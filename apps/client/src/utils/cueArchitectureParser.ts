/**
 * CUE Architecture Parser
 * Extracts architectural elements from CUE specifications for diagram generation
 */

import {
  type ConnectionType,
  type CueArchitectureData,
  type DiagramComponent,
  type DiagramConnection,
  type FlowStep,
} from "../types/architecture";

type KnownWorkload = "deployment" | "statefulset" | "daemonset" | "job" | "cronjob";

const WORKLOAD_VALUES = new Set<KnownWorkload>([
  "deployment",
  "statefulset",
  "daemonset",
  "job",
  "cronjob",
]);

const isWorkload = (value: unknown): value is KnownWorkload =>
  typeof value === "string" && WORKLOAD_VALUES.has(value as KnownWorkload);

const deriveWorkload = (serviceData: Record<string, any>): KnownWorkload | undefined => {
  if (isWorkload(serviceData.workload)) {
    return serviceData.workload;
  }
  if (isWorkload(serviceData.mode)) {
    return serviceData.mode;
  }
  if (isWorkload(serviceData.type)) {
    return serviceData.type;
  }
  return undefined;
};

const deriveArtifactType = (serviceData: Record<string, any>): "internal" | "external" => {
  const raw =
    serviceData.type ?? serviceData.artifactType ?? serviceData.serviceType ?? serviceData.category;
  if (raw === "internal" || raw === "external") {
    return raw;
  }
  if (raw === "bespoke") {
    return "internal";
  }
  if (raw === "prebuilt") {
    return "external";
  }
  if (serviceData.sourceDirectory || serviceData.source?.kind === "monorepo") {
    return "internal";
  }
  if (serviceData.image || serviceData.source?.kind) {
    return "external";
  }
  return "internal";
};

export class CueArchitectureParser {
  private static isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  private static normalizeKind(value: Record<string, any>, fallback: string): string {
    const candidate =
      value.kind ??
      value.class ??
      value.serviceClass ??
      value.service_type ??
      value.category ??
      value.role ??
      value.type;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
    return fallback;
  }

  private static deriveServiceLayer(kind?: string): DiagramComponent["layer"] {
    const lower = (kind || "").toLowerCase();
    if (["database", "datastore", "db", "kv", "kv_store", "cache"].includes(lower)) {
      return "data";
    }
    if (["proxy", "load_balancer", "cdn"].includes(lower)) {
      return "service";
    }
    return "service";
  }

  private static normalizeServices(cueData: CueArchitectureData): Array<{
    id: string;
    name: string;
    data: Record<string, any>;
    kind: string;
  }> {
    const services: Array<{ id: string; name: string; data: Record<string, any>; kind: string }> =
      [];

    const collect = (source: unknown, defaultKind: string, prefix: string) => {
      if (!source) return;
      if (CueArchitectureParser.isRecord(source)) {
        Object.entries(source as Record<string, any>).forEach(([id, raw]) => {
          const data = (raw || {}) as Record<string, any>;
          const kind = CueArchitectureParser.normalizeKind(data, defaultKind);
          const name = (data.name as string) || id;
          services.push({ id, name, data, kind });
        });
      } else if (Array.isArray(source)) {
        (source as Array<any>).forEach((entry, idx) => {
          const data = (entry || {}) as Record<string, any>;
          const id = (data.id as string) || (data.name as string) || `${prefix}_${idx + 1}`;
          const kind = CueArchitectureParser.normalizeKind(data, defaultKind);
          const name = (data.name as string) || id;
          services.push({ id, name, data, kind });
        });
      }
    };

    collect(cueData.services, "service", "service");
    // Common service-like collections collapsed into services
    const infra = cueData.infrastructure || {};
    collect(infra.databases || infra.database, "database", "database");
    collect(infra.datastores, "database", "datastore");
    collect(infra.caches || infra.cache, "cache", "cache");
    collect(
      infra.queues || infra.queue || infra.message_queue || infra.message_queues,
      "queue",
      "queue",
    );
    collect(infra.proxies, "proxy", "proxy");
    collect(infra.load_balancers || infra.loadBalancer, "load_balancer", "lb");
    if (infra.networking) {
      collect(
        infra.networking.load_balancer || infra.networking.load_balancers,
        "load_balancer",
        "lb",
      );
      collect(infra.networking.proxies, "proxy", "proxy");
      collect(infra.networking.cdn, "cdn", "cdn");
    }

    return services;
  }

  private static normalizeResources(cueData: CueArchitectureData): DiagramComponent[] {
    const resources: DiagramComponent[] = [];
    const resourceIds = new Set<string>();

    const addResource = (resource: DiagramComponent) => {
      if (resourceIds.has(resource.id)) return;
      resourceIds.add(resource.id);
      resources.push(resource);
    };

    const buildResourceComponent = (params: {
      id: string;
      name: string;
      kind: string;
      layer: DiagramComponent["layer"];
      description?: string;
      metadata?: Record<string, any>;
      routePath?: string;
      size?: { width: number; height: number };
      capabilities?: string[];
    }): DiagramComponent => {
      return {
        id: params.id,
        name: params.name,
        type: "resource",
        kind: params.kind,
        description: params.description,
        layer: params.layer,
        position: { x: 0, y: 0 },
        size: params.size ?? { width: 160, height: 70 },
        ...(params.routePath ? { routePath: params.routePath } : {}),
        ...(params.capabilities ? { capabilities: params.capabilities } : {}),
        metadata: params.metadata ?? {},
      };
    };

    // New simplified schema: resources collection
    const collectResources = (source: unknown, defaultKind: string, prefix: string) => {
      if (!source) return;
      if (CueArchitectureParser.isRecord(source)) {
        Object.entries(source as Record<string, any>).forEach(([id, raw]) => {
          const data = (raw || {}) as Record<string, any>;
          const kind = CueArchitectureParser.normalizeKind(data, defaultKind);
          const name = (data.name as string) || id;
          const layer =
            kind.toLowerCase() === "view" || kind.toLowerCase() === "ui"
              ? "presentation"
              : "service";
          addResource(
            buildResourceComponent({
              id: `resource_${id}`,
              name,
              kind,
              layer,
              description: data.description,
              metadata: data,
              routePath: data.path ?? data.route ?? data.routePath,
            }),
          );
        });
      } else if (Array.isArray(source)) {
        (source as Array<any>).forEach((raw, idx) => {
          const data = (raw || {}) as Record<string, any>;
          const id = (data.id as string) || (data.name as string) || `${prefix}_${idx + 1}`;
          const kind = CueArchitectureParser.normalizeKind(data, defaultKind);
          const name = (data.name as string) || id;
          const layer =
            kind.toLowerCase() === "view" || kind.toLowerCase() === "ui"
              ? "presentation"
              : "service";
          addResource(
            buildResourceComponent({
              id: `resource_${id}`,
              name,
              kind,
              layer,
              description: data.description,
              metadata: data,
              routePath: data.path ?? data.route ?? data.routePath,
            }),
          );
        });
      }
    };

    collectResources(cueData.resources, "resource", "resource");

    // Legacy OpenAPI-style paths -> endpoint resources
    if (cueData.paths) {
      Object.entries(cueData.paths).forEach(([path, pathData]) => {
        const methods = Object.keys(pathData as any).filter((key) =>
          ["get", "post", "put", "patch", "delete"].includes(key),
        );

        methods.forEach((method) => {
          const idSafe = path.replace(/[^a-zA-Z0-9]/g, "_");
          const resourceId = `resource_${method}_${idSafe}`;
          addResource(
            buildResourceComponent({
              id: resourceId,
              name: `${method.toUpperCase()} ${path}`,
              kind: "endpoint",
              layer: "service",
              description: `API endpoint: ${method.toUpperCase()} ${path}`,
              metadata: {
                method: method.toUpperCase(),
                path,
                pathData: (pathData as any)[method],
              },
              size: { width: 160, height: 60 },
            }),
          );
        });
      });
    }

    // Legacy UI routes -> view resources
    if (cueData.ui?.routes) {
      cueData.ui.routes.forEach((route, index) => {
        const id = route.id || `view_${index}`;
        addResource(
          buildResourceComponent({
            id: `resource_view_${id}`,
            name: route.name || route.path || `Route ${index + 1}`,
            kind: "view",
            layer: "presentation",
            description: `View: ${route.path}`,
            routePath: route.path,
            size: { width: 150, height: 80 },
            capabilities: route.capabilities || [],
            metadata: {
              ...route,
              requiresAuth: route.requiresAuth,
              component: route.component,
              layout: route.layout,
            },
          }),
        );
      });
    }

    return resources;
  }

  /**
   * Parse CUE data into architecture components and connections
   */
  static parseArchitecture(cueData: CueArchitectureData): {
    components: DiagramComponent[];
    connections: DiagramConnection[];
  } {
    const components: DiagramComponent[] = [];
    const connections: DiagramConnection[] = [];

    CueArchitectureParser.parseAppSchema(cueData, components, connections);

    return { components, connections };
  }

  /**
   * Parse app-centric schema
   */
  private static parseAppSchema(
    cueData: CueArchitectureData,
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): void {
    // Parse capabilities as application layer components
    if (cueData.capabilities) {
      Object.entries(cueData.capabilities).forEach(([capId, capData]) => {
        components.push({
          id: `capability_${capId}`,
          name: (capData as any).name || capId,
          type: "capability",
          description: (capData as any).description || `Capability: ${capId}`,
          layer: "application",
          position: { x: 0, y: 0 },
          size: { width: 140, height: 70 },
          metadata: {
            requirements: (capData as any).requirements || [],
          },
        });
      });
    }

    // Parse services and service-like infrastructure
    CueArchitectureParser.normalizeServices(cueData).forEach((svc) => {
      components.push({
        id: `service_${svc.id}`,
        name: svc.name || svc.id,
        type: "service",
        kind: svc.kind,
        description: svc.data.description || `Service: ${svc.id}`,
        layer: CueArchitectureParser.deriveServiceLayer(svc.kind),
        position: { x: 0, y: 0 },
        size: { width: 180, height: 100 },
        artifactType: deriveArtifactType(svc.data as Record<string, any>),
        language: (svc.data as any).language,
        workload: deriveWorkload(svc.data as Record<string, any>),
        ports: CueArchitectureParser.parseServicePorts(svc.data as any),
        metadata: { ...svc.data, serviceKind: svc.kind },
      });
    });

    // Parse unified resources (endpoints/views)
    CueArchitectureParser.normalizeResources(cueData).forEach((resource) => {
      components.push(resource);
    });

    // Parse processes (formerly state machines)
    const processes = cueData.processes ?? cueData.stateModels;
    if (processes) {
      Object.entries(processes).forEach(([processId, processData]) => {
        components.push({
          id: `process_${processId}`,
          name: (processData as any).name || processId,
          type: "process",
          description: `Process: ${processId}`,
          layer: "application",
          position: { x: 0, y: 0 },
          size: { width: 140, height: 90 },
          states: (processData as any).states || {},
          metadata: {
            initial: (processData as any).initial,
            states: (processData as any).states,
          },
        });
      });
    }

    // Parse behaviors (formerly flows) to generate connections
    const behaviors = cueData.behaviors ?? cueData.flows;
    if (behaviors) {
      behaviors.forEach((flow: any, flowIndex: number) => {
        CueArchitectureParser.parseFlowConnections(flow, flowIndex, components, connections);
      });
    }

    // Parse capability dependencies
    CueArchitectureParser.parseCapabilityConnections(cueData, components, connections);

    // Parse route-capability relationships
    CueArchitectureParser.parseRouteCapabilityConnections(cueData, components, connections);
  }

  /**
   * Parse service ports into diagram ports
   */
  private static parseServicePorts(serviceData: any): any[] {
    if (!serviceData.ports) return [];

    return serviceData.ports.map((port: any, index: number) => ({
      id: `port_${port.name || index}`,
      position: { x: 40 + index * 30, y: 100 }, // Bottom edge
      type: "bidirectional",
      protocol: port.protocol || "http",
      metadata: {
        port: port.port,
        targetPort: port.targetPort,
        name: port.name,
      },
    }));
  }

  /**
   * Parse flows into user journey connections
   */
  private static parseFlowConnections(
    flow: any,
    flowIndex: number,
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): void {
    if (!flow.steps || !Array.isArray(flow.steps)) return;

    const flowSteps: FlowStep[] = flow.steps.map((step: any, index: number) => ({
      id: `${flow.id || flowIndex}_step_${index}`,
      type: Object.keys(step)[0]!, // visit, click, fill, expect, expect_api
      target: step.visit || step.click?.locator || step.fill?.locator || "",
      value: step.fill?.value,
      expectation: step.expect || step.expect_api,
    }));

    // Create connections between flow steps
    for (let i = 0; i < flowSteps.length - 1; i++) {
      const currentStep = flowSteps[i];
      const nextStep = flowSteps[i + 1];

      // Try to find corresponding components
      const fromComponent = CueArchitectureParser.findComponentForFlowStep(currentStep, components);
      const toComponent = nextStep
        ? CueArchitectureParser.findComponentForFlowStep(nextStep, components)
        : undefined;

      if (fromComponent && toComponent && fromComponent.id !== toComponent.id) {
        connections.push({
          id: `flow_${flow.id || flowIndex}_${i}_${i + 1}`,
          from: { componentId: fromComponent.id },
          to: { componentId: toComponent.id },
          type: CueArchitectureParser.getConnectionTypeForStep(nextStep),
          label: CueArchitectureParser.getConnectionLabelForStep(nextStep),
          metadata: {
            userAction: nextStep!.type,
            expectation: nextStep!.expectation,
          },
        });
      }
    }
  }

  /**
   * Find component that corresponds to a flow step
   */
  private static findComponentForFlowStep(
    step: FlowStep | undefined,
    components: DiagramComponent[],
  ): DiagramComponent | undefined {
    if (!step) return undefined;

    // For visit steps, find view resources (or legacy routes)
    if (step.type === "visit" && step.target) {
      return components.find(
        (c) =>
          (c.type === "resource" &&
            (c.kind === "view" || c.layer === "presentation") &&
            (c.routePath === step.target || c.id.includes(step.target ?? ""))) ||
          (c.type === "route" && (c.routePath === step.target || c.id.includes(step.target ?? ""))),
      );
    }

    // For API expectations, find endpoint resources
    if (step.type === "expect_api" && step.expectation) {
      const { method, path } = step.expectation;
      return components.find(
        (c) =>
          (c.type === "resource" &&
            (c.kind === "endpoint" || c.kind === "api_endpoint") &&
            c.metadata?.method === method &&
            c.metadata?.path === path) ||
          (c.type === "api_endpoint" && c.metadata?.method === method && c.metadata?.path === path),
      );
    }

    // For UI interactions, find components by capabilities
    if (["click", "fill", "expect"].includes(step.type)) {
      // This would require locator mapping, simplified for now
      return components.find((c) => c.type === "route");
    }

    return undefined;
  }

  /**
   * Determine connection type for flow step
   */
  private static getConnectionTypeForStep(step: FlowStep | undefined): ConnectionType {
    if (!step) return "data_flow";

    switch (step.type) {
      case "visit":
        return "user_navigation";
      case "click":
      case "fill":
        return "user_interaction";
      case "expect_api":
        return "api_call";
      default:
        return "data_flow";
    }
  }

  /**
   * Generate connection label for flow step
   */
  private static getConnectionLabelForStep(step: FlowStep | undefined): string {
    if (!step) return "Unknown";

    switch (step.type) {
      case "visit":
        return `Navigate to ${step.target ?? ""}`;
      case "click":
        return `Click ${step.target ?? ""}`;
      case "fill":
        return `Fill ${step.target ?? ""}`;
      case "expect_api":
        return `API: ${step.expectation?.method ?? ""} ${step.expectation?.path ?? ""}`;
      default:
        return step.type;
    }
  }

  /**
   * Parse capability dependencies into connections
   */
  private static parseCapabilityConnections(
    cueData: CueArchitectureData,
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): void {
    if (!cueData.capabilities) return;

    Object.entries(cueData.capabilities).forEach(([capId, capData]) => {
      const requirements = (capData as any).requirements || [];
      const fromComponent = components.find((c) => c.id === `capability_${capId}`);

      if (!fromComponent) return;

      requirements.forEach((requirement: string) => {
        // Find components that provide this requirement
        const toComponent = components.find(
          (c) =>
            c.capabilities?.includes(requirement) ||
            c.metadata?.requirements?.includes(requirement),
        );

        if (toComponent) {
          connections.push({
            id: `capability_${capId}_requires_${requirement}`,
            from: { componentId: fromComponent.id },
            to: { componentId: toComponent.id },
            type: "capability_usage",
            label: `Requires ${requirement}`,
            metadata: { capability: requirement },
          });
        }
      });
    });
  }

  /**
   * Parse route-capability relationships
   */
  private static parseRouteCapabilityConnections(
    cueData: CueArchitectureData,
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): void {
    if (!cueData.ui?.routes) return;

    cueData.ui.routes.forEach((route) => {
      const routeComponent = components.find(
        (c) =>
          (c.type === "resource" &&
            (c.kind === "view" || c.layer === "presentation") &&
            c.routePath === route.path) ||
          (c.type === "route" && c.routePath === route.path),
      );

      if (!routeComponent || !route.capabilities) return;

      route.capabilities.forEach((capName: string) => {
        const capComponent = components.find((c) => c.type === "capability" && c.name === capName);

        if (capComponent) {
          connections.push({
            id: `route_${route.id}_uses_${capName}`,
            from: { componentId: routeComponent.id },
            to: { componentId: capComponent.id },
            type: "capability_usage",
            label: `Uses ${capName}`,
            metadata: { capability: capName },
          });
        }
      });
    });
  }

  /**
   * Analyze CUE data structure and suggest diagram types
   */
  static suggestDiagramTypes(cueData: CueArchitectureData): string[] {
    const suggestions: string[] = [];

    const serviceCount = CueArchitectureParser.normalizeServices(cueData).length;
    const resourceCount = CueArchitectureParser.normalizeResources(cueData).length;
    const processCount = Object.keys(cueData.processes ?? cueData.stateModels ?? {}).length;

    if (cueData.ui?.routes && (cueData.behaviors ?? cueData.flows)) {
      suggestions.push("user_journey");
    }

    if (serviceCount > 0) {
      suggestions.push("service_topology");
    }

    if (cueData.capabilities) {
      suggestions.push("capability_map");
    }

    if (processCount > 0) {
      suggestions.push("state_diagram");
    }

    if (resourceCount > 0) {
      suggestions.push("api_surface");
    }

    // Always suggest system overview if we have components
    if (suggestions.length > 0) {
      suggestions.unshift("system_overview");
    }

    return suggestions;
  }
}
