import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CustomHandlerManager } from "../../handlers/manager.ts";
import type { HandlerCreationOptions, RegisteredHandler } from "../../handlers/types.ts";
import type { EventService } from "../../events.ts";
import type { SpecWorkbenchDB } from "../../db.ts";
import type { ServerConfig } from "../../types.ts";

// Minimal event service stub for tests
const eventsStub = {
  broadcastToProject: async () => {},
} as unknown as EventService;

const dbStub = {} as SpecWorkbenchDB;

describe("CustomHandlerManager.createHandler", () => {
  let tempDir: string;
  let originalCwd: string;
  let manager: CustomHandlerManager;
  let baseConfig: ServerConfig;

  beforeAll(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-handlers-"));
    process.chdir(tempDir);

    baseConfig = {
      port: 0,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: join(tempDir, ".spec-workdir"),
      cue_binary_path: "cue",
      jq_binary_path: "jq",
      auth_required: false,
      rate_limit: {
        max_tokens: 10,
        refill_rate: 1,
        window_ms: 1000,
      },
      external_tool_timeout_ms: 5000,
      websocket: {
        max_connections: 10,
        ping_interval_ms: 30000,
      },
      handlers: {
        enableAutoReload: false,
        maxConcurrentExecutions: 2,
        defaultTimeout: 5000,
        defaultRetries: 1,
        sandboxEnabled: true,
        allowedModules: [],
        enableMetrics: false,
        notifications: {
          email: {
            mode: "log",
          },
        },
      },
    };

    manager = new CustomHandlerManager(baseConfig, eventsStub, dbStub);
  });

  afterAll(async () => {
    await manager.dispose();
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  const createHandler = (overrides: Partial<HandlerCreationOptions> = {}): Promise<RegisteredHandler> => {
    return manager.createHandler({
      provider: "github",
      event: "Push",
      code: "const message = 'hi';\nreturn { success: true, message, actions: [] };",
      metadata: {
        name: "GitHub push handler",
        description: "Generated in tests",
      },
      ...overrides,
    });
  };

  it("creates a handler file and registers it", async () => {
    const handler = await createHandler();

    expect(handler.provider).toBe("github");
    expect(handler.event).toBe("push");
    expect(handler.enabled).toBe(true);

    const fileContents = await readFile(handler.handlerPath, "utf-8");
    expect(fileContents).toContain("const message = 'hi';");
    expect(fileContents).toContain("metadata:");

    const registered = manager.getHandlers().find(h => h.id === handler.id);
    expect(registered).toBeDefined();
  });

  it("assigns unique filenames when events collide", async () => {
    const first = await createHandler({ event: "pull_request" });
    const second = await createHandler({ event: "pull_request" });

    expect(second.handlerPath).not.toBe(first.handlerPath);
    expect(second.handlerPath).toMatch(/pull_request-\d+\.ts$/);
  });
});
