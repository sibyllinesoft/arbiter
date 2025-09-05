#!/bin/bash

# Arbiter CLI Usage Demonstration for External Agents
# ====================================================
# 
# This script demonstrates how external agents can easily use the Arbiter CLI
# for CUE validation, schema management, and automation tasks.

echo "🚀 Arbiter CLI Distribution Demo"
echo "==============================="
echo

echo "📋 1. CLI Information and Status"
echo "--------------------------------"
echo "CLI Version and Runtime:"
./arbiter-cli.mjs --version
echo

echo "System Information:"
./arbiter-cli.mjs --info
echo

echo "Dependency Status:"
./arbiter-cli.mjs --deps-check
echo

echo "Self-Test Results:"
./arbiter-cli.mjs --self-test
echo

echo "📖 2. Available Commands Preview"
echo "--------------------------------"
echo "Help Information:"
./arbiter-cli.mjs --help
echo

echo "🔧 3. Installation Options"
echo "--------------------------"
echo "Option 1: Direct usage from project root"
echo "  ./arbiter-cli.mjs <command>"
echo

echo "Option 2: Global installation"
echo "  ./install-cli.sh"
echo "  arbiter <command>"
echo

echo "Option 3: npm package manager"
echo "  npm install arbiter"
echo "  npx arbiter <command>"
echo

echo "🤖 4. Agent-Friendly Features"
echo "-----------------------------"
echo "• JSON output support for all commands"
echo "• Predictable exit codes for automation"
echo "• Built-in dependency validation"
echo "• Self-contained with minimal dependencies"
echo "• Comprehensive error messages with suggestions"
echo

echo "✅ CLI Distribution System Ready!"
echo "External agents can clone this repo and immediately use the CLI."