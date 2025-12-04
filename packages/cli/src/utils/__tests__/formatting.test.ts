import { describe, expect, it } from "bun:test";
import {
  createTextProgressBar,
  formatComponentTable,
  formatErrorDetails,
  formatExitMessage,
  formatFileSize,
  formatJson,
  formatStatusTable,
  formatSummary,
  formatTable,
  formatTime,
  formatValidationTable,
  formatWarningDetails,
  formatYaml,
} from "@/utils/formatting.js";
import chalk from "chalk";

const sampleResult = (overrides: Partial<any> = {}) => ({
  file: "file.cue",
  status: "valid",
  errors: [],
  warnings: [],
  processingTime: 25,
  ...overrides,
});

describe("formatting helpers", () => {
  it("formats simple tables with padded columns", () => {
    const out = formatTable(
      ["A", "B"],
      [
        ["1", "two"],
        ["long", "x"],
      ],
      (v) => v,
    );
    expect(out).toContain("A");
    expect(out).toContain("long");
  });

  it("returns a dimmed message when table rows are empty", () => {
    const out = formatTable(["A", "B"], [], (v) => v);
    expect(out).toBe(chalk.dim("No data to display"));
  });

  it("handles empty validation and summary gracefully", () => {
    expect(formatValidationTable([])).toContain("No files to validate");
    expect(formatSummary([])).toContain("No files processed");
  });

  it("includes warnings and errors in summary when present", () => {
    const results = [
      sampleResult({
        status: "invalid",
        errors: [{ line: 1, column: 1, category: "x", message: "bad" }],
        processingTime: 5,
      }),
      sampleResult({
        status: "valid",
        warnings: [{ line: 2, column: 2, category: "warn", message: "hmm" }],
        processingTime: 5,
      }),
    ];
    const summary = formatSummary(results);
    expect(summary).toContain("warnings");
    expect(summary).toContain("errors");
  });

  it("formats time units correctly", () => {
    expect(formatTime(50)).toBe(chalk.dim("50ms"));
    expect(formatTime(1500)).toBe(chalk.dim("1.50s"));
    expect(formatTime(61000)).toBe(chalk.dim("1m 1s"));
  });

  it("produces summary with counts and total time", () => {
    const results = [
      sampleResult({ status: "valid", processingTime: 10 }),
      sampleResult({
        status: "invalid",
        errors: [{ line: 1, column: 1, category: "syntax", message: "err" }],
        processingTime: 20,
      }),
    ];

    const summary = formatSummary(results);
    expect(summary).toContain("valid");
    expect(summary).toContain("invalid");
    expect(summary).toContain("Processed in");
  });

  it("renders validation table rows with status colors", () => {
    const results = [
      sampleResult({
        status: "invalid",
        errors: [{ line: 1, column: 1, category: "syntax", message: "err" }],
        warnings: [{ line: 2, column: 1, category: "warn", message: "warn" }],
      }),
    ];
    const table = formatValidationTable(results);
    expect(table).toContain("file.cue");
    expect(table).toContain("✗ invalid");
    expect(table).toContain("1");
  });

  it("renders detailed error and warning blocks when present", () => {
    const results = [
      sampleResult({
        file: "bad.cue",
        status: "invalid",
        errors: [{ line: 3, column: 1, category: "syntax", message: "unexpected" }],
        warnings: [{ line: 4, column: 2, category: "style", message: "nit" }],
      }),
    ];

    const errorDetails = formatErrorDetails(results);
    const warningDetails = formatWarningDetails(results);

    expect(errorDetails).toContain("bad.cue");
    expect(errorDetails).toContain("unexpected");
    expect(warningDetails).toContain("Validation Warnings");
    expect(warningDetails).toContain("style");
  });

  it("omits error/warning details when none present", () => {
    const detailsErr = formatErrorDetails([]);
    const detailsWarn = formatWarningDetails([]);
    expect(detailsErr).toBe("");
    expect(detailsWarn).toBe("");
  });

  it("adds simple colors to JSON output when requested", () => {
    const json = formatJson({ ok: true, n: 5, text: "hi" }, true);
    expect(json).toContain(chalk.green('"hi"'));
    expect(json).toContain(chalk.magenta("5"));
  });

  it("returns plain JSON/YAML when color is disabled", () => {
    const json = formatJson({ ok: true }, false);
    const yamlOut = formatYaml({ ok: true }, false);
    expect(json).toBe(JSON.stringify({ ok: true }, null, 2));
    expect(yamlOut).toContain("ok: true");
    expect(yamlOut).not.toContain("\u001b");
  });

  it("highlights YAML keys when color is enabled", () => {
    const yamlOut = formatYaml({ key: "val", num: 3 }, true);
    expect(yamlOut).toContain(chalk.blue("key"));
    expect(yamlOut).toContain(chalk.magenta("3"));
  });

  it("formats file sizes with units", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1024)).toContain("KB");
  });

  it("creates colored progress bar text representation", () => {
    const bar = createTextProgressBar(2, 4, 10);
    expect(bar).toContain("50%");
    expect(bar).toContain("2/4");
  });

  it("formats component and status tables with health information", () => {
    const components = [
      { name: "api", type: "service", status: "active", description: "good" },
      { name: "ui", type: "client", status: "inactive", description: "off" },
    ];
    const componentTable = formatComponentTable(components);
    expect(componentTable).toContain("api");
    expect(componentTable).toContain("ui");

    const statusTable = formatStatusTable({
      health: "healthy",
      healthDetails: "all good",
      components,
      validation: { status: "invalid", summary: "broken" },
    });
    expect(statusTable).toContain("Health");
    expect(statusTable).toContain("Validation");
  });

  it("returns dimmed component table when no components present", () => {
    expect(formatComponentTable([])).toBe(chalk.dim("No components found"));
  });

  it("formats exit messages for common codes", () => {
    expect(formatExitMessage(0, "deploy")).toContain("completed successfully");
    expect(formatExitMessage(1, "deploy")).toContain("validation errors");
    expect(formatExitMessage(2, "deploy")).toContain("system errors");
  });

  it("formats exit messages for unknown codes", () => {
    const msg = formatExitMessage(99, "deploy");
    expect(msg).toContain("unknown error");
  });
});
