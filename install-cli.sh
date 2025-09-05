#!/bin/bash

# Arbiter CLI Global Installation Script
# =====================================
# 
# This script installs the Arbiter CLI globally for easy access from anywhere.
# It handles different runtime environments (Node.js/Bun) and provides robust
# error handling with helpful user feedback.

set -euo pipefail  # Exit on any error, undefined variables, or pipe failures

# Configuration
readonly SCRIPT_NAME="Arbiter CLI Installer"
readonly SCRIPT_VERSION="1.0.0"
readonly REQUIRED_NODE_VERSION="18"
readonly CLI_NAME="arbiter"
readonly REPO_URL="https://github.com/nathanrice/arbiter"

# Colors for output (if terminal supports it)
if [[ -t 1 ]]; then
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[1;33m'
    readonly BLUE='\033[0;34m'
    readonly CYAN='\033[0;36m'
    readonly BOLD='\033[1m'
    readonly NC='\033[0m' # No Color
else
    readonly RED=''
    readonly GREEN=''
    readonly YELLOW=''
    readonly BLUE=''
    readonly CYAN=''
    readonly BOLD=''
    readonly NC=''
fi

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

log_header() {
    echo -e "${BOLD}${CYAN}$1${NC}"
}

# Print banner
print_banner() {
    echo
    log_header "🚀 $SCRIPT_NAME v$SCRIPT_VERSION"
    echo -e "${CYAN}─────────────────────────────────────────${NC}"
    echo
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect runtime environment
detect_runtime() {
    if command_exists bun; then
        local bun_version
        bun_version=$(bun --version 2>/dev/null || echo "unknown")
        log_info "Detected Bun runtime: v$bun_version"
        echo "bun"
        return 0
    fi
    
    if command_exists node; then
        local node_version
        node_version=$(node --version 2>/dev/null || echo "unknown")
        local major_version
        major_version=$(echo "$node_version" | sed 's/^v//' | cut -d. -f1)
        
        if [[ "$major_version" -ge "$REQUIRED_NODE_VERSION" ]]; then
            log_info "Detected Node.js runtime: $node_version"
            echo "node"
            return 0
        else
            log_error "Node.js version $node_version is too old. Minimum required: v$REQUIRED_NODE_VERSION"
            return 1
        fi
    fi
    
    log_error "Neither Node.js ($REQUIRED_NODE_VERSION+) nor Bun found"
    log_info "Please install one of the following:"
    log_info "  • Node.js: https://nodejs.org/ (v$REQUIRED_NODE_VERSION or later)"
    log_info "  • Bun: https://bun.sh/"
    return 1
}

# Check if we're in the Arbiter project directory
check_project_directory() {
    if [[ ! -f "arbiter-cli.mjs" ]]; then
        log_error "arbiter-cli.mjs not found in current directory"
        log_info "Please run this script from the Arbiter project root directory"
        return 1
    fi
    
    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found in current directory"
        log_info "Please run this script from the Arbiter project root directory"
        return 1
    fi
    
    if [[ ! -d "packages/cli/dist" ]]; then
        log_error "packages/cli/dist not found"
        log_info "Please build the CLI first: bun run build:cli"
        return 1
    fi
    
    log_success "Project directory structure verified"
}

# Install dependencies if needed
install_dependencies() {
    local runtime="$1"
    
    log_info "Checking dependencies..."
    
    case "$runtime" in
        "bun")
            if [[ ! -f "bun.lockb" ]] && [[ ! -d "node_modules" ]]; then
                log_info "Installing dependencies with Bun..."
                bun install || {
                    log_error "Failed to install dependencies with Bun"
                    return 1
                }
            fi
            ;;
        "node")
            if [[ ! -d "node_modules" ]]; then
                if command_exists npm; then
                    log_info "Installing dependencies with npm..."
                    npm install || {
                        log_error "Failed to install dependencies with npm"
                        return 1
                    }
                else
                    log_error "npm not found, cannot install dependencies"
                    return 1
                fi
            fi
            ;;
    esac
    
    log_success "Dependencies ready"
}

# Build CLI if needed
build_cli() {
    local runtime="$1"
    
    if [[ ! -f "packages/cli/dist/cli.js" ]]; then
        log_info "Building CLI..."
        
        case "$runtime" in
            "bun")
                bun run build:cli 2>/dev/null || {
                    log_warning "build:cli script not found, attempting direct build..."
                    # Fallback build command
                    if [[ -d "packages/cli/src" ]]; then
                        bun build packages/cli/src/cli.ts --outdir=packages/cli/dist --target=node || {
                            log_error "Failed to build CLI"
                            return 1
                        }
                    fi
                }
                ;;
            "node")
                if command_exists npm; then
                    npm run build:cli 2>/dev/null || {
                        log_warning "build:cli script not found"
                        log_info "CLI may need to be built manually"
                    }
                fi
                ;;
        esac
        
        if [[ ! -f "packages/cli/dist/cli.js" ]]; then
            log_error "CLI build failed - packages/cli/dist/cli.js not found"
            return 1
        fi
    fi
    
    log_success "CLI build verified"
}

# Get installation directory
get_install_dir() {
    # Check common installation directories
    local install_dirs=(
        "$HOME/.local/bin"
        "/usr/local/bin"
        "$HOME/bin"
    )
    
    for dir in "${install_dirs[@]}"; do
        if [[ -d "$dir" ]] && [[ ":$PATH:" == *":$dir:"* ]]; then
            echo "$dir"
            return 0
        fi
    done
    
    # Default to ~/.local/bin and create if needed
    local default_dir="$HOME/.local/bin"
    mkdir -p "$default_dir"
    
    # Add to PATH if not already there
    if [[ ":$PATH:" != *":$default_dir:"* ]]; then
        log_warning "$default_dir is not in your PATH"
        log_info "Add this line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        log_info "  export PATH=\"\$PATH:$default_dir\""
    fi
    
    echo "$default_dir"
}

# Create global symlink/wrapper
create_global_command() {
    local install_dir="$1"
    local source_path
    source_path=$(realpath "arbiter-cli.mjs")
    local target_path="$install_dir/$CLI_NAME"
    
    # Remove existing installation
    if [[ -f "$target_path" ]] || [[ -L "$target_path" ]]; then
        log_info "Removing existing installation..."
        rm -f "$target_path"
    fi
    
    # Create symlink or wrapper script
    if command -v ln >/dev/null 2>&1; then
        ln -sf "$source_path" "$target_path" || {
            log_error "Failed to create symlink"
            return 1
        }
        log_success "Created symlink: $target_path -> $source_path"
    else
        # Fallback: create wrapper script
        cat > "$target_path" << EOF
#!/bin/bash
exec "$source_path" "\$@"
EOF
        chmod +x "$target_path"
        log_success "Created wrapper script: $target_path"
    fi
    
    # Verify installation
    if [[ -x "$target_path" ]]; then
        log_success "Installation completed successfully"
        return 0
    else
        log_error "Installation verification failed"
        return 1
    fi
}

# Run installation tests
run_tests() {
    local install_dir="$1"
    local cli_path="$install_dir/$CLI_NAME"
    
    log_info "Running installation tests..."
    
    # Test 1: Command exists and is executable
    if [[ ! -x "$cli_path" ]]; then
        log_error "Test failed: CLI not executable at $cli_path"
        return 1
    fi
    
    # Test 2: Version check
    if ! "$cli_path" --version >/dev/null 2>&1; then
        log_error "Test failed: Version check failed"
        return 1
    fi
    
    # Test 3: Help check
    if ! "$cli_path" --help >/dev/null 2>&1; then
        log_error "Test failed: Help check failed"
        return 1
    fi
    
    # Test 4: Self-test if available
    if "$cli_path" --self-test >/dev/null 2>&1; then
        log_success "Self-test passed"
    else
        log_warning "Self-test not available or failed (non-critical)"
    fi
    
    log_success "All tests passed"
}

# Print usage information
print_usage() {
    local install_dir="$1"
    local cli_path="$install_dir/$CLI_NAME"
    
    echo
    log_header "🎉 Installation Complete!"
    echo
    log_info "The Arbiter CLI has been installed to: $cli_path"
    echo
    log_info "Usage examples:"
    echo "  $CLI_NAME --version          # Show version"
    echo "  $CLI_NAME --help             # Show help"
    echo "  $CLI_NAME init my-project    # Initialize new project"
    echo "  $CLI_NAME watch              # Watch and validate files"
    echo "  $CLI_NAME check              # Validate CUE files"
    echo "  $CLI_NAME health             # Check server health"
    echo
    
    if [[ ":$PATH:" != *":$install_dir:"* ]]; then
        log_warning "Note: $install_dir is not in your PATH"
        log_info "Add this to your shell profile to use '$CLI_NAME' from anywhere:"
        log_info "  export PATH=\"\$PATH:$install_dir\""
        echo
    fi
    
    log_info "For more commands and options:"
    log_info "  $CLI_NAME --help"
    echo
}

# Main installation function
main() {
    print_banner
    
    # Pre-flight checks
    log_info "Running pre-flight checks..."
    
    local runtime
    if ! runtime=$(detect_runtime); then
        exit 1
    fi
    
    if ! check_project_directory; then
        exit 1
    fi
    
    # Installation steps
    log_info "Starting installation process..."
    
    if ! install_dependencies "$runtime"; then
        exit 1
    fi
    
    if ! build_cli "$runtime"; then
        exit 1
    fi
    
    local install_dir
    install_dir=$(get_install_dir)
    log_info "Installing to: $install_dir"
    
    if ! create_global_command "$install_dir"; then
        exit 1
    fi
    
    if ! run_tests "$install_dir"; then
        exit 1
    fi
    
    print_usage "$install_dir"
}

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Install the Arbiter CLI globally for easy access."
        echo
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --version, -v  Show installer version"
        echo
        echo "This script must be run from the Arbiter project root directory."
        echo "It will:"
        echo "  1. Check runtime environment (Node.js/Bun)"
        echo "  2. Install/verify dependencies"
        echo "  3. Build the CLI if needed"
        echo "  4. Create global command symlink"
        echo "  5. Run installation tests"
        echo
        exit 0
        ;;
    "--version"|"-v")
        echo "$SCRIPT_NAME v$SCRIPT_VERSION"
        exit 0
        ;;
    "")
        # No arguments - proceed with installation
        main
        ;;
    *)
        log_error "Unknown option: $1"
        log_info "Use --help for usage information"
        exit 1
        ;;
esac