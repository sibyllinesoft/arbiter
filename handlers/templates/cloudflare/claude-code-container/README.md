# Claude Code Cloudflare Container Template

This directory contains a reference container used by the Claude Code Durable
Object template. It exposes a lightweight HTTP server that:

1. Parses Arbiter webhook payloads forwarded by the Cloudflare handler adapter.
2. Writes the payload to `/tmp/arbiter-webhook.json` and exports repository
   metadata to environment variables.
3. Clones or updates the repository that triggered the webhook (including branch
   checkout) inside `/srv/claude-code/workspaces`.
4. Invokes the `claude` CLI non-interactively with a configurable prompt.

## Building

```bash
docker build -t claude-code-container handlers/templates/cloudflare/claude-code-container
```

## Running Locally

```bash
docker run --rm -p 8787:8787 \
  -e OPENROUTER_API_KEY=your-openrouter-key \
  -e GITHUB_TOKEN=your-github-token \
  claude-code-container  # CLAUDE_API_KEY defaults to OPENROUTER_API_KEY if unset
```

(Provide `GITHUB_TOKEN` when the repository is private; the container falls back
to anonymous clones if it is omitted.)

Then POST an Arbiter webhook payload to `http://localhost:8787/` to simulate the
Cloudflare Durable Object invocation. The server logs the git checkout and
Claude Code execution progress to stdout.

Adjust the Dockerfile or `server.mjs` to pin specific versions of Node, Claude
Code, or tweak the automation prompt to match your production setup.

## OpenRouter Configuration

The container ships with Bifrost configured to proxy requests through
OpenRouter's `grok-4-fast` model. Provide an `OPENROUTER_API_KEY` secret when
deploying the durable object (the template forwards this secret automatically)
and adjust
`handlers/templates/cloudflare/claude-code-container/bifrost.config.json` if you
need to change headers or models. By default Bifrost advertises its
Anthropic-compatible gateway at `http://<container>:8080/anthropic`, and the
wrapper sets `ANTHROPIC_API_URL` to point Claude Code to that path. Override
`CLAUDE_CODE_MODEL` to target a different OpenRouter model if required.

The container invokes the `claude` CLI; set `CLAUDE_CODE_BIN` if you installed
it in a non-standard location.

## Prompt customization

By default the container asks Claude to summarise the checked-out repository.
Override this by sending a `prompt` field in the webhook payload or by setting
`container.prompt` in the handler template. Additional CLI arguments can be
passed via the `claudeArgs` array in the payload if you need to toggle advanced
flags such as `--append-system-prompt`.

The container sets `CLAUDE_USE_API_KEYS=true` by default so the Claude CLI uses
the supplied API/UI key without interactive login.

The entrypoint also mirrors `OPENROUTER_API_KEY` into both `CLAUDE_API_KEY` and
`ANTHROPIC_API_KEY` so the Claude CLI follows the Bifrost proxy without
interactive authentication.
