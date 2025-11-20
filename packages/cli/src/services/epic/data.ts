// @ts-nocheck
import type { CLIConfig } from "../../types.js";
import { type Epic, ShardedCUEStorage, type Task } from "../../utils/sharded-storage.js";
import type { EpicCreateOptions, EpicOptions, TaskCreateOptions, TaskOptions } from "./types.js";

export interface EpicListFilters {
  status?: string;
  assignee?: string;
  priority?: string;
  shard?: string;
}

export interface TaskListFilters {
  status?: string;
  type?: string;
  assignee?: string;
  priority?: string;
  epicId?: string;
}

export interface StatsResult {
  totalShards: number;
  totalEpics: number;
  totalTasks: number;
  avgEpicsPerShard: number;
  shardUtilization: number;
}

/**
 * Pure data retrieval for epics list with simple in-memory filtering.
 */
export async function listEpicsData(
  filters: EpicListFilters = {},
  _config?: CLIConfig,
): Promise<Epic[]> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();

    let epics = await storage.listEpics(filters.status);

    if (filters.assignee) {
      epics = epics.filter((epic) => epic.assignee === filters.assignee);
    }

    if (filters.priority) {
      epics = epics.filter((epic) => epic.priority === filters.priority);
    }

    if (filters.shard) {
      epics = epics.filter((epic) => epic.arbiter?.shard === filters.shard);
    }

    return epics;
  } finally {
    await storage.close();
  }
}

/**
 * Retrieve a single epic by id.
 */
export async function getEpicById(epicId: string): Promise<Epic | null> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();
    return await storage.getEpic(epicId);
  } finally {
    await storage.close();
  }
}

/**
 * Pure data retrieval for ordered tasks with simple filtering.
 */
export async function listTasksData(
  filters: TaskListFilters = {},
  _config?: CLIConfig,
): Promise<Task[]> {
  const storage = new ShardedCUEStorage();

  try {
    await storage.initialize();

    let tasks = await storage.getOrderedTasks(filters.epicId);

    if (filters.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }

    if (filters.type) {
      tasks = tasks.filter((t) => t.type === filters.type);
    }

    if (filters.assignee) {
      tasks = tasks.filter((t) => t.assignee === filters.assignee);
    }

    if (filters.priority) {
      tasks = tasks.filter((t) => t.priority === filters.priority);
    }

    return tasks;
  } finally {
    await storage.close();
  }
}

/**
 * Storage statistics (exposed for command-level rendering).
 */
export async function getStatsData(): Promise<StatsResult> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();
    return await storage.getStats();
  } finally {
    await storage.close();
  }
}

/**
 * Create a new epic (no console side effects).
 */
export async function createEpicData(
  options: EpicCreateOptions,
  _config?: CLIConfig,
): Promise<{ epic: Epic; shardId: string }> {
  if (!options.name) {
    throw new Error("Epic name is required");
  }

  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();

    const epicId = slugify(options.name);
    const existing = await storage.getEpic(epicId);
    if (existing) {
      throw new Error(`Epic '${epicId}' already exists`);
    }

    const epic: Epic = {
      id: epicId,
      name: options.name,
      description: options.description,
      priority: options.priority || "medium",
      status: "planning",
      owner: options.owner,
      assignee: options.assignee,
      startDate: options.startDate,
      dueDate: options.dueDate,
      tasks: [],
      labels: options.labels ? options.labels.split(",").map((s) => s.trim()) : undefined,
      tags: options.tags ? options.tags.split(",").map((s) => s.trim()) : undefined,
      config: {
        allowParallelTasks: options.allowParallelTasks,
        autoProgress: options.autoProgress,
        requireAllTasks: options.requireAllTasks,
      },
    };

    const shardId = await storage.addEpic(epic);
    return { epic, shardId };
  } finally {
    await storage.close();
  }
}

/**
 * Update an epic (returns updated epic).
 */
export async function updateEpicData(
  epicId: string,
  options: EpicOptions,
  _config?: CLIConfig,
): Promise<Epic> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();

    const epic = await storage.getEpic(epicId);
    if (!epic) {
      throw new Error(`Epic '${epicId}' not found`);
    }

    let updated = false;

    if (
      options.status &&
      ["planning", "in_progress", "completed", "cancelled"].includes(options.status)
    ) {
      epic.status = options.status as Epic["status"];
      updated = true;
    }

    if (options.priority && ["critical", "high", "medium", "low"].includes(options.priority)) {
      epic.priority = options.priority as Epic["priority"];
      updated = true;
    }

    if (options.assignee !== undefined) {
      epic.assignee = options.assignee || undefined;
      updated = true;
    }

    if (!updated) {
      throw new Error("No updates specified");
    }

    await storage.updateEpic(epic);
    return epic;
  } finally {
    await storage.close();
  }
}

export async function deleteEpicData(
  epicId: string,
  options: EpicOptions,
  config?: CLIConfig,
): Promise<Epic> {
  return updateEpicData(epicId, { ...options, status: "cancelled" }, config);
}

/**
 * Create a task within an epic.
 */
export async function createTaskData(
  epicId: string,
  options: TaskCreateOptions,
  _config?: CLIConfig,
): Promise<Task> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();

    const epic = await storage.getEpic(epicId);
    if (!epic) {
      throw new Error(`Epic '${epicId}' not found`);
    }

    if (!options.name) {
      throw new Error("Task name is required");
    }

    const taskId = slugify(options.name);

    if (epic.tasks?.some((t) => t.id === taskId)) {
      throw new Error(`Task '${taskId}' already exists in epic '${epicId}'`);
    }

    const task: Task = {
      id: taskId,
      name: options.name,
      epicId: epic.id,
      description: options.description,
      type: options.type || "feature",
      priority: options.priority || "medium",
      status: "todo",
      assignee: options.assignee,
      reviewer: options.reviewer,
      dependsOn: options.dependsOn ? options.dependsOn.split(",").map((s) => s.trim()) : undefined,
      acceptanceCriteria: options.acceptanceCriteria
        ? options.acceptanceCriteria.split(",").map((s) => s.trim())
        : undefined,
      config: {
        canRunInParallel: options.canRunInParallel,
        requiresReview: options.requiresReview,
        requiresTesting: options.requiresTesting,
        blocksOtherTasks: options.blocksOtherTasks,
      },
    };

    epic.tasks = epic.tasks || [];
    epic.tasks.push(task);

    await storage.updateEpic(epic);
    return task;
  } finally {
    await storage.close();
  }
}

/**
 * Update a task across shards.
 */
export async function updateTaskData(
  taskId: string,
  options: TaskOptions,
  _config?: CLIConfig,
): Promise<Task> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();

    const epics = await storage.listEpics();
    let targetEpic: Epic | null = null;
    let targetTask: Task | null = null;

    for (const epic of epics) {
      const task = epic.tasks?.find((t) => t.id === taskId);
      if (task) {
        targetEpic = epic;
        targetTask = task;
        break;
      }
    }

    if (!targetTask || !targetEpic) {
      throw new Error(`Task '${taskId}' not found`);
    }

    let updated = false;

    if (
      options.status &&
      ["todo", "in_progress", "review", "testing", "completed", "cancelled"].includes(
        options.status,
      )
    ) {
      targetTask.status = options.status as Task["status"];
      updated = true;
    }

    if (options.priority && ["critical", "high", "medium", "low"].includes(options.priority)) {
      targetTask.priority = options.priority as Task["priority"];
      updated = true;
    }

    if (
      options.type &&
      ["feature", "bug", "refactor", "test", "docs", "devops", "research"].includes(options.type)
    ) {
      targetTask.type = options.type as Task["type"];
      updated = true;
    }

    if (options.assignee !== undefined) {
      targetTask.assignee = options.assignee || undefined;
      updated = true;
    }

    if (!updated) {
      throw new Error("No updates specified");
    }

    await storage.updateEpic(targetEpic);
    return targetTask;
  } finally {
    await storage.close();
  }
}

export async function completeTaskData(
  taskId: string,
  options: TaskOptions,
  config?: CLIConfig,
): Promise<Task> {
  return updateTaskData(taskId, { ...options, status: "completed" }, config);
}

/**
 * Dependency graph across tasks (optionally scoped to an epic).
 */
export async function dependencyGraphData(epicId?: string): Promise<{
  nodes: Array<{ id: string; label: string; epicId?: string; status: string; priority: string }>;
  edges: Array<{ from: string; to: string }>;
  tasks: Task[];
}> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();
    const tasks = epicId ? await storage.getOrderedTasks(epicId) : await storage.getOrderedTasks();
    return {
      ...storage.getDependencyGraph(tasks),
      tasks,
    };
  } finally {
    await storage.close();
  }
}

/**
 * Show task details across shards.
 */
export async function getTaskById(taskId: string): Promise<{ epic: Epic; task: Task } | null> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();
    const epics = await storage.listEpics();
    for (const epic of epics) {
      const task = epic.tasks?.find((t) => t.id === taskId);
      if (task) {
        return { epic, task };
      }
    }
    return null;
  } finally {
    await storage.close();
  }
}

export async function readyTasksData(epicId?: string): Promise<Task[]> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();
    const tasks = epicId ? await storage.getOrderedTasks(epicId) : await storage.getOrderedTasks();
    return storage.getReadyTasks(tasks);
  } finally {
    await storage.close();
  }
}

export async function blockedTasksData(epicId?: string): Promise<Task[]> {
  const storage = new ShardedCUEStorage();
  try {
    await storage.initialize();
    const tasks = epicId ? await storage.getOrderedTasks(epicId) : await storage.getOrderedTasks();
    return storage.getBlockedTasks(tasks);
  } finally {
    await storage.close();
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
// @ts-nocheck
