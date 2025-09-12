import { Octokit } from "@octokit/rest";
import type { Epic, Task } from "./sharded-storage.js";
import type { GitHubSyncConfig } from "../types.js";
import chalk from "chalk";

export interface GitHubIssue {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  labels: string[];
  milestone?: {
    number: number;
    title: string;
  };
  assignee?: {
    login: string;
  };
}

export interface GitHubMilestone {
  number: number;
  title: string;
  state: "open" | "closed";
  description?: string;
}

export interface SyncResult {
  action: "created" | "updated" | "skipped" | "closed";
  type: "epic" | "task" | "milestone";
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
  private issueCache: Map<string, GitHubIssue> = new Map();
  private milestoneCache: Map<string, GitHubMilestone> = new Map();

  constructor(config: GitHubSyncConfig) {
    this.config = config;
    
    // Get GitHub token from configured environment variable
    const tokenEnvName = config.repository.tokenEnv || "GITHUB_TOKEN";
    const token = process.env[tokenEnvName] || process.env.GITHUB_TOKEN || process.env.ARBITER_GITHUB_TOKEN;
    
    if (!token) {
      const envVarMessage = tokenEnvName !== "GITHUB_TOKEN" 
        ? `${tokenEnvName} (or GITHUB_TOKEN as fallback)` 
        : "GITHUB_TOKEN";
        
      throw new Error(
        `GitHub token not found. Set the ${envVarMessage} environment variable.\n` +
        "To create a token:\n" +
        "1. Go to https://github.com/settings/tokens\n" +
        "2. Generate a new token with 'repo' scope\n" +
        `3. Set ${tokenEnvName}=your_token_here in your environment`
      );
    }
    
    this.octokit = new Octokit({
      auth: token,
      baseUrl: config.repository.baseUrl || "https://api.github.com",
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
      const epicTitle = this.generateEpicTitle(epic);
      const existingIssue = this.findExistingIssue(epicTitle, epic.id);

      if (!existingIssue) {
        preview.epics.create.push(epic);
      } else if (this.shouldUpdateEpic(epic, existingIssue)) {
        preview.epics.update.push({ epic, existing: existingIssue });
      }

      if (epic.status === "completed" || epic.status === "cancelled") {
        if (existingIssue && existingIssue.state === "open") {
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

        if (epic.status === "completed" || epic.status === "cancelled") {
          if (existingMilestone && existingMilestone.state === "open") {
            preview.milestones.close.push({ epic, existing: existingMilestone });
          }
        }
      }

      // Process tasks for this epic
      for (const task of epic.tasks) {
        const taskTitle = this.generateTaskTitle(task, epic);
        const existingTaskIssue = this.findExistingIssue(taskTitle, task.id);

        if (!existingTaskIssue) {
          preview.tasks.create.push(task);
        } else if (this.shouldUpdateTask(task, existingTaskIssue)) {
          preview.tasks.update.push({ task, existing: existingTaskIssue });
        }

        if (task.status === "completed" || task.status === "cancelled") {
          if (existingTaskIssue && existingTaskIssue.state === "open") {
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
  async syncToGitHub(epics: Epic[], dryRun: boolean = false): Promise<SyncResult[]> {
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
        state: "all",
        per_page: 100,
      });

      for (const issue of issues) {
        if (!issue.pull_request) { // Exclude PRs
          const githubIssue: GitHubIssue = {
            number: issue.number,
            title: issue.title,
            body: issue.body || undefined,
            state: issue.state as "open" | "closed",
            labels: issue.labels.map(label => typeof label === "string" ? label : label.name || ""),
            milestone: issue.milestone ? {
              number: issue.milestone.number,
              title: issue.milestone.title,
            } : undefined,
            assignee: issue.assignee ? {
              login: issue.assignee.login,
            } : undefined,
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
          state: "all",
          per_page: 100,
        });

        for (const milestone of milestones) {
          const githubMilestone: GitHubMilestone = {
            number: milestone.number,
            title: milestone.title,
            state: milestone.state as "open" | "closed",
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
      throw new Error(`Failed to load existing GitHub data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sync a single epic to GitHub
   */
  private async syncEpic(epic: Epic): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const { owner, repo } = this.config.repository;

    try {
      const epicTitle = this.generateEpicTitle(epic);
      const existingIssue = this.findExistingIssue(epicTitle, epic.id);

      if (!existingIssue) {
        // Create new epic issue
        const labels = this.generateEpicLabels(epic);
        const body = this.generateEpicBody(epic);

        const newIssue = await this.octokit.rest.issues.create({
          owner,
          repo,
          title: epicTitle,
          body,
          labels,
          assignee: this.config.behavior?.syncAssignees ? epic.assignee : undefined,
        });

        this.issueCache.set(epicTitle, {
          number: newIssue.data.number,
          title: newIssue.data.title,
          body: newIssue.data.body || undefined,
          state: newIssue.data.state as "open" | "closed",
          labels: newIssue.data.labels.map(l => typeof l === "string" ? l : l.name || ""),
        });

        results.push({
          action: "created",
          type: "epic",
          itemId: epic.id,
          githubNumber: newIssue.data.number,
          details: `Created GitHub issue #${newIssue.data.number}`,
        });
      } else if (this.shouldUpdateEpic(epic, existingIssue)) {
        // Update existing epic issue
        const labels = this.generateEpicLabels(epic);
        const body = this.generateEpicBody(epic);

        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          title: epicTitle,
          body,
          labels,
          assignee: this.config.behavior?.syncAssignees ? epic.assignee : undefined,
        });

        results.push({
          action: "updated",
          type: "epic",
          itemId: epic.id,
          githubNumber: existingIssue.number,
          details: `Updated GitHub issue #${existingIssue.number}`,
        });
      } else {
        results.push({
          action: "skipped",
          type: "epic",
          itemId: epic.id,
          githubNumber: existingIssue.number,
          details: `No changes needed for GitHub issue #${existingIssue.number}`,
        });
      }

      // Handle epic completion/cancellation
      if ((epic.status === "completed" || epic.status === "cancelled") && 
          existingIssue && existingIssue.state === "open" && 
          this.config.behavior?.autoClose) {
        
        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          state: "closed",
        });

        results.push({
          action: "closed",
          type: "epic",
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
        action: "skipped",
        type: "epic",
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
      const taskTitle = this.generateTaskTitle(task, epic);
      const existingIssue = this.findExistingIssue(taskTitle, task.id);

      if (!existingIssue) {
        // Create new task issue
        const labels = this.generateTaskLabels(task);
        const body = this.generateTaskBody(task, epic);
        const milestone = this.findMilestoneForEpic(epic);

        const newIssue = await this.octokit.rest.issues.create({
          owner,
          repo,
          title: taskTitle,
          body,
          labels,
          assignee: this.config.behavior?.syncAssignees ? task.assignee : undefined,
          milestone: milestone?.number,
        });

        results.push({
          action: "created",
          type: "task",
          itemId: task.id,
          githubNumber: newIssue.data.number,
          details: `Created GitHub issue #${newIssue.data.number}`,
        });
      } else if (this.shouldUpdateTask(task, existingIssue)) {
        // Update existing task issue
        const labels = this.generateTaskLabels(task);
        const body = this.generateTaskBody(task, epic);
        const milestone = this.findMilestoneForEpic(epic);

        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          title: taskTitle,
          body,
          labels,
          assignee: this.config.behavior?.syncAssignees ? task.assignee : undefined,
          milestone: milestone?.number,
        });

        results.push({
          action: "updated",
          type: "task",
          itemId: task.id,
          githubNumber: existingIssue.number,
          details: `Updated GitHub issue #${existingIssue.number}`,
        });
      } else {
        results.push({
          action: "skipped",
          type: "task",
          itemId: task.id,
          githubNumber: existingIssue.number,
          details: `No changes needed for GitHub issue #${existingIssue.number}`,
        });
      }

      // Handle task completion/cancellation
      if ((task.status === "completed" || task.status === "cancelled") && 
          existingIssue && existingIssue.state === "open" && 
          this.config.behavior?.autoClose) {
        
        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          state: "closed",
        });

        results.push({
          action: "closed",
          type: "task",
          itemId: task.id,
          githubNumber: existingIssue.number,
          details: `Closed GitHub issue #${existingIssue.number}`,
        });
      }
    } catch (error) {
      results.push({
        action: "skipped",
        type: "task",
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
          state: newMilestone.data.state as "open" | "closed",
          description: newMilestone.data.description || undefined,
        });

        results.push({
          action: "created",
          type: "milestone",
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
          action: "updated",
          type: "milestone",
          itemId: epic.id,
          githubNumber: existingMilestone.number,
          details: `Updated GitHub milestone #${existingMilestone.number}`,
        });
      }

      // Handle milestone completion
      if ((epic.status === "completed" || epic.status === "cancelled") && 
          existingMilestone && existingMilestone.state === "open") {
        
        await this.octokit.rest.issues.updateMilestone({
          owner,
          repo,
          milestone_number: existingMilestone.number,
          state: "closed",
        });

        results.push({
          action: "closed",
          type: "milestone",
          itemId: epic.id,
          githubNumber: existingMilestone.number,
          details: `Closed GitHub milestone #${existingMilestone.number}`,
        });
      }
    } catch (error) {
      results.push({
        action: "skipped",
        type: "milestone",
        itemId: epic.id,
        details: `Failed to sync milestone: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return results;
  }

  // Helper methods for generating GitHub content

  private generateEpicTitle(epic: Epic): string {
    const prefix = this.config.mapping?.epicPrefix || "[Epic]";
    return `${prefix} ${epic.name}`;
  }

  private generateTaskTitle(task: Task, epic: Epic): string {
    const prefix = this.config.mapping?.taskPrefix || "[Task]";
    return `${prefix} ${task.name}`;
  }

  private generateMilestoneTitle(epic: Epic): string {
    return `Epic: ${epic.name}`;
  }

  private generateEpicBody(epic: Epic): string {
    let body = `<!-- arbiter-id: ${epic.id} -->\n\n`;
    
    if (epic.description) {
      body += `${epic.description}\n\n`;
    }

    body += `**Status:** ${epic.status}\n`;
    body += `**Priority:** ${epic.priority}\n`;
    
    if (epic.owner) {
      body += `**Owner:** ${epic.owner}\n`;
    }
    
    if (epic.estimatedHours) {
      body += `**Estimated Hours:** ${epic.estimatedHours}\n`;
    }
    
    if (epic.dueDate) {
      body += `**Due Date:** ${epic.dueDate}\n`;
    }

    if (epic.tasks.length > 0) {
      body += `\n**Tasks:** ${epic.tasks.length} tasks\n`;
    }

    if (epic.labels && epic.labels.length > 0) {
      body += `\n**Labels:** ${epic.labels.join(", ")}\n`;
    }

    return body;
  }

  private generateTaskBody(task: Task, epic: Epic): string {
    let body = `<!-- arbiter-id: ${task.id} -->\n\n`;
    
    if (task.description) {
      body += `${task.description}\n\n`;
    }

    body += `**Epic:** ${epic.name}\n`;
    body += `**Type:** ${task.type}\n`;
    body += `**Status:** ${task.status}\n`;
    body += `**Priority:** ${task.priority}\n`;
    
    if (task.estimatedHours) {
      body += `**Estimated Hours:** ${task.estimatedHours}\n`;
    }

    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && this.config.behavior?.syncAcceptanceCriteria) {
      body += `\n**Acceptance Criteria:**\n`;
      for (const criteria of task.acceptanceCriteria) {
        body += `- ${criteria}\n`;
      }
    }

    if (task.dependsOn && task.dependsOn.length > 0) {
      body += `\n**Dependencies:** ${task.dependsOn.join(", ")}\n`;
    }

    return body;
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

  private generateEpicLabels(epic: Epic): string[] {
    const labels: string[] = [];
    
    // Only add labels explicitly specified in the epic spec
    if (epic.labels) {
      labels.push(...epic.labels);
    }

    return [...new Set(labels)]; // Remove duplicates
  }

  private generateTaskLabels(task: Task): string[] {
    const labels: string[] = [];
    
    // Only add labels explicitly specified in the task spec
    if (task.labels) {
      labels.push(...task.labels);
    }

    // Exception: Add "test" label for test tasks (user found this useful)
    if (task.type === "test") {
      labels.push("test");
    }

    return [...new Set(labels)]; // Remove duplicates
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

  private shouldUpdateEpic(epic: Epic, existingIssue: GitHubIssue): boolean {
    const expectedTitle = this.generateEpicTitle(epic);
    const expectedBody = this.generateEpicBody(epic);
    
    return existingIssue.title !== expectedTitle || 
           existingIssue.body !== expectedBody;
  }

  private shouldUpdateTask(task: Task, existingIssue: GitHubIssue): boolean {
    const expectedTitle = this.generateTaskTitle(task, {} as Epic); // We don't have epic context here
    const expectedBody = this.generateTaskBody(task, {} as Epic);
    
    return existingIssue.title !== expectedTitle || 
           existingIssue.body !== expectedBody;
  }

  private shouldUpdateMilestone(epic: Epic, existingMilestone: GitHubMilestone): boolean {
    const expectedTitle = this.generateMilestoneTitle(epic);
    const expectedDescription = this.generateMilestoneDescription(epic);
    
    return existingMilestone.title !== expectedTitle || 
           existingMilestone.description !== expectedDescription;
  }

  // Helper method to convert preview to results format
  private convertPreviewToResults(preview: SyncPreview): SyncResult[] {
    const results: SyncResult[] = [];

    // Process epics
    preview.epics.create.forEach(epic => {
      results.push({
        action: "created",
        type: "epic",
        itemId: epic.id,
        details: `Would create epic: ${epic.name}`,
      });
    });

    preview.epics.update.forEach(({ epic }) => {
      results.push({
        action: "updated",
        type: "epic",
        itemId: epic.id,
        details: `Would update epic: ${epic.name}`,
      });
    });

    preview.epics.close.forEach(({ epic }) => {
      results.push({
        action: "closed",
        type: "epic",
        itemId: epic.id,
        details: `Would close epic: ${epic.name}`,
      });
    });

    // Process tasks
    preview.tasks.create.forEach(task => {
      results.push({
        action: "created",
        type: "task",
        itemId: task.id,
        details: `Would create task: ${task.name}`,
      });
    });

    preview.tasks.update.forEach(({ task }) => {
      results.push({
        action: "updated",
        type: "task",
        itemId: task.id,
        details: `Would update task: ${task.name}`,
      });
    });

    preview.tasks.close.forEach(({ task }) => {
      results.push({
        action: "closed",
        type: "task",
        itemId: task.id,
        details: `Would close task: ${task.name}`,
      });
    });

    // Process milestones
    preview.milestones.create.forEach(epic => {
      results.push({
        action: "created",
        type: "milestone",
        itemId: epic.id,
        details: `Would create milestone: ${epic.name}`,
      });
    });

    preview.milestones.update.forEach(({ epic }) => {
      results.push({
        action: "updated",
        type: "milestone",
        itemId: epic.id,
        details: `Would update milestone: ${epic.name}`,
      });
    });

    preview.milestones.close.forEach(({ epic }) => {
      results.push({
        action: "closed",
        type: "milestone",
        itemId: epic.id,
        details: `Would close milestone: ${epic.name}`,
      });
    });

    return results;
  }
}