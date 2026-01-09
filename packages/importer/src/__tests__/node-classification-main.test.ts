import { describe, expect, it } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs-extra";
import { NodeJSPlugin } from "../plugins/nodejs";
import { ScannerRunner } from "../scanner";

describe("node service classification respects main field", () => {
  it("treats package with server deps but no main as package", async () => {
    const projectDir = path.join(os.tmpdir(), `arbiter-node-main-${Date.now()}`);
    await fs.ensureDir(projectDir);

    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "api-types",
          version: "0.1.0",
          dependencies: { express: "^4.18.2" },
        },
        null,
        2,
      ),
    );

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new NodeJSPlugin()],
    });

    const manifest = await scanner.scan();
    const artifacts = manifest.artifacts.filter((a) => a.artifact.id === "api-types");
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifact.type).toBe("package");
  });

  it("treats package with docker context but no main as package (not service)", async () => {
    const projectDir = path.join(os.tmpdir(), `arbiter-node-main-docker-${Date.now()}`);
    await fs.ensureDir(projectDir);

    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "api-types",
          version: "0.1.0",
          dependencies: { express: "^4.18.2" },
        },
        null,
        2,
      ),
    );
    // Presence of Dockerfile triggers hasDocker context
    await fs.writeFile(path.join(projectDir, "Dockerfile"), "FROM node:20-alpine\n");

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new NodeJSPlugin(), new (await import("../plugins/docker")).DockerPlugin()],
    });

    const manifest = await scanner.scan();
    const artifacts = manifest.artifacts.filter((a) => a.artifact.id === "api-types");
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifact.type).toBe("package");
  });

  it("treats package with main and server deps and server script as service", async () => {
    const projectDir = path.join(os.tmpdir(), `arbiter-node-main-svc-${Date.now()}`);
    await fs.ensureDir(projectDir);

    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "api-service",
          version: "1.0.0",
          main: "dist/index.js",
          scripts: { start: "node dist/index.js" },
          dependencies: { express: "^4.18.2" },
        },
        null,
        2,
      ),
    );

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new NodeJSPlugin()],
    });

    const manifest = await scanner.scan();
    const artifacts = manifest.artifacts.filter((a) => a.artifact.id === "api-service");
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifact.type).toBe("service");
  });

  it("treats package with main and server deps but no server script as package", async () => {
    const projectDir = path.join(os.tmpdir(), `arbiter-node-main-svc-noscript-${Date.now()}`);
    await fs.ensureDir(projectDir);

    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "api-service-no-script",
          version: "1.0.0",
          main: "dist/index.js",
          dependencies: { express: "^4.18.2" },
          scripts: {},
        },
        null,
        2,
      ),
    );

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new NodeJSPlugin()],
    });

    const manifest = await scanner.scan();
    const artifacts = manifest.artifacts.filter((a) => a.artifact.id === "api-service-no-script");
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifact.type).toBe("package");
  });
});
