/**
 * Handler discovery and loading system
 * Dynamically discovers and loads custom webhook handlers
 */

import { access, readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { logger as defaultLogger } from "../utils.js";
import { HandlerLoader, type HandlerLoaderOptions } from "./loader.js";
import { CloudflareR2HandlerAdapter } from "./storage/cloudflare-r2.js";
import type {
  HandlerConfig,
  HandlerDiscoveryConfig,
  HandlerModule,
  HandlerRuntime,
  HandlerStorageType,
  Logger,
  RegisteredHandler,
} from "./types.js";

type HandlerProvider = "github" | "gitlab";

interface HandlerSourceDescriptor {
  storage: HandlerStorageType;
  identifier: string;
  provider: HandlerProvider;
  eventName: string;
  extension: string;
  filesystemRoot?: string;
}

interface HandlerDiscoveryAdapters {
  cloudflareR2Adapter?: CloudflareR2HandlerAdapter;
}

export class HandlerDiscovery {
  private handlers = new Map<string, RegisteredHandler>();
  private watchers = new Map<string, AbortController>();
  private loader: HandlerLoader;
  private readonly cloudflareR2Adapter?: CloudflareR2HandlerAdapter;

  constructor(
    private config: HandlerDiscoveryConfig,
    private logger: Logger = defaultLogger,
    adapters: HandlerDiscoveryAdapters = {},
  ) {
    this.cloudflareR2Adapter = adapters.cloudflareR2Adapter;

    const loaderOptions: HandlerLoaderOptions = {
      cloudflareR2Adapter: this.cloudflareR2Adapter,
    };

    this.loader = new HandlerLoader(this.logger, loaderOptions);
  }

  /**
   * Discover all handlers in the configured directory
   */
  async discoverHandlers(): Promise<RegisteredHandler[]> {
    const handlersDir = this.config.handlersDirectory;
    let filesystemAvailable = true;

    try {
      await access(handlersDir);
    } catch {
      filesystemAvailable = false;
      if (this.cloudflareR2Adapter) {
        this.logger.warn("Handlers directory not found. Falling back to Cloudflare R2.", {
          path: handlersDir,
        });
      } else {
        this.logger.warn("Handlers directory not found", { path: handlersDir });
        return [];
      }
    }

    this.logger.info("Starting handler discovery", {
      directory: handlersDir,
      cloudflareR2: Boolean(this.cloudflareR2Adapter),
    });

    const handlers: RegisteredHandler[] = [];
    const discoveredHandlers = new Map<string, RegisteredHandler>();

    const filesystemGithubDir = filesystemAvailable ? join(handlersDir, "github") : undefined;
    const filesystemGitlabDir = filesystemAvailable ? join(handlersDir, "gitlab") : undefined;

    const githubHandlers = await this.discoverProviderHandlers("github", filesystemGithubDir);
    handlers.push(...githubHandlers);

    const gitlabHandlers = await this.discoverProviderHandlers("gitlab", filesystemGitlabDir);
    handlers.push(...gitlabHandlers);

    // Cache discovered handlers
    for (const handler of handlers) {
      discoveredHandlers.set(handler.id, handler);
    }

    this.handlers = discoveredHandlers;

    // Set up file watchers if enabled
    if (filesystemAvailable && this.config.enableAutoReload) {
      await this.setupFileWatchers(handlersDir);
    }

    this.logger.info("Handler discovery completed", {
      totalHandlers: handlers.length,
      githubHandlers: githubHandlers.length,
      gitlabHandlers: gitlabHandlers.length,
    });

    return handlers;
  }

  private async discoverFilesystemHandlers(
    providerDir: string,
    provider: HandlerProvider,
  ): Promise<HandlerSourceDescriptor[]> {
    try {
      await access(providerDir);
    } catch {
      this.logger.debug("Provider directory not found", { provider, path: providerDir });
      return [];
    }

    const descriptors: HandlerSourceDescriptor[] = [];
    const entries = await readdir(providerDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = extname(entry.name);
      if (![".ts", ".js", ".mts", ".mjs", ".cjs"].includes(ext)) continue;

      const handlerPath = join(providerDir, entry.name);
      const eventName = basename(entry.name, ext);

      descriptors.push({
        storage: "filesystem",
        identifier: handlerPath,
        provider,
        eventName,
        extension: ext,
        filesystemRoot: this.config.handlersDirectory,
      });
    }

    return descriptors;
  }

  private async discoverR2Handlers(provider: HandlerProvider): Promise<HandlerSourceDescriptor[]> {
    if (!this.cloudflareR2Adapter) {
      return [];
    }

    const objects = await this.cloudflareR2Adapter.listHandlers(provider);
    return objects.map(
      (object): HandlerSourceDescriptor => ({
        storage: "cloudflare-r2",
        identifier: object.key,
        provider: object.provider,
        eventName: object.eventName,
        extension: object.extension,
      }),
    );
  }

  /**
   * Discover handlers for a specific provider
   */
  private async discoverProviderHandlers(
    provider: HandlerProvider,
    filesystemDir?: string,
  ): Promise<RegisteredHandler[]> {
    const sources: HandlerSourceDescriptor[] = [];

    if (filesystemDir) {
      const filesystemSources = await this.discoverFilesystemHandlers(filesystemDir, provider);
      sources.push(...filesystemSources);
    }

    if (this.cloudflareR2Adapter) {
      const r2Sources = await this.discoverR2Handlers(provider);
      sources.push(...r2Sources);
    }

    if (sources.length === 0) {
      this.logger.debug("No handler sources discovered for provider", { provider });
      return [];
    }

    const handlers: RegisteredHandler[] = [];

    for (const source of sources) {
      try {
        const handlerId = this.createHandlerId(source);
        const handler = await this.loadHandlerFromSource(source, handlerId);
        if (handler) {
          handlers.push(handler);
        }
      } catch (error) {
        this.logger.error("Failed to load handler", error as Error, {
          path: source.identifier,
          provider: source.provider,
          event: source.eventName,
          storage: source.storage,
        });
      }
    }

    return handlers;
  }

  /**
   * Load a single handler file
   */
  private async loadHandlerFromSource(
    source: HandlerSourceDescriptor,
    handlerId?: string,
  ): Promise<RegisteredHandler | null> {
    try {
      this.logger.debug("Loading handler", {
        path: source.identifier,
        provider: source.provider,
        event: source.eventName,
        storage: source.storage,
      });

      if (
        source.storage === "filesystem" &&
        source.filesystemRoot &&
        !source.identifier.startsWith(source.filesystemRoot)
      ) {
        throw new Error("Handler path outside allowed directory");
      }

      const defaultMetadata = {
        name: `${source.provider} ${source.eventName} handler`,
        description: `Handler for ${source.provider} ${source.eventName} events`,
        version: "1.0.0",
        supportedEvents: [source.eventName],
        requiredPermissions: [],
      } as HandlerModule["metadata"];

      const provisionalHandler = {
        id: handlerId ?? this.createHandlerId(source),
        provider: source.provider,
        event: source.eventName,
        handlerPath: source.identifier,
        storage: source.storage,
        enabled: true,
        config: {
          enabled: true,
          timeout: this.config.defaultTimeout,
          retries: this.config.defaultRetries,
          environment: {},
          secrets: {},
        },
        runtime: "local",
        executionCount: 0,
        errorCount: 0,
        metadata: defaultMetadata,
      } as RegisteredHandler;

      const handlerModule = await this.loader.load(provisionalHandler);

      const runtime = this.determineHandlerRuntime(handlerModule, source.eventName);

      const mergedConfig = {
        enabled: handlerModule.config?.enabled ?? true,
        timeout: handlerModule.config?.timeout ?? this.config.defaultTimeout,
        retries: handlerModule.config?.retries ?? this.config.defaultRetries,
        environment: handlerModule.config?.environment ?? {},
        secrets: handlerModule.config?.secrets ?? {},
      } as HandlerConfig;

      const registeredHandler: RegisteredHandler = {
        ...provisionalHandler,
        enabled: mergedConfig.enabled,
        config: mergedConfig,
        runtime,
        cloudflare: handlerModule.cloudflare,
        metadata: handlerModule.metadata || defaultMetadata,
      };

      this.logger.info("Handler loaded successfully", {
        id: registeredHandler.id,
        provider: source.provider,
        event: source.eventName,
        name: registeredHandler.metadata?.name,
        runtime: registeredHandler.runtime,
        storage: source.storage,
      });

      return registeredHandler;
    } catch (error) {
      this.logger.error("Handler loading failed", error as Error, {
        path: source.identifier,
        provider: source.provider,
        event: source.eventName,
        storage: source.storage,
      });
      return null;
    }
  }

  private createHandlerId(source: HandlerSourceDescriptor): string {
    const base = `${source.provider}:${source.eventName}`;

    if (source.storage === "filesystem") {
      const root = source.filesystemRoot ?? this.config.handlersDirectory;
      const relativePath = relative(root, source.identifier);
      return `${base}:${relativePath}`;
    }

    return `${base}:r2:${source.identifier}`;
  }

  /**
   * Determine the runtime for a handler module and validate its structure
   */
  private determineHandlerRuntime(module: HandlerModule, eventName: string): HandlerRuntime {
    const hasHandler = typeof module.handler === "function";
    const hasCloudflare = typeof module.cloudflare === "object" && module.cloudflare !== null;

    if (!hasHandler && !hasCloudflare) {
      throw new Error("Handler module must export a handler function or Cloudflare configuration");
    }

    this.validateHandlerMetadata(module, eventName);

    if (hasHandler) {
      return "local";
    }

    const cloudflareConfig = module.cloudflare!;
    if (!cloudflareConfig.endpoint) {
      throw new Error("Cloudflare handler configuration must include an endpoint");
    }

    if (cloudflareConfig.type === "worker") {
      return "cloudflare-worker";
    }

    if (cloudflareConfig.type === "durable-object") {
      if (!cloudflareConfig.objectName) {
        throw new Error("Cloudflare durable object handlers require an objectName");
      }
      return "cloudflare-durable-object";
    }

    throw new Error(
      `Unsupported Cloudflare handler type: ${(cloudflareConfig as { type?: string }).type}`,
    );
  }

  private validateHandlerMetadata(module: HandlerModule, eventName: string): void {
    if (module.metadata?.supportedEvents) {
      const supportedEvents = module.metadata.supportedEvents;
      if (!supportedEvents.includes(eventName)) {
        this.logger.warn("Handler event name not in supported events list", {
          eventName,
          supportedEvents,
        });
      }
    }

    if (module.metadata?.requiredPermissions) {
      for (const permission of module.metadata.requiredPermissions) {
        if (typeof permission !== "string" || !permission.includes(":")) {
          this.logger.warn("Invalid permission format", { permission });
        }
      }
    }
  }

  async registerHandlerFromFile(
    handlerPath: string,
    provider: "github" | "gitlab",
    eventName: string,
  ): Promise<RegisteredHandler> {
    const descriptor: HandlerSourceDescriptor = {
      storage: "filesystem",
      identifier: handlerPath,
      provider,
      eventName,
      extension: extname(handlerPath),
      filesystemRoot: this.config.handlersDirectory,
    };

    const handlerId = this.createHandlerId(descriptor);
    const handler = await this.loadHandlerFromSource(descriptor, handlerId);

    if (!handler) {
      throw new Error("Failed to load handler after creation");
    }

    this.handlers.set(handler.id, handler);
    return handler;
  }

  /**
   * Set up file watchers for auto-reload
   */
  private async setupFileWatchers(handlersDir: string): Promise<void> {
    try {
      // Note: In a real implementation, you'd use fs.watch or a library like chokidar
      this.logger.info("File watching not implemented in this example");

      // Example implementation outline:
      // const watcher = fs.watch(handlersDir, { recursive: true });
      // watcher.on('change', (eventType, filename) => {
      //   if (filename && this.isHandlerFile(filename)) {
      //     this.reloadHandler(filename);
      //   }
      // });
    } catch (error) {
      this.logger.error("Failed to setup file watchers", error as Error);
    }
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): RegisteredHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get handlers for a specific provider and event
   */
  getHandlersForEvent(provider: "github" | "gitlab", event: string): RegisteredHandler[] {
    const normalizedEvent = this.normalizeEventName(event);
    const eligibleHandlers = this.getHandlers().filter((h) => h.provider === provider && h.enabled);

    const prioritized = new Map<string, RegisteredHandler>();

    for (const handler of eligibleHandlers) {
      const handlerEvent = this.normalizeEventName(handler.event);
      if (handlerEvent === normalizedEvent) {
        prioritized.set(handler.id, handler);
      }
    }

    const fallbackEvents = new Set(["*", "all", "default", "__all__", "__default__"]);
    for (const handler of eligibleHandlers) {
      const handlerEvent = this.normalizeEventName(handler.event);
      if (fallbackEvents.has(handlerEvent) && !prioritized.has(handler.id)) {
        prioritized.set(handler.id, handler);
      }
    }

    return Array.from(prioritized.values());
  }

  private normalizeEventName(event: string): string {
    return event.trim().toLowerCase();
  }

  /**
   * Get a specific handler by ID
   */
  getHandler(id: string): RegisteredHandler | undefined {
    return this.handlers.get(id);
  }

  /**
   * Update handler configuration
   */
  updateHandlerConfig(id: string, updates: Partial<RegisteredHandler>): boolean {
    const handler = this.handlers.get(id);
    if (!handler) return false;

    // Merge updates
    Object.assign(handler, updates);
    this.handlers.set(id, handler);

    this.logger.info("Handler configuration updated", { id, updates: Object.keys(updates) });
    return true;
  }

  /**
   * Enable or disable a handler
   */
  setHandlerEnabled(id: string, enabled: boolean): boolean {
    const handler = this.handlers.get(id);
    if (!handler) return false;

    handler.enabled = enabled;
    handler.config.enabled = enabled;
    this.handlers.set(id, handler);

    this.logger.info("Handler state changed", { id, enabled });
    return true;
  }

  /**
   * Remove a handler from registry
   */
  removeHandler(id: string): boolean {
    const removed = this.handlers.delete(id);
    if (removed) {
      this.logger.info("Handler removed", { id });
    }
    return removed;
  }

  /**
   * Reload handler from file
   */
  async reloadHandler(id: string): Promise<boolean> {
    const existingHandler = this.handlers.get(id);
    if (!existingHandler) return false;

    try {
      const descriptor: HandlerSourceDescriptor = {
        storage: existingHandler.storage ?? "filesystem",
        identifier: existingHandler.handlerPath,
        provider: existingHandler.provider,
        eventName: existingHandler.event,
        extension: extname(existingHandler.handlerPath),
        filesystemRoot:
          (existingHandler.storage ?? "filesystem") === "filesystem"
            ? this.config.handlersDirectory
            : undefined,
      };

      const reloadedHandler = await this.loadHandlerFromSource(descriptor, existingHandler.id);

      if (reloadedHandler) {
        // Preserve runtime state
        reloadedHandler.id = existingHandler.id;
        reloadedHandler.executionCount = existingHandler.executionCount;
        reloadedHandler.errorCount = existingHandler.errorCount;
        reloadedHandler.lastExecuted = existingHandler.lastExecuted;

        this.handlers.set(id, reloadedHandler);
        this.logger.info("Handler reloaded", { id });
        return true;
      }
    } catch (error) {
      this.logger.error("Handler reload failed", error as Error, { id });
    }

    return false;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Stop all file watchers
    for (const [path, controller] of this.watchers) {
      controller.abort();
      this.logger.debug("Stopped file watcher", { path });
    }
    this.watchers.clear();

    // Clear handler cache
    this.handlers.clear();

    this.logger.info("Handler discovery disposed");
  }
}
