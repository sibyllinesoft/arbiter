import { afterEach, describe, expect, it } from "bun:test";
import { DEFAULT_CONFIG, applyEnvironmentOverrides } from "@/config";
import type { CLIConfig } from "@/types";

const cloneConfig = (): CLIConfig => ({
  ...DEFAULT_CONFIG,
  projectStructure: { ...DEFAULT_CONFIG.projectStructure },
  uiOptions: DEFAULT_CONFIG.uiOptions ? { ...DEFAULT_CONFIG.uiOptions } : undefined,
});

afterEach(() => {
  delete process.env.ARBITER_URL;
  delete process.env.ARBITER_API_URL;
  delete process.env.ARBITER_VERBOSE;
  delete process.env.ARBITER_FETCH_DEBUG;
});

describe("applyEnvironmentOverrides", () => {
  it("prefers ARBITER_URL over existing apiUrl", () => {
    process.env.ARBITER_URL = "https://example.dev";

    const result = applyEnvironmentOverrides(cloneConfig());

    expect(result.apiUrl).toBe("https://example.dev");
  });

  it("falls back to ARBITER_API_URL when ARBITER_URL is not set", () => {
    process.env.ARBITER_API_URL = "https://backup.dev";

    const result = applyEnvironmentOverrides(cloneConfig());

    expect(result.apiUrl).toBe("https://backup.dev");
  });

  it("sets verbose when ARBITER_VERBOSE is truthy", () => {
    process.env.ARBITER_VERBOSE = "true";

    const result = applyEnvironmentOverrides({ ...cloneConfig(), verbose: false });

    expect(result.verbose).toBe(true);
  });

  it("sets verbose when ARBITER_FETCH_DEBUG is truthy", () => {
    process.env.ARBITER_FETCH_DEBUG = "1";

    const result = applyEnvironmentOverrides({ ...cloneConfig(), verbose: false });

    expect(result.verbose).toBe(true);
  });
});
