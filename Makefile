# Arbiter Makefile - Wrapper for common development tasks

.PHONY: help install ci test e2e build clean lint format sbom

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	bun install --frozen-lockfile

ci: ## Run all CI checks (lint, format, typecheck, test)
	bun run lint
	bun run format:check
	bun run typecheck
	bun run test

test: ## Run unit and integration tests
	bun run test

test-all: ## Run all tests including e2e and tutorial
	bun run test:all

e2e: ## Run end-to-end tests
	bun run test:e2e

e2e-headless: ## Run e2e tests in headless mode
	bun run test:e2e:headless

build: ## Build all packages and apps
	bun run build

clean: ## Clean build artifacts
	rm -rf apps/*/dist packages/*/dist node_modules/.cache
	find . -name "*.tsbuildinfo" -delete

lint: ## Run linter
	bun run lint

format: ## Format code
	bun run format:write

format-check: ## Check code formatting
	bun run format:check

contracts: ## Generate contracts and types
	bun run generate:contracts

sbom: ## Generate Software Bill of Materials
	bun run sbom

dev: ## Start development servers
	bun run dev

typecheck: ## Run TypeScript type checking
	bun run typecheck

# Default target
.DEFAULT_GOAL := help