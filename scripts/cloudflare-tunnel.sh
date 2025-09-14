#!/bin/bash

# Cloudflare Tunnel Helper for Arbiter Webhooks
# This script sets up a persistent Cloudflare tunnel for webhook development

set -euo pipefail

# Configuration
TUNNEL_NAME="${TUNNEL_NAME:-arbiter-dev}"
LOCAL_PORT="${LOCAL_PORT:-5050}"
TUNNEL_CONFIG_DIR="${HOME}/.cloudflared"
TUNNEL_CONFIG_FILE="${TUNNEL_CONFIG_DIR}/config.yml"
CREDENTIALS_DIR="${TUNNEL_CONFIG_DIR}/credentials"

# Security Configuration
TUNNEL_MODE="${TUNNEL_MODE:-webhook-only}"  # webhook-only, full-api, custom
WEBHOOK_ONLY_PATHS="${WEBHOOK_ONLY_PATHS:-/webhooks/github,/webhooks/gitlab}"
ALLOWED_IPS_FILE="${TUNNEL_CONFIG_DIR}/allowed-ips.txt"

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

# Check if cloudflared is installed
check_cloudflared() {
    if ! command -v cloudflared &> /dev/null; then
        log_error "cloudflared is not installed. Please install it first:"
        echo ""
        echo "On macOS: brew install cloudflare/cloudflare/cloudflared"
        echo "On Linux: curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb"
        echo "On Windows: winget install --id Cloudflare.cloudflared"
        echo ""
        echo "Or visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
        exit 1
    fi
}

# Check if user is logged in to Cloudflare
check_login() {
    if ! cloudflared tunnel list &> /dev/null; then
        log_error "Not logged in to Cloudflare. Please run: cloudflared tunnel login"
        exit 1
    fi
}

# Check if tunnel already exists
tunnel_exists() {
    cloudflared tunnel list | grep -q "$TUNNEL_NAME" || return 1
}

# Create a new tunnel
create_tunnel() {
    log_info "Creating new tunnel: $TUNNEL_NAME"
    cloudflared tunnel create "$TUNNEL_NAME"
    
    # Get tunnel UUID
    TUNNEL_UUID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    log_success "Created tunnel: $TUNNEL_NAME (UUID: $TUNNEL_UUID)"
}

# Get existing tunnel UUID
get_tunnel_uuid() {
    cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}'
}

# Create webhook-only configuration (secure default)
create_webhook_only_config() {
    local tunnel_uuid="$1"
    
    log_info "Creating secure webhook-only configuration..."
    log_warning "This configuration uses a reverse proxy for path filtering"
    
    # Setup webhook proxy configuration (but don't start it yet)
    setup_webhook_proxy
    
    cat > "$TUNNEL_CONFIG_FILE" << EOF
tunnel: ${tunnel_uuid}
credentials-file: ${TUNNEL_CONFIG_DIR}/${tunnel_uuid}.json

ingress:
  - hostname: ${TUNNEL_NAME}.${CLOUDFLARE_DOMAIN:-your-domain.com}
    service: http://localhost:8080  # Proxy port
  - service: http_status:404
EOF
}

# Create full API configuration (less secure, all endpoints exposed)
create_full_api_config() {
    local tunnel_uuid="$1"
    
    log_warning "Creating full API configuration - ALL endpoints will be exposed!"
    log_warning "Use webhook-only mode for production environments"
    
    cat > "$TUNNEL_CONFIG_FILE" << EOF
tunnel: ${tunnel_uuid}
credentials-file: ${TUNNEL_CONFIG_DIR}/${tunnel_uuid}.json

ingress:
  - hostname: ${TUNNEL_NAME}.${CLOUDFLARE_DOMAIN:-your-domain.com}
    service: http://localhost:${LOCAL_PORT}
  - service: http_status:404
EOF
}

# Create custom configuration (user-defined)
create_custom_config() {
    local tunnel_uuid="$1"
    
    log_info "Creating custom configuration..."
    log_info "Please manually edit: $TUNNEL_CONFIG_FILE after creation"
    
    cat > "$TUNNEL_CONFIG_FILE" << EOF
tunnel: ${tunnel_uuid}
credentials-file: ${TUNNEL_CONFIG_DIR}/${tunnel_uuid}.json

# Custom configuration - edit as needed
ingress:
  - hostname: ${TUNNEL_NAME}.${CLOUDFLARE_DOMAIN:-your-domain.com}
    service: http://localhost:${LOCAL_PORT}
  - service: http_status:404
EOF
}

# Create tunnel configuration
create_config() {
    local tunnel_uuid="$1"
    
    log_info "Creating tunnel configuration for mode: $TUNNEL_MODE"
    
    # Create config directory if it doesn't exist
    mkdir -p "$TUNNEL_CONFIG_DIR"
    
    case "$TUNNEL_MODE" in
        "webhook-only")
            create_webhook_only_config "$tunnel_uuid"
            ;;
        "full-api")
            create_full_api_config "$tunnel_uuid"
            ;;
        "custom")
            create_custom_config "$tunnel_uuid"
            ;;
        *)
            log_error "Unknown tunnel mode: $TUNNEL_MODE"
            log_info "Available modes: webhook-only, full-api, custom"
            exit 1
            ;;
    esac

    log_success "Configuration created at: $TUNNEL_CONFIG_FILE"
}

# Setup webhook filtering proxy
setup_webhook_proxy() {
    local proxy_script="${TUNNEL_CONFIG_DIR}/webhook-proxy.js"
    local proxy_config="${TUNNEL_CONFIG_DIR}/proxy-config.json"
    
    log_info "Setting up webhook filtering proxy..."
    
    # Create proxy configuration
    cat > "$proxy_config" << 'EOF'
{
  "allowedPaths": [
    "/webhooks/github",
    "/webhooks/gitlab",
    "/health"
  ],
  "allowedIPs": [
    "127.0.0.1",
    "::1"
  ],
  "githubIPs": [
    "140.82.112.0/20",
    "142.250.0.0/15",
    "143.55.64.0/20",
    "192.30.252.0/22",
    "185.199.108.0/22"
  ],
  "gitlabIPs": [
    "34.74.90.64/28",
    "34.74.226.0/24",
    "35.231.147.226/32",
    "35.243.134.0/24"
  ]
}
EOF

    # Create simple Node.js proxy script (using only built-in modules)
    cat > "$proxy_script" << 'EOF'
#!/usr/bin/env node
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, 'proxy-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Simple IP range checking function
function ipInRange(ip, range) {
  if (!range.includes('/')) {
    return ip === range;
  }
  
  // Simple CIDR check for common webhook IP ranges
  const [network, prefixLength] = range.split('/');
  const networkParts = network.split('.');
  const ipParts = ip.split('.');
  
  // Simple prefix matching based on CIDR length
  const bytesToCheck = Math.floor(parseInt(prefixLength) / 8);
  
  for (let i = 0; i < bytesToCheck; i++) {
    if (networkParts[i] !== ipParts[i]) {
      return false;
    }
  }
  return true;
}

// Check if IP is allowed
function isIPAllowed(clientIP, path) {
  // Clean up IPv6-mapped IPv4 addresses
  const cleanIP = clientIP.replace(/^::ffff:/, '');
  
  // Always allow localhost
  if (config.allowedIPs.includes(cleanIP) || cleanIP === '127.0.0.1' || cleanIP === '::1') {
    return true;
  }
  
  // For webhook paths, check provider IPs
  if (path.startsWith('/webhooks/github')) {
    return config.githubIPs.some(range => ipInRange(cleanIP, range));
  }
  
  if (path.startsWith('/webhooks/gitlab')) {
    return config.gitlabIPs.some(range => ipInRange(cleanIP, range));
  }
  
  return false;
}

// Simple proxy function
function proxyRequest(req, res) {
  const targetUrl = `http://localhost:5050${req.url}`;
  const targetOptions = url.parse(targetUrl);
  targetOptions.method = req.method;
  targetOptions.headers = req.headers;
  
  // Remove host header to avoid confusion
  delete targetOptions.headers.host;
  
  const proxyReq = http.request(targetOptions, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    console.error('Proxy request error:', err);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad gateway' }));
    }
  });
  
  req.pipe(proxyReq);
}

// Create server
const server = http.createServer((req, res) => {
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.socket.remoteAddress ||
                   '127.0.0.1';
  
  const path = req.url.split('?')[0]; // Remove query params for path checking
  
  console.log(`${new Date().toISOString()} - ${clientIP} ${req.method} ${path}`);
  
  // Check if path is allowed
  if (!config.allowedPaths.some(allowedPath => path.startsWith(allowedPath))) {
    console.log(`Blocked path: ${path}`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Path not found' }));
    return;
  }
  
  // Check if IP is allowed for this path
  if (!isIPAllowed(clientIP, path)) {
    console.log(`Blocked IP: ${clientIP} for path: ${path}`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access forbidden' }));
    return;
  }
  
  console.log(`Proxying: ${clientIP} ${req.method} ${path}`);
  proxyRequest(req, res);
});

const PORT = process.env.PROXY_PORT || 8080;
server.listen(PORT, () => {
  console.log(`Webhook proxy server listening on port ${PORT}`);
  console.log(`Proxying allowed paths to http://localhost:5050`);
  console.log(`Allowed paths: ${config.allowedPaths.join(', ')}`);
});
EOF

    chmod +x "$proxy_script"
    log_success "Webhook proxy configured at: $proxy_script"
}

# Start webhook proxy server
start_webhook_proxy() {
    local proxy_script="${TUNNEL_CONFIG_DIR}/webhook-proxy.js"
    
    if [[ ! -f "$proxy_script" ]]; then
        log_error "Webhook proxy script not found. Run 'start' command first."
        return 1
    fi
    
    # No external dependencies needed - using built-in Node.js modules
    
    log_info "Starting webhook filtering proxy on port 8080..."
    nohup node "$proxy_script" > /tmp/webhook-proxy.log 2>&1 &
    local proxy_pid=$!
    echo "$proxy_pid" > /tmp/webhook-proxy.pid
    
    sleep 2
    
    if ! kill -0 "$proxy_pid" 2>/dev/null; then
        log_error "Failed to start webhook proxy. Check logs at: /tmp/webhook-proxy.log"
        return 1
    fi
    
    log_success "Webhook proxy started (PID: $proxy_pid)"
    return 0
}

# Stop webhook proxy server  
stop_webhook_proxy() {
    if [[ -f /tmp/webhook-proxy.pid ]]; then
        local proxy_pid
        proxy_pid=$(cat /tmp/webhook-proxy.pid)
        if kill -0 "$proxy_pid" 2>/dev/null; then
            log_info "Stopping webhook proxy (PID: $proxy_pid)..."
            kill "$proxy_pid"
            rm -f /tmp/webhook-proxy.pid
            log_success "Webhook proxy stopped"
        else
            log_warning "Webhook proxy process not running"
            rm -f /tmp/webhook-proxy.pid
        fi
    else
        log_warning "No webhook proxy PID file found"
    fi
}

# Get tunnel URL
get_tunnel_url() {
    local tunnel_uuid="$1"
    
    # Try to get the assigned URL from the tunnel info
    local tunnel_info
    tunnel_info=$(cloudflared tunnel info "$tunnel_uuid" 2>/dev/null || echo "")
    
    if [[ -n "$tunnel_info" ]]; then
        # Extract URL from tunnel info (this might need adjustment based on cloudflared output format)
        echo "$tunnel_info" | grep -o "https://[^[:space:]]*" | head -1
    else
        # Fallback to constructed URL
        echo "https://${tunnel_uuid}.cfargotunnel.com"
    fi
}

# Start tunnel in background
start_tunnel() {
    local tunnel_uuid="$1"
    
    log_info "Starting tunnel: $TUNNEL_NAME (mode: $TUNNEL_MODE)"
    
    # Start webhook proxy if in webhook-only mode
    if [[ "$TUNNEL_MODE" == "webhook-only" ]]; then
        log_info "Starting secure webhook proxy..."
        start_webhook_proxy || {
            log_error "Failed to start webhook proxy"
            exit 1
        }
    fi
    
    # Start tunnel in background
    nohup cloudflared tunnel --config "$TUNNEL_CONFIG_FILE" run "$tunnel_uuid" > /tmp/cloudflare-tunnel.log 2>&1 &
    
    local tunnel_pid=$!
    echo "$tunnel_pid" > /tmp/cloudflare-tunnel.pid
    
    # Wait a moment for tunnel to establish
    sleep 3
    
    # Check if tunnel is running
    if ! kill -0 "$tunnel_pid" 2>/dev/null; then
        log_error "Failed to start tunnel. Check logs at: /tmp/cloudflare-tunnel.log"
        exit 1
    fi
    
    local tunnel_url
    tunnel_url=$(get_tunnel_url "$tunnel_uuid")
    
    log_success "Tunnel started successfully!"
    log_success "Mode: $TUNNEL_MODE"
    
    if [[ "$TUNNEL_MODE" == "webhook-only" ]]; then
        log_success "Webhook proxy: http://localhost:8080 (secured)"
        log_success "Only webhook endpoints exposed to internet"
        log_info "Proxy logs: /tmp/webhook-proxy.log"
    else
        log_warning "ALL API endpoints exposed to internet!"
    fi
    
    log_success "Local server: http://localhost:${LOCAL_PORT}"
    log_success "Public URL: $tunnel_url"
    log_info "Process ID: $tunnel_pid"
    log_info "Tunnel logs: /tmp/cloudflare-tunnel.log"
    
    echo ""
    echo "🔗 Webhook URLs:"
    echo "   GitHub: ${tunnel_url}/webhooks/github"
    echo "   GitLab: ${tunnel_url}/webhooks/gitlab"
    echo ""
    
    if [[ "$TUNNEL_MODE" == "webhook-only" ]]; then
        echo "🔒 Security Status: SECURE (webhook-only mode)"
        echo "   ✅ Only webhook endpoints exposed"
        echo "   ✅ IP filtering for GitHub/GitLab sources" 
        echo "   ✅ Path-based access control"
    else
        echo "⚠️  Security Warning: ALL API endpoints exposed!"
        echo "   Set TUNNEL_MODE=webhook-only for secure deployment"
    fi
    
    echo ""
    echo "📝 Add these URLs to your repository webhook settings:"
    echo "   Content type: application/json"
    echo "   Events: push, pull_request (GitHub) or push, merge_request (GitLab)"
    echo ""
    echo "🛠️  Environment variables for Arbiter:"
    echo "   WEBHOOKS_ENABLED=true"
    echo "   WEBHOOK_SECRET=your-webhook-secret"
    echo "   GITHUB_WEBHOOK_SECRET=your-github-secret"
    echo "   GITLAB_WEBHOOK_SECRET=your-gitlab-secret"
    echo ""
    echo "To stop the tunnel: $0 stop"
}

# Stop tunnel
stop_tunnel() {
    # Stop webhook proxy if running
    stop_webhook_proxy
    
    if [[ -f /tmp/cloudflare-tunnel.pid ]]; then
        local pid
        pid=$(cat /tmp/cloudflare-tunnel.pid)
        
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping tunnel (PID: $pid)..."
            kill "$pid"
            rm -f /tmp/cloudflare-tunnel.pid
            log_success "Tunnel stopped"
        else
            log_warning "Tunnel process not running"
            rm -f /tmp/cloudflare-tunnel.pid
        fi
    else
        log_warning "No tunnel PID file found"
    fi
    
    # Also try to kill any cloudflared processes
    pkill -f "cloudflared tunnel.*run.*$TUNNEL_NAME" || true
}

# Check tunnel status
status_tunnel() {
    if [[ -f /tmp/cloudflare-tunnel.pid ]]; then
        local pid
        pid=$(cat /tmp/cloudflare-tunnel.pid)
        
        if kill -0 "$pid" 2>/dev/null; then
            log_success "Tunnel is running (PID: $pid)"
            
            if tunnel_exists; then
                local tunnel_uuid
                tunnel_uuid=$(get_tunnel_uuid)
                local tunnel_url
                tunnel_url=$(get_tunnel_url "$tunnel_uuid")
                echo "Public URL: $tunnel_url"
                echo "Local URL: http://localhost:${LOCAL_PORT}"
            fi
        else
            log_warning "Tunnel PID file exists but process is not running"
            rm -f /tmp/cloudflare-tunnel.pid
        fi
    else
        log_info "Tunnel is not running"
    fi
}

# Show tunnel logs
logs_tunnel() {
    if [[ -f /tmp/cloudflare-tunnel.log ]]; then
        tail -f /tmp/cloudflare-tunnel.log
    else
        log_error "No tunnel logs found at /tmp/cloudflare-tunnel.log"
    fi
}

# Delete tunnel
delete_tunnel() {
    log_info "Stopping tunnel if running..."
    stop_tunnel
    
    if tunnel_exists; then
        local tunnel_uuid
        tunnel_uuid=$(get_tunnel_uuid)
        
        log_info "Deleting tunnel: $TUNNEL_NAME"
        cloudflared tunnel delete "$tunnel_uuid"
        log_success "Tunnel deleted"
        
        # Clean up config files
        rm -f "$TUNNEL_CONFIG_FILE"
        rm -f "${CREDENTIALS_DIR}/${tunnel_uuid}.json"
        log_info "Configuration files cleaned up"
    else
        log_warning "Tunnel $TUNNEL_NAME does not exist"
    fi
}

# Main function
main() {
    local command="${1:-start}"
    
    case "$command" in
        start)
            check_cloudflared
            check_login
            
            local tunnel_uuid
            if tunnel_exists; then
                tunnel_uuid=$(get_tunnel_uuid)
                log_info "Using existing tunnel: $TUNNEL_NAME (UUID: $tunnel_uuid)"
            else
                create_tunnel
                tunnel_uuid=$(get_tunnel_uuid)
                create_config "$tunnel_uuid"
            fi
            
            start_tunnel "$tunnel_uuid"
            ;;
        stop)
            stop_tunnel
            ;;
        status)
            status_tunnel
            ;;
        logs)
            logs_tunnel
            ;;
        delete)
            delete_tunnel
            ;;
        restart)
            stop_tunnel
            sleep 2
            main start
            ;;
        *)
            echo "🔧 Cloudflare Tunnel Helper for Arbiter Webhooks"
            echo ""
            echo "Usage: $0 {start|stop|restart|status|logs|delete}"
            echo ""
            echo "Commands:"
            echo "  start   - Create and start the tunnel"
            echo "  stop    - Stop the running tunnel"
            echo "  restart - Restart the tunnel"
            echo "  status  - Check tunnel status"
            echo "  logs    - Show tunnel logs"
            echo "  delete  - Delete the tunnel completely"
            echo ""
            echo "🔒 Security Configuration (Environment Variables):"
            echo "  TUNNEL_MODE       - Security mode (default: webhook-only)"
            echo "                     webhook-only: Only webhook endpoints (SECURE)"
            echo "                     full-api:     All API endpoints (INSECURE)"
            echo "                     custom:       Manual configuration"
            echo ""
            echo "📡 Basic Configuration:"
            echo "  TUNNEL_NAME       - Name of the tunnel (default: arbiter-dev)"
            echo "  LOCAL_PORT        - Local port to expose (default: 5050)"
            echo "  CLOUDFLARE_DOMAIN - Your Cloudflare domain (optional)"
            echo ""
            echo "🛡️ Security Examples:"
            echo "  TUNNEL_MODE=webhook-only $0 start  # Secure (default)"
            echo "  TUNNEL_MODE=full-api $0 start      # All endpoints"
            echo ""
            echo "⚠️  Security Warning:"
            echo "  webhook-only mode is STRONGLY recommended for production!"
            echo "  full-api mode exposes ALL server endpoints to the internet."
            echo ""
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"