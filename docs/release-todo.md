# Arbiter Release TODO

## Fast Track (next up)

- [ ] Stand up shared CUE parsing utilities (AST models, conversion helpers) in
      a reusable workspace package
  - expose cue vet/export helpers to CLI + API
  - add golden fixture tests for typical failure modes (syntax error, constraint
    violation)
- [ ] Harden handler runtime safety net
  - replace regex security validator with vm-based sandbox/container boundary
  - implement git + notification service integrations with minimal feature set

## Phase 1 – Core Spec Engine

- [x] Retire legacy SRF pipeline (CLI commands, composition helpers, stub
      parsers)
- [ ] Wire CLI execution flow to the shared CUE engine
- [ ] Rework `apps/api/src/specEngine.ts` gap analysis to operate on structured
      AST
- [ ] Add integration tests covering cue vet/export error mapping and spec
      round-trips

## Phase 2 – Handler Runtime

- [ ] Back handler services (`apps/api/src/handlers/services.ts`) with real
      implementations (Git, notifications, filesystem)
- [ ] Swap regex security validator with vm-based sandbox or containerised
      execution
- [x] Implement handler creation workflow (`apps/api/src/handlers/api.ts` +
      manager) including persistence and hot reload
- [ ] Add end-to-end tests for handler lifecycle (create, reload, execute)

## Phase 3 – Shared Packages & Config

- [ ] Consolidate duplicated utilities into new `packages/shared-utils` (color
      helpers, debouncers, formatting)
- [ ] Deprecate `packages/api-types` in favour of `packages/shared-types`;
      update imports + build outputs
- [ ] Extract config schemas into shared package and align API/CLI/frontend
      loaders
- [ ] Fill in `packages/shared/src/version.ts` compatibility + migration logic
      with real checks and script hooks

## Phase 4 – Product Surfaces

- [ ] Finish OAuth integration in `apps/api/src/auth.ts` or remove placeholders
- [ ] Connect frontend diagrams (e.g.
      `apps/web/frontend/src/components/diagrams/PlotsDiagram.tsx`) to live API
      endpoints
- [ ] Review Storybook stories for accuracy and replace placeholder data

## Phase 5 – Polish & Docs

- [ ] Audit repo for lingering TODOs / placeholders and resolve or ticketise
- [ ] Refresh docs and help output to reflect the CUE-first workflow
- [ ] Ensure CI covers new test suites and passes end-to-end flow
