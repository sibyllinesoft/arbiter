import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { DEFAULT_UI_OPTION_CATALOG, type UiOptionCatalog } from "@/components/modals/entityTypes";
import { useResolvedSpec, useUiOptionCatalog } from "@/hooks/api-hooks";

export interface CatalogState<TResolved = unknown> {
  data: TResolved | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  uiOptionCatalog: UiOptionCatalog;
  isAddOpen: boolean;
  openAdd: () => void;
  closeAdd: () => void;
}

export const useCatalog = <TResolved = unknown>(projectId?: string): CatalogState<TResolved> => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useResolvedSpec(projectId);
  const { data: uiOptions } = useUiOptionCatalog();

  const uiOptionCatalog = useMemo<UiOptionCatalog>(
    () => ({ ...DEFAULT_UI_OPTION_CATALOG, ...(uiOptions ?? {}) }),
    [uiOptions],
  );

  const refresh = useCallback(
    async (_options: { silent?: boolean } = {}) => {
      if (!projectId) return;
      await queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
    },
    [projectId, queryClient],
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const openAdd = useCallback(() => setIsAddOpen(true), []);
  const closeAdd = useCallback(() => setIsAddOpen(false), []);

  return {
    data: data as TResolved | undefined,
    isLoading,
    isError,
    error,
    refresh,
    uiOptionCatalog,
    isAddOpen,
    openAdd,
    closeAdd,
  };
};
