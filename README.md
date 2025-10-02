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

## OAuth Setup & Testing

Many workflows require exercising the OAuth flow repeatedly when iterating on
the CLI or API. The repository ships a complete dev loop that includes a local
OIDC provider, preconfigured server settings, and CLI helpers.

### 1. Launch the full OAuth stack

```bash
bun run dev:full:oauth
```

This single command runs four processes:

- Type-checker in watch mode
- A lightweight OAuth server (`scripts/dev-oauth-server.ts`) on
  `http://localhost:4571`
- The API with `apps/api/config.dev-oauth.json` (auth required, OAuth enabled)
- The web client, pointed at `http://localhost:5050`

Environment overrides:

- `ARBITER_CONFIG_PATH` loads the API config with OAuth defaults.
- `ARBITER_URL` / `VITE_API_URL` ensure the client and CLI target the same API.
- The OAuth server accepts overrides via `OAUTH_DEV_*` variables if you need to
  test different client IDs, ports, or redirect URIs.

### 2. Configure the CLI endpoint

The CLI resolves the API URL in the following order: `ARBITER_URL` env var,
`--arbiter-url/--api-url` flag, `arbiter_url` (or `apiUrl`) in
`.arbiter/config.*`.

Example YAML config:

```yaml
arbiter_url: http://localhost:5050
timeout: 750
```

### 3. Authenticate the CLI

Once `dev:full:oauth` is running:

```bash
arbiter auth
```

Steps:

1. The command prints an authorization URL from the local OAuth server.
2. Open it in a browser, approve access, and copy the displayed code.
3. Paste the code back into the CLI prompt.

Tokens are cached in `~/.arbiter/auth.json`. Re-run `arbiter auth` any time you
want to refresh credentials, or `arbiter auth --logout` to clear the cache.

### 4. Inspect metadata

The API exposes discovery information at
`http://localhost:5050/api/auth/metadata`. Useful for verifying the client ID,
scopes, or endpoints consumed by external tools.

### 5. Common reset checklist

- Restart `dev:full:oauth` after changing OAuth environment variables.
- Delete `~/.arbiter/auth.json` (or run `arbiter auth --logout`) if scopes or
  tokens look stale.
- Regenerate CLI config with the correct `arbiter_url` before running commands.

Following these steps keeps local OAuth iterations quick and reproducible.

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
