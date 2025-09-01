# Repository Hardening Plan - Phase 1

Generated: 2025-01-09  
Baseline SHA: [from BASELINE_SHA.txt]

## Executive Summary

Phase 1 focuses on establishing a stable, maintainable foundation without changing user-facing functionality. Critical test environment issues prevent baseline establishment, making dependency stabilization the highest priority.

## Goals & Non-Goals

### 🎯 Primary Targets
- **Bring tests green**: Resolve Playwright/Bun test conflicts and syntax errors
- **Line coverage ≥ 85%**: Establish coverage thresholds (or current+10pp if lower) 
- **Zero linter errors**: Fix Biome configuration and code quality issues
- **Docs accurate**: Reconcile README/API/CLI discrepancies with actual implementation
- **Remove dead code**: Eliminate unused files and functions (no public surface changes)
- **Unify formatting**: Consistent code style across all packages

### ❌ Explicit Non-Goals  
- ❌ **Adding features**: No new functionality or capabilities
- ❌ **Changing public APIs**: HTTP schemas, CLI UX, or UI strings (beyond typo fixes)
- ❌ **Architectural refactoring**: Large-scale code organization changes
- ❌ **Dependency upgrades**: Major version bumps unless critical for stability

## Critical Issues Identified

### 🚨 Blocker: Test Environment Conflicts
- **Playwright vs Bun test**: E2E tests interfering with unit test execution
- **Missing dependencies**: Vite and other critical dev dependencies missing
- **Syntax errors**: Unterminated string literal in `tests/schema-validation.test.ts:576`
- **Runner conflicts**: Mixed test runners causing configuration interference

### ⚠️ Quality Issues  
- **Biome not installed**: Linting/formatting currently non-functional
- **Coverage gaps**: Unable to establish baseline coverage metrics
- **Inconsistent configuration**: Mixed ESLint/Prettier/Biome configuration

## Work Packets

### Packet 1: Dependency & Environment Stabilization (4-6h) 🔥
**Priority: Critical - Nothing else works until this is fixed**

```bash
# Objectives
- Fix missing dependencies (vite, @biomejs/biome installation)
- Resolve Playwright test import conflicts with Bun test
- Establish working test runners for each package
- Fix syntax errors blocking test execution
```

**Tasks:**
1. **Dependency audit and installation**
   - Run `bun install` and resolve missing dependencies
   - Install missing `@biomejs/biome` globally or locally
   - Verify all workspace packages can resolve dependencies

2. **Test runner separation** 
   - Configure Playwright tests to run separately (`test:e2e` only)
   - Isolate `bun test` for unit tests (exclude e2e directory)
   - Update test script configurations to prevent interference

3. **Syntax error fixes**
   - Fix unterminated string literal in `tests/schema-validation.test.ts:576`
   - Scan for other syntax errors preventing test execution

4. **Validation**
   - `bun test` runs without Playwright conflicts
   - `bun run test:e2e` runs separately without issues
   - All packages can execute their individual test suites

### Packet 2: Lint/Format Baselining (4-6h)
**Priority: High - Needed for code quality consistency**

```bash
# Objectives  
- Establish working Biome linter/formatter
- Resolve existing lint errors to establish clean baseline
- Unify formatting across monorepo packages
```

**Tasks:**
1. **Biome configuration verification**
   - Ensure `biome.json` configuration is applied properly
   - Test `bun run lint` and `bun run format:check` execution
   - Validate Biome installation across development environments

2. **Existing lint error resolution**
   - Run `biome lint .` and categorize errors by severity
   - Fix critical errors (syntax issues, unused variables)
   - Create baseline with remaining warnings (non-breaking)

3. **Format standardization**
   - Run `biome format --write .` to establish consistent style
   - Resolve conflicts between Biome/ESLint/Prettier configurations
   - Commit formatting-only changes in dedicated commits

4. **Package-level linting**
   - Verify individual package lint configurations
   - Ensure apps/web ESLint config doesn't conflict with root Biome
   - Test lint execution in CI environment

### Packet 3: Test Stabilization & Quarantine Flaky Tests (6-8h)
**Priority: High - Required for reliable development**

```bash
# Objectives
- Identify and quarantine flaky/broken tests
- Establish reliable test execution baseline  
- Separate stable tests from problematic ones
```

**Tasks:**
1. **Test execution audit**
   - Run each test suite individually and record results
   - Identify consistently failing tests vs flaky/intermittent failures
   - Document test failures by category (env issues, code issues, timing)

2. **Flaky test quarantine**
   - Move consistently failing tests to `tests/__quarantine__/` directory
   - Create `.test.skip.ts` versions with documented reasons for failure
   - Maintain test structure but prevent CI blocking

3. **Stable test baseline**
   - Ensure remaining tests pass consistently (3+ runs)
   - Fix tests with simple environmental fixes (timeouts, assertions)
   - Establish "green" test suite for CI gates

4. **Test configuration cleanup**
   - Verify test configurations in each package
   - Standardize timeout/retry settings across test runners
   - Document test running procedures for development

### Packet 4: Coverage Enablement & Thresholds (4-6h) 
**Priority: Medium - Non-blocking initially, critical for maintainability**

```bash
# Objectives
- Establish working coverage measurement
- Set achievable coverage thresholds (non-blocking initially) 
- Create coverage reporting for all packages
```

**Tasks:**
1. **Coverage tooling setup**
   - Configure `bun test --coverage` for packages with coverage support
   - Setup Vitest coverage for apps/web
   - Ensure coverage reports are generated consistently

2. **Baseline coverage measurement**
   - Capture current coverage across all testable code
   - Identify packages/modules with zero coverage
   - Document coverage by package and critical code paths

3. **Threshold establishment**
   - Set initial thresholds at current coverage levels
   - Plan incremental increases (current+10pp or 85%, whichever lower)
   - Configure coverage as informational, not blocking initially

4. **Coverage reporting**
   - Generate coverage reports in standardized formats
   - Set up coverage visualization/dashboards if possible
   - Document coverage goals and measurement procedures

### Packet 5: Dead Code & Duplicate Elimination (6-8h)
**Priority: Medium - Maintenance and clarity improvement**

```bash
# Objectives
- Remove unused files, functions, and imports
- Eliminate code duplication without behavior changes
- Clean up development artifacts and test fixtures
```

**Tasks:**
1. **Dead file identification**
   - Scan for unused files in src/ directories  
   - Identify orphaned test files and fixtures
   - Remove commented-out code blocks and TODO artifacts

2. **Unused import cleanup**
   - Use automated tools to identify unused imports
   - Remove orphaned utility functions and constants
   - Clean up unused dependencies (dev and runtime)

3. **Duplication analysis**
   - Identify duplicated functions/logic across packages
   - Consolidate common utilities into packages/shared
   - Maintain identical behavior, only location changes

4. **Development artifact cleanup**  
   - Remove debug console.log statements
   - Clean up temporary files and development scripts
   - Remove unused configuration files and stale comments

### Packet 6: Documentation Reconciliation (4-6h)
**Priority: Medium - Critical for maintainability and onboarding**

```bash
# Objectives
- Align documentation with actual implementation
- Fix API/CLI documentation discrepancies
- Update build/development instructions
```

**Tasks:**
1. **README accuracy audit**
   - Verify installation and setup instructions work
   - Test all documented commands and scripts
   - Update dependency requirements and Node/Bun versions

2. **API documentation sync**
   - Compare API documentation with actual HTTP endpoints
   - Update schema documentation to match Zod schemas
   - Verify WebSocket API documentation

3. **CLI documentation update**
   - Test all documented CLI commands
   - Update help text and command documentation
   - Verify package scripts match documented workflows

4. **Development guide accuracy**
   - Test development setup instructions
   - Update test running and debugging procedures
   - Verify CI/CD pipeline documentation

### Packet 7: CI Tightening (4-6h)
**Priority: High - Prevents regression and ensures quality**

```bash
# Objectives
- Enforce lint, test, and coverage gates in CI
- Establish fast feedback loops for developers
- Prevent regression of cleanup work
```

**Tasks:**
1. **Fast feedback pipeline**
   - Ensure lint and typecheck run in <2 minutes
   - Configure parallel test execution where possible
   - Set up proper test result reporting

2. **Quality gates enforcement**
   - Enable lint errors as CI failures
   - Set coverage thresholds as warnings initially, then errors
   - Ensure test failures properly fail CI builds

3. **CI configuration cleanup**
   - Remove redundant or broken workflow steps
   - Standardize CI environment setup across workflows
   - Ensure consistent Node/Bun versions in CI and local development

4. **Developer experience**
   - Create pre-commit hooks for linting and formatting
   - Document CI requirements and debugging procedures
   - Ensure CI feedback is clear and actionable

### Packet 8: Final Pass - Small Refactors (4-6h)
**Priority: Low - Polish and maintainability improvements**

```bash
# Objectives  
- Reduce complexity without behavior changes
- Improve code readability and maintainability
- Apply safe, mechanical refactors
```

**Tasks:**
1. **Complexity reduction**
   - Break up large functions (>50 lines) into smaller functions
   - Simplify nested conditionals and loops
   - Extract constants from magic numbers and strings

2. **Code clarity improvements**
   - Improve variable and function naming
   - Add JSDoc comments to public functions
   - Standardize error handling patterns

3. **Type safety improvements**
   - Add missing TypeScript types
   - Remove `any` types where possible
   - Improve type definitions in shared packages

4. **Final validation**
   - Run full test suite and verify all quality gates pass
   - Ensure no behavioral changes introduced
   - Document any remaining technical debt or improvement opportunities

## Success Criteria

### ✅ Phase 1 Complete When:
- [ ] All tests execute without configuration errors
- [ ] Test suite passes consistently (can run 5 times without failure)
- [ ] Line coverage ≥ 85% (or current+10pp) with measurement working
- [ ] `bun run lint` returns zero errors
- [ ] All README instructions work for new developer setup
- [ ] CI builds pass with quality gates enabled
- [ ] No dead code or unused imports remain in src/ directories
- [ ] Code style is consistent across all packages

### 📊 Quality Metrics Tracking
- **Test execution time**: Target <30s for unit tests, <5min for full suite
- **Lint error count**: Target 0 errors, <10 warnings
- **Coverage by package**: Document baseline and track improvements
- **Build success rate**: Target 95%+ successful CI builds

## Risk Mitigation

### 🔄 Rollback Strategy
- Each packet is committed separately for easy rollback
- Critical changes (dependency updates) tested in isolation
- Original configurations preserved as `.backup` files during major changes

### 🧪 Testing Strategy  
- Test each packet's changes in isolation
- Run full test suite after each packet completion
- Verify no behavioral changes using existing integration tests

### 📞 Escalation Criteria
- If any packet takes >10 hours, reassess scope and break down further
- If test environment issues persist after Packet 1, escalate for architecture review
- If coverage measurement cannot be established, proceed with other quality metrics

## Timeline Estimate

**Total: 30-42 hours across 8 work packets**

- **Week 1**: Packets 1-2 (Critical stabilization)
- **Week 2**: Packets 3-4 (Test and coverage baseline)  
- **Week 3**: Packets 5-6 (Cleanup and documentation)
- **Week 4**: Packets 7-8 (CI and final polish)

**Dependencies**: Packets 1-2 must complete before others. Packets 3-6 can run in parallel after environment stabilization.

---

*This plan prioritizes stability and maintainability improvements without changing user-facing functionality. Each packet builds on the previous to establish a solid foundation for future development.*