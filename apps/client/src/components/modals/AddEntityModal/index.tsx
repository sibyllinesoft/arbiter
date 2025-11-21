import { MonacoEditor } from "@/components/Editor/MonacoEditor";
import { MarkdownField, type MarkdownFieldProps } from "@/components/form/MarkdownField";
import Button from "@/design-system/components/Button";
import Input from "@/design-system/components/Input";
import Modal from "@/design-system/components/Modal";
import Select, { type SelectOption } from "@/design-system/components/Select";
import { useTheme } from "@/stores/ui-store";
import type { FieldValue } from "@/types/forms";
import KeyValueEditor, { type KeyValueEntry } from "@amalto/key-value-editor";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";

// Helper to convert markdown links to HTML
const markdownLinkToHtml = (text: string): string => {
  return text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>',
  );
};

import { INPUT_SURFACE_CLASSES, SELECT_DROPDOWN_CLASSES } from "./constants";
import type { AddEntityModalProps } from "./types";
import {
  cloneFieldValue,
  coerceFieldValueToArray,
  coerceFieldValueToString,
  extractListFromValue,
  getDefaultValue,
  getFieldConfig,
  keyValuePairsToMap,
  toKeyValuePairs,
  toSingularLabel,
} from "./utils";

// Re-export utility functions that are used by other components
export { coerceFieldValueToString, coerceFieldValueToArray } from "./utils";

export function AddEntityModal({
  open,
  entityType,
  groupLabel,
  optionCatalog,
  onClose,
  onSubmit,
  initialValues,
  titleOverride,
  descriptionOverride,
  mode = "create",
}: AddEntityModalProps) {
  const { isDark } = useTheme();
  const fields = useMemo(
    () => getFieldConfig(entityType, optionCatalog),
    [entityType, optionCatalog],
  );

  const fieldByName = useMemo(() => {
    const map = new Map();
    for (const field of fields) {
      map.set(field.name, field);
    }
    return map;
  }, [fields]);

  const defaultValues = useMemo(() => {
    const values: Record<string, FieldValue> = {};
    for (const field of fields) {
      values[field.name] = getDefaultValue(field);
    }
    return values;
  }, [fields]);

  const [values, setValues] = useState<Record<string, FieldValue>>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const nextValues: Record<string, FieldValue> = {};
      fields.forEach((field) => {
        const sourceValue = defaultValues[field.name] ?? getDefaultValue(field);
        nextValues[field.name] = cloneFieldValue(sourceValue);
      });
      if (initialValues) {
        Object.entries(initialValues).forEach(([key, rawValue]) => {
          const field = fieldByName.get(key);
          if (!field) return;

          if (field.component === "key-value") {
            nextValues[key] = toKeyValuePairs(rawValue);
            return;
          }

          if (field.multiple) {
            nextValues[key] = coerceFieldValueToArray(rawValue);
          } else {
            const stringValue = coerceFieldValueToString(rawValue);
            nextValues[key] = field.markdown ? stringValue : stringValue.trim();
          }
        });
      }

      setValues(nextValues);
      setErrors({});
    }
  }, [defaultValues, open, fieldByName, initialValues, fields]);

  const singularLabel = useMemo(
    () => toSingularLabel(groupLabel, entityType).toLowerCase(),
    [groupLabel, entityType],
  );

  const formId = `add-entity-${entityType}`;
  const firstField = fields[0]?.name ?? null;

  const toArray = (input: FieldValue | undefined): string[] => coerceFieldValueToArray(input);

  const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  };

  const normalizeForComparison = (targetField: any, value: FieldValue | undefined): string => {
    if (targetField?.component === "key-value") {
      return JSON.stringify(toKeyValuePairs(value));
    }
    if (Array.isArray(value) && !targetField?.multiple) {
      return JSON.stringify(value);
    }
    return coerceFieldValueToString(value);
  };

  const prepareValueForStorage = (field: any, value: FieldValue): FieldValue => {
    if (field?.component === "key-value") {
      return toKeyValuePairs(value);
    }
    return value;
  };

  const handleChange = (name: string, nextValue: FieldValue) => {
    const field = fieldByName.get(name);
    const clearKeys = field?.onChangeClear ?? [];
    const impactedKeys = [name, ...clearKeys];

    setValues((prev) => {
      let nextState = prev;
      let mutated = false;

      const prevValue = prev[name];
      const isMultiple = field?.multiple === true;
      const normalizedNextValue = prepareValueForStorage(field, nextValue);
      const shouldUpdate = isMultiple
        ? !arraysEqual(toArray(prevValue), toArray(normalizedNextValue))
        : normalizeForComparison(field, prevValue) !==
          normalizeForComparison(field, normalizedNextValue);

      if (shouldUpdate) {
        nextState = { ...prev, [name]: normalizedNextValue };
        mutated = true;
      }

      if (clearKeys.length > 0) {
        if (!mutated) {
          nextState = { ...prev };
        }

        for (const key of clearKeys) {
          const targetField = fieldByName.get(key);
          const defaultValue: FieldValue = getDefaultValue(targetField);
          const existingValue = nextState[key];
          const needsReset = targetField?.multiple
            ? !arraysEqual(toArray(existingValue), toArray(defaultValue))
            : normalizeForComparison(targetField, existingValue) !==
              normalizeForComparison(targetField, defaultValue);

          if (needsReset) {
            nextState[key] = cloneFieldValue(defaultValue);
            mutated = true;
          }
        }
      }

      return mutated ? nextState : prev;
    });

    if (impactedKeys.some((key) => errors[key])) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        for (const key of impactedKeys) {
          delete nextErrors[key];
        }
        return nextErrors;
      });
    }
  };

  const toStringValue = (input: FieldValue | undefined): string => coerceFieldValueToString(input);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors: Record<string, string> = {};
    const payloadValues: Record<string, FieldValue> = {};

    for (const field of fields) {
      const rawValue = values[field.name];

      if (field.component === "key-value") {
        const pairs = toKeyValuePairs(rawValue);
        if (field.required && pairs.length === 0) {
          validationErrors[field.name] = `${field.label} is required`;
        }
        payloadValues[field.name] = pairs;
        continue;
      }

      if (field.multiple) {
        const normalizedValues = toArray(rawValue)
          .map((item) => item.trim())
          .filter(Boolean);

        if (field.required && normalizedValues.length === 0) {
          validationErrors[field.name] = `${field.label} is required`;
        }

        if (normalizedValues.length > 0 || field.required) {
          payloadValues[field.name] = normalizedValues;
        }
      } else {
        const stringValue = toStringValue(rawValue);
        const trimmedValue = stringValue.trim();
        const useRawValue = field.markdown === true;

        if (field.required && trimmedValue.length === 0) {
          validationErrors[field.name] = `${field.label} is required`;
        }

        if ((useRawValue ? stringValue.length > 0 : trimmedValue.length > 0) || field.required) {
          payloadValues[field.name] = useRawValue ? stringValue : trimmedValue;
        }
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const normalizeLists = (keys: string[]) => {
      keys.forEach((key) => {
        if (key in payloadValues) {
          payloadValues[key] = extractListFromValue(payloadValues[key]);
        }
      });
    };

    if (entityType === "module") {
      normalizeLists(["deliverables", "flowSteps", "schemaTables"]);
    } else if (entityType === "infrastructure") {
      normalizeLists(["environmentSecrets", "observabilityAlerts"]);
    }

    if (
      entityType === "service" &&
      Object.prototype.hasOwnProperty.call(payloadValues, "environmentVariables")
    ) {
      const envPairs = toKeyValuePairs(payloadValues.environmentVariables);
      const envMap = keyValuePairsToMap(envPairs);
      payloadValues.environment = Object.keys(envMap).length > 0 ? envMap : null;
      delete payloadValues.environmentVariables;
    }

    onSubmit?.({ entityType, values: payloadValues });
    onClose();
  };

  const defaultTitle =
    mode === "edit"
      ? `Update ${toSingularLabel(groupLabel, entityType)}`
      : `Add ${toSingularLabel(groupLabel, entityType)}`;
  const defaultDescription =
    mode === "edit"
      ? `Review and update this ${singularLabel}.`
      : `Provide the details needed to add a new ${singularLabel}.`;

  const modalTitle = titleOverride ?? defaultTitle;
  const modalDescription = descriptionOverride ?? defaultDescription;
  const submitVerb = mode === "edit" ? "Update" : "Add";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      size="3xl"
      showDefaultFooter={false}
      className="!max-w-[960px] bg-white text-graphite-900 dark:bg-graphite-900 dark:text-graphite-50 border border-gray-200 dark:border-graphite-700 shadow-2xl dark:[&_label]:text-graphite-100 dark:[&_p]:text-graphite-300 dark:[&_h2]:text-graphite-50"
      containerClassName="px-4 py-6 sm:px-6"
      {...(firstField ? { initialFocus: `#${formId}-${firstField}` } : {})}
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4"
      >
        {fields.map((field) => {
          const fieldId = `${formId}-${field.name}`;
          const rawValue = values[field.name];
          const errorMessage = errors[field.name];
          const shouldRenderMarkdown =
            field.type === "textarea" &&
            (field.markdown || (entityType === "epic" && field.name === "description"));
          const resolvedOptions =
            field.type === "select"
              ? field.resolveOptions
                ? field.resolveOptions(values)
                : (field.options ?? [])
              : [];

          if (field.isVisible && !field.isVisible(values, resolvedOptions)) {
            return null;
          }

          if (field.component === "key-value") {
            const pairs = toKeyValuePairs(rawValue);
            return (
              <div key={field.name} className="col-span-full space-y-1">
                <label
                  className="block text-sm font-medium text-graphite-700 dark:text-graphite-50"
                  htmlFor={fieldId}
                >
                  {field.label}
                </label>
                <KeyValueEditor
                  pairs={pairs}
                  onChange={(nextPairs: KeyValueEntry[]) => handleChange(field.name, nextPairs)}
                  {...(field.keyPlaceholder !== undefined
                    ? { keyPlaceholder: field.keyPlaceholder }
                    : {})}
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

          if (field.component === "monaco") {
            const currentValue = toStringValue(rawValue);
            return (
              <div key={field.name} className="col-span-1 md:col-span-2 lg:col-span-3 space-y-1">
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
                    onChange={(value) => handleChange(field.name, value)}
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

          if (shouldRenderMarkdown) {
            const markdownProps: MarkdownFieldProps = {
              id: fieldId,
              label: field.label,
              value: toStringValue(rawValue),
              onChange: (next: string) => handleChange(field.name, next),
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
              <div key={field.name} className="col-span-1 md:col-span-2 lg:col-span-3">
                <MarkdownField {...markdownProps} />
              </div>
            );
          }

          if (field.type === "textarea") {
            return (
              <div key={field.name} className="col-span-1 md:col-span-2 lg:col-span-3 space-y-1">
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
                  onChange={(event) => handleChange(field.name, event.target.value)}
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

          if (field.type === "select") {
            const optionValues = Array.isArray(resolvedOptions) ? resolvedOptions : [];
            const seen = new Set<string>();
            const selectOptions: SelectOption[] = [];

            optionValues.forEach((option) => {
              if (typeof option === "string") {
                const trimmed = option.trim();
                if (!trimmed) return;
                const dedupeKey = trimmed.toLowerCase();
                if (seen.has(dedupeKey)) return;
                seen.add(dedupeKey);
                selectOptions.push({ value: trimmed, label: trimmed });
              } else if (option && typeof option.value === "string") {
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
                if (option.disabled !== undefined) {
                  normalizedOption.disabled = option.disabled;
                }
                if (option.icon !== undefined) {
                  normalizedOption.icon = option.icon;
                }
                if (typeof option.group === "string" && option.group.trim()) {
                  normalizedOption.group = option.group.trim();
                }
                selectOptions.push(normalizedOption);
              }
            });

            const isMultiple = field.multiple === true;
            const selectValue = isMultiple ? toArray(rawValue) : toStringValue(rawValue).trim();

            return (
              <div key={field.name} className="col-span-1 lg:col-span-2 space-y-1">
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
                    field.placeholder ||
                    (isMultiple ? "Select one or more options" : "Select an option")
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
                      handleChange(field.name, normalized);
                    } else {
                      const normalized = Array.isArray(nextValue)
                        ? (nextValue[0] ?? "")
                        : ((nextValue as string | undefined) ?? "");
                      handleChange(field.name, normalized);
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

          const inputProps = {
            id: fieldId,
            label: field.label,
            placeholder: field.placeholder,
            required: field.required,
            value: toStringValue(rawValue),
            onChange: (event: ChangeEvent<HTMLInputElement>) =>
              handleChange(field.name, event.target.value),
            className: INPUT_SURFACE_CLASSES,
          };

          return (
            <div key={field.name} className="col-span-1 lg:col-span-2">
              <Input {...inputProps} {...(errorMessage ? { error: errorMessage } : {})} />
            </div>
          );
        })}

        <div className="col-span-full flex items-center justify-end pt-2">
          <Button type="submit">
            {submitVerb} {toSingularLabel(groupLabel, entityType)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AddEntityModal;
