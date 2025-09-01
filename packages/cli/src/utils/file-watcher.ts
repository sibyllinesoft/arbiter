import chokidar from 'chokidar';
import { debounce } from './debounce.js';
import type { CLIConfig } from '../types.js';

export interface FileWatcherOptions {
  /** Paths or patterns to watch */
  paths: string[];
  /** Debounce delay in milliseconds (250-400ms per spec) */
  debounce?: number;
  /** Whether to output NDJSON for agent consumption */
  agentMode?: boolean;
  /** Custom file patterns to watch */
  patterns?: string[];
  /** Ignore patterns */
  ignored?: string[];
}

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
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
      agentMode: options.agentMode ?? false,
      patterns: options.patterns ?? ['**/*.cue', '**/arbiter.assembly.cue', '**/*.json', '**/*.yaml', '**/*.yml'],
      ignored: options.ignored ?? [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        'target/**',
        '**/.DS_Store',
        '**/Thumbs.db'
      ]
    };
  }

  /**
   * Start watching files
   */
  async start(onBatch: (batch: WatchBatch) => Promise<void>): Promise<void> {
    if (this.watcher) {
      throw new Error('Watcher is already running');
    }

    // Create debounced handler for burst coalescing
    this.debouncedHandler = debounce(async () => {
      if (this.eventQueue.length > 0) {
        const batch: WatchBatch = {
          events: [...this.eventQueue],
          timestamp: Date.now(),
          debounceWindow: this.options.debounce
        };

        // Clear the queue before processing
        this.eventQueue = [];

        try {
          await onBatch(batch);
        } catch (error) {
          if (this.options.agentMode) {
            console.log(JSON.stringify({
              type: 'error',
              message: `Watch batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: Date.now()
            }));
          } else {
            console.error(`Watch batch processing failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }, this.options.debounce);

    // Initialize chokidar watcher
    this.watcher = chokidar.watch(this.options.paths, {
      ignored: this.options.ignored,
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false, // Per spec: no symlinks for exFAT/Windows compatibility
      depth: undefined,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      atomic: true // Support atomic writes
    });

    // Set up event handlers
    const handleEvent = (type: WatchEvent['type']) => (path: string) => {
      // Filter by patterns if specified
      if (this.options.patterns.length > 0) {
        const matchesPattern = this.options.patterns.some(pattern => {
          // Simple glob matching - could be enhanced with a proper glob library
          const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\./g, '\\.');
          return new RegExp(regexPattern).test(path);
        });

        if (!matchesPattern) {
          return;
        }
      }

      const event: WatchEvent = {
        type,
        path,
        timestamp: Date.now()
      };

      this.eventQueue.push(event);

      if (this.options.agentMode) {
        // Emit individual event for agent consumption
        console.log(JSON.stringify({
          type: 'file_event',
          event,
          queueSize: this.eventQueue.length
        }));
      }

      // Trigger debounced batch processing
      this.debouncedHandler?.();
    };

    this.watcher
      .on('add', handleEvent('add'))
      .on('change', handleEvent('change'))
      .on('unlink', handleEvent('unlink'))
      .on('addDir', handleEvent('addDir'))
      .on('unlinkDir', handleEvent('unlinkDir'))
      .on('error', (error) => {
        if (this.options.agentMode) {
          console.log(JSON.stringify({
            type: 'watcher_error',
            message: error.message,
            timestamp: Date.now()
          }));
        } else {
          console.error('File watcher error:', error);
        }
      })
      .on('ready', () => {
        if (this.options.agentMode) {
          console.log(JSON.stringify({
            type: 'watcher_ready',
            paths: this.options.paths,
            patterns: this.options.patterns,
            debounce: this.options.debounce,
            timestamp: Date.now()
          }));
        } else {
          console.log(`🔍 Watching ${this.options.paths.join(', ')} (debounce: ${this.options.debounce}ms)`);
        }
      });

    return new Promise((resolve) => {
      this.watcher!.on('ready', () => resolve());
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
      queueSize: this.eventQueue.length
    };
  }
}