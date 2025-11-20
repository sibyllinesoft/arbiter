# Workspace state summary (Nov 2025)

## Recent work
- Removed shims: add/generate/check/sync/spec-import/integrate/docs-generate now call services directly.
- Externalized TS templates: component + ancillary files and service templates now live under `packages/cli/src/templates/typescript/`.
- Adjusted TemplateResolver to allow missing fallbacks.
- Updated monitoring/docs limits and added TODO tracker.

## TODO (high-level)
1) Remove remaining command shims (docs schema/api, import/init/status/list/surface/watch/diff/compat, etc.).
2) Externalize remaining templates (TypeScript build/vite/next configs; Go/Python/Rust templates).
3) Replace regex docs parser with CUE/AST pipeline.
4) Rebuild docs/site to propagate new limits and refactors.
