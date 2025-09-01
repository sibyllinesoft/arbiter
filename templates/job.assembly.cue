// Job Artifact Assembly Template
// Use this template for batch processes, background jobs, and scheduled tasks

package assembly

import "github.com/arbiter/spec/profiles"

// =============================================================================
// ARTIFACT METADATA
// =============================================================================

artifact: {
	// Job identification
	name:        "my-data-processor"              // Replace with your job name
	version:     "1.0.0"                         // Semantic version
	kind:        "job"                           // Fixed for job artifacts
	description: "A robust data processing job with resource monitoring and error recovery"
	
	// Repository information
	repository: {
		url:    "https://github.com/myorg/my-data-processor"
		branch: "main"
	}
	
	// Job ownership and licensing
	license: "MIT"
	author:  "Your Organization <contact@yourorg.com>"
	team:    "Data Engineering"
	
	// Technology stack
	language: "python"  // or "typescript", "go", "rust", "java"
	runtime:  "python"  // or "node", "binary", "jvm"
}

// =============================================================================
// JOB PROFILE CONFIGURATION
// =============================================================================

profile: profiles.JobProfile & {
	// Resource constraints and limits
	resources: {
		cpu:      "500m"  // 500 millicores (0.5 CPU cores)
		memory:   "1Gi"   // 1 GiB RAM
		wallTime: "2h"    // Maximum execution time
		disk:     "10Gi"  // Temporary disk space
	}
	
	// I/O contracts and file access patterns
	ioContracts: {
		// Files and directories the job can read
		reads: [
			"/data/input/**/*.csv",           // Input CSV files
			"/data/input/**/*.json",          // Input JSON files
			"/config/*.yaml",                 // Configuration files
			"/schemas/*.json",                // Data validation schemas
			"/tmp/job-*/*.parquet",          // Temporary processing files
		]
		
		// Files and directories the job can write
		writes: [
			"/data/output/**/*.parquet",      // Output data files
			"/data/output/**/*.json",         // Processed JSON output
			"/logs/job-*.log",               // Job execution logs
			"/tmp/job-*/**",                 // Temporary working files
			"/metrics/job-metrics.json",     // Performance metrics
		]
		
		// Network access configuration
		network: true  // Allow network access for API calls and data fetching
		
		// Database access permissions
		database: {
			allowed:     true
			readonly:    false  // Job needs to write results
			connections: 3      // Maximum concurrent connections
		}
		
		// Temporary storage management
		temp: {
			size:    "5Gi"   // Temporary storage quota
			cleanup: true    // Auto-cleanup on completion
		}
	}
	
	// Execution properties and behavior
	execution: {
		// Job is safe to run multiple times with same input
		idempotent: true
		
		// Job can run alongside other instances
		concurrent: false  // Data processing jobs often need exclusive access
		
		// Retry configuration for failed executions
		retries: {
			maxAttempts: 3           // Maximum retry attempts
			backoff:     "exponential" // linear, exponential, or fixed
			delay:       "5s"        // Initial retry delay
		}
		
		// Timeout configuration
		timeout: {
			execution: "2h"   // Must match resources.wallTime
			shutdown:  "30s"  // Graceful shutdown timeout
		}
	}
	
	// Command-line interface and environment
	interface: {
		// Command line arguments
		args: [
			{
				name:        "input-path"
				type:        "file"
				required:    true
				description: "Path to input data directory"
				validation:  "exists && is_directory"
			},
			{
				name:        "output-path"
				type:        "file"
				required:    true
				description: "Path to output data directory"
				validation:  "writable_directory"
			},
			{
				name:        "batch-size"
				type:        "int"
				required:    false
				description: "Number of records to process per batch"
				validation:  "> 0 && <= 100000"
			},
			{
				name:        "format"
				type:        "enum"
				required:    false
				description: "Output format for processed data"
				validation:  "parquet|json|csv"
			},
			{
				name:        "validation-mode"
				type:        "enum"
				required:    false
				description: "Data validation strictness level"
				validation:  "strict|lenient|skip"
			},
		]
		
		// Environment variables
		environment: [
			{
				name:        "LOG_LEVEL"
				type:        "str"
				required:    false
				description: "Logging verbosity level"
			},
			{
				name:        "JOB_ID"
				type:        "str"
				required:    false
				description: "Unique identifier for this job execution"
				sensitive:   false
			},
			{
				name:        "DATABASE_URL"
				type:        "str"
				required:    true
				description: "Database connection string"
				sensitive:   true
			},
			{
				name:        "API_KEY"
				type:        "str"
				required:    false
				description: "External API authentication key"
				sensitive:   true
			},
			{
				name:        "ENCRYPTION_KEY"
				type:        "str"
				required:    false
				description: "Key for encrypting sensitive output data"
				sensitive:   true
			},
			{
				name:        "MAX_WORKERS"
				type:        "int"
				required:    false
				description: "Maximum number of worker processes"
			},
			{
				name:        "CHECKPOINT_INTERVAL"
				type:        "int"
				required:    false
				description: "Seconds between progress checkpoints"
			},
		]
		
		// Input data specification
		input: {
			type:       "files"  // files, stdin, json, csv
			schema:     "./schemas/input-data.json"
			validation: "valid_data_format && non_empty"
		}
		
		// Output data specification
		output: {
			type:   "files"  // files, stdout, json, csv
			schema: "./schemas/output-data.json"
			path:   "{output-path}/processed-{timestamp}.parquet"
		}
		
		// Exit codes and their meanings
		exitCodes: [
			{
				code:        0
				meaning:     "success"
				description: "Job completed successfully"
				retryable:   false
			},
			{
				code:        1
				meaning:     "data_validation_failed"
				description: "Input data failed validation checks"
				retryable:   false
			},
			{
				code:        2
				meaning:     "processing_error"
				description: "Error during data processing"
				retryable:   true
			},
			{
				code:        3
				meaning:     "output_write_failed"
				description: "Failed to write output files"
				retryable:   true
			},
			{
				code:        4
				meaning:     "database_connection_failed"
				description: "Could not connect to database"
				retryable:   true
			},
			{
				code:        5
				meaning:     "resource_exhausted"
				description: "Exceeded memory or disk limits"
				retryable:   false
			},
			{
				code:        6
				meaning:     "timeout"
				description: "Job exceeded maximum execution time"
				retryable:   false
			},
			{
				code:        7
				meaning:     "invalid_arguments"
				description: "Invalid command line arguments provided"
				retryable:   false
			},
			{
				code:        8
				meaning:     "permission_denied"
				description: "Insufficient permissions for file access"
				retryable:   false
			},
		]
	}
	
	// Monitoring and observability
	monitoring: {
		// Health check command for job status
		healthCheck: "./bin/health-check.py"
		
		// Progress reporting configuration
		progress: {
			enabled:  true
			interval: "30s"  // Report progress every 30 seconds
			metrics: [
				"records_processed",
				"records_failed",
				"processing_rate_per_second",
				"memory_usage_mb",
				"disk_usage_mb",
				"estimated_completion_time",
			]
		}
		
		// Logging configuration
		logging: {
			level:       "info"          // debug, info, warn, error
			format:      "json"          // json or text
			destination: "stdout"        // stdout, file, or syslog
		}
	}
	
	// Comprehensive testing strategy
	tests: {
		// Unit tests for job components
		unit: [
			{
				name:         "data_validation_logic"
				description:  "Test input data validation functions"
				command:      "python -m pytest tests/unit/test_validation.py"
				expectedExit: 0
			},
			{
				name:         "data_transformation_logic"
				description:  "Test core data processing algorithms"
				command:      "python -m pytest tests/unit/test_transforms.py"
				expectedExit: 0
			},
			{
				name:         "error_handling"
				description:  "Test error handling and recovery mechanisms"
				command:      "python -m pytest tests/unit/test_error_handling.py"
				expectedExit: 0
			},
			{
				name:         "resource_monitoring"
				description:  "Test resource usage tracking and limits"
				command:      "python -m pytest tests/unit/test_monitoring.py"
				expectedExit: 0
			},
		]
		
		// Integration tests with real data and dependencies
		integration: [
			{
				name:        "small_dataset_processing"
				description: "Process a small test dataset end-to-end"
				setup:       "python tests/setup_small_dataset.py"
				command:     "python job.py ./test/data/small ./test/output/small --batch-size 100"
				expectedFiles: [
					"./test/output/small/processed-*.parquet",
					"./logs/job-*.log",
				]
				expectedOutput: "*Processing completed successfully*"
				cleanup:        "rm -rf ./test/output/small"
			},
			{
				name:        "database_integration"
				description: "Test database read/write operations"
				setup:       "docker-compose up -d postgres && python tests/setup_test_db.py"
				command:     "python job.py ./test/data/db ./test/output/db --format json"
				expectedFiles: [
					"./test/output/db/*.json",
				]
				expectedOutput: "*Database operations completed*"
				cleanup:        "docker-compose down && rm -rf ./test/output/db"
			},
			{
				name:        "error_recovery_test"
				description: "Test job recovery from simulated failures"
				setup:       "python tests/setup_failure_scenarios.py"
				command:     "python job.py ./test/data/failure ./test/output/failure --validation-mode strict"
				expectedFiles: [
					"./test/output/failure/processed-*.parquet",
					"./logs/job-*.log",
				]
				expectedOutput: "*Recovered from * errors*"
				cleanup:        "rm -rf ./test/output/failure"
			},
		]
		
		// Property-based tests for job behavior
		property: [
			{
				name:        "idempotency"
				description: "Running the same job twice produces identical results"
				property:    "output_run1 == output_run2 where output_run1 := run(input) && output_run2 := run(input)"
			},
			{
				name:        "resource_bounds"
				description: "Job never exceeds specified resource limits"
				property:    "memory_usage <= resources.memory && cpu_usage <= resources.cpu && execution_time <= resources.wallTime"
			},
			{
				name:        "data_integrity"
				description: "Output data maintains referential integrity"
				property:    "all(output_records, record => valid_schema(record) && non_null_required_fields(record))"
			},
			{
				name:        "progress_monotonicity"
				description: "Progress metrics always increase monotonically"
				property:    "all(progress_reports, report => report.records_processed >= previous.records_processed)"
			},
			{
				name:        "checkpoint_recovery"
				description: "Job can resume from any checkpoint"
				property:    "resume(checkpoint_t) => output_final == output_without_interruption"
			},
		]
	}
	
	// Scheduling configuration (for recurring jobs)
	scheduling: {
		type:     "cron"           // cron, interval, or manual
		schedule: "0 2 * * *"      // Daily at 2 AM UTC
		timezone: "UTC"            // Timezone for schedule interpretation
		overlap:  "forbid"         // allow, forbid, or queue
	}
}

// =============================================================================
// BUILD CONFIGURATION
// =============================================================================

build: {
	// Language and runtime configuration
	language: artifact.language
	runtime:  artifact.runtime
	
	// Build targets for different deployment methods
	targets: [
		"docker",     // Docker container
		"kubernetes", // Kubernetes Job/CronJob
		"airflow",    // Apache Airflow DAG
		"lambda",     // AWS Lambda function (for smaller jobs)
	]
	
	// Python-specific configuration
	python: {
		version:      "3.11"       // Python version
		requirements: "requirements.txt"
		
		// Virtual environment configuration
		venv: {
			create: true
			name:   "job-env"
		}
		
		// Package installation
		packages: [
			"pandas>=1.5.0",      // Data manipulation
			"pyarrow>=10.0.0",    // Parquet file support
			"pydantic>=2.0.0",    // Data validation
			"sqlalchemy>=2.0.0",  // Database ORM
			"redis>=4.0.0",       // Caching and job queuing
			"prometheus-client",   // Metrics collection
			"structlog",          // Structured logging
		]
		
		// Development dependencies
		devPackages: [
			"pytest>=7.0.0",
			"pytest-cov>=4.0.0",
			"black>=23.0.0",      // Code formatting
			"flake8>=5.0.0",      // Linting
			"mypy>=1.0.0",        // Type checking
		]
	}
	
	// Container image configuration
	docker: {
		baseImage: "python:3.11-slim"  // Lightweight Python base image
		workdir:   "/app"
		
		// Multi-stage build for optimization
		stages: [
			{
				name: "dependencies"
				commands: [
					"COPY requirements.txt .",
					"RUN pip install --no-cache-dir -r requirements.txt",
				]
			},
			{
				name: "application"
				commands: [
					"COPY src/ ./src/",
					"COPY schemas/ ./schemas/",
					"COPY config/ ./config/",
					"COPY job.py .",
				]
			},
		]
		
		// Security hardening
		user:     "1000"     // Run as non-root user
		readOnly: false      // Jobs need write access to temp directories
		
		// Environment variables
		env: {
			PYTHONPATH:        "/app/src"
			PYTHONUNBUFFERED:  "1"
			PIP_NO_CACHE_DIR:  "1"
		}
		
		// Resource limits in container
		limits: {
			memory: profile.resources.memory
			cpu:    profile.resources.cpu
		}
	}
	
	// Build optimization
	optimization: {
		// Dead code elimination
		treeshaking: true
		
		// Dependency bundling
		bundleDeps: true
		
		// Binary size optimization
		stripDebug: true  // For production builds
	}
}

// =============================================================================
// COMPREHENSIVE TESTING CONFIGURATION
// =============================================================================

tests: {
	// Unit testing for job logic
	unit: {
		framework: "pytest"
		coverage: {
			minimum:   85  // Jobs may have platform-specific code
			threshold: {
				statements: 85
				branches:   80
				functions:  90
				lines:      85
			}
		}
		
		// Test patterns and configuration
		patterns: [
			"tests/unit/**/*_test.py",
			"tests/unit/**/test_*.py",
		]
		
		// Test environment setup
		fixtures: [
			"tests/fixtures/sample_data.json",
			"tests/fixtures/test_config.yaml",
			"tests/fixtures/mock_database.sql",
		]
		
		// Mock configurations
		mocks: {
			database:     true   // Mock database connections
			filesystem:   false  // Use real filesystem for I/O testing
			externalApis: true   // Mock external API calls
			time:         true   // Mock time functions for deterministic tests
		}
		
		// Performance benchmarks for critical functions
		benchmarks: [
			{
				name:      "data_processing_throughput"
				function:  "process_batch"
				target:    "10000 records/second"
				dataset:   "medium_test_data.json"
			},
			{
				name:      "memory_efficiency"
				function:  "load_and_transform"
				maxMemory: "100MB"
				dataset:   "large_test_data.json"
			},
		]
	}
	
	// Integration testing with real dependencies
	integration: {
		required: true
		
		// Test environment dependencies (Docker Compose)
		dependencies: [
			{
				name:  "postgres"
				image: "postgres:15-alpine"
				ports: ["5432:5432"]
				env: {
					POSTGRES_DB:       "jobtest"
					POSTGRES_USER:     "jobuser"
					POSTGRES_PASSWORD: "jobpass"
				}
				volumes: [
					"./tests/fixtures/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql",
					"./tests/fixtures/test-data.sql:/docker-entrypoint-initdb.d/02-data.sql",
				]
				healthCheck: "pg_isready -U jobuser -d jobtest"
			},
			{
				name:  "redis"
				image: "redis:7-alpine"
				ports: ["6379:6379"]
				healthCheck: "redis-cli ping"
			},
			{
				name:  "minio"
				image: "minio/minio:latest"
				ports: ["9000:9000", "9001:9001"]
				env: {
					MINIO_ROOT_USER:     "minioadmin"
					MINIO_ROOT_PASSWORD: "minioadmin"
				}
				command: "server /data --console-address ':9001'"
				healthCheck: "curl -f http://localhost:9000/minio/health/live"
			},
		]
		
		// Integration test suites
		suites: [
			{
				name:        "full_pipeline_test"
				description: "Test complete data processing pipeline"
				tests: [
					"tests/integration/test_pipeline.py",
				]
				timeout: "10m"
			},
			{
				name:        "database_operations"
				description: "Test database read/write operations"
				tests: [
					"tests/integration/test_database.py",
				]
				timeout: "5m"
			},
			{
				name:        "file_processing"
				description: "Test large file processing capabilities"
				tests: [
					"tests/integration/test_files.py",
				]
				timeout: "15m"
			},
		]
	}
	
	// End-to-end testing with realistic scenarios
	e2e: {
		required: true
		
		// Complete workflow scenarios
		scenarios: [
			{
				name:        "daily_batch_processing"
				description: "Simulate daily batch processing workflow"
				setup:       "./tests/e2e/setup_daily_data.sh"
				steps: [
					"Generate 24 hours of sample data",
					"Run data processing job",
					"Verify output data quality",
					"Check performance metrics",
				]
				timeout: "30m"
				cleanup: "./tests/e2e/cleanup_daily_data.sh"
			},
			{
				name:        "failure_recovery"
				description: "Test job recovery from various failure scenarios"
				scenarios: [
					{
						name:        "database_failure"
						description: "Simulate database connection loss during processing"
						timeout:     "10m"
					},
					{
						name:        "disk_full"
						description: "Simulate disk space exhaustion"
						timeout:     "5m"
					},
					{
						name:        "memory_pressure"
						description: "Simulate memory pressure conditions"
						timeout:     "10m"
					},
				]
			},
			{
				name:        "large_scale_processing"
				description: "Test processing of large datasets"
				setup:       "./tests/e2e/generate_large_dataset.sh"
				dataSize:    "10GB"
				steps: [
					"Process 10GB dataset",
					"Verify all records processed",
					"Check resource usage stayed within limits",
				]
				timeout: "60m"
				cleanup: "./tests/e2e/cleanup_large_dataset.sh"
			},
		]
		
		// Stress testing configuration
		stress: {
			enabled: true
			scenarios: [
				{
					name:            "concurrent_execution"
					description:     "Run multiple job instances simultaneously"
					concurrentJobs:  5
					datasetSize:     "1GB"
					timeout:         "20m"
				},
				{
					name:           "memory_stress"
					description:    "Process data that approaches memory limits"
					memoryPressure: "90%"
					timeout:        "30m"
				},
			]
		}
	}
	
	// Performance testing
	performance: {
		required: true
		
		// Performance benchmarks
		benchmarks: [
			{
				name:         "throughput_benchmark"
				description:  "Measure data processing throughput"
				metric:       "records_per_second"
				target:       ">= 5000"
				datasetSize:  "1GB"
				timeout:      "15m"
			},
			{
				name:        "memory_efficiency"
				description: "Measure memory usage efficiency"
				metric:      "memory_per_record"
				target:      "<= 1KB"
				timeout:     "10m"
			},
			{
				name:        "scalability_test"
				description: "Test performance with increasing data sizes"
				datasets:    ["100MB", "500MB", "1GB", "5GB"]
				metric:      "processing_time"
				timeout:     "45m"
			},
		]
		
		// Resource monitoring during tests
		monitoring: {
			enabled: true
			metrics: [
				"cpu_usage_percent",
				"memory_usage_bytes",
				"disk_io_read_bytes",
				"disk_io_write_bytes",
				"network_bytes",
			]
			interval: "5s"
		}
	}
}

// =============================================================================
// DEPLOYMENT AND ORCHESTRATION
// =============================================================================

deployment: {
	// Kubernetes Job configuration
	kubernetes: {
		// Job specification
		job: {
			parallelism:    1     // Number of concurrent job pods
			completions:    1     // Number of successful completions required
			backoffLimit:   profile.execution.retries.maxAttempts
			
			// Pod template
			template: {
				// Resource requirements
				resources: {
					requests: {
						cpu:    "200m"
						memory: "512Mi"
					}
					limits: profile.resources
				}
				
				// Security context
				securityContext: {
					runAsNonRoot:             true
					runAsUser:                1000
					allowPrivilegeEscalation: false
					readOnlyRootFilesystem:   false  // Jobs need write access
				}
				
				// Volume mounts for I/O
				volumes: [
					{
						name: "input-data"
						persistentVolumeClaim: claimName: "input-pvc"
					},
					{
						name: "output-data"
						persistentVolumeClaim: claimName: "output-pvc"
					},
					{
						name: "temp-storage"
						emptyDir: sizeLimit: profile.ioContracts.temp.size
					},
				]
				
				volumeMounts: [
					{name: "input-data", mountPath: "/data/input"},
					{name: "output-data", mountPath: "/data/output"},
					{name: "temp-storage", mountPath: "/tmp"},
				]
			}
		}
		
		// CronJob for scheduled execution
		cronJob: {
			schedule:                profile.scheduling.schedule
			timezone:                profile.scheduling.timezone
			concurrencyPolicy:       "Forbid"  // Don't allow overlapping executions
			startingDeadlineSeconds: 600       // 10 minutes deadline to start
			successfulJobsHistoryLimit: 3      // Keep 3 successful job pods
			failedJobsHistoryLimit:     1      // Keep 1 failed job pod for debugging
		}
	}
	
	// Apache Airflow DAG configuration
	airflow: {
		enabled: true
		
		// DAG configuration
		dag: {
			dagId:           "data-processor-dag"
			description:     artifact.description
			schedule:        profile.scheduling.schedule
			maxActiveRuns:   1
			catchup:         false
			
			// Default task arguments
			defaultArgs: {
				owner:          artifact.team
				retries:        profile.execution.retries.maxAttempts
				retryDelay:     profile.execution.retries.delay
				emailOnFailure: true
				emailOnRetry:   false
			}
		}
		
		// Task definition
		task: {
			taskId:        "process-data"
			image:         "my-data-processor:latest"
			resources:     profile.resources
			env:           profile.interface.environment
			
			// Task dependencies (if part of larger pipeline)
			dependsOn: [
				// "upstream-task-1",
				// "upstream-task-2",
			]
		}
	}
	
	// AWS Batch configuration (alternative)
	awsBatch: {
		enabled: false
		
		jobQueue:      "data-processing-queue"
		jobDefinition: "data-processor-job-def"
		
		compute: {
			type:         "EC2"
			minvCpus:     0
			maxvCpus:     100
			desiredvCpus: 10
			instanceTypes: ["m5.large", "m5.xlarge"]
		}
	}
}

// =============================================================================
// MONITORING AND OBSERVABILITY
// =============================================================================

monitoring: {
	// Metrics collection
	metrics: {
		enabled: true
		
		// Custom job metrics
		customMetrics: [
			{
				name:        "job_records_processed_total"
				type:        "counter"
				description: "Total number of records processed"
			},
			{
				name:        "job_records_failed_total"
				type:        "counter"
				description: "Total number of records that failed processing"
			},
			{
				name:        "job_processing_duration_seconds"
				type:        "histogram"
				description: "Time spent processing data"
			},
			{
				name:        "job_memory_usage_bytes"
				type:        "gauge"
				description: "Current memory usage"
			},
			{
				name:        "job_disk_usage_bytes"
				type:        "gauge"
				description: "Current disk usage"
			},
			{
				name:        "job_batch_size"
				type:        "gauge"
				description: "Current batch processing size"
			},
		]
		
		// Prometheus pushgateway for batch job metrics
		pushgateway: {
			url:     "http://pushgateway:9091"
			job:     "data-processor"
			groupBy: ["instance", "job_id"]
		}
	}
	
	// Alerting rules for job monitoring
	alerts: [
		{
			name:        "JobExecutionFailed"
			description: "Data processing job failed"
			condition:   "increase(job_failures_total[5m]) > 0"
			severity:    "critical"
		},
		{
			name:        "JobExecutionTimeHigh"
			description: "Job taking longer than expected"
			condition:   "job_processing_duration_seconds > 7200"  // 2 hours
			severity:    "warning"
		},
		{
			name:        "JobMemoryUsageHigh"
			description: "Job using excessive memory"
			condition:   "job_memory_usage_bytes / (1024^3) > 0.9"  // 90% of 1GB
			severity:    "warning"
		},
		{
			name:        "JobHighFailureRate"
			description: "High rate of record processing failures"
			condition:   "rate(job_records_failed_total[10m]) / rate(job_records_processed_total[10m]) > 0.05"
			severity:    "warning"
		},
	]
	
	// Logging configuration
	logging: profile.monitoring.logging & {
		// Structured logging fields
		fields: [
			"timestamp",
			"level",
			"job_id",
			"batch_id",
			"records_processed",
			"memory_usage",
			"message",
		]
		
		// Log aggregation
		aggregation: {
			enabled:     true
			destination: "elasticsearch"
			index:       "job-logs-*"
		}
	}
	
	// Distributed tracing (for complex pipelines)
	tracing: {
		enabled: false  // Usually not needed for simple batch jobs
		
		// Trace configuration
		service: artifact.name
		spans: [
			"job.execution",
			"data.validation",
			"data.processing",
			"data.output",
		]
	}
}

// =============================================================================
// DATA MANAGEMENT AND GOVERNANCE
// =============================================================================

dataGovernance: {
	// Data lineage tracking
	lineage: {
		enabled: true
		
		// Input data sources
		inputs: [
			{
				name:        "raw_customer_data"
				type:        "database_table"
				location:    "postgres://prod/customers"
				schema:      "./schemas/customer-input.json"
				sensitivity: "PII"
			},
			{
				name:        "transaction_logs"
				type:        "file_system"
				location:    "/data/input/transactions/"
				format:      "csv"
				sensitivity: "confidential"
			},
		]
		
		// Output data products
		outputs: [
			{
				name:        "processed_analytics"
				type:        "file_system"
				location:    "/data/output/analytics/"
				format:      "parquet"
				sensitivity: "internal"
			},
		]
	}
	
	// Data quality checks
	quality: {
		enabled: true
		
		// Quality rules
		rules: [
			{
				name:        "completeness_check"
				description: "Ensure all required fields are present"
				type:        "completeness"
				threshold:   0.99  // 99% of records must be complete
			},
			{
				name:        "uniqueness_check"
				description: "Check for duplicate records"
				type:        "uniqueness"
				fields:      ["customer_id", "transaction_id"]
			},
			{
				name:        "validity_check"
				description: "Validate data formats and ranges"
				type:        "validity"
				rules: [
					"email =~ /^[^@]+@[^@]+\\.[^@]+$/",
					"amount >= 0",
					"date >= '2020-01-01'",
				]
			},
		]
	}
	
	// Data retention and cleanup
	retention: {
		enabled: true
		
		// Retention policies
		policies: [
			{
				type:      "input_data"
				retention: "90d"
				action:    "archive"
			},
			{
				type:      "output_data"
				retention: "365d"
				action:    "delete"
			},
			{
				type:      "temp_data"
				retention: "1d"
				action:    "delete"
			},
			{
				type:      "log_files"
				retention: "30d"
				action:    "compress"
			},
		]
	}
}

// =============================================================================
// CI/CD AND AUTOMATION
// =============================================================================

ci: {
	// Build triggers
	triggers: [
		"push:main",
		"pull_request",
		"schedule:0 6 * * 1",  // Weekly builds on Monday 6 AM
		"tag:v*",
	]
	
	// Build matrix
	matrix: {
		pythonVersion: ["3.9", "3.10", "3.11"]
		platform: ["linux", "macos"]
	}
	
	// Pipeline stages
	stages: [
		{
			name: "validate"
			steps: [
				"python -m pip install --upgrade pip",
				"pip install -r requirements-dev.txt",
				"python -m flake8 src/ tests/",
				"python -m black --check src/ tests/",
				"python -m mypy src/",
				"arbiter validate --profile job",
			]
		},
		{
			name:     "test"
			parallel: true
			steps: [
				"python -m pytest tests/unit/ -v --cov=src --cov-report=xml",
				"python -m pytest tests/integration/ -v",
			]
			artifacts: [
				"coverage.xml",
				"test-results.xml",
			]
		},
		{
			name: "build"
			steps: [
				"docker build -t $JOB_IMAGE .",
				"docker scan $JOB_IMAGE",  // Security scanning
			]
			artifacts: [
				"Dockerfile",
			]
		},
		{
			name: "e2e"
			steps: [
				"docker-compose -f docker-compose.test.yml up -d",
				"python -m pytest tests/e2e/ -v --timeout=600",
				"docker-compose -f docker-compose.test.yml down",
			]
			artifacts: [
				"e2e-results/",
			]
		},
		{
			name: "performance"
			condition: "branch == main"
			steps: [
				"python tests/performance/run_benchmarks.py",
				"python tests/performance/compare_results.py",
			]
			artifacts: [
				"benchmark-results.json",
			]
		},
	]
	
	// Deployment stages
	deployment: {
		// Development environment
		dev: {
			condition: "branch == develop"
			steps: [
				"kubectl apply -f k8s/dev/",
				"kubectl wait --for=condition=complete job/data-processor-dev",
			]
		}
		
		// Staging environment
		staging: {
			condition: "branch == main"
			steps: [
				"kubectl apply -f k8s/staging/",
				"kubectl wait --for=condition=complete job/data-processor-staging",
				"python tests/smoke/verify_staging.py",
			]
		}
		
		// Production environment
		production: {
			condition: "tag =~ /^v\\d+\\.\\d+\\.\\d+$/"
			approval:  true  // Manual approval required
			steps: [
				"kubectl apply -f k8s/production/",
				"kubectl wait --for=condition=complete job/data-processor-prod",
				"python tests/smoke/verify_production.py",
			]
		}
	}
	
	// Notifications
	notifications: {
		slack: {
			channel: "#data-engineering"
			events:  ["failure", "success", "approval_needed"]
		}
		email: {
			recipients: ["data-team@myorg.com"]
			events:     ["failure"]
		}
	}
}

// =============================================================================
// EXAMPLE USAGE AND CUSTOMIZATION
// =============================================================================

// This comprehensive template covers all aspects of batch job development and deployment.
// Customize these sections for your specific job requirements:
//
// 1. artifact.* - Update job metadata and technology stack
// 2. profile.resources - Adjust CPU, memory, and time limits based on your data volume
// 3. profile.ioContracts - Define your specific input/output file patterns
// 4. profile.interface.args - Configure command-line arguments for your job
// 5. tests.e2e.scenarios - Add scenarios specific to your data processing logic
// 6. dataGovernance - Configure data lineage and quality rules for your datasets
//
// Technology Stack Variations:
//
// Node.js/TypeScript Jobs:
// - Change artifact.language to "typescript" and artifact.runtime to "node"
// - Update build.typescript configuration
// - Adjust docker.baseImage to "node:18-alpine"
//
// Go Jobs:
// - Change artifact.language to "go" and artifact.runtime to "binary"
// - Configure Go module build process
// - Use minimal base image like "alpine" or "scratch"
//
// Java Jobs:
// - Change artifact.language to "java" and artifact.runtime to "jvm"
// - Configure Maven/Gradle build
// - Use appropriate JVM base image
//
// Data Processing Patterns:
//
// ETL Jobs:
// - Configure profile.ioContracts.reads for source data
// - Configure profile.ioContracts.writes for transformed data
// - Add data quality validation in dataGovernance.quality
//
// ML Training Jobs:
// - Increase profile.resources for GPU requirements
// - Configure model artifact outputs in profile.ioContracts.writes
// - Add model validation tests in tests.integration
//
// Stream Processing Jobs:
// - Configure profile.execution.concurrent: true for parallel processing
// - Add message queue dependencies in tests.integration.dependencies
// - Configure real-time monitoring in monitoring.metrics
//
// Resource Optimization:
//
// Memory-Intensive Jobs:
// - Increase profile.resources.memory (e.g., "8Gi", "16Gi")
// - Configure appropriate JVM heap size for Java jobs
// - Add memory monitoring in monitoring.alerts
//
// CPU-Intensive Jobs:
// - Increase profile.resources.cpu (e.g., "2", "4")
// - Configure parallel processing in your job logic
// - Add CPU monitoring in monitoring.alerts
//
// Long-Running Jobs:
// - Increase profile.resources.wallTime (e.g., "6h", "24h")
// - Implement checkpointing for job resume capability
// - Configure timeout alerts in monitoring.alerts