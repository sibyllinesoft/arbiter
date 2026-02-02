import { describe, expect, it, vi } from "bun:test";
import {
  debounce,
  formatValidationErrors,
  isRelativePath,
  normalizePath,
  translateCueErrors,
} from "../utils";

describe("shared utils", () => {
  it("formats validation errors with path and position", () => {
    const out = formatValidationErrors([
      { message: "missing field", path: "spec.routes", line: 3, column: 5 },
      { message: "conflict" },
    ]);
    expect(out).toContain("spec.routes");
    expect(out).toContain("line 3, column 5");
    expect(out).toContain("conflict");
  });

  it("detects relative paths", () => {
    expect(isRelativePath("foo/bar")).toBe(true);
    expect(isRelativePath("/abs/path")).toBe(false);
    expect(isRelativePath("C:\\path")).toBe(false);
  });

  it("normalizes slashes", () => {
    expect(normalizePath("foo\\bar\\baz")).toBe("foo/bar/baz");
  });

  it("debounce delays execution", async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 10);
    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 25));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("translates common CUE errors", () => {
    expect(translateCueErrors("undefined field")).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "schema" })]),
    );
    expect(translateCueErrors("random message")[0].friendlyMessage).toBe("random message");
  });
});
