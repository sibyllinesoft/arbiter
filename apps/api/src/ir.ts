/**
 * Intermediate Representation (IR) generator for diagrams and visualizations
 */
import type { IRKind, IRResponse } from "./types.ts";
import { getCurrentTimestamp, logger } from "./utils.ts";

export class IRGenerator {
  /**
   * Generate IR for different diagram types
   */
  async generateIR(kind: IRKind, resolved: Record<string, unknown>): Promise<IRResponse> {
    const startTime = Date.now();

    try {
      let data: Record<string, unknown>;

      switch (kind) {
        case "flow":
          data = this.generateFlowIR(resolved);
          break;
        case "fsm":
          data = this.generateFsmIR(resolved);
          break;
        case "view":
          data = this.generateViewIR(resolved);
          break;
        case "site":
          data = this.generateSiteIR(resolved);
          break;
        case "capabilities":
          data = this.generateCapabilitiesIR(resolved);
          break;
        case "flows":
          data = this.generateFlowsIR(resolved);
          break;
        case "dependencies":
          data = this.generateDependenciesIR(resolved);
          break;
        case "coverage":
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
      logger.error("IR generation failed", error instanceof Error ? error : undefined, { kind });

      throw new Error(
        `Failed to generate ${kind} IR: ${error instanceof Error ? error.message : "Unknown error"}`,
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
                label: step.transition || "",
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
    // Handle both CUE format (states/processes) and legacy format (stateModels)
    const stateModels =
      (resolved.processes as Record<string, any>) ||
      (resolved.states as Record<string, any>) ||
      (resolved.stateModels as Record<string, any>) ||
      {};
    const fsms: any[] = [];

    Object.entries(stateModels).forEach(([fsmId, model]) => {
      const states: Record<string, any> = {};

      if (model.states && typeof model.states === "object") {
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
        initial: model.initialState || model.initial || "idle",
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

      // Also extract widgets from referenced locators
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
    if (step.visit) return "visit";
    if (step.click) return "click";
    if (step.fill) return "fill";
    if (step.expect) return "expect";
    if (step.expect_api) return "expect_api";
    return "process";
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
    const capabilities =
      resolved.capabilities &&
      typeof resolved.capabilities === "object" &&
      !Array.isArray(resolved.capabilities)
        ? (resolved.capabilities as Record<string, any>)
        : {};
    const nodes: any[] = [];
    const edges: any[] = [];
    const groups: any[] = [];
    const domains = new Set<string>();

    // Process capabilities into nodes
    Object.entries(capabilities).forEach(([capId, capability]) => {
      const domain = capId.split(".")[0];
      domains.add(domain);

      nodes.push({
        id: capId,
        label: capability.name || capId,
        type: "capability",
        domain: domain,
        properties: {
          complexity: capability.complexity || "medium",
          priority: capability.priority || "medium",
          owner: capability.owner || "unknown",
        },
      });

      // Create dependency edges
      if (capability.depends_on && Array.isArray(capability.depends_on)) {
        capability.depends_on.forEach((depId: string) => {
          edges.push({
            source: depId,
            target: capId,
            type: "dependency",
          });
        });
      }
    });

    // Create domain groups
    domains.forEach((domain) => {
      const domainNodes = nodes.filter((n) => n.domain === domain);
      groups.push({
        id: domain,
        label: domain.charAt(0).toUpperCase() + domain.slice(1),
        nodeIds: domainNodes.map((n) => n.id),
      });
    });

    return {
      type: "directed_graph",
      nodes,
      edges,
      groups,
      layout: {
        algorithm: "hierarchical",
      },
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
    const flows =
      resolved.flows && typeof resolved.flows === "object" && !Array.isArray(resolved.flows)
        ? (resolved.flows as Record<string, any>)
        : {};
    const flowList: any[] = [];
    const nodes: any[] = [];
    const edges: any[] = [];
    let totalSteps = 0;
    let totalDecisions = 0;

    Object.entries(flows).forEach(([flowId, flow]) => {
      const flowSteps = flow.steps || [];
      totalSteps += flowSteps.length;

      // Add flow to list
      flowList.push({
        id: flowId,
        name: flow.name || flowId,
        trigger: flow.trigger,
        outcome: flow.outcome,
        steps: flowSteps,
      });

      // Generate nodes for each step
      flowSteps.forEach((step: any, index: number) => {
        const nodeId = `${flowId}.${index}`;

        nodes.push({
          id: nodeId,
          label: step.name || `Step ${index + 1}`,
          type: "process",
          properties: {
            action: step.action,
            actor: step.actor,
            duration: step.estimated_duration,
            complexity: step.complexity,
          },
        });

        // Create sequence edges
        if (index > 0) {
          edges.push({
            source: `${flowId}.${index - 1}`,
            target: nodeId,
            type: "sequence",
          });
        }

        // Handle branches (decision nodes)
        if (step.branches && Array.isArray(step.branches)) {
          step.branches.forEach((branch: any, branchIndex: number) => {
            const decisionNodeId = `${nodeId}.${branch.condition}`;
            totalDecisions++;

            nodes.push({
              id: decisionNodeId,
              label: branch.name || branch.condition,
              type: "decision",
              properties: {
                condition: branch.condition,
                description: branch.description,
              },
            });

            edges.push({
              source: nodeId,
              target: decisionNodeId,
              type: "branch",
              label: branch.condition,
            });
          });
        }
      });
    });

    return {
      type: "flowchart",
      nodes,
      edges,
      flows: flowList,
      layout: {
        algorithm: "dagre",
      },
      metadata: {
        totalFlows: flowList.length,
        totalSteps,
        totalDecisions,
      },
    };
  }

  /**
   * Generate dependencies IR for layered graph visualization
   */
  private generateDependenciesIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const capabilities =
      resolved.capabilities &&
      typeof resolved.capabilities === "object" &&
      !Array.isArray(resolved.capabilities)
        ? (resolved.capabilities as Record<string, any>)
        : {};
    const services =
      resolved.services &&
      typeof resolved.services === "object" &&
      !Array.isArray(resolved.services)
        ? (resolved.services as Record<string, any>)
        : {};
    const layers: any[] = [];
    const nodes: any[] = [];
    const edges: any[] = [];
    const processed = new Set<string>();
    let layerIndex = 0;

    // Add capability nodes
    Object.entries(capabilities).forEach(([capId, capability]) => {
      nodes.push({
        id: capId,
        label: capability.name || capId,
        type: "capability",
        properties: {
          dependencies: capability.depends_on || [],
        },
      });

      // Add dependency edges
      if (capability.depends_on && Array.isArray(capability.depends_on)) {
        capability.depends_on.forEach((depId: string) => {
          edges.push({
            source: depId,
            target: capId,
            type: "depends",
          });
        });
      }
    });

    // Add service nodes
    Object.entries(services).forEach(([serviceId, service]) => {
      nodes.push({
        id: serviceId,
        label: service.name || serviceId,
        type: "service",
        properties: {
          technology: service.technology,
          environment: service.environment,
          implements: service.implements || [],
        },
      });

      // Add implementation edges
      if (service.implements && Array.isArray(service.implements)) {
        service.implements.forEach((capId: string) => {
          edges.push({
            source: serviceId,
            target: capId,
            type: "implements",
          });
        });
      }
    });

    // Create logical layers (capabilities and services)
    const capabilityNodes = nodes.filter((n) => n.type === "capability");
    const serviceNodes = nodes.filter((n) => n.type === "service");

    if (capabilityNodes.length > 0) {
      layers.push({
        id: "business",
        label: "Business Layer",
        nodeIds: capabilityNodes.map((n) => n.id),
      });
    }

    if (serviceNodes.length > 0) {
      layers.push({
        id: "application",
        label: "Application Layer",
        nodeIds: serviceNodes.map((n) => n.id),
      });
    }

    return {
      type: "layered_graph",
      nodes,
      edges,
      layers,
      layout: {
        algorithm: "layered",
      },
    };
  }

  /**
   * Generate coverage IR for test coverage visualization
   */
  private generateCoverageIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const capabilities =
      resolved.capabilities &&
      typeof resolved.capabilities === "object" &&
      !Array.isArray(resolved.capabilities)
        ? (resolved.capabilities as Record<string, any>)
        : {};
    const tests =
      resolved.tests && typeof resolved.tests === "object" && !Array.isArray(resolved.tests)
        ? (resolved.tests as Record<string, any>)
        : {};
    const requirements =
      resolved.requirements &&
      typeof resolved.requirements === "object" &&
      !Array.isArray(resolved.requirements)
        ? (resolved.requirements as Record<string, any>)
        : {};

    const nodes: any[] = [];
    const edges: any[] = [];
    const coverage: Record<string, any> = {};
    let fullyTested = 0;
    let partiallyTested = 0;
    let untested = 0;

    // Add capability nodes and calculate coverage
    Object.entries(capabilities).forEach(([capId, capability]) => {
      const coveringTests = Object.entries(tests).filter(([_, test]) => {
        const covers = test.covers || [];
        return covers.includes(capId);
      });

      const relatedRequirements = Object.entries(requirements).filter(([_, req]) => {
        return req.capability === capId;
      });

      const testCount = coveringTests.length;
      const requirementCount = relatedRequirements.length;

      // Coverage calculation: tests + requirements (simplified)
      let coveragePercentage = 0;
      if (testCount >= 8 && requirementCount >= 2) {
        coveragePercentage = 100;
        fullyTested++;
      } else if (testCount >= 1 || requirementCount >= 1) {
        coveragePercentage = Math.min(80, testCount * 10 + requirementCount * 20);
        partiallyTested++;
      } else {
        coveragePercentage = 0;
        untested++;
      }

      nodes.push({
        id: capId,
        label: capability.name || capId,
        type: "capability",
        properties: {
          testCount,
          requirementCount,
          coverage: coveragePercentage,
        },
      });

      coverage[capId] = {
        covered: testCount > 0,
        testCount,
        requirementCount,
        coveragePercentage,
        tests: coveringTests.map(([testId, _]) => testId),
        requirements: relatedRequirements.map(([reqId, _]) => reqId),
      };
    });

    // Add test nodes
    Object.entries(tests).forEach(([testId, test]) => {
      nodes.push({
        id: testId,
        label: test.name || testId,
        type: "test",
        properties: {
          covers: test.covers || [],
        },
      });

      // Add coverage edges from tests to capabilities
      if (test.covers && Array.isArray(test.covers)) {
        test.covers.forEach((capId: string) => {
          edges.push({
            source: testId,
            target: capId,
            type: "covers",
          });
        });
      }
    });

    // Add requirement nodes
    Object.entries(requirements).forEach(([reqId, req]) => {
      nodes.push({
        id: reqId,
        label: req.name || reqId,
        type: "requirement",
        properties: {
          capability: req.capability,
        },
      });

      // Add specifies edges from requirements to capabilities
      if (req.capability) {
        edges.push({
          source: reqId,
          target: req.capability,
          type: "specifies",
        });
      }
    });

    const totalCapabilities = Object.keys(capabilities).length;
    const overallCoverage =
      totalCapabilities > 0
        ? Math.round(((fullyTested + partiallyTested) / totalCapabilities) * 100)
        : 0;

    return {
      type: "coverage_graph",
      nodes,
      edges,
      coverage: {
        overall: overallCoverage,
        fullyTested,
        partiallyTested,
        untested,
        details: coverage,
      },
      layout: {
        algorithm: "force",
      },
      metadata: {
        totalCapabilities,
        totalTests: Object.keys(tests).length,
        totalRequirements: Object.keys(requirements).length,
      },
    };
  }
}
