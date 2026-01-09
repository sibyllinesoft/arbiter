/**
 * @module util/db/fragment-operations
 * Fragment CRUD operations.
 */

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { SpecWorkbenchDrizzle } from "../../db/client";
import { fragmentRevisions, fragments } from "../../db/schema";
import { getRowsAffected } from "../../repositories/helpers";
import type { Fragment, FragmentRevision } from "../types";
import { mapFragment, mapFragmentRevision } from "./row-mappers";

/**
 * Gets the next revision number for a fragment.
 */
async function getNextRevisionNumber(
  fragmentId: string,
  tx: SpecWorkbenchDrizzle,
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

/**
 * Creates a new fragment with an initial revision.
 */
export async function createFragment(
  drizzle: SpecWorkbenchDrizzle,
  withTransaction: <T>(fn: (tx: SpecWorkbenchDrizzle) => Promise<T>) => Promise<T>,
  id: string,
  projectId: string,
  path: string,
  content: string,
  author?: string,
  message?: string,
): Promise<Fragment> {
  return withTransaction(async (tx) => {
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

    const revisionId = randomUUID();
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

    return mapFragment(updatedFragment);
  });
}

/**
 * Updates a fragment with a new revision.
 */
export async function updateFragment(
  drizzle: SpecWorkbenchDrizzle,
  withTransaction: <T>(fn: (tx: SpecWorkbenchDrizzle) => Promise<T>) => Promise<T>,
  projectId: string,
  path: string,
  content: string,
  author?: string,
  message?: string,
): Promise<Fragment> {
  return withTransaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(fragments)
      .where(and(eq(fragments.projectId, projectId), eq(fragments.path, path)))
      .limit(1);

    if (!existing) {
      throw new Error("Fragment not found");
    }

    if (existing.content === content) {
      return mapFragment(existing);
    }

    const nextRevisionNumber = await getNextRevisionNumber(existing.id, tx);
    const revisionId = randomUUID();
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

    return mapFragment(updated);
  });
}

/**
 * Gets a fragment by project ID and path.
 */
export async function getFragment(
  drizzle: SpecWorkbenchDrizzle,
  projectId: string,
  path: string,
): Promise<Fragment | null> {
  const [fragment] = await drizzle
    .select()
    .from(fragments)
    .where(and(eq(fragments.projectId, projectId), eq(fragments.path, path)))
    .limit(1);

  return fragment ? mapFragment(fragment) : null;
}

/**
 * Gets a fragment by ID.
 */
export async function getFragmentById(
  drizzle: SpecWorkbenchDrizzle,
  id: string,
): Promise<Fragment | null> {
  const [fragment] = await drizzle.select().from(fragments).where(eq(fragments.id, id)).limit(1);
  return fragment ? mapFragment(fragment) : null;
}

/**
 * Lists all fragments for a project.
 */
export async function listFragments(
  drizzle: SpecWorkbenchDrizzle,
  projectId: string,
): Promise<Fragment[]> {
  const rows = await drizzle
    .select()
    .from(fragments)
    .where(eq(fragments.projectId, projectId))
    .orderBy(fragments.path);
  return rows.map((row) => mapFragment(row));
}

/**
 * Deletes a fragment by project ID and path.
 */
export async function deleteFragment(
  drizzle: SpecWorkbenchDrizzle,
  projectId: string,
  path: string,
): Promise<void> {
  const result = await drizzle
    .delete(fragments)
    .where(and(eq(fragments.projectId, projectId), eq(fragments.path, path)));
  if (getRowsAffected(result) === 0) {
    throw new Error("Fragment not found");
  }
}

/**
 * Creates a fragment revision.
 */
export async function createFragmentRevision(
  drizzle: SpecWorkbenchDrizzle,
  id: string,
  fragmentId: string,
  revisionNumber: number,
  content: string,
  contentHash: string,
  author: string | null,
  message: string | null,
): Promise<FragmentRevision> {
  const [revision] = await drizzle
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

  return mapFragmentRevision(revision);
}

/**
 * Gets a fragment revision by fragment ID and revision number.
 */
export async function getFragmentRevision(
  drizzle: SpecWorkbenchDrizzle,
  fragmentId: string,
  revisionNumber: number,
): Promise<FragmentRevision | null> {
  const [revision] = await drizzle
    .select()
    .from(fragmentRevisions)
    .where(
      and(
        eq(fragmentRevisions.fragmentId, fragmentId),
        eq(fragmentRevisions.revisionNumber, revisionNumber),
      ),
    )
    .limit(1);
  return revision ? mapFragmentRevision(revision) : null;
}

/**
 * Lists all revisions for a fragment.
 */
export async function listFragmentRevisions(
  drizzle: SpecWorkbenchDrizzle,
  fragmentId: string,
): Promise<FragmentRevision[]> {
  const rows = await drizzle
    .select()
    .from(fragmentRevisions)
    .where(eq(fragmentRevisions.fragmentId, fragmentId))
    .orderBy(desc(fragmentRevisions.revisionNumber));

  return rows.map((row) => mapFragmentRevision(row));
}

/**
 * Gets the latest revision for a fragment.
 */
export async function getLatestFragmentRevision(
  drizzle: SpecWorkbenchDrizzle,
  fragmentId: string,
): Promise<FragmentRevision | null> {
  const [revision] = await drizzle
    .select()
    .from(fragmentRevisions)
    .where(eq(fragmentRevisions.fragmentId, fragmentId))
    .orderBy(desc(fragmentRevisions.revisionNumber))
    .limit(1);
  return revision ? mapFragmentRevision(revision) : null;
}
