import { spawn } from "node:child_process";
import path from "node:path";
import type { GeneratorHookEvent, GeneratorHookMap } from "../types.js";

export interface GenerationHookOptions {
  hooks?: GeneratorHookMap;
  workspaceRoot: string;
  outputDir: string;
  configDir?: string;
  dryRun?: boolean;
}

export class GenerationHookManager {
  private readonly hooks: GeneratorHookMap;
  private readonly workspaceRoot: string;
  private readonly outputDir: string;
  private readonly configDir?: string;
  private readonly dryRun: boolean;

  constructor(options: GenerationHookOptions) {
    this.hooks = options.hooks ?? {};
    this.workspaceRoot = options.workspaceRoot;
    this.outputDir = options.outputDir;
    this.configDir = options.configDir;
    this.dryRun = Boolean(options.dryRun);
  }

  async runBeforeGenerate(): Promise<void> {
    await this.runHook("before:generate");
  }

  async runAfterGenerate(generatedFiles: string[]): Promise<void> {
    await this.runHook("after:generate", {
      ARBITER_GENERATED_FILES: generatedFiles.join("\n"),
    });
  }

  async beforeFileWrite(filePath: string, content: string): Promise<string> {
    const command = this.hooks?.["before:fileWrite"];
    if (!command || this.dryRun) {
      return content;
    }

    const relativePath = path.relative(this.workspaceRoot, filePath);
    const stdout = await this.execute(
      command,
      {
        ARBITER_TARGET_PATH: filePath,
        ARBITER_RELATIVE_PATH: relativePath,
      },
      content,
      true,
    );

    return stdout.length > 0 ? stdout : content;
  }

  async afterFileWrite(filePath: string, content: string): Promise<void> {
    await this.runHook("after:fileWrite", {
      ARBITER_TARGET_PATH: filePath,
      ARBITER_RELATIVE_PATH: path.relative(this.workspaceRoot, filePath),
      ARBITER_CONTENT_LENGTH: String(content.length),
    });
  }

  private async runHook(
    event: GeneratorHookEvent,
    extras: Record<string, string> = {},
  ): Promise<void> {
    const command = this.hooks?.[event];
    if (!command || this.dryRun) {
      return;
    }

    await this.execute(command, extras, undefined, false, event);
  }

  private async execute(
    command: string,
    extras: Record<string, string>,
    input?: string,
    captureOutput = false,
    event: GeneratorHookEvent = "before:generate",
  ): Promise<string> {
    const env = {
      ...process.env,
      ...extras,
      ARBITER_HOOK_EVENT: event,
      ARBITER_WORKSPACE_ROOT: this.workspaceRoot,
      ARBITER_OUTPUT_DIR: this.outputDir,
      ARBITER_CONFIG_DIR: this.configDir ?? "",
      ARBITER_IS_DRY_RUN: this.dryRun ? "1" : "0",
    } as Record<string, string>;

    const stdio: any = captureOutput ? ["pipe", "pipe", "inherit"] : ["pipe", "inherit", "inherit"];
    const child = spawn("sh", ["-c", command], {
      cwd: this.workspaceRoot,
      env,
      stdio,
    });

    let stdout = "";
    if (captureOutput && child.stdout) {
      child.stdout.setEncoding("utf-8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
    }

    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    return await new Promise<string>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Hook command failed (event: ${event}): ${command}`));
          return;
        }
        resolve(stdout.trimEnd());
      });
    });
  }
}
