import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { Hono } from "hono";
import type { TunnelConfig, TunnelManager } from "../io/tunnel-manager";
import { tunnelRoutes } from "../routes/util/tunnel";

// Lightweight mock tunnel manager
const mockManager = {
  loadState: vi.fn(),
  preflight: vi.fn(),
  setup: vi.fn(),
  stop: vi.fn(),
  teardown: vi.fn(),
  getLogs: vi.fn(),
  removeAllListeners: vi.fn(),
  on: vi.fn(),
} as unknown as TunnelManager;

// Patch the route module's tunnelManager import
vi.mock("../io/tunnel-manager", () => {
  return {
    tunnelManager: mockManager,
  };
});

const app = new Hono();
app.route("/tunnel", tunnelRoutes);

const run = async (method: string, path: string, body?: any) => {
  const req = new Request(`http://localhost/tunnel${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
  return app.fetch(req);
};

describe("tunnelRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns saved state on /status", async () => {
    mockManager.loadState = vi.fn().mockResolvedValue({ tunnelName: "demo" });
    const res = await run("GET", "/status");
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.tunnel.tunnelName).toBe("demo");
  });

  it("runs preflight on /preflight", async () => {
    mockManager.preflight = vi.fn().mockResolvedValue({ success: true, zones: ["z1"] });
    const res = await run("GET", "/preflight");
    const json = await res.json();
    expect(mockManager.preflight).toHaveBeenCalled();
    expect(json.zones).toEqual(["z1"]);
  });

  it("calls setup on /setup", async () => {
    mockManager.setup = vi.fn().mockResolvedValue({ url: "https://t.example" });
    mockManager.on = vi.fn();
    mockManager.removeAllListeners = vi.fn();

    const res = await run("POST", "/setup", {
      zone: "example.com",
      subdomain: "api",
      localPort: 5050,
    } satisfies TunnelConfig);

    const json = await res.json();
    expect(mockManager.setup).toHaveBeenCalled();
    expect(json.tunnel.url).toBe("https://t.example");
  });

  it("calls stop on /stop", async () => {
    mockManager.stop = vi.fn().mockResolvedValue(undefined);
    const res = await run("POST", "/stop");
    const json = await res.json();
    expect(mockManager.stop).toHaveBeenCalled();
    expect(json.success).toBe(true);
  });

  it("calls teardown on /teardown", async () => {
    mockManager.teardown = vi.fn().mockResolvedValue(undefined);
    const res = await run("POST", "/teardown");
    const json = await res.json();
    expect(mockManager.teardown).toHaveBeenCalled();
    expect(json.message).toContain("removed");
  });

  it("returns logs on /logs", async () => {
    mockManager.getLogs = vi.fn().mockReturnValue(["a", "b"]);
    const res = await run("GET", "/logs");
    const json = await res.json();
    expect(json.logs).toEqual(["a", "b"]);
    expect(json.count).toBe(2);
  });
});
