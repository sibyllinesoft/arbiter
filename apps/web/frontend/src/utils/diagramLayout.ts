/**
 * Diagram Layout Algorithms
 * Automatic positioning of components for different diagram types
 */

import { 
  DiagramComponent, 
  DiagramConnection, 
  DiagramLayout, 
  DiagramLayer,
  LayoutAlgorithm 
} from '../types/architecture';

export class LayeredLayoutAlgorithm implements LayoutAlgorithm {
  name = 'layered';

  calculate(
    components: DiagramComponent[], 
    connections: DiagramConnection[]
  ): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
    // Define layer ordering
    const layerOrder: DiagramLayer[] = [
      'presentation',
      'application', 
      'service',
      'data',
      'external'
    ];

    // Group components by layer
    const layerGroups = this.groupByLayer(components, layerOrder);
    
    // Calculate positions
    const positioned = this.positionComponentsByLayer(layerGroups, layerOrder);
    
    // Calculate viewport size
    const viewport = this.calculateViewport(positioned);

    return { components: positioned, viewport };
  }

  private groupByLayer(
    components: DiagramComponent[], 
    layerOrder: DiagramLayer[]
  ): Map<DiagramLayer, DiagramComponent[]> {
    const groups = new Map<DiagramLayer, DiagramComponent[]>();
    
    // Initialize groups
    layerOrder.forEach(layer => groups.set(layer, []));
    
    // Group components
    components.forEach(component => {
      const layer = component.layer || 'service';
      if (!groups.has(layer)) {
        groups.set(layer, []);
      }
      groups.get(layer)!.push(component);
    });

    return groups;
  }

  private positionComponentsByLayer(
    layerGroups: Map<DiagramLayer, DiagramComponent[]>,
    layerOrder: DiagramLayer[]
  ): DiagramComponent[] {
    const positioned: DiagramComponent[] = [];
    const layerHeight = 200;
    const componentSpacing = 20;
    let currentY = 60; // Start below header

    layerOrder.forEach(layer => {
      const components = layerGroups.get(layer) || [];
      if (components.length === 0) return;

      // Calculate total width needed for this layer
      const totalWidth = components.reduce((sum, comp) => sum + comp.size.width, 0);
      const totalSpacing = (components.length - 1) * componentSpacing;
      const layerWidth = totalWidth + totalSpacing;
      
      // Center the layer horizontally
      let currentX = Math.max(50, (800 - layerWidth) / 2);

      components.forEach(component => {
        positioned.push({
          ...component,
          position: { x: currentX, y: currentY }
        });
        currentX += component.size.width + componentSpacing;
      });

      currentY += layerHeight;
    });

    return positioned;
  }

  private calculateViewport(components: DiagramComponent[]): { width: number; height: number } {
    if (components.length === 0) {
      return { width: 800, height: 600 };
    }

    const padding = 50;
    const maxX = Math.max(...components.map(c => c.position.x + c.size.width));
    const maxY = Math.max(...components.map(c => c.position.y + c.size.height));

    return {
      width: Math.max(800, maxX + padding),
      height: Math.max(600, maxY + padding)
    };
  }
}

export class ForceDirectedLayoutAlgorithm implements LayoutAlgorithm {
  name = 'force_directed';

  calculate(
    components: DiagramComponent[], 
    connections: DiagramConnection[]
  ): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
    // Simple force-directed layout using basic physics simulation
    const positioned = [...components];
    const iterations = 50;
    const repulsionForce = 5000;
    const attractionForce = 0.1;
    const damping = 0.9;

    // Initialize random positions if not set
    positioned.forEach(component => {
      if (component.position.x === 0 && component.position.y === 0) {
        component.position = {
          x: Math.random() * 600 + 100,
          y: Math.random() * 400 + 100
        };
      }
    });

    // Track velocities
    const velocities = new Map<string, { x: number; y: number }>();
    positioned.forEach(comp => {
      velocities.set(comp.id, { x: 0, y: 0 });
    });

    // Simulation iterations
    for (let iter = 0; iter < iterations; iter++) {
      // Reset forces
      positioned.forEach(comp => {
        const vel = velocities.get(comp.id)!;
        vel.x *= damping;
        vel.y *= damping;
      });

      // Repulsion forces (all components push each other away)
      for (let i = 0; i < positioned.length; i++) {
        for (let j = i + 1; j < positioned.length; j++) {
          const comp1 = positioned[i];
          const comp2 = positioned[j];
          const vel1 = velocities.get(comp1.id)!;
          const vel2 = velocities.get(comp2.id)!;

          const dx = comp2.position.x - comp1.position.x;
          const dy = comp2.position.y - comp1.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const force = repulsionForce / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          vel1.x -= fx;
          vel1.y -= fy;
          vel2.x += fx;
          vel2.y += fy;
        }
      }

      // Attraction forces (connected components pull each other)
      connections.forEach(connection => {
        const comp1 = positioned.find(c => c.id === connection.from.componentId);
        const comp2 = positioned.find(c => c.id === connection.to.componentId);

        if (comp1 && comp2) {
          const vel1 = velocities.get(comp1.id)!;
          const vel2 = velocities.get(comp2.id)!;

          const dx = comp2.position.x - comp1.position.x;
          const dy = comp2.position.y - comp1.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const force = distance * attractionForce;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          vel1.x += fx;
          vel1.y += fy;
          vel2.x -= fx;
          vel2.y -= fy;
        }
      });

      // Apply velocities
      positioned.forEach(comp => {
        const vel = velocities.get(comp.id)!;
        comp.position.x += vel.x;
        comp.position.y += vel.y;

        // Keep components within bounds
        comp.position.x = Math.max(50, Math.min(750, comp.position.x));
        comp.position.y = Math.max(50, Math.min(550, comp.position.y));
      });
    }

    const viewport = this.calculateViewport(positioned);
    return { components: positioned, viewport };
  }

  private calculateViewport(components: DiagramComponent[]): { width: number; height: number } {
    if (components.length === 0) {
      return { width: 800, height: 600 };
    }

    const padding = 100;
    const maxX = Math.max(...components.map(c => c.position.x + c.size.width));
    const maxY = Math.max(...components.map(c => c.position.y + c.size.height));

    return {
      width: Math.max(800, maxX + padding),
      height: Math.max(600, maxY + padding)
    };
  }
}

export class FlowLayoutAlgorithm implements LayoutAlgorithm {
  name = 'flow';

  calculate(
    components: DiagramComponent[], 
    connections: DiagramConnection[]
  ): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
    // Organize components based on flow connections
    const positioned = [...components];
    
    // Find starting components (no incoming flow connections)
    const hasIncoming = new Set<string>();
    connections
      .filter(conn => ['user_navigation', 'user_interaction'].includes(conn.type))
      .forEach(conn => hasIncoming.add(conn.to.componentId));

    const startComponents = positioned.filter(comp => !hasIncoming.has(comp.id));
    const remainingComponents = positioned.filter(comp => hasIncoming.has(comp.id));

    // Layout in flow order
    let currentX = 50;
    let currentY = 100;
    const stepWidth = 200;
    const stepHeight = 150;

    // Position start components
    startComponents.forEach((comp, index) => {
      comp.position = { x: currentX, y: currentY + (index * stepHeight) };
    });

    // Position remaining components based on flow order
    const positioned_ids = new Set(startComponents.map(c => c.id));
    let currentStep = 1;

    while (positioned_ids.size < positioned.length && currentStep < 10) {
      currentX += stepWidth;
      let yOffset = 0;

      // Find components that can be positioned in this step
      const canPosition = remainingComponents.filter(comp => {
        if (positioned_ids.has(comp.id)) return false;
        
        // Check if all predecessors are positioned
        const predecessors = connections
          .filter(conn => conn.to.componentId === comp.id)
          .map(conn => conn.from.componentId);
        
        return predecessors.length === 0 || predecessors.every(id => positioned_ids.has(id));
      });

      canPosition.forEach(comp => {
        comp.position = { x: currentX, y: currentY + yOffset };
        positioned_ids.add(comp.id);
        yOffset += stepHeight;
      });

      currentStep++;
    }

    // Position any remaining components
    remainingComponents
      .filter(comp => !positioned_ids.has(comp.id))
      .forEach((comp, index) => {
        comp.position = { 
          x: currentX + stepWidth, 
          y: currentY + (index * stepHeight) 
        };
      });

    const viewport = this.calculateViewport(positioned);
    return { components: positioned, viewport };
  }

  private calculateViewport(components: DiagramComponent[]): { width: number; height: number } {
    if (components.length === 0) {
      return { width: 800, height: 600 };
    }

    const padding = 100;
    const maxX = Math.max(...components.map(c => c.position.x + c.size.width));
    const maxY = Math.max(...components.map(c => c.position.y + c.size.height));

    return {
      width: Math.max(1000, maxX + padding),
      height: Math.max(600, maxY + padding)
    };
  }
}

export class DiagramLayoutEngine {
  private algorithms: Map<string, LayoutAlgorithm> = new Map();

  constructor() {
    this.algorithms.set('layered', new LayeredLayoutAlgorithm());
    this.algorithms.set('force_directed', new ForceDirectedLayoutAlgorithm());
    this.algorithms.set('flow', new FlowLayoutAlgorithm());
  }

  /**
   * Apply layout algorithm to components
   */
  applyLayout(
    components: DiagramComponent[],
    connections: DiagramConnection[],
    layoutType: string = 'layered'
  ): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
    const algorithm = this.algorithms.get(layoutType);
    
    if (!algorithm) {
      console.warn(`Unknown layout algorithm: ${layoutType}, falling back to layered`);
      return this.algorithms.get('layered')!.calculate(components, connections);
    }

    return algorithm.calculate(components, connections);
  }

  /**
   * Suggest best layout based on diagram characteristics
   */
  suggestLayout(components: DiagramComponent[], connections: DiagramConnection[]): string {
    // Check for flow-based connections
    const hasFlowConnections = connections.some(conn => 
      ['user_navigation', 'user_interaction'].includes(conn.type)
    );

    if (hasFlowConnections) {
      return 'flow';
    }

    // Check for clear layer separation
    const layers = new Set(components.map(c => c.layer));
    if (layers.size >= 3) {
      return 'layered';
    }

    // Default to force-directed for complex interconnections
    return 'force_directed';
  }

  /**
   * Get available layout algorithms
   */
  getAvailableLayouts(): string[] {
    return Array.from(this.algorithms.keys());
  }
}