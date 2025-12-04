import type { SpawnOptions } from "bun";

export interface SafeCommandOptions extends SpawnOptions {
  timeoutMs?: number;
}

export async function runSafeCommand(
  cmd: string[],
  options: SafeCommandOptions = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);

  try {
    const proc = Bun.spawn(cmd, {
      ...options,
      signal: controller.signal,
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: proc.exitCode ?? 1,
    };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Command timed out after ${options.timeoutMs ?? 5000}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
