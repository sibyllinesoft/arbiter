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
        default:
          throw new Error(`Unknown IR kind: ${kind}`);
      }

      const duration = Date.now() - startTime;

      logger.debug("Generated IR", {
        kind,
        nodeCount: this.getNodeCount(data),
        duration,
      });

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
          const nodeId = `${index}`;
          const kind = this.getFlowStepKind(step);
          const label = this.getFlowStepLabel(step, index);

          nodes.push({
            id: nodeId,
            kind,
            label,
          });

          // Create edge to next step
          if (index < flow.steps.length - 1) {
            edges.push({
              from: nodeId,
              to: `${index + 1}`,
              label: step.transition || "",
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
    const stateModels = (resolved.stateModels as Record<string, any>) || {};
    const fsms: any[] = [];

    Object.entries(stateModels).forEach(([fsmId, model]) => {
      const states: Record<string, any> = {};

      if (model.states && typeof model.states === "object") {
        Object.entries(model.states).forEach(([stateId, state]: [string, any]) => {
          states[stateId] = {};

          if (state.on && typeof state.on === "object") {
            states[stateId].on = state.on;
          }
        });
      }

      fsms.push({
        id: fsmId,
        initial: model.initial || "idle",
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
    const routes = (resolved.ui as any)?.routes || [];
    const locators = (resolved.locators as Record<string, string>) || {};
    const views: any[] = [];

    routes.forEach((route: any) => {
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

      if (widgets.length > 0) {
        views.push({
          id: route.id || route.path,
          widgets,
        });
      }
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
    if (step.visit) return "visit";
    if (step.click) return "click";
    if (step.fill) return "fill";
    if (step.expect) return "expect";
    if (step.expect_api) return "expect_api";
    return "process";
  }

  private getFlowStepLabel(step: any, index: number): string {
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
}
