# Code Generation API Reference

This document provides a comprehensive API reference for Arbiter's code generation system, including interfaces, classes, and functions for programmatic use.

## Table of Contents

- [Core Interfaces](#core-interfaces)
- [Generation Service API](#generation-service-api)
- [Template System API](#template-system-api)
- [Language Plugin API](#language-plugin-api)
- [Hook System API](#hook-system-api)
- [Configuration API](#configuration-api)
- [Utility Functions](#utility-functions)
- [Error Types](#error-types)

## Core Interfaces

### GenerateOptions

Main configuration interface for generation operations.

```typescript
interface GenerateOptions {
  /** Output directory for generated code. Defaults to project structure settings. */
  outputDir?: string;
  
  /** Overwrite existing files without prompting. */
  force?: boolean;
  
  /** Preview generation without writing files. */
  dryRun?: boolean;
  
  /** Enable detailed logging and debug output. */
  verbose?: boolean;
  
  /** Target specific specification by name. */
  spec?: string;
  
  /** Synchronize generated code to GitHub repository. */
  syncGithub?: boolean;
  
  /** Preview GitHub synchronization without pushing. */
  githubDryRun?: boolean;
}
```

**Usage Example:**
```typescript
const options: GenerateOptions = {
  outputDir: './generated',
  force: true,
  verbose: true,
  spec: 'my-service'
};

await generateCommand(options, cliConfig);
```

### Generation Contexts

#### ClientGenerationContext

Context for client application generation.

```typescript
interface ClientGenerationContext {
  /** URL-safe project slug identifier */
  slug: string;
  
  /** Root directory path for client code */
  root: string;
  
  /** Routes directory path */
  routesDir: string;
}
```

#### ServiceGenerationContext

Context for service generation.

```typescript
interface ServiceGenerationContext {
  /** Service name (slugified) */
  name: string;
  
  /** Service root directory */
  root: string;
  
  /** Routes directory path */
  routesDir: string;
  
  /** Programming language */
  language: string;
  
  /** Original service name before slugification */
  originalName?: string;
}
```

### Template System Interfaces

#### TemplateEngine

Interface for template engine implementations.

```typescript
interface TemplateEngine {
  /** Engine name identifier */
  name: string;
  
  /** Command to execute the engine */
  command: string;
  
  /** Default command-line arguments */
  defaultArgs: string[];
  
  /** Optional validation function */
  validate?(source: string): Promise<boolean>;
  
  /** Execute template processing */
  execute(
    source: string, 
    destination: string, 
    variables: Record<string, any>
  ): Promise<void>;
}
```

#### TemplateConfig

Configuration structure for template system.

```typescript
interface TemplateConfig {
  /** Template engine configurations */
  engines: Record<string, TemplateEngineConfig>;
  
  /** Template aliases for common patterns */
  aliases: Record<string, TemplateAlias>;
  
  /** Global template settings */
  settings?: {
    defaultEngine?: string;
    cacheDir?: string;
    timeout?: number;
  };
}

interface TemplateEngineConfig {
  command: string;
  defaultArgs: string[];
  timeout?: number;
}

interface TemplateAlias {
  engine: string;
  source: string;
  description: string;
  variables?: Record<string, any>;
  prerequisites?: string[];
}
```

### Language Plugin Interfaces

#### ComponentConfig

Configuration for component generation.

```typescript
interface ComponentConfig {
  /** Component name */
  name: string;
  
  /** Component type */
  type: "page" | "component" | "layout" | "hook" | "util";
  
  /** Component properties */
  props?: ComponentProp[];
  
  /** External dependencies */
  dependencies?: string[];
  
  /** Include styling files */
  styles?: boolean;
  
  /** Generate test files */
  tests?: boolean;
  
  /** Test identifier for E2E testing */
  testId?: string;
}

interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  default?: any;
  description?: string;
}
```

#### ServiceConfig

Configuration for service generation.

```typescript
interface ServiceConfig {
  /** Service name */
  name: string;
  
  /** Service type */
  type: "api" | "service" | "handler" | "middleware" | "model";
  
  /** API endpoints to generate */
  endpoints?: string[];
  
  /** Include database integration */
  database?: boolean;
  
  /** Include authentication */
  auth?: boolean;
  
  /** Include input validation */
  validation?: boolean;
  
  /** Custom methods to generate */
  methods?: Array<Record<string, any>>;
}
```

#### ProjectConfig

Configuration for project initialization.

```typescript
interface ProjectConfig {
  /** Project name */
  name: string;
  
  /** Project description */
  description?: string;
  
  /** Enabled features */
  features: string[];
  
  /** Database type */
  database?: "sqlite" | "postgres" | "mysql" | "mongodb";
  
  /** Authentication method */
  auth?: "jwt" | "session" | "oauth";
  
  /** Include testing setup */
  testing?: boolean;
  
  /** Include Docker configuration */
  docker?: boolean;
}
```

## Generation Service API

### Main Generation Function

```typescript
/**
 * Main code generation command entry point
 * 
 * @param options - Generation options
 * @param config - CLI configuration
 * @param specName - Optional specific specification name
 * @returns Exit code (0 for success, non-zero for error)
 */
export async function generateCommand(
  options: GenerateOptions,
  config: CLIConfig,
  specName?: string,
): Promise<number>
```

### Context Creation Functions

```typescript
/**
 * Create client generation context from app specification
 */
function createClientContext(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  outputDir: string,
): ClientGenerationContext

/**
 * Create service generation context
 */
function createServiceContext(
  serviceName: string,
  serviceConfig: any,
  structure: ProjectStructureConfig,
  outputDir: string,
): ServiceGenerationContext
```

### Specification Discovery

```typescript
/**
 * Discover available specifications in .arbiter/ directories
 * 
 * @returns Array of discovered specifications
 */
function discoverSpecs(): Array<{ name: string; path: string }>
```

### Project Structure Management

```typescript
/**
 * Ensure base directory structure exists
 */
async function ensureBaseStructure(
  structure: ProjectStructureConfig,
  outputDir: string,
  options: GenerateOptions,
): Promise<void>
```

## Template System API

### TemplateResolver Class

Main class for template resolution and processing.

```typescript
export class TemplateResolver {
  constructor(options: TemplateResolverOptions)
  
  /** Set template override directories */
  setOverrideDirectories(directories: string[]): void
  
  /** Set default template directories */
  setDefaultDirectories(directories: string[]): void
  
  /** Render template with context data */
  async renderTemplate(
    templatePath: string,
    context: Record<string, unknown>,
    fallback: string,
  ): Promise<string>
}

interface TemplateResolverOptions {
  language: string;
  overrideDirectories?: string[];
  defaultDirectories?: string[];
}
```

**Usage Example:**
```typescript
const resolver = new TemplateResolver({
  language: 'typescript',
  overrideDirectories: ['./custom-templates'],
  defaultDirectories: ['./default-templates']
});

const result = await resolver.renderTemplate(
  'service/main.ts.hbs',
  { serviceName: 'userService', port: 3000 },
  'export default {};'
);
```

### Template Manager

```typescript
/**
 * Extract variables from CUE specifications for template context
 */
export function extractVariablesFromCue(cueData: any): TemplateContext

interface TemplateContext {
  project: Record<string, unknown>;
  parent?: Record<string, unknown>;
  artifact: Record<string, unknown>;
  impl?: Record<string, unknown>;
}
```

## Language Plugin API

### Plugin Registry

```typescript
/**
 * Language plugin registry for managing code generators
 */
export const registry = {
  /** Configure a language plugin */
  configure(language: string, config: PluginConfiguration): void;
  
  /** Get a language plugin instance */
  get(language: string): LanguagePlugin;
  
  /** Check if language is supported */
  isSupported(language: string): boolean;
  
  /** List all supported languages */
  getSupportedLanguages(): string[];
};

interface PluginConfiguration {
  templateOverrides?: string[];
  pluginConfig?: Record<string, any>;
  workspaceRoot?: string;
  testing?: LanguageTestingConfig;
}
```

### Core Generation Functions

```typescript
/**
 * Initialize a new project with language-specific setup
 */
export async function initializeProject(
  config: ProjectConfig,
  outputDir: string
): Promise<void>

/**
 * Generate a service with specified configuration
 */
export async function generateService(
  config: ServiceConfig,
  context: ServiceGenerationContext
): Promise<void>

/**
 * Generate a component with specified configuration
 */
export async function generateComponent(
  config: ComponentConfig,
  context: ComponentGenerationContext
): Promise<void>
```

### Plugin Configuration

```typescript
/**
 * Configure language plugin runtime settings
 */
export function configureLanguagePluginRuntime(
  language: string, 
  cliConfig: CLIConfig
): void

/**
 * Get language plugin instance
 */
export function getLanguagePlugin(
  language: string
): LanguagePlugin
```

## Hook System API

### GenerationHookManager

Base class for implementing generation hooks.

```typescript
export abstract class GenerationHookManager {
  /** Called before each file write operation */
  async beforeFileWrite(filePath: string, content: string): Promise<string> {
    return content;
  }
  
  /** Called after each file write operation */
  async afterFileWrite(filePath: string, content: string): Promise<void> {
    // Override in subclass
  }
  
  /** Called before generation starts */
  async beforeGeneration(context: GenerationContext): Promise<void> {
    // Override in subclass
  }
  
  /** Called after generation completes */
  async afterGeneration(context: GenerationContext): Promise<void> {
    // Override in subclass
  }
}
```

### Hook Executor Functions

```typescript
/**
 * Set the active hook manager for the current generation
 */
export function setActiveHookManager(manager: GenerationHookManager | null): void

/**
 * Write file with hook processing
 */
export async function writeFileWithHooks(
  filePath: string,
  content: string,
  options: GenerateOptions,
  mode?: number,
): Promise<void>

/**
 * Ensure directory exists with hook processing
 */
export async function ensureDirectory(
  dir: string, 
  options: GenerateOptions
): Promise<void>
```

**Custom Hook Implementation Example:**
```typescript
class CustomHookManager extends GenerationHookManager {
  async beforeFileWrite(filePath: string, content: string): Promise<string> {
    // Add custom header to TypeScript files
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const header = `// Generated by Arbiter on ${new Date().toISOString()}\n`;
      return header + content;
    }
    return content;
  }
  
  async afterFileWrite(filePath: string, content: string): Promise<void> {
    // Format generated files
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      await this.formatTypeScriptFile(filePath);
    }
  }
}

// Use custom hooks
const hookManager = new CustomHookManager();
setActiveHookManager(hookManager);
```

## Configuration API

### CLI Configuration

```typescript
interface CLIConfig {
  /** Project root directory */
  projectDir: string;
  
  /** Configuration directory */
  configDir?: string;
  
  /** API server URL */
  apiUrl?: string;
  
  /** Generator-specific configuration */
  generator?: GeneratorConfig;
}

interface GeneratorConfig {
  /** Template override directories per language */
  templateOverrides?: Record<string, string | string[]>;
  
  /** Language plugin configurations */
  plugins?: Record<string, Record<string, any>>;
  
  /** Testing configurations per language */
  testing?: GeneratorTestingConfig;
  
  /** Generation profiles */
  profiles?: Record<string, GenerationProfile>;
}
```

### Project Structure Configuration

```typescript
interface ProjectStructureConfig {
  clientsDirectory: string;     // "clients"
  servicesDirectory: string;    // "services"
  modulesDirectory: string;     // "modules"
  toolsDirectory: string;       // "tools"
  docsDirectory: string;        // "docs"
  testsDirectory: string;       // "tests"
  infraDirectory: string;       // "infrastructure"
}
```

## Utility Functions

### String Utilities

```typescript
/**
 * Convert string to URL-safe slug
 */
export function slugify(value: string | undefined, fallback?: string): string

/**
 * Split path string into segments
 */
export function toPathSegments(value: string): string[]

/**
 * Join path segments with forward slashes
 */
export function joinRelativePath(...parts: string[]): string
```

### Path Utilities

```typescript
/** Regular expression for path separators */
export const PATH_SEPARATOR_REGEX: RegExp
```

### Command Execution

```typescript
/**
 * Execute command with timeout and error handling
 */
async function executeCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number }
): Promise<{ success: boolean; stdout: string; stderr: string }>
```

## Error Types

### Generation Errors

```typescript
/**
 * Base error class for generation failures
 */
class GenerationError extends Error {
  constructor(
    message: string,
    public context?: {
      spec?: any;
      template?: string;
      phase?: string;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

/**
 * Template processing error
 */
class TemplateError extends GenerationError {
  constructor(
    templatePath: string,
    error: Error,
    context?: Record<string, any>
  ) {
    super(`Template processing failed: ${templatePath}`, {
      template: templatePath,
      originalError: error,
      phase: 'template-processing'
    });
    this.name = 'TemplateError';
  }
}

/**
 * Specification validation error
 */
class SpecificationError extends GenerationError {
  constructor(
    specPath: string,
    validationErrors: string[]
  ) {
    super(`Specification validation failed: ${specPath}`, {
      spec: specPath,
      phase: 'validation'
    });
    this.name = 'SpecificationError';
  }
}
```

### Hook Errors

```typescript
/**
 * Hook execution error
 */
class HookError extends GenerationError {
  constructor(
    hookName: string,
    filePath: string,
    error: Error
  ) {
    super(`Hook execution failed: ${hookName}`, {
      template: filePath,
      originalError: error,
      phase: 'hook-execution'
    });
    this.name = 'HookError';
  }
}
```

## Usage Examples

### Complete Generation Workflow

```typescript
import { 
  generateCommand, 
  GenerateOptions, 
  CLIConfig,
  CustomHookManager,
  setActiveHookManager 
} from '@arbiter/cli';

async function runCustomGeneration() {
  // Setup configuration
  const config: CLIConfig = {
    projectDir: process.cwd(),
    generator: {
      templateOverrides: {
        typescript: ['./custom-templates/typescript']
      },
      plugins: {
        typescript: {
          framework: 'next',
          testing: 'vitest'
        }
      }
    }
  };
  
  // Setup custom hooks
  const hooks = new CustomHookManager();
  setActiveHookManager(hooks);
  
  // Configure generation options
  const options: GenerateOptions = {
    outputDir: './generated',
    force: true,
    verbose: true,
    spec: 'my-app'
  };
  
  try {
    // Run generation
    const exitCode = await generateCommand(options, config);
    
    if (exitCode === 0) {
      console.log('Generation completed successfully');
    } else {
      console.error('Generation failed with exit code:', exitCode);
    }
  } catch (error) {
    if (error instanceof GenerationError) {
      console.error('Generation error:', error.message);
      console.error('Context:', error.context);
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    setActiveHookManager(null);
  }
}
```

### Custom Template Resolver

```typescript
import { TemplateResolver } from '@arbiter/cli';

async function customTemplateProcessing() {
  const resolver = new TemplateResolver({
    language: 'typescript',
    overrideDirectories: ['./my-templates'],
    defaultDirectories: ['./node_modules/@arbiter/templates']
  });
  
  const context = {
    serviceName: 'userService',
    endpoints: [
      { method: 'GET', path: '/users' },
      { method: 'POST', path: '/users' }
    ],
    database: {
      type: 'postgres',
      name: 'userdb'
    }
  };
  
  const result = await resolver.renderTemplate(
    'service/express-service.ts.hbs',
    context,
    'export default {};'
  );
  
  console.log('Generated service code:', result);
}
```

This API reference provides complete documentation for integrating with and extending Arbiter's code generation system programmatically.
