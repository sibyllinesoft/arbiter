import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const CLI_ENTRY = path.resolve(import.meta.dir, "@/cli.ts");
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
  specRequests: Array<{ type: string; path: string }>;
  projectStructureRequests: number;
  close: () => Promise<void>;
}

interface ApiStubOptions {
  storedSpecifications?: Array<{ type: string; path?: string; content: string }>;
  projectStructure?: Record<string, any>;
}

interface StubState {
  fragments: Array<Record<string, any>>;
  projectCreates: Array<Record<string, any>>;
  specRequests: Array<{ type: string; path: string }>;
  projectStructureRequests: number;
}

function sendJson(res: import("http").ServerResponse, data: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function handleProjectStructure(
  res: import("http").ServerResponse,
  state: StubState,
  options: ApiStubOptions,
): void {
  state.projectStructureRequests += 1;
  sendJson(res, { success: true, projectStructure: options.projectStructure ?? {} });
}

function handleSpecifications(
  req: import("http").IncomingMessage,
  res: import("http").ServerResponse,
  state: StubState,
  options: ApiStubOptions,
): void {
  const url = new URL(req.url!, "http://127.0.0.1");
  const type = url.searchParams.get("type") ?? "";
  const pathParam = url.searchParams.get("path") ?? "";
  state.specRequests.push({ type, path: pathParam });

  const match =
    options.storedSpecifications?.find(
      (spec) => spec.type === type && (!spec.path || spec.path === pathParam),
    ) ?? options.storedSpecifications?.find((spec) => spec.type === type);

  if (match) {
    sendJson(res, { content: match.content });
  } else {
    res.statusCode = 404;
    res.end("not found");
  }
}

function handlePostWithBody<T>(
  req: import("http").IncomingMessage,
  callback: (payload: T) => void,
): void {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => callback(JSON.parse(body || "{}")));
}

function createRequestHandler(state: StubState, options: ApiStubOptions) {
  return (req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
    if (!req.url) {
      res.statusCode = 500;
      res.end();
      return;
    }

    const { method, url } = req;

    if (method === "GET" && url.startsWith("/api/config/project-structure")) {
      handleProjectStructure(res, state, options);
      return;
    }

    if (method === "GET" && url.startsWith("/api/specifications")) {
      handleSpecifications(req, res, state, options);
      return;
    }

    if (method === "GET" && url.startsWith("/api/projects")) {
      sendJson(res, { projects: state.projectCreates });
      return;
    }

    if (method === "POST" && url.startsWith("/api/projects")) {
      handlePostWithBody(req, (payload: Record<string, any>) => {
        state.projectCreates.push(payload);
        sendJson(res, { id: payload.id || "cli-project" });
      });
      return;
    }

    if (method === "POST" && url.startsWith("/api/fragments")) {
      handlePostWithBody(req, (payload: Record<string, any>) => {
        state.fragments.push(payload);
        sendJson(res, { success: true, id: "frag-1" });
      });
      return;
    }

    res.statusCode = 404;
    res.end();
  };
}

async function createApiStub(options: ApiStubOptions = {}): Promise<ApiStub> {
  const state: StubState = {
    fragments: [],
    projectCreates: [],
    specRequests: [],
    projectStructureRequests: 0,
  };

  const server = createServer(createRequestHandler(state, options));

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  async function close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }

  return {
    url,
    get fragments() {
      return state.fragments;
    },
    get projectCreates() {
      return state.projectCreates;
    },
    get specRequests() {
      return state.specRequests;
    },
    get projectStructureRequests() {
      return state.projectStructureRequests;
    },
    close,
  };
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

function tryParseJsonFromCli(output: string): any | null {
  try {
    return parseJsonFromCli(output);
  } catch {
    return null;
  }
}

async function expectPathExists(...segments: string[]): Promise<void> {
  const target = path.join(...segments);
  try {
    await stat(target);
  } catch (error) {
    throw new Error(`Expected path to exist: ${target}\n${error}`);
  }
}

async function firstDirectory(root: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true });
  const dir = entries.find((entry) => entry.isDirectory());
  if (!dir) {
    throw new Error(`No directories found in ${root}`);
  }
  return dir.name;
}

async function findFileByName(root: string, fileName: string): Promise<string | null> {
  const queue: string[] = [root];

  while (queue.length) {
    const current = queue.shift()!;
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.name === fileName) {
        return fullPath;
      }
    }
  }

  return null;
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
      const services = tryParseJsonFromCli(serviceList.stdout);
      if (services) {
        const serviceNames = services.map((s: any) => s.name);
        expect(serviceNames).toEqual(expect.arrayContaining(["web", "worker"]));
      } else {
        expect(serviceList.stdout).toContain("web");
        expect(serviceList.stdout).toContain("worker");
      }

      const endpointList = await runCli(
        ["--local", "list", "endpoint", "--format", "json"],
        projectDir,
      );
      const endpoints = tryParseJsonFromCli(endpointList.stdout);
      if (endpoints) {
        expect(
          endpoints.some((e: any) => (e.name || "").toLowerCase().includes("/api/health")),
        ).toBe(true);
      } else {
        expect(endpointList.stdout.toLowerCase()).toContain("/api/health");
      }

      const statusResult = await runCli(["--local", "status", "--format", "json"], projectDir);
      const projectStatus = tryParseJsonFromCli(statusResult.stdout);
      if (projectStatus) {
        expect(projectStatus.health).toBe("healthy");
      } else {
        expect(statusResult.stdout.toLowerCase()).toContain("healthy");
      }

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

      const testsRoot = path.join(projectDir, "tests");
      const flowTestPath = await findFileByName(testsRoot, "checkout.test.ts");
      expect(flowTestPath).not.toBeNull();
      if (flowTestPath) {
        await stat(flowTestPath);
      }
      const runE2ePath = await findFileByName(testsRoot, "run-e2e.mjs");
      expect(runE2ePath).not.toBeNull();
      if (runE2ePath) {
        await stat(runE2ePath);
      }
      const playwrightConfigPath = await findFileByName(testsRoot, "playwright.config.ts");
      expect(playwrightConfigPath).not.toBeNull();
      if (playwrightConfigPath) {
        await stat(playwrightConfigPath);
      }

      const clientsRoot = path.join(projectDir, "clients");
      const clientSlug = await firstDirectory(clientsRoot);
      await expectPathExists(clientsRoot, clientSlug, "src", "routes", "AppRoutes.tsx");

      await expectPathExists(projectDir, "docs", "overview.md");
      await expectPathExists(projectDir, "docs", "api", "openapi.json");
      await expectPathExists(projectDir, "services", "web", "src", "routes", "index.ts");
      await expectPathExists(projectDir, "packages", "ui.json");
      await expectPathExists(projectDir, "infra", "main.tf");
    },
    { timeout: 60000 },
  );

  test(
    "arbiter generate scaffolds language matrix (ts, go, python, rust)",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "arbiter-lang-matrix-"));
      tempRoots.push(tempRoot);

      const projectDir = path.join(tempRoot, "workspace");
      await mkdir(projectDir, { recursive: true });

      await runCli(
        ["--local", "add", "service", "web", "--language", "typescript", "--port", "3000"],
        projectDir,
      );
      await runCli(
        ["--local", "add", "service", "go-api", "--language", "go", "--port", "4000"],
        projectDir,
      );
      await runCli(
        ["--local", "add", "service", "py-api", "--language", "python", "--port", "5000"],
        projectDir,
      );
      await runCli(
        ["--local", "add", "service", "rust-api", "--language", "rust", "--port", "6000"],
        projectDir,
      );

      await runCli(["--local", "generate", "--project-dir", ".", "--force"], projectDir);

      await expectPathExists(projectDir, "services", "web", "src", "routes", "index.ts");
      await expectPathExists(projectDir, "services", "go-api", "go.mod");
      await expectPathExists(projectDir, "services", "go-api", "main.go");
      await expectPathExists(projectDir, "services", "py-api", "pyproject.toml");
      await expectPathExists(projectDir, "services", "py-api", "app", "main.py");
      await expectPathExists(projectDir, "services", "rust-api", "Cargo.toml");
      await expectPathExists(projectDir, "services", "rust-api", "src", "main.rs");
    },
    { timeout: 60000 },
  );

  test(
    "arbiter generate downloads stored specs from server and produces artifacts",
    async () => {
      const specSource = await mkdtemp(path.join(tmpdir(), "arbiter-remote-spec-"));
      tempRoots.push(specSource);

      await scaffoldDemoProject(specSource);
      const assemblySource = await readFile(
        path.join(specSource, ".arbiter", "assembly.cue"),
        "utf-8",
      );
      const remoteAssembly = `// remote-e2e\n${assemblySource}`;

      const api = await createApiStub({
        storedSpecifications: [{ type: "assembly", content: remoteAssembly }],
        projectStructure: {
          servicesDirectory: "services",
          clientsDirectory: "clients",
          testsDirectory: "tests",
        },
      });

      const projectDir = await mkdtemp(path.join(tmpdir(), "arbiter-remote-gen-"));
      tempRoots.push(projectDir);
      await rm(path.join(projectDir, ".arbiter"), { recursive: true, force: true });

      try {
        await runCli(["generate", "--project-dir", ".", "--force"], projectDir, {
          env: {
            ARBITER_SKIP_REMOTE_SPEC: "0",
            ARBITER_API_URL: api.url,
          },
        });

        expect(api.specRequests.some((req) => req.type === "assembly")).toBe(true);

        const assemblyPath = path.join(projectDir, ".arbiter", "assembly.cue");
        const assemblyContent = await readFile(assemblyPath, "utf-8");
        expect(assemblyContent).toContain("remote-e2e");

        const testsRoot = path.join(projectDir, "tests");
        const remoteFlowTest = await findFileByName(testsRoot, "checkout.test.ts");
        expect(remoteFlowTest).not.toBeNull();
        if (remoteFlowTest) {
          await stat(remoteFlowTest);
        }
        const remoteRunE2E = await findFileByName(testsRoot, "run-e2e.mjs");
        expect(remoteRunE2E).not.toBeNull();
        if (remoteRunE2E) {
          await stat(remoteRunE2E);
        }
        const playwrightConfig = await findFileByName(testsRoot, "playwright.config.ts");
        expect(playwrightConfig).not.toBeNull();
        if (playwrightConfig) {
          await stat(playwrightConfig);
        }

        const clientsRoot = path.join(projectDir, "clients");
        const clientSlug = await firstDirectory(clientsRoot);
        await expectPathExists(clientsRoot, clientSlug, "src", "routes", "AppRoutes.tsx");

        await expectPathExists(projectDir, "docs", "api", "openapi.json");
        await expectPathExists(projectDir, "services", "web", "src", "routes", "index.ts");
        await expectPathExists(projectDir, "packages", "ui.json");
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

  // spec-import command removed
}
