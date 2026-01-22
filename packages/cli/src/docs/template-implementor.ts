/**
 * Template implementor for CLI documentation
 *
 * Provides sophisticated templating with built-in templates and custom template support.
 */

import * as path from "path";
import type { OptionInfo, ParsedCommandInfo, TemplateConfig, TemplateData } from "@/docs/types.js";
import * as fs from "fs-extra";
import { getAdvancedHTMLTemplate, getAdvancedMarkdownTemplate } from "./builtin-templates.js";

/** Renders documentation templates with variable substitution and built-in template support. */
export class DocsTemplateImplementor {
  private templateCache = new Map<string, string>();

  /**
   * Render template with provided data
   */
  public render(template: string, data: TemplateData): string {
    return this.processTemplate(template, data);
  }

  /**
   * Load template from file or use built-in
   */
  public async loadTemplate(config: TemplateConfig): Promise<string> {
    // Check cache first
    const cacheKey = `${config.format}-${config.filename}`;
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    let template: string;

    // If template is a path, load from file
    if (config.template.startsWith("./") || config.template.startsWith("/")) {
      template = await fs.readFile(config.template, "utf8");
    } else {
      // Use built-in template
      template = this.getBuiltInTemplate(config);
    }

    // Cache the template
    this.templateCache.set(cacheKey, template);
    return template;
  }

  /**
   * Get built-in template for format
   */
  public getBuiltInTemplate(config: TemplateConfig): string {
    switch (config.format) {
      case "markdown":
        return getAdvancedMarkdownTemplate(config.options);
      case "html":
        return getAdvancedHTMLTemplate(config.options);
      case "json":
        return "{{json}}"; // JSON doesn't need a template, just serialization
      default:
        throw new Error(`Unknown template format: ${config.format}`);
    }
  }

  /**
   * Process template with data using simple replacement
   */
  private processTemplate(template: string, data: TemplateData): string {
    let result = template;

    // Replace simple variables
    result = result.replace(/\{\{metadata\.generatedAt\}\}/g, data.metadata.generatedAt);
    result = result.replace(/\{\{metadata\.version\}\}/g, data.metadata.version);
    result = result.replace(
      /\{\{metadata\.commandCount\}\}/g,
      data.metadata.commandCount.toString(),
    );

    // Process categories loop
    result = result.replace(
      /\{\{#each categories\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, content) => {
        return Object.entries(data.categories)
          .map(([category, commands]) => {
            let categoryContent = content;
            categoryContent = categoryContent.replace(/\{\{@key\}\}/g, category);
            categoryContent = categoryContent.replace(
              /\{\{titleCase @key\}\}/g,
              this.titleCase(category),
            );
            categoryContent = categoryContent.replace(
              /\{\{kebabCase @key\}\}/g,
              this.kebabCase(category),
            );

            // Process commands within category
            categoryContent = categoryContent.replace(
              /\{\{#each this\}\}([\s\S]*?)\{\{\/each\}\}/g,
              (cmdMatch, cmdContent) => {
                return commands.map((cmd) => this.renderCommand(cmdContent, cmd)).join("");
              },
            );

            return categoryContent;
          })
          .join("");
      },
    );

    // Process global options
    result = result.replace(
      /\{\{#each globalOptions\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, content) => {
        return data.globalOptions.map((option) => this.renderOption(content, option)).join("");
      },
    );

    // Process all commands (for search)
    result = result.replace(/\{\{#each commands\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, content) => {
      return data.commands.map((cmd) => this.renderCommand(content, cmd)).join("");
    });

    return result;
  }

  /**
   * Render a single command with template
   */
  private renderCommand(template: string, command: ParsedCommandInfo): string {
    let result = template;

    // Replace command properties
    result = result.replace(/\{\{name\}\}/g, command.name);
    result = result.replace(/\{\{fullName\}\}/g, command.fullName);
    result = result.replace(/\{\{description\}\}/g, command.description);
    result = result.replace(/\{\{usage\}\}/g, command.usage);
    result = result.replace(/\{\{kebabCase fullName\}\}/g, this.kebabCase(command.fullName));

    // Handle stability checks
    result = result.replace(
      /\{\{#eq metadata\.stability "([^"]+)"\}\}([\s\S]*?)\{\{\/eq\}\}/g,
      (match, stability, content) => {
        return command.metadata.stability === stability ? content : "";
      },
    );

    // Handle conditional sections
    result = result.replace(
      /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, content) => {
        return this.evaluateCondition(condition, command) ? content : "";
      },
    );

    // Process arrays
    result = this.processArrays(result, command);

    return result;
  }

  /**
   * Render an option with template
   */
  private renderOption(template: string, option: OptionInfo): string {
    let result = template;
    result = result.replace(/\{\{flags\}\}/g, option.flags);
    result = result.replace(/\{\{description\}\}/g, option.description);
    result = result.replace(/\{\{defaultValue\}\}/g, option.defaultValue?.toString() || "");
    return result;
  }

  /**
   * Process array iterations in templates
   */
  private processArrays(template: string, command: ParsedCommandInfo): string {
    let result = template;

    // Process arguments
    result = result.replace(
      /\{\{#each arguments\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, content) => {
        return command.arguments
          .map((arg) => {
            let argContent = content;
            argContent = argContent.replace(/\{\{name\}\}/g, arg.name);
            argContent = argContent.replace(/\{\{description\}\}/g, arg.description || "");
            argContent = argContent.replace(/\{\{required\}\}/g, arg.required.toString());
            argContent = argContent.replace(/\{\{variadic\}\}/g, arg.variadic.toString());

            // Handle conditionals for arguments
            argContent = argContent.replace(/\{\{#if required\}\}/g, arg.required ? "" : "<!--");
            argContent = argContent.replace(/\{\{#if variadic\}\}/g, arg.variadic ? "" : "<!--");
            argContent = argContent.replace(/\{\{\/if\}\}/g, "-->");

            return argContent;
          })
          .join("");
      },
    );

    // Process options
    result = result.replace(/\{\{#each options\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, content) => {
      return command.options.map((option) => this.renderOption(content, option)).join("");
    });

    // Process tags
    result = result.replace(
      /\{\{#each metadata\.tags\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, content) => {
        return command.metadata.tags.map((tag) => content.replace(/\{\{this\}\}/g, tag)).join("");
      },
    );

    // Process subcommands
    result = result.replace(
      /\{\{#each subcommands\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, content) => {
        return command.subcommands.map((sub) => content.replace(/\{\{this\}\}/g, sub)).join("");
      },
    );

    return result;
  }

  /**
   * Evaluate conditional expressions in templates
   */
  private evaluateCondition(condition: string, command: ParsedCommandInfo): boolean {
    const trimmed = condition.trim();

    if (trimmed === "arguments.length") return command.arguments.length > 0;
    if (trimmed === "options.length") return command.options.length > 0;
    if (trimmed === "examples.length") return command.examples.length > 0;
    if (trimmed === "subcommands.length") return command.subcommands.length > 0;
    if (trimmed === "metadata.tags.length") return command.metadata.tags.length > 0;

    return false;
  }

  /**
   * Helper functions for string transformations
   */
  private titleCase(str: string): string {
    return str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  private kebabCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
}
