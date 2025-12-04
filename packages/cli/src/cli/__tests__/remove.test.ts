import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { createRemoveCommands } from "@/cli/remove.js";
import * as remover from "@/services/remove/index.js";

const baseConfig = {
  apiUrl: "https://api",
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
} as any;

function buildProgram(): Command {
  const program = new Command("arbiter");
  (program as any).config = baseConfig;
  createRemoveCommands(program);
  return program;
}

const cases: Array<[string, string[], string]> = [
  ["service", ["service", "api"], "api"],
  ["endpoint", ["endpoint", "/users", "--method", "get"], "/users"],
  ["route", ["route", "/"], "/"],
  ["flow", ["flow", "checkout"], "checkout"],
  ["load-balancer", ["load-balancer"], ""],
  ["database", ["database", "db"], "db"],
  ["cache", ["cache", "redis"], "redis"],
  ["locator", ["locator", "geo"], "geo"],
  ["schema", ["schema", "user"], "user"],
  ["package", ["package", "util"], "util"],
  ["component", ["component", "hero"], "hero"],
  ["module", ["module", "feature"], "feature"],
];

describe("remove CLI", () => {
  for (const [kind, args, expectedName] of cases) {
    it(`dispatches remove ${kind}`, async () => {
      const removeSpy = spyOn(remover, "removeCommand").mockResolvedValue(0);
      const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

      const program = buildProgram();
      await program.parseAsync(["remove", ...args], { from: "user" });

      expect(removeSpy).toHaveBeenCalledWith(kind, expectedName, expect.anything(), baseConfig);

      removeSpy.mockRestore();
      exitSpy.mockRestore();
    });
  }
});
