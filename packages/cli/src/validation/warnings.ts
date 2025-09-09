/**
 * Validation Warning System
 * 
 * This module provides a comprehensive warning system that checks CUE specifications
 * for completeness and forces agents to create detailed, production-ready specs.
 * 
 * Warnings block generation unless --force flag is used.
 */

import chalk from "chalk";

// Normalized spec interface for validation
interface NormalizedSpec {
  product?: { name?: string; goals?: string[] };
  metadata?: { name?: string; version?: string; description?: string };
  services?: Record<string, any>;
  ui?: { routes?: any[] };
  tests?: any[];
  epics?: any[];
  security?: any;
  performance?: any;
  observability?: any;
  environments?: any;
  locators?: any;
  data?: any;
  docs?: any;
}

export interface ValidationWarning {
  category: string;
  severity: "warning" | "error";
  message: string;
  suggestion: string;
  path?: string;
}

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
  warnings.push(...validateEpicsAndTasks(normalizedSpec));
  warnings.push(...validateServiceCompleteness(normalizedSpec));
  warnings.push(...validateDocumentation(normalizedSpec));
  warnings.push(...validateSecurity(normalizedSpec));
  warnings.push(...validatePerformanceSpecs(normalizedSpec));
  warnings.push(...validateUICompleteness(normalizedSpec));
  warnings.push(...validateDataManagement(normalizedSpec));
  warnings.push(...validateObservability(normalizedSpec));
  warnings.push(...validateEnvironmentConfig(normalizedSpec));

  const errors = warnings.filter(w => w.severity === "error");
  const warningList = warnings.filter(w => w.severity === "warning");

  return {
    hasWarnings: warningList.length > 0,
    hasErrors: errors.length > 0,
    warnings: warningList,
    errors
  };
}

/**
 * Normalize any spec format to a consistent interface
 */
function normalizeSpec(spec: any): NormalizedSpec {
  if (!spec) return {};
  
  return {
    product: spec.product,
    metadata: spec.metadata,
    services: spec.services,
    ui: spec.ui,
    tests: spec.tests,
    epics: spec.epics,
    security: spec.security,
    performance: spec.performance,
    observability: spec.observability,
    environments: spec.environments,
    locators: spec.locators,
    data: spec.data,
    docs: spec.docs
  };
}

/**
 * Check if specification has comprehensive test definitions
 */
function validateTestDefinitions(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for missing test suites
  if (!spec.tests || spec.tests.length === 0) {
    warnings.push({
      category: "Testing",
      severity: "warning",
      message: "No test suites defined",
      suggestion: "Add comprehensive test coverage with unit, integration, and e2e tests",
      path: "tests"
    });
  } else {
    // Check for test coverage completeness
    const hasUnit = spec.tests.some(t => t.type === "unit");
    const hasIntegration = spec.tests.some(t => t.type === "integration");
    const hasE2E = spec.tests.some(t => t.type === "e2e");

    if (!hasUnit) {
      warnings.push({
        category: "Testing",
        severity: "warning", 
        message: "Missing unit tests",
        suggestion: "Add unit test suite to validate individual components",
        path: "tests"
      });
    }

    if (!hasIntegration) {
      warnings.push({
        category: "Testing",
        severity: "warning",
        message: "Missing integration tests", 
        suggestion: "Add integration test suite to validate service interactions",
        path: "tests"
      });
    }

    if (!hasE2E) {
      warnings.push({
        category: "Testing",
        severity: "warning",
        message: "Missing end-to-end tests",
        suggestion: "Add e2e test suite to validate complete user workflows",
        path: "tests"
      });
    }

    // Check for test cases without assertions
    spec.tests.forEach((testSuite, idx) => {
      if (!testSuite.cases || testSuite.cases.length === 0) {
        warnings.push({
          category: "Testing",
          severity: "warning",
          message: `Test suite '${testSuite.name}' has no test cases`,
          suggestion: "Add specific test cases with clear assertions",
          path: `tests[${idx}].cases`
        });
      }
    });
  }

  return warnings;
}

/**
 * Check for missing epics and tasks for source services
 */
function validateEpicsAndTasks(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check if epics/tasks are defined
  const hasEpics = spec.epics && spec.epics.length > 0;
  const hasTasks = spec.epics?.some(epic => epic.tasks && epic.tasks.length > 0);

  // Find source services (not pre-existing containers)
  const sourceServices = Object.entries(spec.services || {})
    .filter(([_, service]) => 
      service.type === "deployment" && 
      service.serviceType === "bespoke" &&
      !service.image // No pre-built image = source code
    );

  if (sourceServices.length > 0) {
    if (!hasEpics) {
      warnings.push({
        category: "Project Management", 
        severity: "warning",
        message: "Source services found but no epics defined",
        suggestion: "Add epics to track implementation of custom services: " + 
                   sourceServices.map(([name]) => name).join(", "),
        path: "epics"
      });
    }

    if (!hasTasks) {
      warnings.push({
        category: "Project Management",
        severity: "warning", 
        message: "Source services found but no implementation tasks defined",
        suggestion: "Add detailed tasks with dependencies for implementing: " +
                   sourceServices.map(([name]) => name).join(", "),
        path: "epics[].tasks"
      });
    }

    // Check each source service has corresponding epic/tasks
    sourceServices.forEach(([serviceName, service]) => {
      const hasServiceEpic = spec.epics?.some(epic => 
        epic.name.toLowerCase().includes(serviceName.toLowerCase()) ||
        epic.description?.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (!hasServiceEpic) {
        warnings.push({
          category: "Project Management",
          severity: "warning",
          message: `Source service '${serviceName}' has no corresponding epic`,
          suggestion: `Add epic for implementing ${serviceName} service with detailed tasks`,
          path: `services.${serviceName}`
        });
      }
    });
  }

  return warnings;
}

/**
 * Check service definitions for completeness  
 */
function validateServiceCompleteness(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  Object.entries(spec.services || {}).forEach(([serviceName, service]) => {
    const basePath = `services.${serviceName}`;

    // Check for missing essential service properties
    if (!service.language) {
      warnings.push({
        category: "Service Definition",
        severity: "warning",
        message: `Service '${serviceName}' missing language specification`,
        suggestion: "Specify the programming language (typescript, python, rust, go, etc.)",
        path: `${basePath}.language`
      });
    }

    if (!service.ports || service.ports.length === 0) {
      warnings.push({
        category: "Service Definition", 
        severity: "warning",
        message: `Service '${serviceName}' has no port definitions`,
        suggestion: "Define exposed ports with protocol and target port",
        path: `${basePath}.ports`
      });
    }

    // Check for missing health checks on source services
    if (service.serviceType === "bespoke" && !service.healthCheck) {
      warnings.push({
        category: "Service Definition",
        severity: "warning",
        message: `Source service '${serviceName}' missing health check configuration`,
        suggestion: "Add health check endpoint and configuration for monitoring",
        path: `${basePath}.healthCheck`
      });
    }

    // Check for missing resource limits
    if (!service.resources) {
      warnings.push({
        category: "Service Definition",
        severity: "warning", 
        message: `Service '${serviceName}' missing resource specifications`,
        suggestion: "Define CPU and memory limits for proper resource management",
        path: `${basePath}.resources`
      });
    }

    // Check for missing environment configuration
    if (service.serviceType === "bespoke" && (!service.env || Object.keys(service.env).length === 0)) {
      warnings.push({
        category: "Service Definition",
        severity: "warning",
        message: `Source service '${serviceName}' missing environment configuration`,
        suggestion: "Define environment variables for configuration management",
        path: `${basePath}.env`
      });
    }
  });

  return warnings;
}

/**
 * Check for missing documentation
 */
function validateDocumentation(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!spec.product?.goals || spec.product.goals.length === 0) {
    warnings.push({
      category: "Documentation",
      severity: "warning",
      message: "Missing product goals and objectives",
      suggestion: "Define clear product goals to guide development decisions",
      path: "product.goals"
    });
  }

  if (!spec.metadata?.description) {
    warnings.push({
      category: "Documentation", 
      severity: "warning",
      message: "Missing project description",
      suggestion: "Add comprehensive project description in metadata",
      path: "metadata.description"
    });
  }

  // Check for missing API documentation
  const hasApiServices = Object.values(spec.services || {}).some(s => 
    s.ports?.some(p => p.name?.includes("http") || p.name?.includes("api"))
  );

  if (hasApiServices && (!spec.docs || !spec.docs.api)) {
    warnings.push({
      category: "Documentation",
      severity: "warning", 
      message: "API services found but no API documentation specified",
      suggestion: "Add API documentation configuration (OpenAPI, endpoints, etc.)",
      path: "docs.api"
    });
  }

  return warnings;
}

/**
 * Check for security configurations
 */
function validateSecurity(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for missing authentication on UI routes
  if (spec.ui?.routes && spec.ui.routes.length > 0) {
    const unprotectedRoutes = spec.ui.routes.filter(route => 
      route.capabilities?.includes("admin") && !route.requiresAuth
    );

    if (unprotectedRoutes.length > 0) {
      warnings.push({
        category: "Security",
        severity: "warning",
        message: "Admin routes found without authentication requirements",
        suggestion: "Add requiresAuth: true to admin routes: " + 
                   unprotectedRoutes.map(r => r.path).join(", "),
        path: "ui.routes"
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
      path: "security"
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
      path: "performance"
    });
  }

  // Check services for missing performance configuration
  Object.entries(spec.services || {}).forEach(([serviceName, service]) => {
    if (service.serviceType === "bespoke" && !service.resources?.limits) {
      warnings.push({
        category: "Performance", 
        severity: "warning",
        message: `Service '${serviceName}' missing resource limits`,
        suggestion: "Define CPU and memory limits for performance predictability",
        path: `services.${serviceName}.resources.limits`
      });
    }
  });

  return warnings;
}

/**
 * Check UI completeness  
 */
function validateUICompleteness(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (spec.ui?.routes && spec.ui.routes.length > 0) {
    spec.ui.routes.forEach((route, idx) => {
      const basePath = `ui.routes[${idx}]`;

      if (!route.components || route.components.length === 0) {
        warnings.push({
          category: "UI Design",
          severity: "warning",
          message: `Route '${route.path}' missing component specifications`,
          suggestion: "Define UI components needed for this route",
          path: `${basePath}.components`
        });
      }

      if (!route.capabilities || route.capabilities.length === 0) {
        warnings.push({
          category: "UI Design",
          severity: "warning",
          message: `Route '${route.path}' missing capability definitions`,
          suggestion: "Define user capabilities/permissions for this route", 
          path: `${basePath}.capabilities`
        });
      }
    });

    // Check for missing locators (test automation)
    if (!spec.locators || Object.keys(spec.locators).length === 0) {
      warnings.push({
        category: "UI Design",
        severity: "warning",
        message: "UI routes defined but no test locators specified",
        suggestion: "Add CSS selectors/test IDs for automated testing",
        path: "locators"
      });
    }
  }

  return warnings;
}

/**
 * Check data management completeness
 */
function validateDataManagement(spec: NormalizedSpec): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for database usage without proper configuration
  const hasDatabaseServices = Object.values(spec.services || {}).some(s =>
    s.image?.includes("postgres") || 
    s.image?.includes("mysql") ||
    s.image?.includes("mongo") ||
    s.serviceType === "database"
  );

  if (hasDatabaseServices) {
    if (!spec.data) {
      warnings.push({
        category: "Data Management",
        severity: "warning", 
        message: "Database services found but no data schema defined",
        suggestion: "Add data models, migrations, and backup strategies",
        path: "data"
      });
    }

    // Check for missing migration strategy
    if (!spec.data?.migrations) {
      warnings.push({
        category: "Data Management",
        severity: "warning",
        message: "Database services found but no migration strategy defined",
        suggestion: "Define database migration and versioning approach",
        path: "data.migrations"
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
      path: "observability"
    });
  }

  if (hasServices && (!spec.observability?.logging)) {
    warnings.push({
      category: "Observability",
      severity: "warning",
      message: "Missing logging configuration",
      suggestion: "Define log levels, formats, and aggregation strategy",
      path: "observability.logging"
    });
  }

  if (hasServices && (!spec.observability?.monitoring)) {
    warnings.push({
      category: "Observability", 
      severity: "warning",
      message: "Missing monitoring configuration",
      suggestion: "Define metrics collection and health monitoring",
      path: "observability.monitoring"
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
      path: "environments"
    });
  } else {
    const requiredEnvs = ["development", "production"];
    const definedEnvs = Object.keys(spec.environments);

    requiredEnvs.forEach(env => {
      if (!definedEnvs.includes(env)) {
        warnings.push({
          category: "Environment Config",
          severity: "warning", 
          message: `Missing ${env} environment configuration`,
          suggestion: `Add ${env} environment with proper configuration`,
          path: `environments.${env}`
        });
      }
    });
  }

  return warnings;
}


/**
 * Format warnings for CLI output
 */
export function formatWarnings(result: ValidationResult): string {
  const lines: string[] = [];
  
  if (result.hasErrors) {
    lines.push(chalk.red.bold("\n❌ ERRORS (must fix):"));
    result.errors.forEach(error => {
      lines.push(chalk.red(`  • ${error.category}: ${error.message}`));
      lines.push(chalk.gray(`    ${error.suggestion}`));
      if (error.path) lines.push(chalk.gray(`    Path: ${error.path}`));
    });
  }
  
  if (result.hasWarnings) {
    lines.push(chalk.yellow.bold("\n⚠️  WARNINGS (recommend fixing):"));
    result.warnings.forEach(warning => {
      lines.push(chalk.yellow(`  • ${warning.category}: ${warning.message}`));
      lines.push(chalk.gray(`    ${warning.suggestion}`));
      if (warning.path) lines.push(chalk.gray(`    Path: ${warning.path}`));
    });
  }

  if (result.hasWarnings || result.hasErrors) {
    lines.push(chalk.blue.bold("\n💡 Use --force to generate anyway"));
    lines.push(chalk.red.bold("\n🚨 IMPORTANT FOR AI AGENTS:"));
    lines.push(chalk.yellow("IF YOU NEED INFORMATION TO COMPLETE THE SPEC, ASK THE PRODUCT OWNER (USER) FOR IT."));
    lines.push(chalk.yellow("YOU MUST REQUEST APPROVAL FROM THE USER BEFORE USING `--force`."));
  }

  return lines.join("\n");
}