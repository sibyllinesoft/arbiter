import { afterAll, describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { ProjectStructureConfig } from "../../../types.js";
import { generateDockerComposeArtifacts } from "../generate/compose.js";

const tmpDirs: string[] = [];

afterAll(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe("generateDockerComposeArtifacts", () => {
  it("emits docker-compose assets for internal + external services", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-compose-"));
    tmpDirs.push(root);

    const structure: ProjectStructureConfig = {
      clientsDirectory: "apps",
      servicesDirectory: "services",
      modulesDirectory: "modules",
      toolsDirectory: "tools",
      docsDirectory: "docs",
      testsDirectory: "tests",
      infraDirectory: "infra",
    };

    const assemblyConfig = {
      _fullCueData: {
        services: {
          api: {
            language: "typescript",
            type: "deployment",
            sourceDirectory: "services/api",
            ports: [{ name: "http", port: 3000 }],
            env: {
              NODE_ENV: "development",
            },
          },
          cache: {
            image: "redis:7",
            type: "statefulset",
            ports: [{ name: "tcp", port: 6379 }],
          },
        },
        deployment: {
          target: "compose",
          compose: {
            networks: {
              default: { driver: "bridge" },
            },
            environment: {
              NODE_ENV: "development",
            },
          },
        },
      },
    };

    const files = await generateDockerComposeArtifacts(
      { name: "demo-app", language: "typescript" },
      root,
      assemblyConfig,
      { dryRun: false },
      structure,
    );

    expect(files).toEqual(
      expect.arrayContaining([
        "infra/compose/docker-compose.yml",
        "infra/compose/.env.template",
        "infra/compose/README.md",
      ]),
    );

    const composePath = path.join(root, "infra/compose/docker-compose.yml");
    const composeContents = await fs.readFile(composePath, "utf-8");
    expect(composeContents).toContain("api:");
    expect(composeContents).toContain("cache:");

    const envTemplate = await fs.readFile(path.join(root, "infra/compose/.env.template"), "utf-8");
    expect(envTemplate).toContain("COMPOSE_PROJECT_NAME=demo-app");
    expect(envTemplate).toContain("# Port Overrides (host binding)");
    expect(envTemplate).toContain("API_PORT=3000");
    expect(envTemplate).toContain("# Global Compose environment\nNODE_ENV=development");
    expect(envTemplate).toContain("# api Service\nNODE_ENV=development");

    const readme = await fs.readFile(path.join(root, "infra/compose/README.md"), "utf-8");
    expect(readme).toContain("docker compose up");
  });
});
