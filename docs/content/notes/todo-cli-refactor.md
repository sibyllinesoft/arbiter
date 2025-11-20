# Arbiter CLI Cleanup TODO (post-commit)

## High-priority
1. Remove `src/commands/*` shim layer; call services directly from `src/cli/*` Commander definitions. Keep signatures and flags intact. Update tests and docs accordingly.
2. Externalize language plugin templates (TS/Go/Python/Rust) into `packages/cli/src/templates/<language>/...` (or dedicated `templates/` dir). Wire TemplateResolver to load files; minimize inline template literals.
3. Unify CUE docs parsing: drop `docs/schema-parser.ts` regex parser and route docs generation through the CUE manipulator / `EnhancedCUEParser` (AST-driven). Adjust docs generators and tests.

## Medium
4. Sweep and rebuild docs/site to propagate new limits (5MB payload, 10s timeout, no client-side rate limit). Verify search_index + rendered guides.
5. Update CLI docs to reflect collapsed command layer and auth loopback flow.
6. Add tests for loopback OAuth path and idempotency disk cache.

## Low / Nice-to-have
7. Refine package-manager UX (sudo hints, npm config audit) and document behavior.
8. Consider caching/template packaging strategy after externalization (possibly lazy-load bundled assets).

## Notes
- Current state already committed (commit `57ba733`).
- `.arbiter/cache/idempotency.json` and `.arbiter/sync-state.json` are created at runtime; ensure docs mention them once stabilized.
- Pre-commit hooks run prettier + biome; watch for parsing errors when moving TS templates.
