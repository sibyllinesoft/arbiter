# Artifact Profiles Quick Start

This guide helps you get started with Arbiter's artifact profile system in just a few minutes.

## Step 1: Scan Your Project

First, let Arbiter detect your project type automatically:

```bash
# Scan and generate assembly file
cd your-project
bun run scan --output-assembly

# Review the generated arbiter.assembly.json
cat arbiter.assembly.json
```

This will create a basic assembly file with auto-detected artifact information.

## Step 2: Choose Your Profile

Based on your project type, select the appropriate template:

### Library Projects (TypeScript/Go/Rust)
```bash
# Copy the library template
cp examples/templates/library-assembly.json arbiter.assembly.json

# Customize for your project
vim arbiter.assembly.json
```

**Key customizations:**
- Set `spec.artifact.language` to your language
- Update `spec.artifact.build.tool` and `targets`
- Configure `spec.profiles.library.surfaceConfig.entryPoints`

### CLI Applications
```bash
# Copy the CLI template  
cp examples/templates/cli-assembly.json arbiter.assembly.json

# Customize for your project
vim arbiter.assembly.json
```

**Key customizations:**
- Define your command structure in `spec.profiles.cli.commandTree`
- Add golden tests in `spec.profiles.cli.tests.golden`
- Configure interactive tests if needed

### Batch Jobs
```bash
# Copy the job template
cp examples/templates/job-assembly.json arbiter.assembly.json

# Customize for your project
vim arbiter.assembly.json
```

**Key customizations:**
- Set resource limits in `spec.profiles.job.resources`
- Define I/O schemas in `spec.profiles.job.io`
- Configure execution parameters

## Step 3: Test Your Configuration

Validate your assembly configuration:

```bash
# Check configuration validity
bun run validate arbiter.assembly.json

# Test profile-specific functionality (dry run)
bun run execute example-epic.json --verbose
```

## Step 4: Add Profile-Specific Tests

### For Libraries
Create API surface baselines:
```bash
# First run will create baseline
bun run execute epic.json --apply

# Subsequent runs will check for breaking changes
bun run execute epic.json --apply --verbose
```

### For CLIs
Add golden test files:
```bash
# Create test directory
mkdir -p testdata/golden

# Run CLI tests to generate golden files
bun run execute epic.json --apply

# Review and commit golden files
git add testdata/golden/
```

### For Jobs
Create test fixtures:
```bash
# Create test data
mkdir -p testdata
echo '{"sample": "data"}' > testdata/test-input.json

# Run job validation
bun run execute epic.json --apply --verbose
```

## Step 5: Integrate with CI/CD

Add to your CI pipeline:

### GitHub Actions Example
```yaml
name: Arbiter Profile Tests
on: [push, pull_request]

jobs:
  profile-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      
      - name: Install dependencies
        run: bun install
        
      - name: Run profile-specific tests
        run: |
          bun run scan --validate
          bun run execute epic.json --apply --verbose
          
      - name: Check for breaking changes (libraries only)
        if: contains(github.event.head_commit.message, 'breaking:')
        run: bun run execute epic.json --check-breaking
```

## Common Patterns

### Library with TypeScript
```json
{
  "spec": {
    "artifact": {
      "kind": "library",
      "language": "ts",
      "build": {
        "tool": "bun",
        "targets": ["./src"]
      }
    },
    "profiles": {
      "library": {
        "semver": "strict",
        "surfaceConfig": {
          "entryPoints": ["./src/index.ts"]
        }
      }
    }
  }
}
```

### CLI with Go
```json
{
  "spec": {
    "artifact": {
      "kind": "cli", 
      "language": "go",
      "build": {
        "tool": "go",
        "targets": ["./cmd/mycli"]
      }
    },
    "profiles": {
      "cli": {
        "tests": {
          "golden": [
            {
              "name": "Version",
              "cmd": "--version",
              "wantCode": 0
            }
          ]
        }
      }
    }
  }
}
```

### Python Job
```json
{
  "spec": {
    "artifact": {
      "kind": "job",
      "language": "python", 
      "build": {
        "tool": "uv",
        "targets": ["./src/main.py"]
      }
    },
    "profiles": {
      "job": {
        "resources": {
          "limits": {
            "cpu": "2000m",
            "memory": "4Gi"
          }
        },
        "execution": {
          "timeout": "1800s"
        }
      }
    }
  }
}
```

## Next Steps

1. **Read the full guide**: [Artifact Profiles Guide](./artifact-profiles.md)
2. **Explore examples**: Check `examples/` directory for complete project examples
3. **Customize testing**: Add more golden tests, API surface validation, or resource constraints
4. **Set up monitoring**: Configure alerts and metrics for production deployments

## Getting Help

- **Documentation**: `docs/artifact-profiles.md`
- **Examples**: `examples/templates/`
- **Troubleshooting**: `docs/artifact-profiles.md#troubleshooting`

Common issues:
- Profile not detected → Check `artifact.kind` in assembly
- Tests failing → Run with `--verbose` flag for details
- Golden tests out of date → Use `--update-golden` flag