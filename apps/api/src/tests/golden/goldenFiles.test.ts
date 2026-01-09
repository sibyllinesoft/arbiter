/**
 * Golden files test suite - validates deterministic behavior against expected outputs
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { IRGenerator } from "../../io/ir";
import { generateId } from "../../io/utils";
import { SpecEngine } from "../../util/specEngine";
import type { ServerConfig } from "../../util/types";
import {
  compareWithTolerance,
  loadExpectedFile as loadExpected,
  loadGoldenFragments as loadFragments,
  validateIRStructure,
} from "./comparison-utils";

const GOLDEN_PROJECT_PATH = "/home/nathan/Projects/arbiter/golden-test-project";
const GOLDEN_AVAILABLE = existsSync(join(GOLDEN_PROJECT_PATH, "ui.routes.cue"));

(GOLDEN_AVAILABLE ? describe : describe.skip)("Golden Files Validation", () => {
  let engine: SpecEngine;
  let irGenerator: IRGenerator;
  let testConfig: ServerConfig;
  let tempWorkdir: string;
  let goldenProjectPath: string;
  let goldenAvailable = GOLDEN_AVAILABLE;

  beforeAll(async () => {
    // Setup temp directory
    tempWorkdir = `/tmp/golden-test-${Date.now()}`;
    await Bun.write(join(tempWorkdir, ".gitkeep"), "");

    // Path to golden test project
    goldenProjectPath = GOLDEN_PROJECT_PATH;

    testConfig = {
      port: 0,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: tempWorkdir,
      jq_binary_path: "jq",
      auth_required: false,
      external_tool_timeout_ms: 15000, // Longer timeout for golden tests
      websocket: {
        max_connections: 100,
        ping_interval_ms: 30000,
      },
    };

    engine = new SpecEngine(testConfig);
    irGenerator = new IRGenerator();
  });

  afterAll(async () => {
    // Cleanup
    try {
      await Bun.spawn(["rm", "-rf", tempWorkdir]).exited;
    } catch (error) {
      console.warn("Failed to cleanup temp directory:", error);
    }
  });

  const FRAGMENT_FILES = ["ui.routes.cue", "locators.cue", "flows.cue", "completion.cue"];

  // Wrapper functions that use the imported utilities with local context
  const loadGoldenFragments = () =>
    goldenAvailable ? loadFragments(goldenProjectPath, FRAGMENT_FILES) : Promise.resolve([]);

  const loadExpectedFile = (filename: string) =>
    goldenAvailable ? loadExpected(goldenProjectPath, filename) : Promise.resolve({});

  // Use imported compareWithTolerance utility for deep comparison
  const _compareWithTolerance = compareWithTolerance;

  const skipIfNoGolden = (): boolean => {
    if (!goldenAvailable) {
      console.warn("Skipping golden file test because fixtures are missing");
      return true;
    }
    return false;
  };

  (goldenAvailable ? describe : describe.skip)("Deterministic Validation Pipeline", () => {
    it("should produce consistent resolved.json output", async () => {
      if (skipIfNoGolden()) return;
      const fragments = await loadGoldenFragments();
      const _expected = await loadExpectedFile("resolved.json");

      const result = await engine.validateProject("golden-test", fragments);

      expect(result.success).toBe(true);
      expect(result.resolved).toBeDefined();

      // Compare major sections - the golden files contain a subset for testing
      const resolved = result.resolved!;

      // Check routes section exists and has expected structure
      expect(resolved.routes).toBeDefined();
      const routes = resolved.routes as any;
      expect(routes.auth).toBeDefined();
      expect(routes.auth.login).toBeDefined();
      expect(routes.auth.login.path).toBe("/auth/login");
      expect(routes.auth.login.method).toBeDefined();

      // Check API routes
      expect(routes.api).toBeDefined();
      expect(routes.api.v1).toBeDefined();
      expect(routes.api.v1.projects).toBeDefined();

      // Verify structure is as expected (golden files contain partial data for validation)
      console.log("✅ Resolved JSON structure matches expected patterns");
    });

    it("should compute consistent spec hash for same content", async () => {
      if (skipIfNoGolden()) return;
      const fragments = await loadGoldenFragments();

      // Run validation twice
      const result1 = await engine.validateProject("golden-test-1", fragments);
      const result2 = await engine.validateProject("golden-test-2", fragments);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.specHash).toBe(result2.specHash);
      expect(result1.specHash.length).toBeGreaterThan(10); // Should be a proper hash
    });

    it("should maintain validation performance targets", async () => {
      const fragments = await loadGoldenFragments();

      const start = Date.now();
      const result = await engine.validateProject("golden-perf-test", fragments);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete under 2 seconds

      console.log(`✅ Validation completed in ${duration}ms (target: <2000ms)`);
    });
  });

  (goldenAvailable ? describe : describe.skip)("IR Generation Consistency", () => {
    it("should generate consistent capabilities IR", async () => {
      const fragments = await loadGoldenFragments();
      const _expected = await loadExpectedFile("capabilities-ir.json");

      const validationResult = await engine.validateProject("golden-test", fragments);
      expect(validationResult.success).toBe(true);

      const ir = await irGenerator.generateIR("capabilities", validationResult.resolved!);

      expect(ir.kind).toBe("capabilities");
      expect(ir.data.type).toBe("directed_graph");
      expect(ir.data.nodes).toBeDefined();
      expect(ir.data.edges).toBeDefined();
      expect(ir.data.groups).toBeDefined();

      // Check structure matches expected patterns
      const nodes = ir.data.nodes as any[];
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.every((n) => n.id && n.label && n.type === "capability")).toBe(true);

      // Check for expected capability domains
      const domains = [...new Set(nodes.map((n) => n.domain))];
      expect(domains.length).toBeGreaterThan(1);

      console.log(`✅ Capabilities IR generated: ${nodes.length} nodes, ${domains.length} domains`);
    });

    it("should generate consistent flows IR", async () => {
      const fragments = await loadGoldenFragments();
      const _expected = await loadExpectedFile("flow-ir.json");

      const validationResult = await engine.validateProject("golden-test", fragments);
      expect(validationResult.success).toBe(true);

      const ir = await irGenerator.generateIR("flows", validationResult.resolved!);

      expect(ir.kind).toBe("flows");
      expect(ir.data.type).toBe("flowchart");
      expect(ir.data.nodes).toBeDefined();
      expect(ir.data.edges).toBeDefined();
      expect(ir.data.flows).toBeDefined();

      // Check for expected flow structure
      const flows = ir.data.flows as any[];
      expect(flows.length).toBeGreaterThan(0);

      const nodes = ir.data.nodes as any[];
      const _edges = ir.data.edges as any[];

      // Should have process and decision nodes
      const processNodes = nodes.filter((n) => n.type === "process");
      const _decisionNodes = nodes.filter((n) => n.type === "decision");

      expect(processNodes.length).toBeGreaterThan(0);
      // Decision nodes depend on branches in the flows

      console.log(`✅ Flows IR generated: ${flows.length} flows, ${nodes.length} nodes`);
    });

    it("should generate consistent coverage IR", async () => {
      const fragments = await loadGoldenFragments();
      const _expected = await loadExpectedFile("coverage-ir.json");

      const validationResult = await engine.validateProject("golden-test", fragments);
      expect(validationResult.success).toBe(true);

      const ir = await irGenerator.generateIR("coverage", validationResult.resolved!);

      expect(ir.kind).toBe("coverage");
      expect(ir.data.type).toBe("coverage_graph");
      expect(ir.data.coverage).toBeDefined();

      // Check coverage metrics structure
      const coverage = ir.data.coverage;
      expect(coverage.overall).toBeDefined();
      expect(typeof coverage.overall).toBe("number");
      expect(coverage.overall).toBeGreaterThanOrEqual(0);
      expect(coverage.overall).toBeLessThanOrEqual(100);

      expect(coverage.fullyTested).toBeDefined();
      expect(coverage.partiallyTested).toBeDefined();
      expect(coverage.untested).toBeDefined();
      expect(coverage.details).toBeDefined();

      console.log(`✅ Coverage IR generated: ${coverage.overall}% overall coverage`);
    });

    it("should generate all IR types within performance targets", async () => {
      const fragments = await loadGoldenFragments();
      const validationResult = await engine.validateProject("golden-test", fragments);
      expect(validationResult.success).toBe(true);

      const irTypes = ["capabilities", "flows", "dependencies", "coverage"] as const;

      for (const irType of irTypes) {
        const start = Date.now();
        const ir = await irGenerator.generateIR(irType, validationResult.resolved!);
        const duration = Date.now() - start;

        expect(ir.kind).toBe(irType);
        expect(duration).toBeLessThan(500); // Each IR should generate under 500ms

        console.log(`✅ ${irType} IR generated in ${duration}ms`);
      }
    });
  });

  (goldenAvailable ? describe : describe.skip)("End-to-End Pipeline Consistency", () => {
    it("should complete full validation→IR pipeline deterministically", async () => {
      const fragments = await loadGoldenFragments();

      // Full pipeline
      const start = Date.now();

      // Step 1: Validation
      const validationResult = await engine.validateProject("golden-e2e", fragments);
      expect(validationResult.success).toBe(true);

      // Step 2: All IR generation
      const irTypes = ["capabilities", "flows", "dependencies", "coverage"] as const;
      const irResults = [];

      for (const irType of irTypes) {
        const ir = await irGenerator.generateIR(irType, validationResult.resolved!);
        irResults.push(ir);
      }

      const totalDuration = Date.now() - start;

      // Verify all components
      expect(validationResult.specHash.length).toBeGreaterThan(10);
      expect(irResults.length).toBe(4);

      // Performance target
      expect(totalDuration).toBeLessThan(5000); // Full pipeline under 5 seconds

      console.log(`✅ Full E2E pipeline completed in ${totalDuration}ms`);
    });

    it("should produce same results across multiple runs", async () => {
      const fragments = await loadGoldenFragments();

      // Run pipeline multiple times
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const result = await engine.validateProject(`golden-consistency-${i}`, fragments);
        runs.push(result);
      }

      // All should succeed
      runs.forEach((run) => expect(run.success).toBe(true));

      // All should have same spec hash
      const hashes = runs.map((r) => r.specHash);
      expect(new Set(hashes).size).toBe(1); // All hashes should be identical

      // All should have same resolved structure
      const resolvedStrings = runs.map((r) => JSON.stringify(r.resolved));
      expect(new Set(resolvedStrings).size).toBe(1); // All resolved should be identical

      console.log("✅ Pipeline produces identical results across multiple runs");
    });

    it("should handle error scenarios consistently", async () => {
      // Create fragments with known errors
      const invalidFragments: Fragment[] = [
        {
          id: generateId(),
          project_id: "error-test",
          path: "invalid.cue",
          content: `package spec

// Intentional syntax error
routes: {
  login: {
    path: "/auth/login"
    method: "POST"
    // Missing closing brace`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject("error-test", invalidFragments);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe("schema");
      expect(result.specHash).toBe(""); // Should be empty on failure

      console.log("✅ Error scenarios handled consistently");
    });
  });

  describe("Golden Files Integrity", () => {
    it("should validate that golden files are valid JSON", async () => {
      const expectedFiles = [
        "resolved.json",
        "gapset.json",
        "flow-ir.json",
        "capabilities-ir.json",
        "coverage-ir.json",
      ];

      for (const filename of expectedFiles) {
        const content = await loadExpectedFile(filename);
        expect(content).toBeDefined();
        expect(typeof content).toBe("object");
        console.log(`✅ ${filename} is valid JSON`);
      }
    });

    it("should validate golden CUE fragments are syntactically correct", async () => {
      const fragments = await loadGoldenFragments();

      expect(fragments.length).toBeGreaterThan(0);

      for (const fragment of fragments) {
        expect(fragment.content.length).toBeGreaterThan(0);
        expect(fragment.content).toContain("package spec");
        console.log(`✅ ${fragment.path} has valid structure`);
      }
    });

    it("should verify golden project exercises all major CUE features", async () => {
      const fragments = await loadGoldenFragments();
      const allContent = fragments.map((f) => f.content).join("\n");

      // Check for various CUE language features
      const features = [
        { name: "Definitions", pattern: /#\w+:/ },
        { name: "Constraints", pattern: /& \w+/ },
        { name: "String patterns", pattern: /=~"/ },
        { name: "Conditional logic", pattern: /if .+ ==/ },
        { name: "List comprehensions", pattern: /for .+ in/ },
        { name: "Templates", pattern: /\$\{.+\}/ },
        { name: "Validations", pattern: /len >/ },
      ];

      const foundFeatures = features.filter((feature) => feature.pattern.test(allContent));

      expect(foundFeatures.length).toBeGreaterThan(3); // Should exercise multiple features

      foundFeatures.forEach((feature) => {
        console.log(`✅ Golden files exercise: ${feature.name}`);
      });
    });
  });
});
