# Arbiter Webhooks

Arbiter now supports GitLab and GitHub webhooks for automatic spec synchronization and validation when repository events occur.

## 🚀 Quick Start

### 1. Enable Webhooks

Set environment variables for your Arbiter server:

```bash
export WEBHOOKS_ENABLED=true
export WEBHOOK_SECRET=your-secure-secret-key
export GITHUB_WEBHOOK_SECRET=github-specific-secret  # Optional: provider-specific
export GITLAB_WEBHOOK_SECRET=gitlab-specific-secret  # Optional: provider-specific
```

### 2. Start Secure Cloudflare Tunnel (for local development)

```bash
# Install cloudflared if not already installed
# macOS: brew install cloudflare/cloudflare/cloudflared
# Linux: Download from https://github.com/cloudflare/cloudflared/releases

# Login to Cloudflare (one-time setup)
cloudflared tunnel login

# Start secure tunnel (webhook-only mode - RECOMMENDED)
TUNNEL_MODE=webhook-only ./scripts/cloudflare-tunnel.sh start

# Alternative: Full API access (LESS SECURE)
TUNNEL_MODE=full-api ./scripts/cloudflare-tunnel.sh start
```

**🔒 Security Modes:**

- **`webhook-only` (Default & Recommended)**: Only webhook endpoints exposed
  - ✅ IP filtering for GitHub/GitLab sources only
  - ✅ Path-based access control (only `/webhooks/*` and `/health`)
  - ✅ Reverse proxy with security filtering
  
- **`full-api` (Less Secure)**: All API endpoints exposed
  - ⚠️ Exposes entire Arbiter API to internet
  - ⚠️ Use only for development/testing

The secure tunnel will output your protected webhook URLs:
- GitHub: `https://your-tunnel.cfargotunnel.com/webhooks/github`
- GitLab: `https://your-tunnel.cfargotunnel.com/webhooks/gitlab`

### 3. Configure Repository Webhooks

#### GitHub
1. Go to your repository → Settings → Webhooks
2. Click "Add webhook"
3. Set Payload URL to: `https://your-tunnel.cfargotunnel.com/webhooks/github`
4. Set Content type to: `application/json`
5. Set Secret to your `WEBHOOK_SECRET` or `GITHUB_WEBHOOK_SECRET`
6. Select events: `push`, `pull requests`
7. Click "Add webhook"

#### GitLab
1. Go to your project → Settings → Webhooks
2. Set URL to: `https://your-tunnel.cfargotunnel.com/webhooks/gitlab`
3. Set Secret Token to your `WEBHOOK_SECRET` or `GITLAB_WEBHOOK_SECRET`
4. Select triggers: `Push events`, `Merge request events`
5. Click "Add webhook"

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBHOOKS_ENABLED` | Enable/disable webhook processing | `false` |
| `WEBHOOK_SECRET` | Universal webhook secret | - |
| `GITHUB_WEBHOOK_SECRET` | GitHub-specific secret (overrides universal) | - |
| `GITLAB_WEBHOOK_SECRET` | GitLab-specific secret (overrides universal) | - |
| `WEBHOOK_ALLOWED_REPOS` | Comma-separated list of allowed repo names | All repos |
| `WEBHOOK_SYNC_ON_PUSH` | Auto-sync specs on push events | `true` |
| `WEBHOOK_VALIDATE_ON_MERGE` | Auto-validate on merge/PR close | `true` |

### Project Configuration

Use the Arbiter CLI to configure webhooks per project:

```bash
# List webhook status
arbiter webhook list

# Configure webhook for a project
arbiter webhook set my-project \
  --provider github \
  --repository https://github.com/user/repo.git \
  --events push,pull_request \
  --secret your-secret

# Get webhook configuration
arbiter webhook get my-project

# Delete webhook configuration
arbiter webhook delete my-project --force
```

## 🧪 Testing

### Test Webhook Endpoints

```bash
# Test GitHub webhook
arbiter webhook test github --secret your-secret

# Test GitLab webhook  
arbiter webhook test gitlab --secret your-secret

# Run comprehensive test suite
./scripts/test-webhooks.sh all
```

### Manual Testing with curl

```bash
# Test GitHub push webhook
curl -X POST http://localhost:5050/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=your-signature" \
  -d @test-github-payload.json

# Test GitLab push webhook
curl -X POST http://localhost:5050/webhooks/gitlab \
  -H "Content-Type: application/json" \
  -H "X-Gitlab-Event: Push Hook" \
  -H "X-Gitlab-Token: your-secret" \
  -d @test-gitlab-payload.json
```

## 🔒 Security

### Multi-Layer Security Architecture

Arbiter implements comprehensive webhook security through multiple layers:

#### 1. **Tunnel-Level Security (Recommended)**

**Webhook-Only Mode (Default)**:
- **Path Filtering**: Only `/webhooks/*` and `/health` endpoints exposed
- **IP Whitelisting**: Restricts access to GitHub/GitLab IP ranges only
- **Reverse Proxy**: Built-in filtering proxy validates all requests
- **Zero Trust**: No other API endpoints accessible from internet

```bash
# Secure mode (default)
TUNNEL_MODE=webhook-only ./scripts/cloudflare-tunnel.sh start
```

**GitHub/GitLab IP Ranges Supported**:
- GitHub: `140.82.112.0/20`, `142.250.0.0/15`, `143.55.64.0/20`, `192.30.252.0/22`, `185.199.108.0/22`
- GitLab: `34.74.90.64/28`, `34.74.226.0/24`, `35.231.147.226/32`, `35.243.134.0/24`

#### 2. **Application-Level Security**

**Signature Verification**:
- **GitHub**: Uses HMAC SHA-256 with `X-Hub-Signature-256` header
- **GitLab**: Uses HMAC SHA-256 with `X-Gitlab-Token` header
- **Cryptographic Validation**: All webhook payloads cryptographically verified

**Repository Filtering**:

Restrict webhooks to specific repositories using `WEBHOOK_ALLOWED_REPOS`:

```bash
export WEBHOOK_ALLOWED_REPOS="user/repo1,org/repo2,company/project"
```

#### 3. **Security Best Practices**

**Production Deployment**:
1. **Use webhook-only mode**: `TUNNEL_MODE=webhook-only` (default and recommended)
2. **Strong secrets**: Generate cryptographically secure webhook secrets (32+ chars)
3. **HTTPS only**: Always use HTTPS for webhook URLs in production
4. **Repository filtering**: Use `WEBHOOK_ALLOWED_REPOS` to restrict access
5. **Monitor logs**: Review webhook processing and proxy logs regularly
6. **Rotate secrets**: Periodically update webhook secrets and tunnel credentials

**Development Recommendations**:
```bash
# Generate secure webhook secret
openssl rand -hex 32

# Start with maximum security
TUNNEL_MODE=webhook-only TUNNEL_NAME=my-project ./scripts/cloudflare-tunnel.sh start

# Monitor security logs
./scripts/cloudflare-tunnel.sh logs  # Tunnel logs
tail -f /tmp/webhook-proxy.log       # Proxy security logs
```

**Security Validation**:
- ✅ Webhook endpoints accessible: `curl https://your-tunnel.example.com/webhooks/github`
- ✅ API endpoints blocked: `curl https://your-tunnel.example.com/api/projects` (should return 404)
- ✅ Non-webhook paths blocked: `curl https://your-tunnel.example.com/` (should return 404)
- ✅ Health endpoint accessible: `curl https://your-tunnel.example.com/health`

## 📡 API Endpoints

### Webhook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks/github` | POST | GitHub webhook receiver |
| `/webhooks/gitlab` | POST | GitLab webhook receiver |

### Management API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks` | GET | List webhook status |
| `/api/webhooks` | POST | Create/update webhook config |
| `/api/webhooks/:projectId` | GET | Get project webhook config |
| `/api/webhooks/:projectId` | DELETE | Delete webhook config |

## 🔄 Event Processing

### Supported Events

#### GitHub
- **push**: Code pushed to repository
- **pull_request**: Pull request opened/closed/merged

#### GitLab
- **Push Hook**: Code pushed to repository  
- **Merge Request Hook**: Merge request opened/closed/merged

### Event Actions

When webhooks are received, Arbiter can:

1. **Sync specifications**: Pull latest spec changes from repository
2. **Validate specs**: Run CUE validation on updated specifications
3. **Broadcast events**: Notify connected WebSocket clients
4. **Log activity**: Record webhook events for auditing

Configure actions via environment variables:
- `WEBHOOK_SYNC_ON_PUSH=true` - Sync specs on push events
- `WEBHOOK_VALIDATE_ON_MERGE=true` - Validate specs on merge events

## 🛠️ Troubleshooting

### Common Issues

#### Webhook not receiving events
1. Check if tunnel is running: `./scripts/cloudflare-tunnel.sh status`
2. Verify webhook URL in repository settings
3. Check server logs: `./scripts/cloudflare-tunnel.sh logs`
4. Test webhook endpoint: `arbiter webhook test github`

#### Signature verification failed
1. Verify webhook secret matches between Arbiter and repository
2. Check environment variables: `WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`, `GITLAB_WEBHOOK_SECRET`
3. Test with known payload: `./scripts/test-webhooks.sh security`

#### Server not processing webhooks
1. Ensure `WEBHOOKS_ENABLED=true`
2. Check server logs for errors
3. Verify Arbiter server is running: `arbiter health`
4. Test API endpoints: `./scripts/test-webhooks.sh api`

### Debug Mode

Enable verbose logging:

```bash
export DEBUG=arbiter:webhooks
bun run dev
```

### Log Files

- **Cloudflare tunnel logs**: `/tmp/cloudflare-tunnel.log`
- **Arbiter server logs**: stdout when running `bun run dev`
- **Test results**: Check exit codes from test scripts

## 📚 CLI Commands Reference

```bash
# Webhook management
arbiter webhook list                          # List webhook status
arbiter webhook help                          # Show setup guide
arbiter webhook get <project-id>              # Get project webhook config
arbiter webhook set <project-id> [options]   # Set webhook configuration
arbiter webhook delete <project-id> --force  # Delete webhook config
arbiter webhook test <provider> [options]    # Test webhook endpoint

# Cloudflare tunnel management
./scripts/cloudflare-tunnel.sh start         # Start tunnel
./scripts/cloudflare-tunnel.sh stop          # Stop tunnel
./scripts/cloudflare-tunnel.sh status        # Check tunnel status
./scripts/cloudflare-tunnel.sh logs          # View tunnel logs
./scripts/cloudflare-tunnel.sh delete        # Delete tunnel

# Testing
./scripts/test-webhooks.sh all              # Run all tests
./scripts/test-webhooks.sh github           # Test GitHub webhooks
./scripts/test-webhooks.sh gitlab           # Test GitLab webhooks
./scripts/test-webhooks.sh api              # Test webhook API
./scripts/test-webhooks.sh security         # Test security features
```

## 🚀 Production Deployment

### Docker Configuration

Add webhook environment variables to your Docker setup:

```dockerfile
ENV WEBHOOKS_ENABLED=true
ENV WEBHOOK_SECRET=your-production-secret
ENV GITHUB_WEBHOOK_SECRET=github-prod-secret
ENV GITLAB_WEBHOOK_SECRET=gitlab-prod-secret
```

### Load Balancer Configuration

Ensure webhook endpoints are accessible:
- Route `/webhooks/*` to Arbiter instances
- Preserve original headers for signature verification
- Use sticky sessions if needed for WebSocket connections

### Monitoring

Monitor webhook processing:
- Track webhook event counts
- Monitor signature verification failures
- Alert on processing errors
- Log webhook response times

### High Availability

For production deployments:
- Use multiple Arbiter instances behind a load balancer
- Store webhook configurations in shared database
- Implement webhook event deduplication
- Set up monitoring and alerting

## 🔗 Related Documentation

- [Arbiter API Documentation](./api.md)
- [Project Configuration](./configuration.md)
- [Development Setup](./development.md)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

## 💡 Tips & Tricks

### Development Workflow
1. Start Arbiter server: `bun run dev`
2. Start Cloudflare tunnel: `./scripts/cloudflare-tunnel.sh start`
3. Configure repository webhooks with tunnel URL
4. Test with: `arbiter webhook test github`
5. Monitor logs: `./scripts/cloudflare-tunnel.sh logs`

### Multiple Projects
Use different webhook secrets per project for better security:
```bash
arbiter webhook set project1 --secret secret1 --provider github
arbiter webhook set project2 --secret secret2 --provider gitlab
```

### Staging Environment
Use different tunnel names for different environments:
```bash
TUNNEL_NAME=arbiter-staging ./scripts/cloudflare-tunnel.sh start
```