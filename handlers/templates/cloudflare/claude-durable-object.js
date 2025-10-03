/**
 * Cloudflare Durable Object template for Claude code automation.
 *
 * Copy this file into a provider directory (e.g., `handlers/github/`) and rename it to match
 * the event you want to proxy. Update the endpoint, namespace, and secrets before enabling.
 */

module.exports = {
  cloudflare: {
    type: 'durable-object',
    endpoint: 'https://your-worker-subdomain.workers.dev/hooks/claude',
    objectName: 'claude-webhook-container',
    namespace: 'claude',
    method: 'POST',
    headers: {
      'x-arbiter-template': 'claude',
      'x-arbiter-runtime': 'cloudflare',
    },
    timeoutMs: 45000,
    forwardSecrets: ['CLOUDFLARE_API_TOKEN', 'CLAUDE_API_KEY'],
    container: {
      template: 'claude',
      name: 'claude-webhook-container',
      repository: 'https://github.com/your-org/claude-webhook-template',
      branch: 'main',
      entry: 'src/index.ts',
      command: 'bun run serve',
      args: ['--mode=webhook'],
      environment: {
        CLAUDE_MODEL: 'claude-3-5-sonnet',
        ARBITER_ORIGIN: 'https://arbiter.example.com',
      },
      image: '',
      description:
        'Durable Object container template for forwarding webhook payloads into Claude workflows.',
    },
  },
  config: {
    enabled: false,
    timeout: 60000,
    retries: 1,
    environment: {
      ARBITER_HANDLER_NAME: 'claude-cloudflare-template',
    },
    secrets: {
      CLOUDFLARE_API_TOKEN: '',
      CLAUDE_API_KEY: '',
    },
  },
  metadata: {
    name: 'Claude Cloudflare Durable Object Template',
    description:
      'Template handler that forwards webhook payloads to a Claude-powered Durable Object container.',
    version: '0.1.0',
    supportedEvents: ['*'],
    requiredPermissions: ['cloudflare:durable-object'],
  },
};
