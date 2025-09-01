#!/usr/bin/env node
/**
 * Arbiter Agent CLI - Implementation Agent following Operating Prompt v1
 * 
 * Core Commands:
 * - scan: Discover/synthesize assembly files
 * - assemble: Load assembly and upsert projects in Arbiter
 * - execute: Execute versioned epics with deterministic codegen
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { scanCommand } from './commands/scan.js';
import { assembleCommand } from './commands/assemble.js';
import { executeCommand } from './commands/execute.js';

const program = new Command();

program
  .name('arbiter-agent')
  .description('Arbiter Agent - Executable contract implementation')
  .version('1.0.0');

program
  .command('scan')
  .description('Discover or synthesize assembly files from repository structure')
  .argument('[path]', 'Repository path', process.cwd())
  .option('-o, --output <dir>', 'Output directory for results')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (repoPath: string, options) => {
    try {
      const result = await scanCommand({
        repoPath,
        outputDir: options.output,
        verbose: options.verbose,
      });
      
      console.log(chalk.green('✅ Scan completed successfully'));
      console.log(`📊 Found ${result.discoveries.suggestedProjects.length} projects`);
      console.log(`📋 Assembly ${result.assemblyFound ? 'found' : 'synthesized'}`);
      
      if (result.legacy) {
        console.log(chalk.yellow('⚠️  Legacy format detected - migration recommended'));
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Scan failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('assemble')
  .description('Load assembly and upsert projects in Arbiter with batching')
  .argument('[path]', 'Repository path', process.cwd())
  .option('-a, --assembly <file>', 'Assembly file path')
  .option('--apply', 'Apply changes to Arbiter (default: dry-run)', false)
  .option('--api-url <url>', 'Arbiter API URL', 'http://localhost:8080')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '750')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (repoPath: string, options) => {
    try {
      const result = await assembleCommand({
        repoPath,
        assemblyPath: options.assembly,
        apply: options.apply,
        apiUrl: options.apiUrl,
        timeout: parseInt(options.timeout),
        verbose: options.verbose,
      });
      
      console.log(chalk.green('✅ Assembly completed successfully'));
      console.log(`📊 Projects: ${result.summary.totalProjects}`);
      console.log(`📁 Files: ${result.summary.totalFiles}`);
      console.log(`⏱️  Duration: ${result.summary.totalDuration}ms`);
      
      if (options.apply) {
        console.log(`🚀 Projects upserted: ${result.projectsUpserted}`);
        console.log(`📈 Success rate: ${result.analysisResults.filter(r => r.success).length}/${result.analysisResults.length}`);
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Assembly failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('execute')
  .description('Execute versioned epic with deterministic codegen')
  .argument('<epicPath>', 'Path to epic file')
  .option('-r, --repo <path>', 'Repository path', process.cwd())
  .option('--apply', 'Apply changes to filesystem (default: dry-run)', false)
  .option('--api-url <url>', 'Arbiter API URL', 'http://localhost:8080')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '750')
  .option('--junit <file>', 'JUnit XML output file')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (epicPath: string, options) => {
    try {
      const result = await executeCommand({
        repoPath: options.repo,
        epicPath,
        apply: options.apply,
        apiUrl: options.apiUrl,
        timeout: parseInt(options.timeout),
        verbose: options.verbose,
        junitOutput: options.junit,
      });
      
      console.log(chalk.green('✅ Epic execution completed'));
      console.log(`📊 Epic: ${result.epic.spec.title} (${result.epic.spec.id})`);
      console.log(`📁 Files changed: ${result.summary.filesChanged}`);
      console.log(`🧪 Tests: ${result.summary.testsPassed}/${result.summary.testsRun} passed`);
      console.log(`⏱️  Duration: ${result.summary.totalDuration}ms`);
      console.log(`${result.summary.overallSuccess ? '🎯' : '❌'} Overall: ${result.summary.overallSuccess ? 'SUCCESS' : 'FAILED'}`);
      
      if (!result.summary.overallSuccess) {
        process.exit(1);
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Epic execution failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

program.parse();