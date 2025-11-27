import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tsFile = (content: string, dir: string) => {
  const file = path.join(dir, "sample.ts");
  return fs.writeFile(file, content, "utf-8").then(() => file);
};

describe("extractTypeScriptSurface", () => {
  it("returns null and warns when no source files are provided", async () => {
    const log = spyOn(console, "log").mockReturnValue();
    const { extractTypeScriptSurface } = await import("../typescript-extractor.js");

    const result = await extractTypeScriptSurface({ includePrivate: false } as any, []);

    expect(result).toBeNull();
    expect(log).toHaveBeenCalled();
  });

  it("extracts public symbols and filters private members", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ts-surface-"));
    const file = await tsFile(
      `
export function greet(name: string): string { return name }
export class Greeter { 
  public hello(msg: string) { return msg }
  private secret() { return 42 }
}
export const value = 3;
`,
      tmp,
    );

    const { extractTypeScriptSurface } = await import("../typescript-extractor.js");

    const surface = await extractTypeScriptSurface({ includePrivate: false } as any, [file]);

    expect(surface?.language).toBe("typescript");
    const names = surface?.symbols.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["greet", "Greeter", "hello", "value"]));
    expect(names).not.toContain("secret");
  });

  it("handles read errors gracefully and returns null", async () => {
    const log = spyOn(console, "error").mockReturnValue();
    const { extractTypeScriptSurface } = await import("../typescript-extractor.js");

    const result = await extractTypeScriptSurface({ includePrivate: true } as any, ["nope.ts"]);

    expect(result).toBeNull();
    expect(log).toHaveBeenCalled();
  });
});
