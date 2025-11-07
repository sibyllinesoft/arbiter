import { createHash, randomUUID } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { SQL, and, desc, eq, gt, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import {
  type DatabaseClient,
  type DatabaseDriver,
  type DatabaseRuntimeContext,
  type SpecWorkbenchDrizzle,
  normalizeClient,
} from "./db/client.ts";
import type {
  ArtifactRow,
  EventRow,
  FragmentRevisionRow,
  FragmentRow,
  ProjectRow,
  VersionRow,
} from "./db/schema.ts";
import {
  events,
  artifacts,
  fragmentRevisions,
  fragments,
  projects,
  versions,
} from "./db/schema.ts";
import type {
  Event,
  EventType,
  Fragment,
  FragmentRevision,
  Project,
  ServerConfig,
  Version,
} from "./types.ts";
import { getCurrentTimestamp, logger } from "./utils.ts";

type BunSQLiteInstance = import("bun:sqlite").Database;

type DbProject = Project & {
  service_count: number;
  database_count: number;
  event_head_id?: string | null;
};

type WithMetadata<T> = T & {
  metadata?: Record<string, unknown> | null;
};

export interface SpecWorkbenchDBOptions {
  client?: DatabaseClient;
}

export class SpecWorkbenchDB {
  private static async createDefaultRuntime(config: ServerConfig): Promise<DatabaseRuntimeContext> {
    const configuredDriver = config.database?.driver ?? "bun-sqlite";

    if (configuredDriver === "cloudflare-d1") {
      const binding = SpecWorkbenchDB.resolveCloudflareD1Binding(config.database?.binding);
      const { createD1Client } = await import("./db/adapters/d1.ts");
      const client = createD1Client({ binding });
      return normalizeClient(client);
    }

    const { createBunSqliteClient } = await import("./db/adapters/bun-sqlite.ts");
    const databasePath = config.database?.path ?? config.database_path ?? "arbiter.db";
    const client = createBunSqliteClient({
      databasePath,
      pragmas: config.database?.pragmas,
    });
    return normalizeClient(client);
  }

  private static resolveCloudflareD1Binding(bindingName?: string): D1Database {
    const name = bindingName?.trim();

    if (!name) {
      throw new Error(
        "ServerConfig.database.binding must be provided when using the `cloudflare-d1` driver.",
      );
    }

    const globalAny = globalThis as Record<string, unknown>;
    const sources: Array<unknown> = [
      globalAny,
      (globalAny as { env?: Record<string, unknown> }).env,
      (globalAny as { __env__?: Record<string, unknown> }).__env__,
      (globalAny as { bindings?: Record<string, unknown> }).bindings,
      (globalAny as { __bindings__?: Record<string, unknown> }).__bindings__,
      (globalAny as { __D1_BETA__?: Record<string, unknown> }).__D1_BETA__,
      (globalAny as { __ARB_CLOUDFLARE_D1__?: unknown }).__ARB_CLOUDFLARE_D1__,
      (
        globalAny as {
          __arbiter?: { cloudflare?: { d1?: Record<string, unknown> } };
        }
      ).__arbiter?.cloudflare?.d1,
    ];

    for (const source of sources) {
      const binding = SpecWorkbenchDB.tryResolveD1From(source, name);
      if (binding) {
        return binding;
      }
    }

    throw new Error(
      `Cloudflare D1 binding "${name}" was not found on the global scope. ` +
        "Pass a D1 client via SpecWorkbenchDB.create({ client }) or expose the binding on globalThis.",
    );
  }

  private static tryResolveD1From(source: unknown, key: string): D1Database | undefined {
    if (!source) {
      return undefined;
    }

    if (SpecWorkbenchDB.isValidD1Binding(source)) {
      return source;
    }

    if (typeof source === "object" && key in source) {
      const value = (source as Record<string, unknown>)[key];
      if (SpecWorkbenchDB.isValidD1Binding(value)) {
        return value;
      }
    }

    return undefined;
  }

  private static isValidD1Binding(value: unknown): value is D1Database {
    return (
      !!value &&
      typeof value === "object" &&
      typeof (value as { prepare?: unknown }).prepare === "function"
    );
  }

  static async create(
    config: ServerConfig,
    options: SpecWorkbenchDBOptions = {},
  ): Promise<SpecWorkbenchDB> {
    const runtime = options.client
      ? normalizeClient(options.client)
      : await SpecWorkbenchDB.createDefaultRuntime(config);

    const instance = new SpecWorkbenchDB(config, runtime);
    await instance.initializeSchema();
    return instance;
  }

  private readonly drizzle: SpecWorkbenchDrizzle;
  private readonly driver: DatabaseDriver;
  private readonly raw: BunSQLiteInstance | D1Database;

  private constructor(
    private readonly config: ServerConfig,
    private readonly runtime: DatabaseRuntimeContext,
  ) {
    this.drizzle = runtime.drizzle;
    this.driver = runtime.driver;
    this.raw = runtime.raw;
  }

  private async initializeSchema(): Promise<void> {
    if (this.driver === "bun-sqlite") {
      this.configurePragmas(this.raw as BunSQLiteInstance);
    }

    await this.handleSchemaMigrations();
    await this.createTables();
    await this.createIndices();
    await this.createTriggers();
    await this.backfillArtifactDescriptions();
  }

  private configurePragmas(database: BunSQLiteInstance): void {
    try {
      database.exec("PRAGMA foreign_keys = ON");
      database.exec("PRAGMA journal_mode = WAL");
      database.exec("PRAGMA synchronous = NORMAL");
      database.exec("PRAGMA cache_size = 1000");
      database.exec("PRAGMA temp_store = memory");
    } catch (error) {
      logger.warn("Failed to configure SQLite pragmas", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async run(statement: SQL): Promise<void> {
    await this.drizzle.run(statement);
  }

  private async handleSchemaMigrations(): Promise<void> {
    const migrations: SQL[] = [
      sql.raw("ALTER TABLE fragments ADD COLUMN head_revision_id TEXT"),
      sql.raw("ALTER TABLE projects ADD COLUMN service_count INTEGER DEFAULT 0"),
      sql.raw("ALTER TABLE projects ADD COLUMN database_count INTEGER DEFAULT 0"),
      sql.raw("ALTER TABLE projects ADD COLUMN event_head_id TEXT"),
      sql.raw("ALTER TABLE events ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"),
      sql.raw("ALTER TABLE events ADD COLUMN reverted_at TEXT"),
      sql.raw("ALTER TABLE artifacts ADD COLUMN description TEXT"),
    ];

    for (const migration of migrations) {
      try {
        await this.run(migration);
      } catch {
        // Intentionally swallow errors for idempotent ALTER statements
      }
    }
  }

  private async createTables(): Promise<void> {
    const statements: SQL[] = [
      sql.raw(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          service_count INTEGER DEFAULT 0,
          database_count INTEGER DEFAULT 0,
          event_head_id TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
        )
      `),
      sql.raw(`
        CREATE TABLE IF NOT EXISTS fragments (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          path TEXT NOT NULL,
          content TEXT NOT NULL,
          head_revision_id TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
          UNIQUE (project_id, path)
        )
      `),
      sql.raw(`
        CREATE TABLE IF NOT EXISTS fragment_revisions (
          id TEXT PRIMARY KEY,
          fragment_id TEXT NOT NULL,
          revision_number INTEGER NOT NULL,
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          author TEXT,
          message TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
          FOREIGN KEY (fragment_id) REFERENCES fragments (id) ON DELETE CASCADE,
          UNIQUE (fragment_id, revision_number)
        )
      `),
      sql.raw(`
        CREATE TABLE IF NOT EXISTS versions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          spec_hash TEXT NOT NULL,
          resolved_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
          UNIQUE (project_id, spec_hash)
        )
      `),
      sql.raw(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          data TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          reverted_at TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
      `),
      sql.raw(`
        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          language TEXT,
          framework TEXT,
          metadata TEXT,
          file_path TEXT,
          confidence REAL DEFAULT 1.0,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
      `),
    ];

    for (const statement of statements) {
      await this.run(statement);
    }
  }

  private async createIndices(): Promise<void> {
    const statements: SQL[] = [
      sql.raw("CREATE INDEX IF NOT EXISTS idx_fragments_project_id ON fragments (project_id)"),
      sql.raw("CREATE INDEX IF NOT EXISTS idx_fragments_path ON fragments (project_id, path)"),
      sql.raw(
        "CREATE INDEX IF NOT EXISTS idx_fragment_revisions_fragment_id ON fragment_revisions (fragment_id)",
      ),
      sql.raw("CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions (project_id)"),
      sql.raw("CREATE INDEX IF NOT EXISTS idx_versions_hash ON versions (spec_hash)"),
      sql.raw("CREATE INDEX IF NOT EXISTS idx_events_project_id ON events (project_id)"),
      sql.raw("CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC)"),
      sql.raw("CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts (project_id)"),
      sql.raw("CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts (type)"),
    ];

    for (const statement of statements) {
      await this.run(statement);
    }
  }

  private async createTriggers(): Promise<void> {
    const statements: SQL[] = [
      sql.raw(`
        CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
        AFTER UPDATE ON projects
        FOR EACH ROW
        BEGIN
          UPDATE projects SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
        END
      `),
      sql.raw(`
        CREATE TRIGGER IF NOT EXISTS update_fragments_updated_at
        AFTER UPDATE ON fragments
        FOR EACH ROW
        BEGIN
          UPDATE fragments SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
        END
      `),
    ];

    for (const statement of statements) {
      await this.run(statement);
    }
  }

  private tryNormalizeDescription(value: unknown): string | null {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return null;
      }
      return trimmed.length > 512 ? `${trimmed.slice(0, 509)}...` : trimmed;
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if ("description" in record) {
        return this.tryNormalizeDescription(record.description);
      }
      if ("summary" in record) {
        return this.tryNormalizeDescription(record.summary);
      }
    }

    return null;
  }

  private extractDescriptionFromMetadata(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return null;
    }

    const meta = metadata as Record<string, unknown>;
    const prioritizedKeys = [
      "description",
      "summary",
      "details",
      "info",
      "package",
      "documentation",
      "doc",
      "metadata",
    ];

    for (const key of Object.keys(meta)) {
      const value = meta[key];
      const normalizedKey = key.toLowerCase();

      if (normalizedKey.includes("description") || normalizedKey === "summary") {
        const normalized = this.tryNormalizeDescription(value);
        if (normalized) {
          return normalized;
        }
      }

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        prioritizedKeys.includes(normalizedKey)
      ) {
        const nested = this.extractDescriptionFromMetadata(value);
        if (nested) {
          return nested;
        }
      }
    }

    for (const key of Object.keys(meta)) {
      const value = meta[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }

      const nested = this.extractDescriptionFromMetadata(value);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private async backfillArtifactDescriptions(): Promise<void> {
    const orm = this.drizzle as any;
    const rows = await orm
      .select({
        id: artifacts.id,
        description: artifacts.description,
        metadata: artifacts.metadata,
      })
      .from(artifacts)
      .where(isNull(artifacts.description));

    if (rows.length === 0) {
      return;
    }

    const updates: Array<{ id: string; description: string }> = [];

    for (const row of rows) {
      if (!row.metadata) {
        continue;
      }

      try {
        const parsed = JSON.parse(row.metadata) as unknown;
        const description = this.extractDescriptionFromMetadata(parsed);
        if (description) {
          updates.push({ id: row.id, description });
        }
      } catch (error) {
        logger.debug("Failed to parse artifact metadata during backfill", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (updates.length === 0) {
      return;
    }

    if (this.driver === "bun-sqlite") {
      await this.withTransaction(async (tx) => {
        for (const update of updates) {
          await tx
            .update(artifacts)
            .set({ description: update.description })
            .where(eq(artifacts.id, update.id));
        }
      });
      return;
    }

    for (const update of updates) {
      await this.drizzle
        .update(artifacts)
        .set({ description: update.description })
        .where(eq(artifacts.id, update.id));
    }
  }

  private mapProject(row: ProjectRow): DbProject {
    return {
      id: row.id,
      name: row.name,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      service_count: row.serviceCount ?? 0,
      database_count: row.databaseCount ?? 0,
      event_head_id: row.eventHeadId ?? null,
    };
  }

  private mapFragment(row: FragmentRow): Fragment {
    return {
      id: row.id,
      project_id: row.projectId,
      path: row.path,
      content: row.content,
      head_revision_id: row.headRevisionId ?? undefined,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private mapFragmentRevision(row: FragmentRevisionRow): FragmentRevision {
    return {
      id: row.id,
      fragment_id: row.fragmentId,
      revision_number: row.revisionNumber,
      content: row.content,
      content_hash: row.contentHash,
      author: row.author ?? undefined,
      message: row.message ?? undefined,
      created_at: row.createdAt,
    };
  }

  private mapVersion(row: VersionRow): Version {
    return {
      id: row.id,
      project_id: row.projectId,
      spec_hash: row.specHash,
      resolved_json: row.resolvedJson,
      created_at: row.createdAt,
    };
  }

  private parseEventData(row: EventRow): Record<string, unknown> {
    if (!row.data) {
      return {};
    }
    if (typeof row.data === "string") {
      try {
        return JSON.parse(row.data) as Record<string, unknown>;
      } catch (error) {
        logger.warn("Failed to parse event data", {
          eventId: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return {};
      }
    }
    return row.data as Record<string, unknown>;
  }

  private mapEvent(row: EventRow): Event {
    return {
      id: row.id,
      project_id: row.projectId,
      event_type: row.eventType as EventType,
      data: this.parseEventData(row),
      is_active: Boolean(row.isActive),
      reverted_at: row.revertedAt ?? null,
      created_at: row.createdAt,
    };
  }

  private mapArtifact(row: ArtifactRow): WithMetadata<any> {
    let metadata: Record<string, unknown> | null = null;
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
        if (metadata && typeof metadata === "object") {
          (metadata as Record<string, unknown>).artifactId = row.id;
        }
      } catch (error) {
        logger.warn("Failed to parse artifact metadata", {
          artifactId: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      ...row,
      metadata,
    };
  }

  private getRowsAffected(result: unknown): number {
    if (!result || typeof result !== "object") {
      return 0;
    }

    if ("rowsAffected" in result && typeof (result as any).rowsAffected === "number") {
      return (result as { rowsAffected: number }).rowsAffected;
    }

    if ("changes" in result && typeof (result as any).changes === "number") {
      return (result as { changes: number }).changes;
    }

    return 0;
  }

  private toSqliteTimestamp(iso: string): string {
    try {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) {
        return iso;
      }
      return date.toISOString().replace("T", " ").replace("Z", "").split(".")[0]!;
    } catch {
      return iso;
    }
  }

  private async withTransaction<T>(fn: (tx: SpecWorkbenchDrizzle) => Promise<T>): Promise<T> {
    if (this.driver === "bun-sqlite" && "transaction" in this.drizzle) {
      return (
        this.drizzle as SpecWorkbenchDrizzle & {
          transaction: (cb: (tx: SpecWorkbenchDrizzle) => Promise<T>) => Promise<T>;
        }
      ).transaction(fn);
    }
    return fn(this.drizzle);
  }

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.driver === "bun-sqlite" && "transaction" in this.drizzle) {
      return (
        this.drizzle as SpecWorkbenchDrizzle & {
          transaction: (cb: () => Promise<T>) => Promise<T>;
        }
      ).transaction(async () => await fn());
    }

    return await fn();
  }

  private generateId(): string {
    return randomUUID();
  }

  // Project operations -------------------------------------------------------

  async createProject(
    id: string,
    name: string,
    serviceCount = 0,
    databaseCount = 0,
  ): Promise<DbProject> {
    const [project] = await this.drizzle
      .insert(projects)
      .values({
        id,
        name,
        serviceCount,
        databaseCount,
      })
      .returning();

    if (!project) {
      throw new Error("Failed to create project");
    }
    return this.mapProject(project);
  }

  async updateProjectCounts(
    projectId: string,
    serviceCount: number,
    databaseCount: number,
  ): Promise<void> {
    await this.drizzle
      .update(projects)
      .set({
        serviceCount,
        databaseCount,
        updatedAt: getCurrentTimestamp(),
      })
      .where(eq(projects.id, projectId));
  }

  async getProject(id: string): Promise<DbProject | null> {
    const [project] = await this.drizzle
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    return project ? this.mapProject(project) : null;
  }

  async listProjects(): Promise<DbProject[]> {
    const rows = await this.drizzle.select().from(projects).orderBy(desc(projects.createdAt));
    return rows.map((row) => this.mapProject(row));
  }

  async deleteProject(id: string): Promise<void> {
    const result = await this.drizzle.delete(projects).where(eq(projects.id, id));
    if (this.getRowsAffected(result) === 0) {
      throw new Error("Project not found");
    }
  }

  // Fragment operations ------------------------------------------------------

  async createFragment(
    id: string,
    projectId: string,
    path: string,
    content: string,
    author?: string,
    message?: string,
  ): Promise<Fragment> {
    return this.withTransaction(async (tx) => {
      const [fragment] = await tx
        .insert(fragments)
        .values({
          id,
          projectId,
          path,
          content,
        })
        .returning();

      if (!fragment) {
        throw new Error("Failed to create fragment");
      }

      const revisionId = this.generateId();
      const contentHash = createHash("sha256").update(content).digest("hex");

      const [revision] = await tx
        .insert(fragmentRevisions)
        .values({
          id: revisionId,
          fragmentId: fragment.id,
          revisionNumber: 1,
          content,
          contentHash,
          author: author ?? null,
          message: message ?? "Initial fragment creation",
        })
        .returning();

      if (!revision) {
        throw new Error("Failed to create fragment revision");
      }

      const [updatedFragment] = await tx
        .update(fragments)
        .set({ headRevisionId: revision.id, content })
        .where(eq(fragments.id, fragment.id))
        .returning();

      if (!updatedFragment) {
        throw new Error("Failed to update fragment head revision");
      }

      return this.mapFragment(updatedFragment);
    });
  }

  async updateFragment(
    projectId: string,
    path: string,
    content: string,
    author?: string,
    message?: string,
  ): Promise<Fragment> {
    return this.withTransaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(fragments)
        .where(and(eq(fragments.projectId, projectId), eq(fragments.path, path)))
        .limit(1);

      if (!existing) {
        throw new Error("Fragment not found");
      }

      if (existing.content === content) {
        return this.mapFragment(existing);
      }

      const nextRevisionNumber = await this.getNextRevisionNumber(existing.id, tx);
      const revisionId = this.generateId();
      const contentHash = createHash("sha256").update(content).digest("hex");

      const [revision] = await tx
        .insert(fragmentRevisions)
        .values({
          id: revisionId,
          fragmentId: existing.id,
          revisionNumber: nextRevisionNumber,
          content,
          contentHash,
          author: author ?? null,
          message: message ?? null,
        })
        .returning();

      if (!revision) {
        throw new Error("Failed to create fragment revision");
      }

      const [updated] = await tx
        .update(fragments)
        .set({
          content,
          headRevisionId: revision.id,
          updatedAt: sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`,
        })
        .where(and(eq(fragments.projectId, projectId), eq(fragments.path, path)))
        .returning();

      if (!updated) {
        throw new Error("Failed to update fragment");
      }

      return this.mapFragment(updated);
    });
  }

  async getFragment(projectId: string, path: string): Promise<Fragment | null> {
    const [fragment] = await this.drizzle
      .select()
      .from(fragments)
      .where(and(eq(fragments.projectId, projectId), eq(fragments.path, path)))
      .limit(1);

    return fragment ? this.mapFragment(fragment) : null;
  }

  async getFragmentById(id: string): Promise<Fragment | null> {
    const [fragment] = await this.drizzle
      .select()
      .from(fragments)
      .where(eq(fragments.id, id))
      .limit(1);
    return fragment ? this.mapFragment(fragment) : null;
  }

  async listFragments(projectId: string): Promise<Fragment[]> {
    const rows = await this.drizzle
      .select()
      .from(fragments)
      .where(eq(fragments.projectId, projectId))
      .orderBy(fragments.path);
    return rows.map((row) => this.mapFragment(row));
  }

  async deleteFragment(projectId: string, path: string): Promise<void> {
    const result = await this.drizzle
      .delete(fragments)
      .where(and(eq(fragments.projectId, projectId), eq(fragments.path, path)));
    if (this.getRowsAffected(result) === 0) {
      throw new Error("Fragment not found");
    }
  }

  private async getNextRevisionNumber(
    fragmentId: string,
    tx: SpecWorkbenchDrizzle = this.drizzle,
  ): Promise<number> {
    const orm = tx as any;
    const [row] = await orm
      .select({
        nextRevision: sql<number>`COALESCE(MAX(${fragmentRevisions.revisionNumber}), 0) + 1`,
      })
      .from(fragmentRevisions)
      .where(eq(fragmentRevisions.fragmentId, fragmentId));

    return row?.nextRevision ?? 1;
  }

  async createFragmentRevision(
    id: string,
    fragmentId: string,
    revisionNumber: number,
    content: string,
    contentHash: string,
    author: string | null,
    message: string | null,
  ): Promise<FragmentRevision> {
    const [revision] = await this.drizzle
      .insert(fragmentRevisions)
      .values({
        id,
        fragmentId,
        revisionNumber,
        content,
        contentHash,
        author,
        message,
      })
      .returning();

    if (!revision) {
      throw new Error("Failed to create fragment revision");
    }

    return this.mapFragmentRevision(revision);
  }

  async getFragmentRevision(
    fragmentId: string,
    revisionNumber: number,
  ): Promise<FragmentRevision | null> {
    const [revision] = await this.drizzle
      .select()
      .from(fragmentRevisions)
      .where(
        and(
          eq(fragmentRevisions.fragmentId, fragmentId),
          eq(fragmentRevisions.revisionNumber, revisionNumber),
        ),
      )
      .limit(1);
    return revision ? this.mapFragmentRevision(revision) : null;
  }

  async listFragmentRevisions(fragmentId: string): Promise<FragmentRevision[]> {
    const rows = await this.drizzle
      .select()
      .from(fragmentRevisions)
      .where(eq(fragmentRevisions.fragmentId, fragmentId))
      .orderBy(desc(fragmentRevisions.revisionNumber));

    return rows.map((row) => this.mapFragmentRevision(row));
  }

  async getLatestFragmentRevision(fragmentId: string): Promise<FragmentRevision | null> {
    const [revision] = await this.drizzle
      .select()
      .from(fragmentRevisions)
      .where(eq(fragmentRevisions.fragmentId, fragmentId))
      .orderBy(desc(fragmentRevisions.revisionNumber))
      .limit(1);
    return revision ? this.mapFragmentRevision(revision) : null;
  }

  // Version operations -------------------------------------------------------

  async createVersion(
    id: string,
    projectId: string,
    specHash: string,
    resolvedJson: string,
  ): Promise<Version> {
    const [version] = await this.drizzle
      .insert(versions)
      .values({
        id,
        projectId,
        specHash,
        resolvedJson,
      })
      .returning();

    if (!version) {
      throw new Error("Failed to create version");
    }

    return this.mapVersion(version);
  }

  async getVersionByHash(projectId: string, specHash: string): Promise<Version | null> {
    const [version] = await this.drizzle
      .select()
      .from(versions)
      .where(and(eq(versions.projectId, projectId), eq(versions.specHash, specHash)))
      .limit(1);
    return version ? this.mapVersion(version) : null;
  }

  async getLatestVersion(projectId: string): Promise<Version | null> {
    const [version] = await this.drizzle
      .select()
      .from(versions)
      .where(eq(versions.projectId, projectId))
      .orderBy(desc(versions.createdAt), desc(sql`rowid`))
      .limit(1);
    return version ? this.mapVersion(version) : null;
  }

  async listVersions(projectId: string): Promise<Version[]> {
    const rows = await this.drizzle
      .select()
      .from(versions)
      .where(eq(versions.projectId, projectId))
      .orderBy(desc(versions.createdAt), desc(sql`rowid`));
    return rows.map((row) => this.mapVersion(row));
  }

  // Event operations ---------------------------------------------------------

  private async getEventByIdInternal(
    id: string,
    tx: SpecWorkbenchDrizzle = this.drizzle,
  ): Promise<Event | null> {
    const [row] = await tx.select().from(events).where(eq(events.id, id)).limit(1);
    return row ? this.mapEvent(row) : null;
  }

  async createEvent(
    id: string,
    projectId: string,
    eventType: EventType,
    data: Record<string, unknown>,
  ): Promise<Event> {
    const result = await this.withTransaction(async (tx) => {
      const [inserted] = await tx
        .insert(events)
        .values({
          id,
          projectId,
          eventType,
          data: JSON.stringify(data),
        })
        .returning();

      if (!inserted) {
        throw new Error("Failed to create event");
      }

      const event = this.mapEvent(inserted);
      return this.finalizeEventCreation(projectId, event, tx);
    });

    return result;
  }

  private async finalizeEventCreation(
    projectId: string,
    event: Event,
    tx: SpecWorkbenchDrizzle,
  ): Promise<Event> {
    const orm = tx as any;
    const [projectRow] = await orm
      .select({
        eventHeadId: projects.eventHeadId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!projectRow) {
      throw new Error(`Project ${projectId} not found`);
    }

    const headEventId = projectRow.eventHeadId ?? null;

    const activateEvent = async () => {
      await tx.update(events).set({ isActive: 1, revertedAt: null }).where(eq(events.id, event.id));
    };

    const deactivateEvent = async () => {
      await tx
        .update(events)
        .set({
          isActive: 0,
          revertedAt: getCurrentTimestamp(),
        })
        .where(eq(events.id, event.id));
    };

    if (!headEventId) {
      await tx.update(projects).set({ eventHeadId: event.id }).where(eq(projects.id, projectId));
      await activateEvent();
    } else if (headEventId === event.id) {
      await activateEvent();
    } else {
      const [headRow] = await orm
        .select({ createdAt: events.createdAt })
        .from(events)
        .where(eq(events.id, headEventId))
        .limit(1);

      if (!headRow) {
        await tx.update(projects).set({ eventHeadId: event.id }).where(eq(projects.id, projectId));
        await activateEvent();
      } else if (event.created_at <= headRow.createdAt) {
        await activateEvent();
      } else {
        await tx.update(projects).set({ eventHeadId: event.id }).where(eq(projects.id, projectId));
        await activateEvent();
      }
    }

    const updated = await this.getEventByIdInternal(event.id, tx);
    if (!updated) {
      throw new Error("Failed to fetch event after creation");
    }
    return updated;
  }

  getEventById(eventId: string): Promise<Event | null> {
    return this.getEventByIdInternal(eventId);
  }

  async getEvents(
    projectId: string,
    limit = 100,
    since?: string,
    includeDangling = true,
  ): Promise<Event[]> {
    const conditions: SQL[] = [eq(events.projectId, projectId)];

    if (since) {
      conditions.push(gte(events.createdAt, this.toSqliteTimestamp(since)));
    }

    if (!includeDangling) {
      conditions.push(eq(events.isActive, 1));
    }

    let whereClause: SQL | undefined = conditions[0];
    for (let i = 1; i < conditions.length; i += 1) {
      whereClause = whereClause ? and(whereClause, conditions[i]) : conditions[i];
    }

    const orm = this.drizzle as any;
    let query = orm.select().from(events);
    if (whereClause) {
      query = query.where(whereClause);
    }

    const rows = (await query.orderBy(desc(events.createdAt)).limit(limit)) as EventRow[];

    return rows.map((row: EventRow) => this.mapEvent(row));
  }

  async listEvents(projectId: string, limit = 100): Promise<Event[]> {
    return this.getEvents(projectId, limit);
  }

  async listEventsByType(projectId: string, eventType: EventType): Promise<Event[]> {
    const orm = this.drizzle as any;
    const rows = (await orm
      .select()
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.eventType, eventType)))
      .orderBy(desc(events.createdAt))) as EventRow[];
    return rows.map((row: EventRow) => this.mapEvent(row));
  }

  async getProjectEventHead(projectId: string): Promise<Event | null> {
    const orm = this.drizzle as any;
    const [projectRow] = (await orm
      .select({ eventHeadId: projects.eventHeadId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)) as Array<{ eventHeadId: string | null }>;

    if (!projectRow) {
      throw new Error(`Project ${projectId} not found`);
    }

    const headEventId = projectRow.eventHeadId ?? null;

    if (!headEventId) {
      const [latestActive] = (await orm
        .select()
        .from(events)
        .where(and(eq(events.projectId, projectId), eq(events.isActive, 1)))
        .orderBy(desc(events.createdAt))
        .limit(1)) as EventRow[];
      return latestActive ? this.mapEvent(latestActive) : null;
    }

    return this.getEventById(headEventId);
  }

  async setEventHead(
    projectId: string,
    headEventId: string | null,
  ): Promise<{
    head: Event | null;
    reactivatedEventIds: string[];
    deactivatedEventIds: string[];
  }> {
    return this.withTransaction(async (tx) => {
      const orm = tx as any;
      const [projectRow] = (await orm
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)) as Array<{ id: string }>;

      if (!projectRow) {
        throw new Error(`Project ${projectId} not found`);
      }

      let targetHeadId: string | null = null;
      let headTimestamp: string | null = null;

      if (headEventId) {
        const [headRow] = (await orm
          .select({ id: events.id, createdAt: events.createdAt })
          .from(events)
          .where(and(eq(events.id, headEventId), eq(events.projectId, projectId)))
          .limit(1)) as Array<{ id: string; createdAt: string }>;

        if (!headRow) {
          throw new Error("Head event not found for project");
        }

        targetHeadId = headRow.id;
        headTimestamp = headRow.createdAt;
      }

      let reactivatedEventIds: string[] = [];
      let deactivatedEventIds: string[] = [];

      if (headTimestamp) {
        const toReactivate = (await orm
          .select({ id: events.id })
          .from(events)
          .where(
            and(
              eq(events.projectId, projectId),
              lte(events.createdAt, headTimestamp),
              eq(events.isActive, 0),
            ),
          )) as Array<{ id: string }>;

        const toDeactivate = (await orm
          .select({ id: events.id })
          .from(events)
          .where(
            and(
              eq(events.projectId, projectId),
              gt(events.createdAt, headTimestamp),
              eq(events.isActive, 1),
            ),
          )) as Array<{ id: string }>;

        reactivatedEventIds = toReactivate.map((row) => row.id);
        deactivatedEventIds = toDeactivate.map((row) => row.id);

        if (reactivatedEventIds.length > 0) {
          await tx
            .update(events)
            .set({ isActive: 1, revertedAt: null })
            .where(
              and(
                eq(events.projectId, projectId),
                lte(events.createdAt, headTimestamp),
                eq(events.isActive, 0),
              ),
            );
        }

        if (deactivatedEventIds.length > 0) {
          await tx
            .update(events)
            .set({ isActive: 0, revertedAt: getCurrentTimestamp() })
            .where(
              and(
                eq(events.projectId, projectId),
                gt(events.createdAt, headTimestamp),
                eq(events.isActive, 1),
              ),
            );
        }
      } else {
        await tx
          .update(events)
          .set({ isActive: 0, revertedAt: getCurrentTimestamp() })
          .where(and(eq(events.projectId, projectId), eq(events.isActive, 1)));
        deactivatedEventIds = (
          (await orm
            .select({ id: events.id })
            .from(events)
            .where(and(eq(events.projectId, projectId), eq(events.isActive, 1)))) as Array<{
            id: string;
          }>
        ).map((row) => row.id);
      }

      await tx
        .update(projects)
        .set({ eventHeadId: targetHeadId })
        .where(eq(projects.id, projectId));

      const head = targetHeadId ? await this.getEventByIdInternal(targetHeadId, tx) : null;

      return {
        head,
        reactivatedEventIds,
        deactivatedEventIds,
      };
    });
  }

  async reactivateEvents(projectId: string, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) {
      return;
    }

    await this.drizzle
      .update(events)
      .set({ isActive: 1, revertedAt: null })
      .where(and(eq(events.projectId, projectId), inArray(events.id, eventIds)));
  }

  async revertEvents(projectId: string, eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) {
      return;
    }

    const timestamp = getCurrentTimestamp();

    await this.drizzle
      .update(events)
      .set({ isActive: 0, revertedAt: timestamp })
      .where(and(eq(events.projectId, projectId), inArray(events.id, eventIds)));
  }

  // Artifact operations ------------------------------------------------------

  async createArtifact(
    id: string,
    projectId: string,
    name: string,
    description: string | null,
    type: string,
    language?: string | null,
    framework?: string | null,
    metadata?: Record<string, unknown> | null,
    filePath?: string | null,
    confidence?: number,
  ): Promise<WithMetadata<any>> {
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    const [created] = await this.drizzle
      .insert(artifacts)
      .values({
        id,
        projectId,
        name,
        description,
        type,
        language: language ?? null,
        framework: framework ?? null,
        metadata: metadataJson,
        filePath: filePath ?? null,
        confidence:
          typeof confidence === "number" && Number.isFinite(confidence) ? confidence : 0.95,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create artifact");
    }

    return this.mapArtifact(created);
  }

  async getArtifacts(projectId: string): Promise<Array<WithMetadata<any>>> {
    const rows = await this.drizzle
      .select()
      .from(artifacts)
      .where(eq(artifacts.projectId, projectId));

    return rows.map((row) => this.mapArtifact(row));
  }

  async getArtifact(projectId: string, artifactId: string): Promise<WithMetadata<any> | null> {
    const [row] = await this.drizzle
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.id, artifactId)))
      .limit(1);
    return row ? this.mapArtifact(row) : null;
  }

  async getArtifactsByType(projectId: string, type: string): Promise<Array<WithMetadata<any>>> {
    const rows = await this.drizzle
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.type, type)))
      .orderBy(artifacts.createdAt);
    return rows.map((row) => this.mapArtifact(row));
  }

  async updateArtifact(
    projectId: string,
    artifactId: string,
    updates: {
      name: string;
      description: string | null;
      type: string;
      language?: string | null;
      framework?: string | null;
      metadata?: Record<string, unknown> | undefined;
      filePath?: string | null;
      confidence?: number;
    },
  ): Promise<WithMetadata<any>> {
    const metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    const confidence =
      typeof updates.confidence === "number" && Number.isFinite(updates.confidence)
        ? updates.confidence
        : 0.95;

    const result = await this.drizzle
      .update(artifacts)
      .set({
        name: updates.name,
        description: updates.description ?? null,
        type: updates.type,
        language: updates.language ?? null,
        framework: updates.framework ?? null,
        metadata,
        filePath: updates.filePath ?? null,
        confidence,
      })
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.id, artifactId)));

    if (this.getRowsAffected(result) === 0) {
      throw new Error("Failed to update artifact");
    }

    const updated = await this.getArtifact(projectId, artifactId);
    if (!updated) {
      throw new Error("Updated artifact not found");
    }

    return updated;
  }

  async deleteArtifact(projectId: string, artifactId: string): Promise<boolean> {
    const result = await this.drizzle
      .delete(artifacts)
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.id, artifactId)));
    return this.getRowsAffected(result) > 0;
  }

  async deleteArtifacts(projectId: string): Promise<void> {
    await this.drizzle.delete(artifacts).where(eq(artifacts.projectId, projectId));
  }

  // Maintenance --------------------------------------------------------------

  async vacuum(): Promise<void> {
    if (this.driver !== "bun-sqlite") {
      logger.debug("VACUUM skipped for non-sqlite driver", { driver: this.driver });
      return;
    }
    (this.raw as BunSQLiteInstance).exec("VACUUM");
  }

  async close(): Promise<void> {
    if (this.driver === "bun-sqlite") {
      (this.raw as BunSQLiteInstance).close();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.drizzle.run(sql.raw("SELECT 1"));
      return true;
    } catch (error) {
      logger.error("Database health check failed", error as Error);
      return false;
    }
  }
}
