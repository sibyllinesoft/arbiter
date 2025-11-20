# Arbiter Code Generation Configuration Recipes

The authoritative list of options lives in the generated TypeDoc for `CLIConfig`. Instead of duplicating the schema here, use this page as a set of working recipes and follow the TypeDoc for the full option catalog.

- **Source of truth:** [`CLIConfig` TypeDoc](../reference/api/tsdoc/cli/src/interfaces/CLIConfig.md)
- **Shape guarantees:** The docs are generated directly from `packages/cli/src/types.ts`; rebuild with `bun run docs:tsdoc` after code changes.

## Where the CLI looks for config
1. `.arbiter/config.json` in the current or parent directories
2. `$HOME/.arbiter/config.json`
3. Environment overrides (e.g., `ARBITER_URL`, `ARBITER_VERBOSE`)
4. CLI flags (`--api-url`, `--timeout`, `--project-dir`, `--local`)

## Defaults you can rely on
Project structure (from `DEFAULT_PROJECT_STRUCTURE` in the CLI):

```json
{
  "clientsDirectory": "clients",
  "servicesDirectory": "services",
  "packagesDirectory": "packages",
  "toolsDirectory": "tools",
  "docsDirectory": "docs",
  "testsDirectory": "tests",
  "infraDirectory": "infra",
  "packageRelative": {
    "docsDirectory": false,
    "testsDirectory": false,
    "infraDirectory": false
  }
}
```

## Recipes

### 1) Monorepo-friendly base config
```json
{
  "projectDir": ".",
  "projectStructure": {
    "clientsDirectory": "apps",
    "servicesDirectory": "services",
    "packagesDirectory": "packages",
    "testsDirectory": "tests",
    "packageRelative": { "testsDirectory": true }
  },
  "generator": {
    "plugins": {
      "typescript": {
        "framework": "next",
        "testing": { "framework": "vitest", "outputDir": "tests" },
        "packageManager": "bun"
      },
      "python": { "framework": "fastapi", "testing": { "framework": "pytest" } }
    }
  }
}
```
- Plugin-owned testing config is now flattened under `generator.plugins.<language>.testing`.
- Use `generator.testing.master` only for the cross-language runner settings (see recipe 4).

### 2) Template override recipes
```json
{
  "generator": {
    "templateOverrides": {
      "typescript": ["./templates/ts", "../shared-templates/ts"],
      "python": "../python-templates"
    },
    "hooks": {
      "before:generate": "pnpm lint",
      "after:fileWrite": "prettier --write {{file}}"
    }
  }
}
```
- Overrides accept a string or array per language; paths are resolved relative to the loaded config file.

### 3) GitHub sync (simplified keys)
```json
{
  "github": {
    "repository": { "owner": "your-org", "repo": "your-repo" },
    "prefixes": { "epic": "[Epic]", "task": "[Task]" },
    "labels": {
      "default": ["arbiter"],
      "epics": { "critical": ["priority:critical"] },
      "tasks": { "bug": ["type:bug"] }
    },
    "automation": {
      "createMilestones": true,
      "autoClose": true,
      "syncAcceptanceCriteria": true,
      "syncAssignees": false
    }
  }
}
```
- The old `mapping`/`behavior` blocks are gone; prefixes/labels/automation match the runtime shape in `GitHubSyncConfig`.

### 4) Master test runner
```json
{
  "generator": {
    "testing": {
      "master": {
        "type": "node",
        "output": "tests/run-all.mjs"
      }
    }
  }
}
```
- Language-specific test runners stay in `generator.plugins.<language>.testing`.
- The master runner just stitches per-language commands together.

### 5) Environment + CLI overrides (quick reference)
- `ARBITER_URL` or `ARBITER_API_URL` → overrides `apiUrl`
- `ARBITER_VERBOSE` / `ARBITER_FETCH_DEBUG` → forces `verbose=true`
- CLI flags like `--project-dir`, `--timeout`, `--local` map directly to their `CLIConfig` counterparts.

## When to regenerate docs
If you change any config types in `packages/cli/src/types.ts`, regenerate the API docs so the UI and guide stay in sync:

```bash
bun run docs:tsdoc
```
