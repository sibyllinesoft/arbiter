#!/usr/bin/env node

/**
 * Example Documentation Generation Script
 *
 * Demonstrates the schema documentation generation system by processing
 * the actual Arbiter CUE schema files and generating comprehensive documentation.
 */

import path from "path";
import { fileURLToPath } from "url";
import { DocumentationGenerator } from "@/docs/generator/documentation-generator.js";
import { EnhancedCUEParser } from "@/docs/parser/enhanced-cue-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateExampleDocumentation() {
  console.log("🚀 Generating example schema documentation...\n");

  try {
    const paths = initializePaths();
    logPathInfo(paths);

    const schema = await parseSchema(paths.schemaDir);
    logParsedTypes(schema);

    await generateAllFormats(schema, paths.outputDir);
    displayGeneratedFiles(paths.outputDir);
    displayTypeAnalysis(schema);
    displayRelationshipSummary(schema);
    displayNextSteps(paths.outputDir);

    return true;
  } catch (error) {
    console.error("❌ Documentation generation failed:", error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

interface ExamplePaths {
  projectRoot: string;
  schemaDir: string;
  outputDir: string;
}

function initializePaths(): ExamplePaths {
  const projectRoot = path.resolve(__dirname, "../../../../../");
  return {
    projectRoot,
    schemaDir: path.join(projectRoot, "spec/schema"),
    outputDir: path.join(__dirname, "example-output"),
  };
}

function logPathInfo(paths: ExamplePaths): void {
  console.log(`📁 Schema directory: ${paths.schemaDir}`);
  console.log(`📁 Output directory: ${paths.outputDir}\n`);
}

async function parseSchema(schemaDir: string): Promise<ParsedSchema> {
  console.log("⚙️  Parsing CUE schema files...");
  const parser = new EnhancedCUEParser();
  const schema = await parser.parseSchemaDirectory(schemaDir);
  console.log(`✅ Successfully parsed ${schema.types.size} types from package "${schema.package}"`);
  console.log(`📋 Found imports: ${schema.imports.join(", ") || "none"}\n`);
  return schema;
}

function logParsedTypes(schema: ParsedSchema): void {
  console.log("📝 Discovered types:");
  for (const [name, type] of schema.types) {
    console.log(`   - ${name} (${type.kind}): ${type.description || "no description"}`);
  }
  console.log("");
}

async function generateAllFormats(schema: ParsedSchema, outputDir: string): Promise<void> {
  console.log("📖 Generating documentation...");
  const generator = new DocumentationGenerator({
    outputDir,
    formats: ["markdown", "html", "json"],
    title: "Arbiter CUE Schema Documentation",
    includePrivateTypes: false,
    includeExamples: true,
    includeRelationships: true,
  });
  await generator.generate(schema);
  console.log("✅ Documentation generated successfully!\n");
}

function displayGeneratedFiles(outputDir: string): void {
  const fs = require("fs");
  const outputFiles = fs.readdirSync(outputDir);
  console.log("📄 Generated files:");
  for (const file of outputFiles) {
    console.log(`   - ${path.join(outputDir, file)}`);
  }
}

function displayTypeAnalysis(schema: ParsedSchema): void {
  console.log("\n📊 Type Analysis:");
  const typesByKind = groupTypesByKind(schema);

  for (const [kind, types] of typesByKind) {
    console.log(`   ${kind.toUpperCase()}: ${types.length}`);
    for (const type of types) {
      const typeInfo = schema.types.get(type)!;
      const deps = typeInfo.dependsOn?.length || 0;
      const users = typeInfo.usedBy?.length || 0;
      console.log(`     - ${type} (depends on ${deps}, used by ${users})`);
    }
  }
}

function groupTypesByKind(schema: ParsedSchema): Map<string, string[]> {
  const typesByKind = new Map<string, string[]>();
  for (const [name, type] of schema.types) {
    if (!typesByKind.has(type.kind)) {
      typesByKind.set(type.kind, []);
    }
    typesByKind.get(type.kind)!.push(name);
  }
  return typesByKind;
}

function displayRelationshipSummary(schema: ParsedSchema): void {
  console.log("\n🔗 Relationship Summary:");
  const { totalDependencies, mostConnectedType, maxConnections } = analyzeRelationships(schema);
  console.log(`   Total type dependencies: ${totalDependencies}`);
  console.log(`   Most connected type: ${mostConnectedType} (${maxConnections} connections)`);
}

function analyzeRelationships(schema: ParsedSchema): {
  totalDependencies: number;
  mostConnectedType: string;
  maxConnections: number;
} {
  let totalDependencies = 0;
  let maxConnections = 0;
  let mostConnectedType = "";

  for (const [name, type] of schema.types) {
    const depCount = (type.dependsOn?.length || 0) + (type.usedBy?.length || 0);
    totalDependencies += type.dependsOn?.length || 0;

    if (depCount > maxConnections) {
      maxConnections = depCount;
      mostConnectedType = name;
    }
  }

  return { totalDependencies, mostConnectedType, maxConnections };
}

function displayNextSteps(outputDir: string): void {
  console.log("\n🎉 Example documentation generation complete!");
  console.log(`\n💡 Next steps:`);
  console.log(`   1. View the HTML documentation: file://${path.join(outputDir, "schema.html")}`);
  console.log(`   2. Read the Markdown documentation: ${path.join(outputDir, "schema.md")}`);
  console.log(`   3. Use the JSON schema: ${path.join(outputDir, "schema.json")}`);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateExampleDocumentation()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Unexpected error:", error);
      process.exit(1);
    });
}

export { generateExampleDocumentation };
