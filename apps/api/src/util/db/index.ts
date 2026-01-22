/**
 * @module util/db
 * Database utilities and SpecWorkbenchDB class.
 */

import { randomUUID } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { sql } from "drizzle-orm";
import {
  type DatabaseDriver,
  type DatabaseRuntimeContext,
  type SpecWorkbenchDrizzle,
  normalizeClient,
} from "../../db/client";
import { logger } from "../../io/utils";
import { ArtifactRepository } from "../../repositories/ArtifactRepository";
import { EntityRepository } from "../../repositories/EntityRepository";
import { EventRepository } from "../../repositories/EventRepository";
import { ProjectRepository } from "../../repositories/ProjectRepository";
import type { DbProject, WithMetadata } from "../../repositories/types";
import type { Event, EventType, Fragment, FragmentRevision, ServerConfig, Version } from "../types";
import { resolveCloudflareD1Binding } from "./d1-binding";
import { backfillArtifactDescriptions } from "./description-extractor";
import * as fragmentOps from "./fragment-operations";
import {
  configurePragmas,
  createIndices,
  createTables,
  createTriggers,
  handleSchemaMigrations,
} from "./schema-init";
import type { SpecWorkbenchDBOptions } from "./types";
import * as versionOps from "./version-operations";

export type { SpecWorkbenchDBOptions } from "./types";

type BunSQLiteInstance = import("bun:sqlite").Database;

export class SpecWorkbenchDB {
  private static async createDefaultRuntime(config: ServerConfig): Promise<DatabaseRuntimeContext> {
    const configuredDriver = config.database?.driver ?? "bun-sqlite";

    if (configuredDriver === "cloudflare-d1") {
      const binding = resolveCloudflareD1Binding(config.database?.binding);
      const { createD1Client } = await import("../../db/adapters/d1");
      const client = createD1Client({ binding });
      return normalizeClient(client);
    }

    const { createBunSqliteClient } = await import("../../db/adapters/bun-sqlite");
    const databasePath = config.database?.path ?? config.database_path ?? "arbiter.db";
    const client = createBunSqliteClient({
      databasePath,
      pragmas: config.database?.pragmas,
    });
    return normalizeClient(client);
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
  private readonly projectsRepo: ProjectRepository;
  private readonly artifactsRepo: ArtifactRepository;
  private readonly eventsRepo: EventRepository;
  private readonly entitiesRepo: EntityRepository;

  private constructor(
    private readonly config: ServerConfig,
    private readonly runtime: DatabaseRuntimeContext,
  ) {
    this.drizzle = runtime.drizzle;
    this.driver = runtime.driver;
    this.raw = runtime.raw;

    this.projectsRepo = new ProjectRepository(this.drizzle);
    this.artifactsRepo = new ArtifactRepository(this.drizzle);
    this.eventsRepo = new EventRepository(this.drizzle, (fn) => this.withTransaction(fn));
    this.entitiesRepo = new EntityRepository(this.drizzle);
  }

  /** Get the entity repository for entity-level tracking */
  get entityRepository(): EntityRepository {
    return this.entitiesRepo;
  }

  private async initializeSchema(): Promise<void> {
    if (this.driver === "bun-sqlite") {
      configurePragmas(this.raw as BunSQLiteInstance);
    }

    await handleSchemaMigrations(this.drizzle);
    await createTables(this.drizzle);
    await createIndices(this.drizzle);
    await createTriggers(this.drizzle);
    await backfillArtifactDescriptions(this.drizzle, this.driver, (fn) => this.withTransaction(fn));
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
    return this.projectsRepo.createProject(id, name, serviceCount, databaseCount);
  }

  async updateProjectCounts(
    projectId: string,
    serviceCount: number,
    databaseCount: number,
  ): Promise<void> {
    await this.projectsRepo.updateProjectCounts(projectId, serviceCount, databaseCount);
  }

  async getProject(id: string): Promise<DbProject | null> {
    return this.projectsRepo.getProject(id);
  }

  async listProjects(): Promise<DbProject[]> {
    return this.projectsRepo.listProjects();
  }

  async deleteProject(id: string): Promise<void> {
    await this.projectsRepo.deleteProject(id);
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
    return fragmentOps.createFragment(
      this.drizzle,
      (fn) => this.withTransaction(fn),
      id,
      projectId,
      path,
      content,
      author,
      message,
    );
  }

  async updateFragment(
    projectId: string,
    path: string,
    content: string,
    author?: string,
    message?: string,
  ): Promise<Fragment> {
    return fragmentOps.updateFragment(
      this.drizzle,
      (fn) => this.withTransaction(fn),
      projectId,
      path,
      content,
      author,
      message,
    );
  }

  async getFragment(projectId: string, path: string): Promise<Fragment | null> {
    return fragmentOps.getFragment(this.drizzle, projectId, path);
  }

  async getFragmentById(id: string): Promise<Fragment | null> {
    return fragmentOps.getFragmentById(this.drizzle, id);
  }

  async listFragments(projectId: string): Promise<Fragment[]> {
    return fragmentOps.listFragments(this.drizzle, projectId);
  }

  async deleteFragment(projectId: string, path: string): Promise<void> {
    return fragmentOps.deleteFragment(this.drizzle, projectId, path);
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
    return fragmentOps.createFragmentRevision(
      this.drizzle,
      id,
      fragmentId,
      revisionNumber,
      content,
      contentHash,
      author,
      message,
    );
  }

  async getFragmentRevision(
    fragmentId: string,
    revisionNumber: number,
  ): Promise<FragmentRevision | null> {
    return fragmentOps.getFragmentRevision(this.drizzle, fragmentId, revisionNumber);
  }

  async listFragmentRevisions(fragmentId: string): Promise<FragmentRevision[]> {
    return fragmentOps.listFragmentRevisions(this.drizzle, fragmentId);
  }

  async getLatestFragmentRevision(fragmentId: string): Promise<FragmentRevision | null> {
    return fragmentOps.getLatestFragmentRevision(this.drizzle, fragmentId);
  }

  // Version operations -------------------------------------------------------

  async createVersion(
    id: string,
    projectId: string,
    specHash: string,
    resolvedJson: string,
  ): Promise<Version> {
    return versionOps.createVersion(this.drizzle, id, projectId, specHash, resolvedJson);
  }

  async getVersionByHash(projectId: string, specHash: string): Promise<Version | null> {
    return versionOps.getVersionByHash(this.drizzle, projectId, specHash);
  }

  async getLatestVersion(projectId: string): Promise<Version | null> {
    return versionOps.getLatestVersion(this.drizzle, projectId);
  }

  async listVersions(projectId: string): Promise<Version[]> {
    return versionOps.listVersions(this.drizzle, projectId);
  }

  // Event operations ---------------------------------------------------------

  async createEvent(
    id: string,
    projectId: string,
    eventType: EventType,
    data: Record<string, unknown>,
  ): Promise<Event> {
    return this.eventsRepo.createEvent(id, projectId, eventType, data);
  }

  getEventById(eventId: string): Promise<Event | null> {
    return this.eventsRepo.getEventById(eventId);
  }

  async getEvents(
    projectId: string,
    limit = 100,
    since?: string,
    includeDangling = true,
  ): Promise<Event[]> {
    return this.eventsRepo.getEvents(projectId, limit, since, includeDangling);
  }

  async listEvents(projectId: string, limit = 100): Promise<Event[]> {
    return this.eventsRepo.listEvents(projectId, limit);
  }

  async listEventsByType(projectId: string, eventType: EventType): Promise<Event[]> {
    return this.eventsRepo.listEventsByType(projectId, eventType);
  }

  async getProjectEventHead(projectId: string): Promise<Event | null> {
    return this.eventsRepo.getProjectEventHead(projectId);
  }

  async setEventHead(
    projectId: string,
    headEventId: string | null,
  ): Promise<{
    head: Event | null;
    reactivatedEventIds: string[];
    deactivatedEventIds: string[];
  }> {
    return this.eventsRepo.setEventHead(projectId, headEventId);
  }

  async reactivateEvents(projectId: string, eventIds: string[]): Promise<void> {
    await this.eventsRepo.reactivateEvents(projectId, eventIds);
  }

  async revertEvents(projectId: string, eventIds: string[]): Promise<void> {
    await this.eventsRepo.revertEvents(projectId, eventIds);
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
    return this.artifactsRepo.createArtifact(
      id,
      projectId,
      name,
      description,
      type,
      language,
      framework,
      metadata,
      filePath,
      confidence,
    );
  }

  async getArtifacts(projectId: string): Promise<Array<WithMetadata<any>>> {
    return this.artifactsRepo.getArtifacts(projectId);
  }

  async getArtifact(projectId: string, artifactId: string): Promise<WithMetadata<any> | null> {
    return this.artifactsRepo.getArtifact(projectId, artifactId);
  }

  async getArtifactsByType(projectId: string, type: string): Promise<Array<WithMetadata<any>>> {
    return this.artifactsRepo.getArtifactsByType(projectId, type);
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
    return this.artifactsRepo.updateArtifact(projectId, artifactId, updates);
  }

  async deleteArtifact(projectId: string, artifactId: string): Promise<boolean> {
    return this.artifactsRepo.deleteArtifact(projectId, artifactId);
  }

  async deleteArtifacts(projectId: string): Promise<void> {
    await this.artifactsRepo.deleteArtifacts(projectId);
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

  /** Backfill missing artifact descriptions from metadata (for testing/maintenance) */
  async backfillArtifactDescriptions(): Promise<void> {
    await backfillArtifactDescriptions(this.drizzle, this.driver, (fn) => this.withTransaction(fn));
  }
}
