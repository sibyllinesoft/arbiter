import { describe, expect, it } from "bun:test";
import {
  LATEST_API_VERSION,
  exportResultSchema,
  validationResultSchema,
} from "../constraints/schema";

describe("constraints/schema validation schemas", () => {
  it("accepts supported apiVersion", () => {
    const data = {
      apiVersion: LATEST_API_VERSION,
      kind: "ValidationResult",
      spec: { success: true, errors: [], warnings: [] },
    };
    const parsed = validationResultSchema.parse(data);
    expect(parsed.spec.success).toBe(true);
  });

  it("rejects unsupported apiVersion", () => {
    const data = {
      apiVersion: "1900-01-01",
      kind: "ExportResult",
      spec: { format: "json", content: "{}" },
    };
    expect(() => exportResultSchema.parse(data)).toThrow();
  });
});
