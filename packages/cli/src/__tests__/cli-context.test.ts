import { describe, expect, it } from "bun:test";
import { requireCommandConfig } from "@/cli/context";
import { Command } from "commander";

describe("cli/context", () => {
  it("throws when config is missing", () => {
    const cmd = new Command("test");
    expect(() => requireCommandConfig(cmd)).toThrow(/Configuration not loaded/);
  });

  it("returns config when attached to command", () => {
    const cmd = new Command("test");
    (cmd as any).config = { apiUrl: "http://localhost:5050" };
    const cfg = requireCommandConfig(cmd);
    expect(cfg.apiUrl).toBe("http://localhost:5050");
  });
});
