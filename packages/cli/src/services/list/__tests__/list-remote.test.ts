import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { listCommand } from "@/services/list/index.js";

describe("listCommand remote mode", () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  const baseConfig = {
    localMode: false,
    format: "table",
    apiUrl: "https://example.com",
    token: "test",
  } as any;

  beforeEach(() => {
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  });

  it("returns error when ApiClient fails", async () => {
    const mockClient = {
      listComponents: mock(() => ({ success: false, error: "boom" })),
    } as any;

    const code = await listCommand("service", {}, baseConfig, mockClient);
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("prints warning when no components returned", async () => {
    const mockClient = {
      listComponents: mock(() => ({ success: true, data: [] })),
    } as any;

    const code = await listCommand("service", {}, baseConfig, mockClient);
    expect(code).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("formats output according to requested format", async () => {
    const mockClient = {
      listComponents: mock(() => ({ success: true, data: [{ name: "svc" }] })),
    } as any;

    // Test JSON format
    await listCommand("service", { format: "json" }, baseConfig, mockClient);
    const jsonOutput = consoleLogSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes('"name"'),
    );
    expect(jsonOutput).toBe(true);

    consoleLogSpy.mockClear();

    // Test YAML format
    await listCommand("service", { format: "yaml" }, baseConfig, mockClient);
    const yamlOutput = consoleLogSpy.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes("name:"),
    );
    expect(yamlOutput).toBe(true);

    consoleLogSpy.mockClear();

    // Test table format (default)
    await listCommand("service", { format: "table" }, baseConfig, mockClient);
    expect(consoleLogSpy).toHaveBeenCalled();
  });
});
