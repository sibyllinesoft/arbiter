/**
 * Performance validation and benchmarking tests
 * Validates all performance targets: 500ms validation, 100ms WebSocket broadcast, 1.5s initial load
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { SpecWorkbenchServer } from '../../server.ts';
import type { ServerConfig } from '../../types.ts';
import { generateId } from '../../utils.ts';

(process.env.ARBITER_FULL_API === '1' ? describe : describe.skip)('Performance Validation and Benchmarks', () => {
  let server: SpecWorkbenchServer;
  let baseUrl: string;
  let testConfig: ServerConfig;
  const performanceResults: Map<string, number[]> = new Map();

  beforeAll(async () => {
    const port = 6001 + Math.floor(Math.random() * 1000);

    testConfig = {
      port,
      host: 'localhost',
      database_path: ':memory:',
      spec_workdir: `/tmp/perf-test-${Date.now()}`,
      cue_binary_path: 'cue',
      jq_binary_path: 'jq',
      auth_required: false,
      rate_limit: {
        max_tokens: 10000, // High limit for performance testing
        refill_rate: 1000,
        window_ms: 1000,
      },
      external_tool_timeout_ms: 60000, // Allow for longer operations
      websocket: {
        max_connections: 200,
        ping_interval_ms: 30000,
      },
    };

    server = new SpecWorkbenchServer(testConfig);
    baseUrl = `http://localhost:${port}`;

    await server.start();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await server.shutdown();
    }

    // Print performance summary
    console.log('\n🎯 PERFORMANCE BENCHMARK SUMMARY');
    console.log('='.repeat(50));

    for (const [testName, measurements] of performanceResults) {
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const min = Math.min(...measurements);
      const max = Math.max(...measurements);
      const p95 = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

      console.log(`${testName}:`);
      console.log(`  Average: ${avg.toFixed(1)}ms`);
      console.log(`  Min: ${min}ms, Max: ${max}ms, P95: ${p95}ms`);
      console.log(`  Samples: ${measurements.length}`);
      console.log();
    }
  });

  /**
   * Record performance measurement
   */
  function recordPerformance(testName: string, duration: number) {
    if (!performanceResults.has(testName)) {
      performanceResults.set(testName, []);
    }
    performanceResults.get(testName)?.push(duration);
  }

  /**
   * Benchmark a function with multiple runs
   */
  async function benchmark<T>(
    name: string,
    fn: () => Promise<T>,
    runs = 5,
    warmupRuns = 1
  ): Promise<{ result: T; avgDuration: number; allDurations: number[] }> {
    // Warmup runs
    for (let i = 0; i < warmupRuns; i++) {
      await fn();
    }

    const durations: number[] = [];
    let lastResult: T;

    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      lastResult = await fn();
      const duration = performance.now() - start;
      durations.push(duration);
      recordPerformance(name, duration);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    return {
      result: lastResult!,
      avgDuration,
      allDurations: durations,
    };
  }

  /**
   * Create test fragments with varying complexity
   */
  async function createTestFragments(
    projectId: string,
    complexity: 'simple' | 'medium' | 'complex' = 'medium'
  ) {
    const fragments: Array<{ path: string; content: string }> = [];

    switch (complexity) {
      case 'simple':
        fragments.push({
          path: 'simple.cue',
          content: `package spec\n\nconfig: {\n\tapi_version: "v1"\n\tport: 8080\n}`,
        });
        break;

      case 'medium':
        fragments.push(
          {
            path: 'routes.cue',
            content: `package spec

routes: {
  auth: {
    login: {
      path: "/auth/login"
      method: "POST"
      parameters: {
        email: string & =~"^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$"
        password: string & len >8
      }
    }
    logout: {
      path: "/auth/logout"
      method: "POST"
    }
  }
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
}`,
          },
          {
            path: 'capabilities.cue',
            content: `package spec

capabilities: {
  "user.authentication": "User login and session management"
  "user.management": "User profile and account operations"
  "project.management": "Project CRUD and collaboration features"
  "api.access": "RESTful API access and operations"
}

flows: {
  user_onboarding: {
    steps: [
      {name: "registration", requires: ["email", "password"]},
      {name: "verification", requires: ["email_token"]},
      {name: "profile_setup", requires: ["user_id"]}
    ]
  }
  project_creation: {
    steps: [
      {name: "initialization", requires: ["name", "type"]},
      {name: "configuration", requires: ["settings"]},
      {name: "collaboration_setup", requires: ["team_members"]}
    ]
  }
}`,
          }
        );
        break;

      case 'complex':
        fragments.push(
          {
            path: 'complex_routes.cue',
            content: `package spec

routes: {
  for domain, config in {
    auth: {base_path: "/auth", methods: ["GET", "POST"]}
    api: {base_path: "/api", methods: ["GET", "POST", "PUT", "DELETE"]}
    admin: {base_path: "/admin", methods: ["GET", "POST", "PUT", "DELETE"]}
  } {
    (domain): {
      for endpoint in ["users", "projects", "settings", "analytics"] {
        (endpoint): {
          path: "\\(config.base_path)/\\(endpoint)"
          method: config.methods[0] | config.methods[1] | config.methods[2] | config.methods[3]
          if domain == "admin" {
            auth_required: true
            roles: ["admin", "super_admin"]
          }
          if endpoint == "analytics" {
            cache_ttl: 300
            rate_limit: {requests: 100, window: "1m"}
          }
        }
      }
    }
  }
}`,
          },
          {
            path: 'complex_validation.cue',
            content: `package spec

#User: {
  id: string & =~"^user_[a-z0-9]{16}$"
  email: string & =~"^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$"
  profile: {
    name: string & len > 0 & len <= 100
    avatar?: string & =~"^https?://.*\\.(jpg|jpeg|png|gif)$"
    preferences: {
      theme: "light" | "dark" | "auto"
      notifications: {
        email: bool
        push: bool
        sms: bool
      }
    }
  }
  created_at: string & =~"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$"
  updated_at: string & =~"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$"
}

#Project: {
  id: string & =~"^proj_[a-z0-9]{16}$"
  name: string & len > 0 & len <= 200
  description?: string & len <= 1000
  settings: {
    visibility: "private" | "public" | "team"
    collaboration: {
      allow_comments: bool
      allow_suggestions: bool
      max_contributors: int & >0 & <=100
    }
  }
  members: [...#User]
  if len(members) > settings.collaboration.max_contributors {
    _error: "Too many contributors"
  }
}`,
          }
        );
        break;
    }

    const createPromises = fragments.map(fragment =>
      fetch(`${baseUrl}/api/fragments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          path: fragment.path,
          content: fragment.content,
        }),
      })
    );

    const responses = await Promise.all(createPromises);
    responses.forEach(response => {
      expect(response.status).toBe(201);
    });

    return fragments.length;
  }

  describe('Validation Performance Targets', () => {
    let testProjectId: string;

    beforeEach(() => {
      testProjectId = generateId();
    });

    it('should validate simple projects under 200ms (target: <500ms)', async () => {
      await createTestFragments(testProjectId, 'simple');

      const benchmark_result = await benchmark(
        'Simple Validation',
        async () => {
          const response = await fetch(`${baseUrl}/api/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: testProjectId }),
          });

          expect(response.status).toBe(200);
          const result = await response.json();
          expect(result.success).toBe(true);
          return result;
        },
        10 // More runs for simple cases
      );

      // Should be well under target for simple cases
      expect(benchmark_result.avgDuration).toBeLessThan(200);
      console.log(
        `✅ Simple validation: ${benchmark_result.avgDuration.toFixed(1)}ms avg (target: <500ms)`
      );
    });

    it('should validate medium projects under 500ms (performance target)', async () => {
      await createTestFragments(testProjectId, 'medium');

      const benchmark_result = await benchmark(
        'Medium Validation',
        async () => {
          const response = await fetch(`${baseUrl}/api/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: testProjectId }),
          });

          expect(response.status).toBe(200);
          const result = await response.json();
          expect(result.success).toBe(true);
          return result;
        },
        8
      );

      // Must meet performance target
      expect(benchmark_result.avgDuration).toBeLessThan(500);
      console.log(
        `✅ Medium validation: ${benchmark_result.avgDuration.toFixed(1)}ms avg (target: <500ms)`
      );
    });

    it('should validate complex projects under 1000ms (stress test)', async () => {
      await createTestFragments(testProjectId, 'complex');

      const benchmark_result = await benchmark(
        'Complex Validation',
        async () => {
          const response = await fetch(`${baseUrl}/api/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: testProjectId }),
          });

          expect(response.status).toBe(200);
          const result = await response.json();
          expect(result.success).toBe(true);
          return result;
        },
        5
      );

      // Stress test - should handle complex cases reasonably
      expect(benchmark_result.avgDuration).toBeLessThan(1000);
      console.log(
        `✅ Complex validation: ${benchmark_result.avgDuration.toFixed(1)}ms avg (stress test: <1000ms)`
      );
    });

    it('should maintain performance under concurrent validation load', async () => {
      await createTestFragments(testProjectId, 'medium');

      const concurrentRequests = 5;
      const requestPromises = [];

      const overallStart = performance.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = (async () => {
          const start = performance.now();
          const response = await fetch(`${baseUrl}/api/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: testProjectId }),
          });
          const duration = performance.now() - start;

          expect(response.status).toBe(200);
          const result = await response.json();
          expect(result.success).toBe(true);

          return { result, duration };
        })();

        requestPromises.push(promise);
      }

      const results = await Promise.all(requestPromises);
      const overallDuration = performance.now() - overallStart;

      // Individual requests should still meet target
      results.forEach(({ duration }) => {
        expect(duration).toBeLessThan(750); // Slightly higher under load
        recordPerformance('Concurrent Validation', duration);
      });

      // All requests should complete within reasonable time
      expect(overallDuration).toBeLessThan(1500);

      const avgDuration = results.reduce((sum, { duration }) => sum + duration, 0) / results.length;
      console.log(
        `✅ Concurrent validation: ${concurrentRequests} requests, ${avgDuration.toFixed(1)}ms avg, ${overallDuration.toFixed(1)}ms total`
      );
    });
  });

  describe('API Response Time Benchmarks', () => {
    let testProjectId: string;

    beforeEach(async () => {
      testProjectId = generateId();
      await createTestFragments(testProjectId, 'medium');
    });

    it('should retrieve fragments under 100ms', async () => {
      const benchmark_result = await benchmark(
        'Fragment Retrieval',
        async () => {
          const response = await fetch(`${baseUrl}/api/fragments?project_id=${testProjectId}`);
          expect(response.status).toBe(200);
          return await response.json();
        },
        10
      );

      expect(benchmark_result.avgDuration).toBeLessThan(100);
      console.log(`✅ Fragment retrieval: ${benchmark_result.avgDuration.toFixed(1)}ms avg`);
    });

    it('should create fragments under 150ms', async () => {
      const benchmark_result = await benchmark(
        'Fragment Creation',
        async () => {
          const response = await fetch(`${baseUrl}/api/fragments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: testProjectId,
              path: `perf_test_${Date.now()}.cue`,
              content: `package spec\n\nperf_test: {\n\ttimestamp: "${new Date().toISOString()}"\n}`,
            }),
          });
          expect(response.status).toBe(201);
          return await response.json();
        },
        8
      );

      expect(benchmark_result.avgDuration).toBeLessThan(150);
      console.log(`✅ Fragment creation: ${benchmark_result.avgDuration.toFixed(1)}ms avg`);
    });

    it('should retrieve resolved spec under 200ms', async () => {
      // Ensure project is validated first
      await fetch(`${baseUrl}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: testProjectId }),
      });

      const benchmark_result = await benchmark(
        'Resolved Spec Retrieval',
        async () => {
          const response = await fetch(`${baseUrl}/api/resolved?project_id=${testProjectId}`);
          expect(response.status).toBe(200);
          return await response.json();
        },
        8
      );

      expect(benchmark_result.avgDuration).toBeLessThan(200);
      console.log(`✅ Resolved spec retrieval: ${benchmark_result.avgDuration.toFixed(1)}ms avg`);
    });

    it('should generate IR under 300ms', async () => {
      // Ensure project is validated first
      await fetch(`${baseUrl}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: testProjectId }),
      });

      const irTypes = ['capabilities', 'flows', 'dependencies', 'coverage'];

      for (const irType of irTypes) {
        const benchmark_result = await benchmark(
          `IR Generation (${irType})`,
          async () => {
            const response = await fetch(
              `${baseUrl}/api/ir?project_id=${testProjectId}&type=${irType}`
            );
            expect(response.status).toBe(200);
            return await response.json();
          },
          5
        );

        expect(benchmark_result.avgDuration).toBeLessThan(300);
        console.log(`✅ ${irType} IR generation: ${benchmark_result.avgDuration.toFixed(1)}ms avg`);
      }
    });
  });

  describe('Initial Load Performance', () => {
    it('should handle complete project initialization under 1.5s (target)', async () => {
      const testProjectId = generateId();

      const benchmark_result = await benchmark(
        'Complete Project Initialization',
        async () => {
          // Simulate complete project setup
          const start = performance.now();

          // Step 1: Create multiple fragments
          const fragmentPromises = [];
          for (let i = 0; i < 5; i++) {
            fragmentPromises.push(
              fetch(`${baseUrl}/api/fragments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  project_id: testProjectId,
                  path: `init_${i}.cue`,
                  content: `package spec\n\ninit${i}: {\n\tid: ${i}\n\tvalue: "initialization_${i}"\n}`,
                }),
              })
            );
          }
          await Promise.all(fragmentPromises);

          // Step 2: Validate project
          const validationResponse = await fetch(`${baseUrl}/api/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: testProjectId }),
          });
          expect(validationResponse.status).toBe(200);

          // Step 3: Get resolved spec
          const resolvedResponse = await fetch(
            `${baseUrl}/api/resolved?project_id=${testProjectId}`
          );
          expect(resolvedResponse.status).toBe(200);

          // Step 4: Generate gap analysis
          const gapResponse = await fetch(`${baseUrl}/api/gaps?project_id=${testProjectId}`);
          expect(gapResponse.status).toBe(200);

          const totalDuration = performance.now() - start;
          return { totalDuration };
        },
        3 // Fewer runs for this comprehensive test
      );

      // Must meet the 1.5s target
      expect(benchmark_result.avgDuration).toBeLessThan(1500);
      console.log(
        `✅ Complete project initialization: ${benchmark_result.avgDuration.toFixed(1)}ms avg (target: <1500ms)`
      );
    });

    it('should handle cold start scenario efficiently', async () => {
      // Test server responsiveness after idle period
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s idle

      const testProjectId = generateId();

      const benchmark_result = await benchmark(
        'Cold Start Response',
        async () => {
          const response = await fetch(`${baseUrl}/api/fragments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: testProjectId,
              path: 'cold_start.cue',
              content: 'package spec\n\ncold_start: true',
            }),
          });
          expect(response.status).toBe(201);
          return await response.json();
        },
        5
      );

      // Cold start should still be reasonable
      expect(benchmark_result.avgDuration).toBeLessThan(300);
      console.log(`✅ Cold start response: ${benchmark_result.avgDuration.toFixed(1)}ms avg`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large projects without performance degradation', async () => {
      const testProjectId = generateId();
      const fragmentCount = 20;

      // Create many fragments
      const createStart = performance.now();
      const fragmentPromises = [];

      for (let i = 0; i < fragmentCount; i++) {
        const content = `package spec

large_section_${i}: {
  for j in list.Range(0, 50, 1) {
    "item_\\(j)": {
      id: "\\(i)_\\(j)"
      value: \\(i * 1000 + j)
      description: "Large item description with some text content \\(i)_\\(j)"
      metadata: {
        created: "2024-01-\\(j % 28 + 1)T12:00:00Z"
        tags: ["tag_\\(i)", "tag_\\(j)", "large_project"]
      }
    }
  }
}`;

        fragmentPromises.push(
          fetch(`${baseUrl}/api/fragments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: testProjectId,
              path: `large_${i}.cue`,
              content,
            }),
          })
        );
      }

      await Promise.all(fragmentPromises);
      const createDuration = performance.now() - createStart;

      // Validate large project
      const validationStart = performance.now();
      const validationResponse = await fetch(`${baseUrl}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: testProjectId }),
      });
      const validationDuration = performance.now() - validationStart;

      expect(validationResponse.status).toBe(200);
      const result = await validationResponse.json();
      expect(result.success).toBe(true);

      // Performance should degrade gracefully, not catastrophically
      expect(createDuration).toBeLessThan(5000); // 5s for 20 fragments
      expect(validationDuration).toBeLessThan(2000); // 2s for large validation

      recordPerformance('Large Project Creation', createDuration);
      recordPerformance('Large Project Validation', validationDuration);

      console.log(
        `✅ Large project: ${fragmentCount} fragments created in ${createDuration.toFixed(1)}ms, validated in ${validationDuration.toFixed(1)}ms`
      );
    });
  });

  describe('Golden File Performance Comparison', () => {
    it('should match golden file performance baselines', async () => {
      // Load the same test project used in golden files
      const goldenProjectId = 'golden-performance-baseline';

      // Create the exact same fragments as in golden tests
      await fetch(`${baseUrl}/api/fragments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: goldenProjectId,
          path: 'ui.routes.cue',
          content: await Bun.file(
            '/home/nathan/Projects/arbiter/golden-test-project/ui.routes.cue'
          ).text(),
        }),
      });

      await fetch(`${baseUrl}/api/fragments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: goldenProjectId,
          path: 'locators.cue',
          content: await Bun.file(
            '/home/nathan/Projects/arbiter/golden-test-project/locators.cue'
          ).text(),
        }),
      });

      await fetch(`${baseUrl}/api/fragments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: goldenProjectId,
          path: 'flows.cue',
          content: await Bun.file(
            '/home/nathan/Projects/arbiter/golden-test-project/flows.cue'
          ).text(),
        }),
      });

      await fetch(`${baseUrl}/api/fragments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: goldenProjectId,
          path: 'completion.cue',
          content: await Bun.file(
            '/home/nathan/Projects/arbiter/golden-test-project/completion.cue'
          ).text(),
        }),
      });

      // Benchmark the same operations as golden tests
      const validationBenchmark = await benchmark(
        'Golden File Validation Baseline',
        async () => {
          const response = await fetch(`${baseUrl}/api/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: goldenProjectId }),
          });
          expect(response.status).toBe(200);
          const result = await response.json();
          expect(result.success).toBe(true);
          return result;
        },
        10
      );

      // Should match golden file performance target (2000ms)
      expect(validationBenchmark.avgDuration).toBeLessThan(2000);

      // Generate all IR types and measure
      const irTypes = ['capabilities', 'flows', 'dependencies', 'coverage'];
      for (const irType of irTypes) {
        const irBenchmark = await benchmark(
          `Golden File IR Generation (${irType})`,
          async () => {
            const response = await fetch(
              `${baseUrl}/api/ir?project_id=${goldenProjectId}&type=${irType}`
            );
            expect(response.status).toBe(200);
            return await response.json();
          },
          5
        );

        // Should match golden file IR target (500ms)
        expect(irBenchmark.avgDuration).toBeLessThan(500);
      }

      console.log(
        `✅ Golden file performance baseline validated: ${validationBenchmark.avgDuration.toFixed(1)}ms validation`
      );
    });

    it('should demonstrate performance consistency across test runs', async () => {
      const testProjectId = generateId();
      await createTestFragments(testProjectId, 'medium');

      const consistencyRuns = 10;
      const measurements: number[] = [];

      for (let i = 0; i < consistencyRuns; i++) {
        const start = performance.now();
        const response = await fetch(`${baseUrl}/api/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: testProjectId }),
        });
        const duration = performance.now() - start;

        expect(response.status).toBe(200);
        measurements.push(duration);

        // Small delay between runs
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate consistency metrics
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const variance =
        measurements.reduce((sum, x) => sum + (x - avg) ** 2, 0) / measurements.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / avg;

      // Performance should be consistent (CV < 30%)
      expect(coefficientOfVariation).toBeLessThan(0.3);

      recordPerformance('Validation Consistency', avg);

      console.log(
        `✅ Performance consistency: ${avg.toFixed(1)}ms avg, ${stdDev.toFixed(1)}ms std dev, ${(coefficientOfVariation * 100).toFixed(1)}% CV`
      );
    });
  });
});
