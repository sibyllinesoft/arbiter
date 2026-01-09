import { desc, eq } from "drizzle-orm";
import type { SpecWorkbenchDrizzle } from "../db/client";
import { type ProjectRow, projects } from "../db/schema";
import { getCurrentTimestamp } from "../io/utils";
import { getRowsAffected, mapProjectRow } from "./helpers";
import type { DbProject } from "./types";

export class ProjectRepository {
  constructor(private readonly drizzle: SpecWorkbenchDrizzle) {}

  async createProject(
    id: string,
    name: string,
    serviceCount = 0,
    databaseCount = 0,
  ): Promise<DbProject> {
    const [project] = await this.drizzle
      .insert(projects)
      .values({ id, name, serviceCount, databaseCount })
      .returning();

    if (!project) {
      throw new Error("Failed to create project");
    }

    return mapProjectRow(project);
  }

  async updateProjectCounts(
    projectId: string,
    serviceCount: number,
    databaseCount: number,
  ): Promise<void> {
    await this.drizzle
      .update(projects)
      .set({
        serviceCount,
        databaseCount,
        updatedAt: getCurrentTimestamp(),
      })
      .where(eq(projects.id, projectId));
  }

  async getProject(id: string): Promise<DbProject | null> {
    const [project] = await this.drizzle
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return project ? mapProjectRow(project as ProjectRow) : null;
  }

  async listProjects(): Promise<DbProject[]> {
    const rows = await this.drizzle.select().from(projects).orderBy(desc(projects.createdAt));
    return rows.map((row) => mapProjectRow(row as ProjectRow));
  }

  async deleteProject(id: string): Promise<void> {
    const result = await this.drizzle.delete(projects).where(eq(projects.id, id));
    if (getRowsAffected(result) === 0) {
      throw new Error("Project not found");
    }
  }
}
