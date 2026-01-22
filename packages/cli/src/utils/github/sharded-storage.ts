/**
 * @packageDocumentation
 * Implements sharded persistence helpers for group and task specifications.
 */

import path from "node:path";
import { getCueManipulator } from "@/constraints/cli-integration.js";
import { safeFileOperation } from "@/constraints/index.js";
import { formatCUE, validateCUE } from "@/cue/index.js";
import chalk from "chalk";
import fs from "fs-extra";

// Types for sharded storage management
/**
 * Serialized representation of an on-disk shard manifest.
 *
 * @public
 */
export interface ShardManifest {
  shardId: string;
  fileName: string;
  groups: Array<{
    id: string;
    status: string;
    lastModified: string;
  }>;
  size: number;
  totalTasks: number;
  created: string;
  lastModified: string;
}

/**
 * External source types for tracking where entities originated.
 *
 * @public
 */
export type ExternalSource = "local" | "github" | "gitlab" | "jira" | "linear";

/**
 * Group type for sync identification.
 * Milestones and epics are just groups with a specific type.
 *
 * @public
 */
export type GroupType = "group" | "milestone" | "epic" | "release" | "sprint" | "iteration";

/**
 * High-level group description stored in CUE.
 * Groups can represent milestones, epics, releases, or sprints.
 *
 * @public
 */
export interface Group {
  id: string;
  name: string;
  description?: string;
  /** Group type - identifies what this group represents for sync purposes */
  type?: GroupType;
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
  /** Parent group for nested groups (e.g., epic belongs to milestone) */
  memberOf?: string;
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
  // External source tracking for GitHub/GitLab sync
  /** Where this group originated */
  source?: ExternalSource;
  /** External system ID (e.g., GitHub milestone number) */
  externalId?: string;
  /** Full URL to the group in the external system */
  externalUrl?: string;
  /** Repository in the external system (e.g., "owner/repo") */
  externalRepo?: string;
}

/**
 * Task representation associated with an group shard.
 * Tasks map to GitHub/GitLab issues.
 *
 * @public
 */
export interface Task {
  id: string;
  name: string;
  groupId?: string | null;
  description?: string;
  type: "feature" | "bug" | "refactor" | "test" | "docs" | "devops" | "research";
  priority: "critical" | "high" | "medium" | "low";
  status: "todo" | "in_progress" | "review" | "testing" | "completed" | "cancelled";
  assignee?: string;
  /** Multiple assignees (GitHub/GitLab compatible) */
  assignees?: string[];
  reviewer?: string;
  estimatedHours?: number;
  actualHours?: number;
  dependsOn?: string[];
  acceptanceCriteria?: string[];
  labels?: string[];
  /** Parent group for membership */
  memberOf?: string;
  /** Milestone group reference (for GitHub/GitLab milestone sync) */
  milestone?: string;
  /** Story points / weight (GitLab weight, Jira points) */
  weight?: number;
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
  // External source tracking for GitHub/GitLab sync
  /** Where this task originated */
  source?: ExternalSource;
  /** External system issue ID (e.g., GitHub issue number) */
  externalId?: string;
  /** Full URL to the issue in the external system */
  externalUrl?: string;
  /** Repository in the external system (e.g., "owner/repo") */
  externalRepo?: string;
}

/**
 * Runtime configuration for the sharded storage helper.
 *
 * @public
 */
export interface ShardedStorageConfig {
  baseDir: string;
  manifestFile: string;
  shardPrefix: string;
  maxGroupsPerShard: number;
  autoCreateShards: boolean;
  cuePackage: string;
}

/**
 * Coordinates reading and writing groups across multiple shard files.
 *
 * @public
 */
export class ShardedCUEStorage {
  private config: ShardedStorageConfig;
  private manifests: Map<string, ShardManifest> = new Map();
  private cueManipulator: any;

  constructor(config: Partial<ShardedStorageConfig> = {}) {
    this.config = {
      baseDir: ".arbiter/groups",
      manifestFile: ".arbiter/shard-manifest.cue",
      shardPrefix: "group-shard",
      maxGroupsPerShard: 10,
      autoCreateShards: true,
      cuePackage: "groups",
      ...config,
    };

    this.cueManipulator = getCueManipulator();
  }

  private ensureGroupIssueContext(group: Group): Group {
    if (!Array.isArray(group.tasks)) {
      group.tasks = [];
      return group;
    }

    group.tasks = group.tasks.map((task) => ({
      ...task,
      groupId: task.groupId ?? group.id,
    }));

    return group;
  }

  /**
   * Ensures directories and manifests are ready for use.
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
   * Creates a minimal manifest file when no shards exist.
   */
  private async createInitialManifest(): Promise<void> {
    const initialManifest = `package ${this.config.cuePackage}

// Shard manifest tracking group distribution across CUE files
shardManifests: []

// Project configuration
project: {
  name: "Project Groups"
  version: "1.0.0"
  description: "Sharded group and task storage"
}

config: {
  defaultGroupShard: "group-shard-1"
  maxGroupsPerShard: ${this.config.maxGroupsPerShard}
  autoCreateShards: ${this.config.autoCreateShards}
}`;

    const formatted = await formatCUE(initialManifest);
    await this.writeFileSafely(this.config.manifestFile, formatted);
  }

  /**
   * Loads manifest metadata from disk so shard operations can be resolved quickly.
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
   * Persists the in-memory manifest collection back to disk.
   */
  private async saveManifests(): Promise<void> {
    try {
      const manifestContent = await fs.readFile(this.config.manifestFile, "utf-8");
      const manifestArray = Array.from(this.manifests.values());

      const updatedContent = await this.cueManipulator.addToSection(
        manifestContent,
        "shardManifests",
        "",
        manifestArray,
      );

      const formatted = await formatCUE(updatedContent);
      await this.writeFileSafely(this.config.manifestFile, formatted);
    } catch (error) {
      throw new Error(`Failed to save shard manifests: ${error}`);
    }
  }

  /**
   * Find the appropriate shard for a new group
   */
  private findAvailableShard(): string | null {
    // Find a shard with space
    for (const [shardId, manifest] of this.manifests) {
      if (manifest.size < this.config.maxGroupsPerShard) {
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

// Group Shard ${shardNumber}
// This file contains a subset of groups for better organization

groups: {
  // Groups in this shard will be added here
}`;

    const formatted = await formatCUE(shardContent);
    await this.writeFileSafely(filePath, formatted);

    // Create manifest entry
    const manifest: ShardManifest = {
      shardId,
      fileName,
      groups: [],
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
   * Resolve target shard for group, creating if needed
   */
  private async resolveTargetShard(group: Group): Promise<string> {
    const targetShard = group.arbiter?.shard || this.findAvailableShard();

    if (targetShard) {
      return targetShard;
    }

    if (this.config.autoCreateShards) {
      return this.createNewShard();
    }

    throw new Error("No available shards and auto-creation is disabled");
  }

  /**
   * Load or create initial shard content
   */
  private async loadShardContent(shardPath: string): Promise<string> {
    if (fs.existsSync(shardPath)) {
      return fs.readFile(shardPath, "utf-8");
    }
    return `package ${this.config.cuePackage}\n\ngroups: {}`;
  }

  /**
   * Validate and write CUE content to shard file
   */
  private async validateAndWriteShard(shardPath: string, content: string): Promise<void> {
    const validationResult = await validateCUE(content);
    if (!validationResult.valid) {
      throw new Error(`CUE validation failed: ${validationResult.errors.join(", ")}`);
    }

    const formatted = await formatCUE(content);
    await this.writeFileSafely(shardPath, formatted);
  }

  /**
   * Update manifest after adding group
   */
  private updateManifestForNewGroup(manifest: ShardManifest, group: Group): void {
    manifest.groups.push({
      id: group.id,
      status: group.status,
      lastModified: new Date().toISOString(),
    });
    manifest.size = manifest.groups.length;
    manifest.totalTasks = (manifest.totalTasks || 0) + (group.tasks?.length || 0);
    manifest.lastModified = new Date().toISOString();
  }

  /**
   * Prepare group for storage with shard info and sorted tasks
   */
  private prepareGroupForStorage(group: Group, targetShard: string): void {
    group.arbiter = {
      ...group.arbiter,
      shard: targetShard,
      cuePackage: this.config.cuePackage,
    };

    this.ensureGroupIssueContext(group);
    this.validateTaskDependencies(group.tasks);
    group.tasks = this.sortTasksByDependencies(group.tasks);
  }

  /**
   * Add an group to the appropriate shard
   */
  async addGroup(group: Group): Promise<string> {
    const targetShard = await this.resolveTargetShard(group);

    const manifest = this.manifests.get(targetShard);
    if (!manifest) {
      throw new Error(`Shard ${targetShard} not found in manifests`);
    }

    this.prepareGroupForStorage(group, targetShard);

    const shardPath = path.join(this.config.baseDir, manifest.fileName);
    const shardContent = await this.loadShardContent(shardPath);

    const updatedContent = await this.cueManipulator.addToSection(
      shardContent,
      "groups",
      group.id,
      group,
    );

    await this.validateAndWriteShard(shardPath, updatedContent);

    this.updateManifestForNewGroup(manifest, group);
    await this.saveManifests();

    console.log(chalk.green(`✅ Added group "${group.name}" to shard ${targetShard}`));
    return targetShard;
  }

  /**
   * Find shard containing a group by ID
   */
  private findShardForGroup(groupId: string): string | null {
    for (const [shardId, manifest] of this.manifests) {
      if (manifest.groups.some((e) => e.id === groupId)) {
        return shardId;
      }
    }
    return null;
  }

  /**
   * Load and parse group from shard content
   */
  private async loadGroupFromShard(shardPath: string, groupId: string): Promise<Group | null> {
    const shardContent = await fs.readFile(shardPath, "utf-8");
    const ast = await this.cueManipulator.parse(shardContent);
    const group = ast.groups?.[groupId] || null;

    if (!group) {
      return null;
    }

    if (!group.id) {
      group.id = groupId;
    }

    return this.ensureGroupIssueContext(group);
  }

  /**
   * Get an group from its shard
   */
  async getGroup(groupId: string): Promise<Group | null> {
    const targetShard = this.findShardForGroup(groupId);
    if (!targetShard) {
      return null;
    }

    const manifest = this.manifests.get(targetShard)!;
    const shardPath = path.join(this.config.baseDir, manifest.fileName);

    if (!fs.existsSync(shardPath)) {
      throw new Error(`Shard file ${manifest.fileName} not found`);
    }

    return this.loadGroupFromShard(shardPath, groupId);
  }

  /**
   * Update an group in its shard
   */
  async updateGroup(group: Group): Promise<void> {
    const existingGroup = await this.getGroup(group.id);
    if (!existingGroup) {
      throw new Error(`Group ${group.id} not found`);
    }

    const targetShard = existingGroup.arbiter?.shard;
    if (!targetShard) {
      throw new Error(`Group ${group.id} has no shard information`);
    }

    // Validate task dependencies and sort by dependency order
    this.ensureGroupIssueContext(group);
    this.validateTaskDependencies(group.tasks);
    group.tasks = this.sortTasksByDependencies(group.tasks);

    const manifest = this.manifests.get(targetShard)!;
    const shardPath = path.join(this.config.baseDir, manifest.fileName);

    const shardContent = await fs.readFile(shardPath, "utf-8");
    const updatedContent = await this.cueManipulator.addToSection(
      shardContent,
      "groups",
      group.id,
      group,
    );

    // Validate and save
    const validationResult = await validateCUE(updatedContent);
    if (!validationResult.valid) {
      throw new Error(`CUE validation failed: ${validationResult.errors.join(", ")}`);
    }

    const formatted = await formatCUE(updatedContent);
    await this.writeFileSafely(shardPath, formatted);

    // Update manifest
    const groupManifest = manifest.groups.find((e) => e.id === group.id);
    if (groupManifest) {
      groupManifest.status = group.status;
      groupManifest.lastModified = new Date().toISOString();
    }

    const previousTaskCount = existingGroup.tasks?.length ?? 0;
    const newTaskCount = group.tasks?.length ?? 0;
    manifest.totalTasks = (manifest.totalTasks || 0) - previousTaskCount + newTaskCount;
    manifest.lastModified = new Date().toISOString();
    await this.saveManifests();

    console.log(chalk.green(`✅ Updated group "${group.name}" in shard ${targetShard}`));
  }

  /**
   * Process a single group from AST and return if it matches status filter.
   */
  private processGroupEntry(
    groupId: string,
    groupAst: any,
    status: string | undefined,
  ): Group | null {
    if (groupAst && !groupAst.id) {
      groupAst.id = groupId;
    }

    const group = this.ensureGroupIssueContext(groupAst);
    if (status && group.status !== status) {
      return null;
    }

    if (group.tasks) {
      group.tasks = this.sortTasksByDependencies(group.tasks);
    }
    return group;
  }

  /**
   * Extract groups from a parsed shard AST
   */
  private extractGroupsFromAst(ast: any, status: string | undefined): Group[] {
    if (!ast.groups) return [];

    const groups: Group[] = [];
    for (const groupId of Object.keys(ast.groups)) {
      const group = this.processGroupEntry(groupId, ast.groups[groupId], status);
      if (group) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Parse groups from a single shard file
   */
  private async parseShardGroups(
    shardId: string,
    manifest: { fileName: string },
    status: string | undefined,
  ): Promise<Group[]> {
    const shardPath = path.join(this.config.baseDir, manifest.fileName);

    if (!fs.existsSync(shardPath)) {
      console.warn(chalk.yellow(`Warning: Shard file ${manifest.fileName} not found`));
      return [];
    }

    try {
      const shardContent = await fs.readFile(shardPath, "utf-8");
      const ast = await this.cueManipulator.parse(shardContent);
      return this.extractGroupsFromAst(ast, status);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not parse shard ${shardId}: ${error}`));
      return [];
    }
  }

  /**
   * List all groups across all shards
   */
  async listGroups(status?: string): Promise<Group[]> {
    const groups: Group[] = [];

    for (const [shardId, manifest] of this.manifests) {
      const shardGroups = await this.parseShardGroups(shardId, manifest, status);
      groups.push(...shardGroups);
    }

    return groups;
  }

  /**
   * Get dependency-ordered tasks across all groups
   */
  async getOrderedTasks(groupId?: string): Promise<Task[]> {
    if (groupId) {
      const group = await this.getGroup(groupId);
      return group?.tasks ? this.sortTasksByDependencies(group.tasks) : [];
    }

    const allGroups = await this.listGroups();
    const allTasks: Task[] = [];

    for (const group of allGroups) {
      if (group.tasks) {
        // Add group context to tasks for cross-group dependencies
        const issuesWithGroupContext = group.tasks.map((task) => ({
          ...task,
          groupId: group.id,
        }));
        allTasks.push(...issuesWithGroupContext);
      }
    }

    // Sort by dependencies within each group, then by group priority
    return this.sortTasksByDependencies(allTasks);
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalShards: number;
    totalGroups: number;
    totalTasks: number;
    avgGroupsPerShard: number;
    shardUtilization: number;
  }> {
    const totalShards = this.manifests.size;
    let totalGroups = 0;
    let totalTasks = 0;

    for (const manifest of this.manifests.values()) {
      totalGroups += manifest.size;
      totalTasks += manifest.totalTasks;
    }

    const avgGroupsPerShard = totalShards > 0 ? totalGroups / totalShards : 0;
    const shardUtilization =
      totalShards > 0 ? (totalGroups / (totalShards * this.config.maxGroupsPerShard)) * 100 : 0;

    return {
      totalShards,
      totalGroups,
      totalTasks,
      avgGroupsPerShard,
      shardUtilization,
    };
  }

  /**
   * Check for missing dependencies in tasks
   */
  private checkMissingDependencies(tasks: Task[], taskIds: Set<string>): void {
    for (const task of tasks) {
      if (!task.dependsOn) continue;
      for (const depId of task.dependsOn) {
        if (!taskIds.has(depId)) {
          throw new Error(`Task "${task.id}" depends on non-existent task "${depId}"`);
        }
      }
    }
  }

  /**
   * Check for cycles in task dependencies using DFS
   */
  private checkCyclicDependencies(tasks: Task[]): void {
    const context = this.createCycleDetectionContext(tasks);

    for (const task of tasks) {
      if (!context.visited.has(task.id)) {
        const cycleFound = this.detectCycleFromNode(task.id, context);
        if (cycleFound) {
          throw new Error(`Circular dependency detected involving task "${task.id}"`);
        }
      }
    }
  }

  private createCycleDetectionContext(tasks: Task[]): {
    visited: Set<string>;
    recursionStack: Set<string>;
    taskMap: Map<string, Task>;
  } {
    return {
      visited: new Set<string>(),
      recursionStack: new Set<string>(),
      taskMap: new Map(tasks.map((t) => [t.id, t])),
    };
  }

  private detectCycleFromNode(
    taskId: string,
    context: { visited: Set<string>; recursionStack: Set<string>; taskMap: Map<string, Task> },
  ): boolean {
    if (context.recursionStack.has(taskId)) return true;
    if (context.visited.has(taskId)) return false;

    context.visited.add(taskId);
    context.recursionStack.add(taskId);

    const task = context.taskMap.get(taskId);
    if (task?.dependsOn) {
      for (const depId of task.dependsOn) {
        if (this.detectCycleFromNode(depId, context)) return true;
      }
    }

    context.recursionStack.delete(taskId);
    return false;
  }

  /**
   * Validate task dependencies for cycles and missing references
   */
  private validateTaskDependencies(tasks: Task[]): void {
    const taskIds = new Set(tasks.map((t) => t.id));
    this.checkMissingDependencies(tasks, taskIds);
    this.checkCyclicDependencies(tasks);
  }

  /**
   * Initialize adjacency list and in-degree maps for topological sort
   */
  private initializeGraphMaps(tasks: Task[]): {
    adjList: Map<string, string[]>;
    inDegree: Map<string, number>;
  } {
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const task of tasks) {
      adjList.set(task.id, []);
      inDegree.set(task.id, 0);
    }

    return { adjList, inDegree };
  }

  /**
   * Build dependency graph edges from task dependencies
   */
  private buildDependencyGraph(
    tasks: Task[],
    adjList: Map<string, string[]>,
    inDegree: Map<string, number>,
  ): void {
    for (const task of tasks) {
      if (!task.dependsOn) continue;
      for (const depId of task.dependsOn) {
        if (adjList.has(depId)) {
          adjList.get(depId)?.push(task.id);
          inDegree.set(task.id, inDegree.get(task.id)! + 1);
        }
      }
    }
  }

  /**
   * Execute Kahn's algorithm for topological sorting
   */
  private executeTopologicalSort(
    tasks: Task[],
    adjList: Map<string, string[]>,
    inDegree: Map<string, number>,
  ): Task[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const queue: string[] = [];
    const result: Task[] = [];

    for (const [taskId, degree] of inDegree) {
      if (degree === 0) queue.push(taskId);
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      result.push(taskMap.get(currentId)!);

      for (const dependentId of adjList.get(currentId)!) {
        inDegree.set(dependentId, inDegree.get(dependentId)! - 1);
        if (inDegree.get(dependentId) === 0) {
          queue.push(dependentId);
        }
      }
    }

    return result;
  }

  /**
   * Sort tasks by dependencies using topological sorting
   */
  private sortTasksByDependencies(tasks: Task[]): Task[] {
    if (tasks.length === 0) return [];

    const { adjList, inDegree } = this.initializeGraphMaps(tasks);
    this.buildDependencyGraph(tasks, adjList, inDegree);
    const result = this.executeTopologicalSort(tasks, adjList, inDegree);

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
    const nodes = tasks.map((task) => ({
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
    return tasks.filter((task) => {
      if (task.status === "completed" || task.status === "cancelled") {
        return false;
      }

      if (!task.dependsOn || task.dependsOn.length === 0) {
        return true;
      }

      // Check if all dependencies are completed
      return task.dependsOn.every((depId) => {
        const depTask = tasks.find((t) => t.id === depId);
        return depTask?.status === "completed";
      });
    });
  }

  /**
   * Get blocked tasks (have incomplete dependencies)
   */
  getBlockedTasks(tasks: Task[]): Task[] {
    return tasks.filter((task) => {
      if (task.status === "completed" || task.status === "cancelled") {
        return false;
      }

      if (!task.dependsOn || task.dependsOn.length === 0) {
        return false;
      }

      // Check if any dependencies are not completed
      return task.dependsOn.some((depId) => {
        const depTask = tasks.find((t) => t.id === depId);
        return depTask?.status !== "completed";
      });
    });
  }

  private async writeFileSafely(filePath: string, content: string): Promise<void> {
    await safeFileOperation("write", filePath, async (validatedPath) => {
      await fs.writeFile(validatedPath, content, "utf-8");
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
