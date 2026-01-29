/**
 * IndexedDB storage for diagram node positions.
 * Persists user-arranged node layouts across sessions.
 */

const DB_NAME = "arbiter-diagrams";
const DB_VERSION = 1;
const STORE_NAME = "node-positions";

export interface NodePosition {
  x: number;
  y: number;
}

export interface DiagramPositions {
  /** Project ID this layout belongs to */
  projectId: string;
  /** Map of node ID to position */
  positions: Record<string, NodePosition>;
  /** Set of expanded node IDs */
  expandedNodes: string[];
  /** Last updated timestamp */
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or create the IndexedDB database.
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open diagram positions database:", request.error);
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "projectId" });
      }
    };
  });

  return dbPromise;
}

export interface DiagramState {
  positions: Map<string, NodePosition>;
  expandedNodes: Set<string>;
}

/**
 * Load saved diagram state for a project.
 */
export async function loadDiagramState(projectId: string): Promise<DiagramState> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(projectId);

      request.onerror = () => {
        console.error("Failed to load diagram state:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const data = request.result as DiagramPositions | undefined;
        const positions = data?.positions
          ? new Map(Object.entries(data.positions))
          : new Map<string, NodePosition>();
        const expandedNodes = data?.expandedNodes ? new Set(data.expandedNodes) : new Set<string>();
        resolve({ positions, expandedNodes });
      };
    });
  } catch (error) {
    console.error("Error loading diagram state:", error);
    return { positions: new Map(), expandedNodes: new Set() };
  }
}

/**
 * @deprecated Use loadDiagramState instead
 */
export async function loadDiagramPositions(projectId: string): Promise<Map<string, NodePosition>> {
  const state = await loadDiagramState(projectId);
  return state.positions;
}

/**
 * Save diagram state for a project.
 */
export async function saveDiagramState(
  projectId: string,
  positions: Map<string, NodePosition>,
  expandedNodes: Set<string>,
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const data: DiagramPositions = {
        projectId,
        positions: Object.fromEntries(positions),
        expandedNodes: Array.from(expandedNodes),
        updatedAt: Date.now(),
      };
      const request = store.put(data);

      request.onerror = () => {
        console.error("Failed to save diagram state:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.error("Error saving diagram state:", error);
  }
}

/**
 * @deprecated Use saveDiagramState instead
 */
export async function saveDiagramPositions(
  projectId: string,
  positions: Map<string, NodePosition>,
): Promise<void> {
  return saveDiagramState(projectId, positions, new Set());
}

/**
 * Clear saved positions for a project.
 */
export async function clearDiagramPositions(projectId: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(projectId);

      request.onerror = () => {
        console.error("Failed to clear diagram positions:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.error("Error clearing diagram positions:", error);
  }
}
