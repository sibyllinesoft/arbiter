#!/bin/bash

# ARBITER ACCEPTANCE SUITE RUNNER
# Runs the comprehensive acceptance test suite for TODO.md Section 12

set -euo pipefail

echo "🏗️  ARBITER ACCEPTANCE SUITE"
echo "Validating all 7 acceptance criteria from TODO.md Section 12"
echo "=========================================="

# Check dependencies
echo "🔍 Checking dependencies..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

# Check npm/bun
if ! command -v npm &> /dev/null && ! command -v bun &> /dev/null; then
    echo "❌ npm or bun is required but not installed"
    exit 1
fi

echo "✅ Dependencies verified"

# Build CLI if needed
echo "🔧 Building CLI packages..."
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    if command -v bun &> /dev/null; then
        bun install
    else
        npm install
    fi
    
    # Build packages
    echo "Building packages..."
    if command -v bun &> /dev/null; then
        bun run build 2>/dev/null || echo "⚠️  Build command not available, continuing..."
    else
        npm run build 2>/dev/null || echo "⚠️  Build command not available, continuing..."
    fi
fi

# Ensure CLI is executable
CLI_PATH="./packages/cli/src/cli.ts"
if [ ! -f "$CLI_PATH" ]; then
    echo "❌ CLI not found at $CLI_PATH"
    echo "Please ensure the project is built and CLI is available"
    exit 1
fi

echo "✅ CLI verified at $CLI_PATH"

# Make acceptance suite executable
chmod +x acceptance-suite.ts

# Run the acceptance suite
echo ""
echo "🚀 Starting Acceptance Test Suite..."
echo "This will validate all 7 criteria:"
echo "  1. Workflow Demo: TODO.md → requirements.cue → assembly.cue → SPECIFICATION.md → M1_IMPLEMENTATION.md → tests → green check"
echo "  2. Rust Surface: Non-empty extraction; breaking change flips required_bump=MAJOR" 
echo "  3. Watch: Edit file → validate/surface/gates update in ≤3s"
echo "  4. Tests: tests generate produces runnable suites; tests cover computes Contract Coverage"
echo "  5. Traceability: TRACE.json links REQ→SPEC→TEST→CODE with no dangling IDs"
echo "  6. Determinism: Identical inputs yield byte-identical outputs across two runs"
echo "  7. No 'not implemented' across commands listed in §§2–10"
echo ""

# Execute the acceptance suite
if command -v bun &> /dev/null; then
    echo "Using Bun runtime..."
    bun run acceptance-suite.ts
else
    echo "Using Node.js runtime..."
    # Use tsx or ts-node if available, otherwise compile first
    if command -v tsx &> /dev/null; then
        tsx acceptance-suite.ts
    elif command -v ts-node &> /dev/null; then
        ts-node acceptance-suite.ts
    else
        echo "Compiling TypeScript to JavaScript..."
        if command -v tsc &> /dev/null; then
            tsc acceptance-suite.ts --target ES2022 --module NodeNext --moduleResolution NodeNext --allowSyntheticDefaultImports
            node acceptance-suite.js
            rm -f acceptance-suite.js
        else
            echo "❌ No TypeScript runtime available. Please install bun, tsx, ts-node, or tsc"
            exit 1
        fi
    fi
fi

echo ""
echo "🏁 Acceptance suite complete!"