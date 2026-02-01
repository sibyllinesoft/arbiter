/**
 * @packageDocumentation
 * Markdown-based handlers for add subcommands.
 *
 * These handlers create entities as markdown files with YAML frontmatter
 * instead of manipulating CUE files directly.
 */

import path from "node:path";
import { createMarkdownFile } from "@/utils/storage/markdown.js";
import { ensureUniqueSlug, slugify } from "@/utils/storage/slug.js";
import chalk from "chalk";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import type { AddOptions } from "./index.js";

/**
 * Check if a project uses markdown-first storage.
 * Returns true if .arbiter/README.md exists (new format).
 * Returns false if .arbiter/assembly.cue exists (legacy format).
 */
export async function isMarkdownStorage(projectDir: string): Promise<boolean> {
  const arbiterDir = path.join(projectDir, ".arbiter");
  const readmePath = path.join(arbiterDir, "README.md");
  const assemblyPath = path.join(arbiterDir, "assembly.cue");

  // Check for new markdown format first
  if (await fs.pathExists(readmePath)) {
    return true;
  }

  // Check for legacy CUE format
  if (await fs.pathExists(assemblyPath)) {
    return false;
  }

  // Neither exists - default to markdown for new projects
  return true;
}

/**
 * Service options for markdown handler
 */
export interface MarkdownServiceOptions extends AddOptions {
  language?: string;
  port?: number;
  framework?: string;
  workload?: string;
  subtype?: "service" | "frontend" | "tool" | "library" | "worker";
  directory?: string;
  image?: string;
  type?: "database" | "cache" | "queue" | "load-balancer";
}

/**
 * Add a service as a markdown directory with README.md
 */
export async function addServiceMarkdown(
  name: string,
  options: MarkdownServiceOptions,
  projectDir: string,
): Promise<number> {
  const arbiterDir = path.join(projectDir, ".arbiter");
  const serviceSlug = slugify(name);
  const servicePath = path.join(arbiterDir, serviceSlug);
  const readmePath = path.join(servicePath, "README.md");

  // Check if service already exists
  if (await fs.pathExists(readmePath)) {
    console.error(chalk.red(`Service "${name}" already exists at ${servicePath}`));
    return 1;
  }

  // Create service directory
  await fs.ensureDir(servicePath);

  // Build frontmatter
  const now = new Date().toISOString();
  const frontmatter: Record<string, unknown> = {
    type: options.type ? "resource" : "service",
    entityId: uuidv4(),
    createdAt: now,
    updatedAt: now,
    language: options.language ?? "typescript",
  };

  // Add optional fields
  if (options.port) frontmatter.port = options.port;
  if (options.framework) frontmatter.framework = options.framework;
  if (options.workload) frontmatter.workload = options.workload;
  if (options.subtype) frontmatter.subtype = options.subtype;
  if (options.image) frontmatter.image = options.image;
  if (options.type) frontmatter.kind = options.type;

  // Build body
  const typeLabel = options.type ? `${options.type} resource` : "service";
  const body = `# ${name}

${options.type ? `Infrastructure ${typeLabel}` : `Backend service`} for the project.

## Configuration

- **Language**: ${options.language ?? "typescript"}
${options.port ? `- **Port**: ${options.port}` : ""}
${options.framework ? `- **Framework**: ${options.framework}` : ""}
${options.workload ? `- **Workload**: ${options.workload}` : ""}
${options.type ? `- **Type**: ${options.type}` : ""}

## Endpoints

Add endpoints to this service:

\`\`\`bash
arbiter add endpoint my-endpoint --service ${serviceSlug} --path /api/example --methods GET
\`\`\`
`;

  // Write README.md
  const content = createMarkdownFile(frontmatter, body);
  await fs.writeFile(readmePath, content, "utf-8");

  console.log(chalk.green(`✅ Created ${typeLabel}: ${name}`));
  console.log(chalk.dim(`   Path: ${path.relative(projectDir, readmePath)}`));
  if (options.verbose) {
    console.log(chalk.dim(`   Entity ID: ${frontmatter.entityId}`));
  }

  return 0;
}

/**
 * Endpoint options for markdown handler
 */
export interface MarkdownEndpointOptions extends AddOptions {
  service?: string;
  path?: string;
  methods?: string;
  method?: string;
  summary?: string;
  description?: string;
  handler?: string;
}

/**
 * Add an endpoint as a markdown file inside a service directory
 */
export async function addEndpointMarkdown(
  name: string,
  options: MarkdownEndpointOptions,
  projectDir: string,
): Promise<number> {
  const arbiterDir = path.join(projectDir, ".arbiter");
  const serviceName = options.service ?? "api";
  const serviceSlug = slugify(serviceName);
  const servicePath = path.join(arbiterDir, serviceSlug);

  // Check if service exists
  if (!(await fs.pathExists(path.join(servicePath, "README.md")))) {
    console.error(chalk.red(`Service "${serviceName}" not found.`));
    console.log(chalk.dim(`Add it first with: arbiter add service ${serviceName}`));
    return 1;
  }

  // Generate endpoint slug
  const endpointSlug = slugify(name);

  // Get existing slugs to ensure uniqueness
  const existingFiles = await fs.readdir(servicePath);
  const existingSlugs = new Set(
    existingFiles
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => f.replace(/\.md$/, "")),
  );
  const uniqueSlug = ensureUniqueSlug(endpointSlug, existingSlugs);

  const endpointPath = path.join(servicePath, `${uniqueSlug}.md`);

  // Parse methods
  const methods = (options.methods ?? options.method ?? "GET")
    .split(",")
    .map((m) => m.trim().toUpperCase());

  // Build frontmatter
  const now = new Date().toISOString();
  const frontmatter: Record<string, unknown> = {
    type: "endpoint",
    entityId: uuidv4(),
    createdAt: now,
    updatedAt: now,
    path: options.path ?? `/${endpointSlug}`,
    methods,
  };

  if (options.summary) frontmatter.summary = options.summary;
  if (options.handler) {
    frontmatter.handler = {
      module: options.handler,
    };
  }

  // Build body
  const body = `# ${name}

${options.summary ?? `API endpoint for ${name}`}

## Details

- **Path**: \`${frontmatter.path}\`
- **Methods**: ${methods.join(", ")}

${options.description ?? ""}
`;

  // Write endpoint file
  const content = createMarkdownFile(frontmatter, body);
  await fs.writeFile(endpointPath, content, "utf-8");

  console.log(chalk.green(`✅ Created endpoint: ${name}`));
  console.log(chalk.dim(`   Service: ${serviceName}`));
  console.log(chalk.dim(`   Path: ${frontmatter.path}`));
  console.log(chalk.dim(`   Methods: ${methods.join(", ")}`));

  return 0;
}

/**
 * Resource options for markdown handler
 */
export interface MarkdownResourceOptions extends AddOptions {
  kind: string;
  engine?: string;
  provider?: string;
  image?: string;
  version?: string;
}

/**
 * Add a resource as a markdown file
 */
export async function addResourceMarkdown(
  name: string,
  options: MarkdownResourceOptions,
  projectDir: string,
): Promise<number> {
  const arbiterDir = path.join(projectDir, ".arbiter");
  const resourceSlug = slugify(name);

  // Get existing slugs
  const existingFiles = await fs.readdir(arbiterDir);
  const existingSlugs = new Set(
    existingFiles
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => f.replace(/\.md$/, "")),
  );
  const uniqueSlug = ensureUniqueSlug(resourceSlug, existingSlugs);

  const resourcePath = path.join(arbiterDir, `${uniqueSlug}.md`);

  // Build frontmatter
  const now = new Date().toISOString();
  const frontmatter: Record<string, unknown> = {
    type: "resource",
    entityId: uuidv4(),
    createdAt: now,
    updatedAt: now,
    kind: options.kind,
  };

  if (options.engine) frontmatter.engine = options.engine;
  if (options.provider) frontmatter.provider = options.provider;
  if (options.image) frontmatter.image = options.image;
  if (options.version) frontmatter.version = options.version;

  // Build body
  const body = `# ${name}

Infrastructure resource of type \`${options.kind}\`.

## Configuration

- **Kind**: ${options.kind}
${options.engine ? `- **Engine**: ${options.engine}` : ""}
${options.provider ? `- **Provider**: ${options.provider}` : ""}
${options.image ? `- **Image**: ${options.image}` : ""}
${options.version ? `- **Version**: ${options.version}` : ""}
`;

  // Write resource file
  const content = createMarkdownFile(frontmatter, body);
  await fs.writeFile(resourcePath, content, "utf-8");

  console.log(chalk.green(`✅ Created resource: ${name}`));
  console.log(chalk.dim(`   Kind: ${options.kind}`));
  if (options.engine) console.log(chalk.dim(`   Engine: ${options.engine}`));

  return 0;
}

/**
 * Client options for markdown handler
 */
export interface MarkdownClientOptions extends AddOptions {
  language?: string;
  framework?: string;
  subtype?: "frontend" | "tool";
}

/**
 * Add a client as a markdown directory with README.md
 */
export async function addClientMarkdown(
  name: string,
  options: MarkdownClientOptions,
  projectDir: string,
): Promise<number> {
  const arbiterDir = path.join(projectDir, ".arbiter");
  const clientSlug = slugify(name);
  const clientPath = path.join(arbiterDir, clientSlug);
  const readmePath = path.join(clientPath, "README.md");

  // Check if client already exists
  if (await fs.pathExists(readmePath)) {
    console.error(chalk.red(`Client "${name}" already exists at ${clientPath}`));
    return 1;
  }

  // Create client directory
  await fs.ensureDir(clientPath);

  // Build frontmatter
  const now = new Date().toISOString();
  const frontmatter: Record<string, unknown> = {
    type: "client",
    entityId: uuidv4(),
    createdAt: now,
    updatedAt: now,
    language: options.language ?? "typescript",
    subtype: options.subtype ?? "frontend",
  };

  if (options.framework) frontmatter.framework = options.framework;

  // Build body
  const body = `# ${name}

${options.subtype === "tool" ? "CLI tool" : "Frontend application"} for the project.

## Configuration

- **Language**: ${options.language ?? "typescript"}
${options.framework ? `- **Framework**: ${options.framework}` : ""}
- **Type**: ${options.subtype ?? "frontend"}
`;

  // Write README.md
  const content = createMarkdownFile(frontmatter, body);
  await fs.writeFile(readmePath, content, "utf-8");

  console.log(chalk.green(`✅ Created client: ${name}`));
  console.log(chalk.dim(`   Path: ${path.relative(projectDir, readmePath)}`));

  return 0;
}

/**
 * Group options for markdown handler
 */
export interface MarkdownGroupOptions extends AddOptions {
  kind?: "milestone" | "epic" | "sprint" | "release";
  due?: string;
  status?: "open" | "closed" | "active";
}

/**
 * Add a group as a markdown directory with README.md
 */
export async function addGroupMarkdown(
  name: string,
  options: MarkdownGroupOptions,
  projectDir: string,
): Promise<number> {
  const arbiterDir = path.join(projectDir, ".arbiter");
  const groupSlug = slugify(name);
  const groupPath = path.join(arbiterDir, groupSlug);
  const readmePath = path.join(groupPath, "README.md");

  // Check if group already exists
  if (await fs.pathExists(readmePath)) {
    console.error(chalk.red(`Group "${name}" already exists at ${groupPath}`));
    return 1;
  }

  // Create group directory
  await fs.ensureDir(groupPath);

  // Build frontmatter
  const now = new Date().toISOString();
  const frontmatter: Record<string, unknown> = {
    type: "group",
    entityId: uuidv4(),
    createdAt: now,
    updatedAt: now,
    kind: options.kind ?? "group",
    status: options.status ?? "open",
  };

  if (options.due) frontmatter.due = options.due;

  // Build body
  const body = `# ${name}

${options.kind === "milestone" ? "Project milestone" : options.kind === "epic" ? "Epic" : "Group"} for organizing related work.

## Status

- **Kind**: ${options.kind ?? "group"}
- **Status**: ${options.status ?? "open"}
${options.due ? `- **Due**: ${options.due}` : ""}

## Tasks

Add tasks to this group:

\`\`\`bash
arbiter add task "My task" --member-of ${groupSlug}
\`\`\`
`;

  // Write README.md
  const content = createMarkdownFile(frontmatter, body);
  await fs.writeFile(readmePath, content, "utf-8");

  console.log(chalk.green(`✅ Created group: ${name}`));
  console.log(chalk.dim(`   Kind: ${options.kind ?? "group"}`));
  console.log(chalk.dim(`   Path: ${path.relative(projectDir, readmePath)}`));

  return 0;
}
