// CLI Artifact Assembly Template
// Use this template for command-line interface tools and utilities

package assembly

import "github.com/arbiter/spec/profiles"

// =============================================================================
// ARTIFACT METADATA
// =============================================================================

artifact: {
	// Project identification
	name:        "my-awesome-cli"              // Replace with your CLI name
	version:     "1.0.0"                      // Semantic version
	kind:        "cli"                        // Fixed for CLI artifacts
	description: "A powerful CLI tool for automating development workflows"
	
	// Repository information
	repository: {
		url:    "https://github.com/myorg/my-awesome-cli"
		branch: "main"
	}
	
	// License and maintainer info
	license: "MIT"
	author:  "Your Organization <contact@yourorg.com>"
	
	// Primary language and runtime
	language:  "typescript"  // or "go", "python", "rust"
	runtime:   "node"        // or "binary", "python", etc.
}

// =============================================================================
// CLI PROFILE CONFIGURATION
// =============================================================================

profile: profiles.CLIProfile & {
	// Complete command tree specification
	commands: [
		{
			name:        "init"
			summary:     "Initialize a new project"
			description: "Create a new project with default configuration and directory structure"
			
			// Positional arguments
			args: [
				{
					name:        "project-name"
					type:        "str"
					required:    false
					description: "Name of the project to initialize (default: current directory name)"
					validation:  "^[a-zA-Z0-9-_]+$"  // Alphanumeric, hyphens, underscores only
				},
			]
			
			// Named flags and options
			flags: [
				{
					name:        "template"
					short:       "t"
					type:        "enum"
					default:     "basic"
					required:    false
					description: "Project template to use"
					validation:  "basic|advanced|minimal|full-stack"
				},
				{
					name:        "language"
					short:       "l"
					type:        "enum"
					default:     "typescript"
					required:    false
					description: "Primary programming language"
					validation:  "typescript|javascript|go|python|rust"
				},
				{
					name:        "force"
					short:       "f"
					type:        "bool"
					default:     false
					required:    false
					description: "Overwrite existing files if they exist"
				},
				{
					name:        "output"
					short:       "o"
					type:        "file"
					required:    false
					description: "Output directory for the new project"
					validation:  "writable_directory"
				},
				{
					name:        "config"
					short:       "c"
					type:        "file"
					required:    false
					description: "Path to custom configuration file"
					validation:  "*.json || *.yaml || *.toml"
				},
			]
			
			// Exit codes and their meanings
			exits: [
				{code: 0, meaning: "success", description: "Project initialized successfully"},
				{code: 1, meaning: "init_failed", description: "Failed to initialize project"},
				{code: 2, meaning: "invalid_args", description: "Invalid command arguments"},
				{code: 3, meaning: "permission_denied", description: "Insufficient permissions to write files"},
				{code: 4, meaning: "template_not_found", description: "Specified template does not exist"},
			]
			
			// Input/Output specification
			io: {
				in:     "none"
				out:    "stdout"
				err:    "stderr"
				schema: "./schemas/init-result.json"
			}
		},
		
		{
			name:        "build"
			summary:     "Build the project"
			description: "Compile, bundle, and prepare the project for deployment"
			
			args: [
				{
					name:        "target"
					type:        "enum"
					required:    false
					description: "Build target environment"
					validation:  "development|staging|production"
				},
			]
			
			flags: [
				{
					name:        "watch"
					short:       "w"
					type:        "bool"
					default:     false
					description: "Watch for file changes and rebuild automatically"
				},
				{
					name:        "minify"
					short:       "m"
					type:        "bool"
					default:     false
					description: "Minify the output for production builds"
				},
				{
					name:        "source-maps"
					type:        "bool"
					default:     true
					description: "Generate source maps for debugging"
				},
				{
					name:        "output-dir"
					type:        "file"
					default:     "./dist"
					description: "Directory to output built files"
					validation:  "writable_directory"
				},
				{
					name:        "parallel"
					short:       "p"
					type:        "int"
					default:     0
					description: "Number of parallel build processes (0 = auto-detect)"
					validation:  ">= 0 && <= 16"
				},
				{
					name:        "verbose"
					short:       "v"
					type:        "bool"
					default:     false
					description: "Show detailed build output"
				},
			]
			
			exits: [
				{code: 0, meaning: "success", description: "Build completed successfully"},
				{code: 1, meaning: "build_failed", description: "Build process failed"},
				{code: 2, meaning: "invalid_config", description: "Invalid build configuration"},
				{code: 3, meaning: "missing_deps", description: "Missing required dependencies"},
			]
			
			io: {
				in:     "file"
				out:    "stdout"
				err:    "stderr"
				schema: "./schemas/build-result.json"
			}
		},
		
		{
			name:        "test"
			summary:     "Run the test suite"
			description: "Execute unit tests, integration tests, and generate coverage reports"
			
			flags: [
				{
					name:        "coverage"
					short:       "c"
					type:        "bool"
					default:     false
					description: "Generate test coverage report"
				},
				{
					name:        "watch"
					short:       "w"
					type:        "bool"
					default:     false
					description: "Watch for file changes and re-run tests"
				},
				{
					name:        "filter"
					short:       "f"
					type:        "str"
					required:    false
					description: "Run only tests matching this pattern"
					validation:  "valid_regex"
				},
				{
					name:        "timeout"
					short:       "t"
					type:        "int"
					default:     30000
					description: "Test timeout in milliseconds"
					validation:  "> 0 && <= 300000"  // Max 5 minutes
				},
				{
					name:        "reporter"
					short:       "r"
					type:        "enum"
					default:     "default"
					description: "Test output format"
					validation:  "default|json|junit|tap|minimal"
				},
			]
			
			exits: [
				{code: 0, meaning: "all_passed", description: "All tests passed"},
				{code: 1, meaning: "tests_failed", description: "Some tests failed"},
				{code: 2, meaning: "no_tests", description: "No tests found to run"},
				{code: 3, meaning: "setup_failed", description: "Test environment setup failed"},
			]
			
			io: {
				in:     "none"
				out:    "stdout"
				err:    "stderr"
				schema: "./schemas/test-result.json"
			}
		},
		
		{
			name:        "deploy"
			summary:     "Deploy the application"
			description: "Deploy the built application to the specified environment"
			
			args: [
				{
					name:        "environment"
					type:        "enum"
					required:    true
					description: "Target deployment environment"
					validation:  "staging|production|development"
				},
			]
			
			flags: [
				{
					name:        "dry-run"
					type:        "bool"
					default:     false
					description: "Show what would be deployed without actually deploying"
				},
				{
					name:        "config"
					short:       "c"
					type:        "file"
					required:    false
					description: "Path to deployment configuration file"
					validation:  "*.json || *.yaml"
				},
				{
					name:        "skip-build"
					type:        "bool"
					default:     false
					description: "Skip the build step and deploy existing artifacts"
				},
				{
					name:        "rollback"
					type:        "bool"
					default:     false
					description: "Rollback to the previous deployment"
				},
			]
			
			exits: [
				{code: 0, meaning: "deployed", description: "Deployment completed successfully"},
				{code: 1, meaning: "deploy_failed", description: "Deployment failed"},
				{code: 2, meaning: "invalid_env", description: "Invalid or unavailable environment"},
				{code: 3, meaning: "auth_failed", description: "Authentication to deployment target failed"},
				{code: 4, meaning: "pre_deploy_failed", description: "Pre-deployment checks failed"},
			]
			
			io: {
				in:     "file"
				out:    "stdout"
				err:    "stderr"
				schema: "./schemas/deploy-result.json"
			}
		},
		
		// Subcommand example for complex CLI structures
		{
			name:        "config"
			summary:     "Manage configuration settings"
			description: "View, set, or validate configuration options"
			
			// Subcommands for nested CLI structure
			subcommands: [
				{
					name:        "get"
					summary:     "Get configuration value"
					description: "Retrieve the current value of a configuration option"
					
					args: [
						{
							name:        "key"
							type:        "str"
							required:    true
							description: "Configuration key to retrieve"
							validation:  "^[a-zA-Z0-9._-]+$"
						},
					]
					
					flags: [
						{
							name:        "default"
							short:       "d"
							type:        "str"
							required:    false
							description: "Default value if key is not set"
						},
					]
					
					exits: [
						{code: 0, meaning: "success"},
						{code: 1, meaning: "key_not_found"},
					]
					
					io: {
						in:  "none"
						out: "stdout"
					}
				},
				{
					name:        "set"
					summary:     "Set configuration value"
					description: "Update a configuration option with a new value"
					
					args: [
						{
							name:        "key"
							type:        "str"
							required:    true
							description: "Configuration key to set"
							validation:  "^[a-zA-Z0-9._-]+$"
						},
						{
							name:        "value"
							type:        "str"
							required:    true
							description: "New value for the configuration key"
						},
					]
					
					flags: [
						{
							name:        "global"
							short:       "g"
							type:        "bool"
							default:     false
							description: "Set value in global configuration"
						},
					]
					
					exits: [
						{code: 0, meaning: "success"},
						{code: 1, meaning: "invalid_key"},
						{code: 2, meaning: "invalid_value"},
					]
					
					io: {
						in:  "none"
						out: "stdout"
					}
				},
			]
		},
	]
	
	// =============================================================================
	// COMPREHENSIVE TEST SPECIFICATIONS
	// =============================================================================
	
	tests: {
		// Golden file tests for expected CLI behavior
		golden: [
			// Help command tests
			{
				name:     "global_help"
				cmd:      "--help"
				wantOut:  "*A powerful CLI tool for automating development workflows*"
				wantCode: 0
				timeout:  "5s"
			},
			{
				name:     "init_help"
				cmd:      "init --help"
				wantOut:  "*Initialize a new project*"
				wantCode: 0
				timeout:  "5s"
			},
			{
				name:     "build_help"
				cmd:      "build --help"
				wantOut:  "*Build the project*"
				wantCode: 0
				timeout:  "5s"
			},
			
			// Version command tests
			{
				name:     "version_short"
				cmd:      "-v"
				wantRE:   "\\d+\\.\\d+\\.\\d+"  // Semantic version regex
				wantCode: 0
				timeout:  "3s"
			},
			{
				name:     "version_long"
				cmd:      "--version"
				wantRE:   "\\d+\\.\\d+\\.\\d+"
				wantCode: 0
				timeout:  "3s"
			},
			
			// Successful command executions
			{
				name:    "init_basic"
				cmd:     "init test-project --template basic --force"
				setup:   "mkdir -p /tmp/cli-test && cd /tmp/cli-test"
				wantOut: "*Project initialized successfully*"
				wantCode: 0
				cleanup: "rm -rf /tmp/cli-test"
				timeout: "30s"
			},
			{
				name:    "init_with_language"
				cmd:     "init --template advanced --language typescript"
				setup:   "mkdir -p /tmp/cli-test-2 && cd /tmp/cli-test-2"
				wantOut: "*Project initialized successfully*"
				wantCode: 0
				cleanup: "rm -rf /tmp/cli-test-2"
				timeout: "30s"
			},
			{
				name:    "config_get_default"
				cmd:     "config get nonexistent.key --default 'default-value'"
				wantOut: "*default-value*"
				wantCode: 0
				timeout: "5s"
			},
			
			// Error handling tests
			{
				name:     "invalid_command"
				cmd:      "nonexistent-command"
				wantCode: 1
				wantErr:  "*Unknown command*"
				timeout:  "5s"
			},
			{
				name:     "invalid_template"
				cmd:      "init --template invalid-template"
				wantCode: 4
				wantErr:  "*template does not exist*"
				timeout:  "10s"
			},
			{
				name:     "missing_required_arg"
				cmd:      "deploy"  // Missing required environment argument
				wantCode: 2
				wantErr:  "*environment is required*"
				timeout:  "5s"
			},
			{
				name:     "invalid_flag_value"
				cmd:      "build --parallel -1"  // Negative parallel count
				wantCode: 2
				wantErr:  "*parallel must be >= 0*"
				timeout:  "5s"
			},
			
			// Complex workflow tests
			{
				name:    "build_watch_interrupt"
				cmd:     "build --watch"
				in:      "\\x03"  // Send Ctrl+C after starting watch mode
				setup:   "mkdir -p /tmp/build-test && cd /tmp/build-test && echo '{}' > package.json"
				wantOut: "*Watching for changes*"
				wantCode: 0  // Should exit cleanly on interrupt
				cleanup: "rm -rf /tmp/build-test"
				timeout: "10s"
			},
		]
		
		// Property-based tests for behavioral consistency
		property: [
			{
				name:        "help_commands_exit_zero"
				description: "All --help commands should exit with code 0"
				property:    "all(commands, cmd => cmd.help_exit_code == 0)"
			},
			{
				name:        "version_format_consistent"
				description: "Version output should always match semantic version format"
				property:    "version_output =~ /^\\d+\\.\\d+\\.\\d+/"
			},
			{
				name:        "required_args_validated"
				description: "Commands with required arguments should fail when not provided"
				property:    "all(commands, cmd => all(cmd.args, arg => arg.required => missing_arg_fails(cmd, arg)))"
			},
			{
				name:        "flag_short_forms_work"
				description: "All short flag forms should work identically to long forms"
				property:    "all(flags_with_short, flag => short_flag_behavior == long_flag_behavior)"
			},
			{
				name:        "exit_codes_documented"
				description: "All possible exit codes should be documented"
				property:    "all(commands, cmd => all(cmd.exits, exit => exit.description != null))"
			},
		]
		
		// Interactive tests for prompts and user input
		interactive: [
			{
				name:    "init_interactive_mode"
				script:  """
				spawn "my-awesome-cli init --interactive"
				expect "Project name:"
				send "test-project\\r"
				expect "Template:"
				send "advanced\\r"
				expect "Language:"
				send "typescript\\r"
				expect "Project initialized successfully"
				expect eof
				"""
				timeout: "60s"
			},
			{
				name:    "deploy_confirmation"
				script:  """
				spawn "my-awesome-cli deploy production"
				expect "Deploy to production? (y/N):"
				send "y\\r"
				expect "Deployment completed"
				expect eof
				"""
				timeout: "30s"
			},
		]
	}
	
	// =============================================================================
	// CLI METADATA AND BRANDING
	// =============================================================================
	
	metadata: {
		version:     artifact.version
		author:      artifact.author
		license:     artifact.license
		homepage:    artifact.repository.url
		description: artifact.description
		
		// Command-line usage examples
		examples: [
			"my-awesome-cli init my-project --template advanced",
			"my-awesome-cli build --watch --verbose",
			"my-awesome-cli test --coverage --reporter json",
			"my-awesome-cli deploy staging --dry-run",
			"my-awesome-cli config set build.parallel 4",
		]
		
		// Additional help text
		footer: "For more information, visit: https://docs.myorg.com/my-awesome-cli"
	}
	
	// Shell completion support configuration
	completion: {
		bash:       true   // Generate bash completion scripts
		zsh:        true   // Generate zsh completion scripts  
		fish:       false  // Fish shell completion
		powershell: false  // PowerShell completion (Windows)
	}
	
	// Installation and distribution methods
	installation: {
		npm:      true   // Publish to NPM registry
		binary:   true   // Provide standalone binary downloads
		homebrew: false  // Homebrew formula (macOS/Linux)
		docker:   false  // Docker image distribution
	}
}

// =============================================================================
// BUILD CONFIGURATION
// =============================================================================

build: {
	// Language and runtime configuration
	language: artifact.language
	runtime:  artifact.runtime
	
	// Build targets for different distribution methods
	targets: [
		"node18",      // Node.js 18+ compatible
		"binary-x64",  // Standalone x64 binary
		"binary-arm64", // Standalone ARM64 binary
	]
	
	// TypeScript-specific build settings
	typescript: {
		strict:      true
		declaration: false  // CLI tools don't need .d.ts files
		sourceMap:   false  // Minimize binary size
		target:      "ES2022"
		outDir:      "./dist"
		
		// Include CLI-specific files
		include: [
			"src/**/*",
			"templates/**/*",  // Include template files
			"schemas/**/*",    // Include JSON schemas
		]
		
		// Exclude non-essential files
		exclude: [
			"**/*.test.ts",
			"**/*.spec.ts",
			"examples/**/*",
		]
	}
	
	// Bundle configuration for CLI distribution
	bundle: {
		// Create single executable file
		singleFile: true
		minify:     true   // Minimize file size for distribution
		treeshaking: true  // Remove unused code
		
		// Include assets in the bundle
		assets: [
			"templates/**/*.{js,ts,json,md}",
			"schemas/**/*.json",
			"docs/help/**/*.txt",
		]
		
		// External dependencies (should be bundled for CLI)
		externals: []  // Bundle all dependencies for standalone distribution
	}
	
	// Platform-specific configurations
	platforms: {
		linux: {
			format: "elf"
			strip:  true  // Remove debug symbols
		}
		darwin: {
			format: "macho"
			sign:   false  // Set to true for code signing
		}
		windows: {
			format: "pe"
			icon:   "./assets/cli-icon.ico"
		}
	}
}

// =============================================================================
// TESTING CONFIGURATION
// =============================================================================

tests: {
	// Unit testing for CLI logic
	unit: {
		framework: "vitest"
		coverage: {
			minimum:   85  // CLI tools may have platform-specific code
			threshold: {
				statements: 85
				branches:   80
				functions:  90
				lines:      85
			}
		}
		
		// Test patterns
		patterns: [
			"src/**/*.test.ts",
			"src/**/*.spec.ts",
		]
		
		// Mock external dependencies during testing
		mocks: {
			filesystem: true   // Mock fs operations
			network:    true   // Mock network calls
			processes:  true   // Mock child processes
		}
	}
	
	// Integration testing with real CLI execution
	integration: {
		required: true
		
		// Test CLI in different environments
		environments: [
			{
				name:    "node18"
				runtime: "node:18-alpine"
				setup:   "npm install -g ."
			},
			{
				name:    "node20"
				runtime: "node:20-alpine"
				setup:   "npm install -g ."
			},
		]
		
		// Integration test suites
		suites: [
			{
				name:        "golden_tests"
				description: "Run all golden file tests"
				command:     "npm run test:golden"
				timeout:     "5m"
			},
			{
				name:        "interactive_tests"
				description: "Test interactive command flows"
				command:     "npm run test:interactive"
				timeout:     "3m"
			},
		]
	}
	
	// End-to-end testing with real project workflows
	e2e: {
		required: true
		framework: "playwright"
		
		// Test complete workflows from start to finish
		scenarios: [
			{
				name:        "project_lifecycle"
				description: "Initialize, build, test, and deploy a project"
				steps: [
					"my-awesome-cli init test-e2e --template basic",
					"cd test-e2e",
					"my-awesome-cli build --verbose",
					"my-awesome-cli test --coverage",
					"my-awesome-cli deploy staging --dry-run",
				]
				cleanup: "rm -rf test-e2e"
				timeout: "10m"
			},
			{
				name:        "template_validation"
				description: "Test all available templates"
				parameterized: {
					template: ["basic", "advanced", "minimal", "full-stack"]
					language: ["typescript", "javascript"]
				}
				timeout: "5m"
			},
		]
	}
}

// =============================================================================
// PACKAGING AND DISTRIBUTION
// =============================================================================

package: {
	// NPM package configuration
	registry: "https://registry.npmjs.org/"
	publish:  true
	access:   "public"
	
	// Binary name and entry points
	bin: {
		"my-awesome-cli": "./dist/cli.js"
		"awesome":        "./dist/cli.js"  // Shorter alias
	}
	
	// Package metadata
	main:        "./dist/index.js"
	types:       false  // CLI tools typically don't export types
	engines: {
		node: ">=18.0.0"  // Minimum Node.js version
		npm:  ">=8.0.0"   // Minimum npm version
	}
	
	// Files to include in the package
	files: [
		"dist/",
		"templates/",
		"schemas/",
		"README.md",
		"LICENSE",
		"CHANGELOG.md",
	]
	
	// Package keywords for discoverability
	keywords: [
		"cli",
		"command-line",
		"developer-tools",
		"automation",
		"workflow",
		"build-tools",
	]
	
	// OS compatibility
	os: ["linux", "darwin", "win32"]  // Linux, macOS, Windows
	cpu: ["x64", "arm64"]             // x64 and ARM64 architectures
	
	// Funding and support
	funding: {
		type: "github"
		url:  "https://github.com/sponsors/myorg"
	}
}

// =============================================================================
// DOCUMENTATION AND HELP SYSTEM
// =============================================================================

documentation: {
	// CLI help system configuration
	help: {
		// Global help template
		template: """
		{name} - {description}
		
		USAGE:
		    {name} [COMMAND] [OPTIONS]
		    
		COMMANDS:
		{commands}
		
		GLOBAL OPTIONS:
		    -h, --help       Show help information
		    -v, --version    Show version information
		    --verbose        Show verbose output
		    --config <file>  Use custom configuration file
		    
		EXAMPLES:
		{examples}
		    
		{footer}
		"""
		
		// Command-specific help templates
		commandTemplate: """
		{name} - {summary}
		
		{description}
		
		USAGE:
		    {usage}
		    
		ARGUMENTS:
		{args}
		    
		OPTIONS:
		{options}
		    
		EXIT CODES:
		{exitCodes}
		"""
	}
	
	// Man page generation
	manPage: {
		generate: true
		section:  1        // Section 1 for user commands
		output:   "./man/my-awesome-cli.1"
	}
	
	// Documentation website
	website: {
		generator: "docsify"  // or "vitepress", "gitbook"
		source:    "./docs"
		output:    "./docs-dist"
		
		// Documentation sections
		sections: [
			{
				name: "Getting Started"
				file: "getting-started.md"
			},
			{
				name: "Command Reference"
				file: "commands.md"
				generated: true  // Auto-generated from CLI definition
			},
			{
				name: "Configuration"
				file: "configuration.md"
			},
			{
				name: "Templates"
				file: "templates.md"
			},
			{
				name: "Examples"
				file: "examples.md"
			},
		]
	}
}

// =============================================================================
// CI/CD AND AUTOMATION
// =============================================================================

ci: {
	// Cross-platform testing matrix
	matrix: {
		os: ["ubuntu-latest", "macos-latest", "windows-latest"]
		nodeVersion: ["18", "20", "22"]
	}
	
	// Pipeline stages
	stages: [
		{
			name: "install"
			steps: [
				"npm ci",
				"npm run prepare",  // Prepare hooks and tools
			]
		},
		{
			name: "validate"
			steps: [
				"npm run lint",
				"npm run type-check",
				"arbiter validate --profile cli",
			]
		},
		{
			name: "test"
			parallel: true
			steps: [
				"npm run test:unit",
				"npm run test:integration",
				"npm run test:golden",
			]
			artifacts: [
				"coverage/",
				"test-results/",
			]
		},
		{
			name: "build"
			steps: [
				"npm run build",
				"npm run build:binary",  // Build standalone binaries
			]
			artifacts: [
				"dist/",
				"binaries/",
			]
		},
		{
			name: "e2e"
			steps: [
				"npm run test:e2e",
			]
			artifacts: [
				"e2e-results/",
			]
		},
	]
	
	// Binary distribution
	distribution: {
		// GitHub Releases for binaries
		github: {
			enabled: true
			assets: [
				"binaries/my-awesome-cli-linux-x64",
				"binaries/my-awesome-cli-linux-arm64",
				"binaries/my-awesome-cli-darwin-x64",
				"binaries/my-awesome-cli-darwin-arm64",
				"binaries/my-awesome-cli-win32-x64.exe",
			]
			conditions: ["tag =~ /^v\\d+\\.\\d+\\.\\d+$/"]
		}
		
		// NPM package publishing
		npm: {
			enabled:     true
			conditions: ["branch == main", "tag =~ /^v\\d+\\.\\d+\\.\\d+$/"]
		}
		
		// Docker image (optional)
		docker: {
			enabled: false
			image:   "myorg/my-awesome-cli"
			tags:    ["latest", "{version}"]
		}
	}
}

// =============================================================================
// EXAMPLE USAGE AND CUSTOMIZATION GUIDE
// =============================================================================

// This template provides a comprehensive foundation for CLI tool development.
// Customize these sections for your specific use case:
//
// 1. artifact.name and metadata - Update with your CLI tool details
// 2. profile.commands - Define your specific command structure
// 3. tests.golden - Add tests for your commands and workflows  
// 4. package.bin - Set your CLI binary name and aliases
// 5. documentation.help.template - Customize help text styling
//
// Command Design Best Practices:
// - Use descriptive, action-oriented command names (init, build, deploy)
// - Provide both short (-v) and long (--verbose) flag forms
// - Include comprehensive help text and examples
// - Use consistent exit codes across commands
// - Validate all user inputs with clear error messages
//
// Testing Strategy:
// - Golden tests for all command variations and edge cases
// - Property tests for behavioral consistency
// - Interactive tests for user prompts and confirmations
// - E2E tests for complete user workflows
//
// Distribution Options:
// - NPM package for Node.js environments
// - Standalone binaries for system-wide installation
// - Docker images for containerized environments
// - Package managers (Homebrew, Scoop, etc.) for easy installation