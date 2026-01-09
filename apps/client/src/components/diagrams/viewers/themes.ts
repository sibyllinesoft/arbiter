/**
 * Diagram theme configurations
 */
import type { DiagramTheme } from "@/types/architecture";

export const DEFAULT_THEME: DiagramTheme = {
  name: "default",
  layers: {
    presentation: {
      background: "#dbeafe",
      border: "#3b82f6",
      text: "#1e40af",
    },
    application: {
      background: "#dcfce7",
      border: "#22c55e",
      text: "#15803d",
    },
    service: {
      background: "#fef3c7",
      border: "#f59e0b",
      text: "#d97706",
    },
    data: {
      background: "#f3e8ff",
      border: "#a855f7",
      text: "#7c3aed",
    },
    external: {
      background: "#fee2e2",
      border: "#ef4444",
      text: "#dc2626",
    },
  },
  connections: {
    user_navigation: { color: "#3b82f6", width: 2, style: "solid" },
    user_interaction: { color: "#10b981", width: 2, style: "dashed" },
    api_call: { color: "#f59e0b", width: 2, style: "solid" },
    capability_usage: { color: "#8b5cf6", width: 1.5, style: "dotted" },
    state_transition: { color: "#ef4444", width: 2, style: "solid" },
    data_flow: { color: "#6b7280", width: 1, style: "solid" },
    dependency: { color: "#374151", width: 1, style: "dashed" },
  },
  components: {
    defaultSize: { width: 150, height: 80 },
    minSize: { width: 100, height: 60 },
    padding: 8,
    borderRadius: 8,
  },
};

export const DARK_THEME: DiagramTheme = {
  name: "dark",
  layers: {
    presentation: {
      background: "#334155",
      border: "#60a5fa",
      text: "#bfdbfe",
    },
    application: {
      background: "#166534",
      border: "#4ade80",
      text: "#dcfce7",
    },
    service: {
      background: "#713f12",
      border: "#f59e0b",
      text: "#fcd34d",
    },
    data: {
      background: "#581c87",
      border: "#c084fc",
      text: "#e9d5ff",
    },
    external: {
      background: "#991b1b",
      border: "#f87171",
      text: "#fecaca",
    },
  },
  connections: {
    user_navigation: { color: "#60a5fa", width: 2, style: "solid" },
    user_interaction: { color: "#4ade80", width: 2, style: "dashed" },
    api_call: { color: "#f59e0b", width: 2, style: "solid" },
    capability_usage: { color: "#c084fc", width: 1.5, style: "dotted" },
    state_transition: { color: "#f87171", width: 2, style: "solid" },
    data_flow: { color: "#9ca3af", width: 1, style: "solid" },
    dependency: { color: "#6b7280", width: 1, style: "dashed" },
  },
  components: {
    defaultSize: { width: 150, height: 80 },
    minSize: { width: 100, height: 60 },
    padding: 8,
    borderRadius: 8,
  },
};
