# Arbiter CLI TODO

## Done (this round)
- Python plugin: moved Dockerfile, docker-compose, pyproject, auth/security, handler, tests, and CI templates into `packages/cli/src/templates/python` and wired plugin to TemplateResolver.
- Rust plugin: all generators now routed through templates (Cargo/main/config/app/database/errors/handlers/routes/services/models/tests/Dockerfiles/compose/GitHub Actions) under `packages/cli/src/templates/rust`.
- Idempotency: cache now persisted to `.arbiter/cache/idempotency.json` with regression test for reload across CLI runs.
- Client/constraints: payload cap raised to 5 MB, timeout to 10 s, and client-side rate limiting disabled (server handles 429s).

## Remaining
- CUE/docs parity: replace legacy `schema-parser.ts` with cue-runner/AST-backed parsing and add regression tests for parser failures; legacy parser is no longer used in docs commands but still needs removal or rewrite.
- GitHub sync robustness: persist arbiter-id to issue mapping locally (e.g., `.arbiter/sync-state.json`) to avoid duplicates when titles/bodies change; add sync tests.
- Language plugin ergonomics: split frontend vs service generator interfaces to remove runtime `throw` stubs in backend-only languages. ✅ type guards/interfaces added.
- Template hygiene: move remaining Python dev requirements/auth/test snippets into templates for full consistency. ✅ requirements-dev templated.
