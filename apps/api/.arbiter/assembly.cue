package api

{
	product: {
		name: "Api"
		goals: [
			"Application goals will be defined here",
		]
	}
	ui: {
		routes: [
			{
				id:   "test-api:main"
				path: "/test-api"
				capabilities: [
					"view",
				]
				components: [
					"Test-apiPage",
				]
			},
			{
				id:   "chat-service:main"
				path: "/chat-service"
				capabilities: [
					"view",
				]
				components: [
					"Chat-servicePage",
				]
			},
		]
	}
	locators: {
		"page:test-api":     "[data-testid=\"test-api-page\"]"
		"page:chat-service": "[data-testid=\"chat-service-page\"]"
	}
	flows: []
	config: {
		language: "typescript"
		kind:     "service"
	}
	metadata: {
		name:    "api"
		version: "1.0.0"
	}
	deployment: {
		target: "kubernetes"
	}
	services: {
		"test-api": {
			serviceType:     "bespoke"
			language:        "typescript"
			type:            "deployment"
			sourceDirectory: "./src/test-api"
			ports: [
				{
					name:       "http"
					port:       3001
					targetPort: 3001
				},
			]
		}
		"chat-service": {
			serviceType:     "bespoke"
			language:        "typescript"
			type:            "deployment"
			sourceDirectory: "./src/chat-service"
			ports: [
				{
					name:       "http"
					port:       3002
					targetPort: 3002
				},
			]
			env: {
				DATABASE_URL: "postgresql://user:password@user-db:5432/user-db"
			}
		}
		"user-db": {
			serviceType: "prebuilt"
			language:    "container"
			type:        "statefulset"
			image:       "postgres:15"
			ports: [
				{
					name:       "db"
					port:       5432
					targetPort: 5432
				},
			]
			volumes: [
				{
					name: "data"
					path: "/var/lib/postgresql/data"
					size: "50Gi"
					type: "persistentVolumeClaim"
				},
			]
			env: {
				POSTGRES_DB:       "user-db"
				POSTGRES_USER:     "user"
				POSTGRES_PASSWORD: "password"
			}
			attachTo: "chat-service"
		}
	}
	paths: {
		"/api/users": {
			get: {
				response: {
					"$ref": "#/components/schemas/UserList"
				}
			}
		}
	}
}
