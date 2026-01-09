/**
 * Field renderer components for AddEntityModal.
 * Each component handles rendering a specific field type with its validation and styling.
 */
import { MonacoEditor } from "@/components/Editor/MonacoEditor";
import { MarkdownField, type MarkdownFieldProps } from "@/components/form/MarkdownField";
import Input from "@/design-system/components/Input";
import Select, { type SelectOption } from "@/design-system/components/Select";
import type { FieldConfig, FieldValue } from "@/types/forms";
import KeyValueEditor, { type KeyValueEntry } from "@amalto/key-value-editor";
import type { ChangeEvent } from "react";
import { INPUT_SURFACE_CLASSES, SELECT_DROPDOWN_CLASSES } from "./constants";
import { coerceFieldValueToArray, coerceFieldValueToString, toKeyValuePairs } from "./utils";

/** Helper to convert markdown links to HTML */
export const markdownLinkToHtml = (text: string): string => {
  return text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>',
  );
};

/** Props shared by all field renderers */
export interface FieldRendererProps {
  field: FieldConfig;
  fieldId: string;
  rawValue: FieldValue | undefined;
  errorMessage: string | undefined;
  onChange: (name: string, value: FieldValue) => void;
}

/** Props for select field renderer */
export interface SelectFieldRendererProps extends FieldRendererProps {
  selectOptions: SelectOption[];
}

/** Normalize a select option and add to options array if valid and unique */
function processSelectOption(
  option: string | SelectOption,
  seen: Set<string>,
  selectOptions: SelectOption[],
): void {
  if (typeof option === "string") {
    const trimmed = option.trim();
    if (!trimmed) return;
    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    selectOptions.push({ value: trimmed, label: trimmed });
    return;
  }
  if (!option || typeof option.value !== "string") return;

  const trimmedValue = option.value.trim();
  if (!trimmedValue) return;

  const dedupeKey = trimmedValue.toLowerCase();
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);

  const normalizedOption: SelectOption = {
    value: trimmedValue,
    label: option.label?.trim() || trimmedValue,
  };
  if (typeof option.description === "string" && option.description.trim()) {
    normalizedOption.description = option.description.trim();
  }
  if (option.disabled !== undefined) normalizedOption.disabled = option.disabled;
  if (option.icon !== undefined) normalizedOption.icon = option.icon;
  if (typeof option.group === "string" && option.group.trim()) {
    normalizedOption.group = option.group.trim();
  }
  selectOptions.push(normalizedOption);
}

/** Convert raw options array to normalized SelectOption array */
export function normalizeSelectOptions(optionValues: unknown[]): SelectOption[] {
  const seen = new Set<string>();
  const selectOptions: SelectOption[] = [];
  optionValues.forEach((option) => {
    processSelectOption(option as string | SelectOption, seen, selectOptions);
  });
  return selectOptions;
}

const toArray = (input: FieldValue | undefined): string[] => coerceFieldValueToArray(input);
const toStringValue = (input: FieldValue | undefined): string => coerceFieldValueToString(input);

/** Render a select field */
export function SelectFieldRenderer({
  field,
  fieldId,
  rawValue,
  errorMessage,
  onChange,
  selectOptions,
}: SelectFieldRendererProps) {
  const isMultiple = field.multiple === true;
  const selectValue = isMultiple ? toArray(rawValue) : toStringValue(rawValue).trim();

  return (
    <div className="col-span-1 lg:col-span-2 space-y-1">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-graphite-700 dark:text-graphite-50"
      >
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <Select
        key={field.name}
        label={field.label}
        hideLabel
        {...(isMultiple ? { multiple: true } : {})}
        placeholder={
          field.placeholder || (isMultiple ? "Select one or more options" : "Select an option")
        }
        {...(isMultiple
          ? { value: selectValue as string[] }
          : selectValue
            ? { value: selectValue as string }
            : {})}
        onChange={(nextValue) => {
          if (isMultiple) {
            const normalized = Array.isArray(nextValue)
              ? nextValue
              : nextValue
                ? [String(nextValue)]
                : [];
            onChange(field.name, normalized);
          } else {
            const normalized = Array.isArray(nextValue)
              ? (nextValue[0] ?? "")
              : ((nextValue as string | undefined) ?? "");
            onChange(field.name, normalized);
          }
        }}
        options={selectOptions}
        disabled={selectOptions.length === 0}
        fullWidth
        className={INPUT_SURFACE_CLASSES}
        dropdownClassName={SELECT_DROPDOWN_CLASSES}
        {...(field.required ? { required: true } : {})}
        {...(errorMessage ? { error: errorMessage } : {})}
      />
      {field.description && (
        <p
          className="text-xs text-graphite-500 dark:text-graphite-300"
          dangerouslySetInnerHTML={{ __html: markdownLinkToHtml(field.description) }}
        />
      )}
    </div>
  );
}

/** Render a text input field */
export function TextInputFieldRenderer({
  field,
  fieldId,
  rawValue,
  errorMessage,
  onChange,
}: FieldRendererProps) {
  const inputProps = {
    id: fieldId,
    label: field.label,
    placeholder: field.placeholder,
    required: field.required,
    value: toStringValue(rawValue),
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(field.name, event.target.value),
    className: INPUT_SURFACE_CLASSES,
  };

  return (
    <div className="col-span-1 lg:col-span-2">
      <Input {...inputProps} {...(errorMessage ? { error: errorMessage } : {})} />
    </div>
  );
}

/** Props for key-value editor renderer */
export interface KeyValueFieldRendererProps extends FieldRendererProps {}

/** Render a key-value editor field */
export function KeyValueFieldRenderer({
  field,
  fieldId,
  rawValue,
  errorMessage,
  onChange,
}: KeyValueFieldRendererProps) {
  const pairs = toKeyValuePairs(rawValue);

  return (
    <div className="space-y-1">
      <label
        className="block text-sm font-medium text-graphite-700 dark:text-graphite-50"
        htmlFor={fieldId}
      >
        {field.label}
      </label>
      <KeyValueEditor
        pairs={pairs}
        onChange={(nextPairs: KeyValueEntry[]) => onChange(field.name, nextPairs)}
        {...(field.keyPlaceholder !== undefined ? { keyPlaceholder: field.keyPlaceholder } : {})}
        {...(field.valuePlaceholder !== undefined
          ? { valuePlaceholder: field.valuePlaceholder }
          : {})}
        {...(field.addLabel !== undefined ? { addLabel: field.addLabel } : {})}
      />
      {field.description && (
        <p
          className="text-xs text-graphite-500 dark:text-graphite-300"
          dangerouslySetInnerHTML={{ __html: markdownLinkToHtml(field.description) }}
        />
      )}
      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
    </div>
  );
}

/** Props for Monaco editor field renderer */
export interface MonacoFieldRendererProps extends FieldRendererProps {
  isDark: boolean;
}

/** Render a Monaco editor field */
export function MonacoFieldRenderer({
  field,
  fieldId,
  rawValue,
  errorMessage,
  onChange,
  isDark,
}: MonacoFieldRendererProps) {
  const currentValue = toStringValue(rawValue);

  return (
    <div className="space-y-1">
      <label
        className="block text-sm font-medium text-graphite-700 dark:text-graphite-50"
        htmlFor={fieldId}
      >
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="h-[200px] border border-gray-300 dark:border-graphite-700 rounded-md overflow-hidden">
        <MonacoEditor
          value={currentValue || ""}
          onChange={(value) => onChange(field.name, value)}
          language={field.language || "cue"}
          theme={isDark ? "vs-dark" : "vs"}
          options={{
            minimap: { enabled: false },
            lineNumbers: "off",
            lineNumbersMinChars: 0,
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 0,
            lineNumbersWidth: 0,
            scrollBeyondLastLine: false,
            fontSize: 13,
            wordWrap: "on",
            readOnly: false,
          }}
        />
      </div>
      {field.description && (
        <p
          className="text-xs text-graphite-500 dark:text-graphite-300"
          dangerouslySetInnerHTML={{ __html: markdownLinkToHtml(field.description) }}
        />
      )}
      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
    </div>
  );
}

/** Render a markdown field */
export function MarkdownFieldRenderer({
  field,
  fieldId,
  rawValue,
  errorMessage,
  onChange,
}: FieldRendererProps) {
  const markdownProps: MarkdownFieldProps = {
    id: fieldId,
    label: field.label,
    value: toStringValue(rawValue),
    onChange: (next: string) => onChange(field.name, next),
  };

  if (field.placeholder) {
    markdownProps.placeholder = field.placeholder;
  }
  if (field.description) {
    markdownProps.description = field.description;
  }
  if (field.required) {
    markdownProps.required = true;
  }
  if (errorMessage) {
    markdownProps.error = errorMessage;
  }

  return (
    <div>
      <MarkdownField {...markdownProps} />
    </div>
  );
}

/** Render a textarea field */
export function TextareaFieldRenderer({
  field,
  fieldId,
  rawValue,
  errorMessage,
  onChange,
}: FieldRendererProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-graphite-700 dark:text-graphite-50"
      >
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        id={fieldId}
        name={field.name}
        placeholder={field.placeholder}
        value={toStringValue(rawValue)}
        onChange={(event) => onChange(field.name, event.target.value)}
        className="block w-full rounded-md border border-gray-300 dark:border-graphite-700 bg-white dark:bg-graphite-950 text-sm text-graphite-900 dark:text-graphite-50 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:border-blue-400 dark:focus:ring-blue-500/40 min-h-[120px] resize-vertical"
      />
      {field.description && (
        <p
          className="text-xs text-graphite-500 dark:text-graphite-300"
          dangerouslySetInnerHTML={{ __html: markdownLinkToHtml(field.description) }}
        />
      )}
      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
    </div>
  );
}
