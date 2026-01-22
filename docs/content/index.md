---
id: intro
slug: /
title: Welcome to Arbiter
sidebar_position: 1
description: Agent-first CLI for collaborative, spec-driven development. Keep AI agents on rails with guided CUE specification workflows.
---

Arbiter will completely change how you build software with agents. It takes the core tenent of spec driven development--That spec should be the new level of abstraction, rather than code--and makes it robust.

Spec driven development seems like a great idea in theory, but when you try it you quickly realize that agents are pretty hit-or-miss about following specs and this behavior gets worse as the spec gets longer and more complicated. To make matters worse, markdown specs are tedious to review and they don't enforce any project structure. Because of this, spec driven development is good for bootstrapping small greenfield projects, but it falls over hard for larger and pre-existing projects.

In an ideal world, specs would be so good that if you deleted the source code you could re-create working software from the spec quickly. We're a long way from that, but Arbiter is my attempt to move us towards that goal. Arbiter uses structured specs with entities and metadata, and these specs are used to automatically generate scaffolding (code, tests, infrastructure, docs, etc) in a predictable, deterministic way. This saves a ton of tokens as agents don't have to manually generate all of it, it reduces errors, and software built from a spec has the same basic structure every time.

## How Does It Work?

Arbiter is a command line tool that agents can use to modify CUE spec files stored in a `.arbiter/` directory in your project root. Arbiter prompts agents through a lightweight specification workflow, adding elements to the spec one at a time via shell commands as you define them rather than waiting till the end of the specification process to write a markdown document.

Because these specs are structured, you can generate C4-style architecture and process diagrams from them and review those rather than having to go line by line through a 20 page markdown file. These diagrams make it easy for non-technical team members to contribute to the system design. Once you're satisfied with the spec,Arbiter can validate its correctness and generate scaffolding automatically. You don't have to wait for agents to create files and generate stubs, they're all generated according to preconfigured rules. Even better, Arbiter's code generation is fully customizable, so if you have organization or team specific practices you'd like the code to follow, it's easy to make Arbiter enforce them.

## Why CUE rather than JSON?

CUE comes with a much stronger validation and composition story than JSON schema. CUE can also represent complex constraints and type systems that would be unweildly or impossible in JSON schema. The downside is fewer options in terms of tooling.

## The Arbiter Philosophy

Unlike other spec driven development tools, Arbiter is focused on building a model of your software. Software architects have been doing this for decades, but the practice

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
- **Structured Outputs**: JSON and table formats. Parse and act on results programmatically.
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
