import { Octokit } from '@octokit/rest';
import chalk from 'chalk';
import type { GitHubSyncConfig, IssueSpec } from '../types.js';
import { FileBasedTemplateManager } from './file-based-template-manager.js';
import { ConfigurableTemplateManager } from './github-template-config.js';
import type { Epic, Task } from './sharded-storage.js';
import { UnifiedGitHubTemplateManager } from './unified-github-template-manager.js';

export interface GitHubIssue {
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: string[];
  milestone?: {
    number: number;
    title: string;
  };
  assignee?: {
    login: string;
  };
}

/** Enhanced GitHub issue template based on exact issue schema */
export interface GitHubIssueTemplate extends IssueSpec {
  /** Additional GitHub-specific fields */
  assignees?: string[];
  milestone?: number;
  projects?: number[];
}

export interface GitHubMilestone {
  number: number;
  title: string;
  state: 'open' | 'closed';
  description?: string;
}

export interface SyncResult {
  action: 'created' | 'updated' | 'skipped' | 'closed';
  type: 'epic' | 'task' | 'milestone';
  itemId: string;
  githubNumber?: number;
  details?: string;
}

export interface SyncPreview {
  epics: {
    create: Epic[];
    update: Array<{ epic: Epic; existing: GitHubIssue }>;
    close: Array<{ epic: Epic; existing: GitHubIssue }>;
  };
  tasks: {
    create: Task[];
    update: Array<{ task: Task; existing: GitHubIssue }>;
    close: Array<{ task: Task; existing: GitHubIssue }>;
  };
  milestones: {
    create: Epic[];
    update: Array<{ epic: Epic; existing: GitHubMilestone }>;
    close: Array<{ epic: Epic; existing: GitHubMilestone }>;
  };
}

export class GitHubSyncClient {
  private octokit: Octokit;
  private config: GitHubSyncConfig;
  private templateManager: UnifiedGitHubTemplateManager;
  private configurableTemplateManager: ConfigurableTemplateManager;
  private fileBasedTemplateManager: FileBasedTemplateManager;
  private issueCache: Map<string, GitHubIssue> = new Map();
  private milestoneCache: Map<string, GitHubMilestone> = new Map();

  constructor(config: GitHubSyncConfig) {
    this.config = config;
    this.templateManager = new UnifiedGitHubTemplateManager();
    this.configurableTemplateManager = new ConfigurableTemplateManager(config.templates);
    this.fileBasedTemplateManager = new FileBasedTemplateManager(config.templates || {});

    // Get GitHub token from configured environment variable
    const tokenEnvName = config.repository.tokenEnv || 'GITHUB_TOKEN';
    const token =
      process.env[tokenEnvName] || process.env.GITHUB_TOKEN || process.env.ARBITER_GITHUB_TOKEN;

    if (!token) {
      const envVarMessage =
        tokenEnvName !== 'GITHUB_TOKEN'
          ? `${tokenEnvName} (or GITHUB_TOKEN as fallback)`
          : 'GITHUB_TOKEN';

      throw new Error(
        `GitHub token not found. Set the ${envVarMessage} environment variable.\nTo create a token:\n1. Go to https://github.com/settings/tokens\n2. Generate a new token with 'repo' scope\n3. Set ${tokenEnvName}=your_token_here in your environment`
      );
    }

    this.octokit = new Octokit({
      auth: token,
      baseUrl: config.repository.baseUrl || 'https://api.github.com',
    });
  }

  /**
   * Generate a preview of what would be synced without making changes
   */
  async generateSyncPreview(epics: Epic[]): Promise<SyncPreview> {
    await this.loadExistingData();

    const preview: SyncPreview = {
      epics: { create: [], update: [], close: [] },
      tasks: { create: [], update: [], close: [] },
      milestones: { create: [], update: [], close: [] },
    };

    // Process epics
    for (const epic of epics) {
      const epicTitle = await this.generateEpicTitle(epic);
      const existingIssue = this.findExistingIssue(epicTitle, epic.id);

      if (!existingIssue) {
        preview.epics.create.push(epic);
      } else if (await this.shouldUpdateEpic(epic, existingIssue)) {
        preview.epics.update.push({ epic, existing: existingIssue });
      }

      if (epic.status === 'completed' || epic.status === 'cancelled') {
        if (existingIssue && existingIssue.state === 'open') {
          preview.epics.close.push({ epic, existing: existingIssue });
        }
      }

      // Process milestone for epic
      if (this.config.behavior?.createMilestones) {
        const milestoneTitle = this.generateMilestoneTitle(epic);
        const existingMilestone = this.findExistingMilestone(milestoneTitle, epic.id);

        if (!existingMilestone) {
          preview.milestones.create.push(epic);
        } else if (this.shouldUpdateMilestone(epic, existingMilestone)) {
          preview.milestones.update.push({ epic, existing: existingMilestone });
        }

        if (epic.status === 'completed' || epic.status === 'cancelled') {
          if (existingMilestone && existingMilestone.state === 'open') {
            preview.milestones.close.push({ epic, existing: existingMilestone });
          }
        }
      }

      // Process tasks for this epic
      for (const task of epic.tasks) {
        const taskTitle = await this.generateTaskTitle(task, epic);
        const existingTaskIssue = this.findExistingIssue(taskTitle, task.id);

        if (!existingTaskIssue) {
          preview.tasks.create.push(task);
        } else if (await this.shouldUpdateTask(task, existingTaskIssue, epic)) {
          preview.tasks.update.push({ task, existing: existingTaskIssue });
        }

        if (task.status === 'completed' || task.status === 'cancelled') {
          if (existingTaskIssue && existingTaskIssue.state === 'open') {
            preview.tasks.close.push({ task, existing: existingTaskIssue });
          }
        }
      }
    }

    return preview;
  }

  /**
   * Sync epics and tasks to GitHub (idempotent operation)
   */
  async syncToGitHub(epics: Epic[], dryRun = false): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    if (dryRun) {
      const preview = await this.generateSyncPreview(epics);
      return this.convertPreviewToResults(preview);
    }

    await this.loadExistingData();

    // Process epics
    for (const epic of epics) {
      const epicResults = await this.syncEpic(epic);
      results.push(...epicResults);

      // Process tasks for this epic
      for (const task of epic.tasks) {
        const taskResults = await this.syncTask(task, epic);
        results.push(...taskResults);
      }
    }

    return results;
  }

  /**
   * Load existing GitHub issues and milestones into cache
   */
  private async loadExistingData(): Promise<void> {
    const { owner, repo } = this.config.repository;

    try {
      // Load issues
      const issues = await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
        owner,
        repo,
        state: 'all',
        per_page: 100,
      });

      for (const issue of issues) {
        if (!issue.pull_request) {
          // Exclude PRs
          const githubIssue: GitHubIssue = {
            number: issue.number,
            title: issue.title,
            body: issue.body || undefined,
            state: issue.state as 'open' | 'closed',
            labels: issue.labels.map(label =>
              typeof label === 'string' ? label : label.name || ''
            ),
            milestone: issue.milestone
              ? {
                  number: issue.milestone.number,
                  title: issue.milestone.title,
                }
              : undefined,
            assignee: issue.assignee
              ? {
                  login: issue.assignee.login,
                }
              : undefined,
          };

          this.issueCache.set(issue.title, githubIssue);

          // Also cache by arbiter ID if present in body
          const arbiterIdMatch = issue.body?.match(/<!-- arbiter-id: ([^\\s]+) -->/);
          if (arbiterIdMatch) {
            this.issueCache.set(`arbiter:${arbiterIdMatch[1]}`, githubIssue);
          }
        }
      }

      // Load milestones if needed
      if (this.config.behavior?.createMilestones) {
        const milestones = await this.octokit.paginate(this.octokit.rest.issues.listMilestones, {
          owner,
          repo,
          state: 'all',
          per_page: 100,
        });

        for (const milestone of milestones) {
          const githubMilestone: GitHubMilestone = {
            number: milestone.number,
            title: milestone.title,
            state: milestone.state as 'open' | 'closed',
            description: milestone.description || undefined,
          };

          this.milestoneCache.set(milestone.title, githubMilestone);

          // Also cache by arbiter ID if present in description
          const arbiterIdMatch = milestone.description?.match(/<!-- arbiter-id: ([^\\s]+) -->/);
          if (arbiterIdMatch) {
            this.milestoneCache.set(`arbiter:${arbiterIdMatch[1]}`, githubMilestone);
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to load existing GitHub data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Sync a single epic to GitHub
   */
  private async syncEpic(epic: Epic): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const { owner, repo } = this.config.repository;

    try {
      const epicTitle = await this.generateEpicTitle(epic);
      const existingIssue = this.findExistingIssue(epicTitle, epic.id);

      if (!existingIssue) {
        // Create new epic issue using file-based template system (fallback to configurable)
        let template;
        try {
          template = await this.fileBasedTemplateManager.generateEpicTemplate(epic, {
            includeMetadata: true,
            includeArbiterIds: true,
            includeAcceptanceCriteria: true,
            includeDependencies: true,
            includeEstimations: true,
          });
        } catch (error) {
          // Fallback to configurable template manager
          template = this.configurableTemplateManager.generateEpicTemplate(epic, {
            includeMetadata: true,
            includeArbiterIds: true,
            includeAcceptanceCriteria: true,
            includeDependencies: true,
            includeEstimations: true,
          });
        }

        // Map semantic labels to GitHub labels
        const mappedLabels = this.mapSemanticLabels(template.labels, 'epic', epic);

        const newIssue = await this.octokit.rest.issues.create({
          owner,
          repo,
          title: template.title,
          body: template.body,
          labels: mappedLabels,
          assignees:
            this.config.behavior?.syncAssignees && template.assignees
              ? template.assignees
              : undefined,
        });

        this.issueCache.set(epicTitle, {
          number: newIssue.data.number,
          title: newIssue.data.title,
          body: newIssue.data.body || undefined,
          state: newIssue.data.state as 'open' | 'closed',
          labels: newIssue.data.labels.map(l => (typeof l === 'string' ? l : l.name || '')),
        });

        results.push({
          action: 'created',
          type: 'epic',
          itemId: epic.id,
          githubNumber: newIssue.data.number,
          details: `Created GitHub issue #${newIssue.data.number}`,
        });
      } else if (await this.shouldUpdateEpic(epic, existingIssue)) {
        // Update existing epic issue using file-based template system (fallback to configurable)
        let template;
        try {
          template = await this.fileBasedTemplateManager.generateEpicTemplate(epic, {
            includeMetadata: true,
            includeArbiterIds: true,
            includeAcceptanceCriteria: true,
            includeDependencies: true,
            includeEstimations: true,
          });
        } catch (error) {
          // Fallback to configurable template manager
          template = this.configurableTemplateManager.generateEpicTemplate(epic, {
            includeMetadata: true,
            includeArbiterIds: true,
            includeAcceptanceCriteria: true,
            includeDependencies: true,
            includeEstimations: true,
          });
        }

        // Map semantic labels to GitHub labels
        const mappedLabels = this.mapSemanticLabels(template.labels, 'epic', epic);

        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          title: template.title,
          body: template.body,
          labels: mappedLabels,
          assignees:
            this.config.behavior?.syncAssignees && template.assignees
              ? template.assignees
              : undefined,
        });

        results.push({
          action: 'updated',
          type: 'epic',
          itemId: epic.id,
          githubNumber: existingIssue.number,
          details: `Updated GitHub issue #${existingIssue.number}`,
        });
      } else {
        results.push({
          action: 'skipped',
          type: 'epic',
          itemId: epic.id,
          githubNumber: existingIssue.number,
          details: `No changes needed for GitHub issue #${existingIssue.number}`,
        });
      }

      // Handle epic completion/cancellation
      if (
        (epic.status === 'completed' || epic.status === 'cancelled') &&
        existingIssue &&
        existingIssue.state === 'open' &&
        this.config.behavior?.autoClose
      ) {
        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          state: 'closed',
        });

        results.push({
          action: 'closed',
          type: 'epic',
          itemId: epic.id,
          githubNumber: existingIssue.number,
          details: `Closed GitHub issue #${existingIssue.number}`,
        });
      }

      // Handle milestone creation/update
      if (this.config.behavior?.createMilestones) {
        const milestoneResults = await this.syncEpicMilestone(epic);
        results.push(...milestoneResults);
      }
    } catch (error) {
      results.push({
        action: 'skipped',
        type: 'epic',
        itemId: epic.id,
        details: `Failed to sync epic: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return results;
  }

  /**
   * Sync a single task to GitHub
   */
  private async syncTask(task: Task, epic: Epic): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const { owner, repo } = this.config.repository;

    try {
      const taskTitle = await this.generateTaskTitle(task, epic);
      const existingIssue = this.findExistingIssue(taskTitle, task.id);

      if (!existingIssue) {
        // Create new task issue using file-based template system (fallback to configurable)
        let template;
        try {
          template = await this.fileBasedTemplateManager.generateTaskTemplate(task, epic, {
            includeMetadata: true,
            includeArbiterIds: true,
            includeAcceptanceCriteria: true,
            includeDependencies: true,
            includeEstimations: true,
          });
        } catch (error) {
          // Fallback to configurable template manager
          template = this.configurableTemplateManager.generateTaskTemplate(task, epic, {
            includeMetadata: true,
            includeArbiterIds: true,
            includeAcceptanceCriteria: true,
            includeDependencies: true,
            includeEstimations: true,
          });
        }
        const milestone = this.findMilestoneForEpic(epic);

        // Map semantic labels to GitHub labels
        const mappedLabels = this.mapSemanticLabels(template.labels, 'task', task);

        const newIssue = await this.octokit.rest.issues.create({
          owner,
          repo,
          title: template.title,
          body: template.body,
          labels: mappedLabels,
          assignees:
            this.config.behavior?.syncAssignees && template.assignees
              ? template.assignees
              : undefined,
          milestone: milestone?.number,
        });

        results.push({
          action: 'created',
          type: 'task',
          itemId: task.id,
          githubNumber: newIssue.data.number,
          details: `Created GitHub issue #${newIssue.data.number}`,
        });
      } else if (await this.shouldUpdateTask(task, existingIssue, epic)) {
        // Update existing task issue using file-based template system (fallback to configurable)
        let template;
        try {
          template = await this.fileBasedTemplateManager.generateTaskTemplate(task, epic, {
            includeMetadata: true,
            includeArbiterIds: true,
            includeAcceptanceCriteria: true,
            includeDependencies: true,
            includeEstimations: true,
          });
        } catch (error) {
          // Fallback to configurable template manager
          template = this.configurableTemplateManager.generateTaskTemplate(task, epic, {
            includeMetadata: true,
            includeArbiterIds: true,
            includeAcceptanceCriteria: true,
            includeDependencies: true,
            includeEstimations: true,
          });
        }
        const milestone = this.findMilestoneForEpic(epic);

        // Map semantic labels to GitHub labels
        const mappedLabels = this.mapSemanticLabels(template.labels, 'task', task);

        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          title: template.title,
          body: template.body,
          labels: mappedLabels,
          assignees:
            this.config.behavior?.syncAssignees && template.assignees
              ? template.assignees
              : undefined,
          milestone: milestone?.number,
        });

        results.push({
          action: 'updated',
          type: 'task',
          itemId: task.id,
          githubNumber: existingIssue.number,
          details: `Updated GitHub issue #${existingIssue.number}`,
        });
      } else {
        results.push({
          action: 'skipped',
          type: 'task',
          itemId: task.id,
          githubNumber: existingIssue.number,
          details: `No changes needed for GitHub issue #${existingIssue.number}`,
        });
      }

      // Handle task completion/cancellation
      if (
        (task.status === 'completed' || task.status === 'cancelled') &&
        existingIssue &&
        existingIssue.state === 'open' &&
        this.config.behavior?.autoClose
      ) {
        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          state: 'closed',
        });

        results.push({
          action: 'closed',
          type: 'task',
          itemId: task.id,
          githubNumber: existingIssue.number,
          details: `Closed GitHub issue #${existingIssue.number}`,
        });
      }
    } catch (error) {
      results.push({
        action: 'skipped',
        type: 'task',
        itemId: task.id,
        details: `Failed to sync task: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return results;
  }

  /**
   * Sync milestone for an epic
   */
  private async syncEpicMilestone(epic: Epic): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const { owner, repo } = this.config.repository;

    try {
      const milestoneTitle = this.generateMilestoneTitle(epic);
      const existingMilestone = this.findExistingMilestone(milestoneTitle, epic.id);

      if (!existingMilestone) {
        // Create new milestone
        const description = this.generateMilestoneDescription(epic);
        const dueDate = epic.dueDate ? new Date(epic.dueDate).toISOString() : undefined;

        const newMilestone = await this.octokit.rest.issues.createMilestone({
          owner,
          repo,
          title: milestoneTitle,
          description,
          due_on: dueDate,
        });

        this.milestoneCache.set(milestoneTitle, {
          number: newMilestone.data.number,
          title: newMilestone.data.title,
          state: newMilestone.data.state as 'open' | 'closed',
          description: newMilestone.data.description || undefined,
        });

        results.push({
          action: 'created',
          type: 'milestone',
          itemId: epic.id,
          githubNumber: newMilestone.data.number,
          details: `Created GitHub milestone #${newMilestone.data.number}`,
        });
      } else if (this.shouldUpdateMilestone(epic, existingMilestone)) {
        // Update existing milestone
        const description = this.generateMilestoneDescription(epic);
        const dueDate = epic.dueDate ? new Date(epic.dueDate).toISOString() : undefined;

        await this.octokit.rest.issues.updateMilestone({
          owner,
          repo,
          milestone_number: existingMilestone.number,
          title: milestoneTitle,
          description,
          due_on: dueDate,
        });

        results.push({
          action: 'updated',
          type: 'milestone',
          itemId: epic.id,
          githubNumber: existingMilestone.number,
          details: `Updated GitHub milestone #${existingMilestone.number}`,
        });
      }

      // Handle milestone completion
      if (
        (epic.status === 'completed' || epic.status === 'cancelled') &&
        existingMilestone &&
        existingMilestone.state === 'open'
      ) {
        await this.octokit.rest.issues.updateMilestone({
          owner,
          repo,
          milestone_number: existingMilestone.number,
          state: 'closed',
        });

        results.push({
          action: 'closed',
          type: 'milestone',
          itemId: epic.id,
          githubNumber: existingMilestone.number,
          details: `Closed GitHub milestone #${existingMilestone.number}`,
        });
      }
    } catch (error) {
      results.push({
        action: 'skipped',
        type: 'milestone',
        itemId: epic.id,
        details: `Failed to sync milestone: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return results;
  }

  // Helper methods for generating GitHub content (kept for milestone support)

  private async generateEpicTitle(epic: Epic): Promise<string> {
    // Use file-based template manager for consistency (fallback to configurable)
    try {
      const template = await this.fileBasedTemplateManager.generateEpicTemplate(epic);
      return template.title;
    } catch {
      // Fallback to configurable template manager
      const template = this.configurableTemplateManager.generateEpicTemplate(epic);
      return template.title;
    }
  }

  private async generateTaskTitle(task: Task, epic: Epic): Promise<string> {
    // Use file-based template manager for consistency (fallback to configurable)
    try {
      const template = await this.fileBasedTemplateManager.generateTaskTemplate(task, epic);
      return template.title;
    } catch {
      // Fallback to configurable template manager
      const template = this.configurableTemplateManager.generateTaskTemplate(task, epic);
      return template.title;
    }
  }

  private generateMilestoneTitle(epic: Epic): string {
    return `Epic: ${epic.name}`;
  }

  private generateMilestoneDescription(epic: Epic): string {
    let description = `<!-- arbiter-id: ${epic.id} -->\n\n`;

    if (epic.description) {
      description += `${epic.description}\n\n`;
    }

    description += `Arbiter Epic: ${epic.name}\n`;
    description += `Tasks: ${epic.tasks.length}\n`;

    if (epic.estimatedHours) {
      const totalEstimated = epic.tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
      description += `Estimated Hours: ${totalEstimated}\n`;
    }

    return description;
  }

  // Helper methods for finding existing items

  private findExistingIssue(title: string, arbiterId: string): GitHubIssue | undefined {
    // First try to find by arbiter ID
    const byId = this.issueCache.get(`arbiter:${arbiterId}`);
    if (byId) return byId;

    // Then try by title
    return this.issueCache.get(title);
  }

  private findExistingMilestone(title: string, arbiterId: string): GitHubMilestone | undefined {
    // First try to find by arbiter ID
    const byId = this.milestoneCache.get(`arbiter:${arbiterId}`);
    if (byId) return byId;

    // Then try by title
    return this.milestoneCache.get(title);
  }

  private findMilestoneForEpic(epic: Epic): GitHubMilestone | undefined {
    if (!this.config.behavior?.createMilestones) return undefined;

    const milestoneTitle = this.generateMilestoneTitle(epic);
    return this.findExistingMilestone(milestoneTitle, epic.id);
  }

  // Helper methods for determining if updates are needed

  private async shouldUpdateEpic(epic: Epic, existingIssue: GitHubIssue): Promise<boolean> {
    let template;
    try {
      template = await this.fileBasedTemplateManager.generateEpicTemplate(epic, {
        includeMetadata: true,
        includeArbiterIds: true,
        includeAcceptanceCriteria: true,
        includeDependencies: true,
        includeEstimations: true,
      });
    } catch (error) {
      // Fallback to configurable template manager
      template = this.configurableTemplateManager.generateEpicTemplate(epic, {
        includeMetadata: true,
        includeArbiterIds: true,
        includeAcceptanceCriteria: true,
        includeDependencies: true,
        includeEstimations: true,
      });
    }

    return existingIssue.title !== template.title || existingIssue.body !== template.body;
  }

  private async shouldUpdateTask(
    task: Task,
    existingIssue: GitHubIssue,
    epic: Epic
  ): Promise<boolean> {
    let template;
    try {
      template = await this.fileBasedTemplateManager.generateTaskTemplate(task, epic, {
        includeMetadata: true,
        includeArbiterIds: true,
        includeAcceptanceCriteria: true,
        includeDependencies: true,
        includeEstimations: true,
      });
    } catch (error) {
      // Fallback to configurable template manager
      template = this.configurableTemplateManager.generateTaskTemplate(task, epic, {
        includeMetadata: true,
        includeArbiterIds: true,
        includeAcceptanceCriteria: true,
        includeDependencies: true,
        includeEstimations: true,
      });
    }

    return existingIssue.title !== template.title || existingIssue.body !== template.body;
  }

  private shouldUpdateMilestone(epic: Epic, existingMilestone: GitHubMilestone): boolean {
    const expectedTitle = this.generateMilestoneTitle(epic);
    const expectedDescription = this.generateMilestoneDescription(epic);

    return (
      existingMilestone.title !== expectedTitle ||
      existingMilestone.description !== expectedDescription
    );
  }

  /**
   * Map semantic labels to GitHub/GitLab platform labels
   */
  private mapSemanticLabels(
    labels: string[],
    itemType: 'epic' | 'task',
    item: Epic | Task
  ): string[] {
    const mappedLabels: string[] = [];

    // Add default labels from configuration
    if (this.config.mapping.defaultLabels) {
      mappedLabels.push(...this.config.mapping.defaultLabels);
    }

    // Map semantic labels using configuration
    for (const label of labels) {
      // Check type-specific mappings first
      const typeSpecificLabels =
        itemType === 'epic'
          ? this.config.mapping.epicLabels?.[label]
          : this.config.mapping.taskLabels?.[label];

      if (typeSpecificLabels) {
        mappedLabels.push(...typeSpecificLabels);
      } else {
        // Use label as-is if no mapping found
        mappedLabels.push(label);
      }
    }

    // Add contextual labels based on item properties
    if (itemType === 'epic') {
      const epic = item as Epic;
      mappedLabels.push(`priority:${epic.priority}`);
      mappedLabels.push(`status:${epic.status}`);
      mappedLabels.push('type:epic');
    } else {
      const task = item as Task;
      mappedLabels.push(`priority:${task.priority}`);
      mappedLabels.push(`status:${task.status}`);
      mappedLabels.push(`type:${task.type}`);
    }

    // Add prefix labels if configured
    const prefix =
      itemType === 'epic' ? this.config.mapping.epicPrefix : this.config.mapping.taskPrefix;
    if (prefix) {
      mappedLabels.unshift(prefix);
    }

    // Remove duplicates and return
    return Array.from(new Set(mappedLabels)).filter(label => label.trim() !== '');
  }

  // Helper method to convert preview to results format
  private convertPreviewToResults(preview: SyncPreview): SyncResult[] {
    const results: SyncResult[] = [];

    // Process epics
    preview.epics.create.forEach(epic => {
      results.push({
        action: 'created',
        type: 'epic',
        itemId: epic.id,
        details: `Would create epic: ${epic.name}`,
      });
    });

    preview.epics.update.forEach(({ epic }) => {
      results.push({
        action: 'updated',
        type: 'epic',
        itemId: epic.id,
        details: `Would update epic: ${epic.name}`,
      });
    });

    preview.epics.close.forEach(({ epic }) => {
      results.push({
        action: 'closed',
        type: 'epic',
        itemId: epic.id,
        details: `Would close epic: ${epic.name}`,
      });
    });

    // Process tasks
    preview.tasks.create.forEach(task => {
      results.push({
        action: 'created',
        type: 'task',
        itemId: task.id,
        details: `Would create task: ${task.name}`,
      });
    });

    preview.tasks.update.forEach(({ task }) => {
      results.push({
        action: 'updated',
        type: 'task',
        itemId: task.id,
        details: `Would update task: ${task.name}`,
      });
    });

    preview.tasks.close.forEach(({ task }) => {
      results.push({
        action: 'closed',
        type: 'task',
        itemId: task.id,
        details: `Would close task: ${task.name}`,
      });
    });

    // Process milestones
    preview.milestones.create.forEach(epic => {
      results.push({
        action: 'created',
        type: 'milestone',
        itemId: epic.id,
        details: `Would create milestone: ${epic.name}`,
      });
    });

    preview.milestones.update.forEach(({ epic }) => {
      results.push({
        action: 'updated',
        type: 'milestone',
        itemId: epic.id,
        details: `Would update milestone: ${epic.name}`,
      });
    });

    preview.milestones.close.forEach(({ epic }) => {
      results.push({
        action: 'closed',
        type: 'milestone',
        itemId: epic.id,
        details: `Would close milestone: ${epic.name}`,
      });
    });

    return results;
  }
}
