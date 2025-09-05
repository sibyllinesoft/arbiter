/**
 * UI-specific types for frontend state management
 */

import type {
  Fragment,
  GapSet,
  IRResponse,
  Project,
  ValidationError,
  ValidationWarning,
} from "./api";

// Application state
export interface AppState {
  // Core data
  currentProject: Project | null;
  fragments: Fragment[];
  resolved: Record<string, unknown> | null;
  gaps: GapSet | null;
  irs: Record<string, IRResponse>;

  // UI state
  activeFragmentId: string | null;
  activeTab: DiagramTab;
  isLoading: boolean;
  error: string | null;

  // Editor state
  unsavedChanges: Set<string>;
  editorContent: Record<string, string>;

  // Connection state
  isConnected: boolean;
  reconnectAttempts: number;
  lastSync: string | null;

  // Validation state
  validationErrors: ValidationError[];
  validationWarnings: ValidationWarning[];
  isValidating: boolean;
  lastValidation: string | null;
  specHash: string | null;
}

// Diagram tabs
export type DiagramTab = "flow" | "site" | "fsm" | "view" | "gaps" | "resolved";

// UI actions
export type AppAction =
  | { type: "SET_PROJECT"; payload: Project | null }
  | { type: "SET_FRAGMENTS"; payload: Fragment[] }
  | { type: "UPDATE_FRAGMENT"; payload: Fragment }
  | { type: "DELETE_FRAGMENT"; payload: string }
  | { type: "SET_RESOLVED"; payload: { resolved: Record<string, unknown>; specHash: string } }
  | { type: "SET_GAPS"; payload: GapSet }
  | { type: "SET_IR"; payload: { kind: string; data: IRResponse } }
  | { type: "SET_ACTIVE_FRAGMENT"; payload: string | null }
  | { type: "SET_ACTIVE_TAB"; payload: DiagramTab }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_EDITOR_CONTENT"; payload: { fragmentId: string; content: string } }
  | { type: "MARK_UNSAVED"; payload: string }
  | { type: "MARK_SAVED"; payload: string }
  | { type: "SET_CONNECTION_STATUS"; payload: boolean }
  | { type: "INCREMENT_RECONNECT_ATTEMPTS" }
  | { type: "RESET_RECONNECT_ATTEMPTS" }
  | { type: "SET_LAST_SYNC"; payload: string }
  | {
      type: "SET_VALIDATION_STATE";
      payload: {
        errors: ValidationError[];
        warnings: ValidationWarning[];
        isValidating: boolean;
        lastValidation: string | null;
        specHash: string | null;
      };
    };

// Component props
export interface SplitPaneProps {
  children: [React.ReactNode, React.ReactNode];
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  allowResize?: boolean;
  split?: "vertical" | "horizontal";
  className?: string;
}

export interface TabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: TabItem[];
  className?: string;
}

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

// File tree types
export interface FileTreeItem {
  id: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeItem[];
  hasUnsavedChanges?: boolean;
}

// Monaco editor types
export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  language?: string;
  theme?: string;
  options?: any;
  className?: string;
}

// Diagram renderer types
export interface DiagramRendererProps {
  data: any;
  loading?: boolean;
  error?: string;
  className?: string;
}

export interface MermaidDiagramProps extends DiagramRendererProps {
  data: string; // Mermaid text
}

export interface GraphvizDiagramProps extends DiagramRendererProps {
  data: string; // DOT notation
}

export interface ExcalidrawDiagramProps extends DiagramRendererProps {
  data: any; // Excalidraw scene data
  onDataChange?: (data: any) => void;
}

// Toast notification types
export interface ToastNotification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  duration?: number;
  timestamp: string;
  user?: string;
}

// WebSocket connection types
export interface WebSocketState {
  isConnected: boolean;
  reconnectAttempts: number;
  lastPing: string | null;
  connectionId: string | null;
}

// Worker message types
export interface WorkerMessage {
  id: string;
  type: "render" | "response" | "error";
  data: any;
}

export interface WorkerResponse extends WorkerMessage {
  type: "response";
  success: boolean;
  result?: any;
  error?: string;
  duration?: number;
}

// Coverage meter types
export interface CoverageMeterProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  showPercentage?: boolean;
  className?: string;
}

// Interactive gaps types
export interface GapItemProps {
  type: "missing_capability" | "orphaned_token" | "coverage_gap" | "duplicate";
  data: any;
  onResolve?: (id: string) => void;
  onNavigate?: (location: string) => void;
}

// Performance monitoring types
export interface PerformanceMetrics {
  initialLoadTime: number;
  wsEventProcessingTime: number;
  diagramRenderTime: Record<string, number>;
  editorResponseTime: number;
  lastMeasured: string;
}

// Cache types
export interface CacheEntry<T = any> {
  data: T;
  timestamp: string;
  specHash: string;
  expiresAt?: string;
}

export interface CacheManager {
  get<T>(key: string): CacheEntry<T> | null;
  set<T>(key: string, data: T, specHash: string, ttl?: number): void;
  invalidate(specHash: string): void;
  clear(): void;
}

// Error boundary types
export interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}
