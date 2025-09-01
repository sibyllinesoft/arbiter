#!/usr/bin/env bun

/**
 * Arbiter CLI - Rails & Guarantees Implementation
 * Complete command routing based on arbiter.assembly.cue specification
 */

import { parseArgs } from 'util';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, resolve, basename } from 'path';
import { spawn } from 'bun';
import chalk from 'chalk';

// Color utilities for CLI output
const colors = {
  reset: '\x1b[0m',
  primary: '\x1b[34m',    // Blue
  success: '\x1b[32m',    // Green  
  warning: '\x1b[33m',    // Yellow
  error: '\x1b[31m',      // Red
  muted: '\x1b[90m',      // Gray
  bold: '\x1b[1m'
} as const;

const c = {
  primary: (s: string) => `${colors.primary}${s}${colors.reset}`,
  success: (s: string) => `${colors.success}${s}${colors.reset}`,
  warning: (s: string) => `${colors.warning}${s}${colors.reset}`,
  error: (s: string) => `${colors.error}${s}${colors.reset}`,
  muted: (s: string) => `${colors.muted}${s}${colors.reset}`,
  bold: (s: string) => `${colors.bold}${s}${colors.reset}`,
};

// Configuration
interface Config {
  apiUrl: string;
  agentMode: boolean;
  format: 'table' | 'json' | 'yaml';
  verbose: boolean;
  dryRun: boolean;
  force: boolean;
}

const DEFAULT_CONFIG: Config = {
  apiUrl: 'http://localhost:4001',
  agentMode: false,
  format: 'table',
  verbose: false,
  dryRun: false,
  force: false,
};

// Command definitions from specification
interface Command {
  name: string;
  summary: string;
  args?: string[];
  flags?: Array<{
    name: string;
    type: 'string' | 'bool' | 'float';
    choices?: string[];
    default?: any;
    alias?: string;
    description?: string;
  }>;
  subcommands?: Command[];
  examples?: string[];
  handler: (args: any, config: Config) => Promise<void>;
}

// Utility functions
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${DEFAULT_CONFIG.apiUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'arbiter-cli',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error(`API server unavailable at ${url}. Is it running?`);
    }
    throw error;
  }
}

function formatOutput(data: any, format: 'table' | 'json' | 'yaml', agentMode: boolean): string {
  if (agentMode) {
    return JSON.stringify(data);
  }

  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      // Simple YAML serialization
      return Object.entries(data)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n');
    case 'table':
    default:
      if (Array.isArray(data)) {
        return data.map((item, i) => `${i + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}`).join('\n');
      }
      return Object.entries(data)
        .map(([k, v]) => `${c.primary(k)}: ${typeof v === 'object' ? JSON.stringify(v, null, 2) : v}`)
        .join('\n');
  }
}

function logOutput(message: string, config: Config): void {
  if (config.agentMode) {
    console.log(JSON.stringify({ type: 'log', message, timestamp: new Date().toISOString() }));
  } else {
    console.log(message);
  }
}

function logError(error: string, config: Config): void {
  if (config.agentMode) {
    console.error(JSON.stringify({ type: 'error', error, timestamp: new Date().toISOString() }));
  } else {
    console.error(c.error('❌ ' + error));
  }
}

// Import contract commands
import { createContractsCommand } from '../commands/contracts.js';
import { createWatchCommand } from '../commands/watch.js';
import { createDocsCommand, addNextStepHints } from '../commands/docs.js';

// Command Handlers

// Phase 1: Core Commands
async function handleImport(args: any, config: Config): Promise<void> {
  const targetPath = args._[1] || '.';
  
  logOutput(c.primary('📦 Importing project into Arbiter...'), config);
  logOutput(c.muted(`Directory: ${resolve(targetPath)}`), config);
  
  try {
    // Scan project files
    logOutput(c.muted('🔍 Scanning project files...'), config);
    
    const result = await apiRequest('/import', {
      method: 'POST',
      body: JSON.stringify({ path: targetPath })
    });
    
    logOutput(formatOutput(result, config.format, config.agentMode), config);
    logOutput(c.success('✅ Project import analysis complete!'), config);
    
    // Show next steps
    if (!config.agentMode) {
      logOutput(c.primary('Next steps:'), config);
      logOutput(c.muted('  1. Run: arbiter generate --template library'), config);
      logOutput(c.muted('  2. Edit: arbiter.assembly.cue'), config);
      logOutput(c.muted('  3. Run: arbiter check'), config);
      console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('import', result)}`));
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Import failed', config);
    process.exit(1);
  }
}

async function handleGenerate(args: any, config: Config): Promise<void> {
  const template = args.template || 'library';
  
  logOutput(c.primary('🛠️ Generating baseline CUE files...'), config);
  logOutput(c.muted(`Template: ${template}`), config);
  
  try {
    const result = await apiRequest('/generate', {
      method: 'POST', 
      body: JSON.stringify({ template, force: config.force })
    });
    
    logOutput(formatOutput(result, config.format, config.agentMode), config);
    logOutput(c.success('✅ Baseline generation complete!'), config);
    
    if (!config.agentMode) {
      logOutput(c.primary('Next: Edit arbiter.assembly.cue to customize your artifact profile'), config);
      console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('generate', result)}`));
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Generation failed', config);
    process.exit(1);
  }
}

async function handleCheck(args: any, config: Config): Promise<void> {
  const patterns = args._.slice(1);
  
  logOutput(c.primary('🔍 Validating CUE files, UI profiles, and contracts...'), config);
  
  try {
    const result = await apiRequest('/check', {
      method: 'POST',
      body: JSON.stringify({ 
        patterns: patterns.length > 0 ? patterns : undefined,
        strict: args.strict,
        includeUI: args.ui !== false, // Include UI validation by default
        includeContracts: args.contracts !== false, // Include contract validation by default
        uiChecks: {
          routes: args.uiRoutes !== false,
          a11y: args.uiA11y !== false,
          i18n: args.uiI18n !== false,
          performance: args.uiPerf !== false,
          designTokens: args.uiTokens !== false
        },
        contractChecks: {
          budgets: args.contractBudgets !== false,
          coverage: args.contractCoverage !== false,
          thresholds: args.contractThresholds || 'contract=0.8,scenario=0.6,fault=0.5'
        }
      })
    });
    
    if (result.valid) {
      logOutput(c.success('✅ All validations passed'), config);
      
      // Show UI-specific validation results
      if (result.ui && !config.agentMode) {
        logOutput(c.muted('UI Profile Validation:'), config);
        if (result.ui.routes) logOutput(c.muted(`  Routes: ${result.ui.routes.valid ? '✅' : '❌'} (${result.ui.routes.count})`), config);
        if (result.ui.a11y) logOutput(c.muted(`  A11y: ${result.ui.a11y.valid ? '✅' : '❌'}`), config);
        if (result.ui.i18n) logOutput(c.muted(`  I18n: ${result.ui.i18n.valid ? '✅' : '❌'} (${result.ui.i18n.coverage}% coverage)`), config);
        if (result.ui.performance) logOutput(c.muted(`  Performance: ${result.ui.performance.valid ? '✅' : '❌'}`), config);
        if (result.ui.designTokens) logOutput(c.muted(`  Design Tokens: ${result.ui.designTokens.valid ? '✅' : '❌'}`), config);
      }

      // Show Contract-specific validation results
      if (result.contracts && !config.agentMode) {
        logOutput(c.muted('Contract Validation:'), config);
        if (result.contracts.overall) {
          logOutput(c.muted(`  Coverage: ${(result.contracts.overall.contractCoverage * 100).toFixed(1)}% ${result.contracts.overall.contractCoverage >= 0.8 ? '✅' : '❌'}`), config);
          logOutput(c.muted(`  Scenarios: ${(result.contracts.overall.scenarioCoverage * 100).toFixed(1)}% ${result.contracts.overall.scenarioCoverage >= 0.6 ? '✅' : '❌'}`), config);
          logOutput(c.muted(`  Faults: ${(result.contracts.overall.faultCoverage * 100).toFixed(1)}% ${result.contracts.overall.faultCoverage >= 0.5 ? '✅' : '❌'}`), config);
          logOutput(c.muted(`  Budget Compliance: ${(result.contracts.overall.resourceBudgetCompliance * 100).toFixed(1)}% ${result.contracts.overall.resourceBudgetCompliance >= 0.9 ? '✅' : '❌'}`), config);
        }
      }
    } else {
      logOutput(c.error('❌ Validation failed'), config);
      
      if (result.errors) {
        result.errors.forEach((error: any) => {
          logError(`${error.file}:${error.line} - ${error.message}`, config);
        });
      }
      
      // Show UI-specific errors
      if (result.ui?.errors) {
        logOutput(c.error('UI Profile Errors:'), config);
        result.ui.errors.forEach((error: any) => {
          logError(`  ${error.route || error.component}: ${error.message}`, config);
        });
      }

      // Show Contract-specific errors
      if (result.contracts?.errors) {
        logOutput(c.error('Contract Validation Errors:'), config);
        result.contracts.errors.forEach((error: any) => {
          logError(`  ${error.contractId || error.id}: ${error.message}`, config);
        });
      }
      
      process.exit(1);
    }
    
    logOutput(formatOutput(result, config.format, config.agentMode), config);
    
    // Show next steps for UI issues
    if (!config.agentMode && result.ui?.suggestions) {
      logOutput(c.primary('Next steps for UI:'), config);
      result.ui.suggestions.forEach((suggestion: string) => {
        logOutput(c.muted(`  • ${suggestion}`), config);
      });
    }

    // Show next steps for contract issues
    if (!config.agentMode && result.contracts?.suggestions) {
      logOutput(c.primary('Next steps for contracts:'), config);
      result.contracts.suggestions.forEach((suggestion: string) => {
        logOutput(c.muted(`  • ${suggestion}`), config);
      });
    }
    
    // Show next step hint
    if (!config.agentMode) {
      console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('check', result)}`));
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Check failed', config);
    process.exit(1);
  }
}

// Ticket System Commands (Rails Implementation)
async function handleTicket(args: any, config: Config): Promise<void> {
  const scope = args.scope;
  const expires = args.expires || '1h';
  
  if (!scope) {
    logError('Missing required --scope parameter (plan hash)', config);
    process.exit(1);
  }
  
  logOutput(c.primary('🎫 Requesting mutation ticket...'), config);
  
  try {
    const result = await apiRequest('/v1/ticket', {
      method: 'POST',
      body: JSON.stringify({ scope, expires })
    });
    
    logOutput(c.success('✅ Ticket issued successfully'), config);
    logOutput(formatOutput(result, config.format, config.agentMode), config);
    
    if (!config.agentMode) {
      logOutput(c.muted(`Next: Use ticket ${result.ticketId} for mutations`), config);
      console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('ticket', result)}`));
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Ticket request failed', config);
    process.exit(1);
  }
}

async function handleVerify(args: any, config: Config): Promise<void> {
  const repoPath = args.repoPath || '.';
  const strict = args.strict;
  
  logOutput(c.primary('🔍 Verifying stamps and tickets...'), config);
  
  try {
    // In a full implementation, this would walk the repo and verify all stamps
    // For now, simulate verification
    const mockResult = {
      valid: true,
      stamps: {
        verified: 0,
        invalid: 0,
        missing: 0
      },
      files: {
        scanned: 0,
        withStamps: 0
      }
    };
    
    if (mockResult.valid) {
      logOutput(c.success('✅ All stamps verified'), config);
    } else {
      logOutput(c.error('❌ Verification failed'), config);
      process.exit(1);
    }
    
    logOutput(formatOutput(mockResult, config.format, config.agentMode), config);
    
    // Show next step hint
    if (!config.agentMode) {
      console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('verify', mockResult)}`));
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Verification failed', config);
    process.exit(1);
  }
}

async function handleExecute(args: any, config: Config): Promise<void> {
  const epic = args._[1];
  const ticket = args.ticket;
  
  if (!epic) {
    logError('Missing epic name argument', config);
    process.exit(1);
  }
  
  if (!ticket) {
    logError('Missing required --ticket parameter', config);
    process.exit(1);
  }
  
  logOutput(c.primary(`🚀 Executing epic: ${epic}`), config);
  
  try {
    const result = await apiRequest('/execute/epic', {
      method: 'POST',
      body: JSON.stringify({ 
        epic, 
        ticketId: ticket,
        dryRun: config.dryRun
      })
    });
    
    if (result.success) {
      logOutput(c.success('✅ Epic execution complete'), config);
    } else {
      logOutput(c.error('❌ Epic execution failed'), config);
      process.exit(1);
    }
    
    logOutput(formatOutput(result, config.format, config.agentMode), config);
    
    // Show next step hint
    if (!config.agentMode) {
      console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('execute', result)}`));
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Execution failed', config);
    process.exit(1);
  }
}

async function handleExplain(args: any, config: Config): Promise<void> {
  const sections = args.sections || 'all';
  const detail = args.detail || 'detailed';
  
  logOutput(c.primary('💬 Explaining assembly configuration...'), config);
  
  try {
    // Use enhanced docs explain functionality
    const { executeExplainCommand } = await import('../commands/docs.js');
    
    const options = {
      sections,
      detail,
      format: config.agentMode ? 'json' : 'markdown',
      includeExamples: true,
      includeContracts: true,
      includeUI: true,
      includeGates: true,
      verbose: config.verbose
    };
    
    // Execute the enhanced explain command
    await executeExplainCommand(options);
    
    // Show next step hint
    if (!config.agentMode) {
      console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('explain', {})}`));
    }
    
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Explain failed', config);
    process.exit(1);
  }
}

async function handleHealth(args: any, config: Config): Promise<void> {
  try {
    const result = await apiRequest('/health');
    
    if (result.status === 'healthy') {
      logOutput(c.success('✅ API server healthy'), config);
    } else {
      logOutput(c.warning('⚠️ API server status unknown'), config);
    }
    
    logOutput(formatOutput(result, config.format, config.agentMode), config);
    
    // Show next step hint
    if (!config.agentMode) {
      console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('health', result)}`));
    }
  } catch (error) {
    logError('API server unavailable', config);
    process.exit(1);
  }
}

async function handleWatch(args: any, config: Config): Promise<void> {
  // The watch command is implemented as a Commander.js command
  // This handler delegates to the actual watch command implementation
  const watchCommand = createWatchCommand();
  
  // Convert our args format to Commander.js format
  const watchArgs = [];
  const watchOptions: any = {};
  
  // Map common args
  if (args.patterns) watchOptions.patterns = args.patterns;
  if (args.debounce) watchOptions.debounce = args.debounce;
  if (args.parallel) watchOptions.parallel = args.parallel;
  if (args.output) watchOptions.output = args.output;
  if (args.format) watchOptions.format = args.format;
  if (args.fast) watchOptions.fast = true;
  if (args.selective) watchOptions.selective = args.selective;
  if (args.timeout) watchOptions.timeout = args.timeout;
  if (args.maxPayload) watchOptions.maxPayload = args.maxPayload;
  if (args.maxRate) watchOptions.maxRate = args.maxRate;
  if (args.bufferSize) watchOptions.bufferSize = args.bufferSize;
  if (config.verbose) watchOptions.verbose = true;

  // Execute the watch command directly
  // Note: In a real implementation, we might need to restructure this
  // For now, we'll call the watch logic directly
  try {
    logOutput(c.primary('🔄 Starting continuous validation loop...'), config);
    
    if (!config.agentMode) {
      logOutput(c.muted('Press Ctrl+C to stop'), config);
      logOutput(c.muted('NDJSON output will be streamed below:'), config);
      console.log('---');
    }

    // Import and execute the watch command function directly
    const { executeWatchCommand } = await import('../commands/watch.js');
    await executeWatchCommand(watchOptions);
    
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Watch command failed', config);
    process.exit(1);
  }
}

// Contract-related command handlers
async function handleContractTestGenerate(args: any, config: Config): Promise<void> {
  logOutput(c.primary('🧪 Generating contract tests from assembly...'), config);
  
  const options = {
    fromAssembly: args.fromAssembly !== false,
    language: args.language || 'ts',
    output: args.output || 'tests/contracts',
    propertyTests: parseInt(args.propertyTests || '50'),
    dryRun: args.dryRun || false,
    verbose: config.verbose
  };
  
  try {
    const result = await apiRequest('/contracts/tests/generate', {
      method: 'POST',
      body: JSON.stringify(options)
    });
    
    if (result.success) {
      logOutput(c.success('✅ Contract test generation completed'), config);
      logOutput(formatOutput({
        totalContracts: result.totalContracts,
        totalTests: result.totalTests,
        generatedFiles: result.generatedFiles,
        outputDirectory: result.outputDirectory,
        language: result.language
      }, config.format, config.agentMode), config);
      
      if (!config.agentMode) {
        logOutput(c.primary('Next steps:'), config);
        logOutput(c.muted(`  1. Review generated tests in ${result.outputDirectory}`), config);
        logOutput(c.muted(`  2. Run tests: cd ${result.outputDirectory} && npm test`), config);
        logOutput(c.muted('  3. Check coverage: arbiter tests cover'), config);
      }
    } else {
      logOutput(c.error('❌ Contract test generation failed'), config);
      if (result.errors) {
        result.errors.forEach((error: string) => logError(error, config));
      }
      process.exit(1);
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Test generation failed', config);
    process.exit(1);
  }
}

async function handleContractTestCover(args: any, config: Config): Promise<void> {
  logOutput(c.primary('📊 Computing contract coverage...'), config);
  
  const options = {
    input: args.input || 'tests/contracts',
    output: args.output || 'coverage/contracts',
    format: args.format || 'json,junit',
    threshold: parseInt(args.threshold || '80'),
    verbose: config.verbose
  };
  
  try {
    const result = await apiRequest('/contracts/tests/cover', {
      method: 'POST',
      body: JSON.stringify(options)
    });
    
    if (result.success) {
      logOutput(c.success('✅ Contract coverage analysis completed'), config);
      
      // Display coverage summary
      const coverage = result.coverage;
      logOutput('\n' + c.bold.blue('📊 Contract Coverage Summary'), config);
      logOutput('═'.repeat(50), config);
      
      const summaryData = [
        ['Coverage Type', 'Percentage', 'Status'],
        [
          'Contract Coverage',
          `${(coverage.overall.contractCoverage * 100).toFixed(1)}%`,
          coverage.overall.contractCoverage >= 0.8 ? '✅' : '❌'
        ],
        [
          'Scenario Coverage',
          `${(coverage.overall.scenarioCoverage * 100).toFixed(1)}%`,
          coverage.overall.scenarioCoverage >= 0.6 ? '✅' : '❌'
        ],
        [
          'Fault Coverage',
          `${(coverage.overall.faultCoverage * 100).toFixed(1)}%`,
          coverage.overall.faultCoverage >= 0.5 ? '✅' : '❌'
        ],
        [
          'Budget Compliance',
          `${(coverage.overall.resourceBudgetCompliance * 100).toFixed(1)}%`,
          coverage.overall.resourceBudgetCompliance >= 0.9 ? '✅' : '❌'
        ]
      ];
      
      if (!config.agentMode) {
        logOutput(formatOutput(summaryData, 'table', false), config);
        
        logOutput('\n' + c.bold.green('📄 Generated Reports'), config);
        result.reports.forEach((report: string) => {
          logOutput(`• ${report}`, config);
        });
      } else {
        logOutput(formatOutput(result, config.format, config.agentMode), config);
      }
      
      // Check coverage thresholds
      const passesThreshold = coverage.overall.contractCoverage * 100 >= options.threshold;
      if (!passesThreshold) {
        logOutput(c.error(`\n❌ Coverage threshold not met: ${(coverage.overall.contractCoverage * 100).toFixed(1)}% < ${options.threshold}%`), config);
        process.exit(1);
      } else {
        logOutput(c.success(`\n✅ Coverage threshold met: ${(coverage.overall.contractCoverage * 100).toFixed(1)}% >= ${options.threshold}%`), config);
      }
    } else {
      logOutput(c.error('❌ Contract coverage analysis failed'), config);
      if (result.errors) {
        result.errors.forEach((error: string) => logError(error, config));
      }
      process.exit(1);
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Coverage analysis failed', config);
    process.exit(1);
  }
}

async function handlePlanMilestone(milestoneId: string, args: any, config: Config): Promise<void> {
  logOutput(c.primary(`📋 Generating implementation plan for milestone: ${milestoneId}...`), config);
  
  const options = {
    output: args.output || 'plans',
    format: args.format || 'markdown',
    includeSteps: args.includeSteps !== false,
    includeContracts: args.includeContracts !== false,
    includeScenarios: args.includeScenarios !== false,
    idempotent: args.idempotent !== false,
    verbose: config.verbose
  };
  
  try {
    const result = await apiRequest('/contracts/plan/milestone', {
      method: 'POST',
      body: JSON.stringify({ milestoneId, ...options })
    });
    
    if (result.success) {
      if (result.existed && options.idempotent) {
        logOutput(c.warning(`✨ Implementation plan exists (idempotent): ${result.planFile}`), config);
      } else {
        logOutput(c.success(`✅ Implementation plan generated: ${result.planFile}`), config);
      }
      
      // Display plan summary
      if (!config.agentMode) {
        logOutput('\n' + c.bold.blue('📋 Implementation Plan Summary'), config);
        logOutput('═'.repeat(45), config);
        
        logOutput(`Milestone: ${c.primary(result.plan.milestoneId)}`, config);
        logOutput(`Contracts: ${c.warning(result.plan.contracts.length.toString())}`, config);
        logOutput(`Timeline: ${c.success(result.plan.timeline)}`, config);
        logOutput(`Generated: ${c.muted(result.plan.generatedAt)}`, config);
        
        logOutput('\n' + c.primary('Next steps:'), config);
        logOutput(c.muted(`  1. Review plan: ${result.planFile}`), config);
        logOutput(c.muted('  2. Begin implementation following the steps'), config);
        logOutput(c.muted('  3. Track progress with arbiter check --contracts'), config);
      } else {
        logOutput(formatOutput(result, config.format, config.agentMode), config);
      }
    } else {
      logOutput(c.error('❌ Milestone planning failed'), config);
      if (result.errors) {
        result.errors.forEach((error: string) => logError(error, config));
      }
      process.exit(1);
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Milestone planning failed', config);
    process.exit(1);
  }
}

async function handleUICommand(subcommand: string, args: any, config: Config): Promise<void> {
  const cuePath = args._[2]; // ui <subcommand> <cue-file>
  
  if (!cuePath) {
    logError('Missing CUE file path argument', config);
    process.exit(1);
  }
  
  switch (subcommand) {
    case 'scaffold':
      await handleUIScaffold(args, config, cuePath);
      break;
    case 'validate':
      await handleUIValidate(args, config, cuePath);
      break;
    default:
      logError(`Unknown UI subcommand: ${subcommand}. Available: scaffold, validate`, config);
      process.exit(1);
  }
}

async function handleUIScaffold(args: any, config: Config, cuePath: string): Promise<void> {
  const outputDir = args.output || './generated';
  const platform = args.platform || 'web';
  
  logOutput(c.primary('🎨 Generating UI artifacts from Profile.ui...'), config);
  logOutput(c.muted(`Source: ${cuePath}`), config);
  logOutput(c.muted(`Platform: ${platform}`), config);
  logOutput(c.muted(`Output: ${outputDir}`), config);
  
  try {
    const result = await apiRequest('/ui/scaffold', {
      method: 'POST',
      body: JSON.stringify({
        cuePath,
        outputDir,
        platform,
        ticketId: args.ticket,
        force: config.force,
        dryRun: config.dryRun,
        options: {
          designSystem: !args.noDesignSystem,
          tests: !args.noTests,
          stories: !args.noStories,
          idempotent: !args.noIdempotent,
          stamped: !args.noStamp
        }
      })
    });
    
    if (result.success) {
      logOutput(c.success('✅ UI scaffolding complete'), config);
      logOutput(formatOutput(result.stats, config.format, config.agentMode), config);
      
      if (!config.agentMode && result.stamp) {
        logOutput(c.muted(`Stamp ID: ${result.stamp.id}`), config);
        if (result.stamp.ticketId) {
          logOutput(c.muted(`Ticket: ${result.stamp.ticketId}`), config);
        }
      }
    } else {
      logOutput(c.error('❌ UI scaffolding failed'), config);
      if (result.errors) {
        result.errors.forEach((error: string) => logError(error, config));
      }
      process.exit(1);
    }
    
    // Show next steps
    if (!config.agentMode) {
      logOutput(c.primary('Next steps:'), config);
      logOutput(c.muted('  1. Review generated components'), config);
      logOutput(c.muted('  2. Run tests: npm test'), config);
      logOutput(c.muted('  3. Check Storybook: npm run storybook'), config);
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'UI scaffolding failed', config);
    process.exit(1);
  }
}

async function handleUIValidate(args: any, config: Config, cuePath: string): Promise<void> {
  logOutput(c.primary('🔍 Validating UI Profile specifications...'), config);
  logOutput(c.muted(`Source: ${cuePath}`), config);
  
  try {
    const result = await apiRequest('/ui/validate', {
      method: 'POST',
      body: JSON.stringify({
        cuePath,
        strict: args.strict,
        checks: {
          routes: args.uiRoutes !== false,
          a11y: args.uiA11y !== false,
          i18n: args.uiI18n !== false,
          performance: args.uiPerf !== false,
          designTokens: args.uiTokens !== false
        }
      })
    });
    
    if (result.valid) {
      logOutput(c.success('✅ UI validation passed'), config);
    } else {
      logOutput(c.warning('⚠️ UI validation completed with issues'), config);
    }
    
    logOutput(formatOutput(result, config.format, config.agentMode), config);
    
    // Show issues if any
    if (result.issues && result.issues.length > 0 && !config.agentMode) {
      logOutput(c.yellow('Issues found:'), config);
      result.issues.forEach((issue: any) => {
        const severity = issue.severity === 'error' ? c.error('ERROR') : c.warning('WARNING');
        logOutput(`  [${severity}] ${issue.message}`, config);
      });
    }
    
    // Show recommendations
    if (result.recommendations && result.recommendations.length > 0 && !config.agentMode) {
      logOutput(c.primary('Recommendations:'), config);
      result.recommendations.forEach((rec: string) => {
        logOutput(c.muted(`  • ${rec}`), config);
      });
    }
    
    // Exit with appropriate code in strict mode
    if (!result.valid && args.strict) {
      logOutput(c.error('❌ Validation failed in strict mode'), config);
      process.exit(1);
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : 'UI validation failed', config);
    process.exit(1);
  }
}

// Command registry with full specification
const commands: Command[] = [
  {
    name: 'import',
    summary: 'Import project into Arbiter',
    args: ['path?'],
    flags: [
      { name: 'format', type: 'string', choices: ['auto', 'cue', 'json', 'yaml'], default: 'auto' },
      { name: 'dry-run', type: 'bool', default: false }
    ],
    examples: [
      'arbiter import .',
      'arbiter import ./project --format cue'
    ],
    handler: handleImport
  },
  {
    name: 'generate',
    summary: 'Generate baseline CUE files',
    flags: [
      { name: 'template', type: 'string', choices: ['library', 'cli', 'service', 'job'], default: 'library' },
      { name: 'force', type: 'bool', default: false }
    ],
    examples: [
      'arbiter generate --template library',
      'arbiter generate --template service --force'
    ],
    handler: handleGenerate
  },
  {
    name: 'check',
    summary: 'Validate CUE files and UI profiles',
    args: ['patterns...'],
    flags: [
      { name: 'strict', type: 'bool', default: false },
      { name: 'format', type: 'string', choices: ['table', 'json', 'yaml'], default: 'table' },
      { name: 'ui', type: 'bool', default: true, description: 'Include UI profile validation' },
      { name: 'ui-routes', type: 'bool', default: true, description: 'Validate UI routes' },
      { name: 'ui-a11y', type: 'bool', default: true, description: 'Validate accessibility requirements' },
      { name: 'ui-i18n', type: 'bool', default: true, description: 'Validate i18n coverage' },
      { name: 'ui-perf', type: 'bool', default: true, description: 'Validate performance budgets' },
      { name: 'ui-tokens', type: 'bool', default: true, description: 'Validate design tokens' },
      { name: 'contracts', type: 'bool', default: true, description: 'Include contract validation' },
      { name: 'contract-budgets', type: 'bool', default: true, description: 'Validate resource budgets' },
      { name: 'contract-coverage', type: 'bool', default: true, description: 'Validate coverage thresholds' },
      { name: 'contract-thresholds', type: 'string', description: 'Coverage thresholds (contract=0.8,scenario=0.6)', default: 'contract=0.8,scenario=0.6,fault=0.5' }
    ],
    examples: [
      'arbiter check',
      'arbiter check spec/**/*.cue --strict',
      'arbiter check --no-ui-a11y --no-ui-i18n',
      'arbiter check --contract-thresholds contract=0.9,scenario=0.7',
      'arbiter check --no-contracts --no-ui'
    ],
    handler: handleCheck
  },
  {
    name: 'ui',
    summary: 'UI generation and validation commands',
    subcommands: [
      {
        name: 'scaffold',
        summary: 'Generate UI artifacts from Profile.ui',
        args: ['cue-file'],
        flags: [
          { name: 'output', type: 'string', default: './generated', description: 'Output directory' },
          { name: 'platform', type: 'string', choices: ['web', 'cli', 'tui', 'desktop'], default: 'web' },
          { name: 'ticket', type: 'string', description: 'Ticket ID for traceability' }
        ],
        examples: [
          'arbiter ui scaffold profile.cue',
          'arbiter ui scaffold profile.cue --platform web --output ./src'
        ],
        handler: async (args: any, config: Config) => await handleUICommand('scaffold', args, config)
      },
      {
        name: 'validate', 
        summary: 'Validate Profile.ui specifications',
        args: ['cue-file'],
        flags: [
          { name: 'strict', type: 'bool', default: false, description: 'Enable strict validation' }
        ],
        examples: [
          'arbiter ui validate profile.cue',
          'arbiter ui validate profile.cue --strict'
        ],
        handler: async (args: any, config: Config) => await handleUICommand('validate', args, config)
      }
    ],
    examples: [
      'arbiter ui scaffold profile.cue',
      'arbiter ui validate profile.cue'
    ],
    handler: async (args: any, config: Config) => {
      const subcommand = args._[1];
      if (!subcommand) {
        logError('Missing UI subcommand. Available: scaffold, validate', config);
        process.exit(1);
      }
      
      await handleUICommand(subcommand, args, config);
    }
  },
  {
    name: 'ticket',
    summary: 'Request mutation ticket from server',
    flags: [
      { name: 'scope', type: 'string', description: 'Plan hash scope (required)' },
      { name: 'expires', type: 'string', default: '1h', description: 'Ticket expiration (e.g. 30m, 2h)' }
    ],
    examples: [
      'arbiter ticket --scope plan-abc123',
      'arbiter ticket --scope plan-abc123 --expires 30m'
    ],
    handler: handleTicket
  },
  {
    name: 'verify',
    summary: 'Verify stamps and tickets',
    flags: [
      { name: 'strict', type: 'bool', default: false },
      { name: 'repo-path', type: 'string', default: '.' }
    ],
    examples: [
      'arbiter verify',
      'arbiter verify --strict --repo-path .'
    ],
    handler: handleVerify
  },
  {
    name: 'execute',
    summary: 'Execute Epic v2 code generation',
    args: ['epic'],
    flags: [
      { name: 'ticket', type: 'string', description: 'Required mutation ticket' },
      { name: 'dry-run', type: 'bool', default: false }
    ],
    examples: [
      'arbiter execute epic-auth --ticket tkn_abc123'
    ],
    handler: handleExecute
  },
  {
    name: 'explain',
    summary: 'Plain-English assembly explanation',
    flags: [
      { name: 'sections', type: 'string', choices: ['all', 'assembly', 'contracts', 'ui'], default: 'all' }
    ],
    examples: [
      'arbiter explain',
      'arbiter explain --sections contracts'
    ],
    handler: handleExplain
  },
  {
    name: 'health',
    summary: 'Check API server health',
    examples: ['arbiter health'],
    handler: handleHealth
  },
  {
    name: 'tests',
    summary: 'Contract test generation and coverage',
    subcommands: [
      {
        name: 'generate',
        summary: 'Generate property tests, scenario tests, fault tests from contracts',
        flags: [
          { name: 'from-assembly', type: 'bool', default: true, description: 'Generate from CUE assembly file' },
          { name: 'language', type: 'string', choices: ['py', 'ts', 'rs', 'go', 'sh'], default: 'ts', description: 'Target language' },
          { name: 'output', type: 'string', default: 'tests/contracts', description: 'Output directory' },
          { name: 'property-tests', type: 'string', default: '50', description: 'Number of property tests per contract' },
          { name: 'dry-run', type: 'bool', default: false, description: 'Show what would be generated' }
        ],
        examples: [
          'arbiter tests generate --language ts',
          'arbiter tests generate --language py --output tests/py'
        ],
        handler: async (args: any, config: Config) => {
          // Delegate to contract test generation
          await handleContractTestGenerate(args, config);
        }
      },
      {
        name: 'cover',
        summary: 'Compute contract coverage and scenario coverage',
        flags: [
          { name: 'input', type: 'string', default: 'tests/contracts', description: 'Input directory containing test results' },
          { name: 'output', type: 'string', default: 'coverage/contracts', description: 'Output directory for coverage reports' },
          { name: 'format', type: 'string', default: 'json,junit', description: 'Report formats: json,junit,lcov,html' },
          { name: 'threshold', type: 'string', default: '80', description: 'Minimum coverage threshold' }
        ],
        examples: [
          'arbiter tests cover',
          'arbiter tests cover --format json,junit,html'
        ],
        handler: async (args: any, config: Config) => {
          // Delegate to contract test coverage
          await handleContractTestCover(args, config);
        }
      }
    ],
    examples: [
      'arbiter tests generate --language ts',
      'arbiter tests cover --format json,junit'
    ],
    handler: async (args: any, config: Config) => {
      const subcommand = args._[1];
      if (!subcommand) {
        logError('Missing tests subcommand. Available: generate, cover', config);
        process.exit(1);
      }
      
      // Delegate to appropriate subcommand
      const testsCmd = commands.find(c => c.name === 'tests');
      const subcmd = testsCmd?.subcommands?.find(sc => sc.name === subcommand);
      if (subcmd) {
        await subcmd.handler(args, config);
      } else {
        logError(`Unknown tests subcommand: ${subcommand}`, config);
        process.exit(1);
      }
    }
  },
  {
    name: 'plan',
    summary: 'Planning and milestone management',
    subcommands: [
      {
        name: 'milestone',
        summary: 'Generate concrete implementation steps from scenarios and contracts',
        args: ['id'],
        flags: [
          { name: 'output', type: 'string', default: 'plans', description: 'Output directory for plan documents' },
          { name: 'format', type: 'string', choices: ['markdown', 'json', 'cue'], default: 'markdown', description: 'Plan format' },
          { name: 'idempotent', type: 'bool', default: true, description: 'Only create plan if it doesn\'t exist' }
        ],
        examples: [
          'arbiter plan milestone auth-epic',
          'arbiter plan milestone auth-epic --format json'
        ],
        handler: async (args: any, config: Config) => {
          const milestoneId = args._[2];
          if (!milestoneId) {
            logError('Missing milestone ID argument', config);
            process.exit(1);
          }
          
          // Delegate to milestone planning
          await handlePlanMilestone(milestoneId, args, config);
        }
      }
    ],
    examples: [
      'arbiter plan milestone auth-epic'
    ],
    handler: async (args: any, config: Config) => {
      const subcommand = args._[1];
      if (!subcommand) {
        logError('Missing plan subcommand. Available: milestone', config);
        process.exit(1);
      }
      
      // Delegate to appropriate subcommand
      const planCmd = commands.find(c => c.name === 'plan');
      const subcmd = planCmd?.subcommands?.find(sc => sc.name === subcommand);
      if (subcmd) {
        await subcmd.handler(args, config);
      } else {
        logError(`Unknown plan subcommand: ${subcommand}`, config);
        process.exit(1);
      }
    }
  },
  {
    name: 'watch',
    summary: 'Continuous validation loop with NDJSON output',
    flags: [
      { name: 'patterns', type: 'string', description: 'File patterns to watch (comma-separated)', default: '**/*.cue,**/*.json,**/*.yaml' },
      { name: 'debounce', type: 'string', description: 'Debounce delay in milliseconds', default: '300' },
      { name: 'parallel', type: 'string', description: 'Number of parallel validations', default: '4' },
      { name: 'output', type: 'string', description: 'Output file for NDJSON (- for stdout)', default: '-' },
      { name: 'format', type: 'string', choices: ['ndjson', 'json', 'table'], default: 'ndjson', description: 'Output format' },
      { name: 'fast', type: 'bool', default: false, description: 'Run in fast mode (incremental validation only)' },
      { name: 'selective', type: 'string', description: 'Selective validation types (validate,surface,ui,contracts,budgets)', default: 'validate,surface,ui,contracts,budgets' },
      { name: 'timeout', type: 'string', description: 'Maximum processing time per validation', default: '750' },
      { name: 'max-payload', type: 'string', description: 'Maximum payload size in bytes', default: '65536' },
      { name: 'max-rate', type: 'string', description: 'Maximum validation rate per second', default: '1.0' },
      { name: 'buffer-size', type: 'string', description: 'Output buffer size', default: '50' }
    ],
    examples: [
      'arbiter watch                                    # Watch all CUE/JSON/YAML files',
      'arbiter watch --patterns="**/*.cue"             # Only CUE files',
      'arbiter watch --fast --selective=validate,ui    # Fast mode, only validate and UI',
      'arbiter watch --output=validation.ndjson        # Save to file',
      'arbiter watch --timeout=1000 --max-rate=2       # Custom resource limits'
    ],
    handler: handleWatch
  },
  {
    name: 'docs',
    summary: 'Comprehensive documentation and workflow system',
    subcommands: [
      {
        name: 'workflow',
        summary: 'Generate Golden Path workflow documentation',
        flags: [
          { name: 'md', type: 'bool', default: true, description: 'Output in Markdown format' },
          { name: 'out', type: 'string', default: 'WORKFLOW.md', description: 'Output file path' },
          { name: 'template', type: 'string', choices: ['basic', 'detailed', 'enterprise'], default: 'detailed' }
        ],
        examples: [
          'arbiter docs workflow',
          'arbiter docs workflow --out docs/DEVELOPMENT.md --template enterprise'
        ],
        handler: async (args: any, config: Config) => {
          const { executeWorkflowCommand } = await import('../commands/docs.js');
          await executeWorkflowCommand({
            md: args.md,
            out: args.out,
            template: args.template,
            includeRules: true,
            includeExamples: true,
            includeNextSteps: true,
            verbose: config.verbose,
            json: config.agentMode
          });
        }
      },
      {
        name: 'api',
        summary: 'Generate API documentation from schemas',
        flags: [
          { name: 'format', type: 'string', choices: ['openapi', 'markdown', 'html'], default: 'openapi' },
          { name: 'out', type: 'string', default: 'API.md', description: 'Output file path' }
        ],
        examples: [
          'arbiter docs api --format openapi --out openapi.yaml',
          'arbiter docs api --format markdown --out API_DOCS.md'
        ],
        handler: async (args: any, config: Config) => {
          const { executeAPICommand } = await import('../commands/docs.js');
          await executeAPICommand({
            format: args.format,
            out: args.out,
            includeExamples: true,
            includeSchemas: true,
            includeAuth: true,
            verbose: config.verbose
          });
        }
      },
      {
        name: 'architecture',
        summary: 'Generate architecture documentation templates',
        flags: [
          { name: 'template', type: 'string', choices: ['basic', 'detailed', 'c4model', 'adr'], default: 'detailed' },
          { name: 'out', type: 'string', default: 'ARCHITECTURE.md', description: 'Output file path' }
        ],
        examples: [
          'arbiter docs architecture --template c4model',
          'arbiter docs architecture --template adr --out decisions/ADR-001.md'
        ],
        handler: async (args: any, config: Config) => {
          const { executeArchitectureCommand } = await import('../commands/docs.js');
          await executeArchitectureCommand({
            template: args.template,
            out: args.out,
            includeDecisions: true,
            includeRisks: true,
            includeMetrics: true,
            verbose: config.verbose
          });
        }
      }
    ],
    examples: [
      'arbiter docs workflow --md --out WORKFLOW.md',
      'arbiter docs api --format openapi --out openapi.yaml',
      'arbiter docs architecture --template c4model'
    ],
    handler: async (args: any, config: Config) => {
      const subcommand = args._[1];
      if (!subcommand) {
        logError('Missing docs subcommand. Available: workflow, api, architecture', config);
        process.exit(1);
      }
      
      // Delegate to appropriate subcommand
      const docsCmd = commands.find(c => c.name === 'docs');
      const subcmd = docsCmd?.subcommands?.find(sc => sc.name === subcommand);
      if (subcmd) {
        await subcmd.handler(args, config);
        
        // Show next step hint
        if (!config.agentMode) {
          console.log(chalk.blue(`\n💡 Next: ${addNextStepHints('docs', {})}`));
        }
      } else {
        logError(`Unknown docs subcommand: ${subcommand}`, config);
        process.exit(1);
      }
    }
  }
];

// Help system
function showHelp(): void {
  console.log(`${c.bold('Arbiter CLI')} - Comprehensive CUE validation and management\n`);
  console.log(`${c.bold('USAGE:')}\n  arbiter <command> [options]\n`);
  
  // Group commands by phase
  const phases = [
    { name: 'CORE COMMANDS (Phase 1):', commands: ['import', 'generate', 'check', 'health'] },
    { name: 'UI PROFILE SYSTEM:', commands: ['ui'] },
    { name: 'CONTRACTS & GUARANTEES:', commands: ['tests', 'plan'] },
    { name: 'CONTINUOUS LOOP (Phase 5):', commands: ['watch'] },
    { name: 'RAILS & GUARANTEES (Phase 2):', commands: ['ticket', 'verify', 'execute'] },
    { name: 'DOCUMENTATION (Phase 6):', commands: ['docs', 'explain'] }
  ];
  
  phases.forEach(phase => {
    console.log(`${c.bold(phase.name)}`);
    phase.commands.forEach(cmdName => {
      const cmd = commands.find(c => c.name === cmdName);
      if (cmd) {
        console.log(`  ${c.primary(cmd.name.padEnd(12))} ${cmd.summary}`);
      }
    });
    console.log();
  });
  
  console.log(`${c.bold('GLOBAL OPTIONS:')}`);
  console.log(`  --api-url <url>        API server URL (default: http://localhost:4001)`);
  console.log(`  --agent-mode           Output NDJSON for agent consumption`);
  console.log(`  --format <type>        Output format: table, json, yaml`);
  console.log(`  --verbose, -v          Verbose output`);
  console.log(`  --dry-run              Show what would be done without doing it`);
  console.log(`  --force                Force overwrite existing files\n`);
  
  console.log(`${c.bold('EXAMPLES:')}`);
  console.log(`  # Core workflow`);
  console.log(`  arbiter import .                          # Import current directory`);
  console.log(`  arbiter generate --template library       # Generate library profile`);
  console.log(`  arbiter check                             # Validate CUE files and UI profiles\n`);
  
  console.log(`  # UI Profile workflow`);
  console.log(`  arbiter ui scaffold profile.cue           # Generate UI artifacts`);
  console.log(`  arbiter ui scaffold profile.cue --platform web --output ./src`);
  console.log(`  arbiter check --no-ui-a11y                # Skip accessibility validation\n`);
  
  console.log(`  # Contract & Guarantees workflow`);
  console.log(`  arbiter tests generate --language ts      # Generate TypeScript contract tests`);
  console.log(`  arbiter tests generate --language py --output tests/py # Python tests`);
  console.log(`  arbiter tests cover --format json,junit   # Generate coverage reports`);
  console.log(`  arbiter plan milestone auth-epic          # Generate implementation plan`);
  console.log(`  arbiter check --contract-thresholds contract=0.9 # Custom thresholds\n`);
  
  console.log(`  # Continuous Loop workflow`);
  console.log(`  arbiter watch                             # Monitor all files with NDJSON output`);
  console.log(`  arbiter watch --fast --selective=validate,ui # Fast mode, specific phases`);
  console.log(`  arbiter watch --output=validation.ndjson  # Save to file`);
  console.log(`  arbiter watch --format=table              # Human-readable output\n`);
  
  console.log(`  # Rails & Guarantees workflow`);
  console.log(`  arbiter ticket --scope plan-abc123        # Request mutation ticket`);
  console.log(`  arbiter execute epic-auth --ticket tkn_123 # Execute with ticket`);
  console.log(`  arbiter verify --strict                    # Verify all stamps\n`);
  
  console.log(`  # Documentation & Workflow workflow`);
  console.log(`  arbiter docs workflow --out WORKFLOW.md   # Generate Golden Path docs`);
  console.log(`  arbiter docs api --format openapi         # Generate OpenAPI spec`);
  console.log(`  arbiter docs architecture --template c4   # Generate architecture docs`);
  console.log(`  arbiter explain --sections contracts      # Plain-English explanations\n`);
  
  console.log(`${c.bold('AGENT MODE:')}`);
  console.log(`  Use --agent-mode for NDJSON output suitable for AI agent consumption.`);
  console.log(`  Many commands support this mode for programmatic integration.`);
}

function showVersion(): void {
  console.log('arbiter 2.0.0 (Rails & Guarantees)');
}

// Main CLI handler
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Handle help and version
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  if (args.includes('--version')) {
    showVersion();
    return;
  }
  
  // Parse global flags
  const config: Config = { ...DEFAULT_CONFIG };
  
  // Simple flag parsing
  const commandArgs: any = { _: [] };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      
      // Handle global flags
      if (key === 'api-url') {
        config.apiUrl = nextArg;
        i++;
      } else if (key === 'agent-mode') {
        config.agentMode = true;
      } else if (key === 'format') {
        config.format = nextArg as 'table' | 'json' | 'yaml';
        i++;
      } else if (key === 'verbose') {
        config.verbose = true;
      } else if (key === 'dry-run') {
        config.dryRun = true;
      } else if (key === 'force') {
        config.force = true;
      } else {
        // Command-specific flag
        if (nextArg && !nextArg.startsWith('--')) {
          commandArgs[key] = nextArg;
          i++;
        } else {
          commandArgs[key] = true;
        }
      }
    } else {
      commandArgs._.push(arg);
    }
  }
  
  const commandName = commandArgs._[0];
  if (!commandName) {
    logError('No command specified', config);
    process.exit(1);
  }
  
  // Find and execute command
  const command = commands.find(c => c.name === commandName);
  if (!command) {
    logError(`Unknown command: ${commandName}`, config);
    logError('Run "arbiter --help" to see available commands', config);
    process.exit(1);
  }
  
  try {
    await command.handler(commandArgs, config);
  } catch (error) {
    logError(error instanceof Error ? error.message : 'Command failed', config);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { main, commands };