---
id: intro
slug: /
title: Welcome to Arbiter
sidebar_position: 1
description: Learn how Arbiter stitches CUE-driven specs, CLI automation, and generation pipelines together.
---

Arbiter is your specification co-pilot: describe the architecture you want in CUE, press go, and let the platform provision opinions, scaffolding, governance, and monitoring in lockstep. Teams adopt it to collapse weeks of diagramming, doc writing, and boilerplate into a single reviewable spec—and to keep everything in sync as reality changes. This site is the playbook for designing that spec-first workflow, bending the CLI to your needs, and scaling the automation across products or business units.

## Quickstart (10–15 minutes)

1) **Clone & install**
   - `git clone https://github.com/arbiter/arbiter.git && cd arbiter`
   - `npm install` (or `bun install` if you already use Bun).

2) **Run the full stack locally**
   - `npm run dev:full` (starts API on `http://localhost:5050`, client on `http://localhost:3000`, auth disabled for local ease).
   - Wait for “ready” logs, then open the UI at `http://localhost:3000`.

3) **Use the UI**
   - Click **New Project** → paste or draft CUE spec fragments (services, routes, flows).
   - Save and run **Generate** to preview scaffolding; the UI streams validation and generation logs from the API.

4) **Create a project via the CLI (agent-friendly path)**
   - `bun packages/cli/src/cli.ts --local add service web --language typescript --port 3000`
   - `bun packages/cli/src/cli.ts --local add endpoint /api/health --service web --method GET`
   - `bun packages/cli/src/cli.ts --local generate --project-dir . --force`
   - Output lands in `services/`, `clients/`, `tests/`, plus docs under `docs/`.

5) **Toolchain flow (Speckit/BMAD specs → Arbiter translation → generated code → AI agent)**
   - Export the structured spec from Speckit/BMAD (OpenAPI/JSON or their native schema) and feed it to Arbiter to translate into `.arbiter/assembly.cue` (the Arbiter spec). This keeps the original intent intact instead of relying on a markdown summary.
   - Run `arbiter generate` to turn the translated Arbiter spec into code, tests, infra, and docs.
   - Point your AI agent at the generated workspace (services/clients/tests) so it implements against the spec-compliant codebase, not a free-form doc.

## What you will find here

- **Overview** – why the project exists, the mental model, and how CUE fits into the workflow.
- **Guides** – deep dives on template development, code-generation architecture, GitHub sync, monitoring, and other day-2 operations.
- **Reference** – canonical CLI docs, the Arbiter CUE schema, API surfaces, and generated TypeDoc output pulled straight from the source.
- **Tutorials** – step-by-step walkthroughs (from the `basics` hands-on labs to Kubernetes-focused playbooks).
