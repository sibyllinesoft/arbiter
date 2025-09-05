/**
 * SQLite database layer using Bun's native sqlite driver
 */
import { Database } from "bun:sqlite";
import type { Event, EventType, Fragment, Project, ServerConfig, Version } from "./types.ts";

export class SpecWorkbenchDB {
  private db: Database;

  constructor(config: ServerConfig) {
    this.db = new Database(config.database_path, { create: true });
    this.initializeSchema();
  }

  /**
   * Initialize database schema with proper indices
   */
  private initializeSchema(): void {
    // Enable WAL mode for better concurrent access
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA cache_size = 1000");
    this.db.exec("PRAGMA temp_store = memory");

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fragments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE (project_id, path)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        spec_hash TEXT NOT NULL,
        resolved_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE (project_id, spec_hash)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      )
    `);

    // Create indices for performance
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_fragments_project_id ON fragments (project_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_fragments_path ON fragments (project_id, path)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions (project_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_versions_hash ON versions (spec_hash)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_events_project_id ON events (project_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC)");

    // Trigger to update updated_at on projects
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
      AFTER UPDATE ON projects
      FOR EACH ROW
      BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);

    // Trigger to update updated_at on fragments
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_fragments_updated_at
      AFTER UPDATE ON fragments
      FOR EACH ROW
      BEGIN
        UPDATE fragments SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);
  }

  // Project operations
  async createProject(id: string, name: string): Promise<Project> {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name) VALUES (?, ?)
      RETURNING id, name, created_at, updated_at
    `);

    const result = stmt.get(id, name) as Project;
    if (!result) {
      throw new Error("Failed to create project");
    }
    return result;
  }

  async getProject(id: string): Promise<Project | null> {
    const stmt = this.db.prepare("SELECT * FROM projects WHERE id = ?");
    return stmt.get(id) as Project | null;
  }

  async listProjects(): Promise<Project[]> {
    const stmt = this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC");
    return stmt.all() as Project[];
  }

  async deleteProject(id: string): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM projects WHERE id = ?");
    const result = stmt.run(id);
    if (result.changes === 0) {
      throw new Error("Project not found");
    }
  }

  // Fragment operations
  async createFragment(
    id: string,
    projectId: string,
    path: string,
    content: string,
  ): Promise<Fragment> {
    const stmt = this.db.prepare(`
      INSERT INTO fragments (id, project_id, path, content) 
      VALUES (?, ?, ?, ?)
      RETURNING id, project_id, path, content, created_at, updated_at
    `);

    const result = stmt.get(id, projectId, path, content) as Fragment;
    if (!result) {
      throw new Error("Failed to create fragment");
    }
    return result;
  }

  async updateFragment(projectId: string, path: string, content: string): Promise<Fragment> {
    const stmt = this.db.prepare(`
      UPDATE fragments 
      SET content = ?
      WHERE project_id = ? AND path = ?
      RETURNING id, project_id, path, content, created_at, updated_at
    `);

    const result = stmt.get(content, projectId, path) as Fragment | undefined;
    if (!result) {
      throw new Error("Fragment not found");
    }
    return result;
  }

  async getFragment(projectId: string, path: string): Promise<Fragment | null> {
    const stmt = this.db.prepare("SELECT * FROM fragments WHERE project_id = ? AND path = ?");
    return stmt.get(projectId, path) as Fragment | null;
  }

  async listFragments(projectId: string): Promise<Fragment[]> {
    const stmt = this.db.prepare("SELECT * FROM fragments WHERE project_id = ? ORDER BY path");
    return stmt.all(projectId) as Fragment[];
  }

  async deleteFragment(projectId: string, path: string): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM fragments WHERE project_id = ? AND path = ?");
    const result = stmt.run(projectId, path);
    if (result.changes === 0) {
      throw new Error("Fragment not found");
    }
  }

  // Version operations
  async createVersion(
    id: string,
    projectId: string,
    specHash: string,
    resolvedJson: string,
  ): Promise<Version> {
    const stmt = this.db.prepare(`
      INSERT INTO versions (id, project_id, spec_hash, resolved_json)
      VALUES (?, ?, ?, ?)
      RETURNING id, project_id, spec_hash, resolved_json, created_at
    `);

    const result = stmt.get(id, projectId, specHash, resolvedJson) as Version;
    if (!result) {
      throw new Error("Failed to create version");
    }
    return result;
  }

  async getVersionByHash(projectId: string, specHash: string): Promise<Version | null> {
    const stmt = this.db.prepare("SELECT * FROM versions WHERE project_id = ? AND spec_hash = ?");
    return stmt.get(projectId, specHash) as Version | null;
  }

  async getLatestVersion(projectId: string): Promise<Version | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM versions 
      WHERE project_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    return stmt.get(projectId) as Version | null;
  }

  async listVersions(projectId: string): Promise<Version[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM versions 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(projectId) as Version[];
  }

  // Event operations
  async createEvent(
    id: string,
    projectId: string,
    eventType: EventType,
    data: Record<string, unknown>,
  ): Promise<Event> {
    const stmt = this.db.prepare(`
      INSERT INTO events (id, project_id, event_type, data)
      VALUES (?, ?, ?, ?)
      RETURNING id, project_id, event_type, data, created_at
    `);

    const result = stmt.get(id, projectId, eventType, JSON.stringify(data)) as Event & {
      data: string;
    };

    if (!result) {
      throw new Error("Failed to create event");
    }

    return {
      ...result,
      data: JSON.parse(result.data),
    };
  }

  async getEvents(projectId: string, limit: number = 100, since?: string): Promise<Event[]> {
    let query = `
      SELECT * FROM events 
      WHERE project_id = ?
    `;
    const params: any[] = [projectId];

    if (since) {
      query += " AND created_at > ?";
      params.push(since);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as (Event & { data: string })[];

    return results.map((event) => ({
      ...event,
      data: JSON.parse(event.data),
    }));
  }

  // Transaction support
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // Cleanup and maintenance
  async vacuum(): Promise<void> {
    this.db.exec("VACUUM");
  }

  close(): void {
    this.db.close();
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = this.db.prepare("SELECT 1 as ok").get();
      return (result as any)?.ok === 1;
    } catch {
      return false;
    }
  }
}
