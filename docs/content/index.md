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

## Three Workflows, One Tool

Arbiter adapts to your situation with three complementary workflows:

### 🚀 Quick Start: Preset + Customize

**Best for:** Rapid prototyping, standard patterns, getting started fast

Start with a preset that matches your use case, then customize with incremental `arbiter add` commands:

```bash
# Initialize from preset
arbiter init my-app --preset web-app

# Customize the spec
arbiter add service api --language typescript --port 3000
arbiter add database postgres --engine postgresql
arbiter add endpoint /users --method GET

# Generate and go
arbiter generate
```

**When to use:**
- Building standard architectures (web apps, APIs, microservices)
- Prototyping new ideas quickly
- Learning Arbiter's conventions
- Onboarding new team members

### 🎯 Structured Planning: plan/design Workflow

**Best for:** New features, team collaboration, AI-assisted development

Follow a guided two-phase process that separates **what to build** from **how to build it**:

```bash
# Phase 1: Define WHAT to build (feature intent)
arbiter plan
# → Outputs planning prompt for AI assistant
# → Captures problem, users, outcomes, scope, flows, success criteria

# Phase 2: Define HOW to build (technical design)
arbiter design
# → Outputs design prompt for AI assistant
# → Records decisions using `arbiter add` as you go:
arbiter add design.approach "New API endpoint on service X..."
arbiter add design.component "Name: OrderValidator; Responsibility: ..."
arbiter add design.data_model "orders table: add status column..."

# Phase 3: Generate implementation
arbiter generate
```

**When to use:**
- Building complex features that need team alignment
- Working with AI assistants on architectural decisions
- Documenting design decisions for future reference
- Onboarding developers to unfamiliar domains

**Why it works:**
- Clear separation of WHAT vs HOW keeps conversations focused
- AI assistants stay on track with structured prompts
- Design decisions are captured incrementally, not as an afterthought
- The spec becomes living documentation of intent and architecture

### 📦 Brownfield Import

**Best for:** Existing codebases, legacy system documentation, detailed external specifications

Arbiter has built-in static analysis to introspect existing projects, or you can use external tools for heavyweight specification processes:

**Option A: Built-in Static Analysis (Recommended)**

Arbiter introspects your existing codebase to detect services, dependencies, and architecture:

```bash
# Import existing project through GitHub
arbiter init --github-url https://github.com/org/my-project

# Or import local directory
arbiter init --local-path ../my-existing-project

# Arbiter's importer detects:
# - Services with manifests (package.json, Cargo.toml, go.mod, pyproject.toml)
# - Dependencies and frameworks
# - Build tools and binaries
# - Docker configurations

# Customize the imported spec
arbiter add endpoint /new-api --service api --method POST
arbiter generate
```

**Option B: External Tool Integration**

For heavyweight specification processes with extensive deliberation, use tools like speckit or bmad to create detailed specs, then translate to Arbiter:

```bash
# Create comprehensive spec with external tool
speckit analyze ./my-project --deep-analysis > spec.json

# Review and translate to arbiter add commands (with AI assistance)
cat spec.json
arbiter init my-project
arbiter add service api --language typescript --port 3000
# ... translate remaining spec decisions

arbiter generate
```

**When to use:**
- **Built-in import:** Quick brownfield onboarding, automatic service detection
- **External tools:** Heavyweight specs after team deliberation, detailed architectural documentation

**Note:** Arbiter's importer supports Node.js, Rust, Python, Go, Docker, and Kubernetes out of the box. External tools are for cases requiring extensive upfront design work beyond what introspection provides.

### Choosing Your Workflow

| Workflow | Time | Planning | Best For |
|----------|------|----------|----------|
| **Preset + Customize** | Low | Minimal | Prototypes, standard patterns |
| **plan/design** | Medium | Structured | Complex features, team projects |
| **Brownfield Import** | Low-Variable | Introspection or Translation | Existing codebases, migrations |

**Mix and match:** Start with a preset for greenfield projects, use plan/design for new features, import brownfield codebases with static analysis, or translate heavyweight external specs. All workflows produce the same validated CUE specs.

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/arbiter/arbiter.git && cd arbiter
bun install  # or npm install

# Start the API server (required for validation and generation)
bun run dev  # Starts API on http://localhost:5050
```

### Your First Project

Choose one of the three workflows above based on your needs:

- **New greenfield project?** Start with "Preset + Customize" for the fastest path
- **Complex feature or team project?** Use "plan/design" for structured development
- **Existing codebase?** Use "Brownfield Import" with built-in static analysis, or translate heavyweight external specs

Once you've chosen your workflow, the CLI guides you through the rest with clear next steps and automatic validation.

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
- **Guided Prompts for Planning**: `arbiter plan` and `arbiter design` output structured prompts that keep AI assistants focused on WHAT vs HOW, preventing scope creep and ensuring decisions get captured.

**For AI Agents**: Use `arbiter plan` and `arbiter design` for structured feature development. The tool outputs prompts specifically designed to guide you through planning (WHAT) and design (HOW) phases. Follow the CLI commands in order, and run `arbiter <command> --help` for detailed guidance.

## What You'll Find Here

- **Overview** – The mental model, core concepts, and why spec-driven development matters for agent-assisted workflows.
- **Guides** – Deep dives on template development, code-generation architecture, CUE authoring, GitHub sync, and operational best practices.
- **Reference** – Complete CLI command documentation, the Arbiter CUE schema, API surfaces, and generated TypeDoc from source.
- **Tutorials** – Hands-on labs (from `basics` to Kubernetes playbooks) designed for learning by doing.
