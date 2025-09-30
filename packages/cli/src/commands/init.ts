import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';
import { DEFAULT_CONFIG } from '../config.js';
import type { InitOptions, ProjectTemplate } from '../types.js';
import { withProgress } from '../utils/progress.js';

/**
 * Basic project templates for initialization (structure only - no CUE files)
 */
const TEMPLATES: Record<string, ProjectTemplate> = {
  basic: {
    name: 'Basic',
    description: 'A simple CUE project with basic structure',
    files: {
      'cue.mod/module.cue': `module: "example.com/myproject"
language: version: "v0.6.0"
`,
      'README.md': `# {{PROJECT_NAME}}

This is a CUE project created with Arbiter CLI.

## Getting Started

⚠️  **IMPORTANT**: This project has been initialized with basic structure only.
To add functionality, use the Arbiter CLI commands to build your specification:

### 1. Add components to your specification:
\`\`\`bash
# Add API endpoints, data models, configurations, etc.
arbiter add <component-type> <name>
\`\`\`

### 2. Generate project files from your specification:
\`\`\`bash
arbiter generate
\`\`\`

### 3. Validate your configuration:
\`\`\`bash
arbiter check
\`\`\`

## Project Structure

- \`cue.mod/\` - CUE module configuration
- \`.arbiter/config.json\` - Arbiter CLI configuration
- Generated CUE files will appear after running \`arbiter generate\`

## Learn More

- [CUE Documentation](https://cuelang.org/docs/)
- [Arbiter CLI](https://github.com/arbiter/cli)
`,
      '.gitignore': `# Build artifacts
*.out
dist/
build/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
`,
    },
  },

  kubernetes: {
    name: 'Kubernetes',
    description: 'CUE project for Kubernetes configurations',
    files: {
      'cue.mod/module.cue': `module: "example.com/k8s-config"
language: version: "v0.6.0"
`,
      'README.md': `# {{PROJECT_NAME}} - Kubernetes Configuration

This project uses CUE to manage Kubernetes configurations with type safety and validation.

## Getting Started

⚠️  **IMPORTANT**: This project has been initialized with basic structure only.
To add Kubernetes resources, use the Arbiter CLI commands:

### 1. Add Kubernetes components:
\`\`\`bash
# Add deployments, services, configmaps, etc.
arbiter add deployment <name>
arbiter add service <name>
arbiter add configmap <name>
\`\`\`

### 2. Generate CUE files:
\`\`\`bash
arbiter generate
\`\`\`

### 3. Validate configurations:
\`\`\`bash
arbiter check
\`\`\`

### 4. Export to YAML:
\`\`\`bash
arbiter export --format k8s
\`\`\`

## Next Steps

1. Import Kubernetes schemas: \`cue get go k8s.io/api/...\`
2. Use \`arbiter add\` commands to build your specification
3. Generate and validate your configurations
`,
    },
  },

  api: {
    name: 'API Schema',
    description: 'CUE project for API schema definition',
    files: {
      'cue.mod/module.cue': `module: "example.com/api-schema"
language: version: "v0.6.0"
`,
      'README.md': `# {{PROJECT_NAME}} - API Schema

This project defines API schemas using CUE with type safety and OpenAPI generation.

## Getting Started

⚠️  **IMPORTANT**: This project has been initialized with basic structure only.
To define your API, use the Arbiter CLI commands:

### 1. Add API components:
\`\`\`bash
# Add data models, endpoints, types, etc.
arbiter add model <name>
arbiter add endpoint <path>
arbiter add type <name>
\`\`\`

### 2. Generate CUE files:
\`\`\`bash
arbiter generate
\`\`\`

### 3. Validate schemas:
\`\`\`bash
arbiter check
\`\`\`

### 4. Export OpenAPI spec:
\`\`\`bash
arbiter export --format openapi > openapi.yaml
\`\`\`

### 5. Generate TypeScript types:
\`\`\`bash
arbiter export --format types > types.ts
\`\`\`

## Features (after adding components)

- Type-safe API definitions
- Automatic validation
- OpenAPI generation
- TypeScript type generation
`,
    },
  },
};

/**
 * Initialize a new CUE project with templates
 */
export async function initCommand(
  displayName: string | undefined,
  options: InitOptions
): Promise<number> {
  try {
    // Get project details
    const projectDetails = await getProjectDetails(displayName, options);
    const { name, directory, template } = projectDetails;

    // Check if directory exists and handle accordingly
    const targetDir = path.resolve(directory);
    const exists = await fs.pathExists(targetDir);
    const displayPath = path.relative(process.cwd(), targetDir) || '.';

    if (exists && !options.force) {
      console.log(
        chalk.yellow(`Directory "${displayPath}" already exists. Use --force to overwrite.`)
      );
      return 1;
    }

    // Create project
    return await withProgress(
      { text: `Creating project "${name}"...`, color: 'green' },
      async () => {
        await createProject(targetDir, name, template);

        console.log(chalk.green(`\n✓ Created project "${name}" in ${displayPath}`));

        console.log(chalk.yellow('\n📋 IMPORTANT: Basic project structure created'));
        console.log(chalk.red('⚠️  NO CUE files have been generated yet - this is intentional!'));
        console.log(chalk.dim('\nNext steps:'));
        console.log(chalk.dim(`  cd ${displayPath}`));
        console.log(chalk.green('  1. Add components to build your specification:'));
        console.log(
          chalk.cyan(
            '     arbiter add <component-type> <name>  # Add models, endpoints, configs, etc.'
          )
        );
        console.log(chalk.green('  2. Generate CUE files from your specification:'));
        console.log(chalk.cyan('     arbiter generate  # Creates the actual CUE files'));
        console.log(chalk.green('  3. Validate your generated CUE files:'));
        console.log(chalk.cyan('     arbiter check  # Validate the generated CUE'));
        console.log(chalk.dim("\n💡 Use 'arbiter --help' to see all available add commands"));

        return 0;
      }
    );
  } catch (error) {
    console.error(
      chalk.red('Init command failed:'),
      error instanceof Error ? error.message : String(error)
    );
    return 2;
  }
}

/**
 * Get project details from user input
 */
async function getProjectDetails(
  displayName: string | undefined,
  options: InitOptions
): Promise<{ name: string; directory: string; template: ProjectTemplate }> {
  // Use defaults for all required values, no interactive prompts
  const targetDirectory = options.directory ? path.resolve(options.directory) : process.cwd();
  const name = displayName || options.name || path.basename(targetDirectory);
  const templateKey = options.template || options.schema || 'basic';
  const resolvedTemplateKey = templateKey === 'app' ? 'basic' : templateKey;
  const directory = targetDirectory;
  const template = TEMPLATES[resolvedTemplateKey];
  if (!template) {
    throw new Error(`Unknown template: ${templateKey}`);
  }

  return { name, directory, template };
}

/**
 * Create project files from template
 */
async function createProject(
  targetDir: string,
  projectName: string,
  template: ProjectTemplate
): Promise<void> {
  // Ensure target directory exists
  await fs.ensureDir(targetDir);

  // Create files from template
  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = path.join(targetDir, filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.ensureDir(dir);

    // Replace template variables
    const processedContent = content
      .replace(/{{PROJECT_NAME}}/g, projectName)
      .replace(/{{DESCRIPTION}}/g, template.description);

    await fs.writeFile(fullPath, processedContent, 'utf-8');
  }

  // Create .arbiter/config.json config file
  const configContent = {
    apiUrl: DEFAULT_CONFIG.apiUrl,
    format: DEFAULT_CONFIG.format,
    color: DEFAULT_CONFIG.color,
    timeout: DEFAULT_CONFIG.timeout,
  };

  const arbiterDir = path.join(targetDir, '.arbiter');
  await fs.ensureDir(arbiterDir);
  await fs.writeFile(
    path.join(arbiterDir, 'config.json'),
    JSON.stringify(configContent, null, 2),
    'utf-8'
  );
}

/**
 * List available templates
 */
export function listTemplates(): void {
  console.log(chalk.cyan('Available templates:'));
  console.log();

  Object.entries(TEMPLATES).forEach(([key, template]) => {
    console.log(`${chalk.green(key.padEnd(12))} ${template.description}`);
  });
}
