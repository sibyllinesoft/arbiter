import { describe, expect, it, spyOn } from "bun:test";
import * as childProcess from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractRustSurface } from "@/surface-extraction/extractors/rust-extractor.js";
import * as globModule from "glob";

describe("extractRustSurface", () => {
  it("returns null when no Cargo files are present", async () => {
    const globSpy = spyOn(globModule, "glob").mockResolvedValue([] as any);
    const surface = await extractRustSurface({ language: "rust" } as any);
    globSpy.mockRestore();
    expect(surface).toBeNull();
  });

  it("extracts public symbols via syn parsing when toolchains fail", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-rust-"));
    const previousCwd = process.cwd();
    process.chdir(tmp);

    try {
      await writeFile("Cargo.toml", '[package]\nname = "demo"\nversion = "0.1.0"\n', "utf-8");
      await fs.mkdir("src", { recursive: true });
      await writeFile(
        path.join("src", "main.rs"),
        'pub fn greet(name: &str) -> String { format!("hi {name}") }\n',
        "utf-8",
      );

      let call = 0;
      const spawnSpy = spyOn(childProcess, "spawn").mockImplementation(
        (command: any, _args: any) => {
          call += 1;
          const child = new (require("node:events").EventEmitter)() as any;
          child.stdout = new (require("node:events").EventEmitter)();
          child.stderr = new (require("node:events").EventEmitter)();

          if (command === "cargo") {
            setImmediate(() => {
              child.stdout.emit(
                "data",
                JSON.stringify({
                  items: [
                    {
                      name: "greet",
                      kind: "function",
                      signature: "pub fn greet()",
                      file_path: "src/main.rs",
                      line: 1,
                      column: 1,
                    },
                  ],
                }),
              );
              child.emit("close", 0);
            });
          } else if (command === "rustc") {
            setImmediate(() => {
              child.stdout.emit("data", "rustc 1.72.0");
              child.emit("close", 0);
            });
          }

          return child;
        },
      );

      const surface = await extractRustSurface({ language: "rust" } as any);
      expect(surface).not.toBeNull();
      expect(surface?.symbols?.some((s) => s.name === "greet")).toBe(true);

      spawnSpy.mockRestore();
    } finally {
      process.chdir(previousCwd);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
