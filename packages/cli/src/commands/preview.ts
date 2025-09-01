/**
 * Preview command - Generate deterministic plans showing what would be created
 * 
 * This command analyzes the assembly.cue file and shows what would be generated
 * without actually creating files. Critical for deterministic output testing.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { Config } from '../config.js';

export interface PreviewOptions {
  format?: 'json' | 'yaml' | 'text';
  output?: string;
  outputDir?: string;
  verbose?: boolean;
  includeContent?: boolean;
}

interface PreviewPlan {
  timestamp: string;
  assembly: {
    language: string;
    kind: string;
    name: string;
    version: string;
    buildTool?: string;
  };
  plannedFiles: Array<{
    path: string;
    type: 'file' | 'directory';
    size?: number;
    checksum?: string;
    content?: string;
  }>;
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    target: string;
    reason: string;
  }>;
  metadata: {
    totalFiles: number;
    totalDirectories: number;
    estimatedSize: number;
  };
}

/**
 * Main preview command implementation
 */
export async function previewCommand(options: PreviewOptions, config: Config): Promise<number> {
  try {
    if (options.verbose) {
      console.log(chalk.blue('🔍 Generating deterministic preview plan...'));
    }
    
    // Read assembly file
    const assemblyPath = path.resolve('arbiter.assembly.cue');
    if (!fs.existsSync(assemblyPath)) {
      console.error(chalk.red('❌ No arbiter.assembly.cue found in current directory'));
      console.log(chalk.dim('Initialize a project with: arbiter init'));
      return 1;
    }
    
    const assemblyContent = fs.readFileSync(assemblyPath, 'utf-8');
    const assemblyConfig = parseAssemblyFile(assemblyContent);
    
    // Generate deterministic plan
    const plan = await generatePreviewPlan(assemblyConfig, options);
    
    // Output plan in requested format
    let output: string;
    switch (options.format) {
      case 'json':
        output = JSON.stringify(plan, null, 2);
        break;
      case 'yaml':
        output = convertToYAML(plan);
        break;
      default:
        output = formatAsText(plan, options.verbose);
        break;
    }
    
    // Write to file or stdout
    if (options.output) {
      const outputDir = options.outputDir || '.';
      const outputPath = path.isAbsolute(options.output) ? options.output : path.join(outputDir, options.output);
      
      // Ensure output directory exists
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      
      fs.writeFileSync(outputPath, output);
      if (options.verbose) {
        console.log(chalk.green(`✅ Preview plan written to ${outputPath}`));
      }
    } else {
      console.log(output);
    }
    
    return 0;
    
  } catch (error) {
    console.error(chalk.red('❌ Preview failed:'), error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/**
 * Parse assembly.cue file and extract configuration
 */
function parseAssemblyFile(content: string): any {
  // Basic CUE parsing - extract key information
  const config: any = {
    kind: 'library',
    language: 'typescript',
    name: 'unknown',
    version: '1.0.0'
  };
  
  // Extract language
  const langMatch = content.match(/language:\s*"([^"]+)"/);
  if (langMatch) {
    config.language = langMatch[1];
  }
  
  // Extract kind
  const kindMatch = content.match(/kind:\s*"([^"]+)"/);
  if (kindMatch) {
    config.kind = kindMatch[1];
  }
  
  // Extract name from metadata
  const nameMatch = content.match(/name:\s*"([^"]+)"/);
  if (nameMatch) {
    config.name = nameMatch[1];
  }
  
  // Extract version
  const versionMatch = content.match(/version:\s*"([^"]+)"/);
  if (versionMatch) {
    config.version = versionMatch[1];
  }
  
  // Extract build tool
  const toolMatch = content.match(/tool:\s*"([^"]+)"/);
  if (toolMatch) {
    config.buildTool = toolMatch[1];
  }
  
  return config;
}

/**
 * Generate a deterministic preview plan
 */
async function generatePreviewPlan(assemblyConfig: any, options: PreviewOptions): Promise<PreviewPlan> {
  const plan: PreviewPlan = {
    // Use fixed timestamp for deterministic output
    timestamp: '2024-01-01T00:00:00.000Z',
    assembly: assemblyConfig,
    plannedFiles: [],
    operations: [],
    metadata: {
      totalFiles: 0,
      totalDirectories: 0,
      estimatedSize: 0
    }
  };
  
  // Plan language-specific files
  const languageFiles = planLanguageFiles(assemblyConfig);
  plan.plannedFiles.push(...languageFiles);
  
  // Plan project structure files
  const structureFiles = planProjectStructure(assemblyConfig);
  plan.plannedFiles.push(...structureFiles);
  
  // Plan CI files if applicable
  if (assemblyConfig.ci !== false) {
    const ciFiles = planCIFiles(assemblyConfig);
    plan.plannedFiles.push(...ciFiles);
  }
  
  // Generate operations
  plan.operations = plan.plannedFiles.map(file => ({
    type: 'create' as const,
    target: file.path,
    reason: `Generate ${file.type} for ${assemblyConfig.language} ${assemblyConfig.kind}`
  }));
  
  // Calculate metadata
  plan.metadata.totalFiles = plan.plannedFiles.filter(f => f.type === 'file').length;
  plan.metadata.totalDirectories = plan.plannedFiles.filter(f => f.type === 'directory').length;
  plan.metadata.estimatedSize = plan.plannedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  
  // Add content if requested (for deterministic comparison)
  if (options.includeContent) {
    plan.plannedFiles.forEach(file => {
      if (file.type === 'file') {
        file.content = generateFileContent(file.path, assemblyConfig);
        file.checksum = generateChecksum(file.content);
        file.size = file.content.length;
      }
    });
  }
  
  return plan;
}

/**
 * Plan language-specific files
 */
function planLanguageFiles(config: any): Array<{ path: string; type: 'file' | 'directory'; size?: number }> {
  const files: Array<{ path: string; type: 'file' | 'directory'; size?: number }> = [];
  
  switch (config.language) {
    case 'typescript':
      files.push(
        { path: 'package.json', type: 'file', size: 500 },
        { path: 'tsconfig.json', type: 'file', size: 300 },
        { path: 'src/', type: 'directory' },
        { path: 'src/index.ts', type: 'file', size: 200 },
        { path: 'tests/', type: 'directory' }
      );
      break;
    case 'python':
      files.push(
        { path: 'pyproject.toml', type: 'file', size: 400 },
        { path: 'requirements.txt', type: 'file', size: 100 },
        { path: `src/${config.name}/`, type: 'directory' },
        { path: `src/${config.name}/__init__.py`, type: 'file', size: 150 },
        { path: `src/${config.name}/main.py`, type: 'file', size: 200 },
        { path: 'tests/', type: 'directory' }
      );
      break;
    case 'rust':
      files.push(
        { path: 'Cargo.toml', type: 'file', size: 200 },
        { path: 'src/', type: 'directory' },
        { path: 'src/lib.rs', type: 'file', size: 300 },
        { path: 'tests/', type: 'directory' }
      );
      break;
    case 'go':
      files.push(
        { path: 'go.mod', type: 'file', size: 100 },
        { path: 'main.go', type: 'file', size: 250 },
        { path: 'test/', type: 'directory' }
      );
      break;
    case 'shell':
    case 'bash':
      files.push(
        { path: 'Makefile', type: 'file', size: 300 },
        { path: 'src/', type: 'directory' },
        { path: `src/${config.name}`, type: 'file', size: 400 },
        { path: 'tests/', type: 'directory' }
      );
      break;
  }
  
  return files;
}

/**
 * Plan project structure files
 */
function planProjectStructure(config: any): Array<{ path: string; type: 'file' | 'directory'; size?: number }> {
  return [
    { path: 'README.md', type: 'file', size: 800 },
    { path: '.gitignore', type: 'file', size: 200 }
  ];
}

/**
 * Plan CI/CD files
 */
function planCIFiles(config: any): Array<{ path: string; type: 'file' | 'directory'; size?: number }> {
  return [
    { path: '.github/', type: 'directory' },
    { path: '.github/workflows/', type: 'directory' },
    { path: '.github/workflows/ci.yml', type: 'file', size: 600 }
  ];
}

/**
 * Generate deterministic file content for checksums
 */
function generateFileContent(filePath: string, config: any): string {
  // Return predictable content based on file path and config
  // This ensures identical runs produce identical output
  
  if (filePath === 'README.md') {
    return `# ${config.name}\n\nGenerated by Arbiter - Version ${config.version}\n`;
  }
  
  if (filePath === 'package.json') {
    return JSON.stringify({
      name: config.name,
      version: config.version,
      type: "module"
    }, null, 2);
  }
  
  if (filePath.endsWith('.ts')) {
    return `// ${config.name} - Generated by Arbiter\nexport function main() {\n  console.log('Hello!');\n}\n`;
  }
  
  if (filePath.endsWith('.py')) {
    return `# ${config.name} - Generated by Arbiter\ndef main():\n    print('Hello!')\n`;
  }
  
  if (filePath.endsWith('.rs')) {
    return `// ${config.name} - Generated by Arbiter\npub fn main() {\n    println!("Hello!");\n}\n`;
  }
  
  if (filePath.endsWith('.go')) {
    return `// ${config.name} - Generated by Arbiter\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello!")\n}\n`;
  }
  
  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
    return `# ${config.name} CI - Generated by Arbiter\nname: CI\n\non: [push, pull_request]\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n`;
  }
  
  // Default content
  return `# Generated by Arbiter for ${config.name}\n`;
}

/**
 * Generate a simple checksum for content
 */
function generateChecksum(content: string): string {
  // Simple hash for deterministic checksums
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Convert plan to YAML format
 */
function convertToYAML(plan: PreviewPlan): string {
  // Simple YAML conversion
  return `timestamp: "${plan.timestamp}"
assembly:
  language: "${plan.assembly.language}"
  kind: "${plan.assembly.kind}"
  name: "${plan.assembly.name}"
  version: "${plan.assembly.version}"
plannedFiles:
${plan.plannedFiles.map(f => `  - path: "${f.path}"\n    type: "${f.type}"`).join('\n')}
operations:
${plan.operations.map(op => `  - type: "${op.type}"\n    target: "${op.target}"\n    reason: "${op.reason}"`).join('\n')}
metadata:
  totalFiles: ${plan.metadata.totalFiles}
  totalDirectories: ${plan.metadata.totalDirectories}
  estimatedSize: ${plan.metadata.estimatedSize}
`;
}

/**
 * Format plan as human-readable text
 */
function formatAsText(plan: PreviewPlan, verbose: boolean = false): string {
  let output = '';
  
  if (verbose) {
    output += chalk.blue('📋 Preview Plan\n');
    output += chalk.dim(`Generated: ${plan.timestamp}\n\n`);
  }
  
  output += chalk.cyan('Assembly Configuration:\n');
  output += `  Language: ${plan.assembly.language}\n`;
  output += `  Kind: ${plan.assembly.kind}\n`;
  output += `  Name: ${plan.assembly.name}\n`;
  output += `  Version: ${plan.assembly.version}\n`;
  if (plan.assembly.buildTool) {
    output += `  Build Tool: ${plan.assembly.buildTool}\n`;
  }
  output += '\n';
  
  output += chalk.cyan('Planned Files:\n');
  const files = plan.plannedFiles.filter(f => f.type === 'file');
  const dirs = plan.plannedFiles.filter(f => f.type === 'directory');
  
  dirs.forEach(dir => {
    output += chalk.yellow(`  📁 ${dir.path}\n`);
  });
  
  files.forEach(file => {
    output += chalk.green(`  📄 ${file.path}`);
    if (file.size) {
      output += chalk.dim(` (${file.size} bytes)`);
    }
    if (file.checksum && verbose) {
      output += chalk.dim(` [${file.checksum}]`);
    }
    output += '\n';
  });
  
  output += '\n';
  output += chalk.cyan('Summary:\n');
  output += `  Files: ${plan.metadata.totalFiles}\n`;
  output += `  Directories: ${plan.metadata.totalDirectories}\n`;
  output += `  Estimated Size: ${plan.metadata.estimatedSize} bytes\n`;
  
  if (verbose) {
    output += '\n';
    output += chalk.cyan('Operations:\n');
    plan.operations.forEach(op => {
      output += `  ${op.type.toUpperCase()} ${op.target} - ${op.reason}\n`;
    });
  }
  
  return output;
}