/**
 * SQLite database layer using Bun's native sqlite driver
 */
import { Database } from 'bun:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import type {
  Event,
  EventType,
  Fragment,
  FragmentRevision,
  Project,
  ServerConfig,
  Version,
} from './types.ts';

export class SpecWorkbenchDB {
  private db: Database;

  constructor(config: ServerConfig) {
    this.db = new Database(config.database_path, { create: true });
    this.initializeSchema();
  }

  /**
   * Configure SQLite pragmas for optimal performance
   */
  private configurePragmas(): void {
    // Enable WAL mode for better concurrent access
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA cache_size = 1000');
    this.db.exec('PRAGMA temp_store = memory');
  }

  /**
   * Handle schema migrations (add columns if needed)
   */
  private handleSchemaMigrations(): void {
    // Schema migration - add head_revision_id column if it doesn't exist
    try {
      this.db.exec('ALTER TABLE fragments ADD COLUMN head_revision_id TEXT');
    } catch (error) {
      // Column already exists or table doesn't exist yet, ignore
    }
  }

  /**
   * Create the projects table
   */
  private createProjectsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Create the fragments table
   */
  private createFragmentsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fragments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        head_revision_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE (project_id, path)
      )
    `);
  }

  /**
   * Create the fragment_revisions table
   */
  private createFragmentRevisionsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fragment_revisions (
        id TEXT PRIMARY KEY,
        fragment_id TEXT NOT NULL,
        revision_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        author TEXT,
        message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (fragment_id) REFERENCES fragments (id) ON DELETE CASCADE,
        UNIQUE (fragment_id, revision_number)
      )
    `);
  }

  /**
   * Create the versions table
   */
  private createVersionsTable(): void {
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
  }

  /**
   * Create the events table
   */
  private createEventsTable(): void {
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
  }

  /**
   * Create all database tables
   */
  private createTables(): void {
    this.createProjectsTable();
    this.createFragmentsTable();
    this.createFragmentRevisionsTable();
    this.createVersionsTable();
    this.createEventsTable();
  }

  /**
   * Create performance indices for tables
   */
  private createIndices(): void {
    // Fragment indices
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_fragments_project_id ON fragments (project_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_fragments_path ON fragments (project_id, path)');

    // Fragment revision indices
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_fragment_revisions_fragment_id ON fragment_revisions (fragment_id)'
    );
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_fragment_revisions_revision_number ON fragment_revisions (fragment_id, revision_number)'
    );
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_fragment_revisions_content_hash ON fragment_revisions (content_hash)'
    );

    // Version indices
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions (project_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_versions_hash ON versions (spec_hash)');

    // Event indices
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_events_project_id ON events (project_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC)');
  }

  /**
   * Create database triggers for automatic timestamp updates
   */
  private createTriggers(): void {
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

  /**
   * Initialize database schema with proper indices
   */
  private initializeSchema(): void {
    this.configurePragmas();
    this.handleSchemaMigrations();
    this.createTables();
    this.createIndices();
    this.createTriggers();
  }

  // Project operations
  async createProject(id: string, name: string): Promise<Project> {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name) VALUES (?, ?)
      RETURNING id, name, created_at, updated_at
    `);

    const result = stmt.get(id, name) as Project;
    if (!result) {
      throw new Error('Failed to create project');
    }
    return result;
  }

  async getProject(id: string): Promise<Project | null> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id) as Project | null;
  }

  async listProjects(): Promise<Project[]> {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    return stmt.all() as Project[];
  }

  async deleteProject(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes === 0) {
      throw new Error('Project not found');
    }
  }

  // Fragment operations
  async createFragment(
    id: string,
    projectId: string,
    path: string,
    content: string,
    author?: string,
    message?: string
  ): Promise<Fragment> {
    return this.transaction(() => {
      // Create fragment
      const stmt = this.db.prepare(`
        INSERT INTO fragments (id, project_id, path, content) 
        VALUES (?, ?, ?, ?)
        RETURNING id, project_id, path, content, head_revision_id, created_at, updated_at
      `);

      const fragment = stmt.get(id, projectId, path, content) as Fragment;
      if (!fragment) {
        throw new Error('Failed to create fragment');
      }

      // Create initial revision
      const revisionId = this.generateId();
      const contentHash = createHash('sha256').update(content).digest('hex');

      this.createFragmentRevision(
        revisionId,
        id,
        1, // Initial revision number
        content,
        contentHash,
        author,
        message || 'Initial fragment creation'
      );

      // Update fragment with head revision pointer
      const updateStmt = this.db.prepare(`
        UPDATE fragments SET head_revision_id = ? WHERE id = ?
      `);
      updateStmt.run(revisionId, id);

      // Return updated fragment
      const getStmt = this.db.prepare('SELECT * FROM fragments WHERE id = ?');
      return getStmt.get(id) as Fragment;
    });
  }

  async updateFragment(
    projectId: string,
    path: string,
    content: string,
    author?: string,
    message?: string
  ): Promise<Fragment> {
    return this.transaction(() => {
      // Get existing fragment
      const existingFragment = this.getFragment(projectId, path);
      if (!existingFragment) {
        throw new Error('Fragment not found');
      }

      // Create content hash for deduplication
      const contentHash = createHash('sha256').update(content).digest('hex');

      // Check if content has actually changed
      if (existingFragment.content === content) {
        return existingFragment; // No change, return existing
      }

      // Get next revision number
      const nextRevisionNumber = this.getNextRevisionNumber(existingFragment.id);

      // Create new revision
      const revisionId = this.generateId();
      const revision = this.createFragmentRevision(
        revisionId,
        existingFragment.id,
        nextRevisionNumber,
        content,
        contentHash,
        author,
        message
      );

      // Update fragment with new content and head revision pointer
      const stmt = this.db.prepare(`
        UPDATE fragments 
        SET content = ?, head_revision_id = ?
        WHERE project_id = ? AND path = ?
        RETURNING id, project_id, path, content, head_revision_id, created_at, updated_at
      `);

      const result = stmt.get(content, revisionId, projectId, path) as Fragment | undefined;
      if (!result) {
        throw new Error('Failed to update fragment');
      }
      return result;
    });
  }

  getFragment(projectId: string, path: string): Fragment | null {
    const stmt = this.db.prepare('SELECT * FROM fragments WHERE project_id = ? AND path = ?');
    return stmt.get(projectId, path) as Fragment | null;
  }

  async getFragmentById(id: string): Promise<Fragment | null> {
    const stmt = this.db.prepare('SELECT * FROM fragments WHERE id = ?');
    return stmt.get(id) as Fragment | null;
  }

  async listFragments(projectId: string): Promise<Fragment[]> {
    const stmt = this.db.prepare('SELECT * FROM fragments WHERE project_id = ? ORDER BY path');
    return stmt.all(projectId) as Fragment[];
  }

  async deleteFragment(projectId: string, path: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM fragments WHERE project_id = ? AND path = ?');
    const result = stmt.run(projectId, path);
    if (result.changes === 0) {
      throw new Error('Fragment not found');
    }
  }

  // Fragment revision operations
  private generateId(): string {
    return randomUUID();
  }

  private getNextRevisionNumber(fragmentId: string): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(MAX(revision_number), 0) + 1 as next_revision
      FROM fragment_revisions 
      WHERE fragment_id = ?
    `);
    const result = stmt.get(fragmentId) as { next_revision: number };
    return result.next_revision;
  }

  async createFragmentRevision(
    id: string,
    fragmentId: string,
    revisionNumber: number,
    content: string,
    contentHash: string,
    author?: string,
    message?: string
  ): Promise<FragmentRevision> {
    const stmt = this.db.prepare(`
      INSERT INTO fragment_revisions (id, fragment_id, revision_number, content, content_hash, author, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id, fragment_id, revision_number, content, content_hash, author, message, created_at
    `);

    const result = stmt.get(
      id,
      fragmentId,
      revisionNumber,
      content,
      contentHash,
      author,
      message
    ) as FragmentRevision;
    if (!result) {
      throw new Error('Failed to create fragment revision');
    }
    return result;
  }

  async getFragmentRevision(
    fragmentId: string,
    revisionNumber: number
  ): Promise<FragmentRevision | null> {
    const stmt = this.db.prepare(
      'SELECT * FROM fragment_revisions WHERE fragment_id = ? AND revision_number = ?'
    );
    return stmt.get(fragmentId, revisionNumber) as FragmentRevision | null;
  }

  async listFragmentRevisions(fragmentId: string): Promise<FragmentRevision[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM fragment_revisions 
      WHERE fragment_id = ? 
      ORDER BY revision_number DESC
    `);
    return stmt.all(fragmentId) as FragmentRevision[];
  }

  async getLatestFragmentRevision(fragmentId: string): Promise<FragmentRevision | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM fragment_revisions 
      WHERE fragment_id = ? 
      ORDER BY revision_number DESC 
      LIMIT 1
    `);
    return stmt.get(fragmentId) as FragmentRevision | null;
  }

  // Version operations
  async createVersion(
    id: string,
    projectId: string,
    specHash: string,
    resolvedJson: string
  ): Promise<Version> {
    const stmt = this.db.prepare(`
      INSERT INTO versions (id, project_id, spec_hash, resolved_json)
      VALUES (?, ?, ?, ?)
      RETURNING id, project_id, spec_hash, resolved_json, created_at
    `);

    const result = stmt.get(id, projectId, specHash, resolvedJson) as Version;
    if (!result) {
      throw new Error('Failed to create version');
    }
    return result;
  }

  async getVersionByHash(projectId: string, specHash: string): Promise<Version | null> {
    const stmt = this.db.prepare('SELECT * FROM versions WHERE project_id = ? AND spec_hash = ?');
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
    data: Record<string, unknown>
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
      throw new Error('Failed to create event');
    }

    return {
      ...result,
      data: JSON.parse(result.data),
    };
  }

  async getEvents(projectId: string, limit = 100, since?: string): Promise<Event[]> {
    let query = `
      SELECT * FROM events 
      WHERE project_id = ?
    `;
    const params: any[] = [projectId];

    if (since) {
      query += ' AND created_at > ?';
      // Convert ISO timestamp to SQLite datetime format
      const sqliteTimestamp = new Date(since)
        .toISOString()
        .replace('T', ' ')
        .replace('Z', '')
        .split('.')[0];
      params.push(sqliteTimestamp);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as (Event & { data: string })[];

    return results.map(event => ({
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
    this.db.exec('VACUUM');
  }

  close(): void {
    this.db.close();
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = this.db.prepare('SELECT 1 as ok').get();
      return (result as any)?.ok === 1;
    } catch {
      return false;
    }
  }
}
