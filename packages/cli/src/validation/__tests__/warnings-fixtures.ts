/**
 * @packageDocumentation
 * Test fixtures for validation warnings tests.
 *
 * Provides reusable test data for validation testing:
 * - Minimal valid specifications
 * - Complete valid specifications
 * - Incomplete specifications
 */

/**
 * Creates a minimal but complete spec for baseline testing.
 */
export function createMinimalValidSpec(): any {
  return {
    product: {
      name: "Test Product",
      goals: ["Achieve high performance", "Ensure reliability"],
    },
    metadata: {
      name: "test-project",
      version: "1.0.0",
      description: "A comprehensive test project",
    },
    services: {},
    ui: { routes: [] },
    tests: [
      {
        name: "Unit Tests",
        type: "unit",
        cases: [{ name: "test case", assertion: "should work" }],
      },
      {
        name: "Integration Tests",
        type: "integration",
        cases: [{ name: "integration test", assertion: "should integrate" }],
      },
      {
        name: "E2E Tests",
        type: "e2e",
        cases: [{ name: "e2e test", assertion: "should work end-to-end" }],
      },
    ],
    security: {
      authentication: { type: "oauth2" },
      authorization: { rbac: true },
    },
    performance: {
      sla: { responseTime: "< 200ms", availability: "99.9%" },
    },
    observability: {
      logging: { level: "info", format: "json" },
      monitoring: { metrics: ["response_time", "error_rate"] },
    },
    environments: {
      development: { name: "dev" },
      production: { name: "prod" },
    },
  };
}

/**
 * Creates a complete spec with all possible configurations.
 */
export function createCompleteValidSpec(): any {
  const minimal = createMinimalValidSpec();
  return {
    ...minimal,
    services: {
      "web-app": {
        type: "external",
        workload: "deployment",
        image: "nginx:latest",
        language: "javascript",
        ports: [{ name: "http", port: 80, targetPort: 80 }],
        healthCheck: { path: "/health", port: 80 },
        resources: {
          limits: { cpu: "1000m", memory: "512Mi" },
          requests: { cpu: "100m", memory: "128Mi" },
        },
        env: { NODE_ENV: "production" },
      },
    },
    ui: {
      routes: [
        {
          id: "dashboard",
          path: "/dashboard",
          capabilities: ["view", "manage"],
          components: ["DashboardHeader", "MetricsPanel"],
          requiresAuth: true,
        },
        {
          id: "admin",
          path: "/admin",
          capabilities: ["admin"],
          components: ["AdminPanel"],
          requiresAuth: true,
        },
      ],
    },
    locators: {
      "dashboard-header": "[data-testid='dashboard-header']",
      "metrics-panel": "[data-testid='metrics-panel']",
    },
    groups: [
      {
        id: "api-implementation",
        name: "Implement API Service",
        description: "Build the core API service",
        priority: "high",
        status: "planning",
        tasks: [
          {
            id: "setup-endpoints",
            name: "Setup API Endpoints",
            type: "feature",
            dependsOn: [],
          },
          {
            id: "add-authentication",
            name: "Add Authentication",
            type: "feature",
            dependsOn: ["setup-endpoints"],
          },
        ],
      },
    ],
    data: {
      models: [{ name: "User", fields: ["id", "email"] }],
      migrations: { strategy: "flyway", version: "1.0" },
    },
    docs: {
      api: { format: "openapi", version: "3.0" },
    },
  };
}

/**
 * Creates an incomplete spec that should trigger many warnings.
 */
export function createIncompleteSpec(): any {
  return {
    product: {
      name: "Incomplete Project",
      // Missing goals
    },
    metadata: {
      name: "incomplete",
      version: "1.0.0",
      // Missing description
    },
    services: {
      "incomplete-api": {
        type: "internal",
        workload: "deployment",
        language: "typescript",
        ports: [{ name: "http", port: 3000, targetPort: 3000 }],
        // Missing: healthCheck, resources, env
      },
    },
    ui: {
      routes: [
        {
          id: "incomplete-route",
          path: "/incomplete",
          // Missing: capabilities, components
        },
      ],
    },
    // Missing: tests, groups, security, performance, observability, environments, locators, docs
  };
}
