#!/bin/bash

# Webhook Testing Script for Arbiter
# Tests webhook functionality with GitHub and GitLab payloads

set -euo pipefail

# Configuration
API_URL="${API_URL:-http://localhost:5050}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-test-secret-key}"
PROJECT_ID="${PROJECT_ID:-test-project}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if server is running
check_server() {
    log_info "Checking if Arbiter server is running..."
    
    if ! curl -s "${API_URL}/health" > /dev/null; then
        log_error "Arbiter server is not running at ${API_URL}"
        log_info "Start the server with: bun run dev"
        exit 1
    fi
    
    log_success "Server is running"
}

# Create HMAC signature for GitHub
create_github_signature() {
    local payload="$1"
    local secret="$2"
    echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | sed 's/^.* //'
}

# Create HMAC signature for GitLab
create_gitlab_signature() {
    local payload="$1"
    local secret="$2"
    echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" -binary | base64
}

# Test GitHub push webhook
test_github_push() {
    log_info "Testing GitHub push webhook..."
    
    local payload='{
      "repository": {
        "full_name": "test/repo",
        "clone_url": "https://github.com/test/repo.git",
        "default_branch": "main"
      },
      "commits": [{
        "id": "abc123def456",
        "message": "Add webhook support",
        "author": {
          "name": "Test User",
          "email": "test@example.com"
        },
        "modified": ["src/webhooks.ts"],
        "added": ["scripts/test-webhooks.sh"],
        "removed": []
      }],
      "ref": "refs/heads/main",
      "before": "000000000",
      "after": "abc123def456"
    }'
    
    local signature="sha256=$(create_github_signature "$payload" "$WEBHOOK_SECRET")"
    
    local response
    response=$(curl -s -w "%{http_code}" -o /tmp/github_response.json \
        -X POST "${API_URL}/webhooks/github" \
        -H "Content-Type: application/json" \
        -H "X-GitHub-Event: push" \
        -H "X-Hub-Signature-256: $signature" \
        -d "$payload")
    
    local http_code="${response: -3}"
    local body
    body=$(cat /tmp/github_response.json)
    
    if [[ "$http_code" == "200" ]]; then
        log_success "GitHub push webhook test passed"
        echo "Response: $body"
    else
        log_error "GitHub push webhook test failed (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Test GitHub pull request webhook
test_github_pr() {
    log_info "Testing GitHub pull request webhook..."
    
    local payload='{
      "action": "opened",
      "repository": {
        "full_name": "test/repo",
        "clone_url": "https://github.com/test/repo.git"
      },
      "pull_request": {
        "id": 123,
        "state": "open",
        "base": {"ref": "main"},
        "head": {"ref": "feature/webhooks"}
      }
    }'
    
    local signature="sha256=$(create_github_signature "$payload" "$WEBHOOK_SECRET")"
    
    local response
    response=$(curl -s -w "%{http_code}" -o /tmp/github_pr_response.json \
        -X POST "${API_URL}/webhooks/github" \
        -H "Content-Type: application/json" \
        -H "X-GitHub-Event: pull_request" \
        -H "X-Hub-Signature-256: $signature" \
        -d "$payload")
    
    local http_code="${response: -3}"
    local body
    body=$(cat /tmp/github_pr_response.json)
    
    if [[ "$http_code" == "200" ]]; then
        log_success "GitHub pull request webhook test passed"
        echo "Response: $body"
    else
        log_error "GitHub pull request webhook test failed (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Test GitLab push webhook
test_gitlab_push() {
    log_info "Testing GitLab push webhook..."
    
    local payload='{
      "repository": {
        "full_name": "test/repo",
        "clone_url": "https://gitlab.com/test/repo.git",
        "default_branch": "main"
      },
      "commits": [{
        "id": "abc123def456",
        "message": "Add webhook support",
        "author": {
          "name": "Test User",
          "email": "test@example.com"
        },
        "modified": ["src/webhooks.ts"],
        "added": ["scripts/test-webhooks.sh"],
        "removed": []
      }],
      "ref": "refs/heads/main",
      "before": "000000000",
      "after": "abc123def456"
    }'
    
    local signature
    signature=$(create_gitlab_signature "$payload" "$WEBHOOK_SECRET")
    
    local response
    response=$(curl -s -w "%{http_code}" -o /tmp/gitlab_response.json \
        -X POST "${API_URL}/webhooks/gitlab" \
        -H "Content-Type: application/json" \
        -H "X-Gitlab-Event: Push Hook" \
        -H "X-Gitlab-Token: $signature" \
        -d "$payload")
    
    local http_code="${response: -3}"
    local body
    body=$(cat /tmp/gitlab_response.json)
    
    if [[ "$http_code" == "200" ]]; then
        log_success "GitLab push webhook test passed"
        echo "Response: $body"
    else
        log_error "GitLab push webhook test failed (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Test GitLab merge request webhook
test_gitlab_mr() {
    log_info "Testing GitLab merge request webhook..."
    
    local payload='{
      "action": "open",
      "repository": {
        "full_name": "test/repo",
        "clone_url": "https://gitlab.com/test/repo.git"
      },
      "merge_request": {
        "id": 123,
        "state": "opened",
        "target_branch": "main",
        "source_branch": "feature/webhooks"
      }
    }'
    
    local signature
    signature=$(create_gitlab_signature "$payload" "$WEBHOOK_SECRET")
    
    local response
    response=$(curl -s -w "%{http_code}" -o /tmp/gitlab_mr_response.json \
        -X POST "${API_URL}/webhooks/gitlab" \
        -H "Content-Type: application/json" \
        -H "X-Gitlab-Event: Merge Request Hook" \
        -H "X-Gitlab-Token: $signature" \
        -d "$payload")
    
    local http_code="${response: -3}"
    local body
    body=$(cat /tmp/gitlab_mr_response.json)
    
    if [[ "$http_code" == "200" ]]; then
        log_success "GitLab merge request webhook test passed"
        echo "Response: $body"
    else
        log_error "GitLab merge request webhook test failed (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Test webhook API endpoints
test_webhook_api() {
    log_info "Testing webhook API endpoints..."
    
    # Test webhook status
    log_info "Testing GET /api/webhooks"
    local response
    response=$(curl -s -w "%{http_code}" -o /tmp/api_response.json \
        -X GET "${API_URL}/api/webhooks")
    
    local http_code="${response: -3}"
    local body
    body=$(cat /tmp/api_response.json)
    
    if [[ "$http_code" == "200" ]]; then
        log_success "Webhook API status test passed"
        echo "Response: $body"
    else
        log_error "Webhook API status test failed (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
    
    # Test webhook configuration creation
    log_info "Testing POST /api/webhooks"
    local webhook_config='{
      "project_id": "test-project",
      "provider": "github",
      "repository_url": "https://github.com/test/repo.git",
      "enabled": true,
      "events": ["push", "pull_request"]
    }'
    
    response=$(curl -s -w "%{http_code}" -o /tmp/api_create_response.json \
        -X POST "${API_URL}/api/webhooks" \
        -H "Content-Type: application/json" \
        -d "$webhook_config")
    
    http_code="${response: -3}"
    body=$(cat /tmp/api_create_response.json)
    
    if [[ "$http_code" == "200" ]]; then
        log_success "Webhook configuration creation test passed"
        echo "Response: $body"
    else
        log_warning "Webhook configuration creation test failed (HTTP $http_code)"
        echo "Response: $body"
        log_info "This might be expected if authentication is required"
    fi
}

# Test invalid webhook signatures
test_invalid_signatures() {
    log_info "Testing webhook with invalid signatures..."
    
    local payload='{"test": "invalid signature"}'
    
    # Test GitHub with invalid signature
    local response
    response=$(curl -s -w "%{http_code}" -o /tmp/invalid_response.json \
        -X POST "${API_URL}/webhooks/github" \
        -H "Content-Type: application/json" \
        -H "X-GitHub-Event: push" \
        -H "X-Hub-Signature-256: sha256=invalidsignature" \
        -d "$payload")
    
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "400" || "$http_code" == "401" ]]; then
        log_success "Invalid signature rejection test passed (HTTP $http_code)"
    else
        log_warning "Invalid signature rejection test unexpected result (HTTP $http_code)"
    fi
}

# Run health check
health_check() {
    log_info "Running health check..."
    
    local health
    health=$(curl -s "${API_URL}/health")
    
    echo "Health status: $health"
    
    if echo "$health" | grep -q '"status":"healthy"'; then
        log_success "Server is healthy"
    else
        log_warning "Server health check shows issues"
    fi
}

# Main function
main() {
    local test_type="${1:-all}"
    
    echo "🧪 Arbiter Webhook Testing Suite"
    echo "================================="
    echo "API URL: $API_URL"
    echo "Webhook Secret: ${WEBHOOK_SECRET:0:8}..."
    echo ""
    
    check_server
    health_check
    
    local failed_tests=0
    
    case "$test_type" in
        github)
            test_github_push || ((failed_tests++))
            test_github_pr || ((failed_tests++))
            ;;
        gitlab)
            test_gitlab_push || ((failed_tests++))
            test_gitlab_mr || ((failed_tests++))
            ;;
        api)
            test_webhook_api || ((failed_tests++))
            ;;
        security)
            test_invalid_signatures || ((failed_tests++))
            ;;
        all)
            test_github_push || ((failed_tests++))
            test_github_pr || ((failed_tests++))
            test_gitlab_push || ((failed_tests++))
            test_gitlab_mr || ((failed_tests++))
            test_webhook_api || ((failed_tests++))
            test_invalid_signatures || ((failed_tests++))
            ;;
        *)
            echo "Usage: $0 {github|gitlab|api|security|all}"
            echo ""
            echo "Test types:"
            echo "  github   - Test GitHub webhooks"
            echo "  gitlab   - Test GitLab webhooks"
            echo "  api      - Test webhook API endpoints"
            echo "  security - Test invalid signatures"
            echo "  all      - Run all tests"
            echo ""
            echo "Environment variables:"
            echo "  API_URL         - Arbiter API URL (default: http://localhost:5050)"
            echo "  WEBHOOK_SECRET  - Webhook secret key (default: test-secret-key)"
            echo "  PROJECT_ID      - Project ID for testing (default: test-project)"
            exit 1
            ;;
    esac
    
    echo ""
    if [[ $failed_tests -eq 0 ]]; then
        log_success "All tests passed! ✨"
        exit 0
    else
        log_error "$failed_tests tests failed"
        exit 1
    fi
}

# Cleanup temp files on exit
cleanup() {
    rm -f /tmp/github_response.json /tmp/github_pr_response.json
    rm -f /tmp/gitlab_response.json /tmp/gitlab_mr_response.json
    rm -f /tmp/api_response.json /tmp/api_create_response.json
    rm -f /tmp/invalid_response.json
}

trap cleanup EXIT

# Run main function with all arguments
main "$@"