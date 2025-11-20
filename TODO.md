# Arbiter CLI TODO

## Done (this round)
- Python plugin: moved Dockerfile, docker-compose, pyproject, auth/security, handler, tests, and CI templates into `packages/cli/src/templates/python` and wired plugin to TemplateResolver.
- Rust plugin: all generators now routed through templates (Cargo/main/config/app/database/errors/handlers/routes/services/models/tests/Dockerfiles/compose/GitHub Actions) under `packages/cli/src/templates/rust`.
- Idempotency: cache now persisted to `.arbiter/cache/idempotency.json` with regression test for reload across CLI runs.
- Client/constraints: payload cap raised to 5 MB, timeout to 10 s, and client-side rate limiting disabled (server handles 429s).

## Remaining
- None for this cycle (core refactor items completed). Consider future enhancements: additional CUE parser coverage and plugin DX polish.
