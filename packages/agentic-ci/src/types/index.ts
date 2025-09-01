import { z } from 'zod';

// ============================================================================
// Core Types for Agentic CI System
// ============================================================================

/**
 * Pipeline execution context and metadata
 */
export const PipelineContextSchema = z.object({
  pipelineId: z.string(),
  runId: z.number(),
  runAttempt: z.number(),
  repository: z.string(),
  owner: z.string(),
  ref: z.string(),
  sha: z.string(),
  branch: z.string(),
  eventName: z.string(),
  actor: z.string(),
  triggeredAt: z.date(),
  environment: z.enum(['development', 'staging', 'production']),
  isPullRequest: z.boolean(),
  pullRequestNumber: z.number().optional(),
  baseSha: z.string().optional(),
});

export type PipelineContext = z.infer<typeof PipelineContextSchema>;

/**
 * Quality gate definitions and results
 */
export const QualityGateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['performance', 'security', 'testing', 'compliance', 'chaos']),
  criticality: z.enum(['blocker', 'major', 'minor', 'info']),
  threshold: z.record(z.unknown()),
  status: z.enum(['pending', 'running', 'passed', 'failed', 'skipped', 'error']),
  result: z.object({
    passed: z.boolean(),
    score: z.number().min(0).max(100),
    metrics: z.record(z.unknown()),
    details: z.string().optional(),
    evidence: z.array(z.string()).optional(),
    executionTime: z.number(),
    timestamp: z.date(),
  }).optional(),
});

export type QualityGate = z.infer<typeof QualityGateSchema>;

/**
 * Failure analysis and classification
 */
export const FailureAnalysisSchema = z.object({
  failureId: z.string(),
  category: z.enum([
    'flaky_test',
    'infrastructure',
    'dependency',
    'code_quality',
    'performance_regression',
    'security_vulnerability',
    'configuration',
    'external_service',
    'unknown'
  ]),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  confidence: z.number().min(0).max(100),
  rootCause: z.string(),
  suggestedFix: z.string(),
  automatedFixAvailable: z.boolean(),
  historicalOccurrences: z.number(),
  lastOccurrence: z.date().optional(),
  impact: z.object({
    userFacing: z.boolean(),
    performanceImpact: z.number().min(0).max(100),
    securityRisk: z.boolean(),
    deploymentBlocking: z.boolean(),
  }),
  evidence: z.array(z.object({
    type: z.enum(['log', 'metric', 'screenshot', 'trace']),
    content: z.string(),
    timestamp: z.date(),
  })),
});

export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;

/**
 * Auto-merge risk assessment
 */
export const RiskAssessmentSchema = z.object({
  riskScore: z.number().min(0).max(100),
  factors: z.object({
    changeSize: z.object({
      linesChanged: z.number(),
      filesChanged: z.number(),
      score: z.number().min(0).max(100),
    }),
    testCoverage: z.object({
      current: z.number().min(0).max(100),
      delta: z.number(),
      score: z.number().min(0).max(100),
    }),
    historicalStability: z.object({
      successRate: z.number().min(0).max(100),
      avgFixTime: z.number(),
      score: z.number().min(0).max(100),
    }),
    authorExperience: z.object({
      commitsInRepo: z.number(),
      recentFailureRate: z.number().min(0).max(100),
      score: z.number().min(0).max(100),
    }),
    timeOfDay: z.object({
      isBusinessHours: z.boolean(),
      isWeekend: z.boolean(),
      score: z.number().min(0).max(100),
    }),
    featureFlags: z.object({
      canRollback: z.boolean(),
      hasGradualRollout: z.boolean(),
      score: z.number().min(0).max(100),
    }),
  }),
  recommendation: z.enum(['auto_merge', 'human_review', 'block']),
  reasoning: z.string(),
  requiredApprovals: z.number().min(0),
  rolloutStrategy: z.enum(['immediate', 'gradual', 'canary', 'manual']).optional(),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

/**
 * Agent decision context
 */
export const AgentDecisionSchema = z.object({
  agentId: z.string(),
  agentVersion: z.string(),
  decision: z.enum(['proceed', 'retry', 'escalate', 'abort']),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  context: z.record(z.unknown()),
  recommendedActions: z.array(z.string()),
  escalationRequired: z.boolean(),
  humanInterventionNeeded: z.boolean(),
  timestamp: z.date(),
  executionTime: z.number(),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

/**
 * CI pipeline status and state
 */
export const PipelineStatusSchema = z.object({
  context: PipelineContextSchema,
  status: z.enum(['pending', 'running', 'success', 'failure', 'cancelled', 'skipped']),
  qualityGates: z.array(QualityGateSchema),
  overallScore: z.number().min(0).max(100),
  failures: z.array(FailureAnalysisSchema),
  riskAssessment: RiskAssessmentSchema.optional(),
  agentDecisions: z.array(AgentDecisionSchema),
  autoMergeEligible: z.boolean(),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().optional(),
  retryCount: z.number().default(0),
  lastUpdated: z.date(),
});

export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;

/**
 * Configuration schemas
 */
export const AgentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string().default('gpt-4'),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().positive().default(2000),
  retryAttempts: z.number().min(0).default(3),
  timeoutMs: z.number().positive().default(30000),
});

export const AutoMergeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  requireAllGatesPass: z.boolean().default(true),
  maxRiskScore: z.number().min(0).max(100).default(30),
  requiredApprovals: z.number().min(0).default(0),
  businessHoursOnly: z.boolean().default(true),
  emergencyOverride: z.boolean().default(false),
  rolloutStrategies: z.array(z.enum(['immediate', 'gradual', 'canary'])).default(['gradual']),
  monitoringPeriod: z.number().positive().default(300000), // 5 minutes
});

export const AgenticCIConfigSchema = z.object({
  repository: z.string(),
  github: z.object({
    token: z.string(),
    webhook: z.object({
      secret: z.string(),
      port: z.number().default(8080),
    }),
  }),
  ai: z.object({
    provider: z.enum(['openai', 'anthropic']).default('openai'),
    apiKey: z.string(),
    model: z.string().default('gpt-4'),
  }),
  agents: z.object({
    failureAnalyzer: AgentConfigSchema,
    riskAssessor: AgentConfigSchema,
    remediationAgent: AgentConfigSchema,
    decisionMaker: AgentConfigSchema,
  }),
  autoMerge: AutoMergeConfigSchema,
  qualityGates: z.object({
    performanceThresholds: z.record(z.number()),
    securityRequirements: z.array(z.string()),
    testCoverageMinimum: z.number().min(0).max(100).default(90),
    chaosTestingRequired: z.boolean().default(true),
  }),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsRetention: z.number().positive().default(2592000000), // 30 days
    alerting: z.object({
      slack: z.object({
        webhook: z.string().optional(),
        channels: z.array(z.string()).default([]),
      }),
      email: z.object({
        enabled: z.boolean().default(false),
        recipients: z.array(z.string()).default([]),
      }),
    }),
  }),
  emergencySettings: z.object({
    stopOnCriticalFailure: z.boolean().default(true),
    rollbackOnPerformanceRegression: z.boolean().default(true),
    humanEscalationThreshold: z.number().min(0).max(100).default(80),
    emergencyContactsNotification: z.boolean().default(true),
  }),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AutoMergeConfig = z.infer<typeof AutoMergeConfigSchema>;
export type AgenticCIConfig = z.infer<typeof AgenticCIConfigSchema>;

/**
 * Event types for the system
 */
export const EventSchema = z.object({
  id: z.string(),
  type: z.enum([
    'pipeline_started',
    'pipeline_completed',
    'quality_gate_passed',
    'quality_gate_failed',
    'failure_detected',
    'failure_analyzed',
    'auto_merge_approved',
    'auto_merge_blocked',
    'human_intervention_required',
    'emergency_stop_triggered',
    'rollback_initiated',
  ]),
  timestamp: z.date(),
  pipelineId: z.string(),
  data: z.record(z.unknown()),
  severity: z.enum(['info', 'warning', 'error', 'critical']).default('info'),
  handled: z.boolean().default(false),
});

export type Event = z.infer<typeof EventSchema>;

/**
 * Audit trail for governance and compliance
 */
export const AuditEntrySchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  action: z.string(),
  actor: z.enum(['agent', 'human', 'system']),
  actorId: z.string(),
  pipelineId: z.string(),
  details: z.record(z.unknown()),
  outcome: z.enum(['success', 'failure', 'partial']),
  impact: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  complianceRelevant: z.boolean().default(false),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/**
 * Performance metrics for the agentic system itself
 */
export const SystemMetricsSchema = z.object({
  timestamp: z.date(),
  agentResponseTime: z.number(),
  decisionAccuracy: z.number().min(0).max(100),
  falsePositiveRate: z.number().min(0).max(100),
  falseNegativeRate: z.number().min(0).max(100),
  systemUptime: z.number().min(0).max(100),
  throughput: z.object({
    pipelinesProcessed: z.number(),
    decisionsPerMinute: z.number(),
    autoMergeRate: z.number().min(0).max(100),
  }),
  resourceUsage: z.object({
    cpuUsage: z.number().min(0).max(100),
    memoryUsage: z.number().min(0).max(100),
    apiCalls: z.number(),
    costs: z.number(),
  }),
});

export type SystemMetrics = z.infer<typeof SystemMetricsSchema>;