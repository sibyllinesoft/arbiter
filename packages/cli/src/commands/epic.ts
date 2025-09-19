/**
 * Epic command - Epic and task management with ordered execution
 *
 * Manages epics and their ordered tasks using sharded CUE storage
 */

import chalk from 'chalk';
import fs from 'fs-extra';
import type { CLIConfig } from '../types.js';
import { formatJson } from '../utils/formatting.js';
import { withProgress } from '../utils/progress.js';
import { type Epic, ShardedCUEStorage, type Task } from '../utils/sharded-storage.js';

// Simple table formatting function
function formatTable(headers: string[], rows: string[][]): string {
  const table = [headers, ...rows];
  const colWidths = headers.map((_, colIndex) =>
    Math.max(...table.map(row => (row[colIndex] || '').length))
  );

  const formatRow = (row: string[], isHeader = false) => {
    const formattedCells = row.map((cell, idx) => (cell || '').padEnd(colWidths[idx])).join(' | ');
    return isHeader ? chalk.cyan(formattedCells) : formattedCells;
  };

  const lines = [
    formatRow(headers, true),
    colWidths.map(w => '-'.repeat(w)).join('-|-'),
    ...rows.map(row => formatRow(row)),
  ];

  return lines.join('\n');
}

export interface EpicOptions {
  verbose?: boolean;
  format?: 'table' | 'json';
  status?: string;
  assignee?: string;
  priority?: string;
  shard?: string;
}

export interface EpicCreateOptions extends EpicOptions {
  name: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  owner?: string;
  assignee?: string;
  startDate?: string;
  dueDate?: string;
  labels?: string;
  tags?: string;
  allowParallelTasks?: boolean;
  autoProgress?: boolean;
  requireAllTasks?: boolean;
}

export interface TaskOptions {
  verbose?: boolean;
  format?: 'table' | 'json';
  status?: string;
  type?: string;
  assignee?: string;
  priority?: string;
}

export interface TaskCreateOptions extends TaskOptions {
  epic: string;
  name?: string;
  description?: string;
  type?: 'feature' | 'bug' | 'refactor' | 'test' | 'docs' | 'devops' | 'research';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  assignee?: string;
  reviewer?: string;
  dependsOn?: string;
  acceptanceCriteria?: string;
  canRunInParallel?: boolean;
  requiresReview?: boolean;
  requiresTesting?: boolean;
  blocksOtherTasks?: boolean;
  // Batch creation support
  json?: string;
  file?: string;
}

/**
 * Main epic command dispatcher
 */
export async function epicCommand(
  action: string,
  epicId: string | undefined,
  options: EpicOptions,
  config: CLIConfig
): Promise<number> {
  const storage = new ShardedCUEStorage();

  try {
    await storage.initialize();

    switch (action) {
      case 'list':
        return await listEpics(storage, options, config);
      case 'show':
        if (!epicId) {
          console.error(chalk.red('Epic ID is required for show command'));
          return 1;
        }
        return await showEpic(storage, epicId, options, config);
      case 'create':
        return await createEpic(storage, options as EpicCreateOptions, config);
      case 'update':
        if (!epicId) {
          console.error(chalk.red('Epic ID is required for update command'));
          return 1;
        }
        return await updateEpic(storage, epicId, options, config);
      case 'delete':
        if (!epicId) {
          console.error(chalk.red('Epic ID is required for delete command'));
          return 1;
        }
        return await deleteEpic(storage, epicId, options, config);
      case 'stats':
        return await showStats(storage, options, config);
      default:
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.dim('Available actions: list, show, create, update, delete, stats'));
        return 1;
    }
  } catch (error) {
    console.error(chalk.red('Epic command failed:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  } finally {
    await storage.close();
  }
}

/**
 * Task command dispatcher
 */
export async function taskCommand(
  action: string,
  taskId: string | undefined,
  options: TaskOptions,
  config: CLIConfig
): Promise<number> {
  const storage = new ShardedCUEStorage();

  try {
    await storage.initialize();

    switch (action) {
      case 'list':
        return await listTasks(storage, options, config);
      case 'show':
        if (!taskId) {
          console.error(chalk.red('Task ID is required for show command'));
          return 1;
        }
        return await showTask(storage, taskId, options, config);
      case 'create':
        return await createTask(storage, options as TaskCreateOptions, config);
      case 'batch':
        return await batchCreateTasks(storage, options as TaskCreateOptions, config);
      case 'update':
        if (!taskId) {
          console.error(chalk.red('Task ID is required for update command'));
          return 1;
        }
        return await updateTask(storage, taskId, options, config);
      case 'complete':
        if (!taskId) {
          console.error(chalk.red('Task ID is required for complete command'));
          return 1;
        }
        return await completeTask(storage, taskId, options, config);
      case 'deps':
      case 'dependencies':
        return await showDependencies(storage, options, config);
      case 'ready':
        return await showReadyTasks(storage, options, config);
      case 'blocked':
        return await showBlockedTasks(storage, options, config);
      default:
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log(
          chalk.dim(
            'Available actions: list, show, create, batch, update, complete, deps, ready, blocked'
          )
        );
        return 1;
    }
  } catch (error) {
    console.error(chalk.red('Task command failed:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  } finally {
    await storage.close();
  }
}

/**
 * List all epics
 */
async function listEpics(
  storage: ShardedCUEStorage,
  options: EpicOptions,
  config: CLIConfig
): Promise<number> {
  return await withProgress({ text: 'Loading epics...' }, async () => {
    const epics = await storage.listEpics(options.status);

    if (epics.length === 0) {
      console.log(chalk.yellow('No epics found'));
      if (options.status) {
        console.log(chalk.dim(`Filtered by status: ${options.status}`));
      }
      return 0;
    }

    if (options.format === 'json') {
      console.log(formatJson(epics));
      return 0;
    }

    // Table format
    const headers = ['ID', 'Name', 'Status', 'Priority', 'Tasks', 'Progress', 'Assignee'];
    const rows = epics.map(epic => {
      const completedTasks = epic.tasks?.filter(t => t.status === 'completed').length || 0;
      const totalTasks = epic.tasks?.length || 0;
      const progress = totalTasks > 0 ? `${completedTasks}/${totalTasks}` : '0/0';

      return [
        epic.id,
        epic.name,
        epic.status,
        epic.priority,
        totalTasks.toString(),
        progress,
        epic.assignee || '-',
      ];
    });

    console.log(formatTable(headers, rows));

    if (options.verbose) {
      console.log(chalk.dim(`\nShowing ${epics.length} epic(s)`));
    }

    return 0;
  });
}

/**
 * Show detailed epic information
 */
async function showEpic(
  storage: ShardedCUEStorage,
  epicId: string,
  options: EpicOptions,
  config: CLIConfig
): Promise<number> {
  return await withProgress({ text: `Loading epic ${epicId}...` }, async () => {
    const epic = await storage.getEpic(epicId);

    if (!epic) {
      console.error(chalk.red(`Epic '${epicId}' not found`));
      return 1;
    }

    if (options.format === 'json') {
      console.log(formatJson(epic));
      return 0;
    }

    // Detailed display
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
      console.log(chalk.dim('Dates:'));
      if (epic.startDate) console.log(chalk.dim(`  Start: ${epic.startDate}`));
      if (epic.dueDate) console.log(chalk.dim(`  Due: ${epic.dueDate}`));
      if (epic.completedDate) console.log(chalk.dim(`  Completed: ${epic.completedDate}`));
    }

    if (epic.dependencies && epic.dependencies.length > 0) {
      console.log(chalk.dim(`Dependencies: ${epic.dependencies.join(', ')}`));
    }

    // Show dependency-ordered tasks
    if (epic.tasks && epic.tasks.length > 0) {
      console.log(chalk.cyan('\nTasks (dependency order):'));

      const headers = ['ID', 'Name', 'Type', 'Status', 'Dependencies', 'Assignee'];
      const rows = epic.tasks.map(task => [
        task.id,
        task.name,
        task.type,
        task.status,
        task.dependsOn?.join(', ') || '-',
        task.assignee || '-',
      ]);

      console.log(formatTable(headers, rows));

      // Show ready/blocked task summary
      if (options.verbose) {
        const storage = new ShardedCUEStorage();
        const readyTasks = storage.getReadyTasks(epic.tasks);
        const blockedTasks = storage.getBlockedTasks(epic.tasks);

        console.log(chalk.dim('\nTask Status:'));
        console.log(chalk.dim(`  Ready to start: ${readyTasks.length}`));
        console.log(chalk.dim(`  Blocked by dependencies: ${blockedTasks.length}`));
        console.log(chalk.dim(`  Total tasks: ${epic.tasks.length}`));
      }
    }

    if (options.verbose && epic.arbiter) {
      console.log(chalk.dim(`\nShard: ${epic.arbiter.shard || 'unknown'}`));
      console.log(chalk.dim(`Package: ${epic.arbiter.cuePackage || 'unknown'}`));
    }

    return 0;
  });
}

/**
 * Create a new epic
 */
async function createEpic(
  storage: ShardedCUEStorage,
  options: EpicCreateOptions,
  config: CLIConfig
): Promise<number> {
  if (!options.name) {
    console.error(chalk.red('Epic name is required'));
    return 1;
  }

  return await withProgress({ text: `Creating epic ${options.name}...` }, async () => {
    const epicId = generateSlug(options.name);

    // Check if epic already exists
    const existing = await storage.getEpic(epicId);
    if (existing) {
      console.error(chalk.red(`Epic '${epicId}' already exists`));
      return 1;
    }

    const epic: Epic = {
      id: epicId,
      name: options.name,
      description: options.description,
      priority: options.priority || 'medium',
      status: 'planning',
      owner: options.owner,
      assignee: options.assignee,
      startDate: options.startDate,
      dueDate: options.dueDate,
      tasks: [], // Start with no tasks
      labels: options.labels ? options.labels.split(',').map(s => s.trim()) : undefined,
      tags: options.tags ? options.tags.split(',').map(s => s.trim()) : undefined,
      config: {
        allowParallelTasks: options.allowParallelTasks,
        autoProgress: options.autoProgress,
        requireAllTasks: options.requireAllTasks,
      },
    };

    const shardId = await storage.addEpic(epic);

    console.log(chalk.green(`✅ Created epic '${epic.name}' (${epicId}) in shard ${shardId}`));

    if (options.verbose) {
      console.log(chalk.dim(`Next: Add tasks with 'arbiter task create --epic ${epicId}'`));
    }

    return 0;
  });
}

/**
 * Update an existing epic
 */
async function updateEpic(
  storage: ShardedCUEStorage,
  epicId: string,
  options: EpicOptions,
  config: CLIConfig
): Promise<number> {
  return await withProgress({ text: `Updating epic ${epicId}...` }, async () => {
    const epic = await storage.getEpic(epicId);

    if (!epic) {
      console.error(chalk.red(`Epic '${epicId}' not found`));
      return 1;
    }

    // Update fields based on options
    let updated = false;

    if (
      options.status &&
      ['planning', 'in_progress', 'completed', 'cancelled'].includes(options.status)
    ) {
      epic.status = options.status as Epic['status'];
      updated = true;
    }

    if (options.priority && ['critical', 'high', 'medium', 'low'].includes(options.priority)) {
      epic.priority = options.priority as Epic['priority'];
      updated = true;
    }

    if (options.assignee !== undefined) {
      epic.assignee = options.assignee || undefined;
      updated = true;
    }

    if (!updated) {
      console.log(chalk.yellow('No updates specified'));
      return 0;
    }

    await storage.updateEpic(epic);

    console.log(chalk.green(`✅ Updated epic '${epic.name}'`));
    return 0;
  });
}

/**
 * Delete an epic
 */
async function deleteEpic(
  storage: ShardedCUEStorage,
  epicId: string,
  options: EpicOptions,
  config: CLIConfig
): Promise<number> {
  // For now, we'll just mark as cancelled rather than actually deleting
  return await updateEpic(storage, epicId, { ...options, status: 'cancelled' }, config);
}

/**
 * Show storage statistics
 */
async function showStats(
  storage: ShardedCUEStorage,
  options: EpicOptions,
  config: CLIConfig
): Promise<number> {
  return await withProgress({ text: 'Calculating statistics...' }, async () => {
    const stats = await storage.getStats();

    if (options.format === 'json') {
      console.log(formatJson(stats));
      return 0;
    }

    console.log(chalk.cyan('Sharded Storage Statistics:'));
    console.log(`Total Shards: ${stats.totalShards}`);
    console.log(`Total Epics: ${stats.totalEpics}`);
    console.log(`Total Tasks: ${stats.totalTasks}`);
    console.log(`Average Epics per Shard: ${stats.avgEpicsPerShard.toFixed(1)}`);
    console.log(`Shard Utilization: ${stats.shardUtilization.toFixed(1)}%`);

    return 0;
  });
}

/**
 * List tasks (across epics or filtered)
 */
async function listTasks(
  storage: ShardedCUEStorage,
  options: TaskOptions,
  config: CLIConfig
): Promise<number> {
  return await withProgress({ text: 'Loading tasks...' }, async () => {
    const tasks = await storage.getOrderedTasks();

    // Apply filters
    let filteredTasks = tasks;

    if (options.status) {
      filteredTasks = filteredTasks.filter(t => t.status === options.status);
    }

    if (options.type) {
      filteredTasks = filteredTasks.filter(t => t.type === options.type);
    }

    if (options.assignee) {
      filteredTasks = filteredTasks.filter(t => t.assignee === options.assignee);
    }

    if (options.priority) {
      filteredTasks = filteredTasks.filter(t => t.priority === options.priority);
    }

    if (filteredTasks.length === 0) {
      console.log(chalk.yellow('No tasks found'));
      return 0;
    }

    if (options.format === 'json') {
      console.log(formatJson(filteredTasks));
      return 0;
    }

    // Table format
    const headers = ['ID', 'Name', 'Type', 'Status', 'Priority', 'Dependencies', 'Assignee'];
    const rows = filteredTasks.map(task => [
      task.id,
      task.name,
      task.type,
      task.status,
      task.priority,
      task.dependsOn?.join(', ') || '-',
      task.assignee || '-',
    ]);

    console.log(formatTable(headers, rows));

    if (options.verbose) {
      console.log(chalk.dim(`\nShowing ${filteredTasks.length} task(s)`));
    }

    return 0;
  });
}

/**
 * Show task details
 */
async function showTask(
  storage: ShardedCUEStorage,
  taskId: string,
  options: TaskOptions,
  config: CLIConfig
): Promise<number> {
  // Find task across all epics
  const epics = await storage.listEpics();
  let targetEpic: Epic | null = null;
  let targetTask: Task | null = null;

  for (const epic of epics) {
    const task = epic.tasks?.find(t => t.id === taskId);
    if (task) {
      targetEpic = epic;
      targetTask = task;
      break;
    }
  }

  if (!targetTask || !targetEpic) {
    console.error(chalk.red(`Task '${taskId}' not found`));
    return 1;
  }

  if (options.format === 'json') {
    console.log(formatJson({ epic: targetEpic.id, task: targetTask }));
    return 0;
  }

  console.log(chalk.cyan(`Task: ${targetTask.name}`));
  console.log(chalk.dim(`ID: ${targetTask.id}`));
  console.log(chalk.dim(`Epic: ${targetEpic.name} (${targetEpic.id})`));

  if (targetTask.description) {
    console.log(chalk.dim(`Description: ${targetTask.description}`));
  }

  console.log(`Status: ${getStatusColor(targetTask.status)}`);
  console.log(`Type: ${targetTask.type}`);
  console.log(`Priority: ${getPriorityColor(targetTask.priority)}`);

  if (targetTask.assignee) {
    console.log(`Assignee: ${targetTask.assignee}`);
  }

  if (targetTask.dependsOn && targetTask.dependsOn.length > 0) {
    console.log(chalk.dim(`Depends on: ${targetTask.dependsOn.join(', ')}`));
  }

  if (targetTask.acceptanceCriteria && targetTask.acceptanceCriteria.length > 0) {
    console.log(chalk.cyan('Acceptance Criteria:'));
    targetTask.acceptanceCriteria.forEach((criteria, index) => {
      console.log(chalk.dim(`  ${index + 1}. ${criteria}`));
    });
  }

  return 0;
}

/**
 * Create a new task in an epic
 */
async function createTask(
  storage: ShardedCUEStorage,
  options: TaskCreateOptions,
  config: CLIConfig
): Promise<number> {
  if (!options.epic) {
    console.error(chalk.red('Epic ID is required (use --epic <epic-id>)'));
    return 1;
  }

  if (!options.name) {
    console.error(chalk.red('Task name is required'));
    return 1;
  }

  try {
    await createSingleTask(storage, options.epic, options, config);
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * Batch create tasks from JSON input
 */
async function batchCreateTasks(
  storage: ShardedCUEStorage,
  options: TaskCreateOptions,
  config: CLIConfig
): Promise<number> {
  if (!options.epic) {
    console.error(chalk.red('Epic ID is required (use --epic <epic-id>)'));
    return 1;
  }

  let tasksData: any[];

  try {
    // Get JSON data from file or command line
    if (options.file) {
      const fileContent = await fs.readFile(options.file, 'utf-8');
      tasksData = JSON.parse(fileContent);
    } else if (options.json) {
      tasksData = JSON.parse(options.json);
    } else {
      console.error(chalk.red('Either --json or --file is required for batch creation'));
      console.log(chalk.dim('Examples:'));
      console.log(
        chalk.dim(
          '  arbiter task batch --epic my-epic --json \'[{"name":"Task 1","order":0},{"name":"Task 2","order":1}]\''
        )
      );
      console.log(chalk.dim('  arbiter task batch --epic my-epic --file tasks.json'));
      return 1;
    }

    if (!Array.isArray(tasksData)) {
      console.error(chalk.red('JSON input must be an array of task objects'));
      return 1;
    }

    if (tasksData.length === 0) {
      console.error(chalk.red('No tasks provided in JSON input'));
      return 1;
    }

    // Validate epic exists
    const epic = await storage.getEpic(options.epic);
    if (!epic) {
      console.error(chalk.red(`Epic '${options.epic}' not found`));
      return 1;
    }

    console.log(chalk.blue(`Creating ${tasksData.length} tasks in epic '${options.epic}'...`));

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each task
    for (let i = 0; i < tasksData.length; i++) {
      const taskData = tasksData[i];

      try {
        // Validate required fields
        if (!taskData.name) {
          errors.push(`Task ${i + 1}: Missing required field 'name'`);
          errorCount++;
          continue;
        }

        // Create task options from JSON data
        const taskOptions: TaskCreateOptions = {
          ...options,
          name: taskData.name,
          description: taskData.description,
          type: taskData.type || 'feature',
          priority: taskData.priority || 'medium',
          assignee: taskData.assignee,
          reviewer: taskData.reviewer,
          dependsOn: Array.isArray(taskData.dependsOn)
            ? taskData.dependsOn.join(',')
            : taskData.dependsOn,
          acceptanceCriteria: Array.isArray(taskData.acceptanceCriteria)
            ? taskData.acceptanceCriteria.join(',')
            : taskData.acceptanceCriteria,
          canRunInParallel: taskData.canRunInParallel,
          requiresReview: taskData.requiresReview,
          requiresTesting: taskData.requiresTesting,
          blocksOtherTasks: taskData.blocksOtherTasks,
        };

        await createSingleTask(storage, options.epic, taskOptions, config, false); // Don't show individual success messages
        successCount++;

        if (options.verbose) {
          console.log(chalk.dim(`  ✓ Created task: ${taskData.name}`));
        }
      } catch (error) {
        const errorMsg = `Task ${i + 1} (${taskData.name || 'unnamed'}): ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        errorCount++;

        if (options.verbose) {
          console.log(chalk.red(`  ✗ Failed to create task: ${taskData.name}`));
        }
      }
    }

    // Summary
    if (successCount > 0) {
      console.log(chalk.green(`✅ Successfully created ${successCount} task(s)`));
    }

    if (errorCount > 0) {
      console.log(chalk.red(`❌ Failed to create ${errorCount} task(s):`));
      errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
      return errorCount === tasksData.length ? 1 : 0; // Return error only if all failed
    }

    return 0;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(chalk.red('Invalid JSON format in input'));
      console.log(chalk.dim('Example format:'));
      console.log(
        chalk.dim(`[
  {
    "name": "Implement user authentication",
    "description": "Add login/logout functionality",
    "type": "feature",
    "priority": "high",
    "order": 0,
    "assignee": "dev1",
    "acceptanceCriteria": ["User can log in", "User can log out", "Session persists"]
  },
  {
    "name": "Write unit tests",
    "description": "Add comprehensive unit tests for auth",
    "type": "test", 
    "priority": "medium",
    "order": 1,
    "dependsOn": ["implement-user-authentication"]
  }
]`)
      );
    } else {
      console.error(
        chalk.red(
          `Batch task creation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
    return 1;
  }
}

/**
 * Create a single task (shared logic)
 */
async function createSingleTask(
  storage: ShardedCUEStorage,
  epicId: string,
  options: TaskCreateOptions,
  config: CLIConfig,
  showSuccessMessage = true
): Promise<void> {
  const epic = await storage.getEpic(epicId);
  if (!epic) {
    throw new Error(`Epic '${epicId}' not found`);
  }

  if (!options.name) {
    throw new Error('Task name is required');
  }

  const taskId = generateSlug(options.name);

  // Check if task already exists in this epic
  if (epic.tasks?.some(t => t.id === taskId)) {
    throw new Error(`Task '${taskId}' already exists in epic '${epicId}'`);
  }

  const task: Task = {
    id: taskId,
    name: options.name,
    description: options.description,
    type: options.type || 'feature',
    priority: options.priority || 'medium',
    status: 'todo',
    assignee: options.assignee,
    reviewer: options.reviewer,
    dependsOn: options.dependsOn ? options.dependsOn.split(',').map(s => s.trim()) : undefined,
    acceptanceCriteria: options.acceptanceCriteria
      ? options.acceptanceCriteria.split(',').map(s => s.trim())
      : undefined,
    config: {
      canRunInParallel: options.canRunInParallel,
      requiresReview: options.requiresReview,
      requiresTesting: options.requiresTesting,
      blocksOtherTasks: options.blocksOtherTasks,
    },
  };

  // Add task to epic
  if (!epic.tasks) {
    epic.tasks = [];
  }
  epic.tasks.push(task);

  await storage.updateEpic(epic);

  if (showSuccessMessage) {
    console.log(chalk.green(`✅ Created task '${task.name}' (${taskId}) in epic '${epicId}'`));
    if (task.dependsOn && task.dependsOn.length > 0) {
      console.log(chalk.dim(`Dependencies: ${task.dependsOn.join(', ')}`));
    }
  }
}

/**
 * Update a task
 */
async function updateTask(
  storage: ShardedCUEStorage,
  taskId: string,
  options: TaskOptions,
  config: CLIConfig
): Promise<number> {
  // Find task across all epics
  const epics = await storage.listEpics();
  let targetEpic: Epic | null = null;
  let targetTask: Task | null = null;

  for (const epic of epics) {
    const task = epic.tasks?.find(t => t.id === taskId);
    if (task) {
      targetEpic = epic;
      targetTask = task;
      break;
    }
  }

  if (!targetTask || !targetEpic) {
    console.error(chalk.red(`Task '${taskId}' not found`));
    return 1;
  }

  // Update fields
  let updated = false;

  if (
    options.status &&
    ['todo', 'in_progress', 'review', 'testing', 'completed', 'cancelled'].includes(options.status)
  ) {
    targetTask.status = options.status as Task['status'];
    updated = true;
  }

  if (options.priority && ['critical', 'high', 'medium', 'low'].includes(options.priority)) {
    targetTask.priority = options.priority as Task['priority'];
    updated = true;
  }

  if (
    options.type &&
    ['feature', 'bug', 'refactor', 'test', 'docs', 'devops', 'research'].includes(options.type)
  ) {
    targetTask.type = options.type as Task['type'];
    updated = true;
  }

  if (options.assignee !== undefined) {
    targetTask.assignee = options.assignee || undefined;
    updated = true;
  }

  if (!updated) {
    console.log(chalk.yellow('No updates specified'));
    return 0;
  }

  await storage.updateEpic(targetEpic);

  console.log(chalk.green(`✅ Updated task '${targetTask.name}'`));
  return 0;
}

/**
 * Move a task to a different order position
 */
async function moveTask(
  storage: ShardedCUEStorage,
  taskId: string,
  options: TaskOptions & { newOrder?: number },
  config: CLIConfig
): Promise<number> {
  if (options.newOrder === undefined) {
    console.error(chalk.red('New order position is required (use --new-order <number>)'));
    return 1;
  }

  // Find task and update order
  const epics = await storage.listEpics();
  let targetEpic: Epic | null = null;
  let targetTask: Task | null = null;

  for (const epic of epics) {
    const task = epic.tasks?.find(t => t.id === taskId);
    if (task) {
      targetEpic = epic;
      targetTask = task;
      break;
    }
  }

  if (!targetTask || !targetEpic) {
    console.error(chalk.red(`Task '${taskId}' not found`));
    return 1;
  }

  const oldOrder = targetTask.order;
  targetTask.order = options.newOrder;

  await storage.updateEpic(targetEpic);

  console.log(
    chalk.green(`✅ Moved task '${targetTask.name}' from order ${oldOrder} to ${options.newOrder}`)
  );
  return 0;
}

/**
 * Mark a task as completed
 */
async function completeTask(
  storage: ShardedCUEStorage,
  taskId: string,
  options: TaskOptions,
  config: CLIConfig
): Promise<number> {
  return await updateTask(storage, taskId, { ...options, status: 'completed' }, config);
}

/**
 * Show dependency graph and relationships
 */
async function showDependencies(
  storage: ShardedCUEStorage,
  options: TaskOptions & { epic?: string },
  config: CLIConfig
): Promise<number> {
  return await withProgress({ text: 'Analyzing dependencies...' }, async () => {
    let tasks: Task[] = [];

    if (options.epic) {
      // Show dependencies for specific epic
      const epic = await storage.getEpic(options.epic);
      if (!epic) {
        console.error(chalk.red(`Epic '${options.epic}' not found`));
        return 1;
      }
      tasks = epic.tasks || [];
      console.log(chalk.cyan(`Dependencies for epic: ${epic.name}`));
    } else {
      // Show dependencies across all epics
      tasks = await storage.getOrderedTasks();
      console.log(chalk.cyan('Dependencies across all epics:'));
    }

    if (tasks.length === 0) {
      console.log(chalk.yellow('No tasks found'));
      return 0;
    }

    if (options.format === 'json') {
      const graph = storage.getDependencyGraph(tasks);
      console.log(formatJson(graph));
      return 0;
    }

    // Show dependency relationships
    const hasDependencies = tasks.filter(t => t.dependsOn && t.dependsOn.length > 0);

    if (hasDependencies.length === 0) {
      console.log(chalk.yellow('No task dependencies found'));
      return 0;
    }

    console.log(chalk.cyan('\nDependency Relationships:'));

    for (const task of hasDependencies) {
      console.log(chalk.white(`${task.name} (${task.id})`));
      console.log(
        chalk.dim(`  Type: ${task.type} | Status: ${task.status} | Priority: ${task.priority}`)
      );

      if (task.dependsOn) {
        console.log(chalk.dim('  Depends on:'));
        for (const depId of task.dependsOn) {
          const depTask = tasks.find(t => t.id === depId);
          if (depTask) {
            const statusColor =
              depTask.status === 'completed'
                ? chalk.green
                : depTask.status === 'in_progress'
                  ? chalk.yellow
                  : chalk.gray;
            console.log(chalk.dim(`    → ${depTask.name} (${statusColor(depTask.status)})`));
          } else {
            console.log(chalk.dim(`    → ${depId} ${chalk.red('(not found)')}`));
          }
        }
      }
      console.log();
    }

    return 0;
  });
}

/**
 * Show tasks that are ready to start (no blocking dependencies)
 */
async function showReadyTasks(
  storage: ShardedCUEStorage,
  options: TaskOptions & { epic?: string },
  config: CLIConfig
): Promise<number> {
  return await withProgress({ text: 'Finding ready tasks...' }, async () => {
    let allTasks: Task[] = [];

    if (options.epic) {
      const epic = await storage.getEpic(options.epic);
      if (!epic) {
        console.error(chalk.red(`Epic '${options.epic}' not found`));
        return 1;
      }
      allTasks = epic.tasks || [];
    } else {
      allTasks = await storage.getOrderedTasks();
    }

    const readyTasks = storage.getReadyTasks(allTasks);

    if (readyTasks.length === 0) {
      console.log(chalk.yellow('No tasks are ready to start'));
      return 0;
    }

    if (options.format === 'json') {
      console.log(formatJson(readyTasks));
      return 0;
    }

    console.log(chalk.green(`${readyTasks.length} task(s) ready to start:`));

    const headers = ['ID', 'Name', 'Type', 'Priority', 'Assignee'];
    const rows = readyTasks.map(task => [
      task.id,
      task.name,
      task.type,
      task.priority,
      task.assignee || '-',
    ]);

    console.log(formatTable(headers, rows));

    return 0;
  });
}

/**
 * Show tasks that are blocked by dependencies
 */
async function showBlockedTasks(
  storage: ShardedCUEStorage,
  options: TaskOptions & { epic?: string },
  config: CLIConfig
): Promise<number> {
  return await withProgress({ text: 'Finding blocked tasks...' }, async () => {
    let allTasks: Task[] = [];

    if (options.epic) {
      const epic = await storage.getEpic(options.epic);
      if (!epic) {
        console.error(chalk.red(`Epic '${options.epic}' not found`));
        return 1;
      }
      allTasks = epic.tasks || [];
    } else {
      allTasks = await storage.getOrderedTasks();
    }

    const blockedTasks = storage.getBlockedTasks(allTasks);

    if (blockedTasks.length === 0) {
      console.log(chalk.green('No tasks are currently blocked'));
      return 0;
    }

    if (options.format === 'json') {
      console.log(formatJson(blockedTasks));
      return 0;
    }

    console.log(chalk.red(`${blockedTasks.length} task(s) blocked by dependencies:`));

    for (const task of blockedTasks) {
      console.log(chalk.white(`${task.name} (${task.id})`));
      console.log(chalk.dim(`  Type: ${task.type} | Priority: ${task.priority}`));

      if (task.dependsOn) {
        console.log(chalk.dim('  Waiting for:'));
        for (const depId of task.dependsOn) {
          const depTask = allTasks.find(t => t.id === depId);
          if (depTask && depTask.status !== 'completed') {
            console.log(chalk.dim(`    → ${depTask.name} (${depTask.status})`));
          }
        }
      }
      console.log();
    }

    return 0;
  });
}

// Helper functions
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return chalk.green(status);
    case 'in_progress':
      return chalk.yellow(status);
    case 'cancelled':
      return chalk.red(status);
    default:
      return chalk.dim(status);
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical':
      return chalk.red(priority);
    case 'high':
      return chalk.yellow(priority);
    case 'medium':
      return chalk.blue(priority);
    case 'low':
      return chalk.dim(priority);
    default:
      return priority;
  }
}
