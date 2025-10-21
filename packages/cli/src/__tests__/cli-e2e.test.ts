import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const CLI_ENTRY = path.resolve(import.meta.dir, "../cli.ts");
const BUN_EXECUTABLE = process.env.BUN_PATH || "bun";

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], cwd: string, expectSuccess = true): CliResult {
  const result = spawnSync(BUN_EXECUTABLE, [CLI_ENTRY, ...args], {
    cwd,
    env: {
      ...process.env,
      ARBITER_SKIP_REMOTE_SPEC: "1",
    },
    encoding: "utf-8",
  });

  if (result.error) {
    throw result.error;
  }

  if (expectSuccess && result.status !== 0) {
    throw new Error(
      `CLI command failed (exit ${result.status}): bun ${[CLI_ENTRY, ...args].join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const tempRoots: string[] = [];

function parseJsonFromCli(output: string): any {
  const withoutAnsi = output.replace(/\x1B\[[0-9;]*m/g, "");
  const firstBrace = withoutAnsi.indexOf("{");
  const firstBracket = withoutAnsi.indexOf("[");
  const startCandidates = [firstBrace, firstBracket].filter((idx) => idx !== -1);

  if (startCandidates.length === 0) {
    throw new Error(`No JSON payload found in CLI output: ${output}`);
  }

  const startIndex = Math.min(...startCandidates);
  const jsonString = withoutAnsi.slice(startIndex).trim();
  return JSON.parse(jsonString);
}

afterAll(async () => {
  await Promise.all(
    tempRoots.map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
});

test(
  "arbiter CLI local workflow end-to-end",
  async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "arbiter-cli-e2e-"));
    tempRoots.push(tempRoot);

    const projectDir = path.join(tempRoot, "workspace");
    await mkdir(projectDir, { recursive: true });

    const add = (...args: string[]) => runCli(["--local", "add", ...args], projectDir);

    add("service", "web", "--language", "typescript", "--port", "3000");
    add("service", "worker", "--service-type", "vercel_function");
    add("endpoint", "/api/health", "--service", "web", "--method", "GET");
    add("schema", "HealthResponse");
    add("route", "/dashboard", "--component", "Dashboard");
    add(
      "flow",
      "checkout",
      "--steps",
      JSON.stringify([
        { visit: "/" },
        { click: "btn:checkout" },
        { expect: { locator: "page:/dashboard", state: "visible" } },
      ]),
    );
    add("database", "analytics");
    add("cache", "session");
    add("locator", "header", "--selector", "#app-header");
    add("package", "shared-lib");
    add("component", "hero-banner", "--framework", "react");
    add("module", "payments");

    runCli(["--local", "generate", "--output-dir", ".", "--force"], projectDir);

    runCli(["--local", "check"], projectDir);

    const serviceList = runCli(["--local", "list", "service", "--format", "json"], projectDir);
    const services = parseJsonFromCli(serviceList.stdout);
    const serviceNames = services.map((s: any) => s.name);
    expect(serviceNames).toEqual(expect.arrayContaining(["web", "worker"]));

    const endpointList = runCli(["--local", "list", "endpoint", "--format", "json"], projectDir);
    const endpoints = parseJsonFromCli(endpointList.stdout);
    expect(endpoints.some((e: any) => (e.name || "").includes("/api/health"))).toBe(true);

    const statusResult = runCli(["--local", "status", "--format", "json"], projectDir);
    const projectStatus = parseJsonFromCli(statusResult.stdout);
    expect(projectStatus.health).toBe("healthy");

    const assemblyPath = path.join(projectDir, ".arbiter", "assembly.cue");
    const assembly = await readFile(assemblyPath, "utf-8");
    expect(assembly).toContain("services:");
    expect(assembly).toContain("locators:");
    expect(assembly).toContain("flows:");

    const expectedDirs = ["services", "tests"];
    await Promise.all(
      expectedDirs.map(async (dir) => {
        const target = path.join(projectDir, dir);
        try {
          await stat(target);
        } catch (error) {
          throw new Error(`Expected directory missing: ${target}`);
        }
      }),
    );
  },
  { timeout: 60000 },
);
