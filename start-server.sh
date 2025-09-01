#!/bin/bash
# Arbiter Server Startup Script
# Generated on: 2025-08-31

set -euo pipefail

echo "🔍 Checking system requirements..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun first."
    exit 1
fi

echo "📦 Installing dependencies..."
if ! bun install; then
    echo "⚠️  Dependencies installation failed. Trying to run without full install..."
fi

echo "🚀 Starting Arbiter server..."
echo "This will start both the API and Web servers concurrently."

# Try to start the development servers
bun run --cwd apps/api dev &
API_PID=$!

bun run --cwd apps/web dev &
WEB_PID=$!

echo "🎉 Servers started!"
echo "API Server PID: $API_PID"
echo "Web Server PID: $WEB_PID"
echo ""
echo "To stop the servers, run:"
echo "kill $API_PID $WEB_PID"

# Wait for both processes
wait $API_PID $WEB_PID