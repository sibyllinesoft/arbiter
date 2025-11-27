import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractBashSurface } from "../bash-extractor.js";

const makeTmp = () => fs.mkdtemp(path.join(os.tmpdir(), "arb-bash-"));

describe("extractBashSurface", () => {
  it("extracts functions from bash files", async () => {
    const dir = await makeTmp();
    const file = path.join(dir, "script.sh");
    await fs.writeFile(
      file,
      `
# sample bash
hello() {
  echo hi
}
_private() { echo hidden; }
cmd --flag value
`,
    );
    const cwd = process.cwd();
    process.chdir(dir);
    const surface = await extractBashSurface({ language: "bash" } as any);
    process.chdir(cwd);

    expect(surface).not.toBeNull();
    if (!surface) return;
    expect(surface.symbols.map((s) => s.name)).toContain("hello");
    expect(surface.statistics.totalSymbols).toBeGreaterThan(0);
  });
});
