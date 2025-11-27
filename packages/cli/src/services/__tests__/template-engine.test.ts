import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import * as templates from "../../templates/index.js";
import {
  executeTemplate,
  validateTemplateExists,
  validateTemplateExistsSync,
} from "../add/template-engine.js";

describe("template engine helpers", () => {
  it("accepts known template aliases", async () => {
    const loadSpy = spyOn(templates.templateOrchestrator, "loadConfig").mockResolvedValue();
    const aliasSpy = spyOn(templates.templateOrchestrator, "getAlias").mockReturnValue({
      implementor: "script",
    } as any);

    await expect(
      validateTemplateExists("service"),
      "resolves when alias exists",
    ).resolves.toBeUndefined();

    loadSpy.mockRestore();
    aliasSpy.mockRestore();
  });

  it("throws with available aliases when template is missing", async () => {
    const loadSpy = spyOn(templates.templateOrchestrator, "loadConfig").mockResolvedValue();
    const aliasSpy = spyOn(templates.templateOrchestrator, "getAlias").mockReturnValue(undefined);
    const aliasesSpy = spyOn(templates.templateOrchestrator, "getAliases").mockReturnValue({
      "bun-hono": {},
      "rust-axum": {},
    } as any);

    await expect(validateTemplateExists("unknown-template")).rejects.toThrow(
      "Template 'unknown-template' not found. Available templates: bun-hono, rust-axum",
    );

    loadSpy.mockRestore();
    aliasSpy.mockRestore();
    aliasesSpy.mockRestore();
  });

  it("builds context and executes template with sensible fallbacks", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-template-"));
    const buildSpy = spyOn(templates, "buildTemplateContext").mockResolvedValue({
      ctx: true,
    } as any);
    const ensureSpy = spyOn(fs, "ensureDir").mockResolvedValue();
    const execSpy = spyOn(templates.templateOrchestrator, "executeTemplate").mockResolvedValue();

    await executeTemplate("orders", "bun-hono", "package spec", tmp, {
      language: "typescript",
      port: 8080,
    });

    expect(buildSpy).toHaveBeenCalledWith(
      "package spec",
      expect.objectContaining({
        artifactName: "orders",
        artifactFallback: expect.objectContaining({
          name: "orders",
          kind: "service",
          language: "typescript",
          ports: [{ name: "http", port: 8080, targetPort: 8080 }],
        }),
      }),
    );

    expect(ensureSpy).toHaveBeenCalledWith(path.resolve(tmp));
    expect(execSpy).toHaveBeenCalledWith("bun-hono", path.resolve(tmp), { ctx: true });

    buildSpy.mockRestore();
    ensureSpy.mockRestore();
    execSpy.mockRestore();
    await rm(tmp, { recursive: true, force: true });
  });

  it("surface sync variant also throws when alias missing", () => {
    const aliasSpy = spyOn(templates.templateOrchestrator, "getAlias").mockReturnValue(undefined);
    const aliasesSpy = spyOn(templates.templateOrchestrator, "getAliases").mockReturnValue({
      "gh-app": {},
    } as any);

    expect(() => validateTemplateExistsSync("nope")).toThrow(
      "Template 'nope' not found. Available templates: gh-app",
    );

    aliasSpy.mockRestore();
    aliasesSpy.mockRestore();
  });
});
