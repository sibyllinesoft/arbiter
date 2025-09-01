// Service Artifact Assembly Template  
// Use this template for HTTP/WebSocket services, REST APIs, and microservices

package assembly

import "github.com/arbiter/spec/profiles"

// =============================================================================
// ARTIFACT METADATA
// =============================================================================

artifact: {
	// Service identification
	name:        "my-awesome-service"           // Replace with your service name
	version:     "1.0.0"                       // Semantic version
	kind:        "service"                     // Fixed for service artifacts
	description: "A high-performance REST API service with real-time capabilities"
	
	// Repository information
	repository: {
		url:    "https://github.com/myorg/my-awesome-service"
		branch: "main"
	}
	
	// Service ownership and licensing
	license: "MIT"
	author:  "Your Organization <contact@yourorg.com>"
	team:    "Backend Engineering"
	
	// Technology stack
	language:  "typescript"  // or "go", "python", "rust", "java"
	framework: "express"     // or "fastify", "hono", "gin", "fastapi", etc.
}

// =============================================================================
// SERVICE PROFILE CONFIGURATION
// =============================================================================

profile: profiles.ServiceProfile & {
	// Complete API endpoint specifications
	endpoints: [
		// Health check endpoint (mandatory for all services)
		{
			path:        "/health"
			method:      "GET"
			summary:     "Health check endpoint"
			description: "Returns service health status and dependency health checks"
			
			responseSchema: "./schemas/health-response.json"
			
			responses: [
				{
					code:        200
					description: "Service is healthy"
					schema:      "./schemas/health-ok.json"
				},
				{
					code:        503
					description: "Service is unhealthy or dependencies are down"
					schema:      "./schemas/health-error.json"
				},
			]
		},
		
		// Readiness probe for container orchestration
		{
			path:        "/ready"
			method:      "GET"
			summary:     "Readiness probe"
			description: "Indicates if service is ready to handle traffic"
			
			responses: [
				{code: 200, description: "Service is ready"},
				{code: 503, description: "Service is not ready"},
			]
		},
		
		// Liveness probe for container orchestration
		{
			path:        "/live"
			method:      "GET"
			summary:     "Liveness probe"
			description: "Indicates if service is alive and should not be restarted"
			
			responses: [
				{code: 200, description: "Service is alive"},
				{code: 503, description: "Service should be restarted"},
			]
		},
		
		// Metrics endpoint for monitoring
		{
			path:        "/metrics"
			method:      "GET"
			summary:     "Prometheus metrics"
			description: "Export service metrics in Prometheus format"
			
			responses: [
				{code: 200, description: "Metrics data", schema: "./schemas/metrics-response.txt"},
			]
		},
		
		// Core business endpoints
		{
			path:        "/api/v1/users"
			method:      "GET"
			summary:     "List users"
			description: "Retrieve a paginated list of users with filtering options"
			
			requestSchema:  "./schemas/list-users-request.json"
			responseSchema: "./schemas/users-list-response.json"
			
			auth: {
				required: true
				type:     "bearer"
				scopes: ["user:read"]
			}
			
			rateLimit: {
				requests: 100
				window:   "1m"
				burst:    20
			}
			
			responses: [
				{code: 200, description: "Users retrieved successfully"},
				{code: 400, description: "Invalid query parameters"},
				{code: 401, description: "Authentication required"},
				{code: 403, description: "Insufficient permissions"},
				{code: 429, description: "Rate limit exceeded"},
				{code: 500, description: "Internal server error"},
			]
		},
		
		{
			path:        "/api/v1/users"
			method:      "POST"
			summary:     "Create user"
			description: "Create a new user account with validation and email verification"
			
			requestSchema:  "./schemas/create-user-request.json"
			responseSchema: "./schemas/user-response.json"
			
			auth: {
				required: true
				type:     "bearer"
				scopes: ["user:write"]
			}
			
			rateLimit: {
				requests: 10
				window:   "1m"
				burst:    5
			}
			
			responses: [
				{code: 201, description: "User created successfully"},
				{code: 400, description: "Invalid request data"},
				{code: 401, description: "Authentication required"},
				{code: 403, description: "Insufficient permissions"},
				{code: 409, description: "User already exists"},
				{code: 422, description: "Validation failed"},
				{code: 429, description: "Rate limit exceeded"},
				{code: 500, description: "Internal server error"},
			]
		},
		
		{
			path:        "/api/v1/users/{userId}"
			method:      "GET"
			summary:     "Get user by ID"
			description: "Retrieve detailed information about a specific user"
			
			responseSchema: "./schemas/user-response.json"
			
			auth: {
				required: true
				type:     "bearer"
				scopes: ["user:read"]
			}
			
			rateLimit: {
				requests: 200
				window:   "1m"
				burst:    50
			}
			
			responses: [
				{code: 200, description: "User found"},
				{code: 401, description: "Authentication required"},
				{code: 403, description: "Insufficient permissions"},
				{code: 404, description: "User not found"},
				{code: 429, description: "Rate limit exceeded"},
				{code: 500, description: "Internal server error"},
			]
		},
		
		{
			path:        "/api/v1/users/{userId}"
			method:      "PUT"
			summary:     "Update user"
			description: "Update user information with optimistic locking"
			
			requestSchema:  "./schemas/update-user-request.json"
			responseSchema: "./schemas/user-response.json"
			
			auth: {
				required: true
				type:     "bearer"
				scopes: ["user:write"]
			}
			
			rateLimit: {
				requests: 50
				window:   "1m"
				burst:    10
			}
			
			responses: [
				{code: 200, description: "User updated successfully"},
				{code: 400, description: "Invalid request data"},
				{code: 401, description: "Authentication required"},
				{code: 403, description: "Insufficient permissions"},
				{code: 404, description: "User not found"},
				{code: 409, description: "Optimistic locking conflict"},
				{code: 422, description: "Validation failed"},
				{code: 429, description: "Rate limit exceeded"},
				{code: 500, description: "Internal server error"},
			]
		},
		
		{
			path:        "/api/v1/users/{userId}"
			method:      "DELETE"
			summary:     "Delete user"
			description: "Soft delete a user account with cleanup jobs"
			
			auth: {
				required: true
				type:     "bearer"
				scopes: ["user:delete"]
			}
			
			rateLimit: {
				requests: 10
				window:   "1m"
				burst:    2
			}
			
			responses: [
				{code: 204, description: "User deleted successfully"},
				{code: 401, description: "Authentication required"},
				{code: 403, description: "Insufficient permissions"},
				{code: 404, description: "User not found"},
				{code: 409, description: "User has dependent data"},
				{code: 429, description: "Rate limit exceeded"},
				{code: 500, description: "Internal server error"},
			]
		},
		
		// Bulk operations endpoint
		{
			path:        "/api/v1/users/bulk"
			method:      "POST"
			summary:     "Bulk user operations"
			description: "Perform bulk create, update, or delete operations on users"
			
			requestSchema:  "./schemas/bulk-users-request.json"
			responseSchema: "./schemas/bulk-operation-response.json"
			
			auth: {
				required: true
				type:     "bearer"
				scopes: ["user:write", "user:bulk"]
			}
			
			rateLimit: {
				requests: 5
				window:   "1m"
				burst:    1
			}
			
			responses: [
				{code: 202, description: "Bulk operation accepted and queued"},
				{code: 400, description: "Invalid bulk request"},
				{code: 401, description: "Authentication required"},
				{code: 403, description: "Insufficient permissions"},
				{code: 413, description: "Request too large"},
				{code: 429, description: "Rate limit exceeded"},
				{code: 500, description: "Internal server error"},
			]
		},
		
		// WebSocket endpoint for real-time features
		{
			path:        "/ws"
			method:      "GET"
			summary:     "WebSocket connection"
			description: "Establish WebSocket connection for real-time updates"
			
			auth: {
				required: false  // Authentication via query parameter or headers
				type:     "bearer"
			}
			
			responses: [
				{code: 101, description: "WebSocket connection established"},
				{code: 400, description: "Invalid WebSocket request"},
				{code: 401, description: "Authentication required"},
				{code: 403, description: "Insufficient permissions"},
				{code: 426, description: "Upgrade required"},
			]
		},
	]
	
	// Health and monitoring configuration
	healthCheck: {
		path:     "/health"
		method:   "GET"
		timeout:  "5s"
		interval: "30s"
		dependencies: [
			"database",
			"redis",
			"external_api",
		]
	}
	
	// Service dependencies and their health checks
	dependencies: [
		{
			name:        "database"
			type:        "database"
			required:    true
			healthCheck: "SELECT 1"
			timeout:     "3s"
		},
		{
			name:        "redis"
			type:        "cache"
			required:    true
			healthCheck: "PING"
			timeout:     "2s"
		},
		{
			name:        "external_api"
			type:        "external-api"
			required:    false  // Service can work without it
			healthCheck: "GET /health"
			timeout:     "5s"
		},
		{
			name:        "file_storage"
			type:        "filesystem"
			required:    true
			healthCheck: "stat /data/uploads"
			timeout:     "1s"
		},
		{
			name:        "message_queue"
			type:        "queue"
			required:    false
			healthCheck: "queue-status check"
			timeout:     "3s"
		},
	]
	
	// Service-level agreements and performance targets
	sla: {
		availability: "99.9%"  // 8.77 hours downtime per year
		
		latency: {
			p50: "50ms"   // 50th percentile response time
			p95: "200ms"  // 95th percentile response time
			p99: "500ms"  // 99th percentile response time
		}
		
		throughput: {
			rps: 1000  // Requests per second
		}
		
		recovery: {
			rto: "5m"   // Recovery Time Objective
			rpo: "15s"  // Recovery Point Objective
		}
	}
	
	// Resource requirements and constraints
	resources: {
		cpu: {
			request: "200m"  // 200 millicores
			limit:   "1000m" // 1 core maximum
		}
		
		memory: {
			request: "256Mi"  // 256 MiB baseline
			limit:   "1Gi"    // 1 GiB maximum
		}
		
		storage: {
			size: "5Gi"
			type: "persistent"
		}
	}
	
	// Configuration management
	configuration: {
		// Environment variables
		environment: [
			{
				name:        "PORT"
				required:    false
				default:     "3000"
				description: "HTTP server port"
				validation:  "int && >0 && <65536"
			},
			{
				name:        "NODE_ENV"
				required:    false
				default:     "development"
				description: "Node.js environment"
				validation:  "development|staging|production"
			},
			{
				name:        "LOG_LEVEL"
				required:    false
				default:     "info"
				description: "Logging verbosity level"
				validation:  "debug|info|warn|error"
			},
			{
				name:        "DATABASE_URL"
				required:    true
				description: "Primary database connection string"
				validation:  "valid_connection_string"
			},
			{
				name:        "REDIS_URL"
				required:    true
				description: "Redis cache connection string"
				validation:  "valid_redis_url"
			},
			{
				name:        "MAX_REQUEST_SIZE"
				required:    false
				default:     "10MB"
				description: "Maximum HTTP request body size"
				validation:  "valid_byte_size"
			},
			{
				name:        "RATE_LIMIT_WINDOW"
				required:    false
				default:     "60000"
				description: "Rate limiting window in milliseconds"
				validation:  "int && >0"
			},
		]
		
		// Secret management
		secrets: [
			{
				name:        "JWT_SECRET"
				description: "JSON Web Token signing secret"
				required:    true
			},
			{
				name:        "DATABASE_PASSWORD"
				description: "Database user password"
				required:    true
			},
			{
				name:        "EXTERNAL_API_KEY"
				description: "Third-party API authentication key"
				required:    false
			},
			{
				name:        "ENCRYPTION_KEY"
				description: "Data encryption key for sensitive fields"
				required:    true
			},
		]
		
		// Configuration files
		files: [
			{
				path:        "/config/service.yaml"
				description: "Main service configuration"
				required:    true
			},
			{
				path:        "/config/database.json"
				description: "Database connection configuration"
				required:    true
			},
			{
				path:        "/certificates/tls.crt"
				description: "TLS certificate for HTTPS"
				required:    false
			},
			{
				path:        "/certificates/tls.key"
				description: "TLS private key"
				required:    false
			},
		]
	}
	
	// Deployment strategy and scaling
	deployment: {
		strategy: "rolling"  // rolling, blue-green, or canary
		
		replicas: {
			min:    2    // Minimum instances for high availability
			max:    20   // Maximum instances for scale
			target: 3    // Default number of replicas
		}
		
		scaling: {
			metric:    "cpu"  // cpu, memory, rps, or queue-depth
			threshold: 70     // Scale up when CPU > 70%
		}
	}
	
	// Comprehensive observability configuration
	observability: {
		// Custom metrics definitions
		metrics: [
			{
				name:        "http_requests_total"
				type:        "counter"
				description: "Total number of HTTP requests"
			},
			{
				name:        "http_request_duration_seconds"
				type:        "histogram"
				description: "HTTP request duration in seconds"
			},
			{
				name:        "websocket_connections_active"
				type:        "gauge"
				description: "Number of active WebSocket connections"
			},
			{
				name:        "database_connection_pool_active"
				type:        "gauge"
				description: "Active database connections"
			},
			{
				name:        "cache_hit_rate"
				type:        "gauge"
				description: "Redis cache hit rate percentage"
			},
			{
				name:        "user_operations_total"
				type:        "counter"
				description: "Total user CRUD operations"
			},
			{
				name:        "authentication_attempts_total"
				type:        "counter"
				description: "Total authentication attempts"
			},
			{
				name:        "rate_limit_violations_total"
				type:        "counter"
				description: "Total rate limit violations"
			},
		]
		
		// Logging configuration
		logs: {
			level:      "info"
			structured: true
			format:     "json"
		}
		
		// Distributed tracing
		tracing: {
			enabled:   true
			sampler:   "probabilistic"
			exporters: ["jaeger", "zipkin"]
		}
	}
}

// =============================================================================
// BUILD CONFIGURATION
// =============================================================================

build: {
	// Language and framework configuration
	language:  artifact.language
	framework: artifact.framework
	
	// Build targets for containerization
	targets: [
		"docker",     // Docker container image
		"kubernetes", // Kubernetes deployment
		"serverless", // Serverless function (optional)
	]
	
	// TypeScript/Node.js specific configuration
	typescript: {
		strict:      true
		declaration: false   // Services don't expose TypeScript APIs
		sourceMap:   true    // For better debugging in production
		target:      "ES2022"
		outDir:      "./dist"
		
		// Include service-specific files
		include: [
			"src/**/*",
			"schemas/**/*",  // JSON schemas for validation
			"docs/**/*",     // OpenAPI documentation
		]
		
		exclude: [
			"**/*.test.ts",
			"**/*.spec.ts",
			"test/**/*",
		]
	}
	
	// Service bundling configuration
	bundle: {
		minify:     false  // Keep readable for debugging
		treeshaking: true  // Remove unused code
		splitting:   false // Single bundle for services
		
		// Include runtime assets
		assets: [
			"schemas/**/*.json",
			"docs/**/*.yaml",
			"templates/**/*",
		]
		
		// External dependencies (typically bundled for containers)
		externals: []  // Bundle all dependencies
	}
	
	// Container image configuration
	docker: {
		baseImage: "node:20-alpine"  // Lightweight base image
		workdir:   "/app"
		
		// Multi-stage build optimization
		stages: [
			{
				name: "dependencies"
				commands: [
					"COPY package*.json ./",
					"RUN npm ci --only=production",
				]
			},
			{
				name: "build"
				commands: [
					"COPY . .",
					"RUN npm run build",
				]
			},
			{
				name: "runtime"
				commands: [
					"COPY --from=dependencies /app/node_modules ./node_modules",
					"COPY --from=build /app/dist ./dist",
					"COPY package.json ./",
				]
			},
		]
		
		// Security hardening
		user:     "node"     // Run as non-root user
		readOnly: true       // Read-only root filesystem
		noCache:  ["**.log"] // Don't cache log files
		
		// Health check in container
		healthcheck: {
			test:     ["CMD", "curl", "-f", "http://localhost:3000/health"]
			interval: "30s"
			timeout:  "3s"
			retries:  3
		}
	}
}

// =============================================================================
// COMPREHENSIVE TESTING CONFIGURATION
// =============================================================================

tests: {
	// Unit testing for business logic
	unit: {
		framework: "vitest"  // or "jest", "mocha"
		coverage: {
			minimum:   90  // High coverage for service reliability
			threshold: {
				statements: 90
				branches:   85
				functions:  95
				lines:      90
			}
		}
		
		// Test patterns and configuration
		patterns: [
			"src/**/*.test.ts",
			"src/**/*.spec.ts",
		]
		
		environment: "node"
		globals:     true
		
		// Mock external dependencies
		mocks: {
			database:     true   // Mock database calls
			cache:        true   // Mock Redis calls
			externalApis: true   // Mock HTTP clients
			fileSystem:   true   // Mock file operations
		}
		
		// Performance testing for critical paths
		benchmarks: [
			{
				name:      "user_creation_performance"
				endpoint:  "POST /api/v1/users"
				maxTime:   "100ms"
				requests:  100
			},
			{
				name:      "user_lookup_performance"
				endpoint:  "GET /api/v1/users/:id"
				maxTime:   "50ms"
				requests:  1000
			},
		]
	}
	
	// Integration testing with real dependencies
	integration: {
		required: true
		
		// Test dependencies (Docker Compose)
		dependencies: [
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
				volumes: [
					"./test/fixtures/schema.sql:/docker-entrypoint-initdb.d/schema.sql",
				]
			},
			{
				name:  "redis"
				image: "redis:7-alpine"
				ports: ["6379:6379"]
				healthCheck: "redis-cli ping"
			},
			{
				name:  "wiremock"
				image: "wiremock/wiremock:latest"
				ports: ["8080:8080"]
				volumes: [
					"./test/fixtures/wiremock:/home/wiremock",
				]
			},
		]
		
		// Integration test suites
		suites: [
			{
				name:        "database_integration"
				description: "Test database operations and transactions"
				tests: [
					"tests/integration/database.test.ts",
					"tests/integration/migrations.test.ts",
				]
				timeout: "60s"
			},
			{
				name:        "cache_integration"
				description: "Test Redis caching operations"
				tests: [
					"tests/integration/cache.test.ts",
				]
				timeout: "30s"
			},
			{
				name:        "external_api_integration"
				description: "Test external API interactions"
				tests: [
					"tests/integration/external-apis.test.ts",
				]
				timeout: "45s"
			},
		]
	}
	
	// End-to-end API testing
	e2e: {
		required: true
		framework: "supertest"  // For HTTP API testing
		
		// E2E test scenarios
		scenarios: [
			{
				name:        "user_lifecycle"
				description: "Complete user CRUD operations"
				steps: [
					"Create user via POST /api/v1/users",
					"Retrieve user via GET /api/v1/users/:id",
					"Update user via PUT /api/v1/users/:id",
					"Delete user via DELETE /api/v1/users/:id",
				]
			},
			{
				name:        "authentication_flow"
				description: "Full authentication and authorization"
				steps: [
					"Register new user",
					"Login and receive JWT",
					"Access protected endpoint with token",
					"Try access with invalid token",
					"Token refresh flow",
				]
			},
			{
				name:        "bulk_operations"
				description: "Large scale operations and performance"
				steps: [
					"Create 1000 users via bulk endpoint",
					"Query users with pagination",
					"Update multiple users",
					"Delete users in batches",
				]
			},
			{
				name:        "websocket_communication"
				description: "Real-time WebSocket functionality"
				steps: [
					"Establish WebSocket connection",
					"Subscribe to user events",
					"Create user and verify event",
					"Handle connection drops",
				]
			},
		]
		
		// Load testing configuration
		load: {
			tool: "k6"  // or "artillery", "locust"
			scenarios: [
				{
					name:        "baseline_load"
					vus:         50    // Virtual users
					duration:    "5m"  // Test duration
					rps:         100   // Requests per second target
				},
				{
					name:        "spike_test"
					vus:         200
					duration:    "2m"
					rps:         500
				},
				{
					name:        "stress_test"
					vus:         500
					duration:    "10m"
					rps:         1000
				},
			]
		}
	}
	
	// Security testing
	security: {
		required: true
		
		// Security test categories
		tests: [
			{
				name:        "authentication_security"
				description: "Test authentication bypass attempts"
				tools:       ["owasp-zap", "custom"]
			},
			{
				name:        "input_validation"
				description: "SQL injection and XSS vulnerability tests"
				tools:       ["sqlmap", "custom"]
			},
			{
				name:        "rate_limiting"
				description: "Verify rate limiting effectiveness"
				tools:       ["custom"]
			},
			{
				name:        "cors_configuration"
				description: "Cross-origin resource sharing security"
				tools:       ["custom"]
			},
		]
	}
}

// =============================================================================
// DEPLOYMENT AND ORCHESTRATION
// =============================================================================

deployment: {
	// Container orchestration (Kubernetes)
	kubernetes: {
		namespace: "my-awesome-service"
		
		// Deployment configuration
		deployment: {
			replicas: profile.deployment.replicas.target
			strategy: profile.deployment.strategy
			
			// Pod template
			template: {
				// Resource requirements
				resources: profile.resources
				
				// Security context
				securityContext: {
					runAsNonRoot:             true
					runAsUser:                1000
					allowPrivilegeEscalation: false
					readOnlyRootFilesystem:   true
				}
				
				// Health checks
				livenessProbe: {
					httpGet: {
						path: "/live"
						port: 3000
					}
					initialDelaySeconds: 30
					periodSeconds:       10
				}
				
				readinessProbe: {
					httpGet: {
						path: "/ready"
						port: 3000
					}
					initialDelaySeconds: 5
					periodSeconds:       5
				}
			}
		}
		
		// Service configuration
		service: {
			type: "ClusterIP"
			ports: [
				{
					name:       "http"
					port:       80
					targetPort: 3000
					protocol:   "TCP"
				},
			]
		}
		
		// Horizontal Pod Autoscaler
		hpa: {
			minReplicas:                     profile.deployment.replicas.min
			maxReplicas:                     profile.deployment.replicas.max
			targetCPUUtilizationPercentage:  profile.deployment.scaling.threshold
			targetMemoryUtilizationPercentage: 80
		}
		
		// Ingress configuration
		ingress: {
			enabled:     true
			className:   "nginx"
			annotations: {
				"nginx.ingress.kubernetes.io/rate-limit": "100"
				"nginx.ingress.kubernetes.io/ssl-redirect": "true"
			}
			tls: true
		}
	}
	
	// Service mesh configuration (Istio)
	serviceMesh: {
		enabled: true
		
		// Virtual service for traffic management
		virtualService: {
			retries: {
				attempts:      3
				perTryTimeout: "10s"
				retryOn:       "5xx,reset,connect-failure,refused-stream"
			}
			
			timeout: "30s"
		}
		
		// Destination rule for load balancing
		destinationRule: {
			loadBalancer: "ROUND_ROBIN"
			connectionPool: {
				tcp: {
					maxConnections: 100
				}
				http: {
					http1MaxPendingRequests:  50
					http2MaxRequests:         100
					maxRequestsPerConnection: 2
				}
			}
		}
	}
}

// =============================================================================
// MONITORING AND OBSERVABILITY
// =============================================================================

monitoring: {
	// Prometheus metrics collection
	prometheus: {
		enabled:    true
		endpoint:   "/metrics"
		interval:   "15s"
		scrapeTimeout: "10s"
		
		// Custom metrics configuration
		customMetrics: profile.observability.metrics
	}
	
	// Alerting rules
	alerts: [
		{
			name:        "HighErrorRate"
			description: "High HTTP error rate detected"
			condition:   "rate(http_requests_total{status=~\"5..\"}[5m]) > 0.05"
			severity:    "warning"
		},
		{
			name:        "HighLatency"
			description: "High response latency detected"
			condition:   "histogram_quantile(0.95, http_request_duration_seconds) > 0.5"
			severity:    "warning"
		},
		{
			name:        "ServiceDown"
			description: "Service is completely down"
			condition:   "up == 0"
			severity:    "critical"
		},
		{
			name:        "HighMemoryUsage"
			description: "Memory usage is critically high"
			condition:   "container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9"
			severity:    "warning"
		},
	]
	
	// Distributed tracing
	tracing: profile.observability.tracing & {
		// Additional tracing configuration
		spanAttributes: [
			"user.id",
			"request.id",
			"operation.name",
		]
	}
	
	// Log aggregation
	logging: profile.observability.logs & {
		// Log shipping configuration
		shipper: {
			enabled:     true
			destination: "elasticsearch"
			bufferSize:  "64MB"
			flushInterval: "30s"
		}
		
		// Log retention
		retention: {
			debug: "1d"
			info:  "7d"
			warn:  "30d"
			error: "90d"
		}
	}
}

// =============================================================================
// CI/CD PIPELINE CONFIGURATION
// =============================================================================

ci: {
	// Pipeline triggers
	triggers: [
		"push:main",
		"pull_request",
		"tag:v*",
		"schedule:0 2 * * *",  // Nightly builds
	]
	
	// Build matrix for testing
	matrix: {
		nodeVersion: ["18", "20", "22"]
		environment: ["test", "staging"]
	}
	
	// Pipeline stages
	stages: [
		{
			name:     "validate"
			parallel: true
			steps: [
				"npm ci",
				"npm run lint",
				"npm run type-check",
				"arbiter validate --profile service",
			]
		},
		{
			name:     "test"
			parallel: true
			steps: [
				"npm run test:unit",
				"npm run test:integration",
				"npm run test:security",
			]
			artifacts: [
				"coverage/",
				"test-results/",
				"security-report.json",
			]
		},
		{
			name: "build"
			steps: [
				"npm run build",
				"docker build -t $SERVICE_IMAGE .",
				"docker scan $SERVICE_IMAGE",  // Security scanning
			]
			artifacts: [
				"dist/",
				"Dockerfile",
			]
		},
		{
			name: "e2e"
			steps: [
				"docker-compose up -d",
				"npm run test:e2e",
				"npm run test:load",
				"docker-compose down",
			]
			artifacts: [
				"e2e-results/",
				"load-test-results/",
			]
		},
		{
			name: "deploy-staging"
			condition: "branch == develop"
			steps: [
				"kubectl apply -f k8s/staging/",
				"kubectl rollout status deployment/$SERVICE_NAME -n staging",
				"npm run test:smoke -- --env=staging",
			]
		},
		{
			name: "deploy-production"
			condition: "tag =~ /^v\\d+\\.\\d+\\.\\d+$/"
			approval: true  // Manual approval required
			steps: [
				"kubectl apply -f k8s/production/",
				"kubectl rollout status deployment/$SERVICE_NAME -n production",
				"npm run test:smoke -- --env=production",
			]
		},
	]
	
	// Notifications
	notifications: {
		slack: {
			channel: "#deployments"
			events:  ["failure", "success"]
		}
		email: {
			recipients: ["team@myorg.com"]
			events:     ["failure"]
		}
	}
}

// =============================================================================
// EXAMPLE USAGE AND CUSTOMIZATION
// =============================================================================

// This comprehensive template covers all aspects of service development and deployment.
// Customize these sections based on your specific requirements:
//
// 1. artifact.* - Update service metadata and technology stack
// 2. profile.endpoints - Define your API endpoints with proper schemas
// 3. profile.dependencies - Configure your service dependencies
// 4. profile.sla - Set realistic performance targets
// 5. tests.e2e.scenarios - Add your specific test scenarios
// 6. deployment.kubernetes - Adjust resource limits and scaling policies
//
// Technology Stack Variations:
//
// Go Services:
// - Change artifact.language to "go"  
// - Update build.targets for Go-specific compilation
// - Adjust docker.baseImage to golang:alpine or scratch
//
// Python Services:
// - Change artifact.language to "python"
// - Set artifact.framework to "fastapi" or "django"
// - Update build configuration for Python requirements
//
// Java Services:
// - Change artifact.language to "java"
// - Set artifact.framework to "spring-boot" or "micronaut"
// - Configure Maven/Gradle build processes
//
// Performance Optimization:
// - Adjust profile.resources based on load testing results
// - Configure profile.deployment.scaling for your traffic patterns
// - Tune monitoring.prometheus.interval based on metric precision needs
//
// Security Hardening:
// - Enable profile.auth for all sensitive endpoints
// - Configure proper rate limiting per endpoint type
// - Add security tests for your specific vulnerability concerns
//
// High Availability Setup:
// - Set profile.deployment.replicas.min >= 2
// - Configure deployment.kubernetes.hpa for auto-scaling
// - Enable deployment.serviceMesh for advanced traffic management