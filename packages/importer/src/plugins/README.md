# Brownfield Detection Plugins

This directory contains plugins for the Arbiter brownfield detection system.
Each plugin implements the `BrownfieldPlugin` interface to analyze specific
programming languages and frameworks.

## Available Plugins

### Rust Plugin (`rust.ts`)

Comprehensive plugin for detecting Rust artifacts including binaries, libraries,
services, and jobs.

#### File Support Detection

The Rust plugin supports:

- **Cargo.toml** - Main package configuration file
- **Cargo.lock** - Dependency lock file
- **src/main.rs** - Main entry point files
- **src/lib.rs** - Library entry point files
- **src/bin/\*.rs** - Binary source files
- **build.rs** - Build script files

#### Parse Evidence

The plugin extracts structured evidence from:

1. **Cargo.toml Analysis**:
   - Package metadata (name, version, description)
   - Dependencies (runtime, dev, build)
   - Binary definitions (`[[bin]]` sections)
   - Library definitions (`[lib]` sections)

2. **Rust Source Analysis**:
   - Main function detection (`fn main()`)
   - Async runtime detection (`#[tokio::main]`, `#[async_std::main]`)
   - HTTP server patterns (axum, warp, actix-web, etc.)
   - Port binding detection
   - Public API exports (`pub mod`, `pub fn`)

3. **Cargo.lock Analysis**:
   - Locked dependency versions
   - Transitive dependency discovery

#### Infer Artifacts

The plugin can infer these artifact types:

1. **Service Artifacts**:
   - Detected when web frameworks are present (axum, warp, actix-web, rocket,
     tide)
   - Extracts port information, framework type, and service dependencies
   - High confidence (0.85) for explicit configurations

2. **Binary Artifacts**:
   - From `[[bin]]` sections in Cargo.toml
   - From `src/bin/*.rs` files with main functions
   - CLI tool detection via CLI frameworks (clap, structopt, argh)
   - Medium confidence (0.7-0.8) based on source

3. **Library Artifacts**:
   - From `[lib]` sections in Cargo.toml
   - From `src/lib.rs` files with public exports
   - Extracts public API information
   - High confidence (0.9) for explicit library configurations

4. **Job Artifacts**:
   - Detected when job scheduling frameworks are present
   - Background job and cron job detection
   - Medium confidence (0.75-0.8) based on dependencies

#### Confidence Scoring

- **High confidence (0.9)**: Explicit Cargo.toml configurations
- **Medium confidence (0.7)**: Conventional file layouts and patterns
- **Lower confidence (0.5)**: Dependency-based inferences

#### Framework Detection

The plugin recognizes these Rust frameworks:

- **Web Frameworks**: axum, warp, actix-web, rocket, tide, gotham, iron, poem
- **CLI Frameworks**: clap, structopt, argh, gumdrop
- **Database Drivers**: sqlx, diesel, rusqlite, postgres, mysql, mongodb, redis
- **Async Runtimes**: tokio, async-std, smol
- **Job Schedulers**: tokio-cron-scheduler, cron, job-scheduler
- **HTTP Clients**: reqwest, hyper, surf, ureq

## Usage Example

```typescript
import { rustPlugin } from '@arbiter/shared/brownfield/plugins';
import type {
  ParseContext,
  InferenceContext,
} from '@arbiter/shared/brownfield/types';

// Check if plugin supports a file
const supports = rustPlugin.supports('/path/to/Cargo.toml');

// Parse evidence from a file
const evidence = await rustPlugin.parse(
  '/path/to/Cargo.toml',
  cargoTomlContent,
  parseContext
);

// Infer artifacts from evidence
const artifacts = await rustPlugin.infer(evidence, inferenceContext);
```

## Testing

The plugin includes comprehensive tests that cover:

- File support detection
- TOML parsing accuracy
- Source code analysis
- Artifact inference for all types
- Confidence scoring

Run tests with:

```bash
bun test src/brownfield/plugins/__tests__/rust.test.ts
```

## Adding New Plugins

To add a new language plugin:

1. Create a new file (e.g., `python.ts`) implementing `BrownfieldPlugin`
2. Export both the class and an instance
3. Add the plugin to `index.ts`
4. Update the utility functions in `index.ts`
5. Create comprehensive tests

Each plugin should follow the same pattern:

- Implement `supports()` for file detection
- Implement `parse()` for evidence extraction
- Implement `infer()` for artifact inference
- Provide confidence scores and provenance tracking
- Include framework-specific detection logic

## Architecture Notes

The plugin system uses:

- **Evidence-based analysis**: Plugins collect structured evidence before
  inference
- **Confidence scoring**: All inferences include confidence metrics
- **Provenance tracking**: Full audit trail of how artifacts were inferred
- **Type safety**: Strong TypeScript typing throughout
- **Modular design**: Each plugin is independent and composable

This design enables accurate analysis of complex, multi-language codebases like
the Smith project.
