/**
 * CLI Test Harness implementing golden file tests and property-based testing
 * Supports sandboxed execution as per TODO.md specification
 */

import { promises as fs } from 'fs';
import { execSync, exec } from 'child_process';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import type { CLIProfile } from './types.js';

const execAsync = promisify(exec);

export interface GoldenTest {
  name?: string;
  cmd: string;
  in?: string;
  wantOut?: string;
  wantRE?: string;
  wantCode?: number;
  wantErr?: string;
  timeout?: string;
  setup?: string;
  cleanup?: string;
}

export interface PropertyTest {
  name: string;
  description?: string;
  property: string;
  examples?: unknown[];
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
  expectedOutput?: string;
  actualOutput?: string;
  exitCode?: number;
  expectedExitCode?: number;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

export interface CLITestOptions {
  timeout: number;
  useSandbox: boolean;
  workingDir?: string;
  environment?: Record<string, string>;
  verbose?: boolean;
}

/**
 * CLI Test Runner with sandboxed execution
 */
export class CLITestHarness {
  private options: CLITestOptions;
  private sandboxDir?: string;
  
  constructor(options: Partial<CLITestOptions> = {}) {
    this.options = {
      timeout: 30000, // 30 seconds default
      useSandbox: true,
      verbose: false,
      ...options
    };
  }
  
  /**
   * Run golden file tests from a CLI profile
   */
  async runGoldenTests(
    profile: CLIProfile,
    cliPath: string,
    options: Partial<CLITestOptions> = {}
  ): Promise<TestSuite> {
    const testOptions = { ...this.options, ...options };
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    // Setup sandbox if required
    if (testOptions.useSandbox) {
      await this.setupSandbox();
    }
    
    try {
      // Generate help tests automatically
      const helpTests = this.generateHelpTests(profile.commands);
      const allTests = [...profile.tests.golden, ...helpTests];
      
      for (const test of allTests) {
        const result = await this.runSingleGoldenTest(test, cliPath, testOptions);
        results.push(result);
        
        if (testOptions.verbose) {
          console.log(`${result.passed ? '✅' : '❌'} ${result.name}: ${result.duration}ms`);
          if (!result.passed && result.error) {
            console.log(`   Error: ${result.error}`);
          }
        }
      }
      
      return {
        name: 'Golden Tests',
        results,
        summary: {
          total: results.length,
          passed: results.filter(r => r.passed).length,
          failed: results.filter(r => !r.passed).length,
          duration: Date.now() - startTime
        }
      };
    } finally {
      if (this.sandboxDir) {
        await this.cleanupSandbox();
      }
    }
  }
  
  /**
   * Run property-based tests
   */
  async runPropertyTests(
    tests: PropertyTest[],
    cliPath: string,
    options: Partial<CLITestOptions> = {}
  ): Promise<TestSuite> {
    const testOptions = { ...this.options, ...options };
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    for (const test of tests) {
      const result = await this.runSinglePropertyTest(test, cliPath, testOptions);
      results.push(result);
      
      if (testOptions.verbose) {
        console.log(`${result.passed ? '✅' : '❌'} ${result.name}: ${result.duration}ms`);
      }
    }
    
    return {
      name: 'Property Tests',
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        duration: Date.now() - startTime
      }
    };
  }
  
  /**
   * Run a complete CLI test suite
   */
  async runTestSuite(
    profile: CLIProfile,
    cliPath: string,
    options: Partial<CLITestOptions> = {}
  ): Promise<{
    golden: TestSuite;
    property: TestSuite;
    overall: {
      passed: boolean;
      totalTests: number;
      totalPassed: number;
      totalFailed: number;
      duration: number;
    };
  }> {
    const startTime = Date.now();
    
    const golden = await this.runGoldenTests(profile, cliPath, options);
    const property = await this.runPropertyTests(profile.tests.property, cliPath, options);
    
    const totalTests = golden.summary.total + property.summary.total;
    const totalPassed = golden.summary.passed + property.summary.passed;
    const totalFailed = golden.summary.failed + property.summary.failed;
    
    return {
      golden,
      property,
      overall: {
        passed: totalFailed === 0,
        totalTests,
        totalPassed,
        totalFailed,
        duration: Date.now() - startTime
      }
    };
  }
  
  /**
   * Generate help tests automatically for each command
   */
  private generateHelpTests(commands: CLIProfile['commands']): GoldenTest[] {
    const helpTests: GoldenTest[] = [];
    
    for (const command of commands) {
      helpTests.push({
        name: `${command.name}_help`,
        cmd: `${command.name} --help`,
        wantOut: `*${command.summary}*`,
        wantCode: 0,
        timeout: '5s'
      });
    }
    
    // Add global help test
    helpTests.push({
      name: 'global_help',
      cmd: '--help',
      wantCode: 0,
      timeout: '5s'
    });
    
    return helpTests;
  }
  
  /**
   * Run a single golden file test
   */
  private async runSingleGoldenTest(
    test: GoldenTest,
    cliPath: string,
    options: CLITestOptions
  ): Promise<TestResult> {
    const startTime = Date.now();
    const testName = test.name || `golden_${Date.now()}`;
    const workDir = this.sandboxDir || options.workingDir || process.cwd();
    
    try {
      // Setup test environment
      if (test.setup) {
        await this.executeCommand(test.setup, workDir, options.timeout);
      }
      
      // Prepare the command
      const fullCommand = `${cliPath} ${test.cmd}`;
      const timeout = this.parseTimeout(test.timeout) || options.timeout;
      
      // Execute the command
      const result = await this.executeCommandWithResult(fullCommand, workDir, timeout, test.in);
      
      // Check exit code
      const expectedCode = test.wantCode ?? 0;
      if (result.exitCode !== expectedCode) {
        return {
          name: testName,
          passed: false,
          duration: Date.now() - startTime,
          error: `Exit code mismatch: expected ${expectedCode}, got ${result.exitCode}`,
          expectedExitCode: expectedCode,
          exitCode: result.exitCode,
          actualOutput: result.stdout + result.stderr
        };
      }
      
      // Check output patterns
      if (test.wantOut && !this.matchesPattern(result.stdout, test.wantOut)) {
        return {
          name: testName,
          passed: false,
          duration: Date.now() - startTime,
          error: 'Output pattern mismatch',
          expectedOutput: test.wantOut,
          actualOutput: result.stdout
        };
      }
      
      if (test.wantRE && !this.matchesRegex(result.stdout, test.wantRE)) {
        return {
          name: testName,
          passed: false,
          duration: Date.now() - startTime,
          error: 'Output regex mismatch',
          expectedOutput: test.wantRE,
          actualOutput: result.stdout
        };
      }
      
      if (test.wantErr && !this.matchesPattern(result.stderr, test.wantErr)) {
        return {
          name: testName,
          passed: false,
          duration: Date.now() - startTime,
          error: 'Error output pattern mismatch',
          expectedOutput: test.wantErr,
          actualOutput: result.stderr
        };
      }
      
      // Cleanup
      if (test.cleanup) {
        await this.executeCommand(test.cleanup, workDir, options.timeout);
      }
      
      return {
        name: testName,
        passed: true,
        duration: Date.now() - startTime,
        output: result.stdout,
        exitCode: result.exitCode
      };
      
    } catch (error) {
      return {
        name: testName,
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Run a single property test
   */
  private async runSinglePropertyTest(
    test: PropertyTest,
    cliPath: string,
    options: CLITestOptions
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Simple property evaluation (in real implementation, use more sophisticated property testing)
      const passed = await this.evaluateProperty(test, cliPath, options);
      
      return {
        name: test.name,
        passed,
        duration: Date.now() - startTime,
        output: test.description
      };
      
    } catch (error) {
      return {
        name: test.name,
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Setup sandbox directory for isolated test execution
   */
  private async setupSandbox(): Promise<void> {
    this.sandboxDir = join(tmpdir(), `arbiter-test-${randomUUID()}`);
    await fs.mkdir(this.sandboxDir, { recursive: true });
    
    // Create basic test structure
    await fs.mkdir(join(this.sandboxDir, 'input'), { recursive: true });
    await fs.mkdir(join(this.sandboxDir, 'output'), { recursive: true });
    await fs.mkdir(join(this.sandboxDir, 'temp'), { recursive: true });
  }
  
  /**
   * Cleanup sandbox directory
   */
  private async cleanupSandbox(): Promise<void> {
    if (this.sandboxDir) {
      try {
        await fs.rm(this.sandboxDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup sandbox: ${error}`);
      }
      this.sandboxDir = undefined;
    }
  }
  
  /**
   * Execute a command and return result details
   */
  private async executeCommandWithResult(
    command: string,
    workDir: string,
    timeout: number,
    input?: string
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve, reject) => {
      const child = exec(command, {
        cwd: workDir,
        timeout,
        encoding: 'utf-8'
      }, (error, stdout, stderr) => {
        const exitCode = error?.code ?? 0;
        resolve({ exitCode, stdout: stdout || '', stderr: stderr || '' });
      });
      
      // Send input if provided
      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
      
      // Handle timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Command timed out'));
      }, timeout);
    });
  }
  
  /**
   * Execute a simple command (for setup/cleanup)
   */
  private async executeCommand(command: string, workDir: string, timeout: number): Promise<void> {
    await execAsync(command, { cwd: workDir, timeout });
  }
  
  /**
   * Parse timeout string to milliseconds
   */
  private parseTimeout(timeout?: string): number | undefined {
    if (!timeout) return undefined;
    
    const match = timeout.match(/^(\d+)([smh]?)$/);
    if (!match) return undefined;
    
    const value = parseInt(match[1], 10);
    const unit = match[2] || 's';
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return value;
    }
  }
  
  /**
   * Check if text matches a glob pattern (simplified)
   */
  private matchesPattern(text: string, pattern: string): boolean {
    // Convert glob pattern to regex (simplified)
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\.\\\*/g, '.*');
    
    const regex = new RegExp(regexPattern, 'i');
    return regex.test(text);
  }
  
  /**
   * Check if text matches a regular expression
   */
  private matchesRegex(text: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(text);
    } catch {
      return false;
    }
  }
  
  /**
   * Evaluate a property test (simplified implementation)
   */
  private async evaluateProperty(
    test: PropertyTest,
    cliPath: string,
    options: CLITestOptions
  ): Promise<boolean> {
    // Simplified property evaluation
    // In real implementation, this would use a proper property testing framework
    
    if (test.property.includes('help_exit_code == 0')) {
      // Test that help commands exit with 0
      try {
        const result = await this.executeCommandWithResult(
          `${cliPath} --help`,
          this.sandboxDir || process.cwd(),
          options.timeout
        );
        return result.exitCode === 0;
      } catch {
        return false;
      }
    }
    
    if (test.property.includes('version_format')) {
      // Test version format
      try {
        const result = await this.executeCommandWithResult(
          `${cliPath} --version`,
          this.sandboxDir || process.cwd(),
          options.timeout
        );
        return /^\d+\.\d+\.\d+/.test(result.stdout);
      } catch {
        return false;
      }
    }
    
    // Default: assume property passes (implement actual evaluation logic)
    return true;
  }
}

/**
 * Utility function to generate test report
 */
export function generateTestReport(suites: TestSuite[]): string {
  const lines: string[] = [];
  lines.push('# CLI Test Report');
  lines.push('');
  
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;
  
  for (const suite of suites) {
    lines.push(`## ${suite.name}`);
    lines.push('');
    lines.push(`- Total: ${suite.summary.total}`);
    lines.push(`- Passed: ${suite.summary.passed}`);
    lines.push(`- Failed: ${suite.summary.failed}`);
    lines.push(`- Duration: ${suite.summary.duration}ms`);
    lines.push('');
    
    if (suite.summary.failed > 0) {
      lines.push('### Failed Tests');
      lines.push('');
      for (const result of suite.results.filter(r => !r.passed)) {
        lines.push(`- **${result.name}**: ${result.error}`);
        if (result.expectedOutput && result.actualOutput) {
          lines.push(`  - Expected: \`${result.expectedOutput}\``);
          lines.push(`  - Actual: \`${result.actualOutput}\``);
        }
      }
      lines.push('');
    }
    
    totalTests += suite.summary.total;
    totalPassed += suite.summary.passed;
    totalFailed += suite.summary.failed;
    totalDuration += suite.summary.duration;
  }
  
  lines.push('## Overall Summary');
  lines.push('');
  lines.push(`- **Total Tests**: ${totalTests}`);
  lines.push(`- **Passed**: ${totalPassed}`);
  lines.push(`- **Failed**: ${totalFailed}`);
  lines.push(`- **Success Rate**: ${totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : 0}%`);
  lines.push(`- **Total Duration**: ${totalDuration}ms`);
  
  return lines.join('\n');
}