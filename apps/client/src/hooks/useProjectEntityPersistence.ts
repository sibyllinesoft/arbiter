/**
 * Entity persistence hook for project entities.
 * Handles creating and updating entities via the API.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { FieldValue } from "@/components/modals/entityTypes";
import { apiService } from "@/services/api";

/** Options for the entity persistence hook */
interface UseProjectEntityPersistenceOptions {
  projectId: string | null;
  refresh?: (options?: { silent?: boolean }) => Promise<void>;
  setError?: (message: string | null) => void;
}

/** Arguments for persisting an entity */
interface PersistEntityArgs {
  entityType: string;
  values: Record<string, FieldValue>;
  artifactId?: string | null;
  draftIdentifier?: string | null;
}

/** Pattern for normalizing identifiers */
const SLUG_NORMALIZE_PATTERN = /[^a-z0-9]+/g;
const SLUG_TRIM_PATTERN = /^-+|-+$/g;

/** Extract trimmed string from a value */
const getTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * Normalize an identifier to a URL-friendly slug.
 * @param value - Raw identifier value
 * @returns Normalized lowercase slug
 */
const normalizeIdentifier = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(SLUG_NORMALIZE_PATTERN, "-")
    .replace(SLUG_TRIM_PATTERN, "")
    .trim();
  return normalized || value;
};

/**
 * Resolve the entity identifier from values or draft.
 * @param values - Form field values
 * @param draftIdentifier - Optional draft identifier
 * @returns Resolved identifier string
 */
const resolveEntityIdentifier = (
  values: Record<string, FieldValue>,
  draftIdentifier?: string | null,
): string =>
  getTrimmedString(values.id) || getTrimmedString(values.slug) || getTrimmedString(draftIdentifier);

/**
 * Hook for persisting project entities to the API.
 * @param options - Persistence options with project ID and callbacks
 * @returns Object with persistEntity function
 */
export function useProjectEntityPersistence({
  projectId,
  refresh,
  setError,
}: UseProjectEntityPersistenceOptions) {
  const queryClient = useQueryClient();

  const persistEntity = useCallback(
    async ({
      entityType,
      values,
      artifactId,
      draftIdentifier,
    }: PersistEntityArgs): Promise<boolean> => {
      if (!projectId) return false;

      const valuesWithContext: Record<string, FieldValue> = { ...values };
      const resolvedIdentifier = resolveEntityIdentifier(values, draftIdentifier);

      if (resolvedIdentifier) {
        const finalIdentifier = normalizeIdentifier(resolvedIdentifier);
        valuesWithContext.id = finalIdentifier;
        valuesWithContext.slug = finalIdentifier;
      }

      try {
        const payload = { type: entityType, values: valuesWithContext };

        if (artifactId) {
          await apiService.updateProjectEntity(projectId, artifactId, payload);
        } else {
          await apiService.createProjectEntity(projectId, payload);
        }

        await refresh?.({ silent: true });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        setError?.(null);
        return true;
      } catch (error: unknown) {
        console.error("[entity-persistence] failed to persist entity", error);
        const message = error instanceof Error ? error.message : "Failed to save entity";
        setError?.(message);
        return false;
      }
    },
    [projectId, refresh, setError, queryClient],
  );

  return { persistEntity };
}
