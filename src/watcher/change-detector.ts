/**
 * Change detection system for tracking file modifications and dependencies
 */

import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { 
  ChangeSet, 
  DependencyGraph, 
  FileState, 
  FileEvent, 
  FileSystemError,
  WatcherError 
} from './types.js';

export interface ChangeDetectorOptions {
  readonly cacheSize: number;
  readonly hashAlgorithm: string;
  readonly dependencyPatterns: readonly RegExp[];
  readonly exclusionPatterns: readonly RegExp[];
  readonly trackContent: boolean;
}

export class ChangeDetector {
  private fileStates = new Map<string, FileState>();
  private dependencyGraph: DependencyGraph = {
    dependencies: new Map(),
    dependents: new Map(),
    lastModified: new Map(),
  };
  
  private readonly defaultOptions: ChangeDetectorOptions = {
    cacheSize: 10000,
    hashAlgorithm: 'sha256',
    dependencyPatterns: [
      /import\s+.*\s+from\s+["']([^"']+)["']/g,      // ES6 imports
      /require\s*\(\s*["']([^"']+)["']\s*\)/g,       // CommonJS requires
      /package\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,         // CUE package declarations
      /#import\s+["']([^"']+)["']/g,                 // CUE imports
    ],
    exclusionPatterns: [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.DS_Store/,
    ],
    trackContent: true,
  };

  constructor(private readonly options: ChangeDetectorOptions = {} as ChangeDetectorOptions) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Process a file system event and determine what validation is needed
   */
  async processFileEvent(event: FileEvent, basePath: string = process.cwd()): Promise<ChangeSet> {
    const absolutePath = resolve(basePath, event.path);
    
    try {
      switch (event.type) {
        case 'add':
        case 'change':
          return await this.handleFileChange(absolutePath, event);
        
        case 'unlink':
          return this.handleFileDelete(absolutePath, event);
        
        case 'addDir':
        case 'unlinkDir':
          return this.handleDirectoryChange(absolutePath, event);
        
        default:
          return this.createEmptyChangeSet('unknown-event', event);
      }
    } catch (error) {
      throw new FileSystemError(
        `Failed to process file event: ${error instanceof Error ? error.message : String(error)}`,
        'process-event',
        absolutePath,
        { event }
      );
    }
  }

  /**
   * Handle file addition or modification
   */
  private async handleFileChange(filePath: string, event: FileEvent): Promise<ChangeSet> {
    if (!this.shouldTrackFile(filePath)) {
      return this.createEmptyChangeSet('excluded-file', event);
    }

    try {
      // Get current file state
      const currentState = await this.getFileState(filePath);
      const previousState = this.fileStates.get(filePath);
      
      // Check if file actually changed
      if (previousState && this.isSameState(currentState, previousState)) {
        return this.createEmptyChangeSet('no-change', event);
      }

      // Update file state cache
      this.fileStates.set(filePath, currentState);
      this.limitCacheSize();

      // Extract dependencies
      const dependencies = await this.extractDependencies(filePath);
      const updatedState = { ...currentState, dependencies };
      this.fileStates.set(filePath, updatedState);

      // Update dependency graph
      this.updateDependencyGraph(filePath, dependencies);

      // Determine affected files
      const affectedFiles = this.getAffectedFiles(filePath);
      const allFiles = new Set([filePath, ...affectedFiles]);

      // Determine validation type
      const validationType = this.determineValidationType(filePath, previousState, dependencies);

      return {
        files: Array.from(allFiles),
        dependencies,
        validationType,
        reason: this.getChangeReason(event.type, filePath, previousState !== undefined),
        timestamp: new Date(),
      };

    } catch (error) {
      throw new FileSystemError(
        `Failed to handle file change: ${error instanceof Error ? error.message : String(error)}`,
        'handle-change',
        filePath,
        { event }
      );
    }
  }

  /**
   * Handle file deletion
   */
  private handleFileDelete(filePath: string, event: FileEvent): ChangeSet {
    const previousState = this.fileStates.get(filePath);
    
    if (!previousState) {
      return this.createEmptyChangeSet('file-not-tracked', event);
    }

    // Remove from cache
    this.fileStates.delete(filePath);
    
    // Get affected files (dependents)
    const affectedFiles = this.getAffectedFiles(filePath);
    
    // Remove from dependency graph
    this.removeDependencyGraphEntry(filePath);

    return {
      files: affectedFiles,
      dependencies: previousState.dependencies,
      validationType: 'full', // Deletion requires full validation of dependents
      reason: `File deleted: ${filePath}`,
      timestamp: new Date(),
    };
  }

  /**
   * Handle directory changes
   */
  private handleDirectoryChange(dirPath: string, event: FileEvent): ChangeSet {
    // For directory changes, we need to check all tracked files in that directory
    const affectedFiles = Array.from(this.fileStates.keys())
      .filter(filePath => filePath.startsWith(dirPath));

    if (event.type === 'unlinkDir') {
      // Remove all files in the deleted directory
      affectedFiles.forEach(filePath => {
        this.fileStates.delete(filePath);
        this.removeDependencyGraphEntry(filePath);
      });
    }

    return {
      files: affectedFiles,
      dependencies: [],
      validationType: 'full',
      reason: `Directory ${event.type}: ${dirPath}`,
      timestamp: new Date(),
    };
  }

  /**
   * Get current state of a file
   */
  private async getFileState(filePath: string): Promise<FileState> {
    try {
      const stats = await stat(filePath);
      let hash = '';
      
      if (this.options.trackContent && stats.isFile()) {
        const content = await readFile(filePath, 'utf-8');
        hash = createHash(this.options.hashAlgorithm).update(content).digest('hex');
      }

      return {
        path: filePath,
        hash,
        mtime: stats.mtime,
        size: stats.size,
        dependencies: [], // Will be populated later
      };
    } catch (error) {
      throw new FileSystemError(
        `Failed to get file state: ${error instanceof Error ? error.message : String(error)}`,
        'stat-file',
        filePath
      );
    }
  }

  /**
   * Extract dependencies from a file
   */
  private async extractDependencies(filePath: string): Promise<string[]> {
    try {
      if (!existsSync(filePath)) {
        return [];
      }

      const content = await readFile(filePath, 'utf-8');
      const dependencies = new Set<string>();
      const fileDir = dirname(filePath);

      for (const pattern of this.options.dependencyPatterns) {
        let match;
        const globalPattern = new RegExp(pattern.source, pattern.flags);
        
        while ((match = globalPattern.exec(content)) !== null) {
          const depPath = match[1];
          if (depPath) {
            // Resolve relative paths
            const resolvedPath = this.resolveDependencyPath(depPath, fileDir);
            if (resolvedPath) {
              dependencies.add(resolvedPath);
            }
          }
        }
      }

      return Array.from(dependencies);
    } catch (error) {
      // Don't throw for dependency extraction failures - just log and return empty
      console.warn(`Failed to extract dependencies from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Resolve a dependency path relative to the importing file
   */
  private resolveDependencyPath(depPath: string, fromDir: string): string | null {
    try {
      // Handle different types of imports
      if (depPath.startsWith('.')) {
        // Relative import
        const resolved = resolve(fromDir, depPath);
        // Try common extensions for CUE files
        for (const ext of ['', '.cue', '.json', '.yaml', '.yml']) {
          const fullPath = resolved + ext;
          if (existsSync(fullPath)) {
            return fullPath;
          }
        }
        return resolved; // Return even if doesn't exist - might be created later
      } else if (!depPath.startsWith('/') && !depPath.includes(':')) {
        // Package import - look in common locations
        const possiblePaths = [
          join(fromDir, depPath + '.cue'),
          join(fromDir, depPath, 'index.cue'),
          join(fromDir, '..', depPath + '.cue'),
          // Add more search paths as needed
        ];
        
        for (const possiblePath of possiblePaths) {
          if (existsSync(possiblePath)) {
            return possiblePath;
          }
        }
      }
      
      return null; // Can't resolve
    } catch {
      return null;
    }
  }

  /**
   * Update dependency graph for a file
   */
  private updateDependencyGraph(filePath: string, dependencies: string[]): void {
    // Remove old dependencies
    const oldDependencies = this.dependencyGraph.dependencies.get(filePath) || new Set();
    for (const oldDep of Array.from(oldDependencies)) {
      const dependents = this.dependencyGraph.dependents.get(oldDep);
      if (dependents) {
        dependents.delete(filePath);
        if (dependents.size === 0) {
          this.dependencyGraph.dependents.delete(oldDep);
        }
      }
    }

    // Add new dependencies
    const newDependencies = new Set(dependencies);
    this.dependencyGraph.dependencies.set(filePath, newDependencies);

    for (const dependency of dependencies) {
      if (!this.dependencyGraph.dependents.has(dependency)) {
        this.dependencyGraph.dependents.set(dependency, new Set());
      }
      this.dependencyGraph.dependents.get(dependency)!.add(filePath);
    }

    // Update modification time
    this.dependencyGraph.lastModified.set(filePath, new Date());
  }

  /**
   * Remove a file from the dependency graph
   */
  private removeDependencyGraphEntry(filePath: string): void {
    // Remove as dependent
    const dependencies = this.dependencyGraph.dependencies.get(filePath) || new Set();
    for (const dependency of Array.from(dependencies)) {
      const dependents = this.dependencyGraph.dependents.get(dependency);
      if (dependents) {
        dependents.delete(filePath);
        if (dependents.size === 0) {
          this.dependencyGraph.dependents.delete(dependency);
        }
      }
    }

    // Remove as dependency
    const dependents = this.dependencyGraph.dependents.get(filePath) || new Set();
    for (const dependent of Array.from(dependents)) {
      const deps = this.dependencyGraph.dependencies.get(dependent);
      if (deps) {
        deps.delete(filePath);
      }
    }

    // Clean up maps
    this.dependencyGraph.dependencies.delete(filePath);
    this.dependencyGraph.dependents.delete(filePath);
    this.dependencyGraph.lastModified.delete(filePath);
  }

  /**
   * Get all files affected by a change to the given file
   */
  private getAffectedFiles(filePath: string): string[] {
    const affected = new Set<string>();
    const toProcess = [filePath];

    while (toProcess.length > 0) {
      const currentFile = toProcess.pop()!;
      const dependents = this.dependencyGraph.dependents.get(currentFile);
      
      if (dependents) {
        for (const dependent of Array.from(dependents)) {
          if (!affected.has(dependent)) {
            affected.add(dependent);
            toProcess.push(dependent); // Process transitive dependents
          }
        }
      }
    }

    return Array.from(affected);
  }

  /**
   * Determine what type of validation is needed
   */
  private determineValidationType(
    filePath: string, 
    previousState: FileState | undefined,
    dependencies: string[]
  ): 'full' | 'incremental' {
    // If it's a new file or dependencies changed, do full validation
    if (!previousState) {
      return 'full';
    }

    const previousDeps = new Set(previousState.dependencies);
    const currentDeps = new Set(dependencies);

    // Check if dependencies changed
    if (previousDeps.size !== currentDeps.size) {
      return 'full';
    }

    for (const dep of currentDeps) {
      if (!previousDeps.has(dep)) {
        return 'full';
      }
    }

    // If only content changed, incremental validation might be sufficient
    return 'incremental';
  }

  /**
   * Check if two file states are the same
   */
  private isSameState(current: FileState, previous: FileState): boolean {
    if (this.options.trackContent) {
      return current.hash === previous.hash;
    }
    
    // Fallback to modification time and size
    return current.mtime.getTime() === previous.mtime.getTime() && 
           current.size === previous.size;
  }

  /**
   * Check if a file should be tracked
   */
  private shouldTrackFile(filePath: string): boolean {
    // Check exclusion patterns
    for (const pattern of this.options.exclusionPatterns) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    // Only track CUE files and related formats
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext === 'cue' || ext === 'json' || ext === 'yaml' || ext === 'yml';
  }

  /**
   * Get human-readable change reason
   */
  private getChangeReason(
    eventType: string, 
    filePath: string, 
    wasTracked: boolean
  ): string {
    const fileName = relative(process.cwd(), filePath);
    
    switch (eventType) {
      case 'add':
        return wasTracked ? `File modified: ${fileName}` : `File added: ${fileName}`;
      case 'change':
        return `File modified: ${fileName}`;
      case 'unlink':
        return `File deleted: ${fileName}`;
      default:
        return `File event (${eventType}): ${fileName}`;
    }
  }

  /**
   * Create an empty change set for cases where no validation is needed
   */
  private createEmptyChangeSet(reason: string, event: FileEvent): ChangeSet {
    return {
      files: [],
      dependencies: [],
      validationType: 'incremental',
      reason: `${reason}: ${event.path}`,
      timestamp: new Date(),
    };
  }

  /**
   * Limit cache size to prevent memory leaks
   */
  private limitCacheSize(): void {
    if (this.fileStates.size <= this.options.cacheSize) {
      return;
    }

    // Remove oldest entries (simple LRU-like behavior)
    const entries = Array.from(this.fileStates.entries());
    entries.sort(([, a], [, b]) => a.mtime.getTime() - b.mtime.getTime());
    
    const toRemove = entries.slice(0, entries.length - this.options.cacheSize);
    for (const [filePath] of toRemove) {
      this.fileStates.delete(filePath);
      this.removeDependencyGraphEntry(filePath);
    }
  }

  /**
   * Get current dependency graph
   */
  getDependencyGraph(): DependencyGraph {
    return {
      dependencies: new Map(this.dependencyGraph.dependencies),
      dependents: new Map(this.dependencyGraph.dependents),
      lastModified: new Map(this.dependencyGraph.lastModified),
    };
  }

  /**
   * Get current file states
   */
  getFileStates(): Map<string, FileState> {
    return new Map(this.fileStates);
  }

  /**
   * Get dependency chain for a file
   */
  getDependencyChain(filePath: string): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();
    
    const collectDependencies = (file: string) => {
      if (visited.has(file)) {
        return; // Avoid cycles
      }
      visited.add(file);
      
      const deps = this.dependencyGraph.dependencies.get(file);
      if (deps) {
        for (const dep of Array.from(deps)) {
          chain.push(dep);
          collectDependencies(dep);
        }
      }
    };
    
    collectDependencies(filePath);
    return Array.from(new Set(chain)); // Remove duplicates
  }

  /**
   * Check for circular dependencies
   */
  detectCircularDependencies(): Array<string[]> {
    const cycles: Array<string[]> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (file: string, path: string[]): void => {
      visited.add(file);
      recursionStack.add(file);
      path.push(file);
      
      const deps = this.dependencyGraph.dependencies.get(file);
      if (deps) {
        for (const dep of Array.from(deps)) {
          if (!visited.has(dep)) {
            dfs(dep, [...path]);
          } else if (recursionStack.has(dep)) {
            // Found a cycle
            const cycleStart = path.indexOf(dep);
            const cycle = path.slice(cycleStart);
            cycle.push(dep); // Complete the cycle
            cycles.push(cycle);
          }
        }
      }
      
      recursionStack.delete(file);
    };
    
    for (const file of Array.from(this.dependencyGraph.dependencies.keys())) {
      if (!visited.has(file)) {
        dfs(file, []);
      }
    }
    
    return cycles;
  }

  /**
   * Clear all cached state
   */
  clear(): void {
    this.fileStates.clear();
    this.dependencyGraph.dependencies.clear();
    this.dependencyGraph.dependents.clear();
    this.dependencyGraph.lastModified.clear();
  }
}