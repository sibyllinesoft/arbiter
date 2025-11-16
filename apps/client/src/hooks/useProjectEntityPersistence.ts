import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { FieldValue } from "@/components/modals/entityTypes";
import { apiService } from "@/services/api";

interface UseProjectEntityPersistenceOptions {
  projectId: string | null;
  refresh?: (options?: { silent?: boolean }) => Promise<void>;
  setError?: (message: string | null) => void;
}

interface PersistEntityArgs {
  entityType: string;
  values: Record<string, FieldValue>;
  artifactId?: string | null;
  draftIdentifier?: string | null;
}

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
      if (!projectId) {
        return false;
      }

      const valuesWithContext: Record<string, FieldValue> = { ...values };

      const incomingId =
        typeof valuesWithContext.id === "string" ? valuesWithContext.id.trim() : "";
      const incomingSlug =
        typeof valuesWithContext.slug === "string" ? valuesWithContext.slug.trim() : "";
      const resolvedIdentifier =
        incomingId ||
        incomingSlug ||
        (typeof draftIdentifier === "string" ? draftIdentifier.trim() : "");

      if (resolvedIdentifier) {
        const normalizedIdentifier = resolvedIdentifier
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .trim();
        const finalIdentifier =
          normalizedIdentifier.length > 0 ? normalizedIdentifier : resolvedIdentifier;
        valuesWithContext.id = finalIdentifier;
        valuesWithContext.slug = finalIdentifier;
      }

      try {
        if (artifactId) {
          await apiService.updateProjectEntity(projectId, artifactId, {
            type: entityType,
            values: valuesWithContext,
          });
        } else {
          await apiService.createProjectEntity(projectId, {
            type: entityType,
            values: valuesWithContext,
          });
        }

        await refresh?.({ silent: true });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        setError?.(null);
        return true;
      } catch (err: any) {
        console.error("[entity-persistence] failed to persist entity", err);
        setError?.(err?.message || "Failed to save entity");
        return false;
      }
    },
    [projectId, refresh, setError, queryClient],
  );

  return { persistEntity };
}
