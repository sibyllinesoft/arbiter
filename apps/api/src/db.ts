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
    // Enable foreign key constraints
    this.db.exec('PRAGMA foreign_keys = ON');
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

    // Schema migration - add service_count and database_count columns to projects table
    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN service_count INTEGER DEFAULT 0');
    } catch (error) {
      // Column already exists or table doesn't exist yet, ignore
    }

    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN database_count INTEGER DEFAULT 0');
    } catch (error) {
      // Column already exists or table doesn't exist yet, ignore
    }

    try {
      this.db.exec('ALTER TABLE projects ADD COLUMN event_head_id TEXT');
    } catch (error) {
      // Column already exists or table doesn't exist yet, ignore
    }

    try {
      this.db.exec('ALTER TABLE events ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    } catch (error) {
      // Column already exists or table doesn't exist yet, ignore
    }

    try {
      this.db.exec('ALTER TABLE events ADD COLUMN reverted_at TEXT');
    } catch (error) {
      // Column already exists or table doesn't exist yet, ignore
    }

    try {
      this.db.exec('ALTER TABLE artifacts ADD COLUMN description TEXT');
    } catch (error) {
      // Column already exists or table doesn't exist yet, ignore
    }

    this.backfillArtifactDescriptions();
  }

  private tryNormalizeDescription(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return null;
      }
      return trimmed.length > 512 ? `${trimmed.slice(0, 509)}...` : trimmed;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if ('description' in record) {
        return this.tryNormalizeDescription(record.description);
      }
      if ('summary' in record) {
        return this.tryNormalizeDescription(record.summary);
      }
    }

    return null;
  }

  private extractDescriptionFromMetadata(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const meta = metadata as Record<string, unknown>;
    const prioritizedKeys = [
      'description',
      'summary',
      'details',
      'info',
      'package',
      'documentation',
      'doc',
      'metadata',
    ];

    for (const key of Object.keys(meta)) {
      const value = meta[key];
      const normalizedKey = key.toLowerCase();

      if (normalizedKey.includes('description') || normalizedKey === 'summary') {
        const normalized = this.tryNormalizeDescription(value);
        if (normalized) {
          return normalized;
        }
      }

      if (
        value &&
        typeof value === 'object' &&
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
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }

      const nested = this.extractDescriptionFromMetadata(value);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private backfillArtifactDescriptions(): void {
    try {
      const tableExists = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifacts'")
        .get() as { name?: string } | undefined;

      if (!tableExists) {
        return;
      }

      const rows = this.db
        .prepare(
          `SELECT id, metadata FROM artifacts
           WHERE (description IS NULL OR TRIM(description) = '')
             AND metadata IS NOT NULL AND TRIM(metadata) != ''`
        )
        .all() as { id: string; metadata: string | null }[];

      if (!rows || rows.length === 0) {
        return;
      }

      const updates: { id: string; description: string }[] = [];

      for (const row of rows) {
        if (!row.metadata) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(row.metadata);
        } catch (error) {
          continue;
        }

        const description = this.extractDescriptionFromMetadata(parsed);
        if (description) {
          updates.push({ id: row.id, description });
        }
      }

      if (updates.length === 0) {
        return;
      }

      const updateStmt = this.db.prepare('UPDATE artifacts SET description = ? WHERE id = ?');
      this.transaction(() => {
        for (const update of updates) {
          updateStmt.run(update.description, update.id);
        }
      });
    } catch (error) {
      console.warn('[database] Failed to backfill artifact descriptions', error);
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
        service_count INTEGER DEFAULT 0,
        database_count INTEGER DEFAULT 0,
        event_head_id TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
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
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
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
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
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
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
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
        is_active INTEGER NOT NULL DEFAULT 1,
        reverted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      )
    `);
  }

  /**
   * Create the artifacts table for storing brownfield detection results
   */
  private createArtifactsTable(): void {
    this.db.exec(`
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
    this.createArtifactsTable();
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
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_events_project_active ON events (project_id, is_active)'
    );

    // Artifact indices
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts (project_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts (project_id, type)');
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
        UPDATE fragments SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
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
  async createProject(
    id: string,
    name: string,
    serviceCount = 0,
    databaseCount = 0
  ): Promise<Project> {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, service_count, database_count) VALUES (?, ?, ?, ?)
      RETURNING id, name, service_count, database_count, created_at, updated_at
    `);

    const result = stmt.get(id, name, serviceCount, databaseCount) as Project;
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
        author ?? null,
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
        author ?? null,
        message ?? null
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
    author: string | null,
    message: string | null
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
      author ?? null,
      message ?? null
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
  private mapEventRow(row: any): Event | null {
    if (!row) {
      return null;
    }

    const data =
      typeof row.data === 'string'
        ? JSON.parse(row.data)
        : ((row.data as Record<string, unknown> | undefined) ?? {});

    return {
      id: row.id as string,
      project_id: row.project_id as string,
      event_type: row.event_type as EventType,
      data,
      is_active: row.is_active === 1 || row.is_active === true,
      reverted_at: row.reverted_at ?? null,
      created_at: row.created_at as string,
    };
  }

  private finalizeEventCreation(projectId: string, event: Event): Event {
    return this.transaction(() => {
      const projectRow = this.db
        .prepare('SELECT event_head_id FROM projects WHERE id = ?')
        .get(projectId) as { event_head_id?: string | null } | undefined;

      if (!projectRow) {
        throw new Error(`Project ${projectId} not found`);
      }

      const headEventId = projectRow.event_head_id ?? null;

      // helper closures reuse to avoid duplication
      const activateEvent = () => {
        this.db
          .prepare(`UPDATE events SET is_active = 1, reverted_at = NULL WHERE id = ?`)
          .run(event.id);
      };

      const deactivateEvent = () => {
        this.db
          .prepare(
            `UPDATE events SET is_active = 0, reverted_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?`
          )
          .run(event.id);
      };

      if (!headEventId) {
        // No head yet - set this event as the head and mark active
        this.db
          .prepare('UPDATE projects SET event_head_id = ? WHERE id = ?')
          .run(event.id, projectId);
        activateEvent();
      } else if (headEventId === event.id) {
        activateEvent();
      } else {
        const headRow = this.db
          .prepare('SELECT created_at FROM events WHERE id = ?')
          .get(headEventId) as { created_at: string } | undefined;

        if (!headRow) {
          // Head reference invalid - treat as no head and promote new event
          this.db
            .prepare('UPDATE projects SET event_head_id = ? WHERE id = ?')
            .run(event.id, projectId);
          activateEvent();
        } else if (event.created_at <= headRow.created_at) {
          activateEvent();
        } else {
          // Event occurs after current head - promote to new head and reactivate
          this.db
            .prepare('UPDATE projects SET event_head_id = ? WHERE id = ?')
            .run(event.id, projectId);
          activateEvent();
        }
      }

      const updatedRow = this.db.prepare('SELECT * FROM events WHERE id = ?').get(event.id);
      const updatedEvent = this.mapEventRow(updatedRow);

      if (!updatedEvent) {
        throw new Error('Failed to fetch event after creation');
      }

      return updatedEvent;
    });
  }

  getEventById(eventId: string): Event | null {
    const stmt = this.db.prepare('SELECT * FROM events WHERE id = ?');
    const row = stmt.get(eventId);
    return this.mapEventRow(row);
  }

  async createEvent(
    id: string,
    projectId: string,
    eventType: EventType,
    data: Record<string, unknown>
  ): Promise<Event> {
    const stmt = this.db.prepare(`
      INSERT INTO events (id, project_id, event_type, data)
      VALUES (?, ?, ?, ?)
      RETURNING id, project_id, event_type, data, is_active, reverted_at, created_at
    `);

    const result = stmt.get(id, projectId, eventType, JSON.stringify(data));

    if (!result) {
      throw new Error('Failed to create event');
    }

    const mapped = this.mapEventRow(result);
    if (!mapped) {
      throw new Error('Failed to map created event');
    }

    return this.finalizeEventCreation(projectId, mapped);
  }

  async getEvents(
    projectId: string,
    limit = 100,
    since?: string,
    includeDangling = true
  ): Promise<Event[]> {
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

    if (!includeDangling) {
      query += ' AND is_active = 1';
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params);

    return results
      .map(row => this.mapEventRow(row))
      .filter((event): event is Event => event !== null);
  }

  // Alias method for compatibility with tests
  async listEvents(projectId: string, limit = 100): Promise<Event[]> {
    return this.getEvents(projectId, limit);
  }

  async listEventsByType(projectId: string, eventType: EventType): Promise<Event[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM events 
      WHERE project_id = ? AND event_type = ?
      ORDER BY created_at DESC
    `);
    const results = stmt.all(projectId, eventType);

    return results
      .map(row => this.mapEventRow(row))
      .filter((event): event is Event => event !== null);
  }

  getProjectEventHead(projectId: string): Event | null {
    const projectRow = this.db
      .prepare('SELECT event_head_id FROM projects WHERE id = ?')
      .get(projectId) as { event_head_id?: string | null } | undefined;

    if (!projectRow) {
      throw new Error(`Project ${projectId} not found`);
    }

    const headEventId = projectRow.event_head_id ?? null;

    if (!headEventId) {
      const latestActive = this.db
        .prepare(
          `SELECT * FROM events WHERE project_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`
        )
        .get(projectId);
      return this.mapEventRow(latestActive);
    }

    return this.getEventById(headEventId);
  }

  setEventHead(
    projectId: string,
    headEventId: string | null
  ): {
    head: Event | null;
    reactivatedEventIds: string[];
    deactivatedEventIds: string[];
  } {
    return this.transaction(() => {
      const projectRow = this.db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
      if (!projectRow) {
        throw new Error(`Project ${projectId} not found`);
      }

      let targetHeadId: string | null = null;
      let headTimestamp: string | null = null;

      if (headEventId) {
        const headRow = this.db
          .prepare('SELECT id, created_at FROM events WHERE id = ? AND project_id = ?')
          .get(headEventId, projectId) as { id: string; created_at: string } | undefined;

        if (!headRow) {
          throw new Error('Head event not found for project');
        }

        targetHeadId = headRow.id;
        headTimestamp = headRow.created_at;
      }

      let reactivatedEventIds: string[] = [];
      let deactivatedEventIds: string[] = [];

      if (headTimestamp) {
        const toReactivate = this.db
          .prepare(
            `SELECT id FROM events WHERE project_id = ? AND created_at <= ? AND is_active = 0`
          )
          .all(projectId, headTimestamp) as { id: string }[];

        const toDeactivate = this.db
          .prepare(
            `SELECT id FROM events WHERE project_id = ? AND created_at > ? AND is_active = 1`
          )
          .all(projectId, headTimestamp) as { id: string }[];

        reactivatedEventIds = toReactivate.map(row => row.id);
        deactivatedEventIds = toDeactivate.map(row => row.id);

        this.db
          .prepare(
            `UPDATE events SET is_active = 1, reverted_at = NULL WHERE project_id = ? AND created_at <= ?`
          )
          .run(projectId, headTimestamp);

        this.db
          .prepare(
            `UPDATE events SET is_active = 0, reverted_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE project_id = ? AND created_at > ?`
          )
          .run(projectId, headTimestamp);
      } else {
        const toReactivate = this.db
          .prepare(`SELECT id FROM events WHERE project_id = ? AND is_active = 0`)
          .all(projectId) as { id: string }[];

        reactivatedEventIds = toReactivate.map(row => row.id);

        this.db
          .prepare(`UPDATE events SET is_active = 1, reverted_at = NULL WHERE project_id = ?`)
          .run(projectId);

        const latestRow = this.db
          .prepare(`SELECT id FROM events WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`)
          .get(projectId) as { id: string } | undefined;

        targetHeadId = latestRow?.id ?? null;
      }

      this.db
        .prepare('UPDATE projects SET event_head_id = ? WHERE id = ?')
        .run(targetHeadId, projectId);

      const headEventRow = targetHeadId
        ? this.db.prepare('SELECT * FROM events WHERE id = ?').get(targetHeadId)
        : undefined;
      const headEvent = this.mapEventRow(headEventRow);

      return {
        head: headEvent,
        reactivatedEventIds,
        deactivatedEventIds,
      };
    });
  }

  revertEvents(
    projectId: string,
    eventIds: string[]
  ): {
    head: Event | null;
    revertedEventIds: string[];
  } {
    if (eventIds.length === 0) {
      return {
        head: this.getProjectEventHead(projectId),
        revertedEventIds: [],
      };
    }

    const uniqueIds = Array.from(new Set(eventIds));

    return this.transaction(() => {
      const placeholders = uniqueIds.map(() => '?').join(',');

      const events = this.db
        .prepare(`SELECT id, project_id FROM events WHERE id IN (${placeholders})`)
        .all(...uniqueIds) as { id: string; project_id: string }[];

      if (events.length !== uniqueIds.length) {
        throw new Error('One or more events not found');
      }

      const invalid = events.filter(event => event.project_id !== projectId);
      if (invalid.length > 0) {
        throw new Error('One or more events do not belong to the specified project');
      }

      const activeEvents = this.db
        .prepare(
          `SELECT id FROM events WHERE project_id = ? AND id IN (${placeholders}) AND is_active = 1`
        )
        .all(projectId, ...uniqueIds) as { id: string }[];

      const toDeactivateIds = activeEvents.map(event => event.id);

      if (toDeactivateIds.length > 0) {
        const deactivatePlaceholders = toDeactivateIds.map(() => '?').join(',');
        this.db
          .prepare(
            `UPDATE events SET is_active = 0, reverted_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE project_id = ? AND id IN (${deactivatePlaceholders})`
          )
          .run(projectId, ...toDeactivateIds);
      }

      const headRow = this.db
        .prepare(
          `SELECT * FROM events WHERE project_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`
        )
        .get(projectId);

      const headEvent = this.mapEventRow(headRow);
      const headEventId = headEvent?.id ?? null;

      this.db
        .prepare('UPDATE projects SET event_head_id = ? WHERE id = ?')
        .run(headEventId, projectId);

      return {
        head: headEvent,
        revertedEventIds: toDeactivateIds,
      };
    });
  }

  // Artifact operations
  async createArtifact(
    id: string,
    projectId: string,
    name: string,
    description: string | null,
    type: string,
    language?: string,
    framework?: string,
    metadata?: any,
    filePath?: string,
    confidence = 1.0
  ): Promise<any> {
    const stmt = this.db.prepare(`
      INSERT INTO artifacts (id, project_id, name, description, type, language, framework, metadata, file_path, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id, project_id, name, description, type, language, framework, metadata, file_path, confidence, created_at
    `);

    const result = stmt.get(
      id,
      projectId,
      name,
      description,
      type,
      language ?? null,
      framework ?? null,
      metadata ? JSON.stringify(metadata) : null,
      filePath ?? null,
      confidence
    ) as any;

    if (!result) {
      throw new Error('Failed to create artifact');
    }

    const parsedMetadata = result.metadata ? JSON.parse(result.metadata) : null;
    if (parsedMetadata && typeof parsedMetadata === 'object') {
      (parsedMetadata as Record<string, unknown>).artifactId = result.id;
    }

    return {
      ...result,
      metadata: parsedMetadata,
    };
  }

  async getArtifacts(projectId: string): Promise<any[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at'
    );
    const results = stmt.all(projectId) as any[];

    return results.map(artifact => {
      const metadata = artifact.metadata ? JSON.parse(artifact.metadata) : null;
      if (metadata && typeof metadata === 'object') {
        (metadata as Record<string, unknown>).artifactId = artifact.id;
      }
      return {
        ...artifact,
        metadata,
      };
    });
  }

  async getArtifact(projectId: string, artifactId: string): Promise<any | null> {
    const stmt = this.db.prepare('SELECT * FROM artifacts WHERE project_id = ? AND id = ? LIMIT 1');
    const result = stmt.get(projectId, artifactId) as any | undefined;
    if (!result) {
      return null;
    }
    const metadata = result.metadata ? JSON.parse(result.metadata) : null;
    if (metadata && typeof metadata === 'object') {
      (metadata as Record<string, unknown>).artifactId = result.id;
    }
    return {
      ...result,
      metadata,
    };
  }

  async getArtifactsByType(projectId: string, type: string): Promise<any[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM artifacts WHERE project_id = ? AND type = ? ORDER BY created_at'
    );
    const results = stmt.all(projectId, type) as any[];

    return results.map(artifact => {
      const metadata = artifact.metadata ? JSON.parse(artifact.metadata) : null;
      if (metadata && typeof metadata === 'object') {
        (metadata as Record<string, unknown>).artifactId = artifact.id;
      }
      return {
        ...artifact,
        metadata,
      };
    });
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
    }
  ): Promise<any> {
    const stmt = this.db.prepare(`
      UPDATE artifacts
         SET name = ?, description = ?, type = ?, language = ?, framework = ?, metadata = ?, file_path = ?, confidence = ?
       WHERE project_id = ? AND id = ?
    `);

    const confidence =
      typeof updates.confidence === 'number' && Number.isFinite(updates.confidence)
        ? updates.confidence
        : 0.95;

    const result = stmt.run(
      updates.name,
      updates.description ?? null,
      updates.type,
      updates.language ?? null,
      updates.framework ?? null,
      updates.metadata ? JSON.stringify(updates.metadata) : null,
      updates.filePath ?? null,
      confidence,
      projectId,
      artifactId
    );

    if (!result || typeof result.changes !== 'number' || result.changes === 0) {
      throw new Error('Failed to update artifact');
    }

    const updated = await this.getArtifact(projectId, artifactId);
    if (!updated) {
      throw new Error('Updated artifact not found');
    }

    return updated;
  }

  async deleteArtifact(projectId: string, artifactId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM artifacts WHERE project_id = ? AND id = ?');
    const result = stmt.run(projectId, artifactId);
    return typeof result?.changes === 'number' ? result.changes > 0 : false;
  }

  async deleteArtifacts(projectId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM artifacts WHERE project_id = ?');
    stmt.run(projectId);
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
