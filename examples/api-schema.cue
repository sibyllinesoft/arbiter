// API Schema Definition for Arbiter Validation Example
// This demonstrates a comprehensive API specification schema

package api

#APISpec: {
	// Metadata
	version: string & =~"^[0-9]+\\.[0-9]+\\.[0-9]+$"
	name:    string & len >1 & len <=100
	baseURL: string & =~"^https?://"
	
	// Global configuration
	globalRateLimit?: #RateLimit
	
	// Security configuration
	security?: {
		defaultAuth: "none" | "apiKey" | "bearer" | "oauth2"
		apiKeys?: [...string]
		oauth2?: {
			authURL:  string & =~"^https://"
			tokenURL: string & =~"^https://"
			scopes: [string]: string
		}
	}
	
	// Endpoint definitions
	endpoints: [string]: #Endpoint
	
	// Data models
	models?: [string]: #Model
	
	// Environment-specific overrides
	environments?: [string]: {
		baseURL?: string & =~"^https?://"
		security?: {
			defaultAuth: "none" | "apiKey" | "bearer" | "oauth2"
		}
		globalRateLimit?: #RateLimit
	}
}

// Rate limiting configuration
#RateLimit: {
	requestsPerMinute: int & >0 & <=50000
	concurrent?:       int & >0 & <=1000
	burst?:           int & >0 & <=10000
}

// HTTP endpoint definition
#Endpoint: {
	method:      "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
	path:        string & =~"^/"
	description?: string
	
	// Authentication requirements
	auth: "required" | "optional" | "none"
	
	// Rate limiting (overrides global)
	rateLimit?: #RateLimit
	
	// Request specification
	request?: {
		contentType?: string | *"application/json"
		headers?: [string]: string | bool
		queryParams?: [string]: {
			type:        "string" | "int" | "float" | "bool"
			required:    bool | *false
			description?: string
			example?:    _
		}
		pathParams?: [string]: {
			type:        "string" | "int" | "uuid"
			description?: string
			pattern?:    string
		}
		body?: #Model | {...}
	}
	
	// Response specification
	response: {
		contentType: string | *"application/json"
		headers?: [string]: string
		// Status code responses
		"200"?: #Model | {...}
		"201"?: #Model | {...}  
		"400"?: #ErrorModel
		"401"?: #ErrorModel
		"403"?: #ErrorModel
		"404"?: #ErrorModel
		"429"?: #ErrorModel
		"500"?: #ErrorModel
	}
	
	// OpenAPI extensions
	tags?: [...string]
	deprecated?: bool | *false
	
	// Testing configuration
	testing?: {
		enabled: bool | *true
		fixtures?: [...]
		skipReasons?: [...string]
	}
}

// Data model definition
#Model: {
	type: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null"
	
	// Object properties
	if type == "object" {
		properties: [string]: #Model | {...}
		required?: [...string]
		additionalProperties?: bool | #Model
	}
	
	// Array items
	if type == "array" {
		items: #Model | {...}
		minItems?: int & >=0
		maxItems?: int & >=0
	}
	
	// String constraints
	if type == "string" {
		minLength?: int & >=0
		maxLength?: int & >=0
		pattern?:   string
		format?:    "date" | "datetime" | "email" | "uri" | "uuid" | "hostname"
		enum?:     [...string]
	}
	
	// Number constraints
	if type == "number" || type == "integer" {
		minimum?:          number
		maximum?:          number
		exclusiveMinimum?: number
		exclusiveMaximum?: number
		multipleOf?:       number & >0
		enum?:            [...number]
	}
	
	// Common fields
	description?: string
	example?:     _
	default?:     _
	nullable?:    bool | *false
	readonly?:    bool | *false
	writeonly?:   bool | *false
	
	// Validation
	// Ensure that if properties is defined, type must be object
	if properties != _|_ {
		type: "object"
	}
	if items != _|_ {
		type: "array"
	}
}

// Standard error model
#ErrorModel: #Model & {
	type: "object"
	properties: {
		error: {
			type: "object"
			properties: {
				code:    {type: "string", description: "Error code"}
				message: {type: "string", description: "Human readable error message"}
				details: {description: "Additional error details", nullable: true}
				timestamp: {type: "string", format: "datetime", description: "When the error occurred"}
				requestId: {type: "string", description: "Request ID for tracking"}
			}
			required: ["code", "message", "timestamp"]
		}
	}
	required: ["error"]
}

// Pagination model for list endpoints
#PaginationModel: #Model & {
	type: "object"
	properties: {
		pagination: {
			type: "object"
			properties: {
				page:     {type: "integer", minimum: 1, description: "Current page number"}
				limit:    {type: "integer", minimum: 1, maximum: 100, description: "Items per page"}
				total:    {type: "integer", minimum: 0, description: "Total number of items"}
				pages:    {type: "integer", minimum: 0, description: "Total number of pages"}
				hasNext:  {type: "boolean", description: "Whether there are more pages"}
				hasPrev:  {type: "boolean", description: "Whether there are previous pages"}
				nextPage: {type: "integer", nullable: true, description: "Next page number"}
				prevPage: {type: "integer", nullable: true, description: "Previous page number"}
			}
			required: ["page", "limit", "total", "pages", "hasNext", "hasPrev"]
		}
	}
	required: ["pagination"]
}

// Health check model
#HealthModel: #Model & {
	type: "object"
	properties: {
		status: {
			type: "string"
			enum: ["healthy", "degraded", "unhealthy"]
			description: "Overall system health status"
		}
		timestamp: {
			type: "string"
			format: "datetime"
			description: "Timestamp of health check"
		}
		version: {
			type: "string"
			description: "API version"
		}
		checks: {
			type: "object"
			properties: {
				database: #ComponentHealth
				redis:    #ComponentHealth
				storage:  #ComponentHealth
			}
			additionalProperties: #ComponentHealth
		}
	}
	required: ["status", "timestamp", "version"]
}

#ComponentHealth: #Model & {
	type: "object"
	properties: {
		status: {
			type: "string"
			enum: ["healthy", "degraded", "unhealthy"]
		}
		responseTime: {
			type: "number"
			description: "Response time in milliseconds"
		}
		message: {
			type: "string"
			nullable: true
			description: "Additional status information"
		}
	}
	required: ["status"]
}