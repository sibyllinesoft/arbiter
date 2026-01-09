/**
 * MCP CLI integration for external tool execution.
 * Provides interfaces for CUE validation and code generation via CLI.
 */
import { spawn } from "node:child_process";
import { logger } from "../io/utils";

/** Command execution result */
interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

/** Extract error message from unknown error */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Integration class for MCP tool execution and CLI operations.
 * Handles CUE validation, code generation, and subprocess management.
 */
export class McpCliIntegration {
  async triggerTool(
    _: string,
    __: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    return { success: true, message: "MCP tool execution stubbed for tests" };
  }

  async validateCue(
    content: string,
  ): Promise<{ success: boolean; errors?: string[]; warnings?: string[] }> {
    const tempFile = `/tmp/validate_${Date.now()}.cue`;

    try {
      await Bun.write(tempFile, content);
      const result = await this.runCommand("cue", ["vet", tempFile]);
      await Bun.write(tempFile, "");

      return result.success
        ? { success: true }
        : { success: false, errors: [result.stderr || "Validation failed"] };
    } catch (error) {
      logger.error("CUE validation error", error instanceof Error ? error : undefined);
      return { success: false, errors: [getErrorMessage(error)] };
    }
  }

  async generateCode(
    specName: string,
    _outputType = "typescript",
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const result = await this.runCommand("./arbiter-cli", [
        "generate",
        specName,
        "--format",
        "json",
      ]);

      return result.success
        ? { success: true, output: result.stdout || "Code generation completed successfully" }
        : { success: false, error: result.stderr || "Code generation failed" };
    } catch (error) {
      logger.error("Code generation error", error instanceof Error ? error : undefined);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  private runCommand(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => (stdout += data.toString()));
      proc.stderr?.on("data", (data) => (stderr += data.toString()));

      proc.on("close", (code) =>
        resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim() }),
      );
      proc.on("error", (error) => resolve({ success: false, stderr: error.message }));
    });
  }
}
