# Scripts Directory

This directory contains automation scripts for the Arbiter project.

## Local CI

The project provides both cross-platform and Unix-specific CI scripts:

### Cross-Platform (Recommended)

```bash
# Works on Windows, macOS, and Linux
bun run ci
# or directly:
bun scripts/local-ci.ts
```

### Unix/Linux/macOS Only (Legacy)

```bash
# Requires bash shell
bun run ci:legacy
# or directly:
./scripts/local-ci.sh
```

## Features

Both scripts perform the same validation steps:

1. Install dependencies
2. Check formatting & linting
3. Type check TypeScript project references
4. Run unit and integration tests
5. Build all workspaces
6. Audit dependencies

The TypeScript version (`local-ci.ts`) is recommended as it provides:

- Cross-platform compatibility (Windows, macOS, Linux)
- Better error handling and reporting
- Consistent behavior across environments
- Signal handling for graceful interruption

## Development

When modifying CI logic, update the TypeScript version (`local-ci.ts`) as the
primary implementation. The shell script (`local-ci.sh`) is maintained for
backward compatibility but marked as deprecated.
