import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs-extra";
import { DockerPlugin } from "../plugins/docker";
import { NodeJSPlugin } from "../plugins/nodejs";
import { ScannerRunner } from "../scanner";

describe("scanner docker metadata integration", () => {
  const tempDir = path.join(os.tmpdir(), `arbiter-importer-${Date.now()}`);
  const dockerfileContent = `FROM node:20-alpine\nWORKDIR /app\nCOPY package.json ./\nRUN npm install\nCOPY . .\nCMD [\"bun\", \"run\", \"start\"]\n`;

  beforeAll(async () => {
    await fs.ensureDir(tempDir);

    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "test-service",
          version: "0.1.0",
          description: "Example service",
          main: "src/index.js",
          scripts: {
            start: "node src/index.js",
          },
          dependencies: {
            express: "^4.18.2",
          },
        },
        null,
        2,
      ),
    );

    await fs.ensureDir(path.join(tempDir, "src"));
    await fs.writeFile(
      path.join(tempDir, "src", "index.js"),
      "const express = require('express');\nconst app = express();\napp.get('/', (_req, res) => res.send('ok'));\napp.listen(3000);\n",
    );

    await fs.writeFile(path.join(tempDir, "Dockerfile"), dockerfileContent);

    const compose = `version: '3.9'\nservices:\n  test-service:\n    build:\n      context: .\n      dockerfile: Dockerfile\n    image: test-service:latest\n    ports:\n      - \\"3000:3000\\"\n`;
    await fs.writeFile(path.join(tempDir, "docker-compose.yml"), compose);
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  it("creates separate package and infrastructure artifacts with appropriate metadata", async () => {
    const scanner = new ScannerRunner({
      projectRoot: tempDir,
      plugins: [new DockerPlugin(), new NodeJSPlugin()],
    });

    const manifest = await scanner.scan();

    // NodeJSPlugin creates a package artifact
    const packageArtifact = manifest.artifacts.find(
      (artifact) => artifact.artifact.id === "test-service" && artifact.artifact.type === "package",
    );
    expect(packageArtifact).toBeDefined();
    const packageMetadata = packageArtifact!.artifact.metadata as Record<string, unknown>;
    expect(packageMetadata.language).toBe("javascript");
    expect(packageMetadata.framework).toBe("express");

    // DockerPlugin creates infrastructure artifacts for compose services
    const infraArtifacts = manifest.artifacts.filter(
      (artifact) => artifact.artifact.type === "infrastructure",
    );
    // Should have 2: one for Dockerfile, one for compose service
    expect(infraArtifacts.length).toBeGreaterThanOrEqual(1);

    // Find the compose service infrastructure artifact
    const composeInfra = infraArtifacts.find((a) => a.artifact.name === "test-service");
    expect(composeInfra).toBeDefined();
    const dockerMetadata = composeInfra!.artifact.metadata as Record<string, unknown>;
    expect(dockerMetadata.configType).toBe("docker-compose");
    expect(dockerMetadata.image).toBe("test-service:latest");
    expect(dockerMetadata.buildContext).toBe(".");
  });
});
