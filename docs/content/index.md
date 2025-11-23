---
id: intro
slug: /
title: Welcome to Arbiter
sidebar_position: 1
description: Agent-first CLI for collaborative, spec-driven development. Keep AI agents on rails with guided CUE specification workflows.
---

**Arbiter keeps agents on rails.** It's a CLI-first specification platform designed to simplify validation, enable collaborative spec-driven development, and guide both humans and AI agents through structured workflows.

## Why Arbiter?

Traditional development tools force you to choose between flexibility and structure. Arbiter gives you both:

- **Agent-First Design**: The CLI is the primary interface, built from the ground up for agentic use with baked-in directions, next-step prompts, and structured outputs that keep AI assistants focused and productive.
- **Guided Workflows**: Start with `arbiter init`, build incrementally with `arbiter add`, validate continuously with `arbiter check`. Each command suggests what to do next.
- **Specification Validation Made Simple**: CUE-based schemas catch errors before they become code. Type-safe, composable, and collaborative.
- **Flexible Control**: Use the CLI for guided workflows (recommended), the web UI for visual modifications, or write CUE directly when you need full control. The CLI is designed to scaffold your spec before manual editing begins.

## The Arbiter Philosophy

**CLI → Spec → Generation → Implementation**

1. **CLI First**: Use commands like `arbiter add service`, `arbiter add endpoint` to build your spec incrementally. The CLI keeps you on the happy path.
2. **Validation Everywhere**: Every change is validated against CUE schemas. No more broken specs, no more drift.
3. **Generate Confidently**: Run `arbiter generate` to create scaffolding, tests, docs, and infrastructure that perfectly matches your spec.
4. **Refine as Needed**: Edit the generated CUE directly for advanced scenarios, or use the web UI for visual exploration. Both paths preserve the CLI-built foundation.

This approach ensures specs stay consistent, agents stay productive, and teams stay aligned.

## Quickstart: CLI-First Path (Recommended)

**For AI Agents and Command-Line Users**

The CLI is your primary interface. It provides guided, incremental spec building with built-in validation:

```bash
# 1) Install Arbiter
git clone https://github.com/arbiter/arbiter.git && cd arbiter
bun install  # or npm install

# 2) Start the API server (required for validation and generation)
bun run dev  # Starts API on http://localhost:5050

# 3) Initialize a new project
arbiter init my-app --language typescript

# 4) Build your spec incrementally (agents: this is your happy path!)
arbiter add service web --language typescript --port 3000
arbiter add endpoint /api/health --service web --method GET
arbiter add endpoint /api/users --service web --method POST

# 5) Validate your spec (happens automatically, but you can check explicitly)
arbiter check

# 6) Generate code, tests, and infrastructure
arbiter generate --force

# Output lands in services/, clients/, tests/, and docs/
```

**Why CLI first?**
- ✅ Keeps agents on the right track with clear next steps
- ✅ Validates every change automatically
- ✅ Produces consistent, reviewable CUE specs
- ✅ Works non-interactively for automation
- ✅ Perfect for AI-assisted development

## Alternative: UI for Visual Exploration

**For Visual Learners and Architecture Review**

After building your spec with the CLI, you can explore and modify it visually:

```bash
# Start the full stack (API + Web UI)
bun run dev:full  # API on :5050, UI on :3000

# Open http://localhost:3000
# - Browse architecture diagrams
# - Edit services and endpoints visually
# - Review generated code previews
```

The UI is great for understanding complex systems, but the CLI is designed to scaffold specs first. Use the UI to refine what the CLI built.

## Advanced: Direct CUE Editing

**For Maximum Control**

Once the CLI has scaffolded your `.arbiter/assembly.cue`, you can edit it directly for advanced scenarios:

- Complex type definitions
- Custom validation rules
- Template overrides
- Multi-environment configurations

The CLI-built structure keeps you organized. Direct editing gives you full CUE power.

## Agent-Friendly Design Principles

Arbiter is built for AI assistants and automation from day one:

- **Non-Interactive Commands**: Every command works without prompts or user input. Perfect for scripting and agent workflows.
- **Structured Outputs**: JSON, NDJSON, and table formats. Parse and act on results programmatically.
- **Clear Next Steps**: Each command tells you what to do next. Agents stay on track without guessing.
- **Proper Exit Codes**: 0 for success, 1 for errors, 2 for configuration issues. Automation-friendly.
- **Incremental Building**: Start simple, add complexity step by step. No giant config files to wrangle.
- **Built-in Validation**: Invalid specs fail fast with clear error messages. No silent failures.

**For AI Agents**: Follow the CLI commands in order. The tool is designed to guide you through spec creation. If you get stuck, run `arbiter <command> --help` for detailed guidance.

## What You'll Find Here

- **Overview** – The mental model, core concepts, and why spec-driven development matters for agent-assisted workflows.
- **Guides** – Deep dives on template development, code-generation architecture, CUE authoring, GitHub sync, and operational best practices.
- **Reference** – Complete CLI command documentation, the Arbiter CUE schema, API surfaces, and generated TypeDoc from source.
- **Tutorials** – Hands-on labs (from `basics` to Kubernetes playbooks) designed for learning by doing.
