#!/bin/bash

# E2E Docker Compose Test Runner
# This script runs comprehensive Docker Compose tests using CUE specifications

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="e2e-test-stack"
COMPOSE_FILE="$TEST_DIR/docker-compose.generated.yml"
DEPENDENCY_CHECKER="$SCRIPT_DIR/check-dependencies.cjs"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Function to cleanup on exit
cleanup() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        print_error "Test run failed with exit code $exit_code"
        
        # Show logs if services are running
        if docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps --services > /dev/null 2>&1; then
            print_status "Showing service logs for debugging:"
            docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs --tail=20
        fi
    fi
    
    print_status "Performing cleanup..."
    
    # Stop and remove containers, networks, and volumes
    if [ -f "$COMPOSE_FILE" ]; then
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --remove-orphans > /dev/null 2>&1 || true
    fi
    
    # Remove generated files
    rm -f "$COMPOSE_FILE"
    
    # Clean up unused Docker resources
    docker system prune -f > /dev/null 2>&1 || true
    
    print_status "Cleanup completed"
    
    exit $exit_code
}

# Function to check if Docker daemon is running
check_docker_daemon() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to show help
show_help() {
    cat << EOF
E2E Docker Compose Test Runner

Usage: $0 [OPTIONS]

Options:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    -q, --quick     Skip dependency checks
    --no-cleanup    Don't cleanup after tests (for debugging)
    --check-only    Only run dependency checks

Examples:
    $0                  # Run full e2e tests
    $0 --verbose        # Run with verbose output
    $0 --check-only     # Only check dependencies
    $0 --no-cleanup     # Keep containers running after tests

This script will:
1. Check all required dependencies
2. Generate docker-compose.yml from CUE specification
3. Build and start Docker services
4. Run comprehensive connectivity and health tests
5. Clean up all resources

EOF
}

# Parse command line arguments
VERBOSE=false
QUICK=false
NO_CLEANUP=false
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quick)
            QUICK=true
            shift
            ;;
        --no-cleanup)
            NO_CLEANUP=true
            shift
            ;;
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set up trap for cleanup (unless --no-cleanup is specified)
if [ "$NO_CLEANUP" != true ]; then
    trap cleanup EXIT
fi

# Main execution starts here
print_status "🚀 Starting E2E Docker Compose Tests"
print_status "Test directory: $TEST_DIR"
print_status "Project name: $PROJECT_NAME"

# Step 1: Check dependencies
if [ "$QUICK" != true ]; then
    print_status "🔍 Checking dependencies..."
    
    if [ -f "$DEPENDENCY_CHECKER" ]; then
        if ! node "$DEPENDENCY_CHECKER"; then
            print_error "Dependency check failed. Please resolve the issues above."
            exit 1
        fi
    else
        print_warning "Dependency checker not found, skipping dependency validation"
    fi
    
    print_success "Dependencies verified"
else
    print_warning "Skipping dependency checks (quick mode)"
fi

# Exit here if only checking dependencies
if [ "$CHECK_ONLY" = true ]; then
    print_success "Dependency check completed successfully"
    exit 0
fi

# Step 2: Check Docker daemon
print_status "🐳 Checking Docker daemon..."
check_docker_daemon
print_success "Docker daemon is running"

# Step 3: Clean up any existing resources
print_status "🧹 Cleaning up existing resources..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --remove-orphans > /dev/null 2>&1 || true
print_success "Previous resources cleaned up"

# Step 4: Generate docker-compose.yml from CUE
print_status "📝 Generating docker-compose.yml from CUE specification..."

if ! command -v cue > /dev/null 2>&1; then
    print_error "CUE is not installed. Please install CUE from https://cuelang.org/docs/install/"
    exit 1
fi

CUE_FILE="$TEST_DIR/specs/docker-compose.cue"
if [ ! -f "$CUE_FILE" ]; then
    print_error "CUE specification file not found: $CUE_FILE"
    exit 1
fi

# Generate the docker-compose.yml file
cd "$TEST_DIR"
if ! cue export "$CUE_FILE" --expression dockerCompose > "$COMPOSE_FILE"; then
    print_error "Failed to generate docker-compose.yml from CUE specification"
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "Generated docker-compose.yml file not found"
    exit 1
fi

print_success "docker-compose.yml generated successfully"

# Step 5: Validate generated docker-compose.yml
print_status "✅ Validating generated docker-compose.yml..."
if ! docker compose -f "$COMPOSE_FILE" config > /dev/null; then
    print_error "Generated docker-compose.yml is invalid"
    if [ "$VERBOSE" = true ]; then
        docker compose -f "$COMPOSE_FILE" config
    fi
    exit 1
fi
print_success "docker-compose.yml is valid"

# Step 6: Run the actual tests
print_status "🧪 Running E2E tests with Bun..."

# Set test environment variables
export TEST_TIMEOUT=300000
export NODE_ENV=test

# Run tests with appropriate verbosity
if [ "$VERBOSE" = true ]; then
    bun test "$TEST_DIR/docker-compose-e2e.test.ts" --timeout 300000
else
    bun test "$TEST_DIR/docker-compose-e2e.test.ts" --timeout 300000 --reporter=tap
fi

# If we get here, tests passed
print_success "All E2E tests passed! 🎉"

# Final status
print_status "📊 Test Summary:"
echo "  ✅ CUE specification successfully generated docker-compose.yml"
echo "  ✅ All Docker services started and became healthy"
echo "  ✅ Service connectivity tests passed"
echo "  ✅ Inter-service communication verified"
echo "  ✅ Health checks and monitoring working"

if [ "$NO_CLEANUP" = true ]; then
    print_warning "Containers are still running (--no-cleanup specified)"
    print_status "To manually stop services run:"
    echo "  docker compose -f \"$COMPOSE_FILE\" -p \"$PROJECT_NAME\" down -v"
    print_status "Service URLs for manual testing:"
    echo "  - Node.js App: http://localhost:3000"
    echo "  - Nginx Proxy: http://localhost:8080"
    echo "  - Health Check: http://localhost:3000/health"
    echo "  - Redis Test: http://localhost:3000/redis/test"
    echo "  - Postgres Test: http://localhost:3000/postgres/test"
fi

print_success "E2E Docker Compose tests completed successfully!"