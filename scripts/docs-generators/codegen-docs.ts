#!/usr/bin/env bun

/**
 * Code Generation Documentation Generator
 *
 * Generates comprehensive documentation for the Arbiter code generation system,
 * including templates, generators, contexts, and transformation patterns.
 */

import * as path from "path";
import chalk from "chalk";
import * as fs from "fs-extra";
import { glob } from "glob";
import Handlebars from "handlebars";

interface CodegenDocumentationOptions {
  sourceDir: string;
  outputDir: string;
  formats: ("markdown" | "json" | "html")[];
  includeTemplates: boolean;
  includeExamples: boolean;
  includeContexts: boolean;
  verbose: boolean;
  dryRun: boolean;
}

interface CodegenTemplate {
  file: string;
  name: string;
  description?: string;
  type: "handlebars" | "ejs" | "mustache" | "custom";
  category: string;
  variables: TemplateVariable[];
  partials: string[];
  helpers: string[];
  examples: TemplateExample[];
  metadata: TemplateMetadata;
}

interface TemplateVariable {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: any;
  examples?: any[];
}

interface TemplateExample {
  name: string;
  description?: string;
  context: any;
  output?: string;
}

interface TemplateMetadata {
  author?: string;
  version?: string;
  created?: string;
  updated?: string;
  tags: string[];
  outputType: string;
  language?: string;
  framework?: string;
}

interface CodegenGenerator {
  file: string;
  name: string;
  description?: string;
  templates: string[];
  contexts: string[];
  commands: GeneratorCommand[];
  metadata: GeneratorMetadata;
}

interface GeneratorCommand {
  name: string;
  description?: string;
  usage: string;
  options: CommandOption[];
  examples: CommandExample[];
}

interface CommandOption {
  name: string;
  alias?: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: any;
}

interface CommandExample {
  description: string;
  command: string;
  expectedOutput?: string;
}

interface GeneratorMetadata {
  category: string;
  targets: string[];
  dependencies: string[];
  version?: string;
  stability: "alpha" | "beta" | "stable" | "deprecated";
}

interface CodegenContext {
  file: string;
  name: string;
  description?: string;
  schema: ContextSchema;
  examples: any[];
  validation: ContextValidation;
}

interface ContextSchema {
  type: string;
  properties: Record<string, ContextProperty>;
  required: string[];
}

interface ContextProperty {
  type: string;
  description?: string;
  examples?: any[];
  validation?: string[];
}

interface ContextValidation {
  rules: ValidationRule[];
  customValidators: string[];
}

interface ValidationRule {
  field: string;
  type: "required" | "pattern" | "range" | "custom";
  value?: any;
  message?: string;
}

export async function generateCodegenDocumentation(
  options: CodegenDocumentationOptions,
): Promise<number> {
  try {
    console.log(chalk.blue("🛠️  Generating Code Generation Documentation"));
    console.log(chalk.dim(`Source: ${options.sourceDir}`));
    console.log(chalk.dim(`Output: ${options.outputDir}`));
    console.log(chalk.dim(`Formats: ${options.formats.join(", ")}`));

    // Find codegen files
    const codegenFiles = await findCodegenFiles(options.sourceDir);

    if (codegenFiles.templates.length === 0 && codegenFiles.generators.length === 0) {
      console.log(chalk.yellow("⚠️  No code generation files found"));
      return 0;
    }

    console.log(
      chalk.blue(
        `🔍 Found ${codegenFiles.templates.length} templates, ${codegenFiles.generators.length} generators, ${codegenFiles.contexts.length} contexts`,
      ),
    );

    // Parse templates
    const templates: CodegenTemplate[] = [];
    if (options.includeTemplates) {
      for (const file of codegenFiles.templates) {
        try {
          const template = await parseTemplate(file, options);
          templates.push(template);

          if (options.verbose) {
            console.log(chalk.dim(`  ✅ Parsed template ${file}`));
          }
        } catch (error) {
          console.warn(
            chalk.yellow(
              `  ⚠️  Failed to parse template ${file}: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }
      }
    }

    // Parse generators
    const generators: CodegenGenerator[] = [];
    for (const file of codegenFiles.generators) {
      try {
        const generator = await parseGenerator(file, options);
        generators.push(generator);

        if (options.verbose) {
          console.log(chalk.dim(`  ✅ Parsed generator ${file}`));
        }
      } catch (error) {
        console.warn(
          chalk.yellow(
            `  ⚠️  Failed to parse generator ${file}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }

    // Parse contexts
    const contexts: CodegenContext[] = [];
    if (options.includeContexts) {
      for (const file of codegenFiles.contexts) {
        try {
          const context = await parseContext(file, options);
          contexts.push(context);

          if (options.verbose) {
            console.log(chalk.dim(`  ✅ Parsed context ${file}`));
          }
        } catch (error) {
          console.warn(
            chalk.yellow(
              `  ⚠️  Failed to parse context ${file}: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }
      }
    }

    // Generate documentation in requested formats
    await fs.ensureDir(options.outputDir);

    const codegenData = { templates, generators, contexts };

    for (const format of options.formats) {
      await generateCodegenDocumentationFormat(format, codegenData, options);
    }

    // Generate additional files
    await generateCodegenIndex(codegenData, options);
    await generateCodegenMetrics(codegenData, options);

    console.log(chalk.green("✅ Code generation documentation completed"));
    return 0;
  } catch (error) {
    console.error(
      chalk.red("Code generation documentation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

async function findCodegenFiles(sourceDir: string): Promise<{
  templates: string[];
  generators: string[];
  contexts: string[];
}> {
  const templatePatterns = [
    path.join(sourceDir, "**/templates/**/*.{hbs,handlebars,ejs,mustache}"),
    path.join(sourceDir, "**/template/**/*.{hbs,handlebars,ejs,mustache}"),
    path.join(sourceDir, "**/*.template.*"),
  ];

  const generatorPatterns = [
    path.join(sourceDir, "**/generators/**/*.{ts,js}"),
    path.join(sourceDir, "**/generator/**/*.{ts,js}"),
    path.join(sourceDir, "**/commands/generate*.{ts,js}"),
  ];

  const contextPatterns = [
    path.join(sourceDir, "**/contexts/**/*.{ts,js,json}"),
    path.join(sourceDir, "**/context/**/*.{ts,js,json}"),
    path.join(sourceDir, "**/schemas/**/*.{ts,js,json}"),
  ];

  const templates = await findFiles(templatePatterns);
  const generators = await findFiles(generatorPatterns);
  const contexts = await findFiles(contextPatterns);

  return { templates, generators, contexts };
}

async function findFiles(patterns: string[]): Promise<string[]> {
  let files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern);
    files.push(...matches);
  }

  return [...new Set(files)].sort();
}

async function parseTemplate(
  filePath: string,
  options: CodegenDocumentationOptions,
): Promise<CodegenTemplate> {
  const content = await fs.readFile(filePath, "utf8");
  const relativePath = path.relative(options.sourceDir, filePath);
  const name = path.basename(filePath, path.extname(filePath));
  const type = determineTemplateType(filePath);

  // Extract template metadata from comments
  const metadata = extractTemplateMetadata(content, filePath);

  // Parse template variables
  const variables = extractTemplateVariables(content, type);

  // Find partials and helpers
  const partials = extractPartials(content, type);
  const helpers = extractHelpers(content, type);

  // Generate examples
  const examples = options.includeExamples
    ? await generateTemplateExamples(content, variables, type)
    : [];

  return {
    file: relativePath,
    name,
    description: metadata.description,
    type,
    category: metadata.category || "general",
    variables,
    partials,
    helpers,
    examples,
    metadata: {
      ...metadata,
      tags: metadata.tags || [],
    },
  };
}

function determineTemplateType(filePath: string): "handlebars" | "ejs" | "mustache" | "custom" {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".hbs":
    case ".handlebars":
      return "handlebars";
    case ".ejs":
      return "ejs";
    case ".mustache":
      return "mustache";
    default:
      return "custom";
  }
}

function extractTemplateMetadata(content: string, filePath: string): Partial<TemplateMetadata> {
  const metadata: Partial<TemplateMetadata> = {};

  // Look for metadata in comments
  const metadataRegex = /\/\*\*([\s\S]*?)\*\//;
  const match = content.match(metadataRegex);

  if (match) {
    const comment = match[1];

    // Extract description
    const descMatch = comment.match(/@description\s+(.*?)(?=@|$)/s);
    if (descMatch) {
      metadata.description = descMatch[1].trim().replace(/\s*\*\s*/g, " ");
    }

    // Extract author
    const authorMatch = comment.match(/@author\s+(.+)/);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim();
    }

    // Extract version
    const versionMatch = comment.match(/@version\s+(.+)/);
    if (versionMatch) {
      metadata.version = versionMatch[1].trim();
    }

    // Extract category
    const categoryMatch = comment.match(/@category\s+(.+)/);
    if (categoryMatch) {
      metadata.category = categoryMatch[1].trim();
    }

    // Extract tags
    const tagsMatch = comment.match(/@tags\s+(.+)/);
    if (tagsMatch) {
      metadata.tags = tagsMatch[1].split(",").map((t) => t.trim());
    }

    // Extract output type
    const outputMatch = comment.match(/@output\s+(.+)/);
    if (outputMatch) {
      metadata.outputType = outputMatch[1].trim();
    }

    // Extract language
    const langMatch = comment.match(/@language\s+(.+)/);
    if (langMatch) {
      metadata.language = langMatch[1].trim();
    }
  }

  // Default values
  metadata.outputType = metadata.outputType || "text";

  return metadata;
}

function extractTemplateVariables(
  content: string,
  type: "handlebars" | "ejs" | "mustache" | "custom",
): TemplateVariable[] {
  const variables: TemplateVariable[] = [];
  const variableNames = new Set<string>();

  switch (type) {
    case "handlebars":
      // Extract {{variable}} patterns
      const hbsRegex = /\{\{([^}]+)\}\}/g;
      let hbsMatch;
      while ((hbsMatch = hbsRegex.exec(content)) !== null) {
        const varExpr = hbsMatch[1].trim();
        // Skip helpers and control structures
        if (
          !varExpr.includes("#") &&
          !varExpr.includes("/") &&
          !varExpr.includes("if") &&
          !varExpr.includes("each")
        ) {
          const varName = varExpr.split(".")[0].split(" ")[0];
          if (!variableNames.has(varName)) {
            variableNames.add(varName);
            variables.push({
              name: varName,
              type: "any",
              required: true,
              description: `Template variable: ${varName}`,
            });
          }
        }
      }
      break;

    case "ejs":
      // Extract <%- variable %> and <%= variable %> patterns
      const ejsRegex = /<%[-=]?\s*([^%]+)\s*%>/g;
      let ejsMatch;
      while ((ejsMatch = ejsRegex.exec(content)) !== null) {
        const varExpr = ejsMatch[1].trim();
        // Skip control structures
        if (!varExpr.includes("if") && !varExpr.includes("for") && !varExpr.includes("function")) {
          const varName = varExpr.split(".")[0].split("[")[0];
          if (!variableNames.has(varName)) {
            variableNames.add(varName);
            variables.push({
              name: varName,
              type: "any",
              required: true,
              description: `Template variable: ${varName}`,
            });
          }
        }
      }
      break;

    case "mustache":
      // Extract {{variable}} patterns (similar to handlebars but simpler)
      const mustacheRegex = /\{\{([^}]+)\}\}/g;
      let mustacheMatch;
      while ((mustacheMatch = mustacheRegex.exec(content)) !== null) {
        const varName = mustacheMatch[1].trim();
        if (!varName.includes("#") && !varName.includes("/") && !variableNames.has(varName)) {
          variableNames.add(varName);
          variables.push({
            name: varName,
            type: "any",
            required: true,
            description: `Template variable: ${varName}`,
          });
        }
      }
      break;
  }

  return variables;
}

function extractPartials(
  content: string,
  type: "handlebars" | "ejs" | "mustache" | "custom",
): string[] {
  const partials: string[] = [];

  switch (type) {
    case "handlebars":
      const partialRegex = /\{\{>\s*([^}]+)\s*\}\}/g;
      let match;
      while ((match = partialRegex.exec(content)) !== null) {
        partials.push(match[1].trim());
      }
      break;
  }

  return [...new Set(partials)];
}

function extractHelpers(
  content: string,
  type: "handlebars" | "ejs" | "mustache" | "custom",
): string[] {
  const helpers: string[] = [];

  switch (type) {
    case "handlebars":
      // Look for helper patterns like {{helper param}}
      const helperRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+[^}]*\}\}/g;
      let match;
      while ((match = helperRegex.exec(content)) !== null) {
        const helperName = match[1];
        // Skip built-in helpers and control structures
        if (!["if", "unless", "each", "with", "lookup"].includes(helperName)) {
          helpers.push(helperName);
        }
      }
      break;
  }

  return [...new Set(helpers)];
}

async function generateTemplateExamples(
  content: string,
  variables: TemplateVariable[],
  type: "handlebars" | "ejs" | "mustache" | "custom",
): Promise<TemplateExample[]> {
  const examples: TemplateExample[] = [];

  // Generate a simple example context
  const exampleContext: any = {};
  for (const variable of variables) {
    switch (variable.type) {
      case "string":
        exampleContext[variable.name] = `example_${variable.name}`;
        break;
      case "number":
        exampleContext[variable.name] = 42;
        break;
      case "boolean":
        exampleContext[variable.name] = true;
        break;
      case "array":
        exampleContext[variable.name] = ["item1", "item2"];
        break;
      case "object":
        exampleContext[variable.name] = { key: "value" };
        break;
      default:
        exampleContext[variable.name] = `${variable.name}_value`;
    }
  }

  if (Object.keys(exampleContext).length > 0) {
    try {
      // Try to render the template with example context
      let output = "";

      if (type === "handlebars") {
        const template = Handlebars.compile(content);
        output = template(exampleContext);
      }
      // For other types, we'd need their respective engines

      examples.push({
        name: "Basic Example",
        description: "Example usage with sample data",
        context: exampleContext,
        output: output || "Output not generated",
      });
    } catch (error) {
      // Template might have syntax errors or missing helpers
      examples.push({
        name: "Basic Example",
        description: "Example context (template compilation failed)",
        context: exampleContext,
      });
    }
  }

  return examples;
}

async function parseGenerator(
  filePath: string,
  options: CodegenDocumentationOptions,
): Promise<CodegenGenerator> {
  const content = await fs.readFile(filePath, "utf8");
  const relativePath = path.relative(options.sourceDir, filePath);
  const name = path.basename(filePath, path.extname(filePath));

  // Extract generator metadata and commands
  const metadata = extractGeneratorMetadata(content);
  const commands = extractGeneratorCommands(content);
  const templates = extractGeneratorTemplates(content);
  const contexts = extractGeneratorContexts(content);

  return {
    file: relativePath,
    name,
    description: extractDescription(content),
    templates,
    contexts,
    commands,
    metadata,
  };
}

function extractGeneratorMetadata(content: string): GeneratorMetadata {
  const metadata: Partial<GeneratorMetadata> = {};

  // Look for metadata in comments
  const categoryMatch = content.match(/@category\s+(.+)/);
  if (categoryMatch) {
    metadata.category = categoryMatch[1].trim();
  }

  const targetsMatch = content.match(/@targets\s+(.+)/);
  if (targetsMatch) {
    metadata.targets = targetsMatch[1].split(",").map((t) => t.trim());
  }

  const stabilityMatch = content.match(/@stability\s+(.+)/);
  if (stabilityMatch) {
    metadata.stability = stabilityMatch[1].trim() as any;
  }

  return {
    category: metadata.category || "general",
    targets: metadata.targets || [],
    dependencies: [], // Would need more sophisticated parsing
    stability: metadata.stability || "stable",
  };
}

function extractGeneratorCommands(content: string): GeneratorCommand[] {
  const commands: GeneratorCommand[] = [];

  // Look for command registrations (Commander.js style)
  const commandRegex =
    /\.command\(\s*['"`]([^'"`]+)['"`]\s*\)[\s\S]*?\.description\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

  let match;
  while ((match = commandRegex.exec(content)) !== null) {
    const name = match[1];
    const description = match[2];

    // Extract options for this command (simplified)
    const options = extractCommandOptions(content, name);
    const examples = extractCommandExamples(content, name);

    commands.push({
      name,
      description,
      usage: `arbiter ${name} [options]`,
      options,
      examples,
    });
  }

  return commands;
}

function extractCommandOptions(content: string, commandName: string): CommandOption[] {
  const options: CommandOption[] = [];

  // Look for option registrations near the command
  const optionRegex =
    /\.option\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*([^)]+))?\s*\)/g;

  let match;
  while ((match = optionRegex.exec(content)) !== null) {
    const flags = match[1];
    const description = match[2];
    const defaultValue = match[3];

    // Parse flags to extract name and alias
    const flagParts = flags.split(",").map((f) => f.trim());
    const longFlag = flagParts.find((f) => f.startsWith("--"));
    const shortFlag = flagParts.find((f) => f.startsWith("-") && !f.startsWith("--"));

    if (longFlag) {
      const name = longFlag.substring(2);

      options.push({
        name,
        alias: shortFlag?.substring(1),
        type: "string", // Would need more sophisticated parsing
        required: false,
        description,
        defaultValue: defaultValue ? defaultValue.trim() : undefined,
      });
    }
  }

  return options;
}

function extractCommandExamples(content: string, commandName: string): CommandExample[] {
  const examples: CommandExample[] = [];

  // Look for examples in comments
  const exampleRegex = new RegExp(`// Example: arbiter ${commandName}(.*)`, "g");

  let match;
  while ((match = exampleRegex.exec(content)) !== null) {
    examples.push({
      description: `Example usage of ${commandName}`,
      command: `arbiter ${commandName}${match[1]}`,
    });
  }

  return examples;
}

function extractGeneratorTemplates(content: string): string[] {
  const templates: string[] = [];

  // Look for template references
  const templateRegex = /template['"`]?\s*:\s*['"`]([^'"`]+)['"`]/g;

  let match;
  while ((match = templateRegex.exec(content)) !== null) {
    templates.push(match[1]);
  }

  return [...new Set(templates)];
}

function extractGeneratorContexts(content: string): string[] {
  const contexts: string[] = [];

  // Look for context/schema references
  const contextRegex = /context['"`]?\s*:\s*['"`]([^'"`]+)['"`]/g;

  let match;
  while ((match = contextRegex.exec(content)) !== null) {
    contexts.push(match[1]);
  }

  return [...new Set(contexts)];
}

function extractDescription(content: string): string | undefined {
  const descMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
  if (descMatch) {
    const comment = descMatch[1];
    const lines = comment.split("\n").map((line) => line.replace(/^\s*\*\s?/, ""));
    const firstLine = lines.find((line) => line.trim() && !line.includes("@"));
    return firstLine?.trim();
  }
  return undefined;
}

async function parseContext(
  filePath: string,
  options: CodegenDocumentationOptions,
): Promise<CodegenContext> {
  const content = await fs.readFile(filePath, "utf8");
  const relativePath = path.relative(options.sourceDir, filePath);
  const name = path.basename(filePath, path.extname(filePath));

  // Parse based on file type
  let contextData: any = {};

  if (filePath.endsWith(".json")) {
    contextData = JSON.parse(content);
  } else if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
    // Extract TypeScript interfaces or exported objects
    contextData = parseTypeScriptContext(content);
  }

  const schema = extractContextSchema(contextData);
  const validation = extractContextValidation(content);
  const examples = extractContextExamples(content, contextData);

  return {
    file: relativePath,
    name,
    description: extractDescription(content),
    schema,
    examples,
    validation,
  };
}

function parseTypeScriptContext(content: string): any {
  // Simplified TypeScript interface parsing
  const interfaceRegex = /interface\s+(\w+)\s*\{([^}]+)\}/g;
  const context: any = {};

  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const interfaceName = match[1];
    const body = match[2];

    context[interfaceName] = parseInterfaceBody(body);
  }

  return context;
}

function parseInterfaceBody(body: string): any {
  const properties: any = {};
  const propRegex = /(\w+)(\?)?:\s*([^;,\n]+)/g;

  let match;
  while ((match = propRegex.exec(body)) !== null) {
    const propName = match[1];
    const optional = !!match[2];
    const type = match[3].trim();

    properties[propName] = {
      type: simplifyTypeScriptType(type),
      optional,
    };
  }

  return properties;
}

function simplifyTypeScriptType(type: string): string {
  if (type.includes("string")) return "string";
  if (type.includes("number")) return "number";
  if (type.includes("boolean")) return "boolean";
  if (type.includes("[]")) return "array";
  if (type.includes("{")) return "object";
  return type;
}

function extractContextSchema(contextData: any): ContextSchema {
  const properties: Record<string, ContextProperty> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(contextData)) {
    if (typeof value === "object" && value !== null) {
      const prop = value as any;
      properties[key] = {
        type: prop.type || "any",
        description: prop.description,
        examples: prop.examples,
      };

      if (!prop.optional) {
        required.push(key);
      }
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}

function extractContextValidation(content: string): ContextValidation {
  return {
    rules: [], // Would need more sophisticated parsing
    customValidators: [],
  };
}

function extractContextExamples(content: string, contextData: any): any[] {
  // Look for example data in comments or exports
  const examples: any[] = [];

  const exampleRegex = /\/\/ Example:([\s\S]*?)(?=\/\/|$)/g;
  let match;

  while ((match = exampleRegex.exec(content)) !== null) {
    try {
      const exampleText = match[1].trim();
      const data = JSON.parse(exampleText);
      examples.push(data);
    } catch {
      // Not valid JSON
    }
  }

  return examples;
}

async function generateCodegenDocumentationFormat(
  format: "markdown" | "json" | "html",
  data: {
    templates: CodegenTemplate[];
    generators: CodegenGenerator[];
    contexts: CodegenContext[];
  },
  options: CodegenDocumentationOptions,
): Promise<void> {
  console.log(chalk.blue(`📄 Generating ${format} code generation documentation...`));

  const outputFile = path.join(options.outputDir, `code-generation.${format}`);

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${outputFile}`));
    return;
  }

  switch (format) {
    case "json":
      await generateJsonFormat(data, outputFile);
      break;
    case "markdown":
      await generateMarkdownFormat(data, outputFile, options);
      break;
    case "html":
      await generateHtmlFormat(data, outputFile, options);
      break;
  }

  console.log(chalk.green(`  ✅ Generated ${format} documentation`));
}

async function generateJsonFormat(
  data: {
    templates: CodegenTemplate[];
    generators: CodegenGenerator[];
    contexts: CodegenContext[];
  },
  outputFile: string,
): Promise<void> {
  const jsonData = {
    generatedAt: new Date().toISOString(),
    generatedBy: "Arbiter Code Generation Documentation Generator",
    version: "1.0.0",
    ...data,
    statistics: {
      totalTemplates: data.templates.length,
      totalGenerators: data.generators.length,
      totalContexts: data.contexts.length,
      templatesByType: groupBy(data.templates, "type"),
      generatorsByCategory: groupBy(data.generators, (t) => t.metadata.category),
    },
  };

  await fs.writeFile(outputFile, JSON.stringify(jsonData, null, 2), "utf8");
}

async function generateMarkdownFormat(
  data: {
    templates: CodegenTemplate[];
    generators: CodegenGenerator[];
    contexts: CodegenContext[];
  },
  outputFile: string,
  options: CodegenDocumentationOptions,
): Promise<void> {
  let content = `# Code Generation System Reference

Generated on ${new Date().toISOString()}

## Overview

This document provides comprehensive documentation for the Arbiter code generation system, including templates, generators, and contexts.

- **Total Templates**: ${data.templates.length}
- **Total Generators**: ${data.generators.length}
- **Total Contexts**: ${data.contexts.length}

## Table of Contents

- [Templates](#templates)
- [Generators](#generators)
- [Contexts](#contexts)

`;

  // Templates section
  if (data.templates.length > 0) {
    content += "## Templates\n\n";

    const templatesByCategory = groupBy(data.templates, "category");

    for (const [category, templates] of Object.entries(templatesByCategory)) {
      content += `### ${category}\n\n`;

      for (const template of templates) {
        content += `#### ${template.name}\n\n`;
        content += `**File**: \`${template.file}\`\n`;
        content += `**Type**: ${template.type}\n\n`;

        if (template.description) {
          content += `${template.description}\n\n`;
        }

        if (template.variables.length > 0) {
          content += "**Variables**:\n\n";
          content += "| Name | Type | Required | Description |\n";
          content += "|------|------|----------|-------------|\n";

          for (const variable of template.variables) {
            const required = variable.required ? "Yes" : "No";
            const description = variable.description || "";
            content += `| \`${variable.name}\` | \`${variable.type}\` | ${required} | ${description} |\n`;
          }
          content += "\n";
        }

        if (template.partials.length > 0) {
          content +=
            "**Partials**: " + template.partials.map((p) => `\`${p}\``).join(", ") + "\n\n";
        }

        if (template.helpers.length > 0) {
          content += "**Helpers**: " + template.helpers.map((h) => `\`${h}\``).join(", ") + "\n\n";
        }

        if (template.examples.length > 0 && options.includeExamples) {
          content += "**Examples**:\n\n";

          for (const example of template.examples) {
            if (example.name) {
              content += `**${example.name}**:\n\n`;
            }

            if (example.description) {
              content += `${example.description}\n\n`;
            }

            content += "```json\n";
            content += JSON.stringify(example.context, null, 2);
            content += "\n```\n\n";

            if (example.output) {
              content += "Output:\n\n";
              content += "```\n";
              content += example.output;
              content += "\n```\n\n";
            }
          }
        }

        content += "---\n\n";
      }
    }
  }

  // Generators section
  if (data.generators.length > 0) {
    content += "## Generators\n\n";

    const generatorsByCategory = groupBy(data.generators, (g) => g.metadata.category);

    for (const [category, generators] of Object.entries(generatorsByCategory)) {
      content += `### ${category}\n\n`;

      for (const generator of generators) {
        content += `#### ${generator.name}\n\n`;
        content += `**File**: \`${generator.file}\`\n\n`;

        if (generator.description) {
          content += `${generator.description}\n\n`;
        }

        if (generator.metadata.targets.length > 0) {
          content +=
            "**Targets**: " + generator.metadata.targets.map((t) => `\`${t}\``).join(", ") + "\n\n";
        }

        content += `**Stability**: ${generator.metadata.stability}\n\n`;

        if (generator.commands.length > 0) {
          content += "**Commands**:\n\n";

          for (const command of generator.commands) {
            content += `##### ${command.name}\n\n`;

            if (command.description) {
              content += `${command.description}\n\n`;
            }

            content += `**Usage**: \`${command.usage}\`\n\n`;

            if (command.options.length > 0) {
              content += "**Options**:\n\n";
              content += "| Option | Type | Required | Description |\n";
              content += "|--------|------|----------|-------------|\n";

              for (const option of command.options) {
                const optionName = option.alias
                  ? `-${option.alias}, --${option.name}`
                  : `--${option.name}`;
                const required = option.required ? "Yes" : "No";
                const description = option.description || "";
                content += `| \`${optionName}\` | \`${option.type}\` | ${required} | ${description} |\n`;
              }
              content += "\n";
            }

            if (command.examples.length > 0) {
              content += "**Examples**:\n\n";

              for (const example of command.examples) {
                content += `${example.description}:\n\n`;
                content += "```bash\n";
                content += example.command;
                content += "\n```\n\n";
              }
            }
          }
        }

        content += "---\n\n";
      }
    }
  }

  // Contexts section
  if (data.contexts.length > 0 && options.includeContexts) {
    content += "## Contexts\n\n";

    for (const context of data.contexts) {
      content += `### ${context.name}\n\n`;
      content += `**File**: \`${context.file}\`\n\n`;

      if (context.description) {
        content += `${context.description}\n\n`;
      }

      if (context.schema.properties && Object.keys(context.schema.properties).length > 0) {
        content += "**Properties**:\n\n";
        content += "| Property | Type | Required | Description |\n";
        content += "|----------|------|----------|-------------|\n";

        for (const [propName, prop] of Object.entries(context.schema.properties)) {
          const required = context.schema.required.includes(propName) ? "Yes" : "No";
          const description = prop.description || "";
          content += `| \`${propName}\` | \`${prop.type}\` | ${required} | ${description} |\n`;
        }
        content += "\n";
      }

      if (context.examples.length > 0) {
        content += "**Examples**:\n\n";

        for (const example of context.examples) {
          content += "```json\n";
          content += JSON.stringify(example, null, 2);
          content += "\n```\n\n";
        }
      }

      content += "---\n\n";
    }
  }

  await fs.writeFile(outputFile, content, "utf8");
}

async function generateHtmlFormat(
  data: {
    templates: CodegenTemplate[];
    generators: CodegenGenerator[];
    contexts: CodegenContext[];
  },
  outputFile: string,
  options: CodegenDocumentationOptions,
): Promise<void> {
  // Convert markdown to HTML (simplified approach)
  const markdownFile = outputFile.replace(".html", ".md");
  await generateMarkdownFormat(data, markdownFile, options);

  const markdown = await fs.readFile(markdownFile, "utf8");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Generation System Reference - Arbiter</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3, h4 { color: #2563eb; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background-color: #f8f9fa; }
        code { background-color: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
        pre { background-color: #f8f9fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
        .template { border-left: 4px solid #10b981; padding-left: 16px; margin: 20px 0; }
        .generator { border-left: 4px solid #f59e0b; padding-left: 16px; margin: 20px 0; }
        .context { border-left: 4px solid #8b5cf6; padding-left: 16px; margin: 20px 0; }
    </style>
</head>
<body>
${markdown
  .replace(/^# (.+)$/gm, "<h1>$1</h1>")
  .replace(/^## (.+)$/gm, "<h2>$1</h2>")
  .replace(/^### (.+)$/gm, "<h3>$1</h3>")
  .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\`(.+?)\`/g, "<code>$1</code>")
  .replace(/^- (.+)$/gm, "<li>$1</li>")
  .replace(/(\<li\>.*\<\/li\>)/gs, "<ul>$1</ul>")
  .replace(/\n/g, "<br>")}
</body>
</html>`;

  await fs.writeFile(outputFile, html, "utf8");

  // Clean up temporary markdown file
  await fs.remove(markdownFile);
}

function groupBy<T>(array: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  for (const item of array) {
    const groupKey = typeof key === "function" ? key(item) : String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  }

  return groups;
}

async function generateCodegenIndex(
  data: {
    templates: CodegenTemplate[];
    generators: CodegenGenerator[];
    contexts: CodegenContext[];
  },
  options: CodegenDocumentationOptions,
): Promise<void> {
  const indexFile = path.join(options.outputDir, "codegen-index.json");

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${indexFile}`));
    return;
  }

  const index = {
    generatedAt: new Date().toISOString(),
    summary: {
      templates: data.templates.length,
      generators: data.generators.length,
      contexts: data.contexts.length,
    },
    templates: data.templates.map((t) => ({
      name: t.name,
      file: t.file,
      type: t.type,
      category: t.category,
      variables: t.variables.length,
    })),
    generators: data.generators.map((g) => ({
      name: g.name,
      file: g.file,
      category: g.metadata.category,
      commands: g.commands.length,
      stability: g.metadata.stability,
    })),
    contexts: data.contexts.map((c) => ({
      name: c.name,
      file: c.file,
      properties: Object.keys(c.schema.properties).length,
    })),
  };

  await fs.writeFile(indexFile, JSON.stringify(index, null, 2), "utf8");
  console.log(chalk.green("  ✅ Generated codegen index"));
}

async function generateCodegenMetrics(
  data: {
    templates: CodegenTemplate[];
    generators: CodegenGenerator[];
    contexts: CodegenContext[];
  },
  options: CodegenDocumentationOptions,
): Promise<void> {
  const metricsFile = path.join(options.outputDir, "codegen-metrics.json");

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${metricsFile}`));
    return;
  }

  const metrics = {
    generatedAt: new Date().toISOString(),
    overview: {
      totalTemplates: data.templates.length,
      totalGenerators: data.generators.length,
      totalContexts: data.contexts.length,
      totalVariables: data.templates.reduce((sum, t) => sum + t.variables.length, 0),
      totalCommands: data.generators.reduce((sum, g) => sum + g.commands.length, 0),
    },
    templateMetrics: {
      byType: groupBy(data.templates, "type"),
      byCategory: groupBy(data.templates, "category"),
      averageVariablesPerTemplate:
        data.templates.length > 0
          ? data.templates.reduce((sum, t) => sum + t.variables.length, 0) / data.templates.length
          : 0,
      templatesWithExamples: data.templates.filter((t) => t.examples.length > 0).length,
      templatesWithHelpers: data.templates.filter((t) => t.helpers.length > 0).length,
    },
    generatorMetrics: {
      byCategory: groupBy(data.generators, (g) => g.metadata.category),
      byStability: groupBy(data.generators, (g) => g.metadata.stability),
      averageCommandsPerGenerator:
        data.generators.length > 0
          ? data.generators.reduce((sum, g) => sum + g.commands.length, 0) / data.generators.length
          : 0,
    },
    contextMetrics: {
      averagePropertiesPerContext:
        data.contexts.length > 0
          ? data.contexts.reduce((sum, c) => sum + Object.keys(c.schema.properties).length, 0) /
            data.contexts.length
          : 0,
      contextsWithExamples: data.contexts.filter((c) => c.examples.length > 0).length,
      contextsWithValidation: data.contexts.filter((c) => c.validation.rules.length > 0).length,
    },
  };

  await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2), "utf8");
  console.log(chalk.green("  ✅ Generated codegen metrics"));
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const defaultOptions: CodegenDocumentationOptions = {
    sourceDir: "./packages/cli/src",
    outputDir: "./docs",
    formats: ["markdown", "json"],
    includeTemplates: true,
    includeExamples: true,
    includeContexts: true,
    verbose: false,
    dryRun: false,
  };

  generateCodegenDocumentation(defaultOptions)
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    });
}
