// Common types used across the application

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Revision {
  projectId: string;
  rev: number;
  text: string;
  createdAt: Date;
}

export interface CueError {
  message: string;
  line?: number;
  column?: number;
  filename?: string;
  severity?: 'error' | 'warning' | 'info';
  violationId?: string;
  friendlyMessage?: string;
  suggestedFix?: string;
}

export interface AnalysisResult {
  requestId: string;
  errors: CueError[];
  value?: unknown;
  graph?: GraphNode[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'object' | 'array' | 'value';
  children?: string[];
  violations?: {
    severity: 'error' | 'warning' | 'info';
    violationIds: string[];
    count: number;
  };
}

export interface User {
  id: string;
  name: string;
  color: string;
}

export interface CursorPosition {
  line: number;
  column: number;
  selectionStart?: { line: number; column: number };
  selectionEnd?: { line: number; column: number };
}

// Artifact profile types (from TODO.md implementation)
export type ArtifactKind = 'library' | 'cli' | 'service' | 'job';
export type ArtifactLanguage = 'go' | 'ts' | 'rust' | 'python' | 'typescript';
export type BuildTool = 'go' | 'bun' | 'cargo' | 'uv' | 'npm' | 'make';
export type ArtifactType = 'tar' | 'wheel' | 'crate' | 'npm' | 'binary' | 'docker';

export interface Artifact {
  kind: ArtifactKind;
  language: ArtifactLanguage;
  build: {
    tool: BuildTool;
    targets: string[];
    matrix: {
      versions: string[];
      os: string[];
      arch: string[];
    };
  };
  packaging: {
    publish: boolean;
    registry?: string;
    artifact?: ArtifactType;
  };
}

export interface LibraryProfile {
  semver: 'strict' | 'minor' | 'none';
  apiSurface: {
    source: 'generated' | 'declared';
    file?: string;
  };
  contracts: {
    forbidBreaking: boolean;
    invariants: string[];
  };
}

export interface CLICommand {
  name: string;
  summary: string;
  args: Array<{
    name: string;
    type: 'str' | 'int' | 'file' | 'enum' | 'bool';
    required: boolean;
  }>;
  flags: Array<{
    name: string;
    type: 'str' | 'int' | 'bool' | 'file' | 'enum';
    default?: unknown;
    repeatable?: boolean;
  }>;
  exits: Array<{
    code: number;
    meaning: string;
  }>;
  io: {
    in?: 'none' | 'stdin' | 'file' | 'json';
    out?: 'stdout' | 'file' | 'json';
    schema?: string;
  };
}

export interface CLIProfile {
  commands: CLICommand[];
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
}

export interface ServiceProfile {
  endpoints: Array<{
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    summary: string;
    requestSchema?: string;
    responseSchema?: string;
  }>;
  healthCheck: string;
  dependencies: string[];
}

export interface JobProfile {
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
}

export type ArtifactProfile = LibraryProfile | CLIProfile | ServiceProfile | JobProfile;

export interface ProjectAssembly {
  artifacts: Record<string, Artifact>;
  profiles: Record<string, ArtifactProfile>;
}

// Profile adapter interface for the TODO.md implementation
export interface ProfileAdapter {
  plan(epic: unknown, repo: unknown): Promise<unknown>;
  test(repo: unknown, plan: unknown): Promise<{ pass: boolean; verdict: string }>;
}