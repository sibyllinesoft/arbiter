import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const CLI_ENTRY = path.resolve(import.meta.dir, "../cli.ts");
const BUN_EXECUTABLE = process.env.BUN_PATH || "bun";
const hasCue =
  spawnSync("cue", ["version"], { stdio: "ignore" }).status === 0 ||
  spawnSync("cue", ["help"], { stdio: "ignore" }).status === 0;
const shouldRunE2E = process.env.ARBITER_RUN_E2E === "1" && hasCue;

if (!shouldRunE2E) {
  test.skip(
    "CLI E2E tests require the CUE binary and ARBITER_RUN_E2E=1; skipping in this environment",
  );
}

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface RunCliOptions {
  expectSuccess?: boolean;
  env?: Record<string, string | undefined>;
}

async function runCli(
  args: string[],
  cwd: string,
  options: RunCliOptions = {},
): Promise<CliResult> {
  const expectSuccess = options.expectSuccess ?? true;

  return await new Promise<CliResult>((resolve, reject) => {
    const child = spawn(BUN_EXECUTABLE, [CLI_ENTRY, ...args], {
      cwd,
      env: {
        ...process.env,
        ARBITER_SKIP_REMOTE_SPEC: "1",
        ...options.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr?.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      const result: CliResult = {
        status: code ?? 0,
        stdout,
        stderr,
      };

      if (expectSuccess && result.status !== 0) {
        return reject(
          new Error(
            `CLI command failed (exit ${result.status}): bun ${[CLI_ENTRY, ...args].join(" ")}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
      }

      resolve(result);
    });
  });
}

const tempRoots: string[] = [];

async function scaffoldDemoProject(projectDir: string): Promise<void> {
  const add = (...args: string[]) => runCli(["--local", "add", ...args], projectDir);

  await add("service", "web", "--language", "typescript", "--port", "3000");
  await add("service", "worker", "--service-type", "vercel_function");
  await add("endpoint", "/api/health", "--service", "web", "--method", "GET");
  await add("schema", "HealthResponse");
  await add("route", "/dashboard", "--component", "Dashboard");
  await add(
    "flow",
    "checkout",
    "--steps",
    JSON.stringify([
      { visit: "/" },
      { click: "btn:checkout" },
      { expect: { locator: "page:/dashboard", state: "visible" } },
    ]),
  );
  await add("database", "analytics");
  await add("cache", "session");
  await add("locator", "header", "--selector", "#app-header");
  await add("package", "shared-lib");
  await add("component", "hero-banner", "--framework", "react");
  await add("module", "payments");
}

interface ApiStub {
  url: string;
  fragments: Array<Record<string, any>>;
  projectCreates: Array<Record<string, any>>;
  close: () => Promise<void>;
}

async function createApiStub(): Promise<ApiStub> {
  const fragments: Array<Record<string, any>> = [];
  const projectCreates: Array<Record<string, any>> = [];

  const server = createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 500;
      return res.end();
    }

    if (req.method === "GET" && req.url.startsWith("/api/projects")) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ projects: projectCreates }));
      return;
    }

    if (req.method === "POST" && req.url.startsWith("/api/projects")) {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const payload = JSON.parse(body || "{}");
        projectCreates.push(payload);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ id: payload.id || "cli-project" }));
      });
      return;
    }

    if (req.method === "POST" && req.url.startsWith("/api/fragments")) {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const payload = JSON.parse(body || "{}");
        fragments.push(payload);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, id: "frag-1" }));
      });
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  async function close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }

  return { url, fragments, projectCreates, close };
}

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

if (!shouldRunE2E) {
  test.skip("CLI E2E tests require the CUE binary and ARBITER_RUN_E2E=1; skipping in this environment", () => {});
} else {
  test(
    "arbiter CLI local workflow end-to-end",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "arbiter-cli-e2e-"));
      tempRoots.push(tempRoot);

      const projectDir = path.join(tempRoot, "workspace");
      await mkdir(projectDir, { recursive: true });

      await scaffoldDemoProject(projectDir);

      await runCli(["--local", "generate", "--project-dir", ".", "--force"], projectDir);

      await runCli(["--local", "check"], projectDir);

      const serviceList = await runCli(
        ["--local", "list", "service", "--format", "json"],
        projectDir,
      );
      const services = parseJsonFromCli(serviceList.stdout);
      const serviceNames = services.map((s: any) => s.name);
      expect(serviceNames).toEqual(expect.arrayContaining(["web", "worker"]));

      const endpointList = await runCli(
        ["--local", "list", "endpoint", "--format", "json"],
        projectDir,
      );
      const endpoints = parseJsonFromCli(endpointList.stdout);
      expect(endpoints.some((e: any) => (e.name || "").toLowerCase().includes("/api/health"))).toBe(
        true,
      );

      const statusResult = await runCli(["--local", "status", "--format", "json"], projectDir);
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

  test(
    "arbiter spec-import persists fragments via remote API",
    async () => {
      const projectDir = await mkdtemp(path.join(tmpdir(), "arbiter-spec-import-"));
      tempRoots.push(projectDir);

      const arbiterDir = path.join(projectDir, ".arbiter");
      await mkdir(arbiterDir, { recursive: true });
      const specPath = path.join(arbiterDir, "assembly.cue");
      await writeFile(specPath, 'project: "demo"\n', "utf-8");

      const api = await createApiStub();

      try {
        await runCli(
          [
            "spec-import",
            "--skip-validate",
            "--project",
            "e2e-spec",
            specPath,
            "--api-url",
            api.url,
          ],
          projectDir,
        );

        expect(api.fragments).toHaveLength(1);
        expect(api.fragments[0].projectId).toBe("e2e-spec");
        expect(api.fragments[0].path).toContain("assembly.cue");
      } finally {
        await api.close();
      }
    },
    { timeout: 60000 },
  );

  test(
    "arbiter sync updates TypeScript manifests",
    async () => {
      const projectDir = await mkdtemp(path.join(tmpdir(), "arbiter-sync-e2e-"));
      tempRoots.push(projectDir);

      const pkgPath = path.join(projectDir, "package.json");
      await writeFile(pkgPath, JSON.stringify({ name: "sync-demo", version: "0.1.0" }, null, 2));

      await runCli(["sync", "--force"], projectDir);

      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
      expect(pkg.scripts["arbiter:check"]).toBe("arbiter check");
      expect(pkg.devDependencies["@arbiter/cli"]).toMatch(/^\^/);
      expect(pkg.arbiter?.surface?.language).toBe("typescript");
    },
    { timeout: 60000 },
  );

  test(
    "generate, sync, and spec-import flow against stubbed API",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "arbiter-cli-remote-"));
      tempRoots.push(tempRoot);
      const projectDir = path.join(tempRoot, "workspace");
      await mkdir(projectDir, { recursive: true });

      await scaffoldDemoProject(projectDir);
      await runCli(["--local", "generate", "--project-dir", ".", "--force"], projectDir);

      const pkgPath = path.join(projectDir, "package.json");
      await writeFile(pkgPath, JSON.stringify({ name: "remote-flow", version: "0.0.1" }, null, 2));
      await runCli(["sync", "--force"], projectDir);

      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
      expect(pkg.scripts["arbiter:check"]).toBeDefined();

      const api = await createApiStub();
      try {
        const specPath = path.join(projectDir, ".arbiter", "assembly.cue");
        await runCli(
          [
            "spec-import",
            "--skip-validate",
            "--project",
            "flow-spec",
            specPath,
            "--api-url",
            api.url,
          ],
          projectDir,
        );

        expect(api.projectCreates).toHaveLength(1);
        expect(api.fragments).toHaveLength(1);
        expect(api.fragments[0].projectId).toBe("flow-spec");
      } finally {
        await api.close();
      }
    },
    { timeout: 60000 },
  );
}
