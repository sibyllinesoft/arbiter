/**
 * GET /projects handler
 */
import type { Context } from "hono";
import {
  buildDatabasesFromArtifacts,
  buildEntityCounts,
  buildServicesFromArtifacts,
} from "../helpers";
import type { Dependencies } from "../types";
import type { DbInstance, ProjectRecord } from "./types";

async function formatProjectWithArtifacts(
  dbInstance: DbInstance,
  project: ProjectRecord,
): Promise<Record<string, unknown>> {
  const artifacts = await dbInstance.getArtifacts(project.id);
  const routeSet = new Set<string>();
  const services = buildServicesFromArtifacts(artifacts, routeSet);
  const databases = buildDatabasesFromArtifacts(artifacts);
  const counts = buildEntityCounts(artifacts, routeSet);

  return {
    id: project.id,
    name: project.name,
    status: "active",
    entities: {
      ...counts,
      services: Object.keys(services).length,
      databases: Object.keys(databases).length,
    },
    lastActivity: project.updated_at,
  };
}

function formatProjectFallback(project: ProjectRecord): Record<string, unknown> {
  return {
    id: project.id,
    name: project.name,
    status: "active",
    entities: {
      services: (project.service_count as number) || 0,
      databases: (project.database_count as number) || 0,
      packages: 0,
      tools: 0,
      frontends: 0,
      infrastructure: 0,
      external: 0,
      views: 0,
      routes: 0,
      flows: 0,
      capabilities: 0,
    },
    lastActivity: project.updated_at,
  };
}

export async function handleListProjects(c: Context, deps: Dependencies) {
  try {
    const dbInstance = deps.db as DbInstance;
    const projects = await dbInstance.listProjects();

    const formattedProjects = await Promise.all(
      (projects as Array<ProjectRecord>).map(async (project) => {
        try {
          return await formatProjectWithArtifacts(dbInstance, project);
        } catch {
          return formatProjectFallback(project);
        }
      }),
    );

    return c.json({ projects: formattedProjects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return c.json({ projects: [] });
  }
}
