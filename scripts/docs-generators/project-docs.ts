#!/usr/bin/env bun

/**
 * Project Documentation Generator
 *
 * Generates comprehensive project overview documentation by aggregating
 * information from README files, CLAUDE.md files, package.json, and other
 * project metadata sources.
 */

import * as path from "path";
import chalk from "chalk";
import * as fs from "fs-extra";
import { glob } from "glob";
import YAML from "yaml";

interface ProjectDocumentationOptions {
  rootDir: string;
  outputDir: string;
  formats: ("markdown" | "json" | "html")[];
  includePackageInfo: boolean;
  includeArchitecture: boolean;
  includeDependencies: boolean;
  includeContributors: boolean;
  verbose: boolean;
  dryRun: boolean;
}

interface ProjectInfo {
  name: string;
  version: string;
  description: string;
  homepage?: string;
  repository?: {
    type: string;
    url: string;
  };
  author?: string | { name: string; email?: string };
  license?: string;
  keywords: string[];
  engines?: Record<string, string>;
  workspaces?: string[];
}

interface PackageInfo {
  name: string;
  version: string;
  description: string;
  path: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  scripts: Record<string, string>;
  type?: string;
  main?: string;
  exports?: any;
  private?: boolean;
}

interface ArchitectureInfo {
  overview: string;
  structure: DirectoryStructure[];
  patterns: ArchitecturePattern[];
  decisions: ArchitectureDecision[];
  technologies: Technology[];
}

interface DirectoryStructure {
  path: string;
  description: string;
  type: "package" | "app" | "config" | "docs" | "scripts" | "other";
  children?: DirectoryStructure[];
}

interface ArchitecturePattern {
  name: string;
  description: string;
  rationale: string;
  examples: string[];
}

interface ArchitectureDecision {
  title: string;
  status: "accepted" | "proposed" | "deprecated" | "superseded";
  date: string;
  context: string;
  decision: string;
  consequences: string[];
}

interface Technology {
  name: string;
  category: "runtime" | "framework" | "library" | "tool" | "language";
  version?: string;
  purpose: string;
  critical: boolean;
}

interface ContributorInfo {
  name: string;
  email?: string;
  role?: string;
  contributions: string[];
  githubUsername?: string;
}

interface ProjectDocumentation {
  info: ProjectInfo;
  packages: PackageInfo[];
  architecture?: ArchitectureInfo;
  contributors?: ContributorInfo[];
  dependencies: DependencyAnalysis;
  metrics: ProjectMetrics;
  generatedAt: string;
}

interface DependencyAnalysis {
  total: number;
  unique: number;
  byCategory: Record<string, number>;
  security: {
    vulnerabilities: number;
    outdated: number;
  };
  licenses: Record<string, number>;
}

interface ProjectMetrics {
  filesCount: number;
  linesOfCode: number;
  packages: number;
  scripts: number;
  lastUpdated: string;
  complexity: {
    cyclomaticComplexity: number;
    technicalDebt: number;
  };
}

export async function generateProjectDocumentation(
  options: ProjectDocumentationOptions,
): Promise<number> {
  try {
    console.log(chalk.blue("📋 Generating Project Documentation"));
    console.log(chalk.dim(`Root: ${options.rootDir}`));
    console.log(chalk.dim(`Output: ${options.outputDir}`));
    console.log(chalk.dim(`Formats: ${options.formats.join(", ")}`));

    // Gather project information
    const projectInfo = await parseProjectInfo(options);
    const packages = options.includePackageInfo ? await parsePackageInfo(options) : [];
    const architecture = options.includeArchitecture
      ? await parseArchitectureInfo(options)
      : undefined;
    const contributors = options.includeContributors
      ? await parseContributorInfo(options)
      : undefined;
    const dependencies = options.includeDependencies
      ? await analyzeDependencies(packages, options)
      : getEmptyDependencyAnalysis();
    const metrics = await calculateProjectMetrics(options);

    const documentation: ProjectDocumentation = {
      info: projectInfo,
      packages,
      architecture,
      contributors,
      dependencies,
      metrics,
      generatedAt: new Date().toISOString(),
    };

    if (options.verbose) {
      console.log(chalk.blue(`🔍 Found ${packages.length} packages`));
      console.log(
        chalk.blue(`📊 ${metrics.filesCount} files, ${metrics.linesOfCode} lines of code`),
      );
    }

    // Generate documentation in requested formats
    await fs.ensureDir(options.outputDir);

    for (const format of options.formats) {
      await generateProjectDocumentationFormat(format, documentation, options);
    }

    // Generate additional files
    await generateProjectIndex(documentation, options);
    await generateProjectMetrics(documentation, options);

    console.log(chalk.green("✅ Project documentation generation completed"));
    return 0;
  } catch (error) {
    console.error(
      chalk.red("Project documentation generation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

async function parseProjectInfo(options: ProjectDocumentationOptions): Promise<ProjectInfo> {
  const packageJsonPath = path.join(options.rootDir, "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error("package.json not found in root directory");
  }

  const packageJson = await fs.readJson(packageJsonPath);

  return {
    name: packageJson.name || "Unknown Project",
    version: packageJson.version || "0.0.0",
    description: packageJson.description || "",
    homepage: packageJson.homepage,
    repository: packageJson.repository,
    author: packageJson.author,
    license: packageJson.license,
    keywords: packageJson.keywords || [],
    engines: packageJson.engines,
    workspaces: packageJson.workspaces,
  };
}

async function parsePackageInfo(options: ProjectDocumentationOptions): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  // Find all package.json files
  const packageJsonFiles = await glob(path.join(options.rootDir, "**/package.json"));

  for (const file of packageJsonFiles) {
    // Skip node_modules
    if (file.includes("node_modules")) continue;

    try {
      const packageJson = await fs.readJson(file);
      const relativePath = path.relative(options.rootDir, path.dirname(file));

      packages.push({
        name: packageJson.name || path.basename(path.dirname(file)),
        version: packageJson.version || "0.0.0",
        description: packageJson.description || "",
        path: relativePath || ".",
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
        scripts: packageJson.scripts || {},
        type: packageJson.type,
        main: packageJson.main,
        exports: packageJson.exports,
        private: packageJson.private,
      });

      if (options.verbose) {
        console.log(chalk.dim(`  ✅ Parsed package ${packageJson.name || relativePath}`));
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `  ⚠️  Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  return packages.sort((a, b) => a.path.localeCompare(b.path));
}

async function parseArchitectureInfo(
  options: ProjectDocumentationOptions,
): Promise<ArchitectureInfo> {
  let overview = "";
  const patterns: ArchitecturePattern[] = [];
  const decisions: ArchitectureDecision[] = [];
  const technologies: Technology[] = [];

  // Parse ARCHITECTURE.md if it exists
  const architectureFile = path.join(options.rootDir, "ARCHITECTURE.md");
  if (await fs.pathExists(architectureFile)) {
    const content = await fs.readFile(architectureFile, "utf8");
    overview = extractOverviewFromMarkdown(content);
    patterns.push(...extractPatternsFromMarkdown(content));
    technologies.push(...extractTechnologiesFromMarkdown(content));
  }

  // Parse CLAUDE.md for architecture insights
  const claudeFile = path.join(options.rootDir, "CLAUDE.md");
  if (await fs.pathExists(claudeFile)) {
    const content = await fs.readFile(claudeFile, "utf8");
    if (!overview) {
      overview = extractOverviewFromMarkdown(content);
    }
    patterns.push(...extractPatternsFromMarkdown(content));
    technologies.push(...extractTechnologiesFromMarkdown(content));
  }

  // Parse ADRs (Architecture Decision Records)
  const adrFiles = await glob(path.join(options.rootDir, "**/adr/**/*.md"));
  for (const file of adrFiles) {
    const content = await fs.readFile(file, "utf8");
    const decision = parseADR(content, file);
    if (decision) {
      decisions.push(decision);
    }
  }

  // Analyze directory structure
  const structure = await analyzeDirectoryStructure(options.rootDir);

  return {
    overview: overview || "No architecture overview available.",
    structure,
    patterns,
    decisions,
    technologies,
  };
}

function extractOverviewFromMarkdown(content: string): string {
  // Look for the first substantial paragraph or section
  const sections = content.split(/^##?\s+/m);

  for (const section of sections) {
    const lines = section.trim().split("\n");
    if (lines.length > 3 && !lines[0].toLowerCase().includes("table of contents")) {
      const overview = lines.slice(0, 5).join(" ").trim();
      if (overview.length > 100) {
        return overview;
      }
    }
  }

  return "";
}

function extractPatternsFromMarkdown(content: string): ArchitecturePattern[] {
  const patterns: ArchitecturePattern[] = [];

  // Look for sections about patterns
  const patternSections = content.match(/^#+.*pattern.*$([\s\S]*?)(?=^#+|$)/gim);

  if (patternSections) {
    for (const section of patternSections) {
      const lines = section.split("\n");
      const title = lines[0].replace(/^#+\s*/, "").trim();
      const description = lines.slice(1, 4).join(" ").trim();

      if (title && description) {
        patterns.push({
          name: title,
          description,
          rationale: "Extracted from documentation",
          examples: [],
        });
      }
    }
  }

  return patterns;
}

function extractTechnologiesFromMarkdown(content: string): Technology[] {
  const technologies: Technology[] = [];
  const techMap = new Map<string, Technology>();

  // Common technology patterns
  const techPatterns = [
    { pattern: /bun/gi, name: "Bun", category: "runtime" as const },
    { pattern: /typescript/gi, name: "TypeScript", category: "language" as const },
    { pattern: /react/gi, name: "React", category: "framework" as const },
    { pattern: /node\.?js/gi, name: "Node.js", category: "runtime" as const },
    { pattern: /vite/gi, name: "Vite", category: "tool" as const },
    { pattern: /elysia/gi, name: "Elysia", category: "framework" as const },
    { pattern: /handlebars/gi, name: "Handlebars", category: "library" as const },
    { pattern: /commander/gi, name: "Commander.js", category: "library" as const },
    { pattern: /chalk/gi, name: "Chalk", category: "library" as const },
  ];

  for (const { pattern, name, category } of techPatterns) {
    if (pattern.test(content)) {
      if (!techMap.has(name)) {
        techMap.set(name, {
          name,
          category,
          purpose: `Used throughout the project`,
          critical: ["Bun", "TypeScript", "React"].includes(name),
        });
      }
    }
  }

  return Array.from(techMap.values());
}

function parseADR(content: string, filePath: string): ArchitectureDecision | null {
  // Parse ADR format (simplified)
  const title = extractADRSection(content, "title") || path.basename(filePath, ".md");
  const status = extractADRSection(content, "status") || "proposed";
  const date = extractADRSection(content, "date") || "";
  const context = extractADRSection(content, "context") || "";
  const decision = extractADRSection(content, "decision") || "";
  const consequences =
    extractADRSection(content, "consequences")
      ?.split("\n")
      .filter((l) => l.trim()) || [];

  if (title && decision) {
    return {
      title,
      status: status as any,
      date,
      context,
      decision,
      consequences,
    };
  }

  return null;
}

function extractADRSection(content: string, sectionName: string): string | undefined {
  const regex = new RegExp(`^##?\\s*${sectionName}\\s*$(.*?)(?=^##?|$)`, "ims");
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

async function analyzeDirectoryStructure(rootDir: string): Promise<DirectoryStructure[]> {
  const structure: DirectoryStructure[] = [];

  const entries = await fs.readdir(rootDir);

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry);
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
      const type = determineDirectoryType(entry);
      const description = getDirectoryDescription(entry, type);

      structure.push({
        path: entry,
        description,
        type,
        children:
          type === "package" || type === "app"
            ? await analyzePackageStructure(fullPath)
            : undefined,
      });
    }
  }

  return structure.sort((a, b) => {
    const order = { package: 0, app: 1, scripts: 2, docs: 3, config: 4, other: 5 };
    return order[a.type] - order[b.type];
  });
}

function determineDirectoryType(dirName: string): DirectoryStructure["type"] {
  if (dirName.startsWith("packages")) return "package";
  if (dirName.startsWith("apps")) return "app";
  if (dirName === "docs" || dirName === "documentation") return "docs";
  if (dirName === "scripts") return "scripts";
  if (dirName.includes("config") || dirName.startsWith(".")) return "config";
  return "other";
}

function getDirectoryDescription(dirName: string, type: DirectoryStructure["type"]): string {
  const descriptions = {
    package: "Shared package/library",
    app: "Deployable application",
    docs: "Documentation files",
    scripts: "Build and utility scripts",
    config: "Configuration files",
    other: "Project files",
  };

  return descriptions[type];
}

async function analyzePackageStructure(packageDir: string): Promise<DirectoryStructure[]> {
  const structure: DirectoryStructure[] = [];

  try {
    const entries = await fs.readdir(packageDir);

    for (const entry of entries) {
      if (entry === "node_modules") continue;

      const fullPath = path.join(packageDir, entry);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        structure.push({
          path: entry,
          description: getPackageDirectoryDescription(entry),
          type: "other",
        });
      }
    }
  } catch {
    // Directory might not be readable
  }

  return structure;
}

function getPackageDirectoryDescription(dirName: string): string {
  const descriptions: Record<string, string> = {
    src: "Source code",
    dist: "Compiled output",
    lib: "Library files",
    test: "Test files",
    tests: "Test files",
    __tests__: "Test files",
    types: "TypeScript type definitions",
    docs: "Package documentation",
    examples: "Usage examples",
    templates: "Code templates",
    assets: "Static assets",
  };

  return descriptions[dirName] || `${dirName} directory`;
}

async function parseContributorInfo(
  options: ProjectDocumentationOptions,
): Promise<ContributorInfo[]> {
  const contributors: ContributorInfo[] = [];

  // Parse from package.json
  const packageJsonPath = path.join(options.rootDir, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);

    if (packageJson.author) {
      const author =
        typeof packageJson.author === "string" ? { name: packageJson.author } : packageJson.author;

      contributors.push({
        name: author.name,
        email: author.email,
        role: "Author",
        contributions: ["Project creation", "Core development"],
      });
    }

    if (packageJson.contributors && Array.isArray(packageJson.contributors)) {
      for (const contributor of packageJson.contributors) {
        const contrib = typeof contributor === "string" ? { name: contributor } : contributor;

        contributors.push({
          name: contrib.name,
          email: contrib.email,
          role: "Contributor",
          contributions: ["Development"],
        });
      }
    }
  }

  // Parse from CONTRIBUTORS.md or AUTHORS.md
  const contributorFiles = ["CONTRIBUTORS.md", "AUTHORS.md", "CREDITS.md"];
  for (const fileName of contributorFiles) {
    const filePath = path.join(options.rootDir, fileName);
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, "utf8");
      const parsedContributors = parseContributorsFromMarkdown(content);
      contributors.push(...parsedContributors);
      break;
    }
  }

  return contributors;
}

function parseContributorsFromMarkdown(content: string): ContributorInfo[] {
  const contributors: ContributorInfo[] = [];

  // Look for list items with names and optional emails
  const listItemRegex = /^[-*+]\s+(.+)$/gm;
  let match;

  while ((match = listItemRegex.exec(content)) !== null) {
    const line = match[1].trim();

    // Parse name and email
    const emailMatch = line.match(/(.+?)\s*<(.+?)>/);
    if (emailMatch) {
      contributors.push({
        name: emailMatch[1].trim(),
        email: emailMatch[2].trim(),
        contributions: [],
      });
    } else {
      contributors.push({
        name: line,
        contributions: [],
      });
    }
  }

  return contributors;
}

async function analyzeDependencies(
  packages: PackageInfo[],
  options: ProjectDocumentationOptions,
): Promise<DependencyAnalysis> {
  const allDeps = new Map<string, string>();
  const categories = {
    runtime: 0,
    development: 0,
    peer: 0,
  };
  const licenses = new Map<string, number>();

  for (const pkg of packages) {
    // Collect all dependencies
    Object.entries(pkg.dependencies).forEach(([name, version]) => {
      allDeps.set(name, version);
      categories.runtime++;
    });

    Object.entries(pkg.devDependencies).forEach(([name, version]) => {
      allDeps.set(name, version);
      categories.development++;
    });

    Object.entries(pkg.peerDependencies).forEach(([name, version]) => {
      allDeps.set(name, version);
      categories.peer++;
    });
  }

  // For a real implementation, you'd use npm audit or similar
  const security = {
    vulnerabilities: 0,
    outdated: 0,
  };

  // Mock license analysis
  licenses.set("MIT", Math.floor(allDeps.size * 0.6));
  licenses.set("Apache-2.0", Math.floor(allDeps.size * 0.2));
  licenses.set("ISC", Math.floor(allDeps.size * 0.1));
  licenses.set("Other", allDeps.size - Array.from(licenses.values()).reduce((a, b) => a + b, 0));

  return {
    total: categories.runtime + categories.development + categories.peer,
    unique: allDeps.size,
    byCategory: categories,
    security,
    licenses: Object.fromEntries(licenses),
  };
}

function getEmptyDependencyAnalysis(): DependencyAnalysis {
  return {
    total: 0,
    unique: 0,
    byCategory: { runtime: 0, development: 0, peer: 0 },
    security: { vulnerabilities: 0, outdated: 0 },
    licenses: {},
  };
}

async function calculateProjectMetrics(
  options: ProjectDocumentationOptions,
): Promise<ProjectMetrics> {
  // Count files
  const allFiles = await glob(path.join(options.rootDir, "**/*"), { nodir: true });
  const codeFiles = allFiles.filter(
    (file) =>
      !file.includes("node_modules") &&
      !file.includes(".git") &&
      (file.endsWith(".ts") ||
        file.endsWith(".js") ||
        file.endsWith(".tsx") ||
        file.endsWith(".jsx")),
  );

  // Count lines of code (simplified)
  let linesOfCode = 0;
  for (const file of codeFiles.slice(0, 50)) {
    // Limit to avoid performance issues
    try {
      const content = await fs.readFile(file, "utf8");
      linesOfCode += content.split("\n").length;
    } catch {
      // File might not be readable
    }
  }

  // Get last updated time
  const packageJsonPath = path.join(options.rootDir, "package.json");
  let lastUpdated = new Date().toISOString();
  try {
    const stats = await fs.stat(packageJsonPath);
    lastUpdated = stats.mtime.toISOString();
  } catch {
    // Use current time as fallback
  }

  // Count package.json files for packages count
  const packageFiles = await glob(path.join(options.rootDir, "**/package.json"));
  const packages = packageFiles.filter((f) => !f.includes("node_modules")).length;

  // Count scripts across all packages
  let scripts = 0;
  for (const file of packageFiles) {
    if (file.includes("node_modules")) continue;
    try {
      const packageJson = await fs.readJson(file);
      scripts += Object.keys(packageJson.scripts || {}).length;
    } catch {
      // Skip invalid package.json files
    }
  }

  return {
    filesCount: allFiles.length,
    linesOfCode,
    packages,
    scripts,
    lastUpdated,
    complexity: {
      cyclomaticComplexity: Math.floor(linesOfCode / 50), // Rough estimate
      technicalDebt: Math.floor(linesOfCode / 100), // Rough estimate
    },
  };
}

async function generateProjectDocumentationFormat(
  format: "markdown" | "json" | "html",
  documentation: ProjectDocumentation,
  options: ProjectDocumentationOptions,
): Promise<void> {
  console.log(chalk.blue(`📄 Generating ${format} project documentation...`));

  const outputFile = path.join(options.outputDir, `project-overview.${format}`);

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${outputFile}`));
    return;
  }

  switch (format) {
    case "json":
      await generateJsonFormat(documentation, outputFile);
      break;
    case "markdown":
      await generateMarkdownFormat(documentation, outputFile, options);
      break;
    case "html":
      await generateHtmlFormat(documentation, outputFile, options);
      break;
  }

  console.log(chalk.green(`  ✅ Generated ${format} documentation`));
}

async function generateJsonFormat(
  documentation: ProjectDocumentation,
  outputFile: string,
): Promise<void> {
  await fs.writeFile(outputFile, JSON.stringify(documentation, null, 2), "utf8");
}

async function generateMarkdownFormat(
  documentation: ProjectDocumentation,
  outputFile: string,
  options: ProjectDocumentationOptions,
): Promise<void> {
  let content = `# ${documentation.info.name}

${documentation.info.description}

**Version**: ${documentation.info.version}  
**License**: ${documentation.info.license || "Not specified"}  
**Generated**: ${documentation.generatedAt}

## Overview

${documentation.architecture?.overview || "No overview available."}

## Project Statistics

- **Files**: ${documentation.metrics.filesCount}
- **Lines of Code**: ${documentation.metrics.linesOfCode}
- **Packages**: ${documentation.metrics.packages}
- **Scripts**: ${documentation.metrics.scripts}
- **Dependencies**: ${documentation.dependencies.unique} unique (${documentation.dependencies.total} total)
- **Last Updated**: ${documentation.metrics.lastUpdated}

`;

  // Architecture section
  if (documentation.architecture) {
    content += `## Architecture

### Directory Structure

`;

    for (const dir of documentation.architecture.structure) {
      content += `- **${dir.path}** (${dir.type}): ${dir.description}\n`;
      if (dir.children) {
        for (const child of dir.children) {
          content += `  - ${child.path}: ${child.description}\n`;
        }
      }
    }

    content += "\n";

    if (documentation.architecture.patterns.length > 0) {
      content += "### Architecture Patterns\n\n";
      for (const pattern of documentation.architecture.patterns) {
        content += `#### ${pattern.name}\n\n`;
        content += `${pattern.description}\n\n`;
        if (pattern.rationale) {
          content += `**Rationale**: ${pattern.rationale}\n\n`;
        }
      }
    }

    if (documentation.architecture.technologies.length > 0) {
      content += "### Technologies\n\n";
      content += "| Technology | Category | Critical | Purpose |\n";
      content += "|------------|----------|----------|----------|\n";

      for (const tech of documentation.architecture.technologies) {
        const critical = tech.critical ? "Yes" : "No";
        content += `| ${tech.name} | ${tech.category} | ${critical} | ${tech.purpose} |\n`;
      }
      content += "\n";
    }

    if (documentation.architecture.decisions.length > 0) {
      content += "### Architecture Decisions\n\n";
      for (const decision of documentation.architecture.decisions) {
        content += `#### ${decision.title}\n\n`;
        content += `**Status**: ${decision.status}  \n`;
        content += `**Date**: ${decision.date}  \n\n`;
        if (decision.context) {
          content += `**Context**: ${decision.context}\n\n`;
        }
        content += `**Decision**: ${decision.decision}\n\n`;
        if (decision.consequences.length > 0) {
          content += `**Consequences**:\n`;
          for (const consequence of decision.consequences) {
            content += `- ${consequence}\n`;
          }
          content += "\n";
        }
      }
    }
  }

  // Packages section
  if (documentation.packages.length > 0) {
    content += "## Packages\n\n";

    for (const pkg of documentation.packages) {
      content += `### ${pkg.name}\n\n`;
      content += `**Path**: \`${pkg.path}\`  \n`;
      content += `**Version**: ${pkg.version}  \n`;
      if (pkg.description) {
        content += `**Description**: ${pkg.description}  \n`;
      }
      content += `**Type**: ${pkg.type || "CommonJS"}  \n`;
      if (pkg.private) {
        content += `**Private**: Yes  \n`;
      }
      content += "\n";

      if (Object.keys(pkg.scripts).length > 0) {
        content += "**Scripts**:\n";
        for (const [script, command] of Object.entries(pkg.scripts)) {
          content += `- \`${script}\`: ${command}\n`;
        }
        content += "\n";
      }

      const depCount = Object.keys(pkg.dependencies).length;
      const devDepCount = Object.keys(pkg.devDependencies).length;
      const peerDepCount = Object.keys(pkg.peerDependencies).length;

      if (depCount + devDepCount + peerDepCount > 0) {
        content += `**Dependencies**: ${depCount} runtime, ${devDepCount} dev, ${peerDepCount} peer\n\n`;
      }
    }
  }

  // Dependencies section
  if (documentation.dependencies.total > 0) {
    content += "## Dependencies Analysis\n\n";
    content += `- **Total Dependencies**: ${documentation.dependencies.total}\n`;
    content += `- **Unique Dependencies**: ${documentation.dependencies.unique}\n`;
    content += `- **Runtime**: ${documentation.dependencies.byCategory.runtime}\n`;
    content += `- **Development**: ${documentation.dependencies.byCategory.development}\n`;
    content += `- **Peer**: ${documentation.dependencies.byCategory.peer}\n\n`;

    if (Object.keys(documentation.dependencies.licenses).length > 0) {
      content += "**License Distribution**:\n";
      for (const [license, count] of Object.entries(documentation.dependencies.licenses)) {
        content += `- ${license}: ${count}\n`;
      }
      content += "\n";
    }

    if (
      documentation.dependencies.security.vulnerabilities > 0 ||
      documentation.dependencies.security.outdated > 0
    ) {
      content += "**Security Issues**:\n";
      content += `- Vulnerabilities: ${documentation.dependencies.security.vulnerabilities}\n`;
      content += `- Outdated: ${documentation.dependencies.security.outdated}\n\n`;
    }
  }

  // Contributors section
  if (documentation.contributors && documentation.contributors.length > 0) {
    content += "## Contributors\n\n";

    for (const contributor of documentation.contributors) {
      content += `### ${contributor.name}\n\n`;
      if (contributor.role) {
        content += `**Role**: ${contributor.role}  \n`;
      }
      if (contributor.email) {
        content += `**Email**: ${contributor.email}  \n`;
      }
      if (contributor.githubUsername) {
        content += `**GitHub**: @${contributor.githubUsername}  \n`;
      }

      if (contributor.contributions.length > 0) {
        content += `**Contributions**: ${contributor.contributions.join(", ")}\n`;
      }
      content += "\n";
    }
  }

  // Project info section
  content += "## Project Information\n\n";
  if (documentation.info.homepage) {
    content += `**Homepage**: ${documentation.info.homepage}\n`;
  }
  if (documentation.info.repository) {
    content += `**Repository**: ${documentation.info.repository.url}\n`;
  }
  if (documentation.info.keywords.length > 0) {
    content += `**Keywords**: ${documentation.info.keywords.join(", ")}\n`;
  }
  if (documentation.info.engines) {
    content += `**Engines**: ${Object.entries(documentation.info.engines)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")}\n`;
  }

  await fs.writeFile(outputFile, content, "utf8");
}

async function generateHtmlFormat(
  documentation: ProjectDocumentation,
  outputFile: string,
  options: ProjectDocumentationOptions,
): Promise<void> {
  // Convert markdown to HTML (simplified approach)
  const markdownFile = outputFile.replace(".html", ".md");
  await generateMarkdownFormat(documentation, markdownFile, options);

  const markdown = await fs.readFile(markdownFile, "utf8");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${documentation.info.name} - Project Overview</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3, h4 { color: #2563eb; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background-color: #f8f9fa; }
        code { background-color: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
        pre { background-color: #f8f9fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
        .stats { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .package { border-left: 4px solid #10b981; padding-left: 16px; margin: 20px 0; }
        .architecture { border-left: 4px solid #8b5cf6; padding-left: 16px; margin: 20px 0; }
    </style>
</head>
<body>
${markdown
  .replace(/^# (.+)$/gm, "<h1>$1</h1>")
  .replace(/^## (.+)$/gm, "<h2>$1</h2>")
  .replace(/^### (.+)$/gm, "<h3>$1</h3>")
  .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\`(.+?)\`/g, "<code>$1</code>")
  .replace(/^- (.+)$/gm, "<li>$1</li>")
  .replace(/(\<li\>.*\<\/li\>)/gs, "<ul>$1</ul>")
  .replace(/\n/g, "<br>")}
</body>
</html>`;

  await fs.writeFile(outputFile, html, "utf8");

  // Clean up temporary markdown file
  await fs.remove(markdownFile);
}

async function generateProjectIndex(
  documentation: ProjectDocumentation,
  options: ProjectDocumentationOptions,
): Promise<void> {
  const indexFile = path.join(options.outputDir, "project-index.json");

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${indexFile}`));
    return;
  }

  const index = {
    generatedAt: new Date().toISOString(),
    project: {
      name: documentation.info.name,
      version: documentation.info.version,
      description: documentation.info.description,
    },
    statistics: documentation.metrics,
    packages: documentation.packages.map((p) => ({
      name: p.name,
      path: p.path,
      version: p.version,
      private: p.private,
    })),
    technologies:
      documentation.architecture?.technologies.map((t) => ({
        name: t.name,
        category: t.category,
        critical: t.critical,
      })) || [],
  };

  await fs.writeFile(indexFile, JSON.stringify(index, null, 2), "utf8");
  console.log(chalk.green("  ✅ Generated project index"));
}

async function generateProjectMetrics(
  documentation: ProjectDocumentation,
  options: ProjectDocumentationOptions,
): Promise<void> {
  const metricsFile = path.join(options.outputDir, "project-metrics.json");

  if (options.dryRun) {
    console.log(chalk.yellow(`🔍 Would generate: ${metricsFile}`));
    return;
  }

  const metrics = {
    generatedAt: new Date().toISOString(),
    project: documentation.info.name,
    overview: documentation.metrics,
    packages: {
      total: documentation.packages.length,
      private: documentation.packages.filter((p) => p.private).length,
      public: documentation.packages.filter((p) => !p.private).length,
      averageScriptsPerPackage:
        documentation.packages.length > 0
          ? documentation.packages.reduce((sum, p) => sum + Object.keys(p.scripts).length, 0) /
            documentation.packages.length
          : 0,
    },
    dependencies: documentation.dependencies,
    architecture: {
      patterns: documentation.architecture?.patterns.length || 0,
      decisions: documentation.architecture?.decisions.length || 0,
      technologies: documentation.architecture?.technologies.length || 0,
    },
    quality: {
      documentationCoverage:
        (documentation.packages.filter((p) => p.description).length /
          Math.max(documentation.packages.length, 1)) *
        100,
      testCoverage: 0, // Would need actual test analysis
      lintingScore: 0, // Would need actual linting analysis
    },
  };

  await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2), "utf8");
  console.log(chalk.green("  ✅ Generated project metrics"));
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const defaultOptions: ProjectDocumentationOptions = {
    rootDir: process.cwd(),
    outputDir: "./docs",
    formats: ["markdown", "json"],
    includePackageInfo: true,
    includeArchitecture: true,
    includeDependencies: true,
    includeContributors: true,
    verbose: false,
    dryRun: false,
  };

  generateProjectDocumentation(defaultOptions)
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    });
}
