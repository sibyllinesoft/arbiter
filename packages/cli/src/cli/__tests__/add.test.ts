import { describe, expect, it, mock } from "bun:test";
import { createAddCommands } from "@/cli/add";
import { Command } from "commander";

// Helper to capture process.exit calls
const originalExit = process.exit;

describe("cli add commands", () => {
  it("fails fast when config is missing", async () => {
    // Patch process.exit to throw so we can catch it
    const exitMock = mock((code?: number) => {
      throw new Error(`exit:${code}`);
    });
    // @ts-expect-error override for test
    process.exit = exitMock as any;

    const program = new Command();
    createAddCommands(program);

    const run = async () => {
      // Simulate invocation: add service foo --dry-run
      await program.parseAsync(["node", "cli", "add", "service", "foo", "--dry-run"]);
    };

    await expect(run()).rejects.toThrow("exit:2");

    // restore
    process.exit = originalExit;
  });

  it("wires subcommands onto program", () => {
    const program = new Command();
    createAddCommands(program);
    const add = program.commands.find((c) => c.name() === "add");
    expect(add).toBeDefined();
    const subNames = add?.commands.map((c) => c.name());
    expect(subNames).toContain("service");
    expect(subNames).toContain("client");
    expect(subNames).toContain("endpoint");
  });
});
