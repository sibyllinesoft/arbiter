/**
 * Comprehensive concurrency and race condition tests
 * Tests multi-client scenarios, last-write-wins, partial state prevention
 *
 * NOTE: Tests marked with [STRESS TEST] are skipped by default as they are
 * timing-sensitive and designed for stress testing under heavy concurrent load.
 * Run them separately with: bun test:stress
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createServer } from "node:net";
import { SpecWorkbenchDB } from "../../db.ts";
import { SpecWorkbenchServer } from "../../server.ts";
import type { Fragment, ServerConfig } from "../../types.ts";
import { generateId } from "../../utils.ts";

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        const { port } = address;
        server.close((closeErr) => {
          if (closeErr) {
            reject(closeErr);
          } else {
            resolve(port);
          }
        });
      } else {
        server.close();
        reject(new Error("Unable to determine free port"));
      }
    });
    server.on("error", (error) => {
      server.close();
      reject(error);
    });
  });
}

describe("Concurrency and Race Condition Tests", () => {
  let db: SpecWorkbenchDB;
  let server: SpecWorkbenchServer;
  let baseUrl: string;
  let testConfig: ServerConfig;

  beforeAll(async () => {
    const port = await getAvailablePort();

    testConfig = {
      port,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: `/tmp/concurrency-test-${Date.now()}`,
      cue_binary_path: "cue",
      jq_binary_path: "jq",
      auth_required: false,
      rate_limit: {
        max_tokens: 1000, // High limit for concurrency testing
        refill_rate: 100,
        window_ms: 1000,
      },
      external_tool_timeout_ms: 30000, // Longer timeout for heavy load
      websocket: {
        max_connections: 100,
        ping_interval_ms: 5000,
      },
    };

    db = await SpecWorkbenchDB.create(testConfig);
    server = new SpecWorkbenchServer(testConfig, db);
    baseUrl = `http://localhost:${port}`;

    await server.start();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Extra startup time
  });

  afterAll(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  /**
   * Helper to create fragments with precise timing control
   */
  async function createFragmentWithTiming(
    projectId: string,
    path: string,
    content: string,
    delayMs = 0,
  ) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const start = Date.now();
    const response = await fetch(`${baseUrl}/api/fragments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        path,
        content,
      }),
    });
    const duration = Date.now() - start;

    return { response, duration, timestamp: start };
  }

  /**
   * Helper to validate project and get resolved spec
   */
  async function getResolvedSpec(projectId: string) {
    const validationResponse = await fetch(`${baseUrl}/api/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });

    if (validationResponse.status !== 200) {
      return null;
    }

    const result = await validationResponse.json();
    if (!result.success) {
      return null;
    }

    const resolvedResponse = await fetch(`${baseUrl}/api/resolved?project_id=${projectId}`);

    if (resolvedResponse.status !== 200) {
      return null;
    }

    return await resolvedResponse.json();
  }

  describe("Multi-Client Fragment Conflicts", () => {
    let testProjectId: string;

    beforeEach(() => {
      testProjectId = generateId();
    });

    it.skip("[STRESS TEST] should handle simultaneous writes to same fragment with last-write-wins", async () => {
      const fragmentPath = "conflict.cue";
      const clientCount = 10;

      // Create simultaneous write operations
      const writePromises = [];
      const expectedContent = [];

      for (let i = 0; i < clientCount; i++) {
        const content = `package spec\n\nclient${i}_data: {\n\tvalue: ${i}\n\ttimestamp: "${new Date().toISOString()}"\n}`;
        expectedContent.push({ clientId: i, content });

        const promise = createFragmentWithTiming(
          testProjectId,
          fragmentPath,
          content,
          Math.random() * 100, // Random delay 0-100ms
        );
        writePromises.push(promise);
      }

      const results = await Promise.all(writePromises);

      // All requests should succeed (201 status)
      results.forEach(({ response }) => {
        expect(response.status).toBe(201);
      });

      // Wait for all operations to settle
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get final state
      const resolvedSpec = await getResolvedSpec(testProjectId);
      expect(resolvedSpec).not.toBeNull();

      // Find which client won (should be deterministic based on timestamp)
      const latestResult = results.reduce((latest, current) =>
        current.timestamp > latest.timestamp ? current : latest,
      );

      // Verify last-write-wins behavior
      const resolvedContent = JSON.stringify(resolvedSpec.resolved);
      const winningClientIndex = results.indexOf(latestResult);

      expect(resolvedContent).toContain(`client${winningClientIndex}_data`);

      console.log(
        `✅ Last-write-wins: Client ${winningClientIndex} won out of ${clientCount} concurrent writes`,
      );
    });

    it("should prevent partial state corruption during concurrent validation", async () => {
      const fragmentCount = 5;
      const validationCount = 3;

      // Create base fragments
      const fragmentPromises = [];
      for (let i = 0; i < fragmentCount; i++) {
        const promise = createFragmentWithTiming(
          testProjectId,
          `base_${i}.cue`,
          `package spec\n\nbase${i}: {\n\tid: "${i}"\n\tvalue: ${i * 10}\n}`,
        );
        fragmentPromises.push(promise);
      }

      await Promise.all(fragmentPromises);

      // Trigger simultaneous validations while adding more fragments
      const concurrentOperations = [];

      // Validation operations
      for (let i = 0; i < validationCount; i++) {
        const validationPromise = fetch(`${baseUrl}/api/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: testProjectId }),
        });
        concurrentOperations.push(validationPromise);
      }

      // Fragment additions during validation
      for (let i = 0; i < 3; i++) {
        const addPromise = createFragmentWithTiming(
          testProjectId,
          `concurrent_${i}.cue`,
          `package spec\n\nconcurrent${i}: {\n\tadded_during_validation: true\n}`,
          50 * i, // Staggered timing
        );
        concurrentOperations.push(addPromise);
      }

      const results = await Promise.all(concurrentOperations);

      // All validations should either succeed or fail cleanly (no partial states)
      for (let i = 0; i < validationCount; i++) {
        const operationResult = results[i];
        // The first validationCount results are validation responses (plain Response objects)
        // The remaining results are fragment creation responses (objects with response property)
        const response =
          operationResult instanceof Response ? operationResult : (operationResult as any).response;
        expect(response.status).toBe(200);

        const validationResult = await response.json();
        expect(typeof validationResult.success).toBe("boolean");
        expect(typeof validationResult.spec_hash).toBe("string");

        // Either fully successful with valid spec_hash or failed with empty or "invalid" hash
        if (validationResult.success) {
          expect(validationResult.spec_hash.length).toBeGreaterThan(0);
          expect(validationResult.resolved).toBeDefined();
        } else {
          // Failed validations may have empty or "invalid" spec_hash
          expect(["", "invalid"].includes(validationResult.spec_hash)).toBe(true);
          expect(validationResult.errors.length).toBeGreaterThan(0);
        }
      }

      console.log("✅ No partial states detected during concurrent validation");
    });

    it.skip("[STRESS TEST] should maintain fragment integrity under high concurrent load", async () => {
      const clientCount = 20;
      const fragmentsPerClient = 5;

      const allOperations = [];
      const expectedFragments = new Set();

      // Each client creates multiple fragments
      for (let client = 0; client < clientCount; client++) {
        for (let fragment = 0; fragment < fragmentsPerClient; fragment++) {
          const path = `client_${client}_fragment_${fragment}.cue`;
          const content = `package spec\n\nclient${client}_fragment${fragment}: {\n\tclient_id: "${client}"\n\tfragment_id: "${fragment}"\n\tvalue: ${client * 1000 + fragment}\n}`;

          expectedFragments.add(path);

          const promise = createFragmentWithTiming(
            testProjectId,
            path,
            content,
            Math.random() * 200, // Random delay 0-200ms
          );
          allOperations.push(promise);
        }
      }

      const start = Date.now();
      const results = await Promise.all(allOperations);
      const totalDuration = Date.now() - start;

      // All operations should succeed
      results.forEach(({ response }, _index) => {
        expect(response.status).toBe(201);
      });

      // Verify all fragments are accessible
      const fragmentsResponse = await fetch(`${baseUrl}/api/fragments?project_id=${testProjectId}`);
      expect(fragmentsResponse.status).toBe(200);

      const fragments = await fragmentsResponse.json();
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

    it("should handle concurrent database operations without deadlocks", async () => {
      const operationCount = 15;
      const operations = [];

      // Mix of different database operations
      for (let i = 0; i < operationCount; i++) {
        const operationType = i % 3;

        switch (operationType) {
          case 0: // Create fragment
            operations.push(
              createFragmentWithTiming(
                testProjectId,
                `db_test_${i}.cue`,
                `package spec\n\ndb_test${i}: ${i}`,
              ),
            );
            break;

          case 1: // Validate project (reads + computation)
            operations.push(
              fetch(`${baseUrl}/api/validate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: testProjectId }),
              }),
            );
            break;

          case 2: // List fragments (read operation)
            operations.push(fetch(`${baseUrl}/api/fragments?project_id=${testProjectId}`));
            break;
        }
      }

      const start = Date.now();
      const results = await Promise.all(operations);
      const duration = Date.now() - start;

      // No operation should fail due to deadlock or timeout
      results.forEach((result, index) => {
        const response = "response" in result ? result.response : result;
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
      await createFragmentWithTiming(
        testProjectId,
        "base.cue",
        `package spec\n\nbase_config: {\n\tapi_version: "v1"\n\tbase_url: "https://api.example.com"\n}`,
      );

      const referenceCount = 10;
      const referenceOperations = [];

      // Create fragments that reference the base fragment
      for (let i = 0; i < referenceCount; i++) {
        const operation = createFragmentWithTiming(
          testProjectId,
          `reference_${i}.cue`,
          `package spec\n\nservice${i}: {\n\tname: "service_${i}"\n\tapi_version: base_config.api_version\n\tbase_url: base_config.base_url\n}`,
        );
        referenceOperations.push(operation);
      }

      const results = await Promise.all(referenceOperations);

      // All reference creations should succeed
      results.forEach(({ response }) => {
        expect(response.status).toBe(201);
      });

      // Validate the complete project
      const validationResponse = await fetch(`${baseUrl}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: testProjectId }),
      });

      expect(validationResponse.status).toBe(200);
      const result = await validationResponse.json();
      expect(result.success).toBe(true);

      // Verify all references resolved correctly
      const resolvedSpec = await getResolvedSpec(testProjectId);
      expect(resolvedSpec).not.toBeNull();

      for (let i = 0; i < referenceCount; i++) {
        const service = resolvedSpec.resolved[`service${i}`];
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
      const initialFragments = [];
      for (let i = 0; i < 5; i++) {
        initialFragments.push(
          createFragmentWithTiming(
            testProjectId,
            `initial_${i}.cue`,
            `package spec\n\ninitial${i}: {\n\tid: ${i}\n\tstatus: "initial"\n}`,
          ),
        );
      }

      await Promise.all(initialFragments);

      // Start validation (this will take some time)
      const validationPromise = fetch(`${baseUrl}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: testProjectId }),
      });

      // While validation is running, modify fragments
      const updatePromises = [];
      for (let i = 0; i < 3; i++) {
        // Wait a bit then update
        const updatePromise = new Promise((resolve) => {
          setTimeout(
            async () => {
              const result = await createFragmentWithTiming(
                testProjectId,
                `initial_${i}.cue`,
                `package spec\n\ninitial${i}: {\n\tid: ${i}\n\tstatus: "updated_during_validation"\n\ttimestamp: "${Date.now()}"\n}`,
              );
              resolve(result);
            },
            50 + i * 30,
          ); // Staggered updates
        });
        updatePromises.push(updatePromise);
      }

      // Wait for both validation and updates
      const [validationResponse, ...updateResults] = await Promise.all([
        validationPromise,
        ...updatePromises,
      ]);

      // Validation should complete successfully
      expect(validationResponse.status).toBe(200);
      const validationResult = await validationResponse.json();

      // Updates should all succeed
      updateResults.forEach((result: any) => {
        expect(result.response.status).toBe(201);
      });

      // Run another validation to see final state
      const finalValidationResponse = await fetch(`${baseUrl}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: testProjectId }),
      });

      expect(finalValidationResponse.status).toBe(200);
      const finalResult = await finalValidationResponse.json();

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
      const fragmentPromises = [];
      for (let i = 0; i < 3; i++) {
        fragmentPromises.push(
          createFragmentWithTiming(testProjectId, `content_${i}.cue`, baseContent),
        );
      }

      await Promise.all(fragmentPromises);

      // Run multiple validations simultaneously
      const validationPromises = [];
      for (let i = 0; i < 5; i++) {
        validationPromises.push(
          fetch(`${baseUrl}/api/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: testProjectId }),
          }),
        );
      }

      const validationResponses = await Promise.all(validationPromises);
      const validationResults = await Promise.all(
        validationResponses.map((response) => response.json()),
      );

      // All validations should succeed
      validationResults.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.spec_hash.length).toBeGreaterThan(0);
      });

      // All spec hashes should be identical (deterministic)
      const hashes = validationResults.map((r) => r.spec_hash);
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
      const operations = [];

      // Create operations that stress different resources
      for (let i = 0; i < heavyLoadCount; i++) {
        // Alternate between different resource-intensive operations
        const operationType = i % 4;

        switch (operationType) {
          case 0: // CPU-intensive validation
            operations.push(
              createFragmentWithTiming(
                testProjectId,
                `heavy_${i}.cue`,
                `package spec\n\n// Complex nested structure\nheavy${i}: {\n\tfor i, v in list.Range(0, 100, 1) {\n\t\t"item_\\(i)": {\n\t\t\tid: i\n\t\t\tvalue: v * 2\n\t\t\tvalidation: string & =~"^[a-z]+$"\n\t\t}\n\t}\n}`,
              ),
            );
            break;

          case 1: {
            // Memory-intensive content
            const largeContent = `package spec\n\nlarge_data${i}: {\n${Array.from(
              { length: 200 },
              (_, j) => `\tfield_${j}: "large_string_value_${"x".repeat(50)}_${j}"`,
            ).join("\n")}\n}`;
            operations.push(
              createFragmentWithTiming(testProjectId, `large_${i}.cue`, largeContent),
            );
            break;
          }

          case 2: // Validation operation
            operations.push(
              fetch(`${baseUrl}/api/validate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project_id: testProjectId }),
              }),
            );
            break;

          case 3: // IR generation (if fragments exist)
            if (i > 5) {
              // Only after some fragments exist
              operations.push(
                fetch(`${baseUrl}/api/ir?project_id=${testProjectId}&type=capabilities`),
              );
            }
            break;
        }
      }

      const start = Date.now();
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - start;

      // Analyze results
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const _failed = results.filter((r) => r.status === "rejected").length;

      // Should handle most operations (some may fail due to resource limits)
      const successRate = successful / results.length;
      expect(successRate).toBeGreaterThan(0.7); // At least 70% success rate

      // System should remain responsive
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds

      console.log(
        `✅ Resource exhaustion test: ${successful}/${results.length} operations succeeded in ${duration}ms`,
      );

      // System should recover - try a simple operation
      const recoveryTest = await createFragmentWithTiming(
        testProjectId,
        "recovery_test.cue",
        "package spec\n\nrecovery: true",
      );

      expect(recoveryTest.response.status).toBe(201);
      console.log("✅ System recovered successfully after resource exhaustion");
    });
  });
});
