/**
 * Test suite for generate command with enhanced service schema
 * Tests all service types: bespoke, prebuilt, and Docker Compose generation
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { generateCommand } from "../generate.js";
import type { Config } from "../../config.js";

const TEST_OUTPUT_DIR = path.join(os.tmpdir(), "arbiter-test-output");
const FIXTURES_DIR = path.join(import.meta.dir, "fixtures");

// Mock config for testing
const mockConfig: Config = {
  version: "1.0.0",
  defaults: {},
};

describe("Enhanced Service Schema Generation", () => {
  beforeEach(async () => {
    // Clean up test output directory
    if (await fs.pathExists(TEST_OUTPUT_DIR)) {
      await fs.remove(TEST_OUTPUT_DIR);
    }
    await fs.ensureDir(TEST_OUTPUT_DIR);
    await fs.ensureDir(FIXTURES_DIR);

    // Create .arbiter directory for test specs
    await fs.ensureDir(path.join(TEST_OUTPUT_DIR, ".arbiter", "test-spec"));
  });

  afterEach(async () => {
    // Clean up after tests
    if (await fs.pathExists(TEST_OUTPUT_DIR)) {
      await fs.remove(TEST_OUTPUT_DIR);
    }
  });

  describe("Service Type Detection", () => {
    test("should detect bespoke service with sourceDirectory", async () => {
      const assemblyContent = `
package test

config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "bespoke-test"
  version: "1.0.0"
}

deployment: {
  target: "kubernetes"
  cluster: {
    name: "test-cluster"
    namespace: "test"
  }
}

services: {
  api: {
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./src/api"
    buildContext: {
      dockerfile: "Dockerfile.api"
      target: "production"
      buildArgs: {
        NODE_ENV: "production"
      }
    }
    ports: [{
      name: "http"
      port: 3000
      targetPort: 3000
    }]
    env: {
      NODE_ENV: "production"
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, assemblyContent);

      // Mock CUE eval command to return parsed JSON
      process.env.TEST_MODE = "true";

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand(
        { verbose: true },
        mockConfig,
        "test-spec", // Specify the spec name to avoid multiple spec detection
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify Terraform files generated
      const terraformDir = path.join(TEST_OUTPUT_DIR, "terraform");
      expect(await fs.pathExists(terraformDir)).toBe(true);

      const servicesFile = path.join(terraformDir, "services.tf");
      expect(await fs.pathExists(servicesFile)).toBe(true);

      const servicesContent = await fs.readFile(servicesFile, "utf-8");
      expect(servicesContent).toContain("kubernetes_deployment");
      expect(servicesContent).toContain("api");
    });

    test("should detect prebuilt service (ClickHouse)", async () => {
      const assemblyContent = `
package test

config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "prebuilt-test"
  version: "1.0.0"
}

deployment: {
  target: "kubernetes"
  cluster: {
    name: "test-cluster"
    namespace: "test"
  }
}

services: {
  clickhouse: {
    language: "container"
    type: "statefulset"
    image: "clickhouse/clickhouse-server:latest"
    ports: [{
      name: "http"
      port: 8123
      targetPort: 8123
    }, {
      name: "native"
      port: 9000
      targetPort: 9000
    }]
    volumes: [{
      name: "data"
      path: "/var/lib/clickhouse"
      size: "50Gi"
      type: "persistentVolumeClaim"
    }]
    env: {
      CLICKHOUSE_DB: "default"
      CLICKHOUSE_USER: "default"
      CLICKHOUSE_PASSWORD: "password"
    }
    config: {
      files: [{
        name: "users.xml"
        content: "<users><default><password>password</password></default></users>"
      }]
    }
  }
  
  redis: {
    language: "container" 
    type: "deployment"
    image: "redis:7-alpine"
    ports: [{
      name: "redis"
      port: 6379
      targetPort: 6379
    }]
    healthCheck: {
      path: "/health"
      port: 6379
      initialDelay: 30
      periodSeconds: 10
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, assemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand(
        { verbose: true },
        mockConfig,
        "test-spec", // Specify the spec name to avoid multiple spec detection
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify services generated correctly
      const servicesFile = path.join(TEST_OUTPUT_DIR, "terraform", "services.tf");
      expect(await fs.pathExists(servicesFile)).toBe(true);

      const servicesContent = await fs.readFile(servicesFile, "utf-8");
      expect(servicesContent).toContain("clickhouse/clickhouse-server:latest");
      expect(servicesContent).toContain("redis:7-alpine");
      expect(servicesContent).toContain("kubernetes_statefulset");
      expect(servicesContent).toContain("kubernetes_deployment");
    });
  });

  describe("Docker Compose Generation", () => {
    test("should generate Docker Compose files for both deployment targets", async () => {
      const assemblyContent = `
package test

config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "compose-test"
  version: "1.0.0"
}

deployment: {
  target: "both"
  cluster: {
    name: "test-cluster"
    namespace: "test"
  }
  compose: {
    version: "3.8"
    networks: {
      app_network: {
        driver: "bridge"
      }
    }
  }
}

services: {
  web: {
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./apps/web"
    buildContext: {
      dockerfile: "Dockerfile"
      target: "production"
    }
    ports: [{
      name: "http"
      port: 3000
      targetPort: 3000
    }]
    env: {
      NODE_ENV: "production"
      DATABASE_URL: "postgresql://user:pass@db:5432/mydb"
    }
  }
  
  db: {
    language: "container"
    type: "statefulset"
    image: "postgres:15"
    ports: [{
      name: "postgres"
      port: 5432
      targetPort: 5432
    }]
    volumes: [{
      name: "data"
      path: "/var/lib/postgresql/data"
      size: "10Gi"
    }]
    env: {
      POSTGRES_DB: "mydb"
      POSTGRES_USER: "user"
      POSTGRES_PASSWORD: "pass"
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, assemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand(
        { verbose: true },
        mockConfig,
        "test-spec", // Specify the spec name to avoid multiple spec detection
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify both Terraform AND Docker Compose generated
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "terraform"))).toBe(true);
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "compose"))).toBe(true);

      // Check Docker Compose files
      const composeFile = path.join(TEST_OUTPUT_DIR, "compose", "docker-compose.yml");
      expect(await fs.pathExists(composeFile)).toBe(true);

      const composeContent = await fs.readFile(composeFile, "utf-8");
      expect(composeContent).toContain('version: "3.8"');
      expect(composeContent).toContain("web:");
      expect(composeContent).toContain("db:");
      expect(composeContent).toContain("build:");
      expect(composeContent).toContain("postgres:15");
      expect(composeContent).toContain("networks:");

      // Check environment template
      const envFile = path.join(TEST_OUTPUT_DIR, "compose", ".env.template");
      expect(await fs.pathExists(envFile)).toBe(true);

      const envContent = await fs.readFile(envFile, "utf-8");
      expect(envContent).toContain("COMPOSE_PROJECT_NAME=compose-test");
      expect(envContent).toContain("NODE_ENV=production");
      expect(envContent).toContain("POSTGRES_DB=mydb");
    });

    test("should generate compose-only deployment", async () => {
      const assemblyContent = `
package test

config: {
  language: "python"
  kind: "service"
}

metadata: {
  name: "compose-only"
  version: "1.0.0"
}

deployment: {
  target: "compose"
}

services: {
  api: {
    language: "python"
    type: "deployment"
    sourceDirectory: "./src"
    buildContext: {
      dockerfile: "Dockerfile"
    }
    ports: [{
      name: "http"
      port: 8000
      targetPort: 8000
    }]
    env: {
      PYTHONPATH: "/app"
      DEBUG: "false"
    }
  }
  
  worker: {
    language: "python"
    type: "deployment"
    sourceDirectory: "./src"
    buildContext: {
      dockerfile: "Dockerfile.worker"
    }
    env: {
      WORKER_TYPE: "celery"
      REDIS_URL: "redis://redis:6379"
    }
  }
  
  redis: {
    language: "container"
    type: "deployment"
    image: "redis:7-alpine"
    ports: [{
      name: "redis"
      port: 6379
      targetPort: 6379
    }]
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, assemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand(
        { verbose: true },
        mockConfig,
        "test-spec", // Specify the spec name to avoid multiple spec detection
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Should NOT generate Terraform
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "terraform"))).toBe(false);

      // Should generate Docker Compose
      const composeFile = path.join(TEST_OUTPUT_DIR, "compose", "docker-compose.yml");
      expect(await fs.pathExists(composeFile)).toBe(true);

      const composeContent = await fs.readFile(composeFile, "utf-8");
      expect(composeContent).toContain("api:");
      expect(composeContent).toContain("worker:");
      expect(composeContent).toContain("redis:");
      expect(composeContent).toContain("build:");
      expect(composeContent).toContain("../src");
      expect(composeContent).toContain("redis:7-alpine");
    });
  });

  describe("Test Composition and Namespacing", () => {
    test("should generate namespaced tests for services", async () => {
      const assemblyContent = `
package test

config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "test-composition"
  version: "1.0.0"
}

deployment: {
  target: "kubernetes"
  cluster: {
    name: "test-cluster"
    namespace: "test"
  }
}

services: {
  api: {
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./src/api"
    ports: [{
      name: "http"
      port: 3000
      targetPort: 3000
    }]
    healthCheck: {
      path: "/health"
      port: 3000
    }
  }
  
  clickhouse: {
    language: "container"
    type: "statefulset"
    image: "clickhouse/clickhouse-server:latest"
    ports: [{
      name: "http"
      port: 8123
      targetPort: 8123
    }]
    volumes: [{
      name: "data"
      path: "/var/lib/clickhouse"
      size: "50Gi"
    }]
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, assemblyContent);

      // Create existing test file to test composition
      const testsDir = path.join(TEST_OUTPUT_DIR, "tests");
      await fs.ensureDir(testsDir);

      const existingTest = `
import { describe, test, expect } from '@jest/globals';

describe('api_tests', () => {
  test('custom_api_test', async () => {
    // This is a custom test that should be preserved
    expect(true).toBe(true);
  });
  
  test('api_health_check', async () => {
    // This is an existing generated test that can be updated
    expect(true).toBe(true);
  });
});
      `;

      await fs.writeFile(path.join(testsDir, "api_tests.test.ts"), existingTest);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand(
        { verbose: true },
        mockConfig,
        "test-spec", // Specify the spec name to avoid multiple spec detection
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify test composition report generated
      const reportFile = path.join(TEST_OUTPUT_DIR, "tests", "composition_report.json");
      expect(await fs.pathExists(reportFile)).toBe(true);

      const report = JSON.parse(await fs.readFile(reportFile, "utf-8"));
      expect(report.summary).toHaveProperty("totalTests");
      expect(report.summary).toHaveProperty("generatedTests");
      expect(report.summary).toHaveProperty("preservedTests");
      expect(report.summary).toHaveProperty("conflicts");

      // Verify test files generated with proper namespacing
      const apiTestFile = path.join(TEST_OUTPUT_DIR, "tests", "api_tests.test.ts");
      expect(await fs.pathExists(apiTestFile)).toBe(true);

      const apiTestContent = await fs.readFile(apiTestFile, "utf-8");
      expect(apiTestContent).toContain("api_health_check");
      expect(apiTestContent).toContain("custom_api_test");

      const clickhouseTestFile = path.join(TEST_OUTPUT_DIR, "tests", "clickhouse_tests.test.ts");
      expect(await fs.pathExists(clickhouseTestFile)).toBe(true);

      const clickhouseTestContent = await fs.readFile(clickhouseTestFile, "utf-8");
      expect(clickhouseTestContent).toContain("clickhouse_health_check");
      expect(clickhouseTestContent).toContain("clickhouse_image_version");
      expect(clickhouseTestContent).toContain("Generated by Arbiter");
    });

    test("should handle test conflicts intelligently", async () => {
      const assemblyContent = `
package test

config: {
  language: "python"
  kind: "service" 
}

metadata: {
  name: "conflict-test"
  version: "1.0.0"
}

deployment: {
  target: "kubernetes"
  cluster: {
    name: "test-cluster"
    namespace: "test"
  }
}

services: {
  worker: {
    language: "python"
    type: "deployment"
    sourceDirectory: "./src/worker"
    env: {
      WORKER_TYPE: "celery"
      REDIS_URL: "redis://localhost:6379"
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, assemblyContent);

      // Create existing test with conflicting name
      const testsDir = path.join(TEST_OUTPUT_DIR, "tests");
      await fs.ensureDir(testsDir);

      const existingTest = `
import pytest

class TestWorkerTests:
    def test_worker_environment_variables(self):
        """Custom implementation of environment test"""
        # This should be preserved as it's custom
        assert True
        
    def test_custom_worker_logic(self):
        """Custom test that should be preserved"""
        assert True
      `;

      await fs.writeFile(path.join(testsDir, "worker_tests.test.py"), existingTest);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand(
        { verbose: true },
        mockConfig,
        "test-spec", // Specify the spec name to avoid multiple spec detection
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Check composition report for conflicts
      const reportFile = path.join(TEST_OUTPUT_DIR, "tests", "composition_report.json");
      const report = JSON.parse(await fs.readFile(reportFile, "utf-8"));

      expect(report.summary.conflicts).toBeGreaterThan(0);
      expect(report.details.conflicts).toHaveLength(1);
      expect(report.details.conflicts[0]).toHaveProperty("test");
      expect(report.details.conflicts[0]).toHaveProperty("reason");
      expect(report.details.conflicts[0]).toHaveProperty("resolution");

      // Verify test file contains both custom and generated tests
      const workerTestFile = path.join(TEST_OUTPUT_DIR, "tests", "worker_tests.test.py");
      const testContent = await fs.readFile(workerTestFile, "utf-8");

      expect(testContent).toContain("test_custom_worker_logic");
      expect(testContent).toContain("test_worker_environment_variables");
      expect(testContent).toContain("Custom implementation of environment test");
    });
  });

  describe("Mixed Service Types", () => {
    test("should handle complex mixed service architecture", async () => {
      const assemblyContent = `
package test

config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "mixed-architecture"
  version: "1.0.0"
}

deployment: {
  target: "both"
  cluster: {
    name: "prod-cluster"
    namespace: "production"
  }
  compose: {
    version: "3.8"
    networks: {
      frontend: { driver: "bridge" }
      backend: { driver: "bridge" }
    }
  }
}

services: {
  # Bespoke frontend service
  webapp: {
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./apps/webapp"
    buildContext: {
      dockerfile: "Dockerfile.webapp"
      target: "production"
      buildArgs: {
        NODE_ENV: "production"
        API_URL: "https://api.example.com"
      }
    }
    ports: [{
      name: "http"
      port: 80
      targetPort: 3000
    }]
    replicas: 3
    env: {
      NODE_ENV: "production"
      PORT: "3000"
    }
    resources: {
      requests: {
        cpu: "100m"
        memory: "256Mi"
      }
      limits: {
        cpu: "500m"
        memory: "512Mi"
      }
    }
  }
  
  # Bespoke API service  
  api: {
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./apps/api"
    buildContext: {
      dockerfile: "Dockerfile.api"
    }
    ports: [{
      name: "http"
      port: 3000
      targetPort: 3000
    }]
    replicas: 2
    env: {
      NODE_ENV: "production"
      DATABASE_URL: "postgresql://user:pass@postgres:5432/mydb"
      REDIS_URL: "redis://redis:6379"
      CLICKHOUSE_URL: "http://clickhouse:8123"
    }
    healthCheck: {
      path: "/health"
      port: 3000
      initialDelay: 30
      periodSeconds: 10
    }
  }
  
  # Prebuilt database services
  postgres: {
    language: "container"
    type: "statefulset"
    image: "postgres:15"
    ports: [{
      name: "postgres"
      port: 5432
      targetPort: 5432
    }]
    volumes: [{
      name: "data"
      path: "/var/lib/postgresql/data"
      size: "100Gi"
    }]
    env: {
      POSTGRES_DB: "mydb"
      POSTGRES_USER: "user"
      POSTGRES_PASSWORD: "pass"
    }
    config: {
      files: [{
        name: "postgresql.conf"
        content: "max_connections = 200\\nshared_buffers = 256MB"
      }]
    }
  }
  
  redis: {
    language: "container"
    type: "deployment"
    image: "redis:7-alpine"
    ports: [{
      name: "redis"
      port: 6379
      targetPort: 6379
    }]
    volumes: [{
      name: "data"
      path: "/data"
      size: "10Gi"
    }]
    env: {
      REDIS_PASSWORD: "redispass"
    }
  }
  
  clickhouse: {
    language: "container"
    type: "statefulset" 
    image: "clickhouse/clickhouse-server:latest"
    ports: [{
      name: "http"
      port: 8123
      targetPort: 8123
    }, {
      name: "native"
      port: 9000
      targetPort: 9000
    }]
    volumes: [{
      name: "data"
      path: "/var/lib/clickhouse"
      size: "500Gi"
    }, {
      name: "config"
      path: "/etc/clickhouse-server/config.d"
      type: "configMap"
    }]
    env: {
      CLICKHOUSE_DB: "analytics"
      CLICKHOUSE_USER: "default"
      CLICKHOUSE_PASSWORD: "clickhouse123"
    }
    config: {
      files: [{
        name: "config.xml"
        content: {
          clickhouse: {
            profiles: {
              default: {
                max_memory_usage: 10000000000
              }
            }
          }
        }
      }]
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, assemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand(
        { verbose: true },
        mockConfig,
        "test-spec", // Specify the spec name to avoid multiple spec detection
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify all deployment artifacts generated
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "terraform"))).toBe(true);
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "compose"))).toBe(true);

      // Check Terraform files
      const servicesFile = path.join(TEST_OUTPUT_DIR, "terraform", "services.tf");
      const servicesContent = await fs.readFile(servicesFile, "utf-8");

      expect(servicesContent).toContain('kubernetes_deployment "webapp"');
      expect(servicesContent).toContain('kubernetes_deployment "api"');
      expect(servicesContent).toContain('kubernetes_statefulset "postgres"');
      expect(servicesContent).toContain('kubernetes_deployment "redis"');
      expect(servicesContent).toContain('kubernetes_statefulset "clickhouse"');

      // Check Docker Compose
      const composeFile = path.join(TEST_OUTPUT_DIR, "compose", "docker-compose.yml");
      const composeContent = await fs.readFile(composeFile, "utf-8");

      expect(composeContent).toContain("webapp:");
      expect(composeContent).toContain("api:");
      expect(composeContent).toContain("postgres:");
      expect(composeContent).toContain("redis:");
      expect(composeContent).toContain("clickhouse:");

      // Check bespoke vs prebuilt service handling
      expect(composeContent).toContain("build:"); // For bespoke services
      expect(composeContent).toContain("postgres:15"); // For prebuilt services
      expect(composeContent).toContain("networks:");

      // Check config files generated
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "compose", "config"))).toBe(true);
      const postgresConfigFile = path.join(
        TEST_OUTPUT_DIR,
        "compose",
        "config",
        "postgres",
        "postgresql.conf",
      );
      expect(await fs.pathExists(postgresConfigFile)).toBe(true);

      // Check comprehensive test generation
      const testsDir = path.join(TEST_OUTPUT_DIR, "tests");
      expect(await fs.pathExists(testsDir)).toBe(true);

      // Should have tests for each service
      expect(await fs.pathExists(path.join(testsDir, "webapp_tests.test.ts"))).toBe(true);
      expect(await fs.pathExists(path.join(testsDir, "api_tests.test.ts"))).toBe(true);
      expect(await fs.pathExists(path.join(testsDir, "postgres_tests.test.ts"))).toBe(true);
      expect(await fs.pathExists(path.join(testsDir, "redis_tests.test.ts"))).toBe(true);
      expect(await fs.pathExists(path.join(testsDir, "clickhouse_tests.test.ts"))).toBe(true);

      // Verify composition report
      const reportFile = path.join(testsDir, "composition_report.json");
      const report = JSON.parse(await fs.readFile(reportFile, "utf-8"));

      expect(report.summary.totalTests).toBeGreaterThan(10);
      expect(report.summary.generatedTests).toBeGreaterThan(5);
    });
  });
});
