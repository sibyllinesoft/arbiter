import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Config } from "../../config.js";
import { examplesCommand } from "../examples/index.js";

const baseConfig: Config = {
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

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), "arb-examples-"));

describe("examplesCommand", () => {
  it("rejects unknown example type", async () => {
    const errSpy = spyOn(console, "error").mockImplementation(() => {});
    const code = await examplesCommand("unknown", {}, baseConfig);
    errSpy.mockRestore();
    expect(code).toBe(1);
  });

  it("generates a profile example to the output directory", async () => {
    const dir = await tmp();
    const code = await examplesCommand(
      "profile",
      { output: dir, profile: "typescript-library" },
      baseConfig,
    );
    expect(code).toBe(0);
    const pkg = await fs.readFile(path.join(dir, "typescript-library", "package.json"), "utf8");
    expect(pkg).toContain("example-library");
  });
});
