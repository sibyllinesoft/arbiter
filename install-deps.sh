#!/bin/bash
# Install CUE and jq CLIs for Spec Workbench
# Generated on: 2025-08-27

set -euo pipefail  # Exit on any error

echo "🔍 Checking system requirements..."
if ! command -v jq &> /dev/null; then
    echo "jq not found, please install with: sudo apt install jq"
    exit 1
fi

echo "📦 Installing CUE CLI..."
if [ ! -f "./cue" ]; then
    curl -L https://github.com/cue-lang/cue/releases/download/v0.8.2/cue_v0.8.2_linux_amd64.tar.gz | tar xz
fi

sudo mv cue /usr/local/bin/cue
sudo chmod +x /usr/local/bin/cue

echo "✅ Verifying installation..."
cue version
jq --version

echo "🎉 Installation complete!"
echo "Now restart the server with: PORT=4000 AUTH_REQUIRED=false bun run dev"