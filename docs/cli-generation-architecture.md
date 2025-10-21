# CLI Generation Architecture

Arbiter's CLI ships with a set of pluggable modules that handle project
scaffolding, GitHub issue template authoring, and language-specific code
generation. This document explains how these pieces fit together and how to
extend them for your own workflows.

## Template aliases & engines

Source: `packages/cli/src/templates/index.ts`

The `TemplateManager` exposes a low-level API that powers commands like
`arbiter add service --template <alias>`. Templates are defined in
`.arbiter/templates.json` (falling back to `~/.arbiter/templates.json` if the
project file is absent) and contain two top-level blocks:

```json
{
  "engines": {
    "cookiecutter": {
      "command": "cookiecutter",
      "defaultArgs": ["--no-input"],
      "timeout": 300000
    },
    "script": {
      "command": "sh",
      "defaultArgs": [],
      "timeout": 60000
    }
  },
  "aliases": {
    "bun-hono": {
      "engine": "cookiecutter",
      "source": "https://github.com/arbiter-templates/bun-hono.git",
      "description": "Bun + Hono API service with Drizzle ORM",
      "variables": {
        "project_name": "{{cookiecutter.serviceName}}"
      },
      "prerequisites": ["bun", "git"]
    }
  }
}
```

Key features:

- **Engines** describe how a template should be executed. The CLI ships with a
  `cookiecutter` engine and a `script` engine. Engines can optionally implement
  a `validate` hook and can set timeouts, default arguments, or prerequisites.
- **Aliases** provide clean names that reference engine + source pairs. When you
  run `arbiter add service api --template bun-hono`, the CLI loads this alias,
  verifies any prerequisites, merges in per-alias variables, and executes the
  template engine.
- **Variables** are extracted for you. `extractVariablesFromCue` parses the
  assembly CUE file for project, service, language, and port metadata so that
  your templates can reference values like `{{serviceName}}`, `{{language}}`,
  or `{{ports}}`.

### Writing a custom engine

Implement the `TemplateEngine` interface and register it with the shared
manager:

```typescript
import { templateManager, type TemplateEngine } from '@arbiter/cli/templates';

class NxEngine implements TemplateEngine {
  name = 'nx';
  command = 'npx';
  defaultArgs = ['create-nx-workspace@latest'];

  async execute(source: string, destination: string, variables: Record<string, any>) {
    await execCommand(this.command, [...this.defaultArgs, source, '--preset', 'apps', '--dir', destination], {
      env: {
        ...process.env,
        TEMPLATE_PROJECT: variables.projectName,
      },
    });
  }
}

templateManager.addEngine(new NxEngine());
```

After registering the engine you can add an alias that references `"engine":
"nx"` and run it through the standard CLI commands.

### Managing template aliases

There is no standalone `arbiter templates` command yet, so alias management is a
combination of editing `.arbiter/templates.json` and using the existing
workflows:

- `arbiter init --list-templates` shows the aliases available for project
  initialization.
- `arbiter add service <name> --template <alias>` applies a template to a
  specific service.
- `arbiter add database <name> --template <alias>` does the same for database
  modules.

## GitHub issue template system

Source: `packages/cli/src/utils/github-template-config.ts`,
`packages/cli/src/utils/file-based-template-manager.ts`,
`packages/cli/src/utils/unified-github-template-manager.ts`

Arbiter provides two complementary approaches for GitHub issue templates:

1. **Configuration-driven templates** through
   `ConfigurableTemplateManager`. Templates live inside
   `.arbiter/config.json` under `github.templates`. They support inheritance,
   validation rules, rich Handlebars sections, and repository-level settings.
2. **File-based templates** managed by `FileBasedTemplateManager`. Templates
   reside on disk (`.github/ISSUE_TEMPLATE/*.md.hbs`, etc.) and can inherit from
   one another using front-matter metadata.

`UnifiedGitHubTemplateManager` wraps both systems so higher-level commands can
consume either source seamlessly.

### Configuration example

`packages/cli/example-github-templates.json` shows a complete configuration:

```json
{
  "github": {
    "repository": { "owner": "my-org", "repo": "my-repo" },
    "templates": {
      "base": { "name": "custom-base", "sections": { "description": "..." } },
      "epic": {
        "inherits": "custom-base",
        "title": "[EPIC] [{{team}}] {{priority}}: {{name}}",
        "labels": ["epic", "priority:{{priority}}", "team:{{team}}"]
      }
    }
  }
}
```

Templates can specify:

- `sections` (simple strings or nested objects) rendered with Handlebars.
- `labels`, `assignees`, `projects`, or `milestone` metadata.
- Validation rules in `validation.fields` that are enforced when the CLI
  generates an issue.
- Repository settings such as `issueConfig` and default labels.

### CLI workflows

The `arbiter github-templates` command exposes common operations:

```
arbiter github-templates --list
arbiter github-templates --show epic
arbiter github-templates --validate
arbiter github-templates --generate --force
```

- `--list`/`--show` render the templates defined in configuration.
- `--validate` flags missing inheritance targets, invalid fields, or missing
  sections.
- `--generate` materializes the configuration into `.github/ISSUE_TEMPLATE`
  files. The command uses `FileBasedTemplateManager` by default so you can
  hand-edit the generated Markdown if needed.

When the CLI onboards repositories via `arbiter integrate --templates` or the
GitHub sync utilities, `UnifiedGitHubTemplateManager` decides whether to load a
file-backed template or a configuration-based one.

## Language plugin system

Source: `packages/cli/src/language-plugins/index.ts`

Language plugins power project scaffolding, per-language service generation, and
test automation. Each plugin implements the `LanguagePlugin` interface and is
registered with the global `registry`.

```typescript
import type {
  GenerationResult,
  LanguagePlugin,
  ProjectConfig,
  ServiceConfig,
} from '@arbiter/cli/language-plugins';
import { registerPlugin } from '@arbiter/cli/language-plugins';

class ElixirPlugin implements LanguagePlugin {
  readonly name = 'Phoenix Generator';
  readonly language = 'elixir';
  readonly version = '0.1.0';
  readonly description = 'Phoenix service scaffolding';
  readonly supportedFeatures = ['service', 'project', 'testing'];

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    return {
      files: [
        { path: 'mix.exs', content: phoenixMixFile(config) },
        { path: 'config/dev.exs', content: phoenixDevConfig(config) }
      ],
      dependencies: ['phoenix', 'ecto_sql'],
    };
  }

  async generateService(config: ServiceConfig): Promise<GenerationResult> {
    return {
      files: [
        {
          path: `lib/${config.name}_service.ex`,
          content: phoenixServiceModule(config),
        },
      ],
      instructions: ['Run mix deps.get', 'Run mix ecto.create'],
    };
  }
}

registerPlugin(new ElixirPlugin());
```

The registry already includes plugins for TypeScript, Python, Go, and Rust (see
`packages/cli/src/language-plugins/typescript.ts`, etc.). Plugins can opt into:

- Component generation (`generateComponent`) for frontend frameworks.
- Service/API generation (`generateService`) used by `arbiter generate`.
- Project bootstrapping (`initializeProject`).
- Build configuration (`generateBuildConfig`).
- Endpoint assertion generation (`generateEndpointTests`) for languages that
  support auto-generated HTTP tests.

### Configuring plugins

`.arbiter/config.json` can pass per-language options under
`generator.plugins.<language>`:

```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "testing": { "framework": "vitest", "outputDir": "tests/api" },
        "templateOverrides": {
          "service.class.ts.tpl": "./templates/service.class.ts.tpl"
        }
      }
    }
  }
}
```

The config module (`packages/cli/src/config.ts`) merges these values and calls
`registry.configure(language, options)` before invoking plugin methods. Custom
plugins can read the options through their `configure` hook.

### Discovering templates

The TypeScript plugin ships with ready-to-use templates in
`packages/cli/templates/typescript`. You can reuse them by pointing
`generator.templateOverrides` to your own versions or by requesting template
names from `plugin.getTemplates()`.

## Additional resources

- `packages/cli/TEMPLATE_SYSTEM.md` – deep dive into the alias/engine system.
- `packages/cli/example-templates.json` – starter alias configuration.
- `packages/cli/example-github-templates.json` – full GitHub template sample.
- `packages/cli/src/utils/github-sync.ts` – how templates feed into repository
  automation.
- `packages/cli/src/commands/add.ts` – where templates and language plugins are
  invoked during `arbiter add ...`.

These components give you full control over Arbiter’s generation pipeline. You
can plug in new engines, register additional language plugins, or override
GitHub templates without patching the core CLI.
