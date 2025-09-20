import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ServerConfig } from './types.ts';

export function loadConfig(): ServerConfig {
  const configPath = process.env.ARBITER_CONFIG_PATH || path.join(process.cwd(), 'config.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ServerConfig;
  } catch {
    return {
      port: parseInt(process.env.PORT || '5050', 10),
      host: 'localhost',
      database_path: ':memory:',
      spec_workdir: path.join(process.cwd(), '.spec-workdir'),
      cue_binary_path: 'cue',
      jq_binary_path: 'jq',
      auth_required: false,
      rate_limit: { max_tokens: 10, refill_rate: 1, window_ms: 10000 },
      external_tool_timeout_ms: 5000,
      websocket: { max_connections: 100, ping_interval_ms: 30000 },
    };
  }
}
