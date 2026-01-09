import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCheckCommand } from "@/services/check/index.js";

describe("runCheckCommand with no files", () => {
  it("returns success and prints empty json", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arb-check-"));
    const config: any = {
      projectDir: dir,
      apiUrl: "http://localhost",
      timeout: 1,
      format: "json",
      color: false,
      localMode: true,
    };

    const logs: string[] = [];
    const orig = console.log;
    console.log = (m?: any) => logs.push(String(m));
    const code = await runCheckCommand([], { format: "json" } as any, config);
    console.log = orig;
    expect(code).toBe(0);
    expect(logs.join("")).toContain("[]");
  });
});
