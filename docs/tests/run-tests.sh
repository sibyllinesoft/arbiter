#!/bin/bash
# Test runner for Arbiter CLI documentation examples
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Determine arbiter location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARBITER_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARBITER_CLI="$ARBITER_ROOT/packages/cli/dist/cli.js"

# Check if CLI is built
if [ ! -f "$ARBITER_CLI" ]; then
    echo -e "${RED}Error: CLI not built at $ARBITER_CLI${NC}"
    echo "Run: cd $ARBITER_ROOT/packages/cli && bun run build"
    exit 1
fi

# Create a temporary wrapper script for 'arbiter' command
TEMP_DIR=$(mktemp -d)
ARBITER_WRAPPER="$TEMP_DIR/arbiter"

cat > "$ARBITER_WRAPPER" << 'EOF'
#!/bin/bash
exec node "$ARBITER_CLI" "$@"
EOF

# Make it executable and set environment variable
chmod +x "$ARBITER_WRAPPER"
export ARBITER_CLI
export PATH="$TEMP_DIR:$PATH"

# Function to cleanup
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Check if cram is installed
if ! command -v cram &> /dev/null; then
    echo -e "${YELLOW}Warning: cram not installed. Installing...${NC}"
    pip install cram
fi

# Run cram tests
echo -e "${GREEN}Running Arbiter CLI documentation tests...${NC}"
echo "Using arbiter CLI: $ARBITER_CLI"
echo "Tests directory: $SCRIPT_DIR"
echo ""

# Run all .t files
if [ $# -eq 0 ]; then
    cram "$SCRIPT_DIR"/*.t
else
    cram "$@"
fi
