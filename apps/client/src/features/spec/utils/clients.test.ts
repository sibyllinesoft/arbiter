/**
 * Unit tests for client utility functions.
 */
import { describe, expect, it } from "vitest";
import {
  coerceDisplayValue,
  collectPathCandidates,
  extractTypeLabel,
  isInfrastructurePath,
  isLikelyCodePath,
  resolveSourcePath,
  slugify,
} from "./clients";

describe("coerceDisplayValue", () => {
  it("returns null for non-string values", () => {
    expect(coerceDisplayValue(123)).toBeNull();
    expect(coerceDisplayValue(null)).toBeNull();
    expect(coerceDisplayValue(undefined)).toBeNull();
  });

  it("returns null for empty or whitespace-only strings", () => {
    expect(coerceDisplayValue("")).toBeNull();
    expect(coerceDisplayValue("   ")).toBeNull();
  });

  it("returns null for 'unknown' values", () => {
    expect(coerceDisplayValue("unknown")).toBeNull();
    expect(coerceDisplayValue("UNKNOWN")).toBeNull();
  });

  it("returns trimmed string for valid values", () => {
    expect(coerceDisplayValue("  hello  ")).toBe("hello");
    expect(coerceDisplayValue("test")).toBe("test");
  });
});

describe("isLikelyCodePath", () => {
  it("returns true for code file extensions", () => {
    expect(isLikelyCodePath("src/main.ts")).toBe(true);
    expect(isLikelyCodePath("app.tsx")).toBe(true);
    expect(isLikelyCodePath("index.js")).toBe(true);
    expect(isLikelyCodePath("component.vue")).toBe(true);
    expect(isLikelyCodePath("main.py")).toBe(true);
  });

  it("returns true for source directory patterns", () => {
    expect(isLikelyCodePath("src/components")).toBe(true);
    expect(isLikelyCodePath("apps/web")).toBe(true);
    expect(isLikelyCodePath("packages/core")).toBe(true);
  });

  it("returns false for non-code paths", () => {
    expect(isLikelyCodePath("config.json")).toBe(false);
    expect(isLikelyCodePath("README.md")).toBe(false);
  });
});

describe("isInfrastructurePath", () => {
  it("returns true for Docker paths", () => {
    expect(isInfrastructurePath("Dockerfile")).toBe(true);
    expect(isInfrastructurePath("docker-compose.yml")).toBe(true);
  });

  it("returns true for compose files", () => {
    expect(isInfrastructurePath("compose.yml")).toBe(true);
    expect(isInfrastructurePath("compose.yaml")).toBe(true);
  });

  it("returns false for non-infrastructure paths", () => {
    expect(isInfrastructurePath("src/main.ts")).toBe(false);
    expect(isInfrastructurePath("package.json")).toBe(false);
  });
});

describe("collectPathCandidates", () => {
  it("returns empty array for null/undefined input", () => {
    expect(collectPathCandidates(null)).toEqual([]);
    expect(collectPathCandidates(undefined)).toEqual([]);
  });

  it("collects paths from direct fields", () => {
    const raw = { path: "/app/src", root: "/app" };
    const candidates = collectPathCandidates(raw);
    expect(candidates).toContain("/app/src");
    expect(candidates).toContain("/app");
  });

  it("collects paths from metadata", () => {
    const raw = {
      metadata: {
        path: "/metadata/path",
        customPathField: "/custom/path",
      },
    };
    const candidates = collectPathCandidates(raw);
    expect(candidates).toContain("/metadata/path");
    expect(candidates).toContain("/custom/path");
  });
});

describe("resolveSourcePath", () => {
  it("returns undefined when no candidates", () => {
    const result = resolveSourcePath({});
    expect(result.path).toBeUndefined();
    expect(result.hasSource).toBe(false);
  });

  it("prefers code paths over infrastructure", () => {
    const raw = {
      path: "docker-compose.yml",
      metadata: { root: "src/app" },
    };
    const result = resolveSourcePath(raw);
    expect(result.path).toBe("src/app");
    expect(result.hasSource).toBe(true);
  });

  it("falls back to first candidate if no code paths", () => {
    const raw = { path: "/some/path" };
    const result = resolveSourcePath(raw);
    expect(result.path).toBe("/some/path");
  });
});

describe("extractTypeLabel", () => {
  it("extracts from frontend analysis frameworks", () => {
    const raw = {
      metadata: {
        frontendAnalysis: { frameworks: ["React", "Next.js"] },
      },
    };
    expect(extractTypeLabel(raw)).toBe("React");
  });

  it("extracts from classification fields", () => {
    const raw = {
      metadata: {
        classification: { label: "Mobile App" },
      },
    };
    expect(extractTypeLabel(raw)).toBe("Mobile App");
  });

  it("extracts from client metadata", () => {
    const raw = {
      metadata: {
        client: { platform: "iOS" },
      },
    };
    expect(extractTypeLabel(raw)).toBe("iOS");
  });

  it("falls back to type field", () => {
    const raw = { type: "web_client" };
    expect(extractTypeLabel(raw)).toBe("web client");
  });

  it("returns undefined for empty data", () => {
    expect(extractTypeLabel({})).toBeUndefined();
    expect(extractTypeLabel(null)).toBeUndefined();
  });
});

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric characters with hyphens", () => {
    expect(slugify("foo@bar#baz")).toBe("foo-bar-baz");
  });

  it("removes leading and trailing hyphens", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });
});
