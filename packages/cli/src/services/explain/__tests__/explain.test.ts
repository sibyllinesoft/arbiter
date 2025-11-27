import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { explainCommand } from "../index.js";

const writeAssembly = async (dir: string, content: string) => {
  const arbiterDir = path.join(dir, ".arbiter");
  await fs.mkdir(arbiterDir, { recursive: true });
  await fs.writeFile(path.join(arbiterDir, "assembly.cue"), content, "utf-8");
};

describe("explainCommand", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-explain-"));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    mock.restore();
  });

  it("returns helpful JSON error when assembly is missing", async () => {
    const log = spyOn(console, "log").mockReturnValue();

    const code = await explainCommand({ format: "json" }, {} as any);

    expect(code).toBe(1);
    const payload = JSON.parse(log.mock.calls[0][0] as string);
    expect(payload.error).toContain("No assembly specification found");
    expect(payload.suggestion).toBe("arbiter init");
  });

  it("emits structured JSON and writes to disk when assembly exists", async () => {
    const assembly = `// Demo application
Artifact: #Artifact & {
  kind: "cli"
  language: "typescript"
  name: "demo-app"
  version: "0.2.0"
}

Profile: #cli
build: {
  tool: "bun"
  targets: ["node", "browser"]
}

tests: { golden: {}, property: {} }
contracts: { invariants: [{ name: "safety", formula: "x>0" }] }
`;

    await writeAssembly(tmpDir, assembly);

    const outputPath = path.join(tmpDir, "explanation.json");
    const code = await explainCommand({ format: "json", output: outputPath }, {} as any);

    expect(code).toBe(0);
    const result = JSON.parse(await fs.readFile(outputPath, "utf-8"));
    expect(result.artifact.type).toBe("cli");
    expect(result.artifact.language).toBe("typescript");
    expect(result.build.targets).toEqual(["node", "browser"]);
    expect(result.tests.types).toEqual(expect.arrayContaining(["golden", "property"]));
    expect(result.contracts.invariants).toContain("safety");
    expect(result.summary).toContain("cli");
  });

  it("prints text explanation and generates markdown when output requested", async () => {
    const assembly = `// Reporting service
Artifact: #Artifact & { kind: "service", language: "python", name: "reporting" }
Profile: #service
build: { tool: "docker", targets: ["container"] }
tests: { property: {} }
contracts: { invariants: [{ name: "balanced", formula: "a==b" }] }
`;

    await writeAssembly(tmpDir, assembly);
    const log = spyOn(console, "log").mockReturnValue();

    const markdownPath = path.join(tmpDir, "explanation.md");
    const code = await explainCommand({ output: markdownPath, hints: false }, {} as any);

    expect(code).toBe(0);
    expect(log).toHaveBeenCalled(); // text mode logs progress and summary

    const markdown = await fs.readFile(markdownPath, "utf-8");
    expect(markdown).toContain("# Project Configuration Explanation");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain("## Artifact Details");
    expect(markdown).toContain("reporting");
  });
});
