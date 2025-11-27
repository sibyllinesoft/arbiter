import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { createDesignCommand } from "../design.js";
import { createPlanCommand } from "../plan.js";

describe("plan/design CLI prompts", () => {
  it("prints planning prompt and exits 0", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = new Command();
    createPlanCommand(program);
    await program.parseAsync(["plan"], { from: "user" });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("=== Feature Planning Assistant Prompt ==="),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("prints design prompt and exits 0", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = new Command();
    createDesignCommand(program);
    await program.parseAsync(["design"], { from: "user" });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("=== Technical Design Assistant Prompt ==="),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
