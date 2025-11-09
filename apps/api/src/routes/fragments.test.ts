import { describe, expect, it } from "bun:test";

import { extractArtifactsFromResolved } from "./fragments";

describe("extractArtifactsFromResolved frameworks", () => {
  const baseService = {
    serviceType: "bespoke",
    type: "deployment",
    language: "typescript",
  };

  it("uses framework from metadata when provided", () => {
    const resolved = {
      services: {
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
      services: {
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
      services: {
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
      services: {
        stats: {
          ...baseService,
          type: "deployment",
        },
      },
    };

    const extracted = extractArtifactsFromResolved(resolved);
    expect(extracted.services[0].framework).toBeNull();
  });
});
