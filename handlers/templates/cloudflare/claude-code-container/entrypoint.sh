#!/usr/bin/env bash
set -euo pipefail

BIFROST_ENABLED="${BIFROST_ENABLED:-1}"
BIFROST_HOST="${BIFROST_HOST:-0.0.0.0}"
BIFROST_PORT="${BIFROST_PORT:-8080}"
BIFROST_APP_DIR="${BIFROST_APP_DIR:-/srv/claude-code/bifrost}"
BIFROST_CONFIG_PATH="${BIFROST_CONFIG_PATH:-/srv/claude-code/bifrost.config.json}"
BIFROST_BINARY="${BIFROST_BINARY:-bifrost}"

mkdir -p "${BIFROST_APP_DIR}"
mkdir -p /root/.config/bifrost
export XDG_CONFIG_HOME="${BIFROST_APP_DIR}"

# Ensure globally installed npm binaries (claude-code) are on PATH
export PATH="/usr/local/bin:$PATH"

if [[ -f "${BIFROST_CONFIG_PATH}" ]]; then
  cp -f "${BIFROST_CONFIG_PATH}" "${BIFROST_APP_DIR}/config.json"
  cp -f "${BIFROST_CONFIG_PATH}" "/root/.config/bifrost/config.json"
fi

# Load local secrets for OpenRouter when available
if [[ -z "${OPENROUTER_API_KEY:-}" ]] && [[ -f "/run/secrets/openrouter_api_key" ]]; then
  export OPENROUTER_API_KEY=$(< /run/secrets/openrouter_api_key)
fi

if [[ -z "${CLAUDE_API_KEY:-}" ]] && [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  export CLAUDE_API_KEY="${OPENROUTER_API_KEY}"
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]] && [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  export ANTHROPIC_API_KEY="${OPENROUTER_API_KEY}"
fi

# Ensure reasonable defaults for OTEL export so traces are emitted when collector is attached
export OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-claude-code-bifrost}"
BASE_OTEL_ATTRIBUTES="service.name=${OTEL_SERVICE_NAME},service.namespace=${OTEL_RESOURCE_NAMESPACE:-arbiter},service.instance.id=${HOSTNAME:-claude-code}"
if [[ -n "${OTEL_RESOURCE_ATTRIBUTES:-}" ]]; then
  export OTEL_RESOURCE_ATTRIBUTES="${BASE_OTEL_ATTRIBUTES},${OTEL_RESOURCE_ATTRIBUTES}"
else
  export OTEL_RESOURCE_ATTRIBUTES="${BASE_OTEL_ATTRIBUTES}"
fi
export OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://otel-collector:4318}"
export OTEL_EXPORTER_OTLP_PROTOCOL="${OTEL_EXPORTER_OTLP_PROTOCOL:-http/protobuf}"
export OTEL_TRACES_EXPORTER="${OTEL_TRACES_EXPORTER:-otlp}"

terminate_pid() {
  local pid="$1"
  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    kill "${pid}" 2>/dev/null || true
    for _ in {1..20}; do
      if ! kill -0 "${pid}" 2>/dev/null; then
        wait "${pid}" 2>/dev/null || true
        return
      fi
      sleep 0.5
    done
    echo "[entrypoint] process ${pid} did not shut down gracefully, forcing termination"
    kill -9 "${pid}" 2>/dev/null || true
    wait "${pid}" 2>/dev/null || true
  fi
}

cleanup() {
  terminate_pid "${NODE_PID:-}"
  terminate_pid "${BIFROST_PID:-}"
}

handle_signal() {
  cleanup
  exit 0
}

trap handle_signal SIGINT SIGTERM

if [[ "${BIFROST_ENABLED}" != "0" ]]; then
  echo "[entrypoint] Starting Bifrost gateway on ${BIFROST_HOST}:${BIFROST_PORT}"
  extra_args=()
  if [[ -n "${BIFROST_EXTRA_ARGS:-}" ]]; then
    # Allow the caller to supply additional CLI flags (e.g. '--profile debug').
    # shellcheck disable=SC2206
    extra_args=(${BIFROST_EXTRA_ARGS})
  fi

  "${BIFROST_BINARY}" http \
    --host "${BIFROST_HOST}" \
    --port "${BIFROST_PORT}" \
    --app-dir "${BIFROST_APP_DIR}" \
    --log-level "${BIFROST_LOG_LEVEL:-debug}" \
    --log-style "${BIFROST_LOG_STYLE:-pretty}" \
    ${extra_args[@]} &
  BIFROST_PID=$!
else
  echo "[entrypoint] Bifrost gateway disabled via BIFROST_ENABLED=0"
fi

# Give the gateway a moment to boot when running in ultra-lightweight environments
if [[ -n "${BIFROST_PID:-}" ]]; then
  for _ in {1..30}; do
    if curl -sf "http://${BIFROST_HOST}:${BIFROST_PORT}/healthz" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

node server.mjs "$@" &
NODE_PID=$!

wait $NODE_PID
status=$?
cleanup
exit $status
