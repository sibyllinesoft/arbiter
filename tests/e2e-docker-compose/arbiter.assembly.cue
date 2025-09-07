package assembly

arbiterSpec: {
	meta: {
		name: "e2e-docker-compose-test"
		version: "1.0.0" 
		description: "E2E test for Docker Compose generation"
	}

	language: "typescript"
	
	deployment: {
		target: "kubernetes"
		testing: {
			artifacts: ["compose"]
			localDevelopment: true
		}
	}

	services: {
		// Redis cache - prebuilt service
		redis: {
			type: "prebuilt"
			image: "redis:7-alpine"
			ports: [6379]
			healthCheck: {
				path: "/"
				interval: "10s"
				timeout: "5s"
				retries: 3
			}
		}

		// PostgreSQL database - prebuilt service
		postgres: {
			type: "prebuilt"
			image: "postgres:15-alpine"
			ports: [5432]
			config: {
				environment: {
					POSTGRES_DB: "testdb"
					POSTGRES_USER: "testuser"
					POSTGRES_PASSWORD: "testpass"
				}
			}
			volumes: [{
				type: "persistentVolumeClaim"
				name: "postgres-data"
				mountPath: "/var/lib/postgresql/data"
			}]
		}

		// Simple web app - bespoke service
		webapp: {
			type: "bespoke"
			language: "typescript"
			sourceDirectory: "./app"
			ports: [3000]
			healthCheck: {
				path: "/health"
				interval: "15s"
				timeout: "10s"
				retries: 3
			}
			config: {
				environment: {
					NODE_ENV: "production"
					REDIS_URL: "redis://redis:6379"
					DATABASE_URL: "postgresql://testuser:testpass@postgres:5432/testdb"
				}
			}
			dependencies: ["redis", "postgres"]
		}
	}

	volumes: {
		"postgres-data": {
			type: "persistentVolumeClaim"
			size: "1Gi"
		}
	}
}