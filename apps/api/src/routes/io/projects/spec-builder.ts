/**
 * Build resolved spec from project data
 */
import { buildGroupIssueSpec } from "../../../io/utils";
import { countComponentsByType, extractFrontendViews } from "./helpers";

export function buildResolvedSpec(
  project: Record<string, unknown>,
  artifacts: unknown[],
  services: Record<string, unknown>,
  databases: Record<string, unknown>,
  components: Record<string, unknown>,
  routes: unknown[],
  infrastructureCount: number,
  externalCount: number,
): Record<string, unknown> {
  const frontendViewSet = extractFrontendViews(artifacts);
  const hasServices = Object.keys(services).length > 0;
  const { groups, tasks } = buildGroupIssueSpec(
    artifacts as Parameters<typeof buildGroupIssueSpec>[0],
  );

  const flows = hasServices ? [{ id: "main-flow", name: "Main Application Flow" }] : [];
  const capabilities = hasServices ? [{ id: "api-capability", name: "API Services" }] : [];

  const specBlock = {
    services,
    databases,
    components,
    frontend: { packages: [] as unknown[] },
    ui: { routes },
    flows,
    capabilities,
    groups,
    tasks,
  };

  return {
    version: "1.0",
    services,
    databases,
    components,
    routes,
    flows,
    capabilities,
    groups,
    tasks,
    spec: specBlock,
    artifacts,
    project: {
      id: project.id,
      name: project.name,
      entities: {
        services: Object.keys(services).length,
        databases: Object.keys(databases).length,
        packages: countComponentsByType(components, "package"),
        tools: countComponentsByType(components, ["tool", "binary"]),
        frontends: countComponentsByType(components, "frontend"),
        infrastructure: infrastructureCount,
        external: externalCount,
        views: frontendViewSet.size,
        routes: (routes as unknown[]).length,
        flows: hasServices ? 1 : 0,
        capabilities: hasServices ? 1 : 0,
      },
    },
  };
}
