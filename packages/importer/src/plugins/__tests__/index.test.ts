import { describe, expect, it } from "bun:test";
import { getAllPlugins } from "../index";

describe("importer plugins index", () => {
  it("returns registered plugins", () => {
    const plugins = getAllPlugins();
    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins.some((p) => p.name() === "nodejs")).toBe(true);
  });
});
