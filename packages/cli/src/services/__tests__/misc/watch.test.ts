/** @packageDocumentation Service tests */
import { describe, expect, it, spyOn } from "bun:test";
import { watchCommand } from "@/services/watch/index.js";
import type { CLIConfig, WatchOptions } from "@/types.js";

const baseConfig: CLIConfig = {
  apiUrl: "http://localhost",
  timeout: 1,
  format: "json",
  color: false,
  localMode: true,
  projectDir: process.cwd(),
  projectStructure: {
    clientsDirectory: "clients",
    servicesDirectory: "services",
    packagesDirectory: "packages",
    toolsDirectory: "tools",
    docsDirectory: "docs",
    testsDirectory: "tests",
    infraDirectory: "infra",
  },
};

describe("watchCommand placeholder", () => {
  it("logs a warning and exits successfully", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const code = await watchCommand({} as WatchOptions, baseConfig);
    expect(code).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
