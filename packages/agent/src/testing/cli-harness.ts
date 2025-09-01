/**
 * CLI Contract Testing Harness
 * 
 * Comprehensive golden testing framework for CLI applications.
 * Supports snapshot testing, interactive session testing, and command tree validation.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import crypto from 'crypto';

export interface CLITestConfig {
  binaryPath: string;
  workingDir: string;
  timeout: number;
  env?: Record<string, string>;
  goldenDir?: string;
}

export interface CLITestCase {
  name: string;
  command: string[];
  stdin?: string;
  env?: Record<string, string>;
  expectedExitCode: number | number[];
  timeout?: number;
  skipPlatforms?: string[];
  description?: string;
}

export interface GoldenTestCase extends CLITestCase {
  updateGolden?: boolean;
  ignoreFields?: string[];
  normalizeOutput?: (output: string) => string;
}

export interface InteractiveTestCase {
  name: string;
  description?: string;
  timeout?: number;
  steps: InteractiveStep[];
}

export interface InteractiveStep {
  send: string;
  expect?: string | RegExp;
  delay?: number;
}

export interface CLITestResult {
  name: string;
  passed: boolean;
  duration: number;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  expectedVsActual?: {
    expected: any;
    actual: any;
  };
}

export interface CommandTreeNode {
  name: string;
  description?: string;
  usage?: string;
  flags?: CommandFlag[];
  subcommands?: CommandTreeNode[];
  examples?: string[];
}

export interface CommandFlag {
  name: string;
  short?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: any;
}

export class CLIContractHarness {
  constructor(private config: CLITestConfig) {}

  /**
   * Run a comprehensive CLI test suite
   */
  async runTestSuite(testCases: CLITestCase[]): Promise<CLITestResult[]> {
    const results: CLITestResult[] = [];
    
    for (const testCase of testCases) {
      const result = await this.runSingleTest(testCase);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Run golden tests with snapshot comparison
   */
  async runGoldenTests(testCases: GoldenTestCase[]): Promise<CLITestResult[]> {
    const results: CLITestResult[] = [];
    const goldenDir = this.config.goldenDir || path.join(this.config.workingDir, 'testdata', 'golden');
    
    // Ensure golden directory exists
    await fs.mkdir(goldenDir, { recursive: true });
    
    for (const testCase of testCases) {
      const result = await this.runGoldenTest(testCase, goldenDir);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Run interactive CLI session tests
   */
  async runInteractiveTests(testCases: InteractiveTestCase[]): Promise<CLITestResult[]> {
    const results: CLITestResult[] = [];
    
    for (const testCase of testCases) {
      const result = await this.runInteractiveTest(testCase);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Extract and validate command tree structure
   */
  async extractCommandTree(): Promise<CommandTreeNode> {
    const helpResult = await this.runCliCommand(['--help'], 10000);
    if (helpResult.exitCode !== 0) {
      throw new Error(`Failed to get help text: ${helpResult.stderr}`);
    }
    
    return this.parseCommandTree(helpResult.stdout);
  }

  /**
   * Validate that CLI conforms to expected command tree
   */
  async validateCommandTree(expectedTree: CommandTreeNode): Promise<boolean> {
    try {
      const actualTree = await this.extractCommandTree();
      return this.compareCommandTrees(expectedTree, actualTree);
    } catch (error) {
      return false;
    }
  }

  /**
   * Auto-generate help tests for all commands
   */
  async generateHelpTests(): Promise<CLITestCase[]> {
    const tests: CLITestCase[] = [];
    
    try {
      const commandTree = await this.extractCommandTree();
      this.addHelpTestsFromTree(tests, commandTree, []);
    } catch (error) {
      // If we can't extract the tree, add basic help tests
      tests.push({
        name: 'Root Help',
        command: ['--help'],
        expectedExitCode: 0,
        description: 'Root command help should be accessible',
      });
    }
    
    return tests;
  }

  private async runSingleTest(testCase: CLITestCase): Promise<CLITestResult> {
    const startTime = Date.now();
    const timeout = testCase.timeout || this.config.timeout;
    
    try {
      // Skip test if platform not supported
      if (testCase.skipPlatforms?.includes(process.platform)) {
        return {
          name: testCase.name,
          passed: true,
          duration: 0,
          stdout: '',
          stderr: '',
          exitCode: 0,
          error: `Skipped on ${process.platform}`,
        };
      }
      
      const result = await this.runCliCommand(testCase.command, timeout, testCase.stdin, testCase.env);
      
      // Check exit code
      const expectedCodes = Array.isArray(testCase.expectedExitCode) 
        ? testCase.expectedExitCode 
        : [testCase.expectedExitCode];
      
      const passed = expectedCodes.includes(result.exitCode);
      
      return {
        name: testCase.name,
        passed,
        duration: Date.now() - startTime,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        error: passed ? undefined : `Expected exit code ${testCase.expectedExitCode}, got ${result.exitCode}`,
        expectedVsActual: passed ? undefined : {
          expected: testCase.expectedExitCode,
          actual: result.exitCode,
        },
      };
    } catch (error) {
      return {
        name: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        stdout: '',
        stderr: '',
        exitCode: -1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async runGoldenTest(testCase: GoldenTestCase, goldenDir: string): Promise<CLITestResult> {
    const startTime = Date.now();
    const goldenFile = path.join(goldenDir, `${this.sanitizeFilename(testCase.name)}.golden.json`);
    
    try {
      const result = await this.runCliCommand(testCase.command, testCase.timeout || this.config.timeout, testCase.stdin, testCase.env);
      
      // Normalize output if normalizer provided
      let normalizedStdout = result.stdout;
      let normalizedStderr = result.stderr;
      if (testCase.normalizeOutput) {
        normalizedStdout = testCase.normalizeOutput(normalizedStdout);
        normalizedStderr = testCase.normalizeOutput(normalizedStderr);
      }
      
      const currentOutput = {
        exitCode: result.exitCode,
        stdout: normalizedStdout,
        stderr: normalizedStderr,
        duration: result.duration,
      };
      
      // Remove ignored fields
      if (testCase.ignoreFields) {
        for (const field of testCase.ignoreFields) {
          delete (currentOutput as any)[field];
        }
      }
      
      // Load existing golden file if exists
      let goldenOutput: any = null;
      try {
        const goldenContent = await fs.readFile(goldenFile, 'utf-8');
        goldenOutput = JSON.parse(goldenContent);
      } catch {
        // Golden file doesn't exist, will create it
      }
      
      // Update golden file if requested or if it doesn't exist
      if (testCase.updateGolden || !goldenOutput) {
        await fs.writeFile(goldenFile, JSON.stringify(currentOutput, null, 2));
        goldenOutput = currentOutput;
      }
      
      // Compare current output with golden
      const passed = this.compareOutputs(goldenOutput, currentOutput);
      
      return {
        name: testCase.name,
        passed,
        duration: Date.now() - startTime,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        error: passed ? undefined : 'Output differs from golden file',
        expectedVsActual: passed ? undefined : {
          expected: goldenOutput,
          actual: currentOutput,
        },
      };
    } catch (error) {
      return {
        name: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        stdout: '',
        stderr: '',
        exitCode: -1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async runInteractiveTest(testCase: InteractiveTestCase): Promise<CLITestResult> {
    const startTime = Date.now();
    const timeout = testCase.timeout || this.config.timeout;
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let stepIndex = 0;
      let timeoutHandle: NodeJS.Timeout;
      
      const child = spawn(this.config.binaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.workingDir,
        env: { ...process.env, ...this.config.env },
      });
      
      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        child.kill('SIGTERM');
      };
      
      const finishTest = (passed: boolean, error?: string) => {
        cleanup();
        resolve({
          name: testCase.name,
          passed,
          duration: Date.now() - startTime,
          stdout,
          stderr,
          exitCode: child.exitCode || 0,
          error,
        });
      };
      
      // Set overall timeout
      timeoutHandle = setTimeout(() => {
        finishTest(false, `Test timed out after ${timeout}ms`);
      }, timeout);
      
      const processNextStep = () => {
        if (stepIndex >= testCase.steps.length) {
          finishTest(true);
          return;
        }
        
        const step = testCase.steps[stepIndex];
        stepIndex++;
        
        // Send input
        child.stdin?.write(step.send + '\n');
        
        // Wait for expected output or delay
        if (step.expect) {
          const expectRegex = typeof step.expect === 'string' 
            ? new RegExp(step.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            : step.expect;
          
          if (!expectRegex.test(stdout)) {
            setTimeout(() => {
              if (!expectRegex.test(stdout)) {
                finishTest(false, `Expected output "${step.expect}" not found in step ${stepIndex}`);
                return;
              }
              processNextStep();
            }, step.delay || 100);
          } else {
            processNextStep();
          }
        } else {
          setTimeout(processNextStep, step.delay || 100);
        }
      };
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        finishTest(false, error.message);
      });
      
      child.on('close', (code) => {
        finishTest(stepIndex >= testCase.steps.length, code !== 0 ? `Process exited with code ${code}` : undefined);
      });
      
      // Start the interaction
      setTimeout(processNextStep, 100);
    });
  }

  private async runCliCommand(
    args: string[], 
    timeoutMs: number, 
    stdin?: string, 
    env?: Record<string, string>
  ): Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      const child = spawn(this.config.binaryPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.workingDir,
        env: { ...process.env, ...this.config.env, ...env },
      });
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? -1,
          duration: Date.now() - startTime,
        });
      });
      
      child.on('error', reject);
      
      // Send stdin if provided
      if (stdin) {
        child.stdin?.write(stdin);
        child.stdin?.end();
      } else {
        child.stdin?.end();
      }
      
      // Timeout handling
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      child.on('close', () => clearTimeout(timeout));
    });
  }

  private parseCommandTree(helpText: string): CommandTreeNode {
    // Basic parser for command help text
    // This is a simplified implementation - real CLIs would need custom parsers
    const lines = helpText.split('\n');
    
    const root: CommandTreeNode = {
      name: 'root',
      description: lines[0] || 'CLI application',
      flags: [],
      subcommands: [],
    };
    
    let currentSection = '';
    let inSubcommands = false;
    let inFlags = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.toLowerCase().includes('commands:') || trimmed.toLowerCase().includes('subcommands:')) {
        inSubcommands = true;
        inFlags = false;
        continue;
      }
      
      if (trimmed.toLowerCase().includes('options:') || trimmed.toLowerCase().includes('flags:')) {
        inFlags = true;
        inSubcommands = false;
        continue;
      }
      
      if (inSubcommands && trimmed && !trimmed.startsWith('-')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          root.subcommands?.push({
            name: parts[0],
            description: parts.slice(1).join(' '),
          });
        }
      }
      
      if (inFlags && trimmed.startsWith('-')) {
        const flagMatch = trimmed.match(/^(-\w),?\s*(--\w+)?\s*(.*)$/);
        if (flagMatch) {
          root.flags?.push({
            name: flagMatch[2] || flagMatch[1],
            short: flagMatch[1],
            description: flagMatch[3] || 'No description',
            type: 'string',
          });
        }
      }
    }
    
    return root;
  }

  private compareCommandTrees(expected: CommandTreeNode, actual: CommandTreeNode): boolean {
    if (expected.name !== actual.name) return false;
    
    // Compare flags
    const expectedFlags = expected.flags || [];
    const actualFlags = actual.flags || [];
    
    for (const expectedFlag of expectedFlags) {
      const found = actualFlags.find(f => f.name === expectedFlag.name);
      if (!found) return false;
    }
    
    // Compare subcommands
    const expectedSubcommands = expected.subcommands || [];
    const actualSubcommands = actual.subcommands || [];
    
    for (const expectedSub of expectedSubcommands) {
      const found = actualSubcommands.find(s => s.name === expectedSub.name);
      if (!found) return false;
      
      if (!this.compareCommandTrees(expectedSub, found)) return false;
    }
    
    return true;
  }

  private addHelpTestsFromTree(tests: CLITestCase[], node: CommandTreeNode, commandPath: string[]) {
    const fullPath = [...commandPath, node.name === 'root' ? '' : node.name].filter(Boolean);
    
    tests.push({
      name: `Help: ${fullPath.join(' ') || 'root'}`,
      command: [...fullPath, '--help'],
      expectedExitCode: 0,
      description: `Help for ${fullPath.join(' ') || 'root command'}`,
    });
    
    // Recursively add tests for subcommands
    if (node.subcommands) {
      for (const subcommand of node.subcommands) {
        this.addHelpTestsFromTree(tests, subcommand, fullPath);
      }
    }
  }

  private compareOutputs(expected: any, actual: any): boolean {
    try {
      return JSON.stringify(expected) === JSON.stringify(actual);
    } catch {
      return false;
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }
}

/**
 * Helper function to create normalized output
 */
export function createOutputNormalizer(options: {
  timestampFields?: string[];
  randomFields?: string[];
  pathFields?: string[];
}): (output: string) => string {
  return (output: string): string => {
    let normalized = output;
    
    // Normalize timestamps
    if (options.timestampFields) {
      for (const field of options.timestampFields) {
        const timestampRegex = new RegExp(`("${field}":\\s*")[^"]*(")`);
        normalized = normalized.replace(timestampRegex, '$1TIMESTAMP$2');
      }
    }
    
    // Normalize random/UUID fields
    if (options.randomFields) {
      for (const field of options.randomFields) {
        const uuidRegex = new RegExp(`("${field}":\\s*")[^"]*(")`);
        normalized = normalized.replace(uuidRegex, '$1UUID$2');
      }
    }
    
    // Normalize file paths
    if (options.pathFields) {
      for (const field of options.pathFields) {
        const pathRegex = new RegExp(`("${field}":\\s*")[^"]*(")`);
        normalized = normalized.replace(pathRegex, '$1PATH$2');
      }
    }
    
    return normalized;
  };
}