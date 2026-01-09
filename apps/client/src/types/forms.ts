import type { SelectOption } from "@/design-system/components/Select";
import type { KeyValueEntry } from "@amalto/key-value-editor";

export interface GroupIssueOption {
  id: string;
  name: string;
  groupId?: string;
  groupName?: string;
  status?: string;
  completed?: boolean;
}

export interface IssueGroupOption {
  id: string;
  name: string;
}

export interface UiOptionCatalog {
  frontendFrameworks?: string[];
  serviceLanguages?: string[];
  serviceFrameworks?: Record<string, string[]>;
  databaseEngines?: string[];
  infrastructureScopes?: string[];
  groupIssueOptions?: GroupIssueOption[];
  issueGroupOptions?: IssueGroupOption[];
}

export const DEFAULT_UI_OPTION_CATALOG: UiOptionCatalog = {
  groupIssueOptions: [],
  issueGroupOptions: [],
};

export type FieldValue =
  | string
  | string[]
  | number
  | boolean
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | KeyValueEntry[]
  | null;

export interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  description?: string;
  multiple?: boolean;
  options?: Array<string | SelectOption>;
  resolveOptions?: (values: Record<string, FieldValue>) => Array<string | SelectOption>;
  isVisible?: (
    values: Record<string, FieldValue>,
    resolvedOptions: Array<string | SelectOption>,
  ) => boolean;
  onChangeClear?: string[];
  markdown?: boolean;
  component?: "key-value" | "monaco";
  language?: string;
  defaultValue?: FieldValue;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}
