/**
 * Intermediate Representation (IR) generator for diagrams and visualizations
 */
import type { IRKind, IRResponse } from "./types.ts";
import { getCurrentTimestamp, logger } from "./utils.ts";

export class IRGenerator {
  /**
   * Generate IR for different diagram types
   */
  async generateIR(
    kind: IRKind, 
    resolved: Record<string, unknown>
  ): Promise<IRResponse> {
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
        default:
          throw new Error(`Unknown IR kind: ${kind}`);
      }

      const duration = Date.now() - startTime;
      
      logger.debug("Generated IR", { 
        kind, 
        nodeCount: this.getNodeCount(data),
        duration 
      });

      return {
        kind,
        data,
        generated_at: getCurrentTimestamp()
      };

    } catch (error) {
      logger.error("IR generation failed", error instanceof Error ? error : undefined, { kind });
      
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
          const nodeId = `${index}`;
          const kind = this.getFlowStepKind(step);
          const label = this.getFlowStepLabel(step, index);
          
          nodes.push({
            id: nodeId,
            kind,
            label
          });

          // Create edge to next step
          if (index < flow.steps.length - 1) {
            edges.push({
              from: nodeId,
              to: `${index + 1}`,
              label: step.transition || ""
            });
          }
        });
      }

      flowIRs.push({
        id: flowId,
        nodes,
        edges
      });
    });

    return {
      specHash: this.computeSpecHash(resolved),
      flows: flowIRs
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
      
      if (model.states && typeof model.states === 'object') {
        Object.entries(model.states).forEach(([stateId, state]: [string, any]) => {
          states[stateId] = {};
          
          if (state.on && typeof state.on === 'object') {
            states[stateId].on = state.on;
          }
        });
      }

      fsms.push({
        id: fsmId,
        initial: model.initial || 'idle',
        states
      });
    });

    return {
      specHash: this.computeSpecHash(resolved),
      fsms
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
          if (component.type === 'button' && component.token) {
            widgets.push({
              type: 'button',
              token: component.token,
              text: component.text || component.token
            });
          } else if (component.type === 'input' && component.token) {
            widgets.push({
              type: 'input', 
              token: component.token,
              label: component.label || component.token
            });
          } else if (component.type === 'table' && component.token) {
            widgets.push({
              type: 'table',
              token: component.token,
              columns: component.columns || []
            });
          }
        });
      }
      
      // Also extract widgets from referenced locators
      Object.entries(locators).forEach(([token, selector]) => {
        if (token.startsWith('btn:')) {
          widgets.push({
            type: 'button',
            token,
            text: token.replace('btn:', '')
          });
        } else if (token.startsWith('input:')) {
          widgets.push({
            type: 'input',
            token,
            label: token.replace('input:', '')
          });
        }
      });

      if (widgets.length > 0) {
        views.push({
          id: route.id || route.path,
          widgets
        });
      }
    });

    return {
      specHash: this.computeSpecHash(resolved),
      views
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
        capabilities: route.capabilities || []
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
              type: 'capability'
            });
          }
        }
      });
    });

    return {
      specHash: this.computeSpecHash(resolved),
      routes: {
        nodes,
        edges
      }
    };
  }

  /**
   * Legacy method - keeping for compatibility during transition
   */
  private generateCapabilitiesIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const capabilities = this.extractCapabilities(resolved);
    const nodes: any[] = [];
    const edges: any[] = [];
    const groups: Record<string, string[]> = {};

    // Create nodes for each capability
    Object.entries(capabilities).forEach(([id, capability]) => {
      const parts = id.split('.');
      const domain = parts[0] || 'default';
      
      nodes.push({
        id,
        label: capability.name || id,
        type: 'capability',
        domain,
        description: capability.description || '',
        status: capability.status || 'draft',
        properties: {
          complexity: capability.complexity || 'medium',
          priority: capability.priority || 'medium',
          owner: capability.owner || 'unassigned'
        }
      });

      // Group by domain
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(id);

      // Create edges for dependencies
      const dependencies = capability.depends_on || [];
      dependencies.forEach((depId: string) => {
        edges.push({
          id: `${id}->${depId}`,
          source: depId,
          target: id,
          type: 'dependency',
          label: 'depends on'
        });
      });
    });

    return {
      type: 'directed_graph',
      nodes,
      edges,
      groups: Object.entries(groups).map(([domain, nodeIds]) => ({
        id: domain,
        label: domain,
        nodeIds
      })),
      layout: {
        algorithm: 'hierarchical',
        direction: 'top-bottom',
        spacing: {
          node: 100,
          rank: 150
        }
      },
      metadata: {
        totalCapabilities: nodes.length,
        domains: Object.keys(groups).length,
        dependencies: edges.length
      }
    };
  }

  /**
   * Generate flow diagram IR (user journeys, business processes)
   */
  private generateFlowsIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const flows = this.extractFlows(resolved);
    const nodes: any[] = [];
    const edges: any[] = [];

    Object.entries(flows).forEach(([flowId, flow]) => {
      const steps = flow.steps || [];
      
      // Create nodes for each step
      steps.forEach((step: any, index: number) => {
        const nodeId = `${flowId}.${index}`;
        
        nodes.push({
          id: nodeId,
          label: step.name || `Step ${index + 1}`,
          type: this.getStepType(step),
          flowId,
          properties: {
            description: step.description || '',
            actor: step.actor || 'user',
            action: step.action || '',
            duration: step.estimated_duration || '',
            complexity: step.complexity || 'medium'
          }
        });

        // Create edge to next step
        if (index < steps.length - 1) {
          edges.push({
            id: `${nodeId}->${flowId}.${index + 1}`,
            source: nodeId,
            target: `${flowId}.${index + 1}`,
            type: 'sequence',
            label: step.transition_condition || ''
          });
        }

        // Handle branches/conditions
        if (step.branches) {
          step.branches.forEach((branch: any) => {
            const branchNodeId = `${flowId}.${index}.${branch.condition}`;
            
            nodes.push({
              id: branchNodeId,
              label: branch.name || branch.condition,
              type: 'decision',
              flowId,
              properties: {
                condition: branch.condition,
                description: branch.description || ''
              }
            });

            edges.push({
              id: `${nodeId}->${branchNodeId}`,
              source: nodeId,
              target: branchNodeId,
              type: 'branch',
              label: branch.condition
            });
          });
        }
      });
    });

    return {
      type: 'flowchart',
      nodes,
      edges,
      flows: Object.entries(flows).map(([flowId, flow]) => ({
        id: flowId,
        name: flow.name || flowId,
        description: flow.description || '',
        trigger: flow.trigger || '',
        outcome: flow.outcome || ''
      })),
      layout: {
        algorithm: 'dagre',
        direction: 'top-bottom',
        spacing: {
          node: 80,
          rank: 100
        }
      },
      metadata: {
        totalFlows: Object.keys(flows).length,
        totalSteps: nodes.filter(n => n.type !== 'decision').length,
        totalDecisions: nodes.filter(n => n.type === 'decision').length
      }
    };
  }

  /**
   * Generate dependencies diagram IR
   */
  private generateDependenciesIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const capabilities = this.extractCapabilities(resolved);
    const services = this.extractServices(resolved);
    const nodes: any[] = [];
    const edges: any[] = [];

    // Add capability nodes
    Object.entries(capabilities).forEach(([id, capability]) => {
      nodes.push({
        id,
        label: capability.name || id,
        type: 'capability',
        layer: 'business'
      });
    });

    // Add service nodes
    Object.entries(services).forEach(([id, service]) => {
      nodes.push({
        id,
        label: service.name || id,
        type: 'service',
        layer: 'application',
        properties: {
          technology: service.technology || '',
          environment: service.environment || ''
        }
      });

      // Connect services to capabilities they implement
      const serviceImplements = service.implements || [];
      serviceImplements.forEach((capId: string) => {
        edges.push({
          id: `${id}-implements-${capId}`,
          source: id,
          target: capId,
          type: 'implements',
          label: 'implements'
        });
      });
    });

    // Add dependency edges
    Object.entries(capabilities).forEach(([id, capability]) => {
      const dependencies = capability.depends_on || [];
      dependencies.forEach((depId: string) => {
        edges.push({
          id: `${id}-depends-${depId}`,
          source: id,
          target: depId,
          type: 'depends',
          label: 'depends on'
        });
      });
    });

    return {
      type: 'layered_graph',
      nodes,
      edges,
      layers: [
        {
          id: 'business',
          label: 'Business Capabilities',
          nodeIds: nodes.filter(n => n.layer === 'business').map(n => n.id)
        },
        {
          id: 'application',
          label: 'Application Services',
          nodeIds: nodes.filter(n => n.layer === 'application').map(n => n.id)
        }
      ],
      layout: {
        algorithm: 'layered',
        direction: 'top-bottom',
        spacing: {
          layer: 200,
          node: 120
        }
      },
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        layers: 2
      }
    };
  }

  /**
   * Generate coverage diagram IR (test coverage, requirement coverage)
   */
  private generateCoverageIR(resolved: Record<string, unknown>): Record<string, unknown> {
    const capabilities = this.extractCapabilities(resolved);
    const tests = this.extractTests(resolved);
    const requirements = this.extractRequirements(resolved);
    
    const nodes: any[] = [];
    const edges: any[] = [];
    const coverageData: Record<string, any> = {};

    // Create capability nodes with coverage information
    Object.entries(capabilities).forEach(([capId, capability]) => {
      const relatedTests = Object.entries(tests).filter(([, test]) => 
        test.covers?.includes(capId) || test.capability === capId
      );
      
      const relatedReqs = Object.entries(requirements).filter(([, req]) =>
        req.capability === capId
      );

      const testCoverage = relatedTests.length;
      const reqCoverage = relatedReqs.length;
      const totalCoverage = Math.min(100, (testCoverage + reqCoverage) * 10); // Simplified calculation

      coverageData[capId] = {
        testCount: testCoverage,
        requirementCount: reqCoverage,
        coveragePercentage: totalCoverage
      };

      nodes.push({
        id: capId,
        label: capability.name || capId,
        type: 'capability',
        properties: {
          coverage: totalCoverage,
          testCount: testCoverage,
          requirementCount: reqCoverage,
          status: this.getCoverageStatus(totalCoverage)
        }
      });

      // Connect to tests
      relatedTests.forEach(([testId]) => {
        edges.push({
          id: `${testId}-covers-${capId}`,
          source: testId,
          target: capId,
          type: 'covers',
          label: 'tests'
        });
      });

      // Connect to requirements
      relatedReqs.forEach(([reqId]) => {
        edges.push({
          id: `${reqId}-specifies-${capId}`,
          source: reqId,
          target: capId,
          type: 'specifies',
          label: 'specifies'
        });
      });
    });

    // Add test nodes
    Object.entries(tests).forEach(([testId, test]) => {
      nodes.push({
        id: testId,
        label: test.name || testId,
        type: 'test',
        properties: {
          testType: test.type || 'functional',
          status: test.status || 'pending',
          automated: test.automated || false
        }
      });
    });

    // Add requirement nodes
    Object.entries(requirements).forEach(([reqId, req]) => {
      nodes.push({
        id: reqId,
        label: req.name || reqId,
        type: 'requirement',
        properties: {
          priority: req.priority || 'medium',
          status: req.status || 'draft',
          source: req.source || ''
        }
      });
    });

    // Calculate overall coverage metrics
    const totalCapabilities = Object.keys(capabilities).length;
    const fullyTested = Object.values(coverageData).filter(c => c.coveragePercentage >= 80).length;
    const partiallyTested = Object.values(coverageData).filter(c => c.coveragePercentage > 0 && c.coveragePercentage < 80).length;
    const untested = totalCapabilities - fullyTested - partiallyTested;

    return {
      type: 'coverage_graph',
      nodes,
      edges,
      coverage: {
        overall: totalCapabilities > 0 ? Math.round((fullyTested + partiallyTested * 0.5) / totalCapabilities * 100) : 0,
        fullyTested,
        partiallyTested,
        untested,
        details: coverageData
      },
      layout: {
        algorithm: 'force',
        clustering: true,
        spacing: {
          node: 100
        }
      },
      metadata: {
        totalCapabilities,
        totalTests: Object.keys(tests).length,
        totalRequirements: Object.keys(requirements).length
      }
    };
  }

  // Helper methods for data extraction
  private extractCapabilities(resolved: Record<string, unknown>): Record<string, any> {
    return (resolved.capabilities as Record<string, any>) || {};
  }

  private extractFlows(resolved: Record<string, unknown>): Record<string, any> {
    return (resolved.flows as Record<string, any>) || {};
  }

  private extractServices(resolved: Record<string, unknown>): Record<string, any> {
    return (resolved.services as Record<string, any>) || {};
  }

  private extractTests(resolved: Record<string, unknown>): Record<string, any> {
    return (resolved.tests as Record<string, any>) || {};
  }

  private extractRequirements(resolved: Record<string, unknown>): Record<string, any> {
    return (resolved.requirements as Record<string, any>) || {};
  }

  private getStepType(step: any): string {
    if (step.type) return step.type;
    if (step.branches && step.branches.length > 0) return 'decision';
    if (step.parallel) return 'parallel';
    return 'process';
  }

  private getCoverageStatus(coverage: number): string {
    if (coverage >= 80) return 'good';
    if (coverage >= 50) return 'partial';
    if (coverage > 0) return 'minimal';
    return 'none';
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