/**
 * Versioned Envelope System for Arbiter Agent
 * 
 * Implements the versioning and migration system described in the Agent Operating Prompt.
 * All resources (Assembly, Epic) must be enveloped with apiVersion/kind/spec structure.
 */

export interface EnvelopedResource<T = any> {
  apiVersion: string;
  kind: 'Assembly' | 'Epic';
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    createdAt?: string;
    updatedAt?: string;
  };
  spec: T;
}

export interface AssemblyV1 {
  // Core artifact definition
  artifact?: {
    kind: 'library' | 'cli' | 'service' | 'job';
    language: 'go' | 'ts' | 'rust' | 'python' | string;
    build: {
      tool: 'go' | 'bun' | 'cargo' | 'uv' | string;
      targets: string[];
      matrix?: {
        versions?: string[];
        os?: string[];
        arch?: string[];
      };
    };
    packaging?: {
      publish: boolean;
      registry?: string;
      artifact?: 'tar' | 'wheel' | 'crate' | 'npm' | string;
    };
  };

  // Profile-specific configurations
  profiles?: {
    library?: {
      semver: 'strict' | 'minor' | 'none';
      apiSurface: {
        source: 'generated' | 'declared';
        file?: string;
      };
      contracts: {
        forbidBreaking: boolean;
        invariants: string[];
      };
    };
    cli?: {
      commands: Array<{
        name: string;
        summary: string;
        args: Array<{
          name: string;
          type: 'str' | 'int' | 'file' | 'enum' | string;
          required: boolean;
        }>;
        flags: Array<{
          name: string;
          type: string;
          default?: any;
          repeatable?: boolean;
        }>;
        exits: Array<{
          code: number;
          meaning: string;
        }>;
        io: {
          in?: 'none' | 'stdin' | 'file' | 'json' | string;
          out?: 'stdout' | 'file' | 'json' | string;
          schema?: string;
        };
      }>;
      tests: {
        golden: Array<{
          cmd: string;
          in?: string;
          wantOut?: string;
          wantRE?: string;
          wantCode?: number;
        }>;
        property: Array<{
          name: string;
          cue: string;
        }>;
      };
    };
    job?: {
      resources: {
        cpu: string;
        mem: string;
        wall: string;
      };
      ioContracts: {
        reads: string[];
        writes: string[];
        net: boolean;
      };
    };
  };

  projects: Array<{
    name: string;
    path: string;
    include?: string[];
    exclude?: string[];
    schema?: string;
    entrypoint?: string;
  }>;
  epics?: Array<{
    id: string;
    path: string;
    enabled?: boolean;
  }>;
  pipelines?: Array<{
    name: string;
    stages: string[];
    triggers?: string[];
  }>;
  settings?: {
    defaultTimeout?: number;
    maxConcurrency?: number;
    rateLimits?: {
      requestsPerSecond?: number;
      payloadSizeKB?: number;
    };
  };
}

export interface EpicV1 {
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
}

/**
 * Legacy v0 types for migration
 */
export interface LegacyAssembly {
  Projects?: any[];
  Epics?: any[];
  Pipelines?: any[];
}

export interface LegacyEpic {
  id?: string;
  title?: string;
  targets?: any[];
  generate?: any[];
}

/**
 * Version constants
 */
export const CURRENT_API_VERSION = 'arbiter.dev/v1';
export const SUPPORTED_VERSIONS = ['arbiter.dev/v0', 'arbiter.dev/v1'];

/**
 * Detect if content is an enveloped resource or legacy v0
 */
export function detectEnvelope(content: string): {
  isEnveloped: boolean;
  apiVersion?: string;
  kind?: string;
  spec?: any;
  legacy?: any;
} {
  try {
    const parsed = JSON.parse(content);
    
    // Check for envelope structure
    if (parsed.apiVersion && parsed.kind && parsed.spec) {
      return {
        isEnveloped: true,
        apiVersion: parsed.apiVersion,
        kind: parsed.kind,
        spec: parsed.spec,
      };
    }
    
    // Check for legacy Assembly shape
    if (parsed.Projects || parsed.Epics || parsed.Pipelines) {
      return {
        isEnveloped: false,
        apiVersion: 'arbiter.dev/v0',
        kind: 'Assembly',
        legacy: parsed,
      };
    }
    
    // Check for legacy Epic shape
    if (parsed.id && parsed.title && (parsed.targets || parsed.generate)) {
      return {
        isEnveloped: false,
        apiVersion: 'arbiter.dev/v0',
        kind: 'Epic',
        legacy: parsed,
      };
    }
    
    throw new Error('Unknown resource format');
  } catch (error) {
    // Try CUE format detection (simplified)
    if (content.includes('Projects:') || content.includes('Epics:')) {
      return {
        isEnveloped: false,
        apiVersion: 'arbiter.dev/v0',
        kind: 'Assembly',
        legacy: { _cueContent: content },
      };
    }
    
    if (content.includes('id:') && content.includes('title:') && content.includes('generate:')) {
      return {
        isEnveloped: false,
        apiVersion: 'arbiter.dev/v0',
        kind: 'Epic',
        legacy: { _cueContent: content },
      };
    }
    
    throw new Error(`Cannot detect resource format: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Migrate legacy v0 to current version
 */
export function migrateToLatest<T>(
  kind: 'Assembly' | 'Epic',
  apiVersion: string,
  legacyData: any
): EnvelopedResource<T> {
  const now = new Date().toISOString();
  
  if (apiVersion === CURRENT_API_VERSION) {
    // Already current version
    return {
      apiVersion: CURRENT_API_VERSION,
      kind,
      metadata: {
        updatedAt: now,
      },
      spec: legacyData,
    };
  }
  
  if (apiVersion === 'arbiter.dev/v0') {
    // Migrate from v0 to v1
    if (kind === 'Assembly') {
      const spec: AssemblyV1 = migrateAssemblyV0ToV1(legacyData);
      return {
        apiVersion: CURRENT_API_VERSION,
        kind: 'Assembly',
        metadata: {
          createdAt: now,
          updatedAt: now,
          annotations: {
            'arbiter.dev/migrated-from': 'v0',
          },
        },
        spec,
      } as EnvelopedResource<T>;
    }
    
    if (kind === 'Epic') {
      const spec: EpicV1 = migrateEpicV0ToV1(legacyData);
      return {
        apiVersion: CURRENT_API_VERSION,
        kind: 'Epic',
        metadata: {
          createdAt: now,
          updatedAt: now,
          annotations: {
            'arbiter.dev/migrated-from': 'v0',
          },
        },
        spec,
      } as EnvelopedResource<T>;
    }
  }
  
  throw new Error(`Unsupported migration: ${kind} from ${apiVersion} to ${CURRENT_API_VERSION}`);
}

/**
 * Migrate Assembly from v0 to v1
 */
function migrateAssemblyV0ToV1(legacy: LegacyAssembly): AssemblyV1 {
  const projects = (legacy.Projects || []).map((p: any) => ({
    name: p.name || p.Name || 'unnamed-project',
    path: p.path || p.Path || '.',
    include: p.include || p.Include || ['**/*.cue'],
    exclude: p.exclude || p.Exclude || ['**/node_modules/**'],
    schema: p.schema || p.Schema,
    entrypoint: p.entrypoint || p.Entrypoint,
  }));
  
  const epics = (legacy.Epics || []).map((e: any) => ({
    id: e.id || e.Id || 'unknown-epic',
    path: e.path || e.Path || `epics/${e.id || 'unknown'}.cue`,
    enabled: e.enabled !== false, // default to enabled
  }));
  
  const pipelines = (legacy.Pipelines || []).map((p: any) => ({
    name: p.name || p.Name || 'unnamed-pipeline',
    stages: p.stages || p.Stages || ['build', 'test', 'deploy'],
    triggers: p.triggers || p.Triggers || ['push'],
  }));
  
  return {
    projects,
    epics: epics.length > 0 ? epics : undefined,
    pipelines: pipelines.length > 0 ? pipelines : undefined,
    settings: {
      defaultTimeout: 750, // ms
      maxConcurrency: 4,
      rateLimits: {
        requestsPerSecond: 1,
        payloadSizeKB: 64,
      },
    },
  };
}

/**
 * Migrate Epic from v0 to v1
 */
function migrateEpicV0ToV1(legacy: LegacyEpic): EpicV1 {
  return {
    id: legacy.id || 'EPIC-MIGRATED-001',
    title: legacy.title || 'Migrated Epic',
    owners: (legacy as any).owners || ['system'],
    targets: (legacy.targets || []).map((t: any) => ({
      root: t.root || t.Root || '.',
      include: t.include || t.Include || ['**/*'],
      exclude: t.exclude || t.Exclude || ['**/node_modules/**'],
    })),
    generate: (legacy.generate || []).map((g: any) => ({
      path: g.path || g.Path || 'generated.txt',
      mode: (g.mode || g.Mode || 'create') as 'create' | 'patch',
      template: g.template || g.Template || '',
      data: g.data || g.Data || {},
      guards: g.guards || g.Guards || [],
    })),
    contracts: {
      types: (legacy as any).contracts?.types || [],
      invariants: (legacy as any).contracts?.invariants || [],
    },
    tests: {
      static: (legacy as any).tests?.static || [],
      property: (legacy as any).tests?.property || [],
      golden: (legacy as any).tests?.golden || [],
      cli: (legacy as any).tests?.cli || [],
    },
    rollout: {
      steps: (legacy as any).rollout?.steps || ['Execute epic'],
      gates: (legacy as any).rollout?.gates || [],
    },
    heuristics: {
      preferSmallPRs: (legacy as any).heuristics?.preferSmallPRs ?? true,
      maxFilesPerPR: (legacy as any).heuristics?.maxFilesPerPR ?? 10,
    },
  };
}

/**
 * Generate migration patch plan
 */
export interface MigrationPatch {
  from: string;
  to: string;
  changes: Array<{
    type: 'add' | 'remove' | 'modify' | 'wrap';
    path: string;
    oldValue?: any;
    newValue?: any;
    description: string;
  }>;
}

export function generateMigrationPatch(
  kind: 'Assembly' | 'Epic',
  fromVersion: string,
  toVersion: string,
  originalData: any,
  migratedData: any
): MigrationPatch {
  const changes: MigrationPatch['changes'] = [];
  
  if (fromVersion === 'arbiter.dev/v0' && toVersion === 'arbiter.dev/v1') {
    // Envelope wrapping
    changes.push({
      type: 'wrap',
      path: '/',
      newValue: {
        apiVersion: toVersion,
        kind,
        metadata: migratedData.metadata,
        spec: '...',
      },
      description: 'Wrap content in versioned envelope structure',
    });
    
    // Specific migrations based on kind
    if (kind === 'Assembly') {
      if (originalData.Projects) {
        changes.push({
          type: 'modify',
          path: '/Projects',
          oldValue: 'Projects',
          newValue: 'spec.projects',
          description: 'Move Projects to spec.projects with normalized field names',
        });
      }
      
      changes.push({
        type: 'add',
        path: '/spec/settings',
        newValue: {
          defaultTimeout: 750,
          maxConcurrency: 4,
          rateLimits: {
            requestsPerSecond: 1,
            payloadSizeKB: 64,
          },
        },
        description: 'Add rate limiting and timeout settings',
      });
    }
    
    if (kind === 'Epic') {
      changes.push({
        type: 'add',
        path: '/spec/heuristics',
        newValue: {
          preferSmallPRs: true,
          maxFilesPerPR: 10,
        },
        description: 'Add default heuristics for PR management',
      });
    }
  }
  
  return {
    from: fromVersion,
    to: toVersion,
    changes,
  };
}

/**
 * Validate enveloped resource
 */
export function validateEnvelopedResource<T>(
  resource: EnvelopedResource<T>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate apiVersion
  if (!SUPPORTED_VERSIONS.includes(resource.apiVersion)) {
    errors.push(`Unsupported apiVersion: ${resource.apiVersion}. Supported: ${SUPPORTED_VERSIONS.join(', ')}`);
  }
  
  // Validate kind
  if (!['Assembly', 'Epic'].includes(resource.kind)) {
    errors.push(`Invalid kind: ${resource.kind}. Must be Assembly or Epic`);
  }
  
  // Validate spec exists
  if (!resource.spec) {
    errors.push('Missing required field: spec');
  }
  
  // Kind-specific validation
  if (resource.kind === 'Epic' && resource.spec) {
    const epic = resource.spec as EpicV1;
    
    if (!epic.id || !epic.id.match(/^EPIC-[A-Z0-9-]+$/)) {
      errors.push('Epic id must match pattern: ^EPIC-[A-Z0-9-]+$');
    }
    
    if (!epic.title) {
      errors.push('Epic title is required');
    }
    
    if (!epic.owners || epic.owners.length === 0) {
      errors.push('Epic must have at least one owner');
    }
    
    if (!epic.targets || epic.targets.length === 0) {
      errors.push('Epic must have at least one target');
    }
  }
  
  if (resource.kind === 'Assembly' && resource.spec) {
    const assembly = resource.spec as AssemblyV1;
    
    if (!assembly.projects || assembly.projects.length === 0) {
      errors.push('Assembly must have at least one project');
    }
    
    // Validate project names are unique
    const projectNames = assembly.projects.map(p => p.name);
    const uniqueNames = new Set(projectNames);
    if (projectNames.length !== uniqueNames.size) {
      errors.push('Project names must be unique within assembly');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Serialize enveloped resource to string
 */
export function serializeResource<T>(
  resource: EnvelopedResource<T>,
  format: 'json' | 'yaml' = 'json'
): string {
  if (format === 'json') {
    return JSON.stringify(resource, null, 2);
  }
  
  // TODO: Implement YAML serialization
  throw new Error('YAML serialization not yet implemented');
}

/**
 * Load and migrate resource from file content
 */
export function loadAndMigrateResource<T>(
  content: string,
  expectedKind?: 'Assembly' | 'Epic'
): {
  resource: EnvelopedResource<T>;
  migrated: boolean;
  migrationPatch?: MigrationPatch;
} {
  const detected = detectEnvelope(content);
  
  if (expectedKind && detected.kind !== expectedKind) {
    throw new Error(`Expected ${expectedKind} but detected ${detected.kind}`);
  }
  
  if (detected.isEnveloped && detected.apiVersion === CURRENT_API_VERSION) {
    // Already current version
    return {
      resource: {
        apiVersion: detected.apiVersion!,
        kind: detected.kind as 'Assembly' | 'Epic',
        spec: detected.spec,
      } as EnvelopedResource<T>,
      migrated: false,
    };
  }
  
  // Need migration
  const kind = detected.kind as 'Assembly' | 'Epic';
  const apiVersion = detected.apiVersion!;
  const sourceData = detected.legacy || detected.spec;
  
  const migrated = migrateToLatest<T>(kind, apiVersion, sourceData);
  const migrationPatch = generateMigrationPatch(kind, apiVersion, CURRENT_API_VERSION, sourceData, migrated);
  
  return {
    resource: migrated,
    migrated: true,
    migrationPatch,
  };
}