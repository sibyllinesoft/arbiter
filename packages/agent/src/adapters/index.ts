/**
 * Profile Adapter System for Arbiter Agent
 * 
 * Implements the adapter pattern for different artifact profiles as described in the TODO:
 * - libraryAdapter: API surface extraction and semver gates
 * - cliAdapter: Command tree validation and golden testing
 * - jobAdapter: Resource constraint validation and I/O contract enforcement
 */

import type { AssemblyV1, EpicV1 } from '../versioning.js';

export interface ProfileAdapter {
  /** Generate execution plan for this profile */
  plan(epic: EpicV1, assembly: AssemblyV1, repoPath: string): Promise<ExecutionPlan>;
  
  /** Test/validate the result according to profile requirements */
  test(repoPath: string, plan: ExecutionPlan): Promise<TestVerdict>;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  metadata: {
    profileKind: 'library' | 'cli' | 'service' | 'job';
    estimatedDuration: number; // milliseconds
    constraints: string[];
  };
}

export interface ExecutionStep {
  type: 'build' | 'test' | 'extract' | 'validate' | 'patch';
  description: string;
  command?: string;
  timeout?: number; // milliseconds
  artifacts: string[]; // file paths produced/consumed
  guards: string[]; // pre-conditions
}

export interface TestVerdict {
  passed: boolean;
  results: TestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    duration: number; // milliseconds
  };
  artifacts: Record<string, any>; // e.g., surface.json, test reports
}

export interface TestResult {
  name: string;
  type: 'unit' | 'integration' | 'golden' | 'property' | 'surface' | 'contract';
  status: 'pass' | 'fail' | 'skip';
  duration?: number; // milliseconds
  message?: string;
  expected?: any;
  actual?: any;
  diff?: string;
}

/**
 * Registry of profile adapters
 */
export const profileAdapters = new Map<string, ProfileAdapter>();

/**
 * Register a profile adapter
 */
export function registerAdapter(kind: string, adapter: ProfileAdapter): void {
  profileAdapters.set(kind, adapter);
}

/**
 * Get adapter for a specific profile kind
 */
export function getAdapter(kind: string): ProfileAdapter | undefined {
  return profileAdapters.get(kind);
}

/**
 * Get adapter for assembly based on its artifact configuration
 */
export function getAdapterForAssembly(assembly: AssemblyV1): ProfileAdapter | undefined {
  const kind = assembly.artifact?.kind;
  if (!kind) return undefined;
  
  return profileAdapters.get(kind);
}

/**
 * Initialize all profile adapters
 */
export async function initializeAdapters(): Promise<void> {
  // Lazy import to avoid circular dependencies
  const { LibraryAdapter } = await import('./library-adapter.js');
  const { CLIAdapter } = await import('./cli-adapter.js');
  const { JobAdapter } = await import('./job-adapter.js');
  
  registerAdapter('library', new LibraryAdapter());
  registerAdapter('cli', new CLIAdapter());
  registerAdapter('job', new JobAdapter());
  
  // Service adapter is not needed - services use existing patterns
}

/**
 * Validate that an assembly has a compatible profile adapter
 */
export function validateAssemblyProfileSupport(assembly: AssemblyV1): {
  supported: boolean;
  kind?: string;
  reason?: string;
} {
  const kind = assembly.artifact?.kind;
  
  if (!kind) {
    return {
      supported: false,
      reason: 'No artifact.kind specified in assembly',
    };
  }
  
  if (kind === 'service') {
    return {
      supported: true,
      kind,
      reason: 'Service profiles use existing patterns',
    };
  }
  
  const adapter = profileAdapters.get(kind);
  if (!adapter) {
    return {
      supported: false,
      kind,
      reason: `No adapter registered for artifact kind: ${kind}`,
    };
  }
  
  return {
    supported: true,
    kind,
  };
}