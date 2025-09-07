import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import fs from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable colors for consistent golden test output
chalk.level = 0;
process.env.NO_COLOR = "1";
process.env.FORCE_COLOR = "0";

const GOLDEN_DIR = path.join(__dirname, "golden");
const TEMP_DIR = path.join(__dirname, "temp");
const CLI_PATH = path.join(__dirname, "../cli.ts");

describe("CLI Golden Tests", () => {
  beforeAll(async () => {
    // Ensure golden and temp directories exist
    await fs.ensureDir(GOLDEN_DIR);
    await fs.ensureDir(TEMP_DIR);

    // Clean up temp directory
    await fs.emptyDir(TEMP_DIR);

    // Create test CUE files for testing
    await createTestFiles();
  });

  afterAll(async () => {
    // Clean up temp directory
    await fs.remove(TEMP_DIR);
  });

  test("help output", async () => {
    const result = await runCLI(["--help"]);
    await compareWithGolden("help.txt", result.stdout);
  });

  test("version output", async () => {
    const result = await runCLI(["--version"]);
    await compareWithGolden("version.txt", result.stdout);
  });

  test("init --list-templates", async () => {
    const result = await runCLI(["init", "--list-templates"]);
    await compareWithGolden("init-list-templates.txt", result.stdout);
  });

  test("export --list-formats", async () => {
    const result = await runCLI(["export", "--help"]);
    await compareWithGolden("export-list-formats.txt", result.stdout);
  });

  test("check help", async () => {
    const result = await runCLI(["check", "--help"]);
    await compareWithGolden("check-help.txt", result.stdout);
  });

  test("validate help", async () => {
    const result = await runCLI(["validate", "--help"]);
    await compareWithGolden("validate-help.txt", result.stdout);
  });

  test("export help", async () => {
    const result = await runCLI(["export", "--help"]);
    await compareWithGolden("export-help.txt", result.stdout);
  });

  test("init basic project structure", async () => {
    const projectDir = path.join(TEMP_DIR, "test-basic");
    const result = await runCLI([
      "init",
      "test-project",
      "--template",
      "basic",
      "--directory",
      projectDir,
    ]);

    // Check that files were created
    expect(await fs.pathExists(path.join(projectDir, "schema.cue"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "values.cue"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, "README.md"))).toBe(true);
    expect(await fs.pathExists(path.join(projectDir, ".arbiter.json"))).toBe(true);

    await compareWithGolden("init-basic.txt", result.stdout);
  });

  test("check command with no files", async () => {
    const emptyDir = path.join(TEMP_DIR, "empty");
    await fs.ensureDir(emptyDir);

    const result = await runCLI(["check"], { cwd: emptyDir });
    await compareWithGolden("check-no-files.txt", result.stdout);
  });

  test("validate command with missing file", async () => {
    const result = await runCLI(["validate", "nonexistent.cue"]);
    expect(result.exitCode).toBe(1);
    await compareWithGolden("validate-missing-file.txt", result.stderr);
  });

  test("config show (without server)", async () => {
    const result = await runCLI(["config", "show"]);
    // Remove dynamic parts for golden comparison
    const normalized = normalizeConfigOutput(result.stdout);
    await compareWithGolden("config-show.txt", normalized);
  });

  test("unknown command error", async () => {
    const result = await runCLI(["unknown-command"]);
    expect(result.exitCode).toBe(1);
    await compareWithGolden("unknown-command.txt", result.stderr);
  });
});

/**
 * Run CLI command and capture output
 */
async function runCLI(
  args: string[],
  options: { cwd?: string } = {},
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const allArgs = [...args];
    const child = spawn("bun", ["run", CLI_PATH, ...allArgs], {
      cwd: options.cwd || process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        NODE_ENV: "test",
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        exitCode: code || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        exitCode: 1,
        stdout: "",
        stderr: error.message,
      });
    });

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        exitCode: 124,
        stdout,
        stderr: `${stderr}\nTimeout: Command took too long (>30s)`,
      });
    }, 30000);
  });
}

/**
 * Compare output with golden file
 */
async function compareWithGolden(filename: string, actual: string): Promise<void> {
  const goldenPath = path.join(GOLDEN_DIR, filename);

  // Normalize output (remove timestamps, paths, etc.)
  const normalized = normalizeOutput(actual);

  if (await fs.pathExists(goldenPath)) {
    // Compare with existing golden file
    const expected = await fs.readFile(goldenPath, "utf-8");
    expect(normalized.trim()).toBe(expected.trim());
  } else {
    // Create new golden file
    console.warn(`Creating new golden file: ${filename}`);
    await fs.writeFile(goldenPath, normalized);
  }
}

/**
 * Normalize output for consistent golden tests
 */
function normalizeOutput(output: string): string {
  return (
    output
      // Remove ANSI color codes
      .replace(/\u001b\[[0-9;]*m/g, "")
      // Normalize paths
      .replace(new RegExp(process.cwd(), "g"), "/project/root")
      .replace(new RegExp(__dirname, "g"), "/test/dir")
      // Normalize timestamps
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "TIMESTAMP")
      // Normalize timing
      .replace(/\(\d+ms\)/g, "(XXXms)")
      .replace(/\d+\.?\d*ms/g, "XXXms")
      .replace(/\d+\.?\d*s/g, "XXXs")
      // Normalize version numbers
      .replace(/\d+\.\d+\.\d+/g, "X.X.X")
      // Normalize ports and URLs
      .replace(/http:\/\/localhost:\d+/g, "http://localhost:XXXX")
      .replace(/"http:\/\/localhost:5050"/g, '"http://localhost:XXXX"')
      .replace(/"5000"/g, '"XXXX"')
      // Remove trailing whitespace
      .replace(/\s+$/gm, "")
  );
}

/**
 * Normalize config output specifically
 */
function normalizeConfigOutput(output: string): string {
  return (
    normalizeOutput(output)
      // Replace dynamic port numbers and URLs
      .replace(/http:\/\/localhost:\d+/g, "http://localhost:XXXX")
      .replace(/:\d{4,5}/g, ":XXXX")
  );
}

/**
 * Create test CUE files for testing
 */
async function createTestFiles(): Promise<void> {
  const validCue = `
package test

name: "test-app"
version: "1.0.0"
config: {
  host: "localhost"
  port: 8080
}
`;

  const invalidCue = `
package test

name: "test-app"
version: 1.0.0  // Should be string
config: {
  host: "localhost"
  port: "8080"  // Should be number
}
`;

  const schema = `
package test

#Config: {
  host: string
  port: int & >0 & <65536
}

#App: {
  name: string
  version: string
  config: #Config
}
`;

  await fs.writeFile(path.join(TEMP_DIR, "valid.cue"), validCue);
  await fs.writeFile(path.join(TEMP_DIR, "invalid.cue"), invalidCue);
  await fs.writeFile(path.join(TEMP_DIR, "schema.cue"), schema);
}

/**
 * Update golden files (run with UPDATE_GOLDEN=1 bun test)
 */
if (process.env.UPDATE_GOLDEN) {
  console.log("Golden files will be updated...");
}
