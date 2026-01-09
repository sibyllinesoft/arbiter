#!/usr/bin/env bun
/**
 * Database migration runner
 */
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { logger } from "../io/utils";

interface Migration {
  id: string;
  name: string;
  up: string;
  down?: string;
}

const migrations: Migration[] = [
  {
    id: "001",
    name: "initial_schema",
    up: `
      -- Enable WAL mode for better concurrent access
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = 1000;
      PRAGMA temp_store = memory;

      -- Create tables
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS fragments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE (project_id, path)
      );

      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        spec_hash TEXT NOT NULL,
        resolved_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE (project_id, spec_hash)
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      );

      -- Create indices for performance
      CREATE INDEX IF NOT EXISTS idx_fragments_project_id ON fragments (project_id);
      CREATE INDEX IF NOT EXISTS idx_fragments_path ON fragments (project_id, path);
      CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions (project_id);
      CREATE INDEX IF NOT EXISTS idx_versions_hash ON versions (spec_hash);
      CREATE INDEX IF NOT EXISTS idx_events_project_id ON events (project_id);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);

      -- Trigger to update updated_at on projects
      CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
      AFTER UPDATE ON projects
      FOR EACH ROW
      BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      -- Trigger to update updated_at on fragments
      CREATE TRIGGER IF NOT EXISTS update_fragments_updated_at
      AFTER UPDATE ON fragments
      FOR EACH ROW
      BEGIN
        UPDATE fragments SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `,
    down: `
      DROP TRIGGER IF EXISTS update_fragments_updated_at;
      DROP TRIGGER IF EXISTS update_projects_updated_at;
      DROP INDEX IF EXISTS idx_events_created_at;
      DROP INDEX IF EXISTS idx_events_project_id;
      DROP INDEX IF EXISTS idx_versions_hash;
      DROP INDEX IF EXISTS idx_versions_project_id;
      DROP INDEX IF EXISTS idx_fragments_path;
      DROP INDEX IF EXISTS idx_fragments_project_id;
      DROP TABLE IF EXISTS events;
      DROP TABLE IF EXISTS versions;
      DROP TABLE IF EXISTS fragments;
      DROP TABLE IF EXISTS projects;
    `,
  },
];

class MigrationRunner {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true });
    this.initializeMigrationTable();
  }

  private initializeMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  private getAppliedMigrations(): Set<string> {
    const stmt = this.db.prepare("SELECT id FROM migrations");
    const results = stmt.all() as { id: string }[];
    return new Set(results.map((r) => r.id));
  }

  private recordMigration(id: string, name: string): void {
    const stmt = this.db.prepare("INSERT INTO migrations (id, name) VALUES (?, ?)");
    stmt.run(id, name);
  }

  private removeMigration(id: string): void {
    const stmt = this.db.prepare("DELETE FROM migrations WHERE id = ?");
    stmt.run(id);
  }

  async runMigrations(): Promise<void> {
    await this.runDrizzleMigrations();

    const applied = this.getAppliedMigrations();
    const pending = migrations.filter((m) => !applied.has(m.id));

    if (pending.length === 0) {
      logger.info("No pending migrations");
      return;
    }

    logger.info(`Running ${pending.length} pending migrations`);

    for (const migration of pending) {
      try {
        logger.info(`Applying migration: ${migration.id} - ${migration.name}`);

        // Execute migration (some commands can't be in transactions)
        this.db.exec(migration.up);
        this.recordMigration(migration.id, migration.name);

        logger.info(`✅ Migration ${migration.id} applied successfully`);
      } catch (error) {
        logger.error(
          `❌ Migration ${migration.id} failed`,
          error instanceof Error ? error : undefined,
        );
        throw error;
      }
    }

    logger.info("All migrations completed successfully");
  }

  private async runDrizzleMigrations(): Promise<void> {
    const migrationsDir = new URL("../../drizzle", import.meta.url).pathname;

    if (!existsSync(migrationsDir)) {
      return;
    }

    logger.info("Running Drizzle migrations", { migrationsDir });

    try {
      await migrate(drizzle(this.db), { migrationsFolder: migrationsDir });
      logger.info("Drizzle migrations completed successfully");
    } catch (error) {
      logger.error("Drizzle migrations failed", error instanceof Error ? error : undefined);
      throw error;
    }
  }

  async rollbackMigration(id: string): Promise<void> {
    const migration = migrations.find((m) => m.id === id);

    if (!migration) {
      throw new Error(`Migration ${id} not found`);
    }

    if (!migration.down) {
      throw new Error(`Migration ${id} has no rollback script`);
    }

    const applied = this.getAppliedMigrations();

    if (!applied.has(id)) {
      throw new Error(`Migration ${id} has not been applied`);
    }

    try {
      logger.info(`Rolling back migration: ${migration.id} - ${migration.name}`);

      // Execute rollback
      this.db.exec(migration.down!);
      this.removeMigration(migration.id);

      logger.info(`✅ Migration ${migration.id} rolled back successfully`);
    } catch (error) {
      logger.error(
        `❌ Rollback of migration ${migration.id} failed`,
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }

  listMigrations(): void {
    const applied = this.getAppliedMigrations();

    logger.info("Migration Status:");
    console.log("==================");

    for (const migration of migrations) {
      const status = applied.has(migration.id) ? "✅ Applied" : "⏳ Pending";
      console.log(`${status} ${migration.id} - ${migration.name}`);
    }
  }

  close(): void {
    this.db.close();
  }
}

// CLI interface
async function main() {
  const dbPath = process.env.DATABASE_PATH || "./spec_workbench.db";
  const runner = new MigrationRunner(dbPath);

  try {
    const command = process.argv[2];

    switch (command) {
      case "up":
        await runner.runMigrations();
        break;

      case "down": {
        const migrationId = process.argv[3];
        if (!migrationId) {
          console.error("Usage: bun run migrate down <migration_id>");
          process.exit(1);
        }
        await runner.rollbackMigration(migrationId);
        break;
      }

      case "status":
        runner.listMigrations();
        break;

      default:
        // Default to running migrations
        await runner.runMigrations();
        break;
    }
  } catch (error) {
    logger.error("Migration failed", error instanceof Error ? error : undefined);
    process.exit(1);
  } finally {
    runner.close();
  }
}

if (import.meta.main) {
  main();
}
