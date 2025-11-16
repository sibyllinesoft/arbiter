# Arbiter Code Generation Configuration Guide

This comprehensive guide covers all aspects of configuring Arbiter's code generation system, from basic setup to advanced customization.

## Table of Contents

- [Configuration Overview](#configuration-overview)
- [Basic Configuration](#basic-configuration)
- [Template System Configuration](#template-system-configuration)
- [Language Plugin Configuration](#language-plugin-configuration)
- [Generation Profiles](#generation-profiles)
- [Override Mechanisms](#override-mechanisms)
- [Testing Configuration](#testing-configuration)
- [Advanced Configuration](#advanced-configuration)

## Configuration Overview

Arbiter's code generation system uses a layered configuration approach:

1. **Global CLI Configuration** - Project-wide settings in `.arbiter.json`
2. **Language-Specific Configuration** - Per-language overrides and plugins
3. **Template Configuration** - Template engine and alias settings
4. **Generation Profiles** - Environment-specific generation settings
5. **Runtime Options** - Command-line flags and environment variables

### Configuration Hierarchy

```
CLI Config (.arbiter.json)
├── generator                    # Generation settings
│   ├── templateOverrides        # Template override directories
│   ├── plugins                  # Language plugin configurations
│   ├── testing                  # Testing configurations
│   └── profiles                 # Generation profiles
├── projectDir                   # Project root directory
└── outputDir                    # Default output directory
```

## Basic Configuration

### Project Initialization

Initialize a new Arbiter project with generation capabilities:

```bash
# Initialize project
arbiter init my-app

# Generate basic configuration
cat > .arbiter.json << EOF
{
  "projectDir": ".",
  "outputDir": "./generated",
  "generator": {
    "templateOverrides": {
      "typescript": ["./templates/typescript"],
      "python": ["./templates/python"]
    },
    "plugins": {
      "typescript": {
        "framework": "next",
        "testing": "vitest"
      },
      "python": {
        "framework": "fastapi",
        "testing": "pytest"
      }
    }
  }
}
EOF
```

### Basic Generation Options

Configure generation behavior through the `GenerateOptions` interface:

```typescript
export interface GenerateOptions {
  outputDir?: string;        // Override default output directory
  force?: boolean;           // Overwrite existing files without prompting
  dryRun?: boolean;         // Preview generation without writing files
  verbose?: boolean;         // Enable detailed logging
  spec?: string;            // Target specific specification
  syncGithub?: boolean;     // Sync generated code to GitHub
  githubDryRun?: boolean;   // Preview GitHub synchronization
}
```

### Command-Line Usage

```bash
# Basic generation
arbiter generate

# Generate with options
arbiter generate \
  --output-dir ./dist \
  --force \
  --verbose \
  --spec my-spec

# Dry run to preview changes
arbiter generate --dry-run

# Generate and sync to GitHub
arbiter generate --sync-github
```

## Template System Configuration

### Template Engine Configuration

Configure template engines in your project's template configuration file:

```typescript
// templates/config.json
{
  "engines": {
    "handlebars": {
      "command": "handlebars",
      "defaultArgs": ["--compile"],
      "timeout": 30000
    },
    "liquid": {
      "command": "liquid",
      "defaultArgs": ["--render"],
      "timeout": 30000
    }
  },
  "aliases": {
    "typescript-service": {
      "engine": "handlebars",
      "source": "service/typescript",
      "description": "TypeScript service template",
      "variables": {
        "framework": "express",
        "database": "postgres"
      }
    },
    "react-component": {
      "engine": "handlebars", 
      "source": "component/react",
      "description": "React component template",
      "prerequisites": ["typescript"]
    }
  },
  "settings": {
    "defaultEngine": "handlebars",
    "cacheDir": ".arbiter/template-cache",
    "timeout": 60000
  }
}
```

### Template Directory Structure

Organize templates in a hierarchical structure:

```
templates/
├── config.json                 # Template configuration
├── typescript/                 # TypeScript templates
│   ├── service/
│   │   ├── main.ts.hbs         # Service entry point
│   │   ├── routes/             # Route templates
│   │   └── models/             # Model templates
│   ├── component/
│   │   ├── index.tsx.hbs       # React component
│   │   ├── styles.css.hbs      # Component styles
│   │   └── test.spec.tsx.hbs   # Component tests
│   └── common/
│       ├── package.json.hbs    # Package configuration
│       └── tsconfig.json.hbs   # TypeScript configuration
├── python/                     # Python templates
│   ├── service/
│   │   ├── main.py.hbs         # FastAPI service
│   │   ├── routers/            # Router templates
│   │   └── models/             # Pydantic models
│   └── common/
│       ├── requirements.txt.hbs
│       └── pyproject.toml.hbs
└── docker/                     # Docker templates
    ├── Dockerfile.hbs
    └── docker-compose.yml.hbs
```

### Template Variables and Context

Templates receive rich context from CUE specifications:

```handlebars
{{!-- Service template example --}}
import express from 'express';

const app = express();
const PORT = {{ port || 3000 }};

{{#if database}}
// Database configuration
import { {{ database.type }}Pool } from '{{ database.package }}';
const db = new {{ database.type }}Pool({
  connectionString: process.env.DATABASE_URL
});
{{/if}}

{{#each endpoints}}
// {{ this.method }} {{ this.path }}
app.{{ this.method }}('{{ this.path }}', async (req, res) => {
  {{#if this.auth}}
  // Authentication required
  {{/if}}
  {{#each this.responses}}
  // Response: {{ this.status }} - {{ this.description }}
  {{/each}}
});
{{/each}}

app.listen(PORT, () => {
  console.log(`{{ serviceName }} listening on port ${PORT}`);
});
```

### Template Override System

Override default templates by configuring override directories:

```json
{
  "generator": {
    "templateOverrides": {
      "typescript": [
        "./custom-templates/typescript",    // Highest priority
        "./shared-templates/typescript"     // Lower priority
      ]
    }
  }
}
```

**Template Resolution Order:**
1. Custom override directories (highest priority)
2. Shared override directories
3. Built-in default templates (lowest priority)

## Language Plugin Configuration

### TypeScript Configuration

Configure TypeScript code generation:

```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "framework": "next",           // next, express, fastify
        "testing": "vitest",           // vitest, jest, playwright
        "database": "prisma",          // prisma, drizzle, typeorm
        "auth": "auth0",              // auth0, supabase, clerk
        "styling": "tailwind",         // tailwind, styled-components, emotion
        "packageManager": "bun",       // bun, npm, yarn, pnpm
        "target": "es2022",           // ES target version
        "strict": true,               // Strict TypeScript mode
        "experimental": {
          "decorators": true,
          "modules": "esnext"
        }
      }
    }
  }
}
```

### Python Configuration

Configure Python code generation:

```json
{
  "generator": {
    "plugins": {
      "python": {
        "framework": "fastapi",        // fastapi, django, flask
        "testing": "pytest",           // pytest, unittest
        "database": "sqlalchemy",     // sqlalchemy, tortoise, peewee
        "async": true,                // Use async/await patterns
        "typing": "strict",           // Type annotation strictness
        "packageManager": "uv",        // uv, poetry, pip
        "pythonVersion": "3.11",      // Target Python version
        "formatting": {
          "black": true,              // Use Black formatter
          "isort": true,              // Use isort for imports
          "maxLineLength": 88
        }
      }
    }
  }
}
```

### Rust Configuration

Configure Rust code generation:

```json
{
  "generator": {
    "plugins": {
      "rust": {
        "framework": "axum",           // axum, warp, actix-web
        "database": "sqlx",           // sqlx, diesel, sea-orm
        "async": "tokio",             // tokio, async-std
        "edition": "2021",            // Rust edition
        "features": ["serde", "uuid"], // Default features
        "clippy": {
          "pedantic": true,
          "nursery": false
        }
      }
    }
  }
}
```

### Go Configuration

Configure Go code generation:

```json
{
  "generator": {
    "plugins": {
      "go": {
        "framework": "gin",            // gin, echo, chi
        "database": "gorm",           // gorm, sqlx
        "version": "1.21",            // Go version
        "modules": true,              // Use Go modules
        "formatting": {
          "gofmt": true,
          "goimports": true
        }
      }
    }
  }
}
```

## Generation Profiles

Generation profiles allow environment-specific configuration:

### Profile Definition

```json
{
  "generator": {
    "profiles": {
      "development": {
        "outputDir": "./src",
        "templateOverrides": {
          "typescript": ["./dev-templates"]
        },
        "plugins": {
          "typescript": {
            "minify": false,
            "sourceMaps": true,
            "hotReload": true
          }
        },
        "testing": {
          "coverage": false,
          "watch": true
        }
      },
      "production": {
        "outputDir": "./dist", 
        "plugins": {
          "typescript": {
            "minify": true,
            "sourceMaps": false,
            "optimization": "size"
          }
        },
        "testing": {
          "coverage": true,
          "e2e": true
        }
      },
      "testing": {
        "outputDir": "./test-output",
        "plugins": {
          "typescript": {
            "testDoubles": true,
            "mocking": "vitest"
          }
        }
      }
    }
  }
}
```

### Using Profiles

```bash
# Generate with development profile
NODE_ENV=development arbiter generate

# Generate with production profile  
NODE_ENV=production arbiter generate

# Explicitly specify profile
arbiter generate --profile testing
```

## Override Mechanisms

### Template Overrides

Override specific templates without replacing entire template directories:

```
project-root/
├── .arbiter/
│   └── template-overrides/
│       ├── typescript/
│       │   └── service/
│       │       └── main.ts.hbs     # Override service template
│       └── docker/
│           └── Dockerfile.hbs       # Override Dockerfile
└── generated/
```

### Plugin Overrides

Override plugin behavior with custom implementations:

```typescript
// custom-plugins/typescript-enhanced.ts
import { TypeScriptPlugin } from '@arbiter/cli/language-plugins';

export class EnhancedTypeScriptPlugin extends TypeScriptPlugin {
  async generateService(config: ServiceConfig): Promise<void> {
    // Custom service generation logic
    await super.generateService(config);
    
    // Add custom post-processing
    await this.addCustomMiddleware(config);
  }
  
  private async addCustomMiddleware(config: ServiceConfig): Promise<void> {
    // Custom middleware generation
  }
}
```

Register custom plugins:

```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "customPlugin": "./custom-plugins/typescript-enhanced.ts"
      }
    }
  }
}
```

### Hook Overrides

Customize the generation pipeline with hooks:

```typescript
// hooks/custom-generation-hooks.ts
import { GenerationHookManager } from '@arbiter/cli';

export class CustomHookManager extends GenerationHookManager {
  async beforeFileWrite(filePath: string, content: string): Promise<string> {
    // Add custom headers to all TypeScript files
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const header = `// Generated by Arbiter on ${new Date().toISOString()}\n`;
      return header + content;
    }
    return content;
  }
  
  async afterFileWrite(filePath: string, content: string): Promise<void> {
    // Run formatting after file generation
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      await this.formatTypeScriptFile(filePath);
    }
  }
}
```

## Testing Configuration

### Testing Framework Configuration

Configure testing per language and framework:

```json
{
  "generator": {
    "testing": {
      "typescript": {
        "unit": {
          "framework": "vitest",
          "coverage": true,
          "threshold": 80
        },
        "integration": {
          "framework": "supertest",
          "database": "testcontainers"
        },
        "e2e": {
          "framework": "playwright",
          "browsers": ["chromium", "firefox"]
        }
      },
      "python": {
        "unit": {
          "framework": "pytest",
          "coverage": true,
          "markers": ["unit", "integration"]
        },
        "integration": {
          "framework": "pytest",
          "fixtures": "factory-boy"
        }
      }
    }
  }
}
```

### Test Generation Configuration

Configure automatic test generation:

```json
{
  "generator": {
    "testing": {
      "autoGenerate": {
        "unit": true,           // Generate unit tests
        "integration": true,    // Generate integration tests
        "e2e": false,          // Skip E2E test generation
        "mocks": true,         // Generate mock objects
        "fixtures": true       // Generate test fixtures
      },
      "coverage": {
        "threshold": 80,       // Minimum coverage threshold
        "exclude": [           // Files to exclude from coverage
          "**/*.spec.ts",
          "**/*.test.ts"
        ]
      }
    }
  }
}
```

## Advanced Configuration

### Workspace Configuration

Configure multi-package workspace generation:

```json
{
  "generator": {
    "workspace": {
      "type": "monorepo",
      "packages": {
        "services": "./packages/services",
        "clients": "./packages/clients", 
        "shared": "./packages/shared"
      },
      "dependencies": {
        "hoisting": true,
        "dedupe": true
      }
    }
  }
}
```

### Docker Configuration

Configure Docker artifact generation:

```json
{
  "generator": {
    "docker": {
      "baseImages": {
        "typescript": "node:18-alpine",
        "python": "python:3.11-slim",
        "rust": "rust:1.70-alpine"
      },
      "compose": {
        "version": "3.8",
        "networks": ["app-network"],
        "volumes": ["app-data"]
      },
      "optimization": {
        "multiStage": true,
        "layers": "minimize",
        "security": "distroless"
      }
    }
  }
}
```

### CI/CD Configuration

Configure CI/CD pipeline generation:

```json
{
  "generator": {
    "cicd": {
      "provider": "github-actions",
      "workflows": {
        "test": {
          "trigger": ["push", "pull_request"],
          "matrix": {
            "node": ["18", "20"],
            "os": ["ubuntu-latest", "windows-latest"]
          }
        },
        "deploy": {
          "trigger": ["push"],
          "branches": ["main"],
          "environment": "production"
        }
      }
    }
  }
}
```

### Performance Configuration

Optimize generation performance:

```json
{
  "generator": {
    "performance": {
      "parallel": true,         // Generate in parallel
      "maxConcurrency": 4,      // Max concurrent generations
      "caching": {
        "templates": true,      // Cache compiled templates
        "contexts": true,       // Cache generation contexts
        "ttl": 3600            // Cache TTL in seconds
      },
      "optimization": {
        "incremental": true,    // Incremental generation
        "fingerprinting": true  // File fingerprinting
      }
    }
  }
}
```

### Security Configuration

Configure security-related generation settings:

```json
{
  "generator": {
    "security": {
      "secretManagement": {
        "provider": "vault",
        "rotation": true
      },
      "authentication": {
        "required": true,
        "methods": ["oauth2", "jwt"]
      },
      "validation": {
        "input": true,
        "output": true,
        "schemas": "strict"
      }
    }
  }
}
```

## Configuration Validation

### Schema Validation

Arbiter validates configuration against schemas:

```bash
# Validate configuration
arbiter config validate

# Validate with specific schema file
arbiter config validate --schema ./schemas/app.cue
```

### Configuration Testing

Test configuration changes:

```bash
# Test configuration with dry run
arbiter generate --dry-run --config-test

# Generate to temporary directory for testing
arbiter generate --output-dir /tmp/arbiter-test
```

This configuration system provides comprehensive control over all aspects of code generation while maintaining flexibility for customization and extension.
