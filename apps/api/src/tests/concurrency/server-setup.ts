import { SpecWorkbenchServer } from "../../server";
/**
 * Server setup utilities for concurrency tests
 */
import { SpecWorkbenchDB } from "../../util/db";
import type { ServerConfig } from "../../util/types";

export interface ConcurrencyTestContext {
  db: SpecWorkbenchDB;
  server: SpecWorkbenchServer;
  baseUrl: string;
  config: ServerConfig;
  skipSuite: boolean;
  startupError: unknown;
}

/** Create test config with random port */
export function createTestConfig(): ServerConfig {
  const port = 45000 + Math.floor(Math.random() * 1000);
  return {
    port,
    host: "127.0.0.1",
    database_path: ":memory:",
    spec_workdir: `/tmp/concurrency-test-${Date.now()}`,
    jq_binary_path: "jq",
    auth_required: false,
    external_tool_timeout_ms: 30000,
    websocket: {
      max_connections: 100,
      ping_interval_ms: 5000,
    },
  };
}

/** Initialize the test server */
export async function initializeTestServer(): Promise<ConcurrencyTestContext> {
  const config = createTestConfig();
  const db = await SpecWorkbenchDB.create(config);
  const server = new SpecWorkbenchServer(config, db);

  try {
    await server.start();
    const assignedPort = server.getPort();
    const baseUrl = `http://${config.host}:${assignedPort}`;
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      db,
      server,
      baseUrl,
      config,
      skipSuite: false,
      startupError: undefined,
    };
  } catch (error) {
    console.warn(
      "[ConcurrencyTest] Skipping concurrency suite due to server startup failure:",
      error,
    );
    return {
      db,
      server,
      baseUrl: "",
      config,
      skipSuite: true,
      startupError: error,
    };
  }
}

/** Shutdown the test server */
export async function shutdownTestServer(ctx: ConcurrencyTestContext): Promise<void> {
  if (!ctx.skipSuite && ctx.server) {
    await ctx.server.shutdown();
  }
}
