#!/bin/bash

# Arbiter Performance & Security Benchmarking Script
# This script runs comprehensive performance and security analysis

set -euo pipefail

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
BENCHMARK_MODE=${1:-"full"}  # full, performance, security, quick
API_PORT=${API_PORT:-3001}
API_URL="http://localhost:${API_PORT}"
WS_URL="ws://localhost:${API_PORT}"

# Directories
BENCHMARK_DIR="./packages/benchmarks"
SECURITY_DIR="./packages/security"
REPORTS_DIR="./benchmarks/reports"

echo -e "${BLUE}🚀 Arbiter Benchmarking Suite${NC}"
echo "================================="
echo -e "Mode: ${YELLOW}${BENCHMARK_MODE}${NC}"
echo -e "API URL: ${API_URL}"
echo -e "Reports: ${REPORTS_DIR}"
echo ""

# Ensure directories exist
mkdir -p "${REPORTS_DIR}"
mkdir -p "./security/reports"

# Function to check if API is running
check_api_health() {
    local timeout=30
    local count=0
    
    echo -e "${BLUE}🔍 Checking API health...${NC}"
    
    while [ $count -lt $timeout ]; do
        if curl -s "${API_URL}/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ API is healthy${NC}"
            return 0
        fi
        
        if curl -s "${API_URL}" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ API is responding${NC}"
            return 0
        fi
        
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    echo -e "${RED}❌ API health check failed after ${timeout}s${NC}"
    return 1
}

# Function to start API server
start_api_server() {
    echo -e "${BLUE}🚀 Starting API server...${NC}"
    
    # Check if already running
    if curl -s "${API_URL}" >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  API server already running${NC}"
        return 0
    fi
    
    # Start API server in background
    cd apps/api
    bun run dev > "${REPORTS_DIR}/api-server.log" 2>&1 &
    API_PID=$!
    cd ../..
    
    # Store PID for cleanup
    echo $API_PID > "${REPORTS_DIR}/api.pid"
    
    # Wait for server to start
    if check_api_health; then
        echo -e "${GREEN}✅ API server started (PID: ${API_PID})${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to start API server${NC}"
        return 1
    fi
}

# Function to stop API server
stop_api_server() {
    if [ -f "${REPORTS_DIR}/api.pid" ]; then
        local pid=$(cat "${REPORTS_DIR}/api.pid")
        echo -e "${BLUE}🛑 Stopping API server (PID: ${pid})...${NC}"
        
        if kill "$pid" 2>/dev/null; then
            echo -e "${GREEN}✅ API server stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  API server was not running${NC}"
        fi
        
        rm -f "${REPORTS_DIR}/api.pid"
    fi
}

# Function to run performance benchmarks
run_performance_benchmarks() {
    echo -e "${BLUE}⚡ Running Performance Benchmarks...${NC}"
    echo "======================================"
    
    cd "${BENCHMARK_DIR}"
    
    # Set environment variables
    export API_URL="${API_URL}"
    export WS_URL="${WS_URL}"
    export CI="${CI:-false}"
    
    if bun run bench; then
        echo -e "${GREEN}✅ Performance benchmarks completed${NC}"
        
        # Display summary if available
        if [ -f "../../benchmarks/reports/benchmark-results.json" ]; then
            local score=$(cat ../../benchmarks/reports/benchmark-results.json | bun run -e "
                const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
                console.log(data.quality_gates?.score || 0);
            ")
            local failed=$(cat ../../benchmarks/reports/benchmark-results.json | bun run -e "
                const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
                console.log(data.summary?.failed_gates || 0);
            ")
            
            echo -e "${BLUE}📊 Performance Score: ${score}/100${NC}"
            echo -e "${BLUE}📊 Failed Gates: ${failed}${NC}"
        fi
        
        cd ../..
        return 0
    else
        echo -e "${RED}❌ Performance benchmarks failed${NC}"
        cd ../..
        return 1
    fi
}

# Function to run security scans
run_security_scans() {
    echo -e "${BLUE}🔒 Running Security Scans...${NC}"
    echo "============================"
    
    cd "${SECURITY_DIR}"
    
    # Set environment variables
    export CI="${CI:-false}"
    
    if bun run scan; then
        echo -e "${GREEN}✅ Security scans completed${NC}"
        
        # Display summary if available
        if [ -f "../../security/reports/security-results.json" ]; then
            local critical=$(cat ../../security/reports/security-results.json | bun run -e "
                const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
                console.log(data.summary?.critical_vulnerabilities || 0);
            ")
            local high=$(cat ../../security/reports/security-results.json | bun run -e "
                const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
                console.log(data.summary?.high_vulnerabilities || 0);
            ")
            local total=$(cat ../../security/reports/security-results.json | bun run -e "
                const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
                console.log(data.summary?.total_vulnerabilities || 0);
            ")
            
            echo -e "${BLUE}📊 Total Vulnerabilities: ${total}${NC}"
            echo -e "${BLUE}📊 Critical: ${critical}, High: ${high}${NC}"
        fi
        
        cd ../..
        return 0
    else
        echo -e "${RED}❌ Security scans failed${NC}"
        cd ../..
        return 1
    fi
}

# Function to generate final report
generate_final_report() {
    echo -e "${BLUE}📊 Generating Final Report...${NC}"
    echo "============================="
    
    local report_file="${REPORTS_DIR}/final-report.md"
    
    cat > "$report_file" << EOF
# Arbiter Quality Gates Report

Generated: $(date -Iseconds)
Mode: ${BENCHMARK_MODE}

## Summary

EOF

    # Add performance results
    if [ -f "${REPORTS_DIR}/benchmark-results.json" ]; then
        echo "### Performance Results" >> "$report_file"
        echo "" >> "$report_file"
        
        local perf_score=$(cat "${REPORTS_DIR}/benchmark-results.json" | bun run -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            console.log(data.quality_gates?.score || 0);
        ")
        local perf_failed=$(cat "${REPORTS_DIR}/benchmark-results.json" | bun run -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            console.log(data.summary?.failed_gates || 0);
        ")
        
        echo "- **Score**: ${perf_score}/100" >> "$report_file"
        echo "- **Failed Gates**: ${perf_failed}" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # Add security results
    if [ -f "./security/reports/security-results.json" ]; then
        echo "### Security Results" >> "$report_file"
        echo "" >> "$report_file"
        
        local sec_critical=$(cat "./security/reports/security-results.json" | bun run -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            console.log(data.summary?.critical_vulnerabilities || 0);
        ")
        local sec_high=$(cat "./security/reports/security-results.json" | bun run -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            console.log(data.summary?.high_vulnerabilities || 0);
        ")
        local sec_total=$(cat "./security/reports/security-results.json" | bun run -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            console.log(data.summary?.total_vulnerabilities || 0);
        ")
        
        echo "- **Total Vulnerabilities**: ${sec_total}" >> "$report_file"
        echo "- **Critical**: ${sec_critical}" >> "$report_file"
        echo "- **High**: ${sec_high}" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    # Add conclusion
    echo "### Conclusion" >> "$report_file"
    echo "" >> "$report_file"
    
    local has_failures=false
    
    if [ -f "${REPORTS_DIR}/benchmark-results.json" ]; then
        local perf_failed=$(cat "${REPORTS_DIR}/benchmark-results.json" | bun run -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            console.log(data.summary?.failed_gates || 0);
        ")
        if [ "$perf_failed" -gt 0 ]; then
            has_failures=true
        fi
    fi
    
    if [ -f "./security/reports/security-results.json" ]; then
        local sec_critical=$(cat "./security/reports/security-results.json" | bun run -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            console.log(data.summary?.critical_vulnerabilities || 0);
        ")
        if [ "$sec_critical" -gt 0 ]; then
            has_failures=true
        fi
    fi
    
    if [ "$has_failures" = true ]; then
        echo "❌ **Quality gates FAILED** - Issues must be resolved before deployment" >> "$report_file"
        echo -e "${RED}❌ Quality gates FAILED${NC}"
        return 1
    else
        echo "✅ **All quality gates PASSED** - Ready for deployment" >> "$report_file"
        echo -e "${GREEN}✅ All quality gates PASSED${NC}"
        return 0
    fi
}

# Cleanup function
cleanup() {
    echo -e "${BLUE}🧹 Cleaning up...${NC}"
    stop_api_server
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    local exit_code=0
    
    case "${BENCHMARK_MODE}" in
        "performance")
            if ! start_api_server; then exit_code=1; fi
            if ! run_performance_benchmarks; then exit_code=1; fi
            ;;
        "security")
            if ! run_security_scans; then exit_code=1; fi
            ;;
        "quick")
            if ! start_api_server; then exit_code=1; fi
            if ! run_performance_benchmarks; then exit_code=1; fi
            if ! run_security_scans; then exit_code=1; fi
            ;;
        "full"|*)
            if ! start_api_server; then exit_code=1; fi
            if ! run_performance_benchmarks; then exit_code=1; fi
            if ! run_security_scans; then exit_code=1; fi
            ;;
    esac
    
    # Generate final report
    if ! generate_final_report; then exit_code=1; fi
    
    echo ""
    echo -e "${BLUE}📁 Reports available in: ${REPORTS_DIR}${NC}"
    echo -e "${BLUE}📁 Security reports in: ./security/reports${NC}"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ Benchmarking completed successfully${NC}"
    else
        echo -e "${RED}❌ Benchmarking completed with errors${NC}"
    fi
    
    exit $exit_code
}

# Run main function
main "$@"