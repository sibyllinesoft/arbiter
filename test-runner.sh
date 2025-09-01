#!/bin/bash

# Arbiter Test Runner
# Consolidated test script for all packages

set -e

echo "🧪 Arbiter Test Suite Runner"
echo "============================"

# Function to run tests with proper error handling
run_tests() {
    local package=$1
    local command=$2
    local timeout=${3:-30}
    
    echo ""
    echo "📦 Testing $package..."
    echo "Command: $command"
    echo "Timeout: ${timeout}s"
    echo "---"
    
    cd "/media/nathan/Seagate Hub/Projects/arbiter/$package"
    
    if timeout ${timeout}s bash -c "$command"; then
        echo "✅ $package tests PASSED"
        return 0
    else
        echo "❌ $package tests FAILED"
        return 1
    fi
}

# Initialize counters
TOTAL=0
PASSED=0
FAILED=0

# Test Shared Package
if run_tests "packages/shared" "bun test" 15; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))

# Test API Package  
if run_tests "apps/api" "bun test --timeout 15000" 120; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))

# Test Web Package (with dependency check)
echo ""
echo "📦 Testing apps/web..."
echo "Command: Check dependencies and run vitest"
echo "---"

cd "/media/nathan/Seagate Hub/Projects/arbiter/apps/web"

# Check if node_modules exists and has vitest
if [ -f "node_modules/.bin/vitest" ] || command -v vitest &> /dev/null; then
    if timeout 60s bash -c "npm test 2>/dev/null || bunx vitest run --reporter=verbose"; then
        echo "✅ apps/web tests PASSED"
        PASSED=$((PASSED + 1))
    else
        echo "❌ apps/web tests FAILED"
        FAILED=$((FAILED + 1))
    fi
else
    echo "⚠️  apps/web tests SKIPPED - Dependencies not installed"
    echo "   Run 'bun install' to install dependencies"
fi
TOTAL=$((TOTAL + 1))

# Summary
echo ""
echo "📊 Test Summary"  
echo "==============="
echo "Total packages: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "💥 Some tests failed"
    exit 1
fi