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
} from "./index.js";
import { TemplateResolver } from "./template-resolver.js";

const rustTemplateResolver = new TemplateResolver({
  language: "rust",
  defaultDirectories: [
    new URL("./templates/rust", import.meta.url).pathname,
    new URL("../templates/rust", import.meta.url).pathname,
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

    switch (config.type) {
      case "api":
        files.push({
          path: `src/handlers/${config.name.toLowerCase()}.rs`,
          content: this.generateAPIHandler(config),
        });
        files.push({
          path: `src/routes/${config.name.toLowerCase()}.rs`,
          content: this.generateRoutes(config),
        });
        dependencies.push("axum", "tokio", "serde");
        break;
      case "service":
        files.push({
          path: `src/services/${config.name.toLowerCase()}.rs`,
          content: this.generateBusinessService(config),
        });
        break;
      case "model":
        files.push({
          path: `src/models/${config.name.toLowerCase()}.rs`,
          content: this.generateModel(config),
        });
        dependencies.push("sqlx", "serde", "uuid");
        break;
      case "middleware":
        files.push({
          path: `src/middleware/${config.name.toLowerCase()}.rs`,
          content: this.generateMiddleware(config),
        });
        break;
    }

    if (config.validation) {
      dependencies.push("validator");
    }

    if (config.database) {
      dependencies.push("sqlx", "uuid");
    }

    return { files, dependencies };
  }

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies = [
      "axum",
      "tokio",
      "serde",
      "serde_json",
      "tracing",
      "tracing-subscriber",
      "tower",
      "tower-http",
    ];

    // Cargo.toml
    files.push({
      path: "Cargo.toml",
      content: await this.generateCargoToml(config),
    });

    // Main application
    files.push({
      path: "src/main.rs",
      content: await this.generateMainApp(config),
    });

    // Application state and configuration
    files.push({
      path: "src/config.rs",
      content: await this.generateConfig(config),
    });

    files.push({
      path: "src/app.rs",
      content: await this.generateAppState(config),
    });

    // Database setup (if needed)
    if (config.database) {
      files.push({
        path: "src/database.rs",
        content: await this.generateDatabase(config),
      });
      dependencies.push("sqlx");
    }

    // Error handling
    files.push({
      path: "src/errors.rs",
      content: this.generateErrors(),
    });

    // Models module
    files.push({
      path: "src/models/mod.rs",
      content: this.generateModelsModule(),
    });

    // Services module
    files.push({
      path: "src/services/mod.rs",
      content: this.generateServicesModule(),
    });

    // Handlers module
    files.push({
      path: "src/handlers/mod.rs",
      content: this.generateHandlersModule(),
    });

    // Routes module
    files.push({
      path: "src/routes/mod.rs",
      content: this.generateRoutesModule(config),
    });

    // Middleware module
    files.push({
      path: "src/middleware/mod.rs",
      content: this.generateMiddlewareModule(),
    });

    // Health check
    files.push({
      path: "src/handlers/health.rs",
      content: this.generateHealthHandler(),
    });

    // Library file
    files.push({
      path: "src/lib.rs",
      content: this.generateLibFile(config),
    });

    // Environment file
    files.push({
      path: ".env.example",
      content: this.generateEnvExample(config),
    });

    // Testing setup (if requested)
    if (config.testing) {
      files.push({
        path: "src/tests/mod.rs",
        content: this.generateTestModule(),
      });
      files.push({
        path: "src/tests/integration.rs",
        content: this.generateIntegrationTests(config),
      });
    }

    // Docker setup (if requested)
    if (config.docker) {
      files.push({
        path: "Dockerfile",
        content: this.generateDockerfile(config),
      });
      files.push({
        path: "docker-compose.yml",
        content: this.generateDockerCompose(config),
      });
    }

    // Justfile for common tasks
    files.push({
      path: "justfile",
      content: this.generateJustfile(config),
    });

    return {
      files,
      dependencies,
      scripts: {
        dev: "cargo watch -x run",
        build: "cargo build --release",
        test: "cargo test",
        "test:coverage": "cargo tarpaulin --out html",
        lint: "cargo clippy -- -D warnings",
        format: "cargo fmt",
        check: "cargo check",
      },
    };
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];

    // Production dockerfile
    if (config.target === "production") {
      files.push({
        path: "Dockerfile.prod",
        content: this.generateProductionDockerfile(config),
      });
    }

    // CI/CD configuration
    files.push({
      path: ".github/workflows/rust.yml",
      content: this.generateGitHubActions(config),
    });

    // Cargo configuration
    files.push({
      path: ".cargo/config.toml",
      content: this.generateCargoConfig(config),
    });

    return { files };
  }

  private generateAPIHandler(config: ServiceConfig): string {
    const structName = this.toPascalCase(config.name);
    const moduleName = config.name.toLowerCase();

    return `use axum::{
    extract::{Path, Query, State},
    response::Json,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tracing::{info, error};

use crate::{
    app::AppState,
    errors::AppError,
    models::${moduleName}::{${structName}, Create${structName}Request, Update${structName}Request},
    services::${moduleName}::${structName}Service,
};

#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ${structName}Response {
    pub data: Vec<${structName}>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

/// Get all ${config.name} items
pub async fn get_all_${moduleName}(
    State(app_state): State<AppState>,
    Query(params): Query<QueryParams>,
) -> Result<Json<${structName}Response>, AppError> {
    info!("Fetching all ${config.name} items");
    
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(20);
    
    let service = ${structName}Service::new(${config.database ? "&app_state.db_pool" : ""});
    
    let (items, total) = service.get_all(page, limit).await?;
    
    let response = ${structName}Response {
        data: items,
        total,
        page,
        limit,
    };
    
    Ok(Json(response))
}

/// Get ${config.name} by ID
pub async fn get_${moduleName}_by_id(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<${structName}>, AppError> {
    info!("Fetching ${config.name} with ID: {}", id);
    
    let service = ${structName}Service::new(${config.database ? "&app_state.db_pool" : ""});
    let item = service.get_by_id(id).await?;
    
    Ok(Json(item))
}

/// Create new ${config.name}
pub async fn create_${moduleName}(
    State(app_state): State<AppState>,
    Json(payload): Json<Create${structName}Request>,
) -> Result<(StatusCode, Json<${structName}>), AppError> {
    info!("Creating new ${config.name}");
    
    // Validate payload if validation is enabled
    ${config.validation ? "payload.validate()?;" : ""}
    
    let service = ${structName}Service::new(${config.database ? "&app_state.db_pool" : ""});
    let item = service.create(payload).await?;
    
    Ok((StatusCode::CREATED, Json(item)))
}

/// Update ${config.name}
pub async fn update_${moduleName}(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<Update${structName}Request>,
) -> Result<Json<${structName}>, AppError> {
    info!("Updating ${config.name} with ID: {}", id);
    
    // Validate payload if validation is enabled
    ${config.validation ? "payload.validate()?;" : ""}
    
    let service = ${structName}Service::new(${config.database ? "&app_state.db_pool" : ""});
    let item = service.update(id, payload).await?;
    
    Ok(Json(item))
}

/// Delete ${config.name}
pub async fn delete_${moduleName}(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    info!("Deleting ${config.name} with ID: {}", id);
    
    let service = ${structName}Service::new(${config.database ? "&app_state.db_pool" : ""});
    service.delete(id).await?;
    
    Ok(StatusCode::NO_CONTENT)
}
`;
  }

  private generateRoutes(config: ServiceConfig): string {
    const moduleName = config.name.toLowerCase();

    return `use axum::{
    routing::{get, post, put, delete},
    Router,
};

use crate::{
    app::AppState,
    handlers::${moduleName}::{
        get_all_${moduleName},
        get_${moduleName}_by_id,
        create_${moduleName},
        update_${moduleName},
        delete_${moduleName},
    },
};

/// Create ${config.name} routes
pub fn create_${moduleName}_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(get_all_${moduleName}).post(create_${moduleName}))
        .route("/:id", get(get_${moduleName}_by_id).put(update_${moduleName}).delete(delete_${moduleName}))
}
`;
  }

  private generateBusinessService(config: ServiceConfig): string {
    const structName = this.toPascalCase(config.name);
    const moduleName = config.name.toLowerCase();

    return `use uuid::Uuid;
use tracing::{info, error};
${config.database ? "use sqlx::{PgPool, Row};" : ""}

use crate::{
    errors::AppError,
    models::${moduleName}::{${structName}, Create${structName}Request, Update${structName}Request},
};

/// Service for ${config.name} business logic
pub struct ${structName}Service${config.database ? "<'a>" : ""} {
    ${config.database ? "db_pool: &'a PgPool," : ""}
}

impl${config.database ? "<'a>" : ""} ${structName}Service${config.database ? "<'a>" : ""} {
    /// Create a new service instance
    pub fn new(${config.database ? "db_pool: &'a PgPool" : ""}) -> Self {
        Self {
            ${config.database ? "db_pool," : ""}
        }
    }

    /// Get all ${config.name} items with pagination
    pub async fn get_all(&self, page: u32, limit: u32) -> Result<(Vec<${structName}>, u64), AppError> {
        info!("Fetching all ${config.name} items (page: {}, limit: {})", page, limit);
        
        ${
          config.database
            ? `
        let offset = (page - 1) * limit;
        
        // Get total count
        let count_row = sqlx::query!(
            "SELECT COUNT(*) as count FROM ${moduleName}s WHERE deleted_at IS NULL"
        )
        .fetch_one(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to count ${config.name} items: {}", e);
            AppError::DatabaseError(e.to_string())
        })?;

        let total = count_row.count.unwrap_or(0) as u64;

        // Get paginated items
        let items = sqlx::query_as!(
            ${structName},
            "SELECT id, name, description, is_active, created_at, updated_at 
             FROM ${moduleName}s 
             WHERE deleted_at IS NULL 
             ORDER BY created_at DESC 
             LIMIT $1 OFFSET $2",
            limit as i32,
            offset as i32
        )
        .fetch_all(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to fetch ${config.name} items: {}", e);
            AppError::DatabaseError(e.to_string())
        })?;

        Ok((items, total))
        `
            : `
        // Placeholder implementation without database
        let items = vec![];
        let total = 0;
        Ok((items, total))
        `
        }
    }

    /// Get ${config.name} by ID
    pub async fn get_by_id(&self, id: Uuid) -> Result<${structName}, AppError> {
        info!("Fetching ${config.name} with ID: {}", id);
        
        ${
          config.database
            ? `
        let item = sqlx::query_as!(
            ${structName},
            "SELECT id, name, description, is_active, created_at, updated_at 
             FROM ${moduleName}s 
             WHERE id = $1 AND deleted_at IS NULL",
            id
        )
        .fetch_optional(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to fetch ${config.name} {}: {}", id, e);
            AppError::DatabaseError(e.to_string())
        })?
        .ok_or_else(|| {
            error!("${config.name} not found: {}", id);
            AppError::NotFound(format!("${config.name} with ID {} not found", id))
        })?;

        Ok(item)
        `
            : `
        // Placeholder implementation without database
        Err(AppError::NotFound(format!("${config.name} with ID {} not found", id)))
        `
        }
    }

    /// Create new ${config.name}
    pub async fn create(&self, request: Create${structName}Request) -> Result<${structName}, AppError> {
        info!("Creating new ${config.name}");
        
        ${
          config.database
            ? `
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();

        let item = sqlx::query_as!(
            ${structName},
            "INSERT INTO ${moduleName}s (id, name, description, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, true, $4, $4)
             RETURNING id, name, description, is_active, created_at, updated_at",
            id,
            request.name,
            request.description,
            now,
        )
        .fetch_one(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to create ${config.name}: {}", e);
            AppError::DatabaseError(e.to_string())
        })?;

        Ok(item)
        `
            : `
        // Placeholder implementation without database
        let item = ${structName} {
            id: Uuid::new_v4(),
            name: request.name,
            description: request.description,
            is_active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        Ok(item)
        `
        }
    }

    /// Update ${config.name}
    pub async fn update(&self, id: Uuid, request: Update${structName}Request) -> Result<${structName}, AppError> {
        info!("Updating ${config.name} with ID: {}", id);
        
        ${
          config.database
            ? `
        let now = chrono::Utc::now();

        let item = sqlx::query_as!(
            ${structName},
            "UPDATE ${moduleName}s 
             SET name = COALESCE($2, name),
                 description = COALESCE($3, description),
                 is_active = COALESCE($4, is_active),
                 updated_at = $5
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id, name, description, is_active, created_at, updated_at",
            id,
            request.name,
            request.description,
            request.is_active,
            now,
        )
        .fetch_optional(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to update ${config.name} {}: {}", id, e);
            AppError::DatabaseError(e.to_string())
        })?
        .ok_or_else(|| {
            error!("${config.name} not found for update: {}", id);
            AppError::NotFound(format!("${config.name} with ID {} not found", id))
        })?;

        Ok(item)
        `
            : `
        // Placeholder implementation without database
        Err(AppError::NotFound(format!("${config.name} with ID {} not found", id)))
        `
        }
    }

    /// Delete ${config.name} (soft delete)
    pub async fn delete(&self, id: Uuid) -> Result<(), AppError> {
        info!("Deleting ${config.name} with ID: {}", id);
        
        ${
          config.database
            ? `
        let now = chrono::Utc::now();

        let result = sqlx::query!(
            "UPDATE ${moduleName}s SET deleted_at = $1 WHERE id = $2 AND deleted_at IS NULL",
            now,
            id
        )
        .execute(self.db_pool)
        .await
        .map_err(|e| {
            error!("Failed to delete ${config.name} {}: {}", id, e);
            AppError::DatabaseError(e.to_string())
        })?;

        if result.rows_affected() == 0 {
            error!("${config.name} not found for deletion: {}", id);
            return Err(AppError::NotFound(format!("${config.name} with ID {} not found", id)));
        }

        Ok(())
        `
            : `
        // Placeholder implementation without database
        Err(AppError::NotFound(format!("${config.name} with ID {} not found", id)))
        `
        }
    }
}
`;
  }

  private generateModel(config: ServiceConfig): string {
    const structName = this.toPascalCase(config.name);

    return `use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
${config.validation ? "use validator::Validate;" : ""}

/// ${structName} model
#[derive(Debug, Clone, Serialize, Deserialize)]
${config.database ? "#[derive(sqlx::FromRow)]" : ""}
pub struct ${structName} {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Request payload for creating a ${structName}
#[derive(Debug, Deserialize${config.validation ? ", Validate" : ""})]
pub struct Create${structName}Request {
    ${config.validation ? "#[validate(length(min = 1, max = 100))]" : ""}
    pub name: String,
    ${config.validation ? "#[validate(length(max = 500))]" : ""}
    pub description: Option<String>,
}

/// Request payload for updating a ${structName}
#[derive(Debug, Deserialize${config.validation ? ", Validate" : ""})]
pub struct Update${structName}Request {
    ${config.validation ? "#[validate(length(min = 1, max = 100))]" : ""}
    pub name: Option<String>,
    ${config.validation ? "#[validate(length(max = 500))]" : ""}
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

impl ${structName} {
    /// Create a new ${structName} instance
    pub fn new(name: String, description: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            is_active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Check if the ${structName} is active
    pub fn is_active(&self) -> bool {
        self.is_active
    }

    /// Update the ${structName} with new data
    pub fn update(&mut self, request: Update${structName}Request) {
        if let Some(name) = request.name {
            self.name = name;
        }
        if let Some(description) = request.description {
            self.description = Some(description);
        }
        if let Some(is_active) = request.is_active {
            self.is_active = is_active;
        }
        self.updated_at = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_${config.name.toLowerCase()}_creation() {
        let name = "Test ${structName}".to_string();
        let description = Some("Test description".to_string());
        let ${config.name.toLowerCase()} = ${structName}::new(name.clone(), description.clone());

        assert_eq!(${config.name.toLowerCase()}.name, name);
        assert_eq!(${config.name.toLowerCase()}.description, description);
        assert!(${config.name.toLowerCase()}.is_active);
        assert!(${config.name.toLowerCase()}.created_at <= Utc::now());
        assert!(${config.name.toLowerCase()}.updated_at <= Utc::now());
    }

    #[test]
    fn test_${config.name.toLowerCase()}_update() {
        let mut ${config.name.toLowerCase()} = ${structName}::new(
            "Original Name".to_string(),
            Some("Original Description".to_string())
        );

        let update_request = Update${structName}Request {
            name: Some("Updated Name".to_string()),
            description: Some("Updated Description".to_string()),
            is_active: Some(false),
        };

        ${config.name.toLowerCase()}.update(update_request);

        assert_eq!(${config.name.toLowerCase()}.name, "Updated Name");
        assert_eq!(${config.name.toLowerCase()}.description, Some("Updated Description".to_string()));
        assert!(!${config.name.toLowerCase()}.is_active);
    }
}
`;
  }

  private generateMiddleware(config: ServiceConfig): string {
    const middlewareName = this.toPascalCase(config.name);

    return `use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use tracing::{info, warn};

/// ${middlewareName} middleware
pub async fn ${config.name.toLowerCase()}_middleware(
    request: Request,
    next: Next,
) -> Response {
    // Pre-processing logic
    info!("${middlewareName} middleware - processing request");

    // Extract request information if needed
    let method = request.method().clone();
    let uri = request.uri().clone();

    // Process the request
    let response = next.run(request).await;

    // Post-processing logic
    let status = response.status();
    info!("${middlewareName} middleware - request completed: {} {} -> {}",
          method, uri, status);

    response
}
`;
  }

  private async generateCargoToml(config: ProjectConfig): Promise<string> {
    type CargoDependency = string | { version: string; features?: string[] };

    const dependencies: Record<string, CargoDependency> = {
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

    const dependenciesBlock = Object.entries(dependencies)
      .map(([name, version]) => {
        if (typeof version === "string") {
          return `${name} = "${version}"`;
        }
        const versionStr = version.version ? `version = "${version.version}"` : "";
        const featuresStr = version.features
          ? `features = [${version.features.map((f: string) => `"${f}"`).join(", ")}]`
          : "";
        const parts = [versionStr, featuresStr].filter(Boolean);
        return `${name} = { ${parts.join(", ")} }`;
      })
      .join("\n");

    const packageName = config.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const binName = config.name.toLowerCase();
    const tokioTest = config.testing ? `tokio-test = "0.4"` : "";
    const description = config.description || `Modern Rust application: ${config.name}`;

    const fallback = `[package]
name = "${packageName}"
version = "0.1.0"
edition = "2021"
description = "${description}"

[dependencies]
${dependenciesBlock}

[dev-dependencies]
tower-test = "0.4"
hyper = { version = "1.0", features = ["full"] }
${tokioTest}

[[bin]]
name = "${binName}"
path = "src/main.rs"

[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
`;

    return rustTemplateResolver.renderTemplate(
      "Cargo.toml.tpl",
      {
        package_name: packageName,
        description,
        dependencies: dependenciesBlock,
        tokio_test: tokioTest,
        bin_name: binName,
      },
      fallback,
    );
  }

  private async generateMainApp(config: ProjectConfig): Promise<string> {
    const moduleName = config.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    const fallback = `use std::net::SocketAddr;

use axum::Server;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use ${moduleName}::{
    app::create_app,
    config::Config,
    ${config.database ? "database::create_pool," : ""}
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "${config.name.toLowerCase()}=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting ${config.name} application");

    // Load configuration
    let config = Config::from_env()?;
    
    ${
      config.database
        ? `// Create database connection pool
    let db_pool = create_pool(&config.database_url).await?;
    info!("Database connection pool created");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await
        .map_err(|e| {
            error!("Failed to run migrations: {}", e);
            e
        })?;
    info!("Database migrations completed");`
        : ""
    }

    // Create application
    let app = create_app(${config.database ? "db_pool" : ""}).await?;

    // Setup server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Server listening on {}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .await
        .map_err(|e| {
            error!("Server error: {}", e);
            e
        })?;

    Ok(())
}
`;

    return rustTemplateResolver.renderTemplate(
      "src/main.rs.tpl",
      {
        module_name: moduleName,
        service_name: config.name,
        database_block: config.database
          ? `// Create database connection pool
    let db_pool = create_pool(&config.database_url).await?;
    info!("Database connection pool created");

    // Run migrations
    sqlx::migrate!("./migrations")
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
      },
      fallback,
    );
  }

  private async generateConfig(config: ProjectConfig): Promise<string> {
    const fallback = `use std::env;

/// Application configuration
#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub environment: String,
    ${config.database ? "pub database_url: String," : ""}
    ${config.auth ? "pub jwt_secret: String," : ""}
    pub log_level: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        let port = env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse::<u16>()
            .unwrap_or(3000);

        let environment = env::var("ENVIRONMENT")
            .unwrap_or_else(|_| "development".to_string());

        ${
          config.database
            ? `let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://user:password@localhost:5432/${config.name.toLowerCase()}".to_string());`
            : ""
        }

        ${
          config.auth
            ? `let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "your-secret-key".to_string());`
            : ""
        }

        let log_level = env::var("LOG_LEVEL")
            .unwrap_or_else(|_| "info".to_string());

        Ok(Self {
            port,
            environment,
            ${config.database ? "database_url," : ""}
            ${config.auth ? "jwt_secret," : ""}
            log_level,
        })
    }

    /// Check if running in production
    pub fn is_production(&self) -> bool {
        self.environment == "production"
    }

    /// Check if running in development
    pub fn is_development(&self) -> bool {
        self.environment == "development"
    }
}
`;

    const databaseField = config.database ? "pub database_url: String," : "";
    const authField = config.auth ? "pub jwt_secret: String," : "";
    const databaseParse = config.database
      ? `        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://user:password@localhost:5432/${config.name.toLowerCase()}".to_string());`
      : "";
    const authParse = config.auth
      ? `        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "your-secret-key".to_string());`
      : "";
    const databaseReturn = config.database ? "            database_url," : "";
    const authReturn = config.auth ? "            jwt_secret," : "";

    return rustTemplateResolver.renderTemplate(
      "src/config.rs.tpl",
      {
        database_field: databaseField,
        auth_field: authField,
        database_parse: databaseParse,
        auth_parse: authParse,
        database_return: databaseReturn,
        auth_return: authReturn,
      },
      fallback,
    );
  }

  private async generateAppState(config: ProjectConfig): Promise<string> {
    const fallback = `use axum::{
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
        HeaderValue, Method,
    },
    Router,
};
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    trace::TraceLayer,
};
${config.database ? "use sqlx::PgPool;" : ""}

use crate::{
    routes::create_routes,
    errors::AppError,
};

/// Application state
#[derive(Clone)]
pub struct AppState {
    ${config.database ? "pub db_pool: PgPool," : ""}
}

impl AppState {
    /// Create new application state
    pub fn new(${config.database ? "db_pool: PgPool" : ""}) -> Self {
        Self {
            ${config.database ? "db_pool," : ""}
        }
    }
}

/// Create the main application with all routes and middleware
pub async fn create_app(${config.database ? "db_pool: PgPool" : ""}) -> Result<Router, AppError> {
    // Create application state
    let app_state = AppState::new(${config.database ? "db_pool" : ""});

    // Create CORS layer
    let cors = CorsLayer::new()
        .allow_origin("http://localhost:3000".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_credentials(true)
        .allow_headers([AUTHORIZATION, ACCEPT, CONTENT_TYPE]);

    // Build the application
    let app = Router::new()
        .merge(create_routes())
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors),
        )
        .with_state(app_state);

    Ok(app)
}
`;

    const dbUse = config.database ? "use sqlx::PgPool;" : "";
    const dbField = config.database ? "    pub db_pool: PgPool," : "";
    const dbCtorParam = config.database ? "db_pool: PgPool" : "";
    const dbCtorAssign = config.database ? "            db_pool," : "";
    const dbCtorArg = config.database ? "db_pool" : "";

    return rustTemplateResolver.renderTemplate(
      "src/app.rs.tpl",
      {
        db_use: dbUse,
        db_field: dbField,
        db_ctor_param: dbCtorParam,
        db_ctor_assign: dbCtorAssign,
        db_ctor_arg: dbCtorArg,
      },
      fallback,
    );
  }

  private async generateDatabase(config: ProjectConfig): Promise<string> {
    if (config.database !== "postgres") {
      return "// Database configuration not implemented for this database type";
    }

    const fallback = `use sqlx::{PgPool, postgres::PgPoolOptions};
use tracing::{info, error};

use crate::errors::AppError;

/// Create database connection pool
pub async fn create_pool(database_url: &str) -> Result<PgPool, AppError> {
    info!("Creating database connection pool");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .map_err(|e| {
            error!("Failed to create database pool: {}", e);
            AppError::DatabaseError(e.to_string())
        })?;

    // Test the connection
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| {
            error!("Failed to test database connection: {}", e);
            AppError::DatabaseError(e.to_string())
        })?;

    info!("Database connection pool created successfully");
    Ok(pool)
}
`;

    return rustTemplateResolver.renderTemplate("src/database.rs.tpl", {}, fallback);
  }

  private generateErrors(): string {
    return `use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;
${this.supportedFeatures.includes("validation") ? "use validator::ValidationErrors;" : ""}

/// Application error types
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Internal server error: {0}")]
    InternalServerError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    ${
      this.supportedFeatures.includes("validation")
        ? `#[error("Validation error")]
    ValidationError(#[from] ValidationErrors),`
        : ""
    }

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg.clone()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone()),
            AppError::DatabaseError(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database error occurred".to_string(),
            ),
            ${
              this.supportedFeatures.includes("validation")
                ? `AppError::ValidationError(errors) => (
                StatusCode::BAD_REQUEST,
                format!("Validation error: {}", errors),
            ),`
                : ""
            }
            AppError::SerializationError(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Serialization error occurred".to_string(),
            ),
            AppError::InternalServerError(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error occurred".to_string(),
            ),
        };

        let body = Json(json!({
            "error": error_message,
            "status": status.as_u16()
        }));

        (status, body).into_response()
    }
}

// Helper function for database errors
impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        match error {
            sqlx::Error::RowNotFound => AppError::NotFound("Resource not found".to_string()),
            _ => AppError::DatabaseError(error.to_string()),
        }
    }
}

// Helper function for serialization errors
impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        AppError::SerializationError(error.to_string())
    }
}
`;
  }

  private generateModelsModule(): string {
    return `//! Data models for the application

pub mod health;

// Add your model modules here
// pub mod user;
// pub mod item;
`;
  }

  private generateServicesModule(): string {
    return `//! Business logic services

// Add your service modules here
// pub mod user;
// pub mod item;
`;
  }

  private generateHandlersModule(): string {
    return `//! HTTP request handlers

pub mod health;

// Add your handler modules here
// pub mod user;
// pub mod item;
`;
  }

  private generateRoutesModule(config: ProjectConfig): string {
    return `//! Application routes

use axum::{
    routing::get,
    Router,
};

use crate::{
    app::AppState,
    handlers::health::health_check,
};

/// Create all application routes
pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health_check))
        // API v1 routes
        .nest("/api/v1", create_api_v1_routes())
}

/// Create API v1 routes
fn create_api_v1_routes() -> Router<AppState> {
    Router::new()
        .route("/ping", get(ping))
        // Add your API routes here
        // .nest("/users", user_routes())
        // .nest("/items", item_routes())
}

/// Ping endpoint
async fn ping() -> &'static str {
    "pong"
}
`;
  }

  private generateMiddlewareModule(): string {
    return `//! Application middleware

// Add your middleware modules here
// pub mod auth;
// pub mod cors;
// pub mod logging;
`;
  }

  private generateHealthHandler(): string {
    return `use axum::{response::Json, http::StatusCode};
use serde_json::{json, Value};
use chrono::Utc;

/// Health check endpoint
pub async fn health_check() -> (StatusCode, Json<Value>) {
    let health_info = json!({
        "status": "healthy",
        "timestamp": Utc::now(),
        "service": "api",
        "version": env!("CARGO_PKG_VERSION")
    });

    (StatusCode::OK, Json(health_info))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;
    use crate::app::create_app;

    #[tokio::test]
    async fn test_health_check() {
        let app = create_app(/* db_pool if needed */).await.unwrap();
        let server = TestServer::new(app).unwrap();

        let response = server.get("/health").await;
        
        assert_eq!(response.status_code(), StatusCode::OK);
        
        let json: serde_json::Value = response.json();
        assert_eq!(json["status"], "healthy");
        assert!(json["timestamp"].is_string());
    }
}
`;
  }

  private generateLibFile(config: ProjectConfig): string {
    return `//! ${config.name} - ${config.description || "A modern Rust application"}

pub mod app;
pub mod config;
${config.database ? "pub mod database;" : ""}
pub mod errors;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod services;

pub use config::Config;
${config.database ? "pub use database::create_pool;" : ""}
pub use errors::AppError;

// Re-export commonly used types
pub use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    Router,
};
pub use serde::{Deserialize, Serialize};
pub use uuid::Uuid;
`;
  }

  private generateEnvExample(config: ProjectConfig): string {
    return `# Application Configuration
PORT=3000
ENVIRONMENT=development
LOG_LEVEL=info

${
  config.database
    ? `# Database Configuration
DATABASE_URL=postgres://user:password@localhost:5432/${config.name.toLowerCase()}`
    : ""
}

${
  config.auth
    ? `# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production`
    : ""
}

# Additional configuration as needed
`;
  }

  private generateTestModule(): string {
    return `//! Integration tests

#[cfg(test)]
mod integration;

// Test utilities
pub mod common {
    use axum_test::TestServer;
    ${this.supportedFeatures.includes("database") ? "use sqlx::PgPool;" : ""}

    use crate::app::create_app;

    /// Create a test server for integration testing
    pub async fn create_test_server(${this.supportedFeatures.includes("database") ? "db_pool: PgPool" : ""}) -> TestServer {
        let app = create_app(${this.supportedFeatures.includes("database") ? "db_pool" : ""}).await.unwrap();
        TestServer::new(app).unwrap()
    }

    ${
      this.supportedFeatures.includes("database")
        ? `/// Create a test database pool
    pub async fn create_test_db_pool() -> PgPool {
        // Implementation would create a test database connection
        // This is a placeholder
        todo!("Implement test database setup")
    }`
        : ""
    }
}
`;
  }

  private generateIntegrationTests(config: ProjectConfig): string {
    return `use axum::http::StatusCode;
use axum_test::TestServer;
${config.database ? "use sqlx::PgPool;" : ""}

use crate::tests::common::{create_test_server${config.database ? ", create_test_db_pool" : ""}};

#[tokio::test]
async fn test_health_endpoint() {
    ${config.database ? "let db_pool = create_test_db_pool().await;" : ""}
    let server = create_test_server(${config.database ? "db_pool" : ""}).await;

    let response = server.get("/health").await;
    
    assert_eq!(response.status_code(), StatusCode::OK);
    
    let json: serde_json::Value = response.json();
    assert_eq!(json["status"], "healthy");
}

#[tokio::test]
async fn test_ping_endpoint() {
    ${config.database ? "let db_pool = create_test_db_pool().await;" : ""}
    let server = create_test_server(${config.database ? "db_pool" : ""}).await;

    let response = server.get("/api/v1/ping").await;
    
    assert_eq!(response.status_code(), StatusCode::OK);
    assert_eq!(response.text(), "pong");
}

#[tokio::test]
async fn test_not_found() {
    ${config.database ? "let db_pool = create_test_db_pool().await;" : ""}
    let server = create_test_server(${config.database ? "db_pool" : ""}).await;

    let response = server.get("/nonexistent").await;
    
    assert_eq!(response.status_code(), StatusCode::NOT_FOUND);
}
`;
  }

  private generateJustfile(config: ProjectConfig): string {
    return `# Justfile for ${config.name}

# Show available commands
default:
    @just --list

# Run the application in development mode
dev:
    cargo watch -x run

# Build the application
build:
    cargo build --release

# Run tests
test:
    cargo test

# Run tests with coverage
test-coverage:
    cargo tarpaulin --out html

# Check code without building
check:
    cargo check

# Run clippy lints
lint:
    cargo clippy -- -D warnings

# Format code
fmt:
    cargo fmt

# Fix code formatting and lints
fix:
    cargo fix --allow-dirty --allow-staged
    cargo fmt

# Clean build artifacts
clean:
    cargo clean

# Install development dependencies
install-dev:
    cargo install cargo-watch cargo-tarpaulin

${
  config.database
    ? `# Run database migrations
migrate:
    sqlx migrate run

# Create a new migration
migrate-create name:
    sqlx migrate add {{name}}

# Revert the last migration
migrate-revert:
    sqlx migrate revert`
    : ""
}

${
  config.docker
    ? `# Build Docker image
docker-build:
    docker build -t ${config.name.toLowerCase()}:latest .

# Run Docker container
docker-run:
    docker run --rm -p 3000:3000 ${config.name.toLowerCase()}:latest

# Build and run with Docker Compose
docker-up:
    docker-compose up --build

# Stop Docker Compose
docker-down:
    docker-compose down`
    : ""
}

# Run all checks (format, lint, test)
ci: fmt lint test

# Prepare for commit
pre-commit: fix test
`;
  }

  private generateDockerfile(config: ProjectConfig): string {
    return `# Multi-stage build for Rust application
FROM rust:1.70 as builder

# Create app directory
WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Build dependencies (this is the caching Docker layer!)
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm src/main.rs

# Copy source code
COPY src ./src

# Build application
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    ca-certificates \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 appuser

# Copy the binary from builder stage
COPY --from=builder /app/target/release/${config.name.toLowerCase()} /usr/local/bin/app

# Change to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

# Run the application
CMD ["app"]
`;
  }

  private generateDockerCompose(config: ProjectConfig): string {
    const dbService =
      config.database === "postgres"
        ? `
  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${config.name.toLowerCase()}
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ${config.name.toLowerCase()}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${config.name.toLowerCase()}"]
      interval: 10s
      timeout: 5s
      retries: 5`
        : "";

    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ENVIRONMENT=development
      ${config.database ? `- DATABASE_URL=postgres://${config.name.toLowerCase()}:password@database:5432/${config.name.toLowerCase()}` : ""}
    ${
      config.database
        ? `depends_on:
      database:
        condition: service_healthy`
        : ""
    }
    restart: unless-stopped
${dbService}

${
  config.database === "postgres"
    ? `volumes:
  postgres_data:`
    : ""
}
`;
  }

  private generateProductionDockerfile(config: BuildConfig): string {
    return `# Production multi-stage build with distroless
FROM rust:1.70 as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    pkg-config \\
    libssl-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm src/main.rs

# Copy source code
COPY src ./src

# Build application with optimizations
RUN touch src/main.rs && cargo build --release

# Final stage with distroless
FROM gcr.io/distroless/cc-debian12

# Copy the binary from builder stage
COPY --from=builder /app/target/release/app /app

EXPOSE 3000

USER nonroot:nonroot

ENTRYPOINT ["/app"]
`;
  }

  private generateGitHubActions(config: BuildConfig): string {
    return `name: Rust Application CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  CARGO_TERM_COLOR: always

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v4
    
    - name: Install Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        components: rustfmt, clippy
        
    - name: Cache dependencies
      uses: actions/cache@v3
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          target
        key: \${{ runner.os }}-cargo-\${{ hashFiles('**/Cargo.lock') }}
        restore-keys: |
          \${{ runner.os }}-cargo-
    
    - name: Check formatting
      run: cargo fmt -- --check
    
    - name: Run clippy
      run: cargo clippy -- -D warnings
    
    - name: Run tests
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/test
      run: cargo test --verbose

  ${
    config.target === "production"
      ? `build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install Rust
      uses: dtolnay/rust-toolchain@stable
    
    - name: Build binary
      run: cargo build --release
    
    - name: Build Docker image
      run: |
        docker build -f Dockerfile.prod -t your-registry/app:$` +
        "{{ github.sha }}" +
        ` .
        docker tag your-registry/app:$` +
        "{{ github.sha }}" +
        ` your-registry/app:latest
    
    - name: Push Docker image
      run: |
        echo "$` +
        "{{ secrets.DOCKER_PASSWORD }}" +
        `" | docker login -u "$` +
        "{{ secrets.DOCKER_USERNAME }}" +
        `" --password-stdin
        docker push your-registry/app:$` +
        `{{ github.sha }}
        docker push your-registry/app:latest`
      : ""
  }

  security-audit:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable
    - name: Install cargo-audit
      run: cargo install cargo-audit
    - name: Run security audit
      run: cargo audit
`;
  }

  private generateCargoConfig(config: BuildConfig): string {
    return `[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=lld"]

[build]
rustc-wrapper = "sccache"

[registries.crates-io]
protocol = "sparse"

${
  config.optimization
    ? `[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
opt-level = 3`
    : ""
}
`;
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
  }
}
