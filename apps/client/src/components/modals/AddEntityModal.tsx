import { MarkdownField, type MarkdownFieldProps } from '@/components/form/MarkdownField';
import Button from '@/design-system/components/Button';
import Input from '@/design-system/components/Input';
import Modal from '@/design-system/components/Modal';
import Select, { type SelectOption } from '@/design-system/components/Select';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';

export interface EpicTaskOption {
  id: string;
  name: string;
  epicId?: string;
  epicName?: string;
  status?: string;
  completed?: boolean;
}

export interface TaskEpicOption {
  id: string;
  name: string;
}

export interface UiOptionCatalog {
  frontendFrameworks?: string[];
  serviceLanguages?: string[];
  serviceFrameworks?: Record<string, string[]>;
  databaseEngines?: string[];
  infrastructureScopes?: string[];
  epicTaskOptions?: EpicTaskOption[];
  taskEpicOptions?: TaskEpicOption[];
}

export type FieldValue =
  | string
  | string[]
  | number
  | boolean
  | Record<string, unknown>
  | Array<Record<string, unknown>>;

const FIELD_RECORD_KEYS = ['value', 'id', 'name', 'label', 'slug', 'key'] as const;

const INPUT_SURFACE_CLASSES =
  'bg-white dark:bg-graphite-950 text-graphite-900 dark:text-graphite-50 border border-gray-300 dark:border-graphite-700 hover:border-graphite-400 dark:hover:border-graphite-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
const SELECT_DROPDOWN_CLASSES =
  'bg-white dark:bg-graphite-950 text-graphite-900 dark:text-graphite-50 border border-gray-200 dark:border-graphite-700';

const extractRecordString = (record: Record<string, unknown> | undefined | null): string => {
  if (!record) return '';
  for (const key of FIELD_RECORD_KEYS) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return '';
};

export const coerceFieldValueToString = (input: FieldValue | undefined): string => {
  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input === 'string') {
    return input;
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return String(input);
  }

  if (Array.isArray(input)) {
    for (const entry of input as unknown[]) {
      const normalized = coerceFieldValueToString(entry as FieldValue);
      if (normalized.trim().length > 0) {
        return normalized;
      }
    }
    return '';
  }

  if (typeof input === 'object') {
    return extractRecordString(input as Record<string, unknown>);
  }

  return '';
};

const coerceFieldValueToArrayInternal = (input: FieldValue | undefined): string[] => {
  if (input === null || input === undefined) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map(entry => coerceFieldValueToString(entry as FieldValue).trim())
      .filter((value): value is string => value.length > 0);
  }

  const normalized = coerceFieldValueToString(input).trim();
  return normalized.length > 0 ? [normalized] : [];
};

export const coerceFieldValueToArray = (input: FieldValue | undefined): string[] =>
  coerceFieldValueToArrayInternal(input);

export const DEFAULT_UI_OPTION_CATALOG: UiOptionCatalog = {
  epicTaskOptions: [],
  taskEpicOptions: [],
};

interface FieldConfig {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  description?: string;
  multiple?: boolean;
  options?: Array<string | SelectOption>;
  resolveOptions?: (values: Record<string, FieldValue>) => Array<string | SelectOption>;
  isVisible?: (
    values: Record<string, FieldValue>,
    resolvedOptions: Array<string | SelectOption>
  ) => boolean;
  onChangeClear?: string[];
  markdown?: boolean;
}

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
  mode?: 'create' | 'edit';
}

const FALLBACK_SERVICE_LANGUAGES = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'C#',
];

const FALLBACK_SERVICE_FRAMEWORKS: Record<string, string[]> = {
  TypeScript: ['NestJS', 'Fastify', 'Express'],
  JavaScript: ['Express', 'Koa', 'Hapi'],
  Python: ['FastAPI', 'Django', 'Flask'],
  Go: ['Gin', 'Echo', 'Fiber'],
  Rust: ['Actix', 'Axum', 'Rocket'],
  Java: ['Spring Boot', 'Micronaut', 'Quarkus'],
  'C#': ['ASP.NET Core', 'NancyFX'],
};

const FALLBACK_FRONTEND_FRAMEWORKS = ['React', 'Next.js', 'React Native', 'Expo', 'Flutter'];
const FALLBACK_DATABASE_ENGINES = ['PostgreSQL', 'MySQL', 'MariaDB', 'MongoDB', 'Redis', 'SQLite'];
const FALLBACK_INFRASTRUCTURE_SCOPES = [
  'Kubernetes Cluster',
  'Terraform Stack',
  'Serverless Platform',
];

const DEFAULT_DESCRIPTION_PLACEHOLDERS: Record<string, string> = {
  component: 'Outline the responsibilities, dependencies, and integrations for this component.',
  flow: 'Summarize the key steps, triggers, and outcomes for this flow.',
  capability: 'Explain the capability, supporting systems, and users it serves.',
  epic: 'Capture the objective, scope, and success metrics for this epic.',
  task: 'Detail the work, dependencies, and definition of done for this task.',
  other: 'Provide helpful context, purpose, or constraints for this item.',
  default: 'Share context, goals, or constraints that clarify this addition.',
};

const buildDefaultFields = (entityType: string): FieldConfig[] => {
  const normalizedType = entityType?.toLowerCase?.() || 'default';
  const placeholder =
    DEFAULT_DESCRIPTION_PLACEHOLDERS[normalizedType] || DEFAULT_DESCRIPTION_PLACEHOLDERS.default;

  return [
    { name: 'name', label: 'Name', required: true, placeholder: 'enter a name' },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      ...(placeholder ? { placeholder } : {}),
    },
  ];
};

function getFieldConfig(entityType: string, catalog: UiOptionCatalog): FieldConfig[] {
  const frontendCandidate = Array.isArray(catalog.frontendFrameworks)
    ? catalog.frontendFrameworks.filter(
        framework => typeof framework === 'string' && framework.trim().length > 0
      )
    : [];
  const frontendFrameworks =
    frontendCandidate.length > 0 ? frontendCandidate : [...FALLBACK_FRONTEND_FRAMEWORKS];

  const serviceFrameworkEntries = Object.entries(catalog.serviceFrameworks ?? {}).map(
    ([language, frameworkList]) =>
      [
        typeof language === 'string' ? language.trim() : '',
        Array.isArray(frameworkList)
          ? frameworkList
              .map(item => (typeof item === 'string' ? item.trim() : ''))
              .filter(entry => entry.length > 0)
          : [],
      ] as const
  );

  const sanitizedFrameworkEntries = serviceFrameworkEntries.filter(
    ([language, frameworks]) => language.length > 0 && frameworks.length > 0
  );

  const serviceFrameworks =
    sanitizedFrameworkEntries.length > 0
      ? Object.fromEntries(sanitizedFrameworkEntries)
      : Object.fromEntries(
          Object.entries(FALLBACK_SERVICE_FRAMEWORKS).map(([language, frameworks]) => [
            language,
            [...frameworks],
          ])
        );

  const combinedLanguages: string[] = [];
  const addLanguage = (language: unknown) => {
    if (typeof language !== 'string') return;
    const normalized = language.trim();
    if (!normalized) return;
    if (!combinedLanguages.includes(normalized)) {
      combinedLanguages.push(normalized);
    }
  };

  if (Array.isArray(catalog.serviceLanguages)) {
    for (const language of catalog.serviceLanguages) {
      addLanguage(language);
    }
  }

  for (const language of Object.keys(serviceFrameworks)) {
    addLanguage(language);
  }

  if (combinedLanguages.length === 0) {
    FALLBACK_SERVICE_LANGUAGES.forEach(addLanguage);
  }

  const serviceLanguages = combinedLanguages;

  const databaseCandidate = Array.isArray(catalog.databaseEngines)
    ? catalog.databaseEngines.filter(
        engine => typeof engine === 'string' && engine.trim().length > 0
      )
    : [];
  const databaseEngines =
    databaseCandidate.length > 0 ? databaseCandidate : [...FALLBACK_DATABASE_ENGINES];

  const infrastructureCandidate = Array.isArray(catalog.infrastructureScopes)
    ? catalog.infrastructureScopes.filter(
        scope => typeof scope === 'string' && scope.trim().length > 0
      )
    : [];
  const infrastructureScopes =
    infrastructureCandidate.length > 0
      ? infrastructureCandidate
      : [...FALLBACK_INFRASTRUCTURE_SCOPES];

  const frameworkLookup = new Map(
    Object.entries(serviceFrameworks).map(([language, frameworks]) => [
      language.toLowerCase(),
      frameworks,
    ])
  );

  const frameworkOptionsFor = (languageValue: FieldValue | undefined): string[] => {
    const language = coerceFieldValueToString(languageValue).trim();
    if (!language) return [];
    if (serviceFrameworks[language]?.length) {
      return serviceFrameworks[language]!;
    }
    return frameworkLookup.get(language.toLowerCase()) ?? [];
  };

  const applyMarkdownSupport = (fields: FieldConfig[]): FieldConfig[] =>
    fields.map(field =>
      field.name === 'description'
        ? {
            ...field,
            type: field.type ?? 'textarea',
            markdown: true,
          }
        : field
    );

  const configs: Record<string, FieldConfig[]> = {
    frontend: [
      { name: 'name', label: 'Frontend Name', required: true, placeholder: 'mobile-app' },
      frontendFrameworks.length > 0
        ? {
            name: 'framework',
            label: 'Framework',
            type: 'select',
            options: frontendFrameworks,
            placeholder: 'Select framework',
          }
        : {
            name: 'framework',
            label: 'Framework',
            placeholder: 'React Native, Expo, Flutter',
          },
      { name: 'entryPoint', label: 'Entry Point', placeholder: 'src/App.tsx' },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Purpose of this frontend and target platform',
      },
    ],
    service: [
      { name: 'name', label: 'Service Name', required: true, placeholder: 'payments-service' },
      serviceLanguages.length > 0
        ? {
            name: 'language',
            label: 'Language',
            type: 'select',
            options: serviceLanguages,
            placeholder: 'Select language',
            required: true,
            onChangeClear: ['framework'],
          }
        : {
            name: 'language',
            label: 'Language',
            required: true,
            placeholder: 'Node.js, Go, Python',
            onChangeClear: ['framework'],
          },
      {
        name: 'framework',
        label: 'Framework (optional)',
        type: 'select',
        placeholder: 'Select framework',
        resolveOptions: values => frameworkOptionsFor(values['language']),
        isVisible: (_, resolvedOptions) => resolvedOptions.length > 0,
        description: 'Optional: choose a framework that fits the selected language.',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'What responsibilities does this service own?',
      },
    ],
    module: [
      { name: 'name', label: 'Module Name', required: true, placeholder: 'shared-library' },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'What problems does this module solve?',
      },
    ],
    tool: [
      { name: 'name', label: 'Tool Name', required: true, placeholder: 'lint-runner' },
      { name: 'command', label: 'Command', placeholder: 'npm run lint' },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'How should this tooling be used?',
      },
    ],
    route: [
      { name: 'name', label: 'Route Name', required: true, placeholder: 'Checkout' },
      { name: 'path', label: 'Route Path', required: true, placeholder: '/checkout' },
      { name: 'methods', label: 'HTTP Methods', placeholder: 'GET, POST' },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'User experience or API contract details',
      },
    ],
    view: [
      { name: 'name', label: 'View Name', required: true, placeholder: 'Dashboard' },
      { name: 'path', label: 'View Path', placeholder: '/dashboard' },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Key widgets or data surfaced in this view',
      },
    ],
    database: [
      { name: 'name', label: 'Database Name', required: true, placeholder: 'user-store' },
      databaseEngines.length > 0
        ? {
            name: 'engine',
            label: 'Engine',
            type: 'select',
            options: databaseEngines,
            placeholder: 'Select engine',
          }
        : {
            name: 'engine',
            label: 'Engine',
            placeholder: 'PostgreSQL, MySQL',
          },
      { name: 'version', label: 'Version', placeholder: '15' },
      {
        name: 'description',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Important schemas, scaling, or retention notes',
      },
    ],
    infrastructure: [
      {
        name: 'name',
        label: 'Infrastructure Component',
        required: true,
        placeholder: 'production-cluster',
      },
      infrastructureScopes.length > 0
        ? {
            name: 'scope',
            label: 'Scope',
            type: 'select',
            options: infrastructureScopes,
            placeholder: 'Select scope',
          }
        : {
            name: 'scope',
            label: 'Scope',
            placeholder: 'Kubernetes Cluster, Terraform Stack',
          },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'What infrastructure does this provide?',
      },
    ],
    epic: [
      { name: 'name', label: 'Epic Name', required: true, placeholder: 'Checkout flow revamp' },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        markdown: true,
        placeholder: 'Summarize the objective, scope, and success metrics for this epic',
      },
    ],
    task: [
      { name: 'name', label: 'Task Name', required: true, placeholder: 'Design API contract' },
      {
        name: 'epicId',
        label: 'Epic',
        type: 'select',
        required: false,
        placeholder: 'Select epic',
        resolveOptions: () =>
          (catalog.taskEpicOptions ?? [])
            .map(option => {
              const value = String(option.id ?? '').trim();
              if (!value) return null;
              const label = String(option.name ?? value).trim() || value;
              return { value, label } as SelectOption;
            })
            .filter((option): option is SelectOption => Boolean(option)),
        description:
          'Optional: choose the epic this task belongs to. Leave blank to keep it unassigned.',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Detail the work, dependencies, and definition of done for this task.',
      },
    ],
    other: buildDefaultFields('other'),
  };

  const result = configs[entityType] ?? buildDefaultFields(entityType);
  return applyMarkdownSupport(result);
}

function toSingularLabel(label: string, fallback: string): string {
  if (!label && !fallback) return 'item';
  const base = (label || fallback).trim();
  if (base.toLowerCase() === 'infrastructure') return 'infrastructure component';
  if (base.toLowerCase() === 'tools') return 'tool';
  if (base.toLowerCase() === 'services') return 'service';
  if (base.toLowerCase() === 'databases') return 'database';
  if (base.toLowerCase().endsWith('ies')) {
    return base.slice(0, -3) + 'y';
  }
  if (base.toLowerCase().endsWith('s')) {
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
  mode = 'create',
}: AddEntityModalProps) {
  const fields = useMemo(
    () => getFieldConfig(entityType, optionCatalog),
    [entityType, optionCatalog]
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
      values[field.name] = field.multiple ? [] : '';
    }
    return values;
  }, [fields]);

  const [values, setValues] = useState<Record<string, FieldValue>>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const nextValues: Record<string, FieldValue> = { ...defaultValues };
      if (initialValues) {
        Object.entries(initialValues).forEach(([key, rawValue]) => {
          const field = fieldByName.get(key);
          if (!field) return;

          if (field.multiple) {
            nextValues[key] = coerceFieldValueToArray(rawValue);
          } else {
            nextValues[key] = coerceFieldValueToString(rawValue).trim();
          }
        });
      }

      setValues(nextValues);
      setErrors({});
    }
  }, [defaultValues, open, fieldByName, initialValues]);

  const singularLabel = useMemo(
    () => toSingularLabel(groupLabel, entityType).toLowerCase(),
    [groupLabel, entityType]
  );

  const formId = `add-entity-${entityType}`;
  const firstField = fields[0]?.name ?? null;

  const toArray = (input: FieldValue | undefined): string[] => coerceFieldValueToArray(input);

  const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  };

  const handleChange = (name: string, nextValue: FieldValue) => {
    const field = fieldByName.get(name);
    const clearKeys = field?.onChangeClear ?? [];
    const impactedKeys = [name, ...clearKeys];

    setValues(prev => {
      let nextState = prev;
      let mutated = false;

      const prevValue = prev[name];
      const isMultiple = field?.multiple === true;
      const shouldUpdate = isMultiple
        ? !arraysEqual(toArray(prevValue), toArray(nextValue))
        : coerceFieldValueToString(prevValue).trim() !== coerceFieldValueToString(nextValue).trim();

      if (shouldUpdate) {
        nextState = { ...prev, [name]: nextValue };
        mutated = true;
      }

      if (clearKeys.length > 0) {
        if (!mutated) {
          nextState = { ...prev };
        }

        for (const key of clearKeys) {
          const targetField = fieldByName.get(key);
          const defaultValue: FieldValue = targetField?.multiple ? [] : '';
          const existingValue = nextState[key];
          const needsReset = targetField?.multiple
            ? !arraysEqual(toArray(existingValue), toArray(defaultValue))
            : coerceFieldValueToString(existingValue).trim() !==
              coerceFieldValueToString(defaultValue).trim();

          if (needsReset) {
            nextState[key] = targetField?.multiple ? [] : '';
            mutated = true;
          }
        }
      }

      return mutated ? nextState : prev;
    });

    if (impactedKeys.some(key => errors[key])) {
      setErrors(prev => {
        const nextErrors = { ...prev };
        for (const key of impactedKeys) {
          delete nextErrors[key];
        }
        return nextErrors;
      });
    }

    if (import.meta.env.DEV) {
      console.debug('[AddEntityModal] handleChange', { field: name, value: nextValue });
    }
  };

  const toStringValue = (input: FieldValue | undefined): string => coerceFieldValueToString(input);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors: Record<string, string> = {};
    const payloadValues: Record<string, FieldValue> = {};

    for (const field of fields) {
      const rawValue = values[field.name];

      if (field.multiple) {
        const normalizedValues = toArray(rawValue)
          .map(item => item.trim())
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

    onSubmit?.({ entityType, values: payloadValues });
    onClose();
  };

  const defaultTitle =
    mode === 'edit'
      ? `Update ${toSingularLabel(groupLabel, entityType)}`
      : `Add ${toSingularLabel(groupLabel, entityType)}`;
  const defaultDescription =
    mode === 'edit'
      ? `Review and update this ${singularLabel}.`
      : `Provide the details needed to add a new ${singularLabel}.`;

  const modalTitle = titleOverride ?? defaultTitle;
  const modalDescription = descriptionOverride ?? defaultDescription;
  const submitVerb = mode === 'edit' ? 'Update' : 'Add';

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
        {fields.map(field => {
          const fieldId = `${formId}-${field.name}`;
          const rawValue = values[field.name];
          const errorMessage = errors[field.name];
          const shouldRenderMarkdown =
            field.type === 'textarea' &&
            (field.markdown || (entityType === 'epic' && field.name === 'description'));
          const resolvedOptions =
            field.type === 'select'
              ? field.resolveOptions
                ? field.resolveOptions(values)
                : (field.options ?? [])
              : [];

          if (field.isVisible && !field.isVisible(values, resolvedOptions)) {
            return null;
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

          if (field.type === 'textarea') {
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
                  onChange={event => handleChange(field.name, event.target.value)}
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

          if (field.type === 'select') {
            const optionValues = Array.isArray(resolvedOptions) ? resolvedOptions : [];
            const seen = new Set<string>();
            const selectOptions: SelectOption[] = [];

            optionValues.forEach(option => {
              if (typeof option === 'string') {
                const trimmed = option.trim();
                if (!trimmed) return;
                const dedupeKey = trimmed.toLowerCase();
                if (seen.has(dedupeKey)) return;
                seen.add(dedupeKey);
                selectOptions.push({ value: trimmed, label: trimmed });
              } else if (option && typeof option.value === 'string') {
                const trimmedValue = option.value.trim();
                if (!trimmedValue) return;
                const dedupeKey = trimmedValue.toLowerCase();
                if (seen.has(dedupeKey)) return;
                seen.add(dedupeKey);
                const normalizedOption: SelectOption = {
                  value: trimmedValue,
                  label: option.label?.trim() || trimmedValue,
                };
                if (typeof option.description === 'string' && option.description.trim()) {
                  normalizedOption.description = option.description.trim();
                }
                if (option.disabled !== undefined) {
                  normalizedOption.disabled = option.disabled;
                }
                if (option.icon !== undefined) {
                  normalizedOption.icon = option.icon;
                }
                if (typeof option.group === 'string' && option.group.trim()) {
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
                    (isMultiple ? 'Select one or more options' : 'Select an option')
                  }
                  {...(isMultiple
                    ? { value: selectValue as string[] }
                    : selectValue
                      ? { value: selectValue as string }
                      : {})}
                  onChange={nextValue => {
                    if (isMultiple) {
                      const normalized = Array.isArray(nextValue)
                        ? nextValue
                        : nextValue
                          ? [String(nextValue)]
                          : [];
                      handleChange(field.name, normalized);
                    } else {
                      const normalized = Array.isArray(nextValue)
                        ? (nextValue[0] ?? '')
                        : ((nextValue as string | undefined) ?? '');
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
