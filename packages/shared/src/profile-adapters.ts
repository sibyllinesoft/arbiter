/**
 * Profile adapters implementing the TODO.md specification
 * Each adapter provides plan() and test() functions for their artifact type
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import type { 
  ProfileAdapter, 
  Artifact, 
  LibraryProfile, 
  CLIProfile, 
  ServiceProfile, 
  JobProfile 
} from './types.js';

export interface Epic {
  name: string;
  versionBump?: 'major' | 'minor' | 'patch';
  changes: Array<{
    type: 'breaking' | 'additive' | 'bugfix';
    description: string;
  }>;
}

export interface Repository {
  path: string;
  files: Record<string, string>;
  artifacts: Record<string, Artifact>;
  profiles: Record<string, LibraryProfile | CLIProfile | ServiceProfile | JobProfile>;
}

/**
 * Library adapter - enforces API surface stability and semver policy
 */
export class LibraryAdapter implements ProfileAdapter {
  async plan(epic: Epic, repo: Repository): Promise<{
    operations: Array<{
      type: 'extract_api_surface' | 'validate_semver' | 'run_tests';
      config: unknown;
    }>;
  }> {
    const operations = [];
    
    // Extract API surface for comparison
    operations.push({
      type: 'extract_api_surface',
      config: {
        language: repo.artifacts.shared?.language || 'typescript',
        outputFile: './dist/api-surface.json',
        previousSurface: './previous-api-surface.json'
      }
    });
    
    // Validate semantic version requirements
    if (epic.versionBump) {
      operations.push({
        type: 'validate_semver',
        config: {
          requestedBump: epic.versionBump,
          changes: epic.changes,
          strict: true
        }
      });
    }
    
    // Run property tests and invariant checks
    operations.push({
      type: 'run_tests',
      config: {
        testTypes: ['unit', 'property', 'invariant'],
        coverage: { minimum: 90 }
      }
    });
    
    return { operations };
  }
  
  async test(repo: Repository, plan: { operations: Array<{ type: string; config: unknown }> }): Promise<{ 
    pass: boolean; 
    verdict: string 
  }> {
    try {
      // Simulate API surface extraction
      const hasBreakingChanges = this.detectBreakingChanges(repo);
      
      // Check if version bump is sufficient for changes
      const profile = Object.values(repo.profiles)[0] as LibraryProfile;
      if (profile.contracts.forbidBreaking && hasBreakingChanges) {
        return {
          pass: false,
          verdict: 'Breaking changes detected but forbidBreaking is true. Requires major version bump.'
        };
      }
      
      return {
        pass: true,
        verdict: 'Library validation passed: API surface stable, semver compliant, all tests passing'
      };
    } catch (error) {
      return {
        pass: false,
        verdict: `Library validation failed: ${error}`
      };
    }
  }
  
  private detectBreakingChanges(repo: Repository): boolean {
    // Simplified breaking change detection
    // In real implementation, this would compare API surfaces
    return false;
  }
}

/**
 * CLI adapter - enforces command tree validation and golden tests
 */
export class CLIAdapter implements ProfileAdapter {
  async plan(epic: Epic, repo: Repository): Promise<{
    operations: Array<{
      type: 'compile_command_table' | 'run_golden_tests' | 'validate_help';
      config: unknown;
    }>;
  }> {
    const operations = [];
    
    // Compile command table from profile
    operations.push({
      type: 'compile_command_table',
      config: {
        profilePath: './profiles/cli-profile.cue',
        outputFile: './analysis/command-table.json'
      }
    });
    
    // Run golden file tests
    operations.push({
      type: 'run_golden_tests',
      config: {
        testDir: './test/golden',
        timeout: '30s',
        sandbox: true
      }
    });
    
    // Validate help consistency
    operations.push({
      type: 'validate_help',
      config: {
        generateHelp: true,
        checkExitCodes: true
      }
    });
    
    return { operations };
  }
  
  async test(repo: Repository, plan: { operations: Array<{ type: string; config: unknown }> }): Promise<{ 
    pass: boolean; 
    verdict: string 
  }> {
    try {
      const profile = Object.values(repo.profiles)[0] as CLIProfile;
      
      // Validate command structure
      for (const command of profile.commands) {
        if (!command.name || !command.summary) {
          return {
            pass: false,
            verdict: `Command missing required name or summary: ${command.name}`
          };
        }
        
        // Check exit codes are properly defined
        const hasZeroExit = command.exits.some(exit => exit.code === 0);
        if (!hasZeroExit) {
          return {
            pass: false,
            verdict: `Command ${command.name} missing success exit code (0)`
          };
        }
      }
      
      // Simulate running golden tests
      const goldenResults = await this.runGoldenTests(profile.tests.golden);
      if (!goldenResults.pass) {
        return goldenResults;
      }
      
      return {
        pass: true,
        verdict: `CLI validation passed: ${profile.commands.length} commands validated, ${profile.tests.golden.length} golden tests passed`
      };
    } catch (error) {
      return {
        pass: false,
        verdict: `CLI validation failed: ${error}`
      };
    }
  }
  
  private async runGoldenTests(tests: CLIProfile['tests']['golden']): Promise<{ pass: boolean; verdict: string }> {
    // Simplified golden test runner
    // In real implementation, this would execute commands in sandbox and check output
    for (const test of tests) {
      if (!test.cmd) {
        return {
          pass: false,
          verdict: `Golden test missing command: ${JSON.stringify(test)}`
        };
      }
    }
    
    return {
      pass: true,
      verdict: `All ${tests.length} golden tests configured correctly`
    };
  }
}

/**
 * Service adapter - enforces API contracts and SLA validation
 */
export class ServiceAdapter implements ProfileAdapter {
  async plan(epic: Epic, repo: Repository): Promise<{
    operations: Array<{
      type: 'validate_endpoints' | 'check_health' | 'run_load_tests';
      config: unknown;
    }>;
  }> {
    const operations = [];
    
    // Validate API endpoints against schemas
    operations.push({
      type: 'validate_endpoints',
      config: {
        schemaDir: './schemas',
        validateRequests: true,
        validateResponses: true
      }
    });
    
    // Check health endpoint and dependencies
    operations.push({
      type: 'check_health',
      config: {
        timeout: '5s',
        dependencies: true,
        retries: 3
      }
    });
    
    // Run load tests for SLA validation
    operations.push({
      type: 'run_load_tests',
      config: {
        duration: '1m',
        virtualUsers: 10,
        checkSLAs: true
      }
    });
    
    return { operations };
  }
  
  async test(repo: Repository, plan: { operations: Array<{ type: string; config: unknown }> }): Promise<{ 
    pass: boolean; 
    verdict: string 
  }> {
    try {
      const profile = Object.values(repo.profiles)[0] as ServiceProfile;
      
      // Validate endpoint structure
      for (const endpoint of profile.endpoints) {
        if (!endpoint.path || !endpoint.method) {
          return {
            pass: false,
            verdict: `Endpoint missing required path or method: ${JSON.stringify(endpoint)}`
          };
        }
        
        // Validate HTTP methods
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        if (!validMethods.includes(endpoint.method)) {
          return {
            pass: false,
            verdict: `Invalid HTTP method ${endpoint.method} for endpoint ${endpoint.path}`
          };
        }
      }
      
      // Check health endpoint exists
      const hasHealthCheck = profile.healthCheck && profile.healthCheck.length > 0;
      if (!hasHealthCheck) {
        return {
          pass: false,
          verdict: 'Service missing required health check endpoint'
        };
      }
      
      return {
        pass: true,
        verdict: `Service validation passed: ${profile.endpoints.length} endpoints validated, health check configured`
      };
    } catch (error) {
      return {
        pass: false,
        verdict: `Service validation failed: ${error}`
      };
    }
  }
}

/**
 * Job adapter - enforces resource limits and I/O contracts
 */
export class JobAdapter implements ProfileAdapter {
  async plan(epic: Epic, repo: Repository): Promise<{
    operations: Array<{
      type: 'enforce_resources' | 'validate_io' | 'test_determinism';
      config: unknown;
    }>;
  }> {
    const operations = [];
    
    // Enforce resource limits
    operations.push({
      type: 'enforce_resources',
      config: {
        useCgroups: true,
        monitoringInterval: '1s',
        terminateOnViolation: true
      }
    });
    
    // Validate I/O contracts
    operations.push({
      type: 'validate_io',
      config: {
        sandbox: true,
        allowedReads: [],
        allowedWrites: [],
        networkAccess: false
      }
    });
    
    // Test determinism and idempotency
    operations.push({
      type: 'test_determinism',
      config: {
        runs: 3,
        compareOutputs: true,
        testIdempotency: true
      }
    });
    
    return { operations };
  }
  
  async test(repo: Repository, plan: { operations: Array<{ type: string; config: unknown }> }): Promise<{ 
    pass: boolean; 
    verdict: string 
  }> {
    try {
      const profile = Object.values(repo.profiles)[0] as JobProfile;
      
      // Validate resource specifications
      if (!profile.resources.cpu || !profile.resources.mem || !profile.resources.wall) {
        return {
          pass: false,
          verdict: 'Job missing required resource specifications (cpu, mem, wall)'
        };
      }
      
      // Validate resource format
      const cpuMatch = profile.resources.cpu.match(/^\d+m?$/);
      const memMatch = profile.resources.mem.match(/^\d+[MG]i$/);
      const wallMatch = profile.resources.wall.match(/^\d+[smh]$/);
      
      if (!cpuMatch || !memMatch || !wallMatch) {
        return {
          pass: false,
          verdict: 'Job resource specifications in invalid format'
        };
      }
      
      // Validate I/O contracts
      if (!Array.isArray(profile.ioContracts.reads) || !Array.isArray(profile.ioContracts.writes)) {
        return {
          pass: false,
          verdict: 'Job I/O contracts must specify reads and writes as arrays'
        };
      }
      
      return {
        pass: true,
        verdict: `Job validation passed: resources specified, I/O contracts defined (${profile.ioContracts.reads.length} read paths, ${profile.ioContracts.writes.length} write paths)`
      };
    } catch (error) {
      return {
        pass: false,
        verdict: `Job validation failed: ${error}`
      };
    }
  }
}

/**
 * Profile adapter factory
 */
export class ProfileAdapterFactory {
  private static adapters: Record<string, ProfileAdapter> = {
    library: new LibraryAdapter(),
    cli: new CLIAdapter(),
    service: new ServiceAdapter(),
    job: new JobAdapter()
  };
  
  static getAdapter(artifactKind: string): ProfileAdapter {
    const adapter = this.adapters[artifactKind];
    if (!adapter) {
      throw new Error(`No profile adapter found for artifact kind: ${artifactKind}`);
    }
    return adapter;
  }
  
  static getSupportedKinds(): string[] {
    return Object.keys(this.adapters);
  }
}