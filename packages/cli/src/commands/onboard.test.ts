import { afterEach, describe, expect, it } from "bun:test";
import os from "os";
import path from "path";
import fs from "fs-extra";

import { generateInitialSpec } from "./onboard";

describe("generateInitialSpec", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await fs.remove(dir);
      }
    }
  });

  it("writes framework metadata when available", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-onboard-test-"));
    tempDirs.push(projectPath);

    const analysis = {
      projectType: "single-service",
      languages: ["typescript"],
      frameworks: ["fastify"],
      services: [
        {
          name: "api",
          type: "api",
          language: "typescript",
          framework: "fastify",
          port: 3000,
          configFiles: [],
          dependencies: [],
          confidence: 0.95,
        },
      ],
      databases: [],
      infrastructure: [],
      buildSystem: [],
      testFrameworks: [],
      configFiles: [],
      environmentFiles: [],
      packageManagers: [],
    } as any;

    await generateInitialSpec(projectPath, analysis, false);

    const specPath = path.join(projectPath, "arbiter.assembly.cue");
    const contents = await fs.readFile(specPath, "utf8");
    expect(contents).toContain('framework: "fastify"');
  });
});
