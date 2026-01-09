/**
 * @packageDocumentation
 * Integrate command - Generate CI/CD workflows from project specifications.
 *
 * Provides functionality to:
 * - Detect project languages and frameworks
 * - Generate GitHub Actions workflows
 * - Create pull request and main branch workflows
 * - Support custom template integration
 */

import fs from "node:fs/promises";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import { readAssemblyConfig } from "@/services/integrate/assembly.js";
import { detectProjectLanguages } from "@/services/integrate/language-detector.js";
import {
  createGitHubMainWorkflow,
  createGitHubPullRequestWorkflow,
} from "@/services/integrate/workflow-builder.js";
import type { CLIConfig, GitHubTemplatesConfig, IntegrateOptions } from "@/types.js";
import { UnifiedGitHubTemplateManager } from "@/utils/github/templates/unified-github-template-manager.js";
import { detectPackageManager, getPackageManagerCommands } from "@/utils/io/package-manager.js";
import chalk from "chalk";
import * as YAML from "yaml";

type FsModule = typeof fs;
type TemplateManagerFactory = (config?: GitHubTemplatesConfig) => UnifiedGitHubTemplateManager;

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
    new UnifiedGitHubTemplateManager(config || {}, process.cwd()),
};

type WriteStatus = "written" | "skipped" | "dry-run";

interface RunContext {
  projectPath: string;
  dryRun: boolean;
  force: boolean;
  type: string;
  provider: string;
  workflowDir: string;
  summary: { written: number; skipped: number; dryRun: number };
}

interface LanguageInfo {
  name: string;
  framework?: string;
}

export class IntegrateService {
  constructor(
    private readonly config: CLIConfig,
    private readonly deps: IntegrateDependencies = defaultDeps,
  ) {}

  async run(options: IntegrateOptions): Promise<number> {
    const ctx = this.createRunContext(options);

    this.logHeader(ctx);

    const languages = await this.detectAndLogLanguages(ctx.projectPath);
    if (!languages) return 1;

    const assembly = await this.loadAndLogAssembly(ctx.projectPath);

    this.validateProvider(ctx.provider);

    await this.deps.fs.mkdir(ctx.workflowDir, { recursive: true });

    const pmCommands = getPackageManagerCommands(detectPackageManager(undefined, ctx.projectPath));

    await this.generateWorkflows(ctx, languages, assembly, pmCommands);
    await this.generateTemplatesIfRequested(ctx, options);

    this.logCompletionSummary(ctx, languages);
    return 0;
  }

  private createRunContext(options: IntegrateOptions): RunContext {
    const projectPath = this.config.projectDir || process.cwd();
    return {
      projectPath,
      dryRun: Boolean(options.dryRun),
      force: Boolean(options.force),
      type: options.type ?? "all",
      provider: options.provider ?? options.platform ?? "github",
      workflowDir: path.resolve(projectPath, options.output ?? ".github/workflows"),
      summary: { written: 0, skipped: 0, dryRun: 0 },
    };
  }

  private logHeader(ctx: RunContext): void {
    console.log(chalk.blue("🔗 Arbiter CI/CD integration"));
    console.log(chalk.dim(`Project: ${ctx.projectPath}`));
    if (ctx.dryRun) {
      console.log(chalk.yellow("Simulating changes (dry run). Files will not be written."));
    }
  }

  private async detectAndLogLanguages(projectPath: string): Promise<LanguageInfo[] | null> {
    const languages = await this.deps.detectLanguages(projectPath);
    if (languages.length === 0) {
      console.log(chalk.yellow("⚠️  No supported languages detected (TS, Python, Rust, Go)."));
      return null;
    }

    console.log(chalk.green(`✅ Detected ${languages.length} language(s):`));
    for (const lang of languages) {
      console.log(chalk.dim(`  • ${lang.name}${lang.framework ? ` (${lang.framework})` : ""}`));
    }
    return languages;
  }

  private async loadAndLogAssembly(projectPath: string) {
    const assembly = await this.deps.readAssembly(projectPath);
    if (assembly?.buildMatrix) {
      console.log(chalk.green("✅ Found arbiter.assembly.cue build matrix"));
      console.log(chalk.dim(`  Versions: ${assembly.buildMatrix.versions.join(", ")}`));
      console.log(chalk.dim(`  OS: ${assembly.buildMatrix.os.join(", ")}`));
    } else if (assembly) {
      console.log(chalk.yellow("⚠️  Assembly file detected but using default build matrix"));
    }
    return assembly;
  }

  private validateProvider(provider: string): void {
    if (provider !== "github") {
      console.log(
        chalk.yellow(
          `⚠️  Provider "${provider}" not supported yet. Falling back to GitHub workflow generation.`,
        ),
      );
    }
  }

  private async generateWorkflows(
    ctx: RunContext,
    languages: LanguageInfo[],
    assembly: Awaited<ReturnType<typeof readAssemblyConfig>>,
    pmCommands: ReturnType<typeof getPackageManagerCommands>,
  ): Promise<void> {
    if (ctx.type === "all" || ctx.type === "pr") {
      await this.generatePrWorkflow(ctx, languages, assembly, pmCommands);
    }

    if (ctx.type === "all" || ctx.type === "main" || ctx.type === "release") {
      await this.generateMainWorkflow(ctx, languages, assembly, pmCommands);
    }
  }

  private async generatePrWorkflow(
    ctx: RunContext,
    languages: LanguageInfo[],
    assembly: Awaited<ReturnType<typeof readAssemblyConfig>>,
    pmCommands: ReturnType<typeof getPackageManagerCommands>,
  ): Promise<void> {
    const prWorkflow = this.deps.createPullRequestWorkflow(
      languages,
      assembly?.buildMatrix,
      pmCommands,
    );
    const prPath = path.join(ctx.workflowDir, "pr.yml");
    const status = await this.writeYaml(prPath, prWorkflow, {
      force: ctx.force,
      dryRun: ctx.dryRun,
    });
    this.logWriteResult(ctx.projectPath, prPath, status);
    this.bumpSummary(ctx.summary, status);
  }

  private async generateMainWorkflow(
    ctx: RunContext,
    languages: LanguageInfo[],
    assembly: Awaited<ReturnType<typeof readAssemblyConfig>>,
    pmCommands: ReturnType<typeof getPackageManagerCommands>,
  ): Promise<void> {
    const mainWorkflow = this.deps.createMainWorkflow(languages, assembly?.buildMatrix, pmCommands);
    const mainPath = path.join(ctx.workflowDir, "main.yml");
    const status = await this.writeYaml(mainPath, mainWorkflow, {
      force: ctx.force,
      dryRun: ctx.dryRun,
    });
    this.logWriteResult(ctx.projectPath, mainPath, status);
    this.bumpSummary(ctx.summary, status);
  }

  private async generateTemplatesIfRequested(
    ctx: RunContext,
    options: IntegrateOptions,
  ): Promise<void> {
    if (!options.templates || ctx.provider !== "github") return;

    console.log(chalk.blue("\n🎯 Generating GitHub issue templates..."));
    const templateManager = this.deps.templateManagerFactory(this.config.github?.templates);
    const templates = await templateManager.generateRepositoryTemplateFiles();

    for (const [relativePath, content] of Object.entries(templates)) {
      const targetPath = path.join(ctx.projectPath, relativePath);
      const status = await this.writeText(targetPath, content, {
        force: ctx.force,
        dryRun: ctx.dryRun,
      });
      this.logWriteResult(ctx.projectPath, targetPath, status);
      this.bumpSummary(ctx.summary, status);
    }
  }

  private logCompletionSummary(ctx: RunContext, languages: LanguageInfo[]): void {
    console.log(chalk.green("\n🎉 CI/CD integration complete!"));
    console.log(
      chalk.cyan(
        `📊 Files — written: ${ctx.summary.written}, skipped: ${ctx.summary.skipped}, dry-run: ${ctx.summary.dryRun}`,
      ),
    );

    if (ctx.summary.written + ctx.summary.dryRun > 0) {
      this.logNextSteps(languages);
    }
  }

  private logNextSteps(languages: LanguageInfo[]): void {
    console.log(chalk.cyan("\nNext steps:"));
    console.log(chalk.dim("  1. Commit and push the workflow files"));
    console.log(chalk.dim("  2. Configure repository secrets for package publishing"));

    const secretHints: Record<string, string> = {
      typescript: "     • NPM_TOKEN",
      python: "     • PYPI_TOKEN",
      rust: "     • CARGO_TOKEN",
    };

    for (const [langName, hint] of Object.entries(secretHints)) {
      if (languages.some((l) => l.name === langName)) {
        console.log(chalk.dim(hint));
      }
    }

    console.log(chalk.dim("  3. Open a PR to exercise the validation workflow"));
    console.log(chalk.dim("  4. Create a release to verify publish automation"));
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
    await safeFileOperation("write", filePath, async (validatedPath) => {
      await this.deps.fs.writeFile(validatedPath, contents, "utf-8");
    });
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
