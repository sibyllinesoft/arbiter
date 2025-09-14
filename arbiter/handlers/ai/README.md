# AI Agent Webhook Handlers

**Intelligent automation for your Git workflows with AI-powered code review, issue analysis, documentation generation, and security scanning.**

## 🤖 Overview

This AI agent system extends Arbiter's webhook handlers with powerful AI capabilities, providing automated assistance for common development tasks. The system features:

- **Command-line style interface** - Trigger AI actions with `/commands` in comments
- **Multiple AI providers** - Support for Claude, OpenAI GPT, and Google Gemini
- **Extensible architecture** - Easy to add new agents and customize behavior
- **Production ready** - Rate limiting, error handling, and comprehensive logging
- **Security focused** - Built-in security scanning and vulnerability detection

## 🎯 Key Features

### AI-Powered Agents

- **Code Review Agent**: Automated code quality, security, and performance analysis
- **Issue Analysis Agent**: Intelligent issue categorization, prioritization, and triaging
- **Documentation Agent**: Automated documentation generation and maintenance
- **Security Agent**: Comprehensive security vulnerability scanning and analysis

### Command-Line Interface

Interact with AI agents using simple commands in PR comments, issue descriptions, or commit messages:

```bash
# Code review commands
/review-code                    # Comprehensive code review
/security-scan critical         # Security vulnerability scan
/performance-check             # Performance analysis

# Issue analysis commands
/analyze-issue                 # Comprehensive issue analysis
/categorize                    # Categorize and label issue
/estimate                      # Complexity estimation

# Documentation commands
/generate-docs api             # Generate API documentation
/readme                        # Create or update README
/changelog                     # Generate changelog entries

# Security commands
/vulnerability-check injection  # Check for injection vulnerabilities
/dependency-audit              # Audit third-party dependencies
/auth-review                   # Review authentication/authorization
```

### Multi-Provider AI Support

Choose the best AI provider for your needs:

- **Claude (Anthropic)**: Excellent for code analysis and security reviews
- **OpenAI GPT**: Strong general-purpose AI with good code understanding
- **Google Gemini**: Advanced multimodal capabilities with safety features

## 🚀 Quick Start

### 1. Configuration

Copy and customize the AI agents configuration:

```bash
cp arbiter/handlers/ai/config/ai-agents.json.example arbiter/handlers/ai/config/ai-agents.json
```

### 2. Enable Your First Agent

Edit `ai-agents.json` to enable the code review agent:

```json
{
  "agents": {
    "code-review-agent": {
      "enabled": true,
      "provider": {
        "type": "claude",
        "config": {
          "apiKey": "your-claude-api-key"
        }
      }
    }
  }
}
```

### 3. Set Up Webhooks

Configure your repository webhooks to point to:
- GitHub: `https://your-domain.com/webhooks/ai/github`
- GitLab: `https://your-domain.com/webhooks/ai/gitlab`

### 4. Try It Out

Create a pull request and add a comment:

```
@arbiter-ai /review-code

Please review this PR for code quality, security issues, and performance concerns.
```

The AI agent will analyze your code and provide detailed feedback!

## 📚 Agent Documentation

### Code Review Agent

Automated code review with comprehensive analysis:

**Capabilities:**
- Code quality assessment (structure, readability, maintainability)
- Security vulnerability detection
- Performance analysis and optimization suggestions
- Architecture and design pattern review
- Testing coverage and quality analysis

**Commands:**
- `/review-code` - Comprehensive review
- `/security-scan [severity]` - Security-focused analysis
- `/performance-check [metric]` - Performance analysis
- `/style-check [language]` - Code style review
- `/architecture-review [aspect]` - Design pattern analysis

**Configuration:**
```json
{
  "code-review-agent": {
    "enabled": true,
    "behavior": {
      "autoResponse": false,
      "verboseLogging": false
    },
    "eventFilters": [
      "github.pull_request",
      "github.push",
      "gitlab.merge_request"
    ]
  }
}
```

### Issue Analysis Agent

Intelligent issue management and triaging:

**Capabilities:**
- Automatic issue categorization (bug, feature, enhancement, etc.)
- Priority assessment (critical, high, medium, low)
- Complexity estimation with story points
- Team member assignment recommendations
- Next steps and action item generation

**Commands:**
- `/analyze-issue` - Comprehensive analysis
- `/categorize` - Categorization and labeling
- `/estimate` - Complexity estimation
- `/triage` - Priority assessment
- `/suggest-assignee` - Assignment recommendations

**Auto-triggers:**
- Runs automatically on new issue creation
- Analyzes issue content and suggests improvements

### Documentation Agent

Automated documentation generation and maintenance:

**Capabilities:**
- API documentation generation (OpenAPI/Swagger)
- README creation and updates
- Code comment suggestions
- Changelog generation
- Migration guide creation

**Commands:**
- `/generate-docs [type]` - Comprehensive documentation
- `/api-docs [format]` - API documentation
- `/readme [section]` - README generation
- `/changelog` - Changelog entries
- `/migration-guide` - Migration documentation
- `/code-comments` - Inline comment suggestions

### Security Agent

Comprehensive security analysis and vulnerability detection:

**Capabilities:**
- OWASP Top 10 vulnerability detection
- Dependency security auditing
- Authentication/authorization review
- Data privacy compliance (GDPR, CCPA)
- Security configuration analysis

**Commands:**
- `/security-scan [severity]` - Full security analysis
- `/vulnerability-check [type]` - Specific vulnerability detection
- `/dependency-audit` - Third-party security audit
- `/auth-review` - Authentication review
- `/data-privacy [regulation]` - Privacy compliance check
- `/config-security` - Security configuration review

## ⚙️ Configuration Guide

### Basic Configuration

The main configuration file is `ai-agents.json`:

```json
{
  "aiProviders": {
    "claude": {
      "enabled": true,
      "config": {
        "apiKey": "CLAUDE_API_KEY",
        "model": "claude-3-5-sonnet-20241022",
        "maxTokens": 4000,
        "temperature": 0.7
      }
    }
  },
  "agents": {
    "code-review-agent": {
      "enabled": false,
      "provider": { "type": "claude" },
      "rateLimits": {
        "requestsPerHour": 100
      }
    }
  }
}
```

### Environment Variables

Set these environment variables for security:

```bash
# AI Provider API Keys
export CLAUDE_API_KEY="sk-..."
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."

# Webhook Secrets
export GITHUB_AI_WEBHOOK_SECRET="..."
export GITLAB_AI_WEBHOOK_SECRET="..."

# Integration Tokens
export GITHUB_TOKEN="ghp_..."
export GITLAB_TOKEN="glpat-..."
```

### Rate Limiting

Configure rate limits to control AI usage and costs:

```json
{
  "rateLimits": {
    "enabled": true,
    "requestsPerMinute": 10,
    "requestsPerHour": 100,
    "requestsPerDay": 1000
  }
}
```

### Event Filtering

Control which events trigger each agent:

```json
{
  "eventFilters": [
    "github.pull_request",
    "github.issues",
    "gitlab.merge_request"
  ]
}
```

## 🔧 Advanced Usage

### Custom Prompts

Override default prompts for specific use cases:

```json
{
  "commands": {
    "customPrompts": {
      "security-scan": "Focus on OWASP Top 10 vulnerabilities and provide CVSS scores for any findings."
    }
  }
}
```

### Webhook Integration

Integrate with external systems using webhooks:

```json
{
  "actionIntegrations": {
    "slack": {
      "enabled": true,
      "webhookUrl": "https://hooks.slack.com/...",
      "notifyOn": ["security-critical", "error"]
    }
  }
}
```

### Multi-Repository Setup

Configure different agents for different repositories:

```json
{
  "security": {
    "allowedRepos": [
      "owner/critical-repo",
      "owner/public-repo"
    ]
  }
}
```

## 📊 Monitoring and Metrics

### Health Checks

Monitor agent health at `/health/ai`:

```json
{
  "status": "healthy",
  "agents": {
    "code-review-agent": {
      "status": "active",
      "provider": "claude",
      "lastActivity": "2024-01-01T12:00:00Z"
    }
  },
  "metrics": {
    "totalRequests": 1234,
    "successRate": 0.95,
    "averageResponseTime": 2500
  }
}
```

### Metrics Endpoint

Get detailed metrics at `/metrics/ai`:

```
# Agent usage metrics
ai_agent_requests_total{agent="code-review-agent"} 150
ai_agent_response_time_seconds{agent="code-review-agent"} 2.5
ai_agent_errors_total{agent="code-review-agent"} 2

# Provider metrics
ai_provider_tokens_used{provider="claude"} 50000
ai_provider_requests_total{provider="claude"} 75
```

### Logging

Comprehensive logging for debugging and auditing:

```json
{
  "type": "ai.agent.command.processed",
  "timestamp": "2024-01-01T12:00:00Z",
  "agentId": "code-review-agent",
  "command": "review-code",
  "success": true,
  "processingTime": 2500,
  "tokenUsage": 1200
}
```

## 🛡️ Security Considerations

### API Key Management

- Store API keys in environment variables, never in configuration files
- Use different API keys for development and production
- Regularly rotate API keys
- Monitor API usage for unusual activity

### Webhook Security

- Always validate webhook signatures
- Use HTTPS for all webhook endpoints
- Implement rate limiting to prevent abuse
- Log all webhook requests for auditing

### Data Privacy

- AI agents process code and issue content - ensure compliance with your data policies
- Consider data residency requirements for different AI providers
- Implement data retention policies for logs and metrics
- Review AI provider terms of service for data handling

## 🔍 Troubleshooting

### Common Issues

**Agent not responding to commands:**
1. Check agent is enabled in configuration
2. Verify webhook endpoints are correctly configured
3. Check API key is valid and has sufficient quota
4. Review logs for error messages

**Rate limit exceeded:**
```bash
# Check current usage
curl https://your-domain.com/metrics/ai | grep rate_limit

# Adjust limits in configuration
{
  "rateLimits": {
    "requestsPerHour": 200
  }
}
```

**Provider connection failures:**
```bash
# Test provider connectivity
curl -X POST https://your-domain.com/api/ai/test-providers

# Check API key validity
# Review provider-specific error messages in logs
```

### Debug Mode

Enable verbose logging for troubleshooting:

```json
{
  "behavior": {
    "verboseLogging": true,
    "dryRun": true
  }
}
```

### Log Analysis

Key log events to monitor:

- `ai.agent.event.received` - Webhook received
- `ai.agent.command.processed` - Command processed
- `ai.agent.action.comment` - Comment posted
- `ai.agent.error` - Error occurred

## 🚀 Production Deployment

### Performance Optimization

1. **Choose appropriate AI models:**
   - Claude Haiku for simple tasks (faster, cheaper)
   - Claude Sonnet for complex analysis (balanced)
   - GPT-4 Turbo for general purpose

2. **Implement caching:**
   - Cache similar code analysis results
   - Implement request deduplication
   - Cache provider responses when appropriate

3. **Resource management:**
   - Set appropriate timeouts (30-60 seconds)
   - Limit concurrent agent processing
   - Monitor memory usage with multiple agents

### Scaling Considerations

- **Horizontal scaling:** Deploy multiple instances with load balancing
- **Database:** Use shared database for metrics and configuration
- **Queue system:** Implement async processing for high-volume repositories
- **CDN:** Cache static assets and documentation

### Backup and Recovery

- **Configuration backup:** Version control `ai-agents.json`
- **Metrics backup:** Export metrics data regularly
- **Log rotation:** Implement log rotation and archival
- **Disaster recovery:** Document recovery procedures

## 🤝 Contributing

### Adding New Agents

1. Create agent class extending `AIAgentHandler`
2. Implement required methods (`processEvent`, `initializeCommands`, etc.)
3. Add configuration schema to `ai-agents.json`
4. Update `AgentManager` to support new agent type
5. Add comprehensive tests and documentation

### Adding New AI Providers

1. Implement `AIProvider` interface
2. Add provider configuration schema
3. Update provider factory in agents
4. Add provider-specific error handling
5. Test with different model types

### Testing

Run the test suite:

```bash
# Unit tests
npm test ai/

# Integration tests
npm run test:integration:ai

# E2E tests with real providers
npm run test:e2e:ai
```

## 📋 Example Configurations

### Small Team Setup

Recommended for teams of 2-5 developers:

```json
{
  "agents": {
    "code-review-agent": {
      "enabled": true,
      "behavior": { "autoResponse": true },
      "rateLimits": { "requestsPerHour": 50 }
    },
    "security-agent": {
      "enabled": true,
      "behavior": { "autoResponse": false },
      "rateLimits": { "requestsPerHour": 20 }
    }
  }
}
```

### Enterprise Setup

Full-featured setup with all agents:

```json
{
  "agents": {
    "code-review-agent": { "enabled": true },
    "issue-analysis-agent": { "enabled": true },
    "documentation-agent": { "enabled": true },
    "security-agent": { "enabled": true }
  },
  "actionIntegrations": {
    "slack": { "enabled": true },
    "jira": { "enabled": true }
  },
  "monitoring": {
    "alerting": { "enabled": true }
  }
}
```

### Security-Focused Setup

High-security environment configuration:

```json
{
  "agents": {
    "security-agent": {
      "enabled": true,
      "behavior": { "autoResponse": true },
      "commands": {
        "enabled": ["security-scan", "vulnerability-check", "dependency-audit"]
      }
    }
  },
  "security": {
    "requireUserMention": true,
    "allowedUsers": ["security-team"],
    "allowedRepos": ["org/critical-app"]
  }
}
```

## 🔗 Integration Examples

### GitHub Actions

Trigger AI analysis in GitHub Actions:

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger AI Review
        run: |
          curl -X POST \
            -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"body": "/review-code security"}' \
            "https://api.github.com/repos/${{ github.repository }}/issues/${{ github.event.pull_request.number }}/comments"
```

### Slack Integration

Get notifications in Slack:

```json
{
  "actionIntegrations": {
    "slack": {
      "enabled": true,
      "webhookUrl": "https://hooks.slack.com/services/...",
      "channel": "#code-reviews",
      "notifyOn": ["security-critical", "error", "rate-limit"],
      "messageFormat": {
        "security-critical": "🚨 Critical security issue found in PR #{{pr_number}}: {{message}}"
      }
    }
  }
}
```

### JIRA Integration

Create JIRA tickets for security findings:

```json
{
  "actionIntegrations": {
    "jira": {
      "enabled": true,
      "baseUrl": "https://yourcompany.atlassian.net",
      "apiKey": "JIRA_API_KEY",
      "projectKey": "SEC",
      "createIssueOn": ["security-critical", "vulnerability-found"]
    }
  }
}
```

---

## 📞 Support

- **Documentation**: Full API documentation available at `/docs/ai`
- **Health Check**: Monitor system status at `/health/ai`
- **Metrics**: View usage metrics at `/metrics/ai`
- **Logs**: Check application logs for detailed troubleshooting

For issues, feature requests, or contributions, please refer to the main Arbiter documentation or contact your system administrator.

---

*Last Updated: 2024-09-14 | Version: 2.0.0*