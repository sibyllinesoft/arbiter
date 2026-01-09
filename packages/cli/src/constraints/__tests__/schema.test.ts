/** @packageDocumentation Constraint system tests */
import { describe, expect, it } from "bun:test";
import { ConstraintViolationError } from "@/constraints/core/core.js";
import {
  LATEST_API_VERSION,
  SchemaVersionValidator,
  VERSION_COMPATIBILITY,
  ensureLatestSchema,
  validateReadData,
} from "@/constraints/core/schema.js";

const baseEnvelope = {
  apiVersion: LATEST_API_VERSION,
  kind: "ValidationResult",
  spec: { success: true },
  metadata: {},
};

describe("Schema constraints", () => {
  it("validates write schema and rejects outdated versions", () => {
    expect(() => ensureLatestSchema(baseEnvelope as any)).not.toThrow();

    expect(() => ensureLatestSchema({ ...baseEnvelope, apiVersion: "2024-12-24" } as any)).toThrow(
      ConstraintViolationError,
    );
  });

  it("validates read schema with deprecated and unsupported versions", () => {
    const deprecated = { ...baseEnvelope, apiVersion: VERSION_COMPATIBILITY.deprecated[0] };
    expect(() => validateReadData(deprecated)).not.toThrow();

    const unsupported = { ...baseEnvelope, apiVersion: VERSION_COMPATIBILITY.unsupported[0] };
    expect(() => validateReadData(unsupported)).toThrow(ConstraintViolationError);
  });

  it("creates envelopes and migrates versions", () => {
    const validator = new SchemaVersionValidator();
    const created = validator.createEnvelope("ExportResult", { format: "txt", content: "hi" });
    expect(created.apiVersion).toBe(LATEST_API_VERSION);

    const migrated = validator.migrateToLatest({
      ...created,
      apiVersion: VERSION_COMPATIBILITY.supported[1],
    });
    expect(migrated.apiVersion).toBe(LATEST_API_VERSION);
    expect(migrated.metadata?.migratedFrom).toBeDefined();
  });

  it("decorator wraps method and enforces validation on write", async () => {
    class TestService {
      @((await import("@/constraints/schema.js")).withSchemaValidation("write"))
      async send() {
        return baseEnvelope;
      }
    }

    const svc = new TestService();
    await expect(svc.send()).resolves.toBeDefined();
  });
});
