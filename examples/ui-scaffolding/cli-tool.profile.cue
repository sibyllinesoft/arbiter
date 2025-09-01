package examples

// Example Profile.ui specification for a CLI tool
// Demonstrates CLI scaffolding capabilities with commands, help, and golden tests
Profile: ui: {
	platform: "cli"
	
	// CLI-specific theme (for colored output and formatting)
	theme: {
		colors: {
			primary: "#007acc"
			success: "#28a745"
			warning: "#ffc107"
			error: "#dc3545"
			info: "#17a2b8"
			muted: "#6c757d"
		}
		formatting: {
			bold: true
			italic: false
			underline: false
		}
	}
	
	// CLI routes (commands)
	routes: {
		"/": {
			path: ""
			component: "RootCommand"
			props: {
				name: "mytool"
				version: "1.0.0"
				description: "A comprehensive CLI tool for project management"
			}
			capabilities: ["help", "version"]
		}
		"/init": {
			path: "init"
			component: "InitCommand"
			props: {
				interactive: true
				template: "default"
			}
			capabilities: ["project:create"]
			guards: ["workspace"]
		}
		"/build": {
			path: "build"
			component: "BuildCommand"
			props: {
				target: "production"
				optimization: true
			}
			capabilities: ["project:build"]
			guards: ["project_exists"]
		}
		"/test": {
			path: "test"
			component: "TestCommand"
			props: {
				coverage: true
				watch: false
			}
			capabilities: ["project:test"]
			guards: ["project_exists"]
		}
		"/deploy": {
			path: "deploy"
			component: "DeployCommand"
			props: {
				environment: "staging"
				dryRun: false
			}
			capabilities: ["project:deploy"]
			guards: ["project_exists", "auth"]
		}
		"/status": {
			path: "status"
			component: "StatusCommand"
			props: {
				verbose: false
				format: "table"
			}
			capabilities: ["project:read"]
			guards: ["project_exists"]
		}
		"/config": {
			path: "config"
			component: "ConfigCommand"
			props: {
				global: false
				interactive: false
			}
			capabilities: ["config:manage"]
		}
		"/config/set": {
			path: "config set"
			component: "ConfigSetCommand"
			props: {
				validate: true
			}
			capabilities: ["config:write"]
		}
		"/config/get": {
			path: "config get"
			component: "ConfigGetCommand"
			props: {
				format: "value"
			}
			capabilities: ["config:read"]
		}
		"/logs": {
			path: "logs"
			component: "LogsCommand"
			props: {
				follow: false
				lines: 50
			}
			capabilities: ["logs:read"]
			guards: ["project_exists"]
		}
	}
	
	// CLI components (command implementations)
	components: {
		RootCommand: {
			name: "RootCommand"
			type: "navigation"
			props: {
				name: "string"
				version: "string"
				description: "string"
				showHelp: "boolean"
			}
			children: ["HelpDisplay", "VersionDisplay"]
			events: {
				onHelp: "showHelp"
				onVersion: "showVersion"
			}
		}
		
		InitCommand: {
			name: "InitCommand"
			type: "form"
			props: {
				interactive: "boolean"
				template: "string"
				directory: "string"
			}
			children: ["ProjectSetupForm", "TemplateSelector"]
			events: {
				onInit: "initializeProject"
				onTemplateSelect: "selectTemplate"
			}
		}
		
		BuildCommand: {
			name: "BuildCommand"
			type: "form"
			props: {
				target: "string"
				optimization: "boolean"
				sourceMap: "boolean"
				watch: "boolean"
			}
			children: ["BuildProgress", "BuildOutput"]
			events: {
				onBuild: "startBuild"
				onProgress: "updateProgress"
				onComplete: "buildComplete"
			}
		}
		
		TestCommand: {
			name: "TestCommand"
			type: "form"
			props: {
				coverage: "boolean"
				watch: "boolean"
				pattern: "string"
				verbose: "boolean"
			}
			children: ["TestRunner", "CoverageReport"]
			events: {
				onTest: "runTests"
				onCoverage: "generateCoverage"
			}
		}
		
		DeployCommand: {
			name: "DeployCommand"
			type: "form"
			props: {
				environment: "string"
				dryRun: "boolean"
				force: "boolean"
				rollback: "boolean"
			}
			children: ["DeploymentProgress", "EnvironmentSelector"]
			events: {
				onDeploy: "startDeployment"
				onRollback: "rollbackDeployment"
			}
		}
		
		StatusCommand: {
			name: "StatusCommand"
			type: "detail"
			props: {
				verbose: "boolean"
				format: "string"
				refresh: "boolean"
			}
			children: ["ProjectStatus", "ServiceStatus", "HealthChecks"]
			events: {
				onRefresh: "refreshStatus"
				onDetails: "showDetails"
			}
		}
		
		ConfigCommand: {
			name: "ConfigCommand"
			type: "navigation"
			props: {
				global: "boolean"
				interactive: "boolean"
			}
			children: ["ConfigSetCommand", "ConfigGetCommand", "ConfigListCommand"]
			events: {
				onList: "listConfig"
				onEdit: "editConfig"
			}
		}
		
		LogsCommand: {
			name: "LogsCommand"
			type: "detail"
			props: {
				follow: "boolean"
				lines: "number"
				since: "string"
				service: "string"
			}
			children: ["LogViewer", "LogFilters"]
			events: {
				onFollow: "followLogs"
				onFilter: "filterLogs"
			}
		}
		
		// Utility components
		HelpDisplay: {
			name: "HelpDisplay"
			type: "detail"
			props: {
				command: "string"
				detailed: "boolean"
			}
		}
		
		VersionDisplay: {
			name: "VersionDisplay"
			type: "detail"
			props: {
				version: "string"
				buildInfo: "object"
			}
		}
		
		BuildProgress: {
			name: "BuildProgress"
			type: "detail"
			props: {
				current: "number"
				total: "number"
				message: "string"
			}
		}
		
		TestRunner: {
			name: "TestRunner"
			type: "detail"
			props: {
				running: "boolean"
				results: "object"
			}
		}
	}
	
	// CLI forms (interactive prompts)
	forms: {
		projectSetup: {
			name: "projectSetup"
			fields: [
				{
					name: "name"
					type: "text"
					label: "Project Name"
					required: true
					placeholder: "my-project"
					validation: {
						pattern: "^[a-z][a-z0-9-]*$"
						minLength: 3
						maxLength: 50
					}
				},
				{
					name: "description"
					type: "text"
					label: "Project Description"
					required: false
					placeholder: "A description of your project"
				},
				{
					name: "template"
					type: "select"
					label: "Project Template"
					required: true
					options: [
						{label: "Basic", value: "basic"},
						{label: "Web Application", value: "webapp"},
						{label: "API Service", value: "api"},
						{label: "CLI Tool", value: "cli"},
						{label: "Library", value: "library"}
					]
				},
				{
					name: "language"
					type: "select"
					label: "Programming Language"
					required: true
					options: [
						{label: "TypeScript", value: "typescript"},
						{label: "JavaScript", value: "javascript"},
						{label: "Python", value: "python"},
						{label: "Go", value: "go"},
						{label: "Rust", value: "rust"}
					]
				},
				{
					name: "git"
					type: "checkbox"
					label: "Initialize Git repository"
					required: false
				},
				{
					name: "ci"
					type: "checkbox"
					label: "Setup CI/CD pipeline"
					required: false
				}
			]
			onSubmit: "createProject"
			layout: "vertical"
		}
		
		deploymentConfig: {
			name: "deploymentConfig"
			fields: [
				{
					name: "environment"
					type: "select"
					label: "Deployment Environment"
					required: true
					options: [
						{label: "Development", value: "dev"},
						{label: "Staging", value: "staging"},
						{label: "Production", value: "prod"}
					]
				},
				{
					name: "region"
					type: "select"
					label: "Region"
					required: true
					options: [
						{label: "US East 1", value: "us-east-1"},
						{label: "US West 2", value: "us-west-2"},
						{label: "EU West 1", value: "eu-west-1"}
					]
				},
				{
					name: "replicas"
					type: "number"
					label: "Number of Replicas"
					required: true
					placeholder: "3"
					validation: {
						min: 1
						max: 10
					}
				},
				{
					name: "dryRun"
					type: "checkbox"
					label: "Dry run (preview changes only)"
					required: false
				}
			]
			onSubmit: "deploy"
			layout: "vertical"
		}
	}
	
	// CLI test definitions (golden tests)
	tests: {
		scenarios: [
			{
				name: "help_command"
				description: "CLI shows help information"
				steps: [
					{
						action: "execute"
						target: "mytool --help"
						assertion: "contains help text"
					},
					{
						action: "expect"
						target: "stdout"
						assertion: "contains 'Usage: mytool'"
					}
				]
				platform: "cli"
			},
			{
				name: "version_command"
				description: "CLI shows version information"
				steps: [
					{
						action: "execute"
						target: "mytool --version"
						assertion: "shows version"
					},
					{
						action: "expect"
						target: "stdout"
						assertion: "matches /\\d+\\.\\d+\\.\\d+/"
					}
				]
				platform: "cli"
			},
			{
				name: "init_command"
				description: "Initialize new project"
				steps: [
					{
						action: "execute"
						target: "mytool init test-project --template=basic"
						assertion: "project created"
					},
					{
						action: "expect"
						target: "filesystem"
						assertion: "directory 'test-project' exists"
					},
					{
						action: "expect"
						target: "test-project/package.json"
						assertion: "file exists and valid"
					}
				]
				platform: "cli"
			},
			{
				name: "build_command"
				description: "Build project successfully"
				steps: [
					{
						action: "execute"
						target: "mytool build --target=production"
						assertion: "build succeeds"
					},
					{
						action: "expect"
						target: "exit_code"
						assertion: "equals 0"
					},
					{
						action: "expect"
						target: "dist/"
						assertion: "directory exists with build artifacts"
					}
				]
				platform: "cli"
			},
			{
				name: "status_command"
				description: "Show project status"
				steps: [
					{
						action: "execute"
						target: "mytool status --verbose"
						assertion: "shows detailed status"
					},
					{
						action: "expect"
						target: "stdout"
						assertion: "contains project information"
					}
				]
				platform: "cli"
			}
		]
		coverage: "85%"
		timeout: 10000
		retries: 1
	}
	
	// CLI-specific configuration
	config: {
		shell: {
			autocompletion: true
			colorSupport: true
			interactiveMode: true
		}
		output: {
			formatting: true
			progressBars: true
			spinners: true
			tables: true
		}
		logging: {
			level: "info"
			file: true
			console: true
		}
		updates: {
			checkForUpdates: true
			autoUpdate: false
			channel: "stable"
		}
		telemetry: {
			enabled: false
			anonymous: true
		}
	}
}