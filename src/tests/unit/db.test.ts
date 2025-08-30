/**
 * Unit tests for the database layer with comprehensive coverage
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { SpecWorkbenchDB } from "../../db.ts";
import type { ServerConfig, Project, Fragment } from "../../types.ts";
import { generateId } from "../../utils.ts";

describe("SpecWorkbenchDB", () => {
  let db: SpecWorkbenchDB;
  let testConfig: ServerConfig;
  let testProjectId: string;
  let testFragmentId: string;

  beforeAll(() => {
    testConfig = {
      port: 0,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: "/tmp/test-workdir",
      cue_binary_path: "cue",
      jq_binary_path: "jq",
      auth_required: false,
      rate_limit: {
        max_tokens: 10,
        refill_rate: 1,
        window_ms: 10000
      },
      external_tool_timeout_ms: 5000,
      websocket: {
        max_connections: 100,
        ping_interval_ms: 30000
      }
    };

    db = new SpecWorkbenchDB(testConfig);
  });

  beforeEach(() => {
    testProjectId = generateId();
    testFragmentId = generateId();
  });

  afterAll(async () => {
    db.close();
  });

  describe("Project Operations", () => {
    it("should create a project successfully", async () => {
      const project = await db.createProject(testProjectId, "Test Project");
      
      expect(project.id).toBe(testProjectId);
      expect(project.name).toBe("Test Project");
      expect(project.created_at).toBeDefined();
      expect(project.updated_at).toBeDefined();
    });

    it("should reject duplicate project IDs", async () => {
      await db.createProject(testProjectId, "First Project");
      
      expect(() => 
        db.createProject(testProjectId, "Duplicate Project")
      ).toThrow();
    });

    it("should retrieve a project by ID", async () => {
      const created = await db.createProject(testProjectId, "Test Project");
      const retrieved = await db.getProject(testProjectId);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(created.name);
    });

    it("should return null for non-existent project", async () => {
      const project = await db.getProject("non-existent-id");
      expect(project).toBeNull();
    });

    it("should list projects in descending creation order", async () => {
      const project1Id = generateId();
      const project2Id = generateId();
      
      await db.createProject(project1Id, "First Project");
      // Small delay to ensure different creation times
      await new Promise(resolve => setTimeout(resolve, 10));
      await db.createProject(project2Id, "Second Project");
      
      const projects = await db.listProjects();
      
      expect(projects.length).toBeGreaterThanOrEqual(2);
      expect(projects[0].id).toBe(project2Id); // Most recent first
      expect(projects[1].id).toBe(project1Id);
    });

    it("should delete a project and cascade to related data", async () => {
      const project = await db.createProject(testProjectId, "Test Project");
      const fragment = await db.createFragment(testFragmentId, testProjectId, "test.cue", "package test");
      
      // Verify fragment exists
      const retrievedFragment = await db.getFragment(testProjectId, "test.cue");
      expect(retrievedFragment).not.toBeNull();
      
      // Delete project
      await db.deleteProject(testProjectId);
      
      // Verify project is deleted
      const retrievedProject = await db.getProject(testProjectId);
      expect(retrievedProject).toBeNull();
      
      // Verify fragment is cascade deleted
      const retrievedFragmentAfterDelete = await db.getFragment(testProjectId, "test.cue");
      expect(retrievedFragmentAfterDelete).toBeNull();
    });

    it("should throw error when deleting non-existent project", async () => {
      expect(() => 
        db.deleteProject("non-existent-id")
      ).toThrow("Project not found");
    });
  });

  describe("Fragment Operations", () => {
    beforeEach(async () => {
      await db.createProject(testProjectId, "Test Project");
    });

    it("should create a fragment successfully", async () => {
      const fragment = await db.createFragment(
        testFragmentId,
        testProjectId,
        "ui/routes.cue",
        "package spec\n\nroutes: {}"
      );
      
      expect(fragment.id).toBe(testFragmentId);
      expect(fragment.project_id).toBe(testProjectId);
      expect(fragment.path).toBe("ui/routes.cue");
      expect(fragment.content).toBe("package spec\n\nroutes: {}");
      expect(fragment.created_at).toBeDefined();
      expect(fragment.updated_at).toBeDefined();
    });

    it("should enforce unique project_id + path constraint", async () => {
      await db.createFragment(testFragmentId, testProjectId, "test.cue", "content1");
      
      expect(() => 
        db.createFragment(generateId(), testProjectId, "test.cue", "content2")
      ).toThrow();
    });

    it("should update fragment content", async () => {
      await db.createFragment(testFragmentId, testProjectId, "test.cue", "original content");
      
      const updated = await db.updateFragment(testProjectId, "test.cue", "updated content");
      
      expect(updated.content).toBe("updated content");
      expect(updated.updated_at).not.toBe(updated.created_at);
    });

    it("should throw error when updating non-existent fragment", async () => {
      expect(() => 
        db.updateFragment(testProjectId, "non-existent.cue", "content")
      ).toThrow("Fragment not found");
    });

    it("should retrieve fragment by project ID and path", async () => {
      const created = await db.createFragment(testFragmentId, testProjectId, "test.cue", "content");
      const retrieved = await db.getFragment(testProjectId, "test.cue");
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.content).toBe(created.content);
    });

    it("should list fragments for a project ordered by path", async () => {
      await db.createFragment(generateId(), testProjectId, "z_last.cue", "content");
      await db.createFragment(generateId(), testProjectId, "a_first.cue", "content");
      await db.createFragment(generateId(), testProjectId, "m_middle.cue", "content");
      
      const fragments = await db.listFragments(testProjectId);
      
      expect(fragments.length).toBe(3);
      expect(fragments[0].path).toBe("a_first.cue");
      expect(fragments[1].path).toBe("m_middle.cue");
      expect(fragments[2].path).toBe("z_last.cue");
    });

    it("should return empty array for project with no fragments", async () => {
      const fragments = await db.listFragments(testProjectId);
      expect(fragments).toEqual([]);
    });

    it("should delete fragment by project ID and path", async () => {
      await db.createFragment(testFragmentId, testProjectId, "test.cue", "content");
      
      // Verify fragment exists
      const retrieved = await db.getFragment(testProjectId, "test.cue");
      expect(retrieved).not.toBeNull();
      
      // Delete fragment
      await db.deleteFragment(testProjectId, "test.cue");
      
      // Verify fragment is deleted
      const retrievedAfterDelete = await db.getFragment(testProjectId, "test.cue");
      expect(retrievedAfterDelete).toBeNull();
    });

    it("should throw error when deleting non-existent fragment", async () => {
      expect(() => 
        db.deleteFragment(testProjectId, "non-existent.cue")
      ).toThrow("Fragment not found");
    });
  });

  describe("Version Operations", () => {
    beforeEach(async () => {
      await db.createProject(testProjectId, "Test Project");
    });

    it("should create a version successfully", async () => {
      const versionId = generateId();
      const specHash = "sha256abcdef";
      const resolvedJson = JSON.stringify({ test: "data" });
      
      const version = await db.createVersion(versionId, testProjectId, specHash, resolvedJson);
      
      expect(version.id).toBe(versionId);
      expect(version.project_id).toBe(testProjectId);
      expect(version.spec_hash).toBe(specHash);
      expect(version.resolved_json).toBe(resolvedJson);
      expect(version.created_at).toBeDefined();
    });

    it("should enforce unique project_id + spec_hash constraint", async () => {
      const specHash = "sha256same";
      
      await db.createVersion(generateId(), testProjectId, specHash, "{}");
      
      expect(() => 
        db.createVersion(generateId(), testProjectId, specHash, "{}")
      ).toThrow();
    });

    it("should retrieve latest version for project", async () => {
      const version1Id = generateId();
      const version2Id = generateId();
      
      await db.createVersion(version1Id, testProjectId, "hash1", "{}");
      // Small delay to ensure different creation times
      await new Promise(resolve => setTimeout(resolve, 10));
      await db.createVersion(version2Id, testProjectId, "hash2", "{}");
      
      const latest = await db.getLatestVersion(testProjectId);
      
      expect(latest).not.toBeNull();
      expect(latest?.id).toBe(version2Id);
    });

    it("should return null for project with no versions", async () => {
      const latest = await db.getLatestVersion(testProjectId);
      expect(latest).toBeNull();
    });

    it("should retrieve version by spec hash", async () => {
      const versionId = generateId();
      const specHash = "unique-hash";
      
      const created = await db.createVersion(versionId, testProjectId, specHash, "{}");
      const retrieved = await db.getVersionByHash(specHash);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it("should list versions for project in descending order", async () => {
      const version1Id = generateId();
      const version2Id = generateId();
      
      await db.createVersion(version1Id, testProjectId, "hash1", "{}");
      await new Promise(resolve => setTimeout(resolve, 10));
      await db.createVersion(version2Id, testProjectId, "hash2", "{}");
      
      const versions = await db.listVersions(testProjectId);
      
      expect(versions.length).toBe(2);
      expect(versions[0].id).toBe(version2Id); // Most recent first
      expect(versions[1].id).toBe(version1Id);
    });
  });

  describe("Event Operations", () => {
    beforeEach(async () => {
      await db.createProject(testProjectId, "Test Project");
    });

    it("should create event successfully", async () => {
      const eventId = generateId();
      const eventData = { user_id: "user123", fragment_path: "test.cue" };
      
      const event = await db.createEvent(
        eventId,
        testProjectId,
        "fragment_updated",
        eventData
      );
      
      expect(event.id).toBe(eventId);
      expect(event.project_id).toBe(testProjectId);
      expect(event.event_type).toBe("fragment_updated");
      expect(JSON.parse(event.data)).toEqual(eventData);
      expect(event.created_at).toBeDefined();
    });

    it("should list events for project in descending order", async () => {
      const event1Id = generateId();
      const event2Id = generateId();
      
      await db.createEvent(event1Id, testProjectId, "validation_started", {});
      await new Promise(resolve => setTimeout(resolve, 10));
      await db.createEvent(event2Id, testProjectId, "validation_completed", {});
      
      const events = await db.listEvents(testProjectId);
      
      expect(events.length).toBe(2);
      expect(events[0].id).toBe(event2Id); // Most recent first
      expect(events[1].id).toBe(event1Id);
    });

    it("should limit number of events returned", async () => {
      // Create 5 events
      for (let i = 0; i < 5; i++) {
        await db.createEvent(generateId(), testProjectId, "test_event", { index: i });
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      const events = await db.listEvents(testProjectId, 3);
      
      expect(events.length).toBe(3);
      // Should return most recent 3 events
      expect(JSON.parse(events[0].data).index).toBe(4);
      expect(JSON.parse(events[1].data).index).toBe(3);
      expect(JSON.parse(events[2].data).index).toBe(2);
    });

    it("should filter events by type", async () => {
      await db.createEvent(generateId(), testProjectId, "fragment_created", {});
      await db.createEvent(generateId(), testProjectId, "validation_started", {});
      await db.createEvent(generateId(), testProjectId, "fragment_updated", {});
      await db.createEvent(generateId(), testProjectId, "validation_completed", {});
      
      const validationEvents = await db.listEventsByType(testProjectId, "validation_started");
      const fragmentEvents = await db.listEventsByType(testProjectId, "fragment_updated");
      
      expect(validationEvents.length).toBe(1);
      expect(fragmentEvents.length).toBe(1);
      expect(validationEvents[0].event_type).toBe("validation_started");
      expect(fragmentEvents[0].event_type).toBe("fragment_updated");
    });
  });

  describe("Transaction Handling", () => {
    beforeEach(async () => {
      await db.createProject(testProjectId, "Test Project");
    });

    it("should commit successful transaction", async () => {
      const result = await db.transaction(() => {
        const fragment1 = db.createFragment(generateId(), testProjectId, "test1.cue", "content1");
        const fragment2 = db.createFragment(generateId(), testProjectId, "test2.cue", "content2");
        return { fragment1, fragment2 };
      });
      
      expect(result.fragment1.path).toBe("test1.cue");
      expect(result.fragment2.path).toBe("test2.cue");
      
      // Verify fragments were actually created
      const fragments = await db.listFragments(testProjectId);
      expect(fragments.length).toBe(2);
    });

    it("should rollback failed transaction", async () => {
      expect(() => {
        db.transaction(() => {
          db.createFragment(generateId(), testProjectId, "test1.cue", "content1");
          // This should fail due to duplicate path
          db.createFragment(generateId(), testProjectId, "test1.cue", "content2");
        });
      }).toThrow();
      
      // Verify no fragments were created due to rollback
      const fragments = await db.listFragments(testProjectId);
      expect(fragments.length).toBe(0);
    });

    it("should handle nested transactions", async () => {
      const result = await db.transaction(() => {
        const fragment1 = db.createFragment(generateId(), testProjectId, "test1.cue", "content1");
        
        // Nested transaction
        const nestedResult = db.transaction(() => {
          return db.createFragment(generateId(), testProjectId, "test2.cue", "content2");
        });
        
        return { fragment1, nestedFragment: nestedResult };
      });
      
      expect(result.fragment1.path).toBe("test1.cue");
      expect(result.nestedFragment.path).toBe("test2.cue");
      
      const fragments = await db.listFragments(testProjectId);
      expect(fragments.length).toBe(2);
    });
  });

  describe("Health Check", () => {
    it("should return true for healthy database", async () => {
      const healthy = await db.healthCheck();
      expect(healthy).toBe(true);
    });

    it("should perform basic query to verify database functionality", async () => {
      // Create a project to ensure database is working
      await db.createProject(testProjectId, "Health Check Project");
      
      const healthy = await db.healthCheck();
      expect(healthy).toBe(true);
      
      // Verify the project was actually created
      const project = await db.getProject(testProjectId);
      expect(project).not.toBeNull();
    });
  });

  describe("Performance and Concurrency", () => {
    beforeEach(async () => {
      await db.createProject(testProjectId, "Test Project");
    });

    it("should handle concurrent fragment creation", async () => {
      const fragmentPromises = [];
      
      // Create 10 fragments concurrently
      for (let i = 0; i < 10; i++) {
        const promise = db.createFragment(
          generateId(),
          testProjectId,
          `concurrent_${i}.cue`,
          `package test\n\ncontent: ${i}`
        );
        fragmentPromises.push(promise);
      }
      
      const fragments = await Promise.all(fragmentPromises);
      
      expect(fragments.length).toBe(10);
      fragments.forEach((fragment, index) => {
        expect(fragment.path).toBe(`concurrent_${index}.cue`);
      });
      
      // Verify all fragments are in database
      const allFragments = await db.listFragments(testProjectId);
      expect(allFragments.length).toBe(10);
    });

    it("should handle large fragment content", async () => {
      const largeContent = "package test\n\n" + "x: ".repeat(10000) + "\"large\"";
      
      const fragment = await db.createFragment(
        testFragmentId,
        testProjectId,
        "large.cue",
        largeContent
      );
      
      expect(fragment.content).toBe(largeContent);
      
      const retrieved = await db.getFragment(testProjectId, "large.cue");
      expect(retrieved?.content).toBe(largeContent);
    });

    it("should maintain performance with many versions", async () => {
      const start = Date.now();
      
      // Create 100 versions
      for (let i = 0; i < 100; i++) {
        await db.createVersion(
          generateId(),
          testProjectId,
          `hash_${i}`,
          `{"version": ${i}}`
        );
      }
      
      const creationTime = Date.now() - start;
      
      // Verify latest version retrieval is still fast
      const latestStart = Date.now();
      const latest = await db.getLatestVersion(testProjectId);
      const latestTime = Date.now() - latestStart;
      
      expect(latest).not.toBeNull();
      expect(JSON.parse(latest!.resolved_json).version).toBe(99);
      expect(latestTime).toBeLessThan(100); // Should be under 100ms
      expect(creationTime).toBeLessThan(5000); // Creation should be under 5s
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity with foreign keys", async () => {
      // Create project and fragment
      await db.createProject(testProjectId, "Test Project");
      await db.createFragment(testFragmentId, testProjectId, "test.cue", "content");
      
      // Delete project should cascade delete fragment
      await db.deleteProject(testProjectId);
      
      // Verify fragment was deleted
      const fragment = await db.getFragment(testProjectId, "test.cue");
      expect(fragment).toBeNull();
    });

    it("should handle UTF-8 content correctly", async () => {
      await db.createProject(testProjectId, "Test Project");
      
      const utf8Content = "package test\n\n// Unicode: 🚀 ñ ü € 中文 русский";
      
      const fragment = await db.createFragment(
        testFragmentId,
        testProjectId,
        "utf8.cue",
        utf8Content
      );
      
      expect(fragment.content).toBe(utf8Content);
      
      const retrieved = await db.getFragment(testProjectId, "utf8.cue");
      expect(retrieved?.content).toBe(utf8Content);
    });

    it("should handle empty and null values appropriately", async () => {
      await db.createProject(testProjectId, "Test Project");
      
      // Empty content should be allowed
      const fragment = await db.createFragment(
        testFragmentId,
        testProjectId,
        "empty.cue",
        ""
      );
      
      expect(fragment.content).toBe("");
      
      const retrieved = await db.getFragment(testProjectId, "empty.cue");
      expect(retrieved?.content).toBe("");
    });
  });
});