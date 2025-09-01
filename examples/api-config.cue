// API Configuration Example for User Management Service
// This demonstrates a concrete implementation of the API schema

package api

import "github.com/nathanrice/arbiter/examples/api-schema.cue"

// Production API configuration
userAPI: #APISpec & {
	// Basic metadata
	version: "1.2.0"
	name:    "User Management API"
	baseURL: "https://api.users.example.com"
	
	// Global rate limiting
	globalRateLimit: {
		requestsPerMinute: 1000
		concurrent:        50
		burst:            200
	}
	
	// Security configuration
	security: {
		defaultAuth: "bearer"
		oauth2: {
			authURL:  "https://auth.example.com/oauth/authorize"
			tokenURL: "https://auth.example.com/oauth/token"
			scopes: {
				"users:read":   "Read user information"
				"users:write":  "Create and update users"
				"users:delete": "Delete users"
				"admin":        "Full administrative access"
			}
		}
	}
	
	// Data models
	models: {
		User: {
			type: "object"
			properties: {
				id: {
					type:        "string"
					format:      "uuid"
					description: "Unique user identifier"
					readonly:    true
					example:     "123e4567-e89b-12d3-a456-426614174000"
				}
				email: {
					type:        "string"
					format:      "email"
					description: "User email address"
					maxLength:   255
					example:     "user@example.com"
				}
				username: {
					type:        "string"
					minLength:   3
					maxLength:   50
					pattern:     "^[a-zA-Z0-9_-]+$"
					description: "Unique username"
					example:     "johnsmith"
				}
				firstName: {
					type:        "string"
					minLength:   1
					maxLength:   100
					description: "First name"
					example:     "John"
				}
				lastName: {
					type:        "string"
					minLength:   1
					maxLength:   100
					description: "Last name"
					example:     "Smith"
				}
				role: {
					type: "string"
					enum: ["user", "admin", "moderator"]
					description: "User role"
					default:     "user"
				}
				isActive: {
					type:        "boolean"
					description: "Whether the user account is active"
					default:     true
				}
				createdAt: {
					type:        "string"
					format:      "datetime"
					description: "Account creation timestamp"
					readonly:    true
					example:     "2024-01-15T10:30:00Z"
				}
				updatedAt: {
					type:        "string"
					format:      "datetime"
					description: "Last update timestamp"
					readonly:    true
					example:     "2024-01-15T10:30:00Z"
				}
				profile: {
					type: "object"
					properties: {
						avatar: {
							type:        "string"
							format:      "uri"
							description: "Avatar image URL"
							nullable:    true
							example:     "https://avatars.example.com/user123.jpg"
						}
						bio: {
							type:        "string"
							maxLength:   500
							description: "User biography"
							nullable:    true
							example:     "Software developer passionate about clean code"
						}
						website: {
							type:        "string"
							format:      "uri"
							description: "Personal website URL"
							nullable:    true
							example:     "https://johnsmith.dev"
						}
						location: {
							type:        "string"
							maxLength:   100
							description: "User location"
							nullable:    true
							example:     "San Francisco, CA"
						}
					}
					nullable: true
				}
			}
			required: ["id", "email", "username", "firstName", "lastName", "role", "isActive", "createdAt", "updatedAt"]
		}
		
		CreateUserRequest: {
			type: "object"
			properties: {
				email: {
					type:        "string"
					format:      "email"
					description: "User email address"
					maxLength:   255
				}
				username: {
					type:        "string"
					minLength:   3
					maxLength:   50
					pattern:     "^[a-zA-Z0-9_-]+$"
					description: "Unique username"
				}
				firstName: {
					type:        "string"
					minLength:   1
					maxLength:   100
					description: "First name"
				}
				lastName: {
					type:        "string"
					minLength:   1
					maxLength:   100
					description: "Last name"
				}
				role: {
					type: "string"
					enum: ["user", "admin", "moderator"]
					description: "User role"
					default:     "user"
				}
				password: {
					type:        "string"
					minLength:   8
					description: "User password (will be hashed)"
					writeonly:   true
				}
			}
			required: ["email", "username", "firstName", "lastName", "password"]
		}
		
		UpdateUserRequest: {
			type: "object"
			properties: {
				email: {
					type:        "string"
					format:      "email"
					description: "User email address"
					maxLength:   255
				}
				firstName: {
					type:        "string"
					minLength:   1
					maxLength:   100
					description: "First name"
				}
				lastName: {
					type:        "string"
					minLength:   1
					maxLength:   100
					description: "Last name"
				}
				role: {
					type: "string"
					enum: ["user", "admin", "moderator"]
					description: "User role"
				}
				isActive: {
					type:        "boolean"
					description: "Whether the user account is active"
				}
				profile: {
					type: "object"
					properties: {
						bio: {
							type:        "string"
							maxLength:   500
							description: "User biography"
							nullable:    true
						}
						website: {
							type:        "string"
							format:      "uri"
							description: "Personal website URL"
							nullable:    true
						}
						location: {
							type:        "string"
							maxLength:   100
							description: "User location"
							nullable:    true
						}
					}
				}
			}
		}
		
		UserListResponse: #PaginationModel & {
			properties: {
				users: {
					type:        "array"
					items:       models.User
					description: "List of users"
				}
			} & properties
			required: required + ["users"]
		}
	}
	
	// API endpoints
	endpoints: {
		// List users with pagination and filtering
		listUsers: {
			method:      "GET"
			path:        "/api/v1/users"
			description: "Retrieve paginated list of users with optional filtering"
			auth:        "required"
			tags: ["Users"]
			
			rateLimit: {
				requestsPerMinute: 100
				concurrent:        10
			}
			
			request: {
				queryParams: {
					page: {
						type:        "int"
						required:    false
						description: "Page number (1-based)"
						example:     1
					}
					limit: {
						type:        "int"
						required:    false
						description: "Items per page (1-100)"
						example:     20
					}
					search: {
						type:        "string"
						required:    false
						description: "Search term for username, email, or name"
						example:     "john"
					}
					role: {
						type:        "string"
						required:    false
						description: "Filter by user role"
						example:     "user"
					}
					active: {
						type:        "bool"
						required:    false
						description: "Filter by active status"
						example:     true
					}
					sort: {
						type:        "string"
						required:    false
						description: "Sort field"
						example:     "createdAt"
					}
					order: {
						type:        "string"
						required:    false
						description: "Sort order"
						example:     "desc"
					}
				}
			}
			
			response: {
				"200": models.UserListResponse
				"400": #ErrorModel
				"401": #ErrorModel
				"403": #ErrorModel
				"500": #ErrorModel
			}
			
			testing: {
				enabled: true
				fixtures: [
					{name: "empty_list", expectedCount: 0},
					{name: "basic_pagination", expectedCount: 20},
					{name: "filtered_results", search: "john", expectedMin: 1}
				]
			}
		}
		
		// Get user by ID
		getUser: {
			method:      "GET"
			path:        "/api/v1/users/{id}"
			description: "Retrieve a specific user by ID"
			auth:        "required"
			tags: ["Users"]
			
			rateLimit: {
				requestsPerMinute: 200
				burst:            50
			}
			
			request: {
				pathParams: {
					id: {
						type:        "uuid"
						description: "User ID"
						pattern:     "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
					}
				}
			}
			
			response: {
				"200": models.User
				"400": #ErrorModel
				"401": #ErrorModel
				"403": #ErrorModel
				"404": #ErrorModel
				"500": #ErrorModel
			}
		}
		
		// Create new user
		createUser: {
			method:      "POST"
			path:        "/api/v1/users"
			description: "Create a new user account"
			auth:        "required"
			tags: ["Users"]
			
			rateLimit: {
				requestsPerMinute: 20
				burst:            5
			}
			
			request: {
				contentType: "application/json"
				body:        models.CreateUserRequest
			}
			
			response: {
				"201": models.User
				"400": #ErrorModel
				"401": #ErrorModel
				"403": #ErrorModel
				"409": #ErrorModel  // Conflict (duplicate email/username)
				"422": #ErrorModel  // Validation error
				"500": #ErrorModel
			}
		}
		
		// Update user
		updateUser: {
			method:      "PUT"
			path:        "/api/v1/users/{id}"
			description: "Update an existing user"
			auth:        "required"
			tags: ["Users"]
			
			rateLimit: {
				requestsPerMinute: 50
				burst:            10
			}
			
			request: {
				pathParams: {
					id: {
						type:        "uuid"
						description: "User ID"
					}
				}
				contentType: "application/json"
				body:        models.UpdateUserRequest
			}
			
			response: {
				"200": models.User
				"400": #ErrorModel
				"401": #ErrorModel
				"403": #ErrorModel
				"404": #ErrorModel
				"409": #ErrorModel  // Conflict
				"422": #ErrorModel  // Validation error
				"500": #ErrorModel
			}
		}
		
		// Delete user
		deleteUser: {
			method:      "DELETE"
			path:        "/api/v1/users/{id}"
			description: "Delete a user account (soft delete)"
			auth:        "required"
			tags: ["Users"]
			
			rateLimit: {
				requestsPerMinute: 10
				burst:            2
			}
			
			request: {
				pathParams: {
					id: {
						type:        "uuid"
						description: "User ID"
					}
				}
			}
			
			response: {
				"204": {type: "null", description: "User successfully deleted"}
				"401": #ErrorModel
				"403": #ErrorModel
				"404": #ErrorModel
				"409": #ErrorModel  // Cannot delete (has dependencies)
				"500": #ErrorModel
			}
		}
		
		// Health check endpoint
		health: {
			method:      "GET"
			path:        "/health"
			description: "Health check endpoint for monitoring"
			auth:        "none"
			tags: ["System"]
			
			response: {
				contentType: "application/json"
				"200":       #HealthModel
				"503": {
					type: "object"
					properties: {
						status: {type: "string", enum: ["unhealthy"]}
						timestamp: {type: "string", format: "datetime"}
						message: {type: "string"}
					}
					required: ["status", "timestamp"]
				}
			}
			
			testing: {
				enabled: true
			}
		}
		
		// API documentation endpoint
		openapi: {
			method:      "GET"
			path:        "/api/v1/openapi.json"
			description: "OpenAPI specification"
			auth:        "none"
			tags: ["System"]
			
			response: {
				contentType: "application/json"
				"200": {
					type:        "object"
					description: "OpenAPI 3.1 specification"
				}
			}
		}
	}
	
	// Environment-specific overrides
	environments: {
		development: {
			baseURL: "http://localhost:3001"
			security: {
				defaultAuth: "none"  // No auth required in dev
			}
			globalRateLimit: {
				requestsPerMinute: 10000  // Higher limits for dev
				concurrent:        100
			}
		}
		
		staging: {
			baseURL: "https://api-staging.users.example.com"
			globalRateLimit: {
				requestsPerMinute: 500    // Lower limits for staging
				concurrent:        25
			}
		}
		
		production: {
			// Use default values from main config
		}
	}
}