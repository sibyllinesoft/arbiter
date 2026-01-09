# Arbiter Code Generation Configuration Guide

This guide provides comprehensive documentation for configuring Arbiter's code generation system. It covers the layered configuration system, all available options, and practical examples for common scenarios.

## Table of Contents

1. [Configuration File Locations](#configuration-file-locations)
2. [Layered Configuration System](#layered-configuration-system)
3. [Configuration Precedence](#configuration-precedence)
4. [Complete Configuration Reference](#complete-configuration-reference)
5. [Project Structure Configuration](#project-structure-configuration)
6. [Generator Configuration](#generator-configuration)
7. [Language Plugin Configuration](#language-plugin-configuration)
8. [Template Overrides](#template-overrides)
9. [Generation Hooks](#generation-hooks)
10. [Docker Configuration](#docker-configuration)
11. [CLI Flags Reference](#cli-flags-reference)
12. [Practical Examples](#practical-examples)
13. [Troubleshooting](#troubleshooting)

---

## Configuration File Locations

Arbiter looks for configuration in `.arbiter/config.json` files at multiple locations. The configuration file must be valid JSON.

### Standard Locations

| Location | Purpose | Example Path |
|----------|---------|--------------|
| Home directory | Global defaults for all projects | `~/.arbiter/config.json` |
| Git repository root | Shared settings for entire repo | `/path/to/repo/.arbiter/config.json` |
| Current working directory | Project-specific overrides | `./project/.arbiter/config.json` |

### Creating a Configuration File

```bash
# Create project-level config
mkdir -p .arbiter
cat > .arbiter/config.json << 'EOF'
{
  "apiUrl": "http://localhost:5050",
  "projectStructure": {
    "servicesDirectory": "services",
    "clientsDirectory": "apps"
  }
}
EOF

# Create global config (applies to all projects)
mkdir -p ~/.arbiter
cat > ~/.arbiter/config.json << 'EOF'
{
  "timeout": 30000,
  "color": true,
  "generator": {
    "plugins": {
      "typescript": {
        "packageManager": "bun"
      }
    }
  }
}
EOF
```

---

## Layered Configuration System

Arbiter uses a sophisticated layered configuration system that allows you to define defaults globally and override them per-project or per-subdirectory.

### How Layering Works

**Within a Git repository**, Arbiter collects configs from the git root down to your current directory:

```
~/.arbiter/config.json          ← Global defaults (base layer)
    ↓
/repo/.arbiter/config.json      ← Repository-wide settings
    ↓
/repo/projects/.arbiter/config.json   ← Subdirectory overrides
    ↓
/repo/projects/my-app/.arbiter/config.json  ← Most specific (wins)
```

**Outside a Git repository**, only these locations are checked:
```
~/.arbiter/config.json          ← Global defaults
    ↓
<cwd>/.arbiter/config.json      ← Current directory only
```

This prevents accidentally inheriting config from unrelated parent directories.

### Deep Merge Behavior

Configurations are **deep merged**, meaning nested objects combine rather than replace:

**Home config (`~/.arbiter/config.json`):**
```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "packageManager": "npm",
        "framework": "express"
      }
    }
  }
}
```

**Project config (`./.arbiter/config.json`):**
```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "framework": "fastify",
        "testing": {
          "framework": "vitest"
        }
      }
    }
  }
}
```

**Resulting merged config:**
```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "packageManager": "npm",        // From home (preserved)
        "framework": "fastify",         // From project (overrides)
        "testing": {
          "framework": "vitest"         // From project (added)
        }
      }
    }
  }
}
```

### Tracking Loaded Configs

The merged config includes `loadedConfigPaths` showing all files that contributed:

```json
{
  "loadedConfigPaths": [
    "/home/user/.arbiter/config.json",
    "/path/to/repo/.arbiter/config.json",
    "/path/to/repo/my-project/.arbiter/config.json"
  ]
}
```

Use `--verbose` to see which configs were loaded during execution.

---

## Configuration Precedence

From **lowest** to **highest** priority:

| Priority | Source | Example |
|----------|--------|---------|
| 1 (lowest) | Built-in defaults | `timeout: 10000` |
| 2 | Home directory config | `~/.arbiter/config.json` |
| 3 | Git root config | `/repo/.arbiter/config.json` |
| 4 | Parent directory configs | `/repo/packages/.arbiter/config.json` |
| 5 | Current directory config | `./.arbiter/config.json` |
| 6 | Environment variables | `ARBITER_API_URL` |
| 7 (highest) | CLI flags | `--api-url`, `--timeout` |

### Environment Variables

| Variable | Overrides | Example |
|----------|-----------|---------|
| `ARBITER_API_URL` | `apiUrl` | `export ARBITER_API_URL=https://arbiter.example.com` |
| `ARBITER_VERBOSE` | `verbose` | `export ARBITER_VERBOSE=1` |

### CLI Flags

CLI flags always take highest precedence:

```bash
# Override API URL for this command only
arbiter generate --api-url http://staging:5050

# Force local mode (no server connection)
arbiter generate --local

# Override project directory
arbiter generate --project-dir /path/to/output
```

---

## Complete Configuration Reference

### Top-Level Options

```json
{
  // API server connection
  "apiUrl": "http://localhost:5050",    // Arbiter server URL
  "timeout": 10000,                      // Request timeout in milliseconds

  // Output formatting
  "format": "table",                     // Output format: "table" | "json" | "yaml"
  "color": true,                         // Enable colored output

  // Project settings
  "projectDir": ".",                     // Base directory for generation
  "projectId": "auto-generated",         // Project identifier (auto-detected from git)
  "localMode": false,                    // Operate without server connection

  // Nested configuration objects
  "projectStructure": { /* see below */ },
  "generator": { /* see below */ },
  "github": { /* see GitHub sync docs */ },
  "uiOptions": { /* see UI options docs */ }
}
```

---

## Project Structure Configuration

Controls where generated artifacts are placed. All paths are relative to `projectDir`.

```json
{
  "projectStructure": {
    // Directory names for each artifact type
    "clientsDirectory": "clients",       // Frontend apps, SPAs
    "servicesDirectory": "services",     // Backend services, APIs
    "packagesDirectory": "packages",     // Shared libraries, modules
    "toolsDirectory": "tools",           // CLI tools, scripts
    "docsDirectory": "docs",             // Generated documentation
    "testsDirectory": "tests",           // Test fixtures, e2e tests
    "infraDirectory": "infra",           // Docker, Kubernetes, IaC

    // Control per-package vs global placement
    "packageRelative": {
      "docsDirectory": false,            // false = global docs/, true = services/foo/docs/
      "testsDirectory": false,           // false = global tests/, true = services/foo/tests/
      "infraDirectory": false            // false = global infra/, true = services/foo/infra/
    }
  }
}
```

### Directory Placement Examples

**Default behavior (`packageRelative: false`):**
```
my-project/
├── services/
│   ├── auth/
│   │   └── src/
│   └── billing/
│       └── src/
├── docs/                    ← All docs here
│   ├── auth/
│   └── billing/
├── tests/                   ← All tests here
│   ├── auth/
│   └── billing/
└── infra/                   ← All infra here
    └── docker-compose.yml
```

**With `packageRelative.testsDirectory: true`:**
```
my-project/
├── services/
│   ├── auth/
│   │   ├── src/
│   │   └── tests/           ← Tests colocated with service
│   └── billing/
│       ├── src/
│       └── tests/           ← Tests colocated with service
├── docs/
└── infra/
```

### Common Project Structure Patterns

**Monorepo with apps/ directory:**
```json
{
  "projectStructure": {
    "clientsDirectory": "apps",
    "servicesDirectory": "services",
    "packagesDirectory": "packages"
  }
}
```

**Flat structure (single service):**
```json
{
  "projectStructure": {
    "servicesDirectory": ".",
    "docsDirectory": "docs",
    "testsDirectory": "tests"
  }
}
```

**Polyrepo with colocated tests:**
```json
{
  "projectStructure": {
    "servicesDirectory": ".",
    "packageRelative": {
      "testsDirectory": true,
      "docsDirectory": true
    }
  }
}
```

---

## Generator Configuration

The `generator` object controls code generation behavior.

```json
{
  "generator": {
    // Custom template directories per language
    "templateOverrides": {
      "typescript": "./templates/ts",
      "python": ["./templates/py", "../shared-templates/py"]
    },

    // Per-language plugin configuration
    "plugins": {
      "typescript": { /* see Language Plugins */ },
      "python": { /* see Language Plugins */ },
      "go": { /* see Language Plugins */ },
      "rust": { /* see Language Plugins */ }
    },

    // Lifecycle hooks
    "hooks": {
      "before:generate": "echo 'Starting generation'",
      "after:generate": "pnpm format",
      "before:fileWrite": "./scripts/transform.sh",
      "after:fileWrite": "prettier --write {{file}}"
    },

    // Cross-language test runner
    "testing": {
      "master": {
        "type": "node",                  // "node" | "make"
        "output": "tests/run-all.mjs"    // Output path for runner script
      }
    },

    // Docker generation settings
    "docker": { /* see Docker Configuration */ }
  }
}
```

---

## Language Plugin Configuration

Each supported language can have its own configuration under `generator.plugins.<language>`.

### TypeScript Plugin

```json
{
  "generator": {
    "plugins": {
      "typescript": {
        // Framework selection
        "framework": "express",          // "express" | "fastify" | "hono" | "next"
        "packageManager": "bun",         // "npm" | "yarn" | "pnpm" | "bun"

        // Testing configuration
        "testing": {
          "framework": "vitest",         // "jest" | "vitest" | "mocha"
          "outputDir": "tests",          // Where to write test files
          "command": "vitest run",       // Custom test command
          "options": {
            "coverage": true,
            "reporter": "verbose"
          }
        },

        // Additional options (passed to templates)
        "strict": true,
        "esm": true
      }
    }
  }
}
```

### Python Plugin

```json
{
  "generator": {
    "plugins": {
      "python": {
        "framework": "fastapi",          // "fastapi" | "flask" | "django"
        "packageManager": "poetry",      // "pip" | "poetry" | "uv"

        "testing": {
          "framework": "pytest",         // "pytest" | "unittest"
          "outputDir": "tests",
          "command": "pytest -v",
          "options": {
            "cov": true,
            "asyncio_mode": "auto"
          }
        },

        "pythonVersion": "3.11"
      }
    }
  }
}
```

### Go Plugin

```json
{
  "generator": {
    "plugins": {
      "go": {
        "framework": "fiber",            // "fiber" | "gin" | "chi" | "echo"

        "testing": {
          "framework": "testify",        // "testing" | "testify"
          "command": "go test ./...",
          "options": {
            "race": true,
            "cover": true
          }
        },

        "goVersion": "1.21"
      }
    }
  }
}
```

### Rust Plugin

```json
{
  "generator": {
    "plugins": {
      "rust": {
        "framework": "axum",             // "axum" | "actix" | "rocket"

        "testing": {
          "command": "cargo test",
          "options": {
            "nocapture": true
          }
        },

        "edition": "2021"
      }
    }
  }
}
```

---

## Template Overrides

Override default templates with your own implementations.

### Basic Override

```json
{
  "generator": {
    "templateOverrides": {
      "typescript": "./my-templates/ts"
    }
  }
}
```

### Multiple Override Directories

Templates are searched in order; first match wins:

```json
{
  "generator": {
    "templateOverrides": {
      "typescript": [
        "./project-templates/ts",        // Checked first
        "../shared-templates/ts",        // Checked second
        "../../company-templates/ts"     // Checked third
      ]
    }
  }
}
```

### Path Resolution

- **Relative paths**: Resolved from the config file's directory
- **Absolute paths**: Used as-is

```json
// Config at /home/user/project/.arbiter/config.json
{
  "generator": {
    "templateOverrides": {
      // Resolves to /home/user/project/templates/ts
      "typescript": "./templates/ts",

      // Resolves to /home/user/shared-templates/ts
      "python": "../shared-templates/ts",

      // Used as-is
      "go": "/opt/arbiter-templates/go"
    }
  }
}
```

---

## Generation Hooks

Hooks execute shell commands at specific points during generation.

### Available Hooks

| Hook | When | Use Case |
|------|------|----------|
| `before:generate` | Before any generation starts | Validation, cleanup, setup |
| `after:generate` | After all files written | Formatting, linting, git operations |
| `before:fileWrite` | Before each file write | Content transformation |
| `after:fileWrite` | After each file write | Per-file formatting |

### Hook Configuration

```json
{
  "generator": {
    "hooks": {
      "before:generate": "echo 'Starting...' && pnpm lint",
      "after:generate": "pnpm format && git add .",
      "before:fileWrite": "./scripts/transform-content.sh",
      "after:fileWrite": "prettier --write {{file}}"
    }
  }
}
```

### Environment Variables Available to Hooks

All hooks receive these environment variables:

| Variable | Description |
|----------|-------------|
| `ARBITER_HOOK_EVENT` | Hook name (e.g., `after:generate`) |
| `ARBITER_WORKSPACE_ROOT` | Workspace root directory |
| `ARBITER_OUTPUT_DIR` | Generation output directory |
| `ARBITER_CONFIG_DIR` | Directory containing config file |
| `ARBITER_IS_DRY_RUN` | `1` if dry-run mode, `0` otherwise |

File-specific hooks also receive:

| Variable | Description |
|----------|-------------|
| `ARBITER_TARGET_PATH` | Absolute path to file |
| `ARBITER_RELATIVE_PATH` | Path relative to output dir |
| `ARBITER_CONTENT_LENGTH` | File size in bytes (after:fileWrite only) |

The `after:generate` hook receives:

| Variable | Description |
|----------|-------------|
| `ARBITER_GENERATED_FILES` | Newline-delimited list of all generated files |

### Content Transformation (before:fileWrite)

The `before:fileWrite` hook can transform file content:
- Receives original content on **stdin**
- Must write transformed content to **stdout**
- Non-zero exit code aborts generation

**Example transform script (`./scripts/add-header.sh`):**
```bash
#!/bin/bash
# Add copyright header to all files
echo "// Copyright $(date +%Y) My Company"
echo "// Generated by Arbiter - DO NOT EDIT"
echo ""
cat  # Pass through original content
```

---

## Docker Configuration

Configure Docker file generation for services and clients.

```json
{
  "generator": {
    "docker": {
      // Default templates for all services/clients
      "defaults": {
        "service": {
          "dockerfile": "./docker/Dockerfile.service",
          "dockerignore": "./docker/.dockerignore.service"
        },
        "client": {
          "dockerfile": "./docker/Dockerfile.client",
          "dockerignore": "./docker/.dockerignore.client"
        }
      },

      // Per-service overrides (by service name or language)
      "services": {
        "auth": {
          "dockerfile": "./docker/Dockerfile.auth"
        },
        "python": {
          "dockerfile": "./docker/Dockerfile.python"
        }
      },

      // Per-client overrides
      "clients": {
        "web": {
          "dockerfile": "./docker/Dockerfile.web"
        }
      }
    }
  }
}
```

### Resolution Order

1. Check for service/client-specific config by name
2. Check for language-specific config
3. Fall back to defaults
4. If no override, use auto-generated Dockerfile

---

## Artifact Groups and Path Routing

Arbiter supports organizing artifacts into logical groups and customizing how artifact paths are determined.

### Artifact Groups

Groups are first-class spec objects that let you organize services, clients, packages, and tools by feature, domain, or any other criteria.

#### Defining Groups in Your Spec

```json
{
  "groups": {
    "billing": {
      "name": "Billing",
      "description": "Payment and invoicing features",
      "directory": "billing",
      "tags": ["revenue", "payments"]
    },
    "commerce": {
      "name": "Commerce",
      "description": "E-commerce domain",
      "structure": {
        "servicesDirectory": "backends"
      }
    }
  }
}
```

#### GroupSpec Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` (required) | Display name of the group |
| `description` | `string` | What this group contains |
| `directory` | `string` | Override directory name (defaults to slugified name) |
| `tags` | `string[]` | Tags for filtering/categorization |
| `structure` | `ProjectStructureConfig` | Override structure within this group |
| `memberOf` | `string` | Parent group (for nested groups) |

#### Assigning Artifacts to Groups

Add `memberOf` to any service, client, package, or tool:

```json
{
  "services": {
    "payment-api": {
      "language": "typescript",
      "memberOf": "billing"
    },
    "invoice-service": {
      "language": "python",
      "memberOf": "billing"
    }
  },
  "clients": {
    "checkout-ui": {
      "language": "typescript",
      "framework": "react",
      "memberOf": "commerce"
    }
  }
}
```

#### Nested Groups

Groups can be nested by referencing other groups in `memberOf`:

```json
{
  "groups": {
    "platform": {
      "name": "Platform",
      "description": "Core platform features"
    },
    "billing": {
      "name": "Billing",
      "memberOf": "platform"
    },
    "subscriptions": {
      "name": "Subscriptions",
      "memberOf": "billing"
    }
  },
  "services": {
    "recurring-payments": {
      "language": "go",
      "memberOf": "subscriptions"
    }
  }
}
```

### Path Routing Configuration

The path router determines where artifacts are placed in the filesystem.

```json
{
  "generator": {
    "routing": {
      "mode": "by-type",
      "warnOnUngrouped": false,
      "customRouter": null
    }
  }
}
```

#### Routing Modes

| Mode | Description | Example Output |
|------|-------------|----------------|
| `by-type` (default) | Organizes by artifact type | `services/payment-api/` |
| `by-group` | Organizes by group membership | `billing/services/payment-api/` |

#### by-type Mode (Default)

All artifacts are placed in their respective type directories:

```
my-project/
├── services/
│   ├── payment-api/
│   └── invoice-service/
├── clients/
│   └── checkout-ui/
└── packages/
    └── shared-utils/
```

#### by-group Mode

Artifacts are organized by their group membership:

```
my-project/
├── billing/
│   └── services/
│       ├── payment-api/
│       └── invoice-service/
├── commerce/
│   └── clients/
│       └── checkout-ui/
└── services/                  # Ungrouped artifacts fall back to type
    └── auth-service/
```

With nested groups:

```
my-project/
└── platform/
    └── billing/
        └── subscriptions/
            └── services/
                └── recurring-payments/
```

#### warnOnUngrouped Option

Enable warnings when artifacts don't have a `memberOf` field:

```json
{
  "generator": {
    "routing": {
      "mode": "by-group",
      "warnOnUngrouped": true
    }
  }
}
```

This helps enforce consistent grouping across your organization.

#### Custom Routers

For advanced use cases, you can provide a custom router module:

```json
{
  "generator": {
    "routing": {
      "customRouter": "./scripts/custom-router.js"
    }
  }
}
```

**Custom router module (`./scripts/custom-router.js`):**

```javascript
export default {
  resolve(input) {
    const { artifactType, artifactKey, artifactConfig, groups, structureConfig } = input;

    // Custom logic to determine path
    if (artifactConfig.priority === "core") {
      return { root: `core/${artifactType}s/${artifactKey}` };
    }

    // Fall back to default behavior
    const typeDir = structureConfig[`${artifactType}sDirectory`] || `${artifactType}s`;
    return { root: `${typeDir}/${artifactKey}` };
  }
};
```

The router receives a `PathRouterInput` object:

| Field | Type | Description |
|-------|------|-------------|
| `artifactType` | `"service" \| "client" \| "package" \| "tool"` | Type of artifact |
| `artifactKey` | `string` | Unique key/identifier |
| `artifactSlug` | `string` | Slugified name for filesystem |
| `artifactConfig` | `object` | Full artifact configuration |
| `groups` | `Record<string, GroupSpec>` | All defined groups |
| `projectDir` | `string` | Project root directory |
| `structureConfig` | `ProjectStructureConfig` | Project structure settings |

And must return a `PathRouterOutput`:

| Field | Type | Description |
|-------|------|-------------|
| `root` | `string` | Relative path from projectDir to artifact root |

### Group Structure Overrides

Groups can override project structure settings within their scope:

```json
{
  "groups": {
    "mobile": {
      "name": "Mobile",
      "structure": {
        "clientsDirectory": "apps",
        "testsDirectory": "__tests__"
      }
    }
  },
  "clients": {
    "ios-app": {
      "language": "swift",
      "memberOf": "mobile"
    }
  }
}
```

Result with `by-group` routing:
```
my-project/
└── mobile/
    └── apps/           # Uses group's clientsDirectory
        └── ios-app/
            └── __tests__/   # Uses group's testsDirectory
```

---

## CLI Flags Reference

### Generate Command

```bash
arbiter generate [spec-name] [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--project-dir <dir>` | Output directory | Current directory or `config.projectDir` |
| `--spec <name>` | Use specific stored spec | Auto-detected |
| `--force` | Overwrite existing files | `false` |
| `--dry-run` | Preview without writing | `false` |
| `--verbose` | Detailed logging | `false` |
| `--no-color` | Disable colored output | `false` |
| `--no-tests` | Skip test generation | `false` |
| `--no-docs` | Skip documentation | `false` |
| `--no-code` | Skip service/client code | `false` |
| `--sync-github` | Sync groups to GitHub | `false` |
| `--github-dry-run` | Preview GitHub sync | `false` |

### Global Flags

These flags work with any command:

| Flag | Description |
|------|-------------|
| `--api-url <url>` | Override Arbiter server URL |
| `--timeout <ms>` | Override request timeout |
| `--local` | Operate without server |
| `-c, --config <path>` | Use specific config file |
| `-v, --verbose` | Enable verbose logging |
| `--no-color` | Disable colored output |

---

## Practical Examples

### Example 1: Full-Featured Monorepo Config

**`~/.arbiter/config.json`** (global defaults):
```json
{
  "timeout": 30000,
  "color": true,
  "generator": {
    "plugins": {
      "typescript": {
        "packageManager": "bun",
        "strict": true
      }
    },
    "hooks": {
      "after:fileWrite": "prettier --write {{file}} 2>/dev/null || true"
    }
  }
}
```

**`/repo/.arbiter/config.json`** (repo-wide):
```json
{
  "projectStructure": {
    "clientsDirectory": "apps",
    "servicesDirectory": "services",
    "packagesDirectory": "packages",
    "packageRelative": {
      "testsDirectory": true
    }
  },
  "generator": {
    "plugins": {
      "typescript": {
        "framework": "fastify",
        "testing": {
          "framework": "vitest"
        }
      }
    },
    "templateOverrides": {
      "typescript": "./templates/ts"
    }
  }
}
```

**`/repo/services/auth/.arbiter/config.json`** (service-specific):
```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "testing": {
          "framework": "jest",
          "options": {
            "setupFilesAfterEnv": ["./tests/setup.ts"]
          }
        }
      }
    }
  }
}
```

### Example 2: Multi-Language Project

```json
{
  "projectStructure": {
    "servicesDirectory": "backend",
    "clientsDirectory": "frontend"
  },
  "generator": {
    "plugins": {
      "typescript": {
        "framework": "next",
        "testing": { "framework": "jest" }
      },
      "python": {
        "framework": "fastapi",
        "testing": { "framework": "pytest" }
      },
      "go": {
        "framework": "fiber",
        "testing": { "framework": "testify" }
      }
    },
    "testing": {
      "master": {
        "type": "make",
        "output": "Makefile"
      }
    }
  }
}
```

### Example 3: Enterprise Setup with Custom Templates

```json
{
  "apiUrl": "https://arbiter.internal.company.com",
  "timeout": 60000,
  "projectStructure": {
    "servicesDirectory": "microservices",
    "infraDirectory": "platform"
  },
  "generator": {
    "templateOverrides": {
      "typescript": [
        "./templates/project",
        "/opt/company-templates/typescript"
      ],
      "python": "/opt/company-templates/python"
    },
    "hooks": {
      "before:generate": "./scripts/validate-spec.sh",
      "after:generate": [
        "pnpm format",
        "pnpm lint --fix",
        "./scripts/security-scan.sh"
      ]
    },
    "docker": {
      "defaults": {
        "service": {
          "dockerfile": "/opt/company-templates/docker/Dockerfile.service"
        }
      }
    }
  }
}
```

### Example 4: Minimal Local Development

```json
{
  "localMode": true,
  "projectDir": ".",
  "generator": {
    "hooks": {
      "after:generate": "npm run format"
    }
  }
}
```

---

## Troubleshooting

### Viewing Effective Configuration

```bash
# See which config files are loaded
arbiter generate --dry-run --verbose

# Check specific config values
arbiter status --verbose
```

### Common Issues

**Config not being picked up:**
- Ensure file is named exactly `config.json` in `.arbiter/` directory
- Check file is valid JSON (`cat .arbiter/config.json | jq .`)
- Verify you're in the expected directory

**Template overrides not working:**
- Paths are relative to the config file location, not cwd
- Check template directory exists and contains expected files
- Use `--verbose` to see template resolution

**Hooks not executing:**
- Ensure hook commands are valid shell commands
- Check file permissions on hook scripts
- Hook failures in dry-run mode are logged but don't abort

**Layered config not merging correctly:**
- Remember: arrays replace, objects merge
- Use `--verbose` to see `loadedConfigPaths`
- Check if you're inside a git repository (affects search behavior)

### Debug Mode

Set environment variable for detailed config debugging:

```bash
export ARBITER_DEBUG_CONFIG=1
arbiter generate --dry-run
```

---

## See Also

- [Code Generation Architecture](./code-generation-architecture.md) - Pipeline internals
- [Template Development Guide](./template-development-guide.md) - Creating custom templates
- [Generation Best Practices](./generation-best-practices.md) - Workflow patterns
- [GitHub Sync Guide](./github-sync.md) - Issue/milestone synchronization
