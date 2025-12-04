import { describe, expect, it } from "bun:test";

import {
  ensureWorkload,
  isInternalService,
  resolveServiceArtifactType,
  resolveServiceWorkload,
} from "@/utils/service-metadata.js";

describe("service metadata helpers", () => {
  it("detects workloads from multiple legacy fields", () => {
    expect(resolveServiceWorkload({ workload: "deployment" })).toBe("deployment");
    expect(resolveServiceWorkload({ mode: "job" } as any)).toBe("job");
    expect(resolveServiceWorkload({ runtime: "cronjob" } as any)).toBe("cronjob");
    expect(resolveServiceWorkload({ execution: "daemonset" } as any)).toBe("daemonset");
    expect(resolveServiceWorkload({ deploymentKind: "statefulset" } as any)).toBe("statefulset");
    expect(resolveServiceWorkload({ type: "service" } as any)).toBeUndefined();
  });

  it("resolves artifact type with explicit overrides and source hints", () => {
    expect(resolveServiceArtifactType(undefined)).toBe("internal");
    expect(resolveServiceArtifactType({ type: "external" })).toBe("external");
    expect(resolveServiceArtifactType({ artifactType: "internal" })).toBe("internal");
    expect(resolveServiceArtifactType({ source: { kind: "monorepo" } } as any)).toBe("internal");
    expect(resolveServiceArtifactType({ source: { kind: "github" } } as any)).toBe("external");
    expect(resolveServiceArtifactType({ sourceDirectory: "services/api" })).toBe("internal");
    expect(resolveServiceArtifactType({ image: "node:18" })).toBe("external");
  });

  it("computes internal/external shortcut and ensures fallback workload", () => {
    expect(isInternalService(undefined)).toBe(true);
    expect(isInternalService({ type: "external" })).toBe(false);
    expect(isInternalService({ image: "nginx" })).toBe(false);
    expect(isInternalService({ sourceDirectory: "@/utils/__tests__/svc" })).toBe(true);

    expect(ensureWorkload({ workload: "deployment" }, "job")).toBe("deployment");
    expect(ensureWorkload({}, "job")).toBe("job");
  });
});
