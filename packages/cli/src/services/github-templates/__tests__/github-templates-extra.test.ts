import { describe, expect, it, spyOn } from "bun:test";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as constraints from "../../../constraints/index.js";
import * as manager from "../../../utils/unified-github-template-manager.js";
import { githubTemplatesCommand } from "../index.js";

const baseConfig: any = {
  projectDir: process.cwd(),
  github: { templates: {} },
};

describe("github templates command - extended coverage", () => {
  it("scaffolds template files into output directory", async () => {
    const safeSpy = spyOn(constraints, "safeFileOperation").mockImplementation(
      async (_op, targetPath, writer) => writer(targetPath),
    );

    const projectDir = await mkdtemp(path.join(os.tmpdir(), "gh-scaffold-"));
    const sourceDir = path.join(projectDir, ".arbiter", "templates", "github");
    await mkdir(sourceDir, { recursive: true });
    const templateNames = [
      "base.hbs",
      "epic.hbs",
      "task.hbs",
      "bug-report.hbs",
      "feature-request.hbs",
    ];
    await Promise.all(
      templateNames.map((name) => writeFile(path.join(sourceDir, name), `content for ${name}`)),
    );

    const outputDir = path.join(projectDir, "out-templates");
    const code = await githubTemplatesCommand(
      { scaffold: true, verbose: true, force: true, outputDir } as any,
      { ...baseConfig, projectDir },
    );

    expect(code).toBe(0);
    for (const name of templateNames) {
      await expect(access(path.join(outputDir, name)).then(() => true)).resolves.toBe(true);
    }

    await rm(projectDir, { recursive: true, force: true });
    safeSpy.mockRestore();
  });

  it("generates template examples and handles unknown types", async () => {
    const epicSpy = spyOn(
      manager.UnifiedGitHubTemplateManager.prototype,
      "generateEpicTemplate",
    ).mockResolvedValue({ title: "Epic", body: "Body", labels: [] });

    const ok = await githubTemplatesCommand({ generate: "epic" } as any, baseConfig);
    expect(ok).toBe(0);
    expect(epicSpy).toHaveBeenCalled();

    const bad = await githubTemplatesCommand({ generate: "unknown-type" } as any, baseConfig);
    expect(bad).toBe(1);

    epicSpy.mockRestore();
  });

  it("reports unimplemented add path and missing removal target", async () => {
    const addCode = await githubTemplatesCommand({ add: true } as any, baseConfig);
    expect(addCode).toBe(0);

    const removeCode = await githubTemplatesCommand(
      { remove: true, name: "nope" } as any,
      baseConfig,
    );
    expect(removeCode).toBe(1);
  });
});
