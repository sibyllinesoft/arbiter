import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as constraints from "@/constraints/index.js";
import * as cfg from "@/io/config/config.js";
import {
  generateProjectTemplates,
  githubTemplatesCommand,
  listTemplates,
  showTemplate,
  validateTemplates,
} from "@/services/github-templates/index.js";
import * as manager from "@/utils/github/templates/unified-github-template-manager.js";

const baseConfig: any = {
  projectDir: process.cwd(),
  github: {
    templates: {
      group: { name: "group", description: "Group template" },
      task: "task-template",
    },
  },
};

describe("github templates service", () => {
  it("lists templates as JSON and table", async () => {
    const jsonSpy = spyOn(console, "log").mockImplementation(() => {});
    await listTemplates(baseConfig.github.templates, "json");
    await listTemplates(undefined, "table");
    jsonSpy.mockRestore();
  });

  it("shows template or reports missing", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const errSpy = spyOn(console, "error").mockImplementation(() => {});

    const ok = await showTemplate(baseConfig.github.templates, "group", "yaml");
    expect(ok).toBe(0);

    const missing = await showTemplate(baseConfig.github.templates, "nonexistent", "table");
    expect(missing).toBe(1);

    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("validates template configuration and reports errors", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const validateSpy = spyOn(
      manager.UnifiedGitHubTemplateManager.prototype,
      "validateTemplateConfig",
    ).mockResolvedValue([{ field: "group", message: "invalid" }]);

    const result = await validateTemplates(new manager.UnifiedGitHubTemplateManager({}, "."));
    expect(result).toBe(1);

    validateSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("removes template and saves config", async () => {
    const tmpConfig = {
      ...baseConfig,
      projectDir: await mkdtemp(path.join(os.tmpdir(), "gh-tpl-")),
    };
    const saveSpy = spyOn(cfg, "saveConfig").mockResolvedValue(undefined as any);
    const getPathSpy = spyOn(cfg, "getDefaultConfigPath").mockReturnValue(
      path.join(tmpConfig.projectDir, "config.json"),
    );

    const code = await githubTemplatesCommand(
      { remove: true, name: "group" } as any,
      tmpConfig as any,
    );
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalled();

    saveSpy.mockRestore();
    getPathSpy.mockRestore();
    await rm(tmpConfig.projectDir, { recursive: true, force: true });
  });

  it("generates project templates to disk", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "gh-gen-"));
    const managerSpy = spyOn(
      manager.UnifiedGitHubTemplateManager.prototype,
      "generateRepositoryTemplateFiles",
    ).mockResolvedValue({
      ".github/ISSUE_TEMPLATE/bug.md": "bug body",
      ".github/ISSUE_TEMPLATE/feature.md": "feature body",
    });

    await generateProjectTemplates(tmp, { projectDir: tmp, github: { templates: {} } } as any);

    const bugPath = path.join(tmp, "ISSUE_TEMPLATE", "bug.md");
    const content = await readFile(bugPath, "utf-8");
    expect(content).toContain("bug body");

    managerSpy.mockRestore();
    await rm(tmp, { recursive: true, force: true });
  });
});
