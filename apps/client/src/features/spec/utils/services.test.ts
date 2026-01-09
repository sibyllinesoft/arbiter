/**
 * Unit tests for service utility functions.
 */
import { describe, expect, it } from "vitest";
import {
  buildEndpointDraftIdentifier,
  collectPathCandidates,
  collectPorts,
  deriveArtifactIdFromRaw,
  isAbsolutePath,
  isInfrastructurePath,
  isLikelyCodePath,
  isPotentialSourcePath,
  resolveSourcePath,
  slugify,
} from "./services";

describe("slugify", () => {
  it("converts to lowercase and replaces non-alphanumeric", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("foo@bar#baz")).toBe("foo-bar-baz");
  });

  it("removes leading and trailing hyphens", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });
});

describe("buildEndpointDraftIdentifier", () => {
  it("builds identifier from service, method, and path", () => {
    expect(buildEndpointDraftIdentifier("api", "GET", "/users")).toBe("api-get-users");
  });

  it("uses fallbacks for empty method and path", () => {
    expect(buildEndpointDraftIdentifier("api", "", "")).toBe("api-any-endpoint");
  });
});

describe("isLikelyCodePath", () => {
  it("returns true for TypeScript files", () => {
    expect(isLikelyCodePath("src/main.ts")).toBe(true);
    expect(isLikelyCodePath("app.tsx")).toBe(true);
  });

  it("returns true for other code extensions", () => {
    expect(isLikelyCodePath("main.py")).toBe(true);
    expect(isLikelyCodePath("main.go")).toBe(true);
    expect(isLikelyCodePath("main.rs")).toBe(true);
  });

  it("returns true for service patterns", () => {
    expect(isLikelyCodePath("api-service")).toBe(true);
    expect(isLikelyCodePath("packages/service")).toBe(true);
  });

  it("returns false for config files", () => {
    expect(isLikelyCodePath("config.json")).toBe(false);
  });
});

describe("isAbsolutePath", () => {
  it("returns true for Unix absolute paths", () => {
    expect(isAbsolutePath("/home/user/app")).toBe(true);
  });

  it("returns true for Windows absolute paths", () => {
    expect(isAbsolutePath("C:\\Users\\app")).toBe(true);
    expect(isAbsolutePath("d:/projects")).toBe(true);
  });

  it("returns false for relative paths", () => {
    expect(isAbsolutePath("./src")).toBe(false);
    expect(isAbsolutePath("src")).toBe(false);
  });
});

describe("isPotentialSourcePath", () => {
  it("returns true for code paths", () => {
    expect(isPotentialSourcePath("src/main.ts")).toBe(true);
  });

  it("returns true for relative paths", () => {
    expect(isPotentialSourcePath("./src")).toBe(true);
    expect(isPotentialSourcePath("../app")).toBe(true);
  });

  it("returns false for empty strings", () => {
    expect(isPotentialSourcePath("")).toBe(false);
    expect(isPotentialSourcePath("   ")).toBe(false);
  });
});

describe("isInfrastructurePath", () => {
  it("returns true for Docker files", () => {
    expect(isInfrastructurePath("Dockerfile")).toBe(true);
    expect(isInfrastructurePath("docker-compose.yml")).toBe(true);
  });

  it("returns true for Docker directories", () => {
    expect(isInfrastructurePath("/docker/app")).toBe(true);
    expect(isInfrastructurePath("docker/config")).toBe(true);
  });

  it("returns true for Helm patterns", () => {
    expect(isInfrastructurePath("/helm/chart")).toBe(true);
    expect(isInfrastructurePath("/charts/api")).toBe(true);
  });

  it("returns false for source paths", () => {
    expect(isInfrastructurePath("src/main.ts")).toBe(false);
  });
});

describe("deriveArtifactIdFromRaw", () => {
  it("returns null for invalid input", () => {
    expect(deriveArtifactIdFromRaw(null)).toBeNull();
    expect(deriveArtifactIdFromRaw(undefined)).toBeNull();
    expect(deriveArtifactIdFromRaw("string")).toBeNull();
  });

  it("extracts artifactId from raw", () => {
    expect(deriveArtifactIdFromRaw({ artifactId: "abc123" })).toBe("abc123");
    expect(deriveArtifactIdFromRaw({ artifact_id: "def456" })).toBe("def456");
  });

  it("extracts from metadata", () => {
    expect(deriveArtifactIdFromRaw({ metadata: { artifactId: "meta123" } })).toBe("meta123");
  });

  it("ignores empty strings", () => {
    expect(deriveArtifactIdFromRaw({ artifactId: "  " })).toBeNull();
  });
});

describe("collectPathCandidates", () => {
  it("returns empty array for null input", () => {
    expect(collectPathCandidates(null)).toEqual([]);
  });

  it("collects from direct fields", () => {
    const raw = { path: "/app/src" };
    expect(collectPathCandidates(raw)).toContain("/app/src");
  });

  it("collects from metadata", () => {
    const raw = { metadata: { sourcePath: "/meta/path" } };
    expect(collectPathCandidates(raw)).toContain("/meta/path");
  });
});

describe("resolveSourcePath", () => {
  it("returns no source when empty candidates", () => {
    const result = resolveSourcePath({});
    expect(result.path).toBeUndefined();
    expect(result.hasSource).toBe(false);
  });

  it("marks as no source when Docker image present", () => {
    const raw = {
      image: "postgres:15",
      path: "src/db",
    };
    const result = resolveSourcePath(raw);
    expect(result.hasSource).toBe(false);
  });

  it("identifies source paths without Docker image", () => {
    const raw = { path: "src/services/api" };
    const result = resolveSourcePath(raw);
    expect(result.hasSource).toBe(true);
  });
});

describe("collectPorts", () => {
  it("returns empty string for no ports", () => {
    expect(collectPorts({})).toBe("");
  });

  it("collects from array of numbers", () => {
    const raw = { ports: [3000, 8080] };
    expect(collectPorts(raw)).toBe("3000, 8080");
  });

  it("collects from array of objects", () => {
    const raw = { ports: [{ hostPort: 3000, containerPort: 80 }] };
    expect(collectPorts(raw)).toBe("3000:80");
  });

  it("deduplicates ports", () => {
    const raw = { ports: [3000, 3000, 8080] };
    expect(collectPorts(raw)).toBe("3000, 8080");
  });
});
