import Button from "@/design-system/components/Button";
import Modal from "@/design-system/components/Modal";
import { useTheme } from "@/stores/ui-store";
import type { FieldConfig, FieldValue } from "@/types/forms";
import { useEffect, useMemo, useState } from "react";

import {
  KeyValueFieldRenderer,
  MarkdownFieldRenderer,
  MonacoFieldRenderer,
  SelectFieldRenderer,
  TextInputFieldRenderer,
  TextareaFieldRenderer,
  normalizeSelectOptions,
} from "./FieldRenderers";
import type { AddEntityModalProps } from "./types";
import {
  cloneFieldValue,
  coerceFieldValueToArray,
  coerceFieldValueToString,
  extractListFromValue,
  getDefaultValue,
  getFieldConfig,
  hasValueChanged,
  keyValuePairsToMap,
  prepareValueForStorage,
  toKeyValuePairs,
  toSingularLabel,
  validateField,
} from "./utils";

/** Get resolved options for a field */
function getResolvedOptions(field: FieldConfig, values: Record<string, FieldValue>): unknown[] {
  if (field.type !== "select") return [];
  return field.resolveOptions ? field.resolveOptions(values) : (field.options ?? []);
}

/** Check if a field should be visible */
function isFieldVisible(
  field: FieldConfig,
  values: Record<string, FieldValue>,
  resolvedOptions: unknown[],
): boolean {
  if (!field.isVisible) return true;
  return field.isVisible(values, resolvedOptions);
}

/** Render a regular (non-editor) field */
function renderRegularField(
  field: FieldConfig,
  formId: string,
  values: Record<string, FieldValue>,
  errors: Record<string, string>,
  handleChange: (name: string, value: FieldValue) => void,
): React.ReactNode {
  const fieldId = `${formId}-${field.name}`;
  const rawValue = values[field.name];
  const errorMessage = errors[field.name];
  const resolvedOptions = getResolvedOptions(field, values);

  if (!isFieldVisible(field, values, resolvedOptions)) {
    return null;
  }

  if (field.type === "select") {
    const optionValues = Array.isArray(resolvedOptions) ? resolvedOptions : [];
    const selectOptions = normalizeSelectOptions(optionValues);

    return (
      <SelectFieldRenderer
        key={field.name}
        field={field}
        fieldId={fieldId}
        rawValue={rawValue}
        errorMessage={errorMessage}
        onChange={handleChange}
        selectOptions={selectOptions}
      />
    );
  }

  return (
    <TextInputFieldRenderer
      key={field.name}
      field={field}
      fieldId={fieldId}
      rawValue={rawValue}
      errorMessage={errorMessage}
      onChange={handleChange}
    />
  );
}

/** Render an editor field (monaco, key-value, markdown, textarea) */
function renderEditorField(
  field: FieldConfig,
  formId: string,
  values: Record<string, FieldValue>,
  errors: Record<string, string>,
  handleChange: (name: string, value: FieldValue) => void,
  entityType: string,
  isDark: boolean,
): React.ReactNode {
  const fieldId = `${formId}-${field.name}`;
  const rawValue = values[field.name];
  const errorMessage = errors[field.name];
  const resolvedOptions = getResolvedOptions(field, values);

  if (!isFieldVisible(field, values, resolvedOptions)) {
    return null;
  }

  if (field.component === "key-value") {
    return (
      <KeyValueFieldRenderer
        key={field.name}
        field={field}
        fieldId={fieldId}
        rawValue={rawValue}
        errorMessage={errorMessage}
        onChange={handleChange}
      />
    );
  }

  if (field.component === "monaco") {
    return (
      <MonacoFieldRenderer
        key={field.name}
        field={field}
        fieldId={fieldId}
        rawValue={rawValue}
        errorMessage={errorMessage}
        onChange={handleChange}
        isDark={isDark}
      />
    );
  }

  const shouldRenderMarkdown =
    field.type === "textarea" &&
    (field.markdown || (entityType === "group" && field.name === "description"));

  if (shouldRenderMarkdown) {
    return (
      <MarkdownFieldRenderer
        key={field.name}
        field={field}
        fieldId={fieldId}
        rawValue={rawValue}
        errorMessage={errorMessage}
        onChange={handleChange}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <TextareaFieldRenderer
        key={field.name}
        field={field}
        fieldId={fieldId}
        rawValue={rawValue}
        errorMessage={errorMessage}
        onChange={handleChange}
      />
    );
  }

  return null;
}

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
  loading = false,
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

  const handleChange = (name: string, nextValue: FieldValue) => {
    const field = fieldByName.get(name);
    const clearKeys = field?.onChangeClear ?? [];
    const impactedKeys = [name, ...clearKeys];

    setValues((prev) => {
      let nextState = prev;
      let mutated = false;

      const normalizedNextValue = prepareValueForStorage(field, nextValue);
      if (hasValueChanged(field, prev[name], normalizedNextValue)) {
        nextState = { ...prev, [name]: normalizedNextValue };
        mutated = true;
      }

      if (clearKeys.length > 0) {
        if (!mutated) nextState = { ...prev };

        for (const key of clearKeys) {
          const targetField = fieldByName.get(key);
          const defaultValue: FieldValue = getDefaultValue(targetField);
          if (hasValueChanged(targetField, nextState[key], defaultValue)) {
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

  const validateAndBuildPayload = () => {
    const validationErrors: Record<string, string> = {};
    const payloadValues: Record<string, FieldValue> = {};

    for (const field of fields) {
      const { error, payload } = validateField(field, values[field.name]);
      if (error) {
        validationErrors[field.name] = error;
      }
      if (payload !== null) {
        payloadValues[field.name] = payload;
      }
    }

    return { validationErrors, payloadValues };
  };

  const normalizePayloadLists = (payloadValues: Record<string, FieldValue>) => {
    const normalizeLists = (keys: string[]) => {
      keys.forEach((key) => {
        if (key in payloadValues) {
          payloadValues[key] = extractListFromValue(payloadValues[key]);
        }
      });
    };

    if (entityType === "package") {
      normalizeLists(["deliverables", "flowSteps", "schemaTables"]);
    } else if (entityType === "infrastructure") {
      normalizeLists(["environmentSecrets", "observabilityAlerts"]);
    }
  };

  const normalizeEnvironmentVariables = (payloadValues: Record<string, FieldValue>) => {
    if (
      entityType === "service" &&
      Object.prototype.hasOwnProperty.call(payloadValues, "environmentVariables")
    ) {
      const envPairs = toKeyValuePairs(payloadValues.environmentVariables);
      const envMap = keyValuePairsToMap(envPairs);
      payloadValues.environment = Object.keys(envMap).length > 0 ? envMap : null;
      delete payloadValues.environmentVariables;
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { validationErrors, payloadValues } = validateAndBuildPayload();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    normalizePayloadLists(payloadValues);
    normalizeEnvironmentVariables(payloadValues);

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

  // Split fields into regular inputs and large editor inputs
  const { regularFields, editorFields } = useMemo(() => {
    const regular: typeof fields = [];
    const editor: typeof fields = [];

    for (const field of fields) {
      const isLargeEditor =
        field.component === "monaco" ||
        field.component === "key-value" ||
        field.markdown ||
        (entityType === "group" && field.name === "description");

      if (isLargeEditor) {
        editor.push(field);
      } else {
        regular.push(field);
      }
    }

    return { regularFields: regular, editorFields: editor };
  }, [fields, entityType]);

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
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        {/* Regular input fields section */}
        {regularFields.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {regularFields.map((field) =>
              renderRegularField(field, formId, values, errors, handleChange),
            )}
          </div>
        )}

        {/* Large editor fields section */}
        {editorFields.length > 0 && (
          <div className="space-y-4">
            {editorFields.map((field) =>
              renderEditorField(field, formId, values, errors, handleChange, entityType, isDark),
            )}
          </div>
        )}

        {/* Submit button */}
        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={loading} loading={loading}>
            {submitVerb} {toSingularLabel(groupLabel, entityType)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AddEntityModal;
