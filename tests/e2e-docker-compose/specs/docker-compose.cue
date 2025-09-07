package dockercompose

// Docker Compose specification for e2e testing
// Uses small, reliable Alpine-based images for fast startup

services: {
	// Redis cache service
	redis: {
		image: "redis:7-alpine"
		ports: ["6379:6379"]
		healthcheck: {
			test: ["CMD", "redis-cli", "ping"]
			interval: "10s"
			timeout: "5s"
			retries: 3
			start_period: "5s"
		}
		restart: "unless-stopped"
		networks: ["e2e-network"]
	}

	// PostgreSQL database
	postgres: {
		image: "postgres:15-alpine"
		ports: ["5432:5432"]
		environment: {
			POSTGRES_DB: "testdb"
			POSTGRES_USER: "testuser"
			POSTGRES_PASSWORD: "testpass"
		}
		healthcheck: {
			test: ["CMD-SHELL", "pg_isready -U testuser -d testdb"]
			interval: "10s"
			timeout: "5s"
			retries: 5
			start_period: "10s"
		}
		restart: "unless-stopped"
		networks: ["e2e-network"]
		volumes: [
			"postgres_data:/var/lib/postgresql/data"
		]
	}

	// Simple Node.js application
	app: {
		build: {
			context: "./services/node-app"
			dockerfile: "Dockerfile"
		}
		ports: ["3000:3000"]
		environment: {
			NODE_ENV: "production"
			REDIS_URL: "redis://redis:6379"
			DATABASE_URL: "postgresql://testuser:testpass@postgres:5432/testdb"
		}
		depends_on: ["redis", "postgres"]
		healthcheck: {
			test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
			interval: "15s"
			timeout: "10s"
			retries: 3
			start_period: "30s"
		}
		restart: "unless-stopped"
		networks: ["e2e-network"]
	}

	// Nginx reverse proxy
	nginx: {
		image: "nginx:alpine"
		ports: ["8080:80"]
		depends_on: ["app"]
		healthcheck: {
			test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
			interval: "10s"
			timeout: "5s"
			retries: 3
			start_period: "10s"
		}
		restart: "unless-stopped"
		networks: ["e2e-network"]
		volumes: [
			"./services/nginx/nginx.conf:/etc/nginx/nginx.conf:ro"
		]
	}
}

// Network configuration
networks: {
	"e2e-network": {
		driver: "bridge"
	}
}

// Volume configuration
volumes: {
	postgres_data: {}
}

// Export structure for docker-compose
dockerCompose: {
	version: "3.8"
	services: {
		// Redis cache service
		redis: {
			image: "redis:7-alpine"
			ports: ["6379:6379"]
			healthcheck: {
				test: ["CMD", "redis-cli", "ping"]
				interval: "10s"
				timeout: "5s"
				retries: 3
				start_period: "5s"
			}
			restart: "unless-stopped"
			networks: ["e2e-network"]
		}

		// PostgreSQL database
		postgres: {
			image: "postgres:15-alpine"
			ports: ["5432:5432"]
			environment: {
				POSTGRES_DB: "testdb"
				POSTGRES_USER: "testuser"
				POSTGRES_PASSWORD: "testpass"
			}
			healthcheck: {
				test: ["CMD-SHELL", "pg_isready -U testuser -d testdb"]
				interval: "10s"
				timeout: "5s"
				retries: 5
				start_period: "10s"
			}
			restart: "unless-stopped"
			networks: ["e2e-network"]
			volumes: [
				"postgres_data:/var/lib/postgresql/data"
			]
		}

		// Simple Node.js application
		app: {
			build: {
				context: "./services/node-app"
				dockerfile: "Dockerfile"
			}
			ports: ["3000:3000"]
			environment: {
				NODE_ENV: "production"
				REDIS_URL: "redis://redis:6379"
				DATABASE_URL: "postgresql://testuser:testpass@postgres:5432/testdb"
			}
			depends_on: ["redis", "postgres"]
			healthcheck: {
				test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
				interval: "15s"
				timeout: "10s"
				retries: 3
				start_period: "30s"
			}
			restart: "unless-stopped"
			networks: ["e2e-network"]
		}

		// Nginx reverse proxy
		nginx: {
			image: "nginx:alpine"
			ports: ["8080:80"]
			depends_on: ["app"]
			healthcheck: {
				test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
				interval: "10s"
				timeout: "5s"
				retries: 3
				start_period: "10s"
			}
			restart: "unless-stopped"
			networks: ["e2e-network"]
			volumes: [
				"./services/nginx/nginx.conf:/etc/nginx/nginx.conf:ro"
			]
		}
	}
	networks: {
		"e2e-network": {
			driver: "bridge"
		}
	}
	volumes: {
		postgres_data: {}
	}
}