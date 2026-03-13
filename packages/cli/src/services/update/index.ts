/**
 * @packageDocumentation
 * Update command - Modifies existing entities in CUE specifications.
 *
 * Supports updating properties of packages, resources, groups, and issues.
 * Arbitrary metadata can be attached via CLI flags.
 */

import * as path from "node:path";
import { getCueManipulator } from "@/constraints/cli-integration.js";
import { safeFileOperation } from "@/constraints/index.js";
import { formatCUE, validateCUE } from "@/cue/index.js";
import { isMarkdownStorage } from "@/services/add/markdown-handlers.js";
import type { CLIConfig } from "@/types.js";
import { Storage, type TaskPriority, type TaskStatus } from "@/utils/storage/index.js";
import { MarkdownStorage } from "@/utils/storage/markdown-storage.js";
import { slugify } from "@/utils/storage/slug.js";
import type { EntityNode, EntityType } from "@/utils/storage/types.js";
import chalk from "chalk";
import { diffLines } from "diff";
import fs from "fs-extra";

export interface UpdateOptions {
  verbose?: boolean;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
  // Package options
  subtype?: string;
  description?: string;
  framework?: string;
  port?: number;
  parent?: string;
  // Resource options
  kind?: string;
  image?: string;
  provider?: string;
  engine?: string;
  version?: string;
  // Group options
  name?: string;
  status?: string;
  due?: string;
  // Issue options
  title?: string;
  priority?: string;
  assignees?: string;
  labels?: string;
  milestone?: string;
}

type UpdateableEntityType = "package" | "resource" | "group" | "issue";

interface AssemblyContext {
  assemblyDir: string;
  assemblyPath: string;
  content: string;
}

const MARKDOWN_ENTITY_TYPES: Partial<Record<UpdateableEntityType, EntityType>> = {
  resource: "resource",
  group: "group",
};

/**
 * Load the assembly file from the .arbiter directory.
 */
async function loadAssembly(verbose: boolean): Promise<AssemblyContext> {
  const assemblyDir = path.resolve(".arbiter");
  const assemblyPath = path.join(assemblyDir, "assembly.cue");

  if (await fs.pathExists(assemblyPath)) {
    if (verbose) {
      console.log(chalk.dim("📁 Loaded specification from .arbiter directory"));
    }
    const content = await fs.readFile(assemblyPath, "utf-8");
    return { assemblyDir, assemblyPath, content };
  }

  throw new Error("No specification found. Run 'arbiter add' to create entities first.");
}

/**
 * Build the update object from options.
 */
function buildUpdateObject(
  entityType: UpdateableEntityType,
  options: UpdateOptions,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  // Common fields
  if (options.description !== undefined) updates.description = options.description;
  const parent =
    options.parent ??
    ((options as UpdateOptions & { memberOf?: string }).memberOf as string | undefined) ??
    (options.metadata?.["member-of"] as string | undefined);
  if (parent !== undefined) updates.parent = parent;

  // Package-specific fields
  if (entityType === "package") {
    if (options.subtype !== undefined) updates.subtype = options.subtype;
    if (options.framework !== undefined) updates.framework = options.framework;
    if (options.port !== undefined) updates.port = options.port;
  }

  // Resource-specific fields
  if (entityType === "resource") {
    if (options.kind !== undefined) updates.kind = options.kind;
    if (options.image !== undefined) updates.image = options.image;
    if (options.provider !== undefined) updates.provider = options.provider;
    if (options.engine !== undefined) updates.engine = options.engine;
    if (options.version !== undefined) updates.version = options.version;
  }

  // Group-specific fields
  if (entityType === "group") {
    if (options.name !== undefined) updates.name = options.name;
    if (options.status !== undefined) updates.status = options.status;
    if (options.due !== undefined) updates.due = options.due;
  }

  // Issue-specific fields
  if (entityType === "issue") {
    if (options.title !== undefined) updates.title = options.title;
    if (options.status !== undefined) updates.status = options.status;
    if (options.priority !== undefined) updates.priority = options.priority;
    if (options.due !== undefined) updates.due = options.due;
    if (options.milestone !== undefined) updates.milestone = options.milestone;
    if (options.assignees !== undefined) {
      updates.assignees = options.assignees.split(",").map((s) => s.trim());
    }
    if (options.labels !== undefined) {
      updates.labels = options.labels.split(",").map((s) => s.trim());
    }
  }

  // Merge arbitrary metadata
  if (options.metadata && Object.keys(options.metadata).length > 0) {
    updates.metadata = {
      ...((updates.metadata as Record<string, unknown>) || {}),
      ...options.metadata,
    };
  }

  return updates;
}

function isMarkdownEntityType(
  entityType: UpdateableEntityType,
): entityType is "resource" | "group" {
  return entityType === "resource" || entityType === "group";
}

function matchesEntitySlug(entity: EntityNode, slug: string): boolean {
  const fileName = path.basename(entity.filePath, path.extname(entity.filePath));
  const directoryName =
    fileName === "README" ? path.basename(path.dirname(entity.filePath)) : fileName;

  return entity.entityId === slug || directoryName === slug || slugify(entity.name) === slug;
}

function mergeMarkdownBody(existingBody: string, name: string, description?: string): string {
  if (description === undefined) {
    return existingBody;
  }

  const trimmed = existingBody.trim();
  const sections = trimmed.split(/\n## /);
  const heading = `# ${name}`;
  const remainingSections = sections
    .slice(1)
    .map((section, index) => `${index === 0 ? "## " : "\n## "}${section}`)
    .join("");

  const descriptionBlock = description.trim().length > 0 ? `${description.trim()}\n` : "";
  return `${heading}\n\n${descriptionBlock}${remainingSections}`.trimEnd() + "\n";
}

async function updateMarkdownTask(
  slug: string,
  options: UpdateOptions,
  projectDir: string,
): Promise<number> {
  const storage = new Storage({
    baseDir: path.join(projectDir, ".arbiter"),
    notesDir: path.join(projectDir, ".arbiter", "notes"),
    tasksDir: path.join(projectDir, ".arbiter", "tasks"),
  });
  await storage.initialize();

  const issue = await storage.getIssue(slug);
  if (!issue) {
    console.error(chalk.red(`❌ Task "${slug}" not found`));
    return 1;
  }

  const updated = await storage.saveIssue({
    ...issue,
    title: options.title ?? issue.title,
    description: options.description ?? issue.description,
    status: (options.status as TaskStatus | undefined) ?? issue.status,
    priority: (options.priority as TaskPriority | undefined) ?? issue.priority,
    assignees:
      options.assignees !== undefined
        ? options.assignees
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : issue.assignees,
    labels:
      options.labels !== undefined
        ? options.labels
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : issue.labels,
    due: options.due ?? issue.due,
    milestone: options.milestone ?? issue.milestone,
    parent: (options.parent as string | undefined) ?? (issue.parent as string | undefined),
  });

  console.log(chalk.green(`✅ Updated task: ${updated.id}`));
  console.log(chalk.dim(`   Title: ${updated.title}`));
  console.log(chalk.dim(`   Status: ${updated.status}`));
  return 0;
}

async function updateMarkdownEntity(
  entityType: "resource" | "group",
  slug: string,
  options: UpdateOptions,
  projectDir: string,
): Promise<number> {
  const storage = new MarkdownStorage(path.join(projectDir, ".arbiter"));
  const entities = await storage.list([MARKDOWN_ENTITY_TYPES[entityType]!]);
  const entity = entities.find((candidate) => matchesEntitySlug(candidate, slug));

  if (!entity) {
    console.error(chalk.red(`❌ ${entityType} "${slug}" not found`));
    return 1;
  }

  const updates = buildUpdateObject(entityType, options);
  const { description, name: _ignoredName, title: _ignoredTitle, ...frontmatterUpdates } = updates;
  const nextName =
    entityType === "group" && typeof options.name === "string" ? options.name : entity.name;
  const updated = await storage.update(entity.entityId, {
    name: nextName,
    body: mergeMarkdownBody(entity.body, nextName, description as string | undefined),
    frontmatter: frontmatterUpdates,
  });

  if (!updated) {
    console.error(chalk.red(`❌ ${entityType} "${slug}" could not be updated`));
    return 1;
  }

  console.log(chalk.green(`✅ Updated ${entityType}: ${updated.name}`));
  console.log(chalk.dim(`   Path: .arbiter/${updated.filePath}`));
  return 0;
}

/**
 * Get the CUE section path for an entity type.
 */
function getSectionPath(entityType: UpdateableEntityType): string {
  const sectionMap: Record<UpdateableEntityType, string> = {
    package: "packages",
    resource: "resources",
    group: "groups",
    issue: "issues",
  };
  return sectionMap[entityType];
}

/**
 * Show diff between old and new content.
 */
function showDiff(oldContent: string, newContent: string): string {
  const diff = diffLines(oldContent, newContent);

  return diff
    .flatMap((part) =>
      part.value
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => {
          if (part.added) return chalk.green(`+ ${line}`);
          if (part.removed) return chalk.red(`- ${line}`);
          return chalk.dim(`  ${line}`);
        }),
    )
    .join("\n");
}

/**
 * Main update command dispatcher.
 */
export async function runUpdateCommand(
  entityType: UpdateableEntityType,
  slug: string,
  options: UpdateOptions,
  config: CLIConfig,
): Promise<number> {
  const projectDir = config.projectDir ?? process.cwd();
  const useMarkdown = await isMarkdownStorage(projectDir);

  if (useMarkdown) {
    if (entityType === "issue") {
      return updateMarkdownTask(slug, options, projectDir);
    }

    if (isMarkdownEntityType(entityType)) {
      return updateMarkdownEntity(entityType, slug, options, projectDir);
    }

    console.error(
      chalk.red(`❌ ${entityType} updates are not supported in markdown-first projects.`),
    );
    return 1;
  }

  const manipulator = getCueManipulator();

  try {
    console.log(chalk.blue(`🔧 Updating ${entityType}: ${slug}`));

    const ctx = await loadAssembly(options.verbose ?? false);
    const updates = buildUpdateObject(entityType, options);

    if (Object.keys(updates).length === 0) {
      console.log(
        chalk.yellow(
          "⚠️  No updates specified. Use options like --subtype, --description, or arbitrary --key value flags.",
        ),
      );
      return 1;
    }

    const section = getSectionPath(entityType);
    const updatedContent = await manipulator.updateInSection(ctx.content, section, slug, updates);

    // Validate the updated content
    const validationResult = await validateCUE(updatedContent);
    if (!validationResult.valid) {
      console.error(chalk.red("❌ CUE validation failed:"));
      validationResult.errors.forEach((error) => console.error(chalk.red(`  • ${error}`)));
      return 1;
    }

    // Format the content
    const formattedContent = await formatCUE(updatedContent);

    if (options.dryRun) {
      console.log(chalk.yellow("🔍 Dry run - changes that would be made:"));
      console.log(showDiff(ctx.content, formattedContent));
      return 0;
    }

    // Write the updated content
    await fs.ensureDir(ctx.assemblyDir);
    await safeFileOperation("write", ctx.assemblyPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, formattedContent, "utf-8");
    });

    const relativePath = path.relative(process.cwd(), ctx.assemblyPath) || ctx.assemblyPath;
    console.log(chalk.green(`✅ Updated ${entityType} "${slug}" in ${relativePath}`));

    if (options.verbose) {
      console.log(chalk.dim("Changes:"));
      console.log(showDiff(ctx.content, formattedContent));
    }

    return 0;
  } catch (error) {
    console.error(chalk.red("❌ Failed to update entity:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  } finally {
    await manipulator.cleanup();
  }
}
