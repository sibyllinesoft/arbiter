import { describe, expect, it } from "bun:test";
import { SimpleProgress, withProgress } from "../progress.js";

describe("progress utilities", () => {
  it("SimpleProgress logs success/error", () => {
    const p = new SimpleProgress(0);
    expect(() => {
      p.log("working");
      p.success("done");
      p.error("oops");
    }).not.toThrow();
  });

  it("withProgress uses SimpleProgress in CI env", async () => {
    const origCI = process.env.CI;
    process.env.CI = "1";
    let ran = false;
    const result = await withProgress({ text: "task" }, async () => {
      ran = true;
      return 42;
    });
    process.env.CI = origCI;
    expect(ran).toBeTrue();
    expect(result).toBe(42);
  });
});
