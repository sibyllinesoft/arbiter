/**
 * @packageDocumentation
 * Example project templates - Static content generators for various project types.
 *
 * Provides template content for:
 * - TypeScript libraries
 * - Rust libraries
 * - Go services
 * - Monorepo structures
 * - CLI tools
 * - Python services
 */

import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";

// Re-export CLI templates
export {
  getCliPackageJson,
  getCliSrc,
  getCliHelloCommand,
  getCliBin,
  getCliTests,
  getCliAssemblyCue,
  getCliReadme,
} from "./cli-templates.js";

// Re-export Python templates
export {
  getPythonServicePyproject,
  getPythonServiceMain,
  getPythonServiceRoutes,
  getPythonServiceTests,
  getServiceAssemblyCue,
  getPythonServiceReadme,
} from "./python-templates.js";

/**
 * Generate package.json content for a TypeScript library project.
 * @returns Package.json content string
 */
export function getTypescriptLibraryPackageJson(): string {
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
    "arbiter:status": "arbiter status"
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

/**
 * Generate tsconfig.json content for TypeScript projects.
 * @returns TypeScript configuration content string
 */
export function getTypescriptConfig(): string {
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

/**
 * Generate source code for a TypeScript library's main entry point.
 * @returns TypeScript source code string with example processor implementation
 */
export function getTypescriptLibrarySrc(): string {
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

/**
 * Generate type definitions for a TypeScript library.
 * @returns TypeScript type definitions string
 */
export function getTypescriptLibraryTypes(): string {
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

/**
 * Generate test file content for a TypeScript library.
 * @returns Test file content string with example test cases
 */
export function getTypescriptLibraryTests(): string {
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

/**
 * Generate CUE assembly configuration for a TypeScript library.
 * @returns CUE configuration string for Arbiter integration
 */
export function getLibraryAssemblyCue(): string {
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

/**
 * Generate README content for a TypeScript library.
 * @param pm - Package manager command set for generating appropriate commands
 * @returns README markdown content string
 */
export function getTypescriptLibraryReadme(pm: PackageManagerCommandSet): string {
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
arbiter status

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

/**
 * Generate Cargo.toml content for a Rust library.
 * @returns Cargo.toml content string
 */
export function getRustLibraryCargoToml(): string {
  return `[package]\nname = "example-lib"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`;
}

/**
 * Generate source code for a Rust library's main entry point.
 * @returns Rust source code string
 */
export function getRustLibrarySrc(): string {
  return `//! Example Rust library\n\npub fn hello() -> String {\n    "Hello, World!".to_string()\n}\n`;
}

/**
 * Generate test file content for a Rust library.
 * @returns Rust test content string
 */
export function getRustLibraryTests(): string {
  return `use example_lib::hello;\n\n#[test]\nfn test_hello() {\n    assert_eq!(hello(), "Hello, World!");\n}\n`;
}

/**
 * Generate CUE assembly configuration for a Rust library.
 * @returns CUE configuration string
 */
export function getRustLibraryAssemblyCue(): string {
  return `// Rust Library Assembly\nArtifact: { kind: "library", language: "rust" }\n`;
}

/**
 * Generate README content for a Rust library.
 * @returns README markdown content string
 */
export function getRustLibraryReadme(): string {
  return "# Example Rust Library\n\nRust library with zero-cost abstractions.\n";
}

/**
 * Generate go.mod file content for a Go service.
 * @returns go.mod content string
 */
export function getGoServiceGoMod(): string {
  return "module example-service\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.0\n";
}

/**
 * Generate main.go file content for a Go service.
 * @returns Go source code string for main entry point
 */
export function getGoServiceMain(): string {
  return `package main\n\nimport "github.com/gin-gonic/gin"\n\nfunc main() {\n\tr := gin.Default()\n\tr.GET("/health", func(c *gin.Context) {\n\t\tc.JSON(200, gin.H{"status": "healthy"})\n\t})\n\tr.Run(":8080")\n}\n`;
}

/**
 * Generate handlers package content for a Go service.
 * @returns Go handlers source code string
 */
export function getGoServiceHandlers(): string {
  return `package handlers\n\nimport "github.com/gin-gonic/gin"\n\nfunc Health(c *gin.Context) {\n\tc.JSON(200, gin.H{"status": "healthy"})\n}\n`;
}

/**
 * Generate config package content for a Go service.
 * @returns Go config source code string
 */
export function getGoServiceConfig(): string {
  return "package config\n\ntype Config struct {\n\tPort string\n}\n";
}

/**
 * Generate CUE assembly configuration for a Go service.
 * @returns CUE configuration string
 */
export function getGoServiceAssemblyCue(): string {
  return `// Go Service Assembly\nArtifact: { kind: "service", language: "go" }\n`;
}

/**
 * Generate README content for a Go service.
 * @returns README markdown content string
 */
export function getGoServiceReadme(): string {
  return "# Example Go Service\n\nGo microservice with concurrency patterns.\n";
}

/**
 * Generate root package.json for a monorepo project.
 * @returns Package.json content string with workspace configuration
 */
export function getMonorepoPackageJson(): string {
  return `{
  "name": "example-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "arbiter:status": "arbiter status"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}`;
}

/**
 * Generate package.json for the core package in a monorepo.
 * @returns Package.json content string
 */
export function getMonorepoCorePackageJson(): string {
  return `{"name": "@example/core", "version": "0.1.0"}`;
}

/**
 * Generate package.json for the CLI package in a monorepo.
 * @returns Package.json content string
 */
export function getMonorepoCliPackageJson(): string {
  return `{"name": "@example/cli", "version": "0.1.0"}`;
}

/**
 * Generate package.json for the web package in a monorepo.
 * @returns Package.json content string
 */
export function getMonorepoWebPackageJson(): string {
  return `{"name": "@example/web", "version": "0.1.0"}`;
}

/**
 * Generate CUE assembly configuration for a monorepo.
 * @returns CUE configuration string
 */
export function getMonorepoAssemblyCue(): string {
  return `// Monorepo Assembly\nArtifact: { kind: "monorepo", language: "typescript" }\n`;
}

/**
 * Generate README content for a monorepo.
 * @returns README markdown content string
 */
export function getMonorepoReadme(): string {
  return "# Example Monorepo\n\nMulti-package TypeScript monorepo.\n";
}

/**
 * Minimize content by removing comments and extra whitespace.
 * @param content - Content string to minimize
 * @returns Minimized content string
 */
export function minimizeContent(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/**
 * Expand content with additional template-specific content.
 * @param content - Content string to expand
 * @param templateName - Name of the template for customization
 * @returns Expanded content string
 */
export function expandContent(content: string, templateName: string): string {
  if (templateName.includes("typescript")) {
    return `${content}\n\n// Additional examples and comprehensive documentation would go here`;
  }
  return content;
}
