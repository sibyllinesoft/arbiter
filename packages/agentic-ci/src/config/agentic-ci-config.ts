import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Configuration schema for the Agentic CI system
 */
export const AgenticCIConfigSchema = z.object({
  // GitHub configuration
  github: z.object({
    token: z.string().min(1, 'GitHub token is required'),
    webhookSecret: z.string().min(1, 'Webhook secret is required'),
    repository: z.object({
      owner: z.string().min(1, 'Repository owner is required'),
      repo: z.string().min(1, 'Repository name is required'),
    }),
  }),
  
  // OpenAI configuration for AI agents
  openai: z.object({
    apiKey: z.string().min(1, 'OpenAI API key is required'),
    model: z.string().default('gpt-4'),
    maxTokens: z.number().min(1).max(32768).default(8192),
    temperature: z.number().min(0).max(2).default(0.3),
    timeout: z.number().positive().default(60000), // 60 seconds
  }),
  
  // Auto-merge configuration
  autoMerge: z.object({
    enabled: z.boolean().default(true),
    requireApproval: z.boolean().default(true),
    minimumApprovals: z.number().min(0).default(1),
    maxRiskScore: z.number().min(0).max(100).default(30),
    allowedBranches: z.array(z.string()).default(['main', 'master']),
    restrictedFiles: z.array(z.string()).default([
      'package.json',
      'package-lock.json',
      'Dockerfile',
      '.github/workflows/*.yml',
      '.github/workflows/*.yaml',
      'docker-compose.yml',
    ]),
    riskFactors: z.object({
      weights: z.object({
        changeSize: z.number().default(0.3),
        testCoverage: z.number().default(0.25),
        authorExperience: z.number().default(0.15),
        fileTypes: z.number().default(0.15),
        timeOfDay: z.number().default(0.1),
        deploymentFrequency: z.number().default(0.05),
      }),
      thresholds: z.object({
        largeChange: z.number().default(500), // lines changed
        manyFiles: z.number().default(20), // files changed
        criticalFiles: z.array(z.string()).default([
          'auth',
          'security',
          'payment',
          'billing',
          'user',
          'admin',
        ]),
        lowTestCoverage: z.number().default(80), // percentage
        offHoursWindow: z.object({
          start: z.string().default('18:00'),
          end: z.string().default('09:00'),
          timezone: z.string().default('UTC'),
        }),
      }),
    }),
  }),
  
  // Quality gates configuration
  qualityGates: z.object({
    required: z.array(z.string()).default([
      'test',
      'code-quality',
      'security',
      'build',
    ]),
    thresholds: z.object({
      testCoverage: z.number().min(0).max(100).default(90),
      performanceBudget: z.number().positive().default(2000), // ms
      securitySeverity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      codeQualityScore: z.number().min(0).max(100).default(80),
    }),
    retryPolicy: z.object({
      maxAttempts: z.number().min(1).max(5).default(3),
      backoffMultiplier: z.number().positive().default(2),
      initialDelay: z.number().positive().default(30000), // 30 seconds
    }),
  }),
  
  // Agent configuration
  agents: z.object({
    failureAnalyzer: z.object({
      enabled: z.boolean().default(true),
      maxAnalysisTime: z.number().positive().default(300000), // 5 minutes
      confidenceThreshold: z.number().min(0).max(1).default(0.7),
    }),
    riskAssessor: z.object({
      enabled: z.boolean().default(true),
      historicalDataWindow: z.number().positive().default(30), // days
      authorExperienceWindow: z.number().positive().default(90), // days
    }),
    remediationAgent: z.object({
      enabled: z.boolean().default(true),
      maxRemediationAttempts: z.number().min(1).max(5).default(3),
      allowedActions: z.array(z.string()).default([
        'retry_tests',
        'cache_clear',
        'dependency_install',
        'lint_fix',
      ]),
    }),
    decisionMaker: z.object({
      enabled: z.boolean().default(true),
      decisionTimeout: z.number().positive().default(180000), // 3 minutes
      escalationThreshold: z.number().min(0).max(1).default(0.8),
    }),
  }),
  
  // Safety and monitoring configuration
  safety: z.object({
    emergencyStop: z.object({
      enabled: z.boolean().default(true),
      triggers: z.array(z.string()).default([
        'high_failure_rate',
        'security_incident',
        'performance_degradation',
        'external_dependency_failure',
      ]),
      cooldownPeriod: z.number().positive().default(3600000), // 1 hour
    }),
    circuitBreaker: z.object({
      failureThreshold: z.number().min(1).default(5),
      timeout: z.number().positive().default(60000), // 1 minute
      monitoringWindow: z.number().positive().default(300000), // 5 minutes
    }),
    rateLimiting: z.object({
      maxConcurrentPipelines: z.number().min(1).default(10),
      maxDecisionsPerHour: z.number().min(1).default(100),
      cooldownBetweenMerges: z.number().positive().default(300000), // 5 minutes
    }),
  }),
  
  // Monitoring and metrics configuration
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().positive().default(60000), // 1 minute
    reportingInterval: z.number().positive().default(300000), // 5 minutes
    retentionPeriod: z.number().positive().default(2592000000), // 30 days
    alerting: z.object({
      enabled: z.boolean().default(true),
      channels: z.array(z.string()).default(['github', 'webhook']),
      thresholds: z.object({
        failureRate: z.number().min(0).max(1).default(0.1), // 10%
        responseTime: z.number().positive().default(5000), // 5 seconds
        errorRate: z.number().min(0).max(1).default(0.05), // 5%
      }),
    }),
  }),
  
  // Audit and compliance configuration
  audit: z.object({
    enabled: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    retentionPeriod: z.number().positive().default(7776000000), // 90 days
    encryptLogs: z.boolean().default(true),
    complianceReporting: z.object({
      enabled: z.boolean().default(true),
      schedule: z.string().default('0 0 * * MON'), // Weekly on Monday
      recipients: z.array(z.string()).default([]),
    }),
  }),
  
  // Integration settings
  integrations: z.object({
    chaos: z.object({
      enabled: z.boolean().default(true),
      configPath: z.string().default('./chaos.config.js'),
      triggerOnMerge: z.boolean().default(true),
    }),
    performanceGates: z.object({
      enabled: z.boolean().default(true),
      configPath: z.string().default('./PERFORMANCE_SECURITY_GATES.md'),
    }),
    agentCollaboration: z.object({
      enabled: z.boolean().default(true),
      configPath: z.string().default('./AGENT_COLLABORATION.md'),
    }),
  }),
});

export type AgenticCIConfig = z.infer<typeof AgenticCIConfigSchema>;

/**
 * Configuration manager for the Agentic CI system
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AgenticCIConfig;
  
  private constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }
  
  public static getInstance(configPath?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configPath);
    }
    return ConfigManager.instance;
  }
  
  /**
   * Load configuration from file or environment
   */
  private loadConfig(configPath?: string): AgenticCIConfig {
    let rawConfig: any = {};
    
    // Load from file if provided
    if (configPath) {
      try {
        const configFile = readFileSync(configPath, 'utf-8');
        rawConfig = JSON.parse(configFile);
      } catch (error) {
        console.warn(`Could not load config from ${configPath}:`, error);
      }
    }
    
    // Override with environment variables
    const envConfig = this.loadFromEnvironment();
    rawConfig = { ...rawConfig, ...envConfig };
    
    // Validate and parse configuration
    try {
      return AgenticCIConfigSchema.parse(rawConfig);
    } catch (error) {
      console.error('Invalid configuration:', error);
      throw new Error('Configuration validation failed');
    }
  }
  
  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): Partial<AgenticCIConfig> {
    const envConfig: any = {};
    
    // GitHub configuration
    if (process.env.GITHUB_TOKEN) {
      envConfig.github = {
        ...envConfig.github,
        token: process.env.GITHUB_TOKEN,
      };
    }
    
    if (process.env.GITHUB_WEBHOOK_SECRET) {
      envConfig.github = {
        ...envConfig.github,
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
      };
    }
    
    if (process.env.GITHUB_REPOSITORY) {
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      envConfig.github = {
        ...envConfig.github,
        repository: { owner, repo },
      };
    }
    
    // OpenAI configuration
    if (process.env.OPENAI_API_KEY) {
      envConfig.openai = {
        ...envConfig.openai,
        apiKey: process.env.OPENAI_API_KEY,
      };
    }
    
    if (process.env.OPENAI_MODEL) {
      envConfig.openai = {
        ...envConfig.openai,
        model: process.env.OPENAI_MODEL,
      };
    }
    
    // Auto-merge configuration
    if (process.env.AUTO_MERGE_ENABLED !== undefined) {
      envConfig.autoMerge = {
        ...envConfig.autoMerge,
        enabled: process.env.AUTO_MERGE_ENABLED === 'true',
      };
    }
    
    if (process.env.AUTO_MERGE_MAX_RISK_SCORE) {
      envConfig.autoMerge = {
        ...envConfig.autoMerge,
        maxRiskScore: parseInt(process.env.AUTO_MERGE_MAX_RISK_SCORE, 10),
      };
    }
    
    // Safety configuration
    if (process.env.EMERGENCY_STOP_ENABLED !== undefined) {
      envConfig.safety = {
        ...envConfig.safety,
        emergencyStop: {
          enabled: process.env.EMERGENCY_STOP_ENABLED === 'true',
        },
      };
    }
    
    return envConfig;
  }
  
  /**
   * Get current configuration
   */
  public getConfig(): AgenticCIConfig {
    return this.config;
  }
  
  /**
   * Get specific configuration section
   */
  public getSection<K extends keyof AgenticCIConfig>(section: K): AgenticCIConfig[K] {
    return this.config[section];
  }
  
  /**
   * Update configuration (for testing purposes)
   */
  public updateConfig(updates: Partial<AgenticCIConfig>): void {
    this.config = AgenticCIConfigSchema.parse({
      ...this.config,
      ...updates,
    });
  }
  
  /**
   * Validate configuration
   */
  public validateConfig(): boolean {
    try {
      AgenticCIConfigSchema.parse(this.config);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get environment-specific defaults
   */
  public static getDefaultConfig(): AgenticCIConfig {
    return AgenticCIConfigSchema.parse({
      github: {
        token: process.env.GITHUB_TOKEN || '',
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
        repository: {
          owner: process.env.GITHUB_REPOSITORY?.split('/')[0] || '',
          repo: process.env.GITHUB_REPOSITORY?.split('/')[1] || '',
        },
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
    });
  }
}