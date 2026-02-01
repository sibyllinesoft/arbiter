/**
 * Tests for Markdown-based issue and comment storage
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { Storage } from "../index.js";

// Mock console.log to suppress output during tests
const originalLog = console.log;
beforeAll(() => {
  console.log = () => {};
});
afterAll(() => {
  console.log = originalLog;
});

describe("Markdown Storage", () => {
  let tempDir: string;
  let storage: Storage;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-storage-"));
    storage = new Storage({
      baseDir: tempDir,
      notesDir: join(tempDir, "notes"),
      tasksDir: join(tempDir, "tasks"),
    });
    await storage.initialize();
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("directory structure", () => {
    test("creates notes and tasks directories", async () => {
      const files = await readdir(tempDir);
      expect(files).toContain("notes");
      expect(files).toContain("tasks");
    });
  });

  describe("issues", () => {
    test("saves and retrieves an issue", async () => {
      const saved = await storage.saveIssue({
        title: "Test Issue",
        type: "feature",
        priority: "high",
        status: "open",
      });

      expect(saved.id).toBeDefined();
      expect(saved.title).toBe("Test Issue");
      expect(saved.status).toBe("open");
      expect(saved.created).toBeDefined();

      const retrieved = await storage.getIssue(saved.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe("Test Issue");
    });

    test("creates markdown file for issue", async () => {
      const files = await readdir(join(tempDir, "tasks"));
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.endsWith(".md"))).toBe(true);

      // Check file content
      const filePath = join(tempDir, "tasks", files[0]);
      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("---");
      expect(content).toContain("id:");
      expect(content).toContain("status:");
      expect(content).toContain("# Test Issue");
    });

    test("updates existing issue", async () => {
      const issues = await storage.listIssues();
      const issue = issues[0];

      const updated = await storage.saveIssue({
        ...issue,
        title: "Updated Issue",
        status: "in_progress",
      });

      expect(updated.title).toBe("Updated Issue");
      expect(updated.status).toBe("in_progress");
      expect(updated.created).toBe(issue.created); // Created unchanged
    });

    test("lists issues with filters", async () => {
      // Add another issue
      await storage.saveIssue({
        title: "Second Issue",
        type: "bug",
        priority: "low",
        status: "open",
      });

      const all = await storage.listIssues();
      expect(all.length).toBe(2);

      const inProgress = await storage.listIssues({ status: "in_progress" });
      expect(inProgress.length).toBe(1);
      expect(inProgress[0].title).toBe("Updated Issue");

      const highPriority = await storage.listIssues({ priority: "high" });
      expect(highPriority.length).toBe(1);
    });

    test("updates issue status", async () => {
      const issues = await storage.listIssues({ status: "open" });
      const issue = issues[0];

      const updated = await storage.updateIssueStatus(issue.id, "done");
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("done");
      expect(updated!.closedAt).toBeDefined();
    });

    test("adds entity reference to issue", async () => {
      const issues = await storage.listIssues();
      const issue = issues[0];

      const updated = await storage.addIssueReference(issue.id, "api-service", "package");
      expect(updated).not.toBeNull();
      expect(updated!.references).toContainEqual({ type: "package", slug: "api-service" });
    });

    test("filters issues by entity reference", async () => {
      const referenced = await storage.listIssues({ entity: "api-service" });
      expect(referenced.length).toBe(1);
    });

    test("deletes issue and removes markdown file", async () => {
      const issues = await storage.listIssues();
      const toDelete = issues[issues.length - 1];

      const filesBefore = await readdir(join(tempDir, "tasks"));

      const deleted = await storage.deleteIssue(toDelete.id);
      expect(deleted).toBe(true);

      const remaining = await storage.listIssues();
      expect(remaining.length).toBe(issues.length - 1);

      const filesAfter = await readdir(join(tempDir, "tasks"));
      expect(filesAfter.length).toBe(filesBefore.length - 1);
    });
  });

  describe("comments", () => {
    test("adds and retrieves a comment", async () => {
      const comment = await storage.addComment("api-service", "This is a test comment", {
        author: "testuser",
        kind: "discussion",
        tags: ["important"],
      });

      expect(comment.id).toBeDefined();
      expect(comment.content).toBe("This is a test comment");
      expect(comment.author).toBe("testuser");
      expect(comment.target).toBe("api-service");

      const retrieved = await storage.getComment(comment.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe("This is a test comment");
    });

    test("creates markdown file for comment", async () => {
      const files = await readdir(join(tempDir, "notes"));
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.endsWith(".md"))).toBe(true);

      // Check file content
      const filePath = join(tempDir, "notes", files[0]);
      const content = await readFile(filePath, "utf-8");
      expect(content).toContain("---");
      expect(content).toContain("id:");
      expect(content).toContain("target:");
      expect(content).toContain("This is a test comment");
    });

    test("adds comment attached to issue", async () => {
      const issues = await storage.listIssues();
      const issue = issues[0];

      const comment = await storage.addComment(issue.id, "Comment on issue", {
        targetType: "issue",
      });

      expect(comment.target).toBe(issue.id);
      expect(comment.targetType).toBe("issue");
    });

    test("lists comments with filters", async () => {
      await storage.addComment("other-entity", "Another comment", { kind: "note" });

      const all = await storage.listComments();
      expect(all.length).toBe(3);

      const entityComments = await storage.listComments({ target: "api-service" });
      expect(entityComments.length).toBe(1);

      const notes = await storage.listComments({ kind: "note" });
      expect(notes.length).toBe(1);
    });

    test("updates comment", async () => {
      const comments = await storage.listComments();
      const comment = comments[0];

      const updated = await storage.updateComment(comment.id, "Updated comment content");
      expect(updated).not.toBeNull();
      expect(updated!.content).toBe("Updated comment content");
      expect(updated!.edited).toBeDefined();
    });

    test("resolves comment", async () => {
      const comments = await storage.listComments();
      const comment = comments[0];

      const resolved = await storage.resolveComment(comment.id, true);
      expect(resolved).not.toBeNull();
      expect(resolved!.resolved).toBe(true);
    });

    test("filters by resolved status", async () => {
      const resolved = await storage.listComments({ resolved: true });
      expect(resolved.length).toBe(1);

      const unresolved = await storage.listComments({ resolved: false });
      expect(unresolved.length).toBe(2);
    });

    test("deletes comment and removes markdown file", async () => {
      const comments = await storage.listComments();
      const toDelete = comments[comments.length - 1];

      const filesBefore = await readdir(join(tempDir, "notes"));

      const deleted = await storage.deleteComment(toDelete.id);
      expect(deleted).toBe(true);

      const remaining = await storage.listComments();
      expect(remaining.length).toBe(comments.length - 1);

      const filesAfter = await readdir(join(tempDir, "notes"));
      expect(filesAfter.length).toBe(filesBefore.length - 1);
    });

    test("deletes all comments for target", async () => {
      // Add more comments to api-service
      await storage.addComment("api-service", "Comment 2");
      await storage.addComment("api-service", "Comment 3");

      const deletedCount = await storage.deleteTargetComments("api-service");
      expect(deletedCount).toBeGreaterThan(0);

      const remaining = await storage.listComments({ target: "api-service" });
      expect(remaining.length).toBe(0);
    });
  });

  describe("entity lookups", () => {
    test("gets issues for entity", async () => {
      // Create an issue with reference
      await storage.saveIssue({
        title: "Entity test issue",
        status: "open",
        references: [{ type: "package", slug: "user-service" }],
      });

      const issues = await storage.getIssuesForEntity("user-service");
      expect(issues.length).toBe(1);
      expect(issues[0].title).toBe("Entity test issue");
    });

    test("gets comments for entity", async () => {
      // Add a direct comment
      await storage.addComment("user-service", "Direct comment on user-service");

      // Get all comments for the entity
      const comments = await storage.getCommentsForEntity("user-service");
      expect(comments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("output formatting", () => {
    test("formats issues as table", async () => {
      const issues = await storage.listIssues();
      const table = storage.formatIssues(issues, "table");

      expect(table).toContain("ID");
      expect(table).toContain("STATUS");
      expect(table).toContain("TITLE");
    });

    test("formats issues as JSON", async () => {
      const issues = await storage.listIssues();
      const json = storage.formatIssues(issues, "json");

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
    });

    test("formats issues as YAML", async () => {
      const issues = await storage.listIssues();
      const yaml = storage.formatIssues(issues, "yaml");

      expect(yaml).toContain("- id:");
      expect(yaml).toContain("  title:");
    });

    test("formats issues as markdown", async () => {
      const issues = await storage.listIssues();
      const md = storage.formatIssues(issues, "markdown");

      expect(md).toContain("##");
    });

    test("formats comments as table", async () => {
      const comments = await storage.listComments();
      const table = storage.formatComments(comments, "table");

      expect(table).toContain("ID");
      expect(table).toContain("TARGET");
      expect(table).toContain("KIND");
    });

    test("formats comments as JSON", async () => {
      const comments = await storage.listComments();
      const json = storage.formatComments(comments, "json");

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe("statistics", () => {
    test("returns correct statistics", async () => {
      const stats = await storage.getStats();

      expect(stats.totalIssues).toBeGreaterThan(0);
      expect(stats.issuesByStatus).toBeDefined();
      expect(stats.totalComments).toBeGreaterThanOrEqual(0);
      expect(stats.entitiesReferenced).toBeInstanceOf(Array);
    });
  });

  describe("persistence", () => {
    test("markdown files have correct frontmatter structure", async () => {
      const taskFiles = await readdir(join(tempDir, "tasks"));
      expect(taskFiles.length).toBeGreaterThan(0);

      const content = await readFile(join(tempDir, "tasks", taskFiles[0]), "utf-8");
      // Should have frontmatter delimiters
      expect(content.startsWith("---\n")).toBe(true);
      expect(content).toMatch(/\n---\n/);
      // Should have id in frontmatter
      expect(content).toMatch(/id:\s*["']?i-/);
    });

    test("markdown files are readable after reload", async () => {
      // Get current issues
      const issuesBefore = await storage.listIssues();

      // Reload storage (clears cache)
      storage.reload();

      // Should load same issues from disk
      const issuesAfter = await storage.listIssues();
      expect(issuesAfter.length).toBe(issuesBefore.length);

      // Verify IDs match
      const idsBefore = new Set(issuesBefore.map((i) => i.id));
      const idsAfter = new Set(issuesAfter.map((i) => i.id));
      expect(idsAfter).toEqual(idsBefore);
    });

    test("issue description survives round-trip", async () => {
      const originalDescription = "This is a **markdown** description\n\nWith multiple paragraphs.";
      const saved = await storage.saveIssue({
        title: "Issue with description",
        status: "open",
        description: originalDescription,
      });

      // Reload to ensure we read from disk
      storage.reload();

      const loaded = await storage.getIssue(saved.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.description).toBe(originalDescription);
    });
  });
});

describe("slug utilities", () => {
  test("slugify creates URL-safe slugs", async () => {
    const { slugify } = await import("../slug.js");

    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Test@123!")).toBe("test-123");
    expect(slugify("  Leading spaces  ")).toBe("leading-spaces");
    expect(slugify("Multiple---dashes")).toBe("multiple-dashes");
  });

  test("ensureUniqueSlug handles collisions", async () => {
    const { ensureUniqueSlug } = await import("../slug.js");

    const existing = new Set(["test", "test-2", "test-3"]);
    expect(ensureUniqueSlug("test", existing)).toBe("test-4");
    expect(ensureUniqueSlug("unique", existing)).toBe("unique");
  });
});

describe("markdown utilities", () => {
  test("parseFrontmatter extracts frontmatter and body", async () => {
    const { parseFrontmatter } = await import("../markdown.js");

    const content = `---
id: "test-123"
status: "open"
---

# Title

Body content here.`;

    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter.id).toBe("test-123");
    expect(frontmatter.status).toBe("open");
    expect(body).toContain("# Title");
    expect(body).toContain("Body content here.");
  });

  test("createMarkdownFile generates valid markdown", async () => {
    const { createMarkdownFile, parseFrontmatter } = await import("../markdown.js");

    const metadata = { id: "test-123", status: "open" };
    const body = "# Test\n\nContent";

    const content = createMarkdownFile(metadata, body);

    // Should be parseable
    const parsed = parseFrontmatter(content);
    expect(parsed.frontmatter.id).toBe("test-123");
    expect(parsed.body).toContain("# Test");
  });
});
