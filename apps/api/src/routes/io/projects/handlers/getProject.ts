/**
 * GET /projects/:id handler
 */
import type { Context } from "hono";
import { ProjectsController } from "../../../../controllers/ProjectsController";
import type { SpecWorkbenchDB } from "../../../../util/db";
import { buildResolvedSpec } from "../spec-builder";
import type { Dependencies } from "../types";

export async function handleGetProject(c: Context, deps: Dependencies) {
  const projectId = c.req.param("id");
  if (!projectId) {
    return c.json({ error: "Project ID is required" }, 400);
  }

  const db = deps.db as SpecWorkbenchDB | undefined;
  const controller = db ? new ProjectsController(deps) : null;

  if (!controller) {
    return c.json({ error: "Database unavailable" }, 503);
  }

  try {
    const data = await controller.getProjectWithArtifacts(projectId);
    const resolvedSpec = buildResolvedSpec(
      data.project as unknown as Record<string, unknown>,
      data.artifacts,
      data.services,
      data.databases,
      data.components,
      data.routes,
      data.infrastructureCount,
      data.externalCount,
    );
    return c.json({ resolved: resolvedSpec });
  } catch (error) {
    console.error("Error fetching project details:", error);
    return c.json({ error: "Failed to fetch project details" }, 500);
  }
}
