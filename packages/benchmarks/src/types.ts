import { z } from 'zod';

export const BenchmarkResultSchema = z.object({
  name: z.string(),
  type: z.enum(['api', 'websocket', 'cue', 'memory', 'bundle']),
  timestamp: z.string().datetime(),
  duration: z.number().positive(),
  metrics: z.record(z.union([z.number(), z.string()])),
  metadata: z.record(z.unknown()).optional(),
});

export const BenchmarkSuiteSchema = z.object({
  version: z.string(),
  environment: z.object({
    node_version: z.string(),
    bun_version: z.string(),
    os: z.string(),
    arch: z.string(),
    memory: z.number(),
    cpu_count: z.number(),
  }),
  baseline: BenchmarkResultSchema.optional(),
  results: z.array(BenchmarkResultSchema),
  summary: z.object({
    total_duration: z.number(),
    passed_gates: z.number(),
    failed_gates: z.number(),
    performance_regression: z.boolean(),
    security_issues: z.number(),
  }),
});

export const PerformanceGateSchema = z.object({
  name: z.string(),
  metric: z.string(),
  operator: z.enum(['lt', 'lte', 'gt', 'gte', 'eq']),
  threshold: z.number(),
  baseline_comparison: z.boolean().default(false),
  regression_threshold: z.number().default(0.2), // 20% regression threshold
});

export const SecurityScanResultSchema = z.object({
  scanner: z.string(),
  timestamp: z.string().datetime(),
  vulnerabilities: z.array(z.object({
    id: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    title: z.string(),
    description: z.string(),
    file: z.string().optional(),
    line: z.number().optional(),
    cve: z.string().optional(),
  })),
  summary: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
});

export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;
export type BenchmarkSuite = z.infer<typeof BenchmarkSuiteSchema>;
export type PerformanceGate = z.infer<typeof PerformanceGateSchema>;
export type SecurityScanResult = z.infer<typeof SecurityScanResultSchema>;

export interface BenchmarkConfig {
  api: {
    baseUrl: string;
    concurrency: number;
    duration: number;
    endpoints: string[];
  };
  websocket: {
    url: string;
    connections: number;
    messagesPerConnection: number;
    messageSize: number;
  };
  cue: {
    sampleFiles: string[];
    iterations: number;
    timeout: number;
  };
  memory: {
    iterations: number;
    gcForce: boolean;
  };
}