import { describe, expect, it } from "bun:test";

import {
  debounce,
  formatValidationErrors,
  isRelativePath,
  normalizePath,
  translateCueErrors,
} from "@arbiter/specification";

describe("shared utils", () => {
  it("formats validation errors with paths and locations", () => {
    const message = formatValidationErrors([
      { message: "missing field", path: "spec.name", line: 3, column: 5 },
      { message: "invalid type", line: 10 },
    ]);

    expect(message).toContain("spec.name: missing field (line 3, column 5)");
    expect(message).toContain("invalid type (line 10)");
    expect(message.split("\n")).toHaveLength(2);
  });

  it("detects relative paths and normalizes separators", () => {
    expect(isRelativePath("relative/path")).toBe(true);
    expect(isRelativePath("/abs/path")).toBe(false);
    expect(isRelativePath("C:\\abs\\path")).toBe(false);

    expect(normalizePath("C:\\tmp\\project\\file.ts")).toBe("C:/tmp/project/file.ts");
  });

  it("debounces calls so only the last invocation runs", async () => {
    const calls: Array<unknown[]> = [];
    const debounced = debounce((value) => {
      calls.push([value]);
    }, 10);

    debounced("first");
    debounced("second");

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["second"]);
  });

  it("translates common CUE errors to friendly messages", () => {
    const [translation] = translateCueErrors("conflicting values in schema");
    expect(translation.category).toBe("validation");
    expect(translation.friendlyMessage).toContain("Values conflict");

    const [fallback] = translateCueErrors("unknown problem");
    expect(fallback.friendlyMessage).toBe("unknown problem");
    expect(fallback.category).toBe("validation");
  });
});
