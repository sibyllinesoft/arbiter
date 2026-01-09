/**
 * DELETE /projects/:id handler
 */
import type { Context } from "hono";
import type { EventService } from "../../../../io/events";
import type { Dependencies } from "../types";
import type { DbInstance, ProjectRecord } from "./types";

export async function handleDeleteProject(c: Context, deps: Dependencies) {
  const projectId = c.req.param("id");
  if (!projectId) {
    return c.json({ error: "Project ID is required" }, 400);
  }

  try {
    const dbInstance = deps.db as DbInstance;
    const projects = await dbInstance.listProjects();
    const project = (projects as Array<ProjectRecord>).find((p) => p.id === projectId);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    await dbInstance.deleteArtifacts(projectId);
    await dbInstance.deleteProject(projectId);

    const eventsService = deps.events as EventService | undefined;
    if (eventsService?.broadcastToAll) {
      await eventsService.broadcastToAll({
        type: "event",
        data: {
          event_type: "project_deleted",
          project_id: projectId,
          project_name: project.name,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return c.json({
      success: true,
      message: `Project "${project.name}" deleted successfully`,
      projectId,
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return c.json({ error: "Failed to delete project" }, 500);
  }
}
