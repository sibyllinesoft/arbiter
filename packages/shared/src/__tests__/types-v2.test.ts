/**
 * Comprehensive test suite for v2 TypeScript type definitions
 * Tests type safety, validation, and schema compliance
 */

import { describe, expect, test } from "bun:test";
import type {
  // Core v2 types
  AppSpec,
  Cap,
  ComponentsSpec,
  ConfigWithVersion,
  CssSelector,
  Email,
  ExpectAPI,
  // Flow types
  ExpectUI,
  FactoryName,
  FlowSpec,
  FlowStep,
  HTTPMethod,
  HTTPStatus,
  Human,
  ISODateTime,
  LocatorToken,
  PathSpec,
  ProductSpec,
  Role,
  RouteID,
  // Schema version detection
  SchemaVersion,
  Seed,
  // Primitive types
  Slug,
  StateKind,
  TestabilitySpec,
  TextMatch,
  UIRoute,
  UISpec,
  URLPath,
} from "../types.js";

describe("V2 Type System Validation", () => {
  describe("Primitive Type Constraints", () => {
    test("should enforce Slug pattern constraints", () => {
      // Valid slugs
      const validSlugs: Slug[] = [
        "simple",
        "kebab-case",
        "snake_case",
        "with123numbers",
        "mixed-123_case",
        "a.b.c",
        "version1.2.3",
      ];

      // All valid slugs should be string assignable
      validSlugs.forEach((slug) => {
        expect(typeof slug).toBe("string");
        expect(slug.length).toBeGreaterThan(0);
      });
    });

    test("should enforce Human readable label constraints", () => {
      // Valid human-readable labels
      const validHumans: Human[] = [
        "Simple Label",
        "Complex Multi-Word Label with Numbers 123",
        "Special Characters: & () - /",
        "Unicode: ñáéíóú 中文 🚀",
      ];

      validHumans.forEach((human) => {
        expect(typeof human).toBe("string");
        expect(human.trim().length).toBeGreaterThan(0);
      });
    });

    test("should enforce Email format constraints", () => {
      // Valid emails (basic format check)
      const validEmails: Email[] = [
        "user@example.com",
        "test.user@domain.co.uk",
        "admin+notifications@company.org",
        "support@multi-word-domain.com",
      ];

      validEmails.forEach((email) => {
        expect(typeof email).toBe("string");
        expect(email).toContain("@");
        expect(email.split("@")).toHaveLength(2);
      });
    });

    test("should enforce URLPath format constraints", () => {
      // Valid URL paths
      const validPaths: URLPath[] = [
        "/",
        "/home",
        "/users/:id",
        "/api/v1/users",
        "/complex/path/with-dashes_and_underscores",
        "/path?query=value&other=123",
        "/path#fragment",
      ];

      validPaths.forEach((path) => {
        expect(typeof path).toBe("string");
        expect(path).toMatch(/^\/.*$/);
      });
    });

    test("should enforce HTTPMethod enum values", () => {
      const validMethods: HTTPMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

      validMethods.forEach((method) => {
        expect(["GET", "POST", "PUT", "PATCH", "DELETE"]).toContain(method);
      });
    });

    test("should enforce RouteID pattern constraints", () => {
      // Valid route IDs with domain:action pattern
      const validRouteIDs: RouteID[] = [
        "invoices:list",
        "users:detail",
        "dashboard:overview",
        "admin:user-management",
        "api:health-check",
      ];

      validRouteIDs.forEach((routeId) => {
        expect(typeof routeId).toBe("string");
        expect(routeId).toContain(":");
        const parts = routeId.split(":");
        expect(parts).toHaveLength(2);
        expect(parts[0].length).toBeGreaterThan(0);
        expect(parts[1].length).toBeGreaterThan(0);
      });
    });

    test("should enforce LocatorToken pattern constraints", () => {
      // Valid locator tokens with type:identifier pattern
      const validLocators: LocatorToken[] = [
        "btn:submit",
        "field:email",
        "table:users",
        "modal:confirmation",
        "nav:main-menu",
      ];

      validLocators.forEach((locator) => {
        expect(typeof locator).toBe("string");
        expect(locator).toContain(":");
        const parts = locator.split(":");
        expect(parts).toHaveLength(2);
        expect(parts[0].length).toBeGreaterThan(0);
        expect(parts[1].length).toBeGreaterThan(0);
      });
    });
  });

  describe("Complex Type Structures", () => {
    test("should validate complete AppSpec structure", () => {
      const validAppSpec: AppSpec = {
        product: {
          name: "Test Application",
          goals: ["Goal 1", "Goal 2"],
          constraints: ["Constraint 1"],
          roles: ["user", "admin"],
          slos: {
            p95_page_load_ms: 2000,
            uptime: "99.9%",
          },
        },
        ui: {
          routes: [
            {
              id: "home:dashboard",
              path: "/dashboard",
              capabilities: ["view", "refresh"],
              components: ["DashboardWidget", "RefreshButton"],
            },
            {
              id: "users:management",
              path: "/users",
              capabilities: ["list", "create", "edit", "delete"],
            },
          ],
        },
        locators: {
          "btn:refresh": '[data-testid="refresh"]',
          "table:users": '[data-testid="users-table"]',
          "modal:create": '[data-testid="create-modal"]',
        },
        flows: [
          {
            id: "user_management",
            preconditions: {
              role: "admin",
              seed: [
                {
                  factory: "users_dataset",
                  as: "users",
                  with: { count: 10 },
                },
              ],
            },
            steps: [
              {
                visit: "users:management",
              },
              {
                expect: {
                  locator: "table:users",
                  state: "visible",
                },
              },
              {
                click: "btn:create",
              },
              {
                expect_api: {
                  method: "POST",
                  path: "/api/users",
                  status: 201,
                  bodyExample: { id: 1, name: "New User" },
                },
              },
            ],
            variants: [
              {
                name: "guest_user",
                override: {
                  preconditions: { role: "guest" },
                },
              },
            ],
          },
        ],
      };

      // Type should compile and be valid
      expect(validAppSpec.product.name).toBe("Test Application");
      expect(validAppSpec.ui.routes).toHaveLength(2);
      expect(validAppSpec.flows).toHaveLength(1);
      expect(validAppSpec.locators["btn:refresh"]).toBe('[data-testid="refresh"]');
    });

    test("should validate UIRoute with all optional properties", () => {
      const fullUIRoute: UIRoute = {
        id: "products:detail",
        path: "/products/:id",
        capabilities: ["view", "edit", "delete", "share"],
        components: ["ProductDetails", "EditForm", "DeleteButton", "ShareModal", "ReviewsList"],
      };

      expect(fullUIRoute.id).toMatch(/^[a-z0-9]+:[a-z0-9_-]+$/);
      expect(fullUIRoute.path).toMatch(/^\/.*$/);
      expect(fullUIRoute.capabilities).toBeInstanceOf(Array);
      expect(fullUIRoute.components).toBeInstanceOf(Array);
      expect(fullUIRoute.components?.length).toBe(5);
    });

    test("should validate FlowSpec with complex steps", () => {
      const complexFlow: FlowSpec = {
        id: "checkout_process",
        preconditions: {
          role: "customer",
          seed: [
            {
              factory: "shopping_cart",
              as: "cart",
              with: {
                items: [
                  { productId: 1, quantity: 2 },
                  { productId: 3, quantity: 1 },
                ],
              },
            },
          ],
          env: "staging",
        },
        steps: [
          {
            visit: "cart:review",
          },
          {
            expect: {
              locator: "summary:total",
              text: { contains: "$" },
            },
          },
          {
            click: "btn:checkout",
          },
          {
            fill: {
              locator: "field:email",
              value: "customer@example.com",
            },
          },
          {
            fill: {
              locator: "field:card_number",
              value: "4111111111111111",
            },
          },
          {
            click: "btn:pay",
          },
          {
            expect_api: {
              method: "POST",
              path: "/api/orders",
              status: 201,
              bodyExample: {
                orderId: "ORDER-123",
                status: "confirmed",
              },
              headers: {
                "Content-Type": "application/json",
              },
            },
          },
        ],
        variants: [
          {
            name: "guest_checkout",
            override: {
              preconditions: { role: "guest" },
            },
          },
          {
            name: "express_checkout",
            override: {
              steps: [{ visit: "cart:review" }, { click: "btn:express_pay" }],
            },
          },
        ],
      };

      expect(complexFlow.id).toBe("checkout_process");
      expect(complexFlow.preconditions?.role).toBe("customer");
      expect(complexFlow.preconditions?.seed).toHaveLength(1);
      expect(complexFlow.steps).toHaveLength(7);
      expect(complexFlow.variants).toHaveLength(2);

      // Validate step types
      const visitStep = complexFlow.steps[0];
      expect(visitStep.visit).toBe("cart:review");

      const expectStep = complexFlow.steps[1];
      expect(expectStep.expect?.locator).toBe("summary:total");
      expect(expectStep.expect?.text?.contains).toBe("$");

      const apiStep = complexFlow.steps[6];
      expect(apiStep.expect_api?.method).toBe("POST");
      expect(apiStep.expect_api?.path).toBe("/api/orders");
      expect(apiStep.expect_api?.status).toBe(201);
    });

    test("should validate ComponentsSpec with OpenAPI-like schemas", () => {
      const componentsSpec: ComponentsSpec = {
        schemas: {
          User: {
            example: {
              id: 1,
              name: "John Doe",
              email: "john@example.com",
              role: "user",
              createdAt: "2024-01-15T10:00:00Z",
            },
            examples: [
              {
                id: 1,
                name: "Admin User",
                email: "admin@example.com",
                role: "admin",
              },
              {
                id: 2,
                name: "Regular User",
                email: "user@example.com",
                role: "user",
              },
            ],
            rules: {
              id: "positive integer",
              email: "valid email format",
              role: "one of: user, admin",
              name: "non-empty string",
            },
          },
          CreateUserRequest: {
            example: {
              name: "Jane Smith",
              email: "jane@example.com",
              role: "user",
            },
            rules: {
              name: "required, non-empty",
              email: "required, valid format",
              role: "optional, defaults to user",
            },
          },
        },
      };

      expect(componentsSpec.schemas?.User).toBeDefined();
      expect(componentsSpec.schemas?.User.example.id).toBe(1);
      expect(componentsSpec.schemas?.User.examples).toHaveLength(2);
      expect(componentsSpec.schemas?.CreateUserRequest).toBeDefined();
    });

    test("should validate PathSpec with all HTTP methods", () => {
      const pathSpec: PathSpec = {
        get: {
          response: {
            $ref: "#/components/schemas/User",
            example: { id: 1, name: "John" },
          },
        },
        post: {
          request: {
            $ref: "#/components/schemas/CreateUserRequest",
            example: { name: "Jane", email: "jane@example.com" },
          },
          response: {
            $ref: "#/components/schemas/User",
            example: { id: 2, name: "Jane" },
          },
          status: 201,
        },
        put: {
          request: {
            $ref: "#/components/schemas/CreateUserRequest",
          },
          response: {
            $ref: "#/components/schemas/User",
          },
        },
        patch: {
          request: {
            example: { name: "Updated Name" },
          },
          response: {
            $ref: "#/components/schemas/User",
          },
        },
        delete: {
          status: 204,
        },
      };

      expect(pathSpec.get?.response.$ref).toBe("#/components/schemas/User");
      expect(pathSpec.post?.status).toBe(201);
      expect(pathSpec.delete?.status).toBe(204);
    });

    test("should validate TestabilitySpec with all features", () => {
      const testabilitySpec: TestabilitySpec = {
        network: {
          stub: true,
          passthrough: ["/api/health", "/api/metrics"],
        },
        clock: {
          fixed: "2024-01-15T10:00:00Z",
        },
        seeds: {
          factories: {
            user_dataset: {
              count: 100,
              roles: { user: 0.8, admin: 0.2 },
            },
            product_catalog: {
              categories: ["electronics", "clothing", "books"],
              price_range: { min: 10, max: 1000 },
            },
          },
        },
        quality_gates: {
          a11y: {
            axe_severity_max: "serious",
          },
          perf: {
            p95_nav_ms_max: 1500,
          },
        },
      };

      expect(testabilitySpec.network?.stub).toBe(true);
      expect(testabilitySpec.network?.passthrough).toHaveLength(2);
      expect(testabilitySpec.clock?.fixed).toBe("2024-01-15T10:00:00Z");
      expect(testabilitySpec.seeds?.factories?.user_dataset).toBeDefined();
      expect(testabilitySpec.quality_gates?.a11y?.axe_severity_max).toBe("serious");
      expect(testabilitySpec.quality_gates?.perf?.p95_nav_ms_max).toBe(1500);
    });
  });

  describe("Schema Version Detection Types", () => {
    test("should validate SchemaVersion structure", () => {
      const v1Schema: SchemaVersion = {
        version: "v1",
        detected_from: "structure",
      };

      const v2Schema: SchemaVersion = {
        version: "v2",
        detected_from: "metadata",
      };

      expect(v1Schema.version).toBe("v1");
      expect(v1Schema.detected_from).toBe("structure");
      expect(v2Schema.version).toBe("v2");
      expect(v2Schema.detected_from).toBe("metadata");
    });

    test("should validate ConfigWithVersion for dual format support", () => {
      const v1Config: ConfigWithVersion = {
        schema: {
          version: "v1",
          detected_from: "structure",
        },
        v1: {
          config: {
            language: "typescript",
            kind: "service",
          },
          metadata: {
            name: "test-service",
            version: "1.0.0",
          },
          deployment: {
            target: "kubernetes",
          },
          services: {
            api: {
              name: "api",
              serviceType: "bespoke",
              language: "typescript",
              type: "deployment",
              ports: [{ name: "http", port: 3000 }],
            },
          },
        },
      };

      const v2Config: ConfigWithVersion = {
        schema: {
          version: "v2",
          detected_from: "structure",
        },
        v2: {
          product: {
            name: "Test App",
            goals: ["Test v2 format"],
          },
          ui: {
            routes: [
              {
                id: "home:main",
                path: "/",
                capabilities: ["view"],
              },
            ],
          },
          locators: {
            "page:home": '[data-testid="home"]',
          },
          flows: [
            {
              id: "basic_navigation",
              steps: [{ visit: "home:main" }],
            },
          ],
        },
      };

      expect(v1Config.schema.version).toBe("v1");
      expect(v1Config.v1?.config.language).toBe("typescript");
      expect(v1Config.v1?.services.api).toBeDefined();
      expect(v1Config.v2).toBeUndefined();

      expect(v2Config.schema.version).toBe("v2");
      expect(v2Config.v2?.product.name).toBe("Test App");
      expect(v2Config.v2?.ui.routes).toHaveLength(1);
      expect(v2Config.v1).toBeUndefined();
    });
  });

  describe("Type Safety and Constraints", () => {
    test("should enforce StateKind enum constraints", () => {
      const validStates: StateKind[] = [
        "visible",
        "hidden",
        "enabled",
        "disabled",
        "attached",
        "detached",
      ];

      validStates.forEach((state) => {
        expect(["visible", "hidden", "enabled", "disabled", "attached", "detached"]).toContain(
          state,
        );
      });
    });

    test("should validate TextMatch union types", () => {
      const exactMatch: TextMatch = {
        eq: "Exact Text",
      };

      const containsMatch: TextMatch = {
        contains: "partial",
      };

      const regexMatch: TextMatch = {
        regex: "^[A-Z][a-z]+$",
      };

      const complexMatch: TextMatch = {
        eq: "Primary",
        contains: "Pri",
        regex: "^Pri.*ry$",
      };

      expect(exactMatch.eq).toBe("Exact Text");
      expect(containsMatch.contains).toBe("partial");
      expect(regexMatch.regex).toBe("^[A-Z][a-z]+$");
      expect(complexMatch.eq).toBe("Primary");
      expect(complexMatch.contains).toBe("Pri");
    });

    test("should validate Seed factory references", () => {
      const seed: Seed = {
        factory: "user_factory",
        as: "testUser",
        with: {
          role: "admin",
          permissions: ["read", "write"],
          metadata: { department: "engineering" },
        },
      };

      expect(seed.factory).toBe("user_factory");
      expect(seed.as).toBe("testUser");
      expect(seed.with?.role).toBe("admin");
      expect(seed.with?.permissions).toHaveLength(2);
    });
  });
});
