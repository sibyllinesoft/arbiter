/**
 * GET /activities handler
 */
import type { Context } from "hono";

export function handleGetActivities(c: Context) {
  return c.json({
    activities: [
      {
        id: "act-1",
        type: "service",
        message: "Service added: user-auth-service",
        timestamp: "2025-09-20T10:30:00Z",
        projectId: "project-1",
      },
      {
        id: "act-2",
        type: "database",
        message: "Database configured: postgres-main",
        timestamp: "2025-09-20T10:15:00Z",
        projectId: "project-1",
      },
      {
        id: "act-3",
        type: "service",
        message: "Service deployed to staging environment",
        timestamp: "2025-09-20T09:45:00Z",
        projectId: "project-2",
      },
    ],
  });
}
