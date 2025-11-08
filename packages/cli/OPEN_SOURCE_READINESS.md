# Arbiter CLI – Open Source Readiness Plan

_Last updated: 2025-11-08_

The CLI will be the publicly released entrypoint for Arbiter, so it has to be
approachable, well documented, and built on clean abstractions. This document
captures the current state, desired architecture, and the sequence of work
needed to make the CLI “rock-solid” for external contributors.

---

## 1. Current Assessment

| Area | Observation |
| --- | --- |
| Command Surface | `src/commands/generate.ts` is ~7k LOC and mixes compose parsing, dependency inference, file emission, and UX logic. Several other commands bundle unrelated responsibilities. |
| Entry Points | There are three layers (`src/cli.ts`, `src/cli/index.ts`, individual modules) with overlapping option parsing and config loading. Newcomers struggle to trace execution order. |
| Template System | Overrides are configured via `languageRegistry.configure` but the control flow is implicit: template resolution, generation hooks, and filesystem writes live in separate directories with little high-level documentation. |
| Tests | Golden tests cover help text, but there is limited unit coverage for template resolution, compose parsing, or registry configuration. |
| Documentation | The package README covers installation but not architecture, layering, or customization. No “template/override cookbook” exists. |

---

## 2. Architecture Goals

1. **Layered Core**
   - **Presentation**: Commander command modules that only handle option parsing + user feedback.
   - **Application Services**: Reusable orchestrators (e.g., `GenerateService`, `ImportService`) with typed inputs/outputs.
   - **Domain Modules**: Compose parser, project detectors, template renderers, git helpers.
   - **Infrastructure**: File IO, HTTP clients, logging/progress utilities.

2. **Self-Documenting Template System**
   - Unified `TemplateResolver` interface with explicit lifecycle hooks (discover, render, post-process).
   - Overrides defined via declarative config (`arbiter.template.json`) with schema validation and examples.
   - Clear separation between stock templates and user overrides (no implicit search order).

3. **Predictable Codegen**
   - Deterministic file emission, idempotent re-runs, and descriptive dry-run output.
   - Hook system for pre/post file generation with explicit contract docs.

4. **Contributor-Friendly Docs**
   - Quickstart (install, run, develop).
   - Architecture guide (layers + key modules).
   - Template & override guide (best practices, examples).
   - Testing guide (golden tests, unit tests, e2e harness).

---

## 3. Refactor & Hardening Plan

### Phase A – Core Restructuring
1. **Command Shims → Services**
   - Extract `generate`, `sync`, `integrate`, `spec-import` logic into dedicated service classes in `src/services/`.
   - Keep command modules <200 LOC focused on argument parsing and calling services.
2. **Configuration Flow**
   - Single config-loading helper (currently scattered between `cli.ts` and `cli/index.ts`).
   - Provide strongly typed `CLIContext` object passed into every service.
3. **Dependency Registration**
   - Introduce lightweight DI container (even a factory map) so tests can swap dependencies (template resolver, file writer, progress reporter).

_Status 2025-11-08:_ `generate`, `spec-import`, and `sync` have been moved into
service modules; `integrate` is partially migrated and will be fully split once
the template subsystem is cleaned up. Remaining commands still need the same
treatment._

### Phase B – Template & Override System
1. **Documented Lifecycle**
   - Codify steps: discover templates → resolve overrides → render → hook pipeline → write file.
   - Each step gets an interface + default implementation in `language-plugins/template-resolver.ts`.
2. **Declarative Overrides**
   - Support `arbiter.templates.json` with schema:
     ```json
     {
       "overrides": [
         { "language": "typescript", "source": "./templates/react" }
       ],
       "hooks": "./hooks/my-hooks.ts"
     }
     ```
   - Validate with Zod and emit descriptive errors.
3. **Best Practice Guardrails**
   - Enforce no direct fs writes inside templates; only return strings.
   - Require template metadata (name, description, version) for discoverability.
4. **Cookbook**
   - Examples for override directories, partial template overrides, custom hooks, and testing overrides.

### Phase C – Documentation & Developer Experience
1. **Package README Revamp**
   - Overview, installation, CLI usage, architecture diagram, contribution guide.
2. **`docs/cli/` Section (or `/docs/cli-reference.md`)**
   - Detailed description of layers/services, template system, override examples, and testing instructions.
3. **Quickstart Tutorial**
   - “Build a plugin in 10 minutes” covering override creation, dry-run, and validation.

### Phase D – Quality Gates
1. **Testing**
   - Unit tests for compose parser, template resolver, override config.
   - Snapshot tests for generated projects (use fixture directories + diff).
   - CLI e2e smoke test for critical commands (`init`, `generate`, `spec-import`, `sync`).
2. **Linting & Formatting**
   - Ensure Biome covers `packages/cli`.
3. **Release Checklist**
   - Automatic docs build (if applicable), CLI `--help` golden verification, dry-run integration test.

---

## 4. Templating Best Practices (Reference)

These principles align with established codegen frameworks (Hygen, Yeoman,
Nx Generators):

1. **Treat templates as pure functions** – they should only consume the data
   passed in and return content, making dry-runs easy.
2. **Keep context objects small** – provide only the metadata the template needs.
3. **Version templates** – include a `version` field in overrides so users know
   when breaking changes occur.
4. **Support composition** – allow templates to `include` partials instead of
   duplicating boilerplate.
5. **Write idempotent hooks** – hooks should check whether their mutation already
   exists before applying changes to `package.json`, `tsconfig`, etc.
6. **Visible Diff Mode** – expose a `--dry-run --diff` path so users can inspect
   changes before writing.

We should bake these into documentation and enforce them via lint rules/tests.

---

## 5. Documentation Deliverables

| Artifact | Location | Owner |
| --- | --- | --- |
| CLI Overview & Architecture | `packages/cli/README.md` | CLI |
| Template/Override Guide | `docs/cli/templates.md` | CLI + Docs |
| Hook API Reference | TSDoc + `docs/cli/hooks.md` | CLI |
| Contribution Guide | `CONTRIBUTING.md` (CLI section) | Project Maintainers |

Each guide should include runnable examples and reference repos once the CLI is
public.

---

## 6. Readiness Checklist

- [ ] Commands wrap services; no monolithic files.
- [ ] Template lifecycle documented + enforced.
- [ ] Override config schema validated with actionable errors.
- [ ] README + docs updated (architecture, templates, contribution).
- [ ] Testing suite covers core flows (unit + e2e).
- [ ] Lint/test/build workflows pass in CI.
- [ ] Versioned release notes for the public CLI binary.

Tracking completion of this checklist will signal that the CLI is ready for the
public launch.

### Immediate Follow-ups

- ✅ Finish migrating `integrate` (and related GitHub template commands) into
  `src/services/`, mirroring the pattern established for `generate` and `sync`.
- ✅ Split `services/generate` into submodules (compose parser, template runner,
  hook executor) with unit tests covering each piece.
- ✅ Add service-level tests for `spec-import`, `sync`, and `integrate` to guard
  their behaviour before the repo opens up.
- ☐ Tighten documentation so the new architecture (services + tests +
  templates) is reflected in `packages/cli/README.md` and `docs/cli/*`.
- ☐ Add e2e smoke tests that execute `arbiter generate`, `arbiter sync`, and
  `arbiter spec-import` against the demo project to catch regressions.
