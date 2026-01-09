import { debounce } from "@/utils/util/core/debounce.js";
import chokidar from "chokidar";

export interface FileWatcherOptions {
  /** Paths or patterns to watch */
  paths: string[];
  /** Debounce delay in milliseconds (250-400ms per spec) */
  debounce?: number;
  /** Custom file patterns to watch */
  patterns?: string[];
  /** Ignore patterns */
  ignored?: string[];
}

export interface WatchEvent {
  type: "add" | "change" | "unlink" | "addDir" | "unlinkDir";
  path: string;
  timestamp: number;
}

export interface WatchBatch {
  events: WatchEvent[];
  timestamp: number;
  debounceWindow: number;
}

/**
 * Cross-platform file watcher with debouncing and burst coalescing
 * Implements requirements from arbiter.assembly.cue for 250-400ms debouncing
 */
export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private debouncedHandler: ((...args: any[]) => void) | null = null;
  private eventQueue: WatchEvent[] = [];
  private options: Required<FileWatcherOptions>;

  constructor(options: FileWatcherOptions) {
    this.options = {
      paths: options.paths,
      debounce: Math.max(250, Math.min(400, options.debounce ?? 300)), // Enforce spec limits
      patterns: options.patterns ?? [
        "**/*.cue",
        "**/arbiter.assembly.cue",
        "**/*.json",
        "**/*.yaml",
        "**/*.yml",
      ],
      ignored: options.ignored ?? [
        "node_modules/**",
        ".git/**",
        "dist/**",
        "build/**",
        "target/**",
        "**/.DS_Store",
        "**/Thumbs.db",
      ],
    };
  }

  /**
   * Convert a glob pattern to a regex for matching.
   */
  private globPatternToRegex(pattern: string): RegExp {
    const regexPattern = pattern
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\./g, "\\.");
    return new RegExp(regexPattern);
  }

  /**
   * Check if a path matches any of the configured patterns.
   */
  private matchesPatterns(filePath: string): boolean {
    if (this.options.patterns.length === 0) return true;
    return this.options.patterns.some((pattern) => this.globPatternToRegex(pattern).test(filePath));
  }

  /**
   * Create a batch from the current event queue and clear it.
   */
  private createAndClearBatch(): WatchBatch {
    const batch: WatchBatch = {
      events: [...this.eventQueue],
      timestamp: Date.now(),
      debounceWindow: this.options.debounce,
    };
    this.eventQueue = [];
    return batch;
  }

  /**
   * Process a batch of events with error handling.
   */
  private async processBatch(
    batch: WatchBatch,
    onBatch: (batch: WatchBatch) => Promise<void>,
  ): Promise<void> {
    try {
      await onBatch(batch);
    } catch (error) {
      console.error(
        `Watch batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a debounced handler for batch processing.
   */
  private createDebouncedHandler(
    onBatch: (batch: WatchBatch) => Promise<void>,
  ): (...args: any[]) => void {
    return debounce(async () => {
      if (this.eventQueue.length > 0) {
        const batch = this.createAndClearBatch();
        await this.processBatch(batch, onBatch);
      }
    }, this.options.debounce);
  }

  /**
   * Create event handler for a specific event type.
   */
  private createEventHandler(type: WatchEvent["type"]): (path: string) => void {
    return (filePath: string) => {
      if (!this.matchesPatterns(filePath)) return;

      this.eventQueue.push({
        type,
        path: filePath,
        timestamp: Date.now(),
      });
      this.debouncedHandler?.();
    };
  }

  /**
   * Configure chokidar watcher options.
   */
  private getChokidarOptions(): chokidar.WatchOptions {
    return {
      ignored: this.options.ignored,
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false, // Per spec: no symlinks for exFAT/Windows compatibility
      depth: undefined,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      atomic: true, // Support atomic writes
    };
  }

  /**
   * Start watching files
   */
  async start(onBatch: (batch: WatchBatch) => Promise<void>): Promise<void> {
    if (this.watcher) {
      throw new Error("Watcher is already running");
    }

    this.debouncedHandler = this.createDebouncedHandler(onBatch);
    this.watcher = chokidar.watch(this.options.paths, this.getChokidarOptions());

    this.watcher
      .on("add", this.createEventHandler("add"))
      .on("change", this.createEventHandler("change"))
      .on("unlink", this.createEventHandler("unlink"))
      .on("addDir", this.createEventHandler("addDir"))
      .on("unlinkDir", this.createEventHandler("unlinkDir"))
      .on("error", (error) => {
        console.error("File watcher error:", error);
      })
      .on("ready", () => {
        console.log(
          `🔍 Watching ${this.options.paths.join(", ")} (debounce: ${this.options.debounce}ms)`,
        );
      });

    return new Promise((resolve) => {
      this.watcher?.on("ready", () => resolve());
    });
  }

  /**
   * Stop the file watcher
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    this.debouncedHandler = null;
    this.eventQueue = [];
  }

  /**
   * Get current watch statistics
   */
  getStats(): {
    isWatching: boolean;
    paths: string[];
    patterns: string[];
    debounce: number;
    queueSize: number;
  } {
    return {
      isWatching: this.watcher !== null,
      paths: this.options.paths,
      patterns: this.options.patterns,
      debounce: this.options.debounce,
      queueSize: this.eventQueue.length,
    };
  }
}
