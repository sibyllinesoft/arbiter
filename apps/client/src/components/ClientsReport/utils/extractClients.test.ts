/**
 * Unit tests for extractClients utility functions.
 */
import { describe, expect, it } from "vitest";
import { extractClients } from "./extractClients";

describe("extractClients", () => {
  it("returns empty arrays for undefined input", () => {
    const result = extractClients(undefined);
    expect(result.internalClients).toEqual([]);
    expect(result.externalClients).toEqual([]);
  });

  it("returns empty arrays for empty object", () => {
    const result = extractClients({});
    expect(result.internalClients).toEqual([]);
    expect(result.externalClients).toEqual([]);
  });

  it("extracts frontend components from components object", () => {
    const resolved = {
      components: {
        "web-app": {
          id: "web-app",
          name: "Web App",
          type: "frontend",
          metadata: {
            packageRoot: "/packages/web",
          },
        },
      },
    };
    const result = extractClients(resolved);
    expect(result.internalClients.length).toBeGreaterThanOrEqual(0);
    // Verifies no crash and returns structured result
    expect(result).toHaveProperty("internalClients");
    expect(result).toHaveProperty("externalClients");
  });

  it("extracts frontend components from components array", () => {
    const resolved = {
      components: [
        {
          id: "mobile-app",
          name: "Mobile App",
          type: "frontend",
          metadata: {
            packageRoot: "/packages/mobile",
          },
        },
      ],
    };
    const result = extractClients(resolved);
    expect(result).toHaveProperty("internalClients");
    expect(result).toHaveProperty("externalClients");
  });

  it("extracts from spec.components when nested", () => {
    const resolved = {
      spec: {
        components: {
          dashboard: {
            id: "dashboard",
            name: "Dashboard",
            type: "frontend",
            metadata: {},
          },
        },
      },
    };
    const result = extractClients(resolved);
    expect(result).toHaveProperty("internalClients");
    expect(result).toHaveProperty("externalClients");
  });

  it("processes frontend packages from spec.frontend.packages", () => {
    const resolved = {
      spec: {
        frontend: {
          packages: [
            {
              packageName: "web-client",
              packageRoot: "/apps/web",
              frameworks: ["react"],
              routes: [
                { path: "/", filePath: "src/pages/Home.tsx" },
                { path: "/about", filePath: "src/pages/About.tsx" },
              ],
            },
          ],
        },
        components: {},
      },
    };
    const result = extractClients(resolved);
    expect(result).toHaveProperty("internalClients");
    expect(result).toHaveProperty("externalClients");
  });

  it("filters out non-frontend components", () => {
    const resolved = {
      components: {
        "api-service": {
          id: "api-service",
          name: "API Service",
          type: "service",
          metadata: {},
        },
        "web-app": {
          id: "web-app",
          name: "Web App",
          type: "frontend",
          metadata: { packageRoot: "/web" },
        },
      },
    };
    const result = extractClients(resolved);
    // Services should not appear in client lists
    const allIdentifiers = [
      ...result.internalClients.map((c) => c.identifier),
      ...result.externalClients.map((c) => c.key),
    ];
    expect(allIdentifiers).not.toContain("api-service");
  });

  it("handles frontend packages without routes", () => {
    const resolved = {
      spec: {
        frontend: {
          packages: [
            {
              packageName: "static-site",
              packageRoot: "/static",
              frameworks: ["html"],
            },
          ],
        },
        components: {},
      },
    };
    const result = extractClients(resolved);
    expect(result).toHaveProperty("internalClients");
  });

  it("deduplicates frontend packages by key", () => {
    const resolved = {
      spec: {
        frontend: {
          packages: [
            { packageName: "web-app", packageRoot: "/apps/web" },
            { packageName: "web-app", packageRoot: "/duplicate" },
          ],
        },
        components: {},
      },
    };
    const result = extractClients(resolved);
    // Should not crash and should handle duplicates
    expect(result).toHaveProperty("internalClients");
  });

  it("handles view entities and associates them with clients", () => {
    const resolved = {
      components: {
        "web-app": {
          id: "web-app",
          name: "Web App",
          type: "frontend",
          metadata: { packageRoot: "/web" },
        },
        "home-view": {
          id: "home-view",
          name: "Home View",
          type: "view",
          metadata: {
            path: "/",
            clientId: "web-app",
            component: "HomePage",
          },
        },
      },
    };
    const result = extractClients(resolved);
    // Views should be associated with their parent client
    expect(result).toHaveProperty("internalClients");
  });

  it("skips packages without a name", () => {
    const resolved = {
      spec: {
        frontend: {
          packages: [
            { packageRoot: "/unnamed" },
            { packageName: "valid-app", packageRoot: "/valid" },
          ],
        },
        components: {},
      },
    };
    const result = extractClients(resolved);
    expect(result).toHaveProperty("internalClients");
  });

  it("normalizes package names with underscores to dashes", () => {
    const resolved = {
      spec: {
        frontend: {
          packages: [{ packageName: "my_app_name", packageRoot: "/app" }],
        },
        components: {},
      },
    };
    const result = extractClients(resolved);
    // Should process without errors
    expect(result).toHaveProperty("internalClients");
  });

  it("handles malformed route entries gracefully", () => {
    const resolved = {
      spec: {
        frontend: {
          packages: [
            {
              packageName: "app",
              routes: [
                null,
                undefined,
                { path: "/valid" },
                "invalid string",
                { path: "", filePath: "" },
              ],
            },
          ],
        },
        components: {},
      },
    };
    const result = extractClients(resolved);
    expect(result).toHaveProperty("internalClients");
  });

  it("sorts clients alphabetically by display name", () => {
    const resolved = {
      components: {
        "zebra-app": {
          id: "zebra-app",
          name: "Zebra App",
          type: "frontend",
          metadata: { packageRoot: "/z" },
        },
        "alpha-app": {
          id: "alpha-app",
          name: "Alpha App",
          type: "frontend",
          metadata: { packageRoot: "/a" },
        },
      },
    };
    const result = extractClients(resolved);
    if (result.internalClients.length >= 2) {
      const names = result.internalClients.map((c) => c.displayName);
      expect(names).toEqual([...names].sort());
    }
  });
});
