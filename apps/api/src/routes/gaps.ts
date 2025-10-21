import { Hono } from "hono";

type Dependencies = Record<string, unknown>;

export function createGapsRouter(deps: Dependencies) {
  const router = new Hono();

  router.get("/", async (c) => {
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId parameter is required" }, 400);
    }

    // Mock gaps analysis data
    return c.json({
      success: true,
      projectId,
      gaps: {
        categories: [
          {
            id: "security",
            name: "Security",
            status: "warning",
            items: [
              {
                id: "auth-implementation",
                title: "Authentication Implementation",
                description: "User authentication system needs to be implemented",
                priority: "high",
                status: "missing",
                effort: "medium",
                blockers: [],
              },
              {
                id: "input-validation",
                title: "Input Validation",
                description: "All user inputs should be validated and sanitized",
                priority: "high",
                status: "partial",
                effort: "low",
                blockers: [],
              },
            ],
          },
          {
            id: "testing",
            name: "Testing",
            status: "error",
            items: [
              {
                id: "unit-tests",
                title: "Unit Test Coverage",
                description: "Core business logic needs comprehensive unit tests",
                priority: "medium",
                status: "missing",
                effort: "high",
                blockers: ["testing-framework-setup"],
              },
              {
                id: "integration-tests",
                title: "Integration Tests",
                description: "API endpoints need integration test coverage",
                priority: "medium",
                status: "missing",
                effort: "medium",
                blockers: ["unit-tests"],
              },
            ],
          },
          {
            id: "performance",
            name: "Performance",
            status: "success",
            items: [
              {
                id: "caching",
                title: "Response Caching",
                description: "Implement caching for frequently accessed data",
                priority: "low",
                status: "completed",
                effort: "medium",
                blockers: [],
              },
              {
                id: "database-optimization",
                title: "Database Query Optimization",
                description: "Optimize slow database queries and add indexes",
                priority: "medium",
                status: "in_progress",
                effort: "medium",
                blockers: [],
              },
            ],
          },
          {
            id: "documentation",
            name: "Documentation",
            status: "warning",
            items: [
              {
                id: "api-docs",
                title: "API Documentation",
                description: "Complete API documentation with examples",
                priority: "medium",
                status: "partial",
                effort: "low",
                blockers: [],
              },
              {
                id: "user-guide",
                title: "User Guide",
                description: "Create comprehensive user guide and tutorials",
                priority: "low",
                status: "missing",
                effort: "high",
                blockers: ["api-docs"],
              },
            ],
          },
        ],
        summary: {
          total: 7,
          completed: 1,
          in_progress: 1,
          missing: 4,
          partial: 1,
          high_priority: 2,
          medium_priority: 4,
          low_priority: 1,
        },
      },
    });
  });

  return router;
}
