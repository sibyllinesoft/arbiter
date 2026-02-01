import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the cue module since it requires native bindings
vi.mock("@/cue/index.js", () => ({
  validateCUE: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
}));

import { MarkdownStorage, createMarkdownStorage } from "../markdown-storage.js";

describe("MarkdownStorage", () => {
  const testDir = path.join(process.cwd(), ".test-arbiter-storage");

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe("initialize", () => {
    it("creates root project README.md", async () => {
      const storage = new MarkdownStorage(testDir);
      const root = await storage.initialize("Test Project");

      expect(root.type).toBe("project");
      expect(root.name).toBe("Test Project");

      const content = await fs.readFile(path.join(testDir, "README.md"), "utf-8");
      expect(content).toContain('type: "project"');
      expect(content).toContain("# Test Project");
    });
  });

  describe("isInitialized", () => {
    it("returns false for empty directory", async () => {
      const storage = new MarkdownStorage(testDir);
      expect(await storage.isInitialized()).toBe(false);
    });

    it("returns true after initialization", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");
      expect(await storage.isInitialized()).toBe(true);
    });
  });

  describe("save", () => {
    it("saves a leaf entity as .md file", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const entity = await storage.save({
        type: "task",
        name: "Implement Feature",
        body: "Description of the task",
        frontmatter: {
          status: "open",
          priority: "high",
        } as any,
      });

      expect(entity.entityId).toBeDefined();
      expect(entity.filePath).toBe("implement-feature.md");

      const content = await fs.readFile(path.join(testDir, "implement-feature.md"), "utf-8");
      expect(content).toContain('type: "task"');
      expect(content).toContain("# Implement Feature");
    });

    it("saves a container entity as directory with README.md", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const entity = await storage.save(
        {
          type: "service",
          name: "API Service",
          body: "Service description",
          frontmatter: {
            language: "typescript",
            port: 3000,
          } as any,
        },
        { asContainer: true },
      );

      expect(entity.isContainer).toBe(true);
      expect(entity.filePath).toBe("api-service/README.md");

      const content = await fs.readFile(path.join(testDir, "api-service", "README.md"), "utf-8");
      expect(content).toContain('type: "service"');
    });

    it("creates nested entities under parent", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      await storage.save({ type: "service", name: "API" }, { asContainer: true });

      const endpoint = await storage.save(
        {
          type: "endpoint",
          name: "Get Users",
          frontmatter: {
            path: "/users",
            methods: ["GET"],
          } as any,
        },
        { parentPath: "api" },
      );

      expect(endpoint.filePath).toBe("api/get-users.md");
      const exists = await fs.pathExists(path.join(testDir, "api", "get-users.md"));
      expect(exists).toBe(true);
    });

    it("ensures unique slugs", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      await storage.save({ type: "task", name: "My Task" });
      const second = await storage.save({ type: "task", name: "My Task" });

      expect(second.filePath).toBe("my-task-2.md");
    });
  });

  describe("get and getByPath", () => {
    it("retrieves entity by ID", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const saved = await storage.save({
        type: "task",
        name: "Test Task",
      });

      const retrieved = await storage.get(saved.entityId);
      expect(retrieved?.name).toBe("Test Task");
    });

    it("retrieves entity by file path", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      await storage.save({ type: "task", name: "Test Task" });

      const retrieved = await storage.getByPath("test-task.md");
      expect(retrieved?.name).toBe("Test Task");
    });

    it("returns undefined for non-existent entity", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const retrieved = await storage.get("non-existent-id");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("list", () => {
    it("lists all entities", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      await storage.save({ type: "task", name: "Task 1" });
      await storage.save({ type: "task", name: "Task 2" });
      await storage.save({ type: "note", name: "Note 1" });

      const all = await storage.list();
      // 3 + 1 root = 4
      expect(all.length).toBe(4);
    });

    it("filters by entity type", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      await storage.save({ type: "task", name: "Task 1" });
      await storage.save({ type: "note", name: "Note 1" });

      const tasks = await storage.list(["task"]);
      expect(tasks.length).toBe(1);
      expect(tasks[0].type).toBe("task");
    });
  });

  describe("delete", () => {
    it("deletes a leaf entity", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const entity = await storage.save({ type: "task", name: "To Delete" });
      const deleted = await storage.delete(entity.entityId);

      expect(deleted).toBe(true);
      expect(await fs.pathExists(path.join(testDir, "to-delete.md"))).toBe(false);
    });

    it("deletes a container entity with children", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      await storage.save({ type: "service", name: "API" }, { asContainer: true });
      await storage.save({ type: "endpoint", name: "Users" }, { parentPath: "api" });

      // Reload to get the API entity
      const graph = await storage.load();
      const apiEntity = Array.from(graph.nodes.values()).find((n) => n.name === "API");

      const deleted = await storage.delete(apiEntity!.entityId);

      expect(deleted).toBe(true);
      expect(await fs.pathExists(path.join(testDir, "api"))).toBe(false);
    });

    it("returns false for non-existent entity", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const deleted = await storage.delete("non-existent");
      expect(deleted).toBe(false);
    });
  });

  describe("update", () => {
    it("updates entity frontmatter", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const entity = await storage.save({
        type: "task",
        name: "My Task",
        frontmatter: { status: "open" } as any,
      });

      const updated = await storage.update(entity.entityId, {
        frontmatter: { ...entity.frontmatter, status: "done" },
      });

      expect(updated?.frontmatter.status).toBe("done");

      // Verify persisted
      const content = await fs.readFile(path.join(testDir, "my-task.md"), "utf-8");
      expect(content).toContain('status: "done"');
    });

    it("returns null for non-existent entity", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const result = await storage.update("non-existent", { body: "new" });
      expect(result).toBeNull();
    });
  });

  describe("relationships", () => {
    it("adds relationship between entities", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const service = await storage.save({ type: "service", name: "API" }, { asContainer: true });
      const database = await storage.save({
        type: "resource",
        name: "Database",
        frontmatter: { kind: "database" } as any,
      });

      await storage.addRelationship(service.entityId, database.entityId, "depends_on", "Main DB");

      // Reload and verify
      const graph = await storage.load();
      const apiNode = graph.nodes.get(service.entityId);
      expect(apiNode?.frontmatter.relationships?.depends_on).toBeDefined();
    });

    it("removes relationship", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test");

      const service = await storage.save({ type: "service", name: "API" }, { asContainer: true });
      const database = await storage.save({
        type: "resource",
        name: "Database",
        frontmatter: { kind: "database" } as any,
      });

      await storage.addRelationship(service.entityId, database.entityId, "depends_on");
      await storage.removeRelationship(service.entityId, database.entityId, "depends_on");

      const graph = await storage.load();
      const apiNode = graph.nodes.get(service.entityId);
      expect(apiNode?.frontmatter.relationships?.depends_on).toBeUndefined();
    });
  });

  describe("toCue", () => {
    it("exports graph as CUE", async () => {
      const storage = new MarkdownStorage(testDir);
      await storage.initialize("Test Project");

      await storage.save(
        {
          type: "service",
          name: "API",
          frontmatter: {
            language: "typescript",
            port: 3000,
          } as any,
        },
        { asContainer: true },
      );

      const cue = await storage.toCue();

      expect(cue).toContain("package spec");
      expect(cue).toContain("packages:");
      expect(cue).toContain('"api"');
    });
  });

  describe("createMarkdownStorage helper", () => {
    it("creates storage instance", () => {
      const storage = createMarkdownStorage(testDir);
      expect(storage).toBeInstanceOf(MarkdownStorage);
    });
  });
});
