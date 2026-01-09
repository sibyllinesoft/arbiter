/**
 * @module util/db/version-operations
 * Version CRUD operations.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { SpecWorkbenchDrizzle } from "../../db/client";
import { versions } from "../../db/schema";
import type { Version } from "../types";
import { mapVersion } from "./row-mappers";

/**
 * Creates a new version.
 */
export async function createVersion(
  drizzle: SpecWorkbenchDrizzle,
  id: string,
  projectId: string,
  specHash: string,
  resolvedJson: string,
): Promise<Version> {
  const [version] = await drizzle
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

  return mapVersion(version);
}

/**
 * Gets a version by project ID and spec hash.
 */
export async function getVersionByHash(
  drizzle: SpecWorkbenchDrizzle,
  projectId: string,
  specHash: string,
): Promise<Version | null> {
  const [version] = await drizzle
    .select()
    .from(versions)
    .where(and(eq(versions.projectId, projectId), eq(versions.specHash, specHash)))
    .limit(1);
  return version ? mapVersion(version) : null;
}

/**
 * Gets the latest version for a project.
 */
export async function getLatestVersion(
  drizzle: SpecWorkbenchDrizzle,
  projectId: string,
): Promise<Version | null> {
  const [version] = await drizzle
    .select()
    .from(versions)
    .where(eq(versions.projectId, projectId))
    .orderBy(desc(versions.createdAt), desc(sql`rowid`))
    .limit(1);
  return version ? mapVersion(version) : null;
}

/**
 * Lists all versions for a project.
 */
export async function listVersions(
  drizzle: SpecWorkbenchDrizzle,
  projectId: string,
): Promise<Version[]> {
  const rows = await drizzle
    .select()
    .from(versions)
    .where(eq(versions.projectId, projectId))
    .orderBy(desc(versions.createdAt), desc(sql`rowid`));
  return rows.map((row) => mapVersion(row));
}
