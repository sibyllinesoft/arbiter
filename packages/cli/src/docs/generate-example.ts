#!/usr/bin/env node

/**
 * Example Documentation Generation Script
 *
 * Demonstrates the schema documentation generation system by processing
 * the actual Arbiter CUE schema files and generating comprehensive documentation.
 */

import path from "path";
import { fileURLToPath } from "url";
import { DocumentationGenerator } from "./documentation-generator.js";
import { EnhancedCUEParser } from "./enhanced-cue-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateExampleDocumentation() {
  console.log("🚀 Generating example schema documentation...\n");

  try {
    // Determine the schema directory path
    const projectRoot = path.resolve(__dirname, "../../../../../");
    const schemaDir = path.join(projectRoot, "spec/schema");
    const outputDir = path.join(__dirname, "example-output");

    console.log(`📁 Schema directory: ${schemaDir}`);
    console.log(`📁 Output directory: ${outputDir}\n`);

    // Use the enhanced parser for better results
    console.log("⚙️  Parsing CUE schema files...");
    const parser = new EnhancedCUEParser();
    const schema = await parser.parseSchemaDirectory(schemaDir);

    console.log(
      `✅ Successfully parsed ${schema.types.size} types from package "${schema.package}"`,
    );
    console.log(`📋 Found imports: ${schema.imports.join(", ") || "none"}\n`);

    // List all discovered types
    console.log("📝 Discovered types:");
    for (const [name, type] of schema.types) {
      console.log(`   - ${name} (${type.kind}): ${type.description || "no description"}`);
    }
    console.log("");

    // Generate documentation in all formats
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

    // Display file listing
    const fs = require("fs");
    const outputFiles = fs.readdirSync(outputDir);
    console.log("📄 Generated files:");
    for (const file of outputFiles) {
      console.log(`   - ${path.join(outputDir, file)}`);
    }

    // Display detailed type analysis
    console.log("\n📊 Type Analysis:");
    const typesByKind = new Map<string, string[]>();

    for (const [name, type] of schema.types) {
      if (!typesByKind.has(type.kind)) {
        typesByKind.set(type.kind, []);
      }
      typesByKind.get(type.kind)!.push(name);
    }

    for (const [kind, types] of typesByKind) {
      console.log(`   ${kind.toUpperCase()}: ${types.length}`);
      types.forEach((type) => {
        const typeInfo = schema.types.get(type)!;
        const deps = typeInfo.dependsOn?.length || 0;
        const users = typeInfo.usedBy?.length || 0;
        console.log(`     - ${type} (depends on ${deps}, used by ${users})`);
      });
    }

    // Display relationship summary
    console.log("\n🔗 Relationship Summary:");
    let totalDependencies = 0;
    let maxDependencies = 0;
    let mostConnectedType = "";

    for (const [name, type] of schema.types) {
      const depCount = (type.dependsOn?.length || 0) + (type.usedBy?.length || 0);
      totalDependencies += type.dependsOn?.length || 0;

      if (depCount > maxDependencies) {
        maxDependencies = depCount;
        mostConnectedType = name;
      }
    }

    console.log(`   Total type dependencies: ${totalDependencies}`);
    console.log(`   Most connected type: ${mostConnectedType} (${maxDependencies} connections)`);

    console.log("\n🎉 Example documentation generation complete!");
    console.log(`\n💡 Next steps:`);
    console.log(`   1. View the HTML documentation: file://${path.join(outputDir, "schema.html")}`);
    console.log(`   2. Read the Markdown documentation: ${path.join(outputDir, "schema.md")}`);
    console.log(`   3. Use the JSON schema: ${path.join(outputDir, "schema.json")}`);

    return true;
  } catch (error) {
    console.error("❌ Documentation generation failed:", error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return false;
  }
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
