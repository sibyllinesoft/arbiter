#!/bin/bash

# Server monitoring script for Arbiter API
# This script monitors the API server and logs health metrics

API_URL="http://localhost:5050"
LOG_FILE="/tmp/arbiter-monitor.log"
CHECK_INTERVAL=${1:-30}  # Default: check every 30 seconds

echo "🔍 Starting Arbiter API server monitoring..."
echo "📍 API URL: $API_URL"
echo "📝 Log file: $LOG_FILE"
echo "⏱️  Check interval: ${CHECK_INTERVAL}s"
echo ""

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check server health
check_health() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Try to get health status
    local response=$(curl -s -w "%{http_code}" -m 5 "$API_URL/health" 2>/dev/null)
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$http_code" == "200" ]]; then
        echo "✅ $timestamp - Server healthy"
        echo "   Response: $body"
        
        # Extract status from JSON if available
        if command -v jq >/dev/null; then
            local status=$(echo "$body" | jq -r '.status // "unknown"' 2>/dev/null)
            local db_status=$(echo "$body" | jq -r '.database // false' 2>/dev/null)
            echo "   Status: $status, Database: $db_status"
        fi
    elif [[ "$http_code" =~ ^[4-5][0-9][0-9]$ ]]; then
        log_message "❌ Server error - HTTP $http_code"
        log_message "   Response: $body"
        return 1
    else
        log_message "🔌 Server unreachable - Connection failed"
        return 1
    fi
    
    return 0
}

# Function to check WebSocket endpoint
check_websocket() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Test WebSocket upgrade capability (will fail but should return proper headers)
    local response=$(curl -s -I -w "%{http_code}" -m 3 \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        -H "Sec-WebSocket-Version: 13" \
        "$API_URL/events" 2>/dev/null)
    
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "400" ]] || [[ "$http_code" == "401" ]] || [[ "$http_code" == "101" ]]; then
        echo "🔗 $timestamp - WebSocket endpoint responsive (HTTP $http_code)"
        return 0
    else
        log_message "⚠️  WebSocket endpoint issue - HTTP $http_code"
        return 1
    fi
}

# Function to get server process info
check_process() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Find Bun processes running the server
    local processes=$(pgrep -f "bun.*server.ts" 2>/dev/null)
    
    if [[ -n "$processes" ]]; then
        echo "🔄 $timestamp - Server processes found:"
        echo "$processes" | while read pid; do
            if [[ -n "$pid" ]]; then
                local mem_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
                local mem_mb=$((mem_kb / 1024))
                local cpu=$(ps -o %cpu= -p "$pid" 2>/dev/null | tr -d ' ')
                echo "   PID $pid: ${mem_mb}MB RAM, ${cpu}% CPU"
            fi
        done
    else
        log_message "⚠️  No server processes found"
        return 1
    fi
    
    return 0
}

# Main monitoring loop
main() {
    log_message "🚀 Server monitoring started"
    
    local consecutive_failures=0
    local max_failures=5
    
    while true; do
        echo ""
        echo "--- Health Check $(date '+%Y-%m-%d %H:%M:%S') ---"
        
        local health_ok=true
        local websocket_ok=true
        local process_ok=true
        
        # Check API health
        if ! check_health; then
            health_ok=false
            ((consecutive_failures++))
        fi
        
        # Check WebSocket
        if ! check_websocket; then
            websocket_ok=false
        fi
        
        # Check processes
        if ! check_process; then
            process_ok=false
            ((consecutive_failures++))
        fi
        
        # Reset failure counter on success
        if $health_ok && $process_ok; then
            consecutive_failures=0
        fi
        
        # Alert on consecutive failures
        if [[ $consecutive_failures -ge $max_failures ]]; then
            log_message "🚨 ALERT: $consecutive_failures consecutive failures detected!"
            log_message "🚨 Server may be in a crash loop or completely down"
            
            # Optional: Send notification, restart service, etc.
            # notify-send "Arbiter API Alert" "Server health check failing"
        fi
        
        # Status summary
        local health_icon=$([ $health_ok == true ] && echo "✅" || echo "❌")
        local ws_icon=$([ $websocket_ok == true ] && echo "✅" || echo "⚠️")
        local proc_icon=$([ $process_ok == true ] && echo "✅" || echo "❌")
        
        echo "Summary: API $health_icon | WebSocket $ws_icon | Process $proc_icon | Failures: $consecutive_failures"
        
        sleep "$CHECK_INTERVAL"
    done
}

# Handle signals for graceful shutdown
trap 'log_message "🔸 Monitoring stopped"; exit 0' SIGINT SIGTERM

# Start monitoring
main