/**
 * Merge blocker system
 * Integrates with Git hosting platforms to block merges based on gate results
 */

import { Octokit } from '@octokit/rest';
import axios from 'axios';
import {
  MergeBlocker,
  GateExecutionReport,
  OverrideRequest,
  MergeStatus,
  GateExecutionContext,
  GateStatus,
  OverrideOption,
  CIStatusUpdate
} from './types.js';

export interface BlockerConfiguration {
  /** Git hosting platform */
  platform: 'github' | 'gitlab' | 'bitbucket' | 'azure-devops';
  /** Platform API configuration */
  apiConfig: PlatformApiConfig;
  /** Merge blocking rules */
  blockingRules: BlockingRule[];
  /** Override settings */
  overrideSettings: OverrideSettings;
  /** Status check configuration */
  statusChecks: StatusCheckConfig;
}

export interface PlatformApiConfig {
  /** API base URL */
  baseUrl: string;
  /** Authentication token */
  token: string;
  /** Repository identifier */
  repository: string;
  /** Organization/owner */
  owner: string;
}

export interface BlockingRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Gate IDs that trigger this rule */
  gateIds: string[];
  /** Gate statuses that trigger blocking */
  triggerStatuses: GateStatus[];
  /** Blocking action */
  action: 'block' | 'warn' | 'require-approval';
  /** Rule conditions */
  conditions: BlockingCondition[];
  /** Rule priority */
  priority: number;
}

export interface BlockingCondition {
  /** Condition type */
  type: 'branch-pattern' | 'file-pattern' | 'user-role' | 'time-window' | 'gate-count';
  /** Condition pattern or value */
  value: string | number;
  /** Whether condition should match or not match */
  negate: boolean;
}

export interface OverrideSettings {
  /** Enable emergency overrides */
  enableEmergencyOverride: boolean;
  /** Enable hotfix overrides */
  enableHotfixOverride: boolean;
  /** Enable approval-based overrides */
  enableApprovalOverride: boolean;
  /** Override expiration settings */
  expiration: OverrideExpiration;
  /** Required permissions for overrides */
  permissions: OverridePermissions;
}

export interface OverrideExpiration {
  /** Default expiration time in hours */
  defaultHours: number;
  /** Maximum expiration time in hours */
  maxHours: number;
  /** Emergency override expiration in hours */
  emergencyHours: number;
}

export interface OverridePermissions {
  /** Roles that can create emergency overrides */
  emergencyRoles: string[];
  /** Roles that can approve overrides */
  approvalRoles: string[];
  /** Roles that can create administrative overrides */
  administrativeRoles: string[];
}

export interface StatusCheckConfig {
  /** Status check name prefix */
  namePrefix: string;
  /** Include individual gate statuses */
  includeIndividualGates: boolean;
  /** Include overall status */
  includeOverallStatus: boolean;
  /** Status check descriptions */
  descriptions: StatusCheckDescriptions;
}

export interface StatusCheckDescriptions {
  /** Description for pending status */
  pending: string;
  /** Description for success status */
  success: string;
  /** Description for failure status */
  failure: string;
  /** Description for error status */
  error: string;
}

export interface MergeBlock {
  /** Block ID */
  id: string;
  /** Block reason */
  reason: string;
  /** Blocked by rules */
  blockedBy: BlockingRule[];
  /** Failed gates */
  failedGates: string[];
  /** Block timestamp */
  timestamp: Date;
  /** Block expiration */
  expiresAt?: Date;
  /** Override information */
  override?: OverrideInfo;
}

export interface OverrideInfo {
  /** Override ID */
  id: string;
  /** Override type */
  type: 'emergency' | 'hotfix' | 'approved' | 'administrative';
  /** Override reason */
  reason: string;
  /** Requestor */
  requestor: string;
  /** Approver (if applicable) */
  approver?: string;
  /** Override timestamp */
  timestamp: Date;
  /** Override expiration */
  expiresAt: Date;
  /** Number of uses allowed */
  usesAllowed: number;
  /** Number of uses consumed */
  usesConsumed: number;
}

/**
 * Merge blocker implementation
 */
export class GitMergeBlocker implements MergeBlocker {
  private config: BlockerConfiguration;
  private platformClient: PlatformClient;
  private activeBlocks: Map<string, MergeBlock> = new Map();
  private activeOverrides: Map<string, OverrideInfo> = new Map();

  constructor(config: BlockerConfiguration) {
    this.config = config;
    this.platformClient = this.createPlatformClient(config);
  }

  /**
   * Block merge based on gate results
   */
  async blockMerge(report: GateExecutionReport): Promise<void> {
    const context = report.context;
    const blockId = this.generateBlockId(context);

    try {
      // Evaluate blocking rules
      const applicableRules = this.evaluateBlockingRules(report);
      
      if (applicableRules.length === 0) {
        // No rules apply, ensure merge is not blocked
        await this.unblockMerge(context);
        return;
      }

      // Create merge block
      const block = this.createMergeBlock(blockId, report, applicableRules);
      this.activeBlocks.set(blockId, block);

      // Update platform status checks
      await this.updateStatusChecks(report, block);

      // Set merge protection
      await this.setMergeProtection(context, block);

      // Notify stakeholders
      await this.notifyStakeholders(context, block);

    } catch (error) {
      console.error('Failed to block merge:', error);
      throw new Error(`Failed to block merge: ${error}`);
    }
  }

  /**
   * Unblock merge with override
   */
  async overrideMerge(
    report: GateExecutionReport,
    override: OverrideRequest
  ): Promise<void> {
    const context = report.context;
    const blockId = this.generateBlockId(context);

    try {
      // Validate override request
      await this.validateOverrideRequest(override, report);

      // Create override info
      const overrideInfo = this.createOverrideInfo(override);
      this.activeOverrides.set(overrideInfo.id, overrideInfo);

      // Update or remove block
      const existingBlock = this.activeBlocks.get(blockId);
      if (existingBlock) {
        existingBlock.override = overrideInfo;
        existingBlock.expiresAt = overrideInfo.expiresAt;
      }

      // Update status checks with override
      await this.updateStatusChecksWithOverride(report, overrideInfo);

      // Remove merge protection
      await this.removeMergeProtection(context, overrideInfo);

      // Log override usage
      await this.logOverrideUsage(overrideInfo, context);

    } catch (error) {
      console.error('Failed to override merge:', error);
      throw new Error(`Failed to override merge: ${error}`);
    }
  }

  /**
   * Get current merge status
   */
  async getMergeStatus(context: GateExecutionContext): Promise<MergeStatus> {
    const blockId = this.generateBlockId(context);
    const block = this.activeBlocks.get(blockId);

    if (!block || this.isBlockExpired(block)) {
      return {
        blocked: false,
        reasons: [],
        overrideOptions: this.getAvailableOverrideOptions(context)
      };
    }

    return {
      blocked: true,
      reasons: [block.reason, ...block.blockedBy.map(rule => rule.name)],
      overrideOptions: this.getAvailableOverrideOptions(context)
    };
  }

  /**
   * Create platform-specific client
   */
  private createPlatformClient(config: BlockerConfiguration): PlatformClient {
    switch (config.platform) {
      case 'github':
        return new GitHubClient(config.apiConfig);
      case 'gitlab':
        return new GitLabClient(config.apiConfig);
      case 'bitbucket':
        return new BitbucketClient(config.apiConfig);
      case 'azure-devops':
        return new AzureDevOpsClient(config.apiConfig);
      default:
        throw new Error(`Unsupported platform: ${config.platform}`);
    }
  }

  /**
   * Evaluate blocking rules against report
   */
  private evaluateBlockingRules(report: GateExecutionReport): BlockingRule[] {
    const applicableRules: BlockingRule[] = [];

    for (const rule of this.config.blockingRules) {
      // Check if any gates match the rule
      const matchingGates = report.gateResults.filter(result => 
        rule.gateIds.includes(result.gateId) &&
        rule.triggerStatuses.includes(result.status)
      );

      if (matchingGates.length === 0) {
        continue;
      }

      // Check rule conditions
      if (this.evaluateRuleConditions(rule, report)) {
        applicableRules.push(rule);
      }
    }

    // Sort by priority (higher priority first)
    return applicableRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateRuleConditions(
    rule: BlockingRule,
    report: GateExecutionReport
  ): boolean {
    for (const condition of rule.conditions) {
      const matches = this.evaluateCondition(condition, report);
      if (condition.negate ? matches : !matches) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: BlockingCondition,
    report: GateExecutionReport
  ): boolean {
    switch (condition.type) {
      case 'branch-pattern': {
        const pattern = new RegExp(condition.value as string);
        return pattern.test(report.context.branch);
      }
      case 'file-pattern': {
        const pattern = new RegExp(condition.value as string);
        return report.context.changedFiles.some(file => pattern.test(file));
      }
      case 'gate-count': {
        const failedCount = report.gateResults.filter(r => 
          r.status === GateStatus.FAILED || r.status === GateStatus.ERROR
        ).length;
        return failedCount >= (condition.value as number);
      }
      case 'time-window': {
        // Implementation would check if current time is within specified window
        return true;
      }
      default:
        return false;
    }
  }

  /**
   * Create merge block
   */
  private createMergeBlock(
    blockId: string,
    report: GateExecutionReport,
    rules: BlockingRule[]
  ): MergeBlock {
    const failedGates = report.gateResults
      .filter(result => result.status === GateStatus.FAILED || result.status === GateStatus.ERROR)
      .map(result => result.gateId);

    const reason = this.generateBlockReason(report, rules);

    return {
      id: blockId,
      reason,
      blockedBy: rules,
      failedGates,
      timestamp: new Date()
    };
  }

  /**
   * Generate block reason
   */
  private generateBlockReason(
    report: GateExecutionReport,
    rules: BlockingRule[]
  ): string {
    const failedGates = report.gateResults
      .filter(result => result.status === GateStatus.FAILED || result.status === GateStatus.ERROR)
      .map(result => result.name);

    if (failedGates.length === 1) {
      return `Merge blocked due to ${failedGates[0]} gate failure`;
    } else if (failedGates.length > 1) {
      return `Merge blocked due to ${failedGates.length} gate failures: ${failedGates.join(', ')}`;
    } else {
      return `Merge blocked by quality gate policies: ${rules.map(r => r.name).join(', ')}`;
    }
  }

  /**
   * Update status checks on the platform
   */
  private async updateStatusChecks(
    report: GateExecutionReport,
    block: MergeBlock
  ): Promise<void> {
    const statusUpdates: CIStatusUpdate[] = [];

    // Overall status
    if (this.config.statusChecks.includeOverallStatus) {
      statusUpdates.push({
        name: `${this.config.statusChecks.namePrefix}/quality-gates`,
        state: 'failure',
        description: block.reason,
        targetUrl: this.generateReportUrl(report)
      });
    }

    // Individual gate statuses
    if (this.config.statusChecks.includeIndividualGates) {
      for (const gateResult of report.gateResults) {
        statusUpdates.push({
          name: `${this.config.statusChecks.namePrefix}/${gateResult.gateId}`,
          state: this.mapGateStatusToPlatformStatus(gateResult.status),
          description: gateResult.details.summary,
          targetUrl: gateResult.details.reportUrls[0]
        });
      }
    }

    // Update status checks on platform
    for (const statusUpdate of statusUpdates) {
      await this.platformClient.updateStatusCheck(report.context, statusUpdate);
    }
  }

  /**
   * Update status checks with override information
   */
  private async updateStatusChecksWithOverride(
    report: GateExecutionReport,
    override: OverrideInfo
  ): Promise<void> {
    const statusUpdate: CIStatusUpdate = {
      name: `${this.config.statusChecks.namePrefix}/quality-gates`,
      state: 'success',
      description: `Quality gates overridden: ${override.reason}`,
      targetUrl: this.generateReportUrl(report)
    };

    await this.platformClient.updateStatusCheck(report.context, statusUpdate);
  }

  /**
   * Set merge protection
   */
  private async setMergeProtection(
    context: GateExecutionContext,
    block: MergeBlock
  ): Promise<void> {
    await this.platformClient.setMergeProtection(context, {
      enabled: true,
      reason: block.reason,
      requiredStatusChecks: [`${this.config.statusChecks.namePrefix}/quality-gates`]
    });
  }

  /**
   * Remove merge protection
   */
  private async removeMergeProtection(
    context: GateExecutionContext,
    override: OverrideInfo
  ): Promise<void> {
    await this.platformClient.setMergeProtection(context, {
      enabled: false,
      reason: `Override applied: ${override.reason}`,
      requiredStatusChecks: []
    });
  }

  /**
   * Unblock merge (remove protection)
   */
  private async unblockMerge(context: GateExecutionContext): Promise<void> {
    const blockId = this.generateBlockId(context);
    
    // Remove from active blocks
    this.activeBlocks.delete(blockId);

    // Update status to success
    const statusUpdate: CIStatusUpdate = {
      name: `${this.config.statusChecks.namePrefix}/quality-gates`,
      state: 'success',
      description: 'All quality gates passed',
      targetUrl: undefined
    };

    await this.platformClient.updateStatusCheck(context, statusUpdate);

    // Remove merge protection
    await this.platformClient.setMergeProtection(context, {
      enabled: false,
      reason: 'Quality gates passed',
      requiredStatusChecks: []
    });
  }

  /**
   * Validate override request
   */
  private async validateOverrideRequest(
    override: OverrideRequest,
    report: GateExecutionReport
  ): Promise<void> {
    // Check if overrides are enabled
    if (!this.config.overrideSettings.enableEmergencyOverride &&
        !this.config.overrideSettings.enableHotfixOverride &&
        !this.config.overrideSettings.enableApprovalOverride) {
      throw new Error('Override functionality is disabled');
    }

    // Check permissions (simplified - would integrate with platform permissions)
    // This would typically check user roles against required permissions

    // Check if override already exists
    const blockId = this.generateBlockId(report.context);
    const existingBlock = this.activeBlocks.get(blockId);
    if (existingBlock?.override) {
      throw new Error('Override already exists for this merge');
    }

    // Validate override scope
    if (!override.scope.gates.some(gateId => 
      report.gateResults.some(result => result.gateId === gateId)
    )) {
      throw new Error('Override scope does not match failed gates');
    }
  }

  /**
   * Create override info
   */
  private createOverrideInfo(override: OverrideRequest): OverrideInfo {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 
      this.getOverrideExpirationHours(override) * 60 * 60 * 1000);

    return {
      id: this.generateOverrideId(),
      type: this.determineOverrideType(override),
      reason: override.reason,
      requestor: override.requestor,
      timestamp: now,
      expiresAt,
      usesAllowed: override.scope.usesAllowed,
      usesConsumed: 0
    };
  }

  /**
   * Get override expiration hours
   */
  private getOverrideExpirationHours(override: OverrideRequest): number {
    const settings = this.config.overrideSettings.expiration;
    
    // Determine expiration based on override type
    if (override.reason.toLowerCase().includes('emergency')) {
      return settings.emergencyHours;
    }
    
    return Math.min(
      (override.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000),
      settings.maxHours
    );
  }

  /**
   * Determine override type
   */
  private determineOverrideType(override: OverrideRequest): OverrideInfo['type'] {
    if (override.reason.toLowerCase().includes('emergency')) {
      return 'emergency';
    }
    if (override.reason.toLowerCase().includes('hotfix')) {
      return 'hotfix';
    }
    if (override.requiresApproval) {
      return 'approved';
    }
    return 'administrative';
  }

  /**
   * Get available override options
   */
  private getAvailableOverrideOptions(context: GateExecutionContext): OverrideOption[] {
    const options: OverrideOption[] = [];

    if (this.config.overrideSettings.enableEmergencyOverride) {
      options.push({
        type: 'emergency',
        permissions: this.config.overrideSettings.permissions.emergencyRoles,
        requiresApproval: false
      });
    }

    if (this.config.overrideSettings.enableHotfixOverride) {
      options.push({
        type: 'hotfix',
        permissions: ['maintainer', 'admin'],
        requiresApproval: false
      });
    }

    if (this.config.overrideSettings.enableApprovalOverride) {
      options.push({
        type: 'approved',
        permissions: this.config.overrideSettings.permissions.approvalRoles,
        requiresApproval: true
      });
    }

    options.push({
      type: 'administrative',
      permissions: this.config.overrideSettings.permissions.administrativeRoles,
      requiresApproval: false
    });

    return options;
  }

  /**
   * Notify stakeholders about merge block
   */
  private async notifyStakeholders(
    context: GateExecutionContext,
    block: MergeBlock
  ): Promise<void> {
    // Implementation would send notifications via various channels
    // For now, just log the notification
    console.log(`Merge blocked for ${context.repository}:${context.branch}`, {
      blockId: block.id,
      reason: block.reason,
      failedGates: block.failedGates
    });
  }

  /**
   * Log override usage
   */
  private async logOverrideUsage(
    override: OverrideInfo,
    context: GateExecutionContext
  ): Promise<void> {
    // Implementation would log to audit system
    console.log(`Override used for ${context.repository}:${context.branch}`, {
      overrideId: override.id,
      type: override.type,
      requestor: override.requestor,
      reason: override.reason
    });
  }

  /**
   * Check if block is expired
   */
  private isBlockExpired(block: MergeBlock): boolean {
    return block.expiresAt ? block.expiresAt < new Date() : false;
  }

  /**
   * Map gate status to platform status
   */
  private mapGateStatusToPlatformStatus(status: GateStatus): 'pending' | 'success' | 'failure' | 'error' {
    switch (status) {
      case GateStatus.PENDING:
      case GateStatus.RUNNING:
        return 'pending';
      case GateStatus.PASSED:
        return 'success';
      case GateStatus.FAILED:
        return 'failure';
      case GateStatus.ERROR:
        return 'error';
      case GateStatus.SKIPPED:
        return 'success';
      default:
        return 'error';
    }
  }

  /**
   * Generate block ID
   */
  private generateBlockId(context: GateExecutionContext): string {
    return `${context.repository}-${context.branch}-${context.commitSha}`;
  }

  /**
   * Generate override ID
   */
  private generateOverrideId(): string {
    return `override-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate report URL
   */
  private generateReportUrl(report: GateExecutionReport): string | undefined {
    // Implementation would generate a URL to the detailed gate report
    return `https://reports.example.com/gate-report/${report.id}`;
  }
}

// Platform client interfaces and implementations
interface PlatformClient {
  updateStatusCheck(context: GateExecutionContext, status: CIStatusUpdate): Promise<void>;
  setMergeProtection(context: GateExecutionContext, protection: MergeProtectionConfig): Promise<void>;
}

interface MergeProtectionConfig {
  enabled: boolean;
  reason: string;
  requiredStatusChecks: string[];
}

class GitHubClient implements PlatformClient {
  private octokit: Octokit;
  private config: PlatformApiConfig;

  constructor(config: PlatformApiConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
      baseUrl: config.baseUrl
    });
  }

  async updateStatusCheck(context: GateExecutionContext, status: CIStatusUpdate): Promise<void> {
    await this.octokit.repos.createCommitStatus({
      owner: this.config.owner,
      repo: this.config.repository,
      sha: context.commitSha,
      state: status.state,
      description: status.description,
      context: status.name,
      target_url: status.targetUrl
    });
  }

  async setMergeProtection(context: GateExecutionContext, protection: MergeProtectionConfig): Promise<void> {
    if (protection.enabled) {
      await this.octokit.repos.updateBranchProtection({
        owner: this.config.owner,
        repo: this.config.repository,
        branch: context.branch,
        required_status_checks: {
          strict: true,
          contexts: protection.requiredStatusChecks
        },
        enforce_admins: false,
        required_pull_request_reviews: null,
        restrictions: null
      });
    }
  }
}

class GitLabClient implements PlatformClient {
  private config: PlatformApiConfig;

  constructor(config: PlatformApiConfig) {
    this.config = config;
  }

  async updateStatusCheck(context: GateExecutionContext, status: CIStatusUpdate): Promise<void> {
    const url = `${this.config.baseUrl}/api/v4/projects/${encodeURIComponent(this.config.repository)}/statuses/${context.commitSha}`;
    
    await axios.post(url, {
      state: status.state,
      description: status.description,
      name: status.name,
      target_url: status.targetUrl
    }, {
      headers: {
        'Authorization': `Bearer ${this.config.token}`
      }
    });
  }

  async setMergeProtection(context: GateExecutionContext, protection: MergeProtectionConfig): Promise<void> {
    // GitLab merge protection implementation
  }
}

class BitbucketClient implements PlatformClient {
  private config: PlatformApiConfig;

  constructor(config: PlatformApiConfig) {
    this.config = config;
  }

  async updateStatusCheck(context: GateExecutionContext, status: CIStatusUpdate): Promise<void> {
    // Bitbucket status check implementation
  }

  async setMergeProtection(context: GateExecutionContext, protection: MergeProtectionConfig): Promise<void> {
    // Bitbucket merge protection implementation
  }
}

class AzureDevOpsClient implements PlatformClient {
  private config: PlatformApiConfig;

  constructor(config: PlatformApiConfig) {
    this.config = config;
  }

  async updateStatusCheck(context: GateExecutionContext, status: CIStatusUpdate): Promise<void> {
    // Azure DevOps status check implementation
  }

  async setMergeProtection(context: GateExecutionContext, protection: MergeProtectionConfig): Promise<void> {
    // Azure DevOps merge protection implementation
  }
}