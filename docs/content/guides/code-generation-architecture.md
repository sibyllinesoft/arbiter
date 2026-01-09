# Arbiter Code Generation Architecture

This guide explains how Arbiter transforms your specifications into working code. Whether you're debugging generation issues, customizing templates, or building language plugins, understanding the generation pipeline will help you work more effectively.

## How Generation Works (The Short Version)

When you run `arbiter generate`, here's what happens:

1. **Load** — Arbiter reads your `.arbiter/assembly.cue` specification
2. **Resolve** — It figures out what services, clients, and schemas need code
3. **Match** — Each artifact is paired with the right language plugin and templates
4. **Render** — Templates produce actual source files using your spec data
5. **Write** — Files land in your project directory, ready for use

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Your Spec      │ ──► │  Generator      │ ──► │  Source Code    │
│  (assembly.cue) │     │  (plugins +     │     │  (services,     │
│                 │     │   templates)    │     │   clients, etc) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

For most users, that's all you need to know. The sections below dive deeper for those who want to customize or extend the system.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Generation Pipeline](#generation-pipeline)
- [Core Components](#core-components)
- [Template System](#template-system)
- [Configuration System](#configuration-system)
- [Language Plugins](#language-plugins)
- [Context Providers](#context-providers)
- [Hooks and Customization](#hooks-and-customization)

---

## Architecture Overview

Arbiter's code generation system follows a modular, extensible architecture designed to transform CUE specifications into production-ready code artifacts across multiple languages and frameworks.

### Core Principles

1. **Specification-Driven**: All generation is driven by CUE specifications that define complete application architecture
2. **Multi-Language Support**: Pluggable language system supporting TypeScript, Python, Rust, Go, and more
3. **Template-Based**: Flexible template implementor with override capabilities
4. **Hook-Based Extension**: Comprehensive hook system for custom generation logic
5. **Context-Aware**: Rich context providers that extract meaningful data from specifications

### System Components

```mermaid
flowchart LR
    specs["CUE Specs (.arbiter/*.cue)"] --> core["Generation Core"]
    core --> assets["Generated Code & Assets"]
    core --> helpers["Template System + Language Plugins + Context Providers + Hooks"]
    style specs fill:#eef3ff,stroke:#4c63d9,stroke-width:2px
    style core fill:#ecfdf3,stroke:#1c8b5f,stroke-width:2px
    style assets fill:#fffbe6,stroke:#c48a06,stroke-width:2px
    style helpers fill:#ffecef,stroke:#d6456a,stroke-width:2px
```

> **Project structure quick reference**  
> Generators never guess paths. They all consume `ProjectStructureConfig`, which lists `clientsDirectory`, `servicesDirectory`, `packagesDirectory`, `toolsDirectory`, `docsDirectory`, `testsDirectory`, `infraDirectory`, and optional `packageRelative` toggles. See [Project Structure Schema](#project-structure-schema) for the full TypeScript interface and defaults.

## Generation Pipeline

The generation pipeline consists of five main phases. Understanding each phase helps you debug issues and know where to customize behavior.

### 1. Specification Discovery and Loading

Arbiter looks for your specification in `.arbiter/assembly.cue` (or sharded files if you have a large project). It:

- Validates the CUE syntax and structure
- Resolves any imports or references between files
- Ensures all required fields are present

**Troubleshooting:** If generation fails early, run `arbiter check` to see validation errors before the generator even starts.

### 2. Context Resolution

Once the spec is loaded, Arbiter builds a "context" for each artifact that needs generation. Think of context as the data package that templates will use:

- **What's being built** — service name, language, framework, ports
- **Where it goes** — output directory paths based on your project structure
- **What it depends on** — database connections, other services, schemas

This is where your project structure config (`clientsDirectory`, `servicesDirectory`, etc.) gets applied.

### 3. Template Resolution and Processing

Now Arbiter matches each artifact to the right template:

1. Checks if you have custom templates in your project's override directories
2. Falls back to built-in templates for your language/framework
3. Prepares the template engine (Handlebars by default, but you can use external tools)

**Customization point:** Add your own templates to override defaults. See [Template Development Guide](./template-development-guide.md).

### 4. Code Generation

This is where files actually get written:

- Language plugins (TypeScript, Python, Rust, Go) handle framework-specific generation
- Templates render with your spec data interpolated
- Docker files, CI/CD configs, and tests are generated alongside source code
- Hooks run before/after each file write if you've configured them

**Tip:** Use `arbiter generate --dry-run` to preview what files will be created without actually writing them.

### 5. Post-Generation Processing

After all files are written:

- Generated code structure is validated
- Post-generation hooks run (for things like formatting, linting)
- Project manifests (`package.json`, `go.mod`, etc.) are updated if needed
- Optionally, changes can sync to GitHub

## Core Components

### GenerateService (`packages/cli/src/services/generate/index.ts`)

The main orchestrator that coordinates the entire generation process.

**Key Features:**
- Spec discovery and validation
- Context preparation
- Template processing coordination
- Error handling and reporting
- Dry-run support

**Main Methods:**
- `generateCommand()` - Primary entry point
- `discoverSpecs()` - Finds available specifications
- `createClientContext()` - Sets up client generation context
- `createServiceContext()` - Sets up service generation context

### Hook Executor (`packages/cli/src/services/generate/hook-executor.ts`)

Manages the execution of generation hooks for customization.

**Features:**
- File write hooks with before/after processing
- Directory creation with dry-run support
- Active hook manager state management

```typescript
export async function writeFileWithHooks(
  filePath: string,
  content: string,
  options: GenerateOptions,
  mode?: number,
): Promise<void>

export async function ensureDirectory(
  dir: string, 
  options: GenerateOptions
): Promise<void>
```

### Template Orchestrator (`packages/cli/src/services/generate/template-orchestrator.ts`)

Bridges the generation system with language-specific plugins.

**Capabilities:**
- Language plugin configuration
- Template override resolution
- Testing configuration management
- Workspace root configuration

> **Template Orchestrator vs. Template Implementors**
>
> The template orchestrator never renders source files itself. Its job is to locate the correct language plugin, configure overrides, and hand the plugin a `TemplateContext`. Plugins can then:
> 1. Call the pluggable **Template Implementor** interface to execute external templates (cookiecutter, scripts, etc.), or
> 2. Render programmatically (e.g., write TypeScript ASTs) while still using the same `TemplateContext`.
>
> This separation keeps the CLI deterministic: the orchestrator decides *what* should be generated, the implementors decide *how* the bytes are produced.

## Template System

This section focuses on how the generation pipeline invokes templates. For step‑by‑step authoring guidance, see the [Template Development Guide](./template-development-guide.md).

### Template Orchestrator Responsibilities

The orchestrator (inside `services/generate/template-orchestrator.ts`) decides _when_ templates execute:

- Resolves language plugins and template overrides from CLI config (including remote configs)
- Builds the canonical `TemplateContext { project, parent, artifact, impl }`
- Hands that context to either internal renderers or external implementors

> `arbiter add service --template ts-fastify` only records template metadata inside the spec. **`arbiter generate`** is the command that resolves aliases, loads implementors, streams the JSON context, and writes files.

Plugins can still emit code programmatically, but they ingest the same context object to keep behavior deterministic.

### Internal Template Implementor (Handlebars default)

Arbiter ships with embedded [Handlebars](https://handlebarsjs.com/) templates for the built-in service/client scaffolds. When `arbiter generate` runs, the implementor loads the Handlebars bundle, binds the template context, and writes files in-place. The repository bootstrap templates documented in the Template Development Guide reuse the exact same interface.

- **Pros:** Fast, bundled with the CLI, supports partials/inheritance/helpers, zero external runtime.
- **Cons:** Logic must remain declarative; advanced branching often moves into helpers.

### External Template Implementors

Prefer Liquid, Mustache, your own Python renderer, or a bespoke binary? Declare an alias in `.arbiter/templates.json`. When referenced, Arbiter shells out to the command you specified and streams the entire context via `stdin`/environment variables. Whatever the process writes to `stdout` becomes the generated artifact, so you can adopt any templating stack without forking the CLI.

Built-in helpers (like the cookiecutter shortcut behind `arbiter add service --template ...`) follow the same contract. They call the library directly for performance but still receive `{ command, args, context }`, so swapping implementors is as simple as editing your template config.

### Template Implementor Interface

The template system provides a pluggable architecture for different template processors:

```typescript
export interface TemplateImplementor {
  name: string;
  command: string;
  defaultArgs: string[];
  validate?(source: string): Promise<boolean>;
  execute(source: string, destination: string, context: TemplateContext): Promise<void>;
}
```

### Template Configuration

Templates are configured through a hierarchical system:

```typescript
export interface TemplateConfig {
  implementors: Record<string, TemplateImplementorConfig>;
  aliases: Record<string, TemplateAlias>;
  settings?: {
    defaultImplementor?: string;
    cacheDir?: string;
    timeout?: number;
  };
}

export interface TemplateImplementorConfig {
  command: string;
  defaultArgs: string[];
  timeout?: number;
}
```

### Template Resolution

Templates are resolved through the `TemplateResolver` class with the following priority:

1. **Override Directories** - Custom user templates
2. **Default Directories** - Built-in templates
3. **Fallback Content** - Hard-coded defaults

```typescript
export class TemplateResolver {
  async renderTemplate(
    templatePath: string,
    context: Record<string, unknown>,
    fallback: string,
  ): Promise<string>
}
```

### Template Variables

Templates support two types of variable interpolation:

- `{{ variable }}` - Simple variable substitution
- `{{{ variable }}}` - Complex object serialization (JSON)

**Variable Context Structure:**
```typescript
export interface TemplateContext {
  /**
   * Entire application spec (already normalized/augmented).
   * Template implementors can reach any part of the project without re-querying.
   */
  project: Record<string, unknown>;

  /**
   * Parent artifact, if this template renders something nested
   * (e.g., an endpoint template gets the owning service as the parent).
   */
  parent?: Record<string, unknown>;

  /**
   * The concrete artifact being rendered (service, client, endpoint, route, etc).
   * This is always present and mirrors the structure from the CUE spec.
   */
  artifact: Record<string, unknown>;

  /**
   * Implementation metadata computed by the generator (paths, language hints,
   * derived names). Nothing in here comes from user specs, so template authors
   * can safely treat it as helper data.
   */
  impl?: Record<string, unknown>;
}
```

## Configuration System

### Generation Options

The `GenerateOptions` interface defines all configurable aspects of generation:

```typescript
export interface GenerateOptions {
  projectDir?: string;       // Target project directory (defaults to cwd or config.projectDir)
  force?: boolean;           // Overwrite existing files
  dryRun?: boolean;         // Preview mode without file writes
  verbose?: boolean;         // Detailed logging
  spec?: string;            // Specific spec to generate
  syncGithub?: boolean;     // Sync to GitHub after generation
  githubDryRun?: boolean;   // Preview GitHub sync
}
```

### CLI Configuration Integration

The generation system integrates with the broader CLI configuration:

```typescript
export function configureTemplateOrchestrator(
  language: string, 
  cliConfig: CLIConfig
): void {
  const generatorConfig = cliConfig.generator;
  const overridesEntry = generatorConfig?.templateOverrides?.[language];
  // ... configure language-specific settings
}
```

### Project Structure Schema

`ProjectStructureConfig` tells the generator where to place each artifact family
within the host repository. Every context builder receives it so templates never
hard-code paths.

```typescript
export interface ProjectStructureConfig {
  clientsDirectory: string;   // e.g. "clients"
  servicesDirectory: string;  // e.g. "services"
  packagesDirectory: string;  // shared domain libraries
  toolsDirectory: string;     // CLIs/automation utilities
  docsDirectory: string;      // generated docs landing zone
  testsDirectory: string;     // shared test harnesses/fixtures
  infraDirectory: string;     // IaC / compose / helm output
  packageRelative?: {
    docsDirectory?: boolean;
    testsDirectory?: boolean;
    infraDirectory?: boolean;
  };
}
```

Defaults come from the CLI config (`arbiter init` seeds them), but projects can
override directories in `.arbiter/config.json`. When generators need to emit
shared modules, docs, or infrastructure beyond a single service directory, they
resolve the target via this schema to stay consistent across greenfield and
brownfield repos.

Set `packageRelative.docsDirectory/testsDirectory/infraDirectory` to `true` when
you want those artifacts written inside each service/client/tool package rather
than in global folders. When a package context doesn’t exist (for example, a
cross-cutting doc), Arbiter falls back to the shared directory.

## Language Plugins

### Plugin System Architecture

Language plugins provide specialized code generation for different programming languages and frameworks.

**Core Interfaces:**
```typescript
export interface ComponentConfig {
  name: string;
  type: "page" | "component" | "layout" | "hook" | "util";
  props?: ComponentProp[];
  dependencies?: string[];
  styles?: boolean;
  tests?: boolean;
  testId?: string;
}

export interface ServiceConfig {
  name: string;
  type: "api" | "service" | "handler" | "middleware" | "model";
  endpoints?: string[];
  database?: boolean;
  auth?: boolean;
  validation?: boolean;
  methods?: Array<Record<string, any>>;
}
```

### Supported Languages

Current language plugin support:
- **TypeScript/Node.js** - Full-stack web applications
- **Python** - FastAPI services and data processing
- **Rust** - High-performance services with Axum
- **Go** - Microservices and CLI tools

### Plugin Configuration

Language plugins are configured through the CLI config:

```typescript
languageRegistry.configure(language, {
  templateOverrides: resolvedOverrides,
  pluginConfig: generatorConfig?.plugins?.[language],
  workspaceRoot: cliConfig.projectDir,
  testing: getLanguageTestingConfig(generatorConfig?.testing, language),
});

// `appSpec` is the fully expanded Arbiter specification (domain + contracts + services)
// that the generator derives from CUE before handing data to plugins. Each artifact
// gets a normalized target derived from this object so every plugin reads the same
// ground truth regardless of language.
type AppSpec = ResolvedAssembly;
```

## Context Providers

### Generation Contexts

Generation contexts provide structured data to templates and generators:

#### Client Generation Context
```typescript
export interface ClientGenerationContext {
  root: string;      // Absolute root directory for the client artifacts
  routesDir: string; // Where UI routes live
  testsDir: string;  // Client-level tests directory path
}
```

#### Service Generation Context
```typescript
export interface ServiceGenerationContext {
  root: string;        // Service root directory
  routesDir: string;   // Routes directory
  testsDir: string;    // Service-level tests directory
}
```

### Context Creation

Contexts are created from CUE specifications during the resolution phase:

```typescript
// Client context from app specification
const clientContext = createClientContext(
  appSpec,
  projectStructure,
  projectDir
);

// Service context from service configuration
const serviceContext = createServiceContext(
  serviceName,
  serviceConfig,
  projectStructure,
  projectDir
);
```

Both helpers feed into generation “targets” that bundle the context with spec
metadata:

```typescript
export interface ClientGenerationTarget {
  key: string;              // Spec identifier (service/route key)
  slug: string;             // Stable slug derived from key
  relativeRoot: string;     // Path relative to repo root
  config?: ClientConfig;    // Raw spec block for the client
  context: ClientGenerationContext; // Filesystem locations (root/routes/tests)
}

export interface ServiceGenerationTarget {
  key: string;
  slug: string;
  relativeRoot: string;
  language: string;         // Normalized from service config
  config: ServiceConfig;    // Spec payload (contracts, env, etc.)
  context: ServiceGenerationContext;
}
```

By keeping contexts focused on filesystem concerns and moving spec-derived data
into the targets, every artifact type (clients, services, tools, packages) reads
the same structure. Plugins that need additional metadata simply reference the
target’s `config` (the exact spec block) while using `context` for IO paths.

> **Context vs. Target**
>
> Context objects intentionally contain only filesystem locations. Spec-derived metadata (slug, language, relationships) now lives in `ClientGenerationTarget` and `ServiceGenerationTarget`, ensuring templates always read canonical data from the spec rather than ad‑hoc context bags.

#### Template Implementor Context

When the orchestrator executes a template implementor (cookiecutter, script, custom binary, etc.) it serializes a `TemplateContext` defined in `packages/cli/src/templates/index.ts`:

```typescript
export interface TemplateContext {
  project: Record<string, unknown>; // resolved spec (services, clients, structure)
  parent?: Record<string, unknown>; // owning service/client metadata
  artifact: Record<string, unknown>; // the concrete thing being generated
  impl?: Record<string, unknown>;    // orchestrator-provided hints (e.g., alias vars)
}
```

That `{ project, parent?, artifact, impl? }` shape is the same one user-supplied implementors receive, so in-repo templates and external engines observe identical inputs.

> **Filesystem helpers vs. file writes**
>
> Functions exported from `services/generate/shared.ts` (`joinRelativePath`, `resolvePackageDirectory`, etc.) only compute suggested paths from `ProjectStructureConfig`. Implementors still choose where (and whether) to write files; the orchestrator never stages or copies bytes on their behalf. The helpers keep the “where should this live?” math consistent while leaving the actual IO to the template layer.

## Hooks and Customization

### Generation Hook System

The generation system provides hooks for customizing the generation process:

```typescript
export class GenerationHookManager {
  async beforeFileWrite(
    filePath: string, 
    content: string
  ): Promise<string>;
  
  async afterFileWrite(
    filePath: string, 
    content: string
  ): Promise<void>;
}
```

### Hook Integration

Hooks are integrated throughout the generation pipeline:

1. **Pre-Generation Hooks** - Setup and validation
2. **File Write Hooks** - Content transformation
3. **Post-Generation Hooks** - Cleanup and finalization

### Custom Hook Implementation

Implement custom hooks by extending the `GenerationHookManager`:

```typescript
class CustomHookManager extends GenerationHookManager {
  async beforeFileWrite(filePath: string, content: string): Promise<string> {
    // Apply custom transformations
    return transformedContent;
  }
  
  async afterFileWrite(filePath: string, content: string): Promise<void> {
    // Perform post-write actions
  }
}
```

## Error Handling and Validation

### Validation Pipeline

The generation system includes comprehensive validation:

1. **Specification Validation** - CUE schema validation
2. **Template Validation** - Template syntax checking
3. **Output Validation** - Generated code validation
4. **Dependency Validation** - Required tool availability

### Error Recovery

The system implements graceful error recovery:

- **Dry Run Mode** - Preview generation without side effects
- **Partial Generation** - Continue on non-critical errors
- **Rollback Support** - Undo incomplete generations
- **Detailed Logging** - Comprehensive error reporting

## CLI Deep Dive (authoritative paths)

Formerly duplicated in the CLI reference, this section is the single place to find file-level pointers:
- **Template aliases & implementors** — `.arbiter/templates.json` drives the `TemplateOrchestrator` in `packages/cli/src/templates/index.ts`. Implementors receive `{ project, parent, artifact, impl }` as JSON over stdin and may be external commands or built-ins.
- **GitHub issue templates** — `UnifiedGitHubTemplateManager` (`packages/cli/src/utils/unified-github-template-manager.ts`) merges on-disk `.github/ISSUE_TEMPLATE` files with the config-driven templates under `github.templates` in `.arbiter/config.json`.
- **Language plugins** — Registered in `packages/cli/src/language-plugins/index.ts` (TypeScript, Python, Go, Rust today). Each plugin owns its `pluginConfig` and `testing` block under `generator.plugins.<language>` in the CLI config.

## Integration Points

### API Server Integration

The generation system integrates with the Arbiter API server for:
- Specification validation
- Real-time generation status
- WebSocket event broadcasting
- Shared storage coordination

### CI/CD Integration

Generated projects include CI/CD configurations for:
- **GitHub Actions** - Automated testing and deployment
- **Docker Compose** - Container orchestration
- **Kubernetes** - Production deployment manifests

### External Tool Integration

The system integrates with external tools:
- **CUE CLI** - Specification validation
- **Docker** - Container builds
- **Git** - Version control
- **Package Managers** - Dependency installation
