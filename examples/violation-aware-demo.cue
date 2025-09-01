// Example CUE configuration with intentional violations to demonstrate the system
// This file shows how the violation-aware diagram system works

// Valid configuration section
config: {
	environment: "production"
	version: "1.0.0"
	features: {
		logging: true
		metrics: true
		tracing: false
	}
}

// Database configuration with a violation
database: {
	host: "localhost"
	port: 5432
	// This will cause a violation if we have constraints
	max_connections: 1000 & >500  // Intentional constraint violation for demo
}

// API configuration with conflicting values (violation)
api: {
	base_url: "http://api.example.com"
	timeout: 30 & 60  // Conflicting values - violation
	retries: 3
}

// Services configuration with references
services: {
	web: {
		image: "nginx:alpine"
		port: 80
		environment: config.environment  // Reference to config.environment
		depends_on: ["api", "database"]
	}
	
	worker: {
		image: "app:worker"
		replicas: 3
		config_ref: config  // Reference to entire config block
	}
}

// Invalid field that should trigger a violation if schema is closed
unauthorized_field: "this should not be allowed"