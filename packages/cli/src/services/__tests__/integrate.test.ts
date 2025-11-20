import { afterEach, describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { CLIConfig } from "../../types.js";
import { DEFAULT_TEMPLATES_CONFIG } from "../../utils/unified-github-template-manager.js";
import { integrateProject } from "../integrate/index.js";

const tempProjects: string[] = [];

afterEach(async () => {
  await Promise.all(tempProjects.splice(0).map((dir) => fs.remove(dir)));
});

function createCliConfig(projectDir: string): CLIConfig {
  return {
    apiUrl: "http://localhost:5050",
    timeout: 5_000,
    format: "json",
    color: true,
    localMode: false,
    projectDir,
    github: {
      templates: DEFAULT_TEMPLATES_CONFIG,
    },
    projectStructure: {
      clientsDirectory: "apps",
      servicesDirectory: "services",
      packagesDirectory: "packages",
      toolsDirectory: "tools",
      docsDirectory: "docs",
      testsDirectory: "tests",
      infraDirectory: "infra",
    },
  };
}

describe("IntegrateService", () => {
  it("generates GitHub workflows and templates", async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-integrate-"));
    tempProjects.push(projectDir);
    await fs.writeJSON(path.join(projectDir, "package.json"), { name: "demo" });

    const exitCode = await integrateProject(
      { templates: true, force: true },
      createCliConfig(projectDir),
    );

    expect(exitCode).toBe(0);
    const workflowPath = path.join(projectDir, ".github/workflows/pr.yml");
    const templatePath = path.join(projectDir, ".github/ISSUE_TEMPLATE/epic.md");
    expect(await fs.pathExists(workflowPath)).toBeTrue();
    expect(await fs.pathExists(templatePath)).toBeTrue();
  });

  it("skips writing files in dry-run mode", async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-integrate-"));
    tempProjects.push(projectDir);
    await fs.writeJSON(path.join(projectDir, "package.json"), { name: "demo" });

    const exitCode = await integrateProject(
      { dryRun: true, templates: true },
      createCliConfig(projectDir),
    );

    expect(exitCode).toBe(0);
    expect(await fs.pathExists(path.join(projectDir, ".github/workflows/pr.yml"))).toBeFalse();
  });
});
