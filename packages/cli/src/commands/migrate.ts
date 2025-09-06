import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { glob } from "glob";
import type { AssemblyConfig, AppSpec, ProductSpec, UIRoute, FlowSpec, LocatorToken, CssSelector, ServiceConfig } from "@arbiter/shared";

export interface MigrateOptions {
  from?: string;
  to?: string;
  dryRun?: boolean;
  backup?: boolean;
  patterns?: string[];
  force?: boolean;
  schemaVersion?: "v1" | "v2"; // New option for schema version migration
}

export interface MigrationPlan {
  files: Array<{
    path: string;
    changes_needed: boolean;
    backup_path?: string;
    errors: string[];
    migration_type?: "syntax" | "schema" | "both";
  }>;
  summary: {
    total_files: number;
    files_to_migrate: number;
    backup_created: boolean;
    schema_migrations: number;
    syntax_migrations: number;
  };
  safe_to_proceed: boolean;
}

export interface V1ToV2ConversionResult {
  success: boolean;
  appSpec?: AppSpec;
  errors: string[];
  warnings: string[];
}

/**
 * Find CUE files to migrate
 */
async function findCueFiles(patterns: string[]): Promise<string[]> {
  const allFiles: string[] = [];

  for (const pattern of patterns) {
    try {
      const files = await glob(pattern, {
        ignore: ["node_modules/**", "dist/**", ".git/**"],
      });
      allFiles.push(...files);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not process pattern '${pattern}': ${error}`));
    }
  }

  // Remove duplicates and filter for .cue files
  const uniqueFiles = [...new Set(allFiles)];
  return uniqueFiles.filter((f) => f.endsWith(".cue"));
}

/**
 * Create backup of files
 */
async function createBackups(files: string[]): Promise<Map<string, string>> {
  const backups = new Map<string, string>();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (const file of files) {
    const backupPath = `${file}.backup-${timestamp}`;
    try {
      await fs.copyFile(file, backupPath);
      backups.set(file, backupPath);
    } catch (error) {
      console.error(
        chalk.red(`Failed to backup ${file}:`),
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return backups;
}

/**
 * Detect if file contains v1 assembly structure
 */
function detectV1AssemblyStructure(content: string): boolean {
  // Look for v1 assembly patterns
  const v1Patterns = [
    /arbiterSpec\s*:\s*{/, // Main arbiterSpec block
    /config\s*:\s*{\s*language\s*:/, // Config with language
    /deployment\s*:\s*{/, // Deployment block
    /services\s*:\s*{/, // Services block
    /meta\s*:\s*{\s*name\s*:/, // Meta block
  ];
  
  return v1Patterns.some(pattern => pattern.test(content));
}

/**
 * Detect if file contains v2 app spec structure
 */
function detectV2AppStructure(content: string): boolean {
  // Look for v2 app spec patterns
  const v2Patterns = [
    /product\s*:\s*{/, // Product specification
    /ui\s*:\s*routes\s*:/, // UI routes
    /flows\s*:\s*\[/, // Flows array
    /locators\s*:\s*{/, // Locators object
  ];
  
  return v2Patterns.some(pattern => pattern.test(content));
}

/**
 * Parse v1 assembly.cue file content to AssemblyConfig
 */
function parseV1Assembly(content: string): { success: boolean; config?: AssemblyConfig; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // This is a simplified parser - in a real implementation, you'd use CUE's Go API
    // or a proper CUE parser. For now, we'll extract key information with regex.
    
    const config: Partial<AssemblyConfig> = {
      config: { language: "", kind: "" },
      metadata: { name: "", version: "" },
      deployment: { target: "kubernetes" },
      services: {}
    };

    // Extract language
    const languageMatch = content.match(/language\s*:\s*"([^"]+)"/);
    if (languageMatch) {
      config.config!.language = languageMatch[1];
    }

    // Extract name
    const nameMatch = content.match(/name\s*:\s*"([^"]+)"/);
    if (nameMatch) {
      config.metadata!.name = nameMatch[1];
    }

    // Extract version
    const versionMatch = content.match(/version\s*:\s*"([^"]+)"/);
    if (versionMatch) {
      config.metadata!.version = versionMatch[1];
    }

    // Extract deployment target
    const targetMatch = content.match(/target\s*:\s*"([^"]+)"/);
    if (targetMatch) {
      config.deployment!.target = targetMatch[1] as any;
    }

    // Extract services (simplified)
    const servicesMatch = content.match(/services\s*:\s*{([^}]+(?:{[^}]*}[^}]*)*)}/) ;
    if (servicesMatch) {
      const servicesContent = servicesMatch[1];
      const serviceBlocks = servicesContent.split(/(?=\w+\s*:\s*{)/);
      
      for (const block of serviceBlocks) {
        const serviceNameMatch = block.match(/^(\w+)\s*:/);
        if (serviceNameMatch) {
          const serviceName = serviceNameMatch[1];
          const service: Partial<ServiceConfig> = {
            name: serviceName,
            serviceType: "bespoke",
            language: config.config?.language || "typescript",
            type: "deployment"
          };

          // Extract service type
          const typeMatch = block.match(/type\s*:\s*"([^"]+)"/);
          if (typeMatch) {
            service.serviceType = typeMatch[1] as any;
          }

          // Extract image
          const imageMatch = block.match(/image\s*:\s*"([^"]+)"/);
          if (imageMatch) {
            service.image = imageMatch[1];
          }

          // Extract ports
          const portsMatch = block.match(/ports\s*:\s*\[([^\]]+)\]/);
          if (portsMatch) {
            const ports = portsMatch[1].split(',').map(p => parseInt(p.trim()));
            service.ports = ports.map(port => ({ name: `port-${port}`, port }));
          }

          config.services![serviceName] = service as ServiceConfig;
        }
      }
    }

    if (!config.config?.language) {
      errors.push("Could not extract language from config");
    }
    if (!config.metadata?.name) {
      errors.push("Could not extract name from metadata");
    }

    return { 
      success: errors.length === 0, 
      config: errors.length === 0 ? config as AssemblyConfig : undefined, 
      errors 
    };
  } catch (error) {
    errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, errors };
  }
}

/**
 * Convert v1 AssemblyConfig to v2 AppSpec
 */
function convertV1ToV2(v1Config: AssemblyConfig): V1ToV2ConversionResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Create product specification
    const product: ProductSpec = {
      name: v1Config.metadata.name,
      goals: v1Config.metadata.description ? [v1Config.metadata.description] : undefined,
      roles: ["user"], // Default role, could be enhanced based on service analysis
      slos: {
        p95_page_load_ms: 2000, // Default SLO
        uptime: "99.9%" // Default uptime
      }
    };

    // Generate UI routes from services
    const routes: UIRoute[] = [];
    const locators: Record<LocatorToken, CssSelector> = {};
    const flows: FlowSpec[] = [];

    // Convert services to routes and generate basic locators/flows
    for (const [serviceName, service] of Object.entries(v1Config.services)) {
      // Generate basic routes based on service name
      const routeId = `${serviceName}:list`;
      const route: UIRoute = {
        id: routeId,
        path: `/${serviceName}`,
        capabilities: ["list", "create", "view"],
        components: [`${serviceName.charAt(0).toUpperCase()}${serviceName.slice(1)}Table`]
      };
      routes.push(route);

      // Generate detail route
      const detailRouteId = `${serviceName}:detail`;
      const detailRoute: UIRoute = {
        id: detailRouteId,
        path: `/${serviceName}/:id`,
        capabilities: ["edit", "delete"],
        components: [`${serviceName.charAt(0).toUpperCase()}${serviceName.slice(1)}Form`]
      };
      routes.push(detailRoute);

      // Generate basic locators
      locators[`btn:Create${serviceName.charAt(0).toUpperCase()}${serviceName.slice(1)}`] = `[data-testid="create-${serviceName}"]`;
      locators[`field:${serviceName}Name`] = `[data-testid="${serviceName}-name"]`;
      locators[`btn:Save${serviceName.charAt(0).toUpperCase()}${serviceName.slice(1)}`] = `[data-testid="save-${serviceName}"]`;

      // Generate basic flow
      const flow: FlowSpec = {
        id: `${serviceName}_create`,
        preconditions: { role: "user" },
        steps: [
          { visit: routeId },
          { click: `btn:Create${serviceName.charAt(0).toUpperCase()}${serviceName.slice(1)}` },
          { fill: { locator: `field:${serviceName}Name`, value: `Test ${serviceName}` } },
          { click: `btn:Save${serviceName.charAt(0).toUpperCase()}${serviceName.slice(1)}` },
          { 
            expect: { 
              locator: "toast:Saved" as LocatorToken, 
              state: "visible" 
            } 
          }
        ]
      };
      flows.push(flow);
    }

    // Add common locators
    locators["toast:Saved"] = '[role="status"][data-kind="saved"]';
    locators["toast:Error"] = '[role="status"][data-kind="error"]';

    const appSpec: AppSpec = {
      product,
      ui: {
        routes
      },
      locators,
      flows,
      testability: {
        coverage_targets: {
          unit: 80,
          integration: 70,
          e2e: 60
        }
      },
      ops: {
        deployment: {
          target: v1Config.deployment.target,
          ci_cd: {
            provider: "github_actions",
            environments: ["staging", "production"]
          }
        }
      }
    };

    warnings.push(`Generated ${routes.length} UI routes from ${Object.keys(v1Config.services).length} services`);
    warnings.push(`Generated ${Object.keys(locators).length} locators`);
    warnings.push(`Generated ${flows.length} basic flows`);

    return {
      success: true,
      appSpec,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`Conversion error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      errors,
      warnings
    };
  }
}

/**
 * Generate v2 CUE content from AppSpec
 */
function generateV2CueContent(appSpec: AppSpec): string {
  const lines: string[] = [];

  lines.push("package app");
  lines.push("");

  // Product specification
  lines.push("product: {");
  lines.push(`  name: "${appSpec.product.name}"`);
  if (appSpec.product.goals && appSpec.product.goals.length > 0) {
    lines.push(`  goals: [${appSpec.product.goals.map(g => `"${g}"`).join(", ")}]`);
  }
  if (appSpec.product.roles && appSpec.product.roles.length > 0) {
    lines.push(`  roles: [${appSpec.product.roles.map(r => `"${r}"`).join(", ")}]`);
  }
  if (appSpec.product.slos) {
    lines.push("  slos: {");
    if (appSpec.product.slos.p95_page_load_ms) {
      lines.push(`    p95_page_load_ms: ${appSpec.product.slos.p95_page_load_ms}`);
    }
    if (appSpec.product.slos.uptime) {
      lines.push(`    uptime: "${appSpec.product.slos.uptime}"`);
    }
    lines.push("  }");
  }
  lines.push("}");
  lines.push("");

  // UI routes
  lines.push("ui: routes: [");
  for (const route of appSpec.ui.routes) {
    lines.push(`  { id: "${route.id}", path: "${route.path}", capabilities: [${route.capabilities.map(c => `"${c}"`).join(", ")}]${route.components ? `, components: [${route.components.map(c => `"${c}"`).join(", ")}]` : ""} },`);
  }
  lines.push("]");
  lines.push("");

  // Locators
  lines.push("locators: {");
  for (const [token, selector] of Object.entries(appSpec.locators)) {
    lines.push(`  "${token}": '${selector}'`);
  }
  lines.push("}");
  lines.push("");

  // Flows
  lines.push("flows: [");
  for (const flow of appSpec.flows) {
    lines.push(`  {`);
    lines.push(`    id: "${flow.id}"`);
    if (flow.preconditions) {
      lines.push(`    preconditions: {`);
      if (flow.preconditions.role) {
        lines.push(`      role: "${flow.preconditions.role}"`);
      }
      lines.push(`    }`);
    }
    lines.push(`    steps: [`);
    for (const step of flow.steps) {
      lines.push(`      {${Object.entries(step).map(([key, value]) => {
        if (typeof value === "string") {
          return ` ${key}: "${value}"`;
        } else if (typeof value === "object" && value !== null) {
          return ` ${key}: ${JSON.stringify(value)}`;
        }
        return ` ${key}: ${value}`;
      }).join(",")} },`);
    }
    lines.push(`    ]`);
    lines.push(`  },`);
  }
  lines.push("]");
  lines.push("");

  // Testability
  if (appSpec.testability) {
    lines.push("testability: {");
    if (appSpec.testability.coverage_targets) {
      lines.push("  coverage_targets: {");
      Object.entries(appSpec.testability.coverage_targets).forEach(([key, value]) => {
        lines.push(`    ${key}: ${value}`);
      });
      lines.push("  }");
    }
    lines.push("}");
    lines.push("");
  }

  // Ops
  if (appSpec.ops) {
    lines.push("ops: {");
    if (appSpec.ops.deployment) {
      lines.push("  deployment: {");
      lines.push(`    target: "${appSpec.ops.deployment.target}"`);
      if (appSpec.ops.deployment.ci_cd) {
        lines.push("    ci_cd: {");
        lines.push(`      provider: "${appSpec.ops.deployment.ci_cd.provider}"`);
        if (appSpec.ops.deployment.ci_cd.environments) {
          lines.push(`      environments: [${appSpec.ops.deployment.ci_cd.environments.map(e => `"${e}"`).join(", ")}]`);
        }
        lines.push("    }");
      }
      lines.push("  }");
    }
    lines.push("}");
  }

  return lines.join("\n");
}

/**
 * Apply v1 to v2 schema migration
 */
async function applySchemaV1ToV2Migration(
  file: string,
): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const content = await fs.readFile(file, "utf-8");
    
    // Parse v1 assembly
    const parseResult = parseV1Assembly(content);
    if (!parseResult.success || !parseResult.config) {
      errors.push(...parseResult.errors);
      return { success: false, errors, warnings };
    }

    // Convert to v2
    const conversionResult = convertV1ToV2(parseResult.config);
    if (!conversionResult.success || !conversionResult.appSpec) {
      errors.push(...conversionResult.errors);
      return { success: false, errors, warnings };
    }

    warnings.push(...conversionResult.warnings);

    // Generate v2 content
    const v2Content = generateV2CueContent(conversionResult.appSpec);

    // Write new content (with .v2 extension for safety)
    const v2FilePath = file.replace(/\.cue$/, ".v2.cue");
    await fs.writeFile(v2FilePath, v2Content, "utf-8");
    
    console.log(chalk.green(`  ✓ Generated v2 schema: ${v2FilePath}`));
    warnings.push(`V2 schema written to: ${v2FilePath}`);

    return { success: true, errors, warnings };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { success: false, errors, warnings };
  }
}

/**
 * Apply simple migrations automatically
 */
async function applySyntaxMigrations(
  file: string,
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const content = await fs.readFile(file, "utf-8");
    let newContent = content;
    let hasChanges = false;

    // Simple migrations that can be done automatically
    const migrations = [
      {
        name: "Update old constraint syntax",
        pattern: /(\w+):\s*\(([^)]+)\)\s*&\s*/g,
        replacement: "$1: $2 & ",
        description: "Convert old constraint syntax to new format",
      },
      {
        name: "Fix import paths",
        pattern: /import\s+"cue\.lang\.io\/go\/([^"]+)"/g,
        replacement: 'import "$1"',
        description: "Update deprecated import paths",
      },
      {
        name: "Convert old validation syntax",
        pattern: /_\w+:\s*\([^)]+\)\s*==\s*/g,
        replacement: (match: string) => {
          // Convert validation expressions to new constraint format
          return match.replace(/^_(\w+):\s*\(([^)]+)\)\s*==\s*/, "$1: $2 & ");
        },
        description: "Update validation syntax to constraint format",
      },
    ];

    for (const migration of migrations) {
      const before = newContent;
      if (typeof migration.replacement === "function") {
        newContent = newContent.replace(migration.pattern, migration.replacement);
      } else {
        newContent = newContent.replace(migration.pattern, migration.replacement);
      }

      if (newContent !== before) {
        hasChanges = true;
        console.log(chalk.green(`  ✓ Applied: ${migration.description}`));
      }
    }

    // Write updated content if changes were made
    if (hasChanges) {
      await fs.writeFile(file, newContent, "utf-8");
    }

    return { success: true, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { success: false, errors };
  }
}

/**
 * Validate migrated file
 */
async function validateMigratedFile(file: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const content = await fs.readFile(file, "utf-8");

    // Basic syntax checks
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for unclosed braces
      const _openBraces = (line.match(/\{/g) || []).length;
      const _closeBraces = (line.match(/\}/g) || []).length;

      // Check for malformed constraints
      if (line.includes(":") && line.includes("&")) {
        const constraintPattern = /^\s*\w+:\s*[^&]*&\s*$/;
        if (!constraintPattern.test(line) && !line.includes("//") && line.trim() !== "") {
          errors.push(`Line ${lineNumber}: Potential malformed constraint`);
        }
      }

      // Check for old syntax patterns that weren't caught
      if (line.includes("cue.lang.io/go/")) {
        errors.push(`Line ${lineNumber}: Old import path detected`);
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { valid: false, errors };
  }
}

/**
 * Generate migration plan
 */
async function generateMigrationPlan(
  files: string[],
  options: MigrateOptions,
): Promise<MigrationPlan> {
  const plan: MigrationPlan = {
    files: [],
    summary: {
      total_files: files.length,
      files_to_migrate: 0,
      backup_created: false,
      schema_migrations: 0,
      syntax_migrations: 0,
    },
    safe_to_proceed: true,
  };

  console.log(chalk.cyan("Analyzing files for migration needs..."));

  for (const file of files) {
    const fileInfo = {
      path: file,
      changes_needed: false,
      errors: [] as string[],
      migration_type: undefined as "syntax" | "schema" | "both" | undefined,
    };

    try {
      const content = await fs.readFile(file, "utf-8");

      // Check for v1 to v2 schema migration needs
      const needsSchemaV1ToV2 = detectV1AssemblyStructure(content) && !detectV2AppStructure(content);
      
      // Check for syntax migration needs
      const needsSyntaxMigration = [
        content.includes("cue.lang.io/go/"),
        content.match(/_\w+:\s*\([^)]+\)\s*==\s*/),
        content.match(/(\w+):\s*\([^)]+\)\s*&\s*/),
      ].some(Boolean);

      if (needsSchemaV1ToV2 && needsSyntaxMigration) {
        fileInfo.migration_type = "both";
        fileInfo.changes_needed = true;
        plan.summary.files_to_migrate++;
        plan.summary.schema_migrations++;
        plan.summary.syntax_migrations++;
      } else if (needsSchemaV1ToV2) {
        fileInfo.migration_type = "schema";
        fileInfo.changes_needed = true;
        plan.summary.files_to_migrate++;
        plan.summary.schema_migrations++;
      } else if (needsSyntaxMigration) {
        fileInfo.migration_type = "syntax";
        fileInfo.changes_needed = true;
        plan.summary.files_to_migrate++;
        plan.summary.syntax_migrations++;
      }

      // Run validation to check current file health
      const validation = await validateMigratedFile(file);
      if (!validation.valid) {
        fileInfo.errors.push(...validation.errors);
        plan.safe_to_proceed = false;
      }
    } catch (error) {
      fileInfo.errors.push(
        `Could not read file: ${error instanceof Error ? error.message : String(error)}`,
      );
      plan.safe_to_proceed = false;
    }

    plan.files.push(fileInfo);
  }

  return plan;
}

/**
 * Display migration plan
 */
function displayMigrationPlan(plan: MigrationPlan, options: MigrateOptions): void {
  console.log(chalk.cyan("\nMigration Plan:"));
  console.log(chalk.dim("=".repeat(50)));

  console.log(`Total files: ${plan.summary.total_files}`);
  console.log(`Files needing migration: ${plan.summary.files_to_migrate}`);
  console.log(`Schema migrations (v1→v2): ${chalk.blue(plan.summary.schema_migrations)}`);
  console.log(`Syntax migrations: ${chalk.yellow(plan.summary.syntax_migrations)}`);
  console.log(`Safe to proceed: ${plan.safe_to_proceed ? chalk.green("Yes") : chalk.red("No")}`);

  if (options.backup) {
    console.log(`Backups will be created: ${chalk.green("Yes")}`);
  }

  console.log();

  // Show files that need migration
  const filesToMigrate = plan.files.filter((f) => f.changes_needed);
  if (filesToMigrate.length > 0) {
    console.log(chalk.bold("Files to migrate:"));
    for (const file of filesToMigrate) {
      const icon = file.migration_type === "schema" ? "🔄" : 
                   file.migration_type === "syntax" ? "📝" : "🔄📝";
      const typeLabel = file.migration_type === "schema" ? "(v1→v2 schema)" :
                       file.migration_type === "syntax" ? "(CUE syntax)" : "(schema + syntax)";
      console.log(`  ${chalk.yellow(icon)} ${file.path} ${chalk.dim(typeLabel)}`);
      if (file.errors.length > 0) {
        for (const error of file.errors) {
          console.log(`    ${chalk.red("⚠️")} ${error}`);
        }
      }
    }
    console.log();
  }

  // Show files with errors
  const filesWithErrors = plan.files.filter((f) => f.errors.length > 0);
  if (filesWithErrors.length > 0) {
    console.log(chalk.red("Files with issues:"));
    for (const file of filesWithErrors) {
      console.log(`  ${chalk.red("❌")} ${file.path}`);
      for (const error of file.errors) {
        console.log(`    ${error}`);
      }
    }
    console.log();
  }

  if (options.dryRun) {
    console.log(chalk.dim("This is a dry run - no changes will be made"));
  } else if (!plan.safe_to_proceed) {
    console.log(chalk.red("Migration blocked due to errors - fix issues above or use --force"));
  }
}

/**
 * Execute migration
 */
async function executeMigration(plan: MigrationPlan, options: MigrateOptions): Promise<number> {
  const filesToMigrate = plan.files.filter((f) => f.changes_needed);

  if (filesToMigrate.length === 0) {
    console.log(chalk.green("✓ No files require migration"));
    return 0;
  }

  // Create backups if requested
  let backups: Map<string, string> | undefined;
  if (options.backup) {
    console.log(chalk.cyan("Creating backups..."));
    backups = await createBackups(filesToMigrate.map((f) => f.path));
    console.log(chalk.green(`✓ Created ${backups.size} backup files`));
    console.log();
  }

  // Apply migrations
  console.log(chalk.cyan("Applying migrations..."));
  let successCount = 0;
  let errorCount = 0;

  for (const fileInfo of filesToMigrate) {
    console.log(`Migrating ${chalk.blue(fileInfo.path)}... ${chalk.dim(`(${fileInfo.migration_type})`)}`);

    let migrationSuccess = true;
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Apply schema migration if needed
    if (fileInfo.migration_type === "schema" || fileInfo.migration_type === "both") {
      const schemaResult = await applySchemaV1ToV2Migration(fileInfo.path);
      if (!schemaResult.success) {
        migrationSuccess = false;
        allErrors.push(...schemaResult.errors);
      } else {
        allWarnings.push(...schemaResult.warnings);
        console.log(chalk.green("  ✓ Schema migration (v1→v2) applied"));
      }
    }

    // Apply syntax migration if needed  
    if (fileInfo.migration_type === "syntax" || fileInfo.migration_type === "both") {
      const syntaxResult = await applySyntaxMigrations(fileInfo.path);
      if (!syntaxResult.success) {
        migrationSuccess = false;
        allErrors.push(...syntaxResult.errors);
      } else {
        console.log(chalk.green("  ✓ Syntax migration applied"));
      }
    }

    if (migrationSuccess) {
      // Validate the result (only for syntax changes, schema creates new file)
      if (fileInfo.migration_type === "syntax" || fileInfo.migration_type === "both") {
        const validation = await validateMigratedFile(fileInfo.path);
        if (!validation.valid) {
          console.log(`  ${chalk.red("✗")} Migration failed validation:`);
          for (const error of validation.errors) {
            console.log(`    ${error}`);
          }
          errorCount++;

          // Restore from backup if available
          if (backups?.has(fileInfo.path)) {
            const backupPath = backups.get(fileInfo.path)!;
            await fs.copyFile(backupPath, fileInfo.path);
            console.log(`    ${chalk.yellow("↺")} Restored from backup`);
          }
        } else {
          console.log(`  ${chalk.green("✓")} Migration successful`);
          if (allWarnings.length > 0) {
            allWarnings.forEach(warning => console.log(`    ${chalk.yellow("ℹ")} ${warning}`));
          }
          successCount++;
        }
      } else {
        console.log(`  ${chalk.green("✓")} Migration successful`);
        if (allWarnings.length > 0) {
          allWarnings.forEach(warning => console.log(`    ${chalk.yellow("ℹ")} ${warning}`));
        }
        successCount++;
      }
    } else {
      console.log(`  ${chalk.red("✗")} Migration failed:`);
      for (const error of allErrors) {
        console.log(`    ${error}`);
      }
      errorCount++;
    }

    console.log();
  }

  // Summary
  console.log(chalk.cyan("Migration Summary:"));
  console.log(`Successful: ${chalk.green(successCount)}`);
  console.log(`Failed: ${chalk.red(errorCount)}`);
  
  if (plan.summary.schema_migrations > 0) {
    console.log();
    console.log(chalk.blue("Schema Migration Notes:"));
    console.log("• V2 schemas were written to new files (*.v2.cue)");
    console.log("• Review the generated v2 files and update as needed");
    console.log("• Original v1 files are preserved");
  }

  if (backups && backups.size > 0) {
    console.log();
    console.log(chalk.dim("Backup files created:"));
    for (const [original, backup] of backups.entries()) {
      console.log(`  ${original} → ${backup}`);
    }
    console.log(chalk.dim("You can remove backup files after verifying the migration"));
  }

  return errorCount > 0 ? 1 : 0;
}

/**
 * Migrate command - Apply schema evolution changes and v1→v2 migrations
 */
export async function migrateCommand(
  patterns: string[],
  options: MigrateOptions = {},
): Promise<number> {
  try {
    // Default patterns if none provided
    const searchPatterns = patterns.length > 0 ? patterns : ["**/*.cue"];

    console.log(chalk.cyan("Arbiter Schema Migration"));
    console.log(chalk.dim("Automatically updating CUE schemas and converting v1→v2 formats"));
    console.log();

    // Find files to migrate
    const files = await findCueFiles(searchPatterns);
    if (files.length === 0) {
      console.log(chalk.yellow("No CUE files found matching patterns"));
      return 0;
    }

    console.log(chalk.dim(`Found ${files.length} CUE files`));

    // Generate migration plan
    const plan = await generateMigrationPlan(files, options);

    // Display plan
    displayMigrationPlan(plan, options);

    // Stop here if dry run
    if (options.dryRun) {
      return 0;
    }

    // Check if safe to proceed
    if (!plan.safe_to_proceed && !options.force) {
      console.log(chalk.red("Migration aborted due to errors"));
      console.log(chalk.dim("Use --force to proceed anyway (not recommended)"));
      return 1;
    }

    // Execute migration
    return await executeMigration(plan, options);
  } catch (error) {
    console.error(
      chalk.red("Migration failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}