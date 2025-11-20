# Arbiter CUE Authoring Guide

Use this guide when writing or reviewing Arbiter specs. For every field and type, refer to the [schema reference](../reference/arbiter-cue-schema.md); this page keeps the “how to author” guidance separate from the type dump.

## Quick authoring checklist
1. Define `meta` (name, version, repository) and `runtime.language` early.
2. Model domain types in `domain.entities` and `domain.events` before wiring services.
3. Add contracts under `contracts.http` / `contracts.rpc` and link them from services.
4. Declare services in `services.<name>` with `language`, `serviceType`/`workload`, and dependencies.
5. Prefer `deployments.<environment>` for runtime settings; **avoid the legacy singular `deployment` key** (kept for compatibility only).
6. Lock determinism with `codegen.profile` and `codegen.templateHash` when cutting releases.

## Compatibility notes
- **`deployment` vs `deployments`:** The singular key remains accepted by the loader but is deprecated in docs; use `deployments` in new specs to avoid ambiguity.
- **Schema evolution:** Breaking changes should bump `meta.version` and add compatibility details under `contracts.compat`.
- **Overrides:** Per-service overrides beat global runtime defaults; keep overrides minimal to reduce drift between services.

## Validation & tooling
- Validate locally with `arbiter validate <file.cue>` before running `arbiter generate`.
- The template context generator (`packages/cli/src/templates/index.ts`) serializes your spec directly; inspect that JSON (see Template Development Guide) if a template misunderstands your data.

## Reference
The full type list (e.g., `#Service`, `#Deployment`, `#Runtime`) lives in the [schema reference](../reference/arbiter-cue-schema.md). Regenerate docs via `bun run docs:cue` when the schema changes.
