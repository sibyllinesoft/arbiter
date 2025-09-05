#!/bin/bash

# Arbiter CLI Distribution Test Suite
# ===================================
# 
# This script validates that the Arbiter CLI distribution system works correctly
# and provides evidence for external agents that the CLI can be easily installed and used.

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# Test configuration
readonly CLI_EXEC="./arbiter-cli.mjs"
readonly INSTALL_SCRIPT="./install-cli.sh"
readonly TEST_TIMEOUT="10"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

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

# Test runner function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_exit_code="${3:-0}"
    
    ((TESTS_RUN++))
    
    log_info "Running: $test_name"
    
    if timeout "$TEST_TIMEOUT" bash -c "$test_command" >/dev/null 2>&1; then
        local exit_code=$?
        if [[ $exit_code -eq $expected_exit_code ]]; then
            log_success "$test_name"
            ((TESTS_PASSED++))
            return 0
        else
            log_error "$test_name (exit code: $exit_code, expected: $expected_exit_code)"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log_error "$test_name (timeout)"
        else
            log_error "$test_name (exit code: $exit_code)"
        fi
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test with output capture
run_test_with_output() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    ((TESTS_RUN++))
    
    log_info "Running: $test_name"
    
    local output
    if output=$(timeout "$TEST_TIMEOUT" bash -c "$test_command" 2>&1); then
        if [[ "$output" =~ $expected_pattern ]]; then
            log_success "$test_name"
            ((TESTS_PASSED++))
            return 0
        else
            log_error "$test_name (output doesn't match pattern: $expected_pattern)"
            log_error "Actual output: $output"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        log_error "$test_name (command failed or timeout)"
        ((TESTS_FAILED++))
        return 1
    fi
}

print_banner() {
    echo
    log_header "🧪 Arbiter CLI Distribution Test Suite"
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo
    log_info "Testing CLI distribution system for external agents..."
    echo
}

print_summary() {
    echo
    log_header "📊 Test Summary"
    echo -e "${CYAN}════════════════════════${NC}"
    echo -e "Total tests run: ${BOLD}$TESTS_RUN${NC}"
    echo -e "Passed:          ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed:          ${RED}$TESTS_FAILED${NC}"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo
        log_success "All tests passed! CLI distribution system is working correctly."
        echo
        log_info "External agents can:"
        echo "  • Clone this repository"
        echo "  • Run ./arbiter-cli.mjs directly"
        echo "  • Install globally with ./install-cli.sh"  
        echo "  • Use via npm/package managers with bin entry"
        echo "  • Validate installation with dependency checks"
        echo
        return 0
    else
        echo
        log_error "Some tests failed. CLI distribution may have issues."
        return 1
    fi
}

# Main test execution
main() {
    print_banner
    
    # Test 1: Check if CLI executable exists and is executable
    log_header "1. Basic File Checks"
    run_test "CLI executable exists" "test -f '$CLI_EXEC'"
    run_test "CLI executable has execute permissions" "test -x '$CLI_EXEC'"
    run_test "Installation script exists" "test -f '$INSTALL_SCRIPT'"
    run_test "Installation script has execute permissions" "test -x '$INSTALL_SCRIPT'"
    
    echo
    
    # Test 2: CLI wrapper functionality
    log_header "2. CLI Wrapper Functionality"
    run_test_with_output "CLI version command" "$CLI_EXEC --version" "arbiter v"
    run_test_with_output "CLI help command" "$CLI_EXEC --help" "Arbiter CLI"
    run_test_with_output "CLI info command" "$CLI_EXEC --info" "CLI Information"
    run_test_with_output "CLI self-test" "$CLI_EXEC --self-test" "Self-test passed"
    run_test_with_output "CLI dependency check" "$CLI_EXEC --deps-check" "Dependency Check"
    
    echo
    
    # Test 3: Installation script functionality
    log_header "3. Installation Script Tests"
    run_test_with_output "Install script help" "$INSTALL_SCRIPT --help" "Install the Arbiter CLI"
    run_test_with_output "Install script version" "$INSTALL_SCRIPT --version" "Installer v"
    
    echo
    
    # Test 4: Package.json configuration
    log_header "4. Package Configuration"
    run_test "Package.json has bin entry" "grep -q '\"arbiter\".*arbiter-cli.mjs' package.json"
    run_test "Package.json has CLI scripts" "grep -q 'cli:' package.json"
    run_test "Package.json updated name" "grep -q '\"name\": \"arbiter\"' package.json"
    
    echo
    
    # Test 5: Dependency checker functionality
    log_header "5. Dependency Checker"
    if [[ -f "./cli-dependencies.mjs" ]]; then
        run_test "Dependency checker exists" "test -x './cli-dependencies.mjs'"
        run_test_with_output "Dependency checker runs" "./cli-dependencies.mjs --json" "runtime"
    else
        log_warning "Dependency checker not found (optional)"
    fi
    
    echo
    
    # Test 6: Error handling and robustness
    log_header "6. Error Handling"
    run_test_with_output "CLI handles unknown flags gracefully" "$CLI_EXEC --unknown-flag || true" "CLI"
    
    print_summary
}

# Run main function
main "$@"