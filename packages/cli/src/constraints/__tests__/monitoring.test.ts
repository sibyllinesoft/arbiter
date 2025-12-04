import { describe, expect, it, mock } from "bun:test";
import os from "node:os";
import path from "node:path";
import { ConstraintMonitor, DEFAULT_MONITORING_CONFIG } from "@/constraints/monitoring.js";
import fs from "fs-extra";

const tmpFile = (prefix: string) => path.join(os.tmpdir(), `${prefix}-${Date.now()}.log`);

describe("ConstraintMonitor", () => {
  it("records violations and metrics, emits alerts and writes logs", async () => {
    const violationLog = tmpFile("violations");
    const metricsLog = tmpFile("metrics");
    const monitor = new ConstraintMonitor({
      ...DEFAULT_MONITORING_CONFIG,
      violationLogPath: violationLog,
      metricsLogPath: metricsLog,
      alertThresholds: {
        ...DEFAULT_MONITORING_CONFIG.alertThresholds,
        maxViolationsPerHour: 0, // force alert
        maxAverageResponseTime: 1, // force alert
        minSuccessRate: 99,
      },
    });

    const alerts: any[] = [];
    monitor.on("alert", (a) => alerts.push(a));

    // Record violation
    monitor.recordViolation({
      constraint: "test",
      violation: new Error("boom") as any,
      timestamp: Date.now(),
      operation: "op1",
    });

    // Record slow/failed op to trigger perf alert
    monitor.recordOperation("op1", 10, false);

    expect(alerts.length).toBeGreaterThan(0);

    // Generate report contains sections
    const report = monitor.generateReport();
    expect(report).toContain("Constraint System Monitoring Report");
    expect(report).toContain("Violations Summary");

    // Export data writes json
    const out = tmpFile("export");
    await monitor.exportData(out);
    const exported = await fs.readJson(out);
    expect(exported.violationCounts.total).toBeGreaterThan(0);

    // Logs written
    const violationLogContent = await fs.readFile(violationLog, "utf8");
    expect(violationLogContent.length).toBeGreaterThan(0);

    const metricLogContent = await fs.readFile(metricsLog, "utf8");
    expect(metricLogContent.length).toBeGreaterThan(0);
  });

  it("cleanup prunes old violations and emits event", () => {
    const monitor = new ConstraintMonitor({ metricsRetentionDays: 0 });
    const eventSpy = (...args: any[]) => {
      (eventSpy as any).calls = ((eventSpy as any).calls || 0) + 1;
      (eventSpy as any).last = args;
    };
    monitor.on("cleanup_completed", eventSpy);

    const longAgo = Date.now() - 1000 * 60 * 60 * 24 * 10;
    (monitor as any).violations.push({
      constraint: "old",
      violation: new Error() as any,
      timestamp: longAgo,
    });

    monitor.cleanup();
    expect((eventSpy as any).calls || 0).toBeGreaterThan(0);
  });
});
