/**
 * Hook for persisting diagram node positions to IndexedDB.
 * Provides debounced saving to avoid excessive writes during drag operations.
 */

import {
  type NodePosition,
  clearDiagramPositions,
  loadDiagramPositions,
  saveDiagramPositions,
} from "@/utils/storage/diagramPositions";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseDiagramPositionsReturn {
  /** Current loaded positions (updates when projectId changes) */
  positions: Map<string, NodePosition>;
  /** Whether positions have been loaded */
  isLoaded: boolean;
  /** Update a single node's position */
  updatePosition: (nodeId: string, position: NodePosition) => void;
  /** Update multiple positions at once */
  updatePositions: (updates: Map<string, NodePosition>) => void;
  /** Clear all saved positions for this project */
  clearPositions: () => Promise<void>;
  /** Force an immediate save */
  flushSave: () => void;
}

/**
 * Hook for managing diagram node position persistence.
 *
 * @param projectId - Project ID to scope positions to
 * @param debounceMs - Debounce delay in ms (default: 500)
 */
export function useDiagramPositions(
  projectId: string,
  debounceMs = 500,
): UseDiagramPositionsReturn {
  const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);

  const positionsRef = useRef<Map<string, NodePosition>>(new Map());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const currentProjectIdRef = useRef(projectId);

  // Load positions when projectId changes
  useEffect(() => {
    let cancelled = false;

    // Flush pending save for PREVIOUS project before switching
    // (currentProjectIdRef still holds the old project ID at this point)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingSaveRef.current && positionsRef.current.size > 0) {
      saveDiagramPositions(currentProjectIdRef.current, positionsRef.current);
      pendingSaveRef.current = false;
    }

    // Now clear state and switch to new project
    setIsLoaded(false);
    positionsRef.current = new Map();
    setPositions(new Map());
    currentProjectIdRef.current = projectId;

    loadDiagramPositions(projectId).then((loadedPositions) => {
      if (cancelled) return;
      console.log(
        "[DiagramPositions] Loaded positions for project:",
        projectId,
        "count:",
        loadedPositions.size,
        loadedPositions,
      );
      positionsRef.current = loadedPositions;
      setPositions(new Map(loadedPositions));
      setIsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Cleanup on unmount - flush pending saves
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingSaveRef.current && positionsRef.current.size > 0) {
        saveDiagramPositions(currentProjectIdRef.current, positionsRef.current);
      }
    };
  }, []);

  // Debounced save function
  const scheduleSave = useCallback(() => {
    pendingSaveRef.current = true;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      console.log(
        "[DiagramPositions] Saving positions for project:",
        currentProjectIdRef.current,
        "count:",
        positionsRef.current.size,
      );
      saveDiagramPositions(currentProjectIdRef.current, positionsRef.current);
      pendingSaveRef.current = false;
      saveTimeoutRef.current = null;
    }, debounceMs);
  }, [debounceMs]);

  // Update a single position
  const updatePosition = useCallback(
    (nodeId: string, position: NodePosition) => {
      console.log("[DiagramPositions] updatePosition:", nodeId, position);
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

  // Clear all positions
  const clearPositions = useCallback(async () => {
    positionsRef.current.clear();
    setPositions(new Map());
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
    if (positionsRef.current.size > 0) {
      saveDiagramPositions(currentProjectIdRef.current, positionsRef.current);
      pendingSaveRef.current = false;
    }
  }, []);

  return {
    positions,
    isLoaded,
    updatePosition,
    updatePositions,
    clearPositions,
    flushSave,
  };
}
