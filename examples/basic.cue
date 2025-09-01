// Basic CUE Configuration Example
package config

// Application metadata
name:    "my-app"
version: "1.0.0"

// Server configuration
server: {
	host: "localhost"
	port: 8080
	ssl:  false
}

// Database settings
database: {
	driver: "postgresql"
	host:   "localhost"
	port:   5432
	name:   "myapp_db"
	
	// Connection pool settings
	pool: {
		min: 5
		max: 50
	}
}

// Feature flags
features: {
	auth_enabled:         true
	metrics_enabled:      true
	debug_mode:          false
	rate_limiting:       true
}

// API endpoints
endpoints: {
	"/health":     "GET - health check"
	"/users":      "GET, POST - user management"
	"/users/:id":  "GET, PUT, DELETE - specific user"
	"/auth/login": "POST - user authentication"
}