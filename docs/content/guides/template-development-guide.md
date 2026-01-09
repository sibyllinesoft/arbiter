# Template Development Guide

This guide covers how to create, customize, and maintain templates for Arbiter's code generation system.

## Table of Contents

- [Template System Overview](#template-system-overview)
- [Creating Custom Templates](#creating-custom-templates)
- [Template Syntax and Variables](#template-syntax-and-variables)
- [Template Organization](#template-organization)
- [Context Data Reference](#context-data-reference)
- [Template Inheritance](#template-inheritance)
- [Testing Templates](#testing-templates)
- [Best Practices](#best-practices)

## Template System Overview

Arbiter's template system is designed to transform CUE specifications into production-ready code across multiple languages and frameworks. The system supports:

- **Multiple Template Implementors** - Handlebars, Liquid, and custom implementors
- **Override Hierarchies** - Custom templates override defaults
- **Rich Context Data** - Comprehensive data from CUE specifications
- **Template Inheritance** - Shared partials and layouts
- **Dynamic Resolution** - Runtime template selection

The “implementor” abstraction is simply a command invocation. When Arbiter needs to render a template it serializes the context to JSON and pipes it into the implementor command you registered. The command can be anything you want—`bunx handlebars`, `python render.py`, `cookiecutter`, or a compiled binary. Whatever the command writes to stdout becomes the generated artifact, so you can bring virtually any templating technology without writing TypeScript.

Built-in helpers (like the cookiecutter integrations used by some stock templates) consume the same interface internally. They call the underlying library directly for speed, but they still accept the `{command, args, context}` shape that external implementors see. That means the alias you register for a first-party template is structurally identical to the alias you would register for your own implementor.

Example `.arbiter/templates.json` entry that shells out to a local script:

```json
{
  "implementors": {
    "my-templates": {
      "command": "python",
      "defaultArgs": ["templates/render.py"],
      "timeout": 120000
    }
  },
  "aliases": {
    "orders-fastapi": {
      "implementor": "my-templates",
      "source": "./templates/orders"
    }
  }
}
```

Every call to `orders-fastapi` now receives the Arbiter context on stdin, and your script can emit any content it likes.

### Template Architecture

```mermaid
flowchart LR
    cue[CUE Spec]
    ctx[Context Extraction<br/>Assembly.cue + variables/metadata]
    select[Template Selection<br/>Override dir → Default dir]
    process[Template Processing<br/>Registered implementor command<br/>(Handlebars, Liquid, cookiecutter, etc.)]
    out[Generated Code]

    cue --> ctx --> select --> process --> out
    out --> src[Source files]
    out --> cfg[Config files]
    out --> docs[Documentation]
```

## Creating Custom Templates

### Directory Structure (keep it small)

```
templates/
  typescript/
    service/
      main.ts.hbs
      partials/
        response.hbs
  python/
    service/
      main.py.hbs
```

- Mirror the shape of the code you want to emit; shallow trees are easier to reason about.
- Name dynamic files with Handlebars expressions (e.g., `{{serviceName}}.ts.hbs`).
- Register implementors and aliases in `.arbiter/templates.json` as shown above so Arbiter knows which command to run for each template set.

### Minimal service template example

```handlebars
{{!-- templates/typescript/service/main.ts.hbs --}}
import express from 'express';
{{#if auth}}import { authenticate } from './auth';{{/if}}

const app = express();
{{#each endpoints}}
app.{{ this.method }}('{{ this.path }}', {{#if ../auth}}authenticate, {{/if}}(req, res) => {
  res.json({ ok: true });
});
{{/each}}

export default app;
```

## Template Syntax and Variables

Handlebars basics you’ll use most often:

- Interpolation: `{{ serviceName }}` (escaped) or `{{{ jsonBlob }}}` (unescaped JSON).
- Conditionals: `{{#if auth}}...{{/if}}`, `{{#unless testing}}...{{/unless}}`.
- Loops: `{{#each endpoints}}app.{{this.method}}('{{this.path}}'){{/each}}`.
- Arbiter helpers: casing helpers (`camelCase`, `kebabCase`, `pascalCase`), `default`, and simple type checks (`isString`, `isArray`).

Recommended references (authoritative and exhaustive):
- [Handlebars.js Guide](https://handlebarsjs.com/guide/)
- [Expressions & Context](https://handlebarsjs.com/guide/expressions.html)
- [Built-in Helpers](https://handlebarsjs.com/guide/builtin-helpers.html)
- [Partials](https://handlebarsjs.com/guide/partials.html)

## Template Organization

Keep shared fragments in one place and keep templates short.

- **Partials** live in `partials/` and are pulled in with `{{>name}}`.
- **Layouts** (via `extend`/`block` helpers) let you define a shell once and swap sections.

Examples:

```handlebars
{{!-- partials/response.hbs --}}
res.status({{status | default 200}}).json({{payload}});
```

```handlebars
{{!-- main.ts.hbs --}}
{{#each endpoints}}
app.{{this.method}}('{{this.path}}', (req, res) => {
  {{>response payload="{ ok: true }"}}
});
{{/each}}
```

```handlebars
{{!-- layouts/service.hbs --}}
{{#block "imports"}}import express from 'express';{{/block}}
{{#block "body"}}{{/block}}
```

```handlebars
{{!-- api.hbs --}}
{{#extend "layouts/service"}}
  {{#block "body"}}
  app.get('/health', (_req, res) => res.send('ok'));
  {{/block}}
{{/extend}}
```

## Context Data Reference

Templates receive the exact JSON produced by `buildTemplateContext` in `packages/cli/src/templates/index.ts`. Here is a real sample (generated from the demo assembly and pointing at the `orders` service):

```json
{
  "project": {
    "product": { "name": "storefront", "version": "0.1.0" },
    "services": {
      "orders": {
        "language": "typescript",
        "serviceType": "api",
        "routes": [{ "method": "get", "path": "/orders" }],
        "database": { "type": "postgres" }
      }
    }
  },
  "parent": {
    "orders": {
      "language": "typescript",
      "serviceType": "api",
      "routes": [{ "method": "get", "path": "/orders" }],
      "database": { "type": "postgres" }
    }
  },
  "artifact": {
    "name": "orders",
    "language": "typescript",
    "serviceType": "api",
    "routes": [{ "method": "get", "path": "/orders" }],
    "database": { "type": "postgres" }
  },
  "impl": {
    "alias": "ts-fastify",
    "source": "./templates/typescript/service"
  }
}
```

- `project` is the full parsed CUE document.
- `parent` is the container map that held the artifact (e.g., `services.orders`).
- `artifact` is the specific node selected via `artifactName` (plus a `name` field injected for convenience).
- `impl` echoes whatever you passed to the template orchestrator (usually the alias metadata).

Use this JSON as the canonical variable map inside Handlebars or any other implementor; there is no hidden mutation layer.

### Endpoint and component shapes (quick view)

- Endpoints generally include `method`, `path`, optional `description`, `auth`, `validation`, `responses`, and optional `database` details.
- Components include `componentName`, `type`, props/state/hooks, styling hints, and testing metadata (`testId`, fixtures).

Inspect the live context by logging it from your implementor or by running Arbiter with `--dry-run --debug`.

Common nested access patterns:
```handlebars
{{ endpoints.[0].path }}
{{#each endpoints}}Route {{@index}}: {{method}} {{path}}{{/each}}
{{ database.config.host }}
```

## Template Inheritance

Use layouts to share a skeleton and override only what you need.

```handlebars
{{!-- layouts/service.hbs --}}
{{#block "imports"}}import express from 'express';{{/block}}
{{#block "routes"}}{{/block}}
```

```handlebars
{{!-- service/api.hbs --}}
{{#extend "layouts/service"}}
  {{#block "imports"}}{{#parent}}{{/parent}}import helmet from 'helmet';{{/block}}
  {{#block "routes"}}
    app.get('/health', (_req, res) => res.send('ok'));
  {{/block}}
{{/extend}}
```

## Testing Templates

Lightweight checks keep templates stable:

- Co-locate fixtures in `__tests__/fixtures/` beside the template.
- Use `TemplateResolver` (from `@sibyllinesoft/arbiter-cli`) to render a template with a small JSON context and assert on key strings.
- Add one integration test that runs `generateCommand` against a tiny demo assembly to confirm wiring and file paths.
- Snapshot tests are great for big outputs; prefer focused string assertions for small ones.

## Best Practices

- Keep templates skinny; push heavy logic into the context builder.
- Prefer partials and layouts over copy/paste; name blocks and files descriptively.
- Provide sensible defaults with `default` and guard optional fields with `if`.
- Version template sets and note breaking changes in `CHANGELOG.md` or template README.
- Add a couple of unit assertions and one integration test per template family.
- When things fail, print the template name and key context bits in the error.
