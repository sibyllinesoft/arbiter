#!/usr/bin/env bun
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { DEFAULT_PROJECT_STRUCTURE } from "../src/config.js";
import { generateCommand } from "../src/services/generate/index.js";
import type { CLIConfig } from "../src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliRoot = path.resolve(__dirname, "..");
const fixtureRoot = path.join(cliRoot, "tests", "fixtures", "smoke-app");

interface RunCommandOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

function runCommand(command: string, args: string[], options: RunCommandOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

async function findPlaywrightWorkspace(projectRoot: string): Promise<string> {
  const testsRoot = path.join(projectRoot, "tests");
  if (!(await fs.pathExists(testsRoot))) {
    throw new Error(`tests directory missing at ${testsRoot}`);
  }

  const entries = await fs.readdir(testsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgPath = path.join(testsRoot, entry.name, "package.json");
    if (!(await fs.pathExists(pkgPath))) continue;
    const pkg = await fs.readJSON(pkgPath);
    if (pkg?.scripts?.test === "playwright test") {
      return path.dirname(pkgPath);
    }
  }

  throw new Error("Unable to locate Playwright workspace under tests/");
}

async function main(): Promise<void> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-smoke-"));
  const keepArtifacts = process.env.KEEP_GENERATOR_SMOKE === "1";

  try {
    const specDir = path.join(tempRoot, "spec");
    const outputDir = path.join(tempRoot, "generated");

    await fs.copy(fixtureRoot, specDir);
    await fs.ensureDir(outputDir);

    const previousCwd = process.cwd();
    process.chdir(specDir);

    try {
      const cliConfig: CLIConfig = {
        apiUrl: "http://localhost:5050",
        timeout: 750,
        format: "table",
        color: true,
        localMode: true,
        projectDir: specDir,
        projectStructure: { ...DEFAULT_PROJECT_STRUCTURE },
      };

      const status = await generateCommand({ outputDir }, cliConfig);
      if (status !== 0) {
        throw new Error(`generateCommand exited with code ${status}`);
      }
    } finally {
      process.chdir(previousCwd);
    }

    const env = { ...process.env, CI: "1" };
    await runCommand("npm", ["install"], { cwd: outputDir, env });

    const playwrightWorkspace = await findPlaywrightWorkspace(outputDir);
    await runCommand("npx", ["playwright", "install", "chromium"], {
      cwd: playwrightWorkspace,
      env,
    });

    await runCommand("npm", ["run", "lint"], { cwd: outputDir, env });
    await runCommand("npm", ["run", "build"], { cwd: outputDir, env });
    await runCommand("npm", ["run", "test"], { cwd: outputDir, env });
    await runCommand("npm", ["run", "test:e2e"], { cwd: outputDir, env });

    console.log("✅ Generator smoke test succeeded");
  } finally {
    if (keepArtifacts) {
      console.log(`ℹ️  Smoke artifacts retained at ${tempRoot}`);
    } else {
      await fs.remove(tempRoot);
    }
  }
}

main().catch((error) => {
  console.error("❌ Generator smoke test failed:", error);
  process.exit(1);
});
