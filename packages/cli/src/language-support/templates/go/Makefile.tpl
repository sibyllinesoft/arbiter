.PHONY: build run test clean dev help

# Variables
APP_NAME={{ app_name }}
BINARY_DIR=bin
BINARY_NAME=${BINARY_DIR}/${APP_NAME}

# Default target
help: ## Show this help message
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build the application
	@echo "Building ${APP_NAME}..."
	@mkdir -p ${BINARY_DIR}
	@go build -o ${BINARY_NAME} cmd/main.go
	@echo "Build complete: ${BINARY_NAME}"

run: build ## Build and run the application
	@echo "Running ${APP_NAME}..."
	@./${BINARY_NAME}

dev: ## Run the application in development mode
	@echo "Running ${APP_NAME} in development mode..."
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
	@rm -rf ${BINARY_DIR}
	@rm -f coverage.out coverage.html

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	@go mod download

{{ docker_block }}

# Development database commands (if using Docker)
{{ db_block }}
