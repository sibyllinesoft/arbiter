/**
 * Cloudflare Durable Object template for ingesting Arbiter telemetry into R2.
 *
 * Deploy alongside webhook automation containers (such as the Claude Code
 * template) to accept OTLP traffic from your agents and persist traces in a
 * Cloudflare R2 data lake for later analysis.
 */

module.exports = {
  cloudflare: {
    type: 'durable-object',
    endpoint: 'https://your-worker-subdomain.workers.dev/otel/collect',
    objectName: 'arbiter-otel-collector',
    namespace: 'arbiter-otel',
    method: 'POST',
    headers: {
      'x-arbiter-template': 'otel-collector',
      'x-arbiter-runtime': 'cloudflare',
    },
    timeoutMs: 60000,
    forwardSecrets: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_SESSION_TOKEN'],
    container: {
      template: 'otel-collector',
      name: 'arbiter-otel-collector',
      branch: 'main',
      entry: '/otelcol-contrib',
      command: '/otelcol-contrib',
      args: ['--config=/etc/otelcol-contrib/config.yaml'],
      workdir: '/',
      environment: {
        R2_BUCKET: 'my-observability-bucket',
        R2_BASE_PREFIX: 'otel/traces',
        R2_REGION: 'auto',
        R2_S3_ENDPOINT: 'https://<account-id>.r2.cloudflarestorage.com',
        OTEL_ENVIRONMENT: 'cloudflare-workers',
        AWS_REGION: 'auto',
      },
      description:
        'Receives OTLP traces over HTTP/gRPC and exports gzipped OTLP JSON files to a Cloudflare R2 bucket.',
    },
  },
  config: {
    enabled: false,
    timeout: 90000,
    retries: 1,
    environment: {
      ARBITER_HANDLER_NAME: 'arbiter-otel-collector-template',
    },
    secrets: {
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_SESSION_TOKEN: '',
    },
  },
  metadata: {
    name: 'Arbiter OpenTelemetry Collector (R2)',
    description:
      'Durable Object container that accepts OTLP traffic and stores compressed traces inside a Cloudflare R2 data catalog.',
    version: '0.1.0',
    supportedEvents: ['*'],
    requiredPermissions: ['cloudflare:durable-object', 'r2:write'],
  },
};
