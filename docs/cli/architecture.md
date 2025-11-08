# Arbiter CLI Architecture

_Last updated: 2025-11-08_

This document describes how the CLI is structured internally so contributors
can reason about services, template lifecycles, and dependency injection when
extending Arbiter.

## Layered Design

```
packages/cli/src/
  cli/             Commander program & global options
  commands/        Thin shells that parse flags and call services
  services/        Application services (generate, integrate, sync, spec-import, …)
  language-plugins Template + codegen runtimes per language
  templates/       Stock templates and metadata
  utils/           Shared helpers (hooks, GitHub managers, sharded storage, …)
```

- **CLI entry (`cli/index.ts`)** wires Commander, resolves global flags, and
  hydrates commands with a `CLIConfig` via `cli/context.ts`.
- **Commands** stay small. They accept parsed options, grab `CLIConfig` through
  `requireCommandConfig`, and hand off to services.
- **Services** encapsulate orchestration logic and expose injectable
  dependencies so tests (and other tooling) can exercise them without going
  through Commander.

## Key Services

| Service | Responsibilities | Supporting Modules |
| --- | --- | --- |
| `services/generate` | Compose parsing, template overrides, hook orchestration, file emission. | `generate/compose.ts`, `generate/template-runner.ts`, `generate/hook-executor.ts`, `generate/shared.ts` |
| `services/integrate` | CI/CD workflow generation, GitHub template emission, build matrix inference. | `integrate/assembly.ts`, `integrate/language-detector.ts`, `integrate/workflow-builder.ts` |
| `services/spec-import` | Validates CUE, ensures remote projects exist, uploads fragments via API. | Dependency injection for `ApiClient`, CUE validator, project helper |
| `services/sync` | Reconciles manifests (`package.json`, `pyproject`, `Cargo.toml`, `Makefile`) with Arbiter defaults. | Deep-merge helpers, intelligent conflict tracking, backup utilities |

Each service accepts a `CLIConfig` and (optionally) custom dependency factories,
making them reusable in scripts, tests, or future GUI integrations.

## CLI Context & Dependency Injection

- `cli/context.ts` standardizes config resolution. Global flags (`--config`,
  `--api-url`, `--local`, etc.) feed into `loadConfig` and environment overrides.
- Services that need external systems (HTTP clients, file writers) accept
  dependency objects with sensible defaults. Tests can swap them for fakes.
  Examples:
  - `IntegrateService` accepts a custom filesystem interface and template
    manager factory.
  - `spec-import` can override `createApiClient`, `validateCue`, and
    `ensureProjectExists`.
  - `generate` shares writers/formatters through `hook-executor.ts`.

## Template & Hook Lifecycle

1. **Configure plugins** via `generator.templateOverrides` /
   `generator.testing` in `.arbiter/config.*`. `generate/template-runner.ts`
   registers overrides and testing knobs with the language registry.
2. **Render templates** inside plugins (React, API service, etc.) using the
   curated context derived from specs + UI options.
3. **Hook executor** (`generate/hook-executor.ts`) wraps `GenerationHookManager`
   so `beforeFileWrite` and `afterFileWrite` run with consistent environment
   variables and respect `--dry-run`.
4. **Compose utilities** (`generate/compose.ts`) build Docker Compose bundles,
   README files, env templates, and other infra outputs on top of the same
   context.

See `docs/cli/templates.md` for override details and hook best practices.

## Testing Strategy

- **Service unit tests** live in `packages/cli/src/services/__tests__/`. They
  cover compose emission, hook execution, template overrides, manifest sync,
  spec import, and CI integration.
- **CLI e2e tests** (`packages/cli/src/__tests__/cli-e2e.test.ts`) run full
  workflows using Bun’s test runner. They create temporary workspaces, call the
  CLI via `bun packages/cli/src/cli.ts …`, and, when needed, boot a lightweight
  HTTP stub to mimic the Arbiter API.
- **Type safety** is enforced via `bun run typecheck` (project references +
  strict TS config).

## Contributor Checklist

1. Add or update services instead of embedding logic in commands.
2. Inject dependencies when the code touches IO so tests can provide fakes.
3. Keep template overrides pure and hook effects idempotent.
4. Extend the service/unit tests and CLI e2e harness when introducing new flows.
5. Update `packages/cli/README.md` and relevant docs (`docs/cli/*.md`) when
   adding new architecture concepts or extension points.
