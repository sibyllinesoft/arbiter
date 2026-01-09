/**
 * Diagram Layout Algorithms
 * Automatic positioning of components for different diagram types
 */

import {
  type DiagramComponent,
  type DiagramConnection,
  type DiagramLayer,
  type LayoutAlgorithm,
} from "../types/architecture";

/** Layout algorithm that arranges components in horizontal layers by type */
export class LayeredLayoutAlgorithm implements LayoutAlgorithm {
  name = "layered";

  calculate(
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
    // Define layer ordering
    const layerOrder: DiagramLayer[] = [
      "presentation",
      "application",
      "service",
      "data",
      "external",
    ];

    // Group components by layer
    const layerGroups = this.groupByLayer(components, layerOrder);

    // Calculate positions
    const positioned = this.positionComponentsByLayer(layerGroups, layerOrder);

    // Calculate viewport size
    const viewport = this.calculateViewport(positioned);

    return { components: positioned, viewport };
  }

  /**
   * Group components by their layer assignment.
   * @param components - Components to group
   * @param layerOrder - Order of layers
   * @returns Map of layer to components
   */
  private groupByLayer(
    components: DiagramComponent[],
    layerOrder: DiagramLayer[],
  ): Map<DiagramLayer, DiagramComponent[]> {
    const groups = new Map<DiagramLayer, DiagramComponent[]>();

    // Initialize groups
    layerOrder.forEach((layer) => groups.set(layer, []));

    // Group components
    components.forEach((component) => {
      const layer = component.layer || "service";
      if (!groups.has(layer)) {
        groups.set(layer, []);
      }
      groups.get(layer)?.push(component);
    });

    return groups;
  }

  /**
   * Position components within their respective layers.
   * @param layerGroups - Components grouped by layer
   * @param layerOrder - Order of layers from top to bottom
   * @returns Components with updated positions
   */
  private positionComponentsByLayer(
    layerGroups: Map<DiagramLayer, DiagramComponent[]>,
    layerOrder: DiagramLayer[],
  ): DiagramComponent[] {
    const positioned: DiagramComponent[] = [];
    const layerHeight = 200;
    const componentSpacing = 20;
    let currentY = 60; // Start below header

    layerOrder.forEach((layer) => {
      const components = layerGroups.get(layer) || [];
      if (components.length === 0) return;

      // Calculate total width needed for this layer
      const totalWidth = components.reduce((sum, comp) => sum + comp.size.width, 0);
      const totalSpacing = (components.length - 1) * componentSpacing;
      const layerWidth = totalWidth + totalSpacing;

      // Center the layer horizontally
      let currentX = Math.max(50, (800 - layerWidth) / 2);

      components.forEach((component) => {
        positioned.push({
          ...component,
          position: { x: currentX, y: currentY },
        });
        currentX += component.size.width + componentSpacing;
      });

      currentY += layerHeight;
    });

    return positioned;
  }

  /**
   * Calculate viewport dimensions to fit all components.
   * @param components - Positioned components
   * @returns Viewport width and height
   */
  private calculateViewport(components: DiagramComponent[]): { width: number; height: number } {
    if (components.length === 0) {
      return { width: 800, height: 600 };
    }

    const padding = 50;
    const maxX = Math.max(...components.map((c) => c.position.x + c.size.width));
    const maxY = Math.max(...components.map((c) => c.position.y + c.size.height));

    return {
      width: Math.max(800, maxX + padding),
      height: Math.max(600, maxY + padding),
    };
  }
}

/** Physics configuration for force-directed layout */
interface ForceConfig {
  repulsion: number;
  attraction: number;
  damping: number;
  iterations: number;
}

/** Velocity tracking for physics simulation */
type VelocityMap = Map<string, { x: number; y: number }>;

/** Initialize random positions for components at origin */
function initializePositions(components: DiagramComponent[]): void {
  components.forEach((component) => {
    if (component.position.x === 0 && component.position.y === 0) {
      component.position = {
        x: Math.random() * 600 + 100,
        y: Math.random() * 400 + 100,
      };
    }
  });
}

/** Create velocity map for physics simulation */
function createVelocityMap(components: DiagramComponent[]): VelocityMap {
  const velocities = new Map<string, { x: number; y: number }>();
  components.forEach((comp) => {
    velocities.set(comp.id, { x: 0, y: 0 });
  });
  return velocities;
}

/** Apply damping to all velocities */
function applyDamping(
  components: DiagramComponent[],
  velocities: VelocityMap,
  damping: number,
): void {
  components.forEach((comp) => {
    const vel = velocities.get(comp.id);
    if (vel) {
      vel.x *= damping;
      vel.y *= damping;
    }
  });
}

/** Calculate distance and normalized direction between two positions */
function calculateVector(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
): { dx: number; dy: number; distance: number; nx: number; ny: number } {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  return { dx, dy, distance, nx: dx / distance, ny: dy / distance };
}

/** Apply force to velocity pair in opposite directions */
function applyForcePair(
  vel1: { x: number; y: number },
  vel2: { x: number; y: number },
  fx: number,
  fy: number,
  invert: boolean,
): void {
  if (invert) {
    vel1.x -= fx;
    vel1.y -= fy;
    vel2.x += fx;
    vel2.y += fy;
  } else {
    vel1.x += fx;
    vel1.y += fy;
    vel2.x -= fx;
    vel2.y -= fy;
  }
}

/** Calculate and apply repulsion forces between all component pairs */
function applyRepulsionForces(
  components: DiagramComponent[],
  velocities: VelocityMap,
  repulsionForce: number,
): void {
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const comp1 = components[i];
      const comp2 = components[j];
      if (!comp1 || !comp2) continue;

      const vel1 = velocities.get(comp1.id);
      const vel2 = velocities.get(comp2.id);
      if (!vel1 || !vel2) continue;

      const { distance, nx, ny } = calculateVector(comp1.position, comp2.position);
      const force = repulsionForce / (distance * distance);
      applyForcePair(vel1, vel2, nx * force, ny * force, true);
    }
  }
}

/** Calculate and apply attraction forces between connected components */
function applyAttractionForces(
  components: DiagramComponent[],
  connections: DiagramConnection[],
  velocities: VelocityMap,
  attractionForce: number,
): void {
  connections.forEach((connection) => {
    const comp1 = components.find((c) => c.id === connection.from.componentId);
    const comp2 = components.find((c) => c.id === connection.to.componentId);
    if (!comp1 || !comp2) return;

    const vel1 = velocities.get(comp1.id);
    const vel2 = velocities.get(comp2.id);
    if (!vel1 || !vel2) return;

    const { distance, nx, ny } = calculateVector(comp1.position, comp2.position);
    const force = distance * attractionForce;
    applyForcePair(vel1, vel2, nx * force, ny * force, false);
  });
}

/** Apply velocities to component positions and constrain to bounds */
function applyVelocities(components: DiagramComponent[], velocities: VelocityMap): void {
  components.forEach((comp) => {
    const vel = velocities.get(comp.id);
    if (!vel) return;

    comp.position.x += vel.x;
    comp.position.y += vel.y;

    // Keep components within bounds
    comp.position.x = Math.max(50, Math.min(750, comp.position.x));
    comp.position.y = Math.max(50, Math.min(550, comp.position.y));
  });
}

/** Layout algorithm using physics simulation to position connected components */
export class ForceDirectedLayoutAlgorithm implements LayoutAlgorithm {
  /** Algorithm identifier */
  name = "force_directed";

  /** Default physics configuration */
  private config: ForceConfig = {
    repulsion: 5000,
    attraction: 0.1,
    damping: 0.9,
    iterations: 50,
  };

  /**
   * Calculate force-directed layout positions using physics simulation.
   * @param components - Components to position
   * @param connections - Connections that create attraction forces
   * @returns Positioned components and viewport dimensions
   */
  calculate(
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
    const positioned = [...components];
    const { repulsion, attraction, damping, iterations } = this.config;

    initializePositions(positioned);
    const velocities = createVelocityMap(positioned);

    for (let iter = 0; iter < iterations; iter++) {
      applyDamping(positioned, velocities, damping);
      applyRepulsionForces(positioned, velocities, repulsion);
      applyAttractionForces(positioned, connections, velocities, attraction);
      applyVelocities(positioned, velocities);
    }

    const viewport = this.calculateViewport(positioned);
    return { components: positioned, viewport };
  }

  private calculateViewport(components: DiagramComponent[]): { width: number; height: number } {
    if (components.length === 0) {
      return { width: 800, height: 600 };
    }

    const padding = 100;
    const maxX = Math.max(...components.map((c) => c.position.x + c.size.width));
    const maxY = Math.max(...components.map((c) => c.position.y + c.size.height));

    return {
      width: Math.max(800, maxX + padding),
      height: Math.max(600, maxY + padding),
    };
  }
}

/** Layout algorithm that arranges components based on user flow connections */
export class FlowLayoutAlgorithm implements LayoutAlgorithm {
  /** Algorithm identifier */
  name = "flow";

  /**
   * Calculate flow-based layout following user navigation paths.
   * @param components - Components to position
   * @param connections - Navigation and interaction connections
   * @returns Positioned components and viewport dimensions
   */
  calculate(
    components: DiagramComponent[],
    connections: DiagramConnection[],
  ): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
    // Organize components based on flow connections
    const positioned = [...components];

    // Find starting components (no incoming flow connections)
    const hasIncoming = new Set<string>();
    connections
      .filter((conn) => ["user_navigation", "user_interaction"].includes(conn.type))
      .forEach((conn) => hasIncoming.add(conn.to.componentId));

    const startComponents = positioned.filter((comp) => !hasIncoming.has(comp.id));
    const remainingComponents = positioned.filter((comp) => hasIncoming.has(comp.id));

    // Layout in flow order
    let currentX = 50;
    const currentY = 100;
    const stepWidth = 200;
    const stepHeight = 150;

    // Position start components
    startComponents.forEach((comp, index) => {
      comp.position = { x: currentX, y: currentY + index * stepHeight };
    });

    // Position remaining components based on flow order
    const positioned_ids = new Set(startComponents.map((c) => c.id));
    let currentStep = 1;

    while (positioned_ids.size < positioned.length && currentStep < 10) {
      currentX += stepWidth;
      let yOffset = 0;

      // Find components that can be positioned in this step
      const canPosition = remainingComponents.filter((comp) => {
        if (positioned_ids.has(comp.id)) return false;

        // Check if all predecessors are positioned
        const predecessors = connections
          .filter((conn) => conn.to.componentId === comp.id)
          .map((conn) => conn.from.componentId);

        return predecessors.length === 0 || predecessors.every((id) => positioned_ids.has(id));
      });

      canPosition.forEach((comp) => {
        comp.position = { x: currentX, y: currentY + yOffset };
        positioned_ids.add(comp.id);
        yOffset += stepHeight;
      });

      currentStep++;
    }

    // Position any remaining components
    remainingComponents
      .filter((comp) => !positioned_ids.has(comp.id))
      .forEach((comp, index) => {
        comp.position = {
          x: currentX + stepWidth,
          y: currentY + index * stepHeight,
        };
      });

    const viewport = this.calculateViewport(positioned);
    return { components: positioned, viewport };
  }

  /**
   * Calculate viewport dimensions to fit all components.
   * @param components - Positioned components
   * @returns Viewport width and height
   */
  private calculateViewport(components: DiagramComponent[]): { width: number; height: number } {
    if (components.length === 0) {
      return { width: 800, height: 600 };
    }

    const padding = 100;
    const maxX = Math.max(...components.map((c) => c.position.x + c.size.width));
    const maxY = Math.max(...components.map((c) => c.position.y + c.size.height));

    return {
      width: Math.max(1000, maxX + padding),
      height: Math.max(600, maxY + padding),
    };
  }
}

/** Engine that manages and applies diagram layout algorithms */
export class DiagramLayoutEngine {
  private algorithms: Map<string, LayoutAlgorithm> = new Map();

  constructor() {
    this.algorithms.set("layered", new LayeredLayoutAlgorithm());
    this.algorithms.set("force_directed", new ForceDirectedLayoutAlgorithm());
    this.algorithms.set("flow", new FlowLayoutAlgorithm());
  }

  /**
   * Apply layout algorithm to components
   */
  applyLayout(
    components: DiagramComponent[],
    connections: DiagramConnection[],
    layoutType = "layered",
  ): { components: DiagramComponent[]; viewport: { width: number; height: number } } {
    const algorithm = this.algorithms.get(layoutType);

    if (!algorithm) {
      console.warn(`Unknown layout algorithm: ${layoutType}, falling back to layered`);
      return this.algorithms.get("layered")!.calculate(components, connections);
    }

    return algorithm.calculate(components, connections);
  }

  /**
   * Suggest best layout based on diagram characteristics
   */
  suggestLayout(components: DiagramComponent[], connections: DiagramConnection[]): string {
    // Check for flow-based connections
    const hasFlowConnections = connections.some((conn) =>
      ["user_navigation", "user_interaction"].includes(conn.type),
    );

    if (hasFlowConnections) {
      return "flow";
    }

    // Check for clear layer separation
    const layers = new Set(components.map((c) => c.layer));
    if (layers.size >= 3) {
      return "layered";
    }

    // Default to force-directed for complex interconnections
    return "force_directed";
  }

  /**
   * Get available layout algorithms
   */
  getAvailableLayouts(): string[] {
    return Array.from(this.algorithms.keys());
  }
}
