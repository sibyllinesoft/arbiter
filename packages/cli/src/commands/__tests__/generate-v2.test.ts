/**
 * Comprehensive test suite for v2 schema parsing and generation
 * Tests app-centric schema format with UI routes, flows, and locators
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { generateCommand } from "../generate.js";
import type { Config } from "../../config.js";

const TEST_OUTPUT_DIR = path.join(os.tmpdir(), "arbiter-test-v2-output");
const FIXTURES_DIR = path.join(import.meta.dir, "fixtures");

// Mock config for testing
const mockConfig: Config = {
  version: "1.0.0",
  defaults: {},
};

describe("V2 Schema Parsing and Generation", () => {
  beforeEach(async () => {
    // Clean up test output directory
    if (await fs.pathExists(TEST_OUTPUT_DIR)) {
      await fs.remove(TEST_OUTPUT_DIR);
    }
    await fs.ensureDir(TEST_OUTPUT_DIR);
    await fs.ensureDir(FIXTURES_DIR);

    // Create .arbiter directory for test specs
    await fs.ensureDir(path.join(TEST_OUTPUT_DIR, ".arbiter", "test-v2-spec"));
  });

  afterEach(async () => {
    // Clean up after tests
    if (await fs.pathExists(TEST_OUTPUT_DIR)) {
      await fs.remove(TEST_OUTPUT_DIR);
    }
  });

  describe("Schema Version Detection", () => {
    test("should detect v2 schema from product and ui structure", async () => {
      const v2AssemblyContent = `
package invoiceapp

product: {
  name: "Invoice Manager"
  goals: ["Streamline invoice creation", "Automate payment tracking"]
  roles: ["admin", "accountant", "manager"]
  slos: { p95_page_load_ms: 2000, uptime: "99.9%" }
}

ui: routes: [
  {
    id: "invoices:list"
    path: "/invoices"
    capabilities: ["list", "create", "search", "filter"]
    components: ["InvoiceTable", "CreateButton", "SearchBar"]
  },
  {
    id: "invoices:detail" 
    path: "/invoices/:id"
    capabilities: ["view", "edit", "delete", "send"]
    components: ["InvoiceForm", "StatusBadge", "ActionButtons"]
  }
]

locators: {
  "btn:createInvoice": '[data-testid="create-invoice"]'
  "field:customerName": '[data-testid="customer-name"]'
  "table:invoicesList": '[data-testid="invoices-table"]'
}

flows: [
  {
    id: "invoice_creation"
    preconditions: { role: "accountant" }
    steps: [
      { visit: "invoices:list" },
      { click: "btn:createInvoice" },
      { fill: { locator: "field:customerName", value: "Acme Corp" } },
      { expect: { locator: "btn:saveInvoice", state: "enabled" } }
    ]
  }
]

components: schemas: {
  Invoice: {
    example: {
      id: "INV-001"
      customer: "Acme Corp"
      total: 1500.00
      status: "draft"
    }
    rules: { total: ">= 0", status: "must be valid enum" }
  }
}

paths: {
  "/api/invoices": {
    get: { response: { $ref: "#/components/schemas/Invoice", example: [] } }
    post: { 
      request: { $ref: "#/components/schemas/Invoice" }
      response: { $ref: "#/components/schemas/Invoice" }
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-v2-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v2AssemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand({ verbose: true }, mockConfig, "test-v2-spec");

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify v2 artifacts generated (not v1 infrastructure)
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "terraform"))).toBe(false);
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "src", "components"))).toBe(true);
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "tests", "flows"))).toBe(true);

      // Check generated React components
      const componentsDir = path.join(TEST_OUTPUT_DIR, "src", "components");
      expect(await fs.pathExists(path.join(componentsDir, "InvoicesListPage.tsx"))).toBe(true);
      expect(await fs.pathExists(path.join(componentsDir, "InvoicesDetailPage.tsx"))).toBe(true);
    });

    test("should detect v1 schema from config and services structure", async () => {
      const v1AssemblyContent = `
package test

config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "legacy-service"
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
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-v2-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v1AssemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand({ verbose: true }, mockConfig, "test-v2-spec");

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify v1 artifacts generated (not v2 components)
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "src", "components"))).toBe(false);
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "tests", "flows"))).toBe(false);
    });
  });

  describe("V2 Component Generation", () => {
    test("should generate React components from UI routes", async () => {
      const v2AssemblyContent = `
package testapp

product: {
  name: "Test App"
  goals: ["Test functionality"]
}

ui: routes: [
  {
    id: "dashboard:overview"
    path: "/dashboard"
    capabilities: ["view", "refresh"]
    components: ["StatsCards", "ActivityFeed"]
  },
  {
    id: "users:management"
    path: "/users"
    capabilities: ["list", "create", "edit", "delete"]
    components: ["UserTable", "AddUserForm", "UserModal"]
  }
]

locators: {
  "btn:refresh": '[data-testid="refresh-button"]'
  "table:users": '[data-testid="users-table"]'
  "modal:addUser": '[data-testid="add-user-modal"]'
}

flows: [
  {
    id: "user_management"
    steps: [
      { visit: "users:management" },
      { expect: { locator: "table:users", state: "visible" } }
    ]
  }
]
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-v2-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v2AssemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand({ verbose: true }, mockConfig, "test-v2-spec");

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify React components generated
      const componentsDir = path.join(TEST_OUTPUT_DIR, "src", "components");

      const dashboardComponent = path.join(componentsDir, "DashboardOverviewPage.tsx");
      expect(await fs.pathExists(dashboardComponent)).toBe(true);

      const dashboardContent = await fs.readFile(dashboardComponent, "utf-8");
      expect(dashboardContent).toContain("DashboardOverviewPage");
      expect(dashboardContent).toContain('data-testid="dashboard:overview"');
      expect(dashboardContent).toContain("view, refresh");
      expect(dashboardContent).toContain("<div>StatsCards</div>");
      expect(dashboardContent).toContain("<div>ActivityFeed</div>");

      const usersComponent = path.join(componentsDir, "UsersManagementPage.tsx");
      expect(await fs.pathExists(usersComponent)).toBe(true);

      const usersContent = await fs.readFile(usersComponent, "utf-8");
      expect(usersContent).toContain("UsersManagementPage");
      expect(usersContent).toContain('data-testid="users:management"');
      expect(usersContent).toContain("list, create, edit, delete");
      expect(usersContent).toContain("<div>UserTable</div>");
      expect(usersContent).toContain("<div>AddUserForm</div>");
    });
  });

  describe("V2 Flow-Based Test Generation", () => {
    test("should generate Playwright tests from flows", async () => {
      const v2AssemblyContent = `
package testapp

product: {
  name: "E-commerce App"
  goals: ["Enable online shopping"]
}

ui: routes: [
  {
    id: "products:list"
    path: "/products"
    capabilities: ["view", "search"]
  },
  {
    id: "cart:checkout"
    path: "/checkout"
    capabilities: ["review", "pay"]
  }
]

locators: {
  "btn:addToCart": '[data-testid="add-to-cart"]'
  "field:search": '[data-testid="search-products"]'
  "btn:checkout": '[data-testid="proceed-checkout"]'
  "form:payment": '[data-testid="payment-form"]'
}

flows: [
  {
    id: "product_search"
    preconditions: { role: "customer" }
    steps: [
      { visit: "products:list" },
      { fill: { locator: "field:search", value: "laptop" } },
      { expect: { locator: "btn:addToCart", state: "visible" } }
    ]
  },
  {
    id: "checkout_flow"
    preconditions: { role: "customer", seed: [{ factory: "cart_with_items", as: "cart" }] }
    steps: [
      { visit: "cart:checkout" },
      { expect: { locator: "form:payment", state: "enabled" } },
      { click: "btn:checkout" },
      { expect_api: { method: "POST", path: "/api/orders", status: 201 } }
    ]
    variants: [
      { name: "guest_checkout", override: { preconditions: { role: "guest" } } }
    ]
  }
]

testability: {
  network: { stub: true, passthrough: ["/api/health"] }
  clock: { fixed: "2024-01-15T10:00:00Z" }
  seeds: {
    factories: {
      cart_with_items: {
        items: [{ id: 1, name: "Laptop", price: 999.99 }]
      }
    }
  }
  quality_gates: {
    a11y: { axe_severity_max: "moderate" }
    perf: { p95_nav_ms_max: 2000 }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-v2-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v2AssemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand({ verbose: true }, mockConfig, "test-v2-spec");

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify Playwright test files generated
      const flowsDir = path.join(TEST_OUTPUT_DIR, "tests", "flows");

      const searchTestFile = path.join(flowsDir, "product_search.test.ts");
      expect(await fs.pathExists(searchTestFile)).toBe(true);

      const searchTestContent = await fs.readFile(searchTestFile, "utf-8");
      expect(searchTestContent).toContain("import { test, expect } from '@playwright/test'");
      expect(searchTestContent).toContain("product_search flow test");
      expect(searchTestContent).toContain("page.goto('/products')");
      expect(searchTestContent).toContain(
        "page.locator('[data-testid=\"search-products\"]').fill('laptop')",
      );
      expect(searchTestContent).toContain("page.locator('[data-testid=\"add-to-cart\"]')");
      expect(searchTestContent).toContain("toBeVisible()");

      const checkoutTestFile = path.join(flowsDir, "checkout_flow.test.ts");
      expect(await fs.pathExists(checkoutTestFile)).toBe(true);

      const checkoutTestContent = await fs.readFile(checkoutTestFile, "utf-8");
      expect(checkoutTestContent).toContain("checkout_flow flow test");
      expect(checkoutTestContent).toContain("page.goto('/checkout')");
      expect(checkoutTestContent).toContain("page.locator('[data-testid=\"payment-form\"]')");
      expect(checkoutTestContent).toContain(
        "page.locator('[data-testid=\"proceed-checkout\"]').click()",
      );
      expect(checkoutTestContent).toContain("POST /api/orders");
      expect(checkoutTestContent).toContain("response.status() === 201");

      // Check variant test generation
      expect(checkoutTestContent).toContain("guest_checkout variant");
    });
  });

  describe("V2 API Spec Generation", () => {
    test("should generate OpenAPI spec from components and paths", async () => {
      const v2AssemblyContent = `
package apiapp

product: {
  name: "API Test"
  goals: ["Provide REST API"]
}

components: schemas: {
  User: {
    example: {
      id: 1
      name: "John Doe"
      email: "john@example.com"
      role: "user"
    }
    rules: {
      email: "valid email format"
      role: "one of: user, admin"
    }
  }
  CreateUserRequest: {
    example: {
      name: "Jane Smith"
      email: "jane@example.com"
    }
    rules: {
      name: "required"
      email: "required, valid format"
    }
  }
}

paths: {
  "/api/users": {
    get: { 
      response: { 
        $ref: "#/components/schemas/User"
        example: [
          { id: 1, name: "John Doe", email: "john@example.com", role: "user" },
          { id: 2, name: "Jane Smith", email: "jane@example.com", role: "admin" }
        ]
      }
    }
    post: {
      request: { $ref: "#/components/schemas/CreateUserRequest" }
      response: { $ref: "#/components/schemas/User" }
      status: 201
    }
  }
  "/api/users/:id": {
    get: { response: { $ref: "#/components/schemas/User" } }
    put: {
      request: { $ref: "#/components/schemas/CreateUserRequest" }
      response: { $ref: "#/components/schemas/User" }
    }
    delete: { status: 204 }
  }
}

ui: routes: [
  {
    id: "users:list"
    path: "/users"
    capabilities: ["list"]
  }
]

flows: []
locators: {}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-v2-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, v2AssemblyContent);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand({ verbose: true }, mockConfig, "test-v2-spec");

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify OpenAPI spec generated
      const openapiFile = path.join(TEST_OUTPUT_DIR, "api", "openapi.json");
      expect(await fs.pathExists(openapiFile)).toBe(true);

      const openapiContent = JSON.parse(await fs.readFile(openapiFile, "utf-8"));
      expect(openapiContent.openapi).toBe("3.0.0");
      expect(openapiContent.info.title).toBe("API Test");

      // Check components
      expect(openapiContent.components.schemas.User).toBeDefined();
      expect(openapiContent.components.schemas.User.example).toEqual({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        role: "user",
      });

      expect(openapiContent.components.schemas.CreateUserRequest).toBeDefined();

      // Check paths
      expect(openapiContent.paths["/api/users"]).toBeDefined();
      expect(openapiContent.paths["/api/users"].get).toBeDefined();
      expect(openapiContent.paths["/api/users"].post).toBeDefined();
      expect(openapiContent.paths["/api/users/{id}"]).toBeDefined();

      // Check response schemas reference components
      expect(
        openapiContent.paths["/api/users"].get.responses["200"].content["application/json"].schema
          .$ref,
      ).toBe("#/components/schemas/User");
    });
  });

  describe("Mixed V2 Features", () => {
    test("should handle complex v2 app with all features", async () => {
      const complexV2Assembly = `
package complexapp

product: {
  name: "Complex App"
  goals: ["Demonstrate full v2 capabilities"]
  roles: ["admin", "user", "guest"]
  slos: { p95_page_load_ms: 1500, uptime: "99.95%" }
}

domain: {
  enums: {
    OrderStatus: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"]
    PaymentMethod: ["CREDIT_CARD", "PAYPAL", "BANK_TRANSFER"]
  }
  permissions: {
    create_order: ["user", "admin"]
    cancel_order: ["admin"]
    view_analytics: ["admin"]
  }
}

ui: routes: [
  {
    id: "orders:dashboard"
    path: "/orders"
    capabilities: ["view", "create", "filter", "export"]
    components: ["OrdersList", "CreateOrderButton", "FilterPanel", "ExportDialog"]
  }
]

locators: {
  "btn:createOrder": '[data-testid="create-order"]'
  "select:status": '[data-testid="status-filter"]'
  "btn:export": '[data-testid="export-orders"]'
}

flows: [
  {
    id: "order_management"
    preconditions: { 
      role: "admin"
      seed: [{ factory: "orders_dataset", as: "orders" }]
    }
    steps: [
      { visit: "orders:dashboard" },
      { expect: { locator: "btn:createOrder", state: "visible" } },
      { click: "select:status" },
      { expect: { locator: "select:status", text: { contains: "PENDING" } } }
    ]
  }
]

components: schemas: {
  Order: {
    example: {
      id: 1001
      status: "PENDING"
      items: [
        { name: "Product A", quantity: 2, price: 29.99 }
      ]
      total: 59.98
    }
    rules: {
      status: "must be valid OrderStatus enum"
      total: "> 0"
    }
  }
}

paths: {
  "/api/orders": {
    get: { response: { $ref: "#/components/schemas/Order", example: [] } }
    post: {
      request: { $ref: "#/components/schemas/Order" }
      response: { $ref: "#/components/schemas/Order" }
    }
  }
}

testability: {
  network: { stub: true }
  seeds: {
    factories: {
      orders_dataset: {
        count: 100
        status_distribution: { PENDING: 0.4, CONFIRMED: 0.3, SHIPPED: 0.2, DELIVERED: 0.1 }
      }
    }
  }
  quality_gates: {
    a11y: { axe_severity_max: "serious" }
    perf: { p95_nav_ms_max: 1500 }
  }
}

ops: {
  feature_flags: ["advanced_filtering", "export_analytics"]
  environments: ["staging", "production"]
  security: {
    auth: "oauth2"
    scopes: ["orders:read", "orders:write", "analytics:read"]
  }
}

stateModels: {
  orderFlow: {
    id: "order_lifecycle"
    initial: "pending"
    states: {
      pending: { on: { confirm: "confirmed", cancel: "cancelled" } }
      confirmed: { on: { ship: "shipped", cancel: "cancelled" } }
      shipped: { on: { deliver: "delivered" } }
      delivered: { on: {} }
      cancelled: { on: {} }
    }
  }
}
      `;

      const assemblyPath = path.join(TEST_OUTPUT_DIR, ".arbiter", "test-v2-spec", "assembly.cue");
      await fs.writeFile(assemblyPath, complexV2Assembly);

      // Change to test output directory and run generate
      const originalCwd = process.cwd();
      process.chdir(TEST_OUTPUT_DIR);

      const result = await generateCommand({ verbose: true }, mockConfig, "test-v2-spec");

      // Restore original directory
      process.chdir(originalCwd);

      expect(result).toBe(0);

      // Verify all v2 artifacts generated
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "src", "components"))).toBe(true);
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "tests", "flows"))).toBe(true);
      expect(await fs.pathExists(path.join(TEST_OUTPUT_DIR, "api"))).toBe(true);

      // Check component generation with all features
      const componentFile = path.join(
        TEST_OUTPUT_DIR,
        "src",
        "components",
        "OrdersDashboardPage.tsx",
      );
      expect(await fs.pathExists(componentFile)).toBe(true);

      const componentContent = await fs.readFile(componentFile, "utf-8");
      expect(componentContent).toContain("view, create, filter, export");
      expect(componentContent).toContain("<div>OrdersList</div>");
      expect(componentContent).toContain("<div>CreateOrderButton</div>");
      expect(componentContent).toContain("<div>FilterPanel</div>");

      // Check flow test with complex preconditions
      const flowTestFile = path.join(TEST_OUTPUT_DIR, "tests", "flows", "order_management.test.ts");
      expect(await fs.pathExists(flowTestFile)).toBe(true);

      const flowTestContent = await fs.readFile(flowTestFile, "utf-8");
      expect(flowTestContent).toContain("order_management flow test");
      expect(flowTestContent).toContain("Role: admin");
      expect(flowTestContent).toContain("Factory: orders_dataset");
      expect(flowTestContent).toContain("page.locator('[data-testid=\"status-filter\"]').click()");
      expect(flowTestContent).toContain("toContainText('PENDING')");

      // Check API spec includes all schemas
      const openapiFile = path.join(TEST_OUTPUT_DIR, "api", "openapi.json");
      expect(await fs.pathExists(openapiFile)).toBe(true);

      const openapiContent = JSON.parse(await fs.readFile(openapiFile, "utf-8"));
      expect(openapiContent.components.schemas.Order).toBeDefined();
      expect(openapiContent.paths["/api/orders"]).toBeDefined();
    });
  });
});
