# Repository Inventory - Phase 0

Generated: 2025-01-09

## Languages & Ecosystems

### Primary Language Stack
- **TypeScript/JavaScript**: Primary language across all applications
  - Node.js runtime via Bun (>=1.0.0)
  - ESM modules (`"type": "module"`)
  - TypeScript 5.x series

### Package Managers & Build Tools
- **Bun**: Primary runtime and package manager
- **npm/pnpm**: Workspace configuration present (`pnpm-workspace.yaml`)
- **Vite**: Frontend build tool (apps/web)
- **TypeScript**: Type checking across all packages

### Framework Detection
- **Frontend (apps/web)**:
  - React 18.3.1 with TypeScript
  - Vite build system
  - Monaco Editor integration
  - Storybook for component development
  - Tailwind CSS for styling

- **Backend (apps/api)**:
  - Bun server runtime
  - WebSocket support (collaborative features)
  - Zod for validation

## Test Runners Present

### Active Test Runners
- **bun test**: Primary test runner
  - Root: `bun test` 
  - Coverage: `bun test --coverage` (apps/api)
  - Watch mode available
- **Playwright**: E2E testing
  - Configuration: `playwright.config.ts`
  - Headless and interactive modes
- **Vitest**: Frontend unit testing (apps/web)
  - Coverage with v8 provider
  - UI mode available
- **Storybook**: Component testing and documentation

### Test Script Matrix
```bash
# Root level
bun test                    # Unit tests
bun run test:all           # Full suite (typecheck + test + tutorial + e2e)  
bun run test:e2e           # Playwright tests
bun run test:tutorial      # Tutorial validation
bun run test:chaos         # Chaos testing suite

# Package level  
apps/api: bun test, bun test --coverage
apps/web: vitest
```

### Chaos Testing
- Custom chaos testing framework in `scripts/run-chaos-tests.sh`
- Multiple modes: quick, network, crdt, realworld
- CI-specific configuration

## CI Configuration Files

### GitHub Actions (.github/workflows/)
- `fast-feedback.yml` - Quick validation
- `integration-tests.yml` - Integration testing  
- `e2e-tests.yml` - End-to-end testing
- `performance-security-gates.yml` - Quality gates
- `deployment.yml` - Deployment pipeline
- `workflow-orchestration.yml` - Workflow coordination
- `agentic-ci.yml` - AI-powered CI
- `validate-architecture.yml` - Architecture validation
- `epic-execution.yml` - Epic-based workflows

### Other Build Configuration
- `Makefile` - Build automation
- `biome.json` - Code formatting and linting
- `playwright.config.ts` - E2E test configuration  
- `chaos.config.js` - Chaos testing configuration
- `docker-compose.yml` - Container orchestration
- Multiple Dockerfiles (Dockerfile, Dockerfile.agent)

## Symlinks

| Path | Target | Type | Status |
|------|--------|------|--------|
| *No symlinks detected* | - | - | None found in repository root |

*Note: Symlink scan completed for root and immediate subdirectories. No symbolic links detected.*

## Test Coverage Status

**Coverage Status**: ❌ **Coverage Missing** - Test execution failed due to configuration issues

Coverage tools detected:
- `@vitest/coverage-v8` (apps/web)  
- `bun test --coverage` (apps/api)

**Critical Issues Identified**:
1. **Dependency Resolution**: Missing vite dependency in apps/web
2. **Test Environment Conflicts**: Playwright tests interfering with unit test runners  
3. **Workspace Dependencies**: Potential workspace package installation issues
4. **Test Timeouts**: Tests hanging for >2 minutes indicating configuration problems

## Monorepo Structure

### Applications (`apps/`)
- `apps/api` - Backend API service (Bun + TypeScript)
- `apps/web` - Frontend React application (Vite + TypeScript)

### Packages (`packages/`)
- `packages/shared` - Shared types and utilities
- `packages/benchmarks` - Performance benchmarking  
- `packages/security` - Security scanning
- `packages/agentic-ci` - AI-powered CI/CD
- `packages/cli` - Command line interface
- `packages/sdk` - Software development kit
- `packages/agent` - Agent framework

### Supporting Directories
- `.github/` - CI/CD workflows and actions
- `docs/` - Documentation
- `examples/` - Code examples
- `scripts/` - Build and automation scripts
- `tests/` - Test utilities and fixtures
- `benchmarks/` - Performance benchmarks
- `e2e/` - End-to-end tests
- `spec/` - Specifications (CUE format)

## Quality Tools

### Linting & Formatting
- **Biome**: Primary linter and formatter
- **ESLint**: Frontend-specific linting (apps/web)
- **Prettier**: Code formatting (apps/web)
- **TypeScript**: Strict type checking

### Security & Quality
- `syft` - SBOM generation
- Security scanning in packages/security
- Performance benchmarking in packages/benchmarks

## Phase 0 Summary

### ✅ Successfully Completed
- Repository structure analysis
- Language/ecosystem detection (TypeScript/Bun primary stack)
- Test runner identification (bun test, vitest, playwright)
- CI configuration mapping (8 GitHub Actions workflows)  
- Symlink audit (none found)
- Test file inventory (100+ test files across repository)

### ❌ Critical Issues Discovered
- **Test Execution Blocked**: Cannot establish baseline due to configuration issues
- **Dependency Problems**: Missing critical dependencies (vite) preventing test startup
- **Test Environment Conflicts**: Mixed test runners causing interference
- **Coverage Data Missing**: Unable to capture baseline coverage metrics

### 📊 Repository Health Assessment
- **Structure**: ✅ Well-organized monorepo with clear separation
- **Configuration**: ⚠️ Mixed - good CI setup but test environment issues  
- **Dependencies**: ❌ Critical gaps preventing basic operations
- **Documentation**: ✅ Extensive documentation and specifications

## Next Steps - Phase 1 Priority

1. **CRITICAL**: Fix dependency installation and test environment
2. Establish working baseline test execution
3. Capture actual coverage metrics
4. Document real test failures and gaps (not configuration issues)
5. Create cleanup priorities based on actual test results

**Recommendation**: Phase 1 should focus heavily on establishing a working development environment before proceeding with deeper cleanup tasks.