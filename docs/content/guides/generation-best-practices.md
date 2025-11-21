# Code Generation Best Practices

Short, opinionated guidance for getting reliable Arbiter outputs.

## Core Workflow (CLI-first)
- Author specs first; run `arbiter check` to fail fast.
- Iterate with `arbiter generate --dry-run` and review diffs; only write to the repo once it’s clean.
- Use `arbiter generate --project-dir /tmp/out` for disposable trials; keep the canonical run in CI.
- Prefer `arbiter watch` (or a file-watcher that shells the CLI) instead of ad‑hoc scripts.
- Regenerate in CI and diff against committed output; fail the build on drift.

## Repo Shapes: Mono or Poly
- Monorepo: keep specs in `.arbiter/`, emit to `packages/` (services, clients, infra). Great for shared tooling and unified CI.
- Polyrepo: store specs plus templates per service/app; point `arbiter generate --project-dir .` at each repo. Custom implementors make this viable without sharing a root.
- Custom templates travel well: publish them as npm/PyPI/git packages, or pin a local path in `.arbiter/templates.json`; works in both mono and poly setups.

## Templates & Tests
- Keep templates small; push logic into context builders.
- Reuse partials/layouts; prefer overlays instead of copying.
- Write template unit tests in-repo; see the Template Development Guide’s testing section for patterns and fixtures.
- When customizing stock templates, add a smoke test that renders with your real spec to catch regressions.
- Handy references: [Template Development Guide](./template-development-guide.md) and [CLI Reference](../reference/cli-reference.md) for flags.

## Testing Strategy (overview)
- Spec validation: `arbiter check`.
- Template unit tests: render with minimal context and assert strings/snapshots.
- Generation smoke: `arbiter generate --dry-run --verbose` in CI; fail on drift.
- Generated code tests: run the generated project’s unit/integration suite (language-specific).
- Performance spot-check: time `arbiter generate` on representative specs; cache dependencies in CI.

## Performance & Reliability Quick Wins
- Cache template compilation where possible; avoid gigantic single templates.
- Precompute derived fields in context; templates stay O(1) lookups.
- Limit parallelism via `--max-workers` if resource-constrained; otherwise keep concurrency on.
- Log context keys in debug builds only; strip/disable for production runs.

## Common Anti-Patterns to Avoid
- Burying business logic inside templates instead of context preparation.
- Mixing environment-specific values into templates; keep env in `deployments.<env>` and pass via context.
- Massive “god” templates with duplicate blocks—split into partials/layouts.
- Skipping CLI validation and relying on manual edits; always regenerate via the CLI.
