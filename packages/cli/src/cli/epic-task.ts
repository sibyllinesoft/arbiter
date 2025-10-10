/**
 * Epic and Task commands module - Epic and task management with dependency-driven execution
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { epicCommand, taskCommand } from '../commands/epic.js';
import type { EpicOptions, TaskOptions } from '../commands/epic.js';

export function createEpicTaskCommands(addCmd: Command): void {
  // Epic commands as subcommands of add
  const epicSubCmd = addCmd
    .command('epic')
    .description('manage epics and their tasks using sharded CUE storage');

  epicSubCmd
    .command('list')
    .description('list all epics')
    .option(
      '-s, --status <status>',
      'filter by status (planning, in_progress, completed, cancelled)'
    )
    .option('-p, --priority <priority>', 'filter by priority (critical, high, medium, low)')
    .option('-a, --assignee <assignee>', 'filter by assignee')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (options: EpicOptions, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await epicCommand('list', undefined, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  epicSubCmd
    .command('show <epic-id>')
    .description('show detailed epic information')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (epicId: string, options: EpicOptions, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await epicCommand('show', epicId, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  epicSubCmd
    .command('create')
    .description('create a new epic')
    .requiredOption('-n, --name <name>', 'epic name')
    .option('-d, --description <description>', 'epic description')
    .option('-p, --priority <priority>', 'priority (critical, high, medium, low)', 'medium')
    .option('-o, --owner <owner>', 'epic owner')
    .option('-a, --assignee <assignee>', 'epic assignee')
    .option('--start-date <date>', 'start date (YYYY-MM-DD)')
    .option('--due-date <date>', 'due date (YYYY-MM-DD)')
    .option('--labels <labels>', 'comma-separated labels')
    .option('--tags <tags>', 'comma-separated tags')
    .option('--allow-parallel-tasks', 'allow tasks to run in parallel')
    .option('--no-auto-progress', 'disable automatic task progression')
    .option('--no-require-all-tasks', "don't require all tasks to complete epic")
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (options: EpicOptions & { name: string }, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await epicCommand('create', undefined, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  epicSubCmd
    .command('update <epic-id>')
    .description('update an existing epic')
    .option('-s, --status <status>', 'update status (planning, in_progress, completed, cancelled)')
    .option('-p, --priority <priority>', 'update priority (critical, high, medium, low)')
    .option('-a, --assignee <assignee>', 'update assignee')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (epicId: string, options: EpicOptions, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await epicCommand('update', epicId, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  epicSubCmd
    .command('stats')
    .description('show sharded storage statistics')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (options: EpicOptions, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await epicCommand('stats', undefined, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  // Task commands as subcommands of add
  const taskSubCmd = addCmd.command('task').description('manage tasks within epics');

  taskSubCmd
    .command('list')
    .description('list all tasks across epics')
    .option(
      '-s, --status <status>',
      'filter by status (todo, in_progress, review, testing, completed, cancelled)'
    )
    .option(
      '-t, --type <type>',
      'filter by type (feature, bug, refactor, test, docs, devops, research)'
    )
    .option('-p, --priority <priority>', 'filter by priority (critical, high, medium, low)')
    .option('-a, --assignee <assignee>', 'filter by assignee')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (options: TaskOptions, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await taskCommand('list', undefined, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  taskSubCmd
    .command('show <task-id>')
    .description('show detailed task information')
    .option('-f, --format <format>', 'output format (table, json)', 'table')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (taskId: string, options: TaskOptions, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await taskCommand('show', taskId, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  taskSubCmd
    .command('create')
    .description('create a new task in an epic')
    .requiredOption('-e, --epic <epic-id>', 'epic ID to add task to')
    .requiredOption('-n, --name <name>', 'task name')
    .option('-d, --description <description>', 'task description')
    .option(
      '-t, --type <type>',
      'task type (feature, bug, refactor, test, docs, devops, research)',
      'feature'
    )
    .option('-p, --priority <priority>', 'priority (critical, high, medium, low)', 'medium')
    .option('-a, --assignee <assignee>', 'task assignee')
    .option('-r, --reviewer <reviewer>', 'task reviewer')
    .option('--depends-on <tasks>', 'comma-separated list of task IDs this depends on')
    .option('--acceptance-criteria <criteria>', 'comma-separated list of acceptance criteria')
    .option('--can-run-in-parallel', 'task can run in parallel with others')
    .option('--no-requires-review', "task doesn't require code review")
    .option('--no-requires-testing', "task doesn't require testing")
    .option('--blocks-other-tasks', 'task blocks subsequent tasks')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (options: TaskOptions & { epic: string; name: string }, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await taskCommand('create', undefined, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  taskSubCmd
    .command('batch')
    .description('batch create tasks from JSON')
    .requiredOption('-e, --epic <epic-id>', 'epic ID to add tasks to')
    .option('--json <json>', 'JSON array of task objects')
    .option('--file <file>', 'JSON file containing task array')
    .option('-v, --verbose', 'verbose output with individual task creation status')
    .action(
      async (options: TaskOptions & { epic: string; json?: string; file?: string }, command) => {
        try {
          const config = command.parent?.parent?.parent?.config;
          if (!config) {
            throw new Error('Configuration not loaded');
          }

          const exitCode = await taskCommand('batch', undefined, options, config);
          process.exit(exitCode);
        } catch (error) {
          console.error(
            chalk.red('Command failed:'),
            error instanceof Error ? error.message : String(error)
          );
          process.exit(2);
        }
      }
    );

  taskSubCmd
    .command('update <task-id>')
    .description('update an existing task')
    .option(
      '-s, --status <status>',
      'update status (todo, in_progress, review, testing, completed, cancelled)'
    )
    .option(
      '-t, --type <type>',
      'update type (feature, bug, refactor, test, docs, devops, research)'
    )
    .option('-p, --priority <priority>', 'update priority (critical, high, medium, low)')
    .option('-a, --assignee <assignee>', 'update assignee')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (taskId: string, options: TaskOptions, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await taskCommand('update', taskId, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });

  taskSubCmd
    .command('complete <task-id>')
    .description('mark a task as completed')
    .option('-v, --verbose', 'verbose output with additional details')
    .action(async (taskId: string, options: TaskOptions, command) => {
      try {
        const config = command.parent?.parent?.parent?.config;
        if (!config) {
          throw new Error('Configuration not loaded');
        }

        const exitCode = await taskCommand('complete', taskId, options, config);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red('Command failed:'),
          error instanceof Error ? error.message : String(error)
        );
        process.exit(2);
      }
    });
}
