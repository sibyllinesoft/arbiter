/**
 * Unit tests for the IR (Intermediate Representation) generator
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { IRGenerator } from "../../ir.ts";
import type { IRKind } from "../../types.ts";

describe("IRGenerator", () => {
  let generator: IRGenerator;

  beforeAll(() => {
    generator = new IRGenerator();
  });

  describe("Capabilities IR Generation", () => {
    it("should generate capabilities diagram data", async () => {
      const resolved = {
        capabilities: {
          "user.authentication": {
            name: "User Authentication",
            description: "Handle user login and logout",
            depends_on: [],
            complexity: "high",
            priority: "critical",
            owner: "security-team",
          },
          "user.profile": {
            name: "User Profile Management",
            description: "Manage user profile data",
            depends_on: ["user.authentication"],
            complexity: "medium",
            priority: "high",
            owner: "backend-team",
          },
          "dashboard.view": {
            name: "Dashboard View",
            description: "Display user dashboard",
            depends_on: ["user.authentication", "user.profile"],
            complexity: "medium",
            priority: "medium",
            owner: "frontend-team",
          },
        },
      };

      const result = await generator.generateIR("capabilities", resolved);

      expect(result.kind).toBe("capabilities");
      expect(result.data.type).toBe("directed_graph");
      expect(result.generated_at).toBeDefined();

      const data = result.data;
      expect(data.nodes).toBeDefined();
      expect(data.edges).toBeDefined();
      expect(data.groups).toBeDefined();

      // Check nodes
      const nodes = data.nodes as any[];
      expect(nodes.length).toBe(3);

      const authNode = nodes.find((n) => n.id === "user.authentication");
      expect(authNode).toBeDefined();
      expect(authNode.label).toBe("User Authentication");
      expect(authNode.type).toBe("capability");
      expect(authNode.domain).toBe("user");
      expect(authNode.properties.complexity).toBe("high");

      // Check edges (dependencies)
      const edges = data.edges as any[];
      expect(edges.length).toBe(3); // profile->auth, dashboard->auth, dashboard->profile

      const profileAuthEdge = edges.find(
        (e) => e.source === "user.authentication" && e.target === "user.profile",
      );
      expect(profileAuthEdge).toBeDefined();
      expect(profileAuthEdge.type).toBe("dependency");

      // Check groups (domains)
      const groups = data.groups as any[];
      expect(groups.length).toBeGreaterThan(0);

      const userGroup = groups.find((g) => g.id === "user");
      expect(userGroup).toBeDefined();
      expect(userGroup.nodeIds).toContain("user.authentication");
      expect(userGroup.nodeIds).toContain("user.profile");

      // Check metadata
      expect(data.metadata.totalCapabilities).toBe(3);
      expect(data.metadata.dependencies).toBe(3);
    });

    it("should handle empty capabilities gracefully", async () => {
      const resolved = { capabilities: {} };

      const result = await generator.generateIR("capabilities", resolved);

      expect(result.data.nodes).toEqual([]);
      expect(result.data.edges).toEqual([]);
      expect(result.data.groups).toEqual([]);
      expect(result.data.metadata.totalCapabilities).toBe(0);
    });

    it("should handle missing capabilities object", async () => {
      const resolved = {};

      const result = await generator.generateIR("capabilities", resolved);

      expect(result.data.nodes).toEqual([]);
      expect(result.data.edges).toEqual([]);
    });
  });

  describe("Flows IR Generation", () => {
    it("should generate flow diagram data", async () => {
      const resolved = {
        flows: {
          user_onboarding: {
            name: "User Onboarding",
            description: "Complete user registration process",
            trigger: "User visits signup",
            outcome: "User has active account",
            steps: [
              {
                name: "Landing Page Visit",
                action: "navigate_to_signup",
                actor: "user",
                description: "User arrives at signup page",
                estimated_duration: "30s",
                complexity: "low",
              },
              {
                name: "Form Submission",
                action: "submit_signup_form",
                actor: "user",
                description: "User fills and submits form",
                estimated_duration: "2m",
                complexity: "medium",
                branches: [
                  {
                    condition: "email_exists",
                    name: "Email Already Registered",
                    description: "Handle existing email",
                  },
                  {
                    condition: "validation_fails",
                    name: "Validation Error",
                    description: "Handle form validation errors",
                  },
                ],
              },
              {
                name: "Email Verification",
                action: "verify_email",
                actor: "system",
                description: "Send and verify email",
                estimated_duration: "5s",
                complexity: "medium",
              },
            ],
          },
        },
      };

      const result = await generator.generateIR("flows", resolved);

      expect(result.kind).toBe("flows");
      expect(result.data.type).toBe("flowchart");

      const data = result.data;
      expect(data.nodes).toBeDefined();
      expect(data.edges).toBeDefined();
      expect(data.flows).toBeDefined();

      // Check nodes (steps + decision nodes)
      const nodes = data.nodes as any[];
      expect(nodes.length).toBeGreaterThan(3); // 3 steps + 2 decision nodes

      const landingStep = nodes.find((n) => n.id === "user_onboarding.0");
      expect(landingStep).toBeDefined();
      expect(landingStep.label).toBe("Landing Page Visit");
      expect(landingStep.type).toBe("process");
      expect(landingStep.properties.actor).toBe("user");

      const formStep = nodes.find((n) => n.id === "user_onboarding.1");
      expect(formStep).toBeDefined();

      // Check decision nodes from branches
      const emailExistsNode = nodes.find((n) => n.id.includes("email_exists"));
      expect(emailExistsNode).toBeDefined();
      expect(emailExistsNode.type).toBe("decision");

      // Check edges (sequence flow)
      const edges = data.edges as any[];
      expect(edges.length).toBeGreaterThan(0);

      const sequenceEdge = edges.find(
        (e) => e.source === "user_onboarding.0" && e.target === "user_onboarding.1",
      );
      expect(sequenceEdge).toBeDefined();
      expect(sequenceEdge.type).toBe("sequence");

      // Check branch edges
      const branchEdge = edges.find((e) => e.type === "branch");
      expect(branchEdge).toBeDefined();

      // Check flows metadata
      const flows = data.flows as any[];
      expect(flows.length).toBe(1);
      expect(flows[0].name).toBe("User Onboarding");
      expect(flows[0].trigger).toBe("User visits signup");

      expect(data.metadata.totalFlows).toBe(1);
      expect(data.metadata.totalSteps).toBe(3);
      expect(data.metadata.totalDecisions).toBe(2);
    });

    it("should handle flows without branches", async () => {
      const resolved = {
        flows: {
          simple_flow: {
            name: "Simple Linear Flow",
            steps: [
              { name: "Step 1", action: "action1", actor: "user" },
              { name: "Step 2", action: "action2", actor: "system" },
            ],
          },
        },
      };

      const result = await generator.generateIR("flows", resolved);

      const nodes = result.data.nodes as any[];
      expect(nodes.length).toBe(2);
      expect(nodes.every((n) => n.type === "process")).toBe(true);

      const edges = result.data.edges as any[];
      expect(edges.length).toBe(1);
      expect(edges[0].type).toBe("sequence");
    });
  });

  describe("Dependencies IR Generation", () => {
    it("should generate dependencies diagram data", async () => {
      const resolved = {
        capabilities: {
          "user.auth": {
            name: "User Authentication",
            depends_on: [],
          },
          "user.profile": {
            name: "User Profile",
            depends_on: ["user.auth"],
          },
          "project.create": {
            name: "Project Creation",
            depends_on: ["user.auth"],
          },
        },
        services: {
          "auth-service": {
            name: "Authentication Service",
            technology: "Node.js",
            environment: "production",
            implements: ["user.auth"],
          },
          "user-service": {
            name: "User Management Service",
            technology: "Python",
            environment: "production",
            implements: ["user.profile"],
          },
          "project-service": {
            name: "Project Management Service",
            technology: "Go",
            environment: "production",
            implements: ["project.create"],
          },
        },
      };

      const result = await generator.generateIR("dependencies", resolved);

      expect(result.kind).toBe("dependencies");
      expect(result.data.type).toBe("layered_graph");

      const data = result.data;
      expect(data.nodes).toBeDefined();
      expect(data.edges).toBeDefined();
      expect(data.layers).toBeDefined();

      // Check nodes (capabilities + services)
      const nodes = data.nodes as any[];
      expect(nodes.length).toBe(6); // 3 capabilities + 3 services

      const capabilityNodes = nodes.filter((n) => n.type === "capability");
      expect(capabilityNodes.length).toBe(3);

      const serviceNodes = nodes.filter((n) => n.type === "service");
      expect(serviceNodes.length).toBe(3);

      const authService = serviceNodes.find((n) => n.id === "auth-service");
      expect(authService).toBeDefined();
      expect(authService.properties.technology).toBe("Node.js");

      // Check edges (dependencies + implementations)
      const edges = data.edges as any[];
      expect(edges.length).toBeGreaterThan(0);

      const dependsEdges = edges.filter((e) => e.type === "depends");
      expect(dependsEdges.length).toBe(2); // profile->auth, project->auth

      const implementsEdges = edges.filter((e) => e.type === "implements");
      expect(implementsEdges.length).toBe(3); // Each service implements one capability

      // Check layers
      const layers = data.layers as any[];
      expect(layers.length).toBe(2);

      const businessLayer = layers.find((l) => l.id === "business");
      expect(businessLayer).toBeDefined();
      expect(businessLayer.nodeIds.length).toBe(3);

      const applicationLayer = layers.find((l) => l.id === "application");
      expect(applicationLayer).toBeDefined();
      expect(applicationLayer.nodeIds.length).toBe(3);
    });
  });

  describe("Coverage IR Generation", () => {
    it("should generate coverage diagram data", async () => {
      const resolved = {
        capabilities: {
          "user.auth": {
            name: "User Authentication",
          },
          "user.profile": {
            name: "User Profile",
          },
          "project.create": {
            name: "Project Creation",
          },
        },
        tests: {
          "test.auth.login": {
            name: "Login Test",
            covers: ["user.auth"],
            type: "e2e",
            status: "passing",
            automated: true,
          },
          "test.auth.logout": {
            name: "Logout Test",
            covers: ["user.auth"],
            type: "integration",
            status: "passing",
            automated: true,
          },
          "test.profile.read": {
            name: "Profile Read Test",
            covers: ["user.profile"],
            type: "unit",
            status: "failing",
            automated: true,
          },
          "test.project.create": {
            name: "Project Creation Test",
            covers: ["project.create"],
            type: "e2e",
            status: "pending",
            automated: false,
          },
        },
        requirements: {
          "req.auth.security": {
            name: "Authentication Security Requirements",
            capability: "user.auth",
            priority: "high",
            status: "approved",
            source: "security-team",
          },
          "req.profile.privacy": {
            name: "Profile Privacy Requirements",
            capability: "user.profile",
            priority: "medium",
            status: "draft",
            source: "privacy-team",
          },
        },
      };

      const result = await generator.generateIR("coverage", resolved);

      expect(result.kind).toBe("coverage");
      expect(result.data.type).toBe("coverage_graph");

      const data = result.data;
      expect(data.nodes).toBeDefined();
      expect(data.edges).toBeDefined();
      expect(data.coverage).toBeDefined();

      // Check nodes (capabilities + tests + requirements)
      const nodes = data.nodes as any[];
      expect(nodes.length).toBeGreaterThan(6); // 3 caps + 4 tests + 2 reqs

      const capabilityNodes = nodes.filter((n) => n.type === "capability");
      expect(capabilityNodes.length).toBe(3);

      const testNodes = nodes.filter((n) => n.type === "test");
      expect(testNodes.length).toBe(4);

      const requirementNodes = nodes.filter((n) => n.type === "requirement");
      expect(requirementNodes.length).toBe(2);

      // Check capability coverage calculation
      const authCapability = capabilityNodes.find((n) => n.id === "user.auth");
      expect(authCapability).toBeDefined();
      expect(authCapability.properties.testCount).toBe(2); // 2 tests cover user.auth
      expect(authCapability.properties.requirementCount).toBe(1); // 1 requirement
      expect(authCapability.properties.coverage).toBeGreaterThan(0);

      // Check edges (covers and specifies relationships)
      const edges = data.edges as any[];
      const coversEdges = edges.filter((e) => e.type === "covers");
      const specifiiesEdges = edges.filter((e) => e.type === "specifies");

      expect(coversEdges.length).toBeGreaterThan(0);
      expect(specifiiesEdges.length).toBeGreaterThan(0);

      // Check coverage summary
      const coverage = data.coverage;
      expect(coverage.overall).toBeDefined();
      expect(coverage.fullyTested).toBeDefined();
      expect(coverage.partiallyTested).toBeDefined();
      expect(coverage.untested).toBeDefined();
      expect(coverage.details).toBeDefined();

      expect(coverage.details["user.auth"]).toBeDefined();
      expect(coverage.details["user.auth"].testCount).toBe(2);

      // Check metadata
      expect(data.metadata.totalCapabilities).toBe(3);
      expect(data.metadata.totalTests).toBe(4);
      expect(data.metadata.totalRequirements).toBe(2);
    });

    it("should calculate coverage percentages correctly", async () => {
      const resolved = {
        capabilities: {
          "fully.tested": { name: "Fully Tested" },
          "partially.tested": { name: "Partially Tested" },
          "not.tested": { name: "Not Tested" },
        },
        tests: {
          test1: { covers: ["fully.tested"] },
          test2: { covers: ["fully.tested"] },
          test3: { covers: ["fully.tested"] },
          test4: { covers: ["fully.tested"] },
          test5: { covers: ["fully.tested"] },
          test6: { covers: ["fully.tested"] },
          test7: { covers: ["fully.tested"] },
          test8: { covers: ["fully.tested"] },
          test9: { covers: ["partially.tested"] },
        },
        requirements: {
          req1: { capability: "fully.tested" },
          req2: { capability: "fully.tested" },
        },
      };

      const result = await generator.generateIR("coverage", resolved);
      const data = result.data;

      // Check detailed coverage calculations
      const coverage = data.coverage.details;

      // fully.tested should have high coverage (8 tests + 2 requirements = 100%)
      expect(coverage["fully.tested"].testCount).toBe(8);
      expect(coverage["fully.tested"].requirementCount).toBe(2);
      expect(coverage["fully.tested"].coveragePercentage).toBe(100);

      // partially.tested should have lower coverage (1 test + 0 requirements)
      expect(coverage["partially.tested"].testCount).toBe(1);
      expect(coverage["partially.tested"].requirementCount).toBe(0);
      expect(coverage["partially.tested"].coveragePercentage).toBeLessThan(80);

      // not.tested should have zero coverage
      expect(coverage["not.tested"].testCount).toBe(0);
      expect(coverage["not.tested"].requirementCount).toBe(0);
      expect(coverage["not.tested"].coveragePercentage).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should throw error for unknown IR kind", async () => {
      const resolved = { test: "data" };

      await expect(generator.generateIR("unknown" as IRKind, resolved)).rejects.toThrow(
        "Unknown IR kind: unknown",
      );
    });

    it("should handle malformed resolved data gracefully", async () => {
      const resolved = {
        capabilities: "not an object", // Should be object
        flows: null, // Should be object
        services: undefined, // Should be object
      };

      // Should not throw, but return empty structures
      const capResult = await generator.generateIR("capabilities", resolved);
      expect(capResult.data.nodes).toEqual([]);

      const flowResult = await generator.generateIR("flows", resolved);
      expect(flowResult.data.nodes).toEqual([]);

      const depsResult = await generator.generateIR("dependencies", resolved);
      expect(depsResult.data.nodes).toEqual([]);
    });

    it("should handle circular dependencies in capabilities", async () => {
      const resolved = {
        capabilities: {
          "cap.a": {
            name: "Capability A",
            depends_on: ["cap.b"],
          },
          "cap.b": {
            name: "Capability B",
            depends_on: ["cap.c"],
          },
          "cap.c": {
            name: "Capability C",
            depends_on: ["cap.a"], // Creates circular dependency
          },
        },
      };

      // Should not throw error, but handle circular deps gracefully
      const result = await generator.generateIR("capabilities", resolved);

      expect(result.data.nodes).toBeDefined();
      expect(result.data.edges).toBeDefined();
      expect((result.data.nodes as any[]).length).toBe(3);
      expect((result.data.edges as any[]).length).toBe(3);
    });
  });

  describe("Performance", () => {
    it("should handle large datasets efficiently", async () => {
      // Generate large dataset
      const capabilities: any = {};
      const tests: any = {};
      const requirements: any = {};

      for (let i = 0; i < 100; i++) {
        capabilities[`cap.${i}`] = {
          name: `Capability ${i}`,
          depends_on: i > 0 ? [`cap.${i - 1}`] : [],
        };
        tests[`test.${i}`] = {
          name: `Test ${i}`,
          covers: [`cap.${i}`],
        };
        requirements[`req.${i}`] = {
          name: `Requirement ${i}`,
          capability: `cap.${i}`,
        };
      }

      const resolved = { capabilities, tests, requirements };

      const start = Date.now();
      const result = await generator.generateIR("coverage", resolved);
      const duration = Date.now() - start;

      expect(result.data.nodes).toBeDefined();
      expect((result.data.nodes as any[]).length).toBe(300); // 100 each type
      expect(duration).toBeLessThan(1000); // Should complete under 1 second
    });

    it("should generate IR within reasonable time limits", async () => {
      const resolved = {
        capabilities: { "test.cap": { name: "Test" } },
      };

      for (const kind of ["capabilities", "flows", "dependencies", "coverage"] as IRKind[]) {
        const start = Date.now();
        await generator.generateIR(kind, resolved);
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(500); // Each IR type under 500ms
      }
    });
  });

  describe("Layout and Metadata", () => {
    it("should include proper layout configuration for each IR type", async () => {
      const resolved = {
        capabilities: { "test.cap": { name: "Test" } },
        flows: { "test.flow": { name: "Test", steps: [] } },
      };

      const capResult = await generator.generateIR("capabilities", resolved);
      expect(capResult.data.layout).toBeDefined();
      expect(capResult.data.layout.algorithm).toBe("hierarchical");

      const flowResult = await generator.generateIR("flows", resolved);
      expect(flowResult.data.layout).toBeDefined();
      expect(flowResult.data.layout.algorithm).toBe("dagre");

      const depResult = await generator.generateIR("dependencies", resolved);
      expect(depResult.data.layout).toBeDefined();
      expect(depResult.data.layout.algorithm).toBe("layered");

      const covResult = await generator.generateIR("coverage", resolved);
      expect(covResult.data.layout).toBeDefined();
      expect(covResult.data.layout.algorithm).toBe("force");
    });

    it("should include accurate metadata for all IR types", async () => {
      const resolved = {
        capabilities: {
          cap1: { name: "Cap 1" },
          cap2: { name: "Cap 2" },
        },
        flows: {
          flow1: {
            name: "Flow 1",
            steps: [
              { name: "Step 1", action: "action1", actor: "user" },
              {
                name: "Step 2",
                action: "action2",
                actor: "system",
                branches: [{ condition: "branch1", name: "Branch 1" }],
              },
            ],
          },
        },
        tests: {
          test1: { covers: ["cap1"] },
        },
        requirements: {
          req1: { capability: "cap1" },
        },
      };

      const capResult = await generator.generateIR("capabilities", resolved);
      expect(capResult.data.metadata.totalCapabilities).toBe(2);

      const flowResult = await generator.generateIR("flows", resolved);
      expect(flowResult.data.metadata.totalFlows).toBe(1);
      expect(flowResult.data.metadata.totalSteps).toBe(2);
      expect(flowResult.data.metadata.totalDecisions).toBe(1);

      const covResult = await generator.generateIR("coverage", resolved);
      expect(covResult.data.metadata.totalCapabilities).toBe(2);
      expect(covResult.data.metadata.totalTests).toBe(1);
      expect(covResult.data.metadata.totalRequirements).toBe(1);
    });
  });
});
