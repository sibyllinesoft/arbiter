/**
 * Unified GitHub Template Manager
 *
 * Consolidates file-based and configuration-driven GitHub template systems
 * into a single, comprehensive solution that supports:
 * - File-based templates with Handlebars
 * - Configuration-driven templates
 * - Template inheritance
 * - Dynamic content generation
 * - Validation rules
 */

import path from "node:path";
import fs from "fs-extra";
import Handlebars from "handlebars";
import type {
  GitHubFieldValidation,
  GitHubFileTemplateRef,
  GitHubLabel,
  GitHubTemplateConfig,
  GitHubTemplateOptions,
  GitHubTemplateSections,
  GitHubTemplateSet,
  GitHubTemplateSetSource,
  GitHubTemplatesConfig,
  IssueSpec,
} from "../types.js";
import { validateIssue } from "../types.js";
import type { Epic, Task } from "./sharded-storage.js";

/** Generated template following exact issue schema specification */
export interface GeneratedTemplate extends IssueSpec {
  /** Additional GitHub-specific fields */
  assignees?: string[];
  milestone?: number;
  projects?: number[];
}

export interface TemplateLoadResult {
  content: string;
  metadata?: {
    name?: string;
    description?: string;
    labels?: string[];
    assignees?: string[];
    inherits?: string;
  };
}

export interface TemplateDiscoveryResult {
  templatePath: string;
  metadata: TemplateLoadResult["metadata"];
}

export interface TemplateFiles {
  [filePath: string]: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
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
        { name: "estimatedHours", label: "Estimated Hours", type: "number" },
      ],
      acceptanceCriteria:
        "## ✅ Acceptance Criteria\n\n{{#each acceptanceCriteria}}\n- [ ] {{this}}\n{{/each}}\n\n",
      dependencies: "## 🔗 Dependencies\n\n{{#each dependencies}}\n- [ ] {{this}}\n{{/each}}\n\n",
    },
    labels: ["arbiter-managed"],
    validation: {
      fields: [
        {
          field: "name",
          required: true,
          minLength: 5,
          maxLength: 80,
          errorMessage: "Name must be 5-80 characters",
        },
        {
          field: "description",
          required: true,
          minLength: 10,
          errorMessage: "Description must be at least 10 characters",
        },
      ],
    },
  },
  epic: {
    inherits: "arbiter-default",
    name: "Epic",
    title: "[EPIC] {{priority}}: {{name}}",
    labels: ["epic", "priority:{{priority}}", "status:{{status}}"],
    sections: {
      description:
        "## 📋 Epic Description\n\n**Summary:** {{description}}\n\n**Success Criteria:** {{successCriteria}}\n\n",
      additional: {
        scope:
          "## 🎯 Scope\n\n**In Scope:**\n{{#each inScope}}\n- {{this}}\n{{/each}}\n\n**Out of Scope:**\n{{#each outOfScope}}\n- {{this}}\n{{/each}}\n\n",
        tasks:
          "## ✅ Tasks Overview\n\n**Total Tasks:** {{tasks.length}}\n\n{{#each tasks}}\n- [ ] {{this.name}} ({{this.status}})\n{{/each}}\n\n",
      },
    },
    validation: {
      fields: [
        {
          field: "priority",
          required: true,
          enum: ["critical", "high", "medium", "low"],
          errorMessage: "Priority must be one of: critical, high, medium, low",
        },
        {
          field: "owner",
          required: true,
          errorMessage: "Epic must have an assigned owner",
        },
      ],
    },
  },
  task: {
    inherits: "arbiter-default",
    name: "Task",
    title: "[TASK] {{type}}: {{name}}",
    labels: ["type:{{type}}", "priority:{{priority}}", "status:{{status}}", "epic:{{epicId}}"],
    sections: {
      description: "## 📋 Task Description\n\n{{description}}\n\n**Context:** {{context}}\n\n",
      additional: {
        implementation:
          "## 🔧 Implementation\n\n**Notes:** {{implementationNotes}}\n\n**Technical Notes:** {{technicalNotes}}\n\n",
        testing:
          "## 🧪 Testing\n\n**Test Scenarios:**\n{{#each testScenarios}}\n- [ ] {{this}}\n{{/each}}\n\n",
        subtasks:
          "## 📝 Subtasks\n\n{{#each subtasks}}\n- [ ] **{{this.name}}** - {{this.description}}\n{{/each}}\n\n",
      },
    },
    validation: {
      fields: [
        {
          field: "type",
          required: true,
          enum: ["feature", "bug", "improvement", "refactor", "docs", "test"],
          errorMessage: "Type must be one of: feature, bug, improvement, refactor, docs, test",
        },
        {
          field: "epicId",
          required: false,
          errorMessage: "Epic ID must be provided if task belongs to an epic",
        },
      ],
    },
  },
  bugReport: {
    name: "Bug Report",
    title: "[BUG] {{severity}}: {{summary}}",
    labels: ["type:bug", "severity:{{severity}}", "priority:{{priority}}"],
    sections: {
      description:
        "## 🐛 Bug Report\n\n**Summary:** {{summary}}\n\n**Impact:** {{impact.businessImpact}}\n\n",
      additional: {
        reproduction:
          "## 🔄 Reproduction\n\n**Steps to Reproduce:**\n{{#each stepsToReproduce}}\n{{@index}}. {{this}}\n{{/each}}\n\n",
        behavior:
          "## 🎯 Expected vs Actual Behavior\n\n**Expected:** {{expectedBehavior}}\n\n**Actual:** {{actualBehavior}}\n\n",
        environment:
          "## 🌍 Environment\n\n- **OS:** {{environment.os}}\n- **Browser:** {{environment.browser}}\n- **Version:** {{environment.version}}\n{{#if environment.additional}}\n- **Additional:** {{environment.additional}}\n{{/if}}\n\n",
        workaround: "{{#if workaround}}## 🔧 Workaround\n\n{{workaround}}\n\n{{/if}}",
      },
    },
    validation: {
      fields: [
        {
          field: "severity",
          required: true,
          enum: ["critical", "high", "medium", "low"],
          errorMessage: "Severity must be one of: critical, high, medium, low",
        },
        {
          field: "stepsToReproduce",
          required: true,
          minLength: 1,
          errorMessage: "At least one reproduction step is required",
        },
      ],
    },
  },
  featureRequest: {
    name: "Feature Request",
    title: "[FEATURE] {{priority}}: {{summary}}",
    labels: ["type:feature", "priority:{{priority}}"],
    sections: {
      description:
        "## 💡 Feature Request\n\n**Summary:** {{summary}}\n\n**Problem Statement:** {{problemStatement}}\n\n**Proposed Solution:** {{proposedSolution}}\n\n",
      additional: {
        useCases:
          "## 👥 Use Cases\n\n{{#each useCases}}\n- **{{this.userType}}**: {{this.goal}} → {{this.benefit}}\n{{/each}}\n\n",
        impact:
          "## 📊 Impact\n\n- **Potential Users:** {{impact.potentialUsers}}\n- **Business Value:** {{impact.businessValue}}\n- **Technical Complexity:** {{impact.technicalComplexity}}\n{{#if impact.dependencies}}\n- **Dependencies:** {{impact.dependencies}}\n{{/if}}\n\n",
        requirements:
          "## ⚙️ Technical Requirements\n\n{{#each technicalRequirements}}\n- {{this}}\n{{/each}}\n\n",
        alternatives:
          "{{#if alternativesConsidered}}## 🤔 Alternatives Considered\n\n{{alternativesConsidered}}\n\n{{/if}}",
      },
    },
    validation: {
      fields: [
        {
          field: "problemStatement",
          required: true,
          minLength: 20,
          errorMessage: "Problem statement must be at least 20 characters",
        },
        {
          field: "proposedSolution",
          required: true,
          minLength: 20,
          errorMessage: "Proposed solution must be at least 20 characters",
        },
      ],
    },
  },
};

/**
 * Unified GitHub Template Manager
 *
 * Combines file-based and configuration-driven approaches into a single system
 */
export class UnifiedGitHubTemplateManager {
  private config: GitHubTemplatesConfig;
  private templateCache: Map<string, TemplateLoadResult> = new Map();
  private compiledTemplateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private baseDir: string;

  constructor(
    config: GitHubTemplatesConfig = DEFAULT_TEMPLATES_CONFIG,
    baseDir: string = process.cwd(),
  ) {
    this.config = { ...DEFAULT_TEMPLATES_CONFIG, ...config };
    this.baseDir = baseDir;
    this.registerHelpers();
  }

  /**
   * Register Handlebars helpers for template processing
   */
  private registerHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper("formatDate", (date: string | Date) => {
      if (!date) return "";
      const d = new Date(date);
      return d.toLocaleDateString();
    });

    // Conditional helper for better logic
    Handlebars.registerHelper("if_eq", (a: any, b: any, options: any) => {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    // List formatting helper
    Handlebars.registerHelper("list", (items: any[], options: any) => {
      if (!Array.isArray(items) || items.length === 0) return "";
      return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    });

    // Capitalize helper
    Handlebars.registerHelper("capitalize", (str: string) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
  }

  /**
   * Type guards for configuration objects
   */
  private isFileReference(value: unknown): value is GitHubFileTemplateRef {
    return typeof value === "object" && value !== null && "file" in value;
  }

  private isTemplateSet(value: unknown): value is GitHubTemplateSet {
    return (
      typeof value === "object" &&
      value !== null &&
      "sections" in value &&
      typeof (value as GitHubTemplateSet).sections?.description === "string"
    );
  }

  private isTemplateConfigCandidate(value: unknown): value is GitHubTemplateConfig {
    if (typeof value !== "object" || value === null) return false;
    if (this.isFileReference(value)) return false;

    return (
      "templateFile" in value || "sections" in value || "title" in value || "description" in value
    );
  }

  /**
   * Generate epic template
   */
  async generateEpicTemplate(
    epic: Epic,
    options: GitHubTemplateOptions = {},
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.epic;
    if (!templateRef) {
      throw new Error("Epic template not configured");
    }

    if (this.isFileReference(templateRef)) {
      return await this.generateFromFileTemplate("epic", epic, templateRef, options);
    } else {
      return await this.generateFromConfigTemplate("epic", epic, templateRef, options);
    }
  }

  /**
   * Generate task template
   */
  async generateTaskTemplate(
    task: Task,
    epic: Epic,
    options: GitHubTemplateOptions = {},
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.task;
    if (!templateRef) {
      throw new Error("Task template not configured");
    }

    const context = { ...task, epic, epicId: epic.id };

    if (this.isFileReference(templateRef)) {
      return await this.generateFromFileTemplate("task", context, templateRef, options);
    } else {
      return await this.generateFromConfigTemplate("task", context, templateRef, options);
    }
  }

  /**
   * Generate bug report template
   */
  async generateBugReportTemplate(
    bugData: any,
    options: GitHubTemplateOptions = {},
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.bugReport;
    if (!templateRef) {
      throw new Error("Bug report template not configured");
    }

    if (this.isFileReference(templateRef)) {
      return await this.generateFromFileTemplate("bugReport", bugData, templateRef, options);
    } else {
      return await this.generateFromConfigTemplate("bugReport", bugData, templateRef, options);
    }
  }

  /**
   * Generate feature request template
   */
  async generateFeatureRequestTemplate(
    featureData: any,
    options: GitHubTemplateOptions = {},
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.featureRequest;
    if (!templateRef) {
      throw new Error("Feature request template not configured");
    }

    if (this.isFileReference(templateRef)) {
      return await this.generateFromFileTemplate(
        "featureRequest",
        featureData,
        templateRef,
        options,
      );
    } else {
      return await this.generateFromConfigTemplate(
        "featureRequest",
        featureData,
        templateRef,
        options,
      );
    }
  }

  /**
   * Generate template from file-based configuration
   */
  private async generateFromFileTemplate(
    templateType: string,
    data: any,
    templateRef: GitHubFileTemplateRef,
    options: GitHubTemplateOptions,
  ): Promise<GeneratedTemplate> {
    const template = await this.loadTemplate(templateRef);
    const context = this.createTemplateContext(data, options);
    return await this.renderTemplate(template, context, templateRef);
  }

  /**
   * Generate template from configuration-driven template
   */
  private async generateFromConfigTemplate(
    templateType: string,
    data: any,
    templateConfig: GitHubTemplateConfig,
    options: GitHubTemplateOptions,
  ): Promise<GeneratedTemplate> {
    // Resolve inheritance
    const resolvedConfig = await this.resolveTemplateInheritance(templateConfig);

    // Validate data against template rules
    await this.validateTemplateData(data, resolvedConfig);

    // Generate title
    const title = this.renderString(resolvedConfig.title || "{{name}}", data);

    // Generate body
    const sectionsWithDefaults = {
      ...resolvedConfig.sections,
      description: resolvedConfig.sections?.description || "## Description\n\n{{description}}",
    };
    const body = this.generateTemplateBody(sectionsWithDefaults, data);

    // Process labels
    const labels = this.processLabels(resolvedConfig.labels || [], data);

    // Process assignees
    const assignees = this.processAssignees(resolvedConfig.assignees || [], data);

    const result: GeneratedTemplate = {
      title,
      body,
      labels,
      assignees: assignees.length > 0 ? assignees : undefined,
    };

    // Validate the generated template
    const validation = validateIssue(result);
    if (!validation.valid) {
      throw new Error(`Generated template validation failed: ${validation.errors.join(", ")}`);
    }

    return result;
  }

  /**
   * Load template from file system with caching
   */
  private async loadTemplate(templateRef: GitHubFileTemplateRef): Promise<TemplateLoadResult> {
    const cacheKey = `${templateRef.file}-${templateRef.inherits || "none"}`;

    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    const templatePath = this.resolveTemplatePath(templateRef.file);

    if (!(await fs.pathExists(templatePath))) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    let content = await fs.readFile(templatePath, "utf-8");
    let metadata = templateRef.metadata || {};

    // Handle inheritance
    if (templateRef.inherits) {
      const baseContent = await this.loadBaseTemplate(templateRef.inherits);
      content = this.mergeTemplateContent(baseContent, content);
    }

    const result: TemplateLoadResult = { content, metadata };
    this.templateCache.set(cacheKey, result);

    return result;
  }

  /**
   * Load base template for inheritance
   */
  private async loadBaseTemplate(baseTemplateName: string): Promise<string> {
    const baseTemplatePath = this.resolveTemplatePath(`${baseTemplateName}.hbs`);

    if (await fs.pathExists(baseTemplatePath)) {
      return await fs.readFile(baseTemplatePath, "utf-8");
    }

    // Fall back to base template from config
    const baseConfig = this.config.base;
    if (baseConfig && this.isTemplateSet(baseConfig)) {
      return this.generateTemplateBody(baseConfig.sections, {});
    }

    throw new Error(`Base template not found: ${baseTemplateName}`);
  }

  /**
   * Merge template content with base template
   */
  private mergeTemplateContent(baseContent: string, childContent: string): string {
    // Simple merge strategy - child content appends to base
    // In a more sophisticated system, you might have template blocks
    return `${baseContent}\n\n${childContent}`;
  }

  /**
   * Resolve template file path
   */
  private resolveTemplatePath(templateFile: string): string {
    if (path.isAbsolute(templateFile)) {
      return templateFile;
    }

    // Check discovery paths from config
    const discoveryPaths = this.config.discoveryPaths || [
      ".arbiter/templates/github",
      "~/.arbiter/templates/github",
    ];

    for (const discoveryPath of discoveryPaths) {
      const resolvedPath = path.resolve(
        this.baseDir,
        discoveryPath.replace("~", require("os").homedir()),
      );
      const fullPath = path.join(resolvedPath, templateFile);

      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Fall back to relative path from base directory
    return path.resolve(this.baseDir, templateFile);
  }

  /**
   * Create template context with all available data
   */
  private createTemplateContext(data: any, options: GitHubTemplateOptions): any {
    const context = {
      ...data,
      timestamp: new Date().toISOString(),
      arbiterVersion: "1.0.0", // Could be dynamic
      ...options.customFields,
    };

    // Add Arbiter IDs if requested
    if (options.includeArbiterIds && data.id) {
      context.arbiterId = data.id;
    }

    return context;
  }

  /**
   * Render template with context
   */
  private async renderTemplate(
    template: TemplateLoadResult,
    context: any,
    templateRef: GitHubFileTemplateRef,
  ): Promise<GeneratedTemplate> {
    const compiledTemplate = this.getCompiledTemplate(template.content);
    const renderedContent = compiledTemplate(context);

    // Extract title from content (first line) or use metadata
    const lines = renderedContent.split("\n");
    const title = template.metadata?.name || lines[0] || context.name || "Untitled";
    const body = lines.slice(1).join("\n").trim();

    // Process labels from metadata and template
    const labels = [...(template.metadata?.labels || []), ...(templateRef.metadata?.labels || [])];

    const result: GeneratedTemplate = {
      title,
      body,
      labels,
      assignees: template.metadata?.assignees,
    };

    // Validate the generated template
    const validation = validateIssue(result);
    if (!validation.valid) {
      throw new Error(`Generated template validation failed: ${validation.errors.join(", ")}`);
    }

    return result;
  }

  /**
   * Get compiled Handlebars template with caching
   */
  private getCompiledTemplate(content: string): HandlebarsTemplateDelegate {
    const contentHash = this.hashContent(content);

    if (this.compiledTemplateCache.has(contentHash)) {
      return this.compiledTemplateCache.get(contentHash)!;
    }

    const compiled = Handlebars.compile(content);
    this.compiledTemplateCache.set(contentHash, compiled);

    return compiled;
  }

  /**
   * Hash content for caching
   */
  private hashContent(content: string): string {
    // Simple hash for caching - in production might use crypto
    return Buffer.from(content).toString("base64").substring(0, 32);
  }

  /**
   * Resolve template inheritance for configuration-based templates
   */
  private async resolveTemplateInheritance(
    templateConfig: GitHubTemplateConfig,
  ): Promise<GitHubTemplateConfig> {
    if (!templateConfig.inherits) {
      return templateConfig;
    }

    const baseConfigName = templateConfig.inherits;
    const baseConfig = this.config[baseConfigName as keyof GitHubTemplatesConfig];

    if (!baseConfig) {
      throw new Error(`Base template not found: ${baseConfigName}`);
    }

    if (this.isTemplateConfigCandidate(baseConfig)) {
      const resolvedBase = await this.resolveTemplateInheritance(baseConfig);
      return this.mergeTemplateConfigs(resolvedBase, templateConfig);
    }

    throw new Error(`Invalid base template type: ${baseConfigName}`);
  }

  /**
   * Merge template configurations for inheritance
   */
  private mergeTemplateConfigs(
    base: GitHubTemplateConfig,
    child: GitHubTemplateConfig,
  ): GitHubTemplateConfig {
    return {
      ...base,
      ...child,
      sections: {
        ...base.sections,
        ...child.sections,
        additional: {
          ...base.sections?.additional,
          ...child.sections?.additional,
        },
      },
      labels: [...(base.labels || []), ...(child.labels || [])],
      assignees: [...(base.assignees || []), ...(child.assignees || [])],
      validation: {
        fields: [...(base.validation?.fields || []), ...(child.validation?.fields || [])],
      },
    };
  }

  /**
   * Validate template data against configuration rules
   */
  private async validateTemplateData(data: any, config: GitHubTemplateConfig): Promise<void> {
    const errors: ValidationError[] = [];
    const validationRules = config.validation?.fields || [];

    for (const rule of validationRules) {
      const value = data[rule.field];
      const fieldErrors = this.validateField(rule, value);
      errors.push(...fieldErrors);
    }

    if (errors.length > 0) {
      const errorMessages = errors.map((e) => `${e.field}: ${e.message}`);
      throw new Error(`Template validation failed: ${errorMessages.join(", ")}`);
    }
  }

  /**
   * Validate individual field against rules
   */
  private validateField(rule: GitHubFieldValidation, value: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push({
        field: rule.field,
        message: rule.errorMessage || `${rule.field} is required`,
        value,
      });
      return errors; // Don't validate further if required field is missing
    }

    if (value !== undefined && value !== null && value !== "") {
      if (rule.minLength && typeof value === "string" && value.length < rule.minLength) {
        errors.push({
          field: rule.field,
          message:
            rule.errorMessage || `${rule.field} must be at least ${rule.minLength} characters`,
          value,
        });
      }

      if (rule.maxLength && typeof value === "string" && value.length > rule.maxLength) {
        errors.push({
          field: rule.field,
          message:
            rule.errorMessage || `${rule.field} must be no more than ${rule.maxLength} characters`,
          value,
        });
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} must be one of: ${rule.enum.join(", ")}`,
          value,
        });
      }
    }

    return errors;
  }

  /**
   * Generate template body from sections configuration
   */
  private generateTemplateBody(sections: GitHubTemplateSections | undefined, data: any): string {
    if (!sections) return "";

    let body = "";

    // Add main description
    if (sections.description) {
      body += this.renderString(sections.description, data);
    }

    // Add details fields
    if (sections.details) {
      // This would generate form fields for GitHub issue templates
      // For now, we'll just add them as text
      body += "\n## Details\n\n";
      for (const detail of sections.details) {
        const value = data[detail.name] || "";
        body += `**${detail.label}:** ${value}\n`;
      }
      body += "\n";
    }

    // Add acceptance criteria
    if (sections.acceptanceCriteria) {
      body += this.renderString(sections.acceptanceCriteria, data);
    }

    // Add dependencies
    if (sections.dependencies) {
      body += this.renderString(sections.dependencies, data);
    }

    // Add additional sections
    if (sections.additional) {
      for (const [key, content] of Object.entries(sections.additional)) {
        body += this.renderString(content, data);
      }
    }

    return body.trim();
  }

  /**
   * Render string template with data
   */
  private renderString(template: string, data: any): string {
    const compiled = Handlebars.compile(template);
    return compiled(data);
  }

  /**
   * Process labels with template substitution
   */
  private processLabels(labels: string[], data: any): string[] {
    return labels
      .map((label) => this.renderString(label, data))
      .filter((label) => label.trim() !== "");
  }

  /**
   * Process assignees with template substitution
   */
  private processAssignees(assignees: string[], data: any): string[] {
    return assignees
      .map((assignee) => this.renderString(assignee, data))
      .filter((assignee) => assignee.trim() !== "");
  }

  /**
   * Discover templates in configured discovery paths
   */
  async discoverTemplates(): Promise<TemplateDiscoveryResult[]> {
    const discoveryPaths = this.config.discoveryPaths || [
      ".arbiter/templates/github",
      "~/.arbiter/templates/github",
    ];

    const results: TemplateDiscoveryResult[] = [];

    for (const discoveryPath of discoveryPaths) {
      const resolvedPath = path.resolve(
        this.baseDir,
        discoveryPath.replace("~", require("os").homedir()),
      );

      if (!(await fs.pathExists(resolvedPath))) {
        continue;
      }

      const files = await fs.readdir(resolvedPath);

      for (const file of files) {
        if (file.endsWith(".hbs") || file.endsWith(".handlebars")) {
          const fullPath = path.join(resolvedPath, file);

          try {
            const template = await this.loadTemplate({ file: fullPath });
            results.push({
              templatePath: fullPath,
              metadata: template.metadata,
            });
          } catch (error) {
            // Skip invalid templates
            console.warn(`Skipping invalid template ${fullPath}:`, error);
          }
        }
      }
    }

    return results;
  }

  /**
   * Validate template configuration
   */
  async validateTemplateConfig(): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Validate each template type
    const templateTypes = ["epic", "task", "bugReport", "featureRequest"] as const;

    for (const templateType of templateTypes) {
      const templateRef = this.config[templateType];

      if (templateRef) {
        try {
          if (this.isFileReference(templateRef)) {
            const templatePath = this.resolveTemplatePath(templateRef.file);
            if (!(await fs.pathExists(templatePath))) {
              errors.push({
                field: `${templateType}.file`,
                message: `Template file not found: ${templatePath}`,
              });
            }
          } else if (this.isTemplateConfigCandidate(templateRef)) {
            // Validate config template
            await this.resolveTemplateInheritance(templateRef);
          }
        } catch (error) {
          errors.push({
            field: templateType,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return errors;
  }

  /**
   * Generate GitHub repository template files
   */
  async generateRepositoryTemplateFiles(): Promise<TemplateFiles> {
    const files: TemplateFiles = {};

    // Generate issue templates
    if (this.config.epic) {
      files[".github/ISSUE_TEMPLATE/epic.yml"] = await this.generateIssueTemplateFile("epic");
    }

    if (this.config.task) {
      files[".github/ISSUE_TEMPLATE/task.yml"] = await this.generateIssueTemplateFile("task");
    }

    if (this.config.bugReport) {
      files[".github/ISSUE_TEMPLATE/bug-report.yml"] =
        await this.generateIssueTemplateFile("bug-report");
    }

    if (this.config.featureRequest) {
      files[".github/ISSUE_TEMPLATE/feature-request.yml"] =
        await this.generateIssueTemplateFile("feature-request");
    }

    // Generate config file
    files[".github/ISSUE_TEMPLATE/config.yml"] = this.generateConfigFile();

    return files;
  }

  /**
   * Generate GitHub issue template file
   */
  private async generateIssueTemplateFile(templateType: string): Promise<string> {
    const templateRef = this.config[templateType as keyof GitHubTemplatesConfig];
    if (!templateRef) return "";

    let resolvedConfig: GitHubTemplateConfig;

    if (this.isFileReference(templateRef)) {
      // Convert file reference to config format
      resolvedConfig = {
        name: templateRef.metadata?.name || templateType,
        description: templateRef.metadata?.description || `${templateType} template`,
        title: `{{name}}`,
        labels: templateRef.metadata?.labels || [],
      };
    } else if (this.isTemplateConfigCandidate(templateRef)) {
      resolvedConfig = await this.resolveTemplateInheritance(templateRef);
    } else {
      return "";
    }

    let template = "name: ";
    template += `'${resolvedConfig.name}'\n`;
    template += "description: ";
    template += `'${resolvedConfig.description || ""}'\n`;
    template += "title: ";
    template += `'${resolvedConfig.title?.replace(/\{\{.*?\}\}/g, "")}'\n`;
    template += "labels: ";
    template += `'${(resolvedConfig.labels || []).join(",").replace(/\{\{.*?\}\}/g, "")}'\n`;
    template += "assignees: ";
    template += `'${(resolvedConfig.assignees || []).join(",")}'\n`;
    template += "body:\n";

    // Add template sections as form fields
    if (resolvedConfig.sections) {
      const sectionsWithDefaults = {
        ...resolvedConfig.sections,
        description: resolvedConfig.sections?.description || "## Description\n\n{{description}}",
      };
      template += this.generateTemplateFormBody(sectionsWithDefaults, {});
    }

    return template;
  }

  /**
   * Generate template form body for GitHub issue templates
   */
  private generateTemplateFormBody(sections: GitHubTemplateSections, data: any): string {
    let body = "";

    if (sections.description) {
      body += "  - type: textarea\n";
      body += "    id: description\n";
      body += "    attributes:\n";
      body += "      label: Description\n";
      body += "      placeholder: Describe the issue or request...\n";
      body += "    validations:\n";
      body += "      required: true\n";
    }

    if (sections.details) {
      for (const detail of sections.details) {
        body += `  - type: ${detail.type === "select" ? "dropdown" : "input"}\n`;
        body += `    id: ${detail.name}\n`;
        body += "    attributes:\n";
        body += `      label: ${detail.label}\n`;

        if (detail.type === "select" && detail.enum) {
          body += "      options:\n";
          for (const option of detail.enum) {
            body += `        - ${option}\n`;
          }
        }

        if (detail.required) {
          body += "    validations:\n";
          body += "      required: true\n";
        }
      }
    }

    return body;
  }

  /**
   * Generate config.yml file for GitHub issue templates
   */
  private generateConfigFile(): string {
    let content = "# GitHub issue template configuration\n\n";
    content += "blank_issues_enabled: false\n";
    content += "contact_links:\n";
    content += "  - name: 📚 Documentation\n";
    content += "    url: https://github.com/your-org/docs\n";
    content += "    about: Check our documentation for common questions\n";

    return content;
  }
}

/**
 * Default template manager instance
 */
export const unifiedTemplateManager = new UnifiedGitHubTemplateManager();
