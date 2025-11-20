# Arbiter CLI TODO

## Done (this round)
- Python plugin: moved Dockerfile, docker-compose, pyproject, auth/security, handler, tests, and CI templates into `packages/cli/src/templates/python` and wired plugin to TemplateResolver.
- Rust plugin: cargo manifest, main, config, app state, database, errors, and handler generation now templated or routed through TemplateResolver (`packages/cli/src/templates/rust`).

## Remaining
- Rust plugin: wire remaining generators to templates (routes, services, models, tests, Dockerfiles/compose, GitHub Actions) and remove inline strings.
- CUE/docs parity: drop regex-based schema parsing and regex fallback mutation paths; use the AST wrapper for documentation generation and error surfacing. Add regression tests to cover failure cases when CUE parsing fails.
- Idempotency persistence: move the in-memory cache to a disk-backed store (e.g., `.arbiter/cache.json`) so idempotency spans CLI invocations; add tests.
- Constraint tuning: relax client rate limiting/timeout defaults and raise payload limit to ~5MB, ensuring API client and constraint checks are aligned.
- GitHub sync robustness: persist arbiter-id to issue mapping locally (e.g., `.arbiter/sync-state.json`) to avoid duplicates when titles/bodies change; add sync tests.
- Language plugin ergonomics: split frontend vs service generator interfaces to remove runtime `throw` stubs in backend-only languages.
- Template hygiene: move remaining Python dev requirements/auth/test snippets into templates for full consistency.
