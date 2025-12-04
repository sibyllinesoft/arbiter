Based on the source code provided, I have conducted a comprehensive architectural review of the Arbiter CLI.

The codebase is sophisticated, featuring advanced concepts like sharded storage, constraint enforcement, and a plugin architecture. However, it suffers from significant "bloat" in specific modules, inconsistency in template handling, and tight coupling in generation logic.

Here are the prioritized opportunities to clean up, organize, and improve maintainability.

### 1. Deconstruct the `generate` Monolith
**Target:** `src/services/generate/index.ts` (224 KB)

This is the single largest maintainability risk. It currently handles file system logic, CUE parsing, language detection, test generation, infrastructure scaffolding, and GitHub syncing all in one file.

*   **The Fix: Strategy Pattern for Artifact Generation**
    Break the generation logic into distinct "Artifact Generators" that implement a common interface.
    *   **Create:** `src/services/generate/strategies/`
    *   **Extract:**
        *   `InfrastructureGenerator` (Terraform/K8s logic)
        *   `TestGenerator` (Playwright/Unit test logic)
        *   `DocumentationGenerator` (OpenAPI/Markdown logic)
        *   `CIWorkflowGenerator` (GitHub Actions logic)
    *   **Refactor:** The main `index.ts` should essentially be an iterator that loops through active strategies and calls `.generate(context)`.

### 2. Unify Template Management
**Target:** `src/language-plugins/*.ts` vs `src/templates/`

There is a split personality in how code is generated.
1.  **External Templates:** Used in `src/templates/**` (Handlebars/Mustache).
2.  **Hardcoded Strings:** Massive string template literals inside `src/language-plugins/rust.ts`, `python.ts`, etc.

**The Problem:** Hardcoded strings inside TypeScript files (like in `rust.ts` lines 400-1000+) offer no syntax highlighting, are hard to read, and bloat the bundle size.

*   **The Fix:**
    *   Move **ALL** hardcoded strings from `language-plugins/*.ts` into external `.hbs` or `.tpl` files within `src/templates/`.
    *   The Language Plugins should strictly handle **logic** (determining *variable values* for the template context), not **content** (the code itself).

### 3. Remove `@ts-nocheck` and Fix Types
**Target:** `src/services/remove/index.ts`, `src/services/check-constrained/index.ts`, `src/services/epic/data.ts`, and others.

Several core files start with `// @ts-nocheck`. This disables type safety entirely for those files, defeating the purpose of using TypeScript.

*   **The Fix:**
    *   Remove the directive and fix the underlying type errors.
    *   Most errors appear to stem from loose typing on the CUE AST objects (treating `any` types as specific objects).
    *   Define strict interfaces for the CUE AST responses in `src/cue/types.ts` instead of casting to `any`.

### 4. Refactor CUE Manipulation
**Target:** `src/cue/index.ts`

The `CUEManipulator` attempts to parse CUE to JSON, modify the JSON, and serialize it back to CUE.
*   **The Risk:** Round-tripping CUE -> JSON -> CUE destroys comments, custom formatting, and complex CUE features (like hidden fields or comprehensions) that aren't representable in JSON.
*   **The Fix:**
    *   **Short term:** If you must stick to JS, ensure the serializing layer is extremely robust.
    *   **Long term (Recommended):** Switch "Add" commands to an **append-only** or **merge** strategy. Instead of parsing and rewriting `assembly.cue`, create new fragment files (e.g., `services/my-service.cue`) and let CUE's unification handle the merging at runtime. This is much safer and more "GitOps" friendly.

### 5. Consolidate API Client Logic
**Target:** `src/api-client.ts`

The API client contains business logic (like `getProjectStructureConfig` containing fallback logic) mixed with low-level fetch logic (retries, auth headers).

*   **The Fix:**
    *   Keep `ApiClient` dumb. It should only handle Auth, Rate Limiting, and Fetching.
    *   Move domain-specific API calls into "Repositories" or service layers.
        *   `src/repositories/ProjectRepository.ts`
        *   `src/repositories/FragmentRepository.ts`

### 6. Simplify the Constraint/Monitoring System
**Target:** `src/constraints/*.ts`

The constraint system is very elaborate (event emitters, rate limit tracking, performance hooks). For a CLI tool running on a developer's machine, this adds significant complexity and startup time overhead.

*   **The Fix:**
    *   Lazy load the constraint system. Only initialize `globalConstraintEnforcer` if a specific flag (like `--agent-mode` or `--strict`) is passed.
    *   If this CLI is intended to be run by AI Agents, keep it, but isolate it so it doesn't impact human developers running `arbiter init`.

### 7. Standardize Service Architecture
Currently, some commands are in `src/cli/*.ts` with logic inline, while others delegate to `src/services/*`.

*   **The Fix:** Enforce a strict separation:
    *   **CLI Layer (`src/cli/*`):** Only handles argument parsing (Commander.js), loading config, and printing to stdout/stderr.
    *   **Service Layer (`src/services/*`):** Pure business logic. Should return typed objects/results, NOT print to console directly.
    *   **Benefits:** This makes the code testable without spawning child processes and allows you to build a GUI or LSP on top of the services later.

### 8. Directory Structure Cleanup
The `src` directory is getting crowded. Suggested reorganization:

```text
src/
├── cli/                # Command definitions (Commander)
├── core/               # Core business logic
│   ├── config/         # Config loading/resolution
│   ├── generation/     # The refactored generator strategies
│   ├── cue/            # CUE interfacing
│   └── constraints/    # Constraint system
├── infrastructure/     # External concerns
│   ├── api/            # API Client
│   ├── fs/             # File system helpers
│   └── git/            # Git detection
├── templates/          # ALL template files (moved out of code)
└── language-support/   # Renamed from language-plugins (logic only)
```

### 9. Docker Logic Duplication
**Target:** `src/language-plugins/*.ts` and `src/services/generate/compose.ts`

There is Dockerfile string generation logic inside every language plugin *and* inside the compose generator.

*   **The Fix:** Centralize Docker generation.
    *   Create a `DockerGenerator` service.
    *   Language plugins should provide metadata (e.g., "I need port 8080 and these build steps") rather than returning a full Dockerfile string.
    *   The `DockerGenerator` takes that metadata and applies it to a standard Dockerfile template.

### 10. Simplify `context.ts`
**Target:** `src/cli/context.ts`

This file attempts to hydrate remote configuration and merge it with local config using global mutable state on the command object.

*   **The Fix:** Make configuration immutable. Load it once at the entry point, resolve all remote/local merges, and pass the final `Config` object down to services. Avoid attaching config to the `Command` object which requires casting `(command as any).config`.
