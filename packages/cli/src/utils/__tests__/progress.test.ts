import { afterEach, describe, expect, it, mock } from "bun:test";
import chalk from "chalk";

// Mock ora so spinner output doesn't pollute test logs
let lastSpinner: any;
mock.module("ora", () => ({
  __esModule: true,
  default: () => {
    lastSpinner = {
      text: "",
      start: () => {},
      succeed: (...args: any[]) => {
        (lastSpinner as any)._succeedCalls?.push(args);
      },
      fail: (...args: any[]) => {
        (lastSpinner as any)._failCalls?.push(args);
      },
      warn: (...args: any[]) => {
        (lastSpinner as any)._warnCalls?.push(args);
      },
      stop: () => {},
      _succeedCalls: [] as any[],
      _failCalls: [] as any[],
      _warnCalls: [] as any[],
    };
    return lastSpinner;
  },
}));

const progressModulePromise = import("../progress.js");

describe("progress utilities", () => {
  const originalCI = process.env.CI;
  const originalNow = Date.now;
  const originalLog = console.log;

  it("includes estimated time when steps have history", async () => {
    const { Progress } = await progressModulePromise;
    let now = 0;
    Date.now = () => now;
    const progress = new Progress({ text: "build" });
    progress.addSteps(["a", "b", "c"]);
    progress.nextStep(); // start a at 0ms
    now = 200;
    progress.nextStep(); // complete a at 200ms, start b

    progress.updateWithEstimate("processing");
    expect(progress["spinner"].text).toContain("remaining");
    Date.now = originalNow;
  });

  it("falls back to SimpleProgress when running in CI", async () => {
    process.env.CI = "1";
    const { createProgress } = await progressModulePromise;
    const progress = createProgress({ text: "ci run" });
    expect(progress.constructor.name).toBe("SimpleProgress");
    process.env.CI = originalCI;
  });

  it("renders plain text progress when stdout is not a TTY", async () => {
    const originalStdout = process.stdout;
    const originalNow = Date.now;
    let now = 0;
    Date.now = () => now;
    const fakeStdout: any = { isTTY: false, write: () => {}, columns: 80 };
    Object.defineProperty(process, "stdout", { value: fakeStdout, configurable: true });
    const logCalls: any[] = [];
    const logSpy = (...args: any[]) => logCalls.push(args);
    console.log = logSpy as any;

    try {
      const { createProgressBar } = await progressModulePromise;
      const bar = createProgressBar({ title: "Build", total: 10 });
      now = 150;
      bar.update(5, "halfway");
      expect(logCalls.join(" ")).toContain("Build: 50%");
    } finally {
      console.log = originalLog;
      Object.defineProperty(process, "stdout", { value: originalStdout, configurable: true });
      Date.now = originalNow;
    }
  });

  it("throttles TTY progress bar updates to avoid spam", async () => {
    const originalIsTTY = process.stdout.isTTY;
    const originalWrite = process.stdout.write;
    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    (process.stdout as any).columns = 80;
    const writeCalls: any[] = [];
    const writeSpy = (...args: any[]) => writeCalls.push(args);
    (process.stdout as any).write = writeSpy as any;

    try {
      Date.now = () => 0;
      const { createProgressBar } = await progressModulePromise;
      const bar = createProgressBar({ title: "Deploy", total: 10 });

      bar.update(1);
      expect(writeCalls.length).toBe(0); // throttled

      Date.now = () => 150;
      bar.update(2);
      expect(writeCalls.length).toBe(1);

      Date.now = () => 180;
      bar.update(3);
      expect(writeCalls.length).toBe(1); // still throttled

      Date.now = () => 300;
      bar.update(10, "done");
      expect(writeCalls.length).toBe(2);
    } finally {
      Date.now = originalNow;
      Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
      (process.stdout as any).write = originalWrite;
      (process.stdout as any).columns = originalColumns;
    }
  });

  it("tracks step failures and forwards to spinner", async () => {
    const { Progress } = await progressModulePromise;
    const progress = new Progress({ text: "steps" });
    progress.addSteps(["one", "two"]);
    progress.nextStep();
    progress.failCurrentStep("boom");

    expect((lastSpinner as any)._failCalls.length).toBeGreaterThan(0);
    expect(progress.getStepsSummary()).toContain("failed");
    expect(progress.getStepsReport()).toContain("✗");
  });

  it("warns and stops progress indicators via utility methods", async () => {
    const { Progress, MultiProgress } = await progressModulePromise;
    const progress = new Progress({ text: "warnable" });
    progress.warn("careful");
    expect((lastSpinner as any)._warnCalls.length).toBeGreaterThan(0);

    const multi = new MultiProgress();
    multi.add("a", { text: "one" });
    multi.add("b", { text: "two" });
    multi.stopAll();
    expect(multi.get("a")).toBeUndefined();

    const multi2 = new MultiProgress();
    multi2.add("x", { text: "x" });
    multi2.add("y", { text: "y" });
    multi2.failAll("nope");
    expect(multi2.get("x")).toBeUndefined();
  });

  it("manages multiple progresses and clears map on succeedAll", async () => {
    const { MultiProgress } = await progressModulePromise;
    const mp = new MultiProgress();
    const first = mp.add("first", { text: "one" });
    mp.add("second", { text: "two" });

    mp.updateAll("bump");
    expect(first["spinner"].text).toBe("bump");

    mp.succeedAll("done");
    expect(mp.get("first")).toBeUndefined();
  });

  it("throttles SimpleProgress log output and reports success/error", async () => {
    const logCalls: any[] = [];
    console.log = ((...args: any[]) => logCalls.push(args)) as any;
    Date.now = () => 0;

    const { SimpleProgress } = await progressModulePromise;
    const progress = new SimpleProgress(100);

    Date.now = () => 50;
    progress.log("skip");
    expect(logCalls.length).toBe(0);

    Date.now = () => 120;
    progress.log("print");
    expect(logCalls.length).toBe(1);

    Date.now = () => 200;
    progress.success("done");
    expect(logCalls.at(-1)?.join(" ")).toContain("done");

    Date.now = () => 250;
    progress.error("fail");
    expect(logCalls.at(-1)?.join(" ")).toContain("fail");

    Date.now = () => 300;
    progress.warn("warn");
    expect(logCalls.at(-1)?.join(" ")).toContain("warn");

    console.log = originalLog;
    Date.now = originalNow;
  });

  it("wraps async operations with success and failure handling", async () => {
    process.env.CI = "1"; // ensure SimpleProgress branch
    const logCalls: any[] = [];
    console.log = ((...args: any[]) => logCalls.push(args)) as any;
    const { withProgress } = await progressModulePromise;

    try {
      await withProgress({ text: "ok" }, async () => "result");
      expect(logCalls.at(-1)?.join(" ")).toContain("ok");

      await expect(
        withProgress({ text: "bad" }, async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      expect(logCalls.at(-1)?.join(" ")).toContain("boom");
    } finally {
      console.log = originalLog;
      process.env.CI = originalCI;
    }
  });

  it("handles withStepProgress success and failure paths", async () => {
    const { withStepProgress } = await progressModulePromise;
    const result = await withStepProgress({ title: "plan", steps: ["a", "b"] }, async (p) => {
      if ("nextStep" in p) {
        p.nextStep("a");
        p.nextStep("b");
      }
      return "ok";
    });
    expect(result).toBe("ok");

    await expect(
      withStepProgress({ title: "fail", steps: ["x"] }, async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
  });

  it("completes progress bar with custom message and reports failure", async () => {
    const originalStdout = process.stdout;
    const fakeStdout: any = { isTTY: false, write: () => {}, columns: 80 };
    Object.defineProperty(process, "stdout", { value: fakeStdout, configurable: true });
    const logs: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    const { withProgressBar } = await progressModulePromise;

    await withProgressBar(
      { title: "download", total: 2, completeMessage: "all done" },
      async (bar) => {
        bar.update(1);
        bar.update(2);
      },
    );
    expect(logs.some((l) => l.includes("all done"))).toBe(true);

    await expect(
      withProgressBar({ title: "explode", total: 1 }, async () => {
        throw new Error("kaboom");
      }),
    ).rejects.toThrow("kaboom");
    expect(logs.some((l) => l.includes("failed"))).toBe(true);

    console.log = originalConsoleLog;
    Object.defineProperty(process, "stdout", { value: originalStdout, configurable: true });
  });
});
