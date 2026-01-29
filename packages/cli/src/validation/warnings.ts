/**
 * @packageDocumentation
 * Validation Warning System
 *
 * This module provides a comprehensive warning system that checks CUE specifications
 * for completeness and forces agents to create detailed, production-ready specs.
 *
 * Warnings block generation unless --force flag is used.
 */

import {
  resolveServiceArtifactType,
  resolveServiceWorkload,
} from "@/utils/api/service-metadata.js";
import chalk from "chalk";

/** Supported HTTP methods for path validation */
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

/** Normalized spec interface for validation */
interface NormalizedSpec {
  product?: { name?: string; goals?: string[] };
  metadata?: { name?: string; version?: string; description?: string };
  services?: Record<string, any>;
  clients?: Record<string, any>;
  paths?: Record<string, any>;
  contracts?: Record<string, any>;
  ui?: { routes?: any[] };
  tests?: any[];
  groups?: any[];
  security?: any;
  performance?: any;
  observability?: any;
  environments?: any;
  locators?: any;
  data?: any;
  docs?: any;
  relationships?: Record<string, any>;
}

/** Validation warning or error structure */
export interface ValidationWarning {
  category: string;
  severity: "warning" | "error";
  message: string;
  suggestion: string;
  path?: string;
}

/** Result of specification validation */
export interface ValidationResult {
  hasWarnings: boolean;
  hasErrors: boolean;
  warnings: ValidationWarning[];
  errors: ValidationWarning[];
}

/**
 * Main validation function - checks all warning categories
 */
export function validateSpecification(spec: any): ValidationResult {
  const warnings: ValidationWarning[] = [];

  // Normalize spec to ensure we have a consistent interface
  const normalizedSpec = normalizeSpec(spec);

  // Run all validators
  warnings.push(...validateTestDefinitions(normalizedSpec));
  warnings.push(...validateGroupsAndIssues(normalizedSpec));
  warnings.push(...validateServiceCompleteness(normalizedSpec));
  warnings.push(...validateOrphanServices(normalizedSpec));
  warnings.push(...validateDocumentation(normalizedSpec));
  warnings.push(...validateSecurity(normalizedSpec));
  warnings.push(...validatePerformanceSpecs(normalizedSpec));
  warnings.push(...validateUICompleteness(normalizedSpec));
  warnings.push(...validateDataManagement(normalizedSpec));
  warnings.push(...validateObservability(normalizedSpec));
  warnings.push(...validateEnvironmentConfig(normalizedSpec));
  warnings.push(...validatePathGrouping(normalizedSpec));
  warnings.push(...validateEndpointReferences(normalizedSpec));
  warnings.push(...validateContractImplementations(spec, normalizedSpec));

  const errors = warnings.filter((w) => w.severity === "error");
  const warningList = warnings.filter((w) => w.severity === "warning");

  return {
    hasWarnings: warningList.length > 0,
    hasErrors: errors.length > 0,
    warnings: warningList,
    errors,
  };
}

/** Normalize any spec format to a consistent interface */
function normalizeSpec(spec: any): NormalizedSpec {
  if (!spec) return {};

  // Handle services being stored as either 'services' or 'packages' due to schema mapping
  const services = spec.services ?? spec.packages;

  return {
    product: spec.product,
    metadata: spec.metadata,
    services,
    clients: spec.clients,
    paths: spec.paths,
    contracts: spec.contracts,
    ui: spec.ui,
    tests: spec.tests,
    groups: spec.groups,
    security: spec.security,
    performance: spec.performance,
    observability: spec.observability,
    environments: spec.environments,
    locators: spec.locators,
    data: spec.data,
    docs: spec.docs,
    relationships: spec.relationships,
  };
}

/** Create a validation warning with the given properties */
function createWarning(
  category: string,
  message: string,
  suggestion: string,
  path?: string,
  severity: "warning" | "error" = "warning",
): ValidationWarning {
  return { category, severity, message, suggestion, path };
}

/** Check if a test type exists in the test suite */
function hasTestType(tests: any[], type: string): boolean {
  return tests.some((t) => t.type === type);
}

/** Check for missing test types (unit, integration, e2e) */
function checkMissingTestTypes(tests: any[]): ValidationWarning[] {
  const checks = [
    {
      type: "unit",
      message: "Missing unit tests",
      suggestion: "Add unit test suite to validate individual components",
    },
    {
      type: "integration",
      message: "Missing integration tests",
      suggestion: "Add integration test suite to validate service interactions",
    },
    {
      type: "e2e",
      message: "Missing end-to-end tests",
      suggestion: "Add e2e test suite to validate complete user workflows",
    },
  ];
  return checks
    .filter(({ type }) => !hasTestType(tests, type))
    .map(({ message, suggestion }) => createWarning("Testing", message, suggestion, "tests"));
}

/** Check for test suites without test cases */
function checkEmptyTestSuites(tests: any[]): ValidationWarning[] {
  return tests
    .filter((suite) => !suite.cases?.length)
    .map((suite, idx) =>
      createWarning(
        "Testing",
        `Test suite '${suite.name}' has no test cases`,
        "Add specific test cases with clear assertions",
        `tests[${idx}].cases`,
      ),
    );
}

/** Validate test definitions for completeness */
function validateTestDefinitions(spec: NormalizedSpec): ValidationWarning[] {
  if (!spec.tests?.length) {
    return [
      createWarning(
        "Testing",
        "No test suites defined",
        "Add comprehensive test coverage with unit, integration, and e2e tests",
        "tests",
      ),
    ];
  }
  return [...checkMissingTestTypes(spec.tests), ...checkEmptyTestSuites(spec.tests)];
}

/** Check if a service is a source (buildable) service */
function isSourceService(service: any): boolean {
  return (
    resolveServiceWorkload(service) === "deployment" &&
    resolveServiceArtifactType(service) === "internal" &&
    !service.image
  );
}

/** Find all source services in the service map */
function findSourceServices(services: Record<string, any>): [string, any][] {
  return Object.entries(services || {}).filter(([, service]) => isSourceService(service));
}

/**
 * Check if groups array has groups with tasks.
 * @param groups - Array of groups to check
 * @returns Object indicating if groups and tasks exist
 */
function hasGroupsWithTasks(groups: any[]): { hasGroups: boolean; hasTasks: boolean } {
  const hasGroups = groups?.length > 0;
  const hasTasks = groups?.some((g) => g.tasks?.length > 0);
  return { hasGroups, hasTasks };
}

/**
 * Check if a service has a corresponding group in the groups array.
 * @param serviceName - Name of the service
 * @param groups - Array of groups to search
 * @returns True if a corresponding group exists
 */
function serviceHasCorrespondingGroup(serviceName: string, groups: any[]): boolean {
  return (
    groups?.some(
      (g) =>
        g.name?.toLowerCase().includes(serviceName.toLowerCase()) ||
        g.description?.toLowerCase().includes(serviceName.toLowerCase()),
    ) ?? false
  );
}

/**
 * Check for missing project management elements.
 * @param sourceServices - Array of source services
 * @param groupStatus - Object indicating group and task status
 * @returns Array of validation warnings
 */
function checkMissingProjectManagement(
  sourceServices: [string, any][],
  groupStatus: { hasGroups: boolean; hasTasks: boolean },
): ValidationWarning[] {
  const serviceNames = sourceServices.map(([n]) => n).join(", ");
  const warnings: ValidationWarning[] = [];
  if (!groupStatus.hasGroups)
    warnings.push(
      createWarning(
        "Project Management",
        "Source services found but no groups defined",
        `Add groups to track implementation of custom services: ${serviceNames}`,
        "groups",
      ),
    );
  if (!groupStatus.hasTasks)
    warnings.push(
      createWarning(
        "Project Management",
        "Source services found but no implementation tasks defined",
        `Add detailed tasks with dependencies for implementing: ${serviceNames}`,
        "groups[].tasks",
      ),
    );
  return warnings;
}

/**
 * Check if all source services have corresponding groups.
 * @param sourceServices - Array of source services
 * @param groups - Array of groups
 * @returns Array of validation warnings for uncovered services
 */
function checkServiceGroupCoverage(
  sourceServices: [string, any][],
  groups: any[],
): ValidationWarning[] {
  return sourceServices
    .filter(([name]) => !serviceHasCorrespondingGroup(name, groups))
    .map(([name]) =>
      createWarning(
        "Project Management",
        `Source service '${name}' has no corresponding group`,
        `Add group for implementing ${name} service with detailed tasks`,
        `services.${name}`,
      ),
    );
}

/**
 * Validate groups and issues in the specification.
 * @param spec - Normalized specification
 * @returns Array of validation warnings
 */
function validateGroupsAndIssues(spec: NormalizedSpec): ValidationWarning[] {
  const sourceServices = findSourceServices(spec.services || {});
  if (sourceServices.length === 0) return [];
  const groupStatus = hasGroupsWithTasks(spec.groups || []);
  return [
    ...checkMissingProjectManagement(sourceServices, groupStatus),
    ...checkServiceGroupCoverage(sourceServices, spec.groups || []),
  ];
}

/** Configuration for a service validation check */
interface ServiceCheck {
  condition: (service: any) => boolean;
  message: (name: string) => string;
  suggestion: string;
  pathSuffix: string;
}

/** List of service validation checks */
const SERVICE_CHECKS: ServiceCheck[] = [
  {
    condition: (s) => !s.language,
    message: (n) => `Service '${n}' missing language specification`,
    suggestion: "Specify the programming language (typescript, python, rust, go, etc.)",
    pathSuffix: "language",
  },
  {
    condition: (s) => !s.ports?.length,
    message: (n) => `Service '${n}' has no port definitions`,
    suggestion: "Define exposed ports with protocol and target port",
    pathSuffix: "ports",
  },
  {
    condition: (s) => resolveServiceArtifactType(s) === "internal" && !s.healthCheck,
    message: (n) => `Source service '${n}' missing health check configuration`,
    suggestion: "Add health check endpoint and configuration for monitoring",
    pathSuffix: "healthCheck",
  },
  {
    condition: (s) => !s.resources,
    message: (n) => `Service '${n}' missing resource specifications`,
    suggestion: "Define CPU and memory limits for proper resource management",
    pathSuffix: "resources",
  },
  {
    condition: (s) =>
      resolveServiceArtifactType(s) === "internal" && !Object.keys(s.env || {}).length,
    message: (n) => `Source service '${n}' missing environment configuration`,
    suggestion: "Define environment variables for configuration management",
    pathSuffix: "env",
  },
];

/**
 * Validate a single service against all service checks.
 * @param serviceName - Name of the service
 * @param service - Service configuration object
 * @returns Array of validation warnings for the service
 */
function validateSingleService(serviceName: string, service: any): ValidationWarning[] {
  const basePath = `services.${serviceName}`;
  return SERVICE_CHECKS.filter(({ condition }) => condition(service)).map(
    ({ message, suggestion, pathSuffix }) =>
      createWarning(
        "Service Definition",
        message(serviceName),
        suggestion,
        `${basePath}.${pathSuffix}`,
      ),
  );
}

/**
 * Validate completeness of all services in the specification.
 * @param spec - Normalized specification
 * @returns Array of validation warnings
 */
function validateServiceCompleteness(spec: NormalizedSpec): ValidationWarning[] {
  return Object.entries(spec.services || {}).flatMap(([name, service]) =>
    validateSingleService(name, service),
  );
}

/**
 * Collect all service names that are targets of relationships.
 * @param relationships - Relationships map from spec
 * @returns Set of service names that have dependents
 */
function collectServicesWithDependents(
  relationships: Record<string, any> | undefined,
): Set<string> {
  const servicesWithDependents = new Set<string>();

  if (!relationships) return servicesWithDependents;

  for (const rel of Object.values(relationships)) {
    if (!rel || typeof rel !== "object") continue;

    // The "to" field indicates the target of the relationship
    // If something points TO a service, that service has a dependent
    if (typeof rel.to === "string") {
      servicesWithDependents.add(rel.to);
    }
  }

  return servicesWithDependents;
}

/**
 * Check if a service should be validated for orphan status.
 * Only external services are excluded - they're consumed from outside our system.
 * @param service - Service configuration
 * @returns True if service should be checked for dependents
 */
function shouldCheckForDependents(service: any): boolean {
  // Skip external services - they're consumed from outside our system boundary
  if (service.external) return false;

  return true;
}

/**
 * Validate that services have at least one dependent (client or other service).
 * Warns about "orphan" services that nothing depends on.
 * @param spec - Normalized specification
 * @returns Array of validation warnings for orphan services
 */
function validateOrphanServices(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const services = spec.services || {};
  const serviceNames = Object.keys(services);

  // No services means nothing to validate
  if (serviceNames.length === 0) return warnings;

  // Collect services that have dependents via relationships
  const servicesWithDependents = collectServicesWithDependents(spec.relationships);

  // Check each service for orphan status
  for (const [serviceName, service] of Object.entries(services)) {
    if (!shouldCheckForDependents(service)) continue;

    if (!servicesWithDependents.has(serviceName)) {
      warnings.push(
        createWarning(
          "Service Architecture",
          `Service '${serviceName}' has no dependents - nothing uses this service`,
          `Add a relationship showing which clients or services depend on '${serviceName}', or verify this service is needed`,
          `services.${serviceName}`,
        ),
      );
    }
  }

  return warnings;
}

/**
 * Check for missing product goals
 */
function checkMissingProductGoals(spec: NormalizedSpec): ValidationWarning | null {
  if (!spec.product?.goals || spec.product.goals.length === 0) {
    return createWarning(
      "Documentation",
      "Missing product goals and objectives",
      "Define clear product goals to guide development decisions",
      "product.goals",
    );
  }
  return null;
}

/**
 * Check for missing project description
 */
function checkMissingDescription(spec: NormalizedSpec): ValidationWarning | null {
  if (!spec.metadata?.description) {
    return createWarning(
      "Documentation",
      "Missing project description",
      "Add comprehensive project description in metadata",
      "metadata.description",
    );
  }
  return null;
}

/**
 * Check if spec has API services
 */
function hasApiServices(services: Record<string, any> | undefined): boolean {
  return Object.values(services || {}).some((s) =>
    s.ports?.some((p: any) => p.name?.includes("http") || p.name?.includes("api")),
  );
}

/**
 * Check for missing API documentation
 */
function checkMissingApiDocs(spec: NormalizedSpec): ValidationWarning | null {
  if (hasApiServices(spec.services) && (!spec.docs || !spec.docs.api)) {
    return createWarning(
      "Documentation",
      "API services found but no API documentation specified",
      "Add API documentation configuration (OpenAPI, endpoints, etc.)",
      "docs.api",
    );
  }
  return null;
}

/**
 * Check for missing documentation
 */
function validateDocumentation(spec: NormalizedSpec): ValidationWarning[] {
  const checks = [
    checkMissingProductGoals(spec),
    checkMissingDescription(spec),
    checkMissingApiDocs(spec),
  ];

  return checks.filter((w): w is ValidationWarning => w !== null);
}

/**
 * Check for security configurations
 */
function validateSecurity(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for missing authentication on UI routes
  if (spec.ui?.routes && spec.ui.routes.length > 0) {
    const unprotectedRoutes = spec.ui.routes.filter(
      (route) => route.capabilities?.includes("admin") && !route.requiresAuth,
    );

    if (unprotectedRoutes.length > 0) {
      warnings.push({
        category: "Security",
        severity: "warning",
        message: "Admin routes found without authentication requirements",
        suggestion: `Add requiresAuth: true to admin routes: ${unprotectedRoutes.map((r) => r.path).join(", ")}`,
        path: "ui.routes",
      });
    }
  }

  // Check for missing security configuration
  if (!spec.security) {
    warnings.push({
      category: "Security",
      severity: "warning",
      message: "Missing security configuration",
      suggestion: "Define authentication, authorization, and security policies",
      path: "security",
    });
  }

  return warnings;
}

/**
 * Check for performance specifications
 */
function validatePerformanceSpecs(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!spec.performance) {
    warnings.push({
      category: "Performance",
      severity: "warning",
      message: "Missing performance specifications",
      suggestion: "Define SLAs, response time targets, and throughput requirements",
      path: "performance",
    });
  }

  // Check services for missing performance configuration
  Object.entries(spec.services || {}).forEach(([serviceName, service]) => {
    if (resolveServiceArtifactType(service) === "internal" && !service.resources?.limits) {
      warnings.push({
        category: "Performance",
        severity: "warning",
        message: `Service '${serviceName}' missing resource limits`,
        suggestion: "Define CPU and memory limits for performance predictability",
        path: `services.${serviceName}.resources.limits`,
      });
    }
  });

  return warnings;
}

/**
 * Check UI completeness
 */
/**
 * Validate a single route for completeness
 */
function validateRoute(route: any, idx: number): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const basePath = `ui.routes[${idx}]`;

  if (!route.components || route.components.length === 0) {
    warnings.push(
      createWarning(
        "UI Design",
        `Route '${route.path}' missing component specifications`,
        "Define UI components needed for this route",
        `${basePath}.components`,
      ),
    );
  }

  if (!route.capabilities || route.capabilities.length === 0) {
    warnings.push(
      createWarning(
        "UI Design",
        `Route '${route.path}' missing capability definitions`,
        "Define user capabilities/permissions for this route",
        `${basePath}.capabilities`,
      ),
    );
  }

  return warnings;
}

/**
 * Check if locators are missing when routes are defined
 */
function checkMissingLocators(spec: NormalizedSpec): ValidationWarning[] {
  if (!spec.locators || Object.keys(spec.locators).length === 0) {
    return [
      createWarning(
        "UI Design",
        "UI routes defined but no test locators specified",
        "Add CSS selectors/test IDs for automated testing",
        "locators",
      ),
    ];
  }
  return [];
}

function validateUICompleteness(spec: NormalizedSpec): ValidationWarning[] {
  if (!spec.ui?.routes || spec.ui.routes.length === 0) {
    return [];
  }

  const routeWarnings = spec.ui.routes.flatMap((route, idx) => validateRoute(route, idx));
  const locatorWarnings = checkMissingLocators(spec);

  return [...routeWarnings, ...locatorWarnings];
}

/**
 * Check if a service is a database service
 */
function isDatabaseService(service: any): boolean {
  if (!service || typeof service !== "object") {
    return false;
  }
  const image = typeof service.image === "string" ? service.image.toLowerCase() : "";
  const resourceKind =
    typeof service.resource?.kind === "string" ? service.resource.kind.toLowerCase() : "";

  return (
    image.includes("postgres") ||
    image.includes("mysql") ||
    image.includes("mongo") ||
    resourceKind === "database"
  );
}

/**
 * Check if spec has any database services
 */
function hasDatabaseServices(services: Record<string, any> | undefined): boolean {
  return Object.values(services || {}).some(isDatabaseService);
}

/**
 * Check data management completeness
 */
function validateDataManagement(spec: NormalizedSpec): ValidationWarning[] {
  if (!hasDatabaseServices(spec.services)) {
    return [];
  }

  const warnings: ValidationWarning[] = [];

  if (!spec.data) {
    warnings.push(
      createWarning(
        "Data Management",
        "Database services found but no data schema defined",
        "Add data models, migrations, and backup strategies",
        "data",
      ),
    );
  }

  if (!spec.data?.migrations) {
    warnings.push(
      createWarning(
        "Data Management",
        "Database services found but no migration strategy defined",
        "Define database migration and versioning approach",
        "data.migrations",
      ),
    );
  }

  return warnings;
}

/**
 * Validate path grouping in the specification.
 * @param spec - Normalized specification
 * @returns Array of validation warnings for path grouping issues
 */
function validatePathGrouping(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const services = spec.services || {};
  const paths = spec.paths || {};

  for (const [groupKey, definition] of Object.entries(paths)) {
    if (isPathSpecCandidate(definition)) {
      warnings.push({
        category: "API Design",
        severity: "warning",
        message: "Paths should be grouped under the owning service to avoid collisions.",
        suggestion: `Nest operations under 'paths.${groupKey}.${String(groupKey).split(".").pop()}/<path>' grouped by service name.`,
        path: `paths.${groupKey}`,
      });
      continue;
    }

    if (!services[groupKey]) {
      warnings.push({
        category: "API Design",
        severity: "error",
        message: `Path group '${groupKey}' does not match any defined service.`,
        suggestion:
          "Create the service or move these operations under an existing service's path group.",
        path: `paths.${groupKey}`,
      });
    }
  }

  return warnings;
}

/**
 * Check observability configuration
 */
function validateObservability(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const hasServices = Object.keys(spec.services || {}).length > 0;

  if (hasServices && !spec.observability) {
    warnings.push({
      category: "Observability",
      severity: "warning",
      message: "Services defined but no observability configuration",
      suggestion: "Add logging, monitoring, and alerting configuration",
      path: "observability",
    });
  }

  if (hasServices && !spec.observability?.logging) {
    warnings.push({
      category: "Observability",
      severity: "warning",
      message: "Missing logging configuration",
      suggestion: "Define log levels, formats, and aggregation strategy",
      path: "observability.logging",
    });
  }

  if (hasServices && !spec.observability?.monitoring) {
    warnings.push({
      category: "Observability",
      severity: "warning",
      message: "Missing monitoring configuration",
      suggestion: "Define metrics collection and health monitoring",
      path: "observability.monitoring",
    });
  }

  return warnings;
}

/**
 * Check environment configuration
 */
function validateEnvironmentConfig(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for missing environment definitions
  if (!spec.environments || Object.keys(spec.environments).length === 0) {
    warnings.push({
      category: "Environment Config",
      severity: "warning",
      message: "Missing environment configurations",
      suggestion: "Define development, staging, and production environments",
      path: "environments",
    });
  } else {
    const requiredEnvs = ["development", "production"];
    const definedEnvs = Object.keys(spec.environments);

    requiredEnvs.forEach((env) => {
      if (!definedEnvs.includes(env)) {
        warnings.push({
          category: "Environment Config",
          severity: "warning",
          message: `Missing ${env} environment configuration`,
          suggestion: `Add ${env} environment with proper configuration`,
          path: `environments.${env}`,
        });
      }
    });
  }

  return warnings;
}

/**
 * Validate that all contract references in the specification are implemented.
 * @param rawSpec - Raw specification object
 * @param spec - Normalized specification
 * @returns Array of validation warnings for missing contract implementations
 */
function validateContractImplementations(rawSpec: any, spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const root = rawSpec ?? {};
  const services = spec.services || {};

  const reportMissing = (reference: string, path: string) => {
    warnings.push({
      category: "Contracts",
      severity: "error",
      message: `Contract reference '${reference}' was not found.`,
      suggestion: "Define the contract under the contracts section or update the implements path.",
      path,
    });
  };

  validateServiceContractRefs(services, root, reportMissing);
  validatePathOperationContracts(spec.paths, root, reportMissing);

  return warnings;
}

/**
 * Validate contract references in service definitions.
 * @param services - Map of services
 * @param root - Root specification object
 * @param reportMissing - Callback to report missing references
 */
function validateServiceContractRefs(
  services: Record<string, any>,
  root: any,
  reportMissing: (ref: string, path: string) => void,
): void {
  for (const [serviceName, service] of Object.entries(services)) {
    if (!service || typeof service !== "object") continue;

    const basePath = `services.${serviceName}`;
    validateServiceApiRefs(service, root, basePath, reportMissing);
    validateEndpointContractRefs(service.endpoints, root, basePath, reportMissing);
  }
}

/**
 * Validate API references in a service.
 * @param service - Service object
 * @param root - Root specification object
 * @param basePath - Base path for error reporting
 * @param reportMissing - Callback to report missing references
 */
function validateServiceApiRefs(
  service: any,
  root: any,
  basePath: string,
  reportMissing: (ref: string, path: string) => void,
): void {
  const serviceApis = service.implements?.apis;
  if (!Array.isArray(serviceApis)) return;

  serviceApis.forEach((reference: unknown, index: number) => {
    if (typeof reference === "string" && !resolveContractReference(root, reference)) {
      reportMissing(reference, `${basePath}.implements.apis[${index}]`);
    }
  });
}

/**
 * Validate contract references in endpoint definitions.
 * @param endpoints - Endpoints object
 * @param root - Root specification object
 * @param basePath - Base path for error reporting
 * @param reportMissing - Callback to report missing references
 */
function validateEndpointContractRefs(
  endpoints: any,
  root: any,
  basePath: string,
  reportMissing: (ref: string, path: string) => void,
): void {
  if (!endpoints || typeof endpoints !== "object") return;

  for (const [endpointId, endpointSpec] of Object.entries(endpoints)) {
    if (!endpointSpec || typeof endpointSpec !== "object") continue;

    const reference = (endpointSpec as Record<string, unknown>).implements;
    if (typeof reference === "string" && !resolveContractReference(root, reference)) {
      reportMissing(reference, `${basePath}.endpoints.${endpointId}.implements`);
    }
  }
}

/**
 * Validate contract references in path operations.
 * @param paths - Paths object
 * @param root - Root specification object
 * @param reportMissing - Callback to report missing references
 */
function validatePathOperationContracts(
  paths: any,
  root: any,
  reportMissing: (ref: string, path: string) => void,
): void {
  forEachPathOperation(paths, (operation, contextPath) => {
    const reference = operation?.implements;
    if (typeof reference === "string" && !resolveContractReference(root, reference)) {
      reportMissing(reference, `${contextPath}.implements`);
    }
  });
}

/**
 * Check if a handler is an endpoint handler.
 * @param handler - Handler object
 * @returns True if the handler is an endpoint handler
 */
function isEndpointHandler(handler: any): boolean {
  return handler && typeof handler === "object" && handler.type === "endpoint";
}

/**
 * Create a handler validator function.
 * @param services - Map of services
 * @param warnings - Array to collect warnings
 * @returns Validator function for handlers
 */
function createHandlerValidator(
  services: Record<string, any>,
  warnings: ValidationWarning[],
): (handler: any, contextPath: string) => void {
  return (handler, contextPath) => {
    if (!isEndpointHandler(handler)) return;

    const serviceWarning = validateHandlerService(handler, services, contextPath);
    if (serviceWarning) {
      warnings.push(serviceWarning);
      return;
    }

    const endpointWarning = validateHandlerEndpoint(handler, services, contextPath);
    if (endpointWarning) {
      warnings.push(endpointWarning);
    }
  };
}

/**
 * Validate that a handler references an existing service.
 * @param handler - Handler object
 * @param services - Map of services
 * @param contextPath - Context path for error reporting
 * @returns Validation warning if service is missing, null otherwise
 */
function validateHandlerService(
  handler: any,
  services: Record<string, any>,
  contextPath: string,
): ValidationWarning | null {
  const targetService = handler.service;
  if (typeof targetService !== "string" || !services[targetService]) {
    return {
      category: "API Design",
      severity: "error",
      message: `Handler references unknown service '${targetService ?? "undefined"}'.`,
      suggestion: "Update the handler to reference an existing service.",
      path: `${contextPath}.handler.service`,
    };
  }
  return null;
}

/**
 * Validate that a handler references an existing endpoint.
 * @param handler - Handler object
 * @param services - Map of services
 * @param contextPath - Context path for error reporting
 * @returns Validation warning if endpoint is missing, null otherwise
 */
function validateHandlerEndpoint(
  handler: any,
  services: Record<string, any>,
  contextPath: string,
): ValidationWarning | null {
  const { service: targetService, endpoint: targetEndpoint } = handler;
  const endpointMap = services[targetService]?.endpoints;
  const isInvalidEndpoint =
    !endpointMap || typeof endpointMap !== "object" || !(targetEndpoint in endpointMap);

  if (isInvalidEndpoint) {
    return {
      category: "API Design",
      severity: "error",
      message: `Handler references unknown endpoint '${targetEndpoint ?? "undefined"}' on service '${targetService}'.`,
      suggestion: "Ensure the endpoint exists under services.<name>.endpoints.",
      path: `${contextPath}.handler.endpoint`,
    };
  }
  return null;
}

/**
 * Extract handler from an object.
 * @param obj - Object to extract handler from
 * @returns Handler object or undefined
 */
function extractHandler(obj: any): any {
  return obj && typeof obj === "object" ? (obj as Record<string, any>).handler : undefined;
}

/**
 * Validate endpoint references in the specification.
 * @param spec - Normalized specification
 * @returns Array of validation warnings
 */
function validateEndpointReferences(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const services = spec.services || {};
  const validateHandlerReference = createHandlerValidator(services, warnings);

  for (const [serviceName, service] of Object.entries(services)) {
    const endpoints = service?.endpoints;
    if (!endpoints || typeof endpoints !== "object") continue;

    for (const [endpointId, endpointSpec] of Object.entries(endpoints)) {
      const handler = extractHandler(endpointSpec);
      validateHandlerReference(handler, `services.${serviceName}.endpoints.${endpointId}`);
    }
  }

  forEachPathOperation(spec.paths, (operation, contextPath) => {
    validateHandlerReference(extractHandler(operation), contextPath);
  });

  return warnings;
}

/**
 * Resolve a contract reference path in the specification.
 * @param root - Root specification object
 * @param reference - Reference path string
 * @returns True if the reference resolves to a valid value
 */
function resolveContractReference(root: any, reference: string): boolean {
  if (!reference) return true;
  let current: any = root;
  const segments = reference.split(".").filter(Boolean);

  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return false;
    }
    current = current[segment];
  }

  return true;
}

/**
 * Check if a value is a path specification candidate.
 * @param value - Value to check
 * @returns True if the value is a path specification candidate
 */
function isPathSpecCandidate(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }
  return HTTP_METHODS.some((method) => Object.prototype.hasOwnProperty.call(value, method));
}

/**
 * Iterate over all path operations in the specification.
 * @param paths - Paths object
 * @param iterate - Callback for each operation
 */
/**
 * Visit all HTTP method operations in a path spec
 */
function visitPathSpec(
  pathSpec: Record<string, any>,
  contextBase: string,
  iterate: (operation: Record<string, any>, contextPath: string) => void,
): void {
  for (const method of HTTP_METHODS) {
    const operation = pathSpec[method];
    if (operation && typeof operation === "object") {
      iterate(operation as Record<string, any>, `${contextBase}.${method}`);
    }
  }
}

/**
 * Process nested path group entries
 */
function processNestedPathGroup(
  groupKey: string,
  value: Record<string, any>,
  iterate: (operation: Record<string, any>, contextPath: string) => void,
): void {
  for (const [pathKey, pathSpec] of Object.entries(value)) {
    if (isPathSpecCandidate(pathSpec)) {
      visitPathSpec(pathSpec as Record<string, any>, `paths.${groupKey}.${pathKey}`, iterate);
    }
  }
}

function forEachPathOperation(
  paths: Record<string, any> | undefined,
  iterate: (operation: Record<string, any>, contextPath: string) => void,
): void {
  if (!paths || typeof paths !== "object") {
    return;
  }

  for (const [groupKey, value] of Object.entries(paths)) {
    if (isPathSpecCandidate(value)) {
      visitPathSpec(value as Record<string, any>, `paths.${groupKey}`, iterate);
      continue;
    }

    if (value && typeof value === "object") {
      processNestedPathGroup(groupKey, value as Record<string, any>, iterate);
    }
  }
}

/**
 * Format a single validation item for display.
 * @param item - Validation warning item
 * @param colorFn - Chalk color function
 * @returns Array of formatted lines
 */
function formatValidationItem(item: ValidationWarning, colorFn: typeof chalk.red): string[] {
  const lines = [
    colorFn(`  • ${item.category}: ${item.message}`),
    chalk.gray(`    ${item.suggestion}`),
  ];
  if (item.path) lines.push(chalk.gray(`    Path: ${item.path}`));
  return lines;
}

/**
 * Format a section of validation items for display.
 * @param header - Section header
 * @param items - Validation warnings
 * @param colorFn - Chalk color function
 * @returns Array of formatted lines
 */
function formatSection(
  header: string,
  items: ValidationWarning[],
  colorFn: typeof chalk.red,
): string[] {
  if (items.length === 0) return [];
  return [colorFn.bold(header), ...items.flatMap((item) => formatValidationItem(item, colorFn))];
}

/**
 * Format the agent notice for display.
 * @returns Array of formatted notice lines
 */
function formatAgentNotice(): string[] {
  return [
    chalk.blue.bold("\n💡 Use --force to generate anyway"),
    chalk.red.bold("\n🚨 IMPORTANT FOR AI AGENTS:"),
    chalk.yellow(
      "IF YOU NEED INFORMATION TO COMPLETE THE SPEC, ASK THE PRODUCT OWNER (USER) FOR IT.",
    ),
    chalk.yellow("YOU MUST REQUEST APPROVAL FROM THE USER BEFORE USING `--force`."),
  ];
}

/**
 * Format validation warnings and errors for display.
 * @param result - Validation result object
 * @returns Formatted string of warnings and errors
 */
export function formatWarnings(result: ValidationResult): string {
  const sections = [
    formatSection("\n❌ ERRORS (must fix):", result.errors, chalk.red),
    formatSection("\n⚠️  WARNINGS (recommend fixing):", result.warnings, chalk.yellow),
  ];
  const hasIssues = result.hasWarnings || result.hasErrors;
  return [...sections.flat(), ...(hasIssues ? formatAgentNotice() : [])].join("\n");
}
