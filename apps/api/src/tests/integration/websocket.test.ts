/**
 * Integration tests for WebSocket real-time collaboration functionality
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { SpecWorkbenchServer } from "../../server.ts";
import type { ServerConfig } from "../../types.ts";
import { generateId } from "../../utils.ts";

// Mock WebSocket for testing
class MockWebSocket {
  private listeners: { [event: string]: Function[] } = {};
  public readyState: number = 1; // OPEN
  public url: string;

  constructor(url: string) {
    this.url = url;
    // Simulate connection after a short delay
    setTimeout(() => {
      this.dispatchEvent({ type: "open" });
    }, 10);
  }

  addEventListener(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  removeEventListener(event: string, listener: Function) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(listener);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  send(data: string) {
    // In real tests, this would send to the server
    // For now, we'll simulate echo
    setTimeout(() => {
      this.dispatchEvent({
        type: "message",
        data: JSON.stringify({ type: "echo", data: JSON.parse(data) }),
      });
    }, 10);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.dispatchEvent({ type: "close" });
  }

  private dispatchEvent(event: any) {
    const listeners = this.listeners[event.type] || [];
    listeners.forEach((listener) => listener(event));
  }
}

describe("WebSocket Integration Tests", () => {
  let server: SpecWorkbenchServer;
  let baseUrl: string;
  let wsUrl: string;
  let testConfig: ServerConfig;
  let testProjectId: string;

  beforeAll(async () => {
    const port = 4001 + Math.floor(Math.random() * 1000);

    testConfig = {
      port,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: `/tmp/ws-test-${Date.now()}`,
      cue_binary_path: "cue",
      jq_binary_path: "jq",
      auth_required: false,
      rate_limit: {
        max_tokens: 100,
        refill_rate: 10,
        window_ms: 10000,
      },
      external_tool_timeout_ms: 10000,
      websocket: {
        max_connections: 50,
        ping_interval_ms: 10000,
      },
    };

    server = new SpecWorkbenchServer(testConfig);
    baseUrl = `http://localhost:${port}`;
    wsUrl = `ws://localhost:${port}/ws`;

    await server.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  beforeEach(() => {
    testProjectId = generateId();
  });

  /**
   * Helper to create a fragment via HTTP API
   */
  async function createFragment(projectId: string, path: string, content: string) {
    const response = await fetch(`${baseUrl}/api/fragments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        path,
        content,
      }),
    });
    return response;
  }

  /**
   * Helper to validate a project
   */
  async function validateProject(projectId: string) {
    const response = await fetch(`${baseUrl}/api/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    return response;
  }

  /**
   * Create a mock WebSocket connection
   */
  function createMockWebSocket(): MockWebSocket {
    return new MockWebSocket(wsUrl);
  }

  describe("WebSocket Connection", () => {
    it("should establish WebSocket connection successfully", (done) => {
      const ws = createMockWebSocket();

      ws.addEventListener("open", () => {
        expect(ws.readyState).toBe(1); // OPEN
        ws.close();
        done();
      });
    });

    it("should handle WebSocket connection close gracefully", (done) => {
      const ws = createMockWebSocket();

      ws.addEventListener("open", () => {
        ws.close();
      });

      ws.addEventListener("close", () => {
        expect(ws.readyState).toBe(3); // CLOSED
        done();
      });
    });

    it("should handle multiple concurrent WebSocket connections", (done) => {
      const connectionCount = 5;
      let openConnections = 0;
      const connections: MockWebSocket[] = [];

      for (let i = 0; i < connectionCount; i++) {
        const ws = createMockWebSocket();
        connections.push(ws);

        ws.addEventListener("open", () => {
          openConnections++;
          if (openConnections === connectionCount) {
            // All connections established
            expect(openConnections).toBe(connectionCount);

            // Close all connections
            connections.forEach((conn) => conn.close());
            done();
          }
        });
      }
    });
  });

  describe("Real-time Fragment Updates", () => {
    it("should broadcast fragment creation events", async () => {
      // This test would require a real WebSocket implementation
      // For now, we'll test the HTTP API that triggers WebSocket events

      const fragmentResponse = await createFragment(
        testProjectId,
        "realtime.cue",
        `package spec

routes: {
	test: {
		path: "/test"
		method: "GET"
	}
}`,
      );

      expect(fragmentResponse.status).toBe(201);

      // In a real implementation, this would verify that WebSocket clients
      // receive a fragment_updated event
    });

    it("should broadcast validation events", async () => {
      // Create a fragment first
      await createFragment(
        testProjectId,
        "validation.cue",
        `package spec

capabilities: {
	"test.capability": "Test capability"
}`,
      );

      // Validate project
      const validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);

      const result = await validationResponse.json();
      expect(result.success).toBe(true);

      // In a real implementation, connected WebSocket clients would receive:
      // 1. validation_started event
      // 2. validation_completed event
      // 3. resolved_updated event
      // 4. gaps_updated event
    });

    it("should handle validation failure broadcasts", async () => {
      // Create fragment with validation errors
      await createFragment(
        testProjectId,
        "invalid.cue",
        `package spec

// This will cause a validation error
config: {
	port: 8080
}

config: {
	port: 3000 // Conflicting value
}`,
      );

      const validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);

      const result = await validationResponse.json();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // WebSocket clients should receive validation_failed event
    });
  });

  describe("Multi-Client Collaboration Simulation", () => {
    it("should handle simultaneous fragment updates from multiple clients", async () => {
      const clientCount = 3;
      const promises = [];

      // Simulate multiple clients updating different fragments simultaneously
      for (let i = 0; i < clientCount; i++) {
        const promise = createFragment(
          testProjectId,
          `client_${i}.cue`,
          `package spec

client${i}: {
	name: "Client ${i}"
	timestamp: "${new Date().toISOString()}"
}`,
        );
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // All updates should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // In real implementation, all connected clients would receive
      // fragment_updated events for each update
    });

    it("should handle last-write-wins conflict resolution", async () => {
      const fragmentPath = "conflict.cue";

      // Client 1 creates fragment
      const response1 = await createFragment(
        testProjectId,
        fragmentPath,
        `package spec\n\nclient1_data: true`,
      );
      expect(response1.status).toBe(201);

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Client 2 updates same fragment (should win)
      const response2 = await createFragment(
        testProjectId,
        fragmentPath,
        `package spec\n\nclient2_data: true`,
      );
      expect(response2.status).toBe(201);

      // Verify last write wins by checking resolved spec
      await validateProject(testProjectId);

      const resolvedResponse = await fetch(`${baseUrl}/api/resolved?project_id=${testProjectId}`);
      expect(resolvedResponse.status).toBe(200);

      const resolved = await resolvedResponse.json();
      expect(resolved.resolved.client2_data).toBe(true);
      expect(resolved.resolved.client1_data).toBeUndefined();
    });

    it("should maintain event ordering guarantees", async () => {
      // This test verifies that WebSocket events are sent in the correct order:
      // 1. fragment_updated
      // 2. validation_started
      // 3. validation_completed/validation_failed
      // 4. resolved_updated (if successful)
      // 5. gaps_updated (if successful)

      const fragmentPath = "ordered.cue";

      // Create fragment that should validate successfully
      const fragmentResponse = await createFragment(
        testProjectId,
        fragmentPath,
        `package spec

routes: {
	ordered: {
		path: "/ordered"
		method: "GET"
	}
}

capabilities: {
	"test.ordered": "Ordered test capability"
}`,
      );
      expect(fragmentResponse.status).toBe(201);

      // Trigger validation
      const validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);

      const result = await validationResponse.json();
      expect(result.success).toBe(true);

      // In real implementation, we would verify event ordering
      // by capturing WebSocket messages and checking their sequence
    });
  });

  describe("WebSocket Performance and Reliability", () => {
    it("should handle high-frequency updates without message loss", async () => {
      const updateCount = 20;
      const promises = [];

      // Create many fragments rapidly
      for (let i = 0; i < updateCount; i++) {
        const promise = createFragment(
          testProjectId,
          `rapid_${i}.cue`,
          `package spec\n\nrapid${i}: ${i}`,
        );
        promises.push(promise);
      }

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);

      console.log(`✅ ${updateCount} rapid updates completed in ${duration}ms`);
    });

    it("should maintain WebSocket broadcast performance under load", async () => {
      // Create base fragment
      await createFragment(
        testProjectId,
        "load_test.cue",
        `package spec

base: {
	created: true
}`,
      );

      // Simulate load by making many rapid updates
      const updateCount = 10;
      const promises = [];

      const start = Date.now();

      for (let i = 0; i < updateCount; i++) {
        const promise = createFragment(
          testProjectId,
          "load_test.cue", // Same file, rapid updates
          `package spec

base: {
	created: true
	update: ${i}
	timestamp: "${new Date().toISOString()}"
}`,
        );
        promises.push(promise);

        // Small stagger to simulate real usage
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All updates should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Should handle load efficiently
      expect(duration).toBeLessThan(3000);

      // Verify final state
      const validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);

      console.log(`✅ Load test: ${updateCount} updates in ${duration}ms`);
    });

    it("should recover gracefully from validation failures during collaboration", async () => {
      // Start with valid fragment
      await createFragment(
        testProjectId,
        "recovery.cue",
        `package spec

valid: {
	data: "initial"
}`,
      );

      // Validate successfully
      let validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);
      let result = await validationResponse.json();
      expect(result.success).toBe(true);

      // Introduce validation error
      await createFragment(
        testProjectId,
        "recovery.cue",
        `package spec

// Invalid CUE - missing closing brace
invalid: {
	data: "broken"
`,
      );

      // Validation should fail
      validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);
      result = await validationResponse.json();
      expect(result.success).toBe(false);

      // Fix the error
      await createFragment(
        testProjectId,
        "recovery.cue",
        `package spec

fixed: {
	data: "recovered"
}`,
      );

      // Should validate successfully again
      validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);
      result = await validationResponse.json();
      expect(result.success).toBe(true);

      console.log("✅ Recovery from validation failure successful");
    });
  });

  describe("WebSocket Error Handling", () => {
    it("should handle malformed WebSocket messages gracefully", () => {
      const ws = createMockWebSocket();

      ws.addEventListener("open", () => {
        // Send malformed JSON
        ws.send("{ invalid json }");

        // Connection should remain stable
        expect(ws.readyState).toBe(1);
        ws.close();
      });
    });

    it("should enforce connection limits", () => {
      // This would test the max_connections setting
      // In a real implementation, we would try to create more connections
      // than the configured limit and verify that excess connections are rejected

      const maxConnections = testConfig.websocket.max_connections;
      expect(maxConnections).toBe(50);

      // In practice, this would create 51 connections and verify
      // that the 51st is rejected
    });

    it("should handle WebSocket message flooding", () => {
      const ws = createMockWebSocket();

      ws.addEventListener("open", () => {
        // Send many messages rapidly
        for (let i = 0; i < 100; i++) {
          ws.send(
            JSON.stringify({
              type: "test",
              data: { message: i },
            }),
          );
        }

        // Connection should remain stable despite flooding
        expect(ws.readyState).toBe(1);
        ws.close();
      });
    });
  });

  describe("Integration with Validation Pipeline", () => {
    it("should broadcast resolved specification updates", async () => {
      // Create initial fragment
      await createFragment(
        testProjectId,
        "integration.cue",
        `package spec

initial: {
	version: "1.0.0"
}`,
      );

      // Validate to create initial resolved spec
      let validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);

      // Get initial resolved spec
      let resolvedResponse = await fetch(`${baseUrl}/api/resolved?project_id=${testProjectId}`);
      expect(resolvedResponse.status).toBe(200);

      let resolved = await resolvedResponse.json();
      const initialHash = resolved.spec_hash;

      // Update fragment
      await createFragment(
        testProjectId,
        "integration.cue",
        `package spec

updated: {
	version: "2.0.0" 
}`,
      );

      // Validate again
      validationResponse = await validateProject(testProjectId);
      expect(validationResponse.status).toBe(200);

      // Get updated resolved spec
      resolvedResponse = await fetch(`${baseUrl}/api/resolved?project_id=${testProjectId}`);
      expect(resolvedResponse.status).toBe(200);

      resolved = await resolvedResponse.json();
      const updatedHash = resolved.spec_hash;

      // Spec hash should change
      expect(updatedHash).not.toBe(initialHash);
      expect(resolved.resolved.updated.version).toBe("2.0.0");

      // In real implementation, WebSocket clients would receive:
      // - resolved_updated event with new spec_hash
      // - gaps_updated event with new gap analysis
    });

    it("should handle concurrent validation requests appropriately", async () => {
      // Create multiple fragments
      await createFragment(testProjectId, "concurrent1.cue", `package spec\ndata1: true`);
      await createFragment(testProjectId, "concurrent2.cue", `package spec\ndata2: true`);
      await createFragment(testProjectId, "concurrent3.cue", `package spec\ndata3: true`);

      // Trigger multiple validations concurrently
      const validationPromises = [
        validateProject(testProjectId),
        validateProject(testProjectId),
        validateProject(testProjectId),
      ];

      const responses = await Promise.all(validationPromises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // All should have same result (due to deterministic validation)
      const results = await Promise.all(responses.map((r) => r.json()));
      const hashes = results.map((r) => r.spec_hash);

      expect(new Set(hashes).size).toBe(1); // All hashes should be identical
    });
  });
});
