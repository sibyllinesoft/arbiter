import { and, desc, eq } from "drizzle-orm";
import type { SpecWorkbenchDrizzle } from "../db/client";
import { type ArtifactRow, artifacts } from "../db/schema";
import { getRowsAffected, mapArtifactRow } from "./helpers";
import type { WithMetadata } from "./types";

export class ArtifactRepository {
  constructor(private readonly drizzle: SpecWorkbenchDrizzle) {}

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
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    const [created] = await this.drizzle
      .insert(artifacts)
      .values({
        id,
        projectId,
        name,
        description,
        type,
        language: language ?? null,
        framework: framework ?? null,
        metadata: metadataJson,
        filePath: filePath ?? null,
        confidence:
          typeof confidence === "number" && Number.isFinite(confidence) ? confidence : 0.95,
      })
      .returning();

    if (!created) throw new Error("Failed to create artifact");
    return mapArtifactRow(created as ArtifactRow);
  }

  async getArtifacts(projectId: string): Promise<Array<WithMetadata<any>>> {
    const rows = await this.drizzle
      .select()
      .from(artifacts)
      .where(eq(artifacts.projectId, projectId));
    return rows.map((row) => mapArtifactRow(row as ArtifactRow));
  }

  async getArtifact(projectId: string, artifactId: string): Promise<WithMetadata<any> | null> {
    const [row] = await this.drizzle
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.id, artifactId)))
      .limit(1);
    return row ? mapArtifactRow(row as ArtifactRow) : null;
  }

  async getArtifactsByType(projectId: string, type: string): Promise<Array<WithMetadata<any>>> {
    const rows = await this.drizzle
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.type, type)))
      .orderBy(desc(artifacts.createdAt));
    return rows.map((row) => mapArtifactRow(row as ArtifactRow));
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
    const metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    const confidence =
      typeof updates.confidence === "number" && Number.isFinite(updates.confidence)
        ? updates.confidence
        : 0.95;

    const result = await this.drizzle
      .update(artifacts)
      .set({
        name: updates.name,
        description: updates.description ?? null,
        type: updates.type,
        language: updates.language ?? null,
        framework: updates.framework ?? null,
        metadata,
        filePath: updates.filePath ?? null,
        confidence,
      })
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.id, artifactId)));

    if (getRowsAffected(result) === 0) {
      throw new Error("Failed to update artifact");
    }

    const updated = await this.getArtifact(projectId, artifactId);
    if (!updated) throw new Error("Updated artifact not found");
    return updated;
  }

  async deleteArtifact(projectId: string, artifactId: string): Promise<boolean> {
    const result = await this.drizzle
      .delete(artifacts)
      .where(and(eq(artifacts.projectId, projectId), eq(artifacts.id, artifactId)));
    return getRowsAffected(result) > 0;
  }

  async deleteArtifacts(projectId: string): Promise<void> {
    await this.drizzle.delete(artifacts).where(eq(artifacts.projectId, projectId));
  }
}
