/**
 * Cloudflare Durable Object template for Claude Code automation.
 *
 * Copy into `handlers/github/` or `handlers/gitlab/`, rename to match the event
 * you want to capture (e.g. `push.js`), and update the endpoint/namespace to
 * point at your deployed Durable Object. The container blueprint boots Claude
 * Code, checks out the triggering repository, and runs a non-interactive Claude prompt.
 */

module.exports = {
  cloudflare: {
    type: 'durable-object',
    endpoint: 'https://your-worker-subdomain.workers.dev/hooks/claude-code',
    objectName: 'claude-code-webhook-container',
    namespace: 'claude-code',
    method: 'POST',
    headers: {
      'x-arbiter-template': 'claude-code',
      'x-arbiter-runtime': 'cloudflare',
    },
    timeoutMs: 60000,
    forwardSecrets: [
      'CLOUDFLARE_API_TOKEN',
      'CLAUDE_API_KEY',
      'GIT_ACCESS_TOKEN',
      'GITHUB_TOKEN',
      'OPENROUTER_API_KEY',
    ],
    container: {
      template: 'claude-code',
      name: 'claude-code-webhook-container',
      branch: 'main',
      entry: 'server.mjs',
      command: 'node',
      args: ['server.mjs'],
      workdir: '/srv/claude-code',
      environment: {
        CLAUDE_CODE_MODEL: 'openrouter/x-ai/grok-4-fast',
        CLAUDE_CODE_WORKDIR: '/srv/claude-code/workspaces',
        BIFROST_ENABLED: '1',
        BIFROST_HOST: '0.0.0.0',
        BIFROST_PORT: '8080',
        BIFROST_GATEWAY_URL: 'http://127.0.0.1:8080',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4318',
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_SERVICE_NAME: 'claude-code-bifrost',
        CLAUDE_CODE_OTEL_SERVICE_NAME: 'claude-code-runner',
      },
      image: '',
      description:
        'Durable Object container primed to install Claude Code, clone the triggering repository, and run a non-interactive Claude prompt.',
    },
  },
  config: {
    enabled: false,
    timeout: 90000,
    retries: 1,
    environment: {
      ARBITER_HANDLER_NAME: 'claude-code-cloudflare-template',
    },
    secrets: {
      CLOUDFLARE_API_TOKEN: '',
      CLAUDE_API_KEY: '',
      GIT_ACCESS_TOKEN: '',
      GITHUB_TOKEN: '',
      OPENROUTER_API_KEY: '',
    },
  },
  metadata: {
    name: 'Claude Code Cloudflare Durable Object Template',
    description:
      'Forwards webhook payloads to a Claude Code container with an embedded Bifrost gateway, capturing output from a non-interactive Claude run with traces shipped to your OpenTelemetry collector.',
    version: '0.1.0',
    supportedEvents: ['*'],
    requiredPermissions: ['cloudflare:durable-object', 'git:clone'],
  },
};
