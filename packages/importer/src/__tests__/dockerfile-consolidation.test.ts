import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs-extra";
import { DockerPlugin } from "../plugins/docker";
import { GoPlugin } from "../plugins/go";
import { NodeJSPlugin } from "../plugins/nodejs";
import { PythonPlugin } from "../plugins/python";
import { RustPlugin } from "../plugins/rust";
import { ScannerRunner } from "../scanner";

describe("dockerfile naming and consolidation", () => {
  const tempDir = path.join(os.tmpdir(), `arbiter-dockerfile-consolidation-${Date.now()}`);

  beforeAll(async () => {
    await fs.ensureDir(tempDir);
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  it("names service from package.json when Dockerfile is present", async () => {
    const projectDir = path.join(tempDir, "project-with-package");
    await fs.ensureDir(projectDir);

    // Create package.json with service name
    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "@myorg/mattermost-proxy",
          version: "1.0.0",
          description: "Mattermost steering proxy service",
          main: "dist/index.js",
          scripts: {
            start: "node server.js",
          },
          dependencies: {
            express: "^4.18.2",
          },
        },
        null,
        2,
      ),
    );

    // Create Dockerfile
    await fs.writeFile(
      path.join(projectDir, "Dockerfile"),
      `FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
CMD ["node", "server.js"]
`,
    );

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new DockerPlugin(), new NodeJSPlugin()],
    });

    const manifest = await scanner.scan();

    // Should have only one service artifact (consolidated)
    const serviceArtifacts = manifest.artifacts.filter((a) => a.artifact.type === "service");
    expect(serviceArtifacts).toHaveLength(1);

    const service = serviceArtifacts[0];
    // Should use the package name, not "dockerfile-container" or directory name
    expect(service.artifact.name).toBe("mattermost-proxy");

    // Should have metadata from both sources
    const metadata = service.artifact.metadata as Record<string, unknown>;
    expect(metadata.language).toBe("javascript");
    // Should only include package-based plugin in provenance
    const plugins = service.provenance?.plugins || [];
    expect(plugins).toContain("nodejs");
    expect(plugins).not.toContain("docker");
  });

  it("names service from go.mod when Dockerfile is present", async () => {
    const projectDir = path.join(tempDir, "project-with-gomod");
    await fs.ensureDir(projectDir);

    // Create go.mod
    await fs.writeFile(
      path.join(projectDir, "go.mod"),
      `module github.com/myorg/go-service

go 1.21

require (
  github.com/gin-gonic/gin v1.9.0
)
`,
    );

    // Create Dockerfile
    await fs.writeFile(
      path.join(projectDir, "Dockerfile"),
      `FROM golang:1.21-alpine
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o main .
CMD ["./main"]
`,
    );

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new DockerPlugin(), new GoPlugin()],
    });

    const manifest = await scanner.scan();

    // Find the docker service artifact
    const services = manifest.artifacts.filter((a) => a.artifact.type === "service");
    expect(services.length).toBe(1);

    const service = services[0];
    // Should extract name from go.mod
    expect(service.artifact.name).toBe("go-service");
    expect(service.provenance?.plugins).toContain("go");
    expect(service.provenance?.plugins).not.toContain("docker");
  });

  it("names service from Cargo.toml when Dockerfile is present", async () => {
    const projectDir = path.join(tempDir, "project-with-cargo");
    await fs.ensureDir(projectDir);

    // Create Cargo.toml
    await fs.writeFile(
      path.join(projectDir, "Cargo.toml"),
      `[package]
name = "rust-api"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4.0"
`,
    );

    // Create Dockerfile
    await fs.writeFile(
      path.join(projectDir, "Dockerfile"),
      `FROM rust:1.70-alpine
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN cargo fetch
COPY . .
RUN cargo build --release
CMD ["./target/release/rust-api"]
`,
    );

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new DockerPlugin(), new RustPlugin()],
    });

    const manifest = await scanner.scan();

    const services = manifest.artifacts.filter((a) => a.artifact.type === "service");
    expect(services.length).toBe(1);

    const service = services[0];
    // Should extract name from Cargo.toml
    expect(service.artifact.name).toBe("rust-api");
    expect(service.provenance?.plugins).toContain("rust");
    expect(service.provenance?.plugins).not.toContain("docker");
  });

  it("names service from pyproject.toml when Dockerfile is present", async () => {
    const projectDir = path.join(tempDir, "project-with-pyproject");
    await fs.ensureDir(projectDir);

    // Create pyproject.toml
    await fs.writeFile(
      path.join(projectDir, "pyproject.toml"),
      `[project]
name = "python-service"
version = "1.0.0"
description = "Python web service"
dependencies = ["fastapi>=0.100.0"]
`,
    );

    // Create Dockerfile
    await fs.writeFile(
      path.join(projectDir, "Dockerfile"),
      `FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install .
COPY . .
CMD ["python", "main.py"]
`,
    );

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new DockerPlugin(), new PythonPlugin()],
    });

    const manifest = await scanner.scan();

    const services = manifest.artifacts.filter((a) => a.artifact.type === "service");
    expect(services.length).toBe(1);

    const service = services[0];
    // Should extract name from pyproject.toml
    expect(service.artifact.name).toBe("python-service");
    expect(service.provenance?.plugins).toContain("python");
    expect(service.provenance?.plugins).not.toContain("docker");
  });

  it("falls back to directory name when no package file exists", async () => {
    const projectDir = path.join(tempDir, "project-no-package");
    await fs.ensureDir(projectDir);

    // Compose service with only image (no package files or dockerfile build)
    const compose = `version: '3.9'
services:
  nginx-proxy:
    image: nginx:alpine
    ports:
      - "8080:80"
`;
    await fs.writeFile(path.join(projectDir, "docker-compose.yml"), compose);

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new DockerPlugin()],
    });

    const manifest = await scanner.scan();

    const services = manifest.artifacts.filter((a) => a.artifact.type === "service");
    expect(services.length).toBe(1);

    const service = services[0];
    expect(service.artifact.name).toBe("nginx-proxy");
    expect(service.artifact.tags).toContain("external");
    const metadata = service.artifact.metadata as Record<string, unknown>;
    expect(metadata.external).toBe(true);
    expect(metadata.composeOnly).toBe(true);
    expect(metadata.docker).toBeDefined();
  });

  it("does not emit compose external when package exists without main", async () => {
    const projectDir = path.join(tempDir, "project-compose-package-no-main");
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

    const compose = `version: '3.9'
services:
  api-types:
    image: node:20-alpine
    command: ["node", "index.js"]
`;
    await fs.writeFile(path.join(projectDir, "docker-compose.yml"), compose);

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new DockerPlugin(), new NodeJSPlugin()],
    });

    const manifest = await scanner.scan();

    const services = manifest.artifacts.filter((a) => a.artifact.type === "service");
    expect(services.length).toBe(0);

    const packages = manifest.artifacts.filter((a) => a.artifact.type === "package");
    expect(packages.length).toBe(1);
    expect(packages[0].artifact.name).toBe("api-types");
  });

  it("handles scoped npm package names correctly", async () => {
    const projectDir = path.join(tempDir, "project-scoped");
    await fs.ensureDir(projectDir);

    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "@mycompany/super-service",
          version: "1.0.0",
          main: "dist/index.js",
          scripts: { start: "node dist/index.js" },
          dependencies: { express: "^4.18.2" },
        },
        null,
        2,
      ),
    );

    await fs.writeFile(
      path.join(projectDir, "Dockerfile"),
      `FROM node:20-alpine
CMD ["node", "index.js"]
`,
    );

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new NodeJSPlugin()],
    });

    const manifest = await scanner.scan();

    const serviceArtifacts = manifest.artifacts.filter((a) => a.artifact.type === "service");
    expect(serviceArtifacts).toHaveLength(1);

    const service = serviceArtifacts[0];
    // Should strip @mycompany/ prefix
    expect(service.artifact.name).toBe("super-service");
    expect(service.provenance?.plugins).toContain("nodejs");
    expect(service.provenance?.plugins).not.toContain("docker");
  });

  it("skips compose-only external when a package service with main exists", async () => {
    const projectDir = path.join(tempDir, "project-compose-and-package");
    await fs.ensureDir(projectDir);

    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: "compose-app",
          version: "1.0.0",
          main: "dist/index.js",
          scripts: { start: "node dist/index.js" },
          dependencies: { express: "^4.18.2" },
        },
        null,
        2,
      ),
    );

    const compose = `version: '3.9'
services:
  compose-app:
    build:
      context: .
    ports:
      - "8080:8080"
`;
    await fs.writeFile(path.join(projectDir, "docker-compose.yml"), compose);

    const scanner = new ScannerRunner({
      projectRoot: projectDir,
      plugins: [new DockerPlugin(), new NodeJSPlugin()],
    });

    const manifest = await scanner.scan();

    const services = manifest.artifacts.filter((a) => a.artifact.type === "service");
    expect(services.length).toBe(1);
    expect(services[0].artifact.name).toBe("compose-app");
    expect(services[0].provenance?.plugins).toContain("nodejs");
    expect(services[0].provenance?.plugins).not.toContain("docker");
  });
});
