import { describe, expect, it, spyOn } from "bun:test";
import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as globModule from "glob";
import { extractGoSurface } from "../go-extractor.js";

describe("extractGoSurface", () => {
  it("returns null when no go.mod is present", async () => {
    const globSpy = spyOn(globModule, "glob").mockResolvedValue([] as any);
    const surface = await extractGoSurface({ language: "go" } as any);
    globSpy.mockRestore();
    expect(surface).toBeNull();
  });

  it("falls back to basic parsing when go tooling is unavailable", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-go-"));
    const previousCwd = process.cwd();
    process.chdir(tmp);

    try {
      await writeFile("go.mod", "module example.com/demo\n", "utf-8");
      await writeFile(
        "main.go",
        `
package main

// Hello greets
func Hello(name string) string { return "hi " + name }

type Widget struct{}
`,
        "utf-8",
      );

      let call = 0;
      const spawnSpy = spyOn(childProcess, "spawn").mockImplementation(
        (command: any, _args: any) => {
          call += 1;
          const child = new EventEmitter() as any;
          child.stdout = new EventEmitter();
          child.stderr = new EventEmitter();

          if (call === 1) {
            // go list fails
            setImmediate(() => child.emit("error", new Error("go missing")));
          } else if (call === 2) {
            // go doc (would be skipped because list failed)
            setImmediate(() => child.emit("close", 1));
          } else {
            // go version for basic parser
            setImmediate(() => {
              child.stdout.emit("data", "go version go1.21.0 linux/amd64");
              child.emit("close", 0);
            });
          }

          return child;
        },
      );

      const surface = await extractGoSurface({ language: "go" } as any);
      expect(surface).not.toBeNull();
      expect(surface?.symbols?.some((s) => s.name === "Hello")).toBe(true);
      expect(surface?.symbols?.some((s) => s.name === "Widget")).toBe(true);

      spawnSpy.mockRestore();
    } finally {
      process.chdir(previousCwd);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
