/**
 * Cloudflare Durable Object template for Codex-powered webhook handlers.
 *
 * Copy this file into `handlers/github/` or `handlers/gitlab/` and rename it to the
 * event you want to handle (e.g., `push.js`). Customize the endpoint, secrets, and
 * container overrides as needed before enabling the handler.
 */

module.exports = {
  cloudflare: {
    type: 'durable-object',
    endpoint: 'https://your-worker-subdomain.workers.dev/hooks/codex',
    objectName: 'codex-webhook-container',
    namespace: 'codex',
    method: 'POST',
    headers: {
      'x-arbiter-template': 'codex',
      'x-arbiter-runtime': 'cloudflare',
    },
    timeoutMs: 45000,
    forwardSecrets: ['CLOUDFLARE_API_TOKEN', 'CODEX_API_KEY'],
    container: {
      template: 'codex',
      name: 'codex-webhook-container',
      repository: 'https://github.com/your-org/codex-webhook-template',
      branch: 'main',
      entry: 'src/index.ts',
      command: 'bun run serve',
      args: ['--mode=webhook'],
      environment: {
        CODEX_MODEL: 'gpt-4.1',
        ARBITER_ORIGIN: 'https://arbiter.example.com',
      },
      image: '',
      description:
        'Durable Object container template for executing Codex code in response to webhooks.',
    },
  },
  config: {
    enabled: false,
    timeout: 60000,
    retries: 1,
    environment: {
      ARBITER_HANDLER_NAME: 'codex-cloudflare-template',
    },
    secrets: {
      CLOUDFLARE_API_TOKEN: '',
      CODEX_API_KEY: '',
    },
  },
  metadata: {
    name: 'Codex Cloudflare Durable Object Template',
    description:
      'Template handler that forwards webhook payloads to a Codex-powered Durable Object container.',
    version: '0.1.0',
    supportedEvents: ['*'],
    requiredPermissions: ['cloudflare:durable-object'],
  },
};
