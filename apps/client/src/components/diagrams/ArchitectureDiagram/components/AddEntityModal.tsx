import Button from '@/design-system/components/Button';
import Input from '@/design-system/components/Input';
import Modal from '@/design-system/components/Modal';
import Select from '@/design-system/components/Select';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';

export interface UiOptionCatalog {
  frontendFrameworks?: string[];
  serviceLanguages?: string[];
  serviceFrameworks?: Record<string, string[]>;
  databaseEngines?: string[];
  infrastructureScopes?: string[];
}

interface FieldConfig {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  description?: string;
  options?: string[];
  resolveOptions?: (values: Record<string, string>) => string[];
  isVisible?: (values: Record<string, string>, resolvedOptions: string[]) => boolean;
  onChangeClear?: string[];
}

interface AddEntityModalProps {
  open: boolean;
  entityType: string;
  groupLabel: string;
  optionCatalog: UiOptionCatalog;
  onClose: () => void;
  onSubmit?: (payload: { entityType: string; values: Record<string, string> }) => void;
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

const DEFAULT_FIELDS: FieldConfig[] = [
  { name: 'name', label: 'Name', required: true, placeholder: 'enter a name' },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'What does this component do?',
  },
];

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

  const frameworkOptionsFor = (languageValue: string | undefined): string[] => {
    const language = (languageValue ?? '').trim();
    if (!language) return [];
    if (serviceFrameworks[language]?.length) {
      return serviceFrameworks[language]!;
    }
    return frameworkLookup.get(language.toLowerCase()) ?? [];
  };

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
        resolveOptions: values => frameworkOptionsFor(values.language),
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
    other: DEFAULT_FIELDS,
  };

  return configs[entityType] ?? DEFAULT_FIELDS;
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
}: AddEntityModalProps) {
  const fields = useMemo(
    () => getFieldConfig(entityType, optionCatalog),
    [entityType, optionCatalog]
  );

  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const field of fields) {
      values[field.name] = '';
    }
    return values;
  }, [fields]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
  }, [initialValues, open]);

  const singularLabel = useMemo(
    () => toSingularLabel(groupLabel, entityType).toLowerCase(),
    [groupLabel, entityType]
  );

  const formId = `add-entity-${entityType}`;
  const firstField = fields[0]?.name ?? null;

  const fieldByName = useMemo(() => {
    const map = new Map<string, FieldConfig>();
    for (const field of fields) {
      map.set(field.name, field);
    }
    return map;
  }, [fields]);

  const handleChange = (name: string, value: string) => {
    const field = fieldByName.get(name);
    const clearKeys = field?.onChangeClear ?? [];
    const impactedKeys = [name, ...clearKeys];

    setValues(prev => {
      let next = prev;
      let mutated = false;

      if (prev[name] !== value) {
        next = { ...prev, [name]: value };
        mutated = true;
      }

      if (clearKeys.length > 0) {
        if (!mutated) {
          next = { ...prev };
        }

        for (const key of clearKeys) {
          if (next[key] !== '') {
            next[key] = '';
            mutated = true;
          }
        }
      }

      return mutated ? next : prev;
    });

    if (impactedKeys.some(key => errors[key])) {
      setErrors(prev => {
        const next = { ...prev };
        for (const key of impactedKeys) {
          delete next[key];
        }
        return next;
      });
    }

    if (import.meta.env.DEV) {
      console.debug('[AddEntityModal] handleChange', { field: name, value });
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors: Record<string, string> = {};
    const payloadValues: Record<string, string> = {};

    for (const field of fields) {
      const rawValue = values[field.name] ?? '';
      const trimmedValue = rawValue.trim();

      if (field.required && trimmedValue.length === 0) {
        validationErrors[field.name] = `${field.label} is required`;
      }

      if (trimmedValue.length > 0 || field.required) {
        payloadValues[field.name] = trimmedValue;
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSubmit?.({ entityType, values: payloadValues });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add ${toSingularLabel(groupLabel, entityType)}`}
      description={`Provide the details needed to add a new ${singularLabel}.`}
      size="lg"
      showDefaultFooter={false}
      className="bg-white text-graphite-900 dark:bg-graphite-900 dark:text-graphite-50 border border-gray-200 dark:border-graphite-700 shadow-2xl dark:[&_label]:text-graphite-100 dark:[&_p]:text-graphite-300 dark:[&_h2]:text-graphite-50"
      containerClassName="px-4 py-6 sm:px-6"
      {...(firstField ? { initialFocus: `#${formId}-${firstField}` } : {})}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {fields.map(field => {
          const fieldId = `${formId}-${field.name}`;
          const value = values[field.name] ?? '';
          const errorMessage = errors[field.name];
          const resolvedOptions =
            field.type === 'select'
              ? field.resolveOptions
                ? field.resolveOptions(values)
                : (field.options ?? [])
              : [];

          if (field.isVisible && !field.isVisible(values, resolvedOptions)) {
            return null;
          }

          if (field.type === 'textarea') {
            return (
              <div key={field.name} className="space-y-1">
                <label
                  htmlFor={fieldId}
                  className="block text-sm font-medium text-graphite-700 dark:text-graphite-100"
                >
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <textarea
                  id={fieldId}
                  name={field.name}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={event => handleChange(field.name, event.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-900 text-sm text-graphite-900 dark:text-graphite-100 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:border-blue-400 dark:focus:ring-blue-500/40 min-h-[120px] resize-vertical"
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
            const uniqueOptions = Array.from(
              new Set(
                optionValues.filter(
                  option => typeof option === 'string' && option.trim().length > 0
                )
              )
            ) as string[];
            const selectOptions = uniqueOptions.map(option => ({ value: option, label: option }));

            return (
              <div key={field.name} className="space-y-1">
                <label
                  htmlFor={fieldId}
                  className="block text-sm font-medium text-graphite-700 dark:text-graphite-100"
                >
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <Select
                  key={field.name}
                  label={field.label}
                  hideLabel
                  placeholder={field.placeholder || 'Select an option'}
                  value={value ? value : undefined}
                  onChange={nextValue => {
                    const normalized = Array.isArray(nextValue)
                      ? (nextValue[0] ?? '')
                      : ((nextValue as string | undefined) ?? '');
                    handleChange(field.name, normalized);
                  }}
                  options={selectOptions}
                  disabled={selectOptions.length === 0}
                  fullWidth
                  className="bg-white dark:bg-graphite-900 text-graphite-900 dark:text-graphite-100 border border-gray-300 dark:border-graphite-600 hover:border-graphite-400 dark:hover:border-graphite-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  dropdownClassName="bg-white dark:bg-graphite-900 text-graphite-900 dark:text-graphite-100 border border-gray-200 dark:border-graphite-700"
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
            value,
            onChange: (event: ChangeEvent<HTMLInputElement>) =>
              handleChange(field.name, event.target.value),
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
          <Button type="submit">Add {toSingularLabel(groupLabel, entityType)}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default AddEntityModal;
