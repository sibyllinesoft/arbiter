/**
 * Unit tests for the SpecEngine with comprehensive validation pipeline coverage
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { generateId } from "../../io/utils";
import { SpecEngine } from "../../util/specEngine";
import type { Fragment, ServerConfig } from "../../util/types";
const MINIMAL_CAPABILITIES_BLOCK = `
capabilities: {
	"spec.test": {
		name: "Test Capability"
		description: "Capability used in SpecEngine tests"
	}
}
`;

async function directoryExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

describe("SpecEngine", () => {
  let engine: SpecEngine;
  let testConfig: ServerConfig;
  let testProjectId: string;
  let tempWorkdir: string;

  beforeAll(async () => {
    // Create temporary directory for tests
    tempWorkdir = `/tmp/spec-engine-test-${Date.now()}`;
    await Bun.write(join(tempWorkdir, ".gitkeep"), "");

    testConfig = {
      port: 0,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: tempWorkdir,
      jq_binary_path: "jq",
      auth_required: false,
      external_tool_timeout_ms: 10000,
      websocket: {
        max_connections: 100,
        ping_interval_ms: 30000,
      },
    };

    engine = new SpecEngine(testConfig);
  });

  beforeEach(() => {
    testProjectId = generateId();
  });

  afterAll(async () => {
    // Cleanup temp directory
    try {
      await Bun.spawn(["rm", "-rf", tempWorkdir]).exited;
    } catch (error) {
      console.warn("Failed to cleanup temp directory:", error);
    }
  });

  // NOTE: Fragment Formatting tests are skipped due to a known limitation in cuelang-js WASM.
  // The cue fmt command panics when trying to write back to the file system in the WASM environment.
  // These tests work correctly with the native cue binary but fail in the WASM-based implementation.
  describe("Fragment Formatting", () => {
    it.skip("should format valid CUE content", async () => {
      const unformattedContent = `package test
routes:{login:{path:"/auth/login",method:"POST"}}`;

      const result = await engine.formatFragment(unformattedContent);

      expect(result.success).toBe(true);
      expect(result.formatted).toBeDefined();
      expect(result.formatted).toContain("package test");
      expect(result.formatted).toContain("routes:");
      expect(result.formatted).toContain("login:");
    });

    it.skip("should handle invalid CUE syntax gracefully", async () => {
      const invalidContent = `package test
routes: {
  invalid syntax here!!!
  missing braces
`;

      const result = await engine.formatFragment(invalidContent);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("syntax");
    });

    it.skip("should preserve valid formatting", async () => {
      const wellFormattedContent = `package test

routes: {
	login: {
		path:   "/auth/login"
		method: "POST"
	}
}`;

      const result = await engine.formatFragment(wellFormattedContent);

      expect(result.success).toBe(true);
      expect(result.formatted).toContain("package test");
    });
  });

  describe("Project Validation Pipeline", () => {
    it("should validate simple valid project", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "main.cue",
          content: `package spec

routes: {
	home: {
		path:   "/"
		method: "GET"
	}
}

${MINIMAL_CAPABILITIES_BLOCK}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(true);
      expect(result.specHash).toBeDefined();
      expect(result.specHash.length).toBeGreaterThan(0);
      expect(result.resolved).toBeDefined();
      expect(result.errors).toEqual([]);
    });

    it("should detect CUE syntax errors", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "invalid.cue",
          content: `package spec

routes: {
  login: {
    path: "/auth/login"
    method: "POST"
    // Missing closing brace
  }
  // Missing closing brace for routes
`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe("schema");
      expect(result.errors[0].message).toBeDefined();
    });

    it("should detect type constraint violations", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "constraints.cue",
          content: `package spec

// Define constraint
User: {
	name: string & != ""
	age:  int & >= 0 & <= 150
}

// Invalid instance
user: User & {
	name: "" // Violates non-empty constraint
	age:  -5 // Violates >= 0
}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const constraintErrors = result.errors.filter((e) => e.message.includes("out of bound"));
      expect(constraintErrors.length).toBeGreaterThan(0);
    });

    it("should export resolved specification correctly", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "base.cue",
          content: `package spec

#Route: {
	path:   string
	method: "GET" | "POST" | "PUT" | "DELETE"
}

routes: [string]: #Route`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: generateId(),
          project_id: testProjectId,
          path: "routes.cue",
          content: `package spec

routes: {
	login: {
		path:   "/auth/login"
		method: "POST"
	}
	dashboard: {
		path:   "/dashboard"
		method: "GET"
	}
}

${MINIMAL_CAPABILITIES_BLOCK}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(true);
      expect(result.resolved).toBeDefined();
      expect(result.resolved?.routes).toBeDefined();

      const routes = result.resolved?.routes as any;
      expect(routes.login).toBeDefined();
      expect(routes.login.path).toBe("/auth/login");
      expect(routes.login.method).toBe("POST");
      expect(routes.dashboard).toBeDefined();
      expect(routes.dashboard.path).toBe("/dashboard");
      expect(routes.dashboard.method).toBe("GET");
    });

    it("should compute consistent spec hash for same content", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "test.cue",
          content: `package spec\n\ntest: "value"\n\n${MINIMAL_CAPABILITIES_BLOCK}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result1 = await engine.validateProject(testProjectId, fragments);
      const result2 = await engine.validateProject(testProjectId, fragments);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.specHash).toBe(result2.specHash);
    });

    it("should compute different spec hash for different content", async () => {
      const fragments1: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "test.cue",
          content: `package spec\n\ntest: "value1"\n\n${MINIMAL_CAPABILITIES_BLOCK}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const fragments2: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "test.cue",
          content: `package spec\n\ntest: "value2"\n\n${MINIMAL_CAPABILITIES_BLOCK}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result1 = await engine.validateProject(testProjectId, fragments1);
      const result2 = await engine.validateProject(testProjectId, fragments2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.specHash).not.toBe(result2.specHash);
    });

    it("should handle complex nested structures", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "complex.cue",
          content: `package spec

api: {
	v1: {
		endpoints: {
			users: {
				list: {
					path:   "/api/v1/users"
					method: "GET"
					params: {
						limit:  10
						offset: 0
					}
					response: {
						users: [
							{
								id:    "user-1"
								name:  "Alice"
								email: "alice@example.com"
							}
						]
						total: 1
					}
				}
				create: {
					path:   "/api/v1/users"
					method: "POST"
					body: {
						name:     "Alice"
						email:    "alice@example.com"
						password: "changeme123"
					}
				}
			}
		}
	}
}

${MINIMAL_CAPABILITIES_BLOCK}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(true);
      expect(result.resolved).toBeDefined();

      const api = result.resolved?.api as any;
      expect(api.v1.endpoints.users.list.path).toBe("/api/v1/users");
      expect(api.v1.endpoints.users.create.method).toBe("POST");
    });

    it("should handle multiple file dependencies", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "schemas.cue",
          content: `package spec

#User: {
	id:    string
	name:  string & != ""
	email: string & =~"^[^@]+@[^@]+$"
}

#Route: {
	path:   string
	method: "GET" | "POST" | "PUT" | "DELETE"
}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: generateId(),
          project_id: testProjectId,
          path: "routes.cue",
          content: `package spec

routes: {
	getUser: #Route & {
		path:   "/users/{id}"
		method: "GET"
	}
	createUser: #Route & {
		path:   "/users"
		method: "POST"
	}
}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: generateId(),
          project_id: testProjectId,
          path: "data.cue",
          content: `package spec

users: {
	"user1": #User & {
		id:    "user1"
		name:  "John Doe"
		email: "john@example.com"
	}
	"user2": #User & {
		id:    "user2"
		name:  "Jane Smith"
		email: "jane@example.com"
	}
}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: generateId(),
          project_id: testProjectId,
          path: "capabilities.cue",
          content: `package spec\n\n${MINIMAL_CAPABILITIES_BLOCK}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(true);
      expect(result.resolved).toBeDefined();

      const resolved = result.resolved!;
      expect((resolved.routes as any).getUser.path).toBe("/users/{id}");
      expect((resolved.users as any).user1.name).toBe("John Doe");
    });

    it("should detect unification conflicts", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "conflict.cue",
          content: `package spec

// Define the same field with conflicting values
config: {
	port: 8080
}

config: {
	port: 3000 // Conflict with above
}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some(
          (e) => e.message.includes("conflict") || e.message.includes("unification"),
        ),
      ).toBe(true);
    });
  });

  describe("Custom Validation Rules", () => {
    it("should detect missing capabilities", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "no-capabilities.cue",
          content: `package spec

routes: {
	login: {
		path:   "/auth/login"
		method: "POST"
	}
}

// No capabilities defined`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.type === "custom" && e.message.includes("capabilities")),
      ).toBe(true);
    });

    it("should detect duplicates and generate warnings", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "duplicates.cue",
          content: `package spec

capabilities: {
	"user.auth": {
		name: "User Authentication"
	}
	"user.profile": {
		name: "User Profile"  
	}
	"user.auth.login": {
		name: "User Login" // Contains duplicate "auth" component
	}
}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await engine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(true); // Duplicates are warnings, not errors
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some((w) => w.type === "duplicate" && w.message.includes("auth")),
      ).toBe(true);
    });
  });

  describe("Performance and Error Handling", () => {
    it("should complete validation within performance target", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "perf.cue",
          content: `package spec

routes: {
	home: { path: "/", method: "GET" }
}

capabilities: {
	"static.serve": "Serve static files"
}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const start = Date.now();
      const result = await engine.validateProject(testProjectId, fragments);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete under 5 seconds
    });

    it("should handle timeout gracefully", async () => {
      // Create engine with very short timeout
      const shortTimeoutConfig = { ...testConfig, external_tool_timeout_ms: 1 };
      const shortEngine = new SpecEngine(shortTimeoutConfig);

      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "test.cue",
          content: `package spec\n\ntest: "value"`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await shortEngine.validateProject(testProjectId, fragments);

      // Should handle timeout and return error
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle filesystem errors gracefully", async () => {
      // Use invalid workdir to trigger filesystem errors
      const invalidConfig = {
        ...testConfig,
        spec_workdir: "/invalid/readonly/path",
      };
      const invalidEngine = new SpecEngine(invalidConfig);

      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "test.cue",
          content: `package spec\n\ntest: "value"`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = await invalidEngine.validateProject(testProjectId, fragments);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle large projects efficiently", async () => {
      const fragments: Fragment[] = [];

      // Create many fragments to test scalability
      for (let i = 0; i < 20; i++) {
        fragments.push({
          id: generateId(),
          project_id: testProjectId,
          path: `fragment_${i}.cue`,
          content: `package spec

fragment${i}: {
	name: "Fragment ${i}"
	data: {
		items: {
			item0: "value-0"
			item1: "value-1"
			item2: "value-2"
		}
	}
}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      fragments.push({
        id: generateId(),
        project_id: testProjectId,
        path: "capabilities.cue",
        content: `package spec\n\n${MINIMAL_CAPABILITIES_BLOCK}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const start = Date.now();
      const result = await engine.validateProject(testProjectId, fragments);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete under 10 seconds
    });
  });

  describe("Cleanup Operations", () => {
    it("should cleanup project workspace", async () => {
      const fragments: Fragment[] = [
        {
          id: generateId(),
          project_id: testProjectId,
          path: "cleanup.cue",
          content: "package spec\n\ntest: true",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: generateId(),
          project_id: testProjectId,
          path: "capabilities.cue",
          content: `package spec\n\n${MINIMAL_CAPABILITIES_BLOCK}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Run validation to create workspace files
      await engine.validateProject(testProjectId, fragments);

      // Check that workspace directory exists
      const workspaceDir = join(testConfig.spec_workdir, testProjectId);
      const workspaceDirExists = await directoryExists(workspaceDir);
      expect(workspaceDirExists).toBe(true);

      // Cleanup project
      await engine.cleanupProject(testProjectId);

      // Check that workspace directory is removed
      const workspaceDirExistsAfter = await directoryExists(workspaceDir);
      expect(workspaceDirExistsAfter).toBe(false);
    });

    it("should handle cleanup of non-existent project gracefully", async () => {
      // Should not throw error when cleaning up non-existent project
      await expect(engine.cleanupProject("non-existent-project")).resolves.toBeUndefined();
    });
  });
});
