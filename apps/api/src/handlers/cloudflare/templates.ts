import type {
  CloudflareContainerTemplate,
  CloudflareDurableObjectHandlerConfig,
} from '../types.js';

type DurableObjectTemplateOptions = {
  endpoint: string;
  objectName?: string;
  objectId?: string;
  namespace?: string;
  headers?: Record<string, string>;
  forwardSecrets?: string[];
  timeoutMs?: number;
  containerOverrides?: Partial<CloudflareContainerTemplate>;
};

const defaultCodexContainer: CloudflareContainerTemplate = {
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
  description:
    'Container Durable Object template for executing Codex code fragments via Cloudflare.',
};

const defaultClaudeContainer: CloudflareContainerTemplate = {
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
  description: 'Container Durable Object template for executing Claude code flows via Cloudflare.',
};

const defaultClaudeCodeContainer: CloudflareContainerTemplate = {
  template: 'claude-code',
  name: 'claude-code-webhook-container',
  branch: 'main',
  entry: 'server.mjs',
  command: 'node',
  args: ['server.mjs'],
  workdir: '/srv/claude-code',
  environment: {
    CLAUDE_CODE_MODEL: 'claude-3-5-sonnet',
    CLAUDE_CODE_WORKDIR: '/srv/claude-code/workspaces',
    CLAUDE_CODE_PLAYBOOK: 'playbooks/webhook.yml',
  },
  description:
    'Durable Object container primed to install Claude Code, clone the triggering repository, and execute playbooks.',
};

const defaultOtelCollectorContainer: CloudflareContainerTemplate = {
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
    'Durable Object container that accepts OTLP traffic and writes gzipped OTLP JSON traces to Cloudflare R2.',
};

export const codexContainerTemplate: CloudflareContainerTemplate = {
  ...defaultCodexContainer,
};

export const claudeContainerTemplate: CloudflareContainerTemplate = {
  ...defaultClaudeContainer,
};

export const claudeCodeContainerTemplate: CloudflareContainerTemplate = {
  ...defaultClaudeCodeContainer,
};

export const otelCollectorContainerTemplate: CloudflareContainerTemplate = {
  ...defaultOtelCollectorContainer,
};

export function createCodexDurableObjectConfig(
  options: DurableObjectTemplateOptions
): CloudflareDurableObjectHandlerConfig {
  return buildDurableObjectConfig({
    defaults: defaultCodexContainer,
    templateName: 'codex',
    fallbackObjectName: 'codex-webhook-container',
    fallbackNamespace: 'codex',
    forwardSecrets: ['CLOUDFLARE_API_TOKEN', 'CODEX_API_KEY'],
    ...options,
  });
}

export function createClaudeDurableObjectConfig(
  options: DurableObjectTemplateOptions
): CloudflareDurableObjectHandlerConfig {
  return buildDurableObjectConfig({
    defaults: defaultClaudeContainer,
    templateName: 'claude',
    fallbackObjectName: 'claude-webhook-container',
    fallbackNamespace: 'claude',
    forwardSecrets: ['CLOUDFLARE_API_TOKEN', 'CLAUDE_API_KEY'],
    ...options,
  });
}

export function createClaudeCodeDurableObjectConfig(
  options: DurableObjectTemplateOptions
): CloudflareDurableObjectHandlerConfig {
  return buildDurableObjectConfig({
    defaults: defaultClaudeCodeContainer,
    templateName: 'claude-code',
    fallbackObjectName: 'claude-code-webhook-container',
    fallbackNamespace: 'claude-code',
    forwardSecrets: ['CLOUDFLARE_API_TOKEN', 'CLAUDE_API_KEY', 'GIT_ACCESS_TOKEN'],
    ...options,
  });
}

export function createOtelCollectorDurableObjectConfig(
  options: DurableObjectTemplateOptions
): CloudflareDurableObjectHandlerConfig {
  return buildDurableObjectConfig({
    defaults: defaultOtelCollectorContainer,
    templateName: 'otel-collector',
    fallbackObjectName: 'arbiter-otel-collector',
    fallbackNamespace: 'arbiter-otel',
    forwardSecrets: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_SESSION_TOKEN'],
    ...options,
  });
}

type BuildConfigOptions = DurableObjectTemplateOptions & {
  defaults: CloudflareContainerTemplate;
  templateName: string;
  fallbackObjectName: string;
  fallbackNamespace: string;
  forwardSecrets: string[];
};

function buildDurableObjectConfig(
  options: BuildConfigOptions
): CloudflareDurableObjectHandlerConfig {
  const {
    endpoint,
    objectId,
    objectName,
    namespace,
    headers,
    forwardSecrets,
    timeoutMs,
    containerOverrides,
    defaults,
    templateName,
    fallbackObjectName,
    fallbackNamespace,
  } = options;

  if (!endpoint) {
    throw new Error('Cloudflare Durable Object endpoint is required to build config');
  }

  const container: CloudflareContainerTemplate = {
    ...defaults,
    ...(containerOverrides ?? {}),
  };

  return {
    type: 'durable-object',
    endpoint,
    objectName: objectName ?? fallbackObjectName,
    objectId,
    namespace: namespace ?? fallbackNamespace,
    method: 'POST',
    headers: {
      'x-arbiter-template': templateName,
      'x-arbiter-runtime': 'cloudflare',
      ...((headers as Record<string, string> | undefined) ?? {}),
    },
    timeoutMs: timeoutMs ?? 45000,
    forwardSecrets: forwardSecrets ?? [],
    container,
  };
}
