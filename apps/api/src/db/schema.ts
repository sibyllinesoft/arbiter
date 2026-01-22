/**
 * Database schema definitions using Drizzle ORM.
 * Defines all tables, columns, indexes, and type exports for the SQLite database.
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Projects table for storing workspace configurations */
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    serviceCount: integer("service_count").notNull().default(0),
    databaseCount: integer("database_count").notNull().default(0),
    eventHeadId: text("event_head_id"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
  },
  (table) => ({
    nameIdx: index("idx_projects_name").on(table.name),
  }),
);

/** Fragments table for storing CUE specification files */
export const fragments = sqliteTable(
  "fragments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    headRevisionId: text("head_revision_id"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
  },
  (table) => ({
    projectIdx: index("idx_fragments_project_id").on(table.projectId),
    projectPathIdx: uniqueIndex("uniq_fragments_project_path").on(table.projectId, table.path),
  }),
);

/** Fragment revisions table for version history */
export const fragmentRevisions = sqliteTable(
  "fragment_revisions",
  {
    id: text("id").primaryKey(),
    fragmentId: text("fragment_id")
      .notNull()
      .references(() => fragments.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    author: text("author"),
    message: text("message"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
  },
  (table) => ({
    fragmentIdx: index("idx_fragment_revisions_fragment_id").on(table.fragmentId),
    fragmentRevisionUnique: uniqueIndex("uniq_fragment_revision").on(
      table.fragmentId,
      table.revisionNumber,
    ),
  }),
);

/** Versions table for frozen specification snapshots */
export const versions = sqliteTable(
  "versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    specHash: text("spec_hash").notNull(),
    resolvedJson: text("resolved_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
  },
  (table) => ({
    projectIdx: index("idx_versions_project_id").on(table.projectId),
    hashIdx: index("idx_versions_hash").on(table.specHash),
    uniqueProjectHash: uniqueIndex("uniq_versions_project_hash").on(
      table.projectId,
      table.specHash,
    ),
  }),
);

/** Events table for tracking project changes and actions */
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    data: text("data").notNull(),
    isActive: integer("is_active").notNull().default(1),
    revertedAt: text("reverted_at"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
  },
  (table) => ({
    projectIdx: index("idx_events_project_id").on(table.projectId),
    createdIdx: index("idx_events_created_at").on(table.createdAt),
    eventTypeIdx: index("idx_events_event_type").on(table.eventType),
  }),
);

/** Artifacts table for storing analyzed project components */
export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    language: text("language"),
    framework: text("framework"),
    metadata: text("metadata"),
    filePath: text("file_path"),
    confidence: real("confidence").default(1).notNull(),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
  },
  (table) => ({
    projectIdx: index("idx_artifacts_project_id").on(table.projectId),
    typeIdx: index("idx_artifacts_type").on(table.type),
  }),
);

/** Entities table for tracking specification entities with UUIDs and timestamps */
export const entities = sqliteTable(
  "entities",
  {
    /** UUID identifier from CUE spec (entityId field) */
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Entity type (service, client, schema, flow, etc.) */
    type: text("type").notNull(),
    /** Key/slug in the spec (e.g., "invoiceService") */
    slug: text("slug").notNull(),
    /** Location in spec (e.g., "services.invoiceService") */
    path: text("path"),
    /** Human-readable name */
    name: text("name").notNull(),
    description: text("description"),
    /** SHA-256 hash of entity JSON for change detection */
    contentHash: text("content_hash").notNull(),
    /** Full entity JSON data */
    data: text("data").notNull(),
    /** Reference to current revision */
    headRevisionId: text("head_revision_id"),
    /** Optional link to source CUE fragment */
    fragmentId: text("fragment_id").references(() => fragments.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
  },
  (table) => ({
    projectIdx: index("idx_entities_project_id").on(table.projectId),
    typeIdx: index("idx_entities_type").on(table.type),
    slugIdx: index("idx_entities_slug").on(table.slug),
    projectTypeSlug: uniqueIndex("uniq_entities_project_type_slug").on(
      table.projectId,
      table.type,
      table.slug,
    ),
  }),
);

/** Entity revisions table for version history of entities */
export const entityRevisions = sqliteTable(
  "entity_revisions",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    /** SHA-256 hash of entity JSON */
    contentHash: text("content_hash").notNull(),
    /** Full entity JSON at this revision */
    data: text("data").notNull(),
    /** Type of change: created, updated, renamed, moved */
    changeType: text("change_type").notNull(),
    /** Previous slug if renamed */
    previousSlug: text("previous_slug"),
    /** Previous path if moved */
    previousPath: text("previous_path"),
    /** Author of the change */
    author: text("author"),
    /** Commit message or change description */
    message: text("message"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%d %H:%M:%f', 'now'))`),
  },
  (table) => ({
    entityIdx: index("idx_entity_revisions_entity_id").on(table.entityId),
    entityRevisionUnique: uniqueIndex("uniq_entity_revision").on(
      table.entityId,
      table.revisionNumber,
    ),
  }),
);

/** Type for a project row selected from the database */
export type ProjectRow = typeof projects.$inferSelect;
/** Type for a fragment row selected from the database */
export type FragmentRow = typeof fragments.$inferSelect;
/** Type for a fragment revision row selected from the database */
export type FragmentRevisionRow = typeof fragmentRevisions.$inferSelect;
/** Type for a version row selected from the database */
export type VersionRow = typeof versions.$inferSelect;
/** Type for an event row selected from the database */
export type EventRow = typeof events.$inferSelect;
/** Type for an artifact row selected from the database */
export type ArtifactRow = typeof artifacts.$inferSelect;
/** Type for an entity row selected from the database */
export type EntityRow = typeof entities.$inferSelect;
/** Type for an entity revision row selected from the database */
export type EntityRevisionRow = typeof entityRevisions.$inferSelect;

/** Combined schema object for Drizzle ORM */
export const schema = {
  projects,
  fragments,
  fragmentRevisions,
  versions,
  events,
  artifacts,
  entities,
  entityRevisions,
};
