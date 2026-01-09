/**
 * @packageDocumentation
 * Documentation template generators for the docs command.
 *
 * Provides functionality to:
 * - Generate Markdown documentation
 * - Generate HTML documentation with CSS styling
 * - Define schema and field documentation structures
 * - Provide example templates for CLI and library projects
 */

/**
 * Documentation Structure
 */
export interface SchemaDoc {
  name: string;
  description: string;
  fields: FieldDoc[];
  examples: string[];
  constraints: string[];
  imports: string[];
}

export interface FieldDoc {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: string;
  constraints: string[];
}

/**
 * Generate CSS styles for HTML documentation
 */
export function generateCssStyles(): string {
  return `
    :root {
      --primary: #4f46e5;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-300: #d1d5db;
      --gray-600: #4b5563;
      --gray-900: #111827;
      --green-600: #16a34a;
      --amber-600: #d97706;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: var(--gray-900);
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      text-align: center;
      padding: 2rem 0;
      border-bottom: 1px solid var(--gray-300);
      margin-bottom: 2rem;
    }

    h1 { color: var(--primary); font-size: 2.5rem; }
    h2 { margin-top: 2rem; color: var(--gray-900); border-bottom: 2px solid var(--gray-300); padding-bottom: 0.5rem; }
    h3 { margin-top: 1.5rem; color: var(--gray-600); }

    .description { color: var(--gray-600); font-size: 1.1rem; margin-top: 0.5rem; }
    .meta { font-size: 0.875rem; color: var(--gray-600); margin-top: 0.5rem; }

    nav {
      position: sticky;
      top: 0;
      background: white;
      padding: 1rem 0;
      border-bottom: 1px solid var(--gray-100);
      margin-bottom: 2rem;
    }

    nav ul { display: flex; gap: 2rem; list-style: none; justify-content: center; }
    nav a { color: var(--primary); text-decoration: none; font-weight: 500; }
    nav a:hover { text-decoration: underline; }

    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--gray-300); }
    th { background: var(--gray-50); font-weight: 600; }

    code { background: var(--gray-100); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; }
    pre { background: var(--gray-100); padding: 1rem; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }

    .required { color: var(--green-600); font-weight: 500; }
    .optional { color: var(--gray-600); }

    footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--gray-300); text-align: center; color: var(--gray-600); }
  `;
}

/**
 * Generate Markdown documentation
 */
export function generateMarkdownDocs(schemaInfo: SchemaDoc): string {
  let md = "";

  // Header
  md += `# ${schemaInfo.name}\n\n`;
  md += `${schemaInfo.description}\n\n`;

  // Auto-generated notice
  md += "> This documentation is auto-generated from CUE definitions.\n";
  md += `> Last updated: ${new Date().toISOString()}\n\n`;

  // Table of Contents
  md += "## Table of Contents\n\n";
  md += "- [Schema Overview](#schema-overview)\n";
  md += "- [Fields](#fields)\n";
  md += "- [Imports](#imports)\n";
  md += "- [Examples](#examples)\n";
  md += "- [Constraints](#constraints)\n\n";

  // Schema Overview
  md += "## Schema Overview\n\n";
  md += "This schema defines the structure for Arbiter project configurations.\n\n";

  // Fields
  md += "## Fields\n\n";
  md += "| Field | Type | Required | Default | Description |\n";
  md += "|-------|------|----------|---------|-------------|\n";

  for (const field of schemaInfo.fields) {
    const required = field.required ? "Yes" : "No";
    const defaultVal = field.default ? `\`${field.default}\`` : "-";
    md += `| \`${field.name}\` | \`${field.type}\` | ${required} | ${defaultVal} | ${field.description || "No description"} |\n`;
  }

  md += "\n";

  // Imports
  if (schemaInfo.imports.length > 0) {
    md += "## Imports\n\n";
    md += "This schema imports the following modules:\n\n";

    for (const importPath of schemaInfo.imports) {
      md += `- \`${importPath}\`\n`;
    }

    md += "\n";
  }

  // Examples
  md += "## Examples\n\n";
  md += "### Basic Configuration\n\n";
  md += "```cue\n";
  md += "// Basic library configuration\n";
  md += `import "github.com/arbiter-framework/schemas/artifact"\n`;
  md += `import "github.com/arbiter-framework/schemas/profiles"\n\n`;
  md += "Artifact: artifact.#Artifact & {\n";
  md += `  kind: "library"\n`;
  md += `  language: "typescript"\n`;
  md += "  build: {\n";
  md += `    tool: "bun"\n`;
  md += `    targets: ["./src"]\n`;
  md += "  }\n";
  md += "}\n\n";
  md += "Profile: profiles.#library & {\n";
  md += `  semver: "strict"\n`;
  md += "  apiSurface: {\n";
  md += `    source: "generated"\n`;
  md += `    file: "./dist/api-surface.json"\n`;
  md += "  }\n";
  md += "}\n";
  md += "```\n\n";

  md += "### CLI Configuration\n\n";
  md += "```cue\n";
  md += "Artifact: artifact.#Artifact & {\n";
  md += `  kind: "cli"\n`;
  md += `  language: "typescript"\n`;
  md += "}\n\n";
  md += "Profile: profiles.#cli & {\n";
  md += "  commands: [\n";
  md += "    {\n";
  md += `      name: "main"\n`;
  md += `      summary: "Main command"\n`;
  md += "      args: []\n";
  md += "      flags: [\n";
  md += `        {name: "help", type: "bool", default: false}\n`;
  md += "      ]\n";
  md += "    }\n";
  md += "  ]\n";
  md += "}\n";
  md += "```\n\n";

  // Footer
  md += "---\n\n";
  md +=
    "**Generated by Arbiter CLI** - [Learn more](https://github.com/arbiter-framework/arbiter)\n";

  return md;
}

/**
 * Generate HTML documentation
 */
export function generateHtmlDocs(schemaInfo: SchemaDoc): string {
  let html = "";

  html += "<!DOCTYPE html>\n";
  html += `<html lang="en">\n`;
  html += "<head>\n";
  html += `  <meta charset="UTF-8">\n`;
  html += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
  html += `  <title>${schemaInfo.name} - Schema Documentation</title>\n`;
  html += "  <style>\n";
  html += generateCssStyles();
  html += "  </style>\n";
  html += "</head>\n";
  html += "<body>\n";

  // Header
  html += "  <header>\n";
  html += `    <h1>${schemaInfo.name}</h1>\n`;
  html += `    <p class="description">${schemaInfo.description}</p>\n`;
  html += `    <div class="meta">Auto-generated on ${new Date().toLocaleString()}</div>\n`;
  html += "  </header>\n";

  // Navigation
  html += "  <nav>\n";
  html += "    <ul>\n";
  html += `      <li><a href="#overview">Overview</a></li>\n`;
  html += `      <li><a href="#fields">Fields</a></li>\n`;
  html += `      <li><a href="#examples">Examples</a></li>\n`;
  html += "    </ul>\n";
  html += "  </nav>\n";

  // Main content
  html += "  <main>\n";

  // Overview
  html += `    <section id="overview">\n`;
  html += "      <h2>Schema Overview</h2>\n";
  html += "      <p>This schema defines the structure for Arbiter project configurations.</p>\n";

  if (schemaInfo.imports.length > 0) {
    html += "      <h3>Imports</h3>\n";
    html += "      <ul>\n";
    for (const importPath of schemaInfo.imports) {
      html += `        <li><code>${importPath}</code></li>\n`;
    }
    html += "      </ul>\n";
  }

  html += "    </section>\n";

  // Fields
  html += `    <section id="fields">\n`;
  html += "      <h2>Fields</h2>\n";
  html += "      <table>\n";
  html += "        <thead>\n";
  html += "          <tr>\n";
  html += "            <th>Field</th>\n";
  html += "            <th>Type</th>\n";
  html += "            <th>Required</th>\n";
  html += "            <th>Default</th>\n";
  html += "            <th>Description</th>\n";
  html += "          </tr>\n";
  html += "        </thead>\n";
  html += "        <tbody>\n";

  for (const field of schemaInfo.fields) {
    const required = field.required
      ? '<span class="required">Yes</span>'
      : '<span class="optional">No</span>';
    const defaultVal = field.default ? `<code>${field.default}</code>` : "-";
    html += "          <tr>\n";
    html += `            <td><code>${field.name}</code></td>\n`;
    html += `            <td><code>${field.type}</code></td>\n`;
    html += `            <td>${required}</td>\n`;
    html += `            <td>${defaultVal}</td>\n`;
    html += `            <td>${field.description || "No description"}</td>\n`;
    html += "          </tr>\n";
  }

  html += "        </tbody>\n";
  html += "      </table>\n";
  html += "    </section>\n";

  // Examples
  html += `    <section id="examples">\n`;
  html += "      <h2>Examples</h2>\n";
  html += "      <h3>Basic Configuration</h3>\n";
  html += "      <pre><code>";
  html += "// Basic library configuration\n";
  html += 'import "github.com/arbiter-framework/schemas/artifact"\n';
  html += 'import "github.com/arbiter-framework/schemas/profiles"\n\n';
  html += "Artifact: artifact.#Artifact & {\n";
  html += '  kind: "library"\n';
  html += '  language: "typescript"\n';
  html += "}\n";
  html += "</code></pre>\n";
  html += "    </section>\n";

  html += "  </main>\n";

  // Footer
  html += "  <footer>\n";
  html += "    <p>Generated by Arbiter CLI</p>\n";
  html += `    <p><a href="https://github.com/arbiter-framework/arbiter">Learn more</a></p>\n`;
  html += "  </footer>\n";

  html += "</body>\n";
  html += "</html>\n";

  return html;
}

/**
 * Library example template
 */
export const LIBRARY_EXAMPLE_TEMPLATE = `// Example: Library Configuration
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript"

  build: {
    tool: "bun"
    targets: ["./src"]
    matrix: {
      versions: ["18", "20", "latest"]
      os: ["linux", "darwin"]
    }
  }

  packaging: {
    publish: true
    registry: "npm"
  }
}

Profile: profiles.#library & {
  semver: "strict"
  apiSurface: {
    source: "generated"
    file: "./dist/api-surface.json"
  }
  contracts: {
    forbidBreaking: true
    invariants: [
      // Your invariants here
    ]
  }
}
`;

/**
 * CLI example template
 */
export const CLI_EXAMPLE_TEMPLATE = `// Example: CLI Tool Configuration
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "cli"
  language: "typescript"

  build: {
    tool: "bun"
    targets: ["./src/cli.ts"]
  }
}

Profile: profiles.#cli & {
  commands: [
    {
      name: "main"
      summary: "Main command"
      args: [
        {name: "input", type: "string", description: "Input file"}
      ]
      flags: [
        {name: "help", type: "bool", default: false}
        {name: "verbose", type: "bool", default: false}
        {name: "output", type: "string", default: "stdout"}
      ]
      exits: [
        {code: 0, meaning: "success"}
        {code: 1, meaning: "error"}
      ]
    }
  ]

  tests: {
    golden: [
      {name: "help_output", command: ["--help"]}
    ]
  }
}
`;
