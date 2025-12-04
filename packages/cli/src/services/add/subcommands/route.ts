import type { RouteConfig } from "@/cue/index.js";

export interface RouteOptions {
  id?: string;
  capabilities?: string;
  components?: string;
  [key: string]: any;
}

export async function addRoute(
  manipulator: any,
  content: string,
  routePath: string,
  options: RouteOptions,
): Promise<string> {
  const routeId = options.id || generateRouteId(routePath);
  const capabilities = options.capabilities
    ? options.capabilities.split(",").map((s: string) => s.trim())
    : ["view"];
  const components = options.components
    ? options.components.split(",").map((s: string) => s.trim())
    : [];

  const routeConfig: RouteConfig = {
    id: routeId,
    path: routePath,
    capabilities,
    ...(components.length > 0 && { components }),
  };

  return await manipulator.addRoute(content, routeConfig);
}

function generateRouteId(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "home:main";
  if (segments.length === 1) return `${segments[0]}:main`;
  return segments.join(":");
}
