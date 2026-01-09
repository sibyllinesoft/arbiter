/**
 * @packageDocumentation
 * Generation hook management for custom build steps.
 *
 * Provides a hook system for running custom commands before/after
 * code generation and file writes.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import type { GeneratorHookEvent, GeneratorHookMap } from "@/types.js";

/** Options for configuring generation hooks. */
export interface GenerationHookOptions {
  hooks?: GeneratorHookMap;
  workspaceRoot: string;
  outputDir: string;
  configDir?: string;
  dryRun?: boolean;
}

/**
 * Manager for executing generation lifecycle hooks.
 */
export class GenerationHookManager {
  /** Configured hook commands. */
  private readonly hooks: GeneratorHookMap;
  /** Workspace root directory. */
  private readonly workspaceRoot: string;
  /** Output directory for generated files. */
  private readonly outputDir: string;
  /** Configuration directory. */
  private readonly configDir?: string;
  /** Whether to skip actual execution. */
  private readonly dryRun: boolean;

  /**
   * Create a new GenerationHookManager.
   * @param options - Hook configuration options
   */
  constructor(options: GenerationHookOptions) {
    this.hooks = options.hooks ?? {};
    this.workspaceRoot = options.workspaceRoot;
    this.outputDir = options.outputDir;
    this.configDir = options.configDir;
    this.dryRun = Boolean(options.dryRun);
  }

  /**
   * Run the before:generate hook.
   * @returns Promise that resolves when hook completes
   */
  async runBeforeGenerate(): Promise<void> {
    await this.runHook("before:generate");
  }

  /**
   * Run the after:generate hook.
   * @param generatedFiles - List of generated file paths
   * @returns Promise that resolves when hook completes
   */
  async runAfterGenerate(generatedFiles: string[]): Promise<void> {
    await this.runHook("after:generate", {
      ARBITER_GENERATED_FILES: generatedFiles.join("\n"),
    });
  }

  /**
   * Run the before:fileWrite hook.
   * @param filePath - Path to the file being written
   * @param content - Content to be written
   * @returns Potentially modified content from hook
   */
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

  /**
   * Run the after:fileWrite hook.
   * @param filePath - Path to the written file
   * @param content - Content that was written
   */
  async afterFileWrite(filePath: string, content: string): Promise<void> {
    await this.runHook("after:fileWrite", {
      ARBITER_TARGET_PATH: filePath,
      ARBITER_RELATIVE_PATH: path.relative(this.workspaceRoot, filePath),
      ARBITER_CONTENT_LENGTH: String(content.length),
    });
  }

  /**
   * Run a hook command for the given event.
   * @param event - Hook event type
   * @param extras - Extra environment variables
   */
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

  private buildHookEnvironment(
    extras: Record<string, string>,
    event: GeneratorHookEvent,
  ): Record<string, string> {
    return {
      ...process.env,
      ...extras,
      ARBITER_HOOK_EVENT: event,
      ARBITER_WORKSPACE_ROOT: this.workspaceRoot,
      ARBITER_OUTPUT_DIR: this.outputDir,
      ARBITER_CONFIG_DIR: this.configDir ?? "",
      ARBITER_IS_DRY_RUN: this.dryRun ? "1" : "0",
    } as Record<string, string>;
  }

  private setupOutputCapture(
    child: ReturnType<typeof spawn>,
    captureOutput: boolean,
  ): () => string {
    let stdout = "";
    if (captureOutput && child.stdout) {
      child.stdout.setEncoding("utf-8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
    }
    return () => stdout.trimEnd();
  }

  private sendInput(child: ReturnType<typeof spawn>, input?: string): void {
    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  }

  private waitForCompletion(
    child: ReturnType<typeof spawn>,
    getOutput: () => string,
    event: GeneratorHookEvent,
    command: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Hook command failed (event: ${event}): ${command}`));
          return;
        }
        resolve(getOutput());
      });
    });
  }

  /**
   * Execute a shell command with environment variables.
   */
  private async execute(
    command: string,
    extras: Record<string, string>,
    input?: string,
    captureOutput = false,
    event: GeneratorHookEvent = "before:generate",
  ): Promise<string> {
    const env = this.buildHookEnvironment(extras, event);
    const stdio: any = captureOutput ? ["pipe", "pipe", "inherit"] : ["pipe", "inherit", "inherit"];

    const child = spawn("sh", ["-c", command], {
      cwd: this.workspaceRoot,
      env,
      stdio,
    });

    const getOutput = this.setupOutputCapture(child, captureOutput);
    this.sendInput(child, input);

    return this.waitForCompletion(child, getOutput, event, command);
  }
}
