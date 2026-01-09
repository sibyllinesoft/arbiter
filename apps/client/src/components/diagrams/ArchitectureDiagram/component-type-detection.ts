/**
 * Component type detection utilities for architecture diagrams.
 * Determines the appropriate type category for each component based on metadata.
 */

const toLowerString = (value: unknown): string => String(value || "").toLowerCase();

/** Detect type from explicit detected type metadata */
function detectFromMetadataType(detectedType: string): string | null {
  if (detectedType === "tool" || detectedType === "build_tool") return "tool";
  if (detectedType === "frontend" || detectedType === "mobile") return "frontend";
  if (detectedType === "web_service") return "service";
  return null;
}

/** Detect type from raw type string */
function detectFromRawType(rawType: string, data: any): string | null {
  if (rawType.includes("service")) return "service";
  if (["package", "module", "library"].includes(rawType)) return "package";
  if (["tool", "cli", "binary"].includes(rawType)) return "tool";
  if (["deployment", "infrastructure"].includes(rawType)) return "infrastructure";
  if (rawType === "database") return "database";
  if (rawType === "frontend" || rawType === "mobile") return "frontend";
  if (rawType === "route") {
    const routerType = toLowerString(data.metadata?.routerType);
    return routerType && routerType !== "tsoa" ? "view" : "route";
  }
  if (rawType === "component") return "component";
  return null;
}

/** Detect type from language and framework metadata */
function detectFromLanguageFramework(
  language: string,
  framework: string,
  data: any,
): string | null {
  if (!language) return null;
  if (!["javascript", "typescript", "tsx", "jsx"].includes(language)) return null;

  if (data.metadata?.routerType) return "view";
  if (framework.includes("react") || framework.includes("next")) return "view";
  return null;
}

/** Detect type from infrastructure markers */
function detectFromInfrastructure(data: any): string | null {
  if (data.metadata?.containerImage || data.metadata?.compose) return "service";
  if (data.metadata?.kubernetes || data.metadata?.terraform) return "infrastructure";
  return null;
}

/** Detect type from name patterns */
function detectFromName(name: string): string | null {
  if (name.includes("@")) return "package";
  return null;
}

/**
 * Determine the component type from data and name.
 * Uses a multi-step detection strategy based on metadata and patterns.
 */
export function getComponentType(data: any, name: string): string {
  const rawType = toLowerString(data.type || data.metadata?.type);
  const language = toLowerString(data.metadata?.language);
  const framework = toLowerString(data.metadata?.framework);
  const detectedType = toLowerString(data.metadata?.detectedType);

  // Try detection strategies in order of specificity
  const fromMetadataType = detectFromMetadataType(detectedType);
  if (fromMetadataType) return fromMetadataType;

  const fromRawType = detectFromRawType(rawType, data);
  if (fromRawType) return fromRawType;

  const fromLanguage = detectFromLanguageFramework(language, framework, data);
  if (fromLanguage) return fromLanguage;

  const fromInfra = detectFromInfrastructure(data);
  if (fromInfra) return fromInfra;

  const fromName = detectFromName(name);
  if (fromName) return fromName;

  return "component";
}
