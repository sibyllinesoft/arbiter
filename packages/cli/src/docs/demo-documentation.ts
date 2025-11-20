#!/usr/bin/env node

/**
 * Demo Documentation Generation
 *
 * This script demonstrates the schema documentation generation by creating
 * a simplified version that works with the actual Arbiter schema files
 * and generates a preview of the documentation.
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { safeFileOperation } from "../constraints/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple interfaces for demo
interface DemoType {
  name: string;
  description?: string;
  kind: "constraint" | "enum" | "primitive" | "struct" | "union";
  definition: string;
  constraints: string[];
  examples: string[];
  location: string;
}

/**
 * Simple CUE parser for demonstration purposes
 */
function parseSimpleCUE(content: string, fileName: string): DemoType[] {
  const lines = content.split("\n");
  const types: DemoType[] = [];
  let currentComment = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Collect comments
    if (line.startsWith("//")) {
      currentComment += line.substring(2).trim() + " ";
      continue;
    }

    // Parse type definitions
    if (line.includes("#") && line.includes(":")) {
      const match = line.match(/^(#\w+):\s*(.+)$/);
      if (match) {
        const [, typeName, definition] = match;
        const name = typeName.substring(1);

        const type: DemoType = {
          name,
          description: currentComment.trim() || undefined,
          kind: determineKind(definition),
          definition: definition.trim(),
          constraints: extractConstraints(definition),
          examples: extractExamples(currentComment),
          location: `${fileName}:${i + 1}`,
        };

        types.push(type);
      }

      currentComment = "";
    } else if (line && !line.startsWith("//")) {
      currentComment = "";
    }
  }

  return types;
}

function determineKind(definition: string): DemoType["kind"] {
  if (definition.includes("=~")) return "constraint";
  if (definition.includes("|") && definition.includes('"')) return "enum";
  if (definition.includes("|")) return "union";
  if (definition.includes("{")) return "struct";
  return "primitive";
}

function extractConstraints(definition: string): string[] {
  const constraints: string[] = [];

  if (definition.includes("=~")) {
    const match = definition.match(/=~"([^"]+)"/);
    if (match) constraints.push(`Pattern: ${match[1]}`);
  }

  if (definition.includes(">=")) {
    const match = definition.match(/>=(\d+(?:\.\d+)?)/);
    if (match) constraints.push(`Minimum: ${match[1]}`);
  }

  if (definition.includes("<=")) {
    const match = definition.match(/<=(\d+(?:\.\d+)?)/);
    if (match) constraints.push(`Maximum: ${match[1]}`);
  }

  if (definition.includes('!=""')) {
    constraints.push("Non-empty string");
  }

  return constraints;
}

function extractExamples(comment: string): string[] {
  const examples: string[] = [];
  const match = comment.match(/e\.g\.,?\s*([^,\n]+)/);
  if (match) {
    examples.push(match[1].trim());
  }
  return examples;
}

/**
 * Generate markdown documentation
 */
function generateMarkdownDemo(types: DemoType[], packageName: string): string {
  let content = `# Arbiter CUE Schema Documentation (Demo)

*This is a demo documentation generated from the actual Arbiter CUE schema files*

**Package:** \`${packageName}\`  
**Types:** ${types.length}  
**Generated:** ${new Date().toISOString()}

---

## Table of Contents

`;

  // Generate TOC
  for (const type of types) {
    const anchor = type.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    content += `- [${type.name}](#${anchor}) - ${type.kind}\n`;
  }

  content += "\n---\n\n## Type Definitions\n\n";

  // Generate type documentation
  for (const type of types) {
    const anchor = type.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    content += `### \`${type.name}\` {#${anchor}}\n\n`;

    if (type.description) {
      content += `${type.description}\n\n`;
    }

    content += `**Category:** \`${type.kind}\`  \n`;
    content += `**Definition:** \`${type.definition}\`  \n`;
    content += `**Source:** \`${type.location}\`\n\n`;

    if (type.constraints.length > 0) {
      content += "**Constraints:**\n";
      for (const constraint of type.constraints) {
        content += `- ${constraint}\n`;
      }
      content += "\n";
    }

    if (type.examples.length > 0) {
      content += "**Examples:**\n";
      for (const example of type.examples) {
        content += `- \`${example}\`\n`;
      }
      content += "\n";
    }

    content += "---\n\n";
  }

  content += `## Summary

This demo documentation was generated from ${types.length} type definitions found in the Arbiter CUE schema files.

### Type Distribution

`;

  const kindCounts = types.reduce(
    (acc, type) => {
      acc[type.kind] = (acc[type.kind] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  for (const [kind, count] of Object.entries(kindCounts)) {
    content += `- **${kind}**: ${count} types\n`;
  }

  content += `\n> **Note:** This is a simplified demo. The full documentation system supports advanced features like relationship mapping, HTML output, JSON schema generation, and more sophisticated CUE parsing.`;

  return content;
}

/**
 * Generate HTML demo
 */
function generateHTMLDemo(types: DemoType[], packageName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Arbiter Schema Documentation (Demo)</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; margin: 0; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { background: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .type-card { background: white; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .type-title { color: #2563eb; font-family: monospace; font-size: 1.25rem; margin: 0 0 0.5rem 0; }
        .type-meta { font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem; }
        .badge { background: #e5e7eb; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
        .badge-constraint { background: #fef3c7; color: #92400e; }
        .badge-enum { background: #dcfce7; color: #166534; }
        .badge-primitive { background: #f3f4f6; color: #374151; }
        .badge-struct { background: #dbeafe; color: #1e40af; }
        .badge-union { background: #ede9fe; color: #6b21a8; }
        .constraints { background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; }
        .examples { background: #f0fdf4; border-left: 4px solid #10b981; padding: 1rem; margin: 1rem 0; }
        code { background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 4px; font-family: monospace; }
        .definition { font-family: monospace; background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 4px; overflow-x: auto; margin: 1rem 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Arbiter CUE Schema Documentation</h1>
            <p><strong>Package:</strong> <code>${packageName}</code></p>
            <p><strong>Types:</strong> ${types.length}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><em>This is a demo documentation generated from actual Arbiter CUE schema files</em></p>
        </div>

${types
  .map(
    (type) => `
        <div class="type-card">
            <h2 class="type-title">#${type.name}</h2>
            <div class="type-meta">
                <span class="badge badge-${type.kind}">${type.kind}</span>
                <span style="margin-left: 1rem;">Source: <code>${type.location}</code></span>
            </div>
            
            ${type.description ? `<p>${type.description}</p>` : ""}
            
            <div class="definition">${type.definition}</div>
            
            ${
              type.constraints.length > 0
                ? `
            <div class="constraints">
                <h4>Constraints:</h4>
                <ul>
                    ${type.constraints.map((c) => `<li>${c}</li>`).join("")}
                </ul>
            </div>
            `
                : ""
            }
            
            ${
              type.examples.length > 0
                ? `
            <div class="examples">
                <h4>Examples:</h4>
                <ul>
                    ${type.examples.map((e) => `<li><code>${e}</code></li>`).join("")}
                </ul>
            </div>
            `
                : ""
            }
        </div>
`,
  )
  .join("")}

        <div class="header">
            <h2>Summary</h2>
            <p>This demo documentation was generated from <strong>${types.length}</strong> type definitions found in the Arbiter CUE schema files.</p>
            
            <h3>Type Distribution</h3>
            ${Object.entries(
              types.reduce(
                (acc, type) => {
                  acc[type.kind] = (acc[type.kind] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            )
              .map(
                ([kind, count]) =>
                  `<p><span class="badge badge-${kind}">${kind}</span>: ${count} types</p>`,
              )
              .join("")}
            
            <p><em><strong>Note:</strong> This is a simplified demo. The full documentation system supports advanced features like relationship mapping, cross-references, JSON schema generation, and more sophisticated CUE parsing.</em></p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Main demo function
 */
async function runDemo() {
  console.log("🚀 Running Arbiter Schema Documentation Demo...\n");

  try {
    // Get schema files
    const projectRoot = path.resolve(__dirname, "../../../..");
    const schemaDir = path.join(projectRoot, "spec/schema");
    const outputDir = path.join(__dirname, "demo-output");

    // Create output directory
    await fs.ensureDir(outputDir);

    console.log(`📁 Project root: ${projectRoot}`);
    console.log(`📁 Schema dir: ${schemaDir}`);

    const schemaFiles = [
      "core_types.cue",
      "app_spec.cue",
      "feature_spec.cue",
      "completion_rules.cue",
    ];

    let allTypes: DemoType[] = [];
    let packageName = "schema";

    // Parse each schema file
    for (const fileName of schemaFiles) {
      const filePath = path.join(schemaDir, fileName);

      try {
        console.log(`📄 Parsing ${fileName}...`);
        const content = await fs.readFile(filePath, "utf-8");

        // Extract package name from first file
        if (fileName === "core_types.cue") {
          const packageMatch = content.match(/package\s+(\w+)/);
          if (packageMatch) packageName = packageMatch[1];
        }

        const types = parseSimpleCUE(content, fileName);
        console.log(`   Found ${types.length} types`);
        allTypes = allTypes.concat(types);
      } catch (error) {
        console.warn(`   ⚠️  Could not parse ${fileName}: ${error}`);
      }
    }

    console.log(`\n✅ Parsed ${allTypes.length} total types from package "${packageName}"\n`);

    // List discovered types
    console.log("📋 Discovered types:");
    const typesByKind = allTypes.reduce(
      (acc, type) => {
        if (!acc[type.kind]) acc[type.kind] = [];
        acc[type.kind].push(type.name);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    for (const [kind, names] of Object.entries(typesByKind)) {
      console.log(`   ${kind.toUpperCase()}: ${names.join(", ")}`);
    }

    // Generate documentation
    console.log("\n📖 Generating demo documentation...");

    const markdownContent = generateMarkdownDemo(allTypes, packageName);
    const htmlContent = generateHTMLDemo(allTypes, packageName);

    // Write files
    const markdownPath = path.join(outputDir, "demo-schema.md");
    const htmlPath = path.join(outputDir, "demo-schema.html");

    await safeFileOperation("write", markdownPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, markdownContent, "utf8");
    });
    await safeFileOperation("write", htmlPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, htmlContent, "utf8");
    });

    console.log("✅ Demo documentation generated successfully!\n");
    console.log("📄 Generated files:");
    console.log(`   - ${markdownPath}`);
    console.log(`   - ${htmlPath}`);

    console.log(`\n💡 View the demo:`);
    console.log(`   Markdown: cat "${markdownPath}"`);
    console.log(`   HTML: file://${htmlPath}`);

    console.log(
      `\n🎉 Demo complete! This shows a simplified version of what the full documentation system can generate.`,
    );

    return true;
  } catch (error) {
    console.error("❌ Demo failed:", error);
    return false;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error("Unexpected error:", error);
      process.exit(1);
    });
}

export { runDemo };
