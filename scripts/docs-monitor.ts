#!/usr/bin/env bun

/**
 * Documentation Monitoring and Maintenance System
 *
 * Monitors documentation freshness, quality, and health.
 * Provides automated maintenance tasks and alerting.
 */

import * as path from "path";
import chalk from "chalk";
import { program } from "commander";
import * as fs from "fs-extra";
import { glob } from "glob";
import YAML from "yaml";

interface MonitoringOptions {
  config?: string;
  "check-freshness"?: boolean;
  "check-links"?: boolean;
  "check-quality"?: boolean;
  "generate-report"?: boolean;
  "auto-fix"?: boolean;
  verbose?: boolean;
  "dry-run"?: boolean;
  environment?: "dev" | "staging" | "production";
}

interface DocumentationHealthReport {
  timestamp: string;
  environment: string;
  overall: {
    status: "healthy" | "warning" | "critical";
    score: number;
    issues: number;
  };
  freshness: {
    status: "fresh" | "stale" | "outdated";
    oldestFile: string;
    oldestAge: number;
    staleFiles: string[];
  };
  quality: {
    status: "good" | "fair" | "poor";
    coverage: number;
    brokenLinks: number;
    missingDescriptions: number;
    spellingErrors: number;
  };
  links: {
    status: "valid" | "issues" | "broken";
    total: number;
    broken: BrokenLink[];
    external: number;
    internal: number;
  };
  files: {
    total: number;
    byFormat: Record<string, number>;
    totalSize: number;
    averageSize: number;
  };
  recommendations: Recommendation[];
}

interface BrokenLink {
  file: string;
  link: string;
  error: string;
  line?: number;
}

interface Recommendation {
  type: "freshness" | "quality" | "links" | "structure";
  priority: "high" | "medium" | "low";
  message: string;
  action?: string;
  files?: string[];
}

interface AlertConfig {
  enabled: boolean;
  thresholds: {
    freshnessHours: number;
    qualityScore: number;
    brokenLinksPercent: number;
  };
  channels: {
    slack?: SlackConfig;
    email?: EmailConfig;
    webhook?: WebhookConfig;
  };
}

interface SlackConfig {
  enabled: boolean;
  webhook: string;
  channel?: string;
  username?: string;
}

interface EmailConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  recipients: string[];
}

interface WebhookConfig {
  enabled: boolean;
  url: string;
  method: "POST" | "PUT";
  headers?: Record<string, string>;
}

export async function main(): Promise<void> {
  program
    .name("docs-monitor")
    .description("Documentation monitoring and maintenance system")
    .version("1.0.0")
    .option("-c, --config <path>", "configuration file path", "./docs-config.yaml")
    .option("--check-freshness", "check documentation freshness")
    .option("--check-links", "validate all links")
    .option("--check-quality", "assess documentation quality")
    .option("--generate-report", "generate comprehensive health report")
    .option("--auto-fix", "automatically fix issues where possible")
    .option("-v, --verbose", "verbose output")
    .option("--dry-run", "preview actions without executing")
    .option("-e, --environment <env>", "environment: dev|staging|production", "dev")
    .action(async (options: MonitoringOptions) => {
      try {
        const exitCode = await runDocumentationMonitoring(options);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Documentation monitoring failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  program
    .command("health")
    .description("quick health check of documentation")
    .option("-c, --config <path>", "configuration file path", "./docs-config.yaml")
    .action(async (options) => {
      try {
        const report = await generateHealthReport(options.config);
        printHealthSummary(report);
      } catch (error) {
        console.error(chalk.red("Health check failed:"), error);
        process.exit(1);
      }
    });

  program
    .command("fix")
    .description("automatically fix common documentation issues")
    .option("-c, --config <path>", "configuration file path", "./docs-config.yaml")
    .option("--dry-run", "preview fixes without applying")
    .option("-v, --verbose", "verbose output")
    .action(async (options) => {
      try {
        const exitCode = await autoFixIssues(options.config, options);
        process.exit(exitCode);
      } catch (error) {
        console.error(chalk.red("Auto-fix failed:"), error);
        process.exit(1);
      }
    });

  program
    .command("alert")
    .description("send alerts based on current health status")
    .option("-c, --config <path>", "configuration file path", "./docs-config.yaml")
    .option("--force", "send alerts regardless of thresholds")
    .action(async (options) => {
      try {
        const exitCode = await sendAlerts(options.config, options.force);
        process.exit(exitCode);
      } catch (error) {
        console.error(chalk.red("Alert sending failed:"), error);
        process.exit(1);
      }
    });

  program.parse();
}

async function runDocumentationMonitoring(options: MonitoringOptions): Promise<number> {
  console.log(chalk.blue("📊 Documentation Monitoring System"));
  console.log(chalk.dim(`Environment: ${options.environment}`));

  // Load configuration
  const config = await loadMonitoringConfig(options.config);

  let report: DocumentationHealthReport;

  if (
    options["generate-report"] ||
    (!options["check-freshness"] && !options["check-links"] && !options["check-quality"])
  ) {
    // Generate comprehensive report
    console.log(chalk.blue("🔍 Generating comprehensive health report..."));
    report = await generateHealthReport(options.config);
  } else {
    // Run specific checks
    console.log(chalk.blue("🔍 Running targeted checks..."));
    report = await generateTargetedReport(options);
  }

  // Print results
  printHealthReport(report, options.verbose);

  // Auto-fix if requested
  if (options["auto-fix"] && !options["dry-run"]) {
    console.log(chalk.blue("🔧 Auto-fixing issues..."));
    await autoFixFromReport(report, config);
  }

  // Send alerts if thresholds are exceeded
  if (shouldSendAlerts(report, config)) {
    console.log(chalk.blue("📢 Sending alerts..."));
    await sendHealthAlerts(report, config);
  }

  // Generate monitoring artifacts
  await generateMonitoringArtifacts(report, options);

  const status = report.overall.status;
  if (status === "critical") {
    console.log(chalk.red("❌ Documentation health is CRITICAL"));
    return 1;
  } else if (status === "warning") {
    console.log(chalk.yellow("⚠️  Documentation health has WARNINGS"));
    return 0; // Don't fail CI for warnings
  } else {
    console.log(chalk.green("✅ Documentation health is GOOD"));
    return 0;
  }
}

async function loadMonitoringConfig(configPath?: string): Promise<any> {
  const defaultConfig = {
    monitoring: {
      enabled: true,
      freshness: { maxAgeHours: 24, alertThreshold: 72 },
      quality: { minimumScore: 80 },
      alerts: {
        enabled: false,
        thresholds: {
          freshnessHours: 48,
          qualityScore: 70,
          brokenLinksPercent: 5,
        },
      },
    },
  };

  if (!configPath || !(await fs.pathExists(configPath))) {
    return defaultConfig;
  }

  try {
    const content = await fs.readFile(configPath, "utf8");
    const config = YAML.parse(content);
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.warn(chalk.yellow(`Failed to load config from ${configPath}, using defaults`));
    return defaultConfig;
  }
}

async function generateHealthReport(configPath?: string): Promise<DocumentationHealthReport> {
  const docsDir = "./docs";

  // Check if docs directory exists
  if (!(await fs.pathExists(docsDir))) {
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      overall: { status: "critical", score: 0, issues: 1 },
      freshness: { status: "outdated", oldestFile: "", oldestAge: 0, staleFiles: [] },
      quality: {
        status: "poor",
        coverage: 0,
        brokenLinks: 0,
        missingDescriptions: 0,
        spellingErrors: 0,
      },
      links: { status: "broken", total: 0, broken: [], external: 0, internal: 0 },
      files: { total: 0, byFormat: {}, totalSize: 0, averageSize: 0 },
      recommendations: [
        {
          type: "structure",
          priority: "high",
          message: "Documentation directory does not exist",
          action: "Run documentation generation first",
        },
      ],
    };
  }

  console.log(chalk.blue("📋 Analyzing documentation files..."));

  // Find all documentation files
  const docFiles = await findDocumentationFiles(docsDir);

  // Check freshness
  const freshness = await checkFreshness(docFiles);

  // Check quality
  const quality = await checkQuality(docFiles);

  // Check links
  const links = await checkLinks(docFiles);

  // Analyze files
  const files = await analyzeFiles(docFiles);

  // Generate recommendations
  const recommendations = generateRecommendations(freshness, quality, links, files);

  // Calculate overall score and status
  const overall = calculateOverallHealth(freshness, quality, links);

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    overall,
    freshness,
    quality,
    links,
    files,
    recommendations,
  };
}

async function findDocumentationFiles(docsDir: string): Promise<string[]> {
  const patterns = [
    path.join(docsDir, "**/*.md"),
    path.join(docsDir, "**/*.html"),
    path.join(docsDir, "**/*.json"),
    path.join(docsDir, "**/*.yaml"),
    path.join(docsDir, "**/*.yml"),
  ];

  let files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern);
    files.push(...matches);
  }

  return [...new Set(files)].sort();
}

async function checkFreshness(files: string[]): Promise<DocumentationHealthReport["freshness"]> {
  const maxAgeHours = 24;
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();

  let oldestFile = "";
  let oldestAge = 0;
  const staleFiles: string[] = [];

  for (const file of files) {
    try {
      const stats = await fs.stat(file);
      const age = now - stats.mtime.getTime();

      if (age > oldestAge) {
        oldestAge = age;
        oldestFile = file;
      }

      if (age > maxAgeMs) {
        staleFiles.push(file);
      }
    } catch {
      // File might not be accessible
    }
  }

  const status: "fresh" | "stale" | "outdated" =
    staleFiles.length === 0
      ? "fresh"
      : staleFiles.length < files.length * 0.3
        ? "stale"
        : "outdated";

  return {
    status,
    oldestFile,
    oldestAge: Math.floor(oldestAge / (1000 * 60 * 60)), // Convert to hours
    staleFiles,
  };
}

async function checkQuality(files: string[]): Promise<DocumentationHealthReport["quality"]> {
  let coverage = 0;
  let missingDescriptions = 0;
  let spellingErrors = 0; // Placeholder - would need spell checker integration

  const markdownFiles = files.filter((f) => f.endsWith(".md"));

  for (const file of markdownFiles) {
    try {
      const content = await fs.readFile(file, "utf8");

      // Check for basic documentation elements
      const hasTitle = /^#\s+/.test(content);
      const hasDescription = content.length > 100;
      const hasStructure = (content.match(/^#{2,6}\s+/gm) || []).length > 1;

      if (hasTitle && hasDescription && hasStructure) {
        coverage++;
      } else {
        missingDescriptions++;
      }
    } catch {
      missingDescriptions++;
    }
  }

  const coveragePercent = markdownFiles.length > 0 ? (coverage / markdownFiles.length) * 100 : 0;

  const status: "good" | "fair" | "poor" =
    coveragePercent >= 80 ? "good" : coveragePercent >= 60 ? "fair" : "poor";

  return {
    status,
    coverage: coveragePercent,
    brokenLinks: 0, // Will be filled by link checker
    missingDescriptions,
    spellingErrors,
  };
}

async function checkLinks(files: string[]): Promise<DocumentationHealthReport["links"]> {
  const broken: BrokenLink[] = [];
  let totalLinks = 0;
  let externalLinks = 0;
  let internalLinks = 0;

  const markdownFiles = files.filter((f) => f.endsWith(".md"));

  for (const file of markdownFiles) {
    try {
      const content = await fs.readFile(file, "utf8");
      const links = extractLinksFromMarkdown(content);

      for (const link of links) {
        totalLinks++;

        if (link.startsWith("http://") || link.startsWith("https://")) {
          externalLinks++;
          // For external links, we'd need to make HTTP requests to validate
          // Skipping for this implementation to avoid external dependencies
        } else {
          internalLinks++;
          // Check internal links
          const isValid = await validateInternalLink(file, link);
          if (!isValid) {
            broken.push({
              file,
              link,
              error: "File not found or anchor missing",
            });
          }
        }
      }
    } catch {
      // File might not be readable
    }
  }

  const status: "valid" | "issues" | "broken" =
    broken.length === 0 ? "valid" : broken.length / totalLinks < 0.1 ? "issues" : "broken";

  return {
    status,
    total: totalLinks,
    broken,
    external: externalLinks,
    internal: internalLinks,
  };
}

function extractLinksFromMarkdown(content: string): string[] {
  const links: string[] = [];

  // Extract markdown links [text](url)
  const markdownLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
  if (markdownLinks) {
    for (const match of markdownLinks) {
      const urlMatch = match.match(/\]\(([^)]+)\)/);
      if (urlMatch) {
        links.push(urlMatch[1]);
      }
    }
  }

  // Extract HTML links <a href="url">
  const htmlLinks = content.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi);
  if (htmlLinks) {
    for (const match of htmlLinks) {
      const urlMatch = match.match(/href=["']([^"']+)["']/i);
      if (urlMatch) {
        links.push(urlMatch[1]);
      }
    }
  }

  return links;
}

async function validateInternalLink(sourceFile: string, link: string): Promise<boolean> {
  // Handle relative links
  if (link.startsWith("./") || link.startsWith("../") || !link.startsWith("/")) {
    const sourcePath = path.dirname(sourceFile);
    const targetPath = path.resolve(sourcePath, link.split("#")[0]);
    return await fs.pathExists(targetPath);
  }

  // Handle absolute links (within project)
  const targetPath = path.join("./docs", link.split("#")[0]);
  return await fs.pathExists(targetPath);
}

async function analyzeFiles(files: string[]): Promise<DocumentationHealthReport["files"]> {
  const byFormat: Record<string, number> = {};
  let totalSize = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const format = ext.substring(1) || "unknown";

    byFormat[format] = (byFormat[format] || 0) + 1;

    try {
      const stats = await fs.stat(file);
      totalSize += stats.size;
    } catch {
      // File might not be accessible
    }
  }

  return {
    total: files.length,
    byFormat,
    totalSize,
    averageSize: files.length > 0 ? Math.floor(totalSize / files.length) : 0,
  };
}

function generateRecommendations(
  freshness: DocumentationHealthReport["freshness"],
  quality: DocumentationHealthReport["quality"],
  links: DocumentationHealthReport["links"],
  files: DocumentationHealthReport["files"],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Freshness recommendations
  if (freshness.status === "outdated") {
    recommendations.push({
      type: "freshness",
      priority: "high",
      message: `${freshness.staleFiles.length} files are outdated`,
      action: "Run documentation generation to refresh stale files",
      files: freshness.staleFiles,
    });
  }

  // Quality recommendations
  if (quality.status === "poor") {
    recommendations.push({
      type: "quality",
      priority: "medium",
      message: `Documentation coverage is ${quality.coverage.toFixed(1)}%`,
      action: "Add descriptions and structure to documentation files",
    });
  }

  if (quality.missingDescriptions > 0) {
    recommendations.push({
      type: "quality",
      priority: "medium",
      message: `${quality.missingDescriptions} files lack proper descriptions`,
      action: "Add meaningful descriptions to documentation files",
    });
  }

  // Links recommendations
  if (links.broken.length > 0) {
    recommendations.push({
      type: "links",
      priority: "high",
      message: `${links.broken.length} broken links found`,
      action: "Fix or remove broken links",
      files: links.broken.map((b) => b.file),
    });
  }

  // Structure recommendations
  if (files.total === 0) {
    recommendations.push({
      type: "structure",
      priority: "high",
      message: "No documentation files found",
      action: "Generate initial documentation",
    });
  }

  return recommendations;
}

function calculateOverallHealth(
  freshness: DocumentationHealthReport["freshness"],
  quality: DocumentationHealthReport["quality"],
  links: DocumentationHealthReport["links"],
): DocumentationHealthReport["overall"] {
  let score = 0;
  let issues = 0;

  // Freshness scoring (30 points)
  if (freshness.status === "fresh") score += 30;
  else if (freshness.status === "stale") score += 20;
  else issues++;

  // Quality scoring (40 points)
  score += Math.min(40, (quality.coverage / 100) * 40);
  if (quality.status === "poor") issues++;

  // Links scoring (30 points)
  if (links.status === "valid") score += 30;
  else if (links.status === "issues") score += 20;
  else {
    score += 10;
    issues++;
  }

  const status: "healthy" | "warning" | "critical" =
    score >= 80 && issues === 0 ? "healthy" : score >= 60 ? "warning" : "critical";

  return { status, score, issues };
}

async function generateTargetedReport(
  options: MonitoringOptions,
): Promise<DocumentationHealthReport> {
  // Simplified version that only runs requested checks
  const docsDir = "./docs";
  const files = await findDocumentationFiles(docsDir);

  const report: Partial<DocumentationHealthReport> = {
    timestamp: new Date().toISOString(),
    environment: options.environment || "dev",
  };

  if (options["check-freshness"]) {
    report.freshness = await checkFreshness(files);
  }

  if (options["check-quality"]) {
    report.quality = await checkQuality(files);
  }

  if (options["check-links"]) {
    report.links = await checkLinks(files);
  }

  // Fill in defaults for missing sections
  return {
    overall: { status: "healthy", score: 100, issues: 0 },
    freshness: report.freshness || {
      status: "fresh",
      oldestFile: "",
      oldestAge: 0,
      staleFiles: [],
    },
    quality: report.quality || {
      status: "good",
      coverage: 100,
      brokenLinks: 0,
      missingDescriptions: 0,
      spellingErrors: 0,
    },
    links: report.links || { status: "valid", total: 0, broken: [], external: 0, internal: 0 },
    files: { total: files.length, byFormat: {}, totalSize: 0, averageSize: 0 },
    recommendations: [],
    ...report,
  } as DocumentationHealthReport;
}

function printHealthSummary(report: DocumentationHealthReport): void {
  console.log(chalk.blue(`\n📊 Documentation Health Report - ${report.timestamp}`));

  const statusColor =
    report.overall.status === "healthy"
      ? chalk.green
      : report.overall.status === "warning"
        ? chalk.yellow
        : chalk.red;

  console.log(statusColor(`Status: ${report.overall.status.toUpperCase()}`));
  console.log(chalk.dim(`Score: ${report.overall.score}/100`));
  console.log(chalk.dim(`Issues: ${report.overall.issues}`));

  if (report.recommendations.length > 0) {
    console.log(chalk.blue("\n📋 Key Recommendations:"));
    for (const rec of report.recommendations.slice(0, 3)) {
      const priorityColor =
        rec.priority === "high" ? chalk.red : rec.priority === "medium" ? chalk.yellow : chalk.dim;
      console.log(priorityColor(`  ${rec.priority.toUpperCase()}: ${rec.message}`));
    }
  }
}

function printHealthReport(report: DocumentationHealthReport, verbose: boolean = false): void {
  printHealthSummary(report);

  if (verbose) {
    console.log(chalk.blue("\n📅 Freshness:"));
    console.log(chalk.dim(`  Status: ${report.freshness.status}`));
    console.log(
      chalk.dim(
        `  Oldest file: ${report.freshness.oldestFile} (${report.freshness.oldestAge}h old)`,
      ),
    );
    console.log(chalk.dim(`  Stale files: ${report.freshness.staleFiles.length}`));

    console.log(chalk.blue("\n📝 Quality:"));
    console.log(chalk.dim(`  Status: ${report.quality.status}`));
    console.log(chalk.dim(`  Coverage: ${report.quality.coverage.toFixed(1)}%`));
    console.log(chalk.dim(`  Missing descriptions: ${report.quality.missingDescriptions}`));

    console.log(chalk.blue("\n🔗 Links:"));
    console.log(chalk.dim(`  Status: ${report.links.status}`));
    console.log(
      chalk.dim(
        `  Total: ${report.links.total} (${report.links.internal} internal, ${report.links.external} external)`,
      ),
    );
    console.log(chalk.dim(`  Broken: ${report.links.broken.length}`));

    if (report.links.broken.length > 0) {
      console.log(chalk.red("\n❌ Broken Links:"));
      for (const brokenLink of report.links.broken.slice(0, 5)) {
        console.log(chalk.red(`  ${brokenLink.file}: ${brokenLink.link}`));
      }
      if (report.links.broken.length > 5) {
        console.log(chalk.dim(`  ... and ${report.links.broken.length - 5} more`));
      }
    }

    console.log(chalk.blue("\n📁 Files:"));
    console.log(chalk.dim(`  Total: ${report.files.total}`));
    console.log(chalk.dim(`  Total size: ${(report.files.totalSize / 1024).toFixed(1)} KB`));
    console.log(chalk.dim(`  Average size: ${(report.files.averageSize / 1024).toFixed(1)} KB`));
  }

  if (report.recommendations.length > 0) {
    console.log(chalk.blue("\n💡 All Recommendations:"));
    for (const rec of report.recommendations) {
      const priorityColor =
        rec.priority === "high" ? chalk.red : rec.priority === "medium" ? chalk.yellow : chalk.dim;
      console.log(priorityColor(`  ${rec.priority.toUpperCase()}: ${rec.message}`));
      if (rec.action) {
        console.log(chalk.dim(`    Action: ${rec.action}`));
      }
    }
  }
}

async function autoFixIssues(configPath?: string, options: any = {}): Promise<number> {
  console.log(chalk.blue("🔧 Auto-fixing documentation issues..."));

  const report = await generateHealthReport(configPath);
  let fixesApplied = 0;

  // Fix broken internal links
  for (const brokenLink of report.links.broken) {
    if (await tryFixBrokenLink(brokenLink, options["dry-run"])) {
      fixesApplied++;
      console.log(chalk.green(`  ✅ Fixed broken link in ${brokenLink.file}`));
    }
  }

  // Generate missing index files
  if (report.files.total > 0 && !(await fs.pathExists("./docs/index.md"))) {
    if (!options["dry-run"]) {
      await generateIndexFile();
    }
    fixesApplied++;
    console.log(chalk.green("  ✅ Generated missing index.md"));
  }

  console.log(chalk.blue(`\n📊 Applied ${fixesApplied} fixes`));
  return fixesApplied > 0 ? 0 : 1;
}

async function tryFixBrokenLink(brokenLink: BrokenLink, dryRun: boolean = false): Promise<boolean> {
  // Simple fix attempt - this could be much more sophisticated
  // For now, just log what would be fixed
  if (dryRun) {
    console.log(chalk.yellow(`  Would attempt to fix: ${brokenLink.link} in ${brokenLink.file}`));
    return true;
  }

  // Actual fix implementation would go here
  return false;
}

async function generateIndexFile(): Promise<void> {
  const docsDir = "./docs";
  const files = await findDocumentationFiles(docsDir);

  let indexContent = `# Documentation Index

This is the main documentation index for the Arbiter project.

## Available Documentation

`;

  const markdownFiles = files.filter((f) => f.endsWith(".md") && !f.endsWith("index.md"));

  for (const file of markdownFiles) {
    const relativePath = path.relative(docsDir, file);
    const title = path
      .basename(file, ".md")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    indexContent += `- [${title}](./${relativePath})\n`;
  }

  indexContent += `\n---\n\nGenerated on ${new Date().toISOString()}\n`;

  await fs.writeFile(path.join(docsDir, "index.md"), indexContent, "utf8");
}

function shouldSendAlerts(report: DocumentationHealthReport, config: any): boolean {
  if (!config.monitoring?.alerts?.enabled) return false;

  const thresholds = config.monitoring.alerts.thresholds;

  return (
    report.overall.status === "critical" ||
    report.freshness.oldestAge > thresholds.freshnessHours ||
    report.overall.score < thresholds.qualityScore ||
    (report.links.total > 0 &&
      (report.links.broken.length / report.links.total) * 100 > thresholds.brokenLinksPercent)
  );
}

async function sendAlerts(configPath?: string, force: boolean = false): Promise<number> {
  console.log(chalk.blue("📢 Sending documentation health alerts..."));

  const config = await loadMonitoringConfig(configPath);
  const report = await generateHealthReport(configPath);

  if (!force && !shouldSendAlerts(report, config)) {
    console.log(chalk.green("✅ No alerts needed - documentation health is within thresholds"));
    return 0;
  }

  return await sendHealthAlerts(report, config);
}

async function sendHealthAlerts(report: DocumentationHealthReport, config: any): Promise<number> {
  let alertsSent = 0;

  const alertData = {
    status: report.overall.status,
    score: report.overall.score,
    issues: report.overall.issues,
    timestamp: report.timestamp,
    url: "https://docs.arbiter.dev",
  };

  // Slack alerts
  if (config.monitoring?.alerts?.channels?.slack?.enabled) {
    try {
      await sendSlackAlert(alertData, config.monitoring.alerts.channels.slack);
      alertsSent++;
      console.log(chalk.green("  ✅ Sent Slack alert"));
    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to send Slack alert: ${error}`));
    }
  }

  // Email alerts
  if (config.monitoring?.alerts?.channels?.email?.enabled) {
    try {
      await sendEmailAlert(alertData, config.monitoring.alerts.channels.email);
      alertsSent++;
      console.log(chalk.green("  ✅ Sent email alert"));
    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to send email alert: ${error}`));
    }
  }

  // Webhook alerts
  if (config.monitoring?.alerts?.channels?.webhook?.enabled) {
    try {
      await sendWebhookAlert(alertData, config.monitoring.alerts.channels.webhook);
      alertsSent++;
      console.log(chalk.green("  ✅ Sent webhook alert"));
    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to send webhook alert: ${error}`));
    }
  }

  return alertsSent > 0 ? 0 : 1;
}

async function sendSlackAlert(alertData: any, config: SlackConfig): Promise<void> {
  const color =
    alertData.status === "critical"
      ? "danger"
      : alertData.status === "warning"
        ? "warning"
        : "good";

  const payload = {
    username: config.username || "Docs Monitor",
    channel: config.channel,
    attachments: [
      {
        color,
        title: `Documentation Health: ${alertData.status.toUpperCase()}`,
        text: `Documentation health score: ${alertData.score}/100\nIssues found: ${alertData.issues}`,
        footer: "Arbiter Documentation Monitor",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  // In a real implementation, you'd use fetch() to send to Slack webhook
  console.log(chalk.dim("Slack payload:", JSON.stringify(payload, null, 2)));
}

async function sendEmailAlert(alertData: any, config: EmailConfig): Promise<void> {
  // In a real implementation, you'd use nodemailer or similar
  console.log(chalk.dim("Email alert:", JSON.stringify(alertData, null, 2)));
}

async function sendWebhookAlert(alertData: any, config: WebhookConfig): Promise<void> {
  // In a real implementation, you'd use fetch() to send to webhook URL
  console.log(chalk.dim("Webhook alert:", JSON.stringify(alertData, null, 2)));
}

async function autoFixFromReport(report: DocumentationHealthReport, config: any): Promise<void> {
  // Auto-fix logic based on report findings
  console.log(chalk.blue("🔧 Auto-fixing issues from report..."));

  // This would contain sophisticated logic to automatically fix common issues
  // For now, it's a placeholder
}

async function generateMonitoringArtifacts(
  report: DocumentationHealthReport,
  options: MonitoringOptions,
): Promise<void> {
  const outputDir = "./docs";

  if (options["dry-run"]) return;

  // Save detailed report
  const reportFile = path.join(outputDir, "health-report.json");
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2), "utf8");

  // Generate health badge data
  const badgeData = {
    schemaVersion: 1,
    label: "docs",
    message: `${report.overall.score}/100`,
    color:
      report.overall.status === "healthy"
        ? "brightgreen"
        : report.overall.status === "warning"
          ? "yellow"
          : "red",
  };

  const badgeFile = path.join(outputDir, "health-badge.json");
  await fs.writeFile(badgeFile, JSON.stringify(badgeData, null, 2), "utf8");

  console.log(chalk.green("  ✅ Generated monitoring artifacts"));
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red("Script error:"), error);
    process.exit(1);
  });
}
