import { describe, expect, it } from "bun:test";
import { REQUIRED_ENDPOINTS } from "@/constraints/sandbox";

describe("constraints/sandbox REQUIRED_ENDPOINTS", () => {
  it("contains validate endpoint with expected method", () => {
    expect(REQUIRED_ENDPOINTS.validate.method).toBe("POST");
    expect(REQUIRED_ENDPOINTS.validate.path).toBe("/api/v1/validate");
  });
});
