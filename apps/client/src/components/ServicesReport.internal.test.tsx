import { describe, expect, it } from "vitest";

import type { InternalServiceCandidate } from "./services/internal-service-classifier";
import { shouldTreatAsInternalService } from "./services/internal-service-classifier";

const createService = (
  overrides: Partial<InternalServiceCandidate> = {},
): InternalServiceCandidate => {
  const service: InternalServiceCandidate = {
    raw: overrides.raw ?? {},
    endpoints: overrides.endpoints ?? [],
    hasSource: overrides.hasSource ?? false,
  };

  if (overrides.sourcePath !== undefined) {
    service.sourcePath = overrides.sourcePath;
  }
  if (overrides.typeLabel !== undefined) {
    service.typeLabel = overrides.typeLabel;
  }

  return service;
};

describe("shouldTreatAsInternalService", () => {
  it("treats services with detected source as internal", () => {
    const service = createService({
      hasSource: true,
      raw: { sourceDirectory: "./services/sibylline-store" },
    });

    expect(shouldTreatAsInternalService(service)).toBe(true);
  });

  it("treats services with explicit sourcePath as internal even without package metadata", () => {
    const service = createService({
      sourcePath: "apps/store",
      hasSource: true,
      raw: {},
    });

    expect(shouldTreatAsInternalService(service)).toBe(true);
  });

  it("keeps services without source or package data external", () => {
    const service = createService({ raw: { metadata: { type: "database" } } });

    expect(shouldTreatAsInternalService(service)).toBe(false);
  });

  it("keeps external container services external", () => {
    const service = createService({
      raw: { type: "external", language: "container" },
    });

    expect(shouldTreatAsInternalService(service)).toBe(false);
  });

  it("treats external services with actual source paths as internal", () => {
    const service = createService({
      raw: { type: "external", language: "container" },
      hasSource: true,
      sourcePath: "./services/custom-redis",
    });

    expect(shouldTreatAsInternalService(service)).toBe(true);
  });

  it("treats internal services as internal even without detected source", () => {
    const service = createService({ raw: { type: "internal" } });

    expect(shouldTreatAsInternalService(service)).toBe(true);
  });
});
