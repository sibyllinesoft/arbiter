import { describe, expect, it } from "bun:test";

// Ensure the CLI entrypoint loads without throwing when imported
describe("cli/index entrypoint", () => {
  it("loads program definition without executing parse", async () => {
    const module = await import("@/cli/index");
    expect(module.default).toBeTruthy();
  });
});
