export const STATUS_STYLES: Record<string, string> = {
  completed: "fill:#dcfce7,stroke:#15803d,color:#166534,font-weight:bold",
  in_progress: "fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a,font-weight:bold",
  blocked: "fill:#fee2e2,stroke:#dc2626,color:#991b1b,font-weight:bold",
  at_risk: "fill:#fef3c7,stroke:#d97706,color:#92400e,font-weight:bold",
  todo: "fill:#f1f5f9,stroke:#94a3b8,color:#475569",
};

export const DEFAULT_TASK_LAYER_KEY = "task-default";

export const TASK_STATUS_LAYER_KEY: Record<string, string> = {
  completed: "task-completed",
  in_progress: "task-in-progress",
  blocked: "task-blocked",
  at_risk: "task-at-risk",
  todo: DEFAULT_TASK_LAYER_KEY,
};

export const FALLBACK_STATUS_CLASS = "todo";

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 1.6;
export const HORIZONTAL_PADDING = 80;
export const TOP_PADDING = 20;
export const BOTTOM_PADDING = 80;
