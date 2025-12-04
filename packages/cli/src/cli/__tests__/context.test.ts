import { describe, expect, it } from "bun:test";
import { requireCommandConfig } from "@/cli/context";
import { Command } from "commander";

describe("cli context helpers", () => {
  it("walks up command tree to find config", () => {
    const root = new Command("root");
    (root as any).config = { apiUrl: "http://localhost:4000" };
    const sub = new Command("child");
    root.addCommand(sub);

    const cfg = requireCommandConfig(sub);
    expect(cfg.apiUrl).toBe("http://localhost:4000");
  });

  it("throws when no config attached", () => {
    const cmd = new Command();
    expect(() => requireCommandConfig(cmd)).toThrow("Configuration not loaded");
  });
});
