# Arbiter CLI Documentation Hub

_Last updated: 2025-11-08_

Use this page to navigate the CLI documentation set. Each guide targets a
different layer of the tooling, so you can ramp up without hunting through the
repo.

## Quick Map

| Topic | Read This | Why |
| --- | --- | --- |
| Day-to-day command usage | [`CLI Reference`](../cli-reference.md) | Exhaustive command help, flags, and examples. |
| Repo & service internals | [`CLI Architecture`](./architecture.md) | Explains layering, dependency injection, and testing strategy. |
| Template overrides & hooks | [`CLI Templates`](./templates.md) | Cookbook for override directories, hook authoring, and best practices. |
| Template engines, GitHub templates, plugins | [`Generation Architecture`](./generation-architecture.md) | Deep dive on template aliases, GitHub template managers, and language plugins. |
| Release/readiness checklist | [`packages/cli/OPEN_SOURCE_READINESS.md`](https://github.com/sibyllinesoft/arbiter/blob/main/packages/cli/OPEN_SOURCE_READINESS.md) | Tracks outstanding work before the CLI is published. |
| Cleanup/refactor plan | [`notes/cleanup-plan.md`](../../notes/cleanup-plan.md) | Cross-repo cleanup phases (API, client, CLI). |

## Onboarding Sequence

1. **Start with the CLI README** (`packages/cli/README.md`) for local build
   instructions and a high-level architecture summary.
2. **Skim this hub** to jump into the right guide based on what you’re doing:
   - Running commands → CLI Reference
   - Extending services/templates → Architecture + Templates guides
   - Working on engines or GitHub templates → Generation Architecture guide
3. **Review the readiness checklist** before contributing bigger changes so you
   know what’s already in flight.
4. **Use the tests** referenced in the Architecture guide (`bun test
   packages/cli/src/__tests__/cli-e2e.test.ts`, etc.) to validate your changes.

## Document Conventions

- All CLI docs now live under `docs/content/reference/cli/` and are surfaced inside the “Reference → CLI” sidebar section.
- Cross-links use relative paths so the docs render correctly on GitHub and in
  local tooling.
- Each guide starts with “Last updated” to make stale pages obvious. Please
  update the timestamp when you make substantial edits.
