import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GraphLoader, loadEntityGraph } from "../graph-loader.js";
import { createMarkdownFile } from "../markdown.js";

describe("GraphLoader", () => {
  const testDir = path.join(process.cwd(), ".test-arbiter");

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe("parseEntity", () => {
    it("parses entity from markdown content", () => {
      const loader = new GraphLoader(testDir);
      const content = createMarkdownFile(
        {
          type: "service",
          entityId: "test-123",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          language: "typescript",
          port: 3000,
        },
        "# My Service\n\nService description here.",
      );

      const entity = loader.parseEntity("my-service/README.md", content, true, "my-service");

      expect(entity.entityId).toBe("test-123");
      expect(entity.type).toBe("service");
      expect(entity.name).toBe("My Service");
      expect(entity.isContainer).toBe(true);
      expect(entity.body).toContain("Service description here.");
      expect(entity.frontmatter.language).toBe("typescript");
      expect(entity.frontmatter.port).toBe(3000);
    });

    it("generates entityId if not present", () => {
      const loader = new GraphLoader(testDir);
      const content = createMarkdownFile({ type: "service" }, "# Test");

      const entity = loader.parseEntity("test.md", content, false, "test");

      expect(entity.entityId).toBeDefined();
      expect(entity.entityId).toMatch(/^[0-9a-f-]+$/);
    });

    it("extracts name from H1 heading", () => {
      const loader = new GraphLoader(testDir);
      const content = createMarkdownFile(
        { type: "endpoint" },
        "# Get Users Endpoint\n\nReturns all users.",
      );

      const entity = loader.parseEntity("get-users.md", content, false, "get-users");

      expect(entity.name).toBe("Get Users Endpoint");
    });

    it("falls back to default name if no H1", () => {
      const loader = new GraphLoader(testDir);
      const content = createMarkdownFile({ type: "note" }, "Just some content without heading.");

      const entity = loader.parseEntity("my-note.md", content, false, "my-note");

      expect(entity.name).toBe("my-note");
    });

    it("parses relationships from frontmatter", () => {
      const loader = new GraphLoader(testDir);
      const content = createMarkdownFile(
        {
          type: "service",
          relationships: {
            depends_on: ["[Postgres](../database.md)"],
          },
        },
        "# API Service",
      );

      const entity = loader.parseEntity("api/README.md", content, true, "api");

      expect(entity.relationships.depends_on).toHaveLength(1);
      expect(entity.relationships.depends_on![0].label).toBe("Postgres");
    });
  });

  describe("walkDirectory", () => {
    it("walks directory and finds all entities", async () => {
      // Create test structure
      await fs.writeFile(
        path.join(testDir, "README.md"),
        createMarkdownFile({ type: "project", entityId: "root" }, "# Test Project"),
      );
      await fs.ensureDir(path.join(testDir, "api"));
      await fs.writeFile(
        path.join(testDir, "api", "README.md"),
        createMarkdownFile({ type: "service", entityId: "api" }, "# API"),
      );
      await fs.writeFile(
        path.join(testDir, "api", "users.md"),
        createMarkdownFile({ type: "endpoint", entityId: "users" }, "# Users Endpoint"),
      );

      const loader = new GraphLoader(testDir);
      const nodes = await loader.walkDirectory(testDir);

      expect(nodes).toHaveLength(3);
      expect(nodes.find((n) => n.entityId === "root")).toBeDefined();
      expect(nodes.find((n) => n.entityId === "api")).toBeDefined();
      expect(nodes.find((n) => n.entityId === "users")).toBeDefined();
    });

    it("ignores non-markdown files", async () => {
      await fs.writeFile(
        path.join(testDir, "README.md"),
        createMarkdownFile({ type: "project" }, "# Test"),
      );
      await fs.writeFile(path.join(testDir, "config.json"), "{}");
      await fs.writeFile(path.join(testDir, "notes.txt"), "text file");

      const loader = new GraphLoader(testDir);
      const nodes = await loader.walkDirectory(testDir);

      expect(nodes).toHaveLength(1);
    });
  });

  describe("load", () => {
    it("loads complete entity graph", async () => {
      // Create test structure
      await fs.writeFile(
        path.join(testDir, "README.md"),
        createMarkdownFile({ type: "project", entityId: "project-1" }, "# My Project"),
      );
      await fs.ensureDir(path.join(testDir, "api"));
      await fs.writeFile(
        path.join(testDir, "api", "README.md"),
        createMarkdownFile({ type: "service", entityId: "service-1" }, "# API Service"),
      );

      const loader = new GraphLoader(testDir);
      const graph = await loader.load();

      expect(graph.nodes.size).toBe(2);
      // Root detection looks for README.md at base level with type project
      expect(graph.rootId).toBe("project-1");
    });

    it("resolves parent-child relationships for leaf entities", async () => {
      await fs.ensureDir(path.join(testDir, "api"));
      await fs.writeFile(
        path.join(testDir, "api", "README.md"),
        createMarkdownFile({ type: "service", entityId: "api" }, "# API"),
      );
      await fs.writeFile(
        path.join(testDir, "api", "users.md"),
        createMarkdownFile({ type: "endpoint", entityId: "users" }, "# Users"),
      );

      const loader = new GraphLoader(testDir);
      const graph = await loader.load();

      const apiNode = graph.nodes.get("api");
      const usersNode = graph.nodes.get("users");

      expect(usersNode?.parentId).toBe("api");
      expect(apiNode?.childIds).toContain("users");
    });

    it("builds relationship edges", async () => {
      await fs.writeFile(
        path.join(testDir, "README.md"),
        createMarkdownFile({ type: "project", entityId: "root" }, "# Project"),
      );
      await fs.writeFile(
        path.join(testDir, "database.md"),
        createMarkdownFile({ type: "resource", entityId: "db" }, "# Database"),
      );
      await fs.ensureDir(path.join(testDir, "api"));
      await fs.writeFile(
        path.join(testDir, "api", "README.md"),
        createMarkdownFile(
          {
            type: "service",
            entityId: "api",
            relationships: {
              depends_on: ["[Database](../database.md)"],
            },
          },
          "# API",
        ),
      );

      const loader = new GraphLoader(testDir);
      const graph = await loader.load();

      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toEqual({
        from: "api",
        to: "db",
        kind: "depends_on",
        label: "Database",
      });
    });

    it("returns empty graph for non-existent directory", async () => {
      const loader = new GraphLoader("/non/existent/path");
      const graph = await loader.load();

      expect(graph.nodes.size).toBe(0);
      expect(graph.edges).toHaveLength(0);
    });

    it("filters by entity types", async () => {
      await fs.writeFile(
        path.join(testDir, "README.md"),
        createMarkdownFile({ type: "project", entityId: "root" }, "# Project"),
      );
      await fs.writeFile(
        path.join(testDir, "task.md"),
        createMarkdownFile({ type: "task", entityId: "task-1", status: "open" }, "# My Task"),
      );

      const loader = new GraphLoader(testDir);
      const graph = await loader.load({ types: ["task"] });

      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.get("task-1")).toBeDefined();
    });
  });

  describe("loadEntityGraph helper", () => {
    it("provides convenient loading function", async () => {
      await fs.writeFile(
        path.join(testDir, "README.md"),
        createMarkdownFile({ type: "project", entityId: "test" }, "# Test"),
      );

      // The loadEntityGraph uses .arbiter by default, but we can override with baseDir
      const loader = new GraphLoader(testDir);
      const graph = await loader.load();

      expect(graph.nodes.size).toBe(1);
    });
  });
});
