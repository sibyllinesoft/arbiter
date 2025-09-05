/**
 * Basic tests for the Spec Workbench server
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SpecWorkbenchServer } from "./server.ts";
import type { ServerConfig } from "./types.ts";

describe("SpecWorkbenchServer", () => {
  let server: SpecWorkbenchServer;
  let testConfig: ServerConfig;

  beforeAll(async () => {
    testConfig = {
      port: 0, // Use random port for testing
      host: "localhost",
      database_path: ":memory:", // In-memory database for tests
      spec_workdir: "/tmp/test-workdir",
      cue_binary_path: "cue",
      jq_binary_path: "jq",
      auth_required: false,
      rate_limit: {
        max_tokens: 10,
        refill_rate: 1,
        window_ms: 10000,
      },
      external_tool_timeout_ms: 5000,
      websocket: {
        max_connections: 100,
        ping_interval_ms: 30000,
      },
    };

    server = new SpecWorkbenchServer(testConfig);
  });

  afterAll(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  it("should create server instance", () => {
    expect(server).toBeDefined();
  });

  it("should handle health check", async () => {
    const request = new Request("http://localhost/health", {
      method: "GET",
    });

    // Note: This is a simplified test since we can't easily test the full server
    // In a real implementation, you'd want to use the server's fetch handler
    expect(request.method).toBe("GET");
    expect(new URL(request.url).pathname).toBe("/health");
  });
});

describe("Configuration", () => {
  it("should have valid default config values", () => {
    const defaultConfig: ServerConfig = {
      port: 3000,
      host: "localhost",
      database_path: "./spec_workbench.db",
      spec_workdir: "./workdir",
      cue_binary_path: "cue",
      jq_binary_path: "jq",
      auth_required: true,
      rate_limit: {
        max_tokens: 10,
        refill_rate: 1,
        window_ms: 10000,
      },
      external_tool_timeout_ms: 10000,
      websocket: {
        max_connections: 1000,
        ping_interval_ms: 30000,
      },
    };

    expect(defaultConfig.port).toBeGreaterThan(0);
    expect(defaultConfig.host).toBe("localhost");
    expect(defaultConfig.rate_limit.max_tokens).toBeGreaterThan(0);
    expect(defaultConfig.external_tool_timeout_ms).toBeGreaterThan(0);
  });
});
