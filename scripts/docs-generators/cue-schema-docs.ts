#!/usr/bin/env bun

/**
 * CUE Schema Documentation Generator
 *
 * Generates comprehensive documentation for CUE schemas used in the Arbiter project.
 * Extracts schema definitions, constraints, examples, and relationships.
 */

import { spawn } from "child_process";
import * as path from "path";
import { promisify } from "util";
import chalk from "chalk";
import * as fs from "fs-extra";
import { glob } from "glob";

interface CueSchemaInfo {
  file: string;
  package: string;
  definitions: CueDefinition[];
  imports: CueImport[];
  constraints: CueConstraint[];
  examples: CueExample[];
}

interface CueDefinition {
  name: string;
  type: string;
  description?: string;
  fields?: CueField[];
  constraints?: string[];
  examples?: any[];
  deprecated?: boolean;
  since?: string;
}

interface CueField {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  constraints?: string[];
  defaultValue?: any;
}

interface CueImport {
  package: string;
  alias?: string;
  url?: string;
}

interface CueConstraint {
  field: string;
  type: "validation" | "default" | "required";
  value: any;
  description?: string;
}

interface CueExample {
  name?: string;
  description?: string;
  data: any;
  valid: boolean;
}

interface CueDocsOptions {
  sourceDir: string;
  outputDir: string;
  formats: ("markdown" | "json" | "html")[];
  includeExamples: boolean;
  includeConstraints: boolean;
  includeRelationships: boolean;
  packageFilter?: string;
  verbose: boolean;
  dryRun: boolean;
}

const execAsync = promisify(spawn);

export async function generateCueSchemaDocumentation(options: CueDocsOptions): Promise<number> {
  try {
    console.log(chalk.blue("📋 Generating CUE Schema Documentation"));
    console.log(chalk.dim(`Source: ${options.sourceDir}`));
    console.log(chalk.dim(`Output: ${options.outputDir}`));
    console.log(chalk.dim(`Formats: ${options.formats.join(", ")}`));

    // Find all CUE files
    const cueFiles = await findCueFiles(options.sourceDir, options.packageFilter);

    if (cueFiles.length === 0) {
      console.log(chalk.yellow("⚠️  No CUE files found"));
      return 0;
    }

    console.log(chalk.blue(`🔍 Found ${cueFiles.length} CUE files`));

    // Parse each CUE file
    const schemas: CueSchemaInfo[] = [];
    for (const file of cueFiles) {
      try {
        const schema = await parseCueFile(file, options);
        schemas.push(schema);

        if (options.verbose) {
          console.log(chalk.dim(`  ✅ Parsed ${file}`));
        }
      } catch (error) {
        console.warn(
          chalk.yellow(
            `  ⚠️  Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }

    if (schemas.length === 0) {
      console.log(chalk.red("❌ No valid CUE schemas found"));
      return 1;
    }

    // Build relationships between schemas
    const relationships = options.includeRelationships
      ? await buildSchemaRelationships(schemas)
      : {};

    // Generate documentation in requested formats
    await fs.ensureDir(options.outputDir);

    for (const format of options.formats) {
      await generateSchemaDocumentationFormat(format, schemas, relationships, options);
    }

    // Generate additional files
    await generateSchemaIndex(schemas, options);
    await generateSchemaMetrics(schemas, options);

    console.log(chalk.green("✅ CUE Schema documentation generation completed"));
    return 0;
  } catch (error) {
    console.error(
      chalk.red("CUE Schema documentation generation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

async function findCueFiles(sourceDir: string, packageFilter?: string): Promise<string[]> {
  const patterns = [path.join(sourceDir, "**/*.cue"), path.join(sourceDir, "**/*.CUE")];

  let files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern);
    files.push(...matches);
  }

  // Remove duplicates and filter by package if specified
  files = [...new Set(files)];

  if (packageFilter) {
    files = files.filter((file) => file.includes(packageFilter));
  }

  return files.sort();
}

async function parseCueFile(filePath: string, options: CueDocsOptions): Promise<CueSchemaInfo> {
  const content = await fs.readFile(filePath, "utf8");
  const relativePath = path.relative(options.sourceDir, filePath);

  // Parse package declaration
  const packageMatch = content.match(/^package\s+(\w+)/m);
  const packageName = packageMatch ? packageMatch[1] : "default";

  // Parse imports
  const imports = parseImports(content);

  // Parse definitions
  const definitions = parseDefinitions(content, filePath);

  // Parse constraints
  const constraints = options.includeConstraints ? parseConstraints(content, definitions) : [];

  // Parse examples
  const examples = options.includeExamples ? await parseExamples(content, filePath) : [];

  return {
    file: relativePath,
    package: packageName,
    definitions,
    imports,
    constraints,
    examples,
  };
}

function parseImports(content: string): CueImport[] {
  const imports: CueImport[] = [];
  const importRegex = /import\s+(?:(\w+):\s+)?["']([^"']+)["']/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      alias: match[1],
      package: match[2],
      url: match[2],
    });
  }

  return imports;
}

function parseDefinitions(content: string, filePath: string): CueDefinition[] {
  const definitions: CueDefinition[] = [];

  // Parse top-level definitions (simplified approach)
  const definitionRegex = /^(#?\w+):\s*(\{[^}]*\}|\[.*?\]|[^\n]+)/gm;

  let match;
  while ((match = definitionRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[2];

    // Skip comments and some built-ins
    if (name.startsWith("//") || name === "package") continue;

    const def: CueDefinition = {
      name,
      type: determineDefinitionType(definition),
      description: extractDescription(content, match.index),
      fields: parseFields(definition),
      constraints: extractConstraints(definition),
      examples: [],
      deprecated: content.includes(`@deprecated ${name}`),
      since: extractSince(content, name),
    };

    definitions.push(def);
  }

  return definitions;
}

function determineDefinitionType(definition: string): string {
  if (definition.startsWith("{")) return "struct";
  if (definition.startsWith("[")) return "list";
  if (definition.includes("|")) return "union";
  if (definition.includes("&")) return "intersection";
  if (definition.includes("string")) return "string";
  if (definition.includes("int") || definition.includes("number")) return "number";
  if (definition.includes("bool")) return "boolean";
  return "unknown";
}

function parseFields(definition: string): CueField[] {
  if (!definition.startsWith("{")) return [];

  const fields: CueField[] = [];
  const fieldRegex = /(\w+)(\?)?\s*:\s*([^,\n}]+)/g;

  let match;
  while ((match = fieldRegex.exec(definition)) !== null) {
    fields.push({
      name: match[1],
      optional: !!match[2],
      type: match[3].trim(),
      constraints: extractFieldConstraints(match[3]),
    });
  }

  return fields;
}

function extractDescription(content: string, index: number): string | undefined {
  // Look for comment above the definition
  const beforeDefinition = content.substring(0, index);
  const lines = beforeDefinition.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("//")) {
      return line.substring(2).trim();
    }
    if (line !== "") break; // Stop at first non-empty, non-comment line
  }

  return undefined;
}

function extractConstraints(definition: string): string[] {
  const constraints: string[] = [];

  // Look for common constraint patterns
  if (definition.includes(">")) constraints.push("greater than");
  if (definition.includes("<")) constraints.push("less than");
  if (definition.includes("=~")) constraints.push("regex match");
  if (definition.includes("!=")) constraints.push("not equal");
  if (definition.includes("len(")) constraints.push("length constraint");

  return constraints;
}

function extractFieldConstraints(fieldType: string): string[] {
  const constraints: string[] = [];

  if (fieldType.includes("!")) constraints.push("required");
  if (fieldType.includes("|")) constraints.push("union type");
  if (fieldType.includes("&")) constraints.push("intersection type");
  if (fieldType.includes("...")) constraints.push("open field");

  return constraints;
}

function extractSince(content: string, name: string): string | undefined {
  const sinceRegex = new RegExp(`@since\\s+([^\\n]+).*?${name}`, "s");
  const match = content.match(sinceRegex);
  return match ? match[1].trim() : undefined;
}

function parseConstraints(content: string, definitions: CueDefinition[]): CueConstraint[] {
  const constraints: CueConstraint[] = [];

  // This is a simplified implementation - would need more sophisticated parsing
  for (const def of definitions) {
    for (const field of def.fields || []) {
      if (field.constraints) {
        for (const constraint of field.constraints) {
          constraints.push({
            field: `${def.name}.${field.name}`,
            type: "validation",
            value: constraint,
            description: `Field constraint: ${constraint}`,
          });
        }
      }
    }
  }

  return constraints;
}

async function parseExamples(content: string, filePath: string): Promise<CueExample[]> {
  const examples: CueExample[] = [];

  // Look for example blocks in comments or separate files
  const exampleRegex = /\/\/ Example:\s*([\s\S]*?)(?=\/\/|\n\n|$)/g;

  let match;
  while ((match = exampleRegex.exec(content)) !== null) {
    try {
      const exampleText = match[1].trim();
      // Simple JSON parsing - would need CUE evaluation for full support
      const data = JSON.parse(exampleText);

      examples.push({
        description: "Inline example",
        data,
        valid: true,
      });
    } catch {
      // Not valid JSON, treat as raw example
      examples.push({
        description: "Inline example",
        data: match[1].trim(),
        valid: false,
      });
    }
  }

  return examples;
}

async function buildSchemaRelationships(
  schemas: CueSchemaInfo[],
): Promise<Record<string, string[]>> {
  const relationships: Record<string, string[]> = {};

  for (const schema of schemas) {
    const related: string[] = [];

    // Find relationships through imports
    for (const imp of schema.imports) {
      const relatedSchema = schemas.find((s) => s.package === imp.package);
      if (relatedSchema) {
        related.push(relatedSchema.file);
      }
    }

    // Find relationships through field types
    for (const def of schema.definitions) {
      for (const field of def.fields || []) {
        // Look for references to other definitions
        for (const otherSchema of schemas) {
          for (const otherDef of otherSchema.definitions) {
            if (field.type.includes(otherDef.name) && otherSchema !== schema) {
              related.push(otherSchema.file);
            }
          }
        }
      }
    }

    relationships[schema.file] = [...new Set(related)];
  }

  return relationships;
}

async function generateSchemaDocumentationFormat(
  format: "markdown" | "json" | "html",
  schemas: CueSchemaInfo[],
  relationships: Record<string, string[]>,
  options: CueDocsOptions,
): Promise<void> {
  console.log(chalk.blue(`📄 Generating ${format} CUE schema documentation...`));

  const outputFile = path.join(options.outputDir, `cue-schemas.${format}`);

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${outputFile}`));
    return;
  }

  switch (format) {
    case "json":
      await generateJsonFormat(schemas, relationships, outputFile);
      break;
    case "markdown":
      await generateMarkdownFormat(schemas, relationships, outputFile, options);
      break;
    case "html":
      await generateHtmlFormat(schemas, relationships, outputFile, options);
      break;
  }

  console.log(chalk.green(`  ✅ Generated ${format} documentation`));
}

async function generateJsonFormat(
  schemas: CueSchemaInfo[],
  relationships: Record<string, string[]>,
  outputFile: string,
): Promise<void> {
  const data = {
    generatedAt: new Date().toISOString(),
    generatedBy: "Arbiter CUE Schema Documentation Generator",
    version: "1.0.0",
    schemas,
    relationships,
    statistics: {
      totalSchemas: schemas.length,
      totalDefinitions: schemas.reduce((sum, s) => sum + s.definitions.length, 0),
      totalPackages: new Set(schemas.map((s) => s.package)).size,
    },
  };

  await fs.writeFile(outputFile, JSON.stringify(data, null, 2), "utf8");
}

async function generateMarkdownFormat(
  schemas: CueSchemaInfo[],
  relationships: Record<string, string[]>,
  outputFile: string,
  options: CueDocsOptions,
): Promise<void> {
  let content = `# CUE Schema Reference

Generated on ${new Date().toISOString()}

## Overview

This document provides comprehensive documentation for all CUE schemas in the Arbiter project.

- **Total Schemas**: ${schemas.length}
- **Total Definitions**: ${schemas.reduce((sum, s) => sum + s.definitions.length, 0)}
- **Total Packages**: ${new Set(schemas.map((s) => s.package)).size}

## Table of Contents

`;

  // Generate table of contents
  const packages = groupSchemasByPackage(schemas);
  for (const [packageName, packageSchemas] of Object.entries(packages)) {
    content += `- [${packageName}](#package-${packageName.toLowerCase()})\n`;
    for (const schema of packageSchemas) {
      content += `  - [${path.basename(schema.file, ".cue")}](#${path.basename(schema.file, ".cue").toLowerCase()})\n`;
    }
  }

  content += "\n";

  // Generate documentation for each package
  for (const [packageName, packageSchemas] of Object.entries(packages)) {
    content += `## Package: ${packageName}\n\n`;

    for (const schema of packageSchemas) {
      content += `### ${path.basename(schema.file, ".cue")}\n\n`;
      content += `**File**: \`${schema.file}\`\n\n`;

      if (schema.imports.length > 0) {
        content += "**Imports**:\n";
        for (const imp of schema.imports) {
          content += `- \`${imp.package}\`${imp.alias ? ` as ${imp.alias}` : ""}\n`;
        }
        content += "\n";
      }

      if (schema.definitions.length > 0) {
        content += "**Definitions**:\n\n";
        for (const def of schema.definitions) {
          content += `#### ${def.name}\n\n`;
          if (def.description) {
            content += `${def.description}\n\n`;
          }
          content += `**Type**: ${def.type}\n\n`;

          if (def.deprecated) {
            content += "⚠️ **Deprecated**\n\n";
          }

          if (def.since) {
            content += `**Since**: ${def.since}\n\n`;
          }

          if (def.fields && def.fields.length > 0) {
            content += "**Fields**:\n\n";
            content += "| Field | Type | Required | Description |\n";
            content += "|-------|------|----------|-------------|\n";
            for (const field of def.fields) {
              const required = field.optional ? "No" : "Yes";
              const description = field.description || "";
              content += `| \`${field.name}\` | \`${field.type}\` | ${required} | ${description} |\n`;
            }
            content += "\n";
          }

          if (def.constraints && def.constraints.length > 0) {
            content += "**Constraints**:\n";
            for (const constraint of def.constraints) {
              content += `- ${constraint}\n`;
            }
            content += "\n";
          }

          if (options.includeExamples && def.examples && def.examples.length > 0) {
            content += "**Examples**:\n\n";
            for (const example of def.examples) {
              content += "```cue\n";
              content += typeof example === "string" ? example : JSON.stringify(example, null, 2);
              content += "\n```\n\n";
            }
          }
        }
      }

      if (options.includeRelationships && relationships[schema.file]?.length > 0) {
        content += "**Related Schemas**:\n";
        for (const related of relationships[schema.file]) {
          content += `- [\`${related}\`](#${path.basename(related, ".cue").toLowerCase()})\n`;
        }
        content += "\n";
      }

      content += "---\n\n";
    }
  }

  await fs.writeFile(outputFile, content, "utf8");
}

async function generateHtmlFormat(
  schemas: CueSchemaInfo[],
  relationships: Record<string, string[]>,
  outputFile: string,
  options: CueDocsOptions,
): Promise<void> {
  // Convert markdown to HTML (simplified approach)
  const markdownFile = outputFile.replace(".html", ".md");
  await generateMarkdownFormat(schemas, relationships, markdownFile, options);

  // Read markdown and convert to HTML
  const markdown = await fs.readFile(markdownFile, "utf8");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CUE Schema Reference - Arbiter</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3, h4 { color: #2563eb; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background-color: #f8f9fa; }
        code { background-color: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
        pre { background-color: #f8f9fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
        .deprecated { color: #dc2626; font-weight: bold; }
        .toc { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="content">
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
    </div>
</body>
</html>`;

  await fs.writeFile(outputFile, html, "utf8");

  // Clean up temporary markdown file
  await fs.remove(markdownFile);
}

function groupSchemasByPackage(schemas: CueSchemaInfo[]): Record<string, CueSchemaInfo[]> {
  const groups: Record<string, CueSchemaInfo[]> = {};

  for (const schema of schemas) {
    if (!groups[schema.package]) {
      groups[schema.package] = [];
    }
    groups[schema.package].push(schema);
  }

  // Sort schemas within each package
  for (const packageName of Object.keys(groups)) {
    groups[packageName].sort((a, b) => a.file.localeCompare(b.file));
  }

  return groups;
}

async function generateSchemaIndex(
  schemas: CueSchemaInfo[],
  options: CueDocsOptions,
): Promise<void> {
  const indexFile = path.join(options.outputDir, "schema-index.json");

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${indexFile}`));
    return;
  }

  const index = {
    generatedAt: new Date().toISOString(),
    packages: Object.keys(groupSchemasByPackage(schemas)),
    schemas: schemas.map((s) => ({
      file: s.file,
      package: s.package,
      definitions: s.definitions.map((d) => d.name),
    })),
  };

  await fs.writeFile(indexFile, JSON.stringify(index, null, 2), "utf8");
  console.log(chalk.green("  ✅ Generated schema index"));
}

async function generateSchemaMetrics(
  schemas: CueSchemaInfo[],
  options: CueDocsOptions,
): Promise<void> {
  const metricsFile = path.join(options.outputDir, "schema-metrics.json");

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${metricsFile}`));
    return;
  }

  const metrics = {
    generatedAt: new Date().toISOString(),
    overview: {
      totalSchemas: schemas.length,
      totalDefinitions: schemas.reduce((sum, s) => sum + s.definitions.length, 0),
      totalPackages: new Set(schemas.map((s) => s.package)).size,
      totalConstraints: schemas.reduce((sum, s) => sum + s.constraints.length, 0),
      totalExamples: schemas.reduce((sum, s) => sum + s.examples.length, 0),
    },
    byPackage: {},
    coverage: {
      documented: 0,
      total: 0,
      percentage: 0,
    },
    complexity: {
      averageDefinitionsPerSchema: 0,
      averageFieldsPerDefinition: 0,
      mostComplexSchema: "",
      mostComplexDefinition: "",
    },
  };

  // Calculate metrics by package
  const packages = groupSchemasByPackage(schemas);
  for (const [packageName, packageSchemas] of Object.entries(packages)) {
    (metrics.byPackage as any)[packageName] = {
      schemas: packageSchemas.length,
      definitions: packageSchemas.reduce((sum, s) => sum + s.definitions.length, 0),
      avgDefinitionsPerSchema:
        packageSchemas.reduce((sum, s) => sum + s.definitions.length, 0) / packageSchemas.length,
    };
  }

  // Calculate coverage
  let documented = 0;
  let total = 0;
  for (const schema of schemas) {
    for (const def of schema.definitions) {
      total++;
      if (def.description && def.description.length > 10) {
        documented++;
      }
    }
  }
  metrics.coverage = {
    documented,
    total,
    percentage: total > 0 ? (documented / total) * 100 : 0,
  };

  // Calculate complexity metrics
  const totalDefs = metrics.overview.totalDefinitions;
  metrics.complexity.averageDefinitionsPerSchema = totalDefs / schemas.length;

  let totalFields = 0;
  let maxFields = 0;
  let mostComplexDef = "";
  let mostComplexSchema = "";
  let maxDefs = 0;

  for (const schema of schemas) {
    if (schema.definitions.length > maxDefs) {
      maxDefs = schema.definitions.length;
      mostComplexSchema = schema.file;
    }

    for (const def of schema.definitions) {
      const fieldCount = def.fields?.length || 0;
      totalFields += fieldCount;

      if (fieldCount > maxFields) {
        maxFields = fieldCount;
        mostComplexDef = `${schema.file}:${def.name}`;
      }
    }
  }

  metrics.complexity.averageFieldsPerDefinition = totalDefs > 0 ? totalFields / totalDefs : 0;
  metrics.complexity.mostComplexSchema = mostComplexSchema;
  metrics.complexity.mostComplexDefinition = mostComplexDef;

  await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2), "utf8");
  console.log(chalk.green("  ✅ Generated schema metrics"));
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const defaultOptions: CueDocsOptions = {
    sourceDir: "./packages/shared/src/cue",
    outputDir: "./docs",
    formats: ["markdown", "json"],
    includeExamples: true,
    includeConstraints: true,
    includeRelationships: true,
    verbose: false,
    dryRun: false,
  };

  generateCueSchemaDocumentation(defaultOptions)
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    });
}
