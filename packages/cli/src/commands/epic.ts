import chalk from "chalk";
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
} from "../services/epic/data.js";
import type { EpicOptions, TaskOptions } from "../services/epic/index.js";
import {
  epicCommand as runEpicCommand,
  taskCommand as runTaskCommand,
} from "../services/epic/index.js";
import type { CLIConfig } from "../types.js";
import { formatJson, formatTable } from "../utils/formatting.js";
import { type Epic as EpicModel, ShardedCUEStorage } from "../utils/sharded-storage.js";

export type { EpicOptions, TaskOptions } from "../services/epic/index.js";

export async function epicCommand(
  action: string,
  epicId: string | undefined,
  options: EpicOptions,
  config: CLIConfig,
): Promise<number> {
  if (action === "create") return await handleEpicCreate(options);
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

  // Fall back to legacy implementation for create/update/delete/etc.
  return await runEpicCommand(action, epicId, options, config);
}

export async function taskCommand(
  action: string,
  taskId: string | undefined,
  options: TaskOptions,
  config: CLIConfig,
): Promise<number> {
  if (action === "create") return await handleTaskCreate(taskId, options);
  if (action === "show" && taskId) return await handleTaskShow(taskId, options);
  if (action === "update" && taskId) return await handleTaskUpdate(taskId, options);
  if (action === "complete" && taskId) return await handleTaskComplete(taskId, options);
  if (action === "batch") return await handleTaskBatch(options as any); // keep legacy types
  if (action === "deps" || action === "dependencies") return await handleTaskDependencies(options);
  if (action === "ready") return await handleTaskReady(options);
  if (action === "blocked") return await handleTaskBlocked(options);
  if (action === "list") {
    return await handleTaskList(options);
  }

  // Delegate the rest to the existing service implementation
  return await runTaskCommand(action, taskId, options, config);
}

async function handleEpicList(options: EpicOptions): Promise<number> {
  const filters: EpicListFilters = {
    status: options.status,
    assignee: options.assignee,
    priority: options.priority,
    shard: options.shard,
  };

  const epics = await listEpicsData(filters);

  if (epics.length === 0) {
    console.log(options.format === "json" ? formatJson([]) : chalk.yellow("No epics found"));
    return 0;
  }

  if (options.format === "json") {
    console.log(formatJson(epics));
    return 0;
  }

  const headers = ["ID", "Name", "Status", "Priority", "Tasks", "Progress", "Assignee"];
  const rows = epics.map((epic) => {
    const completedTasks = epic.tasks?.filter((t) => t.status === "completed").length || 0;
    const totalTasks = epic.tasks?.length || 0;
    const progress = totalTasks > 0 ? `${completedTasks}/${totalTasks}` : "0/0";

    return [
      epic.id,
      epic.name,
      epic.status,
      epic.priority,
      totalTasks.toString(),
      progress,
      epic.assignee || "-",
    ];
  });

  console.log(formatTable(headers, rows));

  if (options.verbose) {
    const appliedFilters = Object.entries(filters)
      .filter(([, value]) => !!value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    if (appliedFilters) {
      console.log(chalk.dim(`Filtered by ${appliedFilters}`));
    }
    console.log(chalk.dim(`Showing ${epics.length} epic(s)`));
  }

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

  printEpicDetails(epic, options.verbose);
  return 0;
}

async function handleEpicStats(options: EpicOptions): Promise<number> {
  const stats = await getStatsData();

  if (options.format === "json") {
    console.log(formatJson(stats));
    return 0;
  }

  console.log(chalk.cyan("Sharded Storage Statistics:"));
  console.log(`Total Shards: ${stats.totalShards}`);
  console.log(`Total Epics: ${stats.totalEpics}`);
  console.log(`Total Tasks: ${stats.totalTasks}`);
  console.log(`Average Epics per Shard: ${stats.avgEpicsPerShard.toFixed(1)}`);
  console.log(`Shard Utilization: ${stats.shardUtilization.toFixed(1)}%`);
  return 0;
}

async function handleTaskList(options: TaskOptions): Promise<number> {
  const filters: TaskListFilters = {
    status: options.status,
    type: options.type,
    assignee: options.assignee,
    priority: options.priority,
  };

  const tasks = await listTasksData(filters);

  if (tasks.length === 0) {
    console.log(options.format === "json" ? formatJson([]) : chalk.yellow("No tasks found"));
    return 0;
  }

  if (options.format === "json") {
    console.log(formatJson(tasks));
    return 0;
  }

  const headers = ["ID", "Name", "Type", "Status", "Priority", "Dependencies", "Assignee"];
  const rows = tasks.map((task) => [
    task.id,
    task.name,
    task.type,
    task.status,
    task.dependsOn?.join(", ") || "-",
    task.assignee || "-",
  ]);

  console.log(formatTable(headers, rows));

  if (options.verbose) {
    console.log(chalk.dim(`Showing ${tasks.length} task(s)`));
  }

  return 0;
}

async function handleEpicCreate(options: EpicOptions): Promise<number> {
  try {
    const { epic, shardId } = await createEpicData(options as any);
    console.log(chalk.green(`✅ Created epic '${epic.name}' (${epic.id}) in shard ${shardId}`));
    if (options.verbose) {
      console.log(chalk.dim(`Next: Add tasks with 'arbiter task create --epic ${epic.id}'`));
    }
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function handleEpicUpdate(epicId: string, options: EpicOptions): Promise<number> {
  try {
    const epic = await updateEpicData(epicId, options);
    console.log(chalk.green(`✅ Updated epic '${epic.name}'`));
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return error instanceof Error && error.message.includes("No updates specified") ? 0 : 1;
  }
}

async function handleEpicDelete(epicId: string, options: EpicOptions): Promise<number> {
  try {
    const epic = await deleteEpicData(epicId, options);
    console.log(chalk.green(`✅ Marked epic '${epic.name}' as cancelled`));
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function handleTaskCreate(
  _taskId: string | undefined,
  options: TaskOptions & { epic?: string; name?: string },
): Promise<number> {
  if (!options.epic) {
    console.error(chalk.red("Epic ID is required (use --epic <epic-id>)"));
    return 1;
  }

  try {
    const task = await createTaskData(options.epic, options as any);
    console.log(
      chalk.green(`✅ Created task '${task.name}' (${task.id}) in epic '${options.epic}'`),
    );
    if (task.dependsOn?.length) {
      console.log(chalk.dim(`Dependencies: ${task.dependsOn.join(", ")}`));
    }
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function handleTaskShow(taskId: string, options: TaskOptions): Promise<number> {
  try {
    const result = await getTaskById(taskId);
    if (!result) {
      console.error(chalk.red(`Task '${taskId}' not found`));
      return 1;
    }

    if (options.format === "json") {
      console.log(formatJson({ epic: result.epic.id, task: result.task }));
      return 0;
    }

    const { epic, task } = result;
    console.log(chalk.cyan(`Task: ${task.name}`));
    console.log(chalk.dim(`ID: ${task.id}`));
    console.log(chalk.dim(`Epic: ${epic.name} (${epic.id})`));

    if (task.description) {
      console.log(chalk.dim(`Description: ${task.description}`));
    }

    console.log(`Status: ${getStatusColor(task.status)}`);
    console.log(`Type: ${task.type}`);
    console.log(`Priority: ${getPriorityColor(task.priority)}`);

    if (task.assignee) {
      console.log(`Assignee: ${task.assignee}`);
    }

    if (task.dependsOn?.length) {
      console.log(chalk.dim(`Depends on: ${task.dependsOn.join(", ")}`));
    }

    if (task.acceptanceCriteria?.length) {
      console.log(chalk.cyan("Acceptance Criteria:"));
      task.acceptanceCriteria.forEach((criteria, index) => {
        console.log(chalk.dim(`  ${index + 1}. ${criteria}`));
      });
    }

    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function handleTaskUpdate(
  taskId: string,
  options: TaskOptions & { epic?: string },
): Promise<number> {
  try {
    const task = await updateTaskData(taskId, options);
    console.log(chalk.green(`✅ Updated task '${task.name}'`));
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return error instanceof Error && error.message === "No updates specified" ? 0 : 1;
  }
}

async function handleTaskComplete(taskId: string, options: TaskOptions): Promise<number> {
  try {
    const task = await completeTaskData(taskId, options);
    console.log(chalk.green(`✅ Completed task '${task.name}'`));
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function handleTaskBatch(options: any): Promise<number> {
  if (!options.epic) {
    console.error(chalk.red("Epic ID is required (use --epic <epic-id>)"));
    return 1;
  }

  let tasksData: any[];

  try {
    if (options.file) {
      const fileContent = await (await import("fs-extra")).readFile(options.file, "utf-8");
      tasksData = JSON.parse(fileContent);
    } else if (options.json) {
      tasksData = JSON.parse(options.json);
    } else {
      console.error(chalk.red("Either --json or --file is required for batch creation"));
      return 1;
    }

    if (!Array.isArray(tasksData) || tasksData.length === 0) {
      console.error(chalk.red("JSON input must be a non-empty array of task objects"));
      return 1;
    }

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < tasksData.length; i++) {
      const taskData = tasksData[i];
      try {
        await createTaskData(options.epic, {
          ...options,
          name: taskData.name,
          description: taskData.description,
          type: taskData.type || "feature",
          priority: taskData.priority || "medium",
          assignee: taskData.assignee,
          reviewer: taskData.reviewer,
          dependsOn: Array.isArray(taskData.dependsOn)
            ? taskData.dependsOn.join(",")
            : taskData.dependsOn,
          acceptanceCriteria: Array.isArray(taskData.acceptanceCriteria)
            ? taskData.acceptanceCriteria.join(",")
            : taskData.acceptanceCriteria,
          canRunInParallel: taskData.canRunInParallel,
          requiresReview: taskData.requiresReview,
          requiresTesting: taskData.requiresTesting,
          blocksOtherTasks: taskData.blocksOtherTasks,
        } as any);
        successCount++;
      } catch (error) {
        const name = taskData?.name || `task ${i + 1}`;
        errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (successCount > 0) {
      console.log(chalk.green(`✅ Successfully created ${successCount} task(s)`));
    }
    if (errors.length > 0) {
      console.log(chalk.red(`❌ Failed to create ${errors.length} task(s):`));
      errors.forEach((err) => console.log(chalk.red(`  • ${err}`)));
      return errors.length === tasksData.length ? 1 : 0;
    }
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function handleTaskDependencies(options: TaskOptions & { epic?: string }): Promise<number> {
  try {
    const graph = await dependencyGraphData(options.epic);
    if (options.format === "json") {
      console.log(formatJson(graph));
      return 0;
    }

    const tasksWithDeps = graph.tasks.filter((t) => t.dependsOn && t.dependsOn.length > 0);
    if (tasksWithDeps.length === 0) {
      console.log(chalk.yellow("No task dependencies found"));
      return 0;
    }

    console.log(
      chalk.cyan(
        options.epic ? `Dependencies for epic: ${options.epic}` : "Dependencies across all epics:",
      ),
    );

    for (const task of tasksWithDeps) {
      console.log(chalk.white(`${task.name} (${task.id})`));
      console.log(
        chalk.dim(`  Type: ${task.type} | Status: ${task.status} | Priority: ${task.priority}`),
      );

      if (task.dependsOn) {
        console.log(chalk.dim("  Depends on:"));
        for (const depId of task.dependsOn) {
          const depTask = graph.tasks.find((t) => t.id === depId);
          if (depTask) {
            const statusColor =
              depTask.status === "completed"
                ? chalk.green
                : depTask.status === "in_progress"
                  ? chalk.yellow
                  : chalk.gray;
            console.log(chalk.dim(`    → ${depTask.name} (${statusColor(depTask.status)})`));
          } else {
            console.log(chalk.dim(`    → ${depId} ${chalk.red("(not found)")}`));
          }
        }
      }
      console.log();
    }

    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function handleTaskReady(options: TaskOptions & { epic?: string }): Promise<number> {
  try {
    const ready = await readyTasksData(options.epic);
    if (options.format === "json") {
      console.log(formatJson(ready));
      return 0;
    }

    if (ready.length === 0) {
      console.log(chalk.yellow("No tasks are ready to start"));
      return 0;
    }

    console.log(chalk.green(`${ready.length} task(s) ready to start:`));
    const headers = ["ID", "Name", "Type", "Priority", "Assignee"];
    const rows = ready.map((task) => [
      task.id,
      task.name,
      task.type,
      task.priority,
      task.assignee || "-",
    ]);
    console.log(formatTable(headers, rows));
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

async function handleTaskBlocked(options: TaskOptions & { epic?: string }): Promise<number> {
  try {
    const blocked = await blockedTasksData(options.epic);
    if (options.format === "json") {
      console.log(formatJson(blocked));
      return 0;
    }

    if (blocked.length === 0) {
      console.log(chalk.green("No tasks are currently blocked"));
      return 0;
    }

    console.log(chalk.red(`${blocked.length} task(s) blocked by dependencies:`));
    for (const task of blocked) {
      console.log(chalk.white(`${task.name} (${task.id})`));
      console.log(chalk.dim(`  Type: ${task.type} | Priority: ${task.priority}`));
      if (task.dependsOn) {
        console.log(chalk.dim("  Waiting for:"));
        for (const depId of task.dependsOn) {
          const depTask = blocked.find((t) => t.id === depId);
          if (depTask && depTask.status !== "completed") {
            console.log(chalk.dim(`    → ${depTask.name} (${depTask.status})`));
          }
        }
      }
      console.log();
    }
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

function printEpicDetails(epic: EpicModel, verbose?: boolean): void {
  console.log(chalk.cyan(`Epic: ${epic.name}`));
  console.log(chalk.dim(`ID: ${epic.id}`));

  if (epic.description) {
    console.log(chalk.dim(`Description: ${epic.description}`));
  }

  console.log(`Status: ${getStatusColor(epic.status)}`);
  console.log(`Priority: ${getPriorityColor(epic.priority)}`);

  if (epic.assignee) {
    console.log(`Assignee: ${epic.assignee}`);
  }

  if (epic.startDate || epic.dueDate) {
    console.log(chalk.dim("Dates:"));
    if (epic.startDate) console.log(chalk.dim(`  Start: ${epic.startDate}`));
    if (epic.dueDate) console.log(chalk.dim(`  Due: ${epic.dueDate}`));
    if (epic.completedDate) console.log(chalk.dim(`  Completed: ${epic.completedDate}`));
  }

  if (epic.dependencies && epic.dependencies.length > 0) {
    console.log(chalk.dim(`Dependencies: ${epic.dependencies.join(", ")}`));
  }

  if (epic.tasks && epic.tasks.length > 0) {
    console.log(chalk.cyan("\nTasks (dependency order):"));

    const headers = ["ID", "Name", "Type", "Status", "Dependencies", "Assignee"];
    const rows = epic.tasks.map((task) => [
      task.id,
      task.name,
      task.type,
      task.status,
      task.dependsOn?.join(", ") || "-",
      task.assignee || "-",
    ]);

    console.log(formatTable(headers, rows));

    if (verbose) {
      const storage = new ShardedCUEStorage();
      const readyTasks = storage.getReadyTasks(epic.tasks);
      const blockedTasks = storage.getBlockedTasks(epic.tasks);

      console.log(chalk.dim("\nTask Status:"));
      console.log(chalk.dim(`  Ready to start: ${readyTasks.length}`));
      console.log(chalk.dim(`  Blocked by dependencies: ${blockedTasks.length}`));
      console.log(chalk.dim(`  Total tasks: ${epic.tasks.length}`));
    }
  }

  if (verbose && epic.arbiter) {
    console.log(chalk.dim(`\nShard: ${epic.arbiter.shard || "unknown"}`));
    console.log(chalk.dim(`Package: ${epic.arbiter.cuePackage || "unknown"}`));
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return chalk.green(status);
    case "in_progress":
      return chalk.yellow(status);
    case "cancelled":
      return chalk.red(status);
    default:
      return chalk.dim(status);
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical":
      return chalk.red(priority);
    case "high":
      return chalk.yellow(priority);
    case "medium":
      return chalk.blue(priority);
    case "low":
      return chalk.dim(priority);
    default:
      return priority;
  }
}
