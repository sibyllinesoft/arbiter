import { describe, expect, it } from "bun:test";
import { withProgressBar } from "@/utils/api/progress.js";

describe("withProgressBar", () => {
  it("runs operation and completes bar", async () => {
    let ticks = 0;
    const result = await withProgressBar(
      {
        title: "bar",
        total: 3,
        completeMessage: "done",
      },
      async (bar) => {
        bar.increment();
        ticks++;
        bar.increment();
        ticks++;
        bar.increment();
        ticks++;
        return "ok";
      },
    );

    expect(ticks).toBe(3);
    expect(result).toBe("ok");
  });

  it("fails bar when operation throws", async () => {
    let caught = false;
    try {
      await withProgressBar({ title: "bar", total: 1, completeMessage: "done" }, async () => {
        throw new Error("boom");
      });
    } catch (err) {
      caught = true;
      expect((err as Error).message).toContain("boom");
    }
    expect(caught).toBeTrue();
  });

  it("emits completeMessage when provided", async () => {
    let completeLine = "";
    const originalLog = console.log;
    console.log = (msg?: any) => {
      completeLine += String(msg ?? "");
    };

    await withProgressBar(
      { title: "bar", total: 1, completeMessage: "custom complete" },
      async (bar) => {
        bar.increment();
      },
    );

    console.log = originalLog;
    expect(completeLine).toContain("custom complete");
  });
});
