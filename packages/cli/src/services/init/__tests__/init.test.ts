import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

const minimalConfig = {
  apiUrl: "http://localhost:3000",
  format: "text",
  color: true,
  timeout: 30_000,
  token: "test-token",
} as any;

describe("initCommand", () => {
  afterEach(() => {
    mock.restore();
  });

  it("requires a preset to be specified", async () => {
    const { initCommand } = await import("@/services/init/index.js");
    const error = spyOn(console, "error").mockReturnValue();

    const code = await initCommand("demo", {} as any);

    expect(code).toBe(1);
    expect(error).toHaveBeenCalled();

    error.mockRestore();
  });

  it("prints available presets for unknown preset id", async () => {
    const log = spyOn(console, "log").mockReturnValue();
    const error = spyOn(console, "error").mockReturnValue();

    const { initCommand } = await import(`../index.js?unknown=${Date.now()}`);
    const code = await initCommand("demo", { preset: "nope" } as any, minimalConfig);

    expect(code).toBe(1);
    expect(error).toHaveBeenCalled();
    expect(log.mock.calls.some((c) => String(c[0]).includes("Available presets"))).toBe(true);

    log.mockRestore();
    error.mockRestore();
  });

  it("fails when config is missing for preset initialization", async () => {
    const { initCommand } = await import("@/services/init/index.js");
    const error = spyOn(console, "error").mockReturnValue();

    const code = await initCommand("demo", { preset: "web-app" } as any);

    expect(code).toBe(2);
    expect(error).toHaveBeenCalled();

    error.mockRestore();
  });

  it("creates project via preset using ApiClient", async () => {
    mock.module("@/io/api/api-client.js", () => ({
      ApiClient: class MockApiClient {
        async createProject() {
          return { success: true } as any;
        }
      },
    }));
    mock.module("@/utils/api/progress.js", () => ({
      withProgress: async (_opts: any, fn: any) => fn(),
    }));

    const { initCommand } = await import(`../index.js?preset=${Date.now()}`);

    const code = await initCommand(undefined, { preset: "web-app" } as any, minimalConfig);

    expect(code).toBe(0);
  });
});
