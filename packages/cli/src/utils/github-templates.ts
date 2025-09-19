/**
 * GitHub Templates and Field Management
 *
 * Provides structured templates for GitHub issues and proper field organization
 * instead of just putting everything in the body text.
 *
 * @deprecated Use ConfigurableTemplateManager from github-template-config.ts instead
 */

import {
  ConfigurableTemplateManager,
  DEFAULT_TEMPLATES_CONFIG,
  type GeneratedTemplate,
  type TemplateFiles,
} from './github-template-config.js';
import type { Epic, Task } from './sharded-storage.js';

export interface GitHubEpicTemplate {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  milestone?: number;
  projects?: number[];
}

export interface GitHubTaskTemplate {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  milestone?: number;
  projects?: number[];
}

export interface GitHubTemplateOptions {
  includeMetadata?: boolean;
  includeArbiterIds?: boolean;
  includeAcceptanceCriteria?: boolean;
  includeDependencies?: boolean;
  includeEstimations?: boolean;
  customFields?: Record<string, string>;
}

export interface ValidationRule {
  field: string;
  required: boolean;
  validator?: (value: any) => boolean;
  errorMessage?: string;
}

export interface TemplateValidationConfig {
  epic: ValidationRule[];
  task: ValidationRule[];
  milestone: ValidationRule[];
}

/**
 * Default validation rules for GitHub templates
 */
export const DEFAULT_VALIDATION_CONFIG: TemplateValidationConfig = {
  epic: [
    {
      field: 'name',
      required: true,
      validator: (value: string) => value.length >= 5 && value.length <= 80,
      errorMessage: 'Epic name must be 5-80 characters',
    },
    {
      field: 'description',
      required: true,
      validator: (value: string) => value.length >= 20,
      errorMessage: 'Epic description must be at least 20 characters',
    },
    {
      field: 'priority',
      required: true,
      validator: (value: string) => ['critical', 'high', 'medium', 'low'].includes(value),
      errorMessage: 'Priority must be one of: critical, high, medium, low',
    },
    {
      field: 'owner',
      required: true,
      validator: (value: string) => value.length > 0,
      errorMessage: 'Epic must have an assigned owner',
    },
  ],
  task: [
    {
      field: 'name',
      required: true,
      validator: (value: string) => value.length >= 5 && value.length <= 80,
      errorMessage: 'Task name must be 5-80 characters',
    },
    {
      field: 'description',
      required: true,
      validator: (value: string) => value.length >= 10,
      errorMessage: 'Task description must be at least 10 characters',
    },
    {
      field: 'type',
      required: true,
      validator: (value: string) =>
        ['feature', 'bug', 'refactor', 'test', 'docs', 'devops', 'research'].includes(value),
      errorMessage:
        'Task type must be one of: feature, bug, refactor, test, docs, devops, research',
    },
    {
      field: 'acceptanceCriteria',
      required: true,
      validator: (value: string[]) => Array.isArray(value) && value.length > 0,
      errorMessage: 'Task must have at least one acceptance criterion',
    },
  ],
  milestone: [
    {
      field: 'name',
      required: true,
      validator: (value: string) => value.length >= 5 && value.length <= 80,
      errorMessage: 'Milestone name must be 5-80 characters',
    },
  ],
};

export class GitHubTemplateManager {
  private validationConfig: TemplateValidationConfig;

  constructor(validationConfig: TemplateValidationConfig = DEFAULT_VALIDATION_CONFIG) {
    this.validationConfig = validationConfig;
  }

  /**
   * Generate epic template with proper structured fields
   */
  generateEpicTemplate(epic: Epic, options: GitHubTemplateOptions = {}): GitHubEpicTemplate {
    // Validate epic before generating template
    this.validateEpic(epic);

    const title = this.generateEpicTitle(epic);
    const body = this.generateEpicBody(epic, options);
    const labels = this.generateEpicLabels(epic);
    const assignees = this.generateEpicAssignees(epic);

    return {
      title,
      body,
      labels,
      assignees,
    };
  }

  /**
   * Generate task template with proper structured fields
   */
  generateTaskTemplate(
    task: Task,
    epic: Epic,
    options: GitHubTemplateOptions = {}
  ): GitHubTaskTemplate {
    // Validate task before generating template
    this.validateTask(task);

    const title = this.generateTaskTitle(task, epic);
    const body = this.generateTaskBody(task, epic, options);
    const labels = this.generateTaskLabels(task, epic);
    const assignees = this.generateTaskAssignees(task);

    return {
      title,
      body,
      labels,
      assignees,
    };
  }

  /**
   * Validate epic against configured rules
   */
  validateEpic(epic: Epic): void {
    const errors: string[] = [];

    for (const rule of this.validationConfig.epic) {
      const value = (epic as any)[rule.field];

      if (rule.required && (!value || (Array.isArray(value) && value.length === 0))) {
        errors.push(rule.errorMessage || `${rule.field} is required`);
        continue;
      }

      if (value && rule.validator && !rule.validator(value)) {
        errors.push(rule.errorMessage || `${rule.field} is invalid`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Epic validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
    }
  }

  /**
   * Validate task against configured rules
   */
  validateTask(task: Task): void {
    const errors: string[] = [];

    for (const rule of this.validationConfig.task) {
      const value = (task as any)[rule.field];

      if (rule.required && (!value || (Array.isArray(value) && value.length === 0))) {
        errors.push(rule.errorMessage || `${rule.field} is required`);
        continue;
      }

      if (value && rule.validator && !rule.validator(value)) {
        errors.push(rule.errorMessage || `${rule.field} is invalid`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Task validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
    }
  }

  /**
   * Generate properly structured epic title
   */
  private generateEpicTitle(epic: Epic): string {
    const prefix = '[EPIC]';
    const priority = epic.priority?.toUpperCase() || 'MEDIUM';
    return `${prefix} ${priority}: ${epic.name}`;
  }

  /**
   * Generate properly structured task title
   */
  private generateTaskTitle(task: Task, epic: Epic): string {
    const prefix = `[${task.type?.toUpperCase() || 'TASK'}]`;
    const priority = task.priority?.toUpperCase() || 'MEDIUM';
    return `${prefix} ${priority}: ${task.name}`;
  }

  /**
   * Generate structured epic body using GitHub's field formatting
   */
  private generateEpicBody(epic: Epic, options: GitHubTemplateOptions): string {
    let body = '';

    // Add hidden Arbiter ID for tracking
    if (options.includeArbiterIds !== false) {
      body += `<!-- arbiter-id: ${epic.id} -->\n<!-- arbiter-type: epic -->\n\n`;
    }

    // Description section
    body += `## 📋 Description\n\n${epic.description || 'No description provided'}\n\n`;

    // Epic Details section
    body += '## 📊 Epic Details\n\n';
    body += '| Field | Value |\n';
    body += '|-------|-------|\n';
    body += `| **Priority** | \`${epic.priority}\` |\n`;
    body += `| **Status** | \`${epic.status}\` |\n`;
    body += `| **Owner** | ${epic.owner ? `@${epic.owner}` : 'Unassigned'} |\n`;
    body += `| **Assignee** | ${epic.assignee ? `@${epic.assignee}` : 'Unassigned'} |\n`;

    if (options.includeEstimations !== false) {
      if (epic.estimatedHours) {
        body += `| **Estimated Hours** | ${epic.estimatedHours}h |\n`;
      }
      if (epic.actualHours) {
        body += `| **Actual Hours** | ${epic.actualHours}h |\n`;
      }
    }

    if (epic.startDate) {
      body += `| **Start Date** | ${epic.startDate} |\n`;
    }
    if (epic.dueDate) {
      body += `| **Due Date** | ${epic.dueDate} |\n`;
    }

    body += '\n';

    // Tasks Overview section
    if (epic.tasks.length > 0) {
      body += '## ✅ Tasks Overview\n\n';
      body += `**Total Tasks:** ${epic.tasks.length}\n\n`;

      const tasksByStatus = epic.tasks.reduce(
        (acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      body += '**Status Breakdown:**\n';
      Object.entries(tasksByStatus).forEach(([status, count]) => {
        const emoji = this.getStatusEmoji(status);
        body += `- ${emoji} ${status}: ${count} tasks\n`;
      });
      body += '\n';
    }

    // Dependencies section
    if (
      options.includeDependencies !== false &&
      epic.dependencies &&
      epic.dependencies.length > 0
    ) {
      body += '## 🔗 Dependencies\n\n';
      epic.dependencies.forEach(dep => {
        body += `- [ ] ${dep}\n`;
      });
      body += '\n';
    }

    // Labels and Tags section
    if (epic.labels && epic.labels.length > 0) {
      body += '## 🏷️ Labels\n\n';
      epic.labels.forEach(label => {
        body += `\`${label}\` `;
      });
      body += '\n\n';
    }

    // Custom fields
    if (options.customFields && Object.keys(options.customFields).length > 0) {
      body += '## 🔧 Additional Information\n\n';
      Object.entries(options.customFields).forEach(([key, value]) => {
        body += `**${key}:** ${value}\n`;
      });
      body += '\n';
    }

    return body.trim();
  }

  /**
   * Generate structured task body using GitHub's field formatting
   */
  private generateTaskBody(task: Task, epic: Epic, options: GitHubTemplateOptions): string {
    let body = '';

    // Add hidden Arbiter ID for tracking
    if (options.includeArbiterIds !== false) {
      body += `<!-- arbiter-id: ${task.id} -->\n<!-- arbiter-type: task -->\n`;
      body += `<!-- arbiter-epic-id: ${epic.id} -->\n\n`;
    }

    // Description section
    body += `## 📋 Description\n\n${task.description || 'No description provided'}\n\n`;

    // Task Details section
    body += '## 📊 Task Details\n\n';
    body += '| Field | Value |\n';
    body += '|-------|-------|\n';
    body += `| **Epic** | [${epic.name}](../issues) |\n`;
    body += `| **Type** | \`${task.type}\` |\n`;
    body += `| **Priority** | \`${task.priority}\` |\n`;
    body += `| **Status** | \`${task.status}\` |\n`;
    body += `| **Assignee** | ${task.assignee ? `@${task.assignee}` : 'Unassigned'} |\n`;
    body += `| **Reviewer** | ${task.reviewer ? `@${task.reviewer}` : 'TBD'} |\n`;

    if (options.includeEstimations !== false) {
      if (task.estimatedHours) {
        body += `| **Estimated Hours** | ${task.estimatedHours}h |\n`;
      }
      if (task.actualHours) {
        body += `| **Actual Hours** | ${task.actualHours}h |\n`;
      }
    }

    body += '\n';

    // Acceptance Criteria section
    if (
      options.includeAcceptanceCriteria !== false &&
      task.acceptanceCriteria &&
      task.acceptanceCriteria.length > 0
    ) {
      body += '## ✅ Acceptance Criteria\n\n';
      task.acceptanceCriteria.forEach((criteria, index) => {
        body += `${index + 1}. [ ] ${criteria}\n`;
      });
      body += '\n';
    }

    // Dependencies section
    if (options.includeDependencies !== false && task.dependsOn && task.dependsOn.length > 0) {
      body += '## 🔗 Dependencies\n\n';
      body += 'This task depends on the following:\n\n';
      task.dependsOn.forEach(dep => {
        body += `- [ ] ${dep}\n`;
      });
      body += '\n';
    }

    // Configuration section
    if (task.config) {
      body += '## ⚙️ Configuration\n\n';
      if (task.config.canRunInParallel) {
        body += '- ✅ Can run in parallel with other tasks\n';
      }
      if (task.config.requiresReview) {
        body += '- 👀 Requires code review before completion\n';
      }
      if (task.config.requiresTesting) {
        body += '- 🧪 Requires testing before completion\n';
      }
      if (task.config.blocksOtherTasks) {
        body += '- 🚧 Blocks other tasks until completed\n';
      }
      body += '\n';
    }

    // Custom fields
    if (options.customFields && Object.keys(options.customFields).length > 0) {
      body += '## 🔧 Additional Information\n\n';
      Object.entries(options.customFields).forEach(([key, value]) => {
        body += `**${key}:** ${value}\n`;
      });
      body += '\n';
    }

    return body.trim();
  }

  /**
   * Generate epic labels with proper categorization
   */
  private generateEpicLabels(epic: Epic): string[] {
    const labels: string[] = [];

    // Type label
    labels.push('epic');

    // Priority label
    labels.push(`priority:${epic.priority}`);

    // Status label
    labels.push(`status:${epic.status}`);

    // Custom labels from epic
    if (epic.labels && epic.labels.length > 0) {
      labels.push(...epic.labels);
    }

    return [...new Set(labels)]; // Remove duplicates
  }

  /**
   * Generate task labels with proper categorization
   */
  private generateTaskLabels(task: Task, epic: Epic): string[] {
    const labels: string[] = [];

    // Type label
    labels.push(`type:${task.type}`);

    // Priority label
    labels.push(`priority:${task.priority}`);

    // Status label
    labels.push(`status:${task.status}`);

    // Epic reference
    labels.push(`epic:${epic.id}`);

    // Configuration-based labels
    if (task.config?.requiresReview) {
      labels.push('needs-review');
    }
    if (task.config?.requiresTesting) {
      labels.push('needs-testing');
    }
    if (task.config?.canRunInParallel) {
      labels.push('parallel-safe');
    }

    return [...new Set(labels)]; // Remove duplicates
  }

  /**
   * Generate epic assignees
   */
  private generateEpicAssignees(epic: Epic): string[] | undefined {
    const assignees: string[] = [];

    if (epic.assignee) {
      assignees.push(epic.assignee);
    }
    if (epic.owner && epic.owner !== epic.assignee) {
      assignees.push(epic.owner);
    }

    return assignees.length > 0 ? assignees : undefined;
  }

  /**
   * Generate task assignees
   */
  private generateTaskAssignees(task: Task): string[] | undefined {
    const assignees: string[] = [];

    if (task.assignee) {
      assignees.push(task.assignee);
    }

    return assignees.length > 0 ? assignees : undefined;
  }

  /**
   * Get status emoji for display
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      todo: '📋',
      planning: '📋',
      in_progress: '🚧',
      review: '👀',
      testing: '🧪',
      completed: '✅',
      cancelled: '❌',
    };
    return emojis[status] || '❓';
  }
}

/**
 * Create GitHub issue template files for repositories
 * @deprecated Use ConfigurableTemplateManager.generateRepositoryTemplates() instead
 */
export function generateGitHubIssueTemplates(): Record<string, string> {
  const manager = new ConfigurableTemplateManager();
  return manager.generateRepositoryTemplates();
}

/**
 * Generate repository configuration for GitHub templates
 * @deprecated Use ConfigurableTemplateManager.generateRepositoryTemplates() instead
 */
export function generateGitHubConfiguration(): Record<string, string> {
  const manager = new ConfigurableTemplateManager();
  const allFiles = manager.generateRepositoryTemplates();

  // Return only configuration files (not template files)
  const configFiles: Record<string, string> = {};
  Object.entries(allFiles).forEach(([path, content]) => {
    if (path.includes('config.yml') || path.includes('labels.yml')) {
      configFiles[path] = content;
    }
  });

  return configFiles;
}
