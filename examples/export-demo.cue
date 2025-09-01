// Export Demo - Showcasing tag-based export functionality
// #OpenAPI user-api version=3.1.0, file=user-api.yaml
// #TypeScript models file=user-types.d.ts
// #K8s deployment namespace=production, file=user-service.k8s.yaml

package demo

// User API Schema with OpenAPI export
#UserAPI: {
	// OpenAPI metadata
	openapi: "3.1.0"
	info: {
		title:       "User Management API"
		version:     "1.0.0"
		description: "RESTful API for user management operations"
	}
	servers: [{
		url:         "https://api.example.com/v1"
		description: "Production server"
	}]
	
	// API paths
	paths: {
		"/users": {
			get: {
				summary:     "List all users"
				operationId: "listUsers"
				parameters: [{
					name:        "limit"
					in:          "query"
					description: "Maximum number of users to return"
					schema: type: "integer"
				}]
				responses: {
					"200": {
						description: "List of users"
						content: "application/json": schema: {
							type: "array"
							items: #User
						}
					}
				}
			}
			post: {
				summary:     "Create a new user"
				operationId: "createUser"
				requestBody: content: "application/json": schema: #CreateUserRequest
				responses: {
					"201": {
						description: "User created successfully"
						content: "application/json": schema: #User
					}
					"400": {
						description: "Invalid request"
						content: "application/json": schema: #ErrorResponse
					}
				}
			}
		}
		"/users/{id}": {
			get: {
				summary:     "Get user by ID"
				operationId: "getUserById"
				parameters: [{
					name:        "id"
					in:          "path"
					required:    true
					description: "User ID"
					schema: type: "string"
				}]
				responses: {
					"200": {
						description: "User details"
						content: "application/json": schema: #User
					}
					"404": {
						description: "User not found"
						content: "application/json": schema: #ErrorResponse
					}
				}
			}
		}
	}
	
	// Schema components
	components: schemas: {
		User:              #User
		CreateUserRequest: #CreateUserRequest
		ErrorResponse:     #ErrorResponse
	}
}

// TypeScript-ready data models
#User: {
	id:          string
	email:       string
	name:        string
	role:        "admin" | "user" | "guest"
	isActive:    bool
	createdAt:   string // ISO 8601 timestamp
	updatedAt:   string // ISO 8601 timestamp
	profile?:    #UserProfile
}

#UserProfile: {
	firstName?:   string
	lastName?:    string
	avatar?:      string
	phoneNumber?: string
	address?:     #Address
}

#Address: {
	street:  string
	city:    string
	state:   string
	zipCode: string
	country: string | *"US"
}

#CreateUserRequest: {
	email:    string
	name:     string
	role:     "admin" | "user" | "guest" | *"user"
	profile?: #UserProfile
}

#ErrorResponse: {
	error: {
		code:    string
		message: string
		details?: {...}
	}
}

// Kubernetes deployment configuration
#UserService: {
	apiVersion: "apps/v1"
	kind:       "Deployment"
	metadata: {
		name:      "user-service"
		namespace: "production"
		labels: {
			app:     "user-service"
			version: "v1.0.0"
		}
	}
	spec: {
		replicas: 3
		selector: matchLabels: app: "user-service"
		template: {
			metadata: labels: app: "user-service"
			spec: {
				containers: [{
					name:  "user-service"
					image: "user-service:1.0.0"
					ports: [{
						containerPort: 8080
						name:          "http"
					}]
					env: [
						{name: "NODE_ENV", value:           "production"},
						{name: "DB_HOST", valueFrom: secretKeyRef: {name: "db-secrets", key: "host"}},
						{name: "DB_PASSWORD", valueFrom: secretKeyRef: {name: "db-secrets", key: "password"}},
					]
					resources: {
						requests: {
							cpu:    "100m"
							memory: "128Mi"
						}
						limits: {
							cpu:    "500m"
							memory: "512Mi"
						}
					}
					livenessProbe: {
						httpGet: {
							path: "/health"
							port: 8080
						}
						initialDelaySeconds: 30
						periodSeconds:       10
					}
					readinessProbe: {
						httpGet: {
							path: "/ready"
							port: 8080
						}
						initialDelaySeconds: 5
						periodSeconds:       5
					}
				}]
			}
		}
	}
}

// Service to expose the deployment
#UserServiceSvc: {
	apiVersion: "v1"
	kind:       "Service"
	metadata: {
		name:      "user-service"
		namespace: "production"
	}
	spec: {
		selector: app: "user-service"
		ports: [{
			port:       80
			targetPort: 8080
			protocol:   "TCP"
		}]
		type: "ClusterIP"
	}
}

// Actual resource instances for export
userAPI:        #UserAPI
userDeployment: #UserService
userService:    #UserServiceSvc

// Example user data for testing
exampleUser: #User & {
	id:        "user-123"
	email:     "john.doe@example.com"
	name:      "John Doe"
	role:      "user"
	isActive:  true
	createdAt: "2024-01-15T10:30:00Z"
	updatedAt: "2024-01-15T10:30:00Z"
	profile: {
		firstName: "John"
		lastName:  "Doe"
		avatar:    "https://example.com/avatars/john.jpg"
		address: {
			street:  "123 Main St"
			city:    "Anytown"
			state:   "CA"
			zipCode: "12345"
			country: "US"
		}
	}
}