import { z } from 'zod';

export const VulnerabilitySchema = z.object({
  id: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  cve: z.string().optional(),
  cwe: z.string().optional(),
  category: z.string(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional(),
  references: z.array(z.string()).optional(),
});

export const SecurityScanResultSchema = z.object({
  scanner: z.string(),
  version: z.string().optional(),
  timestamp: z.string().datetime(),
  scan_duration_ms: z.number(),
  vulnerabilities: z.array(VulnerabilitySchema),
  summary: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
    total: z.number(),
  }),
  metadata: z.record(z.unknown()).optional(),
});

export const SecuritySuiteSchema = z.object({
  version: z.string(),
  environment: z.object({
    os: z.string(),
    arch: z.string(),
    node_version: z.string(),
    bun_version: z.string(),
  }),
  scans: z.array(SecurityScanResultSchema),
  summary: z.object({
    total_vulnerabilities: z.number(),
    critical_vulnerabilities: z.number(),
    high_vulnerabilities: z.number(),
    passed_gates: z.number(),
    failed_gates: z.number(),
    scan_duration_ms: z.number(),
  }),
  generated_at: z.string().datetime(),
});

export const SecurityGateSchema = z.object({
  name: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  max_count: z.number().nonnegative(),
  scanner: z.string().optional(),
  category: z.string().optional(),
  blocking: z.boolean().default(true),
});

export const SecurityGateResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  actual_count: z.number(),
  max_allowed: z.number(),
  severity: z.string(),
  blocking: z.boolean(),
  details: z.array(z.object({
    id: z.string(),
    title: z.string(),
    file: z.string().optional(),
  })).optional(),
});

export type Vulnerability = z.infer<typeof VulnerabilitySchema>;
export type SecurityScanResult = z.infer<typeof SecurityScanResultSchema>;
export type SecuritySuite = z.infer<typeof SecuritySuiteSchema>;
export type SecurityGate = z.infer<typeof SecurityGateSchema>;
export type SecurityGateResult = z.infer<typeof SecurityGateResultSchema>;

export interface ScannerConfig {
  enabled: boolean;
  timeout_ms?: number;
  additional_args?: string[];
  output_format?: string;
}

export interface SecurityConfig {
  scanners: {
    sast: ScannerConfig;
    dependency: ScannerConfig;
    container: ScannerConfig;
    secrets: ScannerConfig;
    api_security: ScannerConfig;
  };
  gates: SecurityGate[];
  report_formats: ('json' | 'html' | 'sarif' | 'junit')[];
  fail_on_error: boolean;
}