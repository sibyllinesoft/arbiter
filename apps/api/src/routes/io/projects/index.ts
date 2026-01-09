/**
 * Projects router - modular structure
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createProjectSchema } from "../../../schemas/project";
import {
  handleCreateEntity,
  handleCreateProject,
  handleDeleteEntity,
  handleDeleteProject,
  handleGetActivities,
  handleGetProject,
  handleListProjects,
  handleRestoreEntity,
  handleUpdateEntity,
} from "./handlers";
import type { Dependencies } from "./types";

export type { Dependencies } from "./types";

export function createProjectsRouter(deps: Dependencies) {
  const router = new Hono();

  // GET /projects/:id - Get project with resolved spec
  router.get("/projects/:id", (c) => handleGetProject(c, deps));

  // PUT /projects/:projectId/entities/:artifactId - Update entity
  router.put("/projects/:projectId/entities/:artifactId", (c) => handleUpdateEntity(c, deps));

  // GET /projects - List all projects
  router.get("/projects", (c) => handleListProjects(c, deps));

  // POST /projects/:projectId/entities - Create entity
  router.post("/projects/:projectId/entities", (c) => handleCreateEntity(c, deps));

  // DELETE /projects/:projectId/entities/:artifactId - Delete entity
  router.delete("/projects/:projectId/entities/:artifactId", (c) => handleDeleteEntity(c, deps));

  // POST /projects/:projectId/entities/:artifactId/restore - Restore entity
  router.post("/projects/:projectId/entities/:artifactId/restore", (c) =>
    handleRestoreEntity(c, deps),
  );

  // POST /projects - Create project
  router.post("/projects", zValidator("json", createProjectSchema), (c) =>
    handleCreateProject(c, deps),
  );

  // DELETE /projects/:id - Delete project
  router.delete("/projects/:id", (c) => handleDeleteProject(c, deps));

  // GET /activities - Get recent activities
  router.get("/activities", (c) => handleGetActivities(c));

  return router;
}
