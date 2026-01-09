import type { FieldValue, UiOptionCatalog } from "@/types/forms";

export interface AddEntityModalProps {
  open: boolean;
  entityType: string;
  groupLabel: string;
  optionCatalog: UiOptionCatalog;
  onClose: () => void;
  onSubmit?: (payload: { entityType: string; values: Record<string, FieldValue> }) => void;
  initialValues?: Record<string, FieldValue> | undefined;
  titleOverride?: string | undefined;
  descriptionOverride?: string | undefined;
  mode?: "create" | "edit";
  loading?: boolean;
}
