/**
 * Artifact display utilities.
 * Helpers for rendering artifact metadata in diagrams and UI components.
 */
import { LAYER_STYLE_CLASSES } from "@/components/diagrams/ArchitectureDiagram/constants";

/** Direct type-to-layer mappings */
const TYPE_TO_LAYER: Record<string, string> = {
  service: "service",
  route: "route",
  view: "view",
  frontend: "frontend",
  module: "package",
  package: "package",
  tool: "tool",
  infrastructure: "infrastructure",
  database: "database",
  databases: "database",
  datastore: "database",
  flow: "flow",
  flows: "flow",
  capability: "capability",
  capabilities: "capability",
  backend: "backend",
};

/**
 * Coerce a raw value to a display-safe string.
 * Returns null for empty, undefined, or "unknown" values.
 */
export const coerceDisplayValue = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return null;
  return trimmed;
};

/** Extract a string value from a nested object property */
const getNestedString = (input: unknown, key: string): string | undefined => {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
};

/** Check if metadata indicates the presence of frameworks */
const hasFrameworks = (metadata: unknown): boolean => {
  if (!metadata || typeof metadata !== "object") return false;
  const frameworks = (metadata as Record<string, unknown>).frameworks;
  return Array.isArray(frameworks) && frameworks.length > 0;
};

/** Resolve layer key from metadata when direct type mapping fails */
function resolveLayerFromMetadata(metadata: Record<string, unknown>): string {
  if (getNestedString(metadata, "detectedType") === "frontend") return "frontend";
  if (hasFrameworks(metadata)) return "frontend";
  if (getNestedString(metadata, "engine") || getNestedString(metadata, "database"))
    return "database";
  return "external";
}

/**
 * Resolve the CSS layer class for an artifact based on its type.
 * Inspects type, metadata, and other fields to determine coloring.
 */
export const resolveLayerClass = (data: Record<string, unknown>): string => {
  const metadata =
    typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : {};
  const resolvedType =
    getNestedString(data, "type") ||
    getNestedString(metadata, "type") ||
    getNestedString(metadata, "detectedType") ||
    getNestedString(metadata, "category");
  const normalizedType = typeof resolvedType === "string" ? resolvedType.toLowerCase() : "";

  const colorKey = TYPE_TO_LAYER[normalizedType] ?? resolveLayerFromMetadata(metadata);
  const layerClass = LAYER_STYLE_CLASSES[colorKey as keyof typeof LAYER_STYLE_CLASSES];

  return typeof layerClass === "string" && layerClass.length > 0
    ? layerClass
    : (LAYER_STYLE_CLASSES.external ?? "");
};
