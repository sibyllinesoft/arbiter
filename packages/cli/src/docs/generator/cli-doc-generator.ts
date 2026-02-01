/**
 * CLI Documentation Generator
 *
 * Extracts command structure, options, and help text from Commander.js
 * command definitions to generate comprehensive CLI documentation.
 */

import * as path from "path";
import { safeFileOperation } from "@/constraints/index.js";
import type { CommandMetadata, DocGenerationOptions, ParsedCommandInfo } from "@/docs/types.js";
import type { Command, Option } from "commander";
import * as fs from "fs-extra";

/** Generates documentation from Commander.js command definitions. */
export class CLIDocumentationGenerator {
  private commands: ParsedCommandInfo[] = [];
  private rootCommand?: Command;

  /**
   * Initialize the generator with the root command
   */
  constructor(rootCommand: Command) {
    this.rootCommand = rootCommand;
  }

  /**
   * Parse all commands from the Commander.js program structure
   */
  public parseCommands(): ParsedCommandInfo[] {
    if (!this.rootCommand) {
      throw new Error("No root command provided");
    }

    this.commands = [];
    this.parseCommand(this.rootCommand, []);
    return this.commands;
  }

  /**
   * Recursively parse a command and its subcommands
   */
  private parseCommand(command: Command, parentNames: string[]): void {
    const cmdInfo = this.extractCommandInfo(command, parentNames);

    // Only add non-root commands or root if it has actions
    if (parentNames.length > 0 || this.hasAction(command)) {
      this.commands.push(cmdInfo);
    }

    // Parse subcommands
    for (const subCmd of command.commands) {
      const newPath =
        parentNames.length === 0 && !this.hasAction(command)
          ? parentNames
          : [...parentNames, command.name()];
      this.parseCommand(subCmd, newPath);
    }
  }

  /**
   * Check if command has an action (is executable)
   */
  private hasAction(command: Command): boolean {
    return !!(command as any)._actionHandler;
  }

  /**
   * Extract detailed information from a command
   */
  private extractCommandInfo(command: Command, parentNames: string[]): ParsedCommandInfo {
    const fullName = [...parentNames, command.name()].filter(Boolean).join(" ");
    const args = this.extractArguments(command);
    const options = this.extractOptions(command);
    const examples = this.extractExamplesFromDescription(command.description() || "");

    return {
      name: command.name(),
      fullName,
      parentNames,
      description: command.description() || "",
      usage: this.generateUsage(fullName, args, options),
      arguments: args,
      options,
      examples,
      metadata: this.extractMetadata(command),
      subcommands: command.commands.map((sub) => sub.name()),
      isExecutable: this.hasAction(command),
      help: this.getCommandHelp(command),
    };
  }

  /**
   * Extract command arguments
   */
  private extractArguments(command: Command): Array<{
    name: string;
    required: boolean;
    variadic: boolean;
    description?: string;
  }> {
    const args: Array<{
      name: string;
      required: boolean;
      variadic: boolean;
      description?: string;
    }> = [];

    // Get arguments from Commander.js internal structure
    const cmdArgs = (command as any)._args || [];

    for (const arg of cmdArgs) {
      args.push({
        name: arg.name,
        required: arg.required,
        variadic: arg.variadic,
        description: arg.description,
      });
    }

    return args;
  }

  /**
   * Extract command options
   */
  private extractOptions(command: Command): Array<{
    flags: string;
    description: string;
    required: boolean;
    defaultValue?: any;
    choices?: string[];
  }> {
    return command.options.map((option) => ({
      flags: option.flags,
      description: option.description || "",
      required: option.required,
      defaultValue: option.defaultValue,
      choices: (option as any).choices,
    }));
  }

  /**
   * Generate usage string for command
   */
  private generateUsage(fullName: string, args: any[], options: any[]): string {
    let usage = `arbiter ${fullName}`;

    // Add arguments
    for (const arg of args) {
      if (arg.required) {
        usage += arg.variadic ? ` <${arg.name}...>` : ` <${arg.name}>`;
      } else {
        usage += arg.variadic ? ` [${arg.name}...]` : ` [${arg.name}]`;
      }
    }

    // Add options indicator
    if (options.length > 0) {
      usage += " [options]";
    }

    return usage;
  }

  /**
   * Extract examples from description text
   */
  private extractExamplesFromDescription(description: string): string[] {
    const examples: string[] = [];

    // Look for example patterns in description
    const exampleMatches = description.match(/(?:example|usage):\s*([^\n]+)/gi);
    if (exampleMatches) {
      examples.push(
        ...exampleMatches.map((match) => match.replace(/^(?:example|usage):\s*/i, "").trim()),
      );
    }

    return examples;
  }

  /**
   * Extract metadata from command
   */
  private extractMetadata(command: Command): CommandMetadata {
    return {
      version: this.rootCommand?.version() || "1.0.0",
      category: this.categorizeCommand(command.name()),
      tags: this.extractTags(command),
      stability: "stable", // Default, could be parsed from comments
    };
  }

  /**
   * Categorize command by name/purpose
   */
  private categorizeCommand(name: string): string {
    const categories: Record<string, string> = {
      init: "project",
      add: "specification",
      remove: "specification",
      check: "validation",
      watch: "development",
      surface: "extraction",
      generate: "generation",
      docs: "documentation",
      examples: "generation",
      execute: "execution",
      rename: "management",
      version: "release",
      sync: "integration",
      integrate: "integration",
      "github-templates": "integration",
      import: "utilities",
      tests: "testing",
      group: "project-management",
      task: "project-management",
      auth: "authentication",
      health: "diagnostics",
      list: "inspection",
      status: "inspection",
      diff: "analysis",
    };

    return categories[name] || "general";
  }

  /**
   * Tag extraction rules
   */
  private static readonly TAG_RULES: Array<{
    tag: string;
    check: (desc: string, command: Command) => boolean;
  }> = [
    { tag: "agent-friendly", check: (d) => d.includes("agent") || d.includes("ai") },
    {
      tag: "safe-mode",
      check: (d, c) =>
        d.includes("dry-run") || c.options.some((opt) => opt.flags.includes("dry-run")),
    },
    { tag: "real-time", check: (d) => d.includes("watch") || d.includes("live") },
    { tag: "generative", check: (d) => d.includes("generate") || d.includes("create") },
    { tag: "validation", check: (d) => d.includes("validate") || d.includes("check") },
  ];

  /**
   * Extract tags from command for organization
   */
  private extractTags(command: Command): string[] {
    const description = command.description().toLowerCase();
    return CLIDocumentationGenerator.TAG_RULES.filter((rule) =>
      rule.check(description, command),
    ).map((rule) => rule.tag);
  }

  /**
   * Get formatted help text for command
   */
  private captureStdout(fn: () => void): string {
    const originalWrite = process.stdout.write;
    let captured = "";

    process.stdout.write = function (chunk: any): boolean {
      captured += chunk;
      return true;
    };

    try {
      fn();
    } finally {
      process.stdout.write = originalWrite;
    }

    return captured.trim();
  }

  private getCommandHelp(command: Command): string {
    try {
      return this.captureStdout(() => {
        try {
          command.outputHelp();
        } catch {
          // Help output might throw, that's ok
        }
      });
    } catch {
      return `Help for ${command.name()}`;
    }
  }

  /**
   * Generate documentation in multiple formats
   */
  public async generateDocumentation(options: DocGenerationOptions): Promise<void> {
    const commands = this.parseCommands();

    if (options.formats.includes("markdown")) {
      await this.generateMarkdown(commands, options);
    }

    if (options.formats.includes("json")) {
      await this.generateJSON(commands, options);
    }

    if (options.formats.includes("html")) {
      await this.generateHTML(commands, options);
    }
  }

  /**
   * Generate comprehensive markdown documentation
   */
  private async generateMarkdown(
    commands: ParsedCommandInfo[],
    options: DocGenerationOptions,
  ): Promise<void> {
    const template = await this.loadTemplate("markdown");
    const content = this.renderMarkdownTemplate(template, commands);

    const outputFile = path.join(options.outputDir, "cli-reference.md");
    await fs.ensureDir(options.outputDir);
    await this.writeOutputFile(outputFile, content);

    console.log(`✅ Generated markdown documentation: ${outputFile}`);
  }

  /**
   * Generate JSON documentation
   */
  private async generateJSON(
    commands: ParsedCommandInfo[],
    options: DocGenerationOptions,
  ): Promise<void> {
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: this.rootCommand?.version() || "1.0.0",
        commandCount: commands.length,
      },
      commands,
    };

    const outputFile = path.join(options.outputDir, "cli-reference.json");
    await fs.ensureDir(options.outputDir);
    await this.writeOutputFile(outputFile, JSON.stringify(data, null, 2));

    console.log(`✅ Generated JSON documentation: ${outputFile}`);
  }

  /**
   * Generate HTML documentation
   */
  private async generateHTML(
    commands: ParsedCommandInfo[],
    options: DocGenerationOptions,
  ): Promise<void> {
    const template = await this.loadTemplate("html");
    const content = this.renderHTMLTemplate(template, commands);

    const outputFile = path.join(options.outputDir, "cli-reference.html");
    await fs.ensureDir(options.outputDir);
    await this.writeOutputFile(outputFile, content);

    console.log(`✅ Generated HTML documentation: ${outputFile}`);
  }

  private async writeOutputFile(filePath: string, content: string): Promise<void> {
    await safeFileOperation("write", filePath, async (validatedPath) => {
      await fs.writeFile(validatedPath, content, "utf8");
    });
  }

  /**
   * Load template from templates directory
   */
  private async loadTemplate(format: string): Promise<string> {
    const templatePath = path.join(__dirname, "templates", `${format}.hbs`);

    if (await fs.pathExists(templatePath)) {
      return fs.readFile(templatePath, "utf8");
    }

    // Return built-in template if file doesn't exist
    return this.getBuiltInTemplate(format);
  }

  /**
   * Get built-in template for format
   */
  private getBuiltInTemplate(format: string): string {
    switch (format) {
      case "markdown":
        return this.getMarkdownTemplate();
      case "html":
        return this.getHTMLTemplate();
      default:
        throw new Error(`Unknown template format: ${format}`);
    }
  }

  /**
   * Built-in markdown template
   */
  private getMarkdownTemplate(): string {
    return `# Arbiter CLI Reference

> Generated on {{generatedAt}}

## Overview

The Arbiter CLI is a CUE-based specification validation and management tool with agent-first automation capabilities.

{{#each categories}}
## {{@key}} Commands

{{#each this}}
### \`{{fullName}}\`

{{description}}

**Usage:** \`{{usage}}\`

{{#if arguments.length}}
**Arguments:**

{{#each arguments}}
- \`{{name}}\`{{#if required}} (required){{/if}}{{#if variadic}} (variadic){{/if}}{{#if description}} - {{description}}{{/if}}
{{/each}}
{{/if}}

{{#if options.length}}
**Options:**

{{#each options}}
- \`{{flags}}\`{{#if description}} - {{description}}{{/if}}{{#if defaultValue}} (default: {{defaultValue}}){{/if}}
{{/each}}
{{/if}}

{{#if examples.length}}
**Examples:**

{{#each examples}}
\`\`\`bash
{{this}}
\`\`\`
{{/each}}
{{/if}}

{{#if subcommands.length}}
**Subcommands:** {{subcommands}}
{{/if}}

---

{{/each}}
{{/each}}

## Global Options

- \`-c, --config <path>\` - path to configuration file
- \`--no-color\` - disable colored output
- \`--api-url <url>\` - API server URL
- \`--timeout <ms>\` - request timeout in milliseconds
- \`--local\` - operate in offline mode using local CUE files only

## Exit Codes

- \`0\` - Success
- \`1\` - Command error (validation failure, file not found, etc.)
- \`2\` - Configuration error (server unreachable, config invalid)
`;
  }

  /**
   * Built-in HTML template
   */
  private getHTMLTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Arbiter CLI Reference</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; margin: 40px; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .command { margin-bottom: 30px; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .command-name { font-family: 'Monaco', 'Menlo', monospace; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
        .usage { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; }
        .options, .arguments { margin: 15px 0; }
        .option, .argument { margin: 5px 0; padding-left: 20px; }
        .flag { font-family: monospace; font-weight: bold; }
        .nav { position: fixed; top: 20px; right: 20px; background: white; border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Arbiter CLI Reference</h1>
        <p>Generated on {{generatedAt}}</p>
        <p>The Arbiter CLI is a CUE-based specification validation and management tool with agent-first automation capabilities.</p>
    </div>

    <div class="nav">
        <h4>Quick Navigation</h4>
        {{#each categories}}
        <div><a href="#{{@key}}">{{@key}} Commands</a></div>
        {{/each}}
    </div>

    {{#each categories}}
    <section id="{{@key}}">
        <h2>{{@key}} Commands</h2>
        {{#each this}}
        <div class="command">
            <h3><span class="command-name">{{fullName}}</span></h3>
            <p>{{description}}</p>
            <div class="usage"><strong>Usage:</strong> {{usage}}</div>
            
            {{#if arguments.length}}
            <div class="arguments">
                <h4>Arguments:</h4>
                {{#each arguments}}
                <div class="argument">
                    <span class="flag">{{name}}</span>{{#if required}} (required){{/if}}{{#if variadic}} (variadic){{/if}}
                    {{#if description}} - {{description}}{{/if}}
                </div>
                {{/each}}
            </div>
            {{/if}}

            {{#if options.length}}
            <div class="options">
                <h4>Options:</h4>
                {{#each options}}
                <div class="option">
                    <span class="flag">{{flags}}</span>{{#if description}} - {{description}}{{/if}}
                    {{#if defaultValue}} (default: {{defaultValue}}){{/if}}
                </div>
                {{/each}}
            </div>
            {{/if}}

            {{#if subcommands.length}}
            <p><strong>Subcommands:</strong> {{subcommands}}</p>
            {{/if}}
        </div>
        {{/each}}
    </section>
    {{/each}}
</body>
</html>`;
  }

  /**
   * Render markdown template with data
   */
  private renderMarkdownTemplate(template: string, commands: ParsedCommandInfo[]): string {
    const categorizedCommands = this.categorizeCommands(commands);

    return template
      .replace("{{generatedAt}}", new Date().toISOString())
      .replace("{{#each categories}}", this.renderCategories(categorizedCommands))
      .replace("{{/each}}", "");
  }

  /**
   * Render HTML template with data
   */
  private renderHTMLTemplate(template: string, commands: ParsedCommandInfo[]): string {
    const categorizedCommands = this.categorizeCommands(commands);

    return template
      .replace("{{generatedAt}}", new Date().toISOString())
      .replace(
        /\{\{#each categories\}\}[\s\S]*?\{\{\/each\}\}/g,
        this.renderCategoriesHTML(categorizedCommands),
      );
  }

  /**
   * Categorize commands by their metadata category
   */
  private categorizeCommands(commands: ParsedCommandInfo[]): Record<string, ParsedCommandInfo[]> {
    const categories: Record<string, ParsedCommandInfo[]> = {};

    for (const command of commands) {
      const category = command.metadata.category;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(command);
    }

    return categories;
  }

  /**
   * Render arguments section for markdown
   */
  private renderArgumentsMd(command: ParsedCommandInfo): string {
    if (command.arguments.length === 0) return "";
    let content = "**Arguments:**\n\n";
    for (const arg of command.arguments) {
      content += `- \`${arg.name}\`${arg.required ? " (required)" : ""}${arg.variadic ? " (variadic)" : ""}`;
      if (arg.description) content += ` - ${arg.description}`;
      content += "\n";
    }
    return content + "\n";
  }

  /**
   * Render options section for markdown
   */
  private renderOptionsMd(command: ParsedCommandInfo): string {
    if (command.options.length === 0) return "";
    let content = "**Options:**\n\n";
    for (const option of command.options) {
      content += `- \`${option.flags}\``;
      if (option.description) content += ` - ${option.description}`;
      if (option.defaultValue !== undefined) content += ` (default: ${option.defaultValue})`;
      content += "\n";
    }
    return content + "\n";
  }

  /**
   * Render examples section for markdown
   */
  private renderExamplesMd(command: ParsedCommandInfo): string {
    if (command.examples.length === 0) return "";
    let content = "**Examples:**\n\n";
    for (const example of command.examples) {
      content += `\`\`\`bash\n${example}\n\`\`\`\n`;
    }
    return content + "\n";
  }

  /**
   * Render a single command for markdown
   */
  private renderCommandMd(command: ParsedCommandInfo): string {
    let content = `### \`${command.fullName}\`\n\n`;
    content += `${command.description}\n\n`;
    content += `**Usage:** \`${command.usage}\`\n\n`;
    content += this.renderArgumentsMd(command);
    content += this.renderOptionsMd(command);
    content += this.renderExamplesMd(command);
    if (command.subcommands.length > 0) {
      content += `**Subcommands:** ${command.subcommands.join(", ")}\n\n`;
    }
    content += "---\n\n";
    return content;
  }

  /**
   * Render categories for markdown
   */
  private renderCategories(categorizedCommands: Record<string, ParsedCommandInfo[]>): string {
    let content = "";
    for (const [category, commands] of Object.entries(categorizedCommands)) {
      content += `\n## ${category.charAt(0).toUpperCase() + category.slice(1)} Commands\n\n`;
      for (const command of commands) {
        content += this.renderCommandMd(command);
      }
    }
    return content;
  }

  /**
   * Render arguments section for HTML
   */
  private renderArgumentsHtml(command: ParsedCommandInfo): string {
    if (command.arguments.length === 0) return "";
    let content = '<div class="arguments"><h4>Arguments:</h4>';
    for (const arg of command.arguments) {
      content += '<div class="argument">';
      content += `<span class="flag">${arg.name}</span>${arg.required ? " (required)" : ""}${arg.variadic ? " (variadic)" : ""}`;
      if (arg.description) content += ` - ${arg.description}`;
      content += "</div>";
    }
    return content + "</div>";
  }

  /**
   * Render options section for HTML
   */
  private renderOptionsHtml(command: ParsedCommandInfo): string {
    if (command.options.length === 0) return "";
    let content = '<div class="options"><h4>Options:</h4>';
    for (const option of command.options) {
      content += '<div class="option">';
      content += `<span class="flag">${option.flags}</span>`;
      if (option.description) content += ` - ${option.description}`;
      if (option.defaultValue !== undefined) content += ` (default: ${option.defaultValue})`;
      content += "</div>";
    }
    return content + "</div>";
  }

  /**
   * Render a single command for HTML
   */
  private renderCommandHtml(command: ParsedCommandInfo): string {
    let content = '<div class="command">';
    content += `<h3><span class="command-name">${command.fullName}</span></h3>`;
    content += `<p>${command.description}</p>`;
    content += `<div class="usage"><strong>Usage:</strong> ${command.usage}</div>`;
    content += this.renderArgumentsHtml(command);
    content += this.renderOptionsHtml(command);
    if (command.subcommands.length > 0) {
      content += `<p><strong>Subcommands:</strong> ${command.subcommands.join(", ")}</p>`;
    }
    content += "</div>";
    return content;
  }

  /**
   * Render categories for HTML
   */
  private renderCategoriesHTML(categorizedCommands: Record<string, ParsedCommandInfo[]>): string {
    let content = "";
    for (const [category, commands] of Object.entries(categorizedCommands)) {
      content += `<section id="${category}">`;
      content += `<h2>${category.charAt(0).toUpperCase() + category.slice(1)} Commands</h2>`;
      for (const command of commands) {
        content += this.renderCommandHtml(command);
      }
      content += "</section>";
    }

    return content;
  }
}
