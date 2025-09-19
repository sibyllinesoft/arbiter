#!/usr/bin/env bash
# Ensure the script aborts on errors, unset variables, or failed pipelines
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

TOTAL_STEPS=6
STEP=1

print_header() {
  printf '\n========================================\n'
  printf '%s\n' "$1"
  printf '========================================\n'
}

run_step() {
  local title=$1
  shift
  local cmd=("$@")

  printf '\n[%d/%d] %s\n' "${STEP}" "${TOTAL_STEPS}" "${title}"
  printf '----------------------------------------\n'
  if "${cmd[@]}"; then
    printf '✅ %s\n' "${title}"
  else
    local status=$?
    printf '❌ %s (exit code %d)\n' "${title}" "${status}"
    exit "${status}"
  fi
  STEP=$((STEP + 1))
}

print_header "Arbiter Local CI"

run_step "Install dependencies" bun install --frozen-lockfile
run_step "Check formatting & linting" bun run check:ci
run_step "Type check (TS project references)" bun run typecheck
run_step "Run unit and integration tests" bun run test
run_step "Build workspaces" bun run build
run_step "Audit dependencies" bun audit

printf '\nAll checks passed ✅\n'
