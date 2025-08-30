/**
 * Integration tests for API endpoints with real server instance
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { SpecWorkbenchServer } from "../../server.ts";
import type { ServerConfig, CreateFragmentRequest, ValidationRequest } from "../../types.ts";
import { generateId } from "../../utils.ts";

describe("API Integration Tests", () => {
  let server: SpecWorkbenchServer;
  let baseUrl: string;
  let testConfig: ServerConfig;
  let testProjectId: string;

  beforeAll(async () => {
    // Use random port to avoid conflicts
    const port = 4000 + Math.floor(Math.random() * 1000);
    
    testConfig = {
      port,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: `/tmp/api-test-${Date.now()}`,
      cue_binary_path: "cue",
      jq_binary_path: "jq",
      auth_required: false, // Disable auth for testing
      rate_limit: {
        max_tokens: 100,
        refill_rate: 10,
        window_ms: 10000
      },
      external_tool_timeout_ms: 10000,
      websocket: {
        max_connections: 100,
        ping_interval_ms: 30000
      }
    };

    server = new SpecWorkbenchServer(testConfig);
    baseUrl = `http://localhost:${port}`;
    
    // Start server
    await server.start();
    
    // Wait a bit for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  beforeEach(() => {
    testProjectId = generateId();
  });

  /**
   * Helper to make HTTP requests to the server
   */
  async function makeRequest(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${baseUrl}${endpoint}`;
    const defaultHeaders = {
      "Content-Type": "application/json",
      ...options.headers
    };

    return await fetch(url, {
      ...options,
      headers: defaultHeaders
    });
  }

  describe("Health Check Endpoint", () => {
    it("should return healthy status", async () => {
      const response = await makeRequest("/health");
      
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe("healthy");
      expect(health.timestamp).toBeDefined();
      expect(health.database).toBe(true);
    });
  });

  describe("Fragments API", () => {
    it("should create fragment successfully", async () => {
      const fragmentData: CreateFragmentRequest & { project_id: string } = {
        project_id: testProjectId,
        path: "test.cue",
        content: `package spec

routes: {
	home: {
		path: "/"
		method: "GET"
	}
}`
      };

      const response = await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify(fragmentData)
      });

      expect(response.status).toBe(201);
      
      const result = await response.json();
      expect(result.id).toBeDefined();
      expect(result.path).toBe("test.cue");
      expect(result.created_at).toBeDefined();
    });

    it("should validate fragment content format", async () => {
      const invalidData = {
        project_id: testProjectId,
        path: "invalid.cue",
        content: `package spec

// Invalid CUE syntax
routes: {
  home: {
    path: "/"
    method: "GET"
    // Missing closing brace
  }
  // Missing closing brace
`
      };

      const response = await makeRequest("/api/fragments", {
        method: "POST", 
        body: JSON.stringify(invalidData)
      });

      // Should still create the fragment (validation happens later)
      expect(response.status).toBe(201);
    });

    it("should reject invalid path format", async () => {
      const invalidData = {
        project_id: testProjectId,
        path: "../../../etc/passwd", // Invalid path
        content: "package spec"
      };

      const response = await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify(invalidData)
      });

      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error.title).toBe("Bad Request");
      expect(error.detail).toContain("Invalid path format");
    });

    it("should handle missing required fields", async () => {
      const incompleteData = {
        project_id: testProjectId,
        path: "test.cue"
        // Missing content
      };

      const response = await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify(incompleteData)
      });

      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error.detail).toContain("content are required");
    });

    it("should handle update of existing fragment", async () => {
      const fragmentPath = "update.cue";
      
      // Create initial fragment
      const initialData = {
        project_id: testProjectId,
        path: fragmentPath,
        content: "package spec\n\ninitial: true"
      };

      const createResponse = await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify(initialData)
      });
      expect(createResponse.status).toBe(201);

      // Update same fragment  
      const updateData = {
        project_id: testProjectId,
        path: fragmentPath,
        content: "package spec\n\nupdated: true"
      };

      const updateResponse = await makeRequest("/api/fragments", {
        method: "POST", 
        body: JSON.stringify(updateData)
      });
      expect(updateResponse.status).toBe(201);
    });

    it("should handle concurrent fragment creation", async () => {
      const promises = [];
      
      // Create 10 fragments concurrently
      for (let i = 0; i < 10; i++) {
        const data = {
          project_id: testProjectId,
          path: `concurrent_${i}.cue`,
          content: `package spec\n\nfragment${i}: true`
        };

        const promise = makeRequest("/api/fragments", {
          method: "POST",
          body: JSON.stringify(data)
        });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
    });
  });

  describe("Validation API", () => {
    beforeEach(async () => {
      // Create a valid fragment for validation tests
      await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          path: "main.cue",
          content: `package spec

routes: {
	login: {
		path: "/auth/login"
		method: "POST"
	}
	home: {
		path: "/"
		method: "GET"
	}
}

capabilities: {
	"user.auth": "User authentication"
	"static.serve": "Serve static files"
}`
        })
      });
    });

    it("should validate project successfully", async () => {
      const validationData: ValidationRequest & { project_id: string } = {
        project_id: testProjectId
      };

      const response = await makeRequest("/api/validate", {
        method: "POST",
        body: JSON.stringify(validationData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.spec_hash).toBeDefined();
      expect(result.spec_hash.length).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
    });

    it("should return validation errors for invalid CUE", async () => {
      // Add invalid fragment
      await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          path: "invalid.cue",
          content: `package spec

// This will cause validation error
config: {
	port: 8080
}

config: {
	port: 3000 // Conflicting value
}`
        })
      });

      const response = await makeRequest("/api/validate", {
        method: "POST",
        body: JSON.stringify({ project_id: testProjectId })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe("schema");
    });

    it("should handle validation timeout gracefully", async () => {
      // Create a complex fragment that might cause timeout
      const complexContent = `package spec

// Generate large structure that could cause timeout
data: {
	${Array.from({ length: 1000 }, (_, i) => `"item${i}": "${i}"`).join('\n\t')}
}`;

      await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          path: "complex.cue",
          content: complexContent
        })
      });

      const response = await makeRequest("/api/validate", {
        method: "POST",
        body: JSON.stringify({ project_id: testProjectId })
      });

      // Should complete within reasonable time
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("Resolved Specification API", () => {
    beforeEach(async () => {
      // Create and validate a project
      await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          path: "base.cue",
          content: `package spec

routes: {
	api: {
		users: {
			path: "/api/users"
			method: "GET"
		}
	}
}

config: {
	version: "1.0.0"
	environment: "test"
}`
        })
      });

      // Validate to create version
      await makeRequest("/api/validate", {
        method: "POST",
        body: JSON.stringify({ project_id: testProjectId })
      });
    });

    it("should retrieve resolved specification", async () => {
      const response = await makeRequest(`/api/resolved?project_id=${testProjectId}`);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.spec_hash).toBeDefined();
      expect(result.resolved).toBeDefined();
      expect(result.last_updated).toBeDefined();

      // Check resolved structure
      expect(result.resolved.routes).toBeDefined();
      expect(result.resolved.routes.api.users.path).toBe("/api/users");
      expect(result.resolved.config.version).toBe("1.0.0");
    });

    it("should return 404 for project with no resolved spec", async () => {
      const emptyProjectId = generateId();
      
      const response = await makeRequest(`/api/resolved?project_id=${emptyProjectId}`);

      expect(response.status).toBe(404);
      
      const error = await response.json();
      expect(error.title).toBe("Not Found");
    });

    it("should require project_id parameter", async () => {
      const response = await makeRequest("/api/resolved");

      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error.detail).toContain("project_id parameter is required");
    });
  });

  describe("Gap Analysis API", () => {
    beforeEach(async () => {
      // Create project with gaps for analysis
      await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          path: "gaps.cue",
          content: `package spec

capabilities: {
	"user.auth": {
		name: "User Authentication"
		description: "Handle login/logout"
	}
	"project.create": {
		name: "Project Creation"
		description: "Create new projects"
	}
}

// Some tests but not complete coverage
tests: {
	"auth.login": {
		name: "Login Test"
		covers: ["user.auth"]
	}
	// Note: project.create has no tests
}

// Template with unresolved tokens
template: "Welcome \${user.name} to project \${project.id}"`
        })
      });

      // Validate to create resolved spec
      await makeRequest("/api/validate", {
        method: "POST",
        body: JSON.stringify({ project_id: testProjectId })
      });
    });

    it("should generate gap analysis", async () => {
      const response = await makeRequest(`/api/gaps?project_id=${testProjectId}`);

      expect(response.status).toBe(200);
      
      const gapSet = await response.json();
      expect(gapSet.missing_capabilities).toBeDefined();
      expect(gapSet.orphaned_tokens).toBeDefined();
      expect(gapSet.coverage_gaps).toBeDefined();
      expect(gapSet.duplicates).toBeDefined();

      // Should detect coverage gap for project.create
      expect(gapSet.coverage_gaps.length).toBeGreaterThan(0);
      const hasProjectGap = gapSet.coverage_gaps.some((gap: any) => 
        gap.capability === "project.create"
      );
      expect(hasProjectGap).toBe(true);

      // Should detect orphaned tokens
      expect(gapSet.orphaned_tokens.length).toBeGreaterThan(0);
      const tokenStrings = gapSet.orphaned_tokens.map((t: any) => t.token);
      const hasUserToken = tokenStrings.some((token: string) => token.includes("user.name"));
      const hasProjectToken = tokenStrings.some((token: string) => token.includes("project.id"));
      expect(hasUserToken || hasProjectToken).toBe(true);
    });

    it("should handle empty project gracefully", async () => {
      const emptyProjectId = generateId();
      
      // Create empty project
      await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: emptyProjectId,
          path: "empty.cue",
          content: "package spec\n\n// Empty project"
        })
      });

      await makeRequest("/api/validate", {
        method: "POST",
        body: JSON.stringify({ project_id: emptyProjectId })
      });

      const response = await makeRequest(`/api/gaps?project_id=${emptyProjectId}`);

      expect(response.status).toBe(200);
      
      const gapSet = await response.json();
      expect(gapSet.missing_capabilities).toEqual([]);
      expect(gapSet.orphaned_tokens).toEqual([]);
      expect(gapSet.coverage_gaps).toEqual([]);
      expect(gapSet.duplicates).toEqual([]);
    });
  });

  describe("IR Generation API", () => {
    beforeEach(async () => {
      // Create project with data for IR generation
      await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          path: "ir-data.cue",
          content: `package spec

capabilities: {
	"user.auth": {
		name: "User Authentication"
		depends_on: []
	}
	"user.profile": {
		name: "User Profile" 
		depends_on: ["user.auth"]
	}
}

flows: {
	login_flow: {
		name: "User Login Flow"
		steps: [
			{
				name: "Show Login Form"
				actor: "system"
				action: "display_form"
			},
			{
				name: "Submit Credentials"
				actor: "user"
				action: "submit_form"
			}
		]
	}
}

tests: {
	"auth.test": {
		name: "Auth Test"
		covers: ["user.auth"]
	}
}`
        })
      });

      // Validate to create resolved spec
      await makeRequest("/api/validate", {
        method: "POST",
        body: JSON.stringify({ project_id: testProjectId })
      });
    });

    it("should generate capabilities IR", async () => {
      const response = await makeRequest(`/api/ir/capabilities?project_id=${testProjectId}`);

      expect(response.status).toBe(200);
      
      const ir = await response.json();
      expect(ir.kind).toBe("capabilities");
      expect(ir.data.type).toBe("directed_graph");
      expect(ir.data.nodes).toBeDefined();
      expect(ir.data.edges).toBeDefined();
      expect(ir.generated_at).toBeDefined();

      // Check for expected capabilities
      const nodes = ir.data.nodes;
      expect(nodes.length).toBe(2);
      
      const authNode = nodes.find((n: any) => n.id === "user.auth");
      expect(authNode).toBeDefined();
      expect(authNode.label).toBe("User Authentication");
    });

    it("should generate flows IR", async () => {
      const response = await makeRequest(`/api/ir/flows?project_id=${testProjectId}`);

      expect(response.status).toBe(200);
      
      const ir = await response.json();
      expect(ir.kind).toBe("flows");
      expect(ir.data.type).toBe("flowchart");
      expect(ir.data.flows).toBeDefined();

      const flows = ir.data.flows;
      expect(flows.length).toBe(1);
      expect(flows[0].name).toBe("User Login Flow");
    });

    it("should generate dependencies IR", async () => {
      const response = await makeRequest(`/api/ir/dependencies?project_id=${testProjectId}`);

      expect(response.status).toBe(200);
      
      const ir = await response.json();
      expect(ir.kind).toBe("dependencies");
      expect(ir.data.type).toBe("layered_graph");
      expect(ir.data.layers).toBeDefined();
    });

    it("should generate coverage IR", async () => {
      const response = await makeRequest(`/api/ir/coverage?project_id=${testProjectId}`);

      expect(response.status).toBe(200);
      
      const ir = await response.json();
      expect(ir.kind).toBe("coverage");
      expect(ir.data.type).toBe("coverage_graph");
      expect(ir.data.coverage).toBeDefined();

      const coverage = ir.data.coverage;
      expect(typeof coverage.overall).toBe("number");
      expect(coverage.overall).toBeGreaterThanOrEqual(0);
      expect(coverage.overall).toBeLessThanOrEqual(100);
    });

    it("should reject invalid IR kind", async () => {
      const response = await makeRequest(`/api/ir/invalid?project_id=${testProjectId}`);

      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error.detail).toContain("Invalid IR kind");
    });
  });

  describe("Error Handling", () => {
    it("should return CORS headers for all responses", async () => {
      const response = await makeRequest("/health");
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    });

    it("should handle preflight OPTIONS requests", async () => {
      const response = await makeRequest("/api/fragments", {
        method: "OPTIONS"
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });

    it("should return 404 for non-existent routes", async () => {
      const response = await makeRequest("/api/nonexistent");

      expect(response.status).toBe(404);
      
      const error = await response.json();
      expect(error.type).toBeDefined();
      expect(error.title).toBe("Not Found");
    });

    it("should return proper error format for malformed JSON", async () => {
      const response = await makeRequest("/api/fragments", {
        method: "POST",
        body: "{ invalid json"
      });

      expect(response.status).toBe(400);
    });

    it("should handle rate limiting", async () => {
      // Make many requests quickly to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 150; i++) { // Exceed rate limit
        promises.push(makeRequest("/health"));
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe("Performance Validation", () => {
    it("should handle API requests within performance targets", async () => {
      // Fragment creation should be fast
      const start = Date.now();
      const response = await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          path: "perf.cue",
          content: "package spec\n\ntest: true"
        })
      });
      const duration = Date.now() - start;

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(1000); // Should complete under 1 second
    });

    it("should complete validation within target time", async () => {
      // Create fragment
      await makeRequest("/api/fragments", {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          path: "validation-perf.cue", 
          content: `package spec

routes: {
	${Array.from({ length: 50 }, (_, i) => 
    `"route${i}": { path: "/path${i}", method: "GET" }`
  ).join('\n\t')}
}

capabilities: {
	${Array.from({ length: 20 }, (_, i) => 
    `"cap${i}": "Capability ${i}"`
  ).join('\n\t')}
}`
        })
      });

      // Validation should complete within target
      const start = Date.now();
      const response = await makeRequest("/api/validate", {
        method: "POST",
        body: JSON.stringify({ project_id: testProjectId })
      });
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should complete under 2 seconds

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it("should handle concurrent API requests efficiently", async () => {
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = makeRequest("/api/fragments", {
          method: "POST",
          body: JSON.stringify({
            project_id: `concurrent-${i}`,
            path: `concurrent-${i}.cue`,
            content: `package spec\n\ndata${i}: true`
          })
        });
        promises.push(promise);
      }

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Should handle concurrent load efficiently
      expect(duration).toBeLessThan(5000); // All requests under 5 seconds
      console.log(`✅ ${concurrentRequests} concurrent requests completed in ${duration}ms`);
    });
  });
});