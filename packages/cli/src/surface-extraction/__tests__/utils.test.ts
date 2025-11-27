import { describe, expect, it } from "bun:test";
import { calculateStatistics } from "../utils.js";

describe("surface extraction utils", () => {
  it("calculates counts by visibility and type", () => {
    const stats = calculateStatistics([
      {
        name: "A",
        type: "function",
        visibility: "public",
        location: { file: "a", line: 1, column: 1 },
      },
      {
        name: "B",
        type: "class",
        visibility: "private",
        location: { file: "b", line: 1, column: 1 },
      },
      {
        name: "C",
        type: "function",
        visibility: "internal",
        location: { file: "c", line: 1, column: 1 },
      },
      {
        name: "D",
        type: "function",
        visibility: "public",
        location: { file: "d", line: 1, column: 1 },
      },
    ]);

    expect(stats.totalSymbols).toBe(4);
    expect(stats.publicSymbols).toBe(2);
    expect(stats.privateSymbols).toBe(2);
    expect(stats.byType.function).toBe(3);
    expect(stats.byType.class).toBe(1);
  });
});
