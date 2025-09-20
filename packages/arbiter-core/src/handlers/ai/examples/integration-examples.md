# AI Agent Integration Examples

This document provides comprehensive examples of integrating AI agents with
various platforms, tools, and workflows.

## 🔗 GitHub Actions Integration

### Automatic Code Review on PR

```yaml
# .github/workflows/ai-code-review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - name: AI Code Review
        uses: actions/github-script@v7
        with:
          script: |
            const prNumber = context.payload.pull_request.number;
            const comment = `/review-code security

Please analyze this PR for:
- Security vulnerabilities
- Code quality issues
- Performance concerns
- Best practices compliance`;

            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: prNumber,
              body: comment
            });

  security-scan:
    runs-on: ubuntu-latest
    if: contains(github.head_ref, 'security/') || contains(github.head_ref, 'auth/')
    steps:
      - name: Trigger Security Scan
        run: |
          curl -X POST \
            -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"body": "/security-scan critical"}' \
            "https://api.github.com/repos/${{ github.repository }}/issues/${{ github.event.pull_request.number }}/comments"
```

### Issue Auto-Analysis

```yaml
# .github/workflows/ai-issue-analysis.yml
name: AI Issue Analysis
on:
  issues:
    types: [opened]

jobs:
  analyze-issue:
    runs-on: ubuntu-latest
    steps:
      - name: Analyze New Issue
        uses: actions/github-script@v7
        with:
          script: |
            const issueNumber = context.payload.issue.number;
            const labels = context.payload.issue.labels.map(l => l.name);

            // Only analyze issues without labels (newly created)
            if (labels.length === 0) {
              const comment = `/analyze-issue

Auto-analysis requested for new issue. This will help with:
- Issue categorization and labeling
- Priority assessment
- Complexity estimation
- Assignment recommendations`;

              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: issueNumber,
                body: comment
              });
            }
```

## 📊 Slack Integration

### Security Alert Notifications

```javascript
// slack-integration.js
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendSecurityAlert(finding) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🚨 Security Vulnerability Found',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Repository:*\n${finding.repository}`,
        },
        {
          type: 'mrkdwn',
          text: `*Severity:*\n${finding.severity.toUpperCase()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Type:*\n${finding.vulnerabilityType}`,
        },
        {
          type: 'mrkdwn',
          text: `*PR:*\n<${finding.prUrl}|#${finding.prNumber}>`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Finding:*\n${finding.description}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View PR',
          },
          url: finding.prUrl,
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Security Dashboard',
          },
          url: 'https://security.company.com/dashboard',
        },
      ],
    },
  ];

  await slack.chat.postMessage({
    channel: '#security-alerts',
    blocks: blocks,
    text: `Security vulnerability found in ${finding.repository}`,
  });
}

// Usage in AI agent
export async function executeSecurityWebhook(data, eventData, originalEvent) {
  if (data.severity === 'critical' || data.severity === 'high') {
    await sendSecurityAlert({
      repository: eventData.repository.fullName,
      severity: data.severity,
      vulnerabilityType: data.type || 'Unknown',
      prNumber: eventData.pullRequest.number,
      prUrl: eventData.pullRequest.url,
      description: data.summary || 'Security vulnerability detected',
    });
  }
}
```

### Code Review Summary

```javascript
// Send daily code review summary to Slack
export async function sendDailyReviewSummary() {
  const summary = await generateDailyReviewSummary();

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📊 Daily AI Code Review Summary',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*PRs Reviewed:*\n${summary.totalPRs}`,
        },
        {
          type: 'mrkdwn',
          text: `*Issues Found:*\n${summary.totalIssues}`,
        },
        {
          type: 'mrkdwn',
          text: `*Security Findings:*\n${summary.securityFindings}`,
        },
        {
          type: 'mrkdwn',
          text: `*Performance Issues:*\n${summary.performanceIssues}`,
        },
      ],
    },
  ];

  await slack.chat.postMessage({
    channel: '#dev-team',
    blocks: blocks,
  });
}
```

## 🎫 JIRA Integration

### Automatic Security Ticket Creation

```javascript
// jira-integration.js
import { Version3Client } from 'jira.js';

const jira = new Version3Client({
  host: 'https://company.atlassian.net',
  authentication: {
    basic: {
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
    },
  },
});

export async function createSecurityTicket(finding) {
  const issue = {
    fields: {
      project: { key: 'SEC' },
      summary: `Security: ${finding.type} in ${finding.repository}`,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Security vulnerability detected by AI analysis:',
              },
            ],
          },
          {
            type: 'panel',
            attrs: { panelType: 'error' },
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `Severity: ${finding.severity.toUpperCase()}`,
                  },
                  { type: 'hardBreak' },
                  { type: 'text', text: `Type: ${finding.type}` },
                  { type: 'hardBreak' },
                  { type: 'text', text: `Repository: ${finding.repository}` },
                  { type: 'hardBreak' },
                  { type: 'text', text: `PR: `, marks: [{ type: 'strong' }] },
                  {
                    type: 'text',
                    text: `#${finding.prNumber}`,
                    marks: [{ type: 'link', attrs: { href: finding.prUrl } }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Description' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: finding.description }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Remediation' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: finding.remediation || 'See AI analysis for details',
              },
            ],
          },
        ],
      },
      issuetype: { name: 'Security Finding' },
      priority: {
        name:
          finding.severity === 'critical'
            ? 'Highest'
            : finding.severity === 'high'
              ? 'High'
              : finding.severity === 'medium'
                ? 'Medium'
                : 'Low',
      },
      labels: ['ai-detected', 'security', finding.type?.toLowerCase()],
      components: [{ name: 'Security' }],
    },
  };

  const createdIssue = await jira.issues.createIssue(issue);

  // Link to original PR if possible
  if (finding.prUrl) {
    await jira.issueLinks.createIssueLink({
      type: { name: 'Relates' },
      inwardIssue: { key: createdIssue.key },
      outwardIssue: { url: finding.prUrl },
    });
  }

  return createdIssue;
}
```

## 📧 Email Integration

### Security Alert Emails

```javascript
// email-integration.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendSecurityAlertEmail(finding) {
  const html = `
    <h2>🚨 Critical Security Issue Detected</h2>
    
    <table style="border-collapse: collapse; width: 100%;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Repository:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${finding.repository}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Severity:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; color: red;">${finding.severity.toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Type:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${finding.type}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Pull Request:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">
          <a href="${finding.prUrl}">#${finding.prNumber}</a>
        </td>
      </tr>
    </table>

    <h3>Description</h3>
    <p>${finding.description}</p>

    <h3>Remediation</h3>
    <p>${finding.remediation}</p>

    <p>
      <a href="${finding.prUrl}" style="background: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        View Pull Request
      </a>
    </p>

    <hr>
    <p><small>This alert was generated automatically by the AI Security Agent.</small></p>
  `;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM,
    to: process.env.SECURITY_TEAM_EMAIL,
    subject: `🚨 ${finding.severity.toUpperCase()} Security Issue: ${finding.type}`,
    html: html,
  });
}
```

## 📊 Monitoring Integration

### Prometheus Metrics

```javascript
// prometheus-metrics.js
import client from 'prom-client';

// Create metrics
export const aiAgentMetrics = {
  requestsTotal: new client.Counter({
    name: 'ai_agent_requests_total',
    help: 'Total number of AI agent requests',
    labelNames: ['agent', 'command', 'provider', 'status'],
  }),

  responseTime: new client.Histogram({
    name: 'ai_agent_response_time_seconds',
    help: 'AI agent response time in seconds',
    labelNames: ['agent', 'provider'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
  }),

  tokenUsage: new client.Counter({
    name: 'ai_agent_tokens_used_total',
    help: 'Total tokens used by AI agents',
    labelNames: ['agent', 'provider', 'type'],
  }),

  securityFindings: new client.Counter({
    name: 'ai_security_findings_total',
    help: 'Total security findings by severity',
    labelNames: ['severity', 'type', 'repository'],
  }),

  errorRate: new client.Counter({
    name: 'ai_agent_errors_total',
    help: 'Total errors from AI agents',
    labelNames: ['agent', 'error_type'],
  }),
};

// Usage in agents
export function recordAgentMetrics(
  agentId,
  command,
  provider,
  startTime,
  success,
  tokenUsage
) {
  const status = success ? 'success' : 'error';
  const duration = (Date.now() - startTime) / 1000;

  aiAgentMetrics.requestsTotal.inc({
    agent: agentId,
    command,
    provider,
    status,
  });

  aiAgentMetrics.responseTime.observe({ agent: agentId, provider }, duration);

  if (tokenUsage) {
    aiAgentMetrics.tokenUsage.inc(
      { agent: agentId, provider, type: 'input' },
      tokenUsage.inputTokens
    );
    aiAgentMetrics.tokenUsage.inc(
      { agent: agentId, provider, type: 'output' },
      tokenUsage.outputTokens
    );
  }
}

export function recordSecurityFinding(severity, type, repository) {
  aiAgentMetrics.securityFindings.inc({ severity, type, repository });
}
```

### DataDog Integration

```javascript
// datadog-integration.js
import { StatsD } from 'node-statsd';

const statsd = new StatsD({
  host: process.env.DATADOG_HOST || 'localhost',
  port: 8125,
  prefix: 'arbiter.ai.',
});

export function recordDataDogMetrics(
  agentId,
  command,
  startTime,
  success,
  tokenUsage
) {
  const duration = Date.now() - startTime;
  const tags = [`agent:${agentId}`, `command:${command}`];

  // Record response time
  statsd.timing('response_time', duration, tags);

  // Record request count
  statsd.increment('requests', 1, [
    ...tags,
    `status:${success ? 'success' : 'error'}`,
  ]);

  // Record token usage
  if (tokenUsage) {
    statsd.gauge('tokens.input', tokenUsage.inputTokens, tags);
    statsd.gauge('tokens.output', tokenUsage.outputTokens, tags);
    statsd.gauge('tokens.total', tokenUsage.totalTokens, tags);
  }
}

export function recordSecurityEvent(severity, repository) {
  const tags = [`severity:${severity}`, `repo:${repository}`];
  statsd.increment('security.findings', 1, tags);
}
```

## 🐳 Docker Integration

### Container Health Checks

```dockerfile
# Dockerfile with AI agent health checks
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Health check for AI agents
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health/ai || exit 1

EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  arbiter-ai:
    build: .
    environment:
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health/ai']
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - '9090:9090'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
```

## ⚡ Redis Caching Integration

```javascript
// redis-cache.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export class AIResponseCache {
  constructor() {
    this.defaultTTL = 3600; // 1 hour
  }

  // Generate cache key based on code content and command
  generateCacheKey(command, codeHash, provider) {
    return `ai:${provider}:${command}:${codeHash}`;
  }

  // Cache AI analysis results
  async cacheResponse(key, response, ttl = this.defaultTTL) {
    await redis.setex(
      key,
      ttl,
      JSON.stringify({
        response,
        cachedAt: new Date().toISOString(),
        provider: response.provider,
      })
    );
  }

  // Retrieve cached response
  async getCachedResponse(key) {
    const cached = await redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...parsed.response,
        fromCache: true,
        cachedAt: parsed.cachedAt,
      };
    }
    return null;
  }

  // Cache security scan results (longer TTL)
  async cacheSecurityScan(codeHash, findings) {
    const key = `security:scan:${codeHash}`;
    await redis.setex(key, 86400, JSON.stringify(findings)); // 24 hours
  }

  // Invalidate cache for repository
  async invalidateRepositoryCache(repoName) {
    const pattern = `ai:*:*:${repoName}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// Usage in AI agents
export async function getCachedOrAnalyze(command, codeContent, provider) {
  const cache = new AIResponseCache();
  const codeHash = createHash('sha256')
    .update(codeContent)
    .digest('hex')
    .substring(0, 16);
  const cacheKey = cache.generateCacheKey(command, codeHash, provider);

  // Try cache first
  let response = await cache.getCachedResponse(cacheKey);
  if (response) {
    return response;
  }

  // Generate new analysis
  response = await performAIAnalysis(command, codeContent, provider);

  // Cache the result
  await cache.cacheResponse(cacheKey, response);

  return response;
}
```

## 🔄 CI/CD Pipeline Integration

### GitLab CI/CD

```yaml
# .gitlab-ci.yml
stages:
  - analysis
  - test
  - deploy

ai-security-scan:
  stage: analysis
  script:
    - echo "Triggering AI security scan..."
    - |
      curl -X POST \
        -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "body": "/security-scan critical\n\nAutomatic security scan for pipeline '$CI_PIPELINE_ID'"
        }' \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes"
  only:
    - merge_requests
  when: manual

ai-code-review:
  stage: analysis
  script:
    - echo "Requesting AI code review..."
    - |
      curl -X POST \
        -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "body": "/review-code\n\nAutomatic code review for pipeline '$CI_PIPELINE_ID'"
        }' \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes"
  only:
    - merge_requests
```

### Jenkins Integration

```groovy
// Jenkinsfile
pipeline {
    agent any

    stages {
        stage('AI Code Analysis') {
            when {
                changeRequest()
            }
            parallel {
                stage('Security Scan') {
                    steps {
                        script {
                            def prNumber = env.CHANGE_ID
                            def repoUrl = "https://api.github.com/repos/${env.CHANGE_URL.split('/')[3]}/${env.CHANGE_URL.split('/')[4]}"

                            httpRequest(
                                httpMode: 'POST',
                                url: "${repoUrl}/issues/${prNumber}/comments",
                                requestBody: '{"body": "/security-scan critical\\n\\nJenkins Pipeline Security Scan"}',
                                customHeaders: [[name: 'Authorization', value: "token ${env.GITHUB_TOKEN}"]]
                            )
                        }
                    }
                }

                stage('Code Review') {
                    steps {
                        script {
                            def prNumber = env.CHANGE_ID
                            def repoUrl = "https://api.github.com/repos/${env.CHANGE_URL.split('/')[3]}/${env.CHANGE_URL.split('/')[4]}"

                            httpRequest(
                                httpMode: 'POST',
                                url: "${repoUrl}/issues/${prNumber}/comments",
                                requestBody: '{"body": "/review-code\\n\\nJenkins Pipeline Code Review"}',
                                customHeaders: [[name: 'Authorization', value: "token ${env.GITHUB_TOKEN}"]]
                            )
                        }
                    }
                }
            }
        }
    }
}
```

## 🎯 Advanced Integration Patterns

### Webhook Relay Service

```javascript
// webhook-relay.js - Route webhooks to multiple AI agents
export class WebhookRelay {
  constructor(config) {
    this.config = config;
    this.agents = new Map();
  }

  // Route webhook to appropriate agents based on rules
  async routeWebhook(event) {
    const applicableAgents = this.findApplicableAgents(event);
    const results = await Promise.allSettled(
      applicableAgents.map(agent => agent.process(event))
    );

    return {
      processed: applicableAgents.length,
      successful: results.filter(r => r.status === 'fulfilled').length,
      results: results,
    };
  }

  // Find agents based on event content and configuration
  findApplicableAgents(event) {
    const agents = [];

    // Security-related events always go to security agent
    if (this.isSecurityRelated(event)) {
      agents.push(this.agents.get('security-agent'));
    }

    // Large PRs get code review
    if (event.pullRequest && event.pullRequest.changedFiles > 10) {
      agents.push(this.agents.get('code-review-agent'));
    }

    // New issues get analysis
    if (event.eventType === 'issues' && event.payload.action === 'opened') {
      agents.push(this.agents.get('issue-analysis-agent'));
    }

    return agents.filter(Boolean);
  }
}
```

### Multi-Repository Configuration

```javascript
// multi-repo-config.js
export const repositoryConfigs = {
  'company/payment-service': {
    agents: ['security-agent', 'code-review-agent'],
    securityLevel: 'high',
    autoResponse: true,
    notifications: ['slack', 'pagerduty'],
    customPrompts: {
      'security-scan': 'Focus on PCI compliance and payment data security',
    },
  },

  'company/public-website': {
    agents: ['code-review-agent', 'documentation-agent'],
    securityLevel: 'medium',
    autoResponse: false,
    notifications: ['slack'],
    customPrompts: {
      'review-code': 'Focus on performance and accessibility',
    },
  },

  'company/internal-tools': {
    agents: ['issue-analysis-agent'],
    securityLevel: 'low',
    autoResponse: true,
    notifications: [],
  },
};

export function getRepositoryConfig(repoName) {
  return (
    repositoryConfigs[repoName] || {
      agents: ['code-review-agent'],
      securityLevel: 'medium',
      autoResponse: false,
      notifications: ['slack'],
    }
  );
}
```

### Custom Webhook Signatures

```javascript
// webhook-security.js
import crypto from 'crypto';

export function validateGitHubSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = Buffer.from(
    'sha256=' + hmac.update(payload).digest('hex'),
    'utf8'
  );
  const checksum = Buffer.from(signature, 'utf8');

  if (
    checksum.length !== digest.length ||
    !crypto.timingSafeEqual(digest, checksum)
  ) {
    throw new Error('Invalid GitHub webhook signature');
  }
}

export function validateGitLabSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');

  if (digest !== signature) {
    throw new Error('Invalid GitLab webhook signature');
  }
}

// Middleware for webhook validation
export function webhookSecurityMiddleware(req, res, next) {
  const signature =
    req.headers['x-hub-signature-256'] || req.headers['x-gitlab-token'];
  const payload = JSON.stringify(req.body);

  try {
    if (req.headers['x-github-event']) {
      validateGitHubSignature(
        payload,
        signature,
        process.env.GITHUB_WEBHOOK_SECRET
      );
    } else if (req.headers['x-gitlab-event']) {
      validateGitLabSignature(
        payload,
        signature,
        process.env.GITLAB_WEBHOOK_SECRET
      );
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized webhook' });
  }
}
```

---

These integration examples provide a comprehensive foundation for connecting AI
agents with various platforms and services. Each example includes
production-ready code with proper error handling, security considerations, and
monitoring integration.

For more specific integration needs, refer to the individual platform
documentation and adapt these examples accordingly.
