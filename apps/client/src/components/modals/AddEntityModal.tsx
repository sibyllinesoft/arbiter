/* eslint-disable react-refresh/only-export-components */
import { MarkdownField, type MarkdownFieldProps } from "@/components/form/MarkdownField";
import Button from "@/design-system/components/Button";
import Input from "@/design-system/components/Input";
import Modal from "@/design-system/components/Modal";
import Select, { type SelectOption } from "@/design-system/components/Select";
import { parseEnvironmentText } from "@/utils/environment";
import KeyValueEditor, { type KeyValueEntry } from "@amalto/key-value-editor";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_UI_OPTION_CATALOG,
  type EpicTaskOption,
  type FieldConfig,
  type FieldValue,
  type TaskEpicOption,
  type UiOptionCatalog,
} from "./entityTypes";
import { buildServiceFieldConfig } from "./serviceFields";

const FIELD_RECORD_KEYS = ["value", "id", "name", "label", "slug", "key"] as const;

const INPUT_SURFACE_CLASSES =
  "bg-white dark:bg-graphite-950 text-graphite-900 dark:text-graphite-50 border border-gray-300 dark:border-graphite-700 hover:border-graphite-400 dark:hover:border-graphite-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const SELECT_DROPDOWN_CLASSES =
  "bg-white dark:bg-graphite-950 text-graphite-900 dark:text-graphite-50 border border-gray-200 dark:border-graphite-700";

const extractRecordString = (record: Record<string, unknown> | undefined | null): string => {
  if (!record) return "";
  for (const key of FIELD_RECORD_KEYS) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return "";
};

export const coerceFieldValueToString = (input: FieldValue | undefined): string => {
  if (input === null || input === undefined) {
    return "";
  }

  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }

  if (Array.isArray(input)) {
    for (const entry of input as unknown[]) {
      const normalized = coerceFieldValueToString(entry as FieldValue);
      if (normalized.trim().length > 0) {
        return normalized;
      }
    }
    return "";
  }

  if (typeof input === "object") {
    return extractRecordString(input as Record<string, unknown>);
  }

  return "";
};

const coerceFieldValueToArrayInternal = (input: FieldValue | undefined): string[] => {
  if (input === null || input === undefined) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map((entry) => coerceFieldValueToString(entry as FieldValue).trim())
      .filter((value): value is string => value.length > 0);
  }

  const normalized = coerceFieldValueToString(input).trim();
  return normalized.length > 0 ? [normalized] : [];
};

export const coerceFieldValueToArray = (input: FieldValue | undefined): string[] =>
  coerceFieldValueToArrayInternal(input);

const extractListFromValue = (input: FieldValue | undefined): string[] => {
  if (input === null || input === undefined) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map((entry) =>
        typeof entry === "string" ? entry : coerceFieldValueToString(entry as FieldValue),
      )
      .flatMap((entry) => entry.split(/\r?\n/))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return coerceFieldValueToString(input)
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const cloneFieldValue = (value: FieldValue): FieldValue => {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === "object" && entry !== null
        ? { ...(entry as Record<string, unknown>) }
        : entry,
    ) as FieldValue;
  }
  if (value && typeof value === "object") {
    return { ...(value as Record<string, unknown>) };
  }
  return value;
};

const getDefaultValue = (field?: FieldConfig): FieldValue => {
  if (!field) {
    return "";
  }
  if (field.defaultValue !== undefined) {
    return cloneFieldValue(field.defaultValue);
  }
  return field.multiple ? [] : "";
};

const toKeyValuePairs = (input: FieldValue | undefined): KeyValueEntry[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((entry) => ({
      key: typeof (entry as any)?.key === "string" ? (entry as any).key : "",
      value: typeof (entry as any)?.value === "string" ? (entry as any).value : "",
    }));
  }
  if (typeof input === "object") {
    return Object.entries(input as Record<string, unknown>).map(([key, value]) => ({
      key,
      value:
        typeof value === "string"
          ? value
          : value === undefined || value === null
            ? ""
            : String(value),
    }));
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = parseEnvironmentText(input);
    return Object.entries(parsed).map(([key, value]) => ({ key, value }));
  }
  return [];
};

const keyValuePairsToMap = (pairs: KeyValueEntry[]): Record<string, string> => {
  const map: Record<string, string> = {};
  pairs.forEach((pair) => {
    const key = typeof pair?.key === "string" ? pair.key.trim() : "";
    if (!key) return;
    map[key] = typeof pair?.value === "string" ? pair.value : "";
  });
  return map;
};

interface AddEntityModalProps {
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
}

const FALLBACK_FRONTEND_FRAMEWORKS = ["React", "Next.js", "React Native", "Expo", "Flutter"];
const FALLBACK_DATABASE_ENGINES = ["PostgreSQL", "MySQL", "MariaDB", "MongoDB", "Redis", "SQLite"];
const FALLBACK_INFRASTRUCTURE_SCOPES = [
  "Kubernetes Cluster",
  "Terraform Stack",
  "Serverless Platform",
];

const MODULE_TYPE_OPTIONS = [
  { value: "capability", label: "Capability" },
  { value: "flow", label: "Flow" },
  { value: "data-schema", label: "Data Schema" },
  { value: "documentation", label: "Documentation" },
  { value: "runbook", label: "Runbook" },
  { value: "performance", label: "Performance" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const INFRA_CATEGORY_OPTIONS = [
  { value: "environment", label: "Environment" },
  { value: "observability", label: "Observability" },
  { value: "database-migration", label: "Database Migration" },
  { value: "platform", label: "Platform" },
  { value: "other", label: "Other" },
];

const DEFAULT_DESCRIPTION_PLACEHOLDERS: Record<string, string> = {
  component: "Outline the responsibilities, dependencies, and integrations for this component.",
  flow: "Summarize the key steps, triggers, and outcomes for this flow.",
  capability: "Explain the capability, supporting systems, and users it serves.",
  epic: "Capture the objective, scope, and success metrics for this epic.",
  task: "Detail the work, dependencies, and definition of done for this task.",
  other: "Provide helpful context, purpose, or constraints for this item.",
  default: "Share context, goals, or constraints that clarify this addition.",
};

const buildDefaultFields = (entityType: string): FieldConfig[] => {
  const normalizedType = entityType?.toLowerCase?.() || "default";
  const placeholder =
    DEFAULT_DESCRIPTION_PLACEHOLDERS[normalizedType] || DEFAULT_DESCRIPTION_PLACEHOLDERS.default;

  return [
    { name: "name", label: "Name", required: true, placeholder: "enter a name" },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      ...(placeholder ? { placeholder } : {}),
    },
  ];
};

function getFieldConfig(entityType: string, catalog: UiOptionCatalog): FieldConfig[] {
  const frontendCandidate = Array.isArray(catalog.frontendFrameworks)
    ? catalog.frontendFrameworks.filter(
        (framework) => typeof framework === "string" && framework.trim().length > 0,
      )
    : [];
  const frontendFrameworks =
    frontendCandidate.length > 0 ? frontendCandidate : [...FALLBACK_FRONTEND_FRAMEWORKS];

  const databaseCandidate = Array.isArray(catalog.databaseEngines)
    ? catalog.databaseEngines.filter(
        (engine) => typeof engine === "string" && engine.trim().length > 0,
      )
    : [];
  const databaseEngines =
    databaseCandidate.length > 0 ? databaseCandidate : [...FALLBACK_DATABASE_ENGINES];

  const infrastructureCandidate = Array.isArray(catalog.infrastructureScopes)
    ? catalog.infrastructureScopes.filter(
        (scope) => typeof scope === "string" && scope.trim().length > 0,
      )
    : [];
  const infrastructureScopes =
    infrastructureCandidate.length > 0
      ? infrastructureCandidate
      : [...FALLBACK_INFRASTRUCTURE_SCOPES];

  const moduleTypeEquals = (values: Record<string, FieldValue>, type: string): boolean =>
    coerceFieldValueToString(values["moduleType"]).trim().toLowerCase() === type;

  const infraCategoryEquals = (values: Record<string, FieldValue>, category: string): boolean =>
    coerceFieldValueToString(values["category"]).trim().toLowerCase() === category;

  const applyMarkdownSupport = (fields: FieldConfig[]): FieldConfig[] =>
    fields.map((field) =>
      field.name === "description"
        ? {
            ...field,
            type: field.type ?? "textarea",
            markdown: true,
          }
        : field,
    );

  const configs: Record<string, FieldConfig[]> = {
    frontend: [
      { name: "name", label: "Frontend Name", required: true, placeholder: "mobile-app" },
      frontendFrameworks.length > 0
        ? {
            name: "framework",
            label: "Framework",
            type: "select",
            options: frontendFrameworks,
            placeholder: "Select framework",
          }
        : {
            name: "framework",
            label: "Framework",
            placeholder: "React Native, Expo, Flutter",
          },
      { name: "entryPoint", label: "Entry Point", placeholder: "src/App.tsx" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        placeholder: "Purpose of this frontend and target platform",
      },
    ],
    service: buildServiceFieldConfig(catalog),
    module: [
      { name: "name", label: "Module Name", required: true, placeholder: "shared-library" },
      {
        name: "moduleType",
        label: "Module Type",
        type: "select",
        options: MODULE_TYPE_OPTIONS,
        placeholder: "Select module type",
      },
      { name: "owner", label: "Owner", placeholder: "owner@sibylline.dev" },
      { name: "kind", label: "Kind / Domain", placeholder: "service, integration, ui" },
      {
        name: "deliverables",
        label: "Key Deliverables",
        type: "textarea",
        placeholder: "List deliverables, one per line",
        description: "Capture major outputs and handoffs for this module.",
      },
      {
        name: "flowSteps",
        label: "Flow Steps",
        type: "textarea",
        placeholder: "Describe each step on a new line",
        isVisible: (values) => moduleTypeEquals(values, "flow"),
      },
      {
        name: "schemaEngine",
        label: "Schema Engine",
        placeholder: "PostgreSQL",
        isVisible: (values) => moduleTypeEquals(values, "data-schema"),
      },
      {
        name: "schemaVersion",
        label: "Schema Version",
        placeholder: "1.0.0",
        isVisible: (values) => moduleTypeEquals(values, "data-schema"),
      },
      {
        name: "schemaOwner",
        label: "Schema Owner",
        placeholder: "catalog-api",
        isVisible: (values) => moduleTypeEquals(values, "data-schema"),
      },
      {
        name: "schemaTables",
        label: "Schema Tables",
        type: "textarea",
        placeholder: "products\nplans\nprice_tiers",
        isVisible: (values) => moduleTypeEquals(values, "data-schema"),
      },
      {
        name: "docFormat",
        label: "Documentation Format",
        placeholder: "OpenAPI, Markdown",
        isVisible: (values) => moduleTypeEquals(values, "documentation"),
      },
      {
        name: "docVersion",
        label: "Documentation Version",
        placeholder: "1.0.0",
        isVisible: (values) => moduleTypeEquals(values, "documentation"),
      },
      {
        name: "docSource",
        label: "Documentation Source Path",
        placeholder: "./docs/openapi.yaml",
        isVisible: (values) => moduleTypeEquals(values, "documentation"),
      },
      {
        name: "runbookName",
        label: "Runbook Name",
        placeholder: "On-call playbook",
        isVisible: (values) => moduleTypeEquals(values, "runbook"),
      },
      {
        name: "runbookPath",
        label: "Runbook Path",
        placeholder: "./docs/runbooks/on-call.md",
        isVisible: (values) => moduleTypeEquals(values, "runbook"),
      },
      {
        name: "slaUptime",
        label: "Target Uptime (e.g. 99.5%)",
        placeholder: "99.5%",
        isVisible: (values) => moduleTypeEquals(values, "performance"),
      },
      {
        name: "slaP95",
        label: "P95 Response (ms)",
        placeholder: "400",
        isVisible: (values) => moduleTypeEquals(values, "performance"),
      },
      {
        name: "slaP99",
        label: "P99 Response (ms)",
        placeholder: "900",
        isVisible: (values) => moduleTypeEquals(values, "performance"),
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        placeholder: "What problems does this module solve?",
      },
    ],
    tool: [
      { name: "name", label: "Tool Name", required: true, placeholder: "lint-runner" },
      { name: "command", label: "Command", placeholder: "npm run lint" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        placeholder: "How should this tooling be used?",
      },
    ],
    route: [
      { name: "name", label: "Route Name", required: true, placeholder: "Checkout" },
      { name: "path", label: "Route Path", required: true, placeholder: "/checkout" },
      { name: "methods", label: "HTTP Methods", placeholder: "GET, POST" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        placeholder: "User experience or API contract details",
      },
    ],
    view: [
      { name: "name", label: "View Name", required: true, placeholder: "Dashboard" },
      { name: "path", label: "View Path", placeholder: "/dashboard" },
      {
        name: "component",
        label: "Component (optional)",
        placeholder: "components/DashboardView",
      },
      {
        name: "filePath",
        label: "Source File (optional)",
        placeholder: "apps/client/src/views/DashboardView.tsx",
      },
      {
        name: "routerType",
        label: "Router Type (optional)",
        placeholder: "react-router",
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        placeholder: "Key widgets or data surfaced in this view",
      },
    ],
    database: [
      { name: "name", label: "Database Name", required: true, placeholder: "user-store" },
      databaseEngines.length > 0
        ? {
            name: "engine",
            label: "Engine",
            type: "select",
            options: databaseEngines,
            placeholder: "Select engine",
          }
        : {
            name: "engine",
            label: "Engine",
            placeholder: "PostgreSQL, MySQL",
          },
      { name: "version", label: "Version", placeholder: "15" },
      {
        name: "description",
        label: "Notes",
        type: "textarea",
        placeholder: "Important schemas, scaling, or retention notes",
      },
    ],
    infrastructure: [
      {
        name: "name",
        label: "Infrastructure Component",
        required: true,
        placeholder: "production-cluster",
      },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: INFRA_CATEGORY_OPTIONS,
        placeholder: "Select category",
      },
      infrastructureScopes.length > 0
        ? {
            name: "scope",
            label: "Scope",
            type: "select",
            options: infrastructureScopes,
            placeholder: "Select scope",
          }
        : {
            name: "scope",
            label: "Scope",
            placeholder: "Kubernetes Cluster, Terraform Stack",
          },
      {
        name: "environmentDomain",
        label: "Environment Domain",
        placeholder: "https://staging.example.com",
        isVisible: (values) => infraCategoryEquals(values, "environment"),
      },
      {
        name: "environmentReleaseGate",
        label: "Release Gate",
        placeholder: "qa-signoff",
        isVisible: (values) => infraCategoryEquals(values, "environment"),
      },
      {
        name: "environmentChangeManagement",
        label: "Change Management",
        placeholder: "prod-approval",
        isVisible: (values) => infraCategoryEquals(values, "environment"),
      },
      {
        name: "environmentSecrets",
        label: "Managed Secrets",
        type: "textarea",
        placeholder: "STRIPE_TEST_KEY\nLAGO_API_KEY",
        isVisible: (values) => infraCategoryEquals(values, "environment"),
      },
      {
        name: "observabilityLoggingLevel",
        label: "Logging Level",
        placeholder: "info",
        isVisible: (values) => infraCategoryEquals(values, "observability"),
      },
      {
        name: "observabilityMetricsProvider",
        label: "Metrics Provider",
        placeholder: "prometheus",
        isVisible: (values) => infraCategoryEquals(values, "observability"),
      },
      {
        name: "observabilityAlerts",
        label: "Alert Rules",
        type: "textarea",
        placeholder: "high-error-rate\nwebhook-failures",
        isVisible: (values) => infraCategoryEquals(values, "observability"),
      },
      {
        name: "migrationTool",
        label: "Migration Tool",
        placeholder: "Drizzle",
        isVisible: (values) => infraCategoryEquals(values, "database-migration"),
      },
      {
        name: "migrationStrategy",
        label: "Migration Strategy",
        placeholder: "versioned",
        isVisible: (values) => infraCategoryEquals(values, "database-migration"),
      },
      {
        name: "migrationSchedule",
        label: "Migration Schedule",
        placeholder: "continuous",
        isVisible: (values) => infraCategoryEquals(values, "database-migration"),
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        placeholder: "What infrastructure does this provide?",
      },
    ],
    epic: [
      { name: "name", label: "Epic Name", required: true, placeholder: "Checkout flow revamp" },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        markdown: true,
        placeholder: "Summarize the objective, scope, and success metrics for this epic",
      },
    ],
    task: [
      { name: "name", label: "Task Name", required: true, placeholder: "Design API contract" },
      {
        name: "epicId",
        label: "Epic",
        type: "select",
        required: false,
        placeholder: "Select epic",
        resolveOptions: () =>
          (catalog.taskEpicOptions ?? [])
            .map((option) => {
              const value = String(option.id ?? "").trim();
              if (!value) return null;
              const label = String(option.name ?? value).trim() || value;
              return { value, label } as SelectOption;
            })
            .filter((option): option is SelectOption => Boolean(option)),
        description:
          "Optional: choose the epic this task belongs to. Leave blank to keep it unassigned.",
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        placeholder: "Detail the work, dependencies, and definition of done for this task.",
      },
    ],
    other: buildDefaultFields("other"),
  };

  const result = configs[entityType] ?? buildDefaultFields(entityType);
  return applyMarkdownSupport(result);
}

function toSingularLabel(label: string, fallback: string): string {
  if (!label && !fallback) return "item";
  const base = (label || fallback).trim();
  if (base.toLowerCase() === "infrastructure") return "infrastructure component";
  if (base.toLowerCase() === "tools") return "tool";
  if (base.toLowerCase() === "services") return "service";
  if (base.toLowerCase() === "databases") return "database";
  if (base.toLowerCase().endsWith("ies")) {
    return base.slice(0, -3) + "y";
  }
  if (base.toLowerCase().endsWith("s")) {
    return base.slice(0, -1);
  }
  return base;
}

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
  const fields = useMemo(
    () => getFieldConfig(entityType, optionCatalog),
    [entityType, optionCatalog],
  );

  const fieldByName = useMemo(() => {
    const map = new Map<string, FieldConfig>();
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
  }, [defaultValues, open, fieldByName, initialValues]);

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

  const normalizeForComparison = (
    targetField: FieldConfig | undefined,
    value: FieldValue | undefined,
  ): string => {
    if (targetField?.component === "key-value") {
      return JSON.stringify(toKeyValuePairs(value));
    }
    if (Array.isArray(value) && !targetField?.multiple) {
      return JSON.stringify(value);
    }
    return coerceFieldValueToString(value);
  };

  const prepareValueForStorage = (
    field: FieldConfig | undefined,
    value: FieldValue,
  ): FieldValue => {
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
      size="lg"
      showDefaultFooter={false}
      className="bg-white text-graphite-900 dark:bg-graphite-900 dark:text-graphite-50 border border-gray-200 dark:border-graphite-700 shadow-2xl dark:[&_label]:text-graphite-100 dark:[&_p]:text-graphite-300 dark:[&_h2]:text-graphite-50"
      containerClassName="px-4 py-6 sm:px-6"
      {...(firstField ? { initialFocus: `#${formId}-${firstField}` } : {})}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
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
              <div key={field.name} className="space-y-1">
                <label
                  className="block text-sm font-medium text-graphite-700 dark:text-graphite-50"
                  htmlFor={fieldId}
                >
                  {field.label}
                </label>
                <KeyValueEditor
                  pairs={pairs}
                  onChange={(nextPairs) => handleChange(field.name, nextPairs)}
                  {...(field.keyPlaceholder !== undefined
                    ? { keyPlaceholder: field.keyPlaceholder }
                    : {})}
                  {...(field.valuePlaceholder !== undefined
                    ? { valuePlaceholder: field.valuePlaceholder }
                    : {})}
                  {...(field.addLabel !== undefined ? { addLabel: field.addLabel } : {})}
                />
                {field.description && (
                  <p className="text-xs text-graphite-500 dark:text-graphite-300">
                    {field.description}
                  </p>
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

            return <MarkdownField key={field.name} {...markdownProps} />;
          }

          if (field.type === "textarea") {
            return (
              <div key={field.name} className="space-y-1">
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
                  <p className="text-xs text-graphite-500 dark:text-graphite-300">
                    {field.description}
                  </p>
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
              <div key={field.name} className="space-y-1">
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
                  <p className="text-xs text-graphite-500 dark:text-graphite-300">
                    {field.description}
                  </p>
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
            <Input
              key={field.name}
              {...inputProps}
              {...(errorMessage ? { error: errorMessage } : {})}
            />
          );
        })}

        <div className="flex items-center justify-end pt-2">
          <Button type="submit">
            {submitVerb} {toSingularLabel(groupLabel, entityType)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AddEntityModal;
