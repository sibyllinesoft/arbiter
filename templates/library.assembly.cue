// Library Artifact Assembly Template
// Use this template for reusable code packages (NPM packages, Go modules, Python libraries, etc.)

package assembly

import "github.com/arbiter/spec/profiles"

// =============================================================================
// ARTIFACT METADATA
// =============================================================================

artifact: {
	// Project identification
	name:        "my-awesome-library"  // Replace with your library name
	version:     "1.0.0"               // Semantic version - updated by CI/CD
	kind:        "library"             // Fixed for library artifacts
	description: "A high-performance data processing library with type-safe APIs"
	
	// Repository information
	repository: {
		url:    "https://github.com/myorg/my-awesome-library"
		branch: "main"
	}
	
	// License and maintainer info
	license: "MIT"
	author:  "Your Organization <contact@yourorg.com>"
	
	// Language and framework
	language:  "typescript"  // or "go", "python", "rust"
	framework: "none"        // or specific framework if applicable
}

// =============================================================================
// LIBRARY PROFILE CONFIGURATION
// =============================================================================

profile: profiles.LibraryProfile & {
	// Semantic versioning enforcement
	// Options: "strict" | "minor" | "none"
	semver: "strict"
	
	// API surface tracking and validation
	apiSurface: {
		source: "generated"  // API surface is auto-generated from code
		file:   "./dist/api-surface.json"
		
		// Language-specific API extractors
		extractors: {
			// TypeScript API extraction
			typescript: {
				tool:   "api-extractor"
				config: "./api-extractor.json"
				output: "./dist/api-surface.json"
			}
			
			// Go API extraction (uncomment if using Go)
			// go: {
			//   tool: "go-api-extractor"
			//   pattern: "./..."
			//   output: "./api-surface.json"
			// }
		}
	}
	
	// Breaking change detection and version requirements
	contracts: {
		forbidBreaking: true  // Prevent breaking changes in non-major releases
		
		// API invariants that must always be true
		invariants: [
			"apiSurface.exports != null",
			"len(apiSurface.exports) > 0",
			"apiSurface.breaking_changes == null",
		]
		
		// Version bump requirements based on change type
		versionRules: {
			breaking: "major"  // Breaking changes require major version bump
			addition: "minor"  // New features require minor version bump
			bugfix:   "patch"  // Bug fixes require patch version bump
		}
		
		// Cross-version compatibility matrix
		compatibilityMatrix: {
			backwards: 2     // Support 2 major versions back
			forwards:  false // Forward compatibility not guaranteed
		}
	}
	
	// Property-based tests for library invariants
	propertyTests: [
		{
			name:        "export_consistency"
			description: "All public exports must have consistent TypeScript types"
			property:    "all_exports_have_types"
			examples: ["function", "class", "interface", "type"]
		},
		{
			name:        "api_stability"
			description: "Public API surface should remain stable across patch versions"
			property:    "api_surface_stable_in_patch"
			examples: ["v1.0.0", "v1.0.1", "v1.0.2"]
		},
		{
			name:        "documentation_coverage"
			description: "All public APIs must have JSDoc documentation"
			property:    "all_public_apis_documented"
			examples: ["function", "class", "interface"]
		},
	]
	
	// Build matrix for testing across different versions
	buildMatrix: {
		nodeVersions: ["18", "20", "22"]     // Test on multiple Node.js versions
		// goVersions: ["1.20", "1.21"]      // Uncomment for Go projects
		// pythonVersions: ["3.9", "3.10", "3.11"]  // Uncomment for Python projects
		// rustVersions: ["1.70", "1.75"]    // Uncomment for Rust projects
	}
}

// =============================================================================
// BUILD CONFIGURATION
// =============================================================================

build: {
	// Language-specific build settings
	language:  artifact.language
	framework: artifact.framework
	
	// Build targets and output formats
	targets: [
		"es2020",      // Modern JavaScript target
		"commonjs",    // CommonJS for Node.js compatibility
		"esm",         // ES modules for modern bundlers
	]
	
	// TypeScript-specific configuration
	typescript: {
		strict:     true                    // Enable strict type checking
		declaration: true                   // Generate .d.ts files
		sourceMap:   true                   // Generate source maps
		outDir:      "./dist"               // Output directory
		include: ["src/**/*"]               // Source files to compile
		exclude: ["**/*.test.ts", "**/*.spec.ts"] // Exclude test files
	}
	
	// Bundle configuration for libraries
	bundle: {
		minify:       false  // Don't minify library code for better debugging
		treeshaking:  true   // Enable tree shaking for smaller bundles
		externals: [         // Mark these as external dependencies
			"lodash",
			"axios",
			"react",
		]
	}
	
	// Assets to include in the build
	assets: [
		"README.md",
		"LICENSE",
		"CHANGELOG.md",
	]
}

// =============================================================================
// COMPREHENSIVE TEST CONFIGURATION
// =============================================================================

tests: {
	// Unit testing requirements
	unit: {
		framework: "vitest"        // or "jest", "mocha", etc.
		coverage: {
			minimum:    90         // Minimum 90% code coverage
			threshold: {
				statements: 90
				branches:   85
				functions:  95
				lines:      90
			}
		}
		
		// Test patterns and locations
		patterns: [
			"src/**/*.test.ts",
			"src/**/*.spec.ts",
		]
		
		// Test environment configuration
		environment: "node"        // or "jsdom" for browser-like environment
		globals:     true          // Allow global test functions
		
		// Performance benchmarks for critical functions
		benchmarks: [
			{
				name:      "data_processing_performance"
				function:  "processLargeDataset"
				maxTime:   "100ms"     // Function must complete within 100ms
				dataset:   "10000_records"
			},
			{
				name:     "memory_usage"
				function: "createProcessor"
				maxMemory: "50MB"      // Function must use less than 50MB
			},
		]
	}
	
	// Integration testing with external dependencies
	integration: {
		required: true
		
		// Test database connections, external APIs, etc.
		dependencies: [
			{
				name:    "redis"
				image:   "redis:7-alpine"
				ports:   ["6379:6379"]
				healthCheck: "redis-cli ping"
			},
			{
				name:  "postgres"
				image: "postgres:15-alpine"
				ports: ["5432:5432"]
				env: {
					POSTGRES_DB:       "testdb"
					POSTGRES_USER:     "testuser"
					POSTGRES_PASSWORD: "testpass"
				}
				healthCheck: "pg_isready -U testuser -d testdb"
			},
		]
		
		// Integration test suites
		suites: [
			{
				name:        "database_integration"
				description: "Test database connection and query performance"
				tests: [
					"tests/integration/database.test.ts",
				]
				timeout: "30s"
			},
			{
				name:        "api_integration"
				description: "Test external API interactions"
				tests: [
					"tests/integration/api.test.ts",
				]
				timeout: "15s"
			},
		]
	}
	
	// End-to-end testing (optional for libraries)
	e2e: {
		required: false
		framework: "playwright"
		
		// Test the library in real applications
		scenarios: [
			{
				name:        "react_integration"
				description: "Test library usage in React application"
				app:         "./examples/react-example"
				tests: [
					"examples/react-example/tests/e2e.spec.ts",
				]
			},
		]
	}
}

// =============================================================================
// PACKAGING AND DISTRIBUTION
// =============================================================================

package: {
	// Package registry settings
	registry: "https://registry.npmjs.org/"  // NPM registry
	publish:  true                           // Auto-publish on successful validation
	access:   "public"                       // Package visibility
	
	// Package metadata for distribution
	main:    "./dist/index.js"               // CommonJS entry point
	module:  "./dist/index.esm.js"           // ES module entry point
	types:   "./dist/index.d.ts"             // TypeScript definitions
	exports: {
		".": {
			"import":  "./dist/index.esm.js"
			"require": "./dist/index.js"
			"types":   "./dist/index.d.ts"
		}
		"./utils": {
			"import":  "./dist/utils.esm.js"
			"require": "./dist/utils.js"
			"types":   "./dist/utils.d.ts"
		}
	}
	
	// Files to include in the package
	files: [
		"dist/",
		"src/",
		"README.md",
		"LICENSE",
		"CHANGELOG.md",
	]
	
	// Package keywords for discoverability
	keywords: [
		"typescript",
		"data-processing",
		"performance",
		"type-safe",
	]
	
	// Funding and support information
	funding: {
		type: "github"
		url:  "https://github.com/sponsors/myorg"
	}
	
	// Repository and issue tracking
	repository: artifact.repository
	bugs:       "https://github.com/myorg/my-awesome-library/issues"
	homepage:   "https://github.com/myorg/my-awesome-library#readme"
}

// =============================================================================
// DOCUMENTATION CONFIGURATION
// =============================================================================

documentation: {
	// API documentation generation
	api: {
		tool:   "typedoc"              // Documentation generator
		input:  "./src"                // Source directory to document
		output: "./docs/api"           // Documentation output directory
		config: "./typedoc.json"       // TypeDoc configuration file
		
		// Documentation requirements
		coverage: {
			minimum: 95                // 95% documentation coverage required
			exclude: [
				"**/*.test.ts",
				"**/*.spec.ts",
				"**/internal/**",      // Exclude internal modules
			]
		}
	}
	
	// User guides and tutorials
	guides: [
		{
			name:        "getting-started"
			description: "Quick start guide for new users"
			file:        "docs/guides/getting-started.md"
			examples:    true          // Include code examples
		},
		{
			name:        "advanced-usage"
			description: "Advanced features and configuration"
			file:        "docs/guides/advanced-usage.md"
			examples:    true
		},
		{
			name:        "migration-guide"
			description: "Guide for migrating between major versions"
			file:        "docs/guides/migration.md"
			examples:    false
		},
	]
	
	// Example projects demonstrating usage
	examples: [
		{
			name:        "basic-usage"
			description: "Simple usage example with TypeScript"
			directory:   "examples/basic"
			language:    "typescript"
			framework:   "none"
		},
		{
			name:        "react-integration"
			description: "Using the library in a React application"
			directory:   "examples/react"
			language:    "typescript"
			framework:   "react"
		},
		{
			name:        "node-cli"
			description: "Building a CLI tool with the library"
			directory:   "examples/cli"
			language:    "typescript"
			framework:   "none"
		},
	]
}

// =============================================================================
// QUALITY GATES AND VALIDATION
// =============================================================================

validation: {
	// Quality gates that must pass before release
	gates: [
		{
			name:        "api_compatibility"
			description: "Ensure API changes follow semver rules"
			command:     "arbiter validate-api-surface"
			required:    true
		},
		{
			name:        "test_coverage"
			description: "Minimum test coverage threshold"
			command:     "npm run test:coverage"
			threshold:   90
			required:    true
		},
		{
			name:        "performance_regression"
			description: "No performance regression in critical paths"
			command:     "npm run test:benchmark"
			required:    true
		},
		{
			name:        "security_scan"
			description: "Security vulnerability scanning"
			command:     "npm audit --audit-level=moderate"
			required:    true
		},
		{
			name:        "license_compliance"
			description: "Ensure all dependencies have compatible licenses"
			command:     "license-checker --onlyAllow 'MIT;Apache-2.0;BSD-3-Clause'"
			required:    true
		},
	]
	
	// Pre-commit hooks
	preCommit: [
		"lint-staged",          // Lint and format staged files
		"type-check",           // TypeScript type checking
		"test-affected",        // Run tests for changed files
	]
	
	// Pre-push hooks
	prePush: [
		"test:unit",           // Full unit test suite
		"test:integration",    // Integration tests
		"build",               // Ensure build succeeds
	]
}

// =============================================================================
// CI/CD INTEGRATION
// =============================================================================

ci: {
	// Continuous Integration configuration
	provider: "github-actions"  // or "gitlab-ci", "jenkins", etc.
	
	// Build matrix for testing
	matrix: {
		os: ["ubuntu-latest", "macos-latest", "windows-latest"]
		nodeVersion: build.buildMatrix.nodeVersions
	}
	
	// Pipeline stages
	stages: [
		{
			name:  "install"
			steps: ["npm ci"]
		},
		{
			name: "validate"
			steps: [
				"arbiter validate",
				"npm run lint",
				"npm run type-check",
			]
		},
		{
			name: "test"
			steps: [
				"npm run test:unit",
				"npm run test:integration",
			]
			artifacts: [
				"coverage/",
				"test-results.xml",
			]
		},
		{
			name: "build"
			steps: [
				"npm run build",
				"npm run docs:build",
			]
			artifacts: [
				"dist/",
				"docs/",
			]
		},
		{
			name: "security"
			steps: [
				"npm audit --audit-level=moderate",
				"snyk test",
			]
		},
	]
	
	// Deployment configuration
	deployment: {
		// Auto-deploy to NPM on successful pipeline
		npm: {
			enabled:     true
			conditions: ["branch == main", "tag =~ /^v\\d+\\.\\d+\\.\\d+$/"]
			registry:    package.registry
		}
		
		// Deploy documentation to GitHub Pages
		docs: {
			enabled:    true
			conditions: ["branch == main"]
			target:     "gh-pages"
			directory:  "docs/"
		}
	}
}

// =============================================================================
// EXAMPLE USAGE AND CUSTOMIZATION
// =============================================================================

// This template provides a comprehensive starting point for library projects.
// Customize the following sections based on your specific needs:
//
// 1. artifact.name, artifact.description - Update with your project details
// 2. profile.buildMatrix - Add/remove language versions as needed
// 3. tests.integration.dependencies - Configure required services
// 4. package.keywords - Add relevant keywords for discoverability
// 5. validation.gates - Add project-specific quality gates
//
// For language-specific customization:
//
// Go Projects:
// - Change artifact.language to "go"
// - Update build.targets for Go-specific outputs
// - Configure Go module settings in package section
//
// Python Projects:  
// - Change artifact.language to "python"
// - Update build.targets for wheel/sdist distribution
// - Configure PyPI settings in package section
//
// Rust Projects:
// - Change artifact.language to "rust"
// - Update build.targets for cargo build configurations
// - Configure crates.io settings in package section