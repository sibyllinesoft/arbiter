import { describe, expect, it } from "bun:test";
import type { GroupSpec } from "@arbiter/shared-types/cli";
import type { ProjectStructureConfig } from "../../../types.js";
import {
  DefaultPathRouter,
  type PathRouterInput,
  createRouter,
  validateGroupReferences,
} from "../core/router.js";

const baseStructure: ProjectStructureConfig = {
  clientsDirectory: "clients",
  servicesDirectory: "services",
  packagesDirectory: "packages",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
};

describe("DefaultPathRouter", () => {
  describe("by-type mode (default)", () => {
    it("routes services to services directory", () => {
      const router = new DefaultPathRouter();
      const input: PathRouterInput = {
        artifactType: "service",
        artifactKey: "api",
        artifactSlug: "api",
        artifactConfig: {},
        groups: {},
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("services/api");
    });

    it("routes clients to clients directory", () => {
      const router = new DefaultPathRouter();
      const input: PathRouterInput = {
        artifactType: "client",
        artifactKey: "web",
        artifactSlug: "web",
        artifactConfig: {},
        groups: {},
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("clients/web");
    });

    it("routes packages to packages directory", () => {
      const router = new DefaultPathRouter();
      const input: PathRouterInput = {
        artifactType: "package",
        artifactKey: "shared",
        artifactSlug: "shared",
        artifactConfig: {},
        groups: {},
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("packages/shared");
    });

    it("routes tools to tools directory", () => {
      const router = new DefaultPathRouter();
      const input: PathRouterInput = {
        artifactType: "tool",
        artifactKey: "cli",
        artifactSlug: "cli",
        artifactConfig: {},
        groups: {},
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("tools/cli");
    });

    it("uses custom structure directories", () => {
      const router = new DefaultPathRouter();
      const customStructure: ProjectStructureConfig = {
        ...baseStructure,
        servicesDirectory: "apps/backend",
      };
      const input: PathRouterInput = {
        artifactType: "service",
        artifactKey: "api",
        artifactSlug: "api",
        artifactConfig: {},
        groups: {},
        projectDir: "/project",
        structureConfig: customStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("apps/backend/api");
    });
  });

  describe("by-group mode", () => {
    const groups: Record<string, GroupSpec> = {
      billing: {
        name: "Billing",
        description: "Billing feature group",
      },
      commerce: {
        name: "Commerce",
        description: "Commerce domain",
        directory: "ecommerce",
      },
    };

    it("routes grouped services to group/type/artifact", () => {
      const router = new DefaultPathRouter({ mode: "by-group" });
      const input: PathRouterInput = {
        artifactType: "service",
        artifactKey: "payment-api",
        artifactSlug: "payment-api",
        artifactConfig: { memberOf: "billing" },
        groups,
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("billing/services/payment-api");
    });

    it("uses custom group directory when specified", () => {
      const router = new DefaultPathRouter({ mode: "by-group" });
      const input: PathRouterInput = {
        artifactType: "service",
        artifactKey: "checkout",
        artifactSlug: "checkout",
        artifactConfig: { memberOf: "commerce" },
        groups,
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("ecommerce/services/checkout");
    });

    it("falls back to by-type for ungrouped artifacts", () => {
      const router = new DefaultPathRouter({ mode: "by-group" });
      const input: PathRouterInput = {
        artifactType: "service",
        artifactKey: "api",
        artifactSlug: "api",
        artifactConfig: {},
        groups,
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("services/api");
    });

    it("falls back to by-type for unknown groups", () => {
      const router = new DefaultPathRouter({ mode: "by-group" });
      const input: PathRouterInput = {
        artifactType: "service",
        artifactKey: "api",
        artifactSlug: "api",
        artifactConfig: { memberOf: "nonexistent" },
        groups,
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("services/api");
    });
  });

  describe("nested groups", () => {
    const nestedGroups: Record<string, GroupSpec> = {
      platform: {
        name: "Platform",
        description: "Platform features",
      },
      billing: {
        name: "Billing",
        description: "Billing feature group",
        memberOf: "platform",
      },
      subscriptions: {
        name: "Subscriptions",
        description: "Subscription management",
        memberOf: "billing",
      },
    };

    it("resolves nested group paths correctly", () => {
      const router = new DefaultPathRouter({ mode: "by-group" });
      const input: PathRouterInput = {
        artifactType: "service",
        artifactKey: "recurring-payments",
        artifactSlug: "recurring-payments",
        artifactConfig: { memberOf: "subscriptions" },
        groups: nestedGroups,
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("platform/billing/subscriptions/services/recurring-payments");
    });

    it("handles single level nesting", () => {
      const router = new DefaultPathRouter({ mode: "by-group" });
      const input: PathRouterInput = {
        artifactType: "client",
        artifactKey: "invoice-ui",
        artifactSlug: "invoice-ui",
        artifactConfig: { memberOf: "billing" },
        groups: nestedGroups,
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("platform/billing/clients/invoice-ui");
    });
  });

  describe("group structure overrides", () => {
    const groupsWithOverrides: Record<string, GroupSpec> = {
      mobile: {
        name: "Mobile",
        description: "Mobile apps",
        structure: {
          clientsDirectory: "apps",
        },
      },
    };

    it("uses group structure override for type directory", () => {
      const router = new DefaultPathRouter({ mode: "by-group" });
      const input: PathRouterInput = {
        artifactType: "client",
        artifactKey: "ios-app",
        artifactSlug: "ios-app",
        artifactConfig: { memberOf: "mobile" },
        groups: groupsWithOverrides,
        projectDir: "/project",
        structureConfig: baseStructure,
      };

      const result = router.resolve(input);
      expect(result.root).toBe("mobile/apps/ios-app");
    });
  });
});

describe("createRouter", () => {
  it("creates DefaultPathRouter with by-type mode by default", async () => {
    const router = await createRouter(undefined, "/project");
    expect(router).toBeInstanceOf(DefaultPathRouter);
  });

  it("creates DefaultPathRouter with by-group mode when configured", async () => {
    const router = await createRouter({ mode: "by-group" }, "/project");
    expect(router).toBeInstanceOf(DefaultPathRouter);
  });
});

describe("validateGroupReferences", () => {
  const groups: Record<string, GroupSpec> = {
    billing: { name: "Billing" },
    commerce: { name: "Commerce", memberOf: "platform" },
  };

  it("returns empty array when all references are valid", () => {
    const artifacts = [{ key: "api", config: { memberOf: "billing" }, type: "service" as const }];
    const warnings = validateGroupReferences(artifacts, { billing: { name: "Billing" } });
    expect(warnings).toEqual([]);
  });

  it("returns warning for unknown artifact group reference", () => {
    const artifacts = [
      { key: "api", config: { memberOf: "nonexistent" }, type: "service" as const },
    ];
    const cleanGroups = { billing: { name: "Billing" } };
    const warnings = validateGroupReferences(artifacts, cleanGroups);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("api");
    expect(warnings[0]).toContain("nonexistent");
  });

  it("returns warning for unknown group parent reference", () => {
    const warnings = validateGroupReferences([], groups);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("commerce");
    expect(warnings[0]).toContain("platform");
  });

  it("ignores artifacts without memberOf", () => {
    const artifacts = [{ key: "api", config: {}, type: "service" as const }];
    const warnings = validateGroupReferences(artifacts, groups);
    // Only the commerce->platform warning should be present
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("platform");
  });
});
