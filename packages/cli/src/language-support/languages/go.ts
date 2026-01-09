/**
 * Go Language Plugin - Gin + GORM + Modern Go Patterns
 * Supports: Go 1.21+, Gin Web Framework, GORM v2, Go modules, structured logging
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BuildConfig,
  GeneratedFile,
  GenerationResult,
  LanguagePlugin,
  ProjectConfig,
  ServiceConfig,
} from "@/language-support/index.js";
import { TemplateResolver } from "@/language-support/template-resolver.js";

export class GoPlugin implements LanguagePlugin {
  readonly name = "Go Plugin";
  readonly language = "go";
  readonly version = "1.0.0";
  readonly description = "Modern Go with Gin, GORM, and idiomatic Go patterns";
  readonly supportedFeatures = [
    "web-server",
    "api",
    "database-orm",
    "middleware",
    "validation",
    "testing",
    "concurrency",
    "microservices",
    "grpc",
  ];
  readonly capabilities = {
    components: false,
    services: true,
    api: true,
    testing: true,
  };

  private templateResolver: TemplateResolver;

  constructor() {
    this.templateResolver = new TemplateResolver({
      language: "go",
      defaultDirectories: GoPlugin.resolveDefaultTemplateDirectories(),
    });
  }

  private static resolveDefaultTemplateDirectories(): string[] {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    return [
      path.resolve(moduleDir, "@/templates/go"),
      path.resolve(moduleDir, "../../templates/go"),
    ];
  }

  // --- Generation helpers (template-backed or stubbed) ---
  private async generateAPIHandler(config: ServiceConfig): Promise<string> {
    return this.templateResolver.renderTemplate("internal/handlers/api_handler.go.tpl", { config });
  }

  private async generateRoutes(config: ServiceConfig): Promise<string> {
    return this.templateResolver.renderTemplate("internal/routes/routes.go.tpl", { config });
  }

  private async generateBusinessService(config: ServiceConfig): Promise<string> {
    return this.templateResolver.renderTemplate("internal/services/service.go.tpl", { config });
  }

  private async generateModel(config: ServiceConfig): Promise<string> {
    return this.templateResolver.renderTemplate("internal/models/model.go.tpl", { config });
  }

  private generateMiddleware(config: ServiceConfig): string {
    return `package middleware\n\n// ${config.name} middleware placeholder\n`;
  }

  private async generateGoMod(config: ProjectConfig): Promise<string> {
    return this.templateResolver.renderTemplate("go.mod.tpl", { module: config.name });
  }

  private async generateMainApp(config: ProjectConfig): Promise<string> {
    return this.templateResolver.renderTemplate("cmd/main.go.tpl", { config });
  }

  private async generateConfig(config: ProjectConfig): Promise<string> {
    return this.templateResolver.renderTemplate("internal/config/config.go.tpl", { config });
  }

  private async generateDatabase(config: ProjectConfig): Promise<string> {
    return this.templateResolver.renderTemplate("internal/database/database.go.tpl", { config });
  }

  private async generateServer(config: ProjectConfig): Promise<string> {
    return this.templateResolver.renderTemplate("internal/server/server.go.tpl", { config });
  }

  private async generateCORSMiddleware(): Promise<string> {
    return this.templateResolver.renderTemplate("internal/middleware/cors.go.tpl", {});
  }

  async generateService(config: ServiceConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = [];

    switch (config.type) {
      case "api":
        files.push({
          path: `internal/handlers/${config.name.toLowerCase()}_handler.go`,
          content: await this.generateAPIHandler(config),
        });
        files.push({
          path: `internal/routes/${config.name.toLowerCase()}_routes.go`,
          content: await this.generateRoutes(config),
        });
        dependencies.push("github.com/gin-gonic/gin");
        break;
      case "service":
        files.push({
          path: `internal/services/${config.name.toLowerCase()}_service.go`,
          content: await this.generateBusinessService(config),
        });
        break;
      case "model":
        files.push({
          path: `internal/models/${config.name.toLowerCase()}.go`,
          content: await this.generateModel(config),
        });
        dependencies.push("gorm.io/gorm");
        break;
      case "middleware":
        files.push({
          path: `internal/middleware/${config.name.toLowerCase()}.go`,
          content: this.generateMiddleware(config),
        });
        break;
    }

    if (config.validation) {
      dependencies.push("github.com/go-playground/validator/v10");
    }

    if (config.database) {
      dependencies.push("gorm.io/gorm", "gorm.io/driver/postgres");
    }

    return { files, dependencies };
  }

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies = [
      "github.com/gin-gonic/gin",
      "github.com/joho/godotenv",
      "go.uber.org/zap",
    ];

    // Go module file
    files.push({
      path: "go.mod",
      content: await this.generateGoMod(config),
    });

    // Main application
    files.push({
      path: "cmd/main.go",
      content: await this.generateMainApp(config),
    });

    // Configuration
    files.push({
      path: "internal/config/config.go",
      content: await this.generateConfig(config),
    });

    // Database setup (if needed)
    if (config.database) {
      files.push({
        path: "internal/database/database.go",
        content: await this.generateDatabase(config),
      });
      dependencies.push("gorm.io/gorm", "gorm.io/driver/postgres");
    }

    // Logging setup
    files.push({
      path: "internal/logger/logger.go",
      content: await this.generateLogger(),
    });

    // Server setup
    files.push({
      path: "internal/server/server.go",
      content: await this.generateServer(config),
    });

    // Middleware
    files.push({
      path: "internal/middleware/cors.go",
      content: await this.generateCORSMiddleware(),
    });

    files.push({
      path: "internal/middleware/logger.go",
      content: await this.generateLoggerMiddleware(),
    });

    // Health check
    files.push({
      path: "internal/handlers/health_handler.go",
      content: await this.generateHealthHandler(),
    });

    // Environment file
    files.push({
      path: ".env.example",
      content: await this.generateEnvExample(config),
    });

    // Testing setup
    if (config.testing) {
      files.push({
        path: "internal/testutils/testutils.go",
        content: await this.generateTestUtils(config),
      });
    }

    // Docker setup handled by central generator

    return {
      files,
      dependencies,
      scripts: {
        dev: "go run cmd/main.go",
        build: "go build -o bin/app cmd/main.go",
        test: "go test ./...",
        "test:coverage":
          "go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out",
        lint: "golangci-lint run",
        format: "gofmt -s -w .",
        "mod:tidy": "go mod tidy",
      },
    };
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    const scripts =
      config.target === "production"
        ? { build: "go build -o bin/app cmd/main.go" }
        : { build: "go build -o bin/app cmd/main.go", test: "go test ./..." };
    return { files: [], scripts };
  }

  private async generateLogger(): Promise<string> {
    return await this.templateResolver.renderTemplate("internal/logger/logger.go.tpl", {});
  }

  private async generateLoggerMiddleware(): Promise<string> {
    return await this.templateResolver.renderTemplate("internal/middleware/logger.go.tpl", {});
  }

  private async generateHealthHandler(): Promise<string> {
    return await this.templateResolver.renderTemplate("internal/handlers/health_handler.go.tpl", {
      serviceName: "api",
    });
  }

  private async generateEnvExample(config: ProjectConfig): Promise<string> {
    const module = config.name.toLowerCase();
    const databaseBlock =
      config.database === "postgres"
        ? `# Database Configuration
DATABASE_URL=postgres://user:password@localhost:5432/${module}?sslmode=disable
`
        : "";
    const authBlock =
      config.auth === "jwt"
        ? `# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
`
        : "";

    return await this.templateResolver.renderTemplate(".env.example.tpl", {
      moduleName: module,
      databaseBlock,
      authBlock,
    });
  }

  private async generateTestUtils(config: ProjectConfig): Promise<string> {
    const dbImports = config.database ? '\t"gorm.io/driver/sqlite"\\n\\t"gorm.io/gorm"\\n' : "";
    const dbHelper = config.database
      ? `// SetupTestDB creates an in-memory SQLite database for testing
func SetupTestDB(t *testing.T) *gorm.DB {
\tdb, err := gorm.Open(sqlite.Open(\":memory:\"), &gorm.Config{})
\tassert.NoError(t, err)

\t// Auto-migrate test models here
\t// err = db.AutoMigrate(&models.User{}, &models.Item{})
\t// assert.NoError(t, err)

\treturn db
}`
      : "";

    return await this.templateResolver.renderTemplate("internal/testutils/testutils.go.tpl", {
      db_imports: dbImports,
      db_helper: dbHelper,
    });
  }

  private async generateMakefile(config: ProjectConfig): Promise<string> {
    const dockerBlock = config.docker
      ? `docker-build: ## Build Docker image
\t@echo \"Building Docker image...\"
\t@docker build -t \${APP_NAME}:latest .

docker-run: docker-build ## Build and run Docker container
\t@echo \"Running Docker container...\"
\t@docker run --rm -p 8080:8080 \${APP_NAME}:latest`
      : "";

    const dbBlock = config.database
      ? `db-up: ## Start database container
\t@echo \"Starting database...\"
\t@docker-compose up -d database

db-down: ## Stop database container
\t@echo \"Stopping database...\"
\t@docker-compose down database

db-migrate: ## Run database migrations
\t@echo \"Running migrations...\"
\t@go run cmd/migrate.go`
      : "";

    return await this.templateResolver.renderTemplate("Makefile.tpl", {
      app_name: config.name.toLowerCase(),
      docker_block: dockerBlock,
      db_block: dbBlock,
    });
  }

  private async generateGitHubActions(config: BuildConfig): Promise<string> {
    const productionBlock =
      config.target === "production"
        ? "" // Docker build/push now centralized in shared docker-generator workflows
        : "";

    return await this.templateResolver.renderTemplate("ci.yml.tpl", {
      runner_os_expr: "${{ runner.os }}",
      lockfile_hash: "${{ hashFiles('**/go.sum') }}",
      production_block: productionBlock,
    });
  }

  private async generateGoReleaser(config: BuildConfig): Promise<string> {
    return await this.templateResolver.renderTemplate(".goreleaser.yml.tpl", {
      project_name: config.target,
    });
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
  }
}
