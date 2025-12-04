#!/usr/bin/env bun
/**
 * Manual test script for NATS integration
 * Starts a simple spec event publisher and shows how agents receive events
 */
import { EventService } from "../src/events.ts";
import type { Event, ServerConfig } from "../src/types.ts";

// Mock server config with NATS enabled
const mockConfig: ServerConfig = {
  port: 4000,
  host: "localhost",
  database_path: ":memory:",
  spec_workdir: "/tmp",
  jq_binary_path: "jq",
  auth_required: false,
  rate_limit: {
    max_tokens: 100,
    refill_rate: 10,
    window_ms: 60000,
  },
  external_tool_timeout_ms: 30000,
  websocket: {
    max_connections: 100,
    ping_interval_ms: 30000,
  },
  nats: {
    url: process.env.NATS_URL || "nats://localhost:4222",
    enabled: true,
    reconnectTimeWait: 2000,
    maxReconnectAttempts: 10,
    topicPrefix: "spec",
  },
};

async function testNatsIntegration() {
  console.log("🧪 Testing NATS Integration");
  console.log(`📡 NATS URL: ${mockConfig.nats?.url}`);

  // Create event service (includes NATS)
  const eventService = new EventService(mockConfig);

  console.log("⏳ Waiting for NATS connection...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Show initial stats
  const initialStats = eventService.getStats();
  console.log("📊 Initial stats:", JSON.stringify(initialStats, null, 2));

  console.log("\n🚀 Publishing test events...");

  // Test different event types
  const testEvents: Array<{ name: string; event: Omit<Event, "id" | "created_at"> }> = [
    {
      name: "Fragment Update",
      event: {
        project_id: "test-project-1",
        event_type: "fragment_updated",
        data: {
          path: "capabilities.cue",
          content:
            'package spec\n\ncapabilities: {\n\tauth: {\n\t\tname: "Authentication"\n\t\tdescription: "User login and session management"\n\t}\n}',
        },
      },
    },
    {
      name: "Validation Started",
      event: {
        project_id: "test-project-1",
        event_type: "validation_started",
        data: {
          spec_hash: "abc123def456",
        },
      },
    },
    {
      name: "Validation Failed",
      event: {
        project_id: "test-project-1",
        event_type: "validation_failed",
        data: {
          spec_hash: "abc123def456",
          errors: [
            {
              type: "schema",
              message: "Missing required field 'description'",
              location: "capabilities.auth",
            },
          ],
        },
      },
    },
    {
      name: "Fragment Fixed",
      event: {
        project_id: "test-project-1",
        event_type: "fragment_updated",
        data: {
          path: "capabilities.cue",
          content:
            'package spec\n\ncapabilities: {\n\tauth: {\n\t\tname: "Authentication"\n\t\tdescription: "User login and session management"\n\t\towner: "backend-team"\n\t}\n}',
        },
      },
    },
    {
      name: "Validation Success",
      event: {
        project_id: "test-project-1",
        event_type: "validation_completed",
        data: {
          spec_hash: "def456ghi789",
          success: true,
        },
      },
    },
    {
      name: "Version Frozen",
      event: {
        project_id: "test-project-1",
        event_type: "version_frozen",
        data: {
          version_id: "v1.0.0",
          spec_hash: "def456ghi789",
          description: "Initial release version",
        },
      },
    },
  ];

  // Publish events with delays
  for (const { name, event } of testEvents) {
    console.log(`📤 Publishing: ${name}`);
    await eventService.broadcastToProject(event.project_id, event, event.data.spec_hash as string);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n✅ All events published!");

  // Final stats
  const finalStats = eventService.getStats();
  console.log("📊 Final stats:", JSON.stringify(finalStats, null, 2));

  console.log("\n🎯 To see events, run the example agent:");
  console.log("   bun examples/external-agent.ts");
  console.log("\nOr subscribe manually with NATS CLI:");
  console.log("   nats sub 'spec.test-project-1.*.updated'");

  // Keep running for a bit to allow agents to process
  console.log("\n⏳ Keeping publisher running for 10 seconds...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Cleanup
  console.log("🧹 Cleaning up...");
  await eventService.cleanup();

  console.log("✨ Test completed!");
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  process.exit(0);
});

if (import.meta.main) {
  testNatsIntegration().catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
}
