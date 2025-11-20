SHELL := /bin/bash

.PHONY: help run build test lint format docker db-up db-down db-migrate

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\\033[36m%-20s\\033[0m %s\\n", $$1, $$2}'

run: ## Run the application
	@go run cmd/main.go

build: ## Build the application
	@go build -o bin/app cmd/main.go

test: ## Run unit tests
	@go test ./...

lint: ## Run go fmt and vet
	@go fmt ./...
	@go vet ./...

format: ## Format code
	@gofmt -s -w .

docker: ## Build docker image
	@docker build -t {{moduleName}}:latest .

{{#hasDatabase}}db-up: ## Start database container
	@echo "Starting database..."
	@docker-compose up -d database

db-down: ## Stop database container
	@echo "Stopping database..."
	@docker-compose down database

db-migrate: ## Run database migrations
	@echo "Running migrations..."
	@go run cmd/migrate.go
{{/hasDatabase}}
