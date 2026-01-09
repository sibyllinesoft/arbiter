/**
 * Unit tests for AddEntityModal utility functions.
 */
import { describe, expect, it } from "vitest";
import {
  cloneFieldValue,
  coerceFieldValueToArray,
  coerceFieldValueToString,
  extractListFromValue,
  getDefaultValue,
  keyValuePairsToMap,
  toKeyValuePairs,
  toSingularLabel,
} from "./utils";

describe("coerceFieldValueToString", () => {
  it("returns empty string for null and undefined", () => {
    expect(coerceFieldValueToString(null)).toBe("");
    expect(coerceFieldValueToString(undefined)).toBe("");
  });

  it("returns string values unchanged", () => {
    expect(coerceFieldValueToString("test")).toBe("test");
    expect(coerceFieldValueToString("  spaced  ")).toBe("  spaced  ");
  });

  it("converts numbers to strings", () => {
    expect(coerceFieldValueToString(42)).toBe("42");
    expect(coerceFieldValueToString(3.14)).toBe("3.14");
  });

  it("converts booleans to strings", () => {
    expect(coerceFieldValueToString(true)).toBe("true");
    expect(coerceFieldValueToString(false)).toBe("false");
  });

  it("extracts first non-empty string from arrays", () => {
    expect(coerceFieldValueToString(["", "first", "second"])).toBe("first");
    expect(coerceFieldValueToString(["only"])).toBe("only");
    expect(coerceFieldValueToString([])).toBe("");
  });

  it("extracts value from objects", () => {
    expect(coerceFieldValueToString({ value: "test" })).toBe("test");
    expect(coerceFieldValueToString({ name: "item" })).toBe("item");
  });
});

describe("coerceFieldValueToArray", () => {
  it("returns empty array for null and undefined", () => {
    expect(coerceFieldValueToArray(null)).toEqual([]);
    expect(coerceFieldValueToArray(undefined)).toEqual([]);
  });

  it("filters empty strings from arrays", () => {
    expect(coerceFieldValueToArray(["a", "", "b", "  "])).toEqual(["a", "b"]);
  });

  it("wraps single values in array", () => {
    expect(coerceFieldValueToArray("single")).toEqual(["single"]);
  });

  it("returns empty array for empty string", () => {
    expect(coerceFieldValueToArray("")).toEqual([]);
    expect(coerceFieldValueToArray("   ")).toEqual([]);
  });
});

describe("extractListFromValue", () => {
  it("returns empty array for null and undefined", () => {
    expect(extractListFromValue(null)).toEqual([]);
    expect(extractListFromValue(undefined)).toEqual([]);
  });

  it("splits strings by newlines", () => {
    expect(extractListFromValue("line1\nline2\nline3")).toEqual(["line1", "line2", "line3"]);
  });

  it("handles Windows line endings", () => {
    expect(extractListFromValue("line1\r\nline2")).toEqual(["line1", "line2"]);
  });

  it("filters empty lines", () => {
    expect(extractListFromValue("line1\n\nline2\n")).toEqual(["line1", "line2"]);
  });

  it("processes array elements and splits by newlines", () => {
    expect(extractListFromValue(["a\nb", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("cloneFieldValue", () => {
  it("returns primitives unchanged", () => {
    expect(cloneFieldValue("test")).toBe("test");
    expect(cloneFieldValue(42)).toBe(42);
    expect(cloneFieldValue(true)).toBe(true);
  });

  it("creates shallow copy of arrays", () => {
    const original = ["a", "b"];
    const clone = cloneFieldValue(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
  });

  it("creates shallow copy of objects", () => {
    const original = { key: "value" };
    const clone = cloneFieldValue(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
  });
});

describe("getDefaultValue", () => {
  it("returns empty string for undefined field", () => {
    expect(getDefaultValue(undefined)).toBe("");
  });

  it("returns field default value if specified", () => {
    expect(getDefaultValue({ name: "test", defaultValue: "default" } as any)).toBe("default");
  });

  it("returns empty array for multiple fields", () => {
    expect(getDefaultValue({ name: "test", multiple: true } as any)).toEqual([]);
  });

  it("returns empty string for single fields", () => {
    expect(getDefaultValue({ name: "test" } as any)).toBe("");
  });
});

describe("toKeyValuePairs", () => {
  it("returns empty array for falsy input", () => {
    expect(toKeyValuePairs(null)).toEqual([]);
    expect(toKeyValuePairs(undefined)).toEqual([]);
  });

  it("converts object to key-value pairs", () => {
    const result = toKeyValuePairs({ foo: "bar", baz: "qux" });
    expect(result).toEqual([
      { key: "foo", value: "bar" },
      { key: "baz", value: "qux" },
    ]);
  });

  it("handles array of key-value objects", () => {
    const input = [
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ];
    expect(toKeyValuePairs(input)).toEqual(input);
  });

  it("handles non-string values in objects", () => {
    const result = toKeyValuePairs({ num: 42, bool: true });
    expect(result).toEqual([
      { key: "num", value: "42" },
      { key: "bool", value: "true" },
    ]);
  });
});

describe("keyValuePairsToMap", () => {
  it("converts key-value pairs to object", () => {
    const pairs = [
      { key: "foo", value: "bar" },
      { key: "baz", value: "qux" },
    ];
    expect(keyValuePairsToMap(pairs)).toEqual({ foo: "bar", baz: "qux" });
  });

  it("skips entries with empty keys", () => {
    const pairs = [
      { key: "", value: "skip" },
      { key: "valid", value: "keep" },
    ];
    expect(keyValuePairsToMap(pairs)).toEqual({ valid: "keep" });
  });

  it("trims keys", () => {
    const pairs = [{ key: "  spaced  ", value: "value" }];
    expect(keyValuePairsToMap(pairs)).toEqual({ spaced: "value" });
  });
});

describe("toSingularLabel", () => {
  it("handles special cases", () => {
    expect(toSingularLabel("infrastructure", "")).toBe("infrastructure component");
    expect(toSingularLabel("tools", "")).toBe("tool");
    expect(toSingularLabel("services", "")).toBe("service");
    expect(toSingularLabel("databases", "")).toBe("database");
  });

  it("converts -ies endings to -y", () => {
    expect(toSingularLabel("categories", "")).toBe("category");
    expect(toSingularLabel("entries", "")).toBe("entry");
  });

  it("removes trailing s", () => {
    expect(toSingularLabel("items", "")).toBe("item");
    expect(toSingularLabel("tasks", "")).toBe("task");
  });

  it("returns unchanged if no plural ending", () => {
    expect(toSingularLabel("task", "")).toBe("task");
  });

  it("uses fallback when label is empty", () => {
    expect(toSingularLabel("", "fallback")).toBe("fallback");
  });

  it("returns item when both are empty", () => {
    expect(toSingularLabel("", "")).toBe("item");
  });
});
