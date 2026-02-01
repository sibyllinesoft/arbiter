/**
 * @packageDocumentation
 * Markdown-based storage for issues and comments (Obsidian-compatible).
 *
 * Directory structure:
 * .arbiter/
 * ├── notes/          # Comments as markdown files
 * │   └── {slug}.md
 * ├── tasks/          # Issues as markdown files
 * │   └── {slug}.md
 * └── (other CUE files for groups/config)
 */

import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { createMarkdownFile, parseFrontmatter } from "./markdown.js";
import { ensureUniqueSlug, slugify } from "./slug.js";

// ============================================================================
// Types (matching CUE schema definitions)
// ============================================================================

// Types matching CUE schema definitions from spec/schema/core_types.cue and artifacts.cue
export type IssueType =
  | "issue"
  | "bug"
  | "feature"
  | "task"
  | "epic"
  | "milestone"
  | "story"
  | "spike";
export type IssueStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "closed"
  | "wontfix";
export type IssuePriority = "critical" | "high" | "medium" | "low";
export type ExternalSource = "local" | "github" | "gitlab" | "jira" | "linear";
export type CommentKind = "discussion" | "guidance" | "memory" | "decision" | "note";

/**
 * Entity reference for linking issues to spec entities
 * Matches #EntityRef from spec/schema/core_types.cue
 */
export interface EntityRef {
  type: string; // Entity type (package, resource, endpoint, group, etc.)
  slug: string; // Entity slug
  label?: string; // Optional display label
}

/**
 * Related issue reference
 */
export interface RelatedIssue {
  issue: string;
  type: "blocks" | "blocked-by" | "duplicates" | "related-to";
}

/**
 * Issue matching #IssueConfig from CUE schema
 */
export interface Issue {
  id: string;
  title: string;
  description?: string;
  type?: IssueType;
  status: IssueStatus;
  priority?: IssuePriority;
  /** References to spec entities this issue relates to */
  references?: EntityRef[];
  assignees?: string[];
  labels?: string[];
  due?: string;
  created?: string;
  updated?: string;
  closedAt?: string;
  /** Parent issue for hierarchical tracking */
  parent?: string;
  /** Milestone/group this issue belongs to */
  milestone?: string;
  related?: RelatedIssue[];
  /** Group membership */
  memberOf?: string;
  /** Story points */
  weight?: number;
  /** Time estimate in hours */
  estimate?: number;
  /** Time spent in hours */
  timeSpent?: number;
  /** External source tracking */
  source?: ExternalSource;
  externalId?: string;
  externalUrl?: string;
  // Task-specific fields (when merged from Group tasks)
  groupId?: string;
  dependsOn?: string[];
  acceptanceCriteria?: string[];
  reviewer?: string;
  estimatedHours?: number;
  actualHours?: number;
}

/**
 * Comment matching #CommentConfig from CUE schema
 */
export interface Comment {
  id: string;
  /** Markdown content */
  content: string;
  /** Entity this comment is attached to (entity slug or issue ID) */
  target: string;
  /** Type of target entity */
  targetType?: string;
  author?: string;
  /** Thread ID for grouping */
  threadId?: string;
  /** Parent comment for replies */
  parentId?: string;
  /** Comment purpose */
  kind?: CommentKind;
  tags?: string[];
  created?: string;
  edited?: string;
  resolved?: boolean;
  /** External source tracking */
  source?: ExternalSource;
  externalId?: string;
  externalUrl?: string;
}

/**
 * Output format for CLI
 */
export type OutputFormat = "table" | "json" | "yaml" | "markdown" | "cue";

/**
 * Storage configuration
 */
export interface StorageConfig {
  baseDir: string;
  notesDir: string;
  tasksDir: string;
}

// ============================================================================
// Markdown Storage Implementation
// ============================================================================

/**
 * Markdown-based storage for issues and comments.
 * Compatible with Obsidian and other markdown editors.
 */
export class Storage {
  private config: StorageConfig;
  private issuesCache: Map<string, Issue> | null = null;
  private commentsCache: Map<string, Comment> | null = null;
  // Maps ID -> filename (without .md extension)
  private issueFilenames: Map<string, string> = new Map();
  private commentFilenames: Map<string, string> = new Map();

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      baseDir: ".arbiter",
      notesDir: ".arbiter/notes",
      tasksDir: ".arbiter/tasks",
      ...config,
    };
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.config.baseDir);
    await fs.ensureDir(this.config.notesDir);
    await fs.ensureDir(this.config.tasksDir);

    // Load existing data into cache
    await this.loadIssues();
    await this.loadComments();
  }

  // --------------------------------------------------------------------------
  // Markdown File Operations
  // --------------------------------------------------------------------------

  private getTaskFilePath(filename: string): string {
    return path.join(this.config.tasksDir, `${filename}.md`);
  }

  private getNoteFilePath(filename: string): string {
    return path.join(this.config.notesDir, `${filename}.md`);
  }

  private generateSlugForIssue(issue: Issue): string {
    const baseSlug = slugify(issue.title);
    const existingSlugs = new Set(this.issueFilenames.values());
    // Remove current issue's slug if updating
    const currentFilename = this.issueFilenames.get(issue.id);
    if (currentFilename) {
      existingSlugs.delete(currentFilename);
    }
    return ensureUniqueSlug(baseSlug, existingSlugs);
  }

  private generateSlugForComment(comment: Comment): string {
    // Use first 50 chars of content or target + timestamp for slug
    const baseText = comment.content.substring(0, 50) || `${comment.target}-note`;
    const baseSlug = slugify(baseText);
    const existingSlugs = new Set(this.commentFilenames.values());
    // Remove current comment's slug if updating
    const currentFilename = this.commentFilenames.get(comment.id);
    if (currentFilename) {
      existingSlugs.delete(currentFilename);
    }
    return ensureUniqueSlug(baseSlug, existingSlugs);
  }

  private issueToFrontmatter(issue: Issue): Record<string, unknown> {
    return {
      id: issue.id,
      type: issue.type,
      status: issue.status,
      priority: issue.priority,
      assignees: issue.assignees,
      labels: issue.labels,
      due: issue.due,
      created: issue.created,
      updated: issue.updated,
      closedAt: issue.closedAt,
      references: issue.references,
      related: issue.related,
      milestone: issue.milestone,
      parent: issue.parent,
      memberOf: issue.memberOf,
      weight: issue.weight,
      estimate: issue.estimate,
      timeSpent: issue.timeSpent,
      source: issue.source,
      externalId: issue.externalId,
      externalUrl: issue.externalUrl,
      // Task-specific fields
      groupId: issue.groupId,
      dependsOn: issue.dependsOn,
      acceptanceCriteria: issue.acceptanceCriteria,
      reviewer: issue.reviewer,
      estimatedHours: issue.estimatedHours,
      actualHours: issue.actualHours,
    };
  }

  private frontmatterToIssue(
    frontmatter: Record<string, unknown>,
    body: string,
    title: string,
  ): Issue {
    return {
      id: frontmatter.id as string,
      title,
      description: body || undefined,
      type: frontmatter.type as IssueType | undefined,
      status: (frontmatter.status as IssueStatus) || "open",
      priority: frontmatter.priority as IssuePriority | undefined,
      assignees: frontmatter.assignees as string[] | undefined,
      labels: frontmatter.labels as string[] | undefined,
      due: frontmatter.due as string | undefined,
      created: frontmatter.created as string | undefined,
      updated: frontmatter.updated as string | undefined,
      closedAt: frontmatter.closedAt as string | undefined,
      references: frontmatter.references as EntityRef[] | undefined,
      related: frontmatter.related as RelatedIssue[] | undefined,
      milestone: frontmatter.milestone as string | undefined,
      parent: frontmatter.parent as string | undefined,
      memberOf: frontmatter.memberOf as string | undefined,
      weight: frontmatter.weight as number | undefined,
      estimate: frontmatter.estimate as number | undefined,
      timeSpent: frontmatter.timeSpent as number | undefined,
      source: frontmatter.source as ExternalSource | undefined,
      externalId: frontmatter.externalId as string | undefined,
      externalUrl: frontmatter.externalUrl as string | undefined,
      groupId: frontmatter.groupId as string | undefined,
      dependsOn: frontmatter.dependsOn as string[] | undefined,
      acceptanceCriteria: frontmatter.acceptanceCriteria as string[] | undefined,
      reviewer: frontmatter.reviewer as string | undefined,
      estimatedHours: frontmatter.estimatedHours as number | undefined,
      actualHours: frontmatter.actualHours as number | undefined,
    };
  }

  private commentToFrontmatter(comment: Comment): Record<string, unknown> {
    return {
      id: comment.id,
      target: comment.target,
      targetType: comment.targetType,
      author: comment.author,
      kind: comment.kind,
      tags: comment.tags,
      created: comment.created,
      edited: comment.edited,
      resolved: comment.resolved,
      threadId: comment.threadId,
      parentId: comment.parentId,
      source: comment.source,
      externalId: comment.externalId,
      externalUrl: comment.externalUrl,
    };
  }

  private frontmatterToComment(frontmatter: Record<string, unknown>, body: string): Comment {
    return {
      id: frontmatter.id as string,
      content: body,
      target: frontmatter.target as string,
      targetType: frontmatter.targetType as string | undefined,
      author: frontmatter.author as string | undefined,
      kind: frontmatter.kind as CommentKind | undefined,
      tags: frontmatter.tags as string[] | undefined,
      created: frontmatter.created as string | undefined,
      edited: frontmatter.edited as string | undefined,
      resolved: frontmatter.resolved as boolean | undefined,
      threadId: frontmatter.threadId as string | undefined,
      parentId: frontmatter.parentId as string | undefined,
      source: frontmatter.source as ExternalSource | undefined,
      externalId: frontmatter.externalId as string | undefined,
      externalUrl: frontmatter.externalUrl as string | undefined,
    };
  }

  private async writeTaskMarkdown(issue: Issue): Promise<string> {
    const slug = this.generateSlugForIssue(issue);

    // Delete old file if slug changed
    const oldFilename = this.issueFilenames.get(issue.id);
    if (oldFilename && oldFilename !== slug) {
      const oldPath = this.getTaskFilePath(oldFilename);
      if (await fs.pathExists(oldPath)) {
        await fs.remove(oldPath);
      }
    }

    const frontmatter = this.issueToFrontmatter(issue);
    // Title becomes the H1 heading, description is body
    const body = issue.description || "";
    const content = createMarkdownFile(frontmatter, `# ${issue.title}\n\n${body}`);

    const filePath = this.getTaskFilePath(slug);
    await fs.writeFile(filePath, content, "utf-8");

    this.issueFilenames.set(issue.id, slug);
    return slug;
  }

  private async writeNoteMarkdown(comment: Comment): Promise<string> {
    const slug = this.generateSlugForComment(comment);

    // Delete old file if slug changed
    const oldFilename = this.commentFilenames.get(comment.id);
    if (oldFilename && oldFilename !== slug) {
      const oldPath = this.getNoteFilePath(oldFilename);
      if (await fs.pathExists(oldPath)) {
        await fs.remove(oldPath);
      }
    }

    const frontmatter = this.commentToFrontmatter(comment);
    const content = createMarkdownFile(frontmatter, comment.content);

    const filePath = this.getNoteFilePath(slug);
    await fs.writeFile(filePath, content, "utf-8");

    this.commentFilenames.set(comment.id, slug);
    return slug;
  }

  private async deleteTaskMarkdown(issueId: string): Promise<void> {
    const filename = this.issueFilenames.get(issueId);
    if (filename) {
      const filePath = this.getTaskFilePath(filename);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
      this.issueFilenames.delete(issueId);
    }
  }

  private async deleteNoteMarkdown(commentId: string): Promise<void> {
    const filename = this.commentFilenames.get(commentId);
    if (filename) {
      const filePath = this.getNoteFilePath(filename);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
      this.commentFilenames.delete(commentId);
    }
  }

  private extractTitleFromBody(body: string): { title: string; description: string } {
    // Look for H1 heading
    const h1Match = body.match(/^#\s+(.+?)(?:\r?\n|$)/);
    if (h1Match) {
      const title = h1Match[1].trim();
      const description = body.slice(h1Match[0].length).trim();
      return { title, description };
    }
    // Fall back to first line
    const lines = body.split(/\r?\n/);
    const title = lines[0]?.trim() || "Untitled";
    const description = lines.slice(1).join("\n").trim();
    return { title, description };
  }

  private async loadIssues(): Promise<Map<string, Issue>> {
    if (this.issuesCache) return this.issuesCache;

    this.issuesCache = new Map();
    this.issueFilenames.clear();

    if (!(await fs.pathExists(this.config.tasksDir))) {
      return this.issuesCache;
    }

    const files = await fs.readdir(this.config.tasksDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = path.join(this.config.tasksDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);

      if (!frontmatter.id) continue; // Skip files without ID

      const { title, description } = this.extractTitleFromBody(body);
      const issue = this.frontmatterToIssue(frontmatter, description, title);

      this.issuesCache.set(issue.id, issue);
      this.issueFilenames.set(issue.id, file.replace(/\.md$/, ""));
    }

    return this.issuesCache;
  }

  private async loadComments(): Promise<Map<string, Comment>> {
    if (this.commentsCache) return this.commentsCache;

    this.commentsCache = new Map();
    this.commentFilenames.clear();

    if (!(await fs.pathExists(this.config.notesDir))) {
      return this.commentsCache;
    }

    const files = await fs.readdir(this.config.notesDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = path.join(this.config.notesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);

      if (!frontmatter.id) continue; // Skip files without ID

      const comment = this.frontmatterToComment(frontmatter, body);

      this.commentsCache.set(comment.id, comment);
      this.commentFilenames.set(comment.id, file.replace(/\.md$/, ""));
    }

    return this.commentsCache;
  }

  // --------------------------------------------------------------------------
  // Issues
  // --------------------------------------------------------------------------

  private generateIssueId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `i-${timestamp}-${random}`;
  }

  /**
   * Create or update an issue
   */
  async saveIssue(issue: Omit<Issue, "id"> & { id?: string }): Promise<Issue> {
    const issues = await this.loadIssues();
    const now = new Date().toISOString();

    const id = issue.id || this.generateIssueId();
    const existing = issues.get(id);

    const saved: Issue = {
      ...issue,
      id,
      created: existing?.created || issue.created || now,
      updated: now,
    };

    issues.set(id, saved);
    await this.writeTaskMarkdown(saved);

    console.log(chalk.green(`✅ Saved issue "${saved.title}"`));
    return saved;
  }

  /**
   * Get an issue by ID
   */
  async getIssue(issueId: string): Promise<Issue | null> {
    const issues = await this.loadIssues();
    return issues.get(issueId) || null;
  }

  /**
   * List issues with optional filters
   */
  async listIssues(filter?: {
    status?: IssueStatus;
    priority?: IssuePriority;
    type?: IssueType;
    entity?: string; // Filter by referenced entity
    milestone?: string;
    memberOf?: string;
    label?: string;
    assignee?: string;
  }): Promise<Issue[]> {
    const issues = await this.loadIssues();
    let result = Array.from(issues.values());

    if (filter?.status) {
      result = result.filter((i) => i.status === filter.status);
    }
    if (filter?.priority) {
      result = result.filter((i) => i.priority === filter.priority);
    }
    if (filter?.type) {
      result = result.filter((i) => i.type === filter.type);
    }
    if (filter?.entity) {
      result = result.filter((i) => i.references?.some((r) => r.slug === filter.entity));
    }
    if (filter?.milestone) {
      result = result.filter((i) => i.milestone === filter.milestone);
    }
    if (filter?.memberOf) {
      result = result.filter((i) => i.memberOf === filter.memberOf);
    }
    if (filter?.label) {
      result = result.filter((i) => i.labels?.includes(filter.label!));
    }
    if (filter?.assignee) {
      result = result.filter((i) => i.assignees?.includes(filter.assignee!));
    }

    return result;
  }

  /**
   * Delete an issue
   */
  async deleteIssue(issueId: string): Promise<boolean> {
    const issues = await this.loadIssues();

    if (!issues.has(issueId)) return false;

    issues.delete(issueId);
    await this.deleteTaskMarkdown(issueId);

    console.log(chalk.green(`✅ Deleted issue ${issueId}`));
    return true;
  }

  /**
   * Update issue status
   */
  async updateIssueStatus(issueId: string, status: IssueStatus): Promise<Issue | null> {
    const issue = await this.getIssue(issueId);
    if (!issue) return null;

    issue.status = status;
    if (status === "done" || status === "closed" || status === "wontfix") {
      issue.closedAt = new Date().toISOString();
    }

    return this.saveIssue(issue);
  }

  /**
   * Add an entity reference to an issue
   */
  async addIssueReference(
    issueId: string,
    slug: string,
    type: string,
    label?: string,
  ): Promise<Issue | null> {
    const issue = await this.getIssue(issueId);
    if (!issue) return null;

    if (!issue.references) issue.references = [];

    if (!issue.references.some((r) => r.slug === slug && r.type === type)) {
      issue.references.push({ type, slug, label });
      return this.saveIssue(issue);
    }

    return issue;
  }

  // --------------------------------------------------------------------------
  // Comments
  // --------------------------------------------------------------------------

  private generateCommentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `c-${timestamp}-${random}`;
  }

  /**
   * Add a comment
   */
  async addComment(
    target: string,
    content: string,
    options: {
      targetType?: string;
      author?: string;
      kind?: CommentKind;
      tags?: string[];
      threadId?: string;
      parentId?: string;
    } = {},
  ): Promise<Comment> {
    const comments = await this.loadComments();
    const now = new Date().toISOString();

    const comment: Comment = {
      id: this.generateCommentId(),
      content,
      target,
      targetType: options.targetType,
      author: options.author,
      kind: options.kind,
      tags: options.tags,
      threadId: options.threadId,
      parentId: options.parentId,
      created: now,
      source: "local",
    };

    comments.set(comment.id, comment);
    await this.writeNoteMarkdown(comment);

    console.log(chalk.green(`✅ Added comment ${comment.id}`));
    return comment;
  }

  /**
   * Get a comment by ID
   */
  async getComment(commentId: string): Promise<Comment | null> {
    const comments = await this.loadComments();
    return comments.get(commentId) || null;
  }

  /**
   * List comments with optional filters
   */
  async listComments(filter?: {
    target?: string; // Filter by target entity
    targetType?: string; // Filter by target type
    kind?: CommentKind;
    tag?: string;
    author?: string;
    resolved?: boolean;
  }): Promise<Comment[]> {
    const comments = await this.loadComments();
    let result = Array.from(comments.values());

    if (filter?.target) {
      result = result.filter((c) => c.target === filter.target);
    }
    if (filter?.targetType) {
      result = result.filter((c) => c.targetType === filter.targetType);
    }
    if (filter?.kind) {
      result = result.filter((c) => c.kind === filter.kind);
    }
    if (filter?.tag) {
      result = result.filter((c) => c.tags?.includes(filter.tag!));
    }
    if (filter?.author) {
      result = result.filter((c) => c.author === filter.author);
    }
    if (filter?.resolved !== undefined) {
      result = result.filter((c) => (c.resolved || false) === filter.resolved);
    }

    // Sort by creation date
    return result.sort((a, b) => (a.created || "").localeCompare(b.created || ""));
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: string, content: string): Promise<Comment | null> {
    const comments = await this.loadComments();
    const comment = comments.get(commentId);

    if (!comment) return null;

    comment.content = content;
    comment.edited = new Date().toISOString();

    await this.writeNoteMarkdown(comment);

    console.log(chalk.green(`✅ Updated comment ${commentId}`));
    return comment;
  }

  /**
   * Resolve/unresolve a comment
   */
  async resolveComment(commentId: string, resolved = true): Promise<Comment | null> {
    const comments = await this.loadComments();
    const comment = comments.get(commentId);

    if (!comment) return null;

    comment.resolved = resolved;
    comment.edited = new Date().toISOString();

    await this.writeNoteMarkdown(comment);

    return comment;
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<boolean> {
    const comments = await this.loadComments();

    if (!comments.has(commentId)) return false;

    comments.delete(commentId);
    await this.deleteNoteMarkdown(commentId);

    console.log(chalk.green(`✅ Deleted comment ${commentId}`));
    return true;
  }

  /**
   * Delete all comments for a target
   */
  async deleteTargetComments(target: string): Promise<number> {
    const comments = await this.loadComments();
    let count = 0;
    const toDelete: string[] = [];

    for (const [id, comment] of comments) {
      if (comment.target === target) {
        toDelete.push(id);
        count++;
      }
    }

    for (const id of toDelete) {
      comments.delete(id);
      await this.deleteNoteMarkdown(id);
    }

    if (count > 0) {
      console.log(chalk.green(`✅ Deleted ${count} comments for ${target}`));
    }

    return count;
  }

  // --------------------------------------------------------------------------
  // Entity Lookups
  // --------------------------------------------------------------------------

  /**
   * Get all issues referencing an entity
   */
  async getIssuesForEntity(entity: string): Promise<Issue[]> {
    return this.listIssues({ entity });
  }

  /**
   * Get all comments for an entity (including issues referencing it)
   */
  async getCommentsForEntity(entity: string): Promise<Comment[]> {
    const directComments = await this.listComments({ target: entity });

    // Also get comments on issues that reference this entity
    const relatedIssues = await this.getIssuesForEntity(entity);
    const issueComments: Comment[] = [];

    for (const issue of relatedIssues) {
      const comments = await this.listComments({ target: issue.id });
      issueComments.push(...comments);
    }

    return [...directComments, ...issueComments];
  }

  // --------------------------------------------------------------------------
  // Output Formatting
  // --------------------------------------------------------------------------

  /**
   * Format issues for output
   */
  formatIssues(issues: Issue[], format: OutputFormat): string {
    switch (format) {
      case "json":
        return JSON.stringify(issues, null, 2);

      case "yaml":
        return issues
          .map((i) => {
            const lines = [`- id: ${i.id}`, `  title: "${i.title}"`, `  status: ${i.status}`];
            if (i.priority) lines.push(`  priority: ${i.priority}`);
            if (i.type) lines.push(`  type: ${i.type}`);
            if (i.assignees?.length) lines.push(`  assignees: [${i.assignees.join(", ")}]`);
            if (i.references?.length) {
              lines.push(`  references:`);
              i.references.forEach((r) => lines.push(`    - ${r.type}:${r.slug}`));
            }
            return lines.join("\n");
          })
          .join("\n");

      case "markdown":
        return issues
          .map((i) => {
            const status =
              i.status === "done" || i.status === "closed"
                ? "✅"
                : i.status === "wontfix"
                  ? "❌"
                  : "⏳";
            const priority = i.priority ? ` [${i.priority}]` : "";
            let md = `## ${status} ${i.title}${priority}\n\n`;
            if (i.description) md += `${i.description}\n\n`;
            if (i.references?.length) {
              md += `**References:** ${i.references.map((r) => `${r.type}:${r.slug}`).join(", ")}\n`;
            }
            if (i.assignees?.length) md += `**Assignees:** ${i.assignees.join(", ")}\n`;
            return md;
          })
          .join("\n---\n\n");

      case "cue":
        // Generate CUE format for backwards compatibility
        return this.generateIssuesCue(issues);

      case "table":
      default:
        const rows = issues.map((i) => [
          i.id.substring(0, 12),
          i.status.padEnd(12),
          (i.priority || "-").padEnd(8),
          i.title.substring(0, 40),
          (i.references?.map((r) => r.slug).join(",") || "-").substring(0, 20),
        ]);
        const header = ["ID", "STATUS", "PRIORITY", "TITLE", "ENTITIES"];
        const widths = [12, 12, 8, 40, 20];

        let table = header.map((h, i) => h.padEnd(widths[i])).join("  ") + "\n";
        table += header.map((_, i) => "-".repeat(widths[i])).join("  ") + "\n";
        table += rows.map((r) => r.join("  ")).join("\n");
        return table;
    }
  }

  private generateIssuesCue(issues: Issue[]): string {
    const lines = [
      `package arbiter`,
      ``,
      `// Issues - work items tracking spec changes`,
      ``,
      `issues: {`,
    ];

    for (const issue of issues) {
      lines.push(`  "${issue.id}": {`);
      lines.push(`    title: ${JSON.stringify(issue.title)}`);
      lines.push(`    status: "${issue.status}"`);

      if (issue.description) lines.push(`    description: ${JSON.stringify(issue.description)}`);
      if (issue.type) lines.push(`    type: "${issue.type}"`);
      if (issue.priority) lines.push(`    priority: "${issue.priority}"`);
      if (issue.assignees?.length) lines.push(`    assignees: ${JSON.stringify(issue.assignees)}`);
      if (issue.labels?.length) lines.push(`    labels: ${JSON.stringify(issue.labels)}`);
      if (issue.due) lines.push(`    due: "${issue.due}"`);
      if (issue.created) lines.push(`    created: "${issue.created}"`);
      if (issue.updated) lines.push(`    updated: "${issue.updated}"`);
      if (issue.closedAt) lines.push(`    closedAt: "${issue.closedAt}"`);
      if (issue.parent) lines.push(`    parent: "${issue.parent}"`);
      if (issue.milestone) lines.push(`    milestone: "${issue.milestone}"`);
      if (issue.memberOf) lines.push(`    memberOf: "${issue.memberOf}"`);
      if (issue.weight !== undefined) lines.push(`    weight: ${issue.weight}`);
      if (issue.estimate !== undefined) lines.push(`    estimate: ${issue.estimate}`);
      if (issue.timeSpent !== undefined) lines.push(`    timeSpent: ${issue.timeSpent}`);
      if (issue.source && issue.source !== "local") lines.push(`    source: "${issue.source}"`);
      if (issue.externalId) lines.push(`    externalId: "${issue.externalId}"`);
      if (issue.externalUrl) lines.push(`    externalUrl: "${issue.externalUrl}"`);

      if (issue.references?.length) {
        lines.push(`    references: [`);
        for (const ref of issue.references) {
          if (ref.label) {
            lines.push(`      {type: "${ref.type}", slug: "${ref.slug}", label: "${ref.label}"},`);
          } else {
            lines.push(`      {type: "${ref.type}", slug: "${ref.slug}"},`);
          }
        }
        lines.push(`    ]`);
      }

      if (issue.related?.length) {
        lines.push(`    related: [`);
        for (const rel of issue.related) {
          lines.push(`      {issue: "${rel.issue}", type: "${rel.type}"},`);
        }
        lines.push(`    ]`);
      }

      lines.push(`  }`);
    }

    lines.push(`}`);
    return lines.join("\n");
  }

  /**
   * Format comments for output
   */
  formatComments(comments: Comment[], format: OutputFormat): string {
    switch (format) {
      case "json":
        return JSON.stringify(comments, null, 2);

      case "yaml":
        return comments
          .map((c) => {
            const lines = [`- id: ${c.id}`, `  target: ${c.target}`, `  content: |`];
            c.content.split("\n").forEach((l) => lines.push(`    ${l}`));
            if (c.author) lines.push(`  author: ${c.author}`);
            if (c.kind) lines.push(`  kind: ${c.kind}`);
            return lines.join("\n");
          })
          .join("\n");

      case "markdown":
        return comments
          .map((c) => {
            let md = `### ${c.target}`;
            if (c.author) md += ` — *${c.author}*`;
            if (c.created) md += ` (${c.created.split("T")[0]})`;
            md += `\n\n${c.content}\n`;
            if (c.tags?.length) md += `\n*Tags: ${c.tags.join(", ")}*\n`;
            return md;
          })
          .join("\n---\n\n");

      case "cue":
        return this.generateCommentsCue(comments);

      case "table":
      default:
        const rows = comments.map((c) => [
          c.id.substring(0, 12),
          c.target.substring(0, 15),
          (c.kind || "discussion").padEnd(10),
          c.content.substring(0, 50).replace(/\n/g, " "),
        ]);
        const header = ["ID", "TARGET", "KIND", "CONTENT"];
        const widths = [12, 15, 10, 50];

        let table = header.map((h, i) => h.padEnd(widths[i])).join("  ") + "\n";
        table += header.map((_, i) => "-".repeat(widths[i])).join("  ") + "\n";
        table += rows.map((r) => r.join("  ")).join("\n");
        return table;
    }
  }

  private generateCommentsCue(comments: Comment[]): string {
    const lines = [
      `package arbiter`,
      ``,
      `// Comments - discussions, guidance, and notes attached to entities`,
      ``,
      `comments: {`,
    ];

    for (const comment of comments) {
      lines.push(`  "${comment.id}": {`);
      lines.push(`    content: ${JSON.stringify(comment.content)}`);
      lines.push(`    target: "${comment.target}"`);

      if (comment.targetType) lines.push(`    targetType: "${comment.targetType}"`);
      if (comment.author) lines.push(`    author: "${comment.author}"`);
      if (comment.threadId) lines.push(`    threadId: "${comment.threadId}"`);
      if (comment.parentId) lines.push(`    parentId: "${comment.parentId}"`);
      if (comment.kind && comment.kind !== "discussion") lines.push(`    kind: "${comment.kind}"`);
      if (comment.tags?.length) lines.push(`    tags: ${JSON.stringify(comment.tags)}`);
      if (comment.created) lines.push(`    created: "${comment.created}"`);
      if (comment.edited) lines.push(`    edited: "${comment.edited}"`);
      if (comment.resolved) lines.push(`    resolved: true`);
      if (comment.source && comment.source !== "local")
        lines.push(`    source: "${comment.source}"`);
      if (comment.externalId) lines.push(`    externalId: "${comment.externalId}"`);
      if (comment.externalUrl) lines.push(`    externalUrl: "${comment.externalUrl}"`);

      lines.push(`  }`);
    }

    lines.push(`}`);
    return lines.join("\n");
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalIssues: number;
    issuesByStatus: Record<string, number>;
    issuesByPriority: Record<string, number>;
    totalComments: number;
    commentsByKind: Record<string, number>;
    entitiesReferenced: string[];
  }> {
    const issues = await this.loadIssues();
    const comments = await this.loadComments();

    const issuesByStatus: Record<string, number> = {};
    const issuesByPriority: Record<string, number> = {};
    const entitiesSet = new Set<string>();

    for (const issue of issues.values()) {
      issuesByStatus[issue.status] = (issuesByStatus[issue.status] || 0) + 1;
      if (issue.priority) {
        issuesByPriority[issue.priority] = (issuesByPriority[issue.priority] || 0) + 1;
      }
      issue.references?.forEach((r) => entitiesSet.add(`${r.type}:${r.slug}`));
    }

    const commentsByKind: Record<string, number> = {};
    for (const comment of comments.values()) {
      const kind = comment.kind || "discussion";
      commentsByKind[kind] = (commentsByKind[kind] || 0) + 1;
    }

    return {
      totalIssues: issues.size,
      issuesByStatus,
      issuesByPriority,
      totalComments: comments.size,
      commentsByKind,
      entitiesReferenced: Array.from(entitiesSet),
    };
  }

  /**
   * Clear cache to reload from disk
   */
  reload(): void {
    this.issuesCache = null;
    this.commentsCache = null;
    this.issueFilenames.clear();
    this.commentFilenames.clear();
  }
}

/**
 * Default storage instance
 */
export const storage = new Storage();

/**
 * Initialize the default storage
 */
export async function initializeStorage(): Promise<void> {
  await storage.initialize();
}
