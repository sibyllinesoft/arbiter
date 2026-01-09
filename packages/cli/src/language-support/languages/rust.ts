/**
 * Rust Language Plugin - Axum + SQLx + Modern Rust Patterns
 * Supports: Rust 1.70+, Axum, SQLx, Tokio, Serde, modern async patterns
 */

import type {
  BuildConfig,
  GeneratedFile,
  GenerationResult,
  LanguagePlugin,
  ProjectConfig,
  ServiceConfig,
} from "@/language-support/index.js";
import {
  generateCargoConfig,
  generateErrors,
  generateGitHubActions,
  generateHandlersModule,
  generateHealthHandler,
  generateIntegrationTests,
  generateJustfile,
  generateLibFile,
  generateMiddlewareModule,
  generateModelsModule,
  generateRoutesModule,
  generateServicesModule,
  generateTestModule,
} from "@/language-support/languages/rust-templates.js";
import { TemplateResolver } from "@/language-support/template-resolver.js";

/**
 * Cargo.toml dependency specification
 */
type CargoDependency = string | { version: string; features?: string[] };

const rustTemplateResolver = new TemplateResolver({
  language: "rust",
  defaultDirectories: [
    new URL("@/language-support/templates/rust", import.meta.url).pathname,
    new URL("@/templates/rust", import.meta.url).pathname,
  ],
});

export class RustPlugin implements LanguagePlugin {
  readonly name = "Rust Plugin";
  readonly language = "rust";
  readonly version = "1.0.0";
  readonly description = "Modern Rust with Axum, SQLx, and zero-cost abstractions";
  readonly supportedFeatures = [
    "web-server",
    "api",
    "database",
    "async-runtime",
    "memory-safety",
    "performance",
    "testing",
    "serialization",
    "error-handling",
  ];
  readonly capabilities = {
    components: false,
    services: true,
    api: true,
    testing: true,
  };

  async generateService(config: ServiceConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = [];

    const generators = this.getServiceGenerators();
    const generator = config.type ? generators[config.type] : undefined;
    if (generator) {
      const result = await generator(config);
      files.push(...result.files);
      dependencies.push(...result.dependencies);
    }

    if (config.validation) dependencies.push("validator");
    if (config.database) dependencies.push("sqlx", "uuid");

    return { files, dependencies };
  }

  private getServiceGenerators(): Record<
    string,
    (config: ServiceConfig) => Promise<{ files: GeneratedFile[]; dependencies: string[] }>
  > {
    return {
      api: async (config) => ({
        files: [
          {
            path: `src/handlers/${config.name.toLowerCase()}.rs`,
            content: await this.generateAPIHandler(config),
          },
          {
            path: `src/routes/${config.name.toLowerCase()}.rs`,
            content: await this.generateRoutes(config),
          },
        ],
        dependencies: ["axum", "tokio", "serde"],
      }),
      service: async (config) => ({
        files: [
          {
            path: `src/services/${config.name.toLowerCase()}.rs`,
            content: await this.generateBusinessService(config),
          },
        ],
        dependencies: [],
      }),
      model: async (config) => ({
        files: [
          {
            path: `src/models/${config.name.toLowerCase()}.rs`,
            content: await this.generateModel(config),
          },
        ],
        dependencies: ["sqlx", "serde", "uuid"],
      }),
      middleware: async (config) => ({
        files: [
          {
            path: `src/middleware/${config.name.toLowerCase()}.rs`,
            content: await this.generateMiddleware(config),
          },
        ],
        dependencies: [],
      }),
    };
  }

  private static readonly BASE_DEPENDENCIES = [
    "axum",
    "tokio",
    "serde",
    "serde_json",
    "tracing",
    "tracing-subscriber",
    "tower",
    "tower-http",
  ];

  private static readonly PROJECT_SCRIPTS = {
    dev: "cargo watch -x run",
    build: "cargo build --release",
    test: "cargo test",
    "test:coverage": "cargo tarpaulin --out html",
    lint: "cargo clippy -- -D warnings",
    format: "cargo fmt",
    check: "cargo check",
  };

  /**
   * Generate core application files (main, config, app state)
   */
  private async generateCoreFiles(config: ProjectConfig): Promise<GeneratedFile[]> {
    return [
      { path: "Cargo.toml", content: await this.generateCargoToml(config) },
      { path: "src/main.rs", content: await this.generateMainApp(config) },
      { path: "src/config.rs", content: await this.generateConfig(config) },
      { path: "src/app.rs", content: await this.generateAppState(config) },
      { path: "src/errors.rs", content: await generateErrors() },
      { path: "src/lib.rs", content: await generateLibFile(config) },
      { path: ".env.example", content: await this.generateEnvExample(config) },
      { path: "justfile", content: await generateJustfile(config) },
    ];
  }

  /**
   * Generate module structure files
   */
  private async generateModuleFiles(config: ProjectConfig): Promise<GeneratedFile[]> {
    return [
      { path: "src/models/mod.rs", content: await generateModelsModule() },
      { path: "src/services/mod.rs", content: await generateServicesModule() },
      { path: "src/handlers/mod.rs", content: await generateHandlersModule() },
      { path: "src/routes/mod.rs", content: await generateRoutesModule(config) },
      { path: "src/middleware/mod.rs", content: await generateMiddlewareModule() },
      { path: "src/handlers/health.rs", content: await generateHealthHandler() },
    ];
  }

  /**
   * Generate optional files based on config
   */
  private async generateOptionalFiles(
    config: ProjectConfig,
    dependencies: string[],
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    if (config.database) {
      files.push({ path: "src/database.rs", content: await this.generateDatabase(config) });
      dependencies.push("sqlx");
    }

    if (config.testing) {
      files.push(
        { path: "src/tests/mod.rs", content: await generateTestModule() },
        { path: "src/tests/integration.rs", content: await generateIntegrationTests(config) },
      );
    }

    return files;
  }

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    const dependencies = [...RustPlugin.BASE_DEPENDENCIES];

    const coreFiles = await this.generateCoreFiles(config);
    const moduleFiles = await this.generateModuleFiles(config);
    const optionalFiles = await this.generateOptionalFiles(config, dependencies);

    return {
      files: [...coreFiles, ...moduleFiles, ...optionalFiles],
      dependencies,
      scripts: RustPlugin.PROJECT_SCRIPTS,
    };
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];

    // CI/CD configuration
    files.push({
      path: ".github/workflows/rust.yml",
      content: await generateGitHubActions(config),
    });

    // Cargo configuration
    files.push({
      path: ".cargo/config.toml",
      content: await generateCargoConfig(config),
    });

    return { files };
  }

  private async generateAPIHandler(config: ServiceConfig): Promise<string> {
    const structName = this.toPascalCase(config.name);
    const moduleName = config.name.toLowerCase();
    const dbPoolRef = config.database ? "&app_state.db_pool" : "";
    const validateLine = config.validation ? "payload.validate()?;" : "";

    return await rustTemplateResolver.renderTemplate("api-handler.tpl", {
      structName,
      moduleName,
      name: config.name,
      dbPoolRef,
      validateLine,
    });
  }

  private async generateRoutes(config: ServiceConfig): Promise<string> {
    const moduleName = config.name.toLowerCase();

    return rustTemplateResolver.renderTemplate("src/routes/routes.rs.tpl", {
      module_name: moduleName,
      resource_name: config.name,
    });
  }

  /**
   * Generate struct definition details based on database presence.
   */
  private getServiceStructDetails(hasDb: boolean): {
    lifet: string;
    serviceStruct: string;
    ctorParams: string;
    ctorFields: string;
  } {
    if (!hasDb) {
      return { lifet: "", serviceStruct: "{}", ctorParams: "", ctorFields: "" };
    }
    return {
      lifet: "<'a>",
      serviceStruct: `{\n    db_pool: &'a PgPool,\n}`,
      ctorParams: "db_pool: &'a PgPool",
      ctorFields: "            db_pool,\n",
    };
  }

  /**
   * Generate getAllBody implementation.
   */
  private getAllBody(
    hasDb: boolean,
    structName: string,
    moduleName: string,
    resourceName: string,
  ): string {
    if (!hasDb) {
      return `        // Placeholder implementation without database
        let items: Vec<${structName}> = vec![];
        let total = 0;
        Ok((items, total))`;
    }
    return `        let offset = (page - 1) * limit;

        // Get total count
        let count_row = sqlx::query!(
            "SELECT COUNT(*) as count FROM ${moduleName}s WHERE deleted_at IS NULL"
        )
        .fetch_one(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to count ${resourceName} items: {}", e);
            AppError::DatabaseError(e.toString())
        })?;

        let total = count_row.count.unwrap_or(0) as u64;

        // Get paginated items
        let items = sqlx::query_as!(
            ${structName},
            "SELECT id, name, description, is_active, created_at, updated_at\n             FROM ${moduleName}s\n             WHERE deleted_at IS NULL\n             ORDER BY created_at DESC\n             LIMIT $1 OFFSET $2",
            limit as i32,
            offset as i32
        )
        .fetch_all(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to fetch ${resourceName} items: {}", e);
            AppError::DatabaseError(e.toString())
        })?;

        Ok((items, total))`;
  }

  /**
   * Generate getByIdBody implementation.
   */
  private getByIdBody(
    hasDb: boolean,
    structName: string,
    moduleName: string,
    resourceName: string,
  ): string {
    if (!hasDb) {
      return `        // Placeholder implementation without database
        Err(AppError::NotFound(format!("${resourceName} with ID {} not found", id)))`;
    }
    return `        let item = sqlx::query_as!(
            ${structName},
            "SELECT id, name, description, is_active, created_at, updated_at\n             FROM ${moduleName}s\n             WHERE id = $1 AND deleted_at IS NULL",
            id
        )
        .fetch_optional(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to fetch ${resourceName} {}: {}", id, e);
            AppError::DatabaseError(e.toString())
        })?
        .ok_or_else(() => {
            error!("${resourceName} not found: {}", id);
            AppError::NotFound(format!("${resourceName} with ID {} not found", id))
        })?;

        Ok(item)`;
  }

  /**
   * Generate createBody implementation.
   */
  private createBody(
    hasDb: boolean,
    structName: string,
    moduleName: string,
    resourceName: string,
  ): string {
    if (!hasDb) {
      return `        // Placeholder implementation without database
        let item = ${structName} {
            id: Uuid::new_v4(),
            name: request.name,
            description: request.description,
            is_active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        Ok(item)`;
    }
    return `        let id = Uuid::new_v4();
        let now = chrono::Utc::now();

        let item = sqlx::query_as!(
            ${structName},
            "INSERT INTO ${moduleName}s (id, name, description, is_active, created_at, updated_at)\n             VALUES ($1, $2, $3, true, $4, $4)\n             RETURNING id, name, description, is_active, created_at, updated_at",
            id,
            request.name,
            request.description,
            now,
        )
        .fetch_one(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to create ${resourceName}: {}", e);
            AppError::DatabaseError(e.toString())
        })?;

        Ok(item)`;
  }

  /**
   * Generate updateBody implementation.
   */
  private updateBody(
    hasDb: boolean,
    structName: string,
    moduleName: string,
    resourceName: string,
  ): string {
    if (!hasDb) {
      return `        // Placeholder implementation without database
        Err(AppError::NotFound(format!("${resourceName} with ID {} not found", id)))`;
    }
    return `        let now = chrono::Utc::now();

        let item = sqlx::query_as!(
            ${structName},
            "UPDATE ${moduleName}s\n             SET name = COALESCE($2, name),\n                 description = COALESCE($3, description),\n                 is_active = COALESCE($4, is_active),\n                 updated_at = $5\n             WHERE id = $1 AND deleted_at IS NULL\n             RETURNING id, name, description, is_active, created_at, updated_at",
            id,
            request.name,
            request.description,
            request.is_active,
            now,
        )
        .fetch_optional(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to update ${resourceName} {}: {}", id, e);
            AppError::DatabaseError(e.toString())
        })?
        .ok_or_else(() => {
            error!("${resourceName} not found for update: {}", id);
            AppError::NotFound(format!("${resourceName} with ID {} not found", id))
        })?;

        Ok(item)`;
  }

  /**
   * Generate deleteBody implementation.
   */
  private deleteBody(hasDb: boolean, moduleName: string, resourceName: string): string {
    if (!hasDb) {
      return `        // Placeholder implementation without database
        Err(AppError::NotFound(format!("${resourceName} with ID {} not found", id)))`;
    }
    return `        let now = chrono::Utc::now();

        let result = sqlx::query!(
            "UPDATE ${moduleName}s SET deleted_at = $1 WHERE id = $2 AND deleted_at IS NULL",
            now,
            id
        )
        .execute(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to delete ${resourceName} {}: {}", id, e);
            AppError::DatabaseError(e.toString())
        })?;

        if result.rows_affected() == 0 {
            error!("${resourceName} not found for deletion: {}", id);
            return Err(AppError::NotFound(format!("${resourceName} with ID {} not found", id)));
        }

        Ok(())`;
  }

  private async generateBusinessService(config: ServiceConfig): Promise<string> {
    const structName = this.toPascalCase(config.name);
    const moduleName = config.name.toLowerCase();
    const hasDb = Boolean(config.database);
    const dbImport = hasDb ? "use sqlx::{PgPool, Row};" : "";
    const structDetails = this.getServiceStructDetails(hasDb);

    return rustTemplateResolver.renderTemplate("src/services/service.rs.tpl", {
      struct_name: structName,
      module_name: moduleName,
      resource_name: config.name,
      db_import: dbImport,
      lifet: structDetails.lifet,
      service_struct: structDetails.serviceStruct,
      ctor_params: structDetails.ctorParams,
      ctor_fields: structDetails.ctorFields,
      get_all_body: this.getAllBody(hasDb, structName, moduleName, config.name),
      get_by_id_body: this.getByIdBody(hasDb, structName, moduleName, config.name),
      create_body: this.createBody(hasDb, structName, moduleName, config.name),
      update_body: this.updateBody(hasDb, structName, moduleName, config.name),
      delete_body: this.deleteBody(hasDb, moduleName, config.name),
    });
  }

  private buildValidationVars(hasValidation: boolean): Record<string, string> {
    if (!hasValidation) {
      return {
        extra_imports: "",
        validate_derive: "",
        name_validate: "",
        desc_validate: "",
        create_validate_body: "",
        update_validate_body: "",
      };
    }
    return {
      extra_imports: "use validator::Validate;",
      validate_derive: ", Validate",
      name_validate: "    #[validate(length(min = 1, max = 100))]\n",
      desc_validate: "    #[validate(length(max = 500))]\n",
      create_validate_body:
        '        if self.name.trim().is_empty() {\n            return Err("Name cannot be empty".to_string());\n        }\n',
      update_validate_body:
        '        if let Some(name) = &self.name {\n            if name.trim().is_empty() {\n                return Err("Name cannot be empty".to_string());\n            }\n        }\n',
    };
  }

  private buildModelTemplateVars(config: ServiceConfig): Record<string, string> {
    const hasDatabase = !!config.database;

    return {
      struct_name: this.toPascalCase(config.name),
      from_row_import: hasDatabase ? "use sqlx::FromRow;" : "",
      from_row_derive: hasDatabase ? ", FromRow" : "",
      ...this.buildValidationVars(!!config.validation),
    };
  }

  private async generateModel(config: ServiceConfig): Promise<string> {
    return rustTemplateResolver.renderTemplate(
      "src/models/model.rs.tpl",
      this.buildModelTemplateVars(config),
    );
  }

  private async generateMiddleware(config: ServiceConfig): Promise<string> {
    const middlewareName = this.toPascalCase(config.name);

    return await rustTemplateResolver.renderTemplate("src/middleware/middleware.rs.tpl", {
      middleware_name: middlewareName,
      function_name: `${config.name.toLowerCase()}_middleware`,
    });
  }

  /**
   * Get base Rust dependencies
   */
  private getBaseDependencies(): Record<string, CargoDependency> {
    return {
      axum: "0.7",
      tokio: { version: "1.0", features: ["full"] },
      serde: { version: "1.0", features: ["derive"] },
      serde_json: "1.0",
      tracing: "0.1",
      "tracing-subscriber": { version: "0.3", features: ["env-filter"] },
      tower: "0.4",
      "tower-http": { version: "0.5", features: ["cors", "trace"] },
      uuid: { version: "1.0", features: ["v4", "serde"] },
      chrono: { version: "0.4", features: ["serde"] },
      anyhow: "1.0",
      thiserror: "1.0",
    };
  }

  /**
   * Add optional dependencies based on config
   */
  private addOptionalDependencies(
    dependencies: Record<string, CargoDependency>,
    config: ProjectConfig,
  ): void {
    if (config.database) {
      dependencies.sqlx = {
        version: "0.7",
        features: ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "macros"],
      };
    }

    if (config.auth) {
      dependencies.jsonwebtoken = "9.0";
      dependencies.bcrypt = "0.15";
    }

    if (config.testing) {
      dependencies["tokio-test"] = "0.4";
    }
  }

  /**
   * Format a single dependency for Cargo.toml
   */
  private formatDependency(name: string, version: CargoDependency): string {
    if (typeof version === "string") {
      return `${name} = "${version}"`;
    }

    const versionStr = version.version ? `version = "${version.version}"` : "";
    const featuresStr = version.features
      ? `features = [${version.features.map((f: string) => `"${f}"`).join(", ")}]`
      : "";
    const parts = [versionStr, featuresStr].filter(Boolean);
    return `${name} = { ${parts.join(", ")} }`;
  }

  /**
   * Format all dependencies as Cargo.toml block
   */
  private formatDependenciesBlock(dependencies: Record<string, CargoDependency>): string {
    return Object.entries(dependencies)
      .map(([name, version]) => this.formatDependency(name, version))
      .join("\n");
  }

  private async generateCargoToml(config: ProjectConfig): Promise<string> {
    const dependencies = this.getBaseDependencies();
    this.addOptionalDependencies(dependencies, config);

    const dependenciesBlock = this.formatDependenciesBlock(dependencies);
    const packageName = config.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const binName = config.name.toLowerCase();
    const tokioTest = config.testing ? `tokio-test = "0.4"` : "";
    const description = config.description || `Modern Rust application: ${config.name}`;

    return rustTemplateResolver.renderTemplate("Cargo.toml.tpl", {
      package_name: packageName,
      description,
      dependencies: dependenciesBlock,
      tokio_test: tokioTest,
      bin_name: binName,
    });
  }

  private async generateMainApp(config: ProjectConfig): Promise<string> {
    const moduleName = config.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    return rustTemplateResolver.renderTemplate("src/main.rs.tpl", {
      module_name: moduleName,
      service_name: config.name,
      database_import: config.database ? "database::create_pool," : "",
      database_block: config.database
        ? `// Create database connection pool
    let db_pool = create_pool(&config.database_url).await?;
    info!("Database connection pool created");

    // Run migrations
    sqlx::migrate!("@/language-support/migrations")
        .run(&db_pool)
        .await
        .map_err(|e| {
            error!("Failed to run migrations: {}", e);
            e
        })?;
    info!("Database migrations completed");`
        : "",
      database_arg: config.database ? "db_pool" : "",
      tracing_env: `${config.name.toLowerCase()}=debug,tower_http=debug`,
    });
  }

  private buildDatabaseConfigVars(config: ProjectConfig): Record<string, string> {
    if (!config.database) {
      return { database_field: "", database_parse: "", database_return: "" };
    }
    return {
      database_field: "pub database_url: String,",
      database_parse: `        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://user:password@localhost:5432/${config.name.toLowerCase()}".to_string());`,
      database_return: "            database_url,",
    };
  }

  private buildAuthConfigVars(config: ProjectConfig): Record<string, string> {
    if (!config.auth) {
      return { auth_field: "", auth_parse: "", auth_return: "" };
    }
    return {
      auth_field: "pub jwt_secret: String,",
      auth_parse: `        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "your-secret-key".to_string());`,
      auth_return: "            jwt_secret,",
    };
  }

  private async generateConfig(config: ProjectConfig): Promise<string> {
    const dbVars = this.buildDatabaseConfigVars(config);
    const authVars = this.buildAuthConfigVars(config);

    return rustTemplateResolver.renderTemplate("src/config.rs.tpl", {
      ...dbVars,
      ...authVars,
    });
  }

  private async generateAppState(config: ProjectConfig): Promise<string> {
    const dbUse = config.database ? "use sqlx::PgPool;" : "";
    const dbField = config.database ? "    pub db_pool: PgPool," : "";
    const dbCtorParam = config.database ? "db_pool: PgPool" : "";
    const dbCtorAssign = config.database ? "            db_pool," : "";
    const dbCtorArg = config.database ? "db_pool" : "";

    return rustTemplateResolver.renderTemplate("src/app.rs.tpl", {
      db_use: dbUse,
      db_field: dbField,
      db_ctor_param: dbCtorParam,
      db_ctor_assign: dbCtorAssign,
      db_ctor_arg: dbCtorArg,
    });
  }

  private async generateDatabase(config: ProjectConfig): Promise<string> {
    if (config.database !== "postgres") {
      return "// Database configuration not implemented for this database type";
    }

    return rustTemplateResolver.renderTemplate("src/database.rs.tpl", {});
  }

  private async generateEnvExample(config: ProjectConfig): Promise<string> {
    const databaseBlock = config.database
      ? `# Database Configuration
DATABASE_URL=postgres://user:password@localhost:5432/${config.name.toLowerCase()}`
      : "";

    const authBlock = config.auth
      ? `# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production`
      : "";

    return await rustTemplateResolver.renderTemplate(".env.example.tpl", {
      database_block: databaseBlock,
      auth_block: authBlock,
    });
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
  }
}
