import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CUEManipulator } from "@/cue/index.js";
import { TemplateOrchestrator, buildTemplateContext } from "@/templates/index.js";

function withCwd<T>(cwd: string, run: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  process.chdir(cwd);
  return run().finally(() => process.chdir(prev));
}

describe("template orchestrator", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-templates-"));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("creates default config when missing and normalizes legacy fields", async () => {
    await withCwd(tmp, async () => {
      const orchestrator = new TemplateOrchestrator();
      const configPath = path.join(tmp, "templates.json");
      await orchestrator.loadConfig(configPath);
      const saved = JSON.parse(await readFile(configPath, "utf-8"));
      expect(saved.implementors.cookiecutter.command).toBe("cookiecutter");
      expect(orchestrator.getAliases()["react-vite"]).toBeDefined();
    });

    // Legacy config normalization
    await withCwd(tmp, async () => {
      const cfgDir = path.join(tmp, ".arbiter");
      await mkdir(cfgDir, { recursive: true });
      const legacyConfig = {
        engines: { legacy: { command: "sh", defaultArgs: [] } },
        aliases: {
          legacy: { engine: "legacy", source: "@/templates/__tests__/tpl", description: "Legacy" },
        },
        settings: { defaultEngine: "legacy" },
      };
      const cfgPath = path.join(cfgDir, "templates.json");
      await writeFile(cfgPath, JSON.stringify(legacyConfig));

      const orchestrator = new TemplateOrchestrator();
      await orchestrator.loadConfig(cfgPath);

      const alias = orchestrator.getAlias("legacy");
      expect(alias?.implementor).toBe("legacy");
      expect((orchestrator as any).config.settings.defaultImplementor).toBe("legacy");
    });
  });

  it("resolves assets preferring override directories", async () => {
    const overrideDir = path.join(tmp, "override");
    const defaultDir = path.join(tmp, "default");
    await mkdir(overrideDir, { recursive: true });
    await mkdir(defaultDir, { recursive: true });
    await writeFile(path.join(defaultDir, "template.txt"), "default");
    await writeFile(path.join(overrideDir, "template.txt"), "override");

    const orchestrator = new TemplateOrchestrator();
    const result = await orchestrator.resolveTemplateAsset("template.txt", {
      overrideDirectories: [overrideDir],
      defaultDirectories: [defaultDir],
    });

    expect(result?.content).toBe("override");
    expect(result?.resolvedPath.startsWith(overrideDir)).toBe(true);
  });

  it("executes templates via registered implementor and merges impl variables", async () => {
    const orchestrator = new TemplateOrchestrator();
    const calls: any[] = [];
    orchestrator.addImplementor({
      name: "custom",
      command: "noop",
      defaultArgs: [],
      async execute(_src, dest, ctx) {
        calls.push({ dest, ctx });
      },
    });

    await withCwd(tmp, async () => {
      const cfgDir = path.join(tmp, ".arbiter");
      await mkdir(cfgDir, { recursive: true });
      const cfgPath = path.join(cfgDir, "templates.json");
      await writeFile(
        cfgPath,
        JSON.stringify({
          implementors: { custom: { command: "noop", defaultArgs: [] } },
          aliases: {
            demo: {
              implementor: "custom",
              source: "@/templates/__tests__/tpl",
              description: "demo",
              variables: { foo: "bar" },
            },
          },
        }),
      );

      await orchestrator.loadConfig(cfgPath);
      await orchestrator.executeTemplate("demo", "/tmp/out", {
        project: { name: "proj" },
        artifact: { id: 1 },
      });
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].ctx.impl).toEqual({ foo: "bar" });
    expect(calls[0].dest).toBe("/tmp/out");
  });

  it("builds template context from CUE with artifact resolution and fallback", async () => {
    const parseSpy = spyOn(CUEManipulator.prototype, "parse").mockResolvedValue({
      services: { api: { language: "ts" } },
    });

    const ctx = await buildTemplateContext("cue data", { artifactName: "api" });
    expect(ctx.artifact.language).toBe("ts");
    expect(ctx.parent).toBeDefined();

    parseSpy.mockRestore();
  });

  it("buildTemplateContext falls back on parse error and uses artifact fallback", async () => {
    const parseSpy = spyOn(CUEManipulator.prototype, "parse").mockRejectedValue(new Error("bad"));

    const ctx = await buildTemplateContext("invalid", {
      artifactFallback: { name: "fallback" },
    });

    expect(ctx.project._error).toBeDefined();
    expect(ctx.artifact.name).toBe("fallback");

    parseSpy.mockRestore();
  });
});
