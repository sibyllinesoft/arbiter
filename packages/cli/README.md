# @sibyllinesoft/arbiter

> Spec-driven development CLI. Track work with tasks, persist context with notes, define architecture with CUE specs.

[![npm version](https://badge.fury.io/js/%40sibyllinesoft%2Farbiter.svg)](https://www.npmjs.com/package/@sibyllinesoft/arbiter)
[![License](https://img.shields.io/badge/license-SPL--1.0-blue.svg)](LICENSE)

## Overview

Arbiter is a CLI designed for spec-driven development workflows. It provides:

- **Tasks** - Track work items, issues, and features with persistent metadata
- **Notes** - Capture decisions, context, and knowledge that persists across sessions
- **CUE Specs** - Define architecture using CUE schemas for services, endpoints, schemas, and more

All data is stored in `.arbiter/` as Obsidian-compatible markdown files, making it both human-readable and AI-agent friendly.

## Installation

```bash
npm install -g @sibyllinesoft/arbiter
```

After installation, the `arbiter` command will be available globally.

## Quick Start

### Initialize a Project

```bash
arbiter init
```

This creates an `.arbiter/` directory with:
- `notes/` - Markdown notes with YAML frontmatter
- `tasks/` - Markdown tasks with YAML frontmatter
- CUE schema files for architecture definitions

### Track Work with Tasks

```bash
# Add a new task
arbiter add task

# List tasks
arbiter list task

# Filter tasks by status
arbiter list task --status open

# Filter by priority
arbiter list task --priority high
```

### Persist Context with Notes

```bash
# Add a note
arbiter add note

# List notes
arbiter list note

# Filter notes by tag
arbiter list note --tags architecture
```

### Define Architecture with Specs

For greenfield projects, define your architecture:

```bash
# Add a service
arbiter add service

# Add an endpoint
arbiter add endpoint

# Add a schema
arbiter add schema

# List all services
arbiter list service
```

## Workflow for AI Agents

Arbiter is designed as external memory for AI agents. The recommended workflow:

1. **Start work**: Create a task describing what you're building
2. **Capture decisions**: Add notes for architectural decisions, trade-offs, and context
3. **Track progress**: Update task status as you work
4. **Complete work**: Mark tasks done, notes persist as knowledge base

```bash
# Agent workflow example
arbiter init
arbiter add task        # "Implement user authentication"
arbiter add note        # "Decision: Using JWT with refresh tokens because..."
# ... do the work ...
arbiter list task       # Check current tasks
```

## Core Commands

### Project Management

| Command | Description |
|---------|-------------|
| `arbiter init` | Initialize arbiter in current directory |
| `arbiter list <type>` | List entities (task, note, service, etc.) |
| `arbiter add <type>` | Add a new entity |

### Task Management

| Command | Description |
|---------|-------------|
| `arbiter add task` | Create a new task |
| `arbiter list task` | List all tasks |
| `arbiter list task --status open` | Filter by status |
| `arbiter list task --priority high` | Filter by priority |

### Notes

| Command | Description |
|---------|-------------|
| `arbiter add note` | Create a new note |
| `arbiter list note` | List all notes |
| `arbiter list note --tags <tag>` | Filter by tag |

### Architecture Specs

| Command | Description |
|---------|-------------|
| `arbiter add service` | Define a service |
| `arbiter add endpoint` | Define an API endpoint |
| `arbiter add schema` | Define a data schema |
| `arbiter add group` | Create a milestone/epic |

## File Format

Tasks and notes are stored as Obsidian-compatible markdown with YAML frontmatter:

### Task Example

```markdown
---
id: t-abc123
type: feature
status: in_progress
priority: high
assignees: [user1]
labels: [auth, backend]
created: 2024-01-15T10:00:00Z
---

Implement JWT authentication for the API service.

## Acceptance Criteria
- [ ] Token generation endpoint
- [ ] Token validation middleware
- [ ] Refresh token flow
```

### Note Example

```markdown
---
id: n-xyz789
target: auth-service
targetType: service
tags: [architecture, security]
created: 2024-01-15T10:00:00Z
---

Decided to use JWT with RS256 signing because:
1. Stateless authentication scales better
2. RS256 allows public key verification
3. Refresh tokens handle expiration gracefully
```

## Configuration

Project configuration in `.arbiter/config.json`:

```json
{
  "apiUrl": "http://localhost:5050",
  "format": "table"
}
```

Global configuration in `~/.arbiter/config.json`.

## Requirements

- Node.js >= 18.0.0
- CUE (optional, for advanced validation)

## Development

```bash
git clone https://github.com/sibyllinesoft/arbiter.git
cd arbiter/packages/cli

bun install
bun run build
bun test
```

## License

LicenseRef-SPL-1.0

## Author

Nathan Rice

## Support

- [Report Issues](https://github.com/sibyllinesoft/arbiter/issues)
- [Documentation](https://sibylline.dev/arbiter/)
