# CLI Documentation Testing

This document explains the doctest setup for validating CLI examples in the Arbiter documentation.

## Overview

Arbiter uses a multi-layered approach to ensure CLI documentation stays accurate:

1. **Cram** - Functional testing framework for shell commands
2. **MkDocs Hooks** - Build-time validation of code blocks
3. **Golden File Tests** - Regression testing in `packages/cli`

## Quick Start

```bash
# Install dependencies
pip install -r docs/requirements.txt

# Run CLI documentation tests
cram docs/tests/*.t

# Build docs with validation (optional)
VALIDATE_CLI_EXAMPLES=1 mkdocs build

# Build docs with strict validation (fails on errors)
VALIDATE_CLI_EXAMPLES=1 VALIDATE_CLI_STRICT=1 mkdocs build
```

## Approach 1: Cram Tests (Recommended)

[Cram](https://bitheap.org/cram/) is a functional testing framework specifically designed for testing command-line applications.

### Creating Test Files

Create `.t` files in `docs/tests/`:

```bash
# docs/tests/my-feature.t
Test arbiter health command:

  $ arbiter health
  .*Server is healthy.* (re)
  .*API version.* (re)

Test arbiter init with preset:

  $ arbiter init test-app --preset web-app
  .*Created project: test-app.* (re)
  .*Initialized .arbiter/assembly.cue.* (re)
```

### Running Cram Tests

```bash
# Run all tests
cram docs/tests/*.t

# Run specific test
cram docs/tests/cli-examples.t

# Verbose output
cram -v docs/tests/*.t

# Interactive mode - update expected output
cram -i docs/tests/*.t

# Run in CI
cram --verbose --xunit-file=test-results.xml docs/tests/*.t
```

### Cram Test Syntax

```
Description of test:

  $ command to execute
  expected output line 1
  expected output line 2

  $ another command
  more expected output
```

**Pattern matching:**

- `.*` - Match any characters (requires `(re)` suffix)
- `(re)` - Enable regex matching for this line
- `(glob)` - Enable glob matching for this line
- `(esc)` - Escape special characters
- `(no-eol)` - Line has no trailing newline

**Example with patterns:**

```
Test with regex:

  $ arbiter version
  \d+\.\d+\.\d+ (re)

Test with glob:

  $ ls *.cue
  *.cue (glob)
```

### Best Practices

1. **Test command interfaces, not implementations**
   ```
   # Good - tests help output structure
   $ arbiter init --help
   .*Initialize a new project.* (re)

   # Bad - too specific, brittle
   $ arbiter init --help
   Usage: arbiter init [options] <name>
   ```

2. **Use regex for variable output**
   ```
   $ arbiter health
   .*Server.*healthy.* (re)  # Flexible
   ```

3. **Keep tests fast**
   - Test help text and basic commands
   - Avoid slow operations like full project generation
   - Use mocks or test fixtures when needed

4. **Group related tests**
   ```
   Init command tests:

     $ arbiter init --help
     ...

     $ arbiter init test --list-presets
     ...
   ```

## Approach 2: MkDocs Build-Time Validation

The `docs/hooks.py` file validates CLI code blocks during documentation builds.

### Usage

Mark code blocks for validation:

```markdown
\`\`\`bash
<!-- test -->
arbiter health
\`\`\`
```

Enable validation:

```bash
# Warn on errors but don't fail build
VALIDATE_CLI_EXAMPLES=1 mkdocs build

# Fail build on validation errors
VALIDATE_CLI_EXAMPLES=1 VALIDATE_CLI_STRICT=1 mkdocs build
```

### How It Works

1. Hook extracts all bash/shell code blocks
2. Finds commands starting with `$` or `arbiter`
3. Validates syntax (dry-run mode by default)
4. Reports errors to stderr
5. Optionally fails build in strict mode

### Configuration

Edit `docs/hooks.py` to customize validation:

```python
def validate_cli_block(command: str, dry_run: bool = True):
    # Change dry_run=False to actually execute commands
    # (use with caution!)
    ...
```

## Approach 3: Golden File Testing

For comprehensive CLI regression testing, use the golden file tests in `packages/cli`:

```bash
cd packages/cli
bun test golden.test.ts

# Update golden files
UPDATE_GOLDEN=1 bun test golden.test.ts
```

Golden tests capture complete CLI output and compare against stored snapshots.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Documentation Tests

on: [push, pull_request]

jobs:
  test-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: |
          bun install
          pip install -r docs/requirements.txt

      - name: Start API server
        run: bun run dev &

      - name: Wait for server
        run: sleep 5

      - name: Run Cram tests
        run: cram docs/tests/*.t

      - name: Build docs with validation
        run: VALIDATE_CLI_EXAMPLES=1 VALIDATE_CLI_STRICT=1 mkdocs build
```

## Writing Good CLI Tests

### Do's

✅ **Test the interface, not implementation**
```
$ arbiter health
.*healthy.* (re)
```

✅ **Use regex for flexible matching**
```
$ arbiter version
\d+\.\d+\.\d+ (re)
```

✅ **Test help text structure**
```
$ arbiter init --help
.*Initialize.*project.* (re)
.*--preset.* (re)
```

✅ **Group related tests logically**

### Don'ts

❌ **Don't make tests brittle**
```
# Bad - exact spacing/formatting
$ arbiter health
✓ Server is healthy
✓ API version: 1.0.0

# Good - flexible regex
$ arbiter health
.*Server.*healthy.* (re)
```

❌ **Don't test slow operations**
```
# Bad - slow, creates files
$ arbiter init my-app --preset web-app
$ arbiter generate

# Good - just test help/interface
$ arbiter generate --help
```

❌ **Don't test implementation details**
```
# Bad - internal data structures
$ arbiter list service --format=json | jq '.services[0].internal_id'

# Good - user-facing output
$ arbiter list service
.*api.* (re)
```

## Troubleshooting

### Tests fail with "command not found"

Ensure `arbiter` is in PATH:

```bash
# Option 1: Install CLI globally
bun add -g @sibyllinesoft/arbiter-cli

# Option 2: Use local binary
export PATH="$PWD/packages/cli:$PATH"

# Option 3: Use full path in tests
$ ../../packages/cli/dist/arbiter health
```

### Tests fail with server connection errors

Start the API server before running tests:

```bash
# Terminal 1
bun run dev

# Terminal 2
cram docs/tests/*.t
```

### Updating test expectations

Use interactive mode:

```bash
cram -i docs/tests/*.t
```

Press:
- `y` - Accept new output
- `n` - Keep old output
- `q` - Quit
- `?` - Show diff

## Examples

See:
- `docs/tests/cli-examples.t` - Example Cram test file
- `docs/tests/README.md` - Detailed Cram usage guide
- `packages/cli/src/__tests__/golden.test.ts` - Golden file tests

## Resources

- [Cram Documentation](https://bitheap.org/cram/)
- [MkDocs Hooks](https://www.mkdocs.org/user-guide/configuration/#hooks)
- [Bun Test](https://bun.sh/docs/cli/test)
