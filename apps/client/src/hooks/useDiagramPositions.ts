/**
 * Hook for persisting diagram state (positions and expanded nodes) to IndexedDB.
 * Provides debounced saving to avoid excessive writes during drag operations.
 */

import {
  type NodePosition,
  clearDiagramPositions,
  loadDiagramState,
  saveDiagramState,
} from "@/utils/storage/diagramPositions";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseDiagramStateReturn {
  /** Current loaded positions (updates when projectId changes) */
  positions: Map<string, NodePosition>;
  /** Current expanded node IDs */
  expandedNodes: Set<string>;
  /** Whether state has been loaded */
  isLoaded: boolean;
  /** Update a single node's position */
  updatePosition: (nodeId: string, position: NodePosition) => void;
  /** Update multiple positions at once */
  updatePositions: (updates: Map<string, NodePosition>) => void;
  /** Set a node's expanded state */
  setNodeExpanded: (nodeId: string, expanded: boolean) => void;
  /** Toggle a node's expanded state */
  toggleNodeExpanded: (nodeId: string) => void;
  /** Collapse all expanded nodes */
  collapseAllNodes: () => void;
  /** Clear all saved state for this project */
  clearState: () => Promise<void>;
  /** Force an immediate save */
  flushSave: () => void;
}

/**
 * Hook for managing diagram state persistence (positions and expanded nodes).
 *
 * @param projectId - Project ID to scope state to
 * @param debounceMs - Debounce delay in ms (default: 500)
 */
export function useDiagramPositions(projectId: string, debounceMs = 500): UseDiagramStateReturn {
  const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  const positionsRef = useRef<Map<string, NodePosition>>(new Map());
  const expandedNodesRef = useRef<Set<string>>(new Set());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const currentProjectIdRef = useRef(projectId);

  // Save function that saves both positions and expanded nodes
  const doSave = useCallback((projId: string) => {
    saveDiagramState(projId, positionsRef.current, expandedNodesRef.current);
  }, []);

  // Load state when projectId changes
  useEffect(() => {
    let cancelled = false;

    // Flush pending save for PREVIOUS project before switching
    // (currentProjectIdRef still holds the old project ID at this point)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingSaveRef.current) {
      doSave(currentProjectIdRef.current);
      pendingSaveRef.current = false;
    }

    // Now clear state and switch to new project
    setIsLoaded(false);
    positionsRef.current = new Map();
    expandedNodesRef.current = new Set();
    setPositions(new Map());
    setExpandedNodes(new Set());
    currentProjectIdRef.current = projectId;

    loadDiagramState(projectId).then((state) => {
      if (cancelled) return;
      positionsRef.current = state.positions;
      expandedNodesRef.current = state.expandedNodes;
      setPositions(new Map(state.positions));
      setExpandedNodes(new Set(state.expandedNodes));
      setIsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, doSave]);

  // Cleanup on unmount - flush pending saves
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingSaveRef.current) {
        doSave(currentProjectIdRef.current);
      }
    };
  }, [doSave]);

  // Debounced save function
  const scheduleSave = useCallback(() => {
    pendingSaveRef.current = true;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      doSave(currentProjectIdRef.current);
      pendingSaveRef.current = false;
      saveTimeoutRef.current = null;
    }, debounceMs);
  }, [debounceMs, doSave]);

  // Update a single position
  const updatePosition = useCallback(
    (nodeId: string, position: NodePosition) => {
      positionsRef.current.set(nodeId, position);
      // Also update state so savedPositions stays in sync for layout decisions
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(nodeId, position);
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  // Update multiple positions at once
  const updatePositions = useCallback(
    (updates: Map<string, NodePosition>) => {
      updates.forEach((pos, id) => {
        positionsRef.current.set(id, pos);
      });
      // Also update state so savedPositions stays in sync
      setPositions((prev) => {
        const next = new Map(prev);
        updates.forEach((pos, id) => {
          next.set(id, pos);
        });
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  // Set a node's expanded state
  const setNodeExpanded = useCallback(
    (nodeId: string, expanded: boolean) => {
      if (expanded) {
        expandedNodesRef.current.add(nodeId);
      } else {
        expandedNodesRef.current.delete(nodeId);
      }
      setExpandedNodes(new Set(expandedNodesRef.current));
      scheduleSave();
    },
    [scheduleSave],
  );

  // Toggle a node's expanded state
  const toggleNodeExpanded = useCallback(
    (nodeId: string) => {
      if (expandedNodesRef.current.has(nodeId)) {
        expandedNodesRef.current.delete(nodeId);
      } else {
        expandedNodesRef.current.add(nodeId);
      }
      setExpandedNodes(new Set(expandedNodesRef.current));
      scheduleSave();
    },
    [scheduleSave],
  );

  // Collapse all expanded nodes
  const collapseAllNodes = useCallback(() => {
    expandedNodesRef.current.clear();
    setExpandedNodes(new Set());
    scheduleSave();
  }, [scheduleSave]);

  // Clear all state
  const clearState = useCallback(async () => {
    positionsRef.current.clear();
    expandedNodesRef.current.clear();
    setPositions(new Map());
    setExpandedNodes(new Set());
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSaveRef.current = false;
    await clearDiagramPositions(currentProjectIdRef.current);
  }, []);

  // Force immediate save
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    doSave(currentProjectIdRef.current);
    pendingSaveRef.current = false;
  }, [doSave]);

  return {
    positions,
    expandedNodes,
    isLoaded,
    updatePosition,
    updatePositions,
    setNodeExpanded,
    toggleNodeExpanded,
    collapseAllNodes,
    clearState,
    flushSave,
  };
}
