#!/bin/bash
# Coverage test runner - generates coverage even if tests fail

set +e  # Don't exit on test failures

echo "📊 Running Arbiter tests with coverage..."
echo "ℹ️ Test failures won't block coverage generation"

# List of test files that are known to work (no infinite loops)
TEST_FILES="
packages/shared/src/index.test.ts
packages/shared/src/cue-error-translator.test.ts
apps/web/src/services/__tests__/api.test.ts
apps/web/src/services/__tests__/websocket-new.test.ts
"

echo "📁 Running tests:"
echo "$TEST_FILES" | grep -v "^$" | sed 's/^/  /'

# Clean up previous coverage
rm -rf reports/cleanup/coverage/*

echo ""
echo "🚀 Executing tests with coverage..."

# Run tests with coverage, capture exit code but don't exit
bun test --timeout 10000 --coverage --coverage-dir reports/cleanup/coverage --coverage-reporter lcov $TEST_FILES
TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "⚠️ Some tests failed (exit code: $TEST_EXIT_CODE), but coverage was still generated"
fi

# Check if coverage files were generated
if [ -f "reports/cleanup/coverage/lcov.info" ]; then
    echo "📈 Coverage report generated: reports/cleanup/coverage/lcov.info"
    
    # Generate text coverage summary using basic unix tools
    echo ""
    echo "📊 Coverage Summary (from LCOV data):"
    echo "----------------------------------------"
    
    # Extract coverage stats from LCOV
    LINES_FOUND=$(grep -c "^DA:" reports/cleanup/coverage/lcov.info)
    LINES_HIT=$(grep "^DA:" reports/cleanup/coverage/lcov.info | grep -c ",0$" | awk -v total="$LINES_FOUND" '{print total - $1}')
    
    if [ "$LINES_FOUND" -gt 0 ]; then
        COVERAGE_PERCENT=$(echo "scale=1; $LINES_HIT * 100 / $LINES_FOUND" | bc -l 2>/dev/null || echo "N/A")
        echo "Line Coverage: $LINES_HIT/$LINES_FOUND lines covered ($COVERAGE_PERCENT%)"
    else
        echo "Line Coverage: Unable to calculate"
    fi
    
    # Count functions
    FUNCTIONS_FOUND=$(grep -c "^FNDA:" reports/cleanup/coverage/lcov.info)
    if [ "$FUNCTIONS_FOUND" -gt 0 ]; then
        echo "Functions: $FUNCTIONS_FOUND functions found"
    fi
    
    # Count source files
    FILES_COVERED=$(grep -c "^SF:" reports/cleanup/coverage/lcov.info)
    echo "Files: $FILES_COVERED files analyzed"
    
    echo "----------------------------------------"
    echo "📄 Full report available in: reports/cleanup/coverage/lcov.info"
    
    # Try to generate HTML if genhtml is available
    if command -v genhtml >/dev/null 2>&1; then
        echo "🌐 Generating HTML coverage report..."
        genhtml reports/cleanup/coverage/lcov.info -o reports/cleanup/coverage/html --title "Arbiter Coverage" --legend
        if [ $? -eq 0 ]; then
            echo "📂 HTML report generated: reports/cleanup/coverage/html/index.html"
        else
            echo "⚠️ HTML generation failed, but LCOV report is available"
        fi
    else
        echo "ℹ️ Install lcov (genhtml) for HTML coverage reports: sudo apt-get install lcov"
    fi
else
    echo "❌ Coverage report not generated"
    exit 1
fi

echo ""
echo "🎯 Coverage setup complete! Use 'bun run test:coverage' for future runs."

# Exit with original test result for CI purposes, but don't fail coverage generation
exit $TEST_EXIT_CODE