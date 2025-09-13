/**
 * Configuration-based GitHub Template System
 * 
 * This module provides a flexible, configuration-driven approach to GitHub templates
 * that supports inheritance, customization, and dynamic generation.
 */

import type { Epic, Task } from "./sharded-storage.js";
import type {
  GitHubTemplatesConfig,
  GitHubTemplateConfig,
  GitHubTemplateSet,
  GitHubTemplateSections,
  GitHubFieldValidation,
  GitHubTemplateOptions,
  GitHubLabel
} from "../types.js";

export interface GeneratedTemplate {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  milestone?: number;
  projects?: number[];
}

export interface TemplateFiles {
  [filePath: string]: string;
}

/**
 * Default template configuration for backward compatibility
 */
export const DEFAULT_TEMPLATES_CONFIG: GitHubTemplatesConfig = {
  base: {
    name: "arbiter-default",
    description: "Default Arbiter template set",
    sections: {
      description: "## 📋 Description\n\n{{description}}\n\n",
      details: [
        { name: "priority", label: "Priority", required: true, type: "select" },
        { name: "status", label: "Status", required: true, type: "select" },
        { name: "assignee", label: "Assignee", type: "text" },
        { name: "estimatedHours", label: "Estimated Hours", type: "number" }
      ],
      acceptanceCriteria: "## ✅ Acceptance Criteria\n\n{{#each acceptanceCriteria}}\n- [ ] {{this}}\n{{/each}}\n\n",
      dependencies: "## 🔗 Dependencies\n\n{{#each dependencies}}\n- [ ] {{this}}\n{{/each}}\n\n"
    },
    labels: ["arbiter-managed"],
    validation: {
      fields: [
        {
          field: "name",
          required: true,
          minLength: 5,
          maxLength: 80,
          errorMessage: "Name must be 5-80 characters"
        },
        {
          field: "description",
          required: true,
          minLength: 10,
          errorMessage: "Description must be at least 10 characters"
        }
      ]
    }
  },
  epic: {
    inherits: "arbiter-default",
    name: "Epic",
    title: "[EPIC] {{priority}}: {{name}}",
    labels: ["epic", "priority:{{priority}}", "status:{{status}}"],
    sections: {
      description: "## 📋 Epic Description\n\n**Summary:** {{description}}\n\n**Success Criteria:** {{successCriteria}}\n\n",
      additional: {
        "scope": "## 🎯 Scope\n\n**In Scope:**\n{{#each inScope}}\n- {{this}}\n{{/each}}\n\n**Out of Scope:**\n{{#each outOfScope}}\n- {{this}}\n{{/each}}\n\n",
        "tasks": "## ✅ Tasks Overview\n\n**Total Tasks:** {{tasks.length}}\n\n{{#each tasks}}\n- [ ] {{this.name}} ({{this.status}})\n{{/each}}\n\n"
      }
    },
    validation: {
      fields: [
        {
          field: "priority",
          required: true,
          enum: ["critical", "high", "medium", "low"],
          errorMessage: "Priority must be one of: critical, high, medium, low"
        },
        {
          field: "owner",
          required: true,
          errorMessage: "Epic must have an assigned owner"
        }
      ]
    }
  },
  task: {
    inherits: "arbiter-default",
    name: "Task",
    title: "[{{type}}] {{priority}}: {{name}}",
    labels: ["type:{{type}}", "priority:{{priority}}", "status:{{status}}", "epic:{{epicId}}"],
    sections: {
      description: "## 📋 Task Description\n\n**Summary:** {{description}}\n\n**Context:** {{context}}\n\n",
      additional: {
        "implementation": "## 📝 Implementation Notes\n\n{{implementationNotes}}\n\n",
        "testing": "## 🧪 Testing Requirements\n\n- [ ] Unit tests added/updated\n- [ ] Integration tests added/updated\n- [ ] Manual testing completed\n- [ ] Documentation updated\n\n"
      }
    },
    validation: {
      fields: [
        {
          field: "type",
          required: true,
          enum: ["feature", "bug", "refactor", "test", "docs", "devops", "research"],
          errorMessage: "Task type must be one of: feature, bug, refactor, test, docs, devops, research"
        },
        {
          field: "acceptanceCriteria",
          required: true,
          errorMessage: "Task must have at least one acceptance criterion"
        }
      ]
    }
  },
  bugReport: {
    name: "Bug Report",
    title: "[BUG] {{priority}}: {{title}}",
    labels: ["type:bug", "priority:{{priority}}"],
    sections: {
      description: "## 🐛 Bug Description\n\n**Summary:** {{summary}}\n\n**Expected Behavior:** {{expectedBehavior}}\n\n**Actual Behavior:** {{actualBehavior}}\n\n",
      additional: {
        "reproduction": "## 🔄 Steps to Reproduce\n\n{{#each steps}}\n{{@index}. {{this}}\n{{/each}}\n\n",
        "environment": "## 🌍 Environment\n\n- **OS:** {{os}}\n- **Browser:** {{browser}}\n- **Version:** {{version}}\n\n",
        "impact": "## 📊 Impact Assessment\n\n- **Priority:** {{priority}}\n- **Affected Users:** {{affectedUsers}}\n- **Workaround Available:** {{workaround}}\n\n"
      }
    }
  },
  featureRequest: {
    name: "Feature Request",
    title: "[FEATURE] {{title}}",
    labels: ["type:feature", "priority:{{priority}}"],
    sections: {
      description: "## 💡 Feature Description\n\n**Summary:** {{summary}}\n\n**Problem Statement:** {{problemStatement}}\n\n**Proposed Solution:** {{proposedSolution}}\n\n",
      additional: {
        "useCases": "## 🎯 Use Cases\n\n{{#each useCases}}\n{{@index}}. **As a {{userType}}, I want {{goal}} so that {{benefit}}**\n{{/each}}\n\n",
        "alternatives": "## 🔄 Alternatives Considered\n\n{{alternatives}}\n\n",
        "impact": "## 📊 Impact Assessment\n\n- **Priority:** {{priority}}\n- **Effort Estimate:** {{effortEstimate}}\n- **Potential Users:** {{potentialUsers}}\n\n"
      }
    }
  },
  repositoryConfig: {
    issueConfig: {
      blankIssuesEnabled: false,
      contactLinks: [
        {
          name: "📚 Documentation",
          url: "https://github.com/{{owner}}/{{repo}}/wiki",
          about: "Check our documentation for common questions"
        },
        {
          name: "💬 Discussions",
          url: "https://github.com/{{owner}}/{{repo}}/discussions",
          about: "Ask questions and discuss with the community"
        }
      ]
    },
    labels: [
      // Type labels
      { name: "type:feature", color: "0e8a16", description: "New feature or enhancement" },
      { name: "type:bug", color: "d73a49", description: "Something is not working" },
      { name: "type:refactor", color: "fbca04", description: "Code improvement without new features" },
      { name: "type:test", color: "c5def5", description: "Testing related changes" },
      { name: "type:docs", color: "0052cc", description: "Documentation improvements" },
      { name: "type:devops", color: "5319e7", description: "DevOps and infrastructure changes" },
      { name: "type:research", color: "d4c5f9", description: "Research and exploration task" },
      
      // Priority labels
      { name: "priority:critical", color: "b60205", description: "Critical priority - must be addressed immediately" },
      { name: "priority:high", color: "ff9500", description: "High priority - should be addressed soon" },
      { name: "priority:medium", color: "fbca04", description: "Medium priority - normal timeline" },
      { name: "priority:low", color: "0e8a16", description: "Low priority - can wait" },
      
      // Status labels
      { name: "status:planning", color: "f0f0f0", description: "In planning phase" },
      { name: "status:in_progress", color: "0052cc", description: "Currently being worked on" },
      { name: "status:review", color: "fbca04", description: "In review" },
      { name: "status:testing", color: "c5def5", description: "In testing phase" },
      { name: "status:completed", color: "0e8a16", description: "Completed" },
      { name: "status:cancelled", color: "d93f0b", description: "Cancelled" },
      
      // Special labels
      { name: "epic", color: "5319e7", description: "Large feature epic" },
      { name: "needs-review", color: "fbca04", description: "Requires code review" },
      { name: "needs-testing", color: "c5def5", description: "Requires testing" },
      { name: "parallel-safe", color: "0e8a16", description: "Can run in parallel with other tasks" },
      { name: "arbiter-managed", color: "d4c5f9", description: "Managed by Arbiter CLI" }
    ]
  }
};

export class ConfigurableTemplateManager {
  private config: GitHubTemplatesConfig;
  private baseTemplates: Map<string, GitHubTemplateSet> = new Map();

  constructor(config?: GitHubTemplatesConfig) {
    this.config = config || DEFAULT_TEMPLATES_CONFIG;
    this.loadBaseTemplates();
  }

  /**
   * Load base templates for inheritance
   */
  private loadBaseTemplates(): void {
    if (this.config.base) {
      this.baseTemplates.set(this.config.base.name, this.config.base);
    }
    
    // Load default base template if not overridden
    if (!this.baseTemplates.has("arbiter-default")) {
      this.baseTemplates.set("arbiter-default", DEFAULT_TEMPLATES_CONFIG.base!);
    }
  }

  /**
   * Generate epic template using configuration
   */
  generateEpicTemplate(epic: Epic, options: GitHubTemplateOptions = {}): GeneratedTemplate {
    const templateConfig = this.config.epic || DEFAULT_TEMPLATES_CONFIG.epic!;
    const resolvedConfig = this.resolveTemplateConfig(templateConfig);
    
    // Validate epic data
    this.validateData(epic, resolvedConfig.validation);
    
    // Generate template content
    const context = this.createTemplateContext(epic, options);
    const title = this.renderTemplate(resolvedConfig.title || "{{name}}", context);
    const body = this.generateTemplateBody(resolvedConfig.sections, context);
    const labels = this.renderLabels(resolvedConfig.labels || [], context);
    const assignees = this.getAssignees(epic, resolvedConfig.assignees);

    return {
      title,
      body,
      labels,
      assignees
    };
  }

  /**
   * Generate task template using configuration
   */
  generateTaskTemplate(task: Task, epic: Epic, options: GitHubTemplateOptions = {}): GeneratedTemplate {
    const templateConfig = this.config.task || DEFAULT_TEMPLATES_CONFIG.task!;
    const resolvedConfig = this.resolveTemplateConfig(templateConfig);
    
    // Validate task data
    this.validateData(task, resolvedConfig.validation);
    
    // Generate template content
    const context = this.createTemplateContext({ ...task, epic }, options);
    const title = this.renderTemplate(resolvedConfig.title || "{{name}}", context);
    const body = this.generateTemplateBody(resolvedConfig.sections, context);
    const labels = this.renderLabels(resolvedConfig.labels || [], context);
    const assignees = this.getAssignees(task, resolvedConfig.assignees);

    return {
      title,
      body,
      labels,
      assignees
    };
  }

  /**
   * Generate repository template files
   */
  generateRepositoryTemplates(): TemplateFiles {
    const files: TemplateFiles = {};
    
    // Generate issue templates
    files[".github/ISSUE_TEMPLATE/epic.md"] = this.generateIssueTemplateFile(
      this.config.epic || DEFAULT_TEMPLATES_CONFIG.epic!,
      "epic"
    );
    
    files[".github/ISSUE_TEMPLATE/task.md"] = this.generateIssueTemplateFile(
      this.config.task || DEFAULT_TEMPLATES_CONFIG.task!,
      "task"
    );
    
    files[".github/ISSUE_TEMPLATE/bug_report.md"] = this.generateIssueTemplateFile(
      this.config.bugReport || DEFAULT_TEMPLATES_CONFIG.bugReport!,
      "bug"
    );
    
    files[".github/ISSUE_TEMPLATE/feature_request.md"] = this.generateIssueTemplateFile(
      this.config.featureRequest || DEFAULT_TEMPLATES_CONFIG.featureRequest!,
      "feature"
    );

    // Generate configuration files
    if (this.config.repositoryConfig?.issueConfig) {
      files[".github/config.yml"] = this.generateConfigFile();
    }

    if (this.config.repositoryConfig?.labels) {
      files[".github/labels.yml"] = this.generateLabelsFile();
    }

    return files;
  }

  /**
   * Resolve template configuration with inheritance
   */
  private resolveTemplateConfig(config: GitHubTemplateConfig): GitHubTemplateConfig {
    if (!config.inherits) {
      return config;
    }

    const baseTemplate = this.baseTemplates.get(config.inherits);
    if (!baseTemplate) {
      throw new Error(`Base template "${config.inherits}" not found`);
    }

    // Merge base template with current config
    return {
      ...baseTemplate,
      ...config,
      sections: {
        ...baseTemplate.sections,
        ...config.sections,
        additional: {
          ...baseTemplate.sections.additional,
          ...config.sections?.additional
        }
      },
      labels: [...(baseTemplate.labels || []), ...(config.labels || [])],
      validation: {
        fields: [
          ...(baseTemplate.validation?.fields || []),
          ...(config.validation?.fields || [])
        ],
        custom: [
          ...(baseTemplate.validation?.custom || []),
          ...(config.validation?.custom || [])
        ]
      }
    };
  }

  /**
   * Create template context from data
   */
  private createTemplateContext(data: any, options: GitHubTemplateOptions): Record<string, any> {
    return {
      ...data,
      ...options.customFields,
      // Helper functions for templates
      helpers: {
        capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
        formatDate: (date: string) => new Date(date).toLocaleDateString(),
        statusEmoji: (status: string) => this.getStatusEmoji(status)
      }
    };
  }

  /**
   * Render template string with context
   */
  private renderTemplate(template: string, context: Record<string, any>): string {
    let result = template;
    
    // Simple template rendering (replace {{variable}} with context values)
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(context, key);
      return value !== undefined ? String(value) : match;
    });
    
    // Handle conditional blocks {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
      const value = this.getNestedValue(context, condition);
      return value ? content : "";
    });
    
    // Handle each blocks {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, arrayKey, content) => {
      const array = this.getNestedValue(context, arrayKey);
      if (!Array.isArray(array)) return "";
      
      return array.map((item, index) => {
        let itemContent = content;
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index + 1));
        return itemContent;
      }).join("");
    });

    return result.trim();
  }

  /**
   * Get nested value from context
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Generate template body from sections
   */
  private generateTemplateBody(sections: GitHubTemplateSections | undefined, context: Record<string, any>): string {
    if (!sections) return "";
    
    let body = "";
    
    // Add description section
    if (sections.description) {
      body += this.renderTemplate(sections.description, context);
    }
    
    // Add details table
    if (sections.details && sections.details.length > 0) {
      body += "## 📊 Details\n\n";
      body += "| Field | Value |\n";
      body += "|-------|-------|\n";
      
      sections.details.forEach(field => {
        const value = this.getNestedValue(context, field.name);
        const displayValue = value !== undefined ? String(value) : (field.default || "Not specified");
        body += `| **${field.label}** | \`${displayValue}\` |\n`;
      });
      
      body += "\n";
    }
    
    // Add acceptance criteria section
    if (sections.acceptanceCriteria) {
      body += this.renderTemplate(sections.acceptanceCriteria, context);
    }
    
    // Add dependencies section
    if (sections.dependencies) {
      body += this.renderTemplate(sections.dependencies, context);
    }
    
    // Add additional sections
    if (sections.additional) {
      Object.entries(sections.additional).forEach(([key, template]) => {
        body += this.renderTemplate(template, context);
      });
    }
    
    return body;
  }

  /**
   * Render labels with context
   */
  private renderLabels(labelTemplates: string[], context: Record<string, any>): string[] {
    return labelTemplates
      .map(template => this.renderTemplate(template, context))
      .filter(label => label.length > 0);
  }

  /**
   * Get assignees for template
   */
  private getAssignees(data: any, configAssignees?: string[]): string[] | undefined {
    const assignees: string[] = [];
    
    if (data.assignee) {
      assignees.push(data.assignee);
    }
    
    if (data.owner && data.owner !== data.assignee) {
      assignees.push(data.owner);
    }
    
    if (configAssignees) {
      assignees.push(...configAssignees);
    }
    
    return assignees.length > 0 ? [...new Set(assignees)] : undefined;
  }

  /**
   * Validate data against template validation rules
   */
  private validateData(data: any, validation?: GitHubTemplateConfig["validation"]): void {
    if (!validation?.fields) return;
    
    const errors: string[] = [];
    
    validation.fields.forEach(rule => {
      const value = this.getNestedValue(data, rule.field);
      
      if (rule.required && (!value || (Array.isArray(value) && value.length === 0))) {
        errors.push(rule.errorMessage || `${rule.field} is required`);
        return;
      }
      
      if (value) {
        if (rule.minLength && String(value).length < rule.minLength) {
          errors.push(rule.errorMessage || `${rule.field} must be at least ${rule.minLength} characters`);
        }
        
        if (rule.maxLength && String(value).length > rule.maxLength) {
          errors.push(rule.errorMessage || `${rule.field} must be at most ${rule.maxLength} characters`);
        }
        
        if (rule.pattern && !new RegExp(rule.pattern).test(String(value))) {
          errors.push(rule.errorMessage || `${rule.field} does not match required pattern`);
        }
        
        if (rule.enum && !rule.enum.includes(String(value))) {
          errors.push(rule.errorMessage || `${rule.field} must be one of: ${rule.enum.join(", ")}`);
        }
      }
    });
    
    if (errors.length > 0) {
      throw new Error(`Template validation failed:\n${errors.map(e => `  • ${e}`).join("\n")}`);
    }
  }

  /**
   * Generate issue template file
   */
  private generateIssueTemplateFile(config: GitHubTemplateConfig, type: string): string {
    const resolvedConfig = this.resolveTemplateConfig(config);
    
    let template = "---\n";
    template += `name: ${resolvedConfig.name || type}\n`;
    template += `about: Create a new ${resolvedConfig.name || type}\n`;
    template += `title: '${resolvedConfig.title?.replace(/\{\{.*?\}\}/g, "")}'\n`;
    template += `labels: '${(resolvedConfig.labels || []).join(",").replace(/\{\{.*?\}\}/g, "")}'\n`;
    template += `assignees: '${(resolvedConfig.assignees || []).join(",")}'\n`;
    template += "---\n\n";
    
    // Add template body structure
    template += "<!-- DO NOT EDIT: Arbiter ID will be filled automatically -->\n";
    template += "<!-- arbiter-id:  -->\n";
    template += `<!-- arbiter-type: ${type} -->\n\n`;
    
    // Add template sections as placeholders
    if (resolvedConfig.sections) {
      template += this.generateTemplateBody(resolvedConfig.sections, {});
    }
    
    return template;
  }

  /**
   * Generate config.yml file
   */
  private generateConfigFile(): string {
    const config = this.config.repositoryConfig?.issueConfig;
    if (!config) return "";
    
    let content = "# Configuration for GitHub features\n\n";
    content += `blank_issues_enabled: ${config.blankIssuesEnabled || false}\n`;
    
    if (config.contactLinks) {
      content += "contact_links:\n";
      config.contactLinks.forEach(link => {
        content += `  - name: ${link.name}\n`;
        content += `    url: ${link.url}\n`;
        content += `    about: ${link.about}\n`;
      });
    }
    
    return content;
  }

  /**
   * Generate labels.yml file
   */
  private generateLabelsFile(): string {
    const labels = this.config.repositoryConfig?.labels;
    if (!labels) return "";
    
    let content = "# GitHub Labels for Arbiter-managed projects\n\n";
    
    labels.forEach(label => {
      content += `- name: '${label.name}'\n`;
      content += `  color: '${label.color}'\n`;
      if (label.description) {
        content += `  description: '${label.description}'\n`;
      }
    });
    
    return content;
  }

  /**
   * Get status emoji for display
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      todo: "📋",
      planning: "📋",
      in_progress: "🚧",
      review: "👀",
      testing: "🧪",
      completed: "✅",
      cancelled: "❌",
    };
    return emojis[status] || "❓";
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): Array<{ name: string; type: string; description?: string }> {
    const templates = [];
    
    if (this.config.epic) {
      templates.push({
        name: this.config.epic.name || "epic",
        type: "epic",
        description: this.config.epic.description
      });
    }
    
    if (this.config.task) {
      templates.push({
        name: this.config.task.name || "task",
        type: "task",
        description: this.config.task.description
      });
    }
    
    if (this.config.bugReport) {
      templates.push({
        name: this.config.bugReport.name || "bug_report",
        type: "bug",
        description: this.config.bugReport.description
      });
    }
    
    if (this.config.featureRequest) {
      templates.push({
        name: this.config.featureRequest.name || "feature_request",
        type: "feature",
        description: this.config.featureRequest.description
      });
    }
    
    return templates;
  }

  /**
   * Validate template configuration
   */
  validateTemplateConfig(): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];
    
    // Validate base template references
    const templateConfigs = [
      { name: "epic", config: this.config.epic },
      { name: "task", config: this.config.task },
      { name: "bugReport", config: this.config.bugReport },
      { name: "featureRequest", config: this.config.featureRequest }
    ];
    
    templateConfigs.forEach(({ name, config }) => {
      if (config?.inherits && !this.baseTemplates.has(config.inherits)) {
        errors.push({
          field: `${name}.inherits`,
          message: `Base template "${config.inherits}" not found`
        });
      }
    });
    
    return errors;
  }
}