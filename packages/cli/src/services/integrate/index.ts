import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import * as YAML from "yaml";
import type { CLIConfig, GitHubTemplatesConfig, IntegrateOptions } from "../../types.js";
import { ConfigurableTemplateManager } from "../../utils/github-template-config.js";
import { readAssemblyConfig } from "./assembly.js";
import { detectProjectLanguages } from "./language-detector.js";
import { createGitHubMainWorkflow, createGitHubPullRequestWorkflow } from "./workflow-builder.js";

type FsModule = typeof fs;
type TemplateManagerFactory = (config?: GitHubTemplatesConfig) => ConfigurableTemplateManager;

interface IntegrateDependencies {
  detectLanguages: typeof detectProjectLanguages;
  readAssembly: typeof readAssemblyConfig;
  createPullRequestWorkflow: typeof createGitHubPullRequestWorkflow;
  createMainWorkflow: typeof createGitHubMainWorkflow;
  fs: FsModule;
  yamlStringify: (workflow: Record<string, unknown>) => string;
  templateManagerFactory: TemplateManagerFactory;
}

const defaultDeps: IntegrateDependencies = {
  detectLanguages: detectProjectLanguages,
  readAssembly: readAssemblyConfig,
  createPullRequestWorkflow: createGitHubPullRequestWorkflow,
  createMainWorkflow: createGitHubMainWorkflow,
  fs,
  yamlStringify: (workflow) =>
    YAML.stringify(workflow, {
      indent: 2,
      lineWidth: 0,
    }),
  templateManagerFactory: (config?: GitHubTemplatesConfig) =>
    new ConfigurableTemplateManager(config),
};

type WriteStatus = "written" | "skipped" | "dry-run";

export class IntegrateService {
  constructor(
    private readonly config: CLIConfig,
    private readonly deps: IntegrateDependencies = defaultDeps,
  ) {}

  async run(options: IntegrateOptions): Promise<number> {
    const projectPath = this.config.projectDir || process.cwd();
    const dryRun = Boolean(options.dryRun);

    console.log(chalk.blue("🔗 Arbiter CI/CD integration"));
    console.log(chalk.dim(`Project: ${projectPath}`));
    if (dryRun) {
      console.log(chalk.yellow("Simulating changes (dry run). Files will not be written."));
    }

    const languages = await this.deps.detectLanguages(projectPath);
    if (languages.length === 0) {
      console.log(chalk.yellow("⚠️  No supported languages detected (TS, Python, Rust, Go)."));
      return 1;
    }

    console.log(chalk.green(`✅ Detected ${languages.length} language(s):`));
    for (const lang of languages) {
      console.log(chalk.dim(`  • ${lang.name}${lang.framework ? ` (${lang.framework})` : ""}`));
    }

    const assembly = await this.deps.readAssembly(projectPath);
    if (assembly?.buildMatrix) {
      console.log(chalk.green("✅ Found arbiter.assembly.cue build matrix"));
      console.log(chalk.dim(`  Versions: ${assembly.buildMatrix.versions.join(", ")}`));
      console.log(chalk.dim(`  OS: ${assembly.buildMatrix.os.join(", ")}`));
    } else if (assembly) {
      console.log(chalk.yellow("⚠️  Assembly file detected but using default build matrix"));
    }

    const provider = options.provider ?? options.platform ?? "github";
    if (provider !== "github") {
      console.log(
        chalk.yellow(
          `⚠️  Provider "${provider}" not supported yet. Falling back to GitHub workflow generation.`,
        ),
      );
    }

    const workflowDir = path.resolve(projectPath, options.output ?? ".github/workflows");
    await this.deps.fs.mkdir(workflowDir, { recursive: true });

    const force = Boolean(options.force);
    const type = options.type ?? "all";
    const summary = { written: 0, skipped: 0, dryRun: 0 };

    if (type === "all" || type === "pr") {
      const prWorkflow = this.deps.createPullRequestWorkflow(languages, assembly?.buildMatrix);
      const prPath = path.join(workflowDir, "pr.yml");
      const status = await this.writeYaml(prPath, prWorkflow, { force, dryRun });
      this.logWriteResult(projectPath, prPath, status);
      this.bumpSummary(summary, status);
    }

    if (type === "all" || type === "main" || type === "release") {
      const mainWorkflow = this.deps.createMainWorkflow(languages, assembly?.buildMatrix);
      const mainPath = path.join(workflowDir, "main.yml");
      const status = await this.writeYaml(mainPath, mainWorkflow, { force, dryRun });
      this.logWriteResult(projectPath, mainPath, status);
      this.bumpSummary(summary, status);
    }

    if (options.templates && provider === "github") {
      console.log(chalk.blue("\n🎯 Generating GitHub issue templates..."));
      const templateManager = this.deps.templateManagerFactory(this.config.github?.templates);
      const templates = templateManager.generateRepositoryTemplates();
      for (const [relativePath, content] of Object.entries(templates)) {
        const targetPath = path.join(projectPath, relativePath);
        const status = await this.writeText(targetPath, content, { force, dryRun });
        this.logWriteResult(projectPath, targetPath, status);
        this.bumpSummary(summary, status);
      }
    }

    console.log(chalk.green("\n🎉 CI/CD integration complete!"));
    console.log(
      chalk.cyan(
        `📊 Files — written: ${summary.written}, skipped: ${summary.skipped}, dry-run: ${summary.dryRun}`,
      ),
    );

    if (summary.written + summary.dryRun > 0) {
      console.log(chalk.cyan("\nNext steps:"));
      console.log(chalk.dim("  1. Commit and push the workflow files"));
      console.log(chalk.dim("  2. Configure repository secrets for package publishing"));
      if (languages.some((l) => l.name === "typescript")) {
        console.log(chalk.dim("     • NPM_TOKEN"));
      }
      if (languages.some((l) => l.name === "python")) {
        console.log(chalk.dim("     • PYPI_TOKEN"));
      }
      if (languages.some((l) => l.name === "rust")) {
        console.log(chalk.dim("     • CARGO_TOKEN"));
      }
      console.log(chalk.dim("  3. Open a PR to exercise the validation workflow"));
      console.log(chalk.dim("  4. Create a release to verify publish automation"));
    }

    return 0;
  }

  private async writeYaml(
    filePath: string,
    workflow: Record<string, unknown>,
    options: { force: boolean; dryRun: boolean },
  ): Promise<WriteStatus> {
    const serialized = this.deps.yamlStringify(workflow);
    return this.writeText(filePath, serialized, options);
  }

  private async writeText(
    filePath: string,
    contents: string,
    options: { force: boolean; dryRun: boolean },
  ): Promise<WriteStatus> {
    const exists = await this.fileExists(filePath);
    if (exists && !options.force) {
      return "skipped";
    }

    if (options.dryRun) {
      return "dry-run";
    }

    await this.deps.fs.mkdir(path.dirname(filePath), { recursive: true });
    await this.deps.fs.writeFile(filePath, contents, "utf-8");
    return "written";
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.deps.fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private logWriteResult(projectPath: string, filePath: string, status: WriteStatus): void {
    const displayPath = path.relative(projectPath, filePath) || filePath;
    if (status === "written") {
      console.log(chalk.green(`✅ Generated ${displayPath}`));
    } else if (status === "dry-run") {
      console.log(chalk.cyan(`📝 (dry-run) Would generate ${displayPath}`));
    } else {
      console.log(chalk.yellow(`⚠️  ${displayPath} exists. Use --force to overwrite.`));
    }
  }

  private bumpSummary(
    summary: { written: number; skipped: number; dryRun: number },
    status: WriteStatus,
  ): void {
    if (status === "written") summary.written += 1;
    if (status === "dry-run") summary.dryRun += 1;
    if (status === "skipped") summary.skipped += 1;
  }
}

export async function integrateProject(
  options: IntegrateOptions,
  config: CLIConfig,
): Promise<number> {
  const service = new IntegrateService(config);
  return service.run(options);
}
