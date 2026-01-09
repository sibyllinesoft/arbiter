/**
 * @module util/db/row-mappers
 * Database row to domain object mappers.
 */

import type { FragmentRevisionRow, FragmentRow, VersionRow } from "../../db/schema";
import type { Fragment, FragmentRevision, Version } from "../types";

/**
 * Maps a fragment row to a Fragment domain object.
 */
export function mapFragment(row: FragmentRow): Fragment {
  return {
    id: row.id,
    project_id: row.projectId,
    path: row.path,
    content: row.content,
    head_revision_id: row.headRevisionId ?? undefined,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

/**
 * Maps a fragment revision row to a FragmentRevision domain object.
 */
export function mapFragmentRevision(row: FragmentRevisionRow): FragmentRevision {
  return {
    id: row.id,
    fragment_id: row.fragmentId,
    revision_number: row.revisionNumber,
    content: row.content,
    content_hash: row.contentHash,
    author: row.author ?? undefined,
    message: row.message ?? undefined,
    created_at: row.createdAt,
  };
}

/**
 * Maps a version row to a Version domain object.
 */
export function mapVersion(row: VersionRow): Version {
  return {
    id: row.id,
    project_id: row.projectId,
    spec_hash: row.specHash,
    resolved_json: row.resolvedJson,
    created_at: row.createdAt,
  };
}
