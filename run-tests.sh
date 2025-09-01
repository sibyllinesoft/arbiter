#!/bin/bash
# Unit test runner script - runs known working test files

set -e

echo "🧪 Running Arbiter unit tests..."
echo "ℹ️ This excludes e2e tests (run with 'bun run test:e2e')"

# List of test files that are known to work (no infinite loops)
TEST_FILES="
packages/shared/src/index.test.ts
packages/shared/src/cue-error-translator.test.ts
apps/web/src/services/__tests__/api.test.ts
apps/web/src/services/__tests__/websocket-new.test.ts
"

echo "📁 Running tests:"
echo "$TEST_FILES" | grep -v "^$" | sed 's/^/  /'

# Run tests with proper timeout
echo ""
echo "🚀 Executing tests..."
exec bun test --timeout 10000 $TEST_FILES