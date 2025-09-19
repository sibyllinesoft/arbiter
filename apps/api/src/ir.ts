/**
 * Intermediate Representation (IR) generator for diagrams and visualizations
 */
import type { IRKind, IRResponse } from './types.ts';
import { getCurrentTimestamp, logger } from './utils.ts';

export class IRGenerator {
  /**
   * Generate IR for different diagram types
   */
  async generateIR(kind: IRKind, resolved: Record<string, unknown>): Promise<IRResponse> {
    const startTime = Date.now();

    try {
      let data: Record<string, unknown>;

      switch (kind) {
        case 'flow':
          data = this.generateFlowIR(resolved);
          break;
        case 'fsm':
          data = this.generateFsmIR(resolved);
          break;
        case 'view':
          data = this.generateViewIR(resolved);
          break;
        case 'site':
          data = this.generateSiteIR(resolved);
          break;
        case 'capabilities':
          data = this.generateCapabilitiesIR(resolved);
          break;
        case 'flows':
          data = this.generateFlowsIR(resolved);
          break;
        case 'dependencies':
          data = this.generateDependenciesIR(resolved);
          break;
        case 'coverage':
          data = this.generateCoverageIR(resolved);
          break;
        default:
          throw new Error(`Unknown IR kind: ${kind}`);
      }

      const duration = Date.now() - startTime;

      // Reduced logging - only log for debug level when enabled
      // logger.debug("Generated IR", {
      //   kind,
      //   nodeCount: this.getNodeCount(data),
      //   duration,
      // });

      return {
        kind,
        data,
        generated_at: getCurrentTimestamp(),
      };
    } catch (error) {
      logger.error('IR generation failed', error instanceof Error ? error : undefined, { kind });

      throw new Error(
        `Failed to generate ${kind} IR: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate flow IR for Mermaid (flowchart/sequence) - from TODO.md specification
   */
  private generateFlowIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const flows = this.extractFlows(resolved);
    const flowIRs: any[] = [];

    Object.entries(flows).forEach(([flowId, flow]) => {
      const nodes: any[] = [];
      const edges: any[] = [];

      if (Array.isArray(flow.steps)) {
        flow.steps.forEach((step: any, index: number) => {
          const nodeId = step.id || `${index}`;
          const kind = this.getFlowStepKind(step);
          const label = this.getFlowStepLabel(step, index);

          nodes.push({
            id: nodeId,
            kind,
            label,
          });

          // Create edges based on dependsOn relationships
          if (step.dependsOn && Array.isArray(step.dependsOn)) {
            step.dependsOn.forEach((depId: string) => {
              edges.push({
                from: depId,
                to: nodeId,
                label: step.transition || '',
              });
            });
          }
        });
      }

      flowIRs.push({
        id: flowId,
        nodes,
        edges,
      });
    });

    return {
      specHash: this.computeSpecHash(resolved),
      flows: flowIRs,
    };
  }

  /**
   * Generate FSM IR for XState - from TODO.md specification
   */
  private generateFsmIR(resolved: Record<string, unknown>): Record<string, unknown> {
    // Handle both CUE format (states) and legacy format (stateModels)
    const stateModels =
      (resolved.states as Record<string, any>) ||
      (resolved.stateModels as Record<string, any>) ||
      {};
    const fsms: any[] = [];

    Object.entries(stateModels).forEach(([fsmId, model]) => {
      const states: Record<string, any> = {};

      if (model.states && typeof model.states === 'object') {
        Object.entries(model.states).forEach(([stateId, state]: [string, any]) => {
          states[stateId] = {
            actions: state.actions || [],
            transitions: state.transitions || state.on || {},
          };
        });
      }

      fsms.push({
        id: fsmId,
        name: model.name || fsmId,
        initial: model.initialState || model.initial || 'idle',
        states,
      });
    });

    return {
      specHash: this.computeSpecHash(resolved),
      fsms,
    };
  }

  /**
   * Generate view IR for wireframes - from TODO.md specification
   */
  private generateViewIR(resolved: Record<string, unknown>): Record<string, unknown> {
    // Handle both CUE format (routes) and legacy format (ui.routes)
    const routes = (resolved.routes as Record<string, any>) || (resolved.ui as any)?.routes || {};
    const locators = (resolved.locators as Record<string, string>) || {};
    const views: any[] = [];

    Object.entries(routes).forEach(([path, route]: [string, any]) => {
      const widgets: any[] = [];

      // Extract widgets from route components and map with locators
      if (route.components && Array.isArray(route.components)) {
        route.components.forEach((component: any) => {
          if (component.type === 'button' && component.token) {
            widgets.push({
              type: 'button',
              token: component.token,
              text: component.text || component.token,
            });
          } else if (component.type === 'input' && component.token) {
            widgets.push({
              type: 'input',
              token: component.token,
              label: component.label || component.token,
            });
          } else if (component.type === 'table' && component.token) {
            widgets.push({
              type: 'table',
              token: component.token,
              columns: component.columns || [],
            });
          }
        });
      }

      // Also extract widgets from referenced locators
      Object.entries(locators).forEach(([token, _selector]) => {
        if (token.startsWith('btn:')) {
          widgets.push({
            type: 'button',
            token,
            text: token.replace('btn:', ''),
          });
        } else if (token.startsWith('input:')) {
          widgets.push({
            type: 'input',
            token,
            label: token.replace('input:', ''),
          });
        }
      });

      // Create view for each route (even without widgets for navigation structure)
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
      specHash: this.computeSpecHash(resolved),
      views,
    };
  }

  /**
   * Generate site IR (DAG of routes) for Graphviz - from TODO.md specification
   */
  private generateSiteIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const routes = (resolved.ui as any)?.routes || [];
    const nodes: any[] = [];
    const edges: any[] = [];

    // Create nodes for each route
    routes.forEach((route: any) => {
      nodes.push({
        id: route.id || route.path,
        label: route.name || route.path,
        path: route.path,
        capabilities: route.capabilities || [],
      });
    });

    // Create edges based on route relationships and navigation patterns
    routes.forEach((route: any, index: number) => {
      const routeId = route.id || route.path;

      // Connect routes that share capabilities (simplified relationship detection)
      routes.forEach((otherRoute: any, otherIndex: number) => {
        if (index !== otherIndex && route.capabilities && otherRoute.capabilities) {
          const sharedCaps = route.capabilities.filter((cap: string) =>
            otherRoute.capabilities.includes(cap)
          );

          if (sharedCaps.length > 0) {
            const otherRouteId = otherRoute.id || otherRoute.path;
            edges.push({
              from: routeId,
              to: otherRouteId,
              label: sharedCaps.join(', '),
              type: 'capability',
            });
          }
        }
      });
    });

    return {
      specHash: this.computeSpecHash(resolved),
      routes: {
        nodes,
        edges,
      },
    };
  }

  private extractFlows(resolved: Record<string, unknown>): Record<string, any> {
    return (resolved.flows as Record<string, any>) || {};
  }

  private getNodeCount(data: Record<string, unknown>): number {
    const nodes = data.nodes;
    return Array.isArray(nodes) ? nodes.length : 0;
  }

  // New helper methods for TODO.md specification compliance
  private getFlowStepKind(step: any): string {
    // Handle CUE specification format
    if (step.type) return step.type;

    // Fallback to legacy test format
    if (step.visit) return 'visit';
    if (step.click) return 'click';
    if (step.fill) return 'fill';
    if (step.expect) return 'expect';
    if (step.expect_api) return 'expect_api';
    return 'process';
  }

  private getFlowStepLabel(step: any, index: number): string {
    // Handle CUE specification format
    if (step.name) return step.name;

    // Fallback to legacy test format
    if (step.visit) return `Visit: ${step.visit}`;
    if (step.click) return `Click: ${step.click}`;
    if (step.fill) return `Fill: ${step.fill}`;
    if (step.expect) return `Expect: ${step.expect.locator || step.expect}`;
    if (step.expect_api) return `API: ${step.expect_api.method} ${step.expect_api.path}`;
    return `Step ${index + 1}`;
  }

  private computeSpecHash(resolved: Record<string, unknown>): string {
    // Simple hash computation - in production you'd want a proper hash like SHA-256
    return `sha256-${JSON.stringify(resolved).length.toString(16)}`;
  }

  /**
   * Generate capabilities IR for dependency graph visualization
   */
  private generateCapabilitiesIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const capabilities = (resolved.capabilities as Record<string, any>) || {};
    const nodes: any[] = [];
    const edges: any[] = [];
    const groups: any[] = [];
    const domains = new Set<string>();

    // Process capabilities into nodes
    Object.entries(capabilities).forEach(([capId, capability]) => {
      const domain = capId.split('.')[0];
      domains.add(domain);

      nodes.push({
        id: capId,
        label: capability.name || capId,
        type: 'capability',
        domain: domain,
        properties: {
          complexity: capability.complexity || 'medium',
          priority: capability.priority || 'medium',
          owner: capability.owner || 'unknown',
        },
      });

      // Create dependency edges
      if (capability.depends_on && Array.isArray(capability.depends_on)) {
        capability.depends_on.forEach((depId: string) => {
          edges.push({
            source: depId,
            target: capId,
            type: 'dependency',
          });
        });
      }
    });

    // Create domain groups
    domains.forEach(domain => {
      const domainNodes = nodes.filter(n => n.domain === domain);
      groups.push({
        id: domain,
        label: domain.charAt(0).toUpperCase() + domain.slice(1),
        nodeIds: domainNodes.map(n => n.id),
      });
    });

    return {
      type: 'directed_graph',
      nodes,
      edges,
      groups,
      metadata: {
        totalCapabilities: nodes.length,
        dependencies: edges.length,
        domains: domains.size,
      },
    };
  }

  /**
   * Generate flows IR for flowchart visualization (alias for flow)
   */
  private generateFlowsIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const flows = (resolved.flows as Record<string, any>) || {};
    const flowList: any[] = [];

    Object.entries(flows).forEach(([flowId, flow]) => {
      flowList.push({
        id: flowId,
        name: flow.name || flowId,
        steps: flow.steps || [],
      });
    });

    return {
      type: 'flowchart',
      flows: flowList,
    };
  }

  /**
   * Generate dependencies IR for layered graph visualization
   */
  private generateDependenciesIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const capabilities = (resolved.capabilities as Record<string, any>) || {};
    const layers: any[] = [];
    const processed = new Set<string>();
    let layerIndex = 0;

    // Build dependency layers (topological sort)
    while (processed.size < Object.keys(capabilities).length && layerIndex < 10) {
      const currentLayer: any[] = [];

      Object.entries(capabilities).forEach(([capId, capability]) => {
        if (processed.has(capId)) return;

        const dependencies = capability.depends_on || [];
        const allDepsProcessed = dependencies.every((dep: string) => processed.has(dep));

        if (allDepsProcessed) {
          currentLayer.push({
            id: capId,
            label: capability.name || capId,
            dependencies: dependencies,
          });
          processed.add(capId);
        }
      });

      if (currentLayer.length > 0) {
        layers.push({
          level: layerIndex,
          nodes: currentLayer,
        });
      }

      layerIndex++;
    }

    return {
      type: 'layered_graph',
      layers,
    };
  }

  /**
   * Generate coverage IR for test coverage visualization
   */
  private generateCoverageIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const capabilities = (resolved.capabilities as Record<string, any>) || {};
    const tests = (resolved.tests as Record<string, any>) || {};

    const totalCapabilities = Object.keys(capabilities).length;
    let coveredCapabilities = 0;
    const coverage: Record<string, any> = {};

    // Calculate coverage for each capability
    Object.entries(capabilities).forEach(([capId, capability]) => {
      const coveringTests = Object.entries(tests).filter(([_, test]) => {
        const covers = test.covers || [];
        return covers.includes(capId);
      });

      const isCovered = coveringTests.length > 0;
      if (isCovered) coveredCapabilities++;

      coverage[capId] = {
        covered: isCovered,
        testCount: coveringTests.length,
        tests: coveringTests.map(([testId, _]) => testId),
      };
    });

    const overallCoverage =
      totalCapabilities > 0 ? (coveredCapabilities / totalCapabilities) * 100 : 0;

    return {
      type: 'coverage_graph',
      coverage: {
        overall: Math.round(overallCoverage),
        capabilities: coverage,
        summary: {
          total: totalCapabilities,
          covered: coveredCapabilities,
          uncovered: totalCapabilities - coveredCapabilities,
        },
      },
    };
  }
}
