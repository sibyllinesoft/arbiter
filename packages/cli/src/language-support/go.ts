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
        content: this.generateTestUtils(config),
      });
    }

    // Docker setup (if requested)
    if (config.docker) {
      files.push({
        path: "Dockerfile",
        content: await this.generateDockerfile(config),
      });
      files.push({
        path: "docker-compose.yml",
        content: await this.generateDockerCompose(config),
      });
    }

    // Makefile for common tasks
    files.push({
      path: "Makefile",
      content: await this.generateMakefile(config),
    });

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
    const files: GeneratedFile[] = [];

    // Production dockerfile
    if (config.target === "production") {
      files.push({
        path: "Dockerfile.prod",
        content: await this.generateProductionDockerfile(config),
      });
    }

    // CI/CD configuration
    files.push({
      path: ".github/workflows/go.yml",
      content: await this.generateGitHubActions(config),
    });

    // Build configuration
    files.push({
      path: ".goreleaser.yml",
      content: await this.generateGoReleaser(config),
    });

    return { files };
  }

  private async generateAPIHandler(config: ServiceConfig): Promise<string> {
    const packageName = config.name.toLowerCase();
    const structName = this.toPascalCase(config.name);

    return await this.templateResolver.renderTemplate("api-handler.tpl", {
      packageName,
      structName,
      serviceName: config.name,
    });
  }

  private async generateRoutes(config: ServiceConfig): Promise<string> {
    return await this.templateResolver.renderTemplate("routes.tpl", {
      ...config,
      structName: this.toPascalCase(config.name),
      name: config.name,
    });
  }

  private async generateBusinessService(config: ServiceConfig): Promise<string> {
    return await this.templateResolver.renderTemplate("service.tpl", {
      ...config,
      structName: this.toPascalCase(config.name),
    });
  }

  private async generateModel(config: ServiceConfig): Promise<string> {
    return await this.templateResolver.renderTemplate("model.tpl", {
      ...config,
      structName: this.toPascalCase(config.name),
    });
  }

  private generateMiddleware(config: ServiceConfig): string {
    const middlewareName = this.toPascalCase(config.name);

    return `package middleware

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ${middlewareName} creates a new ${config.name} middleware
func ${middlewareName}(logger *zap.Logger) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		// Pre-processing logic
		logger.Info("${middlewareName} middleware - before request")

		// Process request
		c.Next()

		// Post-processing logic
		logger.Info("${middlewareName} middleware - after request")
	})
}
`;
  }

  private async generateGoMod(config: ProjectConfig): Promise<string> {
    const fallback = `module ${config.name.toLowerCase()}

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/joho/godotenv v1.5.1
	go.uber.org/zap v1.26.0
)
`;
    return await this.templateResolver.renderTemplate(
      "go.mod.tpl",
      { moduleName: config.name.toLowerCase() },
      fallback,
    );
  }

  private async generateMainApp(config: ProjectConfig): Promise<string> {
    const module = config.name.toLowerCase();
    return await this.templateResolver.renderTemplate("main.tpl", {
      module,
      database: Boolean(config.database),
    });
  }

  private async generateConfig(config: ProjectConfig): Promise<string> {
    const module = config.name.toLowerCase();
    const fallback = `package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application
type Config struct {
	Address     string
	Environment string
	DatabaseURL string
	${config.auth ? "JWTSecret   string" : ""}
	LogLevel    string
}

// Load reads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	cfg := &Config{
		Address:     getEnv("ADDRESS", ":8080"),
		Environment: getEnv("ENVIRONMENT", "development"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://user:password@localhost:5432/${module}?sslmode=disable"),
		${config.auth ? 'JWTSecret:   getEnv("JWT_SECRET", "your-secret-key"),' : ""}
		LogLevel:    getEnv("LOG_LEVEL", "info"),
	}

	return cfg, nil
}

// getEnv gets an environment variable with a fallback value
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// getEnvAsInt gets an environment variable as integer with a fallback value
func getEnvAsInt(key string, fallback int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return fallback
}

// getEnvAsBool gets an environment variable as boolean with a fallback value
func getEnvAsBool(key string, fallback bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return fallback
}
`;
    return await this.templateResolver.renderTemplate(
      "internal/config/config.go.tpl",
      {
        moduleName: module,
        databaseField: 'DatabaseURL string        `json:"database_url" yaml:"database_url"`',
        databaseAssign: `DatabaseURL:  getEnv("DATABASE_URL", "postgres://postgres:password@localhost:5432/${module}?sslmode=disable"),`,
      },
      fallback,
    );
  }

  private async generateDatabase(config: ProjectConfig): Promise<string> {
    const module = config.name.toLowerCase();
    const fallback = `package database

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"${config.name.toLowerCase()}/internal/models"
)

// Connect establishes a database connection
func Connect(databaseURL string) (*gorm.DB, error) {
	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	db, err := gorm.Open(postgres.Open(databaseURL), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

// Migrate runs database migrations
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		// Add your models here
		// &models.User{},
		// &models.Item{},
	)
}
`;
    return await this.templateResolver.renderTemplate(
      "internal/database/database.go.tpl",
      { moduleName: module },
      fallback,
    );
  }

  private async generateServer(config: ProjectConfig): Promise<string> {
    const module = config.name.toLowerCase();
    const fallback = `package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	${config.database ? `"gorm.io/gorm"` : ""}

	"${module}/internal/config"
	"${module}/internal/handlers"
	"${module}/internal/middleware"
)

// Server represents the HTTP server
type Server struct {
	config *config.Config
	${config.database ? "db     *gorm.DB" : ""}
	logger *zap.Logger
	router *gin.Engine
}

// New creates a new server instance
func New(cfg *config.Config, ${config.database ? "db *gorm.DB, " : ""}logger *zap.Logger) *http.Server {
	// Set gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.New()

	// Add middleware
	router.Use(middleware.LoggerMiddleware(logger))
	router.Use(middleware.CORSMiddleware())
	router.Use(gin.Recovery())

	// Health check
	router.GET("/health", handlers.HealthCheck)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Add your routes here
		// Example: routes.SetupUserRoutes(v1, userService, logger)
		v1.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "pong"})
		})
	}

	return &http.Server{
		Addr:    cfg.Address,
		Handler: router,
	}
}
`;
    return await this.templateResolver.renderTemplate(
      "internal/server/server.go.tpl",
      {
        moduleName: module,
        serverDbParam: config.database ? "db *gorm.DB, " : "",
        serverDbGuard: config.database ? "" : "\t_ = logger\n",
      },
      fallback,
    );
  }

  private async generateCORSMiddleware(): Promise<string> {
    return await this.templateResolver.renderTemplate(
      "internal/middleware/cors.go.tpl",
      {},
      `package middleware

import (
	"github.com/gin-gonic/gin"
)

// CORSMiddleware handles CORS headers
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
`,
    );
  }

  private async generateLogger(): Promise<string> {
    const fallback = `package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// NewLogger creates a new zap logger
func NewLogger() (*zap.Logger, error) {
	config := zap.NewProductionConfig()
	config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	config.Encoding = "json"
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	config.EncoderConfig.StacktraceKey = "" // Disable stacktrace in logs

	logger, err := config.Build()
	if err != nil {
		return nil, err
	}

	return logger, nil
}

// NewDevelopmentLogger creates a development logger with console output
func NewDevelopmentLogger() (*zap.Logger, error) {
	config := zap.NewDevelopmentConfig()
	config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder

	logger, err := config.Build()
	if err != nil {
		return nil, err
	}

	return logger, nil
}
`;

    return await this.templateResolver.renderTemplate(
      "internal/logger/logger.go.tpl",
      {},
      fallback,
    );
  }

  private async generateLoggerMiddleware(): Promise<string> {
    return await this.templateResolver.renderTemplate(
      "internal/middleware/logger.go.tpl",
      {},
      `package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// LoggerMiddleware creates a gin middleware for logging requests
func LoggerMiddleware(logger *zap.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logger.Info("Request",
			zap.String("client_ip", param.ClientIP),
			zap.String("method", param.Method),
			zap.String("path", param.Path),
			zap.Int("status", param.StatusCode),
			zap.Duration("latency", param.Latency),
			zap.String("user_agent", param.Request.UserAgent()),
			zap.String("error", param.ErrorMessage),
		)
		return ""
	})
}
`,
    );
  }

  private async generateHealthHandler(): Promise<string> {
    return await this.templateResolver.renderTemplate(
      "internal/handlers/health_handler.go.tpl",
      { serviceName: "api" },
      `package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthCheck handles health check requests
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   "api",
		"version":   "1.0.0",
	})
}
`,
    );
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

    const fallback = `# Application Configuration
ADDRESS=:8080
ENVIRONMENT=development
LOG_LEVEL=info

${databaseBlock}
${authBlock}
# Additional configuration as needed
`;

    return await this.templateResolver.renderTemplate(
      ".env.example.tpl",
      { moduleName: module, databaseBlock, authBlock },
      fallback,
    );
  }

  private generateTestUtils(config: ProjectConfig): string {
    return `package testutils

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap/zaptest"
	${
    config.database
      ? `"gorm.io/driver/sqlite"
	"gorm.io/gorm"`
      : ""
  }
)

// SetupTestRouter creates a test router
func SetupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

// SetupTestLogger creates a test logger
func SetupTestLogger(t *testing.T) *zap.Logger {
	return zaptest.NewLogger(t)
}

${
  config.database
    ? `// SetupTestDB creates an in-memory SQLite database for testing
func SetupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Auto-migrate test models here
	// err = db.AutoMigrate(&models.User{}, &models.Item{})
	// assert.NoError(t, err)

	return db
}`
    : ""
}

// MakeRequest makes an HTTP request for testing
func MakeRequest(router *gin.Engine, method, url string, body interface{}) *httptest.ResponseRecorder {
	var reqBody []byte
	if body != nil {
		reqBody, _ = json.Marshal(body)
	}

	req, _ := http.NewRequest(method, url, bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	return w
}

// AssertJSONResponse asserts that the response body matches expected JSON
func AssertJSONResponse(t *testing.T, w *httptest.ResponseRecorder, expected interface{}) {
	var actual interface{}
	err := json.Unmarshal(w.Body.Bytes(), &actual)
	assert.NoError(t, err)
	assert.Equal(t, expected, actual)
}
`;
  }

  private generateMakefile(config: ProjectConfig): string {
    return `.PHONY: build run test clean dev help

# Variables
APP_NAME=${config.name.toLowerCase()}
BINARY_DIR=bin
BINARY_NAME=\${BINARY_DIR}/\${APP_NAME}

# Default target
help: ## Show this help message
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' \$(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \\033[36m%-20s\\033[0m %s\\n", $$1, $$2}'

build: ## Build the application
	@echo "Building \${APP_NAME}..."
	@mkdir -p \${BINARY_DIR}
	@go build -o \${BINARY_NAME} cmd/main.go
	@echo "Build complete: \${BINARY_NAME}"

run: build ## Build and run the application
	@echo "Running \${APP_NAME}..."
	@./\${BINARY_NAME}

dev: ## Run the application in development mode
	@echo "Running \${APP_NAME} in development mode..."
	@go run cmd/main.go

test: ## Run tests
	@echo "Running tests..."
	@go test -v ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	@go test -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

fmt: ## Format Go code
	@echo "Formatting code..."
	@go fmt ./...

vet: ## Run go vet
	@echo "Running go vet..."
	@go vet ./...

lint: ## Run golangci-lint
	@echo "Running linter..."
	@golangci-lint run

tidy: ## Tidy go modules
	@echo "Tidying go modules..."
	@go mod tidy

clean: ## Clean build artifacts
	@echo "Cleaning..."
	@rm -rf \${BINARY_DIR}
	@rm -f coverage.out coverage.html

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	@go mod download

${
  config.docker
    ? `docker-build: ## Build Docker image
	@echo "Building Docker image..."
	@docker build -t \${APP_NAME}:latest .

docker-run: docker-build ## Build and run Docker container
	@echo "Running Docker container..."
	@docker run --rm -p 8080:8080 \${APP_NAME}:latest`
    : ""
}

# Development database commands (if using Docker)
${
  config.database
    ? `db-up: ## Start database container
	@echo "Starting database..."
	@docker-compose up -d database

db-down: ## Stop database container
	@echo "Stopping database..."
	@docker-compose down database

db-migrate: ## Run database migrations
	@echo "Running migrations..."
	@go run cmd/migrate.go`
    : ""
}
`;
  }

  private async generateDockerfile(config: ProjectConfig): Promise<string> {
    const fallback = `# Multi-stage build for Go application
FROM golang:1.21-alpine AS builder

# Install git and ca-certificates (needed for private repos and HTTPS)
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \\
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Copy any additional files (config, migrations, etc.)
# COPY --from=builder /app/migrations ./migrations

# Change ownership to non-root user
RUN chown -R appuser:appgroup /root
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["@/language-support/main"]
`;

    return await this.templateResolver.renderTemplate("Dockerfile.tpl", {}, fallback);
  }

  private async generateDockerCompose(config: ProjectConfig): Promise<string> {
    const module = config.name.toLowerCase();
    const dbEnv =
      config.database === "postgres"
        ? `      - DATABASE_URL=postgres://${module}:password@database:5432/${module}?sslmode=disable\n`
        : "";
    const dbService =
      config.database === "postgres"
        ? `  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${module}
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ${module}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${module}"]
      interval: 10s
      timeout: 5s
      retries: 5
`
        : "";
    const dbVolume = config.database === "postgres" ? "volumes:\n  postgres_data:\n" : "";

    return await this.templateResolver.renderTemplate(
      "docker-compose.yml.tpl",
      {
        databaseEnv: dbEnv,
        databaseService: dbService,
        databaseVolume: dbVolume,
      },
      `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ENVIRONMENT=development
${dbEnv}    restart: unless-stopped
${dbService}

${dbVolume}`,
    );
  }

  private async generateProductionDockerfile(_config: BuildConfig): Promise<string> {
    const fallback = `# Production multi-stage build
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates gcc musl-dev

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build \\
    -a -installsuffix cgo \\
    -ldflags='-w -s -extldflags "-static"' \\
    -o main cmd/main.go

# Final minimal stage
FROM scratch

# Copy ca-certificates from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy the binary
COPY --from=builder /app/main /main

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["/main"]
`;
    return await this.templateResolver.renderTemplate("Dockerfile.prod.tpl", {}, fallback);
  }

  private generateGitHubActions(config: BuildConfig): string {
    return `name: Go Application CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

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
    
    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'
        
    - name: Cache Go modules
      uses: actions/cache@v3
      with:
        path: ~/go/pkg/mod
        key: \${{ runner.os }}-go-\${{ hashFiles('**/go.sum') }}
        restore-keys: |
          \${{ runner.os }}-go-
    
    - name: Download dependencies
      run: go mod download
    
    - name: Verify dependencies
      run: go mod verify
    
    - name: Format check
      run: |
        if [ "$(gofmt -s -l . | wc -l)" -gt 0 ]; then
          echo "Code is not formatted. Please run 'gofmt -s -w .'"
          gofmt -s -l .
          exit 1
        fi
    
    - name: Vet
      run: go vet ./...
    
    - name: Lint
      uses: golangci/golangci-lint-action@v3
      with:
        version: latest
    
    - name: Test
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/test?sslmode=disable
      run: go test -race -coverprofile=coverage.out -covermode=atomic ./...
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.out
        flags: unittests
        name: codecov-umbrella

  ${
    config.target === "production"
      ? `build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'
    
    - name: Build binary
      run: |
        CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo \\
          -ldflags='-w -s -extldflags "-static"' \\
          -o bin/app cmd/main.go
    
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
`;
  }

  private generateGoReleaser(config: BuildConfig): string {
    return `# GoReleaser configuration
project_name: ${config.target}

before:
  hooks:
    - go mod tidy
    - go generate ./...

builds:
  - env:
      - CGO_ENABLED=0
    goos:
      - linux
      - windows
      - darwin
    goarch:
      - amd64
      - arm64
    main: ./cmd/main.go
    binary: app
    ldflags:
      - -s -w -X main.version={{.Version}} -X main.commit={{.Commit}} -X main.date={{.Date}}

archives:
  - format: tar.gz
    name_template: >-
      {{ .ProjectName }}_
      {{- title .Os }}_
      {{- if eq .Arch "amd64" }}x86_64
      {{- else if eq .Arch "386" }}i386
      {{- else }}{{ .Arch }}{{ end }}
    format_overrides:
      - goos: windows
        format: zip

checksum:
  name_template: 'checksums.txt'

snapshot:
  name_template: "{{ incpatch .Version }}-next"

changelog:
  sort: asc
  filters:
    exclude:
      - '^docs:'
      - '^test:'

dockers:
  - image_templates:
      - "your-registry/{{.ProjectName}}:{{ .Tag }}"
      - "your-registry/{{.ProjectName}}:latest"
    dockerfile: Dockerfile.prod
    build_flag_templates:
      - "--platform=linux/amd64"
`;
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase());
  }
}
