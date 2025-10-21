import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export type ProjectRow = typeof projects.$inferSelect;
export type FragmentRow = typeof fragments.$inferSelect;
export type FragmentRevisionRow = typeof fragmentRevisions.$inferSelect;
export type VersionRow = typeof versions.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type ArtifactRow = typeof artifacts.$inferSelect;

export const schema = {
  projects,
  fragments,
  fragmentRevisions,
  versions,
  events,
  artifacts,
};
