import { describe, expect, it } from "bun:test";
import { getExtractor, listExtractors, registerExtractor } from "@/surface-extraction/index.js";

describe("surface extractor registry", () => {
  it("returns default extractor for known language", () => {
    expect(getExtractor("typescript")).toBeInstanceOf(Function);
  });

  it("allows registration of custom extractor", () => {
    const custom = async () => null;
    registerExtractor("typescript", custom as any);
    expect(getExtractor("typescript")).toBe(custom);
    expect(listExtractors()).toContain("typescript");
  });
});
