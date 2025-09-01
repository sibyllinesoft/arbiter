#!/bin/bash

# CRDT & WebSocket Chaos Testing Runner
# 
# This script provides an easy way to run chaos tests with various configurations
# and automatically generate reports for engineering analysis.

set -euo pipefail

# Default configuration
CHAOS_MODE="full"
BROWSER="chromium"
HEADLESS="false"
OUTPUT_DIR="chaos-test-results"
TIMEOUT="300000"  # 5 minutes
MAX_USERS="4"
REPORT_FORMAT="json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

CRDT & WebSocket Chaos Testing Runner

OPTIONS:
    -m, --mode MODE         Chaos testing mode (full|quick|network|crdt|realworld)
    -b, --browser BROWSER   Browser to use (chromium|firefox|webkit)
    -h, --headless         Run in headless mode
    -o, --output DIR       Output directory for results
    -t, --timeout MS       Test timeout in milliseconds
    -u, --users COUNT      Maximum concurrent users to simulate
    -r, --report FORMAT    Report format (json|html|csv)
    --help                 Show this help message

MODES:
    full        Run all chaos tests (default)
    quick       Run essential chaos tests only
    network     Focus on network partition and degradation tests
    crdt        Focus on CRDT conflict resolution tests
    realworld   Focus on real-world failure scenario tests

EXAMPLES:
    $0                                    # Run full chaos test suite
    $0 -m quick -h                       # Quick tests in headless mode
    $0 -m network -b firefox -t 600000   # Network tests with Firefox, 10min timeout
    $0 -m crdt -u 2 -o ./results         # CRDT tests with 2 users, custom output

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            CHAOS_MODE="$2"
            shift 2
            ;;
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -h|--headless)
            HEADLESS="true"
            shift
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -u|--users)
            MAX_USERS="$2"
            shift 2
            ;;
        -r|--report)
            REPORT_FORMAT="$2"
            shift 2
            ;;
        --help)
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Validate mode
case $CHAOS_MODE in
    full|quick|network|crdt|realworld)
        ;;
    *)
        log_error "Invalid mode: $CHAOS_MODE"
        log_error "Valid modes: full, quick, network, crdt, realworld"
        exit 1
        ;;
esac

# Validate browser
case $BROWSER in
    chromium|firefox|webkit)
        ;;
    *)
        log_error "Invalid browser: $BROWSER"
        log_error "Valid browsers: chromium, firefox, webkit"
        exit 1
        ;;
esac

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Set up environment
export CHAOS_TEST_MODE="$CHAOS_MODE"
export CHAOS_MAX_USERS="$MAX_USERS"
export CHAOS_OUTPUT_DIR="$OUTPUT_DIR"
export CHAOS_REPORT_FORMAT="$REPORT_FORMAT"

log_info "Starting CRDT & WebSocket Chaos Testing"
log_info "Mode: $CHAOS_MODE"
log_info "Browser: $BROWSER"
log_info "Headless: $HEADLESS"
log_info "Max Users: $MAX_USERS"
log_info "Timeout: ${TIMEOUT}ms"
log_info "Output: $OUTPUT_DIR"

# Build test grep pattern based on mode
case $CHAOS_MODE in
    full)
        GREP_PATTERN=""
        ;;
    quick)
        GREP_PATTERN="--grep \"handles network partition|survives reconnection storms\""
        ;;
    network)
        GREP_PATTERN="--grep \"network partition|network degradation|message delays\""
        ;;
    crdt)
        GREP_PATTERN="--grep \"CRDT.*concurrent operations|conflict resolution\""
        ;;
    realworld)
        GREP_PATTERN="--grep \"real-world failure patterns\""
        ;;
esac

# Build Playwright command
PLAYWRIGHT_CMD="npx playwright test e2e/chaos/chaos-testing.spec.ts"
PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --project=$BROWSER"
PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --timeout=$TIMEOUT"

if [ "$HEADLESS" = "true" ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --reporter=list"
else
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --reporter=list --headed"
fi

if [ -n "$GREP_PATTERN" ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD $GREP_PATTERN"
fi

# Run the tests
log_info "Executing: $PLAYWRIGHT_CMD"
START_TIME=$(date +%s)

if eval "$PLAYWRIGHT_CMD"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    log_success "Chaos tests completed successfully in ${DURATION}s"
    
    # Generate summary report
    log_info "Generating test summary report"
    SUMMARY_FILE="$OUTPUT_DIR/chaos-test-summary.txt"
    
    cat > "$SUMMARY_FILE" << EOF
CRDT & WebSocket Chaos Testing Summary
======================================

Test Configuration:
- Mode: $CHAOS_MODE
- Browser: $BROWSER
- Headless: $HEADLESS
- Max Users: $MAX_USERS
- Duration: ${DURATION}s
- Timestamp: $(date)

Test Results:
- Status: PASSED
- Output Directory: $OUTPUT_DIR

Key Metrics: (Check detailed reports for full metrics)
- Overall Reliability: Check chaos-report.json
- Data Integrity: Check consistency-validation.json
- Performance Impact: Check performance-metrics.json

Next Steps:
1. Review detailed reports in $OUTPUT_DIR/
2. Analyze any performance degradation patterns
3. Update system resilience based on findings
4. Schedule regular chaos testing runs

For detailed analysis:
- Open test-results/report.html in browser
- Review $OUTPUT_DIR/*.json for raw metrics
- Check console logs for specific failure patterns

EOF

    log_success "Summary report generated: $SUMMARY_FILE"
    
    # List generated files
    log_info "Generated files:"
    find "$OUTPUT_DIR" -type f -name "*.json" -o -name "*.html" -o -name "*.txt" | sort
    
else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    log_error "Chaos tests failed after ${DURATION}s"
    
    # Generate failure report
    FAILURE_FILE="$OUTPUT_DIR/chaos-test-failure.txt"
    cat > "$FAILURE_FILE" << EOF
CRDT & WebSocket Chaos Testing Failure Report
=============================================

Test Configuration:
- Mode: $CHAOS_MODE
- Browser: $BROWSER
- Headless: $HEADLESS
- Max Users: $MAX_USERS
- Duration: ${DURATION}s
- Timestamp: $(date)

Test Results:
- Status: FAILED
- Check test-results/ for detailed failure information

Common Failure Causes:
1. Network proxy setup issues
2. WebSocket connection problems
3. Test timeout due to system overload
4. Browser compatibility issues
5. Resource exhaustion (memory/CPU)

Troubleshooting Steps:
1. Check system resources (memory, CPU)
2. Verify WebSocket server is running
3. Try running with fewer concurrent users (-u 2)
4. Increase timeout (-t 600000)
5. Run in headless mode (-h) to reduce resource usage

For debugging:
- Check test-results/report.html for detailed errors
- Run with --debug flag for more verbose output
- Check system logs for resource issues

EOF

    log_error "Failure report generated: $FAILURE_FILE"
    exit 1
fi

# Performance recommendations based on results
log_info "Performance Analysis Recommendations:"

if [ "$CHAOS_MODE" = "full" ]; then
    log_warning "Full chaos tests completed. Review the following:"
    echo "  • Network partition recovery times"
    echo "  • CRDT conflict resolution effectiveness"
    echo "  • User experience during degradation"
    echo "  • System resource usage under stress"
fi

if [ "$MAX_USERS" -gt 2 ]; then
    log_warning "Multi-user test completed. Validate:"
    echo "  • Scalability under concurrent operations"
    echo "  • Memory usage with multiple connections"
    echo "  • Message throughput and queuing"
fi

if [ "$BROWSER" = "chromium" ]; then
    log_info "Consider testing with other browsers for compatibility validation"
fi

log_success "Chaos testing session complete!"
log_info "Next scheduled chaos test recommended in 1 week"
log_info "For CI/CD integration, add this script to your pipeline"