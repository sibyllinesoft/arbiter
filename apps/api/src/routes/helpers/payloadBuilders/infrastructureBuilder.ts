import { coerceOptionalTrimmedString, coerceStringArray, hasOwn } from "./shared";
/**
 * Infrastructure artifact payload builder
 */
import type { ManualArtifactPayload } from "./types";

/**
 * Build environment metadata for infrastructure.
 */
function buildEnvironmentMetadata(
  values: Record<string, any>,
): Record<string, unknown> | undefined {
  const environmentDomain = coerceOptionalTrimmedString(values.environmentDomain);
  const environmentReleaseGate = coerceOptionalTrimmedString(values.environmentReleaseGate);
  const environmentChangeManagement = coerceOptionalTrimmedString(
    values.environmentChangeManagement,
  );
  const environmentSecrets = hasOwn(values, "environmentSecrets")
    ? coerceStringArray(values.environmentSecrets)
    : undefined;

  if (
    !environmentDomain &&
    !environmentReleaseGate &&
    !environmentChangeManagement &&
    !environmentSecrets
  ) {
    return undefined;
  }

  return {
    ...(environmentDomain ? { domain: environmentDomain } : {}),
    ...(environmentReleaseGate ? { releaseGate: environmentReleaseGate } : {}),
    ...(environmentChangeManagement ? { changeManagement: environmentChangeManagement } : {}),
    ...(environmentSecrets
      ? { secrets: environmentSecrets }
      : hasOwn(values, "environmentSecrets")
        ? { secrets: [] }
        : {}),
  };
}

/**
 * Build config metadata for infrastructure.
 */
function buildConfigMetadata(values: Record<string, any>): Record<string, unknown> | undefined {
  const loggingLevel = coerceOptionalTrimmedString(values.observabilityLoggingLevel);
  const metricsProvider = coerceOptionalTrimmedString(values.observabilityMetricsProvider);
  const observabilityAlerts = hasOwn(values, "observabilityAlerts")
    ? coerceStringArray(values.observabilityAlerts)
    : undefined;
  const migrationTool = coerceOptionalTrimmedString(values.migrationTool);
  const migrationStrategy = coerceOptionalTrimmedString(values.migrationStrategy);
  const migrationSchedule = coerceOptionalTrimmedString(values.migrationSchedule);

  if (
    !loggingLevel &&
    !metricsProvider &&
    !observabilityAlerts &&
    !migrationTool &&
    !migrationStrategy &&
    !migrationSchedule
  ) {
    return undefined;
  }

  const config: Record<string, unknown> = {};

  if (loggingLevel) {
    config.logging = { level: loggingLevel };
  }

  if (metricsProvider || observabilityAlerts) {
    config.monitoring = {
      ...(metricsProvider ? { metricsProvider } : {}),
      ...(observabilityAlerts
        ? { alerts: observabilityAlerts }
        : hasOwn(values, "observabilityAlerts")
          ? { alerts: [] }
          : {}),
    };
  }

  if (migrationTool || migrationStrategy || migrationSchedule) {
    config.tool = migrationTool;
    config.strategy = migrationStrategy;
    config.schedule = migrationSchedule;
  }

  return config;
}

/**
 * Build infrastructure artifact payload with environment and observability config.
 */
export function buildInfrastructurePayload(
  values: Record<string, any>,
  _slug: string,
  name: string,
  description: string | null,
): ManualArtifactPayload {
  const scope = coerceOptionalTrimmedString(values.scope) || "infrastructure";
  const category = coerceOptionalTrimmedString(values.category);

  const metadata: Record<string, unknown> = {
    description,
    scope,
    classification: { detectedType: "infrastructure", reason: "manual-entry", source: "user" },
  };

  if (category) metadata.category = category;

  const environment = buildEnvironmentMetadata(values);
  if (environment) metadata.environment = environment;

  const config = buildConfigMetadata(values);
  if (config) metadata.config = config;

  return { name, description, artifactType: "infrastructure", metadata };
}
