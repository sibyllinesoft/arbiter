# Arbiter CLI

The Arbiter CLI wraps daily workflows for working with Arbiter specifications.
It provides commands for validating fragments, generating scaffolding,
synchronising project plans to GitHub, and interacting with the Spec Workbench
API without leaving a terminal session.

## Features

- Fast validation and IR (intermediate representation) retrieval against the
  Spec Workbench API
- Deterministic artifact generation driven by language plugins and templates
- Epic and task orchestration with sharded CUE storage helpers
- GitHub synchronisation utilities and template management
- Extensible configuration supporting project-specific hooks and UI options

## Installation

```bash
pnpm install
pnpm build
```

The bundled `bin/arbiter.js` entry point can be invoked directly after building.
When developing locally it is often convenient to run commands via
`pnpm --filter @arbiter/cli exec --` so that the TypeScript sources are used
without an additional build step.

## Core Concepts

### Program Entry

The executable defined in `src/cli/index.ts` wires together the Commander-based
command registry. Programmatic consumers can import the `program` export from
`src/index.ts` to mount the CLI inside existing Node.js processes.

### API Client

`src/api-client.ts` exposes the `ApiClient` class, a rate-limited helper that
wraps calls to the Spec Workbench API. It enforces the product constraints
around payload size, request cadence, and network timeouts so downstream
commands do not need to repeat that logic.

### Configuration

Configuration is resolved via `src/config.ts`. The loader merges default values,
project-local overrides, and UI option catalog data sourced from
`@arbiter/shared`. Hooks and generator overrides can be configured through this
module when extending the CLI.

### Sharded Storage

Long-lived epics and tasks are stored using helper utilities in
`src/utils/sharded-storage.ts`. The module writes and reads shards so that large
plans are split across manageable CUE files. Documentation in the source covers
how manifests are initialised and updated.

### GitHub Synchronisation

The utilities in `src/utils/github-sync.ts` and
`src/utils/unified-github-template-manager.ts` orchestrate syncing project work
items to GitHub issues or pull requests. They leverage the shared template
system and surface preview/diff experiences before executing remote mutations.

## Repository Layout

```
src/
  api-client.ts           # REST client obeying platform constraints
  cli/                    # Commander program composition
  commands/               # Individual command implementations
  config.ts               # CLI configuration resolution and schema validation
  templates/              # Built-in code generation templates
  utils/                  # Shared helpers (storage, GitHub integration, formatting)
```

## Development Workflow

1. Install dependencies and build shared packages: `pnpm install`
2. Execute CLI commands in watch mode:
   ```bash
   pnpm --filter @arbiter/cli exec -- node src/cli.ts <command>
   ```
3. Run the test suite: `pnpm test --filter @arbiter/cli`
4. Before contributing, lint and format sources with `pnpm lint` and `pnpm fmt`
   to match repository guidelines.

## Documentation

The CLI sources now include TSDoc annotations for key modules, enabling
generated API documentation and improving editor IntelliSense. Read through the
headers of `src/types.ts`, `src/api-client.ts`, and the utilities in `src/utils`
to understand extension points and architectural decisions.
