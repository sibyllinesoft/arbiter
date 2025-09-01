/**
 * CLI Command: Verify Stamps
 * 
 * Implements the `arbiter verify` command that walks the repository
 * and verifies all HMAC stamps against the server.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { StampVerifier, installGitHooks, type GitVerificationOptions } from '../git/stamp-verifier.js';
import { getTicketSystem } from '../server/ticket-system.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface VerifyCommandOptions {
  strict?: boolean;
  installHooks?: boolean;
  serverUrl?: string;
  allowedFiles?: string;
  protectedPaths?: string;
  repoPath?: string;
  verbose?: boolean;
  json?: boolean;
}

/**
 * Create the verify command
 */
export function createVerifyCommand(): Command {
  return new Command('verify')
    .description('Verify HMAC stamps in repository against server')
    .option('--strict', 'Enable strict verification mode', false)
    .option('--install-hooks', 'Install git pre-commit and pre-receive hooks', false)
    .option('--server-url <url>', 'Arbiter server URL for verification')
    .option('--allowed-files <list>', 'Comma-separated list of files that can be edited without stamps')
    .option('--protected-paths <list>', 'Comma-separated list of paths that require stamps')
    .option('--repo-path <path>', 'Path to repository root', '.')
    .option('--json', 'Output results as JSON', false)
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(async (options: VerifyCommandOptions) => {
      await executeVerifyCommand(options);
    });
}

/**
 * Execute the verify command
 */
async function executeVerifyCommand(options: VerifyCommandOptions): Promise<void> {
  const spinner = ora('Initializing verification...').start();

  try {
    // Configure logging
    if (options.verbose) {
      logger.level = 'debug';
    }

    // Parse options
    const verificationOptions: Partial<GitVerificationOptions> = {
      strictMode: options.strict || false,
      serverUrl: options.serverUrl,
      allowedFiles: options.allowedFiles?.split(',').map(s => s.trim()) || undefined,
      protectedPaths: options.protectedPaths?.split(',').map(s => s.trim()) || undefined,
    };

    const repoPath = path.resolve(options.repoPath || '.');

    // Verify we're in a git repository
    await verifyGitRepository(repoPath);

    // Install hooks if requested
    if (options.installHooks) {
      spinner.text = 'Installing git hooks...';
      await installGitHooks(repoPath, verificationOptions);
      spinner.text = 'Git hooks installed, running verification...';
    }

    // Create verifier
    const verifier = new StampVerifier(verificationOptions);

    // Run pre-commit verification (checks working directory)
    spinner.text = 'Verifying repository stamps...';
    const result = await verifier.verifyPreCommit(repoPath);

    spinner.succeed(chalk.green('Verification completed'));

    // Display results
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      displayVerificationResults(result, options);
    }

    // Exit with appropriate code
    const hasErrors = result.violations.some(v => v.severity === 'error');
    if (hasErrors) {
      console.log(chalk.red('\n❌ Verification failed - repository has stamp violations'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ Verification passed - all stamps are valid'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Verification failed'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      
      if (options.verbose && error.stack) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red(`\nUnknown error: ${String(error)}`));
    }

    process.exit(1);
  }
}

/**
 * Display verification results in human-readable format
 */
function displayVerificationResults(
  result: any,
  options: VerifyCommandOptions
): void {
  console.log('\n' + chalk.bold.blue('🔒 Arbiter Stamp Verification Report'));
  console.log('═'.repeat(50));

  // Summary table
  const summaryData = [
    ['Metric', 'Count', 'Status'],
    ['Total files', result.summary.totalFiles.toString(), '📁'],
    ['Protected files', result.summary.protectedFiles.toString(), '🛡️'],
    ['Valid stamps', result.summary.validStamps.toString(), '✅'],
    ['Invalid stamps', result.summary.invalidStamps.toString(), result.summary.invalidStamps > 0 ? '❌' : '✅'],
    ['Unstamped edits', result.summary.unstampedEdits.toString(), result.summary.unstampedEdits > 0 ? '⚠️' : '✅'],
  ];

  console.log(table(summaryData, {
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼'
    }
  }));

  // Violations
  if (result.violations.length > 0) {
    console.log('\n' + chalk.bold.red('🚨 Violations Found'));
    
    const errors = result.violations.filter((v: any) => v.severity === 'error');
    const warnings = result.violations.filter((v: any) => v.severity === 'warning');

    if (errors.length > 0) {
      console.log(chalk.red(`\n❌ Errors (${errors.length}):`));
      errors.forEach((violation: any, index: number) => {
        console.log(`${index + 1}. ${chalk.yellow(violation.file)}`);
        console.log(`   ${chalk.red(violation.message)}`);
        if (violation.details && options.verbose) {
          console.log(`   ${chalk.gray(JSON.stringify(violation.details))}`);
        }
      });
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Warnings (${warnings.length}):`));
      warnings.forEach((violation: any, index: number) => {
        console.log(`${index + 1}. ${chalk.yellow(violation.file)}`);
        console.log(`   ${chalk.yellow(violation.message)}`);
      });
    }
  }

  // Warnings (non-violation)
  if (result.warnings.length > 0) {
    console.log('\n' + chalk.bold.yellow('⚠️  General Warnings'));
    result.warnings.forEach((warning: string, index: number) => {
      console.log(`${index + 1}. ${chalk.gray(warning)}`);
    });
  }

  // Recommendations
  console.log('\n' + chalk.bold.blue('💡 Recommendations'));
  
  if (result.summary.unstampedEdits > 0) {
    console.log('• Fix unstamped edits by using: ' + chalk.cyan('arbiter edit --file <path>'));
  }
  
  if (result.summary.invalidStamps > 0) {
    console.log('• Regenerate invalid stamps with fresh tickets');
  }
  
  if (!options.installHooks) {
    console.log('• Install git hooks to prevent future violations: ' + chalk.cyan('arbiter verify --install-hooks'));
  }
  
  if (result.valid) {
    console.log('• All stamps verified successfully - repository is secure');
  }
}

/**
 * Verify we're in a git repository
 */
async function verifyGitRepository(repoPath: string): Promise<void> {
  try {
    const gitDir = path.join(repoPath, '.git');
    const stats = await fs.stat(gitDir);
    
    if (!stats.isDirectory()) {
      throw new Error('Not a git repository');
    }
  } catch (error) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }
}

/**
 * Repository status command
 */
export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show repository stamp status')
    .option('--repo-path <path>', 'Path to repository root', '.')
    .option('--json', 'Output as JSON', false)
    .action(async (options: { repoPath?: string; json?: boolean }) => {
      const spinner = ora('Checking repository status...').start();

      try {
        const repoPath = path.resolve(options.repoPath || '.');
        await verifyGitRepository(repoPath);

        const verifier = new StampVerifier();
        const result = await verifier.verifyPreCommit(repoPath);

        spinner.succeed('Status check completed');

        if (options.json) {
          console.log(JSON.stringify({
            valid: result.valid,
            summary: result.summary,
            violationsCount: result.violations.length,
            warningsCount: result.warnings.length,
          }, null, 2));
        } else {
          console.log('\n' + chalk.bold.cyan('📊 Repository Status'));
          console.log('════════════════════');
          
          const status = result.valid ? 
            chalk.green('✅ VALID') : 
            chalk.red('❌ VIOLATIONS FOUND');
          
          console.log(`Status: ${status}`);
          console.log(`Protected files: ${chalk.yellow(result.summary.protectedFiles)}`);
          console.log(`Valid stamps: ${chalk.green(result.summary.validStamps)}`);
          
          if (result.summary.invalidStamps > 0) {
            console.log(`Invalid stamps: ${chalk.red(result.summary.invalidStamps)}`);
          }
          
          if (result.summary.unstampedEdits > 0) {
            console.log(`Unstamped edits: ${chalk.yellow(result.summary.unstampedEdits)}`);
          }

          console.log(`\nRun ${chalk.cyan('arbiter verify')} for detailed analysis`);
        }

      } catch (error) {
        spinner.fail('Status check failed');
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
}

/**
 * Ticket statistics command  
 */
export function createTicketStatsCommand(): Command {
  return new Command('ticket-stats')
    .description('Show ticket system statistics')
    .option('--server-url <url>', 'Arbiter server URL')
    .option('--json', 'Output as JSON', false)
    .action(async (options: { serverUrl?: string; json?: boolean }) => {
      try {
        // In a real implementation, this would make an HTTP request to the server
        // For now, use local ticket system
        const ticketSystem = getTicketSystem();
        const stats = ticketSystem.getTicketStats();

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log('\n' + chalk.bold.magenta('🎫 Ticket System Statistics'));
          console.log('═══════════════════════════');
          console.log(`Active tickets: ${chalk.yellow(stats.activeTickets)}`);
          console.log(`Total issued: ${chalk.cyan(stats.totalIssued)}`);
          
          if (stats.oldestTicket) {
            console.log(`Oldest ticket: ${chalk.gray(stats.oldestTicket)}`);
          }
          
          if (stats.newestTicket) {
            console.log(`Newest ticket: ${chalk.gray(stats.newestTicket)}`);
          }
        }

      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
}

export default createVerifyCommand;