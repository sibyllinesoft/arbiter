# Arbiter CLI Template & Override Guide

_Last updated: 2025-11-08_

This guide explains how Arbiter's CLI discovers templates, how to override and
extend them, and the conventions that keep generated code deterministic. For a
map of all CLI docs, see [`docs/cli/index.md`](./index.md).

## Lifecycle Overview

1. **Discovery** – Each language plugin declares a default template root. The
   CLI optionally augments this list with override directories defined in
   `.arbiter/config.*` under `generator.templateOverrides`.
2. **Resolution** – The `TemplateResolver` composes the template stack,
   respecting override order (user paths take precedence, then fall back to
   stock templates).
3. **Rendering** – Templates receive a curated context (project metadata,
   service definitions, repo info). Templates must be pure and return strings.
4. **Hooks** – Registered `GenerationHook`s can mutate files pre-write
   (e.g. merge into `package.json`) or post-write (e.g. run formatters). Hooks
   must be idempotent and side-effect free outside of the provided helpers.
5. **Emission** – The file writer applies changes. `--dry-run` skips writes and
   prints a plan; `--dry-run --diff` shows unified diffs for each file.

## Configuring Overrides

`arbiter.config.json` (or `.arbiter/config.cue`) can specify overrides:

```jsonc
{
  "generator": {
    "templateOverrides": {
      "typescript": ["./.arbiter/templates/react"]
    },
    "testing": {
      "typescript": { "runner": "vitest" }
    }
  }
}
```

- Paths can be absolute or relative to the config file.
- Arrays are applied in order: first match wins, remaining templates are
  fallbacks.
- Each override directory may contain partial templates (only replace what you
  need) and should ship a `metadata.json` with `name`, `version`, and
  `description` for traceability.

## Hook Cookbook

Hooks live in regular TypeScript modules and implement the
`GenerationHookManager` contract:

```ts
import type { GenerationHook } from "@arbiter/cli";

export const hooks: GenerationHook = {
  async beforeWrite(file, context) {
    // inspect/modify `file.content`
    return file;
  },
  async afterWrite(file, context) {
    // update aggregate state
  },
};
```

Add them via `generator.hooks` in config:

```jsonc
{
  "generator": {
    "hooks": "./.arbiter/hooks/custom-hooks.ts"
  }
}
```

### Best Practices

1. **Pure Templates** – No filesystem/network access inside templates. This
   keeps dry-runs cheap and deterministic.
2. **Idempotent Hooks** – Always check whether a change already exists before
   mutating a file (e.g. inspect JSON before pushing to arrays).
3. **Version Metadata** – Include a `metadata.json` with `name`, `version`,
   `description`, and optional `repository` so consumers know the source.
4. **Test Overrides** – Use `bun test packages/cli -- templates` (see
   `src/templates/__tests__`) or add project-specific tests to ensure overrides
   continue to render after upgrades.
5. **Use Dry-Run Diff** – Encourage users to run `arbiter generate --dry-run
   --diff` when distributing custom templates.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Template not picked up | Verify override path in config, ensure files share the same relative path as the template they replace. |
| Hook throws `Cannot find module` | Hooks are resolved relative to the config file; use absolute paths when unsure. |
| Generated files overwrite local edits | Use hooks to merge instead of replace, or run in `--dry-run` mode to inspect diffs first. |
| CI differences between OSes | Avoid OS-specific path logic; rely on the normalized helpers in `templateManager` and `services/generate/shared.ts`. |

## Further Reading

- `packages/cli/src/language-plugins/typescript.ts` – reference implementation
  showing how template overrides are injected.
- `packages/cli/src/services/generate/template-runner.ts` – centralises
  registry configuration, testing knobs, and override ordering.
- `packages/cli/src/services/generate/hook-executor.ts` – the file writer that
  orchestrates before/after hooks and honours `--dry-run`.
- `packages/cli/src/services/generate/compose.ts` – example of how template
  output feeds auxiliary assets (Docker Compose, README, env templates).
- `packages/cli/src/utils/generation-hooks.ts` – hook helper utilities.
- `packages/cli/OPEN_SOURCE_READINESS.md` – master plan for upcoming
  refactors and release tasks.
