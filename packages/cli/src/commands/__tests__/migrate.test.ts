/**
 * Comprehensive test suite for v1 to v2 migration functionality
 * Tests migration command with various v1 configurations
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { migrateCommand } from "../migrate.js";
import type { Config } from "../../config.js";

const TEST_OUTPUT_DIR = path.join(os.tmpdir(), "arbiter-test-migrate-output");

// Mock config for testing
const mockConfig: Config = {
  version: "1.0.0",
  defaults: {},
};

describe("Migration Command Tests", () => {
  beforeEach(async () => {
    // Clean up test output directory
    if (await fs.pathExists(TEST_OUTPUT_DIR)) {
      await fs.remove(TEST_OUTPUT_DIR);
    }
    await fs.ensureDir(TEST_OUTPUT_DIR);

    // Create .arbiter directory for test specs
    await fs.ensureDir(path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec"));
  });

  afterEach(async () => {
    // Clean up after tests
    if (await fs.pathExists(TEST_OUTPUT_DIR)) {
      await fs.remove(TEST_OUTPUT_DIR);
    }
  });

  describe("V1 to V2 Schema Migration", () => {
    test("should migrate basic v1 service to v2 app format", async () => {
      const v1Assembly = `
package webapp

config: {
  language: "typescript"
  kind: "service"
  buildTool: "bun"
}

metadata: {
  name: "customer-portal"
  version: "2.1.0"
  description: "Customer management portal"
}

deployment: {
  target: "kubernetes"
  cluster: {
    name: "prod-cluster"
    namespace: "customer-portal"
  }
}

services: {
  webapp: {
    serviceType: "bespoke"
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./apps/web"
    ports: [{
      name: "http"
      port: 3000
      targetPort: 3000
    }]
    env: {
      NODE_ENV: "production"
      API_URL: "https://api.company.com"
    }
    resources: {
      requests: { cpu: "100m", memory: "256Mi" }
      limits: { cpu: "500m", memory: "512Mi" }
    }
  }
  
  api: {
    serviceType: "bespoke"
    language: "typescript" 
    type: "deployment"
    sourceDirectory: "./apps/api"
    ports: [{
      name: "http"
      port: 8080
      targetPort: 8080
    }]
    env: {
      DATABASE_URL: "postgresql://user:pass@postgres:5432/customerdb"
      REDIS_URL: "redis://redis:6379"
    }
    healthCheck: {
      path: "/health"
      port: 8080
      initialDelay: 30
    }
  }
  
  postgres: {
    serviceType: "prebuilt"
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
      type: "persistentVolumeClaim"
    }]
    env: {
      POSTGRES_DB: "customerdb"
      POSTGRES_USER: "user"
      POSTGRES_PASSWORD: "pass"
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v1Assembly);

      // Change to test output directory and run migrate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await migrateCommand(
        { dryRun: false, backup: true, verbose: true },
        mockConfig,
        "migrate-spec",
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify backup was created
      const backupDir = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "backup");
      expect(await fs.pathExists(backupDir)).toBe(true);

      const backupFile = path.join(backupDir, "assembly.cue");
      expect(await fs.pathExists(backupFile)).toBe(true);

      // Verify migrated file has v2 structure
      const migratedFile = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      const migratedContent = await fs.readFile(migratedFile, "utf-8");

      // Should contain v2 product specification
      expect(migratedContent).toContain("product: {");
      expect(migratedContent).toContain('name: "Customer Portal"');
      expect(migratedContent).toContain('goals: ["Customer management portal"]');

      // Should contain inferred UI routes
      expect(migratedContent).toContain("ui: routes: [");
      expect(migratedContent).toContain('id: "webapp:main"');
      expect(migratedContent).toContain('path: "/"');
      expect(migratedContent).toContain('capabilities: ["view"]');

      // Should contain basic locators
      expect(migratedContent).toContain("locators: {");

      // Should contain basic flows
      expect(migratedContent).toContain("flows: [");
      expect(migratedContent).toContain('id: "health_check"');

      // Should preserve infrastructure info in ops section
      expect(migratedContent).toContain("ops: {");
      expect(migratedContent).toContain('environments: ["production"]');
    });

    test("should handle migration dry run without modifying files", async () => {
      const v1Assembly = `
package simple

config: {
  language: "python"
  kind: "service"
}

metadata: {
  name: "simple-api"
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
    ports: [{ name: "http", port: 8000 }]
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v1Assembly);

      const originalContent = v1Assembly;

      // Change to test output directory and run migrate with dry run
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await migrateCommand(
        { dryRun: true, verbose: true },
        mockConfig,
        "migrate-spec",
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify original file is unchanged
      const currentContent = await fs.readFile(assemblyPath, "utf-8");
      expect(currentContent).toBe(originalContent);

      // Verify no backup was created
      const backupDir = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "backup");
      expect(await fs.pathExists(backupDir)).toBe(false);
    });

    test("should migrate complex v1 assembly with multiple service types", async () => {
      const complexV1Assembly = `
package ecommerce

config: {
  language: "typescript"
  kind: "service"
  buildTool: "bun"
}

metadata: {
  name: "ecommerce-platform"
  version: "3.2.1" 
  description: "Full-featured e-commerce platform with microservices"
}

deployment: {
  target: "both"
  cluster: {
    name: "ecommerce-prod"
    namespace: "ecommerce"
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
  # Frontend services
  storefront: {
    serviceType: "bespoke"
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./apps/storefront"
    buildContext: {
      dockerfile: "Dockerfile.storefront"
      target: "production"
    }
    ports: [{ name: "http", port: 3000 }]
    env: {
      NODE_ENV: "production"
      API_URL: "https://api.ecommerce.com"
      STRIPE_PUBLIC_KEY: "pk_live_..."
    }
    replicas: 3
  }
  
  admin: {
    serviceType: "bespoke"
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./apps/admin"
    ports: [{ name: "http", port: 3001 }]
    env: {
      NODE_ENV: "production"
      API_URL: "https://api.ecommerce.com"
      ADMIN_SECRET: "admin123"
    }
  }
  
  # Backend API services
  api: {
    serviceType: "bespoke"
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./apps/api"
    ports: [{ name: "http", port: 8080 }]
    env: {
      DATABASE_URL: "postgresql://user:pass@postgres:5432/ecommerce"
      REDIS_URL: "redis://redis:6379"
      STRIPE_SECRET_KEY: "sk_live_..."
    }
    healthCheck: {
      path: "/api/health"
      port: 8080
    }
    replicas: 2
  }
  
  worker: {
    serviceType: "bespoke"
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./apps/worker"
    env: {
      REDIS_URL: "redis://redis:6379"
      EMAIL_SERVICE: "sendgrid"
      SENDGRID_API_KEY: "sg_..."
    }
  }
  
  # Data services
  postgres: {
    serviceType: "prebuilt"
    language: "container"
    type: "statefulset"
    image: "postgres:15"
    ports: [{ name: "postgres", port: 5432 }]
    volumes: [{
      name: "data"
      path: "/var/lib/postgresql/data"
      size: "500Gi"
    }]
    env: {
      POSTGRES_DB: "ecommerce"
      POSTGRES_USER: "user"
      POSTGRES_PASSWORD: "pass"
    }
  }
  
  redis: {
    serviceType: "prebuilt"  
    language: "container"
    type: "deployment"
    image: "redis:7-alpine"
    ports: [{ name: "redis", port: 6379 }]
    volumes: [{ name: "data", path: "/data", size: "50Gi" }]
    env: { REDIS_PASSWORD: "redispass" }
  }
  
  elasticsearch: {
    serviceType: "prebuilt"
    language: "container"
    type: "statefulset"
    image: "elasticsearch:8.11.0"
    ports: [
      { name: "http", port: 9200 },
      { name: "transport", port: 9300 }
    ]
    volumes: [{ name: "data", path: "/usr/share/elasticsearch/data", size: "200Gi" }]
    env: {
      "discovery.type": "single-node"
      "xpack.security.enabled": "false"
    }
    resources: {
      requests: { cpu: "500m", memory: "2Gi" }
      limits: { cpu: "2", memory: "4Gi" }
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, complexV1Assembly);

      // Change to test output directory and run migrate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await migrateCommand(
        { dryRun: false, backup: true, verbose: true },
        mockConfig,
        "migrate-spec",
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify migrated content has proper v2 structure
      const migratedFile = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      const migratedContent = await fs.readFile(migratedFile, "utf-8");

      // Should extract proper product info
      expect(migratedContent).toContain("product: {");
      expect(migratedContent).toContain('name: "Ecommerce Platform"');
      expect(migratedContent).toContain(
        'goals: ["Full-featured e-commerce platform with microservices"]',
      );

      // Should infer UI routes from frontend services
      expect(migratedContent).toContain("ui: routes: [");
      expect(migratedContent).toContain('id: "storefront:main"');
      expect(migratedContent).toContain('path: "/"');
      expect(migratedContent).toContain('id: "admin:main"');
      expect(migratedContent).toContain('path: "/admin"');

      // Should create basic locators for each frontend service
      expect(migratedContent).toContain("locators: {");
      expect(migratedContent).toContain('"page:storefront"');
      expect(migratedContent).toContain('"page:admin"');

      // Should create health check flows
      expect(migratedContent).toContain("flows: [");
      expect(migratedContent).toContain('id: "health_check"');
      expect(migratedContent).toContain('visit: "storefront:main"');

      // Should include operational context
      expect(migratedContent).toContain("ops: {");
      expect(migratedContent).toContain('environments: ["production"]');

      // Should preserve complex deployment configurations as comments
      expect(migratedContent).toContain("# Original v1 deployment configuration:");
      expect(migratedContent).toContain(
        "# Services: storefront, admin, api, worker, postgres, redis, elasticsearch",
      );
    });
  });

  describe("Migration Edge Cases", () => {
    test("should handle v1 assembly without services gracefully", async () => {
      const minimalV1Assembly = `
package minimal

config: {
  language: "typescript"
  kind: "library"
}

metadata: {
  name: "utility-lib"
  version: "1.0.0"
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, minimalV1Assembly);

      // Change to test output directory and run migrate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await migrateCommand(
        { dryRun: false, verbose: true },
        mockConfig,
        "migrate-spec",
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify migrated content handles minimal case
      const migratedFile = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      const migratedContent = await fs.readFile(migratedFile, "utf-8");

      expect(migratedContent).toContain("product: {");
      expect(migratedContent).toContain('name: "Utility Lib"');
      expect(migratedContent).toContain("ui: routes: []"); // Empty routes array
      expect(migratedContent).toContain("locators: {}"); // Empty locators
      expect(migratedContent).toContain("flows: []"); // Empty flows
    });

    test("should handle already migrated v2 file gracefully", async () => {
      const v2Assembly = `
package alreadymigrated

product: {
  name: "Already V2"
  goals: ["Test v2 handling"]
}

ui: routes: [
  {
    id: "main:dashboard"
    path: "/dashboard"
    capabilities: ["view"]
  }
]

locators: {
  "page:dashboard": '[data-testid="dashboard"]'
}

flows: [
  {
    id: "navigation_test"
    steps: [
      { visit: "main:dashboard" }
    ]
  }
]
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v2Assembly);

      // Change to test output directory and run migrate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await migrateCommand(
        { dryRun: false, verbose: true },
        mockConfig,
        "migrate-spec",
      );

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify content remains unchanged (no double migration)
      const migratedFile = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      const migratedContent = await fs.readFile(migratedFile, "utf-8");

      // Should keep original v2 content intact
      expect(migratedContent).toContain('name: "Already V2"');
      expect(migratedContent).toContain('id: "main:dashboard"');
      expect(migratedContent).not.toContain("# Migrated from v1"); // No migration marker
    });

    test("should validate migrated content generates valid v2 artifacts", async () => {
      const v1Assembly = `
package validation

config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "validation-test"
  version: "1.0.0"
  description: "Test migration validation"
}

deployment: {
  target: "kubernetes"
}

services: {
  frontend: {
    serviceType: "bespoke"
    language: "typescript"
    type: "deployment"
    sourceDirectory: "./src/web"
    ports: [{ name: "http", port: 3000 }]
    healthCheck: {
      path: "/health"
      port: 3000
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "migrate-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v1Assembly);

      // Change to test output directory and run migrate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      // First migrate
      const migrateResult = await migrateCommand(
        { dryRun: false, backup: true, verbose: true },
        mockConfig,
        "migrate-spec",
      );

      expect(migrateResult).toBe(0);

      // Then try to generate from migrated v2 spec
      const { generateCommand } = await import("../generate.js");
      const generateResult = await generateCommand({ verbose: true }, mockConfig, "migrate-spec");

      // Restore original directory
      process.chdir(originalCwd);

      expect(generateResult).toBe(0);

      // Verify v2 artifacts were generated
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "src", "components"))).toBe(true);
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "tests", "flows"))).toBe(true);

      // Verify no v1 infrastructure artifacts
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "terraform"))).toBe(false);
    });
  });
});
