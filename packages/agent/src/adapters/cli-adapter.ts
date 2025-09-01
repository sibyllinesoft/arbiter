/**
 * CLI Profile Adapter
 * 
 * Implements command tree validation and golden I/O testing for CLI artifacts.
 * Validates command schemas, tests exit codes, and ensures CLI contract compliance.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import type { AssemblyV1, EpicV1 } from '../versioning.js';
import type { ProfileAdapter, ExecutionPlan, ExecutionStep, TestVerdict, TestResult } from './index.js';
import { 
  CLIContractHarness, 
  CLITestCase, 
  GoldenTestCase, 
  InteractiveTestCase,
  CommandTreeNode,
  createOutputNormalizer,
  type CLITestConfig 
} from '../testing/cli-harness.js';

interface CLICommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export class CLIAdapter implements ProfileAdapter {
  async plan(epic: EpicV1, assembly: AssemblyV1, repoPath: string): Promise<ExecutionPlan> {
    const profile = assembly.profiles?.cli;
    if (!profile) {
      throw new Error('CLI profile not configured in assembly');
    }
    
    const buildTool = assembly.artifact?.build.tool || 'make';
    const targets = assembly.artifact?.build.targets || ['./'];
    
    const steps: ExecutionStep[] = [
      // Step 1: Build the CLI
      {
        type: 'build',
        description: `Build CLI using ${buildTool}`,
        command: this.getBuildCommand(buildTool, targets),
        timeout: 300000, // 5 minutes
        artifacts: ['build/', 'bin/'],
        guards: ['build files exist', 'dependencies installed'],
      },
      
      // Step 2: Validate command tree structure
      {
        type: 'validate',
        description: 'Validate CLI command tree',
        timeout: 30000, // 30 seconds
        artifacts: ['command-tree.json'],
        guards: ['CLI binary exists'],
      },
      
      // Step 3: Run golden tests
      {
        type: 'test',
        description: 'Run CLI golden tests',
        timeout: 120000, // 2 minutes
        artifacts: ['golden-test-results.json'],
        guards: ['command tree valid'],
      },
      
      // Step 4: Auto-generate help tests
      {
        type: 'test',
        description: 'Generate and run help tests',
        timeout: 60000, // 1 minute
        artifacts: ['help-test-results.json'],
        guards: ['CLI binary available'],
      },
      
      // Step 5: Validate exit codes
      {
        type: 'validate',
        description: 'Validate exit code contracts',
        timeout: 30000, // 30 seconds
        artifacts: ['exit-code-validation.json'],
        guards: ['golden tests completed'],
      },
    ];
    
    return {
      steps,
      metadata: {
        profileKind: 'cli',
        estimatedDuration: steps.reduce((total, step) => total + (step.timeout || 30000), 0),
        constraints: [
          'Command tree must match specification',
          'All exit codes must be documented',
          'Help text must be consistent',
        ],
      },
    };
  }
  
  async test(repoPath: string, plan: ExecutionPlan): Promise<TestVerdict> {
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    try {
      // Find the CLI binary
      const cliBinary = await this.findCliBinary(repoPath);
      if (!cliBinary) {
        results.push({
          name: 'CLI Binary Detection',
          type: 'unit',
          status: 'fail',
          message: 'Could not find CLI binary to test',
        });
        
        return this.buildTestVerdict(results, Date.now() - startTime, {});
      }
      
      // Test 1: Basic CLI functionality
      const basicResult = await this.testBasicFunctionality(cliBinary);
      results.push(basicResult);
      
      // Test 2: Help text validation
      const helpResult = await this.testHelpText(cliBinary);
      results.push(helpResult);
      
      // Test 3: Command tree validation
      const commandTreeResult = await this.testCommandTree(cliBinary, repoPath);
      results.push(commandTreeResult);
      
      // Test 4: Golden tests
      const goldenResults = await this.runGoldenTests(cliBinary, repoPath);
      results.push(...goldenResults);
      
      // Test 5: Interactive tests (if configured)
      const interactiveResults = await this.runInteractiveTests(cliBinary, repoPath);
      results.push(...interactiveResults);
      
      // Test 6: Exit code validation
      const exitCodeResult = await this.testExitCodes(cliBinary);
      results.push(exitCodeResult);
      
    } catch (error) {
      results.push({
        name: 'CLI Adapter Test Suite',
        type: 'unit',
        status: 'fail',
        message: `Test suite failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    
    const duration = Date.now() - startTime;
    return this.buildTestVerdict(results, duration, {});
  }
  
  private getBuildCommand(buildTool: string, targets: string[]): string {
    switch (buildTool) {
      case 'bun':
        return `bun run build ${targets.join(' ')}`;
      case 'go':
        return `go build -o bin/ ${targets.join(' ')}`;
      case 'cargo':
        return `cargo build --release ${targets.join(' ')}`;
      case 'uv':
        return `uv build ${targets.join(' ')}`;
      default:
        return `${buildTool} ${targets.join(' ')}`;
    }
  }
  
  private async findCliBinary(repoPath: string): Promise<string | null> {
    // Common binary locations
    const possiblePaths = [
      path.join(repoPath, 'bin'),
      path.join(repoPath, 'target', 'release'),
      path.join(repoPath, 'target', 'debug'),
      path.join(repoPath, 'build'),
      path.join(repoPath, 'dist'),
    ];
    
    for (const binDir of possiblePaths) {
      try {
        const files = await fs.readdir(binDir);
        const executables = files.filter(file => 
          !file.includes('.') || file.endsWith('.exe')
        );
        
        if (executables.length > 0) {
          const binaryPath = path.join(binDir, executables[0]);
          
          // Check if it's executable
          try {
            await fs.access(binaryPath, fs.constants.X_OK);
            return binaryPath;
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
    
    return null;
  }
  
  private async testBasicFunctionality(cliBinary: string): Promise<TestResult> {
    try {
      const result = await this.runCliCommand(cliBinary, ['--version'], 5000);
      
      if (result.exitCode === 0) {
        return {
          name: 'Basic CLI Functionality',
          type: 'unit',
          status: 'pass',
          duration: result.duration,
          message: 'CLI responds to --version command',
        };
      } else {
        // Try without --version flag
        const helpResult = await this.runCliCommand(cliBinary, ['--help'], 5000);
        if (helpResult.exitCode === 0) {
          return {
            name: 'Basic CLI Functionality',
            type: 'unit',
            status: 'pass',
            duration: helpResult.duration,
            message: 'CLI responds to --help command',
          };
        }
        
        return {
          name: 'Basic CLI Functionality',
          type: 'unit',
          status: 'fail',
          duration: result.duration,
          message: `CLI failed both --version and --help (exit code: ${result.exitCode})`,
          actual: result.stderr,
        };
      }
    } catch (error) {
      return {
        name: 'Basic CLI Functionality',
        type: 'unit',
        status: 'fail',
        message: `Failed to test basic functionality: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async testHelpText(cliBinary: string): Promise<TestResult> {
    try {
      const result = await this.runCliCommand(cliBinary, ['--help'], 10000);
      
      if (result.exitCode !== 0) {
        return {
          name: 'Help Text Validation',
          type: 'golden',
          status: 'fail',
          duration: result.duration,
          message: `Help command failed with exit code: ${result.exitCode}`,
          actual: result.stderr,
        };
      }
      
      const helpText = result.stdout.toLowerCase();
      const hasUsage = helpText.includes('usage') || helpText.includes('help');
      
      if (!hasUsage) {
        return {
          name: 'Help Text Validation',
          type: 'golden',
          status: 'fail',
          duration: result.duration,
          message: 'Help text does not contain usage information',
          expected: 'Help text with usage information',
          actual: result.stdout.slice(0, 200) + '...',
        };
      }
      
      return {
        name: 'Help Text Validation',
        type: 'golden',
        status: 'pass',
        duration: result.duration,
        message: 'Help text validation passed',
      };
    } catch (error) {
      return {
        name: 'Help Text Validation',
        type: 'golden',
        status: 'fail',
        message: `Failed to validate help text: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async runGoldenTests(cliBinary: string, repoPath: string): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Initialize the CLI harness
      const harnessConfig: CLITestConfig = {
        binaryPath: cliBinary,
        workingDir: repoPath,
        timeout: 30000,
        goldenDir: path.join(repoPath, 'testdata', 'golden'),
      };
      
      const harness = new CLIContractHarness(harnessConfig);
      
      // Load golden tests from assembly if available
      let goldenTests: GoldenTestCase[] = [];
      
      try {
        const assemblyPath = path.join(repoPath, 'arbiter.assembly.json');
        const assemblyContent = await fs.readFile(assemblyPath, 'utf-8');
        const assembly = JSON.parse(assemblyContent);
        
        const configuredTests = assembly.spec?.profiles?.cli?.tests?.golden || [];
        
        goldenTests = configuredTests.map((test: any) => ({
          name: test.name || `Golden Test: ${test.cmd}`,
          command: test.cmd.split(' '),
          stdin: test.stdin,
          expectedExitCode: test.wantCode ?? 0,
          timeout: test.timeout,
          updateGolden: test.updateGolden || false,
          ignoreFields: test.ignoreFields || ['duration'],
          normalizeOutput: test.normalize ? createOutputNormalizer({
            timestampFields: test.normalize.timestamps || [],
            randomFields: test.normalize.randoms || [],
            pathFields: test.normalize.paths || [],
          }) : undefined,
          description: test.description,
        }));
      } catch {
        // No assembly file or no golden tests configured
      }
      
      // Auto-generate help tests if no tests are configured
      if (goldenTests.length === 0) {
        const helpTests = await harness.generateHelpTests();
        goldenTests = helpTests.map(test => ({
          ...test,
          updateGolden: false,
          ignoreFields: ['duration'],
        }));
      }
      
      if (goldenTests.length === 0) {
        results.push({
          name: 'Golden Tests',
          type: 'golden',
          status: 'skip',
          message: 'No golden tests configured and could not auto-generate',
        });
        return results;
      }
      
      // Run golden tests using the harness
      const harnessResults = await harness.runGoldenTests(goldenTests);
      
      // Convert harness results to TestResult format
      for (const harnessResult of harnessResults) {
        results.push({
          name: harnessResult.name,
          type: 'golden',
          status: harnessResult.passed ? 'pass' : 'fail',
          duration: harnessResult.duration,
          message: harnessResult.error || 'Golden test passed',
          expected: harnessResult.expectedVsActual?.expected,
          actual: harnessResult.expectedVsActual?.actual,
        });
      }
      
    } catch (error) {
      results.push({
        name: 'Golden Tests Execution',
        type: 'golden',
        status: 'fail',
        message: `Failed to execute golden tests: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    
    return results;
  }
  
  private async testCommandTree(cliBinary: string, repoPath: string): Promise<TestResult> {
    try {
      const harnessConfig: CLITestConfig = {
        binaryPath: cliBinary,
        workingDir: repoPath,
        timeout: 10000,
      };
      
      const harness = new CLIContractHarness(harnessConfig);
      
      // Try to extract command tree
      const commandTree = await harness.extractCommandTree();
      
      // Load expected command tree from assembly if available
      try {
        const assemblyPath = path.join(repoPath, 'arbiter.assembly.json');
        const assemblyContent = await fs.readFile(assemblyPath, 'utf-8');
        const assembly = JSON.parse(assemblyContent);
        
        const expectedTree = assembly.spec?.profiles?.cli?.commandTree;
        if (expectedTree) {
          const isValid = await harness.validateCommandTree(expectedTree);
          
          return {
            name: 'Command Tree Validation',
            type: 'contract',
            status: isValid ? 'pass' : 'fail',
            message: isValid ? 'Command tree matches specification' : 'Command tree does not match specification',
            expected: expectedTree,
            actual: commandTree,
          };
        }
      } catch {
        // No assembly file or no expected tree - just validate basic structure
      }
      
      // Basic validation - ensure we have some structure
      const hasCommands = (commandTree.subcommands && commandTree.subcommands.length > 0) ||
                         (commandTree.flags && commandTree.flags.length > 0);
      
      return {
        name: 'Command Tree Validation',
        type: 'contract',
        status: hasCommands ? 'pass' : 'skip',
        message: hasCommands ? 'Command tree extracted successfully' : 'No commands or flags found',
      };
    } catch (error) {
      return {
        name: 'Command Tree Validation',
        type: 'contract',
        status: 'fail',
        message: `Failed to validate command tree: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async runInteractiveTests(cliBinary: string, repoPath: string): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Load interactive tests from assembly if available
      const assemblyPath = path.join(repoPath, 'arbiter.assembly.json');
      const assemblyContent = await fs.readFile(assemblyPath, 'utf-8');
      const assembly = JSON.parse(assemblyContent);
      
      const configuredTests = assembly.spec?.profiles?.cli?.tests?.interactive || [];
      
      if (configuredTests.length === 0) {
        results.push({
          name: 'Interactive Tests',
          type: 'interactive',
          status: 'skip',
          message: 'No interactive tests configured',
        });
        return results;
      }
      
      const harnessConfig: CLITestConfig = {
        binaryPath: cliBinary,
        workingDir: repoPath,
        timeout: 60000, // Longer timeout for interactive tests
      };
      
      const harness = new CLIContractHarness(harnessConfig);
      
      const interactiveTests: InteractiveTestCase[] = configuredTests.map((test: any) => ({
        name: test.name,
        description: test.description,
        timeout: test.timeout,
        steps: test.steps.map((step: any) => ({
          send: step.send,
          expect: step.expect,
          delay: step.delay,
        })),
      }));
      
      const harnessResults = await harness.runInteractiveTests(interactiveTests);
      
      // Convert harness results to TestResult format
      for (const harnessResult of harnessResults) {
        results.push({
          name: harnessResult.name,
          type: 'interactive',
          status: harnessResult.passed ? 'pass' : 'fail',
          duration: harnessResult.duration,
          message: harnessResult.error || 'Interactive test passed',
        });
      }
      
    } catch (error) {
      // If assembly file doesn't exist or can't be parsed, skip interactive tests
      results.push({
        name: 'Interactive Tests',
        type: 'interactive',
        status: 'skip',
        message: 'No assembly file or interactive tests configuration found',
      });
    }
    
    return results;
  }
  
  private async testExitCodes(cliBinary: string): Promise<TestResult> {
    try {
      // Test some common exit code scenarios
      const scenarios = [
        { args: ['--help'], expectedCode: 0, description: 'help' },
        { args: ['--nonexistent-flag'], expectedCode: [1, 2], description: 'invalid flag' },
      ];
      
      let failures = 0;
      let total = 0;
      
      for (const scenario of scenarios) {
        total++;
        try {
          const result = await this.runCliCommand(cliBinary, scenario.args, 10000);
          const expectedCodes = Array.isArray(scenario.expectedCode) 
            ? scenario.expectedCode 
            : [scenario.expectedCode];
          
          if (!expectedCodes.includes(result.exitCode)) {
            failures++;
          }
        } catch {
          failures++;
        }
      }
      
      if (failures > 0) {
        return {
          name: 'Exit Code Validation',
          type: 'contract',
          status: 'fail',
          message: `${failures}/${total} exit code tests failed`,
        };
      }
      
      return {
        name: 'Exit Code Validation',
        type: 'contract',
        status: 'pass',
        message: `All ${total} exit code tests passed`,
      };
    } catch (error) {
      return {
        name: 'Exit Code Validation',
        type: 'contract',
        status: 'fail',
        message: `Failed to validate exit codes: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async runCliCommand(
    binary: string, 
    args: string[], 
    timeoutMs: number
  ): Promise<CLICommandResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      const child = spawn(binary, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
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
      
      // Timeout handling
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      child.on('close', () => clearTimeout(timeout));
    });
  }
  
  private buildTestVerdict(
    results: TestResult[], 
    duration: number, 
    artifacts: Record<string, any>
  ): TestVerdict {
    const passed = results.every(r => r.status === 'pass');
    const summary = {
      totalTests: results.length,
      passedTests: results.filter(r => r.status === 'pass').length,
      failedTests: results.filter(r => r.status === 'fail').length,
      skippedTests: results.filter(r => r.status === 'skip').length,
      duration,
    };
    
    return {
      passed,
      results,
      summary,
      artifacts,
    };
  }
}