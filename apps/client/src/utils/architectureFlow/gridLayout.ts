/**
 * Virtual Grid Layout System for Architecture Flow Diagram
 *
 * Single-pass masonry layout that preserves original item order:
 * - Items are placed in their original order (like reading text)
 * - Each item finds the first available position where it fits
 * - Expanded items reserve X×Y cells from their position
 * - Collapsed items (1×1) flow into gaps left by expanded items
 * - Left-to-right, top-to-bottom placement (masonry reading order)
 * - Parent dimensions are calculated from the grid extents
 */

import type { Node } from "reactflow";

// Layout constants
export const CELL_WIDTH = 168; // CHILD_NODE_SIZE (144) + CHILD_PADDING (24)
export const CELL_HEIGHT = 168;
export const MAX_COLS = 4;
export const PARENT_HEADER_HEIGHT = 40;
export const PARENT_PADDING = 16;
export const MIN_CONTAINER_WIDTH = 300;
export const MIN_CONTAINER_HEIGHT = 216;

/** Grid placement for a single node */
export type GridPlacement = {
  nodeId: string;
  col: number; // Starting column (0-indexed)
  row: number; // Starting row (0-indexed)
  colSpan: number; // Width in grid cells
  rowSpan: number; // Height in grid cells
};

/** Result of grid layout calculation */
export type GridLayout = {
  placements: GridPlacement[];
  nodePositions: Map<string, { x: number; y: number; width: number; height: number }>;
  gridSize: { cols: number; rows: number }; // Total grid dimensions in cells
  dimensions: { width: number; height: number }; // Pixel dimensions for parent
};

/** Context for calculating child grid sizes */
export type GridSizeContext = {
  expandedNodes: Set<string>;
  getChildrenOf: (nodeId: string) => Node[];
  /** Track UI-added children that aren't in resolved data yet */
  uiChildrenCount?: Map<string, number>;
};

/**
 * Calculate how many grid cells a child occupies
 * - Collapsed: 1x1
 * - Expanded with no children: 2x2 (minimum expanded size)
 * - Expanded with children: calculated from actual container size needed
 */
export function getChildGridSize(
  child: Node,
  ctx: GridSizeContext,
): { cols: number; rows: number } {
  const isExpanded = ctx.expandedNodes.has(child.id);

  if (!isExpanded) {
    return { cols: 1, rows: 1 };
  }

  // Expanded - calculate size based on grandchildren
  // Include both resolved children and UI-added children not yet synced
  const resolvedGrandchildren = ctx.getChildrenOf(child.id);
  const uiGrandchildren = ctx.uiChildrenCount?.get(child.id) ?? 0;
  const totalGrandchildren = resolvedGrandchildren.length + uiGrandchildren;

  if (totalGrandchildren === 0) {
    // Minimum expanded size: 2x2 cells
    return { cols: 2, rows: 2 };
  }

  // Calculate how grandchildren would be arranged inside this container
  const grandchildCols = Math.min(MAX_COLS, totalGrandchildren);
  const grandchildRows = Math.ceil(totalGrandchildren / MAX_COLS);

  // Calculate the actual pixel size the container needs:
  // Container width = padding + grandchildren grid + padding
  // Container height = header + padding + grandchildren grid + padding
  const containerWidth = PARENT_PADDING * 2 + grandchildCols * CELL_WIDTH;
  const containerHeight = PARENT_HEADER_HEIGHT + PARENT_PADDING * 2 + grandchildRows * CELL_HEIGHT;

  // Calculate how many grid cells this container needs in its parent's grid
  // Use ceiling to ensure we have enough space
  const cellsNeededCols = Math.ceil(containerWidth / CELL_WIDTH);
  const cellsNeededRows = Math.ceil(containerHeight / CELL_HEIGHT);

  // Ensure minimum 2x2
  return {
    cols: Math.max(2, cellsNeededCols),
    rows: Math.max(2, cellsNeededRows),
  };
}

/**
 * 2D occupancy grid for tracking which cells are taken
 */
class OccupancyGrid {
  private grid: boolean[][] = [];
  private maxRow = 0;
  private maxCol = 0;

  /** Check if a rectangle of cells is available */
  canPlace(col: number, row: number, colSpan: number, rowSpan: number, maxCols: number): boolean {
    // Check column bounds
    if (col + colSpan > maxCols) return false;

    // Check each cell in the rectangle
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        if (this.isOccupied(c, r)) return false;
      }
    }
    return true;
  }

  /** Mark a rectangle of cells as occupied */
  place(col: number, row: number, colSpan: number, rowSpan: number): void {
    for (let r = row; r < row + rowSpan; r++) {
      if (!this.grid[r]) this.grid[r] = [];
      const gridRow = this.grid[r]!;
      for (let c = col; c < col + colSpan; c++) {
        gridRow[c] = true;
        this.maxCol = Math.max(this.maxCol, c + 1);
      }
      this.maxRow = Math.max(this.maxRow, r + 1);
    }
  }

  /** Check if a single cell is occupied */
  private isOccupied(col: number, row: number): boolean {
    return this.grid[row]?.[col] ?? false;
  }

  /** Get the grid bounds */
  getBounds(): { cols: number; rows: number } {
    return { cols: this.maxCol, rows: this.maxRow };
  }
}

/**
 * Find the first position where an item of given size can fit
 * Scans left-to-right, top-to-bottom
 */
function findFirstFit(
  occupancy: OccupancyGrid,
  colSpan: number,
  rowSpan: number,
  maxCols: number,
): { col: number; row: number } {
  let row = 0;

  while (true) {
    for (let col = 0; col <= maxCols - colSpan; col++) {
      if (occupancy.canPlace(col, row, colSpan, rowSpan, maxCols)) {
        return { col, row };
      }
    }
    row++;
    // Safety limit to prevent infinite loops
    if (row > 100) {
      console.warn("Grid layout: exceeded row limit, placing at origin");
      return { col: 0, row: 0 };
    }
  }
}

/**
 * Helper to place a child node in the grid and record its position
 */
function placeChild(
  child: Node,
  size: { cols: number; rows: number },
  ctx: GridSizeContext,
  occupancy: OccupancyGrid,
  placements: GridPlacement[],
  nodePositions: Map<string, { x: number; y: number; width: number; height: number }>,
  maxCols: number,
): void {
  const position = findFirstFit(occupancy, size.cols, size.rows, maxCols);
  occupancy.place(position.col, position.row, size.cols, size.rows);

  placements.push({
    nodeId: child.id,
    col: position.col,
    row: position.row,
    colSpan: size.cols,
    rowSpan: size.rows,
  });

  // Calculate pixel position
  // Position is relative to parent's content area (after header and padding)
  const x = PARENT_PADDING + position.col * CELL_WIDTH;
  const y = PARENT_HEADER_HEIGHT + PARENT_PADDING + position.row * CELL_HEIGHT;

  const isExpanded = ctx.expandedNodes.has(child.id);

  // For collapsed nodes: subtract padding to get actual node size (144px in 168px cell)
  // For expanded nodes: calculate actual content-based dimensions (not from grid cells)
  let width: number;
  let height: number;

  if (isExpanded) {
    // Calculate actual dimensions based on grandchildren content
    // This ensures the container is exactly the right size, not inflated by grid cell rounding
    const grandchildren = ctx.getChildrenOf(child.id);
    const uiGrandchildren = ctx.uiChildrenCount?.get(child.id) ?? 0;
    const totalGrandchildren = grandchildren.length + uiGrandchildren;

    if (totalGrandchildren === 0) {
      width = MIN_CONTAINER_WIDTH;
      height = MIN_CONTAINER_HEIGHT;
    } else {
      const grandchildCols = Math.min(MAX_COLS, totalGrandchildren);
      const grandchildRows = Math.ceil(totalGrandchildren / MAX_COLS);
      const contentWidth = grandchildCols * CELL_WIDTH;
      const contentHeight = grandchildRows * CELL_HEIGHT;
      width = Math.max(MIN_CONTAINER_WIDTH, PARENT_PADDING * 2 + contentWidth);
      height = Math.max(
        MIN_CONTAINER_HEIGHT,
        PARENT_HEADER_HEIGHT + PARENT_PADDING * 2 + contentHeight,
      );
    }
  } else {
    // Collapsed nodes: 144px node in 168px cell
    width = size.cols * CELL_WIDTH - 24;
    height = size.rows * CELL_HEIGHT - 24;
  }

  nodePositions.set(child.id, { x, y, width, height });
}

/**
 * Calculate grid layout for children within a parent container
 *
 * Single-pass masonry layout that preserves original order:
 * - Items are placed in their original order (left-to-right, top-to-bottom reading)
 * - Each item finds the first available position where it fits
 * - Expanded items reserve X×Y cells from their position
 * - Collapsed items (1×1) flow into remaining gaps
 *
 * Example with items [1, 2(expanded 2x2), 3, 4, 5, 6]:
 *   1 2 2 3
 *   4 2 2 5
 *   6 . . .
 */
export function calculateGridLayout(
  children: Node[],
  ctx: GridSizeContext,
  maxCols: number = MAX_COLS,
): GridLayout {
  const placements: GridPlacement[] = [];
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  const occupancy = new OccupancyGrid();

  // Single pass: place each child in original order
  // Each item finds the first position where it fits (masonry reading order)
  for (const child of children) {
    const size = getChildGridSize(child, ctx);
    placeChild(child, size, ctx, occupancy, placements, nodePositions, maxCols);
  }

  // Calculate parent dimensions from grid bounds
  const bounds = occupancy.getBounds();
  const contentWidth = bounds.cols * CELL_WIDTH;
  const contentHeight = bounds.rows * CELL_HEIGHT;

  const dimensions = {
    width: Math.max(MIN_CONTAINER_WIDTH, PARENT_PADDING * 2 + contentWidth),
    height: Math.max(
      MIN_CONTAINER_HEIGHT,
      PARENT_HEADER_HEIGHT + PARENT_PADDING * 2 + contentHeight,
    ),
  };

  return {
    placements,
    nodePositions,
    gridSize: bounds,
    dimensions,
  };
}

/**
 * Calculate dimensions for a parent container based on its children
 * Convenience wrapper around calculateGridLayout
 */
export function calculateParentDimensions(
  parentId: string,
  children: Node[],
  ctx: GridSizeContext,
): { width: number; height: number } {
  if (children.length === 0) {
    return { width: MIN_CONTAINER_WIDTH, height: MIN_CONTAINER_HEIGHT };
  }

  const layout = calculateGridLayout(children, ctx);
  return layout.dimensions;
}

// Top-level layout constants (larger cells for top-level containers)
export const TOP_LEVEL_CELL_WIDTH = 180;
export const TOP_LEVEL_CELL_HEIGHT = 200;
export const TOP_LEVEL_MAX_COLS = 6;
export const TOP_LEVEL_GAP = 24;

/** Result of top-level grid layout */
export type TopLevelGridLayout = {
  nodePositions: Map<string, { x: number; y: number }>;
  gridSize: { cols: number; rows: number };
};

/**
 * Calculate how many grid cells a top-level node occupies
 * - Collapsed: 1x1
 * - Expanded: calculated from actual container dimensions
 */
export function getTopLevelNodeGridSize(
  node: Node,
  expandedNodes: Set<string>,
  parentDimensions: Map<string, { width: number; height: number }>,
): { cols: number; rows: number } {
  const isExpanded = expandedNodes.has(node.id);

  if (!isExpanded) {
    return { cols: 1, rows: 1 };
  }

  // Get the actual dimensions of the expanded container
  const dims = parentDimensions.get(node.id);
  if (!dims) {
    return { cols: 2, rows: 2 }; // Default expanded size
  }

  // Calculate how many grid cells this container needs
  // Add gap to account for spacing between cells
  const cellWithGap = TOP_LEVEL_CELL_WIDTH + TOP_LEVEL_GAP;
  const cellHeightWithGap = TOP_LEVEL_CELL_HEIGHT + TOP_LEVEL_GAP;

  const cols = Math.max(1, Math.ceil(dims.width / cellWithGap));
  const rows = Math.max(1, Math.ceil(dims.height / cellHeightWithGap));

  return { cols, rows };
}

/**
 * Calculate grid layout for top-level nodes using masonry bin-packing
 *
 * This replaces the dagre-based layoutReactFlow for top-level nodes,
 * providing proper handling of expanded containers that span multiple cells.
 */
export function calculateTopLevelGridLayout(
  nodes: Node[],
  expandedNodes: Set<string>,
  parentDimensions: Map<string, { width: number; height: number }>,
  savedPositions?: Map<string, { x: number; y: number }>,
  maxCols: number = TOP_LEVEL_MAX_COLS,
): TopLevelGridLayout {
  const nodePositions = new Map<string, { x: number; y: number }>();
  const occupancy = new OccupancyGrid();

  // Sort nodes: prefer to keep existing positions stable
  // Nodes with saved positions should try to maintain relative order
  const sortedNodes = [...nodes];

  for (const node of sortedNodes) {
    // If node has a saved position, use it
    const savedPos = savedPositions?.get(node.id);
    if (savedPos) {
      nodePositions.set(node.id, savedPos);
      // Mark the grid cells as occupied based on node size
      const size = getTopLevelNodeGridSize(node, expandedNodes, parentDimensions);
      const cellWithGap = TOP_LEVEL_CELL_WIDTH + TOP_LEVEL_GAP;
      const cellHeightWithGap = TOP_LEVEL_CELL_HEIGHT + TOP_LEVEL_GAP;
      const col = Math.round(savedPos.x / cellWithGap);
      const row = Math.round(savedPos.y / cellHeightWithGap);
      // Only mark as occupied if within reasonable bounds
      if (col >= 0 && row >= 0) {
        occupancy.place(col, row, size.cols, size.rows);
      }
      continue;
    }

    // Calculate grid size for this node
    const size = getTopLevelNodeGridSize(node, expandedNodes, parentDimensions);

    // Find first available position using bin-packing
    const position = findFirstFit(occupancy, size.cols, size.rows, maxCols);
    occupancy.place(position.col, position.row, size.cols, size.rows);

    // Convert grid position to pixel position
    const cellWithGap = TOP_LEVEL_CELL_WIDTH + TOP_LEVEL_GAP;
    const cellHeightWithGap = TOP_LEVEL_CELL_HEIGHT + TOP_LEVEL_GAP;
    const x = position.col * cellWithGap;
    const y = position.row * cellHeightWithGap;

    nodePositions.set(node.id, { x, y });
  }

  return {
    nodePositions,
    gridSize: occupancy.getBounds(),
  };
}
