import { describe, expect, it } from "bun:test";

// Ensure argv parsing doesn't run during import
describe("cli/index smoke", () => {
  it("exposes program name and global options", async () => {
    const mod = await import("@/cli/index");
    const program = mod.default;
    expect(program.name()).toBe("arbiter");
    expect(program.options.some((o: any) => o.long === "--api-url")).toBe(true);
  });
});
