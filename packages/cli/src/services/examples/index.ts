#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import type { Config } from "../../config.js";
import { safeFileOperation } from "../../constraints/index.js";
import {
  type PackageManagerCommandSet,
  detectPackageManager,
  getPackageManagerCommands,
} from "../../utils/package-manager.js";

/**
 * Options for examples command
 */
export interface ExamplesOptions {
  type?: "profile" | "language";
  profile?: string;
  language?: string;
  output?: string;
  minimal?: boolean;
  complete?: boolean;
}

/**
 * Example project templates
 */
interface ExampleTemplate {
  name: string;
  description: string;
  type: "profile" | "language";
  tags: string[];
  files: Record<string, ExampleTemplateFile>;
  structure: string[];
}

type ExampleTemplateFile = string | ((context: ExampleTemplateContext) => string);

interface ExampleTemplateContext {
  packageManager: PackageManagerCommandSet;
}

/**
 * Generate example projects by profile or language type
 */
export async function examplesCommand(
  type: string,
  options: ExamplesOptions,
  _config: Config,
): Promise<number> {
  try {
    console.log(chalk.blue("🏗️  Generating example projects..."));

    const outputDir = options.output || "./examples";
    const exampleType = type as "profile" | "language";

    if (!["profile", "language"].includes(exampleType)) {
      console.error(chalk.red(`Invalid type: ${type}`));
      console.log(chalk.dim("Valid types: profile, language"));
      return 1;
    }

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    console.log(chalk.green(`✅ Created output directory: ${outputDir}`));

    const packageManager = detectPackageManager();
    const pmCommands = getPackageManagerCommands(packageManager);
    console.log(chalk.dim(`Using ${packageManager} commands for install/run instructions`));

    // Get available templates
    const templates = getExampleTemplates();
    const filteredTemplates = templates.filter((t) => t.type === exampleType);

    if (filteredTemplates.length === 0) {
      console.log(chalk.yellow(`No examples available for type: ${exampleType}`));
      return 1;
    }

    // Generate examples based on options
    let templatesToGenerate = filteredTemplates;

    if (options.profile) {
      templatesToGenerate = filteredTemplates.filter(
        (t) => t.name === options.profile || t.tags.includes(options.profile),
      );
    }

    if (options.language) {
      templatesToGenerate = filteredTemplates.filter((t) => t.tags.includes(options.language));
    }

    if (templatesToGenerate.length === 0) {
      console.log(chalk.yellow("No matching examples found"));
      console.log(chalk.dim("Available examples:"));
      for (const template of filteredTemplates) {
        console.log(chalk.dim(`  ${template.name} (${template.tags.join(", ")})`));
      }
      return 1;
    }

    // Generate each example
    for (const template of templatesToGenerate) {
      await generateExampleProject(template, outputDir, options, pmCommands);
    }

    // Show next steps
    console.log(chalk.blue("\n🎯 Next steps:"));
    console.log(chalk.dim(`  📁 Browse examples: cd ${outputDir}`));
    console.log(chalk.dim("  🏃 Try an example: cd <example-dir> && arbiter init"));
    console.log(chalk.dim("  📚 Learn more: arbiter docs schema --examples"));

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Example generation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

/**
 * Get all available example templates
 */
function getExampleTemplates(): ExampleTemplate[] {
  return [
    // Profile-based examples
    {
      name: "typescript-library",
      description: "TypeScript library with comprehensive tooling",
      type: "profile",
      tags: ["typescript", "library", "npm", "testing"],
      structure: [
        "src/",
        "src/index.ts",
        "src/types.ts",
        "test/",
        "test/index.test.ts",
        "package.json",
        "tsconfig.json",
        "arbiter.assembly.cue",
      ],
      files: {
        "package.json": getTypescriptLibraryPackageJson(),
        "tsconfig.json": getTypescriptConfig(),
        "src/index.ts": getTypescriptLibrarySrc(),
        "src/types.ts": getTypescriptLibraryTypes(),
        "test/index.test.ts": getTypescriptLibraryTests(),
        "arbiter.assembly.cue": getLibraryAssemblyCue(),
        "README.md": (ctx) => getTypescriptLibraryReadme(ctx.packageManager),
      },
    },

    {
      name: "typescript-cli",
      description: "TypeScript CLI tool with argument parsing",
      type: "profile",
      tags: ["typescript", "cli", "commander", "testing"],
      structure: [
        "src/",
        "src/cli.ts",
        "src/commands/",
        "bin/",
        "test/",
        "package.json",
        "arbiter.assembly.cue",
      ],
      files: {
        "package.json": getCliPackageJson(),
        "src/cli.ts": getCliSrc(),
        "src/commands/hello.ts": getCliHelloCommand(),
        "bin/cli.js": getCliBin(),
        "test/cli.test.ts": getCliTests(),
        "arbiter.assembly.cue": getCliAssemblyCue(),
        "README.md": (ctx) => getCliReadme(ctx.packageManager),
      },
    },

    {
      name: "python-service",
      description: "Python FastAPI service with async patterns",
      type: "profile",
      tags: ["python", "service", "fastapi", "async"],
      structure: [
        "src/",
        "src/main.py",
        "src/api/",
        "tests/",
        "pyproject.toml",
        "arbiter.assembly.cue",
      ],
      files: {
        "pyproject.toml": getPythonServicePyproject(),
        "src/main.py": getPythonServiceMain(),
        "src/api/routes.py": getPythonServiceRoutes(),
        "tests/test_main.py": getPythonServiceTests(),
        "arbiter.assembly.cue": getServiceAssemblyCue(),
        "README.md": getPythonServiceReadme(),
      },
    },

    {
      name: "rust-library",
      description: "Rust library with zero-cost abstractions",
      type: "profile",
      tags: ["rust", "library", "performance", "safety"],
      structure: ["src/", "src/lib.rs", "tests/", "Cargo.toml", "arbiter.assembly.cue"],
      files: {
        "Cargo.toml": getRustLibraryCargoToml(),
        "src/lib.rs": getRustLibrarySrc(),
        "tests/integration_test.rs": getRustLibraryTests(),
        "arbiter.assembly.cue": getRustLibraryAssemblyCue(),
        "README.md": getRustLibraryReadme(),
      },
    },

    {
      name: "go-microservice",
      description: "Go microservice with concurrency patterns",
      type: "profile",
      tags: ["go", "service", "microservice", "concurrency"],
      structure: ["cmd/", "cmd/server/", "internal/", "pkg/", "go.mod", "arbiter.assembly.cue"],
      files: {
        "go.mod": getGoServiceGoMod(),
        "cmd/server/main.go": getGoServiceMain(),
        "internal/handlers/health.go": getGoServiceHandlers(),
        "pkg/config/config.go": getGoServiceConfig(),
        "arbiter.assembly.cue": getGoServiceAssemblyCue(),
        "README.md": getGoServiceReadme(),
      },
    },

    // Language-based examples
    {
      name: "typescript-monorepo",
      description: "Multi-package TypeScript monorepo setup",
      type: "language",
      tags: ["typescript", "monorepo", "workspaces", "lerna"],
      structure: [
        "packages/",
        "packages/core/",
        "packages/cli/",
        "packages/web/",
        "package.json",
        "arbiter.assembly.cue",
      ],
      files: {
        "package.json": getMonorepoPackageJson(),
        "packages/core/package.json": getMonorepoCorePackageJson(),
        "packages/cli/package.json": getMonorepoCliPackageJson(),
        "packages/web/package.json": getMonorepoWebPackageJson(),
        "arbiter.assembly.cue": getMonorepoAssemblyCue(),
        "README.md": getMonorepoReadme(),
      },
    },
  ];
}

/**
 * Generate a single example project
 */
async function generateExampleProject(
  template: ExampleTemplate,
  outputDir: string,
  options: ExamplesOptions,
  packageManager: PackageManagerCommandSet,
): Promise<void> {
  const projectDir = path.join(outputDir, template.name);

  console.log(chalk.blue(`📦 Generating ${template.name}...`));
  console.log(chalk.dim(`   ${template.description}`));

  // Create project directory structure
  await fs.mkdir(projectDir, { recursive: true });

  // Create directory structure
  for (const dir of template.structure.filter((item) => item.endsWith("/"))) {
    const dirPath = path.join(projectDir, dir);
    await fs.mkdir(dirPath, { recursive: true });
  }

  // Generate files
  const fileContext: ExampleTemplateContext = { packageManager };
  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = path.join(projectDir, filePath);

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Customize content based on options
    let finalContent = typeof content === "function" ? content(fileContext) : (content as string);
    if (options.minimal) {
      finalContent = minimizeContent(finalContent);
    } else if (options.complete) {
      finalContent = expandContent(finalContent, template);
    }

    await safeFileOperation("write", fullPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, finalContent, "utf-8");
    });
  }

  console.log(chalk.green(`   ✅ Generated at: ${projectDir}`));
}

/**
 * Template content generators
 */
function getTypescriptLibraryPackageJson(): string {
  return `{
  "name": "@my-org/example-library",
  "version": "0.1.0",
  "description": "Example TypeScript library with Arbiter integration",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src test --ext .ts",
    "arbiter:surface": "arbiter surface typescript --output surface.json",
    "arbiter:check": "arbiter check",
    "arbiter:watch": "arbiter watch --agent-mode"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  },
  "keywords": [
    "typescript",
    "library",
    "arbiter"
  ],
  "license": "MIT"
}`;
}

function getTypescriptConfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}`;
}

function getTypescriptLibrarySrc(): string {
  return `/**
 * Example TypeScript Library with Arbiter Integration
 * 
 * This library demonstrates best practices for TypeScript
 * development with Arbiter tooling integration.
 */

export interface LibraryConfig {
  readonly name: string;
  readonly version: string;
  readonly features?: readonly string[];
}

export interface ProcessingOptions {
  readonly timeout?: number;
  readonly retries?: number;
  readonly verbose?: boolean;
}

export class ExampleProcessor {
  private readonly config: LibraryConfig;

  constructor(config: LibraryConfig) {
    this.config = config;
  }

  /**
   * Process input data with the configured options
   * 
   * @param input - Input data to process
   * @param options - Processing options
   * @returns Promise resolving to processed result
   */
  async process(
    input: string,
    options: ProcessingOptions = {}
  ): Promise<string> {
    const { timeout = 5000, retries = 3, verbose = false } = options;

    if (verbose) {
      console.log(\`Processing with \${this.config.name} v\${this.config.version}\`);
    }

    // Simulate processing
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(\`Processed: \${input}\`);
      }, 100);
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): LibraryConfig {
    return { ...this.config };
  }
}

/**
 * Create a new processor instance
 */
export function createProcessor(config: LibraryConfig): ExampleProcessor {
  return new ExampleProcessor(config);
}

// Default export for convenience
export default ExampleProcessor;`;
}

function getTypescriptLibraryTypes(): string {
  return `/**
 * Core type definitions for the example library
 */

/**
 * Result wrapper type for safe error handling
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Configuration validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Event types for processing lifecycle
 */
export type ProcessingEvent = 
  | { type: 'started'; timestamp: number }
  | { type: 'progress'; progress: number; message: string }
  | { type: 'completed'; duration: number; result: string }
  | { type: 'error'; error: Error };

/**
 * Branded type for validated input
 */
export type ValidatedInput = string & { readonly __brand: 'ValidatedInput' };

/**
 * Type guard for validated input
 */
export function isValidatedInput(input: string): input is ValidatedInput {
  return input.length > 0 && input.length <= 1000;
}

/**
 * Utility types
 */
export type NonEmpty<T extends readonly unknown[]> = T extends readonly [unknown, ...unknown[]] ? T : never;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;`;
}

function getTypescriptLibraryTests(): string {
  return `import { describe, it, expect } from 'bun:test';
import { ExampleProcessor, createProcessor } from '../src/index.js';
import type { LibraryConfig, ProcessingOptions } from '../src/types.js';

describe('ExampleProcessor', () => {
  const defaultConfig: LibraryConfig = {
    name: 'test-processor',
    version: '1.0.0',
    features: ['processing', 'validation']
  };

  describe('constructor', () => {
    it('should create processor with valid config', () => {
      const processor = new ExampleProcessor(defaultConfig);
      expect(processor.getConfig()).toEqual(defaultConfig);
    });
  });

  describe('process', () => {
    it('should process input successfully', async () => {
      const processor = createProcessor(defaultConfig);
      const result = await processor.process('test input');
      
      expect(result).toBe('Processed: test input');
    });

    it('should handle processing options', async () => {
      const processor = createProcessor(defaultConfig);
      const options: ProcessingOptions = {
        timeout: 1000,
        retries: 1,
        verbose: true
      };

      const result = await processor.process('test input', options);
      expect(result).toBe('Processed: test input');
    });

    it('should work with empty options', async () => {
      const processor = createProcessor(defaultConfig);
      const result = await processor.process('test input', {});
      
      expect(result).toBe('Processed: test input');
    });
  });

  describe('getConfig', () => {
    it('should return immutable config copy', () => {
      const processor = createProcessor(defaultConfig);
      const config1 = processor.getConfig();
      const config2 = processor.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });
  });
});

describe('createProcessor', () => {
  it('should create processor instance', () => {
    const config: LibraryConfig = {
      name: 'factory-test',
      version: '0.1.0'
    };

    const processor = createProcessor(config);
    expect(processor).toBeInstanceOf(ExampleProcessor);
    expect(processor.getConfig()).toEqual(config);
  });
});`;
}

function getLibraryAssemblyCue(): string {
  return `// TypeScript Library - Arbiter Assembly Configuration
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "library"
  language: "typescript"
  metadata: {
    name: "@my-org/example-library"
    version: "0.1.0"
    description: "Example TypeScript library with Arbiter integration"
  }

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
    artifact: "npm"
  }
}

Profile: profiles.#library & {
  semver: "strict"
  
  apiSurface: {
    source: "generated"
    file: "./surface.json"
  }
  
  contracts: {
    forbidBreaking: true
    invariants: [
      {
        name: "config_immutability"
        description: "Configuration objects should be immutable"
        formula: "∀config. getConfig() !== getConfig() // Different objects"
      },
      {
        name: "processing_determinism"
        description: "Same input should produce same output"
        formula: "∀input. process(input) = process(input)"
      }
    ]
  }

  tests: {
    property: [
      {
        name: "process_idempotent"
        description: "Processing should be deterministic"
      }
    ]
    
    coverage: {
      threshold: 0.90
      branches: true
      functions: true
    }
  }
}`;
}

function getTypescriptLibraryReadme(pm: PackageManagerCommandSet): string {
  const run = (script: string) => pm.run(script);
  return `# Example TypeScript Library

A comprehensive TypeScript library example with Arbiter integration, demonstrating best practices for modern TypeScript development.

## Features

- 🏗️ **Modern TypeScript**: Latest language features and strict configuration
- 🧪 **Comprehensive Testing**: Vitest with property-based testing
- 📦 **Smart Packaging**: Optimized for ${pm.name} distribution
- 🔍 **API Surface Tracking**: Automated semver compliance
- 🤖 **Arbiter Integration**: Spec-first development workflow

## Installation

\`\`\`bash
${pm.install} @my-org/example-library
\`\`\`

## Usage

\`\`\`typescript
import { createProcessor } from '@my-org/example-library';

const processor = createProcessor({
  name: 'my-processor',
  version: '1.0.0',
  features: ['processing', 'validation']
});

const result = await processor.process('input data', {
  timeout: 5000,
  verbose: true
});

console.log(result); // "Processed: input data"
\`\`\`

## Development

### Setup

\`\`\`bash
${pm.install}
\`\`\`

### Arbiter Workflow

\`\`\`bash
# Initialize Arbiter tracking
arbiter check

# Watch for changes during development
arbiter watch --agent-mode

# Extract API surface
arbiter surface typescript --output surface.json

# Generate tests from contracts
arbiter tests scaffold --language typescript

# Check contract coverage
arbiter tests cover --threshold 0.9
\`\`\`

### Traditional Commands

\`\`\`bash
# Build
${run("build")}

# Test
${run("test")}
${run("test:coverage")}

# Lint
${run("lint")}
\`\`\`

## API Documentation

See [API.md](./API.md) for detailed API documentation (auto-generated).

## License

MIT`;
}

// Additional template generators for other project types...
function getCliPackageJson(): string {
  return `{
  "name": "example-cli",
  "version": "0.1.0",
  "description": "Example TypeScript CLI with Arbiter integration",
  "bin": {
    "example-cli": "./bin/cli.js"
  },
  "main": "./dist/cli.js",
  "files": [
    "dist",
    "bin"
  ],
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "dev": "tsx src/cli.ts",
    "arbiter:check": "arbiter check",
    "arbiter:surface": "arbiter surface typescript"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "chalk": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0"
  },
  "keywords": ["cli", "typescript", "arbiter"],
  "license": "MIT"
}`;
}

function getCliSrc(): string {
  return `#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { helloCommand } from './commands/hello.js';

const program = new Command();

program
  .name('example-cli')
  .description('Example CLI tool with Arbiter integration')
  .version('0.1.0');

// Hello command
program
  .command('hello [name]')
  .description('greet someone')
  .option('-u, --uppercase', 'uppercase the output')
  .option('-c, --count <number>', 'number of greetings', '1')
  .action(async (name: string | undefined, options: { uppercase?: boolean; count?: string }) => {
    try {
      const exitCode = await helloCommand(name, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

// Parse command line arguments
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  program.parse();
}

export default program;`;
}

function getCliHelloCommand(): string {
  return `import chalk from 'chalk';

export interface HelloOptions {
  uppercase?: boolean;
  count?: string;
}

export async function helloCommand(name: string | undefined, options: HelloOptions): Promise<number> {
  const greeting = \`Hello, \${name || 'World'}!\`;
  const count = parseInt(options.count || '1', 10);

  if (isNaN(count) || count <= 0) {
    console.error(chalk.red('Count must be a positive number'));
    return 1;
  }

  for (let i = 0; i < count; i++) {
    const message = options.uppercase ? greeting.toUpperCase() : greeting;
    console.log(chalk.green(message));
  }

  return 0;
}`;
}

function getCliBin(): string {
  return `#!/usr/bin/env node

// Simple wrapper to run the compiled CLI
require('../dist/cli.js');`;
}

function getCliTests(): string {
  return `import { describe, it, expect } from 'bun:test';
import { helloCommand } from '../src/commands/hello.js';

describe('helloCommand', () => {
  it('should return success code', async () => {
    const exitCode = await helloCommand('Test', {});
    expect(exitCode).toBe(0);
  });

  it('should handle invalid count', async () => {
    const exitCode = await helloCommand('Test', { count: 'invalid' });
    expect(exitCode).toBe(1);
  });

  it('should handle zero count', async () => {
    const exitCode = await helloCommand('Test', { count: '0' });
    expect(exitCode).toBe(1);
  });
});`;
}

function getCliAssemblyCue(): string {
  return `// TypeScript CLI - Arbiter Assembly Configuration
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "cli"
  language: "typescript"
  metadata: {
    name: "example-cli"
    version: "0.1.0"
    description: "Example TypeScript CLI with Arbiter integration"
  }

  build: {
    tool: "bun"
    targets: ["./src/cli.ts"]
  }
}

Profile: profiles.#cli & {
  commands: [
    {
      name: "hello"
      summary: "Greet someone"
      args: [
        {name: "name", type: "string", optional: true, description: "Name to greet"}
      ]
      flags: [
        {name: "uppercase", type: "bool", default: false, description: "Uppercase output"}
        {name: "count", type: "int", default: 1, description: "Number of greetings"}
      ]
      exits: [
        {code: 0, meaning: "success"}
        {code: 1, meaning: "invalid_input"}
        {code: 2, meaning: "command_error"}
      ]
      io: {
        in: "none"
        out: "stdout"
      }
    }
  ]

  tests: {
    golden: [
      {
        name: "help_output"
        command: ["--help"]
        expect_exit: 0
      },
      {
        name: "hello_basic"
        command: ["hello"]
        expect_exit: 0
      },
      {
        name: "hello_with_name"
        command: ["hello", "Alice"]
        expect_exit: 0
      }
    ]
    
    property: [
      {
        name: "valid_exit_codes"
        description: "Commands should only return documented exit codes"
      }
    ]
  }
}`;
}

function getCliReadme(pm: PackageManagerCommandSet): string {
  return `# Example CLI

A TypeScript CLI tool example with Arbiter integration, demonstrating command-line interface best practices.

## Installation

\`\`\`bash
${pm.installGlobal("example-cli")}
\`\`\`

## Usage

\`\`\`bash
# Basic greeting
example-cli hello

# Greet someone specific
example-cli hello Alice

# Uppercase output
example-cli hello Bob --uppercase

# Multiple greetings
example-cli hello Charlie --count 3
\`\`\`

## Development

\`\`\`bash
${pm.install}
${pm.run("dev")} hello Alice
\`\`\`

## Arbiter Integration

\`\`\`bash
# Validate CLI contracts
arbiter check

# Generate tests from command specifications
arbiter tests scaffold --language typescript

# Test golden outputs
arbiter tests run --types golden
\`\`\``;
}

// Stub implementations for other templates (Python, Rust, Go, etc.)
// These would be fully implemented in a complete system

function getPythonServicePyproject(): string {
  return `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "example-service"
version = "0.1.0"
description = "Example Python FastAPI service with Arbiter integration"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.23.0",
    "pydantic>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "httpx>=0.24.0",
    "pytest-asyncio>=0.21.0",
]

[tool.arbiter]
profile = "service"
language = "python"`;
}

function getPythonServiceMain(): string {
  return `#!/usr/bin/env python3

from fastapi import FastAPI
from .api.routes import router

app = FastAPI(
    title="Example Service",
    description="Example Python service with Arbiter integration",
    version="0.1.0"
)

app.include_router(router)

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)`;
}

function getPythonServiceRoutes(): string {
  return `from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class MessageRequest(BaseModel):
    message: str

class MessageResponse(BaseModel):
    result: str

@router.post("/process", response_model=MessageResponse)
async def process_message(request: MessageRequest) -> MessageResponse:
    return MessageResponse(result=f"Processed: {request.message}")`;
}

function getPythonServiceTests(): string {
  return `import pytest
from httpx import AsyncClient
from src.main import app

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

@pytest.mark.asyncio
async def test_process_message():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/process", json={"message": "test"})
    assert response.status_code == 200
    assert response.json() == {"result": "Processed: test"}`;
}

function getServiceAssemblyCue(): string {
  return `// Python Service - Arbiter Assembly Configuration
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "service"
  language: "python"
  metadata: {
    name: "example-service"
    version: "0.1.0"
    description: "Example Python FastAPI service"
  }

  build: {
    tool: "uv"
    targets: ["./src"]
  }
}

Profile: profiles.#service & {
  endpoints: [
    {
      path: "/health"
      method: "GET"
      description: "Health check endpoint"
    },
    {
      path: "/process"
      method: "POST"
      description: "Message processing endpoint"
    }
  ]
  
  healthCheck: "/health"
  
  tests: {
    integration: [
      {
        name: "health_check"
        request: {method: "GET", path: "/health"}
        expect: {status: 200, body: {"status": "healthy"}}
      }
    ]
  }
}`;
}

function getPythonServiceReadme(): string {
  return `# Example Python Service

FastAPI service example with Arbiter integration and async patterns.

## Quick Start

\`\`\`bash
# Install dependencies
uv pip install -e .

# Run development server
python src/main.py

# Test the service
curl http://localhost:8000/health
\`\`\`

## Arbiter Integration

\`\`\`bash
arbiter surface python --output surface.json
arbiter tests scaffold --language python
arbiter check
\`\`\``;
}

// Additional stub implementations for completeness
function getRustLibraryCargoToml(): string {
  return `[package]\nname = "example-lib"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`;
}
function getRustLibrarySrc(): string {
  return `//! Example Rust library\n\npub fn hello() -> String {\n    "Hello, World!".to_string()\n}\n`;
}
function getRustLibraryTests(): string {
  return `use example_lib::hello;\n\n#[test]\nfn test_hello() {\n    assert_eq!(hello(), "Hello, World!");\n}\n`;
}
function getRustLibraryAssemblyCue(): string {
  return `// Rust Library Assembly\nArtifact: { kind: "library", language: "rust" }\n`;
}
function getRustLibraryReadme(): string {
  return "# Example Rust Library\n\nRust library with zero-cost abstractions.\n";
}

function getGoServiceGoMod(): string {
  return "module example-service\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.0\n";
}
function getGoServiceMain(): string {
  return `package main\n\nimport "github.com/gin-gonic/gin"\n\nfunc main() {\n\tr := gin.Default()\n\tr.GET("/health", func(c *gin.Context) {\n\t\tc.JSON(200, gin.H{"status": "healthy"})\n\t})\n\tr.Run(":8080")\n}\n`;
}
function getGoServiceHandlers(): string {
  return `package handlers\n\nimport "github.com/gin-gonic/gin"\n\nfunc Health(c *gin.Context) {\n\tc.JSON(200, gin.H{"status": "healthy"})\n}\n`;
}
function getGoServiceConfig(): string {
  return "package config\n\ntype Config struct {\n\tPort string\n}\n";
}
function getGoServiceAssemblyCue(): string {
  return `// Go Service Assembly\nArtifact: { kind: "service", language: "go" }\n`;
}
function getGoServiceReadme(): string {
  return "# Example Go Service\n\nGo microservice with concurrency patterns.\n";
}

function getMonorepoPackageJson(): string {
  return `{
  "name": "example-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "arbiter:check": "arbiter check"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}`;
}

function getMonorepoCorePackageJson(): string {
  return `{"name": "@example/core", "version": "0.1.0"}`;
}
function getMonorepoCliPackageJson(): string {
  return `{"name": "@example/cli", "version": "0.1.0"}`;
}
function getMonorepoWebPackageJson(): string {
  return `{"name": "@example/web", "version": "0.1.0"}`;
}
function getMonorepoAssemblyCue(): string {
  return `// Monorepo Assembly\nArtifact: { kind: "monorepo", language: "typescript" }\n`;
}
function getMonorepoReadme(): string {
  return "# Example Monorepo\n\nMulti-package TypeScript monorepo.\n";
}

/**
 * Minimize content for minimal examples
 */
function minimizeContent(content: string): string {
  // Remove comments and extra whitespace for minimal examples
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
    .replace(/\/\/.*$/gm, "") // Remove line comments
    .replace(/\n\s*\n/g, "\n") // Remove empty lines
    .trim();
}

/**
 * Expand content for complete examples
 */
function expandContent(content: string, template: ExampleTemplate): string {
  // Add additional examples and documentation for complete examples
  if (template.name.includes("typescript")) {
    return `${content}\n\n// Additional examples and comprehensive documentation would go here`;
  }
  return content;
}
