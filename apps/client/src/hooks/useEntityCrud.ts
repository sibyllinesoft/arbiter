/**
 * Entity CRUD operations hook.
 * Manages create/edit modal state and entity persistence.
 */
import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";

import type { FieldValue } from "@/components/modals/entityTypes";
import { useProjectEntityPersistence } from "@/hooks/useProjectEntityPersistence";

/** Mode for CRUD operations */
type CrudMode = "create" | "edit";

/** Options for the entity CRUD hook */
interface UseEntityCrudOptions {
  projectId: string | null;
  entityType: string;
  refresh?: (options?: { silent?: boolean }) => Promise<void>;
  successMessages?: Partial<Record<CrudMode, string>>;
  onError?: (message: string | null) => void;
}

/** Internal state for CRUD modal */
interface CrudState {
  open: boolean;
  mode: CrudMode;
  initialValues: Record<string, FieldValue>;
  artifactId: string | null;
  draftIdentifier: string | null;
  titleOverride: string;
  entityTypeOverride: string;
}

/**
 * Hook for managing entity CRUD operations.
 * Provides modal state management and persistence handlers.
 * @param options - CRUD configuration options
 * @returns CRUD state and action handlers
 */
export function useEntityCrud({
  projectId,
  entityType,
  refresh,
  successMessages,
  onError,
}: UseEntityCrudOptions) {
  const [state, setState] = useState<CrudState>({
    open: false,
    mode: "create",
    initialValues: {},
    artifactId: null,
    draftIdentifier: null,
    titleOverride: "",
    entityTypeOverride: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { persistEntity } = useProjectEntityPersistence({
    projectId,
    refresh: refresh ?? (async () => {}),
    setError: onError ?? (() => undefined),
  });

  const openCreate = useCallback((config: Partial<Omit<CrudState, "mode" | "open">> = {}) => {
    setState({
      open: true,
      mode: "create",
      initialValues: config.initialValues ?? {},
      artifactId: config.artifactId ?? null,
      draftIdentifier: config.draftIdentifier ?? null,
      titleOverride: config.titleOverride ?? "",
      entityTypeOverride: config.entityTypeOverride ?? "",
    });
  }, []);

  const openEdit = useCallback((config: Partial<Omit<CrudState, "mode" | "open">> = {}) => {
    setState({
      open: true,
      mode: "edit",
      initialValues: config.initialValues ?? {},
      artifactId: config.artifactId ?? null,
      draftIdentifier: config.draftIdentifier ?? null,
      titleOverride: config.titleOverride ?? "",
      entityTypeOverride: config.entityTypeOverride ?? "",
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleSubmit = useCallback(
    async (payload: { entityType?: string; values: Record<string, FieldValue> }) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      const success = await persistEntity({
        entityType: payload.entityType ?? (state.entityTypeOverride || entityType),
        values: payload.values,
        artifactId: state.artifactId ?? null,
        draftIdentifier: state.draftIdentifier ?? null,
      });
      setIsSubmitting(false);

      if (success) {
        const message =
          (state.mode === "edit" ? successMessages?.edit : successMessages?.create) ??
          "Saved successfully";
        toast.success(message);
        close();
      }
    },
    [
      close,
      entityType,
      isSubmitting,
      persistEntity,
      state.artifactId,
      state.draftIdentifier,
      state.entityTypeOverride,
      state.mode,
      successMessages?.create,
      successMessages?.edit,
    ],
  );

  return useMemo(
    () => ({
      state,
      isSubmitting,
      openCreate,
      openEdit,
      close,
      handleSubmit,
    }),
    [close, handleSubmit, isSubmitting, openCreate, openEdit, state],
  );
}
