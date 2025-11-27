import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import path from "node:path";

import * as constraints from "../../constraints/index.js";
import { CUEManipulator } from "../index.js";

const fakeRunner: any = {
  exportJson: async () => ({ success: true, value: {}, diagnostics: [], error: undefined }),
  fmt: async () => ({ success: true, stdout: "", stderr: "", diagnostics: [], raw: {} }),
  vet: async () => ({ success: true, diagnostics: [], raw: {} }),
};

describe("CUEManipulator", () => {
  let manipulator: CUEManipulator;
  let safeSpy: any;
  let runnerSpy: any;

  beforeEach(() => {
    manipulator = new CUEManipulator();
    safeSpy = spyOn(constraints, "safeFileOperation").mockImplementation(
      async (_op, filePath, writer) => writer(filePath),
    );
    runnerSpy = spyOn(CUEManipulator.prototype as any, "createRunner").mockReturnValue(fakeRunner);
  });

  afterEach(() => {
    safeSpy.mockRestore();
    runnerSpy.mockRestore();
  });

  it("parses CUE content via cue-runner exportJson", async () => {
    fakeRunner.exportJson = async () => ({
      success: true,
      value: { services: { api: { language: "ts" } } },
      diagnostics: [],
    });

    const result = await manipulator.parse("package demo\nservices: {}");
    expect(result.services.api.language).toBe("ts");
    expect(safeSpy).toHaveBeenCalled();
  });

  it("serializes with package name preserved and formats content", async () => {
    fakeRunner.fmt = async () => ({ success: true, diagnostics: [], raw: {} });
    const output = await manipulator.serialize({ hello: "world" }, 'package demo\nhello: "old"');
    expect(output.startsWith("package demo")).toBe(true);
    expect(output).toContain('hello: "world"');
  });

  it("adds a service and delegates to serialize", async () => {
    const parseSpy = spyOn(manipulator, "parse").mockResolvedValue({});
    const serializeSpy = spyOn(manipulator, "serialize").mockResolvedValue("serialized");

    const result = await manipulator.addService("pkg {}", "api", {
      type: "internal",
      language: "ts",
    });

    expect(result).toBe("serialized");
    expect(parseSpy).toHaveBeenCalled();
    expect(serializeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ services: { api: expect.objectContaining({ language: "ts" }) } }),
      "pkg {}",
    );
  });

  it("adds an endpoint and builds default handler", async () => {
    const ast = { services: { api: {} }, paths: {} };
    spyOn(manipulator, "parse").mockResolvedValue(ast as any);
    const serializeSpy = spyOn(manipulator, "serialize").mockResolvedValue("endpoint-ok");

    const result = await manipulator.addEndpoint("pkg {}", {
      service: "api",
      path: "/foo/bar",
      method: "GET",
      summary: "sum",
      description: "desc",
    });

    expect(result).toBe("endpoint-ok");
    expect(ast.paths.api["/foo/bar"].get.summary).toBe("sum");
    expect(ast.services.api.endpoints).toBeDefined();
    expect(serializeSpy).toHaveBeenCalled();
  });

  it("removes a service and cleans up empty services block", async () => {
    const ast: any = { services: { api: { language: "ts" } } };
    spyOn(manipulator, "parse").mockResolvedValue(ast);
    const serializeSpy = spyOn(manipulator, "serialize").mockResolvedValue("removed");

    const result = await manipulator.removeService("content", "api");
    expect(result).toBe("removed");
    expect(ast.services).toBeUndefined();
    expect(serializeSpy).toHaveBeenCalled();
  });

  it("formats content using cue fmt and returns formatted text", async () => {
    fakeRunner.fmt = async () => ({ success: true, raw: {}, diagnostics: [] });
    const formatted = await manipulator.format("package demo\nfoo: 1");
    expect(formatted).toContain("package demo");
  });

  it("validates content and returns diagnostics on failure", async () => {
    fakeRunner.vet = async () => ({
      success: false,
      diagnostics: [{ message: "invalid" }],
      raw: { stderr: "err" },
    });

    const result = await manipulator.validate("bad");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid");
  });
});
