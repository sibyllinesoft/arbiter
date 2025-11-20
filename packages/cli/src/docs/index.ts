/**
 * CUE Schema Documentation System
 *
 * Complete documentation generation system for CUE schema files.
 * Exports all core components for easy consumption.
 */

import * as fs from "node:fs";
import path from "node:path";

import {
  type SchemaDocsCommandOptions,
  createSchemaDocsCommand,
  generateSchemaDocumentation,
} from "../services/schema-docs/index.js";
import { runDemo } from "./demo-documentation.js";
import { DocumentationGenerator } from "./documentation-generator.js";
import { EnhancedCUEParser } from "./enhanced-cue-parser.js";
import { generateExampleDocumentation } from "./generate-example.js";
import { technicalTemplate } from "./templates/technical-template.js";

export type { ParsedField, ParsedType, ParsedSchema } from "./schema-parser.js";
export type { CUEStructField, CUEContext } from "./enhanced-cue-parser.js";
export type { GeneratorOptions, Templates } from "./documentation-generator.js";
export type { SchemaDocsCommandOptions };
export {
  EnhancedCUEParser,
  DocumentationGenerator,
  createSchemaDocsCommand,
  generateSchemaDocumentation,
  technicalTemplate,
  generateExampleDocumentation,
  runDemo,
};

/**
 * Quick setup function for basic usage
 */
export async function generateSchemaDocumentationQuick(
  inputDir: string,
  outputDir: string,
  options?: Partial<{
    formats: ("markdown" | "html" | "json")[];
    title: string;
  }>,
): Promise<void> {
  const parser = new EnhancedCUEParser();
  const schema = await parser.parseSchemaDirectory(inputDir);

  const generator = new DocumentationGenerator({
    outputDir,
    formats: options?.formats || ["markdown", "html"],
    title: options?.title || "Schema Documentation",
    includePrivateTypes: false,
    includeExamples: true,
    includeRelationships: true,
  });

  await generator.generate(schema);
}

function findCueFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findCueFiles(fullPath));
      } else if (entry.name.endsWith(".cue")) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Could not read directory ${dir}: ${error}`);
  }

  return files;
}

/**
 * Default export for convenience
 */
export default {
  EnhancedCUEParser,
  DocumentationGenerator,
  createSchemaDocsCommand,
  generateSchemaDocumentation,
  generateSchemaDocumentationQuick,
  technicalTemplate,
  generateExampleDocumentation,
  runDemo,
};
