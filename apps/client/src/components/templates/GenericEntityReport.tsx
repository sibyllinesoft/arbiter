import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import React, { useMemo } from "react";

import AddEntityModal from "@/components/modals/AddEntityModal";
import type { FieldValue, UiOptionCatalog } from "@/components/modals/entityTypes";
import { EntityCatalog } from "@/components/templates/EntityCatalog";
import { useEntityCrud } from "@/hooks/useEntityCrud";

interface GenericEntityReportProps<TItem extends { name: string }> {
  title: string;
  description?: string;
  icon: LucideIcon;
  entityType: string;
  projectId: string | null;
  items: TItem[];
  optionCatalog: UiOptionCatalog;
  emptyMessage: string;
  renderCard: (item: TItem, helpers: { openEdit: (item: TItem) => void }) => React.ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  className?: string;
  refresh?: (options?: { silent?: boolean }) => Promise<void>;
  buildInitialValues?: (item: TItem) => Record<string, FieldValue>;
  addLabel?: string;
  successMessages?: {
    create?: string;
    edit?: string;
  };
}

export function GenericEntityReport<TItem extends { name: string }>({
  title,
  description,
  icon,
  entityType,
  projectId,
  items,
  optionCatalog,
  emptyMessage,
  renderCard,
  isLoading = false,
  isError = false,
  errorMessage,
  className,
  refresh,
  buildInitialValues,
  addLabel = "Add",
  successMessages,
}: GenericEntityReportProps<TItem>) {
  const safeClassName = className ?? "";
  const safeSuccessMessages = successMessages ?? {};

  const {
    state,
    handleSubmit,
    openCreate,
    openEdit,
    isSubmitting,
    close: closeCrudModal,
  } = useEntityCrud({
    projectId,
    entityType,
    refresh: refresh ?? (async () => {}),
    successMessages: safeSuccessMessages,
    onError: () => undefined,
  });

  const addAction = useMemo(
    () =>
      ({
        label: addLabel,
        onAdd: () => openCreate(),
        disabled: !projectId || isSubmitting,
        loading: isSubmitting,
      }) as const,
    [addLabel, isSubmitting, openCreate, projectId],
  );

  if (isError) {
    return (
      <div
        className={clsx(
          "flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950",
          className,
        )}
      >
        <div className="flex flex-1 items-center justify-center text-center text-sm text-rose-600 dark:text-rose-400">
          {errorMessage ?? "Unable to load data."}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden", safeClassName)}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-50 dark:bg-graphite-950">
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            <EntityCatalog
              title={title}
              description={description ?? ""}
              icon={icon}
              items={items}
              isLoading={isLoading}
              emptyMessage={emptyMessage}
              addAction={addAction}
              renderCard={(item) => renderCard(item, { openEdit: (i) => openEditForItem(i) })}
            />
          </div>
        </div>
      </div>

      <AddEntityModal
        open={state.open}
        entityType={entityType}
        groupLabel={title}
        optionCatalog={optionCatalog}
        onClose={closeCrudModal}
        mode={state.mode}
        initialValues={state.initialValues}
        titleOverride={state.titleOverride}
        onSubmit={handleSubmit}
        loading={isSubmitting}
      />
    </>
  );

  function openEditForItem(item: TItem) {
    const initialValues = buildInitialValues ? buildInitialValues(item) : {};
    openEdit({ initialValues });
  }
}

export default GenericEntityReport;
