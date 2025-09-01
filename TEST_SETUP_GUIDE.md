# Test Setup Guide - Arbiter Project

## Quick Start

### Run All Tests
```bash
# Using the consolidated test runner
./test-runner.sh

# Or manually by package
bun run test  # Runs all packages via package.json
```

### Run Individual Packages
```bash
# Shared package (Zod schemas)
cd packages/shared && bun test

# API package (Backend tests)  
cd apps/api && bun test --timeout 15000

# Web package (Frontend tests) - requires setup
cd apps/web && bun run test
```

## Test Environment Setup

### Prerequisites
- **Bun**: Version 1.0+ installed
- **Node.js**: For web package dependencies  
- **SQLite**: For database testing (included with Bun)
- **Optional**: CUE CLI for full analysis testing

### Package-Specific Setup

#### Shared Package (`packages/shared`)
```bash
cd packages/shared
bun install  # Install dependencies
bun test     # Run tests
```
- **Test Runner**: Bun test
- **Dependencies**: Zod for schema validation
- **Runtime**: ~135ms

#### API Package (`apps/api`)
```bash
cd apps/api  
bun install  # Install dependencies
bun test     # Run tests with default timeout
bun test --timeout 15000  # Run with extended timeout
```
- **Test Runner**: Bun test
- **Dependencies**: SQLite, p-queue, isolated server components
- **Runtime**: ~76s for 160 tests
- **Database**: Uses in-memory SQLite for testing

#### Web Package (`apps/web`) - Requires Dependency Fix
```bash
cd apps/web

# Option 1: Try installing dependencies (may fail due to permissions)
bun install

# Option 2: If permission issues, use npm
npm install

# Option 3: Run tests with bunx (downloads vitest temporarily)  
bunx vitest run --reporter=verbose
```
- **Test Runner**: Vitest + React Testing Library
- **Dependencies**: React, jsdom, @testing-library/*
- **Status**: ⚠️ Dependency installation issues need resolution

## Test Architecture

### Backend Testing (Working)
```
apps/api/
├── server-isolated.ts     # Isolated testable components
├── test-types.ts         # Test-specific type definitions  
├── *.test.ts            # 8 test files with 160 tests total
└── test databases       # In-memory SQLite for testing
```

**Key Components**:
- **Isolated Testing**: Components extracted from main server for testability
- **Real Database**: Uses SQLite with real schema, in-memory for speed
- **Rate Limiting**: Tests include rate limit validation with unique client IDs
- **Integration**: Full HTTP + WebSocket workflow testing

### Frontend Testing (Pending)
```
apps/web/src/
├── __tests__/           # Main app tests
├── components/*/        # Component-specific tests  
├── hooks/              # Custom hook tests
├── services/__tests__/ # API service tests
└── design-system/      # UI component tests
```

**Key Components**:
- **Component Tests**: React Testing Library for component behavior
- **Hook Tests**: Custom hook testing with React hooks testing library  
- **Service Tests**: API client and WebSocket service testing
- **Design System**: Complete UI component library testing

### Shared Testing (Working)
```
packages/shared/src/
└── index.test.ts       # Schema and type validation
```

**Key Components**:
- **Schema Validation**: Zod schema testing with edge cases
- **Type Safety**: TypeScript type inference validation
- **API Contracts**: Request/response schema compliance

## Test Configuration Files

### API Package Configuration
- **Runner**: Built-in Bun test (no config file needed)
- **Timeout**: Configurable via `--timeout` flag
- **Database**: In-memory SQLite, created fresh for each test

### Web Package Configuration
The web package should have these config files:

#### `vitest.config.ts` (Expected)
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

#### `src/test/setup.ts` (Expected)
```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

## Common Testing Patterns

### API Testing Pattern
```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { IntegrationTestEnvironment } from './integration.test.ts';

describe('Feature Tests', () => {
  let env: IntegrationTestEnvironment;
  
  beforeEach(() => {
    env = new IntegrationTestEnvironment();
  });
  
  afterEach(() => {
    env.cleanup();
  });
  
  test('should handle feature scenario', async () => {
    const response = await env.simulateRequest(data);
    expect(response.status).toBe(200);
  });
});
```

### React Component Testing Pattern  
```typescript
import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import Component from './Component'

test('renders component correctly', () => {
  render(<Component prop="value" />)
  expect(screen.getByText('Expected Text')).toBeInTheDocument()
})
```

## Troubleshooting

### Common Issues

#### 1. Web Package Dependencies
**Problem**: `error: Failed to link` or `vitest: command not found`

**Solutions**:
```bash
# Option 1: Clear and reinstall
rm -rf node_modules bun.lockb
bun install

# Option 2: Use npm instead
rm -rf node_modules package-lock.json  
npm install

# Option 3: Run without installing  
bunx vitest run
```

#### 2. API Test Timeouts
**Problem**: Tests timeout during CUE analysis

**Solutions**:
```bash
# Increase timeout
bun test --timeout 30000

# Skip CUE-dependent tests if CUE CLI not available
# (Tests gracefully handle missing CUE CLI)
```

#### 3. Database Issues
**Problem**: SQLite permission or lock errors

**Solutions**:
```bash
# Clean up any leftover test databases
rm -f *.sqlite test-*.sqlite

# Ensure proper cleanup in tests
# (All tests should clean up in afterEach)
```

#### 4. Rate Limiting in Tests
**Problem**: Tests fail with 429 (Too Many Requests)

**Solution**: Already fixed - tests use unique client IDs to avoid rate limit conflicts.

## Continuous Integration

### GitHub Actions / CI Setup
```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      
      - name: Install dependencies
        run: bun install
        
      - name: Run tests
        run: ./test-runner.sh
```

### Local Development
```bash
# Watch mode for development
cd apps/api && bun test --watch
cd apps/web && bun run test:watch

# Coverage reports  
cd apps/api && bun test --coverage
cd apps/web && bun run test:coverage
```

## Performance Targets

### Test Execution Times
- **Shared**: < 1 second
- **API**: < 2 minutes (currently ~76s)  
- **Web**: < 30 seconds (when working)
- **Total**: < 3 minutes for full suite

### Reliability Targets
- **Pass Rate**: 100% (currently achieved for API + Shared)
- **Flaky Tests**: 0% (currently achieved)  
- **Coverage**: 90%+ for critical paths

## Next Steps

### Immediate (Fix Web Tests)
1. Resolve web package dependency installation
2. Validate all 27 web test files execute
3. Fix any broken web tests

### Short-term (Improve Coverage)
1. Add performance/load testing
2. Add E2E tests with Playwright  
3. Improve error scenario coverage

### Long-term (Advanced Testing)
1. Visual regression testing
2. Accessibility testing
3. Cross-browser testing

---

**Last Updated**: August 30, 2024  
**Status**: Backend tests fully operational, Web tests need dependency fix  
**Contact**: See project maintainers for issues with test setup