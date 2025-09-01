#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import type { Config } from '../config.js';

/**
 * Options for docs command
 */
export interface DocsOptions {
  format?: 'markdown' | 'html' | 'json';
  output?: string;
  outputDir?: string;
  template?: string;
  interactive?: boolean;
  examples?: boolean;
}

/**
 * CUE Schema Documentation Structure
 */
interface SchemaDoc {
  name: string;
  description: string;
  fields: FieldDoc[];
  examples: string[];
  constraints: string[];
  imports: string[];
}

interface FieldDoc {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: string;
  constraints: string[];
}

/**
 * Schema documentation generator from CUE definitions
 */
export async function docsCommand(subcommand: 'schema' | 'api' | 'help', options: DocsOptions, config: Config): Promise<number> {
  try {
    switch (subcommand) {
      case 'schema':
        return await generateSchemaDocumentation(options, config);
      case 'api':
        return await generateApiDocumentation(options, config);
      case 'help':
        showDocsHelp();
        return 0;
      default:
        console.error(chalk.red(`Unknown docs subcommand: ${subcommand}`));
        showDocsHelp();
        return 1;
    }
  } catch (error) {
    console.error(chalk.red('Documentation generation failed:'), error instanceof Error ? error.message : String(error));
    return 2;
  }
}

/**
 * Generate schema documentation from arbiter.assembly.cue
 */
async function generateSchemaDocumentation(options: DocsOptions, config: Config): Promise<number> {
  console.log(chalk.blue('📚 Generating schema documentation from CUE definitions...'));

  // Check for assembly file
  const assemblyPath = path.resolve('arbiter.assembly.cue');
  
  try {
    await fs.access(assemblyPath);
    console.log(chalk.green('✅ Found arbiter.assembly.cue'));
  } catch {
    console.log(chalk.red('❌ No arbiter.assembly.cue found in current directory'));
    console.log(chalk.dim('Run: arbiter init --template <type> to create one'));
    return 1;
  }

  // Read and parse the assembly file
  const assemblyContent = await fs.readFile(assemblyPath, 'utf-8');
  
  // Parse CUE content to extract schema information
  const schemaInfo = await parseCueSchema(assemblyContent);
  
  // Generate documentation based on format
  const format = options.format || 'markdown';
  const outputDir = options.outputDir || '.';
  const filename = options.output || `schema-docs.${format === 'json' ? 'json' : format === 'html' ? 'html' : 'md'}`;
  const outputPath = path.isAbsolute(filename) ? filename : path.join(outputDir, filename);
  
  // Ensure output directory exists
  const outputDirPath = path.dirname(outputPath);
  await fs.mkdir(outputDirPath, { recursive: true });
  
  console.log(chalk.blue(`📝 Generating ${format.toUpperCase()} documentation...`));
  console.log(chalk.dim(`Output: ${outputPath}`));
  
  let documentationContent: string;
  
  switch (format) {
    case 'markdown':
      documentationContent = generateMarkdownDocs(schemaInfo);
      break;
    case 'html':
      documentationContent = generateHtmlDocs(schemaInfo);
      break;
    case 'json':
      documentationContent = JSON.stringify(schemaInfo, null, 2);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  
  // Write documentation file
  await fs.writeFile(outputPath, documentationContent, 'utf-8');
  console.log(chalk.green(`✅ Generated documentation: ${outputPath}`));
  
  // Generate examples if requested
  if (options.examples) {
    await generateExampleFiles(schemaInfo, outputDirPath);
  }
  
  // Show next steps
  console.log(chalk.blue('\n🎯 Next steps:'));
  console.log(chalk.dim(`  📖 View documentation: ${outputPath}`));
  console.log(chalk.dim('  🔄 Regenerate automatically: arbiter watch --docs'));
  console.log(chalk.dim('  🌐 Serve docs: arbiter docs serve (coming soon)'));
  
  return 0;
}

/**
 * Generate API documentation from surface.json
 */
async function generateApiDocumentation(options: DocsOptions, config: Config): Promise<number> {
  console.log(chalk.blue('🔌 Generating API documentation...'));
  
  const surfacePath = path.resolve('surface.json');
  
  try {
    await fs.access(surfacePath);
  } catch {
    console.log(chalk.yellow('⚠️  No surface.json found'));
    console.log(chalk.dim('Run: arbiter surface <language> to generate API surface'));
    return 1;
  }
  
  const surfaceContent = await fs.readFile(surfacePath, 'utf-8');
  const surfaceData = JSON.parse(surfaceContent);
  
  const format = options.format || 'markdown';
  const outputDir = options.outputDir || '.';
  const filename = options.output || `api-docs.${format === 'html' ? 'html' : 'md'}`;
  const outputPath = path.isAbsolute(filename) ? filename : path.join(outputDir, filename);
  
  // Ensure output directory exists
  const outputDirPath = path.dirname(outputPath);
  await fs.mkdir(outputDirPath, { recursive: true });
  
  console.log(chalk.blue(`📝 Generating API ${format.toUpperCase()} documentation...`));
  console.log(chalk.dim(`Output: ${outputPath}`));
  
  const apiDocs = generateApiDocs(surfaceData, format);
  
  await fs.writeFile(outputPath, apiDocs, 'utf-8');
  console.log(chalk.green(`✅ Generated API documentation: ${outputPath}`));
  
  // Show next steps
  console.log(chalk.blue('\n🎯 Next steps:'));
  console.log(chalk.dim(`  📖 View API docs: ${outputPath}`));
  console.log(chalk.dim('  🔄 Update surface: arbiter surface <language> --diff'));
  
  return 0;
}

/**
 * Parse CUE schema to extract documentation information
 */
async function parseCueSchema(content: string): Promise<SchemaDoc> {
  // This is a simplified parser - in production you'd use the CUE API
  // For now, we'll extract basic structure from the assembly file
  
  const lines = content.split('\n');
  const schemaDoc: SchemaDoc = {
    name: 'Arbiter Assembly',
    description: 'Arbiter project configuration schema',
    fields: [],
    examples: [],
    constraints: [],
    imports: []
  };
  
  let currentField: FieldDoc | null = null;
  let inComment = false;
  let commentBuffer: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Extract imports
    if (trimmedLine.startsWith('import ')) {
      const importMatch = trimmedLine.match(/import\s+"([^"]+)"/);
      if (importMatch) {
        schemaDoc.imports.push(importMatch[1]);
      }
    }
    
    // Extract comments
    if (trimmedLine.startsWith('//')) {
      commentBuffer.push(trimmedLine.replace(/^\/\/\s*/, ''));
      inComment = true;
      continue;
    }
    
    // Extract field definitions
    if (trimmedLine.includes(':') && !trimmedLine.startsWith('//')) {
      const fieldMatch = trimmedLine.match(/^([^:]+):\s*(.+)$/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1].trim();
        const fieldType = fieldMatch[2].trim();
        
        // Skip internal fields
        if (fieldName.startsWith('_')) continue;
        
        const field: FieldDoc = {
          name: fieldName,
          type: fieldType,
          description: commentBuffer.join(' '),
          required: !fieldType.includes('?') && !trimmedLine.includes('default:'),
          constraints: []
        };
        
        // Extract default values
        if (trimmedLine.includes('default:')) {
          const defaultMatch = trimmedLine.match(/default:\s*([^,}]+)/);
          if (defaultMatch) {
            field.default = defaultMatch[1].trim();
          }
        }
        
        schemaDoc.fields.push(field);
      }
      
      // Reset comment buffer
      commentBuffer = [];
      inComment = false;
    }
  }
  
  return schemaDoc;
}

/**
 * Generate Markdown documentation
 */
function generateMarkdownDocs(schemaInfo: SchemaDoc): string {
  let md = '';
  
  // Header
  md += `# ${schemaInfo.name}\n\n`;
  md += `${schemaInfo.description}\n\n`;
  
  // Auto-generated notice
  md += `> 🤖 This documentation is auto-generated from CUE definitions.\n`;
  md += `> Last updated: ${new Date().toISOString()}\n\n`;
  
  // Table of Contents
  md += `## Table of Contents\n\n`;
  md += `- [Schema Overview](#schema-overview)\n`;
  md += `- [Fields](#fields)\n`;
  md += `- [Imports](#imports)\n`;
  md += `- [Examples](#examples)\n`;
  md += `- [Constraints](#constraints)\n\n`;
  
  // Schema Overview
  md += `## Schema Overview\n\n`;
  md += `This schema defines the structure for Arbiter project configurations.\n\n`;
  
  // Fields
  md += `## Fields\n\n`;
  md += `| Field | Type | Required | Default | Description |\n`;
  md += `|-------|------|----------|---------|-------------|\n`;
  
  for (const field of schemaInfo.fields) {
    const required = field.required ? '✅' : '❌';
    const defaultVal = field.default ? `\`${field.default}\`` : '-';
    md += `| \`${field.name}\` | \`${field.type}\` | ${required} | ${defaultVal} | ${field.description || 'No description'} |\n`;
  }
  
  md += `\n`;
  
  // Imports
  if (schemaInfo.imports.length > 0) {
    md += `## Imports\n\n`;
    md += `This schema imports the following modules:\n\n`;
    
    for (const importPath of schemaInfo.imports) {
      md += `- \`${importPath}\`\n`;
    }
    
    md += `\n`;
  }
  
  // Examples
  md += `## Examples\n\n`;
  md += `### Basic Configuration\n\n`;
  md += `\`\`\`cue\n`;
  md += `// Basic library configuration\n`;
  md += `import "github.com/arbiter-framework/schemas/artifact"\n`;
  md += `import "github.com/arbiter-framework/schemas/profiles"\n\n`;
  md += `Artifact: artifact.#Artifact & {\n`;
  md += `  kind: "library"\n`;
  md += `  language: "typescript"\n`;
  md += `  build: {\n`;
  md += `    tool: "bun"\n`;
  md += `    targets: ["./src"]\n`;
  md += `  }\n`;
  md += `}\n\n`;
  md += `Profile: profiles.#library & {\n`;
  md += `  semver: "strict"\n`;
  md += `  apiSurface: {\n`;
  md += `    source: "generated"\n`;
  md += `    file: "./dist/api-surface.json"\n`;
  md += `  }\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;
  
  md += `### CLI Configuration\n\n`;
  md += `\`\`\`cue\n`;
  md += `Artifact: artifact.#Artifact & {\n`;
  md += `  kind: "cli"\n`;
  md += `  language: "typescript"\n`;
  md += `}\n\n`;
  md += `Profile: profiles.#cli & {\n`;
  md += `  commands: [\n`;
  md += `    {\n`;
  md += `      name: "main"\n`;
  md += `      summary: "Main command"\n`;
  md += `      args: []\n`;
  md += `      flags: [\n`;
  md += `        {name: "help", type: "bool", default: false}\n`;
  md += `      ]\n`;
  md += `    }\n`;
  md += `  ]\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;
  
  // Footer
  md += `---\n\n`;
  md += `**Generated by Arbiter CLI** - [Learn more](https://github.com/arbiter-framework/arbiter)\n`;
  
  return md;
}

/**
 * Generate HTML documentation
 */
function generateHtmlDocs(schemaInfo: SchemaDoc): string {
  let html = '';
  
  html += `<!DOCTYPE html>\n`;
  html += `<html lang="en">\n`;
  html += `<head>\n`;
  html += `  <meta charset="UTF-8">\n`;
  html += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
  html += `  <title>${schemaInfo.name} - Schema Documentation</title>\n`;
  html += `  <style>\n`;
  html += generateCssStyles();
  html += `  </style>\n`;
  html += `</head>\n`;
  html += `<body>\n`;
  
  // Header
  html += `  <header>\n`;
  html += `    <h1>${schemaInfo.name}</h1>\n`;
  html += `    <p class="description">${schemaInfo.description}</p>\n`;
  html += `    <div class="meta">Auto-generated on ${new Date().toLocaleString()}</div>\n`;
  html += `  </header>\n`;
  
  // Navigation
  html += `  <nav>\n`;
  html += `    <ul>\n`;
  html += `      <li><a href="#overview">Overview</a></li>\n`;
  html += `      <li><a href="#fields">Fields</a></li>\n`;
  html += `      <li><a href="#examples">Examples</a></li>\n`;
  html += `    </ul>\n`;
  html += `  </nav>\n`;
  
  // Main content
  html += `  <main>\n`;
  
  // Overview
  html += `    <section id="overview">\n`;
  html += `      <h2>Schema Overview</h2>\n`;
  html += `      <p>This schema defines the structure for Arbiter project configurations.</p>\n`;
  
  if (schemaInfo.imports.length > 0) {
    html += `      <h3>Imports</h3>\n`;
    html += `      <ul>\n`;
    for (const importPath of schemaInfo.imports) {
      html += `        <li><code>${importPath}</code></li>\n`;
    }
    html += `      </ul>\n`;
  }
  
  html += `    </section>\n`;
  
  // Fields
  html += `    <section id="fields">\n`;
  html += `      <h2>Fields</h2>\n`;
  html += `      <table>\n`;
  html += `        <thead>\n`;
  html += `          <tr>\n`;
  html += `            <th>Field</th>\n`;
  html += `            <th>Type</th>\n`;
  html += `            <th>Required</th>\n`;
  html += `            <th>Default</th>\n`;
  html += `            <th>Description</th>\n`;
  html += `          </tr>\n`;
  html += `        </thead>\n`;
  html += `        <tbody>\n`;
  
  for (const field of schemaInfo.fields) {
    const required = field.required ? '<span class="required">Yes</span>' : '<span class="optional">No</span>';
    const defaultVal = field.default ? `<code>${field.default}</code>` : '-';
    html += `          <tr>\n`;
    html += `            <td><code>${field.name}</code></td>\n`;
    html += `            <td><code>${field.type}</code></td>\n`;
    html += `            <td>${required}</td>\n`;
    html += `            <td>${defaultVal}</td>\n`;
    html += `            <td>${field.description || 'No description'}</td>\n`;
    html += `          </tr>\n`;
  }
  
  html += `        </tbody>\n`;
  html += `      </table>\n`;
  html += `    </section>\n`;
  
  // Examples
  html += `    <section id="examples">\n`;
  html += `      <h2>Examples</h2>\n`;
  html += `      <div class="example">\n`;
  html += `        <h3>Basic Library Configuration</h3>\n`;
  html += `        <pre><code class="language-cue">`;
  html += `// Basic library configuration
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript"
  build: {
    tool: "bun"
    targets: ["./src"]
  }
}

Profile: profiles.#library & {
  semver: "strict"
  apiSurface: {
    source: "generated"
    file: "./dist/api-surface.json"
  }
}`;
  html += `</code></pre>\n`;
  html += `      </div>\n`;
  html += `    </section>\n`;
  
  html += `  </main>\n`;
  
  // Footer
  html += `  <footer>\n`;
  html += `    <p>Generated by <strong>Arbiter CLI</strong></p>\n`;
  html += `  </footer>\n`;
  
  html += `</body>\n`;
  html += `</html>\n`;
  
  return html;
}

/**
 * Generate CSS styles for HTML documentation
 */
function generateCssStyles(): string {
  return `
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
      background: #fafafa;
    }
    
    header {
      border-bottom: 3px solid #007acc;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
    }
    
    header h1 {
      color: #007acc;
      margin: 0;
    }
    
    .description {
      font-size: 1.1rem;
      color: #666;
      margin: 0.5rem 0;
    }
    
    .meta {
      font-size: 0.9rem;
      color: #888;
    }
    
    nav {
      background: white;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    nav ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      gap: 2rem;
    }
    
    nav a {
      color: #007acc;
      text-decoration: none;
      font-weight: 500;
    }
    
    nav a:hover {
      text-decoration: underline;
    }
    
    main {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    section {
      margin-bottom: 3rem;
    }
    
    h2 {
      color: #007acc;
      border-bottom: 1px solid #eee;
      padding-bottom: 0.5rem;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    
    th {
      background: #f8f9fa;
      font-weight: 600;
    }
    
    tr:nth-child(even) {
      background: #f8f9fa;
    }
    
    code {
      background: #f1f3f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1.5rem;
      border-radius: 6px;
      overflow-x: auto;
    }
    
    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    
    .required {
      color: #28a745;
      font-weight: bold;
    }
    
    .optional {
      color: #6c757d;
    }
    
    .example {
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      overflow: hidden;
      margin: 1rem 0;
    }
    
    .example h3 {
      background: #f6f8fa;
      margin: 0;
      padding: 1rem;
      border-bottom: 1px solid #e1e4e8;
    }
    
    footer {
      text-align: center;
      padding: 2rem;
      color: #666;
      border-top: 1px solid #eee;
      margin-top: 3rem;
    }
  `;
}

/**
 * Generate API documentation from surface data
 */
function generateApiDocs(surfaceData: any, format: string): string {
  if (format === 'html') {
    return generateApiDocsHtml(surfaceData);
  } else {
    return generateApiDocsMarkdown(surfaceData);
  }
}

/**
 * Generate API documentation in Markdown format
 */
function generateApiDocsMarkdown(surfaceData: any): string {
  let md = '';
  
  md += `# API Documentation\n\n`;
  md += `> 🤖 Auto-generated from source code analysis\n`;
  md += `> Last updated: ${new Date().toISOString()}\n\n`;
  
  if (surfaceData.functions && surfaceData.functions.length > 0) {
    md += `## Functions\n\n`;
    
    for (const func of surfaceData.functions) {
      md += `### \`${func.name}\`\n\n`;
      
      if (func.description) {
        md += `${func.description}\n\n`;
      }
      
      // Parameters
      if (func.parameters && func.parameters.length > 0) {
        md += `**Parameters:**\n\n`;
        for (const param of func.parameters) {
          md += `- \`${param.name}\` (${param.type}): ${param.description || 'No description'}\n`;
        }
        md += `\n`;
      }
      
      // Returns
      if (func.returns) {
        md += `**Returns:** \`${func.returns.type}\`\n\n`;
        if (func.returns.description) {
          md += `${func.returns.description}\n\n`;
        }
      }
      
      // Example
      if (func.example) {
        md += `**Example:**\n\n`;
        md += `\`\`\`typescript\n${func.example}\`\`\`\n\n`;
      }
      
      md += `---\n\n`;
    }
  }
  
  return md;
}

/**
 * Generate API documentation in HTML format
 */
function generateApiDocsHtml(surfaceData: any): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <style>${generateCssStyles()}</style>
</head>
<body>
  <header>
    <h1>API Documentation</h1>
    <div class="meta">Auto-generated on ${new Date().toLocaleString()}</div>
  </header>
  
  <main>`;
  
  if (surfaceData.functions && surfaceData.functions.length > 0) {
    html += `
    <section id="functions">
      <h2>Functions</h2>`;
    
    for (const func of surfaceData.functions) {
      html += `
      <div class="function">
        <h3><code>${func.name}</code></h3>`;
      
      if (func.description) {
        html += `<p>${func.description}</p>`;
      }
      
      if (func.parameters && func.parameters.length > 0) {
        html += `
        <h4>Parameters</h4>
        <ul>`;
        for (const param of func.parameters) {
          html += `<li><code>${param.name}</code> (${param.type}): ${param.description || 'No description'}</li>`;
        }
        html += `</ul>`;
      }
      
      if (func.returns) {
        html += `<h4>Returns</h4>`;
        html += `<p><code>${func.returns.type}</code></p>`;
        if (func.returns.description) {
          html += `<p>${func.returns.description}</p>`;
        }
      }
      
      html += `</div>`;
    }
    
    html += `</section>`;
  }
  
  html += `
  </main>
  
  <footer>
    <p>Generated by <strong>Arbiter CLI</strong></p>
  </footer>
</body>
</html>`;
  
  return html;
}

/**
 * Generate example files alongside documentation
 */
async function generateExampleFiles(schemaInfo: SchemaDoc, outputDir: string): Promise<void> {
  const examplesDir = path.join(outputDir, 'examples');
  await fs.mkdir(examplesDir, { recursive: true });
  
  // Generate basic library example
  const libraryExample = `// Example: Basic Library Configuration
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
  
  await fs.writeFile(path.join(examplesDir, 'library.cue'), libraryExample);
  
  // Generate CLI example
  const cliExample = `// Example: CLI Tool Configuration
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
  
  await fs.writeFile(path.join(examplesDir, 'cli.cue'), cliExample);
  
  console.log(chalk.green(`✅ Generated example files in ${examplesDir}`));
}

/**
 * Show help for docs command
 */
function showDocsHelp(): void {
  console.log(`
${chalk.bold('arbiter docs')} - Documentation generation

${chalk.bold('USAGE:')}
  arbiter docs schema [options]     Generate schema documentation from CUE
  arbiter docs api [options]        Generate API documentation from surface
  arbiter docs help                 Show this help

${chalk.bold('OPTIONS:')}
  --format <type>      Output format: markdown, html, json (default: markdown)
  --output <file>      Output file path (auto-named if not specified)
  --examples          Generate example files alongside documentation
  --interactive       Interactive documentation setup

${chalk.bold('EXAMPLES:')}
  arbiter docs schema                           # Generate Markdown schema docs
  arbiter docs schema --format html            # Generate HTML documentation
  arbiter docs schema --examples --format json # Generate JSON schema + examples
  arbiter docs api --format html               # Generate API docs from surface.json
`);
}