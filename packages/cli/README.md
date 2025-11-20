# Arbiter CLI

The Arbiter CLI wraps daily workflows for working with Arbiter specifications.
It provides commands for validating fragments, generating scaffolding,
synchronising project plans to GitHub, and interacting with the Spec Workbench
API without leaving a terminal session. This package is the portion of Arbiter
that will be released publicly, so everything is designed to be easy to reason
about, well documented, and extensible.

Looking for the broader doc set? Start at
[`docs/cli/index.md`](../../docs/cli/index.md) for an overview of every CLI
guide.

---

## Quick Start

```bash
# Install workspace dependencies
bun install

# Build shared packages (recommended before running the CLI)
bun run build

# Execute commands directly from source
bun run --filter @arbiter/cli cli -- --help
```

The bundled binary (`arbiter-cli`) is produced via `bun run build:standalone`
and can be distributed independently.

---

## Architecture Overview

The CLI is layered to keep responsibilities clear:

```
src/
  cli/            Commander program setup & option wiring
  commands/       Thin shims that parse flags and delegate to services
  services/       Application services (generate, import, sync, etc.)
  language-plugins/  Template + codegen runtime per language
  templates/      Stock templates (render-only, no side effects)
  utils/          Shared helpers (GitHub, sharded storage, formatting, etc.)
```

### Commands vs. Services

- **Commands (`src/commands/*`)**: accept CLI options, resolve configuration,
  and hand off to services. They should stay under ~200 LOC.
- **Services (`src/services/*`)**: encapsulate orchestration logic. For example,
  `services/generate` now composes several focused modules:
  - `generate/compose.ts` – Docker Compose + infra emitters
  - `generate/template-orchestrator.ts` – language plugin + template override wiring
  - `generate/hook-executor.ts` – wraps `GenerationHookManager` so hooks stay deterministic
  - `generate/shared.ts` – slug/path helpers shared across writers
  Other services follow the same pattern: `services/integrate` produces CI/CD
  workflows, `services/spec-import` persists fragments with injectable deps, and
  `services/sync` keeps manifests aligned with Arbiter metadata. A longer-form
  tour lives in [`docs/cli/architecture.md`](../../docs/cli/architecture.md).

### Configuration & Context

`src/config.ts` builds a `CLIConfig` by merging defaults, project overrides, and
environment variables. Commands receive this config and pass it to services,
ensuring deterministic behaviour (no globals). Auth tokens are stored in
`auth-store.ts`.

#### Environment Overrides

| Variable | Purpose |
| --- | --- |
| `ARBITER_URL` / `ARBITER_API_URL` | Forces the CLI to target a specific server URL (equivalent to `--api-url`). |
| `ARBITER_VERBOSE` / `ARBITER_FETCH_DEBUG` | Enables verbose logging globally. Same effect as passing `--verbose` (used by commands and network client). |
| `ARBITER_DEBUG_CONFIG` | When set to `1`, `true`, or `verbose`, emits remote-config hydration details to stderr. |

`--verbose` and the env flags share a single toggle (`config.verbose`), so you
get consistent logging regardless of how the flag is set.

### Template System

Language plugins register template resolvers and optional overrides:

1. Discover templates (built-in or user-provided override directories).
2. Render templates using a controlled context (project metadata, spec data).
3. Run generation hooks (pre/post file operations).
4. Emit files via the file writer (supports dry-run + diff mode).

Template overrides are configured via `.arbiter/config.json`
under the `generator.templateOverrides` key. See
[`docs/cli/templates.md`](../../docs/cli/templates.md) for the full cookbook and
best practices (pure templates, deterministic hooks, versioning).

### Service-Level Tests & Dry Runs

To keep regression risk low, each major service has targeted Bun tests under
`packages/cli/src/services/__tests__/`:

- `compose.test.ts` ensures Docker Compose assets match expectations.
- `hook-executor.test.ts` verifies hook ordering and dry-run behaviour.
- `template-orchestrator.test.ts` covers override wiring + registry configuration.
- `spec-import.test.ts`, `sync.test.ts`, and `integrate.test.ts` execute the key
  workflows against temporary workspaces (real fs writes).

Run them via:

```bash
bun test packages/cli/src/services/__tests__/*.test.ts
```

All services honour `--dry-run`, so you can preview manifests, CI workflows, and
code generation without touching disk.

### Shared Utilities

- **API Client** (`src/api-client.ts`): rate-limited wrapper around the
  Spec Workbench API with automatic retries and error normalisation.
- **Sharded Storage** (`src/utils/sharded-storage.ts`): deterministic layout for
  epics/tasks stored in `.arbiter/`.
- **GitHub Sync** (`src/utils/github-sync.ts` and
  `src/utils/unified-github-template-manager.ts`): template-driven sync helpers
  with preview/diff capabilities.

---

## Template & Override Best Practices

1. **Keep templates pure** – no filesystem access or process state; just return
   strings.
2. **Version overrides** – include metadata so consumers know which version of
   a template set they are using.
3. **Use hooks for mutations** – modify `package.json`, `tsconfig`, etc. via
   generation hooks so changes stay idempotent.
4. **Validate overrides** – the CLI validates `arbiter.templates.json` using
   Zod, surfacing actionable errors.
5. **Dry-run first** – `arbiter generate --dry-run --diff` shows the file plan
   before touching disk.

Refer to `docs/cli/templates.md` for in-depth guidance, examples, and testing
tips when building custom generators.

Need a starting point? `packages/cli/example-templates.json` contains the same
sample configuration used throughout the docs. It is not loaded automatically—
copy the pieces you want into your `.arbiter/config.json` when experimenting.

---

## Development Workflow

1. **Install deps**: `bun install`
2. **Run commands from source**:
   ```bash
   bun run --filter @arbiter/cli cli -- init my-app
   ```
3. **Watch mode** (optional): `bun run --filter @arbiter/cli dev`
4. **Tests**:
   - Unit/golden tests: `bun test packages/cli`
   - Full CLI e2e: `bun test packages/cli/src/__tests__/cli-e2e.test.ts`
5. **Lint/format**: `bun run lint` from repo root (Biome)

## Runtime Dependencies

Because this CLI is published for end users, interactive libraries have to live
in `dependencies` rather than `devDependencies`. The
`src/types/vendor.d.ts` shim references `inquirer`, `ora`, `cli-table3`, and
`cli-spinners`; when adding or swapping runtime libraries, update both the shim
and `package.json` so downstream installations do not fail with missing module
errors.

---

## Key Extension Points

- `language-plugins/*`: add or customise code generation for new runtimes.
- `templates/index.ts`: register new template sets or hook pipelines.
- `utils/generation-hooks.ts`: implement pre/post file hooks.
- `services/*`: add new workflows (e.g., `spec-import`, `sync`) or extend
  existing ones without modifying command files.

All core modules include TSDoc comments so IDEs surface usage hints. Start with
`src/types.ts`, `src/api-client.ts`, and the files mentioned above to
understand the existing contracts.
