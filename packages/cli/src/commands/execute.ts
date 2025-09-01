import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { diffLines } from 'diff';
import { glob } from 'glob';
import yaml from 'js-yaml';
import { createOutputManager, type PlanOutput, type ExecutionReport, shouldUseAgentMode } from '../utils/standardized-output.js';

/**
 * Epic v2 execution engine with deterministic file-plan generation
 * Implements the agent-first, idempotent codegen approach from TODO.md
 */

export interface Epic {
  id: string;
  title: string;
  owners: string[];
  targets: Array<{
    root: string;
    include: string[];
    exclude: string[];
  }>;
  generate: Array<{
    path: string;
    mode: 'create' | 'patch';
    template: string;
    data: Record<string, any>;
    guards: string[];
  }>;
  contracts: {
    types: string[];
    invariants: string[];
  };
  tests: {
    static: Array<{ selector: string }>;
    property: Array<{ name: string; cue: string }>;
    golden: Array<{ input: string; want: string }>;
    cli: Array<{ cmd: string; expectExit: number; expectRE?: string }>;
  };
  rollout: {
    steps: string[];
    gates: Array<{ name: string; cue: string }>;
  };
  heuristics: {
    preferSmallPRs: boolean;
    maxFilesPerPR: number;
  };
  metadata?: {
    created?: string;
    updated?: string;
    version?: string;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high' | 'critical';
    complexity?: number;
  };
}

export interface FileOperation {
  path: string;
  mode: 'create' | 'patch';
  content: string;
  guards: string[];
  originalExists: boolean;
  originalContent?: string;
}

export interface ExecutionPlan {
  epicId: string;
  operations: FileOperation[];
  sortedOrder: string[];
  conflicts: string[];
  guardViolations: string[];
}

export interface ExecutionSummary {
  epicId: string;
  timestamp: string;
  filesChanged: number;
  testsRun: number;
  testsPassed: number;
  contractsChecked: number;
  contractsPassed: number;
  rolloutGatesChecked: number;
  rolloutGatesPassed: number;
  overallSuccess: boolean;
  duration: number;
  results: Array<{
    name: string;
    passed: boolean;
    duration?: number;
    error?: string;
    details?: any;
  }>;
}

export interface ExecuteOptions {
  dryRun?: boolean;
  epic: string;
  workspace?: string;
  timeout?: number;
  junit?: string;
  verbose?: boolean;
  agentMode?: boolean;
  ndjsonOutput?: string;
}

/**
 * Load and parse epic from CUE file
 */
async function loadEpic(epicPath: string): Promise<Epic> {
  try {
    const content = await fs.readFile(epicPath, 'utf-8');
    
    // For now, assume the epic is in JSON format or can be parsed as such
    // In a real implementation, we'd use CUE's parser
    // This is a simplified version for the prototype
    if (content.includes('package epics') || content.includes(': epics.#Epic')) {
      // CUE format - would need proper CUE parsing here
      throw new Error('CUE parsing not yet implemented - please provide JSON format for now');
    }
    
    // Try to parse as JSON/YAML
    let epic: Epic;
    try {
      epic = JSON.parse(content);
    } catch {
      epic = yaml.load(content) as Epic;
    }
    
    // Validate required fields
    if (!epic.id || !epic.title || !epic.owners || !epic.generate) {
      throw new Error('Invalid epic: missing required fields (id, title, owners, generate)');
    }
    
    return epic;
  } catch (error) {
    throw new Error(`Failed to load epic from ${epicPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Load template content with simple variable substitution
 */
async function loadTemplate(templatePath: string, data: Record<string, any>): Promise<string> {
  try {
    let content = await fs.readFile(templatePath, 'utf-8');
    
    // Simple template variable substitution - {{.variable}}
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{\\{\\.${key}\\}\\}`, 'g');
      content = content.replace(regex, String(value));
    }
    
    // Handle conditional blocks - {{if .variable}}...{{end}}
    content = content.replace(/\{\{if\s+\.(\w+)\}\}(.*?)\{\{end\}\}/gs, (match, varName, block) => {
      return data[varName] ? block : '';
    });
    
    return content;
  } catch (error) {
    // If template file doesn't exist, treat template as inline content
    if ((error as any).code === 'ENOENT') {
      let content = templatePath;
      
      // Apply same substitutions to inline template
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{\\{\\.${key}\\}\\}`, 'g');
        content = content.replace(regex, String(value));
      }
      
      return content;
    }
    throw error;
  }
}

/**
 * Check if guards are satisfied for a file operation
 */
async function checkGuards(filePath: string, guards: string[]): Promise<string[]> {
  const violations: string[] = [];
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    for (const guard of guards) {
      if (content.includes(guard)) {
        violations.push(`Guard violation: "${guard}" already exists in ${filePath}`);
      }
    }
  } catch (error) {
    // File doesn't exist - no guard violations
  }
  
  return violations;
}

/**
 * Generate deterministic file plan from epic
 */
async function generatePlan(epic: Epic, workspace: string): Promise<ExecutionPlan> {
  const operations: FileOperation[] = [];
  const conflicts: string[] = [];
  const guardViolations: string[] = [];
  
  for (const gen of epic.generate) {
    const fullPath = path.isAbsolute(gen.path) ? gen.path : path.join(workspace, gen.path);
    
    // Check if file exists
    let originalExists = false;
    let originalContent: string | undefined;
    try {
      originalContent = await fs.readFile(fullPath, 'utf-8');
      originalExists = true;
    } catch {
      originalExists = false;
    }
    
    // Check guards
    const violations = await checkGuards(fullPath, gen.guards);
    guardViolations.push(...violations);
    
    // Load and render template
    const content = await loadTemplate(gen.template, gen.data);
    
    // Check for conflicts
    if (gen.mode === 'create' && originalExists) {
      conflicts.push(`Conflict: ${gen.path} already exists but mode is 'create'`);
    }
    
    operations.push({
      path: fullPath,
      mode: gen.mode,
      content,
      guards: gen.guards,
      originalExists,
      originalContent,
    });
  }
  
  // Sort operations by depth and path for deterministic order
  const sortedOrder = operations
    .map(op => op.path)
    .sort((a, b) => {
      const depthA = a.split(path.sep).length;
      const depthB = b.split(path.sep).length;
      
      if (depthA !== depthB) {
        return depthA - depthB; // Parents before children
      }
      
      return a.localeCompare(b); // Lexicographic order
    });
  
  return {
    epicId: epic.id,
    operations: operations.sort((a, b) => sortedOrder.indexOf(a.path) - sortedOrder.indexOf(b.path)),
    sortedOrder,
    conflicts,
    guardViolations,
  };
}

/**
 * Apply patch operation with ARBITER markers
 */
function applyPatch(originalContent: string, patchContent: string): string {
  // Look for ARBITER:BEGIN/END markers in patch
  const markerRegex = /\/\/\s*ARBITER:BEGIN\s+(\w+)(.*?)\/\/\s*ARBITER:END\s+\1/gs;
  
  let result = originalContent;
  let match;
  
  while ((match = markerRegex.exec(patchContent)) !== null) {
    const [fullMatch, markerId, blockContent] = match;
    
    // Check if this block already exists in original
    const existingBlockRegex = new RegExp(`//\\s*ARBITER:BEGIN\\s+${markerId}.*?//\\s*ARBITER:END\\s+${markerId}`, 'gs');
    
    if (existingBlockRegex.test(result)) {
      // Replace existing block
      result = result.replace(existingBlockRegex, fullMatch.trim());
    } else {
      // Append new block
      result = result + '\n\n' + fullMatch.trim();
    }
  }
  
  return result;
}

/**
 * Apply execution plan to filesystem
 */
async function applyPlan(plan: ExecutionPlan, dryRun: boolean = false): Promise<void> {
  for (const operation of plan.operations) {
    if (dryRun) {
      continue; // Skip actual file operations in dry run
    }
    
    // Ensure directory exists
    const dir = path.dirname(operation.path);
    await fs.mkdir(dir, { recursive: true });
    
    let finalContent = operation.content;
    
    if (operation.mode === 'patch' && operation.originalExists && operation.originalContent) {
      finalContent = applyPatch(operation.originalContent, operation.content);
    }
    
    await fs.writeFile(operation.path, finalContent, 'utf-8');
  }
}

/**
 * Generate colored diff output for dry run
 */
function generateDiff(operation: FileOperation): string {
  if (!operation.originalExists) {
    // New file
    const lines = operation.content.split('\n');
    return lines.map(line => chalk.green(`+${line}`)).join('\n');
  }
  
  if (!operation.originalContent) {
    return chalk.red('Error: Original content not available');
  }
  
  let finalContent = operation.content;
  if (operation.mode === 'patch') {
    finalContent = applyPatch(operation.originalContent, operation.content);
  }
  
  const diff = diffLines(operation.originalContent, finalContent);
  return diff.map(part => {
    const lines = part.value.split('\n').filter(line => line !== '');
    if (part.added) {
      return lines.map(line => chalk.green(`+${line}`)).join('\n');
    } else if (part.removed) {
      return lines.map(line => chalk.red(`-${line}`)).join('\n');
    } else {
      return lines.map(line => ` ${line}`).join('\n');
    }
  }).join('\n');
}

/**
 * Run simple CLI test
 */
async function runCliTest(test: { cmd: string; expectExit: number; expectRE?: string }, timeout: number): Promise<{ passed: boolean; error?: string; duration: number }> {
  const startTime = Date.now();
  
  try {
    const { spawn } = await import('child_process');
    const [command, ...args] = test.cmd.split(' ');
    
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        if (code !== test.expectExit) {
          resolve({
            passed: false,
            error: `Expected exit code ${test.expectExit}, got ${code}. stderr: ${stderr}`,
            duration,
          });
          return;
        }
        
        if (test.expectRE && !new RegExp(test.expectRE).test(stdout)) {
          resolve({
            passed: false,
            error: `Output didn't match expected regex: ${test.expectRE}`,
            duration,
          });
          return;
        }
        
        resolve({ passed: true, duration });
      });
      
      proc.on('error', (error) => {
        resolve({
          passed: false,
          error: error.message,
          duration: Date.now() - startTime,
        });
      });
    });
  } catch (error) {
    return {
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute epic with full test and validation pipeline
 */
export async function executeCommand(options: ExecuteOptions): Promise<number> {
  const startTime = Date.now();
  const workspace = options.workspace || process.cwd();
  const agentMode = shouldUseAgentMode(options);
  const outputManager = createOutputManager('execute', agentMode, options.ndjsonOutput);
  
  try {
    // Emit start event
    outputManager.emitEvent({
      phase: 'plan',
      status: 'start',
      data: { epic: options.epic, workspace }
    });

    if (!agentMode) {
      console.log(chalk.blue(`🚀 Executing epic: ${options.epic}`));
      console.log(chalk.dim(`Workspace: ${workspace}`));
    }
    
    // Load epic specification
    const epic = await loadEpic(options.epic);
    if (!agentMode) {
      console.log(chalk.cyan(`📋 Epic: ${epic.title} (${epic.id})`));
      console.log(chalk.dim(`Owners: ${epic.owners.join(', ')}`));
    }
    
    // Generate execution plan
    if (!agentMode) {
      console.log(chalk.blue('\n📊 Generating execution plan...'));
    }
    const plan = await generatePlan(epic, workspace);
    
    // Check for conflicts and violations
    if (plan.conflicts.length > 0) {
      if (!agentMode) {
        console.log(chalk.red('\n❌ Conflicts detected:'));
        plan.conflicts.forEach(conflict => console.log(chalk.red(`  • ${conflict}`)));
      }
      outputManager.emitEvent({
        phase: 'plan',
        status: 'error',
        error: `Conflicts detected: ${plan.conflicts.join(', ')}`
      });
      outputManager.close();
      return 1;
    }
    
    if (plan.guardViolations.length > 0) {
      if (!agentMode) {
        console.log(chalk.red('\n❌ Guard violations:'));
        plan.guardViolations.forEach(violation => console.log(chalk.red(`  • ${violation}`)));
      }
      outputManager.emitEvent({
        phase: 'plan',
        status: 'error',
        error: `Guard violations: ${plan.guardViolations.join(', ')}`
      });
      outputManager.close();
      return 1;
    }
    
    // Create plan output in standardized format
    const planOutput: PlanOutput['plan'] = plan.operations.map((op, index) => ({
      id: `op-${index + 1}`,
      type: 'file' as const,
      action: op.mode === 'create' ? 'create' as const : 'update' as const,
      target: path.relative(workspace, op.path),
      content: op.content,
      dependencies: [],
      estimatedTime: 100 // milliseconds estimate
    }));

    const guards: PlanOutput['guards'] = plan.guardViolations.map((violation, index) => ({
      id: `guard-${index + 1}`,
      type: 'constraint' as const,
      description: violation,
      required: true
    }));

    const diff = {
      added: plan.operations.filter(op => !op.originalExists).length,
      modified: plan.operations.filter(op => op.originalExists).length,
      deleted: 0,
      summary: `${plan.operations.length} operations planned`
    };

    // Write plan.json file
    await outputManager.writePlanFile(planOutput, guards, diff);

    outputManager.emitEvent({
      phase: 'plan',
      status: 'complete',
      data: { actions: plan.operations.length, guards: guards.length }
    });

    if (!agentMode) {
      console.log(chalk.green(`✓ Plan generated: ${plan.operations.length} operations`));
    }
    
    // Dry run output
    if (options.dryRun) {
      if (!agentMode) {
        console.log(chalk.blue('\n📝 Dry run - showing planned changes:\n'));
        
        for (const operation of plan.operations) {
          const relativePath = path.relative(workspace, operation.path);
          console.log(chalk.bold(`📄 ${relativePath} (${operation.mode})`));
          
          if (options.verbose) {
            const diffText = generateDiff(operation);
            console.log(diffText);
            console.log(''); // Empty line separator
          }
        }
        
        console.log(chalk.blue(`\n📊 Summary:`));
        console.log(`  Files to modify: ${plan.operations.length}`);
        console.log(`  New files: ${plan.operations.filter(op => !op.originalExists).length}`);
        console.log(`  Existing files: ${plan.operations.filter(op => op.originalExists).length}`);
      }

      // Generate diff.txt file
      const diffContent = plan.operations.map(op => generateDiff(op)).join('\n\n');
      await outputManager.writeDiffFile(diffContent);
      
      outputManager.close();
      return 0;
    }
    
    // Apply changes
    outputManager.emitEvent({
      phase: 'execute',
      status: 'start',
      data: { total: plan.operations.length }
    });

    if (!agentMode) {
      console.log(chalk.blue('\n🔧 Applying changes...'));
    }
    await applyPlan(plan, false);
    
    if (!agentMode) {
      console.log(chalk.green(`✓ Applied ${plan.operations.length} file operations`));
    }

    outputManager.emitEvent({
      phase: 'execute',
      status: 'complete',
      data: { progress: plan.operations.length, total: plan.operations.length }
    });
    
    // Run tests
    const results: ExecutionSummary['results'] = [];
    
    // CLI tests
    if (epic.tests.cli?.length > 0) {
      outputManager.emitEvent({
        phase: 'test',
        status: 'start',
        data: { tests: epic.tests.cli.length }
      });

      if (!agentMode) {
        console.log(chalk.blue('\n🧪 Running CLI tests...'));
      }
      
      for (const test of epic.tests.cli) {
        if (!agentMode) {
          console.log(chalk.dim(`  Running: ${test.cmd}`));
        }
        const result = await runCliTest(test, options.timeout || 30000);
        
        results.push({
          name: `CLI: ${test.cmd}`,
          passed: result.passed,
          duration: result.duration,
          error: result.error,
        });
        
        if (!agentMode) {
          if (result.passed) {
            console.log(chalk.green(`  ✓ ${test.cmd} (${result.duration}ms)`));
          } else {
            console.log(chalk.red(`  ✗ ${test.cmd} (${result.duration}ms)`));
            if (result.error) {
              console.log(chalk.red(`    ${result.error}`));
            }
          }
        }
      }

      outputManager.emitEvent({
        phase: 'test',
        status: 'complete',
        data: { 
          tests: results.length, 
          passed: results.filter(r => r.passed).length, 
          failed: results.filter(r => !r.passed).length 
        }
      });
    }
    
    // Generate summary
    const duration = Date.now() - startTime;
    const summary: ExecutionSummary = {
      epicId: epic.id,
      timestamp: new Date().toISOString(),
      filesChanged: plan.operations.length,
      testsRun: results.length,
      testsPassed: results.filter(r => r.passed).length,
      contractsChecked: epic.contracts.types.length + epic.contracts.invariants.length,
      contractsPassed: 0, // Would be implemented with actual CUE evaluation
      rolloutGatesChecked: epic.rollout.gates.length,
      rolloutGatesPassed: 0, // Would be implemented with actual CUE evaluation
      overallSuccess: results.every(r => r.passed),
      duration,
      results,
    };

    // Create standardized execution report
    const executionReport: ExecutionReport = {
      apiVersion: 'arbiter.dev/v2',
      timestamp: Date.now(),
      command: 'execute',
      kind: 'ExecutionReport',
      applied: plan.operations.map((op, index) => ({
        id: `op-${index + 1}`,
        action: op.mode,
        target: path.relative(workspace, op.path),
        status: 'success' as const,
        duration: 100 // Would track actual duration
      })),
      report: {
        totalActions: plan.operations.length,
        successful: plan.operations.length,
        failed: 0,
        skipped: 0,
        duration
      }
    };

    // Create JUnit report if needed
    if (options.junit || results.length > 0) {
      executionReport.junit = {
        name: `Epic.${epic.id}`,
        tests: results.length,
        failures: results.filter(r => !r.passed).length,
        errors: 0,
        time: duration / 1000,
        testcases: results.map(result => ({
          classname: `Epic.${epic.id}`,
          name: result.name,
          time: (result.duration || 0) / 1000,
          ...(result.passed ? {} : {
            failure: {
              message: result.error || 'Test failed',
              type: 'AssertionError',
              content: result.error || 'Test failed'
            }
          })
        }))
      };
    }

    // Write standardized reports
    await outputManager.writeReportFile(executionReport);
    
    if (options.junit) {
      await outputManager.writeJUnitFile(executionReport.junit!);
    }
    
    if (!agentMode) {
      // Output summary
      console.log(chalk.blue('\n📊 Execution Summary:'));
      console.log(`  Epic: ${summary.epicId}`);
      console.log(`  Files changed: ${summary.filesChanged}`);
      console.log(`  Tests: ${summary.testsPassed}/${summary.testsRun} passed`);
      console.log(`  Duration: ${summary.duration}ms`);
      console.log(`  Overall: ${summary.overallSuccess ? chalk.green('SUCCESS') : chalk.red('FAILED')}`);
    }

    outputManager.close();
    return summary.overallSuccess ? 0 : 1;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (!agentMode) {
      console.error(chalk.red('❌ Execution failed:'), errorMessage);
    }
    
    outputManager.emitEvent({
      phase: 'execute',
      status: 'error',
      error: errorMessage
    });
    
    outputManager.close();
    return 2;
  }
}

/**
 * Generate JUnit XML report
 */
function generateJUnitXML(summary: ExecutionSummary): string {
  const testcases = summary.results.map(result => `
    <testcase 
      classname="Epic.${summary.epicId}" 
      name="${result.name}" 
      time="${(result.duration || 0) / 1000}">
      ${result.passed ? '' : `<failure message="${result.error || 'Test failed'}">${result.error || 'Test failed'}</failure>`}
    </testcase>`).join('');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite 
  name="Epic.${summary.epicId}" 
  tests="${summary.testsRun}" 
  failures="${summary.testsRun - summary.testsPassed}" 
  time="${summary.duration / 1000}"
  timestamp="${summary.timestamp}">
  ${testcases}
</testsuite>`;
}