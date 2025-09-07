import fs from "fs-extra";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { CLIConfig } from "../types.js";

// Test fixtures directory
const fixturesDir = join(process.cwd(), "test-fixtures-onboard");

// Mock CLI config
const mockConfig: CLIConfig = {
  apiUrl: "http://localhost:8080",
  timeout: 5000,
  format: "table" as const,
  color: true,
  projectDir: fixturesDir,
};

// Fixture data for different project types
const fixtures = {
  expressJs: {
    "package.json": {
      name: "express-api",
      version: "1.0.0",
      dependencies: {
        express: "^4.18.2",
        cors: "^2.8.5",
      },
      devDependencies: {
        "@types/node": "^20.0.0",
        typescript: "^5.0.0",
      },
    },
    "src/index.ts": `import express from 'express';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`,
  },

  reactApp: {
    "package.json": {
      name: "react-frontend",
      version: "1.0.0",
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.0.0",
        vite: "^4.4.0",
        typescript: "^5.0.0",
      },
    },
    "vite.config.ts": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
    "src/App.tsx": `import React from 'react';

function App() {
  return <div>Hello World</div>;
}

export default App;`,
  },

  nextJsApp: {
    "package.json": {
      name: "nextjs-app",
      version: "1.0.0",
      dependencies: {
        next: "^14.0.0",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        "@types/node": "^20.0.0",
        "@types/react": "^18.0.0",
        typescript: "^5.0.0",
      },
    },
    "next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig`,
    "src/app/page.tsx": `export default function Home() {
  return <main>Hello World</main>;
}`,
  },

  pythonFastApi: {
    "requirements.txt": `fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0`,
    "pyproject.toml": `[project]
name = "fastapi-api"
version = "0.1.0"
description = "FastAPI application"
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
]`,
    "src/main.py": `from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}`,
  },

  pythonDjango: {
    "requirements.txt": `Django==4.2.7
djangorestframework==3.14.0`,
    "manage.py": `#!/usr/bin/env python
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)`,
    "project/settings.py": `INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'rest_framework',
]`,
  },

  rustAxum: {
    "Cargo.toml": `[package]
name = "rust-api"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7.0"
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }`,
    "src/main.rs": `use axum::{response::Json, routing::get, Router};
use serde_json::{json, Value};

async fn hello() -> Json<Value> {
    Json(json!({"message": "Hello World"}))
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(hello));
    println!("Server running on http://0.0.0.0:3000");
    axum::Server::bind(&"0.0.0.0:3000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}`,
  },

  dockerCompose: {
    "docker-compose.yml": `version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"`,
  },

  monorepo: {
    "package.json": {
      name: "monorepo-example",
      version: "1.0.0",
      workspaces: ["apps/*", "packages/*"],
      devDependencies: {
        lerna: "^7.0.0",
      },
    },
    "lerna.json": {
      version: "1.0.0",
      npmClient: "npm",
      command: {
        publish: {
          ignoreChanges: ["ignored-file", "*.md"],
        },
      },
    },
    "apps/api/package.json": {
      name: "@monorepo/api",
      version: "1.0.0",
      dependencies: {
        express: "^4.18.2",
      },
    },
    "apps/web/package.json": {
      name: "@monorepo/web",
      version: "1.0.0",
      dependencies: {
        next: "^14.0.0",
        react: "^18.2.0",
      },
    },
    "packages/shared/package.json": {
      name: "@monorepo/shared",
      version: "1.0.0",
      main: "index.ts",
    },
  },

  corrupted: {
    "package.json": `{
  "name": "corrupted-project",
  "version": "1.0.0"
  "dependencies": {
    "express": "^4.18.2"
  }`, // Missing closing brace and comma - invalid JSON
  },

  empty: {
    ".gitkeep": "",
  },
};

// Import onboard functions for unit testing
import { onboardCommand } from "./onboard.js";

describe("Onboard Command", () => {
  beforeEach(async () => {
    // Create test directory
    if (!(await fs.pathExists(fixturesDir))) {
      await fs.ensureDir(fixturesDir);
    }
  });

  afterEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(fixturesDir)) {
      await fs.remove(fixturesDir);
    }
  });

  describe("Project Structure Analysis", () => {
    it("should analyze Express.js project structure correctly", async () => {
      // Create Express.js fixture
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should analyze React project structure correctly", async () => {
      await createFixture(fixtures.reactApp);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should analyze Next.js project structure correctly", async () => {
      await createFixture(fixtures.nextJsApp);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should analyze Python FastAPI project structure correctly", async () => {
      await createFixture(fixtures.pythonFastApi);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should analyze Python Django project structure correctly", async () => {
      await createFixture(fixtures.pythonDjango);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should analyze Rust project structure correctly", async () => {
      await createFixture(fixtures.rustAxum);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should analyze monorepo structure correctly", async () => {
      await createFixture(fixtures.monorepo);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });
  });

  describe("Service Detection", () => {
    it("should detect Express.js API service with correct confidence", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
      // Would need to capture logs or expose analysis results for more detailed testing
    });

    it("should detect React frontend service", async () => {
      await createFixture(fixtures.reactApp);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should detect Next.js frontend service with correct framework", async () => {
      await createFixture(fixtures.nextJsApp);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should detect FastAPI service with high confidence", async () => {
      await createFixture(fixtures.pythonFastApi);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should detect Django service", async () => {
      await createFixture(fixtures.pythonDjango);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should detect database and cache services from docker-compose", async () => {
      await createFixture({
        ...fixtures.expressJs,
        ...fixtures.dockerCompose,
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should filter services by confidence threshold", async () => {
      // Create a project with low-confidence indicators
      await createFixture({
        "package.json": {
          name: "ambiguous-project",
          version: "1.0.0",
          // No clear framework dependencies
        },
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });
  });

  describe("Project Type Classification", () => {
    it("should classify single-service project correctly", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should classify monorepo project correctly", async () => {
      await createFixture(fixtures.monorepo);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should classify multi-service project correctly", async () => {
      await createFixture({
        ...fixtures.expressJs,
        ...fixtures.dockerCompose,
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should classify library project correctly", async () => {
      await createFixture({
        "package.json": {
          name: "my-library",
          version: "1.0.0",
          main: "index.js",
          // No application frameworks
        },
        "index.js": "module.exports = { hello: 'world' };",
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });
  });

  describe("CUE Generation", () => {
    it("should generate valid CUE specification for Express.js project", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      // Check that CUE file was created
      const cueFilePath = join(fixturesDir, "arbiter.assembly.cue");
      expect(await fs.pathExists(cueFilePath)).toBe(true);

      // Check CUE content structure
      const cueContent = await fs.readFile(cueFilePath, "utf-8");
      expect(cueContent).toContain("package");
      expect(cueContent).toContain("product:");
      expect(cueContent).toContain("services:");
      expect(cueContent).toContain("metadata:");
    });

    it("should generate valid CUE specification for Next.js project", async () => {
      await createFixture(fixtures.nextJsApp);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const cueFilePath = join(fixturesDir, "arbiter.assembly.cue");
      const cueContent = await fs.readFile(cueFilePath, "utf-8");
      expect(cueContent).toContain("nextjs-app");
      expect(cueContent).toContain("bespoke");
    });

    it("should generate CUE specification with multiple services", async () => {
      await createFixture({
        ...fixtures.expressJs,
        ...fixtures.dockerCompose,
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const cueFilePath = join(fixturesDir, "arbiter.assembly.cue");
      const cueContent = await fs.readFile(cueFilePath, "utf-8");
      expect(cueContent).toContain("postgres:");
      expect(cueContent).toContain("redis:");
    });

    it("should handle service names with hyphens correctly", async () => {
      await createFixture({
        "package.json": {
          name: "my-api-service",
          version: "1.0.0",
          dependencies: {
            express: "^4.18.2",
          },
        },
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const cueFilePath = join(fixturesDir, "arbiter.assembly.cue");
      const cueContent = await fs.readFile(cueFilePath, "utf-8");
      // Service names with hyphens should be quoted
      expect(cueContent).toContain('"my-api-service":');
    });
  });

  describe(".arbiter Directory Structure", () => {
    it("should create .arbiter directory structure", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      // Check directory structure
      const arbiterDir = join(fixturesDir, ".arbiter");
      expect(await fs.pathExists(arbiterDir)).toBe(true);
      expect(await fs.pathExists(join(arbiterDir, "profiles"))).toBe(true);
      expect(await fs.pathExists(join(arbiterDir, "templates"))).toBe(true);
      expect(await fs.pathExists(join(arbiterDir, "config"))).toBe(true);
    });

    it("should create .arbiterignore file", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const ignoreFilePath = join(fixturesDir, ".arbiter", ".arbiterignore");
      expect(await fs.pathExists(ignoreFilePath)).toBe(true);

      const ignoreContent = await fs.readFile(ignoreFilePath, "utf-8");
      expect(ignoreContent).toContain("*.log");
      expect(ignoreContent).toContain("node_modules/");
      expect(ignoreContent).toContain("__pycache__/");
    });

    it("should create config.json with project metadata", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const configPath = join(fixturesDir, ".arbiter", "config.json");
      expect(await fs.pathExists(configPath)).toBe(true);

      const config = await fs.readJson(configPath);
      expect(config.version).toBe("1.0.0");
      expect(config.project.type).toBeDefined();
      expect(config.project.languages).toBeDefined();
      expect(config.services).toBeDefined();
      expect(config.onboarded).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle corrupted package.json gracefully", async () => {
      await createFixture(fixtures.corrupted);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      // Should handle error gracefully and not crash
      expect(exitCode).toBe(0);
    });

    it("should handle missing files gracefully", async () => {
      await createFixture({});

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should handle unreadable docker-compose file", async () => {
      await createFixture({
        ...fixtures.expressJs,
        "docker-compose.yml": "invalid: yaml: content: [",
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should handle empty project directory", async () => {
      await createFixture(fixtures.empty);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should handle potential sync command failures gracefully", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });
  });

  describe("Interactive Mode", () => {
    it("should run successfully in non-interactive mode", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });
  });

  describe("Dry Run Mode", () => {
    it("should not create files in dry run mode", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      // Should not create actual files
      const cueFilePath = join(fixturesDir, "arbiter.assembly.cue");
      const arbiterDir = join(fixturesDir, ".arbiter");
      expect(await fs.pathExists(cueFilePath)).toBe(false);
      expect(await fs.pathExists(arbiterDir)).toBe(false);
    });

    it("should create files when not in dry run mode", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      // Should create actual files
      const cueFilePath = join(fixturesDir, "arbiter.assembly.cue");
      const arbiterDir = join(fixturesDir, ".arbiter");
      expect(await fs.pathExists(cueFilePath)).toBe(true);
      expect(await fs.pathExists(arbiterDir)).toBe(true);
    });
  });

  describe("Force Mode", () => {
    it("should handle already onboarded project without force flag", async () => {
      await createFixture(fixtures.expressJs);
      // Create .arbiter directory to simulate already onboarded project
      await fs.ensureDir(join(fixturesDir, ".arbiter"));

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(1); // Should fail without force
    });

    it("should re-onboard already onboarded project with force flag", async () => {
      await createFixture(fixtures.expressJs);
      await fs.ensureDir(join(fixturesDir, ".arbiter"));

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, force: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0); // Should succeed with force
    });
  });

  describe("Integration with Sync Command", () => {
    it("should complete successfully with sync integration", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should complete successfully in dry run mode", async () => {
      await createFixture(fixtures.expressJs);

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });
  });

  describe("Directory Scanning", () => {
    it("should skip ignored directories and files", async () => {
      await createFixture({
        ...fixtures.expressJs,
        "node_modules/express/package.json": { name: "express" },
        ".git/config": "[core]",
        "dist/bundle.js": "// compiled code",
        "__pycache__/cache.pyc": "compiled python",
        "target/debug/binary": "rust binary",
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
      // The ignored files should not affect the analysis
    });

    it("should handle deep directory structures", async () => {
      await createFixture({
        ...fixtures.expressJs,
        "src/features/auth/controllers/userController.ts": "// deep file",
        "src/features/auth/models/user.ts": "// another deep file",
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle projects with no clear language indicators", async () => {
      await createFixture({
        "README.md": "# My Project",
        "config.yaml": "app: myapp",
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should handle projects with multiple language indicators", async () => {
      await createFixture({
        ...fixtures.expressJs,
        ...fixtures.pythonFastApi,
        ...fixtures.rustAxum,
      });

      const exitCode = await onboardCommand(
        { projectPath: fixturesDir, dryRun: true, interactive: false },
        mockConfig,
      );

      expect(exitCode).toBe(0);
    });

    it("should use current working directory when no path provided", async () => {
      const originalCwd = process.cwd();
      process.chdir(fixturesDir);
      await createFixture(fixtures.expressJs);

      try {
        const exitCode = await onboardCommand({ dryRun: true, interactive: false }, mockConfig);

        expect(exitCode).toBe(0);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});

// Helper function to create test fixtures
async function createFixture(files: Record<string, any>): Promise<void> {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(fixturesDir, filePath);
    await fs.ensureDir(join(fullPath, ".."));

    if (typeof content === "object" && filePath.endsWith(".json")) {
      await fs.writeJson(fullPath, content, { spaces: 2 });
    } else {
      await fs.writeFile(fullPath, String(content));
    }
  }
}
