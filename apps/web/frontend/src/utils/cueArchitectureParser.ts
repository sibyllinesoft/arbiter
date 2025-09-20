/**
 * CUE Architecture Parser
 * Extracts architectural elements from CUE specifications for diagram generation
 */

import {
  type ConnectionType,
  type CueArchitectureData,
  type DiagramComponent,
  type DiagramConnection,
  type DiagramLayer,
  type ElementType,
  type FlowStep,
} from '../types/architecture';

export class CueArchitectureParser {
  /**
   * Parse CUE data into architecture components and connections
   */
  static parseArchitecture(cueData: CueArchitectureData): {
    components: DiagramComponent[];
    connections: DiagramConnection[];
  } {
    const components: DiagramComponent[] = [];
    const connections: DiagramConnection[] = [];

    // Detect schema version
    const isV2 = cueData.ui || cueData.flows || cueData.capabilities;

    if (isV2) {
      // Parse v2 (app-centric) schema
      CueArchitectureParser.parseV2Schema(cueData, components, connections);
    } else {
      // Parse v1 (infrastructure-focused) schema
      CueArchitectureParser.parseV1Schema(cueData, components, connections);
    }

    return { components, connections };
  }

  /**
   * Parse v2 app-centric schema
   */
  private static parseV2Schema(
    cueData: CueArchitectureData,
    components: DiagramComponent[],
    connections: DiagramConnection[]
  ): void {
    // Parse UI routes as presentation layer components
    if (cueData.ui?.routes) {
      cueData.ui.routes.forEach((route, index) => {
        components.push({
          id: `route_${route.id || index}`,
          name: route.name || route.path || `Route ${index + 1}`,
          type: 'route',
          description: `UI route: ${route.path}`,
          layer: 'presentation',
          position: { x: 0, y: 0 }, // Will be calculated by layout
          size: { width: 150, height: 80 },
          routePath: route.path,
          capabilities: route.capabilities || [],
          metadata: {
            requiresAuth: route.requiresAuth,
            component: route.component,
            layout: route.layout,
          },
        });
      });
    }

    // Parse capabilities as application layer components
    if (cueData.capabilities) {
      Object.entries(cueData.capabilities).forEach(([capId, capData]) => {
        components.push({
          id: `capability_${capId}`,
          name: (capData as any).name || capId,
          type: 'capability',
          description: (capData as any).description || `Capability: ${capId}`,
          layer: 'application',
          position: { x: 0, y: 0 },
          size: { width: 140, height: 70 },
          metadata: {
            requirements: (capData as any).requirements || [],
          },
        });
      });
    }

    // Parse services as service layer components
    if (cueData.services) {
      Object.entries(cueData.services).forEach(([serviceId, serviceData]) => {
        components.push({
          id: `service_${serviceId}`,
          name: (serviceData as any).name || serviceId,
          type: 'service',
          description: `Service: ${serviceId}`,
          layer: 'service',
          position: { x: 0, y: 0 },
          size: { width: 180, height: 100 },
          serviceType: (serviceData as any).serviceType,
          language: (serviceData as any).language,
          deploymentType: (serviceData as any).type,
          ports: CueArchitectureParser.parseServicePorts(serviceData as any),
          metadata: serviceData,
        });
      });
    }

    // Parse API paths as service endpoints
    if (cueData.paths) {
      Object.entries(cueData.paths).forEach(([path, pathData]) => {
        const methods = Object.keys(pathData as any).filter(key =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(key)
        );

        methods.forEach(method => {
          components.push({
            id: `api_${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: `${method.toUpperCase()} ${path}`,
            type: 'api_endpoint',
            description: `API endpoint: ${method.toUpperCase()} ${path}`,
            layer: 'service',
            position: { x: 0, y: 0 },
            size: { width: 160, height: 60 },
            metadata: {
              method: method.toUpperCase(),
              path,
              pathData: (pathData as any)[method],
            },
          });
        });
      });
    }

    // Parse state models
    if (cueData.stateModels) {
      Object.entries(cueData.stateModels).forEach(([modelId, modelData]) => {
        components.push({
          id: `state_${modelId}`,
          name: (modelData as any).name || modelId,
          type: 'state_machine',
          description: `State machine: ${modelId}`,
          layer: 'application',
          position: { x: 0, y: 0 },
          size: { width: 140, height: 90 },
          states: (modelData as any).states || {},
          metadata: {
            initial: (modelData as any).initial,
            states: (modelData as any).states,
          },
        });
      });
    }

    // Parse flows to generate connections
    if (cueData.flows) {
      cueData.flows.forEach((flow, flowIndex) => {
        CueArchitectureParser.parseFlowConnections(flow, flowIndex, components, connections);
      });
    }

    // Parse capability dependencies
    CueArchitectureParser.parseCapabilityConnections(cueData, components, connections);

    // Parse route-capability relationships
    CueArchitectureParser.parseRouteCapabilityConnections(cueData, components, connections);
  }

  /**
   * Parse v1 infrastructure-focused schema
   */
  private static parseV1Schema(
    cueData: CueArchitectureData,
    components: DiagramComponent[],
    connections: DiagramConnection[]
  ): void {
    // Parse services from v1 schema
    if (cueData.services) {
      Object.entries(cueData.services).forEach(([serviceId, serviceData]) => {
        components.push({
          id: `service_${serviceId}`,
          name: (serviceData as any).name || serviceId,
          type: 'service',
          description: `Service: ${serviceId}`,
          layer: 'service',
          position: { x: 0, y: 0 },
          size: { width: 180, height: 100 },
          serviceType: (serviceData as any).serviceType,
          language: (serviceData as any).language,
          deploymentType: (serviceData as any).type,
          replicas: (serviceData as any).replicas,
          ports: CueArchitectureParser.parseServicePorts(serviceData as any),
          metadata: serviceData,
        });
      });
    }

    // Parse deployment configuration
    if (cueData.deployment) {
      components.push({
        id: 'deployment_target',
        name: 'Deployment Target',
        type: 'external_system',
        description: `Deployment: ${(cueData.deployment as any).target || 'Unknown'}`,
        layer: 'external',
        position: { x: 0, y: 0 },
        size: { width: 160, height: 80 },
        metadata: cueData.deployment,
      });
    }

    // Parse service dependencies from v1
    CueArchitectureParser.parseV1ServiceConnections(cueData, components, connections);
  }

  /**
   * Parse service ports into diagram ports
   */
  private static parseServicePorts(serviceData: any): any[] {
    if (!serviceData.ports) return [];

    return serviceData.ports.map((port: any, index: number) => ({
      id: `port_${port.name || index}`,
      position: { x: 40 + index * 30, y: 100 }, // Bottom edge
      type: 'bidirectional',
      protocol: port.protocol || 'http',
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
    connections: DiagramConnection[]
  ): void {
    if (!flow.steps || !Array.isArray(flow.steps)) return;

    const flowSteps: FlowStep[] = flow.steps.map((step: any, index: number) => ({
      id: `${flow.id || flowIndex}_step_${index}`,
      type: Object.keys(step)[0], // visit, click, fill, expect, expect_api
      target: step.visit || step.click?.locator || step.fill?.locator,
      value: step.fill?.value,
      expectation: step.expect || step.expect_api,
    }));

    // Create connections between flow steps
    for (let i = 0; i < flowSteps.length - 1; i++) {
      const currentStep = flowSteps[i];
      const nextStep = flowSteps[i + 1];

      // Try to find corresponding components
      const fromComponent = CueArchitectureParser.findComponentForFlowStep(currentStep, components);
      const toComponent = CueArchitectureParser.findComponentForFlowStep(nextStep, components);

      if (fromComponent && toComponent && fromComponent.id !== toComponent.id) {
        connections.push({
          id: `flow_${flow.id || flowIndex}_${i}_${i + 1}`,
          from: { componentId: fromComponent.id },
          to: { componentId: toComponent.id },
          type: CueArchitectureParser.getConnectionTypeForStep(nextStep),
          label: CueArchitectureParser.getConnectionLabelForStep(nextStep),
          metadata: {
            userAction: nextStep.type,
            expectation: nextStep.expectation,
            flowId: flow.id,
            stepIndex: i + 1,
          },
        });
      }
    }
  }

  /**
   * Find component that corresponds to a flow step
   */
  private static findComponentForFlowStep(
    step: FlowStep,
    components: DiagramComponent[]
  ): DiagramComponent | undefined {
    // For visit steps, find route components
    if (step.type === 'visit' && step.target) {
      return components.find(
        c => c.type === 'route' && (c.routePath === step.target || c.id.includes(step.target))
      );
    }

    // For API expectations, find API endpoint components
    if (step.type === 'expect_api' && step.expectation) {
      const { method, path } = step.expectation;
      return components.find(
        c => c.type === 'api_endpoint' && c.metadata?.method === method && c.metadata?.path === path
      );
    }

    // For UI interactions, find components by capabilities
    if (['click', 'fill', 'expect'].includes(step.type)) {
      // This would require locator mapping, simplified for now
      return components.find(c => c.type === 'route');
    }

    return undefined;
  }

  /**
   * Determine connection type for flow step
   */
  private static getConnectionTypeForStep(step: FlowStep): ConnectionType {
    switch (step.type) {
      case 'visit':
        return 'user_navigation';
      case 'click':
      case 'fill':
        return 'user_interaction';
      case 'expect_api':
        return 'api_call';
      default:
        return 'data_flow';
    }
  }

  /**
   * Generate connection label for flow step
   */
  private static getConnectionLabelForStep(step: FlowStep): string {
    switch (step.type) {
      case 'visit':
        return `Navigate to ${step.target}`;
      case 'click':
        return `Click ${step.target}`;
      case 'fill':
        return `Fill ${step.target}`;
      case 'expect_api':
        return `API: ${step.expectation?.method} ${step.expectation?.path}`;
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
    connections: DiagramConnection[]
  ): void {
    if (!cueData.capabilities) return;

    Object.entries(cueData.capabilities).forEach(([capId, capData]) => {
      const requirements = (capData as any).requirements || [];
      const fromComponent = components.find(c => c.id === `capability_${capId}`);

      if (!fromComponent) return;

      requirements.forEach((requirement: string) => {
        // Find components that provide this requirement
        const toComponent = components.find(
          c =>
            c.capabilities?.includes(requirement) || c.metadata?.requirements?.includes(requirement)
        );

        if (toComponent) {
          connections.push({
            id: `capability_${capId}_requires_${requirement}`,
            from: { componentId: fromComponent.id },
            to: { componentId: toComponent.id },
            type: 'capability_usage',
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
    connections: DiagramConnection[]
  ): void {
    if (!cueData.ui?.routes) return;

    cueData.ui.routes.forEach(route => {
      const routeComponent = components.find(c => c.type === 'route' && c.routePath === route.path);

      if (!routeComponent || !route.capabilities) return;

      route.capabilities.forEach((capName: string) => {
        const capComponent = components.find(c => c.type === 'capability' && c.name === capName);

        if (capComponent) {
          connections.push({
            id: `route_${route.id}_uses_${capName}`,
            from: { componentId: routeComponent.id },
            to: { componentId: capComponent.id },
            type: 'capability_usage',
            label: `Uses ${capName}`,
            metadata: { capability: capName },
          });
        }
      });
    });
  }

  /**
   * Parse v1 service connections
   */
  private static parseV1ServiceConnections(
    cueData: CueArchitectureData,
    components: DiagramComponent[],
    connections: DiagramConnection[]
  ): void {
    if (!cueData.services) return;

    // Look for dependencies in service configurations
    Object.entries(cueData.services).forEach(([serviceId, serviceData]) => {
      const fromComponent = components.find(c => c.id === `service_${serviceId}`);
      if (!fromComponent) return;

      // Parse environment variables for service dependencies
      const env = (serviceData as any).env || {};
      Object.entries(env).forEach(([envKey, envValue]) => {
        if (typeof envValue === 'string' && envValue.includes('service')) {
          // Simple heuristic: if env value references another service
          const referencedService = Object.keys(cueData.services!).find(
            s => envValue.includes(s) && s !== serviceId
          );

          if (referencedService) {
            const toComponent = components.find(c => c.id === `service_${referencedService}`);
            if (toComponent) {
              connections.push({
                id: `service_${serviceId}_depends_${referencedService}`,
                from: { componentId: fromComponent.id },
                to: { componentId: toComponent.id },
                type: 'dependency',
                label: `${envKey}`,
                metadata: { envKey, envValue },
              });
            }
          }
        }
      });
    });
  }

  /**
   * Analyze CUE data structure and suggest diagram types
   */
  static suggestDiagramTypes(cueData: CueArchitectureData): string[] {
    const suggestions: string[] = [];

    if (cueData.ui?.routes && cueData.flows) {
      suggestions.push('user_journey');
    }

    if (cueData.services || (cueData.services && Object.keys(cueData.services).length > 1)) {
      suggestions.push('service_topology');
    }

    if (cueData.capabilities) {
      suggestions.push('capability_map');
    }

    if (cueData.stateModels) {
      suggestions.push('state_diagram');
    }

    if (cueData.paths) {
      suggestions.push('api_surface');
    }

    // Always suggest system overview if we have components
    if (suggestions.length > 0) {
      suggestions.unshift('system_overview');
    }

    return suggestions;
  }
}
