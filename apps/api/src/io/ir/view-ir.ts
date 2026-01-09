/**
 * View IR generator for wireframes and site navigation graphs.
 * Transforms UI route and locator specifications into view structures
 * for wireframe visualization and site map generation.
 */
import { computeSpecHash } from "./helpers";
import type { SiteEdge, SiteNode, View, ViewWidget } from "./types";

/**
 * Generate view intermediate representation for wireframe visualization.
 * Extracts routes and locators from the spec to build view structures
 * with widgets (buttons, inputs, tables).
 * @param resolved - The resolved specification containing route and locator definitions
 * @returns IR data with spec hash and array of view definitions
 */
export function generateViewIR(resolved: Record<string, unknown>): Record<string, unknown> {
  const routes = (resolved.routes as Record<string, any>) || (resolved.ui as any)?.routes || {};
  const locators = (resolved.locators as Record<string, string>) || {};
  const views: View[] = [];

  Object.entries(routes).forEach(([path, route]: [string, any]) => {
    const widgets: ViewWidget[] = [];

    if (route.components && Array.isArray(route.components)) {
      route.components.forEach((component: any) => {
        if (component.type === "button" && component.token) {
          widgets.push({
            type: "button",
            token: component.token,
            text: component.text || component.token,
          });
        } else if (component.type === "input" && component.token) {
          widgets.push({
            type: "input",
            token: component.token,
            label: component.label || component.token,
          });
        } else if (component.type === "table" && component.token) {
          widgets.push({
            type: "table",
            token: component.token,
            columns: component.columns || [],
          });
        }
      });
    }

    Object.entries(locators).forEach(([token, _selector]) => {
      if (token.startsWith("btn:")) {
        widgets.push({
          type: "button",
          token,
          text: token.replace("btn:", ""),
        });
      } else if (token.startsWith("input:")) {
        widgets.push({
          type: "input",
          token,
          label: token.replace("input:", ""),
        });
      }
    });

    views.push({
      id: path,
      name: route.name || path,
      component: route.component,
      layout: route.layout,
      requiresAuth: route.requiresAuth || false,
      widgets,
    });
  });

  return {
    specHash: computeSpecHash(resolved),
    views,
  };
}

/**
 * Generate site navigation IR for site map visualization.
 * Creates a graph of routes connected by shared capabilities.
 * @param resolved - The resolved specification containing UI route definitions
 * @returns IR data with spec hash and route graph (nodes and edges)
 */
export function generateSiteIR(resolved: Record<string, unknown>): Record<string, unknown> {
  const routes = (resolved.ui as any)?.routes || [];
  const nodes: SiteNode[] = [];
  const edges: SiteEdge[] = [];

  routes.forEach((route: any) => {
    nodes.push({
      id: route.id || route.path,
      label: route.name || route.path,
      path: route.path,
      capabilities: route.capabilities || [],
    });
  });

  routes.forEach((route: any, index: number) => {
    const routeId = route.id || route.path;

    routes.forEach((otherRoute: any, otherIndex: number) => {
      if (index !== otherIndex && route.capabilities && otherRoute.capabilities) {
        const sharedCaps = route.capabilities.filter((cap: string) =>
          otherRoute.capabilities.includes(cap),
        );

        if (sharedCaps.length > 0) {
          const otherRouteId = otherRoute.id || otherRoute.path;
          edges.push({
            from: routeId,
            to: otherRouteId,
            label: sharedCaps.join(", "),
            type: "capability",
          });
        }
      }
    });
  });

  return {
    specHash: computeSpecHash(resolved),
    routes: {
      nodes,
      edges,
    },
  };
}
