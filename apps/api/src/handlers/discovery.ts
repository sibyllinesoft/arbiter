/**
 * Handler discovery and loading system
 * Dynamically discovers and loads custom webhook handlers
 */

import { access, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { logger as defaultLogger } from '../utils.js';
import { HandlerLoader } from './loader.js';
import type {
  HandlerConfig,
  HandlerDiscoveryConfig,
  HandlerModule,
  HandlerRuntime,
  Logger,
  RegisteredHandler,
} from './types.js';

export class HandlerDiscovery {
  private handlers = new Map<string, RegisteredHandler>();
  private watchers = new Map<string, AbortController>();
  private loader: HandlerLoader;

  constructor(
    private config: HandlerDiscoveryConfig,
    private logger: Logger = defaultLogger
  ) {
    this.loader = new HandlerLoader(this.logger);
  }

  /**
   * Discover all handlers in the configured directory
   */
  async discoverHandlers(): Promise<RegisteredHandler[]> {
    const handlersDir = this.config.handlersDirectory;

    try {
      await access(handlersDir);
    } catch {
      this.logger.warn('Handlers directory not found', { path: handlersDir });
      return [];
    }

    this.logger.info('Starting handler discovery', { directory: handlersDir });

    const handlers: RegisteredHandler[] = [];
    const discoveredHandlers = new Map<string, RegisteredHandler>();

    // Discover GitHub handlers
    const githubHandlers = await this.discoverProviderHandlers(
      join(handlersDir, 'github'),
      'github'
    );
    handlers.push(...githubHandlers);

    // Discover GitLab handlers
    const gitlabHandlers = await this.discoverProviderHandlers(
      join(handlersDir, 'gitlab'),
      'gitlab'
    );
    handlers.push(...gitlabHandlers);

    // Cache discovered handlers
    for (const handler of handlers) {
      discoveredHandlers.set(handler.id, handler);
    }

    this.handlers = discoveredHandlers;

    // Set up file watchers if enabled
    if (this.config.enableAutoReload) {
      await this.setupFileWatchers(handlersDir);
    }

    this.logger.info('Handler discovery completed', {
      totalHandlers: handlers.length,
      githubHandlers: githubHandlers.length,
      gitlabHandlers: gitlabHandlers.length,
    });

    return handlers;
  }

  /**
   * Discover handlers for a specific provider
   */
  private async discoverProviderHandlers(
    providerDir: string,
    provider: 'github' | 'gitlab'
  ): Promise<RegisteredHandler[]> {
    try {
      await access(providerDir);
    } catch {
      this.logger.debug('Provider directory not found', { provider, path: providerDir });
      return [];
    }

    const handlers: RegisteredHandler[] = [];
    const entries = await readdir(providerDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = extname(entry.name);
      if (!['.ts', '.js', '.mts', '.mjs'].includes(ext)) continue;

      const handlerPath = join(providerDir, entry.name);
      const eventName = basename(entry.name, ext);

      try {
        const handlerId = this.createHandlerId(provider, eventName, handlerPath);
        const handler = await this.loadHandler(handlerPath, provider, eventName, handlerId);
        if (handler) {
          handlers.push(handler);
        }
      } catch (error) {
        this.logger.error('Failed to load handler', error as Error, {
          path: handlerPath,
          provider,
          event: eventName,
        });
      }
    }

    return handlers;
  }

  /**
   * Load a single handler file
   */
  private async loadHandler(
    handlerPath: string,
    provider: 'github' | 'gitlab',
    eventName: string,
    handlerId?: string
  ): Promise<RegisteredHandler | null> {
    try {
      this.logger.debug('Loading handler', { path: handlerPath, provider, event: eventName });

      // Security check: validate file path is within handlers directory
      if (!handlerPath.startsWith(this.config.handlersDirectory)) {
        throw new Error('Handler path outside allowed directory');
      }

      const defaultMetadata = {
        name: `${provider} ${eventName} handler`,
        description: `Handler for ${provider} ${eventName} events`,
        version: '1.0.0',
        supportedEvents: [eventName],
        requiredPermissions: [],
      } as HandlerModule['metadata'];

      const provisionalHandler = {
        id: handlerId ?? this.createHandlerId(provider, eventName, handlerPath),
        provider,
        event: eventName,
        handlerPath,
        enabled: true,
        config: {
          enabled: true,
          timeout: this.config.defaultTimeout,
          retries: this.config.defaultRetries,
          environment: {},
          secrets: {},
        },
        runtime: 'local',
        executionCount: 0,
        errorCount: 0,
        metadata: defaultMetadata,
      } as RegisteredHandler;

      const handlerModule = await this.loader.load(provisionalHandler);

      const runtime = this.determineHandlerRuntime(handlerModule, eventName);

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

      this.logger.info('Handler loaded successfully', {
        id: registeredHandler.id,
        provider,
        event: eventName,
        name: registeredHandler.metadata?.name,
        runtime: registeredHandler.runtime,
      });

      return registeredHandler;
    } catch (error) {
      this.logger.error('Handler loading failed', error as Error, {
        path: handlerPath,
        provider,
        event: eventName,
      });
      return null;
    }
  }

  private createHandlerId(
    provider: 'github' | 'gitlab',
    eventName: string,
    handlerPath: string
  ): string {
    const relativePath = relative(this.config.handlersDirectory, handlerPath);
    return `${provider}:${eventName}:${relativePath}`;
  }

  /**
   * Determine the runtime for a handler module and validate its structure
   */
  private determineHandlerRuntime(module: HandlerModule, eventName: string): HandlerRuntime {
    const hasHandler = typeof module.handler === 'function';
    const hasCloudflare = typeof module.cloudflare === 'object' && module.cloudflare !== null;

    if (!hasHandler && !hasCloudflare) {
      throw new Error('Handler module must export a handler function or Cloudflare configuration');
    }

    this.validateHandlerMetadata(module, eventName);

    if (hasHandler) {
      return 'local';
    }

    const cloudflareConfig = module.cloudflare!;
    if (!cloudflareConfig.endpoint) {
      throw new Error('Cloudflare handler configuration must include an endpoint');
    }

    if (cloudflareConfig.type === 'worker') {
      return 'cloudflare-worker';
    }

    if (cloudflareConfig.type === 'durable-object') {
      if (!cloudflareConfig.objectName) {
        throw new Error('Cloudflare durable object handlers require an objectName');
      }
      return 'cloudflare-durable-object';
    }

    throw new Error(
      `Unsupported Cloudflare handler type: ${(cloudflareConfig as { type?: string }).type}`
    );
  }

  private validateHandlerMetadata(module: HandlerModule, eventName: string): void {
    if (module.metadata?.supportedEvents) {
      const supportedEvents = module.metadata.supportedEvents;
      if (!supportedEvents.includes(eventName)) {
        this.logger.warn('Handler event name not in supported events list', {
          eventName,
          supportedEvents,
        });
      }
    }

    if (module.metadata?.requiredPermissions) {
      for (const permission of module.metadata.requiredPermissions) {
        if (typeof permission !== 'string' || !permission.includes(':')) {
          this.logger.warn('Invalid permission format', { permission });
        }
      }
    }
  }

  async registerHandlerFromFile(
    handlerPath: string,
    provider: 'github' | 'gitlab',
    eventName: string
  ): Promise<RegisteredHandler> {
    const handlerId = this.createHandlerId(provider, eventName, handlerPath);
    const handler = await this.loadHandler(handlerPath, provider, eventName, handlerId);

    if (!handler) {
      throw new Error('Failed to load handler after creation');
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
      this.logger.info('File watching not implemented in this example');

      // Example implementation outline:
      // const watcher = fs.watch(handlersDir, { recursive: true });
      // watcher.on('change', (eventType, filename) => {
      //   if (filename && this.isHandlerFile(filename)) {
      //     this.reloadHandler(filename);
      //   }
      // });
    } catch (error) {
      this.logger.error('Failed to setup file watchers', error as Error);
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
  getHandlersForEvent(provider: 'github' | 'gitlab', event: string): RegisteredHandler[] {
    const normalizedEvent = this.normalizeEventName(event);
    const eligibleHandlers = this.getHandlers().filter(h => h.provider === provider && h.enabled);

    const prioritized = new Map<string, RegisteredHandler>();

    for (const handler of eligibleHandlers) {
      const handlerEvent = this.normalizeEventName(handler.event);
      if (handlerEvent === normalizedEvent) {
        prioritized.set(handler.id, handler);
      }
    }

    const fallbackEvents = new Set(['*', 'all', 'default', '__all__', '__default__']);
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

    this.logger.info('Handler configuration updated', { id, updates: Object.keys(updates) });
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

    this.logger.info('Handler state changed', { id, enabled });
    return true;
  }

  /**
   * Remove a handler from registry
   */
  removeHandler(id: string): boolean {
    const removed = this.handlers.delete(id);
    if (removed) {
      this.logger.info('Handler removed', { id });
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
      // Reload handler
      const reloadedHandler = await this.loadHandler(
        existingHandler.handlerPath,
        existingHandler.provider,
        existingHandler.event,
        existingHandler.id
      );

      if (reloadedHandler) {
        // Preserve runtime state
        reloadedHandler.id = existingHandler.id;
        reloadedHandler.executionCount = existingHandler.executionCount;
        reloadedHandler.errorCount = existingHandler.errorCount;
        reloadedHandler.lastExecuted = existingHandler.lastExecuted;

        this.handlers.set(id, reloadedHandler);
        this.logger.info('Handler reloaded', { id });
        return true;
      }
    } catch (error) {
      this.logger.error('Handler reload failed', error as Error, { id });
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
      this.logger.debug('Stopped file watcher', { path });
    }
    this.watchers.clear();

    // Clear handler cache
    this.handlers.clear();

    this.logger.info('Handler discovery disposed');
  }
}
