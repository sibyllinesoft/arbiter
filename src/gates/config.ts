/**
 * Gate configuration system
 * Manages gate configurations, thresholds, and environment-specific settings
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import Ajv from 'ajv';
import {
  GateConfiguration,
  GateMode,
  RetryConfiguration,
  ValidationResult,
  GateExecutionContext
} from './types.js';

export interface GateConfigurationSet {
  /** Configuration version */
  version: string;
  /** Environment name */
  environment: string;
  /** Global settings */
  global: GlobalSettings;
  /** Individual gate configurations */
  gates: GateConfiguration[];
  /** Override configurations */
  overrides: ConfigurationOverride[];
}

export interface GlobalSettings {
  /** Default timeout for all gates */
  defaultTimeout: number;
  /** Maximum parallel gate execution */
  maxParallelGates: number;
  /** Default retry configuration */
  defaultRetry: RetryConfiguration;
  /** Quality score thresholds */
  qualityThresholds: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
  };
  /** Emergency override settings */
  emergencyOverride: {
    enabled: boolean;
    requiresApproval: boolean;
    maxValidityHours: number;
  };
}

export interface ConfigurationOverride {
  /** Override conditions */
  condition: OverrideCondition;
  /** Configuration changes */
  changes: Partial<GateConfiguration>[];
  /** Override priority */
  priority: number;
}

export interface OverrideCondition {
  /** Branch patterns to match */
  branches?: string[];
  /** File patterns to match */
  files?: string[];
  /** Environment variables to check */
  environment?: Record<string, string>;
  /** Time-based conditions */
  timeWindow?: TimeWindow;
}

export interface TimeWindow {
  /** Start time (ISO 8601) */
  start: string;
  /** End time (ISO 8601) */
  end: string;
  /** Timezone */
  timezone: string;
}

/**
 * Configuration manager for the gates system
 */
export class GateConfigurationManager {
  private configCache: Map<string, GateConfigurationSet> = new Map();
  private validator: Ajv;
  private configSchema: object;

  constructor(
    private configPath: string = '.arbiter/gates.json',
    private environmentOverridesPath: string = '.arbiter/gate-overrides'
  ) {
    this.validator = new Ajv({ allErrors: true });
    this.configSchema = this.getConfigurationSchema();
  }

  /**
   * Load configuration for the specified environment
   */
  async loadConfiguration(environment: string = 'default'): Promise<GateConfigurationSet> {
    const cacheKey = environment;
    
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    try {
      // Load base configuration
      const baseConfig = await this.loadBaseConfiguration();
      
      // Apply environment-specific overrides
      const envConfig = await this.applyEnvironmentOverrides(baseConfig, environment);
      
      // Validate configuration
      const validation = this.validateConfiguration(envConfig);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Cache and return
      this.configCache.set(cacheKey, envConfig);
      return envConfig;
    } catch (error) {
      throw new Error(`Failed to load gate configuration: ${error}`);
    }
  }

  /**
   * Get configuration for a specific gate
   */
  async getGateConfiguration(gateId: string, environment: string = 'default'): Promise<GateConfiguration | undefined> {
    const config = await this.loadConfiguration(environment);
    return config.gates.find(gate => gate.id === gateId);
  }

  /**
   * Get all enabled gates for the environment
   */
  async getEnabledGates(environment: string = 'default'): Promise<GateConfiguration[]> {
    const config = await this.loadConfiguration(environment);
    return config.gates.filter(gate => gate.enabled);
  }

  /**
   * Apply context-specific overrides
   */
  async applyContextOverrides(
    gates: GateConfiguration[],
    context: GateExecutionContext
  ): Promise<GateConfiguration[]> {
    const config = await this.loadConfiguration();
    const applicableOverrides = config.overrides
      .filter(override => this.matchesCondition(override.condition, context))
      .sort((a, b) => b.priority - a.priority);

    return gates.map(gate => {
      let updatedGate = { ...gate };
      
      for (const override of applicableOverrides) {
        const gateOverride = override.changes.find(change => 
          'id' in change && change.id === gate.id
        );
        
        if (gateOverride) {
          updatedGate = { ...updatedGate, ...gateOverride };
        }
      }
      
      return updatedGate;
    });
  }

  /**
   * Save configuration
   */
  async saveConfiguration(config: GateConfigurationSet): Promise<void> {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    const configJson = JSON.stringify(config, null, 2);
    await writeFile(this.configPath, configJson, 'utf-8');
    
    // Clear cache
    this.configCache.delete(config.environment);
  }

  /**
   * Create default configuration
   */
  async createDefaultConfiguration(): Promise<GateConfigurationSet> {
    return {
      version: '1.0.0',
      environment: 'default',
      global: {
        defaultTimeout: 300000, // 5 minutes
        maxParallelGates: 5,
        defaultRetry: {
          maxRetries: 2,
          delay: 1000,
          exponentialBackoff: true
        },
        qualityThresholds: {
          excellent: 95,
          good: 85,
          acceptable: 75,
          poor: 0
        },
        emergencyOverride: {
          enabled: true,
          requiresApproval: true,
          maxValidityHours: 24
        }
      },
      gates: [
        {
          id: 'coverage',
          name: 'Test Coverage',
          description: 'Validates test coverage thresholds',
          enabled: true,
          mode: GateMode.BLOCKING,
          settings: {
            lineThreshold: 80,
            branchThreshold: 75,
            functionThreshold: 80,
            differentialOnly: true
          },
          dependencies: [],
          timeout: 120000,
          retry: {
            maxRetries: 1,
            delay: 1000,
            exponentialBackoff: false
          }
        },
        {
          id: 'contracts',
          name: 'Contract Validation',
          description: 'Validates contracts and metamorphic laws',
          enabled: true,
          mode: GateMode.BLOCKING,
          settings: {
            validateProperties: true,
            checkInvariants: true,
            runMetamorphicTests: true
          },
          dependencies: [],
          timeout: 180000,
          retry: {
            maxRetries: 2,
            delay: 2000,
            exponentialBackoff: true
          }
        },
        {
          id: 'traceability',
          name: 'Traceability Validation',
          description: 'Ensures complete traceability chains',
          enabled: true,
          mode: GateMode.BLOCKING,
          settings: {
            requirementCoverageThreshold: 90,
            scenarioCoverageThreshold: 85,
            allowOrphanedArtifacts: false
          },
          dependencies: [],
          timeout: 60000,
          retry: {
            maxRetries: 1,
            delay: 1000,
            exponentialBackoff: false
          }
        },
        {
          id: 'security',
          name: 'Security Analysis',
          description: 'Security vulnerability and policy validation',
          enabled: true,
          mode: GateMode.BLOCKING,
          settings: {
            maxCriticalVulnerabilities: 0,
            maxHighVulnerabilities: 2,
            scanDependencies: true,
            checkSecrets: true
          },
          dependencies: [],
          timeout: 240000,
          retry: {
            maxRetries: 1,
            delay: 1000,
            exponentialBackoff: false
          }
        },
        {
          id: 'quality',
          name: 'Code Quality',
          description: 'Code quality and maintainability analysis',
          enabled: true,
          mode: GateMode.WARNING,
          settings: {
            maxComplexity: 15,
            minMaintainabilityIndex: 60,
            maxDuplication: 5,
            enforceStandards: true
          },
          dependencies: [],
          timeout: 120000,
          retry: {
            maxRetries: 1,
            delay: 1000,
            exponentialBackoff: false
          }
        },
        {
          id: 'version',
          name: 'Version Validation',
          description: 'Semantic versioning and compatibility validation',
          enabled: true,
          mode: GateMode.WARNING,
          settings: {
            enforceSemanticVersioning: true,
            checkBackwardCompatibility: true,
            validateMigrations: true
          },
          dependencies: [],
          timeout: 90000,
          retry: {
            maxRetries: 1,
            delay: 1000,
            exponentialBackoff: false
          }
        }
      ],
      overrides: [
        {
          condition: {
            branches: ['hotfix/*', 'emergency/*'],
            environment: { CI_EMERGENCY: 'true' }
          },
          changes: [
            {
              id: 'coverage',
              mode: GateMode.WARNING,
              settings: { lineThreshold: 60 }
            },
            {
              id: 'quality',
              enabled: false
            }
          ],
          priority: 100
        }
      ]
    };
  }

  /**
   * Validate configuration against schema
   */
  validateConfiguration(config: GateConfigurationSet): ValidationResult {
    const validate = this.validator.compile(this.configSchema);
    const valid = validate(config);
    
    if (valid) {
      return { valid: true, errors: [], warnings: [] };
    }
    
    const errors = validate.errors?.map(error => 
      `${error.instancePath}: ${error.message}`
    ) || [];
    
    return { valid: false, errors, warnings: [] };
  }

  /**
   * Load base configuration from file
   */
  private async loadBaseConfiguration(): Promise<GateConfigurationSet> {
    try {
      await access(this.configPath);
      const configContent = await readFile(this.configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      // Create default configuration if none exists
      const defaultConfig = await this.createDefaultConfiguration();
      await this.saveConfiguration(defaultConfig);
      return defaultConfig;
    }
  }

  /**
   * Apply environment-specific overrides
   */
  private async applyEnvironmentOverrides(
    baseConfig: GateConfigurationSet,
    environment: string
  ): Promise<GateConfigurationSet> {
    if (environment === 'default') {
      return baseConfig;
    }

    const overridePath = join(this.environmentOverridesPath, `${environment}.json`);
    
    try {
      await access(overridePath);
      const overrideContent = await readFile(overridePath, 'utf-8');
      const overrides = JSON.parse(overrideContent);
      
      return {
        ...baseConfig,
        environment,
        global: { ...baseConfig.global, ...overrides.global },
        gates: baseConfig.gates.map(gate => {
          const gateOverride = overrides.gates?.find((g: any) => g.id === gate.id);
          return gateOverride ? { ...gate, ...gateOverride } : gate;
        }),
        overrides: [...baseConfig.overrides, ...(overrides.overrides || [])]
      };
    } catch (error) {
      // No environment overrides found, return base config
      return { ...baseConfig, environment };
    }
  }

  /**
   * Check if condition matches the execution context
   */
  private matchesCondition(
    condition: OverrideCondition,
    context: GateExecutionContext
  ): boolean {
    // Check branch patterns
    if (condition.branches) {
      const branchMatches = condition.branches.some(pattern => 
        this.matchesPattern(context.branch, pattern)
      );
      if (!branchMatches) return false;
    }

    // Check file patterns
    if (condition.files) {
      const fileMatches = condition.files.some(pattern =>
        context.changedFiles.some(file => this.matchesPattern(file, pattern))
      );
      if (!fileMatches) return false;
    }

    // Check environment variables
    if (condition.environment) {
      for (const [key, value] of Object.entries(condition.environment)) {
        if (context.environment[key] !== value) {
          return false;
        }
      }
    }

    // Check time window
    if (condition.timeWindow) {
      const now = new Date();
      const start = new Date(condition.timeWindow.start);
      const end = new Date(condition.timeWindow.end);
      if (now < start || now > end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Match string against glob pattern
   */
  private matchesPattern(str: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\[(.*)]/g, '[$1]')
    );
    return regex.test(str);
  }

  /**
   * Get JSON schema for configuration validation
   */
  private getConfigurationSchema(): object {
    return {
      type: 'object',
      required: ['version', 'environment', 'global', 'gates'],
      properties: {
        version: { type: 'string' },
        environment: { type: 'string' },
        global: {
          type: 'object',
          required: ['defaultTimeout', 'maxParallelGates', 'defaultRetry', 'qualityThresholds'],
          properties: {
            defaultTimeout: { type: 'number', minimum: 1000 },
            maxParallelGates: { type: 'number', minimum: 1 },
            defaultRetry: {
              type: 'object',
              required: ['maxRetries', 'delay', 'exponentialBackoff'],
              properties: {
                maxRetries: { type: 'number', minimum: 0 },
                delay: { type: 'number', minimum: 0 },
                exponentialBackoff: { type: 'boolean' }
              }
            },
            qualityThresholds: {
              type: 'object',
              required: ['excellent', 'good', 'acceptable', 'poor'],
              properties: {
                excellent: { type: 'number', minimum: 0, maximum: 100 },
                good: { type: 'number', minimum: 0, maximum: 100 },
                acceptable: { type: 'number', minimum: 0, maximum: 100 },
                poor: { type: 'number', minimum: 0, maximum: 100 }
              }
            }
          }
        },
        gates: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'name', 'enabled', 'mode', 'settings', 'dependencies', 'timeout'],
            properties: {
              id: { type: 'string', minLength: 1 },
              name: { type: 'string', minLength: 1 },
              description: { type: 'string' },
              enabled: { type: 'boolean' },
              mode: { enum: ['blocking', 'warning', 'reporting'] },
              settings: { type: 'object' },
              dependencies: {
                type: 'array',
                items: { type: 'string' }
              },
              timeout: { type: 'number', minimum: 1000 },
              retry: {
                type: 'object',
                required: ['maxRetries', 'delay', 'exponentialBackoff'],
                properties: {
                  maxRetries: { type: 'number', minimum: 0 },
                  delay: { type: 'number', minimum: 0 },
                  exponentialBackoff: { type: 'boolean' }
                }
              }
            }
          }
        },
        overrides: {
          type: 'array',
          items: {
            type: 'object',
            required: ['condition', 'changes', 'priority'],
            properties: {
              condition: { type: 'object' },
              changes: { type: 'array' },
              priority: { type: 'number' }
            }
          }
        }
      }
    };
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Get cached configuration environments
   */
  getCachedEnvironments(): string[] {
    return Array.from(this.configCache.keys());
  }
}