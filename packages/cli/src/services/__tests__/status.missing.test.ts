import { describe, expect, it } from "bun:test";
import { statusCommand } from "../status/index.js";

describe("statusCommand missing local spec", () => {
  it("returns error when no assembly is present", async () => {
    const code = await statusCommand({ detailed: false }, {
      localMode: true,
      format: "table",
      projectDir: "/tmp/arbiter-no-assembly",
      apiUrl: "http://localhost",
      timeout: 1,
      color: false,
    } as any);
    expect(code).toBe(1);
  });
});
