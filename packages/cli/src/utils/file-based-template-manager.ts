/**
 * File-Based GitHub Template Manager
 *
 * This module provides file-based template loading with inheritance support
 * for GitHub issue templates using Handlebars.
 */

import path from 'node:path';
import fs from 'fs-extra';
import Handlebars from 'handlebars';
import type {
  GitHubFileTemplateRef,
  GitHubTemplateConfig,
  GitHubTemplateOptions,
  GitHubTemplateSet,
  GitHubTemplateSetSource,
  GitHubTemplatesConfig,
  IssueSpec,
} from '../types.js';
import { validateIssue } from '../types.js';
import type { Epic, Task } from './sharded-storage.js';

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
  metadata: TemplateLoadResult['metadata'];
}

/**
 * File-based template manager with inheritance support
 */
export class FileBasedTemplateManager {
  private config: GitHubTemplatesConfig;
  private templateCache: Map<string, TemplateLoadResult> = new Map();
  private compiledTemplateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private baseDir: string;

  constructor(config: GitHubTemplatesConfig, baseDir: string = process.cwd()) {
    this.config = config;
    this.baseDir = baseDir;
    this.registerHelpers();
  }

  private isFileReference(value: unknown): value is GitHubFileTemplateRef {
    return typeof value === 'object' && value !== null && 'file' in value;
  }

  private isTemplateSet(value: unknown): value is GitHubTemplateSet {
    return (
      typeof value === 'object' &&
      value !== null &&
      'sections' in value &&
      typeof (value as GitHubTemplateSet).sections?.description === 'string'
    );
  }

  private isTemplateConfigCandidate(value: unknown): value is GitHubTemplateConfig {
    if (typeof value !== 'object' || value === null) return false;
    if (this.isFileReference(value)) return false;

    return (
      'templateFile' in value || 'sections' in value || 'title' in value || 'description' in value
    );
  }

  /**
   * Generate epic template from file
   */
  async generateEpicTemplate(
    epic: Epic,
    options: GitHubTemplateOptions = {}
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.epic;
    if (!templateRef) {
      throw new Error('Epic template not configured');
    }

    const template = await this.loadTemplate(templateRef);
    const context = this.createTemplateContext(epic, options);

    return await this.renderTemplate(template, context, templateRef);
  }

  /**
   * Generate task template from file
   */
  async generateTaskTemplate(
    task: Task,
    epic: Epic,
    options: GitHubTemplateOptions = {}
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.task;
    if (!templateRef) {
      throw new Error('Task template not configured');
    }

    const template = await this.loadTemplate(templateRef);
    const context = this.createTemplateContext({ ...task, epic }, options);

    return await this.renderTemplate(template, context, templateRef);
  }

  /**
   * Generate bug report template from file
   */
  async generateBugReportTemplate(
    bugData: any,
    options: GitHubTemplateOptions = {}
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.bugReport;
    if (!templateRef) {
      throw new Error('Bug report template not configured');
    }

    const template = await this.loadTemplate(templateRef);
    const context = this.createTemplateContext(bugData, options);

    return await this.renderTemplate(template, context, templateRef);
  }

  /**
   * Generate feature request template from file
   */
  async generateFeatureRequestTemplate(
    featureData: any,
    options: GitHubTemplateOptions = {}
  ): Promise<GeneratedTemplate> {
    const templateRef = this.config.featureRequest;
    if (!templateRef) {
      throw new Error('Feature request template not configured');
    }

    const template = await this.loadTemplate(templateRef);
    const context = this.createTemplateContext(featureData, options);

    return await this.renderTemplate(template, context, templateRef);
  }

  /**
   * Load template from file or config
   */
  private async loadTemplate(
    templateRef: GitHubTemplateConfig | GitHubFileTemplateRef | GitHubTemplateSetSource
  ): Promise<TemplateLoadResult> {
    // Check if it's a file reference
    if (this.isFileReference(templateRef)) {
      return await this.loadTemplateFromFile(templateRef);
    }

    if (this.isTemplateSet(templateRef)) {
      const config: GitHubTemplateConfig = {
        name: templateRef.name,
        description: templateRef.description,
        sections: templateRef.sections,
        labels: templateRef.labels,
        validation: templateRef.validation,
      };

      return this.createInlineTemplate(config);
    }

    if (!this.isTemplateConfigCandidate(templateRef)) {
      throw new Error('Unsupported template reference type for file-based templates');
    }

    // Handle inline template config with possible file reference
    const config = templateRef as GitHubTemplateConfig;
    if (config.templateFile) {
      const fileRef: GitHubFileTemplateRef = {
        file: config.templateFile,
        inherits: config.inherits,
        metadata: {
          name: config.name,
          description: config.description,
          labels: config.labels,
          assignees: config.assignees,
        },
      };
      return await this.loadTemplateFromFile(fileRef);
    }

    // Fallback to inline template generation
    return this.createInlineTemplate(config);
  }

  /**
   * Load template from file with inheritance support
   */
  private async loadTemplateFromFile(
    templateRef: GitHubFileTemplateRef
  ): Promise<TemplateLoadResult> {
    const filePath = await this.resolveTemplatePath(templateRef.file);

    // Check cache first
    const cacheKey = filePath;
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    if (!(await fs.pathExists(filePath))) {
      throw new Error(`Template file not found: ${filePath}`);
    }

    let content = await fs.readFile(filePath, 'utf-8');
    const metadata = this.extractTemplateMetadata(content);

    // Merge metadata from reference and file
    const combinedMetadata = {
      ...metadata,
      ...templateRef.metadata,
      inherits: templateRef.inherits || metadata.inherits,
    };

    // Handle inheritance
    if (combinedMetadata.inherits) {
      const baseTemplate = await this.loadInheritedTemplate(combinedMetadata.inherits);
      content = this.mergeTemplateContent(baseTemplate.content, content);
    }

    const result: TemplateLoadResult = {
      content,
      metadata: combinedMetadata,
    };

    // Cache the result
    this.templateCache.set(cacheKey, result);
    return result;
  }

  /**
   * Load inherited template
   */
  private async loadInheritedTemplate(inheritsRef: string): Promise<TemplateLoadResult> {
    // Check if it's a file path
    if (inheritsRef.includes('.')) {
      const fileRef: GitHubFileTemplateRef = { file: inheritsRef };
      return await this.loadTemplateFromFile(fileRef);
    }

    // Check if it's a template name in config
    const baseTemplates = ['base', 'epic', 'task', 'bugReport', 'featureRequest'] as const;
    for (const templateName of baseTemplates) {
      const templateRef = this.config[templateName];
      if (!templateRef) continue;

      if (this.isFileReference(templateRef)) {
        if (templateRef.metadata?.name === inheritsRef) {
          return await this.loadTemplate(templateRef);
        }
        continue;
      }

      if (this.isTemplateSet(templateRef)) {
        if (templateRef.name === inheritsRef) {
          return await this.loadTemplate(templateRef);
        }
        continue;
      }

      if (this.isTemplateConfigCandidate(templateRef) && templateRef.name === inheritsRef) {
        return await this.loadTemplate(templateRef);
      }
    }

    throw new Error(`Inherited template not found: ${inheritsRef}`);
  }

  /**
   * Merge base template content with child template content
   */
  private mergeTemplateContent(baseContent: string, childContent: string): string {
    // Simple merge strategy: if child has "{{> base}}" or similar, replace it with base content
    // Otherwise, prepend base content
    if (childContent.includes('{{> base}}')) {
      return childContent.replace('{{> base}}', baseContent);
    }

    // Look for @inherits comment and replace
    const inheritMatch = childContent.match(/{{!--\s*@inherits:\s*([^\s]+)\s*--}}/);
    if (inheritMatch) {
      return childContent.replace(inheritMatch[0], baseContent);
    }

    // Fallback: prepend base content
    return `${baseContent}\n\n${childContent}`;
  }

  /**
   * Extract metadata from template file comments
   */
  private extractTemplateMetadata(content: string): TemplateLoadResult['metadata'] {
    const metadata: TemplateLoadResult['metadata'] = {};

    // Extract @inherits
    const inheritMatch = content.match(/{{!--\s*@inherits:\s*([^\s]+)\s*--}}/);
    if (inheritMatch) {
      metadata.inherits = inheritMatch[1];
    }

    // Extract @name
    const nameMatch = content.match(/{{!--\s*@name:\s*([^-]+?)\s*--}}/);
    if (nameMatch) {
      metadata.name = nameMatch[1].trim();
    }

    // Extract @description
    const descriptionMatch = content.match(/{{!--\s*@description:\s*([^-]+?)\s*--}}/);
    if (descriptionMatch) {
      metadata.description = descriptionMatch[1].trim();
    }

    // Extract @labels
    const labelsMatch = content.match(/{{!--\s*@labels:\s*\[([^\]]+)\]\s*--}}/);
    if (labelsMatch) {
      metadata.labels = labelsMatch[1].split(',').map(l => l.trim().replace(/['"]/g, ''));
    }

    return metadata;
  }

  /**
   * Resolve template file path with discovery paths
   */
  private async resolveTemplatePath(templateFile: string): Promise<string> {
    // If absolute path, use as-is
    if (path.isAbsolute(templateFile)) {
      return templateFile;
    }

    // Try discovery paths
    const discoveryPaths = this.config.discoveryPaths || ['.arbiter/templates/github'];

    for (const discoveryPath of discoveryPaths) {
      const resolvedDiscoveryPath = this.resolveDiscoveryPath(discoveryPath);
      let candidatePath = path.join(resolvedDiscoveryPath, templateFile);

      // Add extension if not present
      if (!path.extname(candidatePath) && this.config.defaultExtension) {
        candidatePath += `.${this.config.defaultExtension}`;
      }

      if (await fs.pathExists(candidatePath)) {
        return candidatePath;
      }
    }

    // Fallback to relative to base directory
    let fallbackPath = path.join(this.baseDir, templateFile);
    if (!path.extname(fallbackPath) && this.config.defaultExtension) {
      fallbackPath += `.${this.config.defaultExtension}`;
    }

    return fallbackPath;
  }

  /**
   * Resolve discovery path (handle ~ for home directory)
   */
  private resolveDiscoveryPath(discoveryPath: string): string {
    if (discoveryPath.startsWith('~')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (!homeDir) {
        throw new Error('Could not resolve home directory for template path');
      }
      return path.join(homeDir, discoveryPath.slice(1));
    }

    if (path.isAbsolute(discoveryPath)) {
      return discoveryPath;
    }

    return path.join(this.baseDir, discoveryPath);
  }

  /**
   * Create inline template from config (fallback)
   */
  private createInlineTemplate(config: GitHubTemplateConfig): TemplateLoadResult {
    let content = '';

    if (config.sections?.description) {
      content += `${config.sections.description}\n\n`;
    }

    if (config.sections?.acceptanceCriteria) {
      content += `${config.sections.acceptanceCriteria}\n\n`;
    }

    if (config.sections?.dependencies) {
      content += `${config.sections.dependencies}\n\n`;
    }

    if (config.sections?.additional) {
      Object.values(config.sections.additional).forEach(section => {
        content += `${section}\n\n`;
      });
    }

    return {
      content: content.trim(),
      metadata: {
        name: config.name,
        description: config.description,
        labels: config.labels,
        assignees: config.assignees,
      },
    };
  }

  /**
   * Render template with context
   */
  private async renderTemplate(
    template: TemplateLoadResult,
    context: Record<string, any>,
    templateRef: GitHubTemplateConfig | GitHubFileTemplateRef
  ): Promise<GeneratedTemplate> {
    // Compile template if not cached
    const cacheKey = template.content;
    let compiledTemplate = this.compiledTemplateCache.get(cacheKey);

    if (!compiledTemplate) {
      compiledTemplate = Handlebars.compile(template.content);
      this.compiledTemplateCache.set(cacheKey, compiledTemplate);
    }

    // Render content
    const body = compiledTemplate(context);

    // Extract title - prefer context data or use template metadata
    let title = context.name || context.title || template.metadata?.name || 'Untitled';

    // Ensure title length limit
    if (title.length > 255) {
      title = `${title.substring(0, 252)}...`;
    }

    // Process labels (semantic labels that map to GitHub/GitLab)
    const labels = this.processLabels(template.metadata?.labels || [], context);

    // Process assignees (GitHub-specific)
    const assignees = this.processAssignees(template.metadata?.assignees || [], context);

    // Extract acceptance criteria from context
    const acceptance_criteria = context.acceptanceCriteria || context.acceptance_criteria || [];

    // Extract checklist items from context
    const checklist = this.createChecklistFromContext(context);

    // Extract links from context
    const links = context.links || [];

    // Create the issue following exact schema specification
    const issue: GeneratedTemplate = {
      title,
      body,
      labels,
      acceptance_criteria,
      checklist,
      links,
      // GitHub-specific fields
      assignees: assignees.length > 0 ? assignees : undefined,
    };

    // Validate against issue schema
    const validation = validateIssue(issue);
    if (!validation.valid) {
      throw new Error(`Generated template validation failed: ${validation.errors.join(', ')}`);
    }

    return issue;
  }

  /**
   * Process labels with context substitution
   */
  private processLabels(labelTemplates: string[], context: Record<string, any>): string[] {
    return labelTemplates
      .map(template => {
        const compiled = Handlebars.compile(template);
        return compiled(context);
      })
      .filter(label => label.length > 0);
  }

  /**
   * Process assignees with context substitution
   */
  private processAssignees(assigneeTemplates: string[], context: Record<string, any>): string[] {
    const assignees: string[] = [];

    // Add assignees from context
    if (context.assignee) {
      assignees.push(context.assignee);
    }

    if (context.owner && context.owner !== context.assignee) {
      assignees.push(context.owner);
    }

    // Add assignees from template
    assigneeTemplates.forEach(template => {
      const compiled = Handlebars.compile(template);
      const assignee = compiled(context);
      if (assignee && assignee.length > 0) {
        assignees.push(assignee);
      }
    });

    return [...new Set(assignees)]; // Remove duplicates
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
        statusEmoji: (status: string) => this.getStatusEmoji(status),
      },
    };
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Equality helper
    Handlebars.registerHelper('eq', (a, b) => a === b);

    // If helper for conditional rendering
    Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    // Status emoji helper
    Handlebars.registerHelper('statusEmoji', (status: string) => {
      return this.getStatusEmoji(status);
    });

    // Capitalize helper
    Handlebars.registerHelper('capitalize', (str: string) => {
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    });

    // Format date helper
    Handlebars.registerHelper('formatDate', (date: string) => {
      return date ? new Date(date).toLocaleDateString() : '';
    });
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

  /**
   * Discover available templates in discovery paths
   */
  async discoverTemplates(): Promise<TemplateDiscoveryResult[]> {
    const discovered: TemplateDiscoveryResult[] = [];
    const discoveryPaths: string[] = this.config.discoveryPaths ?? ['.arbiter/templates/github'];

    for (const discoveryPath of discoveryPaths) {
      try {
        const resolvedPath = this.resolveDiscoveryPath(discoveryPath);
        if (!(await fs.pathExists(resolvedPath))) {
          continue;
        }

        const files = await fs.readdir(resolvedPath);
        const templateFiles = files.filter(file => {
          const ext = path.extname(file);
          return ext === '.hbs' || ext === '.md' || ext === '.handlebars';
        });

        for (const file of templateFiles) {
          const templatePath = path.join(resolvedPath, file);
          const content = await fs.readFile(templatePath, 'utf-8');
          const metadata = this.extractTemplateMetadata(content);

          discovered.push({
            templatePath,
            metadata,
          });
        }
      } catch (error) {}
    }

    return discovered;
  }

  /**
   * Validate template configuration
   */
  async validateTemplateConfig(): Promise<Array<{ field: string; message: string }>> {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate template file references
    const templateRefs = [
      { name: 'base', ref: this.config.base },
      { name: 'epic', ref: this.config.epic },
      { name: 'task', ref: this.config.task },
      { name: 'bugReport', ref: this.config.bugReport },
      { name: 'featureRequest', ref: this.config.featureRequest },
    ];

    for (const { name, ref } of templateRefs) {
      if (!ref) continue;

      try {
        if (this.isFileReference(ref)) {
          const filePath = await this.resolveTemplatePath(ref.file);
          if (!(await fs.pathExists(filePath))) {
            errors.push({
              field: `${name}.file`,
              message: `Template file not found: ${filePath}`,
            });
          }
        } else if (this.isTemplateConfigCandidate(ref) && ref.templateFile) {
          const filePath = await this.resolveTemplatePath(ref.templateFile);
          if (!(await fs.pathExists(filePath))) {
            errors.push({
              field: `${name}.templateFile`,
              message: `Template file not found: ${filePath}`,
            });
          }
        }
      } catch (error) {
        errors.push({
          field: `${name}`,
          message: `Error validating template: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return errors;
  }

  /**
   * Create checklist items from context data
   */
  private createChecklistFromContext(
    context: Record<string, any>
  ): Array<{ id: string; text: string; done?: boolean }> {
    const checklist = [];

    // Add task-specific checklist items
    if (context.tasks && Array.isArray(context.tasks)) {
      context.tasks.forEach((task: any, index: number) => {
        checklist.push({
          id: `task-${index}`,
          text: task.name || task.description || `Task ${index + 1}`,
          done: task.status === 'completed',
        });
      });
    }

    // Add acceptance criteria as checklist items
    if (context.acceptanceCriteria && Array.isArray(context.acceptanceCriteria)) {
      context.acceptanceCriteria.forEach((criteria: string, index: number) => {
        checklist.push({
          id: `criteria-${index}`,
          text: criteria,
          done: false,
        });
      });
    }

    // Add any custom checklist items from context
    if (context.checklist && Array.isArray(context.checklist)) {
      context.checklist.forEach((item: any, index: number) => {
        if (typeof item === 'string') {
          checklist.push({
            id: `custom-${index}`,
            text: item,
            done: false,
          });
        } else if (item && typeof item === 'object') {
          checklist.push({
            id: item.id || `custom-${index}`,
            text: item.text || item.description || '',
            done: !!item.done,
          });
        }
      });
    }

    return checklist;
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    this.compiledTemplateCache.clear();
  }
}
