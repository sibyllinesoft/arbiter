/**
 * Comprehensive CUE sample data for Storybook stories
 * Includes various CUE file types and use cases for visualization
 */

export const basicRequirementsCue = `// Requirements specification for a user authentication system
package requirements

// Security requirements
security: {
	password_policy: {
		name:        "Password Security Policy"
		priority:    "critical"
		status:      "implemented"
		description: "Enforce strong password requirements"
		
		requirements: {
			min_length:    12
			max_length:    128
			require_upper: true
			require_lower: true
			require_digit: true
			require_symbol: true
			no_dictionary_words: true
			history_count: 5  // Can't reuse last 5 passwords
		}
		
		validation_rules: [
			"Must contain at least one uppercase letter",
			"Must contain at least one lowercase letter", 
			"Must contain at least one digit",
			"Must contain at least one special character",
			"Cannot contain common dictionary words",
			"Cannot match any of the last 5 passwords"
		]
	}
	
	session_management: {
		name:        "Session Management"
		priority:    "high"
		status:      "implemented"
		description: "Secure session handling and timeout policies"
		
		requirements: {
			session_timeout:     24 * 60 * 60  // 24 hours in seconds
			idle_timeout:        30 * 60      // 30 minutes in seconds
			absolute_timeout:    7 * 24 * 60 * 60  // 7 days in seconds
			concurrent_sessions: 3
			secure_cookies:      true
			httponly_cookies:    true
			same_site:          "strict"
		}
	}
}

// Performance requirements
performance: {
	authentication_latency: {
		name:        "Authentication Response Time"
		priority:    "high" 
		status:      "implemented"
		description: "Authentication endpoints must be fast"
		
		requirements: {
			login_max_time:    200  // milliseconds
			logout_max_time:   100  // milliseconds
			refresh_max_time:  150  // milliseconds
			p95_target:        180  // milliseconds
			p99_target:        250  // milliseconds
		}
		
		measurement: {
			tool:            "Artillery"
			test_duration:   "5m"
			ramp_up_users:   100
			steady_users:    500
		}
	}
}

// Compliance requirements
compliance: {
	gdpr_compliance: {
		name:        "GDPR Data Protection"
		priority:    "critical"
		status:      "draft"
		description: "European data protection regulation compliance"
		
		requirements: {
			data_portability:    true
			right_to_erasure:    true
			consent_management:  true
			data_minimization:   true
			purpose_limitation:  true
			lawful_basis:       "consent"
		}
		
		implementation: {
			export_format: "JSON"
			export_timeout: 24 * 60 * 60  // 24 hours
			deletion_timeout: 30 * 24 * 60 * 60  // 30 days
			consent_storage_period: 2 * 365 * 24 * 60 * 60  // 2 years
		}
	}
}`;

export const assemblySpecCue = `// Assembly specification for microservices architecture
package assembly

// Import shared definitions
import "arbiter.io/shared/types"
import "arbiter.io/shared/infra"

// Service definitions
services: {
	auth_service: {
		name:         "Authentication Service"
		version:      "v2.1.0"
		technology:   "TypeScript + Fastify"
		runtime:      "Node.js 20"
		environment:  "production"
		team:         "platform-team"
		
		capabilities: [
			"user_authentication",
			"session_management", 
			"password_reset",
			"multi_factor_auth"
		]
		
		api: {
			base_path: "/api/v2/auth"
			endpoints: {
				"POST /login": {
					description: "Authenticate user with credentials"
					request_schema: "LoginRequest"
					response_schema: "AuthResponse"
					rate_limit: "10/minute"
				}
				"POST /logout": {
					description: "Invalidate user session"
					request_schema: "LogoutRequest"
					response_schema: "MessageResponse"
					rate_limit: "5/minute"
				}
				"POST /refresh": {
					description: "Refresh access token"
					request_schema: "RefreshRequest"
					response_schema: "AuthResponse"
					rate_limit: "20/minute"
				}
				"POST /forgot-password": {
					description: "Initiate password reset flow"
					request_schema: "ForgotPasswordRequest"
					response_schema: "MessageResponse"
					rate_limit: "3/hour"
				}
			}
		}
		
		database: {
			type:     "PostgreSQL"
			version:  "15"
			schemas: ["users", "sessions", "audit_logs"]
			connection_pool: {
				min: 5
				max: 20
				idle_timeout: 30000
			}
		}
		
		dependencies: {
			redis: {
				purpose: "Session storage and rate limiting"
				version: "7.0"
				cluster: true
			}
			vault: {
				purpose: "Secrets management"
				version: "1.15"
				auth_method: "kubernetes"
			}
			sendgrid: {
				purpose: "Email delivery for password resets"
				api_version: "v3"
			}
		}
		
		deployment: {
			replicas: 3
			cpu_request: "200m"
			cpu_limit: "500m"
			memory_request: "256Mi"
			memory_limit: "512Mi"
			
			health_check: {
				path: "/health"
				initial_delay: 30
				period: 10
				timeout: 5
				failure_threshold: 3
			}
			
			autoscaling: {
				enabled: true
				min_replicas: 2
				max_replicas: 10
				cpu_threshold: 70
				memory_threshold: 80
			}
		}
		
		monitoring: {
			metrics: [
				"http_request_duration_seconds",
				"http_requests_total",
				"database_connections_active",
				"redis_operations_total",
				"login_attempts_total",
				"password_reset_requests_total"
			]
			
			alerts: {
				high_error_rate: {
					condition: "rate(http_requests_total{code=~"5.."}[5m]) > 0.1"
					severity: "critical"
					description: "High 5xx error rate in auth service"
				}
				slow_response_time: {
					condition: "histogram_quantile(0.95, http_request_duration_seconds) > 0.2"
					severity: "warning" 
					description: "95th percentile response time above 200ms"
				}
			}
		}
	}
	
	user_service: {
		name:         "User Management Service"
		version:      "v1.8.2"
		technology:   "Python + FastAPI"
		runtime:      "Python 3.11"
		environment:  "production"
		team:         "backend-team"
		
		capabilities: [
			"user_profiles",
			"account_settings",
			"privacy_controls",
			"data_export"
		]
		
		depends_on: ["auth_service"]
		
		api: {
			base_path: "/api/v1/users"
			endpoints: {
				"GET /profile": {
					description: "Get user profile information"
					auth_required: true
					response_schema: "UserProfile"
					cache_ttl: 300  // 5 minutes
				}
				"PUT /profile": {
					description: "Update user profile"
					auth_required: true
					request_schema: "UpdateProfileRequest"
					response_schema: "UserProfile"
					rate_limit: "10/minute"
				}
				"DELETE /account": {
					description: "Delete user account (GDPR)"
					auth_required: true
					confirmation_required: true
					response_schema: "DeletionResponse"
					rate_limit: "1/day"
				}
				"GET /export": {
					description: "Export all user data (GDPR)"
					auth_required: true
					response_type: "application/zip"
					rate_limit: "1/week"
				}
			}
		}
		
		database: {
			type: "PostgreSQL"
			version: "15"
			schemas: ["user_profiles", "preferences", "audit_trail"]
		}
		
		deployment: {
			replicas: 2
			cpu_request: "150m"
			cpu_limit: "300m" 
			memory_request: "192Mi"
			memory_limit: "384Mi"
		}
	}
	
	notification_service: {
		name:         "Notification Service"
		version:      "v0.9.1"
		technology:   "Go + Gin"
		runtime:      "Go 1.21"
		environment:  "staging"
		team:         "platform-team"
		
		capabilities: [
			"email_notifications",
			"push_notifications", 
			"callback_delivery",
			"notification_preferences"
		]
		
		depends_on: ["auth_service", "user_service"]
		
		message_queue: {
			type: "RabbitMQ"
			version: "3.12"
			exchanges: ["notifications", "callbacks"]
			queues: {
				email: {
					durable: true
					max_retry: 3
					ttl: 86400  // 24 hours
				}
				push: {
					durable: true
					max_retry: 5
					ttl: 3600   // 1 hour
				}
				callback: {
					durable: true
					max_retry: 10
					ttl: 604800  // 1 week
				}
			}
		}
		
		deployment: {
			replicas: 1
			cpu_request: "100m"
			cpu_limit: "200m"
			memory_request: "128Mi" 
			memory_limit: "256Mi"
		}
		
		feature_flags: {
			enable_push_notifications: false
			enable_callback_retries: true
			use_new_email_template: true
		}
	}
}

// Infrastructure configuration
infrastructure: {
	kubernetes: {
		version: "1.28"
		node_pools: {
			main: {
				machine_type: "e2-standard-4"
				min_nodes: 2
				max_nodes: 10
				disk_size: 50
				disk_type: "pd-ssd"
			}
		}
	}
	
	databases: {
		primary_postgres: {
			type: "Cloud SQL PostgreSQL"
			version: "15"
			tier: "db-custom-2-8192"  // 2 vCPU, 8GB RAM
			storage: 100  // GB
			backup_retention: 7  // days
			high_availability: true
		}
		
		redis_cluster: {
			type: "Cloud Memorystore"
			version: "7.0"
			memory_size: 4  // GB
			replicas: 2
			persistence: true
		}
	}
	
	networking: {
		load_balancer: {
			type: "Application Load Balancer"
			ssl_termination: true
			waf_enabled: true
		}
		
		cdn: {
			provider: "CloudFlare"
			cache_ttl: 3600
			static_assets_ttl: 86400
		}
	}
}`;

export const validationErrorsCue = `// CUE file with intentional validation errors for demonstration
package validation_demo

// This will cause a validation error - conflicting values
user_id: 12345
user_id: "user123"  // Error: cannot unify int and string

// This will cause a constraint violation
age: 150  // Error: exceeds maximum allowed age
age: <=120

// Missing required field error
required_user: {
	name: string
	email: string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
	age: int & >=0 & <=120
}

// This instance is missing required fields
incomplete_user: required_user & {
	name: "John Doe"
	// Missing email - validation error
	// Missing age - validation error
}

// Type constraint violations
user_data: {
	// String expected but got int
	username: string
	username: 12345
	
	// Email validation failure
	email: string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
	email: "invalid-email"
	
	// Numeric range violation
	score: int & >=0 & <=100
	score: -50
}

// Struct constraint violations
api_config: {
	endpoints: [string]: {
		method: "GET" | "POST" | "PUT" | "DELETE"
		path: string
		auth_required: bool
	}
}

// This violates the constraint above
api_config: {
	endpoints: {
		invalid_method: {
			method: "PATCH"  // Error: not in allowed methods
			path: "/users"
			auth_required: true
		}
	}
}

// List validation errors
valid_statuses: ["active", "inactive", "pending", "suspended"]

// Error: invalid status value
user_status: valid_statuses
user_status: "unknown"

// Circular reference error (commented out as it would break parsing)
// circular_a: circular_b + 1
// circular_b: circular_a + 1

// Complex nested validation error
service_config: {
	database: {
		host: string & =~"^[a-zA-Z0-9.-]+$"
		port: int & >0 & <=65535
		credentials: {
			username: string & len(>3)
			password: string & len(>=8)
		}
	}
	redis: {
		url: string & =~"^redis://"
		timeout: int & >0
	}
}

// Multiple validation errors in this config
production_config: service_config & {
	database: {
		host: "invalid_host_name!"  // Error: special chars not allowed
		port: 70000                 // Error: port out of range
		credentials: {
			username: "ab"          // Error: too short
			password: "1234"        // Error: too short
		}
	}
	redis: {
		url: "http://localhost:6379"  // Error: wrong protocol
		timeout: -1                   // Error: negative timeout
	}
}`;

export const complexTypescriptProjectCue = `// Complex TypeScript project specification with advanced patterns
package typescript_advanced

import "arbiter.io/languages/typescript"
import "arbiter.io/testing/jest"
import "arbiter.io/bundling/vite"

project: {
	name:         "Advanced TypeScript Microservice"
	description:  "High-performance trading platform API with real-time features"
	version:      "v3.2.1"
	language:     "TypeScript"
	runtime:      "Node.js"
	
	type_system: {
		strict_mode: true
		no_implicit_any: true
		exact_optional_property_types: true
		no_unchecked_indexed_access: true
		
		advanced_features: [
			"branded_types",
			"template_literal_types", 
			"conditional_types",
			"mapped_types",
			"utility_types"
		]
	}
	
	architecture: {
		pattern: "Clean Architecture + DDD"
		layers: {
			domain: {
				description: "Pure business logic with no external dependencies"
				patterns: ["Value Objects", "Entities", "Domain Services"]
				dependencies: []
			}
			application: {
				description: "Use cases and application services"
				patterns: ["Command/Query", "Use Case Interactors"]
				dependencies: ["domain"]
			}
			infrastructure: {
				description: "External concerns and technical implementations"
				patterns: ["Repositories", "Adapters", "Event Publishers"]
				dependencies: ["domain", "application"]
			}
			interface: {
				description: "HTTP API, WebSocket handlers, CLI interfaces"
				patterns: ["Controllers", "Middleware", "DTOs"]
				dependencies: ["application"]
			}
		}
	}
	
	performance_requirements: {
		api_latency: {
			p50: "<=10ms"
			p95: "<=50ms" 
			p99: "<=100ms"
		}
		
		throughput: {
			orders_per_second: >=10000
			concurrent_connections: >=5000
			websocket_messages_per_second: >=100000
		}
		
		memory: {
			heap_usage_max: "<=2GB"
			gc_pause_max: "<=10ms"
		}
		
		optimization_techniques: [
			"Object pooling for high-frequency objects",
			"JIT-compiled validation schemas",
			"Custom JSON serialization",
			"Connection pooling and reuse",
			"Efficient data structures (Maps vs Objects)",
			"Worker threads for CPU-intensive tasks"
		]
	}
	
	real_time_features: {
		websocket_server: {
			technology: "ws + uWS.js"
			max_connections: 50000
			message_compression: true
			heartbeat_interval: 30000  // 30 seconds
			
			channels: {
				market_data: {
					description: "Real-time price feeds and market updates"
					max_subscribers: 10000
					rate_limit: "100 messages/second"
					data_format: "binary (protobuf)"
				}
				order_updates: {
					description: "Order execution and status updates"
					max_subscribers: 5000
					rate_limit: "1000 messages/second" 
					data_format: "JSON"
					authentication_required: true
				}
				trade_notifications: {
					description: "Trade execution notifications"
					max_subscribers: 2000
					rate_limit: "500 messages/second"
					data_format: "JSON"
					authentication_required: true
				}
			}
		}
		
		event_sourcing: {
			enabled: true
			event_store: "EventStore DB"
			snapshot_frequency: 1000  // events
			replay_capability: true
			
			events: {
				"OrderPlaced": {
					schema: "OrderPlacedEvent"
					version: "v1.2.0"
					backward_compatible: true
				}
				"OrderExecuted": {
					schema: "OrderExecutedEvent"
					version: "v1.1.0"
					backward_compatible: true
				}
				"MarketDataUpdated": {
					schema: "MarketDataEvent"
					version: "v2.0.0"
					backward_compatible: false
					migration_guide: "docs/migrations/market-data-v2.md"
				}
			}
		}
	}
	
	testing_strategy: {
		unit_tests: {
			framework: "Vitest"
			coverage_threshold: 90
			
			categories: {
				domain_logic: {
					coverage_required: 100
					mutation_testing: true
					property_based_testing: true
				}
				application_services: {
					coverage_required: 95
					integration_with_mocks: true
				}
				infrastructure: {
					coverage_required: 85
					integration_tests_required: true
				}
			}
		}
		
		integration_tests: {
			database_tests: {
				framework: "TestContainers"
				databases: ["PostgreSQL", "Redis", "EventStore"]
				transaction_rollback: true
			}
			
			api_tests: {
				framework: "Supertest"
				test_data_management: "Factory pattern with Faker.js"
				authentication_mocking: true
			}
			
			websocket_tests: {
				framework: "Custom WebSocket test utilities"
				concurrent_connection_testing: true
				message_ordering_verification: true
			}
		}
		
		e2e_tests: {
			framework: "Playwright"
			browser_support: ["Chrome", "Firefox", "Safari"]
			mobile_testing: true
			
			critical_paths: [
				"User registration and KYC",
				"Deposit and withdrawal flow",
				"Order placement and execution",
				"Real-time market data streaming",
				"Portfolio management"
			]
		}
		
		load_testing: {
			framework: "Artillery + k6"
			scenarios: {
				steady_load: {
					duration: "10m"
					arrival_rate: 100  // requests per second
				}
				spike_load: {
					duration: "2m" 
					arrival_rate: 1000  // requests per second
				}
				soak_test: {
					duration: "4h"
					arrival_rate: 50   // requests per second
				}
			}
		}
	}
	
	security_requirements: {
		authentication: {
			method: "JWT + Refresh Tokens"
			algorithm: "RS256"
			key_rotation_interval: "24h"
			
			mfa_required_for: [
				"Large withdrawals (>$10,000)",
				"API key generation", 
				"Account settings changes",
				"Trading above daily limits"
			]
		}
		
		authorization: {
			model: "RBAC with dynamic permissions"
			roles: ["trader", "premium_trader", "institutional", "admin"]
			
			permissions: {
				"read:market_data": ["trader", "premium_trader", "institutional"]
				"place:orders": ["trader", "premium_trader", "institutional"]
				"access:advanced_analytics": ["premium_trader", "institutional"]
				"modify:system_settings": ["admin"]
			}
		}
		
		data_protection: {
			encryption_at_rest: "AES-256"
			encryption_in_transit: "TLS 1.3"
			
			pii_handling: {
				encryption_required: true
				audit_logging: true
				access_controls: "Need-to-know basis"
				retention_period: "7 years (regulatory requirement)"
			}
		}
		
		input_validation: {
			framework: "Zod"
			sanitization: "DOMPurify"
			
			validation_rules: {
				strict_schema_validation: true
				sql_injection_prevention: true
				xss_prevention: true
				command_injection_prevention: true
			}
		}
	}
	
	monitoring_and_observability: {
		metrics: {
			framework: "Prometheus + OpenTelemetry"
			
			business_metrics: [
				"orders_placed_total",
				"orders_executed_total",
				"trading_volume_usd",
				"active_traders_gauge",
				"average_order_size"
			]
			
			technical_metrics: [
				"http_request_duration_histogram",
				"websocket_connections_gauge",
				"database_query_duration_histogram",
				"memory_usage_bytes",
				"gc_duration_seconds"
			]
		}
		
		logging: {
			framework: "Winston + Structured Logging"
			format: "JSON"
			
			log_levels: {
				production: "info"
				staging: "debug"
				development: "trace"
			}
			
			sensitive_data_redaction: {
				enabled: true
				fields: ["password", "ssn", "credit_card", "private_key"]
			}
		}
		
		tracing: {
			framework: "Jaeger"
			sample_rate: 0.1  // 10% sampling in production
			
			trace_important_operations: [
				"Order processing pipeline",
				"User authentication flow",
				"Market data ingestion",
				"Risk management calculations"
			]
		}
		
		alerting: {
			framework: "Grafana + PagerDuty"
			
			critical_alerts: {
				high_error_rate: {
					condition: "error_rate > 1% for 5 minutes"
					severity: "critical"
					escalation: "immediate"
				}
				high_latency: {
					condition: "p95_latency > 100ms for 3 minutes" 
					severity: "warning"
					escalation: "15 minutes"
				}
				trading_halted: {
					condition: "no trades executed for 1 minute during market hours"
					severity: "critical" 
					escalation: "immediate"
				}
			}
		}
	}
	
	deployment: {
		containerization: {
			base_image: "node:20-alpine"
			multi_stage_build: true
			security_scanning: true
			
			optimization: {
				layer_caching: true
				minimal_dependencies: true
				non_root_user: true
				health_check_included: true
			}
		}
		
		kubernetes: {
			deployment_strategy: "Blue-Green"
			
			resources: {
				requests: {
					cpu: "1"
					memory: "2Gi"
				}
				limits: {
					cpu: "2"
					memory: "4Gi"
				}
			}
			
			autoscaling: {
				hpa_enabled: true
				min_replicas: 3
				max_replicas: 20
				
				scaling_metrics: [
					{name: "cpu_utilization", target: 70},
					{name: "memory_utilization", target: 80},
					{name: "custom.googleapis.com/orders_per_second", target: 1000}
				]
			}
			
			service_mesh: {
				framework: "Istio"
				features: ["Traffic routing", "Load balancing", "Circuit breaking", "Retry policies"]
			}
		}
		
		ci_cd: {
			pipeline_framework: "GitHub Actions + ArgoCD"
			
			stages: {
				build: {
					steps: ["Dependency install", "TypeScript compilation", "Bundle optimization", "Security scan"]
					parallel_execution: true
				}
				test: {
					steps: ["Unit tests", "Integration tests", "E2E tests", "Load tests"]
					test_parallelization: true
					coverage_gates: true
				}
				deploy: {
					environments: ["staging", "production"]
					approval_required: true  // for production
					rollback_capability: true
				}
			}
		}
	}
}`;

export const rustMicroserviceCue = `// High-performance Rust microservice specification
package rust_microservice

import "arbiter.io/languages/rust"
import "arbiter.io/performance/benchmarking"

project: {
	name:         "High-Frequency Trading Engine"
	description:  "Ultra-low latency trading engine built in Rust"
	version:      "v1.5.0"
	language:     "Rust"
	edition:      "2021"
	
	performance_targets: {
		latency: {
			order_processing: "<=100μs"  // microseconds
			market_data_ingestion: "<=50μs"
			risk_calculation: "<=25μs"
			order_matching: "<=75μs"
		}
		
		throughput: {
			orders_per_second: >=1_000_000
			market_updates_per_second: >=10_000_000
			concurrent_connections: >=100_000
		}
		
		memory: {
			heap_allocations_per_order: <=5
			memory_footprint_max: "<=512MB"
			gc_pauses: 0  // Zero-GC requirement
		}
		
		reliability: {
			uptime_target: "99.999%"  // 5 minutes downtime per year
			data_loss_tolerance: 0
			failover_time: "<=10ms"
		}
	}
	
	rust_specific_features: {
		memory_management: {
			zero_copy_deserialization: true
			arena_allocation: true
			object_pooling: true
			stack_allocation_preferred: true
		}
		
		concurrency: {
			async_runtime: "Tokio"
			thread_pool_size: "num_cpus"
			lock_free_data_structures: true
			
			patterns: [
				"Actor model with Actix",
				"Message passing with channels",
				"Shared-nothing architecture",
				"Wait-free algorithms where possible"
			]
		}
		
		zero_cost_abstractions: {
			compile_time_optimization: true
			monomorphization: true
			inlining_aggressive: true
			link_time_optimization: true
		}
		
		safety_guarantees: {
			memory_safety: "Compile-time guaranteed"
			thread_safety: "Compile-time guaranteed" 
			overflow_protection: "Checked in debug, wrapping in release"
			null_pointer_elimination: "Option<T> and Result<T, E> patterns"
		}
	}
	
	architecture: {
		pattern: "Hexagonal + Event Sourcing + CQRS"
		
		core_components: {
			order_book: {
				data_structure: "Custom B-tree with SIMD optimizations"
				update_complexity: "O(log n)"
				memory_layout: "Cache-friendly struct packing"
			}
			
			matching_engine: {
				algorithm: "Price-time priority with pro-rata allocation"
				implementation: "Lock-free with atomic operations"
				batch_processing: true
			}
			
			risk_engine: {
				calculation_frequency: "Real-time per order"
				risk_models: ["VaR", "Greeks", "Position limits", "Margin requirements"]
				parallel_processing: "SIMD vectorization"
			}
			
			market_data_handler: {
				protocol: "Binary protocol with zero-copy parsing"
				compression: "LZ4 real-time compression"
				buffering: "Ring buffer with atomic pointers"
			}
		}
		
		event_sourcing: {
			event_store: "Custom implementation with memory-mapped files"
			serialization: "Cap'n Proto (zero-copy)"
			replication: "Raft consensus"
			
			events: {
				order_placed: {
					size: "64 bytes (fixed)"
					serialization_time: "<=1μs"
				}
				order_matched: {
					size: "96 bytes (fixed)"
					serialization_time: "<=1.5μs"
				}
				market_data_updated: {
					size: "48 bytes (fixed)"
					serialization_time: "<=0.5μs"
				}
			}
		}
	}
	
	dependencies: {
		core_crates: {
			"tokio": {
				version: "1.35"
				features: ["rt-multi-thread", "macros", "sync", "time"]
				justification: "Async runtime for I/O operations"
			}
			
			"serde": {
				version: "1.0"
				features: ["derive"]
				justification: "Serialization framework"
			}
			
			"axum": {
				version: "0.7"
				features: ["ws", "headers"]
				justification: "HTTP server framework"
			}
			
			"sqlx": {
				version: "0.7"
				features: ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate"]
				justification: "Async database driver"
			}
		}
		
		performance_crates: {
			"rayon": {
				version: "1.8"
				justification: "Data parallelism for batch operations"
			}
			
			"crossbeam": {
				version: "0.8"
				justification: "Lock-free data structures and channels"
			}
			
			"mimalloc": {
				version: "0.1"
				justification: "High-performance allocator"
			}
			
			"simd-json": {
				version: "0.13"
				justification: "SIMD-accelerated JSON parsing"
			}
		}
		
		monitoring_crates: {
			"tracing": {
				version: "0.1"
				features: ["attributes", "std"]
				justification: "Structured logging and tracing"
			}
			
			"metrics": {
				version: "0.21"
				justification: "Application metrics collection"
			}
			
			"prometheus": {
				version: "0.13"
				justification: "Metrics export format"
			}
		}
	}
	
	testing_strategy: {
		unit_tests: {
			framework: "Built-in Rust testing"
			coverage_target: 95
			
			property_based_testing: {
				framework: "proptest"
				focus_areas: [
					"Order matching algorithms",
					"Risk calculations",
					"Data structure invariants",
					"Serialization/deserialization"
				]
			}
		}
		
		integration_tests: {
			database_tests: {
				framework: "testcontainers"
				databases: ["PostgreSQL", "Redis"]
			}
			
			load_tests: {
				framework: "Custom Rust load testing harness"
				target_rps: 1_000_000
				duration: "1h"
				
				scenarios: [
					"Steady state trading",
					"Market open surge",
					"Flash crash simulation",
					"High-frequency order cancellations"
				]
			}
		}
		
		benchmarking: {
			framework: "Criterion.rs"
			
			micro_benchmarks: [
				"Order book insertion/deletion",
				"Risk calculation functions", 
				"Message serialization/deserialization",
				"Market data parsing"
			]
			
			regression_detection: true
			statistical_analysis: true
		}
	}
	
	deployment: {
		compilation: {
			target: "x86_64-unknown-linux-musl"  // Static binary
			optimization: "release"
			lto: true  // Link Time Optimization
			codegen_units: 1
			panic: "abort"
			
			cpu_specific_optimizations: {
				enabled: true
				target_cpu: "native"  // Optimize for deployment hardware
				target_features: ["+avx2", "+fma", "+bmi2"]
			}
		}
		
		container: {
			base_image: "scratch"  // Minimal container
			binary_only: true
			size_target: "<=20MB"
			
			security: {
				non_root_user: true
				read_only_filesystem: true
				no_new_privileges: true
				capabilities_dropped: "ALL"
			}
		}
		
		kubernetes: {
			qos_class: "Guaranteed"  // Predictable resource allocation
			
			resources: {
				requests: {
					cpu: "4"      // 4 full cores
					memory: "8Gi"
				}
				limits: {
					cpu: "4"      // No oversubscription
					memory: "8Gi"
				}
			}
			
			node_affinity: {
				required: {
					"node-type": "high-performance"
					"cpu-generation": ">=ice-lake"
					"network": "low-latency"
				}
			}
			
			pod_anti_affinity: true  // Spread across nodes for resilience
			
			networking: {
				host_network: false  // Use service mesh
				dns_policy: "ClusterFirst"
			}
		}
		
		monitoring: {
			health_checks: {
				startup_probe: {
					path: "/health/startup"
					initial_delay: 10
					timeout: 1
				}
				liveness_probe: {
					path: "/health/live"
					period: 5
					timeout: 1
				}
				readiness_probe: {
					path: "/health/ready"
					period: 1
					timeout: 1
				}
			}
			
			metrics_collection: {
				prometheus_endpoint: "/metrics"
				collection_interval: 1  // second
				
				custom_metrics: [
					"orders_processed_total",
					"order_latency_histogram_microseconds",
					"risk_calculation_duration_microseconds",
					"memory_allocations_total",
					"gc_collections_total"  // Should be 0 for Rust
				]
			}
		}
	}
	
	operational_requirements: {
		disaster_recovery: {
			rto: "10 seconds"  // Recovery Time Objective
			rpo: "0 seconds"   // Recovery Point Objective - no data loss
			
			backup_strategy: {
				event_store_replication: "Multi-region with sync replication"
				configuration_backup: "Git-based configuration management"
				secrets_backup: "HashiCorp Vault with HSM"
			}
		}
		
		capacity_planning: {
			scaling_strategy: "Vertical scaling preferred (CPU/memory)"
			horizontal_scaling: "Stateless components only"
			
			resource_projections: {
				"1M orders/day": {cpu: "2 cores", memory: "4GB"}
				"10M orders/day": {cpu: "4 cores", memory: "8GB"}
				"100M orders/day": {cpu: "8 cores", memory: "16GB"}
			}
		}
		
		compliance: {
			financial_regulations: ["MiFID II", "SEC Rule 606", "FINRA"]
			audit_logging: {
				immutable: true
				retention: "7 years"
				format: "Structured JSON with digital signatures"
			}
			
			trade_reporting: {
				latency_requirement: "<=1 second to regulator"
				format: "FIX 4.4 / FIX 5.0"
				delivery_method: "Secure FTP"
			}
		}
	}
}`;

/**
 * Sample data combining multiple CUE files for complex visualization scenarios
 */
export const combinedProjectData = {
  requirements: basicRequirementsCue,
  assembly: assemblySpecCue,
  validation_errors: validationErrorsCue,
  typescript_project: complexTypescriptProjectCue,
  rust_project: rustMicroserviceCue,
};

/**
 * Sample resolved data (what would come from the CUE evaluation)
 */
export const sampleResolvedData = {
  spec_hash: "sha256:a1b2c3d4e5f6789...",
  last_updated: new Date().toISOString(),
  resolved: {
    project: {
      name: "Advanced TypeScript Microservice",
      version: "v3.2.1",
      language: "TypeScript",
      runtime: "Node.js",
    },
    services: {
      auth_service: {
        name: "Authentication Service",
        version: "v2.1.0",
        status: "production",
        endpoints: 4,
        dependencies: ["redis", "vault", "sendgrid"],
      },
      user_service: {
        name: "User Management Service",
        version: "v1.8.2",
        status: "production",
        endpoints: 4,
        depends_on: ["auth_service"],
      },
      notification_service: {
        name: "Notification Service",
        version: "v0.9.1",
        status: "staging",
        endpoints: 6,
        depends_on: ["auth_service", "user_service"],
      },
    },
    requirements: {
      security: 3,
      performance: 2,
      compliance: 1,
      total: 6,
    },
    validation_status: "passed",
    deployment_ready: true,
  },
};
