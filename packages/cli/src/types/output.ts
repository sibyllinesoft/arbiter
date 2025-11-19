export const API_VERSION = "arbiter.dev/v2" as const;

export interface StandardizedOutput {
  apiVersion: typeof API_VERSION;
  timestamp: number;
  command: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface PlanOutput extends StandardizedOutput {
  kind: "Plan";
  plan: Array<{
    id: string;
    type: "file" | "directory" | "command" | "validation";
    action: "create" | "update" | "delete" | "execute" | "validate";
    target: string;
    content?: string;
    dependencies?: string[];
    estimatedTime?: number;
  }>;
  guards: Array<{
    id: string;
    type: "constraint" | "validation" | "security" | "performance";
    description: string;
    required: boolean;
  }>;
  diff: {
    added: number;
    modified: number;
    deleted: number;
    summary: string;
  };
}

export interface ExecutionReport extends StandardizedOutput {
  kind: "ExecutionReport";
  applied: Array<{
    id: string;
    action: string;
    target: string;
    status: "success" | "failed" | "skipped";
    error?: string;
    duration?: number;
  }>;
  junit?: JUnitTestSuite;
  report: {
    totalActions: number;
    successful: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

export interface JUnitTestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  time: number;
  testcases: Array<{
    classname: string;
    name: string;
    time: number;
    failure?: {
      message: string;
      type: string;
      content: string;
    };
    error?: {
      message: string;
      type: string;
      content: string;
    };
  }>;
}

export interface SurfaceOutput extends StandardizedOutput {
  kind: "Surface";
  language: string;
  surface: {
    symbols: Array<{
      name: string;
      type: string;
      visibility: string;
      signature?: string;
      location: {
        file: string;
        line: number;
        column: number;
      };
    }>;
    statistics: {
      totalSymbols: number;
      publicSymbols: number;
      privateSymbols: number;
      byType: Record<string, number>;
    };
  };
  delta?: {
    added: number;
    modified: number;
    removed: number;
    breaking: boolean;
    requiredBump: "MAJOR" | "MINOR" | "PATCH";
  };
}

export interface TraceOutput extends StandardizedOutput {
  kind: "Trace";
  links: {
    requirements: Array<{
      id: string;
      title: string;
      linkedSpecs: string[];
      linkedTests: string[];
      linkedCode: string[];
      coverage: "complete" | "partial" | "missing";
    }>;
    specs: Array<{
      id: string;
      name: string;
      linkedRequirements: string[];
      linkedTests: string[];
      linkedCode: string[];
    }>;
    tests: Array<{
      id: string;
      name: string;
      file: string;
      linkedRequirements: string[];
      linkedSpecs: string[];
      linkedCode: string[];
    }>;
    code: Array<{
      id: string;
      path: string;
      anchor: string;
      linkedRequirements: string[];
      linkedSpecs: string[];
      linkedTests: string[];
    }>;
  };
  coverage: {
    requirements: {
      total: number;
      covered: number;
      percentage: number;
    };
    specs: {
      total: number;
      implemented: number;
      percentage: number;
    };
    contracts: {
      total: number;
      tested: number;
      percentage: number;
    };
  };
}

export interface NDJSONEvent {
  phase: string;
  timestamp: number;
  status: "start" | "progress" | "complete" | "error";
  data?: Record<string, unknown>;
  error?: string;
}

export type PhaseEvent =
  | {
      phase: "validate";
      status: "start" | "complete";
      data?: { files?: string[]; valid?: boolean; errors?: number };
    }
  | {
      phase: "validate";
      status: "error";
      error: string;
      data?: { files?: string[]; valid?: boolean; errors?: number };
    }
  | {
      phase: "surface";
      status: "start" | "complete";
      data?: {
        language?: string;
        symbols?: number;
        delta?: unknown;
        outputFile?: string;
        projectName?: string;
      };
    }
  | {
      phase: "surface";
      status: "error";
      error: string;
      data?: {
        language?: string;
        symbols?: number;
        delta?: unknown;
        outputFile?: string;
        projectName?: string;
      };
    }
  | {
      phase: "plan";
      status: "start" | "complete";
      data?: { actions?: number; guards?: number };
    }
  | {
      phase: "plan";
      status: "error";
      error: string;
      data?: { actions?: number; guards?: number };
    }
  | {
      phase: "execute";
      status: "start" | "progress" | "complete";
      data?: { action?: string; progress?: number; total?: number };
    }
  | {
      phase: "execute";
      status: "error";
      error: string;
      data?: { action?: string; progress?: number; total?: number };
    }
  | {
      phase: "test";
      status: "start" | "complete";
      data?: { tests?: number; passed?: number; failed?: number };
    }
  | {
      phase: "test";
      status: "error";
      error: string;
      data?: { tests?: number; passed?: number; failed?: number };
    }
  | {
      phase: "watch";
      status: "start" | "progress" | "complete";
      data?: {
        changed?: string[];
        validate?: unknown;
        surface?: unknown;
        gates?: unknown;
        eventCount?: number;
        debounceWindow?: number;
        processedFiles?: { cue?: number; code?: number; other?: number };
        reason?: string;
        path?: string;
        debounce?: number;
        message?: string;
        patterns?: string[];
      };
    }
  | {
      phase: "watch";
      status: "error";
      error: string;
      data?: {
        changed?: string[];
        validate?: unknown;
        surface?: unknown;
        gates?: unknown;
        eventCount?: number;
        debounceWindow?: number;
        processedFiles?: { cue?: number; code?: number; other?: number };
        reason?: string;
        path?: string;
        debounce?: number;
        message?: string;
        patterns?: string[];
      };
    };
