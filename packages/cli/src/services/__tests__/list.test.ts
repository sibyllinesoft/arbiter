import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { ApiClient } from "@/api-client.js";
import * as cueIntegration from "@/constraints/cli-integration.js";
import { listCommand } from "@/services/list/index.js";
import * as formatting from "@/utils/formatting.js";
import * as progress from "@/utils/progress.js";
import fs from "fs-extra";

const baseConfig: any = {
  apiUrl: "https://api",
  timeout: 1,
  format: "table",
  color: false,
  localMode: false,
  projectDir: process.cwd(),
  projectStructure: {},
};

afterEach(() => {
  mock.restore();
});

describe("listCommand remote mode", () => {
  it("rejects invalid type", async () => {
    const err = spyOn(console, "error").mockImplementation(() => {});
    const code = await listCommand("invalid", {}, baseConfig);
    expect(code).toBe(1);
    err.mockRestore();
  });

  it("formats remote components with json/yaml/table and verbose", async () => {
    const clientSpy = spyOn(ApiClient.prototype, "listComponents").mockResolvedValue({
      success: true,
      data: [{ id: "svc1" }],
    } as any);
    spyOn(progress, "withProgress").mockImplementation(async (_opts, fn) => fn());
    const log = spyOn(console, "log").mockImplementation(() => {});
    const fmtJson = spyOn(formatting, "formatJson").mockReturnValue("JSON");
    const fmtYaml = spyOn(formatting, "formatYaml").mockReturnValue("YAML");
    const fmtTable = spyOn(formatting, "formatComponentTable").mockReturnValue("TABLE");

    expect(await listCommand("service", { format: "json", verbose: true }, baseConfig)).toBe(0);
    expect(await listCommand("service", { format: "yaml" }, baseConfig)).toBe(0);
    expect(await listCommand("service", { format: "table" }, baseConfig)).toBe(0);

    expect(clientSpy).toHaveBeenCalledWith("service");
    expect(fmtJson).toHaveBeenCalled();
    expect(fmtYaml).toHaveBeenCalled();
    expect(fmtTable).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("returns 1 on remote failure", async () => {
    spyOn(ApiClient.prototype, "listComponents").mockResolvedValue({
      success: false,
      error: "boom",
    } as any);
    spyOn(progress, "withProgress").mockImplementation(async (_opts, fn) => fn());
    const err = spyOn(console, "error").mockImplementation(() => {});
    const code = await listCommand("service", {}, baseConfig);
    expect(code).toBe(1);
    err.mockRestore();
  });
});

describe("listCommand local mode", () => {
  const localCfg = { ...baseConfig, localMode: true, projectDir: "/tmp/project" };

  it("returns 1 when assembly missing", async () => {
    spyOn(fs, "pathExists").mockResolvedValue(false);
    const err = spyOn(console, "error").mockImplementation(() => {});
    const code = await listCommand("service", {}, localCfg as any);
    expect(code).toBe(1);
    err.mockRestore();
  });

  it("returns 2 when parse fails", async () => {
    spyOn(fs, "pathExists").mockResolvedValue(true);
    spyOn(fs, "readFile").mockResolvedValue("bad cue");
    const manip = {
      parse: mock(async () => {
        throw new Error("parse error");
      }),
      cleanup: mock(async () => {}),
    };
    spyOn(cueIntegration, "getCueManipulator").mockReturnValue(manip as any);
    const err = spyOn(console, "error").mockImplementation(() => {});

    const code = await listCommand("service", {}, localCfg as any);
    expect(code).toBe(1);
    expect(manip.cleanup).toHaveBeenCalled();
    err.mockRestore();
  });

  it("prints table for local components", async () => {
    spyOn(fs, "pathExists").mockResolvedValue(true);
    spyOn(fs, "readFile").mockResolvedValue("cue content");
    const manip = {
      parse: mock(async () => ({
        services: { api: { language: "ts", endpoints: { "/": {} } } },
        ui: { routes: [{ id: "home", path: "/" }] },
      })),
      cleanup: mock(async () => {}),
    };
    spyOn(cueIntegration, "getCueManipulator").mockReturnValue(manip as any);
    const fmt = spyOn(formatting, "formatComponentTable").mockReturnValue("TABLE");
    const log = spyOn(console, "log").mockImplementation(() => {});

    const code = await listCommand("service", {}, localCfg as any);
    expect(code).toBe(0);
    expect(fmt).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    expect(manip.cleanup).toHaveBeenCalled();
    log.mockRestore();
  });
});
