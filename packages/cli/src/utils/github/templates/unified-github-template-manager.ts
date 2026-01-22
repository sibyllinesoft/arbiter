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

import os from "node:os";
import path from "node:path";
import { GitHubTemplateAssetStrategy } from "@/templates/github-assets.js";
import { TemplateOrchestrator, templateOrchestrator } from "@/templates/index.js";
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
} from "@/types.js";
import { validateIssue } from "@/types.js";
import type { Group, Task } from "@/utils/github/sharded-storage.js";
import fs from "fs-extra";
import Handlebars from "handlebars";
import { DEFAULT_TEMPLATES_CONFIG } from "./default-templates-config.js";
import {
  generateConfigFile,
  generateTemplateBody,
  generateTemplateFormBody,
  processAssignees,
  processLabels,
  renderString,
} from "./github-template-body.js";
import {
  type ValidationError,
  throwIfValidationErrors,
  validateField,
  validateTemplateDataAgainstRules,
} from "./github-template-validation.js";

// Re-export for backwards compatibility
export { DEFAULT_TEMPLATES_CONFIG };

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

// Re-export ValidationError for backwards compatibility
export type { ValidationError } from "./github-template-validation.js";

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
  private templateLoader: TemplateOrchestrator;
  private readonly templateAssets: GitHubTemplateAssetStrategy;

  constructor(
    config: GitHubTemplatesConfig = DEFAULT_TEMPLATES_CONFIG,
    baseDir: string = process.cwd(),
    templateLoader: TemplateOrchestrator = templateOrchestrator,
  ) {
    this.config = { ...DEFAULT_TEMPLATES_CONFIG, ...config };
    this.baseDir = baseDir;
    this.templateLoader = templateLoader;
    this.templateAssets = new GitHubTemplateAssetStrategy(this.templateLoader);
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
   * Generate group template
   */
  async generateGroupTemplate(
    group: Group,
    options: GitHubTemplateOptions = {},
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.group;
    if (!templateRef) {
      throw new Error("Group template not configured");
    }

    if (this.isFileReference(templateRef)) {
      return await this.generateFromFileTemplate("group", group, templateRef, options);
    } else {
      return await this.generateFromConfigTemplate("group", group, templateRef, options);
    }
  }

  /**
   * Generate task template
   */
  async generateTaskTemplate(
    task: Task,
    group: Group,
    options: GitHubTemplateOptions = {},
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.issue;
    if (!templateRef) {
      throw new Error("Issue template not configured");
    }

    const context = { ...task, group, groupId: group.id };

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
   * Build sections with default description
   */
  private buildSectionsWithDefaults(
    sections?: Partial<GitHubTemplateSections>,
  ): Partial<GitHubTemplateSections> {
    return {
      ...sections,
      description: sections?.description || "## Description\n\n{{description}}",
    };
  }

  /**
   * Build generated template result
   */
  private buildTemplateResult(
    title: string,
    body: string,
    labels: string[],
    assignees: string[],
  ): GeneratedTemplate {
    return {
      title,
      body,
      labels,
      assignees: assignees.length > 0 ? assignees : undefined,
    };
  }

  /**
   * Validate generated template and throw on failure
   */
  private validateGeneratedTemplate(result: GeneratedTemplate): void {
    const validation = validateIssue(result);
    if (!validation.valid) {
      throw new Error(`Generated template validation failed: ${validation.errors.join(", ")}`);
    }
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
    const resolvedConfig = await this.resolveTemplateInheritance(templateConfig);
    await this.validateTemplateData(data, resolvedConfig);

    const title = renderString(resolvedConfig.title || "{{name}}", data);
    const sectionsWithDefaults = this.buildSectionsWithDefaults(resolvedConfig.sections);
    // After buildSectionsWithDefaults, description is guaranteed to be set
    const body = generateTemplateBody(sectionsWithDefaults as GitHubTemplateSections, data);
    const labels = processLabels(resolvedConfig.labels || [], data);
    const assignees = this.processAssignees(resolvedConfig.assignees || [], data);

    const result = this.buildTemplateResult(title, body, labels, assignees);
    this.validateGeneratedTemplate(result);

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

    const asset = await this.loadTemplateAsset(templateRef.file);
    if (!asset) {
      throw new Error(`Template file not found: ${templateRef.file}`);
    }

    let content = asset.content;
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
    const asset = await this.loadTemplateAsset(`${baseTemplateName}.hbs`);
    if (asset) {
      return asset.content;
    }

    // Fall back to base template from config
    const baseConfig = this.config.base;
    if (baseConfig && this.isTemplateSet(baseConfig)) {
      return generateTemplateBody(baseConfig.sections, {});
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

  private async loadTemplateAsset(
    templateFile: string,
  ): Promise<{ content: string; resolvedPath: string } | undefined> {
    const candidates = this.expandTemplateCandidates(templateFile);
    const overrideDirectories = this.getDiscoveryDirectories();
    const defaultDirectories = [this.baseDir];

    for (const candidate of candidates) {
      const asset = await this.templateAssets.resolve(candidate, {
        overrideDirectories,
        defaultDirectories,
      });
      if (asset) {
        return asset;
      }
    }

    for (const candidate of candidates) {
      const fallback = path.resolve(this.baseDir, candidate);
      if (await fs.pathExists(fallback)) {
        const content = await fs.readFile(fallback, "utf-8");
        return { content, resolvedPath: fallback };
      }
    }

    return undefined;
  }

  private expandTemplateCandidates(templateFile: string): string[] {
    if (path.extname(templateFile)) {
      return [templateFile];
    }
    if (this.config.defaultExtension) {
      return [templateFile, `${templateFile}.${this.config.defaultExtension}`];
    }
    return [templateFile];
  }

  private getDiscoveryDirectories(): string[] {
    const discoveryPaths = this.config.discoveryPaths || [
      ".arbiter/templates/github",
      "~/.arbiter/templates/github",
    ];
    return discoveryPaths.map((discoveryPath) => this.resolveDiscoveryPath(discoveryPath));
  }

  private resolveDiscoveryPath(discoveryPath: string): string {
    if (discoveryPath.startsWith("~")) {
      return path.join(os.homedir(), discoveryPath.slice(1));
    }

    return path.isAbsolute(discoveryPath)
      ? discoveryPath
      : path.resolve(this.baseDir, discoveryPath);
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
  /**
   * Extract title and body from rendered content
   */
  private extractTitleAndBody(
    renderedContent: string,
    template: TemplateLoadResult,
    context: any,
  ): { title: string; body: string } {
    const lines = renderedContent.split("\n");
    const title = template.metadata?.name || lines[0] || context.name || "Untitled";
    const body = lines.slice(1).join("\n").trim();
    return { title, body };
  }

  /**
   * Merge labels from template and ref metadata
   */
  private mergeTemplateLabels(
    template: TemplateLoadResult,
    templateRef: GitHubFileTemplateRef,
  ): string[] {
    return [...(template.metadata?.labels || []), ...(templateRef.metadata?.labels || [])];
  }

  private async renderTemplate(
    template: TemplateLoadResult,
    context: any,
    templateRef: GitHubFileTemplateRef,
  ): Promise<GeneratedTemplate> {
    const compiledTemplate = this.getCompiledTemplate(template.content);
    const renderedContent = compiledTemplate(context);

    const { title, body } = this.extractTitleAndBody(renderedContent, template, context);
    const labels = this.mergeTemplateLabels(template, templateRef);

    const result = this.buildTemplateResult(
      title,
      body,
      labels,
      template.metadata?.assignees || [],
    );
    this.validateGeneratedTemplate(result);

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
   * Find base config by name, with fallback to arbiter-default
   */
  private findBaseConfig(baseConfigName: string): unknown {
    let baseConfig = this.config[baseConfigName as keyof GitHubTemplatesConfig];
    if (!baseConfig && baseConfigName === "arbiter-default") {
      baseConfig = this.config.base || DEFAULT_TEMPLATES_CONFIG.base;
    }
    return baseConfig;
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
    const baseConfig = this.findBaseConfig(baseConfigName);

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
    const validationRules = config.validation?.fields || [];
    const errors = validateTemplateDataAgainstRules(data, validationRules);
    throwIfValidationErrors(errors);
  }

  /**
   * Process assignees with template substitution
   */
  private processAssignees(assignees: string[], data: any): string[] {
    return processAssignees(assignees, data);
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
      const pathResults = await this.discoverTemplatesInPath(discoveryPath);
      results.push(...pathResults);
    }

    return results;
  }

  /**
   * Discover templates in a single directory path
   */
  private async discoverTemplatesInPath(discoveryPath: string): Promise<TemplateDiscoveryResult[]> {
    const resolvedPath = path.resolve(
      this.baseDir,
      discoveryPath.replace("~", require("os").homedir()),
    );

    if (!(await fs.pathExists(resolvedPath))) {
      return [];
    }

    const files = await fs.readdir(resolvedPath);
    const results: TemplateDiscoveryResult[] = [];

    for (const file of files) {
      const result = await this.tryLoadTemplateFile(resolvedPath, file);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Attempt to load a template file if it has a valid extension
   */
  private async tryLoadTemplateFile(
    dirPath: string,
    fileName: string,
  ): Promise<TemplateDiscoveryResult | null> {
    if (!fileName.endsWith(".hbs") && !fileName.endsWith(".handlebars")) {
      return null;
    }

    const fullPath = path.join(dirPath, fileName);

    try {
      const template = await this.loadTemplate({ file: fullPath });
      return {
        templatePath: fullPath,
        metadata: template.metadata,
      };
    } catch (error) {
      console.warn(`Skipping invalid template ${fullPath}:`, error);
      return null;
    }
  }

  /**
   * Template types to validate
   */
  private static readonly TEMPLATE_TYPES_TO_VALIDATE = [
    "group",
    "task",
    "bugReport",
    "featureRequest",
  ] as const;

  /**
   * Validate a single template reference
   */
  private async validateFileReference(
    templateType: string,
    templateRef: { file: string },
  ): Promise<ValidationError | null> {
    const asset = await this.loadTemplateAsset(templateRef.file);
    if (!asset) {
      return {
        field: `${templateType}.file`,
        message: `Template file not found: ${templateRef.file}`,
      };
    }
    return null;
  }

  private async validateSingleTemplate(
    templateType: string,
    templateRef: unknown,
  ): Promise<ValidationError | null> {
    try {
      if (this.isFileReference(templateRef)) {
        return this.validateFileReference(templateType, templateRef);
      }
      if (this.isTemplateConfigCandidate(templateRef)) {
        await this.resolveTemplateInheritance(templateRef);
      }
      return null;
    } catch (error) {
      return {
        field: templateType,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate template configuration
   */
  async validateTemplateConfig(): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const templateType of UnifiedGitHubTemplateManager.TEMPLATE_TYPES_TO_VALIDATE) {
      const templateRef = this.config[templateType];
      if (!templateRef) continue;

      const error = await this.validateSingleTemplate(templateType, templateRef);
      if (error) {
        errors.push(error);
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
    if (this.config.group) {
      files[".github/ISSUE_TEMPLATE/group.yml"] = await this.generateIssueTemplateFile("group");
    }

    if (this.config.issue) {
      files[".github/ISSUE_TEMPLATE/issue.yml"] = await this.generateIssueTemplateFile("issue");
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
    files[".github/ISSUE_TEMPLATE/config.yml"] = generateConfigFile();

    return files;
  }

  /**
   * Resolve template reference to config format
   */
  private async resolveTemplateRefToConfig(
    templateType: string,
    templateRef: unknown,
  ): Promise<GitHubTemplateConfig | null> {
    if (this.isFileReference(templateRef)) {
      return {
        name: templateRef.metadata?.name || templateType,
        description: templateRef.metadata?.description || `${templateType} template`,
        title: `{{name}}`,
        labels: templateRef.metadata?.labels || [],
      };
    }

    if (this.isTemplateConfigCandidate(templateRef)) {
      return this.resolveTemplateInheritance(templateRef);
    }

    return null;
  }

  /**
   * Build template YAML header
   */
  private buildTemplateYamlHeader(config: GitHubTemplateConfig): string {
    const stripPlaceholders = (s: string) => s.replace(/\{\{.*?\}\}/g, "");

    return [
      `name: '${config.name}'`,
      `description: '${config.description || ""}'`,
      `title: '${stripPlaceholders(config.title || "")}'`,
      `labels: '${stripPlaceholders((config.labels || []).join(","))}'`,
      `assignees: '${(config.assignees || []).join(",")}'`,
      "body:",
    ].join("\n");
  }

  /**
   * Build template body sections
   */
  private buildTemplateSections(config: GitHubTemplateConfig): string {
    if (!config.sections) return "";

    const sectionsWithDefaults = {
      ...config.sections,
      description: config.sections.description || "## Description\n\n{{description}}",
    };
    return generateTemplateFormBody(sectionsWithDefaults, {});
  }

  /**
   * Generate GitHub issue template file
   */
  private async generateIssueTemplateFile(templateType: string): Promise<string> {
    const templateRef = this.config[templateType as keyof GitHubTemplatesConfig];
    if (!templateRef) return "";

    const resolvedConfig = await this.resolveTemplateRefToConfig(templateType, templateRef);
    if (!resolvedConfig) return "";

    const header = this.buildTemplateYamlHeader(resolvedConfig);
    const body = this.buildTemplateSections(resolvedConfig);

    return header + "\n" + body;
  }
}

/**
 * Default template manager instance
 */
export const unifiedTemplateManager = new UnifiedGitHubTemplateManager();
