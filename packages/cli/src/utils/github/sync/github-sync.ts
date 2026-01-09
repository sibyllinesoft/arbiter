import path from "node:path";
import type { GitHubSyncConfig } from "@/types.js";
import type { Group, Task } from "@/utils/github/sharded-storage.js";
import {
  generateMilestoneDescription,
  generateMilestoneTitle,
  mapSemanticLabels,
} from "@/utils/github/sync/github-sync-helpers.js";
import {
  type GitHubIssue,
  type GitHubMilestone,
  type SyncPreview,
  type SyncResult,
  type SyncState,
  convertPreviewToResults,
} from "@/utils/github/sync/github-sync-types.js";
import { UnifiedGitHubTemplateManager } from "@/utils/github/templates/unified-github-template-manager.js";
import { Octokit } from "@octokit/rest";
import chalk from "chalk";
import fs from "fs-extra";

// Re-export types for backwards compatibility
export type {
  GitHubIssue,
  GitHubIssueTemplate,
  GitHubMilestone,
  SyncResult,
  SyncPreview,
} from "@/utils/github/sync/github-sync-types.js";

export class GitHubSyncClient {
  private octokit: Octokit;
  private config: GitHubSyncConfig;
  private templateManager: UnifiedGitHubTemplateManager;
  private issueCache: Map<string, GitHubIssue> = new Map();
  private milestoneCache: Map<string, GitHubMilestone> = new Map();
  private syncStatePath: string;
  private syncState: SyncState;
  private stateDirty = false;

  constructor(config: GitHubSyncConfig) {
    this.config = config;
    this.templateManager = new UnifiedGitHubTemplateManager(config.templates || {}, process.cwd());
    this.syncStatePath = path.resolve(process.cwd(), ".arbiter", "sync-state.json");
    this.syncState = this.initializeSyncState();
    this.loadSyncState();

    const token = this.resolveGitHubToken(config);
    this.octokit = new Octokit({
      auth: token,
      baseUrl: config.repository.baseUrl || "https://api.github.com",
    });
  }

  /**
   * Initialize the sync state with repository info
   */
  private initializeSyncState(): SyncState {
    return {
      repository: {
        owner: this.config.repository?.owner,
        repo: this.config.repository?.repo,
      },
      issues: {},
      milestones: {},
    };
  }

  /**
   * Resolve GitHub token from environment variables
   * @throws Error if no token is found
   */
  private resolveGitHubToken(config: GitHubSyncConfig): string {
    const tokenEnvName = config.repository.tokenEnv || "GITHUB_TOKEN";
    const token =
      process.env[tokenEnvName] || process.env.GITHUB_TOKEN || process.env.ARBITER_GITHUB_TOKEN;

    if (!token) {
      throw this.createTokenError(tokenEnvName);
    }

    return token;
  }

  /**
   * Create a descriptive error for missing token
   */
  private createTokenError(tokenEnvName: string): Error {
    const envVarMessage =
      tokenEnvName !== "GITHUB_TOKEN"
        ? `${tokenEnvName} (or GITHUB_TOKEN as fallback)`
        : "GITHUB_TOKEN";

    return new Error(
      `GitHub token not found. Set the ${envVarMessage} environment variable.\nTo create a token:\n1. Go to https://github.com/settings/tokens\n2. Generate a new token with 'repo' scope\n3. Set ${tokenEnvName}=your_token_here in your environment`,
    );
  }

  private isMatchingRepository(data: Partial<SyncState>): boolean {
    return (
      data.repository?.owner === this.config.repository?.owner &&
      data.repository?.repo === this.config.repository?.repo
    );
  }

  private createEmptySyncState(): SyncState {
    return {
      repository: { owner: this.config.repository?.owner, repo: this.config.repository?.repo },
      issues: {},
      milestones: {},
    };
  }

  /**
   * Load Arbiter ↔ GitHub mapping from disk to avoid duplicate issue creation when titles change.
   */
  private loadSyncState(): void {
    try {
      if (!fs.existsSync(this.syncStatePath)) {
        return;
      }

      const data = fs.readJsonSync(this.syncStatePath) as Partial<SyncState>;
      if (this.isMatchingRepository(data)) {
        this.syncState = {
          repository: data.repository,
          issues: data.issues ?? {},
          milestones: data.milestones ?? {},
        };
      }
    } catch (error) {
      console.warn("⚠️  Unable to read .arbiter/sync-state.json, starting with empty state.", error);
      this.syncState = this.createEmptySyncState();
    }
  }

  /**
   * Persist sync state when mappings change.
   */
  private async saveSyncState(): Promise<void> {
    if (!this.stateDirty) return;
    this.stateDirty = false;

    try {
      await fs.ensureDir(path.dirname(this.syncStatePath));
      await fs.writeJson(this.syncStatePath, this.syncState, { spaces: 2 });
    } catch (error) {
      console.warn("⚠️  Unable to persist GitHub sync state.", error);
    }
  }

  private rememberIssueMapping(arbiterId: string, issueNumber: number): void {
    if (this.syncState.issues[arbiterId] === issueNumber) return;
    this.syncState.issues[arbiterId] = issueNumber;
    this.stateDirty = true;
  }

  private rememberMilestoneMapping(arbiterId: string, milestoneNumber: number): void {
    if (this.syncState.milestones[arbiterId] === milestoneNumber) return;
    this.syncState.milestones[arbiterId] = milestoneNumber;
    this.stateDirty = true;
  }

  /**
   * Generate a preview of what would be synced without making changes
   */
  async generateSyncPreview(groups: Group[]): Promise<SyncPreview> {
    await this.loadExistingData();

    const preview: SyncPreview = {
      groups: { create: [], update: [], close: [] },
      tasks: { create: [], update: [], close: [] },
      milestones: { create: [], update: [], close: [] },
    };

    for (const group of groups) {
      await this.previewGroupSync(group, preview);
      this.previewMilestoneSync(group, preview);
      await this.previewTasksSync(group, preview);
    }

    await this.saveSyncState();
    return preview;
  }

  /**
   * Preview sync status for a single group
   */
  private async previewGroupSync(group: Group, preview: SyncPreview): Promise<void> {
    const groupTitle = await this.generateGroupTitle(group);
    const existingIssue = this.findExistingIssue(groupTitle, group.id);

    if (!existingIssue) {
      preview.groups.create.push(group);
    } else if (await this.shouldUpdateGroup(group, existingIssue)) {
      preview.groups.update.push({ group, existing: existingIssue });
    }

    const shouldClose = group.status === "completed" || group.status === "cancelled";
    if (shouldClose && existingIssue?.state === "open") {
      preview.groups.close.push({ group, existing: existingIssue });
    }
  }

  /**
   * Preview sync status for a group's milestone
   */
  private previewMilestoneSync(group: Group, preview: SyncPreview): void {
    if (!this.config.automation?.createMilestones) return;

    const milestoneTitle = generateMilestoneTitle(group);
    const existingMilestone = this.findExistingMilestone(milestoneTitle, group.id);

    if (!existingMilestone) {
      preview.milestones.create.push(group);
    } else if (this.shouldUpdateMilestone(group, existingMilestone)) {
      preview.milestones.update.push({ group, existing: existingMilestone });
    }

    const shouldClose = group.status === "completed" || group.status === "cancelled";
    if (shouldClose && existingMilestone?.state === "open") {
      preview.milestones.close.push({ group, existing: existingMilestone });
    }
  }

  /**
   * Preview sync status for all tasks in a group
   */
  private async previewTasksSync(group: Group, preview: SyncPreview): Promise<void> {
    for (const task of group.tasks) {
      await this.previewSingleTaskSync(task, group, preview);
    }
  }

  /**
   * Preview sync status for a single task
   */
  private async previewSingleTaskSync(
    task: Task,
    group: Group,
    preview: SyncPreview,
  ): Promise<void> {
    const taskTitle = await this.generateTaskTitle(task, group);
    const existingTaskIssue = this.findExistingIssue(taskTitle, task.id);

    if (!existingTaskIssue) {
      preview.tasks.create.push(task);
    } else if (await this.shouldUpdateTask(task, existingTaskIssue, group)) {
      preview.tasks.update.push({ task, existing: existingTaskIssue });
    }

    const shouldClose = task.status === "completed" || task.status === "cancelled";
    if (shouldClose && existingTaskIssue?.state === "open") {
      preview.tasks.close.push({ task, existing: existingTaskIssue });
    }
  }

  /**
   * Sync groups and tasks to GitHub (idempotent operation)
   */
  async syncToGitHub(groups: Group[], dryRun = false): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    if (dryRun) {
      const preview = await this.generateSyncPreview(groups);
      return this.convertPreviewToResults(preview);
    }

    await this.loadExistingData();

    // Process groups
    for (const group of groups) {
      const groupResults = await this.syncGroup(group);
      results.push(...groupResults);

      // Process tasks for this group
      for (const task of group.tasks) {
        const taskResults = await this.syncTask(task, group);
        results.push(...taskResults);
      }
    }

    await this.saveSyncState();
    return results;
  }

  /**
   * Load existing GitHub issues and milestones into cache
   */
  private async loadExistingData(): Promise<void> {
    const { owner, repo } = this.config.repository;

    try {
      await this.loadIssuesIntoCache(owner, repo);
      await this.loadMilestonesIntoCacheIfNeeded(owner, repo);
      await this.saveSyncState();
    } catch (error) {
      throw new Error(
        `Failed to load existing GitHub data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load GitHub issues into cache
   */
  private async loadIssuesIntoCache(owner: string, repo: string): Promise<void> {
    const issues = await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
      owner,
      repo,
      state: "all",
      per_page: 100,
    });

    for (const issue of issues) {
      if (!issue.pull_request) {
        this.cacheIssue(issue);
      }
    }
  }

  /**
   * Convert API issue labels to string array
   */
  private normalizeLabels(labels: Array<string | { name?: string }>): string[] {
    return labels.map((label) => (typeof label === "string" ? label : label.name || ""));
  }

  /**
   * Convert API issue to GitHubIssue format
   */
  private convertToGitHubIssue(issue: {
    number: number;
    title: string;
    body?: string | null;
    state: string;
    labels: Array<string | { name?: string }>;
    milestone?: { number: number; title: string } | null;
    assignee?: { login: string } | null;
  }): GitHubIssue {
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || undefined,
      state: issue.state as "open" | "closed",
      labels: this.normalizeLabels(issue.labels),
      milestone: issue.milestone
        ? { number: issue.milestone.number, title: issue.milestone.title }
        : undefined,
      assignee: issue.assignee ? { login: issue.assignee.login } : undefined,
    };
  }

  /**
   * Cache arbiter ID mapping if present in issue body
   */
  private cacheArbiterIdMapping(body: string | null | undefined, githubIssue: GitHubIssue): void {
    const arbiterIdMatch = body?.match(/<!-- arbiter-id: ([^\s]+) -->/);
    if (arbiterIdMatch) {
      const arbiterId = arbiterIdMatch[1];
      this.issueCache.set(`arbiter:${arbiterId}`, githubIssue);
      this.rememberIssueMapping(arbiterId, githubIssue.number);
    }
  }

  /**
   * Convert API issue to GitHubIssue and cache it
   */
  private cacheIssue(issue: {
    number: number;
    title: string;
    body?: string | null;
    state: string;
    labels: Array<string | { name?: string }>;
    milestone?: { number: number; title: string } | null;
    assignee?: { login: string } | null;
  }): void {
    const githubIssue = this.convertToGitHubIssue(issue);

    this.issueCache.set(issue.title, githubIssue);
    this.issueCache.set(`id:${issue.number}`, githubIssue);
    this.cacheArbiterIdMapping(issue.body, githubIssue);
  }

  /**
   * Load milestones into cache if configured
   */
  private async loadMilestonesIntoCacheIfNeeded(owner: string, repo: string): Promise<void> {
    if (!this.config.automation?.createMilestones) return;

    const milestones = await this.octokit.paginate(this.octokit.rest.issues.listMilestones, {
      owner,
      repo,
      state: "all",
      per_page: 100,
    });

    for (const milestone of milestones) {
      this.cacheMilestone(milestone);
    }
  }

  /**
   * Convert API milestone to GitHubMilestone and cache it
   */
  private cacheMilestone(milestone: {
    number: number;
    title: string;
    state: string;
    description?: string | null;
  }): void {
    const githubMilestone: GitHubMilestone = {
      number: milestone.number,
      title: milestone.title,
      state: milestone.state as "open" | "closed",
      description: milestone.description || undefined,
    };

    this.milestoneCache.set(milestone.title, githubMilestone);
    this.milestoneCache.set(`id:${milestone.number}`, githubMilestone);

    const arbiterIdMatch = milestone.description?.match(/<!-- arbiter-id: ([^\s]+) -->/);
    if (arbiterIdMatch) {
      const arbiterId = arbiterIdMatch[1];
      this.milestoneCache.set(`arbiter:${arbiterId}`, githubMilestone);
      this.rememberMilestoneMapping(arbiterId, githubMilestone.number);
    }
  }

  /**
   * Standard template options for generating GitHub content.
   */
  private get standardTemplateOptions() {
    return {
      includeMetadata: true,
      includeArbiterIds: true,
      includeAcceptanceCriteria: true,
      includeDependencies: true,
      includeEstimations: true,
    };
  }

  /**
   * Sync a single group to GitHub
   */
  private async syncGroup(group: Group): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    try {
      const groupTitle = await this.generateGroupTitle(group);
      const existingIssue = this.findExistingIssue(groupTitle, group.id);

      const issueResult = await this.syncGroupIssue(group, existingIssue, groupTitle);
      results.push(issueResult);

      const closeResult = await this.closeGroupIfNeeded(group, existingIssue);
      if (closeResult) results.push(closeResult);

      if (this.config.automation?.createMilestones) {
        const milestoneResults = await this.syncGroupMilestone(group);
        results.push(...milestoneResults);
      }
    } catch (error) {
      results.push(this.createErrorResult("group", group.id, error));
    }

    return results;
  }

  /**
   * Sync a group's issue (create, update, or skip).
   */
  private async syncGroupIssue(
    group: Group,
    existingIssue: GitHubIssue | undefined,
    groupTitle: string,
  ): Promise<SyncResult> {
    if (!existingIssue) {
      return this.createGroupIssue(group, groupTitle);
    }

    if (await this.shouldUpdateGroup(group, existingIssue)) {
      return this.updateGroupIssue(group, existingIssue);
    }

    return this.skipGroupIssue(group, existingIssue);
  }

  /**
   * Create a new GitHub issue for a group.
   */
  private async createGroupIssue(group: Group, groupTitle: string): Promise<SyncResult> {
    const { owner, repo } = this.config.repository;
    const template = await this.templateManager.generateGroupTemplate(
      group,
      this.standardTemplateOptions,
    );
    const mappedLabels = mapSemanticLabels(this.config, template.labels, "group", group);

    const newIssue = await this.octokit.rest.issues.create({
      owner,
      repo,
      title: template.title,
      body: template.body,
      labels: mappedLabels,
      assignees: this.resolveAssignees(template.assignees),
    });

    this.cacheCreatedIssue(groupTitle, newIssue.data);
    this.rememberIssueMapping(group.id, newIssue.data.number);

    return {
      action: "created",
      type: "group",
      itemId: group.id,
      githubNumber: newIssue.data.number,
      details: `Created GitHub issue #${newIssue.data.number}`,
    };
  }

  /**
   * Update an existing GitHub issue for a group.
   */
  private async updateGroupIssue(group: Group, existingIssue: GitHubIssue): Promise<SyncResult> {
    const { owner, repo } = this.config.repository;
    const template = await this.templateManager.generateGroupTemplate(
      group,
      this.standardTemplateOptions,
    );
    const mappedLabels = mapSemanticLabels(this.config, template.labels, "group", group);

    await this.octokit.rest.issues.update({
      owner,
      repo,
      issue_number: existingIssue.number,
      title: template.title,
      body: template.body,
      labels: mappedLabels,
      assignees: this.resolveAssignees(template.assignees),
    });
    this.rememberIssueMapping(group.id, existingIssue.number);

    return {
      action: "updated",
      type: "group",
      itemId: group.id,
      githubNumber: existingIssue.number,
      details: `Updated GitHub issue #${existingIssue.number}`,
    };
  }

  /**
   * Skip updating a group issue (no changes needed).
   */
  private skipGroupIssue(group: Group, existingIssue: GitHubIssue): SyncResult {
    this.rememberIssueMapping(group.id, existingIssue.number);
    return {
      action: "skipped",
      type: "group",
      itemId: group.id,
      githubNumber: existingIssue.number,
      details: `No changes needed for GitHub issue #${existingIssue.number}`,
    };
  }

  /**
   * Close a group's issue if it's completed/cancelled.
   */
  private async closeGroupIfNeeded(
    group: Group,
    existingIssue: GitHubIssue | undefined,
  ): Promise<SyncResult | null> {
    const shouldClose =
      (group.status === "completed" || group.status === "cancelled") &&
      existingIssue?.state === "open" &&
      this.config.automation?.autoClose;

    if (!shouldClose || !existingIssue) return null;

    const { owner, repo } = this.config.repository;
    await this.octokit.rest.issues.update({
      owner,
      repo,
      issue_number: existingIssue.number,
      state: "closed",
    });

    return {
      action: "closed",
      type: "group",
      itemId: group.id,
      githubNumber: existingIssue.number,
      details: `Closed GitHub issue #${existingIssue.number}`,
    };
  }

  /**
   * Sync a single task to GitHub
   */
  private async syncTask(task: Task, group: Group): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    try {
      const taskTitle = await this.generateTaskTitle(task, group);
      const existingIssue = this.findExistingIssue(taskTitle, task.id);

      const issueResult = await this.syncTaskIssue(task, group, existingIssue);
      results.push(issueResult);

      const closeResult = await this.closeTaskIfNeeded(task, existingIssue);
      if (closeResult) results.push(closeResult);
    } catch (error) {
      results.push(this.createErrorResult("task", task.id, error));
    }

    return results;
  }

  /**
   * Sync a task's issue (create, update, or skip).
   */
  private async syncTaskIssue(
    task: Task,
    group: Group,
    existingIssue: GitHubIssue | undefined,
  ): Promise<SyncResult> {
    if (!existingIssue) {
      return this.createTaskIssue(task, group);
    }

    if (await this.shouldUpdateTask(task, existingIssue, group)) {
      return this.updateTaskIssue(task, group, existingIssue);
    }

    return this.skipTaskIssue(task, existingIssue);
  }

  /**
   * Create a new GitHub issue for a task.
   */
  private async createTaskIssue(task: Task, group: Group): Promise<SyncResult> {
    const { owner, repo } = this.config.repository;
    const template = await this.templateManager.generateTaskTemplate(
      task,
      group,
      this.standardTemplateOptions,
    );
    const milestone = this.findMilestoneForGroup(group);
    const mappedLabels = mapSemanticLabels(this.config, template.labels, "task", task);

    const newIssue = await this.octokit.rest.issues.create({
      owner,
      repo,
      title: template.title,
      body: template.body,
      labels: mappedLabels,
      assignees: this.resolveAssignees(template.assignees),
      milestone: milestone?.number,
    });

    this.rememberIssueMapping(task.id, newIssue.data.number);

    return {
      action: "created",
      type: "task",
      itemId: task.id,
      githubNumber: newIssue.data.number,
      details: `Created GitHub issue #${newIssue.data.number}`,
    };
  }

  /**
   * Update an existing GitHub issue for a task.
   */
  private async updateTaskIssue(
    task: Task,
    group: Group,
    existingIssue: GitHubIssue,
  ): Promise<SyncResult> {
    const { owner, repo } = this.config.repository;
    const template = await this.templateManager.generateTaskTemplate(
      task,
      group,
      this.standardTemplateOptions,
    );
    const milestone = this.findMilestoneForGroup(group);
    const mappedLabels = mapSemanticLabels(this.config, template.labels, "task", task);

    await this.octokit.rest.issues.update({
      owner,
      repo,
      issue_number: existingIssue.number,
      title: template.title,
      body: template.body,
      labels: mappedLabels,
      assignees: this.resolveAssignees(template.assignees),
      milestone: milestone?.number,
    });
    this.rememberIssueMapping(task.id, existingIssue.number);

    return {
      action: "updated",
      type: "task",
      itemId: task.id,
      githubNumber: existingIssue.number,
      details: `Updated GitHub issue #${existingIssue.number}`,
    };
  }

  /**
   * Skip updating a task issue (no changes needed).
   */
  private skipTaskIssue(task: Task, existingIssue: GitHubIssue): SyncResult {
    this.rememberIssueMapping(task.id, existingIssue.number);
    return {
      action: "skipped",
      type: "task",
      itemId: task.id,
      githubNumber: existingIssue.number,
      details: `No changes needed for GitHub issue #${existingIssue.number}`,
    };
  }

  /**
   * Close a task's issue if it's completed/cancelled.
   */
  private async closeTaskIfNeeded(
    task: Task,
    existingIssue: GitHubIssue | undefined,
  ): Promise<SyncResult | null> {
    const shouldClose =
      (task.status === "completed" || task.status === "cancelled") &&
      existingIssue?.state === "open" &&
      this.config.automation?.autoClose;

    if (!shouldClose || !existingIssue) return null;

    const { owner, repo } = this.config.repository;
    await this.octokit.rest.issues.update({
      owner,
      repo,
      issue_number: existingIssue.number,
      state: "closed",
    });

    return {
      action: "closed",
      type: "task",
      itemId: task.id,
      githubNumber: existingIssue.number,
      details: `Closed GitHub issue #${existingIssue.number}`,
    };
  }

  private async createOrUpdateMilestone(
    group: Group,
    milestoneTitle: string,
    existingMilestone: GitHubMilestone | undefined,
  ): Promise<SyncResult | undefined> {
    if (!existingMilestone) {
      return this.createGroupMilestone(group, milestoneTitle);
    }
    if (this.shouldUpdateMilestone(group, existingMilestone)) {
      return this.updateGroupMilestone(group, existingMilestone, milestoneTitle);
    }
    return undefined;
  }

  /**
   * Collect milestone sync results, filtering nulls
   */
  private async collectMilestoneResults(
    group: Group,
    milestoneTitle: string,
    existingMilestone: GitHubMilestone | undefined,
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    const createOrUpdateResult = await this.createOrUpdateMilestone(
      group,
      milestoneTitle,
      existingMilestone,
    );
    if (createOrUpdateResult) results.push(createOrUpdateResult);

    const closeResult = await this.closeMilestoneIfNeeded(group, existingMilestone);
    if (closeResult) results.push(closeResult);

    if (existingMilestone) {
      this.rememberMilestoneMapping(group.id, existingMilestone.number);
    }

    return results;
  }

  /**
   * Sync milestone for an group
   */
  private async syncGroupMilestone(group: Group): Promise<SyncResult[]> {
    try {
      const milestoneTitle = generateMilestoneTitle(group);
      const existingMilestone = this.findExistingMilestone(milestoneTitle, group.id);
      return this.collectMilestoneResults(group, milestoneTitle, existingMilestone);
    } catch (error) {
      return [this.createErrorResult("milestone", group.id, error)];
    }
  }

  /**
   * Create a new GitHub milestone for a group
   */
  private async createGroupMilestone(group: Group, milestoneTitle: string): Promise<SyncResult> {
    const { owner, repo } = this.config.repository;
    const description = generateMilestoneDescription(group);
    const dueDate = group.dueDate ? new Date(group.dueDate).toISOString() : undefined;

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
      state: newMilestone.data.state as "open" | "closed",
      description: newMilestone.data.description || undefined,
    });
    this.rememberMilestoneMapping(group.id, newMilestone.data.number);

    return {
      action: "created",
      type: "milestone",
      itemId: group.id,
      githubNumber: newMilestone.data.number,
      details: `Created GitHub milestone #${newMilestone.data.number}`,
    };
  }

  /**
   * Update an existing GitHub milestone for a group
   */
  private async updateGroupMilestone(
    group: Group,
    existingMilestone: GitHubMilestone,
    milestoneTitle: string,
  ): Promise<SyncResult> {
    const { owner, repo } = this.config.repository;
    const description = generateMilestoneDescription(group);
    const dueDate = group.dueDate ? new Date(group.dueDate).toISOString() : undefined;

    await this.octokit.rest.issues.updateMilestone({
      owner,
      repo,
      milestone_number: existingMilestone.number,
      title: milestoneTitle,
      description,
      due_on: dueDate,
    });
    this.rememberMilestoneMapping(group.id, existingMilestone.number);

    return {
      action: "updated",
      type: "milestone",
      itemId: group.id,
      githubNumber: existingMilestone.number,
      details: `Updated GitHub milestone #${existingMilestone.number}`,
    };
  }

  /**
   * Close milestone if group is completed or cancelled
   */
  private async closeMilestoneIfNeeded(
    group: Group,
    existingMilestone: GitHubMilestone | undefined,
  ): Promise<SyncResult | null> {
    if (!existingMilestone || existingMilestone.state !== "open") {
      return null;
    }

    if (group.status !== "completed" && group.status !== "cancelled") {
      return null;
    }

    const { owner, repo } = this.config.repository;

    await this.octokit.rest.issues.updateMilestone({
      owner,
      repo,
      milestone_number: existingMilestone.number,
      state: "closed",
    });

    return {
      action: "closed",
      type: "milestone",
      itemId: group.id,
      githubNumber: existingMilestone.number,
      details: `Closed GitHub milestone #${existingMilestone.number}`,
    };
  }

  // Helper methods for generating GitHub content (kept for milestone support)

  private async generateGroupTitle(group: Group): Promise<string> {
    const template = await this.templateManager.generateGroupTemplate(group);
    return template.title;
  }

  private async generateTaskTitle(task: Task, group: Group): Promise<string> {
    const template = await this.templateManager.generateTaskTemplate(task, group);
    return template.title;
  }

  // Helper methods for finding existing items

  private findExistingIssue(title: string, arbiterId: string): GitHubIssue | undefined {
    const mappedNumber = this.syncState.issues[arbiterId];
    if (mappedNumber !== undefined) {
      const byNumber = this.issueCache.get(`id:${mappedNumber}`);
      if (byNumber) {
        return byNumber;
      }
    }

    // First try to find by arbiter ID embedded in GitHub body
    const byId = this.issueCache.get(`arbiter:${arbiterId}`);
    if (byId) {
      this.rememberIssueMapping(arbiterId, byId.number);
      return byId;
    }

    // Then try by title
    const byTitle = this.issueCache.get(title);
    if (byTitle) {
      this.rememberIssueMapping(arbiterId, byTitle.number);
    }
    return byTitle;
  }

  private findExistingMilestone(title: string, arbiterId: string): GitHubMilestone | undefined {
    const mappedNumber = this.syncState.milestones[arbiterId];
    if (mappedNumber !== undefined) {
      const byNumber = this.milestoneCache.get(`id:${mappedNumber}`);
      if (byNumber) {
        return byNumber;
      }
    }

    const byId = this.milestoneCache.get(`arbiter:${arbiterId}`);
    if (byId) {
      this.rememberMilestoneMapping(arbiterId, byId.number);
      return byId;
    }

    const byTitle = this.milestoneCache.get(title);
    if (byTitle) {
      this.rememberMilestoneMapping(arbiterId, byTitle.number);
    }
    return byTitle;
  }

  private findMilestoneForGroup(group: Group): GitHubMilestone | undefined {
    if (!this.config.automation?.createMilestones) return undefined;

    const milestoneTitle = generateMilestoneTitle(group);
    return this.findExistingMilestone(milestoneTitle, group.id);
  }

  // Helper methods for determining if updates are needed

  private async shouldUpdateGroup(group: Group, existingIssue: GitHubIssue): Promise<boolean> {
    const template = await this.templateManager.generateGroupTemplate(group, {
      includeMetadata: true,
      includeArbiterIds: true,
      includeAcceptanceCriteria: true,
      includeDependencies: true,
      includeEstimations: true,
    });
    return existingIssue.title !== template.title || existingIssue.body !== template.body;
  }

  private async shouldUpdateTask(
    task: Task,
    existingIssue: GitHubIssue,
    group: Group,
  ): Promise<boolean> {
    const template = await this.templateManager.generateTaskTemplate(task, group, {
      includeMetadata: true,
      includeArbiterIds: true,
      includeAcceptanceCriteria: true,
      includeDependencies: true,
      includeEstimations: true,
    });
    return existingIssue.title !== template.title || existingIssue.body !== template.body;
  }

  private shouldUpdateMilestone(group: Group, existingMilestone: GitHubMilestone): boolean {
    const expectedTitle = generateMilestoneTitle(group);
    const expectedDescription = generateMilestoneDescription(group);

    return (
      existingMilestone.title !== expectedTitle ||
      existingMilestone.description !== expectedDescription
    );
  }

  // Shared helper methods

  /**
   * Resolve assignees based on sync settings.
   */
  private resolveAssignees(assignees: string[] | undefined): string[] | undefined {
    return this.config.automation?.syncAssignees && assignees ? assignees : undefined;
  }

  /**
   * Cache a newly created issue.
   */
  private cacheCreatedIssue(
    title: string,
    issueData: {
      number: number;
      title: string;
      body?: string | null;
      state: string;
      labels: Array<string | { name?: string }>;
    },
  ): void {
    this.issueCache.set(title, {
      number: issueData.number,
      title: issueData.title,
      body: issueData.body || undefined,
      state: issueData.state as "open" | "closed",
      labels: issueData.labels.map((l) => (typeof l === "string" ? l : l.name || "")),
    });
  }

  /**
   * Create an error result for sync operations.
   */
  private createErrorResult(
    type: "group" | "task" | "milestone",
    itemId: string,
    error: unknown,
  ): SyncResult {
    return {
      action: "skipped",
      type,
      itemId,
      details: `Failed to sync ${type}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
