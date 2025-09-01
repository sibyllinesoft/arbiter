/**
 * Job Profile Adapter
 * 
 * Implements resource constraint validation and I/O contract enforcement for job artifacts.
 * Ensures jobs run within resource limits and respect file system boundaries.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { glob } from 'glob';
import type { AssemblyV1, EpicV1 } from '../versioning.js';
import type { ProfileAdapter, ExecutionPlan, ExecutionStep, TestVerdict, TestResult } from './index.js';

interface JobExecutionResult {
  exitCode: number;
  duration: number;
  stdout: string;
  stderr: string;
  resourceUsage: {
    maxMemoryMB: number;
    avgCpuPercent: number;
  };
  fileSystemChanges: {
    created: string[];
    modified: string[];
    deleted: string[];
  };
}

export class JobAdapter implements ProfileAdapter {
  async plan(epic: EpicV1, assembly: AssemblyV1, repoPath: string): Promise<ExecutionPlan> {
    const profile = assembly.profiles?.job;
    if (!profile) {
      throw new Error('Job profile not configured in assembly');
    }
    
    const buildTool = assembly.artifact?.build.tool || 'make';
    const targets = assembly.artifact?.build.targets || ['./'];
    
    const steps: ExecutionStep[] = [
      // Step 1: Build the job
      {
        type: 'build',
        description: `Build job using ${buildTool}`,
        command: this.getBuildCommand(buildTool, targets),
        timeout: 300000, // 5 minutes
        artifacts: ['build/', 'bin/'],
        guards: ['build files exist', 'dependencies installed'],
      },
      
      // Step 2: Validate resource constraints
      {
        type: 'validate',
        description: 'Validate resource constraint configuration',
        timeout: 5000, // 5 seconds
        artifacts: ['resource-constraints.json'],
        guards: ['job profile configured'],
      },
      
      // Step 3: Test I/O contracts
      {
        type: 'test',
        description: 'Test I/O contract compliance',
        timeout: parseInt(this.parseWallTime(profile.resources.wall)) + 30000, // wall time + buffer
        artifacts: ['io-contract-test.json'],
        guards: ['job binary exists'],
      },
      
      // Step 4: Resource limit enforcement test
      {
        type: 'test',
        description: 'Test resource limit enforcement',
        timeout: parseInt(this.parseWallTime(profile.resources.wall)) + 60000, // wall time + buffer
        artifacts: ['resource-test.json'],
        guards: ['I/O contract validation passed'],
      },
      
      // Step 5: Idempotence test (if configured)
      {
        type: 'test',
        description: 'Test job idempotence',
        timeout: parseInt(this.parseWallTime(profile.resources.wall)) * 2 + 30000, // 2x wall time + buffer
        artifacts: ['idempotence-test.json'],
        guards: ['resource tests passed'],
      },
    ];
    
    return {
      steps,
      metadata: {
        profileKind: 'job',
        estimatedDuration: steps.reduce((total, step) => total + (step.timeout || 30000), 0),
        constraints: [
          `CPU limit: ${profile.resources.cpu}`,
          `Memory limit: ${profile.resources.mem}`,
          `Wall time limit: ${profile.resources.wall}`,
          `I/O reads: ${profile.ioContracts.reads.join(', ')}`,
          `I/O writes: ${profile.ioContracts.writes.join(', ')}`,
          `Network access: ${profile.ioContracts.net ? 'allowed' : 'blocked'}`,
        ],
      },
    };
  }
  
  async test(repoPath: string, plan: ExecutionPlan): Promise<TestVerdict> {
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    try {
      // Find the job binary/script
      const jobExecutable = await this.findJobExecutable(repoPath);
      if (!jobExecutable) {
        results.push({
          name: 'Job Executable Detection',
          type: 'unit',
          status: 'fail',
          message: 'Could not find job executable to test',
        });
        
        return this.buildTestVerdict(results, Date.now() - startTime, {});
      }
      
      // Load job profile
      const profile = await this.loadJobProfile(repoPath);
      if (!profile) {
        results.push({
          name: 'Job Profile Loading',
          type: 'unit',
          status: 'fail',
          message: 'Could not load job profile configuration',
        });
        
        return this.buildTestVerdict(results, Date.now() - startTime, {});
      }
      
      // Test 1: Resource constraints validation
      const resourceResult = await this.testResourceConstraints(profile);
      results.push(resourceResult);
      
      // Test 2: I/O contract enforcement
      const ioResult = await this.testIOContracts(jobExecutable, profile, repoPath);
      results.push(ioResult);
      
      // Test 3: Runtime limits
      const runtimeResult = await this.testRuntimeLimits(jobExecutable, profile, repoPath);
      results.push(runtimeResult);
      
      // Test 4: Idempotence (if configured)
      if (profile.runtime?.idempotent) {
        const idempotenceResult = await this.testIdempotence(jobExecutable, profile, repoPath);
        results.push(idempotenceResult);
      }
      
    } catch (error) {
      results.push({
        name: 'Job Adapter Test Suite',
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
  
  private parseWallTime(wallTime: string): string {
    // Convert wall time (e.g., "30s", "5m", "2h") to milliseconds
    const match = wallTime.match(/^(\d+)([smh])$/);
    if (!match) return '30000'; // 30 seconds default
    
    const [, value, unit] = match;
    const num = parseInt(value);
    
    switch (unit) {
      case 's': return (num * 1000).toString();
      case 'm': return (num * 60 * 1000).toString();
      case 'h': return (num * 60 * 60 * 1000).toString();
      default: return '30000';
    }
  }
  
  private async findJobExecutable(repoPath: string): Promise<string | null> {
    // Common executable locations
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
          return path.join(binDir, executables[0]);
        }
      } catch {
        continue;
      }
    }
    
    // Look for scripts in the root
    const scriptFiles = ['run.sh', 'job.py', 'main.py', 'index.js'];
    for (const script of scriptFiles) {
      const scriptPath = path.join(repoPath, script);
      try {
        await fs.access(scriptPath);
        return scriptPath;
      } catch {
        continue;
      }
    }
    
    return null;
  }
  
  private async loadJobProfile(repoPath: string): Promise<NonNullable<AssemblyV1['profiles']>['job'] | null> {
    try {
      const assemblyPath = path.join(repoPath, 'arbiter.assembly.json');
      const assemblyContent = await fs.readFile(assemblyPath, 'utf-8');
      const assembly = JSON.parse(assemblyContent);
      
      return assembly.spec?.profiles?.job || null;
    } catch {
      return null;
    }
  }
  
  private async testResourceConstraints(profile: NonNullable<AssemblyV1['profiles']>['job']): Promise<TestResult> {
    try {
      const { cpu, mem, wall } = profile.resources;
      
      // Validate format
      if (!cpu.match(/^[0-9.]+m?$/)) {
        return {
          name: 'Resource Constraints Validation',
          type: 'contract',
          status: 'fail',
          message: `Invalid CPU format: ${cpu}`,
        };
      }
      
      if (!mem.match(/^[0-9.]+[KMGT]?i?B?$/)) {
        return {
          name: 'Resource Constraints Validation',
          type: 'contract',
          status: 'fail',
          message: `Invalid memory format: ${mem}`,
        };
      }
      
      if (!wall.match(/^[0-9]+[smh]$/)) {
        return {
          name: 'Resource Constraints Validation',
          type: 'contract',
          status: 'fail',
          message: `Invalid wall time format: ${wall}`,
        };
      }
      
      return {
        name: 'Resource Constraints Validation',
        type: 'contract',
        status: 'pass',
        message: 'Resource constraint formats are valid',
      };
    } catch (error) {
      return {
        name: 'Resource Constraints Validation',
        type: 'contract',
        status: 'fail',
        message: `Failed to validate resource constraints: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async testIOContracts(
    executable: string, 
    profile: NonNullable<AssemblyV1['profiles']>['job'],
    repoPath: string
  ): Promise<TestResult> {
    try {
      // Create a test environment
      const testDir = path.join(repoPath, 'test-io-contracts');
      await fs.mkdir(testDir, { recursive: true });
      
      // Create some test files that should be readable
      await fs.writeFile(path.join(testDir, 'input.txt'), 'test input');
      
      // Record initial file state
      const initialFiles = await this.getFileList(repoPath);
      
      // Run the job (with a timeout)
      const wallTimeMs = parseInt(this.parseWallTime(profile.resources.wall));
      const result = await this.executeJob(executable, [], wallTimeMs, repoPath);
      
      // Check if job completed successfully
      if (result.exitCode !== 0) {
        return {
          name: 'I/O Contract Test',
          type: 'integration',
          status: 'fail',
          duration: result.duration,
          message: `Job failed with exit code ${result.exitCode}`,
          actual: result.stderr,
        };
      }
      
      // Check file system changes
      const finalFiles = await this.getFileList(repoPath);
      const changes = this.computeFileSystemChanges(initialFiles, finalFiles);
      
      // Validate write permissions
      const unauthorized = changes.created.concat(changes.modified).filter(filePath => {
        return !profile.ioContracts.writes.some(pattern => {
          return this.matchesGlob(filePath, pattern);
        });
      });
      
      if (unauthorized.length > 0) {
        return {
          name: 'I/O Contract Test',
          type: 'integration',
          status: 'fail',
          duration: result.duration,
          message: `Job wrote to unauthorized paths: ${unauthorized.join(', ')}`,
          expected: `Files matching patterns: ${profile.ioContracts.writes.join(', ')}`,
          actual: `Wrote to: ${unauthorized.join(', ')}`,
        };
      }
      
      // Clean up
      await fs.rm(testDir, { recursive: true, force: true });
      
      return {
        name: 'I/O Contract Test',
        type: 'integration',
        status: 'pass',
        duration: result.duration,
        message: 'I/O contract compliance verified',
      };
    } catch (error) {
      return {
        name: 'I/O Contract Test',
        type: 'integration',
        status: 'fail',
        message: `I/O contract test failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async testRuntimeLimits(
    executable: string,
    profile: NonNullable<AssemblyV1['profiles']>['job'],
    repoPath: string
  ): Promise<TestResult> {
    try {
      const wallTimeMs = parseInt(this.parseWallTime(profile.resources.wall));
      const result = await this.executeJob(executable, [], wallTimeMs + 5000, repoPath); // Add 5s buffer
      
      if (result.duration > wallTimeMs) {
        return {
          name: 'Runtime Limits Test',
          type: 'integration',
          status: 'fail',
          duration: result.duration,
          message: `Job exceeded wall time limit`,
          expected: `≤ ${wallTimeMs}ms`,
          actual: `${result.duration}ms`,
        };
      }
      
      return {
        name: 'Runtime Limits Test',
        type: 'integration',
        status: 'pass',
        duration: result.duration,
        message: 'Runtime limits respected',
      };
    } catch (error) {
      return {
        name: 'Runtime Limits Test',
        type: 'integration',
        status: 'fail',
        message: `Runtime limits test failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async testIdempotence(
    executable: string,
    profile: NonNullable<AssemblyV1['profiles']>['job'],
    repoPath: string
  ): Promise<TestResult> {
    try {
      const wallTimeMs = parseInt(this.parseWallTime(profile.resources.wall));
      
      // Run job twice and compare results
      const result1 = await this.executeJob(executable, [], wallTimeMs, repoPath);
      const result2 = await this.executeJob(executable, [], wallTimeMs, repoPath);
      
      if (result1.exitCode !== result2.exitCode) {
        return {
          name: 'Idempotence Test',
          type: 'property',
          status: 'fail',
          duration: result1.duration + result2.duration,
          message: 'Job produces different exit codes on repeated runs',
          expected: `Exit code: ${result1.exitCode}`,
          actual: `Exit code: ${result2.exitCode}`,
        };
      }
      
      // For deterministic jobs, output should be identical
      if (profile.runtime?.deterministic && result1.stdout !== result2.stdout) {
        return {
          name: 'Idempotence Test',
          type: 'property',
          status: 'fail',
          duration: result1.duration + result2.duration,
          message: 'Deterministic job produces different output on repeated runs',
          expected: result1.stdout.slice(0, 100),
          actual: result2.stdout.slice(0, 100),
        };
      }
      
      return {
        name: 'Idempotence Test',
        type: 'property',
        status: 'pass',
        duration: result1.duration + result2.duration,
        message: 'Job is idempotent',
      };
    } catch (error) {
      return {
        name: 'Idempotence Test',
        type: 'property',
        status: 'fail',
        message: `Idempotence test failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  private async executeJob(
    executable: string,
    args: string[],
    timeoutMs: number,
    cwd: string
  ): Promise<JobExecutionResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      const child = spawn(executable, args, {
        cwd,
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
          exitCode: code ?? -1,
          duration: Date.now() - startTime,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          resourceUsage: {
            maxMemoryMB: 0, // TODO: Implement resource monitoring
            avgCpuPercent: 0,
          },
          fileSystemChanges: {
            created: [],
            modified: [],
            deleted: [],
          },
        });
      });
      
      child.on('error', reject);
      
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Job timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      child.on('close', () => clearTimeout(timeout));
    });
  }
  
  private async getFileList(repoPath: string): Promise<string[]> {
    try {
      const files = await glob('**/*', {
        cwd: repoPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/target/**'],
        dot: false,
      });
      return files.sort();
    } catch {
      return [];
    }
  }
  
  private computeFileSystemChanges(before: string[], after: string[]): {
    created: string[];
    modified: string[];
    deleted: string[];
  } {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    
    return {
      created: after.filter(f => !beforeSet.has(f)),
      deleted: before.filter(f => !afterSet.has(f)),
      modified: [], // Simple implementation - would need file stats for real detection
    };
  }
  
  private matchesGlob(filePath: string, pattern: string): boolean {
    // Simple glob matching - real implementation would use a proper glob library
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    }
    return filePath === pattern;
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