# Arbiter Template System

A pluggable template system with clean alias configuration that keeps ugly
implementation details separate from CUE specifications.

## Overview

The Arbiter template system provides:

1. **Clean CUE Specs** - Only simple alias names like `"bun-hono"` in your
   specifications
2. **External Configuration** - Template details stored in
   `.arbiter/templates.json`
3. **Pluggable Implementors** - Support for cookiecutter, custom scripts, and more
4. **Variable Extraction** - Automatic mapping of CUE data to template variables
5. **Template Management** - Full CLI for managing template aliases

## Quick Start

### 1. Initialize Template Configuration

```bash
# List available templates (creates default config if none exists)
arbiter templates list
```

### 2. Add a Template Alias

```bash
# Add a cookiecutter template
arbiter templates add bun-hono \
  --source "https://github.com/arbiter-templates/bun-hono.git" \
  --description "Bun + Hono API service with Drizzle ORM" \
  --implementor cookiecutter

# Add a script-based template
arbiter templates add simple-service \
  --source "./scripts/simple-service-template.sh" \
  --description "Simple TypeScript service template" \
  --implementor script
```

### 3. Use Templates in Your Specifications

```cue
// arbiter.assembly.cue
services: {
  api: {
    template: "bun-hono"  // Clean alias reference
    serviceType: "bespoke"
    language: "typescript"
    port: 3000
  }
}
```

### 4. Generate Code with Templates

```bash
# Add service using template
arbiter add service api --template bun-hono

# Add database with template
arbiter add database main --template postgres-setup --attach-to api
```

## Configuration Format

The template configuration is stored in `.arbiter/templates.json`:

```json
{
  "implementors": {
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
      "implementor": "cookiecutter",
      "source": "https://github.com/arbiter-templates/bun-hono.git",
      "description": "Bun + Hono API service with Drizzle ORM",
      "variables": {
        "project_name": "{{cookiecutter.serviceName}}",
        "use_typescript": true
      },
      "prerequisites": ["bun", "git"]
    }
  },
  "settings": {
    "defaultImplementor": "cookiecutter",
    "cacheDir": "~/.arbiter/template-cache",
    "timeout": 300000
  }
}
```

## Template Implementors

### Cookiecutter Implementor

The default implementor for most templates. Supports:

- Git repositories (GitHub, GitLab, etc.)
- Local directories
- ZIP archives
- Variable substitution

**Example:**

```bash
arbiter templates add react-app \
  --source "gh:cookiecutter/cookiecutter-react-component" \
  --implementor cookiecutter
```

### Script Implementor

For simple shell-based templates:

**Example:**

```bash
arbiter templates add custom-service \
  --source "./scripts/create-service.sh" \
  --implementor script
```

Script templates receive variables as environment variables:

- `TEMPLATE_DESTINATION` - Target directory
- `TEMPLATE_SERVICENAME` - Service name
- `TEMPLATE_PROJECTNAME` - Project name
- `TEMPLATE_*` - Other variables prefixed with `TEMPLATE_`

### Custom Implementors

You can create custom implementors by implementing the `TemplateImplementor` interface:

```typescript
import { TemplateImplementor } from './templates/index.js';

class MyCustomImplementor implements TemplateImplementor {
  name = 'custom';
  command = 'my-generator';
  defaultArgs = ['--quiet'];

  async execute(
    source: string,
    destination: string,
    variables: Record<string, any>
  ): Promise<void> {
    // Your implementation
  }
}

// Register the implementor
templateOrchestrator.addImplementor(new MyCustomImplementor());
```

## Variable Extraction

The system automatically extracts variables from CUE specifications:

```cue
package myproject

services: {
  api: {
    template: "bun-hono"
    serviceType: "bespoke"
    language: "typescript"
    ports: [{ name: "http", port: 3000 }]
  }
}
```

Extracted variables:

```json
{
  "projectName": "myproject",
  "serviceName": "api",
  "serviceType": "bespoke",
  "language": "typescript",
  "ports": [3000]
}
```

## CLI Commands

### Template Management

```bash
# List all template aliases
arbiter templates list

# Show template details
arbiter templates show bun-hono

# Add new template alias
arbiter templates add my-template \
  --source "https://github.com/user/template.git" \
  --description "My custom template" \
  --implementor cookiecutter \
  --prerequisites "node,npm"

# Remove template alias
arbiter templates remove my-template

# Update/reload configuration
arbiter templates update
```

### Using Templates

```bash
# Add service with template
arbiter add service api --template bun-hono

# Add database with template
arbiter add database main --template postgres-setup

# All add commands support --template option
arbiter add service api --template bun-hono --port 3000 --language typescript
```

## Template Development

### Creating Cookiecutter Templates

1. Create a template repository with cookiecutter structure:

```
my-template/
├── cookiecutter.json
├── {{cookiecutter.project_name}}/
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   └── README.md
└── hooks/
    └── post_gen_project.py
```

2. Define variables in `cookiecutter.json`:

```json
{
  "project_name": "my-service",
  "use_typescript": true,
  "port": 3000,
  "database": ["none", "postgres", "mysql"]
}
```

3. Add to Arbiter:

```bash
arbiter templates add my-template \
  --source "https://github.com/user/my-template.git" \
  --description "My custom service template"
```

### Creating Script Templates

1. Create a shell script that generates files:

```bash
#!/bin/bash
# Create service structure based on environment variables
mkdir -p "$TEMPLATE_DESTINATION/src"
# Generate files using template variables...
```

2. Add to Arbiter:

```bash
arbiter templates add my-script \
  --source "./scripts/my-template.sh" \
  --implementor script
```

## Language Plugin Templates & Overrides

Arbiter now ships language-aware templates alongside the alias-based system.
Default templates live inside the CLI package under `templates/<language>/…` and
are used by the language plugins (TypeScript, Python, Go, Rust) when
`initializeProject`, `generateComponent`, or `generateService` are invoked.

### Project-Level Overrides

You can override any of these templates on a per-project basis without forking
the CLI. Add a `generator.templateOverrides` section to `.arbiter/config.json`
that points to a directory containing files that mirror the default layout:

```json
{
  "generator": {
    "templateOverrides": {
      "typescript": "./.arbiter/templates/typescript"
    }
  }
}
```

When present, Arbiter searches override directories first and falls back to the
bundled defaults. For example, dropping a custom `component.tsx.tpl` in
`./.arbiter/templates/typescript` changes every generated component for that
project. Each override file is rendered with the same context data as the
built-in template (e.g., `componentName`, `propsInterface`, etc.).

### Configuring Language Plugins

Language plugins now support runtime configuration controlled from
`.arbiter/config.json`:

```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "framework": "nextjs",
        "styling": "styled-components",
        "stateManagement": "zustand"
      }
    }
  }
}
```

These options allow a single plugin to support multiple stacks (e.g., Vite vs.
Next.js). Plugins that do not understand a specific option simply ignore it.

## Generation Lifecycle Hooks

Code generation can now run custom shell commands at key points in the lifecycle
via `generator.hooks`:

```json
{
  "generator": {
    "hooks": {
      "before:generate": "npm run lint:config",
      "after:generate": "npm install && npx prettier --write .",
      "before:fileWrite": "node scripts/transform.js",
      "after:fileWrite": "./scripts/add-license.sh"
    }
  }
}
```

Hook commands run with these environment variables:

- `ARBITER_HOOK_EVENT`: one of `before:generate`, `after:generate`,
  `before:fileWrite`, `after:fileWrite`
- `ARBITER_WORKSPACE_ROOT`: resolved project root
- `ARBITER_OUTPUT_DIR`: generation output directory
- `ARBITER_TARGET_PATH`: absolute path of the file being written (file hooks
  only)
- `ARBITER_RELATIVE_PATH`: path relative to the workspace root (file hooks only)
- `ARBITER_IS_DRY_RUN`: `1` if the generate command was executed with
  `--dry-run`

`before:fileWrite` receives the pending file content on stdin and may return
modified content on stdout. Hooks are skipped automatically during dry runs to
avoid side effects.

## Best Practices

### Template Organization

- **Cookiecutter templates**: Use for complex, multi-file templates
- **Script templates**: Use for simple, procedural generation
- **Template variables**: Keep them simple and predictable
- **Prerequisites**: Always declare required tools

### CUE Specification

```cue
// ✅ Good - Clean alias reference
services: {
  api: {
    template: "bun-hono"
    // other config...
  }
}

// ❌ Bad - Implementation details in spec
services: {
  api: {
    templateSource: "https://github.com/long-ugly-url/template.git"
    templateEngine: "cookiecutter"
    templateArgs: ["--no-input", "--extra-context", "foo=bar"]
    // other config...
  }
}
```

### Template Design

- Make templates self-contained
- Use sensible defaults for variables
- Include comprehensive documentation
- Test templates with different variable combinations
- Provide both minimal and complete examples

## Troubleshooting

### Template Not Found

```bash
# Check available templates
arbiter templates list

# Check template details
arbiter templates show template-name

# Reload configuration
arbiter templates update
```

### Engine Errors

```bash
# Check if implementor command is available
which cookiecutter

# Install missing prerequisites
npm install -g cookiecutter

# Check implementor configuration
arbiter templates show template-name
```

### Variable Issues

Variables are extracted from CUE context and service-specific options:

```bash
# Debug variable extraction with verbose output
arbiter add service api --template my-template --verbose
```

## Examples

See the `example-templates.json` sample config and the
`src/templates/assets/example-script-template.sh` helper script for working
examples. The JSON file lives at the root of `packages/cli/` and is **only** a
reference snippet for docs and tests—it is not loaded automatically by the CLI.
Copy the sections you need into `.arbiter/config.json` when experimenting with
custom GitHub template sets.

## Integration with Arbiter Workflows

Templates integrate seamlessly with Arbiter's existing workflows:

1. **Development**: Use templates during `arbiter add` commands
2. **Generation**: Templates are applied before normal code generation
3. **Deployment**: Generated code follows Arbiter deployment patterns
4. **Testing**: Template-generated code includes test scaffolding

The template system keeps your specifications clean while providing powerful
code generation capabilities.
