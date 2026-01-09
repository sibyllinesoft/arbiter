import { coerceEnvironmentMap, coerceOptionalTrimmedString, guessLanguage, hasOwn } from "./shared";
/**
 * Service artifact payload builder
 */
import type { ManualArtifactPayload } from "./types";

/**
 * Build service artifact payload with port and environment config.
 */
export function buildServicePayload(
  values: Record<string, any>,
  slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const rawLanguage = coerceOptionalTrimmedString(values.language);
  const rawFramework = coerceOptionalTrimmedString(values.framework);
  const legacyTechnology = coerceOptionalTrimmedString(values.technology);
  const language = rawLanguage || guessLanguage(legacyTechnology) || "javascript";
  const framework = rawFramework || legacyTechnology || undefined;
  const defaultPortContext = `${framework ?? language}`.toLowerCase();
  const defaultPort = defaultPortContext.includes("python") ? 5000 : 3000;
  const portValue = Number.parseInt(values.port || "", 10);
  const port = Number.isFinite(portValue) ? portValue : defaultPort;
  const environmentProvided = hasOwn(values, "environment");
  const environmentMap = coerceEnvironmentMap(values.environment);
  const shouldClearEnvironment = environmentProvided && !environmentMap;

  return {
    name,
    description,
    artifactType: "service",
    language,
    framework,
    metadata: {
      description,
      port,
      containerImage: `manual/${slug}:latest`,
      language,
      framework,
      ...(environmentMap
        ? { environment: environmentMap }
        : shouldClearEnvironment
          ? { environment: null }
          : {}),
      classification: { detectedType: "service", reason: "manual-entry", source: "user" },
    },
    filePath: typeof values.sourcePath === "string" ? values.sourcePath : undefined,
  };
}
