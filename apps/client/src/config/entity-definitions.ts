import { buildServiceFieldConfig } from "@/components/modals/serviceFields";
import type { SelectOption } from "@/design-system/components/Select";
import type { FieldConfig, FieldValue, UiOptionCatalog } from "@/types/forms";

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

const moduleTypeEquals = (values: Record<string, FieldValue>, type: string): boolean =>
  (values["moduleType"] ?? "").toString().trim().toLowerCase() === type;

const infraCategoryEquals = (values: Record<string, FieldValue>, category: string): boolean =>
  (values["category"] ?? "").toString().trim().toLowerCase() === category;

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

const normalizeSelectOptions = (options: unknown[]): Array<string | SelectOption> => {
  if (!Array.isArray(options)) return [];
  return options.filter(
    (option) => typeof option === "string" || (option && typeof option === "object"),
  ) as Array<string | SelectOption>;
};

export const ENTITY_DEFINITIONS = (catalog: UiOptionCatalog): Record<string, FieldConfig[]> => {
  const frontendFrameworks =
    normalizeSelectOptions(catalog.frontendFrameworks ?? []).filter(
      (entry): entry is string => typeof entry === "string",
    ) || FALLBACK_FRONTEND_FRAMEWORKS;

  const databaseEngines =
    normalizeSelectOptions(catalog.databaseEngines ?? []).filter(
      (entry): entry is string => typeof entry === "string",
    ) || FALLBACK_DATABASE_ENGINES;

  const infrastructureScopes =
    normalizeSelectOptions(catalog.infrastructureScopes ?? []).filter(
      (entry): entry is string => typeof entry === "string",
    ) || FALLBACK_INFRASTRUCTURE_SCOPES;

  return {
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
};

export const buildFieldConfig = (entityType: string, catalog: UiOptionCatalog): FieldConfig[] => {
  const configs = ENTITY_DEFINITIONS(catalog);
  const result = configs[entityType] ?? buildDefaultFields(entityType);
  return applyMarkdownSupport(result);
};
