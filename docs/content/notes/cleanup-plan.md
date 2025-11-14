# Arbiter Cleanup & Refactor Plan

_Last updated: 2025-11-08_

## 1. Scope & Goals

After removing the webhook/handler system, the codebase still reflects years of layered features. This document inventoryies the current architecture, highlights maintainability hazards, and proposes a multi-phase cleanup program focused on clarity, stability, and documentation accuracy.

Objectives:
- Capture the present-state architecture across apps, packages, and tooling.
- Identify concrete refactor and simplification opportunities.
- Log documentation gaps/outdated references.
- Stage the cleanup into actionable phases we can execute incrementally.

## 2. Architecture Inventory (Present State)

### 2.1 Applications (`apps/`)

| Area | Responsibilities | Notable Notes |
| --- | --- | --- |
| `apps/api` | Bun + Hono HTTP server (`src/server.ts`) exposing REST+WS APIs, spec import/export (`specEngine.ts`), DB access via Drizzle (`src/db/*`), project analysis workers, tunnel manager, MCP integration. | Single server class still wires now-removed webhook dependencies; `server.ts` ~600 lines orchestrating auth, router, tunnel logging. Multiple worker scripts (`file-scanner`, `git-scanner`, `fetch-queue`) exist but aren't documented. Test coverage via `__tests__` focuses on DB + project analysis, little for routes.
| `apps/client` | React + Vite SPA with architecture/diagram views, project list, Monaco editor, design-system. Uses Zustand for tab state (`stores/ui-store.ts`) and React Query wrappers (`hooks/api-hooks.ts`). | Two app entrypoints (`App.tsx`, `App.new.tsx`) indicate a migration in progress. Legacy webhook/handler components removed, but supporting copy, test fixtures, and storybook stories still reference webhooks. Diagram components rely on massive `ArtifactCard`/`ArchitectureReport` modules.

### 2.2 Packages (`packages/`)

| Package | Purpose | Notes |
| --- | --- | --- |
| `shared` | Core runtime logic used by CLI/API (cue orchestration, spec manipulation). | Mixes CUE helpers, git adapters, JSON schema utilities; no clear module boundaries. Needs API docs. |
| `shared-types` | TypeScript interfaces for CLI/API/Client (specs, events, config). | Recently trimmed but still exports webhook-related event enums in generated `arbiter-surface.json`. Large files (`cli.ts`) hold many unrelated types. |
| `cli` | Main `arbiter` CLI (Commander based) plus template/rendering system. | `src/commands/generate.ts` (~0.8 MB) monolith mixing compose parsing, template wiring, and codegen. Language plugins (e.g., `typescript.ts`) include build system scaffolding plus templating logic. Dist bundling duplicates dependencies list logic. |
| `cue-runner` | Executes CUE commands + parsing wrappers. | Relatively small but uses custom test harness; needs doc on environment assumptions. |
| `importer` | Brownfield detection + spec importer. | Type detection logic still references removed packages (e.g., `@arbiter/core`). |
| `api-types` | API response DTOs for generated clients. | Minimal but depends on older schema shapes (webhook events). |

### 2.3 Tooling / Scripts / Docs

- `deploy/cloudflare/*` and `scripts/cloudflare-tunnel.sh` were deleted, but references remained across docs and `deploy/` sources (e.g., `worker.ts` still forwarding webhooks). **(addressed in Phase 0)**
- `docs/` contained high-level references (`cli-reference.md`, `github-sync.md`, tutorials) that described webhook handlers, Cloudflare tunnels, and CLI commands that no longer exist. **(in progress)**
- Root `README.md` formerly marketed webhook-driven automation. **(addressed in Phase 0)**
- `CLAUDE.md` now carries a warning but still has sectioned walkthroughs for the removed pipeline.

## 3. Maintainability & Refactor Opportunities

| Area | Observation | Proposed Improvement |
| --- | --- | --- |
| API server composition | `apps/api/src/server.ts` manually instantiates auth, events, spec engine, tunnel manager, etc., passing a loose `Dependencies` map to routers. Hard to reason about lifetimes and unused deps. | Extract a dependency builder module that constructs typed services, and move router wiring into `routes/index.ts` where DI can be enforced via TypeScript interfaces. Split server class into HTTP vs WS responsibilities. |
| Router surface | Routes under `src/routes` share repeated auth/cors logic and lack typed request bodies. | Introduce shared request/response schemas (Zod) per route to ensure parity with client types. Consider grouping routes by bounded context (projects/specs/imports) with dedicated controllers. |
| Tunnel manager | `src/tunnel-manager.ts` still contains GitHub webhook registration logic (dead code) and exposes many unused fields. | Remove webhook-specific branches, simplify state machine, and add unit tests for lifecycle (setup/stop/teardown). |
| MCP + worker scripts | `mcp.ts`, `mcp-cli-integration.ts`, `file-scanner-worker.ts` exist with minimal validation or documentation; unclear how agents should interact. | Document these entrypoints and add health-check commands/tests to ensure they keep working. |
| Frontend entrypoints | Dual `App.tsx`/`App.new.tsx` plus `MonacoTestApp.tsx` fragments cause confusion. | Decide on single entrypoint, move experimental UIs under `experiments/` or remove, and ensure `main.tsx` imports the canonical App. |
| Component sprawl | `components/` mixes production components, stories, and experiments. Some diagrams (e.g., `ArtifactCard`) handle color rules + layout + interactions inline. | Create dedicated sub-packages (e.g., `components/diagrams/*`) with index exports; extract color/animation constants to `design-system`. |
| State & data fetching | React Query hooks in `hooks/api-hooks.ts` still expose handler/webhook queries, and `useWebSocket.ts` references handler events. | Remove dead hooks, co-locate per-feature hooks next to screens, and type WebSocket messages using the updated `EventType` union from shared types. |
| CLI codegen | `generate.ts` handles Compose parsing, dependency inference, test generation, and file emission in one module. Hard to test and reason about. | Break into submodules (`compose-parser.ts`, `service-writer.ts`, `test-suite-builder.ts`). Add integration tests per module. |
| CLI language plugins | `typescript.ts` duplicates dependency version logic across Vite/Next, and returns `[string,string][]`/`string[]` inconsistently. | Normalize plugin API to always return structured objects (dependencies/devDependencies/scripts). Move template contexts into smaller builders. |
| Package detection | `packages/importer/src/test-detection.ts` still references `@arbiter/core`; detection dataset uses removed package types. | Update heuristics/tests to reflect the current workspace; drop references to deleted packages. |
| Docs & marketing | Numerous files (README, docs/cli-reference, CLAUDE sections, deploy instructions) promote webhook/tunnel features. | Rewrite content to focus on current strengths (spec validation, architecture explorer). Remove instructions for scripts that no longer exist. |

## 4. Documentation & Knowledge Gaps

1. **`CLAUDE.md`** – only the intro warns about removed features; architecture diagrams, workflows, and CLI command lists still describe webhooks/handlers.
2. **`README.md`** – advertises real-time webhook automation and Cloudflare tunnel setup.
3. **`docs/github-sync.md` / `docs/server-monitoring.md` / tutorial content** – refer to webhook handlers, Slack alerts via `sendSlack`, and `scripts/cloudflare-tunnel.sh`.
4. **`apps/client` Storybook data (`components/Layout/ProjectBrowser.stories.tsx`, `design-system` stories)** – sample data includes webhook tasks.
5. **`deploy/cloudflare` directory** – leftover worker/DO templates still mention webhook proxying, confusing future maintainers.

## 5. Proposed Cleanup Phases

### Phase 0 – Documentation & Dead Asset Sweep (fast follow)
- [x] Remove/replace webhook-heavy sections in `README.md`, `docs/*`, and `CLAUDE.md`.
- [x] Delete or archive `deploy/cloudflare` assets tied to webhook tunneling.
- [x] Purge story/test fixtures referencing webhooks.

### Phase 1 – Codebase Simplification (structural)
- **API**: refactor `server.ts` + routers, trim `tunnel-manager.ts`, add typed dependency wiring.
- **Client**: consolidate App entrypoints, reorganize components directory, drop unused hooks/events.
- **Shared Types**: audit enums/interfaces for webhook remnants, regenerate `arbiter-surface.json` without deleted APIs.

### Phase 2 – CLI & Tooling Hardening
- Modularize `generate.ts` and language plugins; add focused tests for Compose parsing, package scaffolding, and template overrides.
- Update importer detection heuristics and fixtures to match current package set.
- Document MCP/worker processes and ensure CLI exposes a clean spec-import pathway (already exists but needs docs/tests).

**Progress 2025-11-08**

- `services/generate` now exposes dedicated modules for Compose generation, template runner wiring, and hook execution (see `packages/cli/src/services/generate/{compose,template-runner,hook-executor}.ts`).
- Added targeted Bun tests covering the new modules plus `integrate`, `spec-import`, and `sync` services under `packages/cli/src/services/__tests__`.
- `integrate` command runs through `IntegrateService` which shares the GitHub template helpers used by the standalone `github-templates` command.

### Phase 3 – Quality & Observability
- Expand automated tests (API route smoke tests, client component tests, CLI integration tests).
- Introduce lint/coverage gates once refactors settle.
- Refresh monitoring docs to align with actual runtime expectations (no webhook proxy).

## 6. Next Steps

1. Socialize this plan with maintainers; confirm scope and sequencing.
2. Execute Phase 0 (docs + asset cleanup) immediately to avoid onboarding confusion.
3. Schedule refactor tasks (Phase 1) with code owners for API and Client.
4. Track progress directly in this document (add checklist per phase).
