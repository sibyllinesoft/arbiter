import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { withProgress } from '../utils/progress.js';
import type { InitOptions, ProjectTemplate } from '../types.js';

/**
 * Project templates for initialization
 */
const TEMPLATES: Record<string, ProjectTemplate> = {
  basic: {
    name: 'Basic',
    description: 'A simple CUE project with basic structure',
    files: {
      'cue.mod/module.cue': `module: "example.com/myproject"
language: version: "v0.6.0"
`,
      'schema.cue': `package main

// Define your schema here
#Config: {
	name: string
	version: string
	env: "dev" | "staging" | "prod"
	database: #Database
}

#Database: {
	host: string
	port: int & >0 & <65536
	name: string
}
`,
      'values.cue': `package main

// Example configuration
config: #Config & {
	name: "my-app"
	version: "1.0.0"
	env: "dev"
	database: {
		host: "localhost"
		port: 5432
		name: "myapp_dev"
	}
}
`,
      'README.md': `# My CUE Project

This is a CUE project created with Arbiter CLI.

## Getting Started

1. Validate your configuration:
   \`\`\`bash
   arbiter check
   \`\`\`

2. Export to different formats:
   \`\`\`bash
   arbiter export --format json,yaml
   \`\`\`

## Project Structure

- \`schema.cue\` - Define your configuration schema
- \`values.cue\` - Your configuration values
- \`cue.mod/\` - CUE module configuration

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
      'k8s/base.cue': `package k8s

import (
	"k8s.io/api/apps/v1"
	"k8s.io/api/core/v1"
)

// Base deployment template
#Deployment: v1.#Deployment & {
	apiVersion: "apps/v1"
	kind: "Deployment"
	metadata: {
		name: string
		namespace: string | *"default"
		labels: {
			app: metadata.name
			...
		}
	}
	spec: {
		replicas: int | *1
		selector: matchLabels: metadata.labels
		template: {
			metadata: labels: metadata.labels
			spec: #PodSpec
		}
	}
}

#PodSpec: v1.#PodSpec & {
	containers: [#Container, ...]
}

#Container: v1.#Container & {
	name: string
	image: string
	ports: [...v1.#ContainerPort]
}
`,
      'k8s/app.cue': `package k8s

// Application deployment
app: #Deployment & {
	metadata: {
		name: "my-app"
		namespace: "default"
		labels: {
			app: "my-app"
			version: "1.0.0"
		}
	}
	spec: {
		replicas: 3
		template: spec: {
			containers: [{
				name: "app"
				image: "my-app:1.0.0"
				ports: [{
					containerPort: 8080
					name: "http"
				}]
			}]
		}
	}
}
`,
      'README.md': `# Kubernetes CUE Configuration

This project uses CUE to manage Kubernetes configurations with type safety and validation.

## Usage

1. Validate configurations:
   \`\`\`bash
   arbiter check k8s/
   \`\`\`

2. Export to Kubernetes YAML:
   \`\`\`bash
   arbiter export --format k8s
   \`\`\`

## Structure

- \`k8s/base.cue\` - Base Kubernetes types and templates
- \`k8s/app.cue\` - Application-specific configurations
- \`cue.mod/\` - CUE module with Kubernetes API definitions

## Next Steps

1. Import Kubernetes schemas: \`cue get go k8s.io/api/...\`
2. Define your application configurations
3. Use \`arbiter export\` to generate YAML manifests
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
      'api/types.cue': `package api

// Common types
#ID: string & =~"^[a-zA-Z0-9_-]+$"
#Email: string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
#Timestamp: string // ISO 8601 format

// Base response structure
#Response: {
	success: bool
	data?: _
	error?: string
	timestamp: #Timestamp
}

// Pagination
#Pagination: {
	page: int & >=1
	limit: int & >=1 & <=100
	total: int & >=0
	hasNext: bool
}

#PaginatedResponse: #Response & {
	data: {
		items: [...] 
		pagination: #Pagination
	}
}
`,
      'api/users.cue': `package api

// User model
#User: {
	id: #ID
	email: #Email
	name: string & len(>0) & len(<=255)
	createdAt: #Timestamp
	updatedAt: #Timestamp
	active: bool | *true
}

// User operations
#CreateUserRequest: {
	email: #Email
	name: string & len(>0) & len(<=255)
}

#UpdateUserRequest: {
	name?: string & len(>0) & len(<=255)
	active?: bool
}

#UserResponse: #Response & {
	data: #User
}

#UsersResponse: #PaginatedResponse & {
	data: {
		items: [...#User]
		pagination: #Pagination
	}
}
`,
      'openapi.cue': `package api

import "encoding/json"

// OpenAPI specification
openapi: {
	openapi: "3.0.3"
	info: {
		title: "My API"
		version: "1.0.0"
		description: "API defined with CUE"
	}
	paths: {
		"/users": {
			get: {
				summary: "List users"
				responses: {
					"200": {
						description: "Success"
						content: {
							"application/json": {
								schema: json.Schema(#UsersResponse)
							}
						}
					}
				}
			}
			post: {
				summary: "Create user"
				requestBody: {
					content: {
						"application/json": {
							schema: json.Schema(#CreateUserRequest)
						}
					}
				}
				responses: {
					"201": {
						description: "Created"
						content: {
							"application/json": {
								schema: json.Schema(#UserResponse)
							}
						}
					}
				}
			}
		}
	}
}
`,
      'README.md': `# API Schema Project

This project defines API schemas using CUE with type safety and OpenAPI generation.

## Usage

1. Validate schemas:
   \`\`\`bash
   arbiter check
   \`\`\`

2. Export OpenAPI spec:
   \`\`\`bash
   arbiter export --format openapi > openapi.yaml
   \`\`\`

3. Generate TypeScript types:
   \`\`\`bash
   arbiter export --format types > types.ts
   \`\`\`

## Structure

- \`api/types.cue\` - Common types and base structures
- \`api/users.cue\` - User-related schemas
- \`openapi.cue\` - OpenAPI specification definition

## Features

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
  projectName: string | undefined,
  options: InitOptions
): Promise<number> {
  try {
    // Get project details
    const projectDetails = await getProjectDetails(projectName, options);
    const { name, directory, template } = projectDetails;

    // Check if directory exists and handle accordingly
    const targetDir = path.resolve(directory);
    const exists = await fs.pathExists(targetDir);
    
    if (exists && !options.force) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: `Directory "${directory}" already exists. Continue?`,
        default: false,
      }]);
      
      if (!overwrite) {
        console.log(chalk.yellow('Aborted'));
        return 0;
      }
    }

    // Create project
    return await withProgress(
      { text: `Creating project "${name}"...`, color: 'green' },
      async () => {
        await createProject(targetDir, name, template);
        
        console.log(chalk.green(`\n✓ Created project "${name}" in ${directory}`));
        console.log(chalk.dim('\nNext steps:'));
        console.log(chalk.dim(`  cd ${directory}`));
        console.log(chalk.dim('  arbiter check'));
        
        return 0;
      }
    );

  } catch (error) {
    console.error(chalk.red('Init command failed:'), error instanceof Error ? error.message : String(error));
    return 2;
  }
}

/**
 * Get project details from user input
 */
async function getProjectDetails(
  projectName: string | undefined,
  options: InitOptions
): Promise<{ name: string; directory: string; template: ProjectTemplate }> {
  const questions: any[] = [];

  // Project name
  if (!projectName) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'my-cue-project',
      validate: (input: string) => {
        if (!input.trim()) return 'Project name is required';
        if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
          return 'Project name must contain only letters, numbers, hyphens, and underscores';
        }
        return true;
      },
    });
  }

  // Template selection
  if (!options.template) {
    questions.push({
      type: 'list',
      name: 'template',
      message: 'Choose a template:',
      choices: Object.entries(TEMPLATES).map(([key, template]) => ({
        name: `${template.name} - ${template.description}`,
        value: key,
      })),
      default: 'basic',
    });
  }

  // Directory
  if (!options.directory) {
    questions.push({
      type: 'input',
      name: 'directory',
      message: 'Project directory:',
      default: (answers: any) => projectName || answers.name || 'my-cue-project',
    });
  }

  const answers = await inquirer.prompt(questions);

  const name = projectName || answers.name;
  const templateKey = options.template || answers.template;
  const directory = options.directory || answers.directory || name;

  const template = TEMPLATES[templateKey];
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

  // Create .arbiter.json config file
  const configContent = {
    apiUrl: 'http://localhost:8080',
    format: 'table',
    color: true,
  };
  
  await fs.writeFile(
    path.join(targetDir, '.arbiter.json'),
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