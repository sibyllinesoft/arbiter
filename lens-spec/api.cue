package lens

import (
	"time"
	"net/http"
)

// APIServer defines the HTTP API server configuration
#APIServer: {
	// Server configuration
	server: #ServerConfig
	
	// API endpoints and their specifications
	endpoints: #APIEndpoints
	
	// Request/response handling
	handling: #RequestHandling
	
	// NDJSON streaming configuration
	streaming: #StreamingConfig
	
	// Authentication and authorization
	security: #APISecurity
	
	// Rate limiting and throttling
	rate_limiting: #RateLimiting
}

// ServerConfig defines HTTP server settings
#ServerConfig: {
	// Network configuration
	network: {
		host: string | *"0.0.0.0"
		port: int & >=1024 & <=65535 | *8080
		
		// TLS configuration
		tls: {
			enabled: bool | *false
			cert_file: string | *""
			key_file: string | *""
			
			// TLS version constraints
			min_version: "1.2" | "1.3" | *"1.2"
			max_version: "1.2" | "1.3" | *"1.3"
		}
	}
	
	// Server behavior
	behavior: {
		// Timeouts
		read_timeout: time.Duration & >=1*time.Second & <=60*time.Second | *30*time.Second
		write_timeout: time.Duration & >=1*time.Second & <=60*time.Second | *30*time.Second
		idle_timeout: time.Duration & >=1*time.Second & <=300*time.Second | *120*time.Second
		
		// Request size limits
		max_header_bytes: int & >=4096 & <=1048576 | *65536      // 64KB
		max_request_size: int & >=1024 & <=104857600 | *10485760 // 10MB
		
		// Connection limits
		max_connections: int & >=10 & <=10000 | *1000
		
		// Graceful shutdown
		shutdown_timeout: time.Duration & >=5*time.Second & <=300*time.Second | *30*time.Second
	}
	
	// Middleware configuration
	middleware: {
		// CORS configuration
		cors: {
			enabled: bool | *true
			allowed_origins: [...string] | *["*"] // Restrict in production
			allowed_methods: [...string] | *["GET", "POST", "OPTIONS"]
			allowed_headers: [...string] | *["Content-Type", "Authorization", "X-Request-ID"]
			max_age: time.Duration & >=0*time.Second & <=86400*time.Second | *3600*time.Second
		}
		
		// Compression
		compression: {
			enabled: bool | *true
			algorithms: [...string] | *["gzip", "deflate"]
			min_size: int & >=100 & <=10000 | *1024 // Compress responses >1KB
		}
		
		// Request logging
		logging: {
			enabled: bool | *true
			format: "json" | "text" | *"json"
			include_request_body: bool | *false
			include_response_body: bool | *false
			max_body_size: int & >=0 & <=10000 | *1000
		}
	}
}

// APIEndpoints defines the API surface with strict contracts
#APIEndpoints: {
	// Primary search endpoint
	search: #SearchEndpoint & {
		path: "/search"
		method: "GET" | "POST"
		
		// Performance requirements
		performance: {
			target_latency_p95: <=20*time.Millisecond // From performance.cue requirements
			timeout: 30*time.Millisecond
			max_concurrent_requests: int & >=50 & <=1000 | *200
		}
	}
	
	// Structured search endpoint
	struct: #StructEndpoint & {
		path: "/struct"
		method: "GET" | "POST"
		
		// Performance requirements (more lenient for structured search)
		performance: {
			target_latency_p95: <=50*time.Millisecond
			timeout: 100*time.Millisecond
			max_concurrent_requests: int & >=20 & <=500 | *100
		}
	}
	
	// Symbol proximity search
	symbols_near: #SymbolsNearEndpoint & {
		path: "/symbols/near"
		method: "GET" | "POST"
		
		// Performance requirements
		performance: {
			target_latency_p95: <=30*time.Millisecond
			timeout: 60*time.Millisecond
			max_concurrent_requests: int & >=30 & <=500 | *150
		}
	}
	
	// Semantic rerank endpoint
	rerank: #RerankEndpoint & {
		path: "/rerank"
		method: "POST"
		
		// Performance requirements (most expensive operation)
		performance: {
			target_latency_p95: <=100*time.Millisecond
			timeout: 200*time.Millisecond
			max_concurrent_requests: int & >=10 & <=100 | *50
		}
	}
	
	// Health check endpoint
	health: #HealthEndpoint & {
		path: "/health"
		method: "GET"
		
		// Health checks must be very fast
		performance: {
			target_latency_p95: <=5*time.Millisecond
			timeout: 10*time.Millisecond
			max_concurrent_requests: int & >=100 & <=1000 | *500
		}
	}
	
	// Metrics endpoint (for monitoring)
	metrics: #MetricsEndpoint & {
		path: "/metrics"
		method: "GET"
		
		// Metrics collection should be fast
		performance: {
			target_latency_p95: <=10*time.Millisecond
			timeout: 30*time.Millisecond
			max_concurrent_requests: int & >=20 & <=200 | *100
		}
	}
}

// SearchEndpoint defines the primary search API
#SearchEndpoint: #BaseEndpoint & {
	// Request parameters
	parameters: {
		// Query parameters (for GET requests)
		query_params: {
			q: {
				type:        "string"
				required:    true
				description: "Search query string"
				min_length:  1
				max_length:  500
				pattern:     "^.{1,500}$" // Any characters, 1-500 length
			}
			
			// Search scope filters
			repos: {
				type:        "array[string]"
				required:    false
				description: "Repository names to search within"
				max_items:   100
			}
			
			paths: {
				type:        "array[string]"
				required:    false
				description: "File path patterns to include/exclude"
				max_items:   50
			}
			
			languages: {
				type:        "array[string]"
				required:    false
				description: "Programming languages to filter by"
				max_items:   20
				enum:        ["typescript", "javascript", "python", "go", "rust", "java", "c", "cpp", "c#", "php", "ruby", "swift", "kotlin"]
			}
			
			// Result configuration
			limit: {
				type:        "integer"
				required:    false
				description: "Maximum number of results to return"
				default:     50
				minimum:     1
				maximum:     1000
			}
			
			offset: {
				type:        "integer"
				required:    false
				description: "Result offset for pagination"
				default:     0
				minimum:     0
				maximum:     10000
			}
			
			// Search behavior modifiers
			fuzzy: {
				type:        "boolean"
				required:    false
				description: "Enable fuzzy matching"
				default:     true
			}
			
			case_sensitive: {
				type:        "boolean"
				required:    false
				description: "Enable case-sensitive search"
				default:     false
			}
			
			// Pipeline control
			stages: {
				type:        "array[string]"
				required:    false
				description: "Pipeline stages to enable"
				default:     ["lexical", "symbol", "semantic"]
				enum:        ["lexical", "symbol", "semantic"]
				max_items:   3
			}
		}
		
		// POST request body (JSON)
		request_body: {
			type: "object"
			properties: {
				// All query_params are also available in request body
				query: {
					type:        "string"
					required:    true
					min_length:  1
					max_length:  500
				}
				
				// Advanced filters
				filters: {
					type:     "object"
					required: false
					properties: {
						file_types: {
							type:      "array"
							items:     {type: "string"}
							max_items: 50
						}
						
						date_range: {
							type: "object"
							properties: {
								from: {type: "string", format: "date-time"}
								to:   {type: "string", format: "date-time"}
							}
						}
						
						size_range: {
							type: "object"
							properties: {
								min_bytes: {type: "integer", minimum: 0}
								max_bytes: {type: "integer", minimum: 0}
							}
						}
					}
				}
				
				// Search configuration
				config: {
					type:     "object"
					required: false
					properties: {
						timeout_ms: {
							type:    "integer"
							minimum: 1
							maximum: 30000
							default: 10000
						}
						
						explain: {
							type:        "boolean"
							description: "Include search explanation in results"
							default:     false
						}
						
						highlight: {
							type:        "boolean"
							description: "Include highlighted snippets"
							default:     true
						}
					}
				}
			}
		}
	}
	
	// Response format
	responses: {
		"200": #SearchResponse
		"400": #ErrorResponse & {error_code: "INVALID_REQUEST"}
		"429": #ErrorResponse & {error_code: "RATE_LIMITED"}
		"500": #ErrorResponse & {error_code: "INTERNAL_ERROR"}
		"503": #ErrorResponse & {error_code: "SERVICE_UNAVAILABLE"}
	}
}

// StructEndpoint defines structured search API
#StructEndpoint: #BaseEndpoint & {
	// Parameters for structured search
	parameters: {
		query_params: {
			// Structure type to search
			type: {
				type:        "string"
				required:    true
				description: "Structure type to search for"
				enum:        ["function", "class", "method", "variable", "interface", "type", "namespace"]
			}
			
			// Structure name pattern
			name: {
				type:        "string"
				required:    false
				description: "Name pattern to match"
				max_length:  200
			}
			
			// Scope filtering
			scope: {
				type:        "string"
				required:    false
				description: "Scope to search within"
				enum:        ["public", "private", "protected", "internal", "all"]
				default:     "all"
			}
			
			// Common parameters from search endpoint
			repos:     #SearchEndpoint.parameters.query_params.repos
			languages: #SearchEndpoint.parameters.query_params.languages
			limit:     #SearchEndpoint.parameters.query_params.limit
			offset:    #SearchEndpoint.parameters.query_params.offset
		}
	}
	
	// Response format for structured search
	responses: {
		"200": #StructResponse
		"400": #ErrorResponse & {error_code: "INVALID_STRUCTURE_QUERY"}
		"429": #ErrorResponse & {error_code: "RATE_LIMITED"}
		"500": #ErrorResponse & {error_code: "INTERNAL_ERROR"}
	}
}

// SymbolsNearEndpoint defines symbol proximity search
#SymbolsNearEndpoint: #BaseEndpoint & {
	parameters: {
		query_params: {
			// Reference symbol
			symbol: {
				type:        "string"
				required:    true
				description: "Symbol to find neighbors for"
				max_length:  300
			}
			
			// Proximity distance
			distance: {
				type:        "integer"
				required:    false
				description: "Maximum distance in lines"
				default:     10
				minimum:     1
				maximum:     1000
			}
			
			// Relationship types
			relationships: {
				type:        "array[string]"
				required:    false
				description: "Types of relationships to include"
				default:     ["calls", "references", "defines"]
				enum:        ["calls", "references", "defines", "inherits", "implements", "imports"]
				max_items:   6
			}
			
			// Common parameters
			repos:  #SearchEndpoint.parameters.query_params.repos
			limit:  #SearchEndpoint.parameters.query_params.limit
			offset: #SearchEndpoint.parameters.query_params.offset
		}
	}
	
	responses: {
		"200": #SymbolsNearResponse
		"400": #ErrorResponse & {error_code: "INVALID_SYMBOL_QUERY"}
		"404": #ErrorResponse & {error_code: "SYMBOL_NOT_FOUND"}
		"429": #ErrorResponse & {error_code: "RATE_LIMITED"}
		"500": #ErrorResponse & {error_code: "INTERNAL_ERROR"}
	}
}

// RerankEndpoint defines semantic reranking API
#RerankEndpoint: #BaseEndpoint & {
	parameters: {
		// Only supports POST with request body
		request_body: {
			type:     "object"
			required: true
			properties: {
				query: {
					type:        "string"
					required:    true
					description: "Query for semantic reranking"
					min_length:  1
					max_length:  500
				}
				
				documents: {
					type:        "array"
					required:    true
					description: "Documents to rerank"
					min_items:   1
					max_items:   200
					items: {
						type: "object"
						properties: {
							id: {
								type:        "string"
								required:    true
								description: "Document identifier"
								max_length:  200
							}
							
							content: {
								type:        "string"
								required:    true
								description: "Document content"
								max_length:  10000
							}
							
							metadata: {
								type:        "object"
								required:    false
								description: "Additional document metadata"
							}
						}
					}
				}
				
				config: {
					type:     "object"
					required: false
					properties: {
						model: {
							type:        "string"
							description: "Reranking model to use"
							enum:        ["colbert_v2", "splade"]
							default:     "colbert_v2"
						}
						
						top_k: {
							type:        "integer"
							description: "Number of top results to return"
							minimum:     1
							maximum:     200
							default:     50
						}
						
						explain: {
							type:        "boolean"
							description: "Include ranking explanations"
							default:     false
						}
					}
				}
			}
		}
	}
	
	responses: {
		"200": #RerankResponse
		"400": #ErrorResponse & {error_code: "INVALID_RERANK_REQUEST"}
		"413": #ErrorResponse & {error_code: "REQUEST_TOO_LARGE"}
		"429": #ErrorResponse & {error_code: "RATE_LIMITED"}
		"500": #ErrorResponse & {error_code: "INTERNAL_ERROR"}
	}
}

// HealthEndpoint defines health check API
#HealthEndpoint: #BaseEndpoint & {
	parameters: {
		query_params: {
			// Optional detailed health check
			detailed: {
				type:        "boolean"
				required:    false
				description: "Include detailed health information"
				default:     false
			}
		}
	}
	
	responses: {
		"200": #HealthResponse
		"503": #ErrorResponse & {error_code: "SERVICE_UNHEALTHY"}
	}
}

// MetricsEndpoint defines metrics collection API  
#MetricsEndpoint: #BaseEndpoint & {
	parameters: {
		query_params: {
			// Metrics format
			format: {
				type:        "string"
				required:    false
				description: "Metrics output format"
				enum:        ["prometheus", "json"]
				default:     "prometheus"
			}
		}
	}
	
	responses: {
		"200": #MetricsResponse
		"500": #ErrorResponse & {error_code: "METRICS_UNAVAILABLE"}
	}
}

// Base endpoint definition with common fields
#BaseEndpoint: {
	path:   string
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS"
	
	// Performance requirements
	performance: {
		target_latency_p95:        time.Duration
		timeout:                   time.Duration
		max_concurrent_requests:   int
	}
	
	// Common headers
	headers: {
		request: {
			"Content-Type":   string | *"application/json"
			"Accept":         string | *"application/json"
			"User-Agent":     string | *""
			"X-Request-ID":   string | *""
			"Authorization":  string | *""
		}
		
		response: {
			"Content-Type":      string | *"application/json"
			"X-Request-ID":      string
			"X-Response-Time":   string
			"Cache-Control":     string | *"no-cache"
		}
	}
	
	// Parameter and response definitions
	parameters: _
	responses:  _
}

// Response type definitions
#SearchResponse: {
	type: "object"
	properties: {
		// Response metadata
		metadata: {
			type: "object"
			properties: {
				query:          {type: "string"}
				total_results:  {type: "integer", minimum: 0}
				returned_count: {type: "integer", minimum: 0}
				search_time_ms: {type: "number", minimum: 0}
				stages_used:    {type: "array", items: {type: "string"}}
				
				// Pipeline stage timings
				stage_timings: {
					type: "object"
					properties: {
						lexical_ms:  {type: "number", minimum: 0}
						symbol_ms:   {type: "number", minimum: 0}
						semantic_ms: {type: "number", minimum: 0}
						total_ms:    {type: "number", minimum: 0}
					}
				}
				
				// Cache information
				cache_info: {
					type: "object"
					properties: {
						hit:  {type: "boolean"}
						key:  {type: "string"}
						ttl:  {type: "integer"}
					}
				}
			}
		}
		
		// Search results
		results: {
			type: "array"
			items: #SearchResult
		}
		
		// Facets and aggregations
		facets: {
			type: "object"
			properties: {
				languages:   {type: "object"} // Language distribution
				repositories: {type: "object"} // Repository distribution
				file_types:  {type: "object"} // File type distribution
			}
		}
	}
}

#SearchResult: {
	type: "object"
	properties: {
		// Result identification
		id:       {type: "string"}
		type:     {type: "string", enum: ["file", "symbol", "content"]}
		
		// Content information
		content: {
			type: "object"
			properties: {
				text:      {type: "string"}
				language:  {type: "string"}
				file_path: {type: "string"}
				
				// Highlighted snippets
				highlights: {
					type: "array"
					items: {
						type: "object"
						properties: {
							text:       {type: "string"}
							start_line: {type: "integer"}
							end_line:   {type: "integer"}
							score:      {type: "number"}
						}
					}
				}
			}
		}
		
		// Scoring information
		scoring: {
			type: "object"
			properties: {
				overall_score:  {type: "number", minimum: 0, maximum: 1}
				lexical_score:  {type: "number", minimum: 0, maximum: 1}
				symbol_score:   {type: "number", minimum: 0, maximum: 1}
				semantic_score: {type: "number", minimum: 0, maximum: 1}
				
				// Ranking explanation (optional)
				explanation: {
					type: "object"
					properties: {
						factors: {type: "array", items: {type: "string"}}
						weights: {type: "object"}
					}
				}
			}
		}
		
		// Context and metadata
		context: {
			type: "object"
			properties: {
				repository:    {type: "string"}
				branch:        {type: "string"}
				commit_hash:   {type: "string"}
				last_modified: {type: "string", format: "date-time"}
				file_size:     {type: "integer"}
				
				// Symbol-specific context
				symbol_info: {
					type: "object"
					properties: {
						name:      {type: "string"}
						kind:      {type: "string"}
						scope:     {type: "string"}
						signature: {type: "string"}
					}
				}
			}
		}
	}
}

#StructResponse: {
	// Similar structure to SearchResponse but focused on structured results
	type: "object"
	properties: {
		metadata: {
			type: "object"
			properties: {
				structure_type:  {type: "string"}
				total_results:   {type: "integer"}
				returned_count:  {type: "integer"}
				search_time_ms:  {type: "number"}
			}
		}
		
		results: {
			type: "array"
			items: {
				type: "object"
				properties: {
					name:       {type: "string"}
					kind:       {type: "string"}
					scope:      {type: "string"}
					signature:  {type: "string"}
					location:   {
						type: "object"
						properties: {
							file_path:   {type: "string"}
							line_start:  {type: "integer"}
							line_end:    {type: "integer"}
							column_start: {type: "integer"}
							column_end:  {type: "integer"}
						}
					}
					context: {
						type: "object"
						properties: {
							repository: {type: "string"}
							language:   {type: "string"}
						}
					}
				}
			}
		}
	}
}

#SymbolsNearResponse: {
	type: "object"
	properties: {
		metadata: {
			type: "object"
			properties: {
				anchor_symbol:   {type: "string"}
				search_distance: {type: "integer"}
				total_results:   {type: "integer"}
				search_time_ms:  {type: "number"}
			}
		}
		
		results: {
			type: "array"
			items: {
				type: "object"
				properties: {
					symbol:       {type: "string"}
					relationship: {type: "string"}
					distance:     {type: "integer"}
					confidence:   {type: "number"}
					location:     #StructResponse.properties.results.items.properties.location
					context:      #StructResponse.properties.results.items.properties.context
				}
			}
		}
	}
}

#RerankResponse: {
	type: "object"
	properties: {
		metadata: {
			type: "object"
			properties: {
				model_used:      {type: "string"}
				total_documents: {type: "integer"}
				rerank_time_ms:  {type: "number"}
			}
		}
		
		results: {
			type: "array"
			items: {
				type: "object"
				properties: {
					id:              {type: "string"}
					relevance_score: {type: "number", minimum: 0, maximum: 1}
					rank:            {type: "integer", minimum: 1}
					
					// Optional explanation
					explanation: {
						type: "object"
						properties: {
							similarity_score: {type: "number"}
							key_terms:       {type: "array", items: {type: "string"}}
							confidence:      {type: "number"}
						}
					}
				}
			}
		}
	}
}

#HealthResponse: {
	type: "object"
	properties: {
		status: {type: "string", enum: ["healthy", "degraded", "unhealthy"]}
		
		// Detailed health information (if requested)
		details: {
			type: "object"
			properties: {
				uptime_seconds:    {type: "number"}
				version:          {type: "string"}
				
				// Component health
				components: {
					type: "object"
					properties: {
						pipeline:  {type: "string", enum: ["healthy", "degraded", "unhealthy"]}
						storage:   {type: "string", enum: ["healthy", "degraded", "unhealthy"]}
						messaging: {type: "string", enum: ["healthy", "degraded", "unhealthy"]}
						caching:   {type: "string", enum: ["healthy", "degraded", "unhealthy"]}
					}
				}
				
				// Performance metrics
				metrics: {
					type: "object"
					properties: {
						avg_response_time_ms: {type: "number"}
						requests_per_second:  {type: "number"}
						error_rate:          {type: "number"}
						cache_hit_rate:      {type: "number"}
					}
				}
			}
		}
	}
}

#MetricsResponse: {
	// Prometheus format or JSON format based on request
	oneOf: [
		{
			type: "string"
			description: "Prometheus metrics format"
		},
		{
			type: "object"
			description: "JSON metrics format"
			properties: {
				timestamp: {type: "string", format: "date-time"}
				metrics: {type: "object"}
			}
		}
	]
}

#ErrorResponse: {
	type: "object"
	properties: {
		error: {
			type: "object"
			properties: {
				code:        {type: "string"}
				message:     {type: "string"}
				details:     {type: "object"}
				request_id:  {type: "string"}
				timestamp:   {type: "string", format: "date-time"}
			}
		}
	}
	
	// Error codes must be from predefined set
	error_code: "INVALID_REQUEST" | "INVALID_STRUCTURE_QUERY" | "INVALID_SYMBOL_QUERY" | 
	           "INVALID_RERANK_REQUEST" | "SYMBOL_NOT_FOUND" | "REQUEST_TOO_LARGE" | 
	           "RATE_LIMITED" | "SERVICE_UNAVAILABLE" | "SERVICE_UNHEALTHY" | 
	           "INTERNAL_ERROR" | "METRICS_UNAVAILABLE"
}

// RequestHandling defines request processing configuration
#RequestHandling: {
	// Request validation
	validation: {
		enabled: bool | *true
		
		// Validation levels
		strict_mode: bool | *true // Reject unknown parameters
		
		// Parameter validation
		parameter_validation: {
			enabled: bool | *true
			
			// String validation
			string_validation: {
				trim_whitespace: bool | *true
				normalize_unicode: bool | *true
				max_length_enforcement: bool | *true
			}
			
			// Numeric validation
			numeric_validation: {
				range_enforcement: bool | *true
				type_coercion: bool | *false // Strict typing
			}
		}
		
		// Content validation
		content_validation: {
			enabled: bool | *true
			
			// JSON validation
			json_validation: {
				strict_parsing: bool | *true
				max_depth: int & >=5 & <=20 | *10
				max_keys: int & >=10 & <=1000 | *100
			}
			
			// Content-Type enforcement
			content_type_enforcement: bool | *true
		}
	}
	
	// Request processing
	processing: {
		// Request preprocessing
		preprocessing: {
			enabled: bool | *true
			
			// Query normalization
			query_normalization: {
				enabled: bool | *true
				lowercase: bool | *false // Preserve case by default
				trim_whitespace: bool | *true
				normalize_unicode: bool | *true
				remove_stop_words: bool | *false // Keep all terms by default
			}
			
			// Parameter defaults
			apply_defaults: bool | *true
		}
		
		// Concurrent request handling
		concurrency: {
			// Per-endpoint concurrency limits (defined in endpoint specs)
			enforce_limits: bool | *true
			
			// Queue configuration for overflow
			queue_overflow: {
				enabled: bool | *true
				max_queue_size: int & >=10 & <=1000 | *100
				queue_timeout: time.Duration & >=100*time.Millisecond & <=10*time.Second | *1*time.Second
			}
			
			// Load shedding
			load_shedding: {
				enabled: bool | *true
				cpu_threshold: number & >=0.7 & <=0.95 | *0.85
				memory_threshold: number & >=0.7 & <=0.95 | *0.80
				response_time_threshold: time.Duration & >=50*time.Millisecond & <=1*time.Second | *200*time.Millisecond
			}
		}
	}
	
	// Response handling
	response: {
		// Response formatting
		formatting: {
			enabled: bool | *true
			
			// JSON formatting
			json_formatting: {
				pretty_print: bool | *false // Compact JSON for production
				include_nulls: bool | *false // Omit null values
				float_precision: int & >=2 & <=10 | *6
			}
			
			// Header management
			headers: {
				// Security headers
				security_headers: {
					enabled: bool | *true
					include_x_content_type_options: bool | *true
					include_x_frame_options: bool | *true
					include_x_xss_protection: bool | *true
				}
				
				// Performance headers
				performance_headers: {
					include_response_time: bool | *true
					include_cache_info: bool | *true
				}
			}
		}
		
		// Error handling
		error_handling: {
			// Error response standardization
			standardize_errors: bool | *true
			
			// Error details in responses
			include_stack_traces: bool | *false // Security: don't expose internals
			include_error_ids: bool | *true
			include_timestamps: bool | *true
			
			// Error logging
			log_errors: bool | *true
			log_level: "error" | "warn" | "info" | *"error"
		}
	}
}

// StreamingConfig defines NDJSON streaming configuration
#StreamingConfig: {
	// Streaming capability
	enabled: bool | *true
	
	// Stream configuration
	stream_config: {
		// Buffer configuration
		buffer_size: int & >=1024 & <=1048576 | *65536 // 64KB buffer
		flush_interval: time.Duration & >=1*time.Millisecond & <=1*time.Second | *10*time.Millisecond
		
		// Backpressure handling
		backpressure: {
			enabled: bool | *true
			max_buffered_items: int & >=10 & <=10000 | *1000
			drop_policy: "drop_oldest" | "drop_newest" | "block" | *"drop_oldest"
		}
		
		// Client connection management
		connection_management: {
			// Detect client disconnection
			detect_disconnect: bool | *true
			disconnect_timeout: time.Duration & >=1*time.Second & <=30*time.Second | *10*time.Second
			
			// Keep-alive for long streams
			keepalive: {
				enabled: bool | *true
				interval: time.Duration & >=10*time.Second & <=300*time.Second | *30*time.Second
			}
		}
	}
	
	// NDJSON format configuration
	ndjson: {
		// Line format validation
		validate_json: bool | *true
		compact_json: bool | *true // No pretty printing for streams
		
		// Stream metadata
		include_metadata: bool | *true
		metadata_prefix: string | *"_meta"
		
		// Error handling in streams
		error_handling: {
			// How to handle errors mid-stream
			on_error: "terminate" | "skip_item" | "include_error" | *"include_error"
			
			// Error format in stream
			error_format: {
				type: "error"
				properties: {
					error: {type: "string"}
					timestamp: {type: "string"}
					item_index: {type: "integer"}
				}
			}
		}
		
		// Stream termination
		termination: {
			// End-of-stream marker
			include_end_marker: bool | *true
			end_marker_format: {
				type: "end"
				properties: {
					total_items: {type: "integer"}
					stream_time_ms: {type: "number"}
					timestamp: {type: "string"}
				}
			}
		}
	}
	
	// Streaming performance
	performance: {
		// Throughput targets
		target_items_per_second: int & >=100 & <=100000 | *5000
		
		// Latency targets (first item)
		first_item_latency: time.Duration & <=50*time.Millisecond | *20*time.Millisecond
		
		// Memory usage limits
		max_memory_per_stream: int & >0 & <=100*1024*1024 | *10*1024*1024 // 10MB per stream
	}
}

// APISecurity defines authentication and authorization
#APISecurity: {
	// Authentication configuration
	authentication: {
		enabled: bool | *false // Disabled by default for local service
		
		// Authentication methods
		methods: {
			// API key authentication
			api_key: {
				enabled: bool | *false
				header_name: string | *"X-API-Key"
				query_param_name: string | *"api_key"
				
				// Key validation
				key_format: "uuid" | "base64" | "hex" | "custom" | *"uuid"
				min_key_length: int & >=16 & <=256 | *32
			}
			
			// JWT token authentication
			jwt: {
				enabled: bool | *false
				header_name: string | *"Authorization"
				token_prefix: string | *"Bearer "
				
				// JWT validation
				secret_key: string | *""
				algorithm: "HS256" | "RS256" | "ES256" | *"HS256"
				expiry_validation: bool | *true
			}
			
			// mTLS (mutual TLS)
			mtls: {
				enabled: bool | *false
				require_client_cert: bool | *true
				ca_cert_path: string | *""
			}
		}
	}
	
	// Authorization configuration
	authorization: {
		enabled: bool | *false
		
		// Role-based access control
		rbac: {
			enabled: bool | *false
			
			// Default roles
			roles: {
				admin: {
					permissions: ["*"]
					description: "Full access to all endpoints"
				}
				
				reader: {
					permissions: ["search:read", "struct:read", "symbols:read", "health:read", "metrics:read"]
					description: "Read-only access"
				}
				
				indexer: {
					permissions: ["search:read", "struct:read", "rerank:write", "health:read"]
					description: "Search and reranking access"
				}
			}
			
			// Permission format: "endpoint:action"
			permission_format: string | *"^[a-z_]+:(read|write|admin)$"
		}
		
		// IP-based access control
		ip_whitelist: {
			enabled: bool | *false
			allowed_ips: [...string] | *[]
			allowed_networks: [...string] | *[] // CIDR notation
		}
	}
}

// RateLimiting defines request throttling
#RateLimiting: {
	// Global rate limiting
	global: {
		enabled: bool | *true
		
		// Rate limiting strategy
		strategy: "fixed_window" | "sliding_window" | "token_bucket" | "leaky_bucket" | *"token_bucket"
		
		// Rate limits
		requests_per_second: int & >=1 & <=10000 | *1000
		burst_size: int & >=1 & <=1000 | *100
		
		// Time windows
		window_size: time.Duration & >=1*time.Second & <=1*time.Hour | *1*time.Minute
	}
	
	// Per-endpoint rate limiting (overrides global)
	per_endpoint: {
		enabled: bool | *true
		
		// Endpoint-specific limits
		endpoints: {
			"/search": {
				requests_per_second: int & >=100 & <=5000 | *500
				burst_size: int & >=10 & <=500 | *50
			}
			
			"/struct": {
				requests_per_second: int & >=50 & <=1000 | *200
				burst_size: int & >=5 & <=100 | *20
			}
			
			"/symbols/near": {
				requests_per_second: int & >=50 & <=1000 | *150
				burst_size: int & >=5 & <=100 | *15
			}
			
			"/rerank": {
				requests_per_second: int & >=10 & <=200 | *50
				burst_size: int & >=1 & <=50 | *10
			}
			
			"/health": {
				requests_per_second: int & >=100 & <=2000 | *1000
				burst_size: int & >=10 & <=200 | *100
			}
			
			"/metrics": {
				requests_per_second: int & >=10 & <=500 | *100
				burst_size: int & >=1 & <=50 | *10
			}
		}
	}
	
	// Per-client rate limiting
	per_client: {
		enabled: bool | *true
		
		// Client identification
		identification: "ip" | "api_key" | "jwt_subject" | "header" | *"ip"
		
		// Client-specific limits
		default_limits: {
			requests_per_second: int & >=10 & <=1000 | *100
			burst_size: int & >=1 & <=100 | *10
		}
		
		// Premium client limits
		premium_limits: {
			requests_per_second: int & >=100 & <=5000 | *1000
			burst_size: int & >=10 & <=500 | *100
		}
	}
	
	// Rate limit storage
	storage: {
		backend: "memory" | "redis" | "memcached" | *"memory"
		
		// Storage configuration
		config: {
			// Memory backend
			if backend == "memory" {
				max_clients: int & >=100 & <=100000 | *10000
				cleanup_interval: time.Duration & >=1*time.Minute & <=1*time.Hour | *5*time.Minute
			}
			
			// Redis backend
			if backend == "redis" {
				redis_url: string | *"redis://localhost:6379"
				key_prefix: string | *"lens:ratelimit:"
				expiry_time: time.Duration & >=1*time.Minute & <=1*time.Hour | *10*time.Minute
			}
		}
	}
	
	// Rate limit exceeded responses
	exceeded_response: {
		// HTTP status code
		status_code: 429
		
		// Response headers
		headers: {
			"X-RateLimit-Limit":     string
			"X-RateLimit-Remaining": string
			"X-RateLimit-Reset":     string
			"Retry-After":           string
		}
		
		// Response body
		body: #ErrorResponse & {
			error_code: "RATE_LIMITED"
		}
	}
}

// API validation constraints
#APIServer: {
	// Ensure performance requirements are consistent
	endpoints: {
		// Search endpoint must meet pipeline requirements
		search: performance: target_latency_p95 <= 20*time.Millisecond
		
		// Health endpoint must be very fast
		health: performance: target_latency_p95 <= 5*time.Millisecond
	}
	
	// Rate limiting must be reasonable
	rate_limiting: {
		// Global rate limit should accommodate all endpoints
		global: requests_per_second >= 100
		
		// Per-endpoint limits should sum to reasonable total
		per_endpoint: {
			// Search endpoint gets highest allocation
			endpoints: "/search": requests_per_second >= 100
		}
	}
	
	// Server timeouts should be longer than endpoint timeouts
	server: behavior: {
		read_timeout >= endpoints.search.performance.timeout + 5*time.Second
		write_timeout >= endpoints.search.performance.timeout + 5*time.Second
	}
}

// Example API configuration
_example_api: #APIServer & {
	server: {
		network: {
			host: "0.0.0.0"
			port: 8080
		}
		
		behavior: {
			read_timeout: 30*time.Second
			write_timeout: 30*time.Second
			max_connections: 1000
		}
	}
	
	streaming: {
		enabled: true
		ndjson: compact_json: true
	}
	
	rate_limiting: {
		global: {
			enabled: true
			requests_per_second: 1000
			burst_size: 100
		}
	}
}