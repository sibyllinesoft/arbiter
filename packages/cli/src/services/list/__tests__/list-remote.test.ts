import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listComponentsMock = vi.fn();

vi.mock("../../../api-client.js", () => {
  return {
    ApiClient: vi.fn().mockImplementation(() => ({ listComponents: listComponentsMock })),
  };
});

vi.mock("../../../utils/progress.js", () => ({
  withProgress: (_opts: any, fn: any) => fn(),
}));

const formatComponentTable = vi.fn(() => "TABLE_OUT");
const formatJson = vi.fn(() => "JSON_OUT");
const formatYaml = vi.fn(() => "YAML_OUT");

vi.mock("../../../utils/formatting.js", () => ({
  formatComponentTable,
  formatJson,
  formatYaml,
}));

import { listCommand } from "../index.js";

const baseConfig = {
  localMode: false,
  format: "table",
  apiUrl: "https://example.com",
  token: "test",
} as any;

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  listComponentsMock.mockReset();
  formatComponentTable.mockClear();
  formatJson.mockClear();
  formatYaml.mockClear();
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe("listCommand remote mode", () => {
  it("returns error when ApiClient fails", async () => {
    listComponentsMock.mockResolvedValue({ success: false, error: "boom" });

    const code = await listCommand("service", {}, baseConfig);
    if (code === 2) {
      // reveal unexpected errors during debugging
      throw new Error(`unexpected code 2: ${JSON.stringify(consoleErrorSpy.mock.calls)}`);
    }
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("prints warning when no components returned", async () => {
    listComponentsMock.mockResolvedValue({ success: true, data: [] });

    const code = await listCommand("service", {}, baseConfig);
    if (code === 2) {
      throw new Error(`unexpected code 2: ${JSON.stringify(consoleErrorSpy.mock.calls)}`);
    }
    expect(code).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("formats output according to requested format", async () => {
    listComponentsMock.mockResolvedValue({ success: true, data: [{ name: "svc" }] });

    await listCommand("service", { format: "json" }, baseConfig);
    expect(formatJson).toHaveBeenCalled();

    await listCommand("service", { format: "yaml" }, baseConfig);
    expect(formatYaml).toHaveBeenCalled();

    await listCommand("service", { format: "table" }, baseConfig);
    expect(formatComponentTable).toHaveBeenCalled();
  });
});
