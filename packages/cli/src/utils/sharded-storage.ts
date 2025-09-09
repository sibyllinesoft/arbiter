/**
 * Sharded CUE Storage Implementation
 * 
 * Manages CUE files across multiple shards for better organization and performance.
 * Each shard contains a subset of epics and their tasks, with ordering preserved.
 */

import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { createCUEManipulator, validateCUE, formatCUE } from "../cue/index.js";

// Types for sharded storage management
export interface ShardManifest {
  shardId: string;
  fileName: string;
  epics: Array<{
    id: string;
    status: string;
    lastModified: string;
  }>;
  size: number;
  totalTasks: number;
  created: string;
  lastModified: string;
}

export interface Epic {
  id: string;
  name: string;
  description?: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "planning" | "in_progress" | "completed" | "cancelled";
  owner?: string;
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  tasks: Task[];
  dependencies?: string[];
  labels?: string[];
  tags?: string[];
  config?: {
    allowParallelTasks?: boolean;
    autoProgress?: boolean;
    requireAllTasks?: boolean;
  };
  arbiter?: {
    shard?: string;
    generatedFrom?: string;
    cuePackage?: string;
  };
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  type: "feature" | "bug" | "refactor" | "test" | "docs" | "devops" | "research";
  priority: "critical" | "high" | "medium" | "low";
  status: "todo" | "in_progress" | "review" | "testing" | "completed" | "cancelled";
  assignee?: string;
  reviewer?: string;
  estimatedHours?: number;
  actualHours?: number;
  dependsOn?: string[];
  acceptanceCriteria?: string[];
  config?: {
    canRunInParallel?: boolean;
    requiresReview?: boolean;
    requiresTesting?: boolean;
    blocksOtherTasks?: boolean;
  };
  arbiter?: {
    cueManipulation?: {
      operation: string;
      target?: string;
      parameters?: Record<string, any>;
    };
    generatedCode?: {
      language?: string;
      outputPath?: string;
      template?: string;
    };
    testing?: {
      testTypes?: string[];
      coverage?: number;
    };
  };
}

export interface ShardedStorageConfig {
  baseDir: string;
  manifestFile: string;
  shardPrefix: string;
  maxEpicsPerShard: number;
  autoCreateShards: boolean;
  cuePackage: string;
}

/**
 * Manages sharded CUE storage for epics and tasks
 */
export class ShardedCUEStorage {
  private config: ShardedStorageConfig;
  private manifests: Map<string, ShardManifest> = new Map();
  private cueManipulator: any;

  constructor(config: Partial<ShardedStorageConfig> = {}) {
    this.config = {
      baseDir: ".arbiter/epics",
      manifestFile: ".arbiter/shard-manifest.cue",
      shardPrefix: "epic-shard",
      maxEpicsPerShard: 10,
      autoCreateShards: true,
      cuePackage: "epics",
      ...config,
    };
    
    this.cueManipulator = createCUEManipulator();
  }

  /**
   * Initialize sharded storage directory structure
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.config.baseDir);
    
    // Create initial manifest if it doesn't exist
    if (!fs.existsSync(this.config.manifestFile)) {
      await this.createInitialManifest();
    }
    
    // Load existing manifests
    await this.loadManifests();
  }

  /**
   * Create initial manifest file
   */
  private async createInitialManifest(): Promise<void> {
    const initialManifest = `package ${this.config.cuePackage}

// Shard manifest tracking epic distribution across CUE files
shardManifests: []

// Project configuration
project: {
  name: "Project Epics"
  version: "1.0.0"
  description: "Sharded epic and task storage"
}

config: {
  defaultEpicShard: "epic-shard-1"
  maxEpicsPerShard: ${this.config.maxEpicsPerShard}
  autoCreateShards: ${this.config.autoCreateShards}
}`;

    const formatted = await formatCUE(initialManifest);
    await fs.writeFile(this.config.manifestFile, formatted);
  }

  /**
   * Load all shard manifests from the manifest file
   */
  private async loadManifests(): Promise<void> {
    try {
      const manifestContent = await fs.readFile(this.config.manifestFile, "utf-8");
      const ast = await this.cueManipulator.parse(manifestContent);
      
      if (ast.shardManifests) {
        for (const manifest of ast.shardManifests) {
          this.manifests.set(manifest.shardId, manifest);
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not load shard manifests: ${error}`));
    }
  }

  /**
   * Save manifest changes back to file
   */
  private async saveManifests(): Promise<void> {
    try {
      const manifestContent = await fs.readFile(this.config.manifestFile, "utf-8");
      const manifestArray = Array.from(this.manifests.values());
      
      const updatedContent = await this.cueManipulator.addToSection(
        manifestContent,
        "shardManifests",
        "",
        manifestArray
      );
      
      const formatted = await formatCUE(updatedContent);
      await fs.writeFile(this.config.manifestFile, formatted);
    } catch (error) {
      throw new Error(`Failed to save shard manifests: ${error}`);
    }
  }

  /**
   * Find the appropriate shard for a new epic
   */
  private findAvailableShard(): string | null {
    // Find a shard with space
    for (const [shardId, manifest] of this.manifests) {
      if (manifest.size < this.config.maxEpicsPerShard) {
        return shardId;
      }
    }
    
    // No available shard found
    return null;
  }

  /**
   * Create a new shard
   */
  private async createNewShard(): Promise<string> {
    const shardNumber = this.manifests.size + 1;
    const shardId = `${this.config.shardPrefix}-${shardNumber}`;
    const fileName = `${shardId}.cue`;
    const filePath = path.join(this.config.baseDir, fileName);
    
    // Create the shard file
    const shardContent = `package ${this.config.cuePackage}

// Epic Shard ${shardNumber}
// This file contains a subset of epics for better organization

epics: {
  // Epics in this shard will be added here
}`;

    const formatted = await formatCUE(shardContent);
    await fs.writeFile(filePath, formatted);
    
    // Create manifest entry
    const manifest: ShardManifest = {
      shardId,
      fileName,
      epics: [],
      size: 0,
      totalTasks: 0,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    
    this.manifests.set(shardId, manifest);
    await this.saveManifests();
    
    console.log(chalk.green(`✅ Created new shard: ${shardId}`));
    return shardId;
  }

  /**
   * Add an epic to the appropriate shard
   */
  async addEpic(epic: Epic): Promise<string> {
    // Find available shard or create new one
    let targetShard = epic.arbiter?.shard || this.findAvailableShard();
    
    if (!targetShard) {
      if (this.config.autoCreateShards) {
        targetShard = await this.createNewShard();
      } else {
        throw new Error("No available shards and auto-creation is disabled");
      }
    }
    
    const manifest = this.manifests.get(targetShard);
    if (!manifest) {
      throw new Error(`Shard ${targetShard} not found in manifests`);
    }
    
    // Ensure epic has shard information
    epic.arbiter = {
      ...epic.arbiter,
      shard: targetShard,
      cuePackage: this.config.cuePackage,
    };
    
    // Validate task dependencies
    this.validateTaskDependencies(epic.tasks);
    
    // Sort tasks by dependency order
    epic.tasks = this.sortTasksByDependencies(epic.tasks);
    
    // Load shard file and add epic
    const shardPath = path.join(this.config.baseDir, manifest.fileName);
    let shardContent = "";
    
    if (fs.existsSync(shardPath)) {
      shardContent = await fs.readFile(shardPath, "utf-8");
    } else {
      // Create shard file if it doesn't exist
      shardContent = `package ${this.config.cuePackage}\n\nepics: {}`;
    }
    
    // Add epic using CUE manipulation
    const updatedContent = await this.cueManipulator.addToSection(
      shardContent,
      "epics",
      epic.id,
      epic
    );
    
    // Validate and save
    const validationResult = await validateCUE(updatedContent);
    if (!validationResult.valid) {
      throw new Error(`CUE validation failed: ${validationResult.errors.join(", ")}`);
    }
    
    const formatted = await formatCUE(updatedContent);
    await fs.writeFile(shardPath, formatted);
    
    // Update manifest
    manifest.epics.push({
      id: epic.id,
      status: epic.status,
      lastModified: new Date().toISOString(),
    });
    manifest.size = manifest.epics.length;
    manifest.totalTasks = manifest.epics.reduce((sum, e) => sum + (epic.tasks?.length || 0), 0);
    manifest.lastModified = new Date().toISOString();
    
    await this.saveManifests();
    
    console.log(chalk.green(`✅ Added epic "${epic.name}" to shard ${targetShard}`));
    return targetShard;
  }

  /**
   * Get an epic from its shard
   */
  async getEpic(epicId: string): Promise<Epic | null> {
    // Find which shard contains the epic
    let targetShard: string | null = null;
    
    for (const [shardId, manifest] of this.manifests) {
      if (manifest.epics.some(e => e.id === epicId)) {
        targetShard = shardId;
        break;
      }
    }
    
    if (!targetShard) {
      return null;
    }
    
    const manifest = this.manifests.get(targetShard)!;
    const shardPath = path.join(this.config.baseDir, manifest.fileName);
    
    if (!fs.existsSync(shardPath)) {
      throw new Error(`Shard file ${manifest.fileName} not found`);
    }
    
    const shardContent = await fs.readFile(shardPath, "utf-8");
    const ast = await this.cueManipulator.parse(shardContent);
    
    return ast.epics?.[epicId] || null;
  }

  /**
   * Update an epic in its shard
   */
  async updateEpic(epic: Epic): Promise<void> {
    const existingEpic = await this.getEpic(epic.id);
    if (!existingEpic) {
      throw new Error(`Epic ${epic.id} not found`);
    }
    
    const targetShard = existingEpic.arbiter?.shard;
    if (!targetShard) {
      throw new Error(`Epic ${epic.id} has no shard information`);
    }
    
    // Validate task dependencies and sort by dependency order
    this.validateTaskDependencies(epic.tasks);
    epic.tasks = this.sortTasksByDependencies(epic.tasks);
    
    const manifest = this.manifests.get(targetShard)!;
    const shardPath = path.join(this.config.baseDir, manifest.fileName);
    
    const shardContent = await fs.readFile(shardPath, "utf-8");
    const updatedContent = await this.cueManipulator.addToSection(
      shardContent,
      "epics",
      epic.id,
      epic
    );
    
    // Validate and save
    const validationResult = await validateCUE(updatedContent);
    if (!validationResult.valid) {
      throw new Error(`CUE validation failed: ${validationResult.errors.join(", ")}`);
    }
    
    const formatted = await formatCUE(updatedContent);
    await fs.writeFile(shardPath, formatted);
    
    // Update manifest
    const epicManifest = manifest.epics.find(e => e.id === epic.id);
    if (epicManifest) {
      epicManifest.status = epic.status;
      epicManifest.lastModified = new Date().toISOString();
    }
    
    manifest.lastModified = new Date().toISOString();
    await this.saveManifests();
    
    console.log(chalk.green(`✅ Updated epic "${epic.name}" in shard ${targetShard}`));
  }

  /**
   * List all epics across all shards
   */
  async listEpics(status?: string): Promise<Epic[]> {
    const epics: Epic[] = [];
    
    for (const [shardId, manifest] of this.manifests) {
      const shardPath = path.join(this.config.baseDir, manifest.fileName);
      
      if (!fs.existsSync(shardPath)) {
        console.warn(chalk.yellow(`Warning: Shard file ${manifest.fileName} not found`));
        continue;
      }
      
      try {
        const shardContent = await fs.readFile(shardPath, "utf-8");
        const ast = await this.cueManipulator.parse(shardContent);
        
        if (ast.epics) {
          for (const epicId of Object.keys(ast.epics)) {
            const epic = ast.epics[epicId];
            if (!status || epic.status === status) {
              // Sort tasks by dependency order
              if (epic.tasks) {
                epic.tasks = this.sortTasksByDependencies(epic.tasks);
              }
              epics.push(epic);
            }
          }
        }
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Could not parse shard ${shardId}: ${error}`));
      }
    }
    
    return epics;
  }

  /**
   * Get dependency-ordered tasks across all epics
   */
  async getOrderedTasks(epicId?: string): Promise<Task[]> {
    if (epicId) {
      const epic = await this.getEpic(epicId);
      return epic?.tasks ? this.sortTasksByDependencies(epic.tasks) : [];
    }
    
    const allEpics = await this.listEpics();
    const allTasks: Task[] = [];
    
    for (const epic of allEpics) {
      if (epic.tasks) {
        // Add epic context to tasks for cross-epic dependencies
        const tasksWithEpicContext = epic.tasks.map(task => ({
          ...task,
          epicId: epic.id,
        }));
        allTasks.push(...tasksWithEpicContext);
      }
    }
    
    // Sort by dependencies within each epic, then by epic priority
    return this.sortTasksByDependencies(allTasks);
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalShards: number;
    totalEpics: number;
    totalTasks: number;
    avgEpicsPerShard: number;
    shardUtilization: number;
  }> {
    const totalShards = this.manifests.size;
    let totalEpics = 0;
    let totalTasks = 0;
    
    for (const manifest of this.manifests.values()) {
      totalEpics += manifest.size;
      totalTasks += manifest.totalTasks;
    }
    
    const avgEpicsPerShard = totalShards > 0 ? totalEpics / totalShards : 0;
    const shardUtilization = totalShards > 0 ? 
      (totalEpics / (totalShards * this.config.maxEpicsPerShard)) * 100 : 0;
    
    return {
      totalShards,
      totalEpics,
      totalTasks,
      avgEpicsPerShard,
      shardUtilization,
    };
  }

  /**
   * Validate task dependencies for cycles and missing references
   */
  private validateTaskDependencies(tasks: Task[]): void {
    const taskIds = new Set(tasks.map(t => t.id));
    
    // Check for missing dependencies
    for (const task of tasks) {
      if (task.dependsOn) {
        for (const depId of task.dependsOn) {
          if (!taskIds.has(depId)) {
            throw new Error(`Task "${task.id}" depends on non-existent task "${depId}"`);
          }
        }
      }
    }
    
    // Check for circular dependencies using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) {
        return true; // Found cycle
      }
      
      if (visited.has(taskId)) {
        return false; // Already processed
      }
      
      visited.add(taskId);
      recursionStack.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (task?.dependsOn) {
        for (const depId of task.dependsOn) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(taskId);
      return false;
    };
    
    for (const task of tasks) {
      if (!visited.has(task.id) && hasCycle(task.id)) {
        throw new Error(`Circular dependency detected involving task "${task.id}"`);
      }
    }
  }

  /**
   * Sort tasks by dependencies using topological sorting
   */
  private sortTasksByDependencies(tasks: Task[]): Task[] {
    if (tasks.length === 0) return [];
    
    // Create adjacency list and in-degree count
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize
    for (const task of tasks) {
      adjList.set(task.id, []);
      inDegree.set(task.id, 0);
    }
    
    // Build graph
    for (const task of tasks) {
      if (task.dependsOn) {
        for (const depId of task.dependsOn) {
          // Only consider dependencies within this task set
          if (adjList.has(depId)) {
            adjList.get(depId)!.push(task.id);
            inDegree.set(task.id, inDegree.get(task.id)! + 1);
          }
        }
      }
    }
    
    // Kahn's algorithm for topological sorting
    const queue: string[] = [];
    const result: Task[] = [];
    
    // Find all tasks with no dependencies
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentTask = tasks.find(t => t.id === currentId)!;
      result.push(currentTask);
      
      // Process dependents
      for (const dependentId of adjList.get(currentId)!) {
        inDegree.set(dependentId, inDegree.get(dependentId)! - 1);
        if (inDegree.get(dependentId) === 0) {
          queue.push(dependentId);
        }
      }
    }
    
    // If result doesn't contain all tasks, there was a cycle (shouldn't happen due to validation)
    if (result.length !== tasks.length) {
      throw new Error("Unable to sort tasks - circular dependency detected");
    }
    
    return result;
  }

  /**
   * Get dependency graph for visualization
   */
  getDependencyGraph(tasks: Task[]): {
    nodes: Array<{ id: string; name: string; type: string; status: string }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes = tasks.map(task => ({
      id: task.id,
      name: task.name,
      type: task.type,
      status: task.status,
    }));
    
    const edges: Array<{ from: string; to: string }> = [];
    
    for (const task of tasks) {
      if (task.dependsOn) {
        for (const depId of task.dependsOn) {
          edges.push({ from: depId, to: task.id });
        }
      }
    }
    
    return { nodes, edges };
  }

  /**
   * Get tasks that can be started (no incomplete dependencies)
   */
  getReadyTasks(tasks: Task[]): Task[] {
    return tasks.filter(task => {
      if (task.status === "completed" || task.status === "cancelled") {
        return false;
      }
      
      if (!task.dependsOn || task.dependsOn.length === 0) {
        return true;
      }
      
      // Check if all dependencies are completed
      return task.dependsOn.every(depId => {
        const depTask = tasks.find(t => t.id === depId);
        return depTask?.status === "completed";
      });
    });
  }

  /**
   * Get blocked tasks (have incomplete dependencies)
   */
  getBlockedTasks(tasks: Task[]): Task[] {
    return tasks.filter(task => {
      if (task.status === "completed" || task.status === "cancelled") {
        return false;
      }
      
      if (!task.dependsOn || task.dependsOn.length === 0) {
        return false;
      }
      
      // Check if any dependencies are not completed
      return task.dependsOn.some(depId => {
        const depTask = tasks.find(t => t.id === depId);
        return depTask?.status !== "completed";
      });
    });
  }

  /**
   * Cleanup and close storage
   */
  async close(): Promise<void> {
    await this.cueManipulator.cleanup?.();
  }
}

// Export default instance with standard configuration
export const shardedStorage = new ShardedCUEStorage();