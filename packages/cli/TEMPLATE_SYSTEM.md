# Arbiter Template System

A pluggable template system with clean alias configuration that keeps ugly implementation details separate from CUE specifications.

## Overview

The Arbiter template system provides:

1. **Clean CUE Specs** - Only simple alias names like `"bun-hono"` in your specifications
2. **External Configuration** - Template details stored in `.arbiter/templates.json`
3. **Pluggable Engines** - Support for cookiecutter, custom scripts, and more
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
  --engine cookiecutter

# Add a script-based template
arbiter templates add simple-service \
  --source "./scripts/simple-service-template.sh" \
  --description "Simple TypeScript service template" \
  --engine script
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
        "project_name": "{{cookiecutter.serviceName}}",
        "use_typescript": true
      },
      "prerequisites": ["bun", "git"]
    }
  },
  "settings": {
    "defaultEngine": "cookiecutter",
    "cacheDir": "~/.arbiter/template-cache",
    "timeout": 300000
  }
}
```

## Template Engines

### Cookiecutter Engine

The default engine for most templates. Supports:

- Git repositories (GitHub, GitLab, etc.)
- Local directories
- ZIP archives
- Variable substitution

**Example:**
```bash
arbiter templates add react-app \
  --source "gh:cookiecutter/cookiecutter-react-component" \
  --engine cookiecutter
```

### Script Engine

For simple shell-based templates:

**Example:**
```bash
arbiter templates add custom-service \
  --source "./scripts/create-service.sh" \
  --engine script
```

Script templates receive variables as environment variables:
- `TEMPLATE_DESTINATION` - Target directory
- `TEMPLATE_SERVICENAME` - Service name
- `TEMPLATE_PROJECTNAME` - Project name
- `TEMPLATE_*` - Other variables prefixed with `TEMPLATE_`

### Custom Engines

You can create custom engines by implementing the `TemplateEngine` interface:

```typescript
import { TemplateEngine } from "./templates/index.js";

class MyCustomEngine implements TemplateEngine {
  name = 'custom';
  command = 'my-generator';
  defaultArgs = ['--quiet'];

  async execute(source: string, destination: string, variables: Record<string, any>): Promise<void> {
    // Your implementation
  }
}

// Register the engine
templateManager.addEngine(new MyCustomEngine());
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
  --engine cookiecutter \
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
  --engine script
```

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
# Check if engine command is available
which cookiecutter

# Install missing prerequisites
npm install -g cookiecutter

# Check engine configuration
arbiter templates show template-name
```

### Variable Issues

Variables are extracted from CUE context and service-specific options:

```bash
# Debug variable extraction with verbose output
arbiter add service api --template my-template --verbose
```

## Examples

See the `example-templates.json` and `example-script-template.sh` files for working examples.

## Integration with Arbiter Workflows

Templates integrate seamlessly with Arbiter's existing workflows:

1. **Development**: Use templates during `arbiter add` commands
2. **Generation**: Templates are applied before normal code generation
3. **Deployment**: Generated code follows Arbiter deployment patterns
4. **Testing**: Template-generated code includes test scaffolding

The template system keeps your specifications clean while providing powerful code generation capabilities.