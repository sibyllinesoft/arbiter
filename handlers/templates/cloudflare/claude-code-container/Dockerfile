# Claude Code Cloudflare container template
#
# Build with:
#   docker build -t claude-code-container handlers/templates/cloudflare/claude-code-container
# Run locally:
#   docker run --rm -p 8787:8787 claude-code-container

FROM node:20-bullseye

# Install system dependencies used by both Claude Code and the Bifrost gateway
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates curl gosu \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user for automation
RUN useradd --system --create-home --home-dir /home/claude --shell /bin/bash claude

# Install Claude Code CLI (replace with pinned versions as needed) and Bifrost gateway
RUN npm install -g @anthropic-ai/claude-code @maximhq/bifrost

WORKDIR /srv/claude-code

# Copy application files
COPY package.json package-lock.json* ./
RUN npm install --production --ignore-scripts || true

COPY server.mjs ./
COPY playbooks ./playbooks
COPY bifrost.config.json ./
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh
RUN mkdir -p /srv/claude-code/workspaces /srv/claude-code/bifrost \
  && chown -R claude:claude /srv/claude-code /home/claude

ENV PORT=8787 \
    CLAUDE_CODE_WORKDIR=/srv/claude-code/workspaces \
    CLAUDE_CODE_MODEL=openrouter/x-ai/grok-4-fast \
    BIFROST_HOST=0.0.0.0 \
    BIFROST_PORT=8080 \
    BIFROST_APP_DIR=/srv/claude-code/bifrost \
    BIFROST_CONFIG_PATH=/srv/claude-code/bifrost.config.json \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318 \
    OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf \
    OTEL_SERVICE_NAME=claude-code-bifrost \
    OTEL_RESOURCE_NAMESPACE=arbiter

EXPOSE 8787 8080

ENTRYPOINT ["./entrypoint.sh"]
