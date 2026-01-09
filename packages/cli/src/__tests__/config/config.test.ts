import { afterEach, describe, expect, it } from "bun:test";
import { DEFAULT_CONFIG, applyEnvironmentOverrides } from "@/io/config/config.js";
import type { CLIConfig } from "@/types";

const cloneConfig = (): CLIConfig => ({
  ...DEFAULT_CONFIG,
  projectStructure: { ...DEFAULT_CONFIG.projectStructure },
  uiOptions: DEFAULT_CONFIG.uiOptions ? { ...DEFAULT_CONFIG.uiOptions } : undefined,
});

afterEach(() => {
  delete process.env.ARBITER_API_URL;
  delete process.env.ARBITER_VERBOSE;
});

describe("applyEnvironmentOverrides", () => {
  it("uses ARBITER_API_URL to override apiUrl", () => {
    process.env.ARBITER_API_URL = "https://example.dev";

    const result = applyEnvironmentOverrides(cloneConfig());

    expect(result.apiUrl).toBe("https://example.dev");
  });

  it("sets verbose when ARBITER_VERBOSE is truthy", () => {
    process.env.ARBITER_VERBOSE = "true";

    const result = applyEnvironmentOverrides({ ...cloneConfig(), verbose: false });

    expect(result.verbose).toBe(true);
  });
});
