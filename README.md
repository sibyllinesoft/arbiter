# Arbiter Platform

Arbiter turns declarative specifications into production-ready tooling. This
monorepo brings together the CLI, importer, API handlers, and supporting
packages that collaborate to analyse existing systems, capture intent in CUE,
and generate consistent project artefacts.

## Why Arbiter?

- **Specification Driven** – Define architecture once and keep generated code,
  documentation, and workflows in lockstep.
- **Brownfield Friendly** – Importer plugins scan existing repositories to
  bootstrap specs from real projects.
- **Extensible Tooling** – Language plugins, template overrides, and
  configuration hooks let teams evolve the platform alongside their stack.
- **Production Awareness** – Integrations with GitHub, container ecosystems, and
  infrastructure manifests help span the full lifecycle.

## Repository Layout

```
apps/                Frontend and API applications
packages/cli/        Arbiter CLI for specification authoring and scaffolding
packages/importer/   Brownfield detection pipeline and plugins
packages/shared/     Shared utilities and type definitions
packages/shared-types API/CLI contract types
handlers/            Runtime handlers for automated workflows
scripts/             Utility scripts for local development and CI
```

Each package ships its own README with deeper details and TSDoc annotated
sources for IDE discovery.

## Quick Start

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Bootstrap the workspace**
   ```bash
   pnpm build
   ```
3. **Launch the development stack** (API + client)
   ```bash
   pnpm dev
   ```
4. **Run the CLI**
   ```bash
   pnpm --filter @arbiter/cli exec -- node src/cli.ts --help
   ```

## Development Workflow

- `pnpm lint` – Static analysis and formatting checks
- `pnpm test --filter <target>` – Run package-specific tests
- `pnpm build` – Compile TypeScript packages
- `pnpm changeset` – Stage release notes when contributing upstream

The repository uses Turbo + pnpm workspaces, so commands automatically inherit
correct dependency ordering.

## Key Components

### CLI (`packages/cli/`)

Powerful command runner for generating artefacts, validating specs, and syncing
work items. Designed for both terminal usage and programmatic embedding.

### Importer (`packages/importer/`)

Plugin-based scanner that analyses existing repositories. Emits
`ArtifactManifest` outputs with evidence, provenance, and confidence scoring to
drive specification generation.

### Apps (`apps/`)

User interface and API handlers that surface architecture diagrams, project
insights, and integration endpoints. The client consumes the same shared types
as the CLI for consistency.

## Documentation & TSDoc

Core TypeScript modules ship with TSDoc comments. IDEs can surface guidance, and
`pnpm doc` can generate API references if desired. See package READMEs for
focused deep dives.

## Contributing

1. Fork and clone the repository
2. Create a feature branch and make changes with thorough tests
3. Run `pnpm lint && pnpm test`
4. Submit a pull request describing the problem solved, implementation approach,
   and validation steps

## License

This project is released under the MIT License. See `LICENSE` for details.
