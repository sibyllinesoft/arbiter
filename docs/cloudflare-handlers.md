# Cloudflare-Native Webhook Handlers

Arbiter now supports executing webhook handlers directly on Cloudflare using
Workers or Container Durable Objects. This document outlines how to configure
the new handler adapter, reuse the provided templates, and route incoming events
to your Cloudflare infrastructure.

## Runtime Options

Handlers can now declare one of three runtimes:

- **local** – existing sandboxed Node.js execution (unchanged)
- **cloudflare-worker** – forwards the webhook payload to a Cloudflare Worker
  endpoint
- **cloudflare-durable-object** – routes the payload into a Durable Object
  container

The runtime is detected automatically from the handler module. To use a
Cloudflare runtime, export a `cloudflare` configuration object instead of a
local `handler` function.

```js
module.exports = {
  cloudflare: {
    type: 'worker',
    endpoint: 'https://hooks.example.workers.dev/webhooks/github',
    method: 'POST',
    forwardSecrets: ['CLOUDFLARE_API_TOKEN'],
  },
  config: {
    enabled: true,
    timeout: 45000,
    retries: 1,
    environment: {},
    secrets: {
      CLOUDFLARE_API_TOKEN: '***',
    },
  },
  metadata: {
    name: 'GitHub Worker Proxy',
    description: 'Forwards GitHub webhooks into our Cloudflare Worker.',
    version: '1.0.0',
    supportedEvents: ['push'],
    requiredPermissions: ['cloudflare:worker'],
  },
};
```

## Durable Object Container Templates

Two ready-to-customize templates are available for Container Durable Objects:

- `handlers/templates/cloudflare/codex-durable-object.js`
- `handlers/templates/cloudflare/claude-durable-object.js`
- `handlers/templates/cloudflare/claude-code-durable-object.js`

Copy one of these files into `handlers/github/` or `handlers/gitlab/`, rename it
to the webhook event you want to capture, then edit the endpoint, namespace, and
secrets to match your deployment. By default the templates are disabled
(`config.enabled = false`) so that you can stage updates safely.

Each template declares:

- The Durable Object endpoint and namespace
- A list of handler secrets to forward (`forwardSecrets`)
- A container blueprint detailing the repo metadata, entry command, workdir, and
  environment required to bootstrap your Codex or Claude automation

The Claude Code template bootstraps the
[Claude Code](https://www.anthropic.com/claude/code) CLI, clones the triggering
repository (matching branch when present), and then runs a non-interactive
prompt. The handler adapter automatically prioritises the repository that fired
the webhook, so no additional configuration is needed to target the originating
project. The sample container reads the webhook payload and the
`environmentHints` map to export values such as `ARBITER_REPO_HTTP_URL`,
`ARBITER_REPO_BRANCH`, and `ARBITER_REPO_DEFAULT_BRANCH` before invoking Claude
Code.

The template now embeds a Bifrost gateway inside the Claude Code container, so
all Anthropic traffic is routed through a unified OpenAI-compatible API.
Telemetry defaults to OpenTelemetry (OTLP/HTTP) and is forwarded to the
on-cluster collector at `http://otel-collector:4318`. Override the gateway or
collector endpoints with environment overrides (`BIFROST_*`, `OTEL_*`) when
registering the handler.

Pair Claude Code with the new **otel-collector** template
(`handlers/templates/cloudflare/otel-collector-durable-object.js`) to persist
traces in a Cloudflare R2 catalogue. The collector container ships with the
`awss3` exporter configured for R2-compatible S3 endpoints, so you only need to
provide bucket details and access keys via handler secrets.

### Programmatic Builders

To generate these configurations in code (for example, when provisioning
projects), use the helpers in `apps/api/src/handlers/cloudflare/templates.ts`:

```ts
import {
  createCodexDurableObjectConfig,
  createClaudeDurableObjectConfig,
  createClaudeCodeDurableObjectConfig,
  createOtelCollectorDurableObjectConfig,
} from './handlers/cloudflare/templates.js';

const codexConfig = createCodexDurableObjectConfig({
  endpoint: 'https://hooks.example.workers.dev/codex',
  objectId: 'codex-project-123',
  containerOverrides: {
    repository: 'https://github.com/acme/codex-automation',
  },
});

const claudeCodeConfig = createClaudeCodeDurableObjectConfig({
  endpoint: 'https://hooks.example.workers.dev/claude-code',
  objectId: 'claude-code-project-123',
  containerOverrides: {
    environment: {},
  },
});

const otelCollectorConfig = createOtelCollectorDurableObjectConfig({
  endpoint: 'https://hooks.example.workers.dev/otel',
  objectId: 'otel-r2-catalogue',
  containerOverrides: {
    environment: {
      R2_BUCKET: 'my-observability-bucket',
    },
  },
});
```

The helpers merge your overrides with the default container template and return
a `CloudflareDurableObjectHandlerConfig` object ready to drop into a handler
module.

When you are using the otel-collector template, set the R2 bucket defaults in
`.arbiter/config.*` so the publish script can reuse or create the bucket
automatically:

```json
{
  "handlers": {
    "cloudflare": {
      "accountId": "<cloudflare-account-id>",
      "endpoint": "https://your-worker.workers.dev/otel/collect",
      "namespace": "arbiter-otel",
      "objectName": "arbiter-otel-collector",
      "r2": {
        "bucket": "arbiter-observability",
        "basePrefix": "otel/traces",
        "region": "auto",
        "endpoint": "https://<account-id>.r2.cloudflarestorage.com",
        "createIfMissing": true
      }
    }
  }
}
```

Run `bun run handlers:publish --template otel-collector --create-r2-bucket` to
have Arbiter call the Cloudflare R2 API and create the bucket for you. You can
override the bucket, prefix, region, or endpoint with flags such as
`--r2-bucket` and `--r2-prefix` during publishing.

Additional flags: `--r2-region`, `--r2-endpoint`, and `--cloudflare-api-token`
(or set `CLOUDFLARE_API_TOKEN` in your shell).

The Claude Code container now defaults to the OpenRouter `x-ai/grok-4-fast`
model via the embedded Bifrost gateway. The bundled Bifrost config lists the
model without the `openrouter/` prefix (`x-ai/grok-4-fast`) so
anthropic-compatible requests resolve correctly after the provider shim strips
the namespace. Populate the `OPENROUTER_API_KEY` secret (the template forwards
it automatically) and adjust `CLAUDE_CODE_MODEL` or the OpenRouter headers in
`bifrost.config.json` if you need to route to a different provider. For local
testing you can simply export `OPENROUTER_API_KEY` before running the container;
the gateway falls back to the host environment if Cloudflare secrets are not
present. The entrypoint copies that value into `CLAUDE_API_KEY` and
`ANTHROPIC_API_KEY` so the CLI never attempts to prompt for login. The container
also forces `CLAUDE_USE_API_KEYS=true` so the Claude CLI automatically uses the
forwarded key without prompting for /login. Set `GITHUB_TOKEN` (or
`GIT_ACCESS_TOKEN`) as well when the repository requires authentication—the
entrypoint uses it automatically and disables Git prompts so the container never
blocks.

### Publish and Register a Handler

Use the project script to build your container image, push it, and register the
handler with the Arbiter service configured in `.arbiter/config.*`:

```bash
# Example
bun run handlers:publish --dockerfile handlers/templates/cloudflare/claude-code-container/Dockerfile \
  --endpoint https://your-worker.workers.dev/hooks/claude-code \
  --namespace claude-code \
  --object-name claude-code-webhook-container
```

The script reads registry/API settings from `handlers` entries in
`.arbiter/config.*`, builds and publishes the container image, then creates the
handler via `POST /api/handlers` and scaffolds `wrangler.generated.toml`
alongside your container so you can deploy the Durable Object with Wrangler.
Override any value with CLI flags such as `--provider`, `--event`,
`--image-name`, or `--tag`.

Example `.arbiter/config.json` snippet:

```json
{
  "handlers": {
    "api": {
      "url": "https://arbiter.example.com",
      "token": "${ARBITER_API_TOKEN}"
    },
    "registry": {
      "imagePrefix": "registry.example.com/arbiter-handlers"
    },
    "cloudflare": {
      "endpoint": "https://your-worker.workers.dev/hooks/claude-code",
      "namespace": "claude-code",
      "objectName": "claude-code-webhook-container",
      "forwardSecrets": [
        "CLOUDFLARE_API_TOKEN",
        "CLAUDE_API_KEY",
        "GIT_ACCESS_TOKEN"
      ]
    },
    "defaults": {
      "provider": "github",
      "event": "push",
      "template": "claude-code"
    }
  }
}
```

## Secrets and Forwarding

Cloudflare handlers can opt-in to forwarding specific secrets. Define secrets
under `config.secrets` and list the keys in `cloudflare.forwardSecrets`. They
will be bundled with the webhook payload when Arbiter invokes your Worker or
Durable Object.

The adapter now also sends along a `repository` object and an `environmentHints`
map in the request body. These expose the repository URLs, branch names, and
latest commit SHA so your Durable Object can prime environment variables before
executing any setup commands.

## Execution Flow

1. Incoming webhook is matched against handlers.
2. For Cloudflare runtimes, Arbiter forwards the enriched payload via `fetch`.
3. Responses that match the `HandlerResult` shape are returned verbatim;
   otherwise the adapter wraps the HTTP response in a success payload.
4. Timeouts are enforced via the handler configuration (`config.timeout`) and an
   AbortController inside the adapter.

Refer to the Cloudflare templates for the quickest way to prototype Codex or
Claude automations without running local handler code.

The repo includes a buildable container template in
`handlers/templates/cloudflare/claude-code-container/`. Use it as the source for
Cloudflare Container Deployments or to iterate locally before pushing to
Cloudflare.

For local tests, install the `claude` CLI globally
(`npm install -g @anthropic-ai/claude-code`) or set `CLAUDE_CODE_BIN` to the
binary location.

Automation prompt: Send a `prompt` field in the webhook payload (or set
`container.prompt` in the durable-object template) to control what the Claude
CLI executes. The container defaults to a lightweight repository summary if no
prompt is provided.

If you see `HTTP error from anthropic: 401` in the Bifrost logs, double-check
that the OpenRouter key is valid and that the model
(`openrouter/x-ai/grok-4-fast` by default) is available on your plan.
