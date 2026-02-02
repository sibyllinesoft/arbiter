import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { __listTesting, listCommand } from "@/services/list/index.js";

let origCwd: string;
let tmpDir: string | null = null;

beforeEach(() => {
  origCwd = process.cwd();
});

afterEach(async () => {
  mock.restore();
  process.chdir(origCwd);
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    tmpDir = null;
  }
});

const baseConfig: any = {
  localMode: true,
  projectDir: process.cwd(),
  format: "table",
};

describe("list command", () => {
  it("rejects invalid type", async () => {
    spyOn(console, "error").mockImplementation(() => {});
    const code = await listCommand("invalid", {}, baseConfig as any);
    expect(code).toBe(1);
  });

  it("returns when local spec missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "list-missing-"));
    spyOn(console, "log").mockImplementation(() => {});
    const code = await listCommand("service", {}, { ...baseConfig, projectDir: tmpDir } as any);
    // List command now returns 0 with empty results when spec is missing
    expect(code).toBe(0);
  });

  it("buildComponentsFromSpec builds various component summaries", () => {
    const spec = {
      services: { api: { language: "ts", endpoints: { getThing: {} } } },
      modules: {
        clientA: { metadata: { type: "frontend", framework: "react" }, language: "ts" },
        cap1: { type: "capability", description: "caps" },
      },
      paths: { api: { "/foo": { get: {}, post: {} } } },
      ui: { routes: [{ id: "home", path: "/", capabilities: [] }] },
      schemas: { thing: { references: { a: true } } },
      databases: { db: { engine: "postgres" } },
      tools: { gen: { commands: ["build"] } },
      infrastructure: { containers: [{ name: "svc", scope: "dev", image: "img" }] },
      contracts: { workflows: { contract1: { operations: { op1: {} } } } },
      domain: { processes: { flow1: { states: { start: {} } } } },
    };

    expect(__listTesting.buildComponentsFromSpec(spec, "service")[0].endpoints).toContain(
      "getThing",
    );
    expect(__listTesting.buildComponentsFromSpec(spec, "client")[0].framework).toBe("react");
    expect(__listTesting.buildComponentsFromSpec(spec, "endpoint")[0].methods).toEqual(
      expect.arrayContaining(["get", "post"]),
    );
    expect(__listTesting.buildComponentsFromSpec(spec, "capability")[0].description).toBe("caps");
  });
});
