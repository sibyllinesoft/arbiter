/**
 * POST /projects handler
 */
import type { Context } from "hono";
import { ProjectsController } from "../../../../controllers/ProjectsController";
import type { SpecWorkbenchDB } from "../../../../util/db";
import type { Dependencies } from "../types";

export async function handleCreateProject(c: Context, deps: Dependencies) {
  const db = deps.db as SpecWorkbenchDB | undefined;
  const controller = db ? new ProjectsController(deps) : null;

  if (!controller) {
    return c.json({ error: "Project service unavailable" }, 503);
  }

  try {
    const dto = (c.req as unknown as { valid: (type: string) => Record<string, unknown> }).valid(
      "json",
    );
    const result = await controller.createProject(dto);

    return c.json({
      id: result.id,
      name: result.name,
      status: "active",
      services: result.services,
      databases: result.databases,
      artifacts: result.artifacts,
      structure: result.structure,
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    const status = err.status ?? 500;
    const message =
      status === 409 ? "Project already exists" : (err.message ?? "Failed to create project");
    return c.json({ error: message }, status as 400 | 409 | 500 | 503);
  }
}
