/**
 * Comprehensive concurrency and race condition tests
 * Tests multi-client scenarios, last-write-wins, partial state prevention
 *
 * NOTE: Tests marked with [STRESS TEST] are skipped by default as they are
 * timing-sensitive and designed for stress testing under heavy concurrent load.
 * Run them separately with: bun test:stress
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { generateId } from "../../io/utils";
import type { Fragment } from "../../util/types";
import {
  type ConcurrencyTestContext,
  initializeTestServer,
  shutdownTestServer,
} from "./server-setup";
import {
  type FragmentTimingResult,
  createFragmentWithTiming,
  createFragmentsConcurrently,
  delay,
  extractResponse,
  findLatestResult,
  generateCueContent,
  generateDbOperation,
  generateResourceOperation,
  getProjectFragments,
  getResolvedSpec,
  validateProject,
} from "./test-utils";

describe("Concurrency and Race Condition Tests", () => {
  let ctx: ConcurrencyTestContext;

  beforeAll(async () => {
    ctx = await initializeTestServer();
  });

  afterAll(async () => {
    await shutdownTestServer(ctx);
  });

  // Helper wrappers that inject ctx.baseUrl
  const createFragment = (projectId: string, path: string, content: string, delayMs = 0) =>
    createFragmentWithTiming(ctx.baseUrl, projectId, path, content, delayMs);

  const getResolved = (projectId: string) => getResolvedSpec(ctx.baseUrl, projectId);

  const validate = (projectId: string) => validateProject(ctx.baseUrl, projectId);

  const getFragments = (projectId: string) => getProjectFragments(ctx.baseUrl, projectId);

  describe("Multi-Client Fragment Conflicts", () => {
    let testProjectId: string;

    beforeEach(() => {
      testProjectId = generateId();
    });

    it.skip("[STRESS TEST] should handle simultaneous writes to same fragment with last-write-wins", async () => {
      if (ctx.skipSuite) {
        return;
      }
      const fragmentPath = "conflict.cue";
      const clientCount = 10;

      // Create simultaneous write operations
      const writePromises: Promise<FragmentTimingResult>[] = [];

      for (let i = 0; i < clientCount; i++) {
        const content = `package spec\n\nclient${i}_data: {\n\tvalue: ${i}\n\ttimestamp: "${new Date().toISOString()}"\n}`;
        writePromises.push(
          createFragment(testProjectId, fragmentPath, content, Math.random() * 100),
        );
      }

      const results = await Promise.all(writePromises);

      // All requests should succeed (201 status)
      results.forEach(({ response }) => {
        expect(response.status).toBe(201);
      });

      // Wait for all operations to settle
      await delay(500);

      // Get final state
      const resolvedSpec = await getResolved(testProjectId);
      expect(resolvedSpec).not.toBeNull();

      // Find which client won (should be deterministic based on timestamp)
      const latestResult = findLatestResult(results);
      const winningClientIndex = results.indexOf(latestResult);

      // Verify last-write-wins behavior
      const resolvedContent = JSON.stringify(resolvedSpec!.resolved);
      expect(resolvedContent).toContain(`client${winningClientIndex}_data`);

      console.log(
        `✅ Last-write-wins: Client ${winningClientIndex} won out of ${clientCount} concurrent writes`,
      );
    });

    it.skip("[STRESS TEST] should prevent partial state corruption during concurrent validation", async () => {
      if (ctx.skipSuite) {
        console.warn(
          "[ConcurrencyTest] Skipping validation race test due to startup failure",
          ctx.startupError,
        );
        return;
      }
      const fragmentCount = 5;
      const validationCount = 3;

      // Create base fragments
      const baseFragments = Array.from({ length: fragmentCount }, (_, i) => ({
        path: `base_${i}.cue`,
        content: generateCueContent(`base${i}`, { id: `${i}`, value: i * 10 }),
      }));
      await createFragmentsConcurrently(ctx.baseUrl, testProjectId, baseFragments);

      // Trigger simultaneous validations while adding more fragments
      const concurrentOperations: Promise<Response | FragmentTimingResult>[] = [];

      // Validation operations
      for (let i = 0; i < validationCount; i++) {
        concurrentOperations.push(validate(testProjectId).then((r) => r.response));
      }

      // Fragment additions during validation
      for (let i = 0; i < 3; i++) {
        concurrentOperations.push(
          createFragment(
            testProjectId,
            `concurrent_${i}.cue`,
            generateCueContent(`concurrent${i}`, { added_during_validation: true }),
            50 * i,
          ),
        );
      }

      const results = await Promise.all(concurrentOperations);

      // All validations should either succeed or fail cleanly (no partial states)
      for (let i = 0; i < validationCount; i++) {
        const response = extractResponse(results[i] as Response | FragmentTimingResult);
        expect(response.status).toBe(200);

        const validationResult = await response.json();
        expect(typeof validationResult.success).toBe("boolean");
        expect(typeof validationResult.spec_hash).toBe("string");

        // Either fully successful with valid spec_hash or failed with empty or "invalid" hash
        if (validationResult.success) {
          expect(validationResult.spec_hash.length).toBeGreaterThan(0);
          expect(validationResult.resolved).toBeDefined();
        } else {
          expect(["", "invalid"].includes(validationResult.spec_hash)).toBe(true);
          expect(validationResult.errors.length).toBeGreaterThan(0);
        }
      }

      console.log("✅ No partial states detected during concurrent validation");
    });

    it.skip("[STRESS TEST] should maintain fragment integrity under high concurrent load", async () => {
      if (ctx.skipSuite) {
        return;
      }
      const clientCount = 20;
      const fragmentsPerClient = 5;
      const expectedFragments = new Set<string>();

      // Build fragment definitions
      const fragmentDefs = [];
      for (let client = 0; client < clientCount; client++) {
        for (let fragment = 0; fragment < fragmentsPerClient; fragment++) {
          const path = `client_${client}_fragment_${fragment}.cue`;
          expectedFragments.add(path);
          fragmentDefs.push({
            path,
            content: generateCueContent(`client${client}_fragment${fragment}`, {
              client_id: `${client}`,
              fragment_id: `${fragment}`,
              value: client * 1000 + fragment,
            }),
            delayMs: Math.random() * 200,
          });
        }
      }

      const start = Date.now();
      const results = await createFragmentsConcurrently(ctx.baseUrl, testProjectId, fragmentDefs);
      const totalDuration = Date.now() - start;

      // All operations should succeed
      results.forEach(({ response }) => {
        expect(response.status).toBe(201);
      });

      // Verify all fragments are accessible
      const { response: fragmentsResponse, fragments } = await getFragments(testProjectId);
      expect(fragmentsResponse.status).toBe(200);
      expect(fragments.length).toBe(clientCount * fragmentsPerClient);

      // Verify no duplicates or corruption
      const foundPaths = new Set(fragments.map((f: Fragment) => f.path));
      expect(foundPaths.size).toBe(expectedFragments.size);

      expectedFragments.forEach((path) => {
        expect(foundPaths.has(path)).toBe(true);
      });

      console.log(
        `✅ High load test: ${clientCount * fragmentsPerClient} fragments created by ${clientCount} clients in ${totalDuration}ms`,
      );
    });
  });

  describe("Database Transaction Integrity", () => {
    let testProjectId: string;

    beforeEach(() => {
      testProjectId = generateId();
    });

    it.skip("[STRESS TEST] should handle concurrent database operations without deadlocks", async () => {
      if (ctx.skipSuite) {
        console.warn(
          "[ConcurrencyTest] Skipping database concurrency test due to startup failure",
          ctx.startupError,
        );
        return;
      }
      const operationCount = 15;

      // Mix of different database operations using helper
      const operations = Array.from({ length: operationCount }, (_, i) =>
        generateDbOperation(
          i,
          () =>
            createFragment(testProjectId, `db_test_${i}.cue`, `package spec\n\ndb_test${i}: ${i}`),
          () => validate(testProjectId),
          () => getFragments(testProjectId),
        ),
      );

      const start = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - start;

      // No operation should fail due to deadlock or timeout
      results.forEach((result, index) => {
        const response = extractResponse(result as Response | FragmentTimingResult);
        expect(response.status).toBeLessThan(500); // No server errors

        if (response.status >= 400) {
          console.warn(`Operation ${index} failed with status ${response.status}`);
        }
      });

      // Should complete within reasonable time (no deadlock delays)
      expect(duration).toBeLessThan(10000); // 10 seconds max

      console.log(`✅ Database concurrency test: ${operationCount} operations in ${duration}ms`);
    });

    it.skip("[STRESS TEST] should maintain referential integrity during concurrent fragment operations", async () => {
      // Create base fragment that others will reference
      await createFragment(
        testProjectId,
        "base.cue",
        `package spec\n\nbase_config: {\n\tapi_version: "v1"\n\tbase_url: "https://api.example.com"\n}`,
      );

      const referenceCount = 10;
      const referenceFragments = Array.from({ length: referenceCount }, (_, i) => ({
        path: `reference_${i}.cue`,
        content: `package spec\n\nservice${i}: {\n\tname: "service_${i}"\n\tapi_version: base_config.api_version\n\tbase_url: base_config.base_url\n}`,
      }));

      const results = await createFragmentsConcurrently(
        ctx.baseUrl,
        testProjectId,
        referenceFragments,
      );

      // All reference creations should succeed
      results.forEach(({ response }) => {
        expect(response.status).toBe(201);
      });

      // Validate the complete project
      const { response: validationResponse, result } = await validate(testProjectId);
      expect(validationResponse.status).toBe(200);
      expect(result.success).toBe(true);

      // Verify all references resolved correctly
      const resolvedSpec = await getResolved(testProjectId);
      expect(resolvedSpec).not.toBeNull();

      for (let i = 0; i < referenceCount; i++) {
        const service = (resolvedSpec!.resolved as Record<string, any>)[`service${i}`];
        expect(service).toBeDefined();
        expect(service.api_version).toBe("v1");
        expect(service.base_url).toBe("https://api.example.com");
      }

      console.log(
        `✅ Referential integrity maintained across ${referenceCount} concurrent references`,
      );
    });
  });

  describe("Validation Pipeline Race Conditions", () => {
    let testProjectId: string;

    beforeEach(() => {
      testProjectId = generateId();
    });

    it.skip("[STRESS TEST] should handle concurrent fragment updates during active validation", async () => {
      // Create initial fragment set
      const initialFragments = Array.from({ length: 5 }, (_, i) => ({
        path: `initial_${i}.cue`,
        content: generateCueContent(`initial${i}`, { id: i, status: "initial" }),
      }));
      await createFragmentsConcurrently(ctx.baseUrl, testProjectId, initialFragments);

      // Start validation (this will take some time)
      const validationPromise = validate(testProjectId);

      // While validation is running, modify fragments with staggered timing
      const updatePromises: Promise<FragmentTimingResult>[] = [];
      for (let i = 0; i < 3; i++) {
        updatePromises.push(
          delay(50 + i * 30).then(() =>
            createFragment(
              testProjectId,
              `initial_${i}.cue`,
              generateCueContent(`initial${i}`, {
                id: i,
                status: "updated_during_validation",
                timestamp: `${Date.now()}`,
              }),
            ),
          ),
        );
      }

      // Wait for both validation and updates
      const [validationData, ...updateResults] = await Promise.all([
        validationPromise,
        ...updatePromises,
      ]);

      // Validation should complete successfully
      expect(validationData.response.status).toBe(200);
      const validationResult = validationData.result;

      // Updates should all succeed
      updateResults.forEach((result) => {
        expect(result.response.status).toBe(201);
      });

      // Run another validation to see final state
      const { response: finalValidationResponse, result: finalResult } =
        await validate(testProjectId);

      expect(finalValidationResponse.status).toBe(200);

      // The validation might succeed or fail depending on the current state,
      // but it should return a valid response without corruption
      expect(typeof finalResult.success).toBe("boolean");
      expect(typeof finalResult.spec_hash).toBe("string");

      // If successful, spec hashes should be different (content changed)
      if (finalResult.success && validationResult.success) {
        expect(finalResult.spec_hash).not.toBe(validationResult.spec_hash);
      }

      console.log("✅ Handled concurrent updates during validation without corruption");
    });

    it.skip("[STRESS TEST] should maintain consistent spec hash computation under concurrency", async () => {
      // Create identical content across multiple operations
      const baseContent = `package spec

routes: {
  api: {
    v1: {
      users: {
        path: "/api/v1/users"
        method: "GET" | "POST"
      }
      projects: {
        path: "/api/v1/projects"
        method: "GET" | "POST" | "PUT" | "DELETE"
      }
    }
  }
}

capabilities: {
  "user.management": "User creation, authentication, profile management"
  "project.management": "Project CRUD operations and collaboration"
}`;

      // Create fragments in parallel
      const fragments = Array.from({ length: 3 }, (_, i) => ({
        path: `content_${i}.cue`,
        content: baseContent,
      }));
      await createFragmentsConcurrently(ctx.baseUrl, testProjectId, fragments);

      // Run multiple validations simultaneously
      const validationPromises = Array.from({ length: 5 }, () => validate(testProjectId));
      const validationResults = await Promise.all(validationPromises);

      // All validations should succeed
      validationResults.forEach(({ result }) => {
        expect(result.success).toBe(true);
        expect(result.spec_hash.length).toBeGreaterThan(0);
      });

      // All spec hashes should be identical (deterministic)
      const hashes = validationResults.map((r) => r.result.spec_hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);

      console.log(
        `✅ Spec hash consistency: ${hashes.length} concurrent validations produced identical hash: ${hashes[0]}`,
      );
    });
  });

  describe("Resource Exhaustion and Recovery", () => {
    let testProjectId: string;

    beforeEach(() => {
      testProjectId = generateId();
    });

    it.skip("should gracefully handle resource exhaustion scenarios", async () => {
      const heavyLoadCount = 50;

      // Create operations that stress different resources using helper
      const operations = Array.from({ length: heavyLoadCount }, (_, i) =>
        generateResourceOperation(
          i,
          ctx.baseUrl,
          testProjectId,
          (path, content) => createFragment(testProjectId, path, content),
          () => validate(testProjectId),
        ),
      ).filter((op): op is Promise<Response | FragmentTimingResult> => op !== null);

      const start = Date.now();
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - start;

      // Analyze results
      const successful = results.filter((r) => r.status === "fulfilled").length;

      // Should handle most operations (some may fail due to resource limits)
      const successRate = successful / results.length;
      expect(successRate).toBeGreaterThan(0.7); // At least 70% success rate

      // System should remain responsive
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds

      console.log(
        `✅ Resource exhaustion test: ${successful}/${results.length} operations succeeded in ${duration}ms`,
      );

      // System should recover - try a simple operation
      const recoveryTest = await createFragment(
        testProjectId,
        "recovery_test.cue",
        "package spec\n\nrecovery: true",
      );

      expect(recoveryTest.response.status).toBe(201);
      console.log("✅ System recovered successfully after resource exhaustion");
    });
  });
});
