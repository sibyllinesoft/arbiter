/**
 * @module util/db/schema-init
 * Database schema initialization and migrations.
 */

import { SQL, sql } from "drizzle-orm";
import type { SpecWorkbenchDrizzle } from "../../db/client";
import { logger } from "../../io/utils";

type BunSQLiteInstance = import("bun:sqlite").Database;

/**
 * Configures SQLite pragmas for optimal performance.
 */
export function configurePragmas(database: BunSQLiteInstance): void {
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

/**
 * Runs a SQL statement through the drizzle instance.
 */
async function run(drizzle: SpecWorkbenchDrizzle, statement: SQL): Promise<void> {
  await drizzle.run(statement);
}

/**
 * Handles schema migrations (ALTER statements that may already exist).
 */
export async function handleSchemaMigrations(drizzle: SpecWorkbenchDrizzle): Promise<void> {
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
      await run(drizzle, migration);
    } catch {
      // Intentionally swallow errors for idempotent ALTER statements
    }
  }
}

/**
 * Creates all database tables if they don't exist.
 */
export async function createTables(drizzle: SpecWorkbenchDrizzle): Promise<void> {
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
    await run(drizzle, statement);
  }
}

/**
 * Creates database indices for performance.
 */
export async function createIndices(drizzle: SpecWorkbenchDrizzle): Promise<void> {
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
    await run(drizzle, statement);
  }
}

/**
 * Creates database triggers for automatic timestamp updates.
 */
export async function createTriggers(drizzle: SpecWorkbenchDrizzle): Promise<void> {
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
    await run(drizzle, statement);
  }
}
