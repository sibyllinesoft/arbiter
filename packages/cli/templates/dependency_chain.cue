// Dependency Chain Template
// Implements sequential dependencies and workflow orchestration patterns

package workflow

import "strings"
import "list"

// DependencyChain defines ordered execution with prerequisite management
#DependencyChain: {
	// Chain metadata
	name:        string | *"dependency_chain"
	description: string | *"Sequential workflow with dependency management"
	version:     string | *"1.0.0"
	created_at:  string // ISO 8601 timestamp
	
	// Execution configuration
	execution: {
		// Execution mode
		mode: "sequential" | "parallel_safe" | "mixed" | *"mixed"
		
		// Failure handling strategy
		failure_handling: "halt" | "continue" | "retry" | "rollback" | *"halt"
		
		// Retry configuration
		retry_config?: {
			max_attempts: number & >0 | *3
			backoff_strategy: "linear" | "exponential" | "fixed" | *"exponential"
			base_delay: string | *"1s" // duration format
			max_delay: string | *"60s"
			retry_conditions: [...string] | *["transient_error", "timeout"]
		}
		
		// Rollback configuration
		rollback_config?: {
			enabled: bool | *true
			strategy: "reverse_order" | "checkpoint" | "custom" | *"reverse_order"
			preserve_logs: bool | *true
		}
		
		// Timeout settings
		timeouts: {
			step_default: string | *"30m"
			chain_total: string | *"4h"
			cleanup: string | *"10m"
		}
	}
	
	// Step definitions
	steps: [...#Step] & [_, ...] // At least one step required
	
	// Global prerequisites
	global_prerequisites?: [...#Prerequisite]
	
	// Resource management
	resources?: {
		// Resource pools
		pools?: [string]: {
			type: string
			capacity: number & >0
			allocation_strategy: "first_available" | "round_robin" | "least_loaded" | *"first_available"
		}
		
		// Resource constraints
		constraints?: [...{
			resource_type: string
			max_concurrent: number & >0
			priority_levels?: [...string]
		}]
		
		// Cleanup configuration
		cleanup: {
			strategy: "immediate" | "delayed" | "manual" | *"immediate"
			delay?: string // for delayed strategy
			preserve_on_failure: bool | *true
		}
	}
	
	// Monitoring and observability
	monitoring: {
		// Progress tracking
		progress_tracking: bool | *true
		checkpoint_frequency: string | *"5m"
		
		// Metrics collection
		metrics: {
			enabled: bool | *true
			collect: [...string] | *["duration", "success_rate", "resource_usage"]
			retention: string | *"30d"
		}
		
		// Alerting
		alerts?: [...{
			condition: string // e.g., "step_duration > 1h", "failure_rate > 10%"
			severity: "info" | "warning" | "critical"
			channels: [...string]
			message_template?: string
		}]
		
		// Health checks
		health_checks?: {
			interval: string | *"30s"
			endpoint?: string
			custom_checks?: [...string]
		}
	}
	
	// Validation rules
	validation: {
		// Dependency validation
		check_circular_deps: bool | *true
		check_resource_availability: bool | *true
		validate_prerequisites: bool | *true
		
		// Step validation
		validate_step_configs: bool | *true
		check_timeout_consistency: bool | *true
		
		// Security validation
		validate_permissions: bool | *false
		check_secrets_access: bool | *false
	}
}

// Step definition
#Step: {
	// Step identification
	id:          string
	name:        string
	description?: string
	
	// Dependencies
	depends_on: [...string] // List of step IDs
	blocks?: [...string]    // Steps that this step blocks
	
	// Prerequisites
	prerequisites?: [...#Prerequisite]
	
	// Execution configuration
	execution: {
		// Step type
		type: "task" | "checkpoint" | "gate" | "parallel_group" | *"task"
		
		// Execution details
		if type == "task" {
			command?: string
			script?: string
			function?: string
			service_call?: {
				endpoint: string
				method: "GET" | "POST" | "PUT" | "DELETE" | *"POST"
				payload?: [string]: _
				headers?: [string]: string
			}
		}
		
		// Parallel execution (for parallel_group type)
		if type == "parallel_group" {
			parallel_steps: [...string] // Step IDs to execute in parallel
		}
		
		// Resource requirements
		resources?: {
			cpu?: string    // e.g., "2 cores", "500m"
			memory?: string // e.g., "4Gi", "512Mi"
			storage?: string // e.g., "10Gi"
			custom?: [string]: string
		}
		
		// Environment
		environment?: [string]: string
		
		// Timeouts
		timeout?: string
		
		// Retry override
		retry_override?: execution.retry_config
	}
	
	// Success criteria
	success_criteria: {
		// Exit conditions
		exit_code?: number | *0
		output_contains?: [...string]
		output_matches?: string // regex pattern
		
		// External validation
		health_check?: {
			url: string
			expected_status: number | *200
			timeout: string | *"30s"
		}
		
		// File/resource validation
		file_exists?: [...string]
		service_available?: [...string]
		
		// Custom validation
		custom_validator?: string
	}
	
	// Failure handling
	failure_handling?: {
		// Override global strategy
		strategy?: execution.failure_handling
		
		// Cleanup actions
		cleanup_actions?: [...string]
		
		// Notification
		notify_on_failure?: bool | *true
		failure_message?: string
	}
	
	// Rollback configuration
	rollback?: {
		enabled: bool | *true
		actions: [...string]
		verification?: string
	}
}

// Prerequisite definition
#Prerequisite: {
	type: "service_available" | "file_exists" | "env_var_set" | "port_available" | "custom"
	
	// Service availability check
	if type == "service_available" {
		service: {
			host: string
			port: number
			protocol?: "tcp" | "udp" | *"tcp"
			timeout?: string | *"10s"
		}
	}
	
	// File existence check
	if type == "file_exists" {
		file: {
			path: string
			min_size?: number // bytes
			permissions?: string // e.g., "644", "755"
		}
	}
	
	// Environment variable check
	if type == "env_var_set" {
		env_var: {
			name: string
			expected_value?: string
			not_empty?: bool | *true
		}
	}
	
	// Port availability check
	if type == "port_available" {
		port: {
			number: number & >0 & <65536
			host?: string | *"localhost"
		}
	}
	
	// Custom prerequisite
	if type == "custom" {
		custom: {
			check_command: string
			expected_exit_code?: number | *0
			timeout?: string | *"30s"
		}
	}
	
	// Retry configuration for prerequisite checks
	retry?: {
		attempts: number & >0 | *5
		interval: string | *"5s"
	}
}

// Example dependency chain configurations
examples: {
	// CI/CD Pipeline
	cicd_pipeline: #DependencyChain & {
		name:        "cicd_deployment_pipeline"
		description: "Continuous integration and deployment workflow"
		created_at:  "2024-01-01T00:00:00Z"
		
		execution: {
			mode: "mixed"
			failure_handling: "rollback"
			retry_config: {
				max_attempts: 2
				backoff_strategy: "exponential"
			}
		}
		
		steps: [
			{
				id:   "checkout"
				name: "Checkout Code"
				depends_on: []
				execution: {
					type: "task"
					command: "git checkout $BRANCH"
				}
				success_criteria: {
					exit_code: 0
					file_exists: ["package.json", "Dockerfile"]
				}
			},
			{
				id:   "test"
				name: "Run Tests"
				depends_on: ["checkout"]
				prerequisites: [{
					type: "file_exists"
					file: {path: "package.json"}
				}]
				execution: {
					type: "task"
					command: "npm test"
					resources: {
						cpu: "2 cores"
						memory: "4Gi"
					}
					timeout: "15m"
				}
				success_criteria: {
					exit_code: 0
					output_contains: ["All tests passed"]
				}
			},
			{
				id:   "build"
				name: "Build Application"
				depends_on: ["test"]
				execution: {
					type: "task"
					command: "docker build -t app:$VERSION ."
					timeout: "20m"
				}
				success_criteria: {
					exit_code: 0
					output_contains: ["Successfully tagged"]
				}
			},
			{
				id:   "security_scan"
				name: "Security Scan"
				depends_on: ["build"]
				execution: {
					type: "task"
					command: "trivy image app:$VERSION"
				}
				success_criteria: {
					exit_code: 0
				}
			},
			{
				id:   "deploy_staging"
				name: "Deploy to Staging"
				depends_on: ["security_scan"]
				prerequisites: [{
					type: "service_available"
					service: {
						host: "staging-k8s.example.com"
						port: 443
						protocol: "tcp"
					}
				}]
				execution: {
					type: "task"
					command: "kubectl apply -f k8s/staging/"
					environment: {
						KUBECONFIG: "/etc/kubernetes/staging-config"
					}
				}
				success_criteria: {
					exit_code: 0
					health_check: {
						url: "https://staging-app.example.com/health"
						expected_status: 200
					}
				}
			},
			{
				id:   "integration_tests"
				name: "Integration Tests"
				depends_on: ["deploy_staging"]
				execution: {
					type: "task"
					command: "npm run test:integration"
					environment: {
						TEST_URL: "https://staging-app.example.com"
					}
				}
				success_criteria: {
					exit_code: 0
				}
			},
			{
				id:   "deploy_production"
				name: "Deploy to Production"
				depends_on: ["integration_tests"]
				execution: {
					type: "gate" // Manual approval required
				}
				prerequisites: [{
					type: "custom"
					custom: {
						check_command: "check-production-readiness.sh"
					}
				}]
			}
		]
		
		monitoring: {
			alerts: [
				{
					condition: "step_duration > 30m"
					severity: "warning"
					channels: ["slack://devops"]
				},
				{
					condition: "failure_rate > 5%"
					severity: "critical"
					channels: ["slack://devops", "email://oncall@example.com"]
				}
			]
		}
	}
	
	// Data Processing Pipeline
	data_pipeline: #DependencyChain & {
		name:        "data_processing_pipeline"
		description: "ETL data processing workflow"
		created_at:  "2024-01-01T00:00:00Z"
		
		execution: {
			mode: "sequential"
			failure_handling: "retry"
		}
		
		steps: [
			{
				id:   "extract"
				name: "Extract Data"
				depends_on: []
				prerequisites: [{
					type: "service_available"
					service: {
						host: "database.example.com"
						port: 5432
					}
				}]
				execution: {
					type: "task"
					script: "./scripts/extract.py"
					resources: {
						memory: "8Gi"
						storage: "50Gi"
					}
				}
				success_criteria: {
					file_exists: ["/tmp/extracted_data.csv"]
				}
			},
			{
				id:   "transform"
				name: "Transform Data"
				depends_on: ["extract"]
				execution: {
					type: "task"
					script: "./scripts/transform.py"
					resources: {
						cpu: "4 cores"
						memory: "16Gi"
					}
				}
				success_criteria: {
					file_exists: ["/tmp/transformed_data.parquet"]
				}
			},
			{
				id:   "validate"
				name: "Validate Data Quality"
				depends_on: ["transform"]
				execution: {
					type: "task"
					script: "./scripts/validate.py"
				}
				success_criteria: {
					exit_code: 0
					output_matches: "^Data quality: (PASS|OK)$"
				}
			},
			{
				id:   "load"
				name: "Load Data"
				depends_on: ["validate"]
				prerequisites: [{
					type: "service_available"
					service: {
						host: "warehouse.example.com"
						port: 5432
					}
				}]
				execution: {
					type: "task"
					script: "./scripts/load.py"
				}
				success_criteria: {
					exit_code: 0
				}
				rollback: {
					enabled: true
					actions: ["./scripts/rollback_load.py"]
				}
			},
			{
				id:   "notify"
				name: "Send Completion Notification"
				depends_on: ["load"]
				execution: {
					type: "task"
					service_call: {
						endpoint: "https://hooks.slack.com/services/webhook"
						method: "POST"
						payload: {
							text: "Data pipeline completed successfully"
						}
					}
				}
				success_criteria: {
					exit_code: 0
				}
			}
		]
		
		resources: {
			pools: {
				compute: {
					type: "cpu_intensive"
					capacity: 16
				}
				storage: {
					type: "high_io"
					capacity: 4
				}
			}
			cleanup: {
				strategy: "delayed"
				delay: "1h"
			}
		}
	}
	
	// Infrastructure Setup Chain
	infrastructure_setup: #DependencyChain & {
		name:        "infrastructure_provisioning"
		description: "Cloud infrastructure setup workflow"
		
		execution: {
			mode: "mixed"
			failure_handling: "halt"
		}
		
		steps: [
			{
				id:   "create_vpc"
				name: "Create VPC"
				depends_on: []
				execution: {
					type: "task"
					command: "terraform apply -target=aws_vpc.main"
				}
				success_criteria: {
					exit_code: 0
					output_contains: ["Apply complete"]
				}
			},
			{
				id:   "create_subnets"
				name: "Create Subnets"
				depends_on: ["create_vpc"]
				execution: {
					type: "parallel_group"
					parallel_steps: ["create_public_subnet", "create_private_subnet"]
				}
			},
			{
				id:   "create_public_subnet"
				name: "Create Public Subnet"
				depends_on: ["create_vpc"]
				execution: {
					type: "task"
					command: "terraform apply -target=aws_subnet.public"
				}
			},
			{
				id:   "create_private_subnet"
				name: "Create Private Subnet"
				depends_on: ["create_vpc"]
				execution: {
					type: "task"
					command: "terraform apply -target=aws_subnet.private"
				}
			},
			{
				id:   "create_security_groups"
				name: "Create Security Groups"
				depends_on: ["create_subnets"]
				execution: {
					type: "task"
					command: "terraform apply -target=aws_security_group"
				}
			},
			{
				id:   "launch_instances"
				name: "Launch EC2 Instances"
				depends_on: ["create_security_groups"]
				execution: {
					type: "task"
					command: "terraform apply -target=aws_instance"
					timeout: "10m"
				}
				success_criteria: {
					health_check: {
						url: "http://instances.example.com/health"
					}
				}
			}
		]
	}
}

// Simple three-step chain for quick setup
simple_chain: #DependencyChain & {
	name: "simple_three_step"
	description: "Basic three-step sequential workflow"
	
	steps: [
		{
			id: "step1"
			name: "First Step"
			depends_on: []
			execution: {type: "task", command: "echo 'Step 1 complete'"}
			success_criteria: {exit_code: 0}
		},
		{
			id: "step2"
			name: "Second Step"
			depends_on: ["step1"]
			execution: {type: "task", command: "echo 'Step 2 complete'"}
			success_criteria: {exit_code: 0}
		},
		{
			id: "step3"
			name: "Third Step"
			depends_on: ["step2"]
			execution: {type: "task", command: "echo 'Step 3 complete'"}
			success_criteria: {exit_code: 0}
		}
	]
}

// Default chain for quick setup
default_chain: simple_chain