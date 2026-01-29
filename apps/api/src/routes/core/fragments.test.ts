import { describe, expect, it } from "bun:test";

import { extractArtifactsFromResolved } from "../io/fragments";

describe("extractArtifactsFromResolved frameworks", () => {
  const baseService = {
    type: "internal",
    workload: "deployment",
    language: "typescript",
  };

  it("uses framework from metadata when provided", () => {
    const resolved = {
      packages: {
        api: {
          ...baseService,
          metadata: {
            framework: "fastify",
          },
        },
      },
    };

    const extracted = extractArtifactsFromResolved(resolved);
    expect(extracted.services).toHaveLength(1);
    expect(extracted.services[0].framework).toBe("fastify");
    expect(extracted.services[0].metadata?.framework).toBe("fastify");
  });

  it("prefers runtime framework hints", () => {
    const resolved = {
      packages: {
        worker: {
          ...baseService,
          runtime: {
            framework: "fastapi",
          },
        },
      },
    };

    const extracted = extractArtifactsFromResolved(resolved);
    expect(extracted.services[0].framework).toBe("fastapi");
  });

  it("falls back to capability adapter names", () => {
    const resolved = {
      packages: {
        queue: {
          ...baseService,
          capabilities: [
            {
              kind: "httpServer",
              adapter: {
                name: "axum",
              },
            },
          ],
        },
      },
    };

    const extracted = extractArtifactsFromResolved(resolved);
    expect(extracted.services[0].framework).toBe("axum");
  });

  it("does not treat workload type as framework when no hints exist", () => {
    const resolved = {
      packages: {
        stats: {
          ...baseService,
          workload: "deployment",
        },
      },
    };

    const extracted = extractArtifactsFromResolved(resolved);
    expect(extracted.services[0].framework).toBeNull();
  });
});
