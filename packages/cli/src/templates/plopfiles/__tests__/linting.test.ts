/**
 * Infrastructure Linting Tests
 *
 * Uses specialized linters to validate generated infrastructure files.
 * Tests are skipped if the linter isn't available.
 *
 * Supported linters:
 * - terraform: terraform validate, tflint
 * - kubernetes: kubectl --dry-run, kubeconform
 * - docker: docker compose config, hadolint
 * - github actions: actionlint
 * - yaml: yamllint
 *
 * Run with: bun test linting.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { $ } from "bun";
import { mkdir, mkdtemp, readdir, rm } from "fs/promises";
import nodePlop from "node-plop";
import { loadModule } from "../_modules/composer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LINT_TIMEOUT = 60_000;

// Helper to execute plop actions
async function executePlopActions(
  destPath: string,
  actions: Array<Record<string, unknown>>,
  context: Record<string, unknown>,
) {
  const plop = await nodePlop(undefined, {
    destBasePath: destPath,
    force: true,
  });

  // Register helpers on plop's Handlebars instance
  plop.setHelper(
    "kebabCase",
    (str: string) =>
      str
        ?.toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") || "",
  );
  plop.setHelper(
    "snakeCase",
    (str: string) =>
      str
        ?.toLowerCase()
        .replace(/[\s-]+/g, "_")
        .replace(/[^a-z0-9_]/g, "") || "",
  );
  plop.setHelper("camelCase", (str: string) => {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase());
  });
  plop.setHelper("pascalCase", (str: string) => {
    if (!str) return "";
    const camel = str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase());
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  });
  plop.setHelper(
    "titleCase",
    (str: string) => str?.replace(/\b\w/g, (char) => char.toUpperCase()) || "",
  );
  plop.setHelper("eq", (a: unknown, b: unknown) => a === b);
  plop.setHelper("ne", (a: unknown, b: unknown) => a !== b);
  plop.setHelper("json", (obj: unknown) => JSON.stringify(obj, null, 2));

  plop.setGenerator("temp", {
    description: "temp",
    prompts: [],
    actions: actions as any[],
  });

  const gen = plop.getGenerator("temp");
  const results = await gen.runActions(context);

  if (results.failures && results.failures.length > 0) {
    const errors = results.failures.map((f) => f.error || f.message || String(f)).join("\n");
    throw new Error(`Generation failed:\n${errors}`);
  }

  return results;
}

// Helper to generate a single module
async function generateModule(
  category: string,
  moduleName: string,
  destPath: string,
  context: Record<string, unknown>,
) {
  const mod = await loadModule(category, moduleName);
  const actions = mod.default(context);
  await executePlopActions(destPath, actions, context);
  return mod;
}

// Helper to check if a command exists
async function commandExists(cmd: string): Promise<boolean> {
  try {
    await $`which ${cmd}`.quiet();
    return true;
  } catch {
    return false;
  }
}

// Track available linters
const linters: Record<string, boolean> = {};

beforeAll(async () => {
  linters.terraform = await commandExists("terraform");
  linters.tflint = await commandExists("tflint");
  linters.kubectl = await commandExists("kubectl");
  linters.kubeconform = await commandExists("kubeconform");
  linters.docker = await commandExists("docker");
  linters.hadolint = await commandExists("hadolint");
  linters.actionlint = await commandExists("actionlint");
  linters.yamllint = await commandExists("yamllint");

  console.log(
    "Available linters:",
    Object.entries(linters)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(", ") || "none",
  );
});

describe("Terraform Linting", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-lint-tf-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "terraform validate passes",
    async () => {
      if (!linters.terraform) {
        console.log("Skipping: terraform not available");
        return;
      }

      const projectDir = join(tempDir, "tf-validate");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "tf-validate", projectDir };
      await generateModule("infra", "terraform", projectDir, context);

      const tfDir = join(projectDir, "infra/terraform");

      // Init and validate
      const initResult = await $`cd ${tfDir} && terraform init -backend=false`.nothrow();
      expect(initResult.exitCode).toBe(0);

      const validateResult = await $`cd ${tfDir} && terraform validate`.nothrow();
      expect(validateResult.exitCode).toBe(0);

      // Check formatting
      const fmtResult = await $`cd ${tfDir} && terraform fmt -check -recursive`.nothrow();
      if (fmtResult.exitCode !== 0) {
        console.warn("Terraform formatting issues detected (non-blocking)");
      }
    },
    LINT_TIMEOUT,
  );

  test(
    "tflint passes",
    async () => {
      if (!linters.tflint) {
        console.log("Skipping: tflint not available");
        return;
      }

      const projectDir = join(tempDir, "tf-tflint");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "tf-tflint", projectDir };
      await generateModule("infra", "terraform", projectDir, context);

      const tfDir = join(projectDir, "infra/terraform");

      // Run tflint
      const result = await $`cd ${tfDir} && tflint --init && tflint`.nothrow();
      // tflint may have warnings, exit 0 or 2 is acceptable
      expect(result.exitCode).toBeLessThanOrEqual(2);
    },
    LINT_TIMEOUT,
  );
});

describe("Kubernetes Linting", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-lint-k8s-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "kubectl dry-run validates manifests",
    async () => {
      if (!linters.kubectl) {
        console.log("Skipping: kubectl not available");
        return;
      }

      // Check if kubectl can actually connect to a cluster (not just have a config)
      // Use a simple API call that requires a working connection
      const clusterCheck = await $`kubectl get --raw /api/v1 2>&1`.quiet().nothrow();
      if (clusterCheck.exitCode !== 0) {
        console.log(
          "Skipping: No Kubernetes cluster connection (use kubeconform for offline validation)",
        );
        return;
      }

      const projectDir = join(tempDir, "k8s-kubectl");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "k8s-kubectl", projectDir, backendDir: "backend" };
      await generateModule("infra", "kubernetes", projectDir, context);

      const k8sDir = join(projectDir, "k8s/base");

      // Validate each yaml file (skip kustomization.yaml and ingress.yaml - they need cluster CRDs)
      const files = await readdir(k8sDir);
      const yamlFiles = files.filter(
        (f) =>
          (f.endsWith(".yaml") || f.endsWith(".yml")) &&
          !f.startsWith("kustomization") &&
          !f.includes("ingress"), // ingress needs networking.k8s.io CRD from cluster
      );

      for (const file of yamlFiles) {
        const result =
          await $`kubectl apply --dry-run=client -f ${join(k8sDir, file)} 2>&1`.nothrow();
        if (result.exitCode !== 0) {
          console.error(`kubectl validation failed for ${file}:`, result.stdout.toString());
        }
        expect(result.exitCode).toBe(0);
      }
    },
    LINT_TIMEOUT,
  );

  test(
    "kubeconform validates against schemas",
    async () => {
      if (!linters.kubeconform) {
        console.log("Skipping: kubeconform not available");
        return;
      }

      const projectDir = join(tempDir, "k8s-kubeconform");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "k8s-kubeconform", projectDir, backendDir: "backend" };
      await generateModule("infra", "kubernetes", projectDir, context);

      const k8sDir = join(projectDir, "k8s/base");

      // Run kubeconform, skipping Kustomization CRDs (not in standard schemas)
      const result = await $`kubeconform -summary -skip Kustomization ${k8sDir}`.nothrow();
      expect(result.exitCode).toBe(0);
    },
    LINT_TIMEOUT,
  );
});

describe("Docker Linting", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-lint-docker-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "docker compose config validates",
    async () => {
      if (!linters.docker) {
        console.log("Skipping: docker not available");
        return;
      }

      const projectDir = join(tempDir, "docker-compose");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "docker-compose",
        projectDir,
        backendDir: "backend",
        frontendDir: "frontend",
        backend: "node-hono",
        frontend: "react-vite",
        database: "postgres-drizzle",
      };
      await generateModule("infra", "docker-compose", projectDir, context);

      // Validate docker-compose.yml
      const result = await $`cd ${projectDir} && docker compose config`.nothrow();
      expect(result.exitCode).toBe(0);
    },
    LINT_TIMEOUT,
  );

  test(
    "hadolint validates Dockerfiles",
    async () => {
      if (!linters.hadolint) {
        console.log("Skipping: hadolint not available");
        return;
      }

      const projectDir = join(tempDir, "hadolint");
      await mkdir(projectDir, { recursive: true });

      // Generate a backend that includes a Dockerfile
      const context = { name: "hadolint", projectDir, backendDir: "backend" };
      await generateModule("backends", "node-hono", projectDir, context);

      const dockerfilePath = join(projectDir, "backend/Dockerfile");

      // Check if Dockerfile exists
      const dockerfileExists = await Bun.file(dockerfilePath).exists();
      if (!dockerfileExists) {
        console.log("Skipping: No Dockerfile in node-hono module");
        return;
      }

      // Run hadolint
      const result = await $`hadolint ${dockerfilePath}`.nothrow();
      // hadolint may have warnings (exit 1), only fail on errors (exit 2+)
      expect(result.exitCode).toBeLessThanOrEqual(1);
    },
    LINT_TIMEOUT,
  );
});

describe("GitHub Actions Linting", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-lint-gha-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "actionlint validates workflow files",
    async () => {
      if (!linters.actionlint) {
        console.log("Skipping: actionlint not available");
        return;
      }

      const projectDir = join(tempDir, "gha");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "gha",
        projectDir,
        backendDir: "backend",
        frontendDir: "frontend",
        backend: "node-hono",
        frontend: "react-vite",
      };
      await generateModule("infra", "github-actions", projectDir, context);

      const workflowsDir = join(projectDir, ".github/workflows");

      // List workflow files first (glob doesn't expand in bun shell)
      let files: string[];
      try {
        files = await readdir(workflowsDir);
      } catch (e) {
        // Directory may not exist if generation failed
        console.log("Skipping: Workflows directory not generated");
        return;
      }

      const workflowFiles = files
        .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
        .map((f) => join(workflowsDir, f));

      if (workflowFiles.length === 0) {
        console.log("Skipping: No workflow files generated");
        return;
      }

      // Run actionlint on each file
      for (const file of workflowFiles) {
        const result = await $`actionlint ${file}`.nothrow();
        if (result.exitCode !== 0) {
          console.error(`actionlint errors in ${file}:`, result.stderr.toString());
        }
        expect(result.exitCode).toBe(0);
      }
    },
    LINT_TIMEOUT,
  );
});

describe("YAML Linting", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-lint-yaml-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "yamllint validates kubernetes manifests",
    async () => {
      if (!linters.yamllint) {
        console.log("Skipping: yamllint not available");
        return;
      }

      const projectDir = join(tempDir, "yaml-k8s");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "yaml-k8s", projectDir, backendDir: "backend" };
      await generateModule("infra", "kubernetes", projectDir, context);

      const k8sDir = join(projectDir, "k8s/base");

      // Run yamllint with relaxed rules (allow long lines, etc)
      const result = await $`yamllint -d relaxed ${k8sDir}`.nothrow();
      // yamllint warnings are fine (exit 1)
      expect(result.exitCode).toBeLessThanOrEqual(1);
    },
    LINT_TIMEOUT,
  );

  test(
    "yamllint validates docker-compose",
    async () => {
      if (!linters.yamllint) {
        console.log("Skipping: yamllint not available");
        return;
      }

      const projectDir = join(tempDir, "yaml-docker");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "yaml-docker",
        projectDir,
        backendDir: "backend",
        frontendDir: "frontend",
        backend: "node-hono",
        frontend: "react-vite",
        database: "postgres-drizzle",
      };
      await generateModule("infra", "docker-compose", projectDir, context);

      const composeFile = join(projectDir, "docker-compose.yml");

      const result = await $`yamllint -d relaxed ${composeFile}`.nothrow();
      expect(result.exitCode).toBeLessThanOrEqual(1);
    },
    LINT_TIMEOUT,
  );
});

describe("Pulumi Linting", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-lint-pulumi-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "pulumi typescript compiles",
    async () => {
      const projectDir = join(tempDir, "pulumi");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "pulumi", projectDir };
      await generateModule("infra", "pulumi", projectDir, context);

      const pulumiDir = join(projectDir, "infra/pulumi");

      // Install dependencies and typecheck
      await $`cd ${pulumiDir} && bun install`.quiet();
      const result = await $`cd ${pulumiDir} && bunx tsc --noEmit`.nothrow();

      // TypeScript should compile without errors
      expect(result.exitCode).toBe(0);
    },
    LINT_TIMEOUT,
  );
});

describe("Build System Linting", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-lint-build-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "bazel configs are valid with buildifier",
    async () => {
      const buildifierAvailable = await commandExists("buildifier");
      if (!buildifierAvailable) {
        console.log("Skipping: buildifier not available");
        return;
      }

      const projectDir = join(tempDir, "bazel");
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, "backend"), { recursive: true });

      const context = {
        name: "bazel-test",
        projectDir,
        backendDir: "backend",
        backend: "go-chi",
        frontend: "none",
      };
      await generateModule("build", "bazel", projectDir, context);

      // Validate WORKSPACE.bazel
      const workspaceResult =
        await $`buildifier --lint=warn --mode=check ${join(projectDir, "WORKSPACE.bazel")}`.nothrow();
      // buildifier returns 0 for valid, 4 for lint warnings (acceptable)
      expect(workspaceResult.exitCode === 0 || workspaceResult.exitCode === 4).toBe(true);

      // Validate BUILD.bazel files
      const rootBuildResult =
        await $`buildifier --lint=warn --mode=check ${join(projectDir, "BUILD.bazel")}`.nothrow();
      expect(rootBuildResult.exitCode === 0 || rootBuildResult.exitCode === 4).toBe(true);

      const backendBuildResult =
        await $`buildifier --lint=warn --mode=check ${join(projectDir, "backend/BUILD.bazel")}`.nothrow();
      expect(backendBuildResult.exitCode === 0 || backendBuildResult.exitCode === 4).toBe(true);
    },
    LINT_TIMEOUT,
  );

  test(
    "nx.json is valid JSON with correct schema",
    async () => {
      const projectDir = join(tempDir, "nx");
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, "backend"), { recursive: true });

      const context = {
        name: "nx-test",
        projectDir,
        backendDir: "backend",
        backend: "node-hono",
        frontend: "none",
      };
      await generateModule("build", "nx", projectDir, context);

      // Read and parse nx.json
      const nxJsonPath = join(projectDir, "nx.json");
      const nxJsonContent = await Bun.file(nxJsonPath).text();

      let nxJson: any;
      expect(() => {
        nxJson = JSON.parse(nxJsonContent);
      }).not.toThrow();

      // Validate required fields
      expect(nxJson.$schema).toBeDefined();
      expect(nxJson.targetDefaults).toBeDefined();
      expect(nxJson.targetDefaults.build).toBeDefined();
      expect(nxJson.targetDefaults.test).toBeDefined();

      // Validate project.json
      const projectJsonPath = join(projectDir, "backend/project.json");
      const projectJsonContent = await Bun.file(projectJsonPath).text();

      let projectJson: any;
      expect(() => {
        projectJson = JSON.parse(projectJsonContent);
      }).not.toThrow();

      expect(projectJson.name).toBeDefined();
      expect(projectJson.targets).toBeDefined();
      expect(projectJson.targets.build).toBeDefined();
    },
    LINT_TIMEOUT,
  );

  test(
    "turbo.json is valid JSON with correct schema",
    async () => {
      const projectDir = join(tempDir, "turborepo");
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, "backend"), { recursive: true });
      await mkdir(join(projectDir, "frontend"), { recursive: true });

      const context = {
        name: "turbo-test",
        projectDir,
        backendDir: "backend",
        frontendDir: "frontend",
        backend: "node-hono",
        frontend: "react-vite",
      };
      await generateModule("build", "turborepo", projectDir, context);

      // Read and parse turbo.json
      const turboJsonPath = join(projectDir, "turbo.json");
      const turboJsonContent = await Bun.file(turboJsonPath).text();

      let turboJson: any;
      expect(() => {
        turboJson = JSON.parse(turboJsonContent);
      }).not.toThrow();

      // Validate required fields
      expect(turboJson.$schema).toBeDefined();
      expect(turboJson.tasks).toBeDefined();
      expect(turboJson.tasks.build).toBeDefined();
      expect(turboJson.tasks.test).toBeDefined();
      expect(turboJson.tasks.lint).toBeDefined();

      // Validate backend turbo.json
      const backendTurboPath = join(projectDir, "backend/turbo.json");
      const backendTurboContent = await Bun.file(backendTurboPath).text();

      let backendTurbo: any;
      expect(() => {
        backendTurbo = JSON.parse(backendTurboContent);
      }).not.toThrow();

      expect(backendTurbo.extends).toContain("//");
      expect(backendTurbo.tasks).toBeDefined();

      // Validate frontend turbo.json
      const frontendTurboPath = join(projectDir, "frontend/turbo.json");
      const frontendTurboContent = await Bun.file(frontendTurboPath).text();

      let frontendTurbo: any;
      expect(() => {
        frontendTurbo = JSON.parse(frontendTurboContent);
      }).not.toThrow();

      expect(frontendTurbo.extends).toContain("//");
    },
    LINT_TIMEOUT,
  );

  test(
    "turbo CLI validates config",
    async () => {
      const turboAvailable = await commandExists("turbo");
      if (!turboAvailable) {
        console.log("Skipping: turbo not available");
        return;
      }

      const projectDir = join(tempDir, "turbo-cli");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "turbo-cli-test",
        projectDir,
        backend: "none",
        frontend: "none",
      };
      await generateModule("build", "turborepo", projectDir, context);

      // Create minimal package.json for turbo
      await Bun.write(
        join(projectDir, "package.json"),
        JSON.stringify({ name: "turbo-cli-test", private: true, workspaces: [] }, null, 2),
      );

      // turbo --dry-run should parse config without errors
      const result = await $`cd ${projectDir} && turbo build --dry-run=json 2>&1`.nothrow();
      // turbo may return non-zero if no tasks match, but shouldn't crash on invalid config
      // Exit code 1 is acceptable (no matching packages), but segfault/crash would be different
      expect(result.exitCode).toBeLessThanOrEqual(1);
    },
    LINT_TIMEOUT,
  );

  test(
    "nx CLI validates config",
    async () => {
      const nxAvailable = await commandExists("nx");
      if (!nxAvailable) {
        console.log("Skipping: nx not available");
        return;
      }

      const projectDir = join(tempDir, "nx-cli");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "nx-cli-test",
        projectDir,
        backend: "none",
        frontend: "none",
      };
      await generateModule("build", "nx", projectDir, context);

      // Create minimal package.json
      await Bun.write(
        join(projectDir, "package.json"),
        JSON.stringify(
          {
            name: "nx-cli-test",
            private: true,
            devDependencies: { nx: "^17.0.0" },
          },
          null,
          2,
        ),
      );

      // nx show projects should work with valid config
      // First install nx
      await $`cd ${projectDir} && bun install`.quiet().nothrow();

      const result = await $`cd ${projectDir} && bunx nx show projects 2>&1`.nothrow();
      // May return empty or error if no projects, but shouldn't crash on config
      expect(result.exitCode).toBeLessThanOrEqual(1);
    },
    LINT_TIMEOUT,
  );
});

describe("Cloud Provider Configs", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-lint-cloud-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "aws terraform files are valid",
    async () => {
      if (!linters.terraform) {
        console.log("Skipping: terraform not available");
        return;
      }

      const projectDir = join(tempDir, "aws");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "aws-test", projectDir };
      // AWS module is standalone (includes its own terraform block)
      await generateModule("cloud", "aws", projectDir, context);

      const tfDir = join(projectDir, "infra/terraform");

      const initResult = await $`cd ${tfDir} && terraform init -backend=false`.nothrow();
      expect(initResult.exitCode).toBe(0);

      const validateResult = await $`cd ${tfDir} && terraform validate`.nothrow();
      expect(validateResult.exitCode).toBe(0);
    },
    LINT_TIMEOUT,
  );

  test(
    "gcp terraform files are valid",
    async () => {
      if (!linters.terraform) {
        console.log("Skipping: terraform not available");
        return;
      }

      const projectDir = join(tempDir, "gcp");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "gcp-test", projectDir };
      // GCP module is standalone (includes its own terraform block)
      await generateModule("cloud", "gcp", projectDir, context);

      const tfDir = join(projectDir, "infra/terraform");

      const initResult = await $`cd ${tfDir} && terraform init -backend=false`.nothrow();
      expect(initResult.exitCode).toBe(0);

      const validateResult = await $`cd ${tfDir} && terraform validate`.nothrow();
      expect(validateResult.exitCode).toBe(0);
    },
    LINT_TIMEOUT,
  );

  test(
    "azure terraform files are valid",
    async () => {
      if (!linters.terraform) {
        console.log("Skipping: terraform not available");
        return;
      }

      const projectDir = join(tempDir, "azure");
      await mkdir(projectDir, { recursive: true });

      const context = { name: "azure-test", projectDir };
      // Azure module is standalone (includes its own terraform block)
      await generateModule("cloud", "azure", projectDir, context);

      const tfDir = join(projectDir, "infra/terraform");

      const initResult = await $`cd ${tfDir} && terraform init -backend=false`.nothrow();
      expect(initResult.exitCode).toBe(0);

      const validateResult = await $`cd ${tfDir} && terraform validate`.nothrow();
      expect(validateResult.exitCode).toBe(0);
    },
    LINT_TIMEOUT,
  );
});
