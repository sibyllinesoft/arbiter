import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { HandlerResult } from './handlers/types';
import { logger } from './utils';

export class McpCliIntegration {
  async triggerTool(_: string, __: Record<string, unknown>): Promise<HandlerResult> {
    return {
      success: true,
      message: 'MCP tool execution stubbed for tests',
    };
  }

  async validateCue(
    content: string
  ): Promise<{ success: boolean; errors?: string[]; warnings?: string[] }> {
    try {
      // Write content to temp file and validate with CUE
      const tempFile = `/tmp/validate_${Date.now()}.cue`;
      await Bun.write(tempFile, content);

      const result = await this.runCommand('cue', ['vet', tempFile]);

      // Clean up temp file
      await Bun.write(tempFile, ''); // Clear and let GC handle it

      if (result.success) {
        return { success: true };
      } else {
        return {
          success: false,
          errors: result.stderr ? [result.stderr] : ['Validation failed'],
        };
      }
    } catch (error) {
      logger.error('CUE validation error', error instanceof Error ? error : undefined);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }
  }

  async generateCode(
    specName: string,
    outputType: string = 'typescript'
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      // Use the Arbiter CLI to generate code
      const result = await this.runCommand('./arbiter-cli', [
        'generate',
        specName,
        '--format',
        'json',
      ]);

      if (result.success) {
        return {
          success: true,
          output: result.stdout || 'Code generation completed successfully',
        };
      } else {
        return {
          success: false,
          error: result.stderr || 'Code generation failed',
        };
      }
    } catch (error) {
      logger.error('Code generation error', error instanceof Error ? error : undefined);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown generation error',
      };
    }
  }

  private async runCommand(
    command: string,
    args: string[]
  ): Promise<{ success: boolean; stdout?: string; stderr?: string }> {
    return new Promise(resolve => {
      const process = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', data => {
        stdout += data.toString();
      });

      process.stderr?.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });

      process.on('error', error => {
        resolve({
          success: false,
          stderr: error.message,
        });
      });
    });
  }
}
