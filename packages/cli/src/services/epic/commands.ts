import {
  type EpicListFilters,
  type TaskListFilters,
  blockedTasksData,
  completeTaskData,
  createEpicData,
  createTaskData,
  deleteEpicData,
  dependencyGraphData,
  getEpicById,
  getStatsData,
  getTaskById,
  listEpicsData,
  listTasksData,
  readyTasksData,
  updateEpicData,
  updateTaskData,
} from "@/services/epic/data.js";
import type {
  EpicCreateOptions,
  EpicOptions,
  TaskCreateOptions,
  TaskOptions,
} from "@/services/epic/types.js";
import type { CLIConfig } from "@/types.js";
import { formatJson, formatTable } from "@/utils/formatting.js";
import chalk from "chalk";

export type { EpicOptions, TaskOptions } from "@/services/epic/types.js";

export async function epicCommand(
  action: string,
  epicId: string | undefined,
  options: EpicOptions,
  config: CLIConfig,
): Promise<number> {
  if (action === "create") return await handleEpicCreate(options as EpicCreateOptions);
  if (action === "update" && epicId) return await handleEpicUpdate(epicId, options);
  if (action === "delete" && epicId) return await handleEpicDelete(epicId, options);
  if (action === "list") {
    return await handleEpicList(options);
  }

  if (action === "show" && epicId) {
    return await handleEpicShow(epicId, options);
  }

  if (action === "stats") {
    return await handleEpicStats(options);
  }

  console.error(chalk.red(`Unknown epic action: ${action}`));
  return 1;
}

export async function taskCommand(
  action: string,
  taskId: string | undefined,
  options: TaskOptions,
  config: CLIConfig,
): Promise<number> {
  if (action === "create") {
    return await handleTaskCreate(options.epic!, options);
  }

  if (action === "batch") {
    return await handleTaskBatch(options.epic!, options);
  }

  if (action === "update" && taskId) {
    return await handleTaskUpdate(taskId, options);
  }

  if (action === "complete" && taskId) {
    return await handleTaskComplete(taskId, options);
  }

  if (action === "list") {
    return await handleTaskList(options);
  }

  if (action === "show" && taskId) {
    return await handleTaskShow(taskId, options);
  }

  if (action === "dependency-graph") {
    return await handleDependencyGraph(options);
  }

  if (action === "blocked") {
    return await handleBlockedTasks(options);
  }

  if (action === "ready") {
    return await handleReadyTasks(options);
  }

  console.error(chalk.red(`Unknown task action: ${action}`));
  return 1;
}

async function handleEpicList(options: EpicOptions): Promise<number> {
  const filters: EpicListFilters = {
    status: options.status,
    assignee: options.assignee,
    priority: options.priority,
  };

  const epics = await listEpicsData(filters);

  if (options.format === "json") {
    console.log(formatJson(epics));
    return 0;
  }

  const rows = epics.map((epic) => [
    epic.id,
    epic.name,
    epic.status,
    epic.priority,
    epic.owner ?? "",
    epic.assignee ?? "",
  ]);

  console.log(formatTable(["ID", "Name", "Status", "Priority", "Owner", "Assignee"], rows));

  return 0;
}

async function handleEpicShow(epicId: string, options: EpicOptions): Promise<number> {
  const epic = await getEpicById(epicId);
  if (!epic) {
    console.error(chalk.red(`Epic '${epicId}' not found`));
    return 1;
  }

  if (options.format === "json") {
    console.log(formatJson(epic));
    return 0;
  }

  console.log(chalk.blue(`\n🧭 Epic ${epic.name}`));
  console.log(chalk.dim(`ID: ${epic.id}  Status: ${epic.status}  Priority: ${epic.priority}`));
  console.log(
    chalk.dim(`Owner: ${epic.owner ?? "unassigned"}  Assignee: ${epic.assignee ?? "unassigned"}`),
  );
  console.log(chalk.yellow("\nTasks:"));
  epic.tasks?.forEach((task) => {
    console.log(`  • ${task.id}: ${task.name} (${task.status})`);
  });

  return 0;
}

async function handleEpicCreate(options: EpicCreateOptions): Promise<number> {
  const { epic, shardId } = await createEpicData(options);
  console.log(chalk.green(`✅ Created epic '${epic.id}' in shard ${shardId}`));
  return 0;
}

async function handleEpicUpdate(epicId: string, options: EpicOptions): Promise<number> {
  const updated = await updateEpicData(epicId, options);
  console.log(chalk.green(`✅ Updated epic '${updated.id}' (${updated.status})`));
  return 0;
}

async function handleEpicDelete(epicId: string, options: EpicOptions): Promise<number> {
  const deleted = await deleteEpicData(epicId, options);
  console.log(chalk.yellow(`🗑️  Marked epic '${deleted.id}' as cancelled`));
  return 0;
}

async function handleEpicStats(_options: EpicOptions): Promise<number> {
  const stats = await getStatsData();
  console.log(chalk.blue("\n📊 Sharded Storage Stats"));
  console.log(`  Total shards: ${stats.totalShards}`);
  console.log(`  Total epics: ${stats.totalEpics}`);
  console.log(`  Total tasks: ${stats.totalTasks}`);
  console.log(`  Avg epics/shard: ${stats.avgEpicsPerShard.toFixed(2)}`);
  console.log(`  Shard utilization: ${(stats.shardUtilization * 100).toFixed(1)}%`);
  return 0;
}

async function handleTaskList(options: TaskOptions): Promise<number> {
  const filters: TaskListFilters = {
    status: options.status,
    type: options.type,
    assignee: options.assignee,
    priority: options.priority,
    epicId: options.epic,
  };

  const tasks = await listTasksData(filters);

  if (options.format === "json") {
    console.log(formatJson(tasks));
    return 0;
  }

  const rows = tasks.map((task) => [
    task.id,
    task.name ?? "",
    task.status,
    task.priority,
    task.assignee ?? "",
    task.type ?? "",
  ]);

  console.log(formatTable(["ID", "Name", "Status", "Priority", "Assignee", "Type"], rows));

  return 0;
}

async function handleTaskShow(taskId: string, options: TaskOptions): Promise<number> {
  const record = await getTaskById(taskId);
  if (!record) {
    console.error(chalk.red(`Task '${taskId}' not found`));
    return 1;
  }

  if (options.format === "json") {
    console.log(formatJson(record));
    return 0;
  }

  const { task } = record;

  console.log(chalk.blue(`\n🧭 Task ${task.name}`));
  console.log(chalk.dim(`ID: ${task.id}  Status: ${task.status}  Priority: ${task.priority}`));
  console.log(chalk.dim(`Assignee: ${task.assignee ?? "unassigned"}`));
  console.log(chalk.dim(`Type: ${task.type ?? "unspecified"}`));

  if (task.dependsOn?.length) {
    console.log(chalk.yellow("\nDependencies:"));
    task.dependsOn.forEach((dep) => console.log(`  • ${dep}`));
  }

  return 0;
}

async function handleTaskCreate(epicId: string, options: TaskOptions): Promise<number> {
  const task = await createTaskData(epicId, { ...options, epic: epicId } as TaskCreateOptions);
  console.log(chalk.green(`✅ Created task '${task.id}' in epic ${epicId}`));
  return 0;
}

async function handleTaskBatch(epicId: string, options: TaskOptions): Promise<number> {
  const tasks = parseBatchTasks(options);
  for (const task of tasks) {
    await createTaskData(epicId, { ...task, epic: epicId });
  }
  console.log(chalk.green(`✅ Created ${tasks.length} tasks in epic ${epicId}`));
  return 0;
}

async function handleTaskUpdate(taskId: string, options: TaskOptions): Promise<number> {
  const task = await updateTaskData(taskId, options);
  console.log(chalk.green(`✅ Updated task '${task.id}' (${task.status})`));
  return 0;
}

async function handleTaskComplete(taskId: string, options: TaskOptions): Promise<number> {
  const task = await completeTaskData(taskId, options);
  console.log(chalk.green(`✅ Completed task '${task.id}'`));
  return 0;
}

async function handleDependencyGraph(options: TaskOptions): Promise<number> {
  const graph = await dependencyGraphData(options.epic);
  console.log(formatJson(graph));
  return 0;
}

async function handleBlockedTasks(options: TaskOptions): Promise<number> {
  const tasks = await blockedTasksData(options.epic);
  console.log(formatJson(tasks));
  return 0;
}

async function handleReadyTasks(options: TaskOptions): Promise<number> {
  const tasks = await readyTasksData(options.epic);
  console.log(formatJson(tasks));
  return 0;
}

function parseBatchTasks(options: TaskOptions): Omit<TaskCreateOptions, "epic">[] {
  const tasks =
    typeof options.json === "string"
      ? JSON.parse(options.json)
      : options.file
        ? JSON.parse(require("fs").readFileSync(options.file, "utf-8"))
        : [];

  return tasks.map((task: any) => ({
    name: task.name,
    description: task.description,
    status: task.status || options.status,
    priority: task.priority || options.priority,
    assignee: task.assignee ?? options.assignee,
    reviewer: task.reviewer ?? options.reviewer,
    type: task.type ?? options.type,
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria)
      ? task.acceptanceCriteria.join(",")
      : task.acceptanceCriteria,
    dependsOn: Array.isArray(task.dependencies) ? task.dependencies.join(",") : task.dependencies,
    canRunInParallel: task.canRunInParallel ?? options.canRunInParallel,
    requiresReview: task.requiresReview ?? options.requiresReview,
    requiresTesting: task.requiresTesting ?? options.requiresTesting,
    blocksOtherTasks: task.blocksOtherTasks ?? options.blocksOtherTasks,
  }));
}
