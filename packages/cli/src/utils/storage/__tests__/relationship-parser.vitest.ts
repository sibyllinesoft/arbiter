import { describe, expect, it } from "vitest";
import {
  KNOWN_RELATIONSHIP_KINDS,
  addRelationship,
  buildRelationshipEdges,
  calculateRelativePath,
  createMarkdownLink,
  isKnownRelationshipKind,
  isValidRelationshipKind,
  parseMarkdownLink,
  parseRelationships,
  removeRelationship,
  resolveRelationshipPaths,
  serializeRelationships,
} from "../relationship-parser.js";

describe("relationship-parser", () => {
  describe("parseMarkdownLink", () => {
    it("parses a valid markdown link", () => {
      const result = parseMarkdownLink("[Postgres](../database.md)");
      expect(result).toEqual({
        label: "Postgres",
        path: "../database.md",
      });
    });

    it("parses a link with complex label", () => {
      const result = parseMarkdownLink("[My Service API](./services/api.md)");
      expect(result).toEqual({
        label: "My Service API",
        path: "./services/api.md",
      });
    });

    it("returns null for invalid links", () => {
      expect(parseMarkdownLink("not a link")).toBeNull();
      expect(parseMarkdownLink("[label](file.txt)")).toBeNull(); // Not .md
      expect(parseMarkdownLink("[](path.md)")).toBeNull(); // Empty label
      expect(parseMarkdownLink("[label]()")).toBeNull(); // Empty path
    });

    it("handles whitespace", () => {
      const result = parseMarkdownLink("  [Label](path.md)  ");
      expect(result).toEqual({
        label: "Label",
        path: "path.md",
      });
    });
  });

  describe("createMarkdownLink", () => {
    it("creates a markdown link", () => {
      expect(createMarkdownLink("Redis", "../cache/redis.md")).toBe("[Redis](../cache/redis.md)");
    });
  });

  describe("parseRelationships", () => {
    it("parses relationship map from frontmatter", () => {
      const relationships = {
        depends_on: ["[Postgres](../database.md)", "[Redis](../cache/redis.md)"],
        implements: ["[Auth Contract](../../contracts/auth.md)"],
      };

      const result = parseRelationships(relationships);

      expect(result.depends_on).toHaveLength(2);
      expect(result.depends_on![0]).toEqual({
        label: "Postgres",
        path: "../database.md",
      });
      expect(result.implements).toHaveLength(1);
    });

    it("returns empty object for undefined input", () => {
      expect(parseRelationships(undefined)).toEqual({});
    });

    it("filters out invalid links", () => {
      const relationships = {
        depends_on: ["[Valid](file.md)", "invalid link"],
      };

      const result = parseRelationships(relationships);
      expect(result.depends_on).toHaveLength(1);
    });
  });

  describe("resolveRelationshipPaths", () => {
    it("resolves relative paths to entity IDs", () => {
      const relationships = {
        depends_on: [{ label: "Postgres", path: "../database.md" }],
      };
      const sourceFilePath = "services/api/README.md";
      const pathIndex = new Map([["services/database.md", "entity-123"]]);

      const result = resolveRelationshipPaths(relationships, sourceFilePath, pathIndex);

      expect(result.depends_on![0].entityId).toBe("entity-123");
    });

    it("leaves entityId undefined for unresolved paths", () => {
      const relationships = {
        depends_on: [{ label: "Unknown", path: "../unknown.md" }],
      };
      const sourceFilePath = "services/api/README.md";
      const pathIndex = new Map<string, string>();

      const result = resolveRelationshipPaths(relationships, sourceFilePath, pathIndex);

      expect(result.depends_on![0].entityId).toBeUndefined();
    });
  });

  describe("buildRelationshipEdges", () => {
    it("builds edges from resolved relationships", () => {
      const relationships = {
        depends_on: [
          { label: "Postgres", path: "../database.md", entityId: "db-123" },
          { label: "Redis", path: "../redis.md", entityId: "redis-456" },
        ],
        implements: [{ label: "Auth", path: "../../auth.md", entityId: "auth-789" }],
      };

      const edges = buildRelationshipEdges("service-001", relationships);

      expect(edges).toHaveLength(3);
      expect(edges[0]).toEqual({
        from: "service-001",
        to: "db-123",
        kind: "depends_on",
        label: "Postgres",
      });
    });

    it("skips links without entityId", () => {
      const relationships = {
        depends_on: [
          { label: "Postgres", path: "../database.md" }, // No entityId
        ],
      };

      const edges = buildRelationshipEdges("service-001", relationships);
      expect(edges).toHaveLength(0);
    });
  });

  describe("serializeRelationships", () => {
    it("converts parsed relationships back to raw format", () => {
      const parsed = {
        depends_on: [{ label: "Postgres", path: "../database.md" }],
      };

      const result = serializeRelationships(parsed);

      expect(result).toEqual({
        depends_on: ["[Postgres](../database.md)"],
      });
    });

    it("omits empty relationship arrays", () => {
      const parsed = {
        depends_on: [],
      };

      const result = serializeRelationships(parsed);
      expect(result).toEqual({});
    });
  });

  describe("calculateRelativePath", () => {
    it("calculates relative path between files", () => {
      expect(calculateRelativePath("services/api/README.md", "services/database.md")).toBe(
        "../database.md",
      );
    });

    it("handles same directory", () => {
      expect(calculateRelativePath("services/api.md", "services/web.md")).toBe("web.md");
    });

    it("handles nested paths", () => {
      expect(calculateRelativePath("services/api/handlers/auth.md", "shared/utils/logger.md")).toBe(
        "../../../shared/utils/logger.md",
      );
    });
  });

  describe("addRelationship", () => {
    it("adds a new relationship", () => {
      const relationships = {};
      const result = addRelationship(relationships, "depends_on", "Postgres", "../database.md");

      expect(result).toEqual({
        depends_on: ["[Postgres](../database.md)"],
      });
    });

    it("appends to existing relationships", () => {
      const relationships = {
        depends_on: ["[Redis](../redis.md)"],
      };
      const result = addRelationship(relationships, "depends_on", "Postgres", "../database.md");

      expect(result.depends_on).toHaveLength(2);
    });

    it("prevents duplicates", () => {
      const relationships = {
        depends_on: ["[Postgres](../database.md)"],
      };
      const result = addRelationship(relationships, "depends_on", "Postgres", "../database.md");

      expect(result.depends_on).toHaveLength(1);
    });
  });

  describe("removeRelationship", () => {
    it("removes a relationship by path", () => {
      const relationships = {
        depends_on: ["[Postgres](../database.md)", "[Redis](../redis.md)"],
      };
      const result = removeRelationship(relationships, "depends_on", "../database.md");

      expect(result.depends_on).toEqual(["[Redis](../redis.md)"]);
    });

    it("removes the key when array becomes empty", () => {
      const relationships = {
        depends_on: ["[Postgres](../database.md)"],
      };
      const result = removeRelationship(relationships, "depends_on", "../database.md");

      expect(result.depends_on).toBeUndefined();
    });

    it("returns unchanged if relationship not found", () => {
      const relationships = {
        depends_on: ["[Postgres](../database.md)"],
      };
      const result = removeRelationship(relationships, "implements", "../something.md");

      expect(result).toEqual(relationships);
    });
  });

  describe("validation functions", () => {
    it("validates relationship kinds", () => {
      expect(isValidRelationshipKind("depends_on")).toBe(true);
      expect(isValidRelationshipKind("custom_kind")).toBe(true);
      expect(isValidRelationshipKind("")).toBe(false);
    });

    it("identifies known relationship kinds", () => {
      expect(isKnownRelationshipKind("depends_on")).toBe(true);
      expect(isKnownRelationshipKind("custom_kind")).toBe(false);
    });

    it("exports known relationship kinds", () => {
      expect(KNOWN_RELATIONSHIP_KINDS).toContain("depends_on");
      expect(KNOWN_RELATIONSHIP_KINDS).toContain("implements");
      expect(KNOWN_RELATIONSHIP_KINDS).toContain("blocks");
    });
  });
});
