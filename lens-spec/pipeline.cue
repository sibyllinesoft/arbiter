package lens

import "time"

// SearchPipeline defines the three-layer search architecture
#SearchPipeline: {
	// Pipeline configuration and orchestration
	orchestration: #PipelineOrchestration
	
	// Stage-A: Lexical layer (trigrams/FST)
	lexical_layer: #LexicalLayer
	
	// Stage-B: Symbol/AST layer (ctags+LSIF+tree-sitter)  
	symbol_layer: #SymbolLayer
	
	// Stage-C: Semantic rerank (ColBERT-v2/SPLADE)
	semantic_layer: #SemanticLayer
	
	// Data flow between layers
	data_flow: #DataFlowConfig
	
	// Pipeline caching and optimization
	caching: #PipelineCaching
}

// PipelineOrchestration defines how the three layers work together
#PipelineOrchestration: {
	// Execution strategy for the pipeline
	execution_strategy: "sequential" | "parallel" | "adaptive" | *"adaptive"
	
	// Early termination conditions
	early_termination: {
		enabled: bool | *true
		
		// Stop pipeline if sufficient results found in early stages
		result_thresholds: {
			lexical_sufficient:  int & >=10 & <=10000 | *1000    // Stop if lexical finds 1000+ results
			symbol_sufficient:   int & >=5 & <=1000 | *100       // Stop if symbol finds 100+ results
			semantic_required:   int & >=1 & <=100 | *10         // Always run semantic if <10 results
		}
		
		// Confidence thresholds for early termination
		confidence_thresholds: {
			high_confidence: number & >=0.8 & <=1.0 | *0.95  // Very confident results
			medium_confidence: number & >=0.6 & <=0.8 | *0.8 // Moderately confident
			low_confidence: number & >=0.3 & <=0.6 | *0.5    // Need more processing
		}
	}
	
	// Fallback strategies when stages fail
	fallback_strategies: {
		// Lexical layer fallback
		lexical_fallback: {
			enabled: bool | *true
			fallback_to: "basic_text_search" | "regex_search" | *"basic_text_search"
			timeout: time.Duration & >=100*time.Millisecond & <=2*time.Second | *500*time.Millisecond
		}
		
		// Symbol layer fallback  
		symbol_fallback: {
			enabled: bool | *true
			fallback_to: "lexical_only" | "basic_symbol_search" | *"lexical_only"
			timeout: time.Duration & >=500*time.Millisecond & <=5*time.Second | *2*time.Second
		}
		
		// Semantic layer fallback
		semantic_fallback: {
			enabled: bool | *true
			fallback_to: "lexical_symbol_only" | "basic_ranking" | *"basic_ranking"
			timeout: time.Duration & >=1*time.Second & <=10*time.Second | *5*time.Second
		}
	}
	
	// Quality gates between stages
	quality_gates: {
		enabled: bool | *true
		
		// Minimum quality thresholds to proceed to next stage
		thresholds: {
			lexical_to_symbol: {
				min_results: int & >=0 & <=1000 | *1        // Need at least 1 result
				min_quality_score: number & >=0 & <=1 | *0.1 // Very low bar for lexical
			}
			
			symbol_to_semantic: {
				min_results: int & >=0 & <=100 | *1         // Need at least 1 result
				min_quality_score: number & >=0 & <=1 | *0.3 // Higher bar for symbol
			}
		}
	}
	
	// Pipeline result aggregation
	result_aggregation: {
		// Strategy for combining results from multiple layers
		combination_strategy: "union" | "intersection" | "weighted_merge" | *"weighted_merge"
		
		// Weights for each layer in final ranking
		layer_weights: {
			lexical:  number & >=0 & <=1 | *0.3  // 30% weight for lexical matches
			symbol:   number & >=0 & <=1 | *0.4  // 40% weight for symbol matches  
			semantic: number & >=0 & <=1 | *0.3  // 30% weight for semantic rerank
			
			// Weights must sum to 1.0
			_total: lexical + symbol + semantic
			_total: 1.0
		}
		
		// Deduplication of results across layers
		deduplication: {
			enabled: bool | *true
			strategy: "exact_match" | "fuzzy_match" | "content_hash" | *"content_hash"
			fuzzy_threshold: number & >=0.8 & <=1.0 | *0.95 // 95% similarity for fuzzy dedup
		}
	}
}

// LexicalLayer defines the fast trigram/FST-based search
#LexicalLayer: {
	// Stage identification and performance targets
	stage_id: "lexical"
	stage_name: "Lexical Search (Trigrams/FST)"
	
	// Performance constraints (from performance.cue)  
	performance: {
		target_latency_p95: <=6*time.Millisecond
		max_latency: <=10*time.Millisecond
		timeout: 15*time.Millisecond
	}
	
	// Trigram indexing configuration
	trigram_index: {
		// N-gram size for indexing
		ngram_size: 3 | *3 // Standard trigrams
		
		// Character encoding and normalization
		encoding: {
			normalize_unicode: bool | *true
			case_sensitive: bool | *false    // Default to case-insensitive
			normalize_whitespace: bool | *true
			
			// Character filtering
			filter_non_alphanumeric: bool | *false // Keep punctuation for code search
			ascii_folding: bool | *true            // Convert accents to ASCII
		}
		
		// Indexing strategy
		indexing: {
			// Index density (affects size vs speed tradeoff)
			density: "sparse" | "medium" | "dense" | *"medium"
			
			// Skip common trigrams to reduce index size
			skip_common_trigrams: bool | *true
			common_trigram_threshold: number & >=0.01 & <=0.1 | *0.05 // Skip if >5% of docs
			
			// Minimum document frequency for indexing
			min_doc_frequency: int & >=1 & <=1000 | *2
		}
	}
	
	// Finite State Transducer (FST) configuration
	fst_index: {
		enabled: bool | *true
		
		// FST construction parameters
		construction: {
			// Maximum memory during FST construction
			max_construction_memory: int & >0 & <=2*1024*1024*1024 | *512*1024*1024 // 512MB
			
			// Compression level for FST
			compression_level: int & >=0 & <=9 | *6
			
			// Enable sorted insertion optimization
			sorted_insertion: bool | *true
		}
		
		// FST query optimization
		query_optimization: {
			// Maximum automaton states for complex queries
			max_automaton_states: int & >=1000 & <=100000 | *10000
			
			// Enable fuzzy matching in FST
			fuzzy_matching: {
				enabled: bool | *true
				max_edit_distance: int & >=1 & <=3 | *2     // Levenshtein distance
				prefix_length: int & >=0 & <=5 | *1         // Exact prefix required
			}
		}
	}
	
	// Query processing configuration
	query_processing: {
		// Query analysis and preparation
		analysis: {
			// Tokenization strategy
			tokenization: "whitespace" | "unicode" | "language_aware" | *"unicode"
			
			// Minimum query length
			min_query_length: int & >=1 & <=10 | *2
			
			// Maximum query length (prevent DoS)
			max_query_length: int & >=10 & <=1000 | *256
		}
		
		// Result scoring
		scoring: {
			// Base scoring algorithm
			algorithm: "tf_idf" | "bm25" | "frequency" | *"bm25"
			
			// BM25 parameters
			if algorithm == "bm25" {
				k1: number & >=0.5 & <=3.0 | *1.5  // Term frequency saturation
				b: number & >=0.0 & <=1.0 | *0.75   // Length normalization
			}
			
			// Position-based scoring bonuses
			position_scoring: {
				enabled: bool | *true
				
				// Boost for matches at beginning of file/line
				beginning_boost: number & >=1.0 & <=5.0 | *1.5
				
				// Boost for exact phrase matches
				phrase_boost: number & >=1.0 & <=10.0 | *2.0
			}
		}
		
		// Result filtering and limits
		filtering: {
			// Maximum results to return from lexical layer
			max_results: int & >=100 & <=10000 | *5000
			
			// Minimum score threshold
			min_score_threshold: number & >=0.0 & <=1.0 | *0.01
			
			// Duplicate detection within layer
			deduplicate: bool | *true
			dedup_threshold: number & >=0.8 & <=1.0 | *0.95
		}
	}
	
	// Caching for lexical layer
	caching: {
		enabled: bool | *true
		
		// Query result caching
		query_cache: {
			enabled: bool | *true
			max_entries: int & >=100 & <=100000 | *10000
			ttl: time.Duration & >=1*time.Minute & <=1*time.Hour | *10*time.Minute
			
			// Cache hit ratio target
			target_hit_ratio: number & >=0.7 & <=0.99 | *0.85
		}
		
		// Trigram posting list caching
		posting_cache: {
			enabled: bool | *true
			max_memory: int & >0 & <=1024*1024*1024 | *256*1024*1024 // 256MB
			eviction_policy: "lru" | "lfu" | "arc" | *"lru"
		}
	}
}

// SymbolLayer defines structured code understanding
#SymbolLayer: {
	// Stage identification and performance targets
	stage_id: "symbol"
	stage_name: "Symbol/AST Search"
	
	// Performance constraints
	performance: {
		target_latency_p95: <=8*time.Millisecond
		max_latency: <=12*time.Millisecond
		timeout: 20*time.Millisecond
	}
	
	// Code analysis tool integration
	analysis_tools: {
		// ctags integration
		ctags: {
			enabled: bool | *true
			
			// ctags configuration
			config: {
				languages: [...string] | *["c", "cpp", "java", "python", "javascript", "typescript", "go", "rust"]
				recursive: bool | *true
				follow_symlinks: bool | *false
				
				// Custom field extraction
				fields: [...string] | *["name", "kind", "line", "scope", "signature", "typeref"]
				
				// Tag filtering
				exclude_patterns: [...string] | *["test", "spec", "mock", "generated"]
			}
			
			// Performance tuning
			performance: {
				parallel_processing: bool | *true
				max_workers: int & >=1 & <=16 | *4
				timeout_per_file: time.Duration & >=1*time.Second & <=30*time.Second | *10*time.Second
			}
		}
		
		// LSIF (Language Server Index Format) integration
		lsif: {
			enabled: bool | *true
			
			// LSIF index configuration
			index_config: {
				// Languages with LSIF support
				supported_languages: [...string] | *["typescript", "javascript", "python", "go", "java", "c", "cpp"]
				
				// Index freshness requirements
				max_age: time.Duration & >=1*time.Hour & <=7*24*time.Hour | *24*time.Hour
				
				// Cross-reference tracking
				track_references: bool | *true
				track_definitions: bool | *true
				track_implementations: bool | *true
			}
			
			// Query capabilities
			query_features: {
				goto_definition: bool | *true
				find_references: bool | *true
				hover_information: bool | *true
				symbol_search: bool | *true
				workspace_symbols: bool | *true
			}
		}
		
		// Tree-sitter integration for syntax analysis
		tree_sitter: {
			enabled: bool | *true
			
			// Parser configuration
			parsers: {
				// Supported languages and their parsers
				languages: {
					typescript: "tree-sitter-typescript"
					javascript: "tree-sitter-javascript"
					python:     "tree-sitter-python"
					go:         "tree-sitter-go"
					rust:       "tree-sitter-rust"
					java:       "tree-sitter-java"
					c:          "tree-sitter-c"
					cpp:        "tree-sitter-cpp"
				}
				
				// Parser performance limits
				max_parse_time: time.Duration & >=100*time.Millisecond & <=10*time.Second | *5*time.Second
				max_file_size: int & >=1024 & <=10*1024*1024 | *1*1024*1024 // 1MB max file size
			}
			
			// Syntax query configuration
			queries: {
				// Enable specific query types
				function_definitions: bool | *true
				class_definitions: bool | *true
				variable_definitions: bool | *true
				import_statements: bool | *true
				comment_extraction: bool | *true
				
				// Custom query patterns
				custom_patterns: [...string] | *[]
			}
		}
	}
	
	// Symbol indexing strategy
	indexing: {
		// Index granularity
		granularity: "file" | "symbol" | "mixed" | *"symbol"
		
		// Symbol types to index
		symbol_types: {
			functions: bool | *true
			classes: bool | *true
			methods: bool | *true
			variables: bool | *true
			constants: bool | *true
			interfaces: bool | *true
			types: bool | *true
			imports: bool | *true
			namespaces: bool | *true
		}
		
		// Scoping and visibility
		scoping: {
			// Index private/internal symbols
			index_private: bool | *true
			
			// Index test files
			index_tests: bool | *false
			
			// Index generated files
			index_generated: bool | *false
			
			// Scope hierarchy tracking
			track_hierarchy: bool | *true
		}
		
		// Content extraction
		content_extraction: {
			// Extract symbol documentation
			extract_docs: bool | *true
			
			// Extract type information
			extract_types: bool | *true
			
			// Extract signatures
			extract_signatures: bool | *true
			
			// Maximum content length per symbol
			max_content_length: int & >=100 & <=10000 | *2000
		}
	}
	
	// Query processing for symbol search
	query_processing: {
		// Query understanding
		understanding: {
			// Detect query intent (function search, class search, etc.)
			intent_detection: bool | *true
			
			// Language-specific query processing
			language_aware: bool | *true
			
			// Handle qualified names (package.class.method)
			qualified_names: bool | *true
		}
		
		// Symbol matching strategies
		matching: {
			// Exact name matching
			exact_matching: {
				enabled: bool | *true
				case_sensitive: bool | *false
				weight: number & >=0 & <=1 | *1.0
			}
			
			// Fuzzy name matching
			fuzzy_matching: {
				enabled: bool | *true
				edit_distance: int & >=1 & <=5 | *2
				prefix_length: int & >=0 & <=3 | *1
				weight: number & >=0 & <=1 | *0.8
			}
			
			// Semantic matching (based on context)
			semantic_matching: {
				enabled: bool | *true
				context_window: int & >=5 & <=50 | *10  // Lines of context
				weight: number & >=0 & <=1 | *0.6
			}
		}
		
		// Result ranking for symbol matches
		ranking: {
			// Ranking factors and weights
			factors: {
				name_similarity: number & >=0 & <=1 | *0.4     // How well name matches query
				context_relevance: number & >=0 & <=1 | *0.3   // Relevance in context
				symbol_importance: number & >=0 & <=1 | *0.2   // Symbol importance (public, usage)
				location_boost: number & >=0 & <=1 | *0.1      // File/location preference
			}
			
			// Symbol importance calculation
			importance: {
				// Boost public/exported symbols
				public_boost: number & >=1.0 & <=5.0 | *1.5
				
				// Boost frequently referenced symbols  
				reference_count_boost: bool | *true
				
				// Penalize test/generated code
				test_penalty: number & >=0.1 & <=1.0 | *0.5
			}
		}
		
		// Result limits for symbol layer
		limits: {
			max_results: int & >=50 & <=5000 | *1000
			min_score_threshold: number & >=0.0 & <=1.0 | *0.1
			
			// Per-symbol-type limits to ensure diversity
			per_type_limits: {
				functions: int & >=10 & <=500 | *200
				classes: int & >=10 & <=500 | *200
				variables: int & >=10 & <=300 | *100
			}
		}
	}
	
	// Symbol layer caching
	caching: {
		enabled: bool | *true
		
		// Index caching
		index_cache: {
			enabled: bool | *true
			max_memory: int & >0 & <=2*1024*1024*1024 | *512*1024*1024 // 512MB
			ttl: time.Duration & >=10*time.Minute & <=24*time.Hour | *2*time.Hour
		}
		
		// Parse result caching
		parse_cache: {
			enabled: bool | *true
			max_entries: int & >=100 & <=50000 | *10000
			ttl: time.Duration & >=5*time.Minute & <=1*time.Hour | *30*time.Minute
		}
	}
}

// SemanticLayer defines neural reranking using ColBERT-v2/SPLADE
#SemanticLayer: {
	// Stage identification and performance targets
	stage_id: "semantic"
	stage_name: "Semantic Rerank"
	
	// Performance constraints  
	performance: {
		target_latency_p95: <=12*time.Millisecond
		max_latency: <=18*time.Millisecond
		timeout: 25*time.Millisecond
	}
	
	// Neural ranking model configuration
	models: {
		// Primary model selection
		primary_model: "colbert_v2" | "splade" | "custom" | *"colbert_v2"
		
		// ColBERT-v2 configuration
		colbert_v2: {
			enabled: bool | *true
			
			// Model parameters
			model_config: {
				// Model checkpoint/path
				checkpoint: string | *"colbert-ir/colbertv2.0"
				
				// Maximum sequence length
				max_length: int & >=128 & <=512 | *256
				
				// Query/document encoding dimensions  
				embedding_dim: int & >=64 & <=1024 | *128
				
				// Batch size for encoding
				batch_size: int & >=1 & <=128 | *32
			}
			
			// Performance optimization
			optimization: {
				// Use half precision (FP16) for inference
				use_fp16: bool | *true
				
				// Enable TensorRT optimization (if available)
				use_tensorrt: bool | *false
				
				// Use ONNX runtime
				use_onnx: bool | *false
				
				// CPU vs GPU inference
				device: "cpu" | "cuda" | "auto" | *"auto"
			}
		}
		
		// SPLADE configuration
		splade: {
			enabled: bool | *false // Secondary model
			
			// Model parameters
			model_config: {
				checkpoint: string | *"naver/splade-v3"
				max_length: int & >=128 & <=512 | *256
				
				// Sparsity regularization
				sparsity_regularization: number & >=0.0 & <=1.0 | *0.05
			}
		}
		
		// Model serving configuration
		serving: {
			// Model loading strategy
			loading_strategy: "eager" | "lazy" | "on_demand" | *"lazy"
			
			// Model caching in memory
			cache_in_memory: bool | *true
			max_cached_models: int & >=1 & <=5 | *2
			
			// Model inference batching
			batching: {
				enabled: bool | *true
				max_batch_size: int & >=1 & <=128 | *16
				batch_timeout: time.Duration & >=1*time.Millisecond & <=100*time.Millisecond | *10*time.Millisecond
			}
		}
	}
	
	// Semantic processing pipeline
	processing: {
		// Input filtering before semantic processing
		input_filtering: {
			// Maximum candidates to process (from previous layers)
			max_candidates: int & >=10 & <=1000 | *200
			
			// Minimum score threshold from previous layers
			min_input_score: number & >=0.0 & <=1.0 | *0.1
			
			// Content length filtering
			min_content_length: int & >=10 & <=1000 | *50
			max_content_length: int & >=100 & <=10000 | *2000
		}
		
		// Query processing
		query_processing: {
			// Query expansion
			expansion: {
				enabled: bool | *false // Conservative default
				max_expanded_terms: int & >=1 & <=20 | *5
				
				// Expansion strategies
				strategies: [...string] | *["synonym", "related_terms"]
			}
			
			// Query encoding
			encoding: {
				// Use query-specific encoding optimizations
				query_optimized: bool | *true
				
				// Cache query encodings
				cache_encodings: bool | *true
				cache_ttl: time.Duration & >=1*time.Minute & <=1*time.Hour | *15*time.Minute
			}
		}
		
		// Document processing
		document_processing: {
			// Content extraction strategy
			extraction_strategy: "full_content" | "snippets" | "sliding_window" | *"snippets"
			
			// Snippet generation (if using snippets)
			if extraction_strategy == "snippets" {
				snippet_config: {
					max_snippets: int & >=1 & <=10 | *3
					snippet_length: int & >=50 & <=500 | *200
					overlap: int & >=0 & <=100 | *20 // Character overlap between snippets
					
					// Context window around matches
					context_window: int & >=10 & <=100 | *50
				}
			}
			
			// Document encoding caching
			encoding_cache: {
				enabled: bool | *true
				max_entries: int & >=100 & <=100000 | *10000
				ttl: time.Duration & >=10*time.Minute & <=24*time.Hour | *2*time.Hour
				
				// Cache based on content hash
				content_based_caching: bool | *true
			}
		}
		
		// Reranking computation
		reranking: {
			// Similarity computation method
			similarity_method: "cosine" | "dot_product" | "euclidean" | *"cosine"
			
			// Score normalization
			normalization: {
				enabled: bool | *true
				method: "minmax" | "zscore" | "sigmoid" | *"sigmoid"
			}
			
			// Result diversity promotion
			diversity: {
				enabled: bool | *true
				
				// MMR (Maximal Marginal Relevance) parameters
				mmr_lambda: number & >=0.0 & <=1.0 | *0.7 // Balance relevance vs diversity
				
				// Diversity promotion window size
				diversity_window: int & >=5 & <=50 | *10
			}
		}
	}
	
	// Semantic layer output configuration
	output: {
		// Result limits
		max_results: int & >=10 & <=200 | *50
		
		// Score thresholds
		min_semantic_score: number & >=0.0 & <=1.0 | *0.3
		
		// Result formatting
		include_explanations: bool | *false // Include ranking explanations
		include_similarities: bool | *true   // Include similarity scores
		include_snippets: bool | *true       // Include relevant snippets
		
		// Confidence scoring
		confidence_scoring: {
			enabled: bool | *true
			
			// Confidence calculation method
			method: "entropy_based" | "score_distribution" | "ensemble" | *"score_distribution"
			
			// Confidence thresholds
			high_confidence: number & >=0.8 & <=1.0 | *0.9
			medium_confidence: number & >=0.6 & <=0.8 | *0.7
			low_confidence: number & >=0.3 & <=0.6 | *0.5
		}
	}
	
	// Resource management for semantic processing
	resources: {
		// Memory limits for model inference
		memory_limits: {
			max_model_memory: int & >0 & <=8*1024*1024*1024 | *2*1024*1024*1024 // 2GB for models
			max_batch_memory: int & >0 & <=1*1024*1024*1024 | *256*1024*1024    // 256MB for batches
		}
		
		// Compute resource allocation
		compute: {
			// GPU utilization (if available)
			max_gpu_utilization: number & >=0.1 & <=1.0 | *0.8
			
			// CPU cores for inference
			max_cpu_cores: int & >=1 & <=32 | *4
			
			// Concurrency limits
			max_concurrent_requests: int & >=1 & <=100 | *10
		}
	}
}

// DataFlowConfig defines how data flows between pipeline layers
#DataFlowConfig: {
	// Inter-layer communication
	communication: {
		// Message passing strategy
		strategy: "direct" | "queued" | "streamed" | *"streamed"
		
		// Buffer sizes for streaming
		buffer_sizes: {
			lexical_to_symbol: int & >=100 & <=10000 | *1000
			symbol_to_semantic: int & >=10 & <=1000 | *100
		}
		
		// Timeout configuration for inter-layer communication
		timeouts: {
			layer_handoff: time.Duration & >=1*time.Millisecond & <=100*time.Millisecond | *10*time.Millisecond
			result_streaming: time.Duration & >=10*time.Millisecond & <=1*time.Second | *100*time.Millisecond
		}
	}
	
	// Data transformation between layers
	transformation: {
		// Result format standardization
		standardize_formats: bool | *true
		
		// Score normalization across layers
		normalize_scores: {
			enabled: bool | *true
			method: "minmax" | "zscore" | "rank" | *"rank"
			
			// Preserve original scores for debugging
			preserve_original: bool | *true
		}
		
		// Metadata propagation
		metadata_propagation: {
			enabled: bool | *true
			
			// Which metadata fields to propagate
			propagate_fields: [...string] | *["source_layer", "confidence", "processing_time", "cache_hit"]
			
			// Metadata size limits
			max_metadata_size: int & >=100 & <=10000 | *1000 // bytes
		}
	}
	
	// Quality control between layers
	quality_control: {
		// Result validation
		validation: {
			enabled: bool | *true
			
			// Validate result structure
			validate_structure: bool | *true
			
			// Validate score ranges
			validate_scores: bool | *true
			
			// Validate required fields
			required_fields: [...string] | *["id", "content", "score", "source"]
		}
		
		// Error handling in data flow
		error_handling: {
			// Action on validation failure
			on_validation_error: "drop" | "fix" | "forward" | *"fix"
			
			// Maximum errors before stopping pipeline
			max_errors: int & >=1 & <=100 | *10
			
			// Error reporting
			report_errors: bool | *true
		}
	}
	
	// Performance monitoring of data flow
	monitoring: {
		// Track throughput between layers
		track_throughput: bool | *true
		
		// Track latency of data transformation
		track_latency: bool | *true
		
		// Track data loss/corruption
		track_data_integrity: bool | *true
		
		// Alert on performance degradation
		performance_alerts: {
			enabled: bool | *true
			throughput_threshold: number & >=0.5 & <=1.0 | *0.8 // Alert if <80% expected throughput
			latency_threshold: number & >=1.1 & <=3.0 | *1.5     // Alert if >150% expected latency
		}
	}
}

// PipelineCaching defines caching strategies across the pipeline
#PipelineCaching: {
	// Global caching configuration
	global: {
		enabled: bool | *true
		
		// Cache storage backend
		backend: "memory" | "redis" | "memcached" | "hybrid" | *"memory"
		
		// Global cache limits
		max_total_memory: int & >0 & <=8*1024*1024*1024 | *1*1024*1024*1024 // 1GB total
		
		// Cache coordination between layers
		coordination: {
			enabled: bool | *true
			
			// Share cache entries between layers when possible
			cross_layer_sharing: bool | *true
			
			// Cache invalidation strategy
			invalidation_strategy: "ttl" | "lru" | "event_driven" | *"ttl"
		}
	}
	
	// Query-level caching
	query_cache: {
		enabled: bool | *true
		
		// Full pipeline result caching
		full_pipeline: {
			enabled: bool | *true
			max_entries: int & >=100 & <=100000 | *5000
			ttl: time.Duration & >=1*time.Minute & <=1*time.Hour | *15*time.Minute
			
			// Cache key strategy
			key_strategy: "query_hash" | "semantic_hash" | "normalized_query" | *"semantic_hash"
		}
		
		// Per-layer result caching
		per_layer: {
			enabled: bool | *true
			
			// Layer-specific cache configuration
			layers: {
				lexical: {
					max_entries: int & >=500 & <=50000 | *10000
					ttl: time.Duration & >=5*time.Minute & <=30*time.Minute | *10*time.Minute
				}
				
				symbol: {
					max_entries: int & >=100 & <=10000 | *5000
					ttl: time.Duration & >=10*time.Minute & <=1*time.Hour | *20*time.Minute
				}
				
				semantic: {
					max_entries: int & >=50 & <=5000 | *1000
					ttl: time.Duration & >=5*time.Minute & <=30*time.Minute | *10*time.Minute
				}
			}
		}
	}
	
	// Content-based caching
	content_cache: {
		enabled: bool | *true
		
		// Document content caching
		document_content: {
			enabled: bool | *true
			max_memory: int & >0 & <=2*1024*1024*1024 | *512*1024*1024 // 512MB
			ttl: time.Duration & >=10*time.Minute & <=24*time.Hour | *2*time.Hour
		}
		
		// Processed content caching (embeddings, features, etc.)
		processed_content: {
			enabled: bool | *true
			max_memory: int & >0 & <=4*1024*1024*1024 | *1*1024*1024*1024 // 1GB
			ttl: time.Duration & >=30*time.Minute & <=24*time.Hour | *4*time.Hour
		}
	}
	
	// Cache performance monitoring
	monitoring: {
		enabled: bool | *true
		
		// Track cache hit ratios
		target_hit_ratios: {
			query_cache: number & >=0.7 & <=0.99 | *0.8
			content_cache: number & >=0.6 & <=0.99 | *0.75
			overall: number & >=0.7 & <=0.99 | *0.8
		}
		
		// Alert on cache performance issues
		alerts: {
			low_hit_ratio: {
				enabled: bool | *true
				threshold: number & >=0.3 & <=0.8 | *0.5 // Alert if hit ratio <50%
			}
			
			high_eviction_rate: {
				enabled: bool | *true
				threshold: number & >=0.1 & <=0.5 | *0.2 // Alert if >20% eviction rate
			}
		}
	}
}

// Pipeline validation constraints
#SearchPipeline: {
	// Ensure performance targets are consistent across layers
	lexical_layer: performance: target_latency_p95 <= 6*time.Millisecond
	symbol_layer: performance: target_latency_p95 <= 8*time.Millisecond
	semantic_layer: performance: target_latency_p95 <= 12*time.Millisecond
	
	// Ensure result flow makes sense
	orchestration: result_aggregation: layer_weights: {
		// Weights must be reasonable
		lexical >= 0.1  // At least 10% weight
		symbol >= 0.1   // At least 10% weight
		semantic >= 0.1 // At least 10% weight
	}
	
	// Ensure caching memory limits are consistent
	caching: {
		// Total cache memory should not exceed reasonable limits
		global: max_total_memory <= 8*1024*1024*1024 // Max 8GB for caching
		
		// Per-cache limits should sum to less than total
		_content_cache_total: content_cache.document_content.max_memory + 
		                     content_cache.processed_content.max_memory
		_content_cache_total <= global.max_total_memory
	}
}

// Example pipeline configuration
_example_pipeline: #SearchPipeline & {
	orchestration: execution_strategy: "adaptive"
	
	lexical_layer: {
		trigram_index: ngram_size: 3
		fst_index: enabled: true
		query_processing: scoring: algorithm: "bm25"
	}
	
	symbol_layer: {
		analysis_tools: {
			ctags: enabled: true
			lsif: enabled: true
			tree_sitter: enabled: true
		}
		indexing: granularity: "symbol"
	}
	
	semantic_layer: {
		models: primary_model: "colbert_v2"
		processing: input_filtering: max_candidates: 200
	}
	
	caching: {
		global: enabled: true
		query_cache: enabled: true
	}
}