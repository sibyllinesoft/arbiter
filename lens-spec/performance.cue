package lens

import "time"

// PerformanceSLAs define strict latency and throughput requirements
#PerformanceSLAs: {
	// Pipeline stage latency targets (strict constraints)
	stages: {
		// Stage-A: Lexical layer (trigrams/FST)
		lexical: #StagePerformance & {
			name:         "lexical"
			target_p50:   <=2*time.Millisecond
			target_p95:   <=6*time.Millisecond  
			target_p99:   <=8*time.Millisecond
			max_latency:  <=10*time.Millisecond // Hard limit
			timeout:      15*time.Millisecond
		}
		
		// Stage-B: Symbol/AST layer (ctags+LSIF+tree-sitter)
		symbol: #StagePerformance & {
			name:         "symbol"
			target_p50:   <=3*time.Millisecond
			target_p95:   <=8*time.Millisecond
			target_p99:   <=10*time.Millisecond
			max_latency:  <=12*time.Millisecond // Hard limit
			timeout:      20*time.Millisecond
		}
		
		// Stage-C: Semantic rerank (ColBERT-v2/SPLADE)
		semantic: #StagePerformance & {
			name:         "semantic"
			target_p50:   <=5*time.Millisecond
			target_p95:   <=12*time.Millisecond
			target_p99:   <=15*time.Millisecond
			max_latency:  <=18*time.Millisecond // Hard limit
			timeout:      25*time.Millisecond
		}
	}
	
	// Overall pipeline performance (end-to-end)
	pipeline: #PipelinePerformance & {
		// Overall p95 must be < 20ms (strict requirement)
		target_p95:  <=18*time.Millisecond // Leave 2ms buffer
		target_p99:  <=20*time.Millisecond
		max_latency: <=25*time.Millisecond // Hard timeout
		timeout:     30*time.Millisecond
		
		// Pipeline must complete all stages within SLA
		stages_sla_compliance: >=99.5 // 99.5% of requests
	}
	
	// Throughput requirements
	throughput: {
		// Queries per second targets
		target_qps:    >=1000
		peak_qps:      >=2000  // Must handle peak load
		burst_qps:     >=5000  // Must handle short bursts
		
		// Concurrent queries supported
		max_concurrent: int & >=100 & <=1000 | *500
		
		// Index throughput (documents per second)
		index_dps: >=100 // Documents per second during indexing
	}
	
	// Memory performance constraints
	memory_performance: {
		// Memory allocation per query (bounded)
		max_allocation_per_query: <=50*1024*1024 // 50MB max per query
		
		// GC pause time constraints (for garbage-collected runtimes)
		max_gc_pause: <=1*time.Millisecond
		
		// Memory fragmentation limits
		max_fragmentation: <=20 // 20% maximum fragmentation
	}
	
	// I/O performance constraints
	io_performance: {
		// Memory-mapped file access latency
		mmap_access_p95: <=1*time.Millisecond
		
		// Disk I/O constraints (for persistence)
		disk_write_p95: <=5*time.Millisecond
		disk_read_p95:  <=2*time.Millisecond
		
		// Network I/O (for distributed scenarios)
		network_rtt_p95: <=1*time.Millisecond // Local network
	}
}

// StagePerformance defines performance constraints for pipeline stages
#StagePerformance: {
	name: string
	
	// Latency percentiles (strict ordering required)
	target_p50:  time.Duration & >0
	target_p95:  time.Duration & >=target_p50
	target_p99:  time.Duration & >=target_p95
	max_latency: time.Duration & >=target_p99
	timeout:     time.Duration & >=max_latency
	
	// Error rate constraints
	max_error_rate: number & >=0 & <=1 | *0.001 // 0.1% default
	
	// Resource utilization during stage execution
	resource_limits: {
		cpu_per_operation:    number & >=0 & <=100 | *5.0  // 5% CPU per operation
		memory_per_operation: int & >=0 & <=100*1024*1024 | *10*1024*1024 // 10MB default
		
		// Stage-specific resource multipliers
		if name == "lexical" {
			cpu_per_operation:    <=2.0  // Lexical should be very fast
			memory_per_operation: <=5*1024*1024 // 5MB max for lexical
		}
		if name == "symbol" {
			cpu_per_operation:    <=8.0  // Symbol parsing is more expensive
			memory_per_operation: <=20*1024*1024 // 20MB max for symbol
		}
		if name == "semantic" {
			cpu_per_operation:    <=15.0 // Semantic rerank is most expensive
			memory_per_operation: <=50*1024*1024 // 50MB max for semantic
		}
	}
	
	// Caching performance requirements
	cache_performance: {
		hit_rate: number & >=0.7 & <=1.0 | *0.9 // 90% default hit rate
		
		// Cache lookup latency
		cache_lookup_p95: time.Duration & <=100*time.Microsecond
	}
}

// PipelinePerformance defines end-to-end pipeline constraints
#PipelinePerformance: {
	// End-to-end latency constraints
	target_p50:  time.Duration & >0
	target_p95:  time.Duration & >=target_p50
	target_p99:  time.Duration & >=target_p95
	max_latency: time.Duration & >=target_p99
	timeout:     time.Duration & >=max_latency
	
	// SLA compliance rate
	stages_sla_compliance: number & >=0.99 & <=1.0
	
	// Pipeline efficiency metrics
	efficiency: {
		// Percentage of time spent in useful computation vs waiting
		useful_cpu_time: number & >=0.7 & <=1.0 | *0.85
		
		// Pipeline stage parallelism efficiency
		parallelism_efficiency: number & >=0.8 & <=1.0 | *0.9
		
		// Resource utilization efficiency
		resource_efficiency: number & >=0.75 & <=1.0 | *0.85
	}
	
	// Queue management performance
	queue_performance: {
		// Maximum queue depth before backpressure
		max_queue_depth: int & >=10 & <=1000 | *100
		
		// Queue processing latency
		queue_latency_p95: time.Duration & <=1*time.Millisecond
		
		// Queue starvation prevention
		min_processing_rate: number & >0 | *0.1 // Process at least 10% of capacity
	}
}

// PerformanceMonitoring defines how performance is measured and enforced
#PerformanceMonitoring: {
	// Metrics collection configuration
	metrics: {
		// Collection interval for performance metrics
		collection_interval: time.Duration & >=100*time.Millisecond & <=10*time.Second | *1*time.Second
		
		// Histogram buckets for latency measurement
		latency_buckets: [...number] | *[0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0]
		
		// Percentile tracking accuracy
		percentile_accuracy: number & >=0.99 & <=1.0 | *0.999 // 99.9% accuracy
	}
	
	// SLA violation detection and alerting
	sla_monitoring: {
		// Evaluation window for SLA compliance
		evaluation_window: time.Duration & >=1*time.Minute & <=1*time.Hour | *5*time.Minute
		
		// Alert thresholds
		alert_thresholds: {
			// Alert if p95 exceeds target by this percentage
			p95_violation_threshold: number & >=1.05 & <=2.0 | *1.1 // 10% over target
			
			// Alert if error rate exceeds this threshold
			error_rate_threshold: number & >=0.01 & <=0.1 | *0.05 // 5% error rate
			
			// Alert if throughput drops below this percentage of target
			throughput_threshold: number & >=0.5 & <=0.9 | *0.8 // 80% of target
		}
		
		// Circuit breaker configuration
		circuit_breaker: {
			enabled: bool | *true
			
			// Trip circuit if error rate exceeds threshold
			error_rate_threshold: number & >=0.1 & <=0.5 | *0.2 // 20% error rate
			
			// Trip circuit if latency exceeds this multiple of target
			latency_multiplier: number & >=1.5 & <=3.0 | *2.0 // 2x target latency
			
			// Evaluation window for circuit breaker
			evaluation_window: time.Duration & >=10*time.Second & <=5*time.Minute | *30*time.Second
			
			// Recovery configuration
			recovery: {
				timeout:         time.Duration & >=30*time.Second & <=5*time.Minute | *1*time.Minute
				success_threshold: int & >=3 & <=20 | *5 // 5 successful requests to recover
			}
		}
	}
	
	// Load testing and validation
	load_testing: {
		// Continuous load testing configuration
		enabled: bool | *true
		
		// Background load generation
		background_load: {
			enabled: bool | *false
			qps:     int & >=1 & <=100 | *10 // Light background load
			
			// Query patterns for load testing
			query_patterns: [...string] | *["simple", "complex", "fuzzy", "structured"]
		}
		
		// Chaos engineering integration
		chaos_testing: {
			enabled: bool | *false
			
			// Types of chaos experiments
			experiments: [...string] | *["latency_injection", "memory_pressure", "cpu_throttling"]
			
			// Experiment scheduling
			schedule: string | *"0 2 * * *" // Daily at 2 AM
		}
	}
}

// BenchmarkRequirements define the performance testing harness requirements
#BenchmarkRequirements: {
	// Benchmark test suites
	suites: {
		// Latency benchmark suite
		latency: #BenchmarkSuite & {
			name: "latency"
			
			// Test various query types and complexities
			tests: [
				{name: "simple_lexical", target_p95: 3*time.Millisecond},
				{name: "complex_symbol", target_p95: 8*time.Millisecond},
				{name: "semantic_rerank", target_p95: 12*time.Millisecond},
				{name: "end_to_end", target_p95: 18*time.Millisecond}
			]
			
			// Test data requirements
			test_data: {
				repo_sizes: ["small", "medium", "large"] // Different repository sizes
				query_complexity: ["simple", "medium", "complex"]
				concurrent_users: [1, 10, 50, 100, 500]
			}
		}
		
		// Throughput benchmark suite  
		throughput: #BenchmarkSuite & {
			name: "throughput"
			
			tests: [
				{name: "sustained_load", target_qps: 1000},
				{name: "peak_load", target_qps: 2000},
				{name: "burst_load", target_qps: 5000}
			]
			
			// Load patterns
			load_patterns: ["constant", "ramp", "spike", "sawtooth"]
		}
		
		// Resource utilization benchmark
		resources: #BenchmarkSuite & {
			name: "resources"
			
			tests: [
				{name: "memory_efficiency", target_memory_per_query: 50*1024*1024},
				{name: "cpu_efficiency", target_cpu_per_query: 5.0},
				{name: "gc_performance", target_gc_pause: 1*time.Millisecond}
			]
		}
	}
	
	// Benchmark environment requirements
	environment: {
		// Hardware requirements for consistent benchmarking
		hardware: {
			cpu_cores:    int & >=4 & <=64 | *8
			memory_gb:    int & >=8 & <=128 | *16
			storage_type: "ssd" | "nvme" | *"nvme"
			network:      "1gbps" | "10gbps" | *"1gbps"
		}
		
		// Software environment
		software: {
			os_isolation:    bool | *true // Use containers/VMs for isolation
			cpu_pinning:     bool | *true // Pin benchmarks to specific cores  
			numa_awareness:  bool | *true // Enable NUMA optimization
			
			// Background process control
			disable_background_services: bool | *true
			disable_cpu_scaling:         bool | *true
		}
	}
	
	// Benchmark validation criteria
	validation: {
		// Minimum number of iterations for statistical significance
		min_iterations: int & >=100 & <=10000 | *1000
		
		// Confidence interval for results
		confidence_level: number & >=0.95 & <=0.999 | *0.99 // 99% confidence
		
		// Maximum coefficient of variation (for consistency)
		max_cv: number & >=0.01 & <=0.2 | *0.05 // 5% max variation
		
		// Warmup requirements
		warmup: {
			iterations: int & >=10 & <=1000 | *100
			duration:   time.Duration & >=30*time.Second & <=5*time.Minute | *2*time.Minute
		}
	}
}

// BenchmarkSuite defines a collection of related performance tests
#BenchmarkSuite: {
	name: string
	
	// Test definitions
	tests: [...{
		name: string
		[string]: _ // Allow arbitrary test-specific parameters
	}]
	
	// Execution configuration
	execution: {
		timeout:     time.Duration & >=1*time.Minute & <=1*time.Hour | *10*time.Minute
		parallelism: int & >=1 & <=100 | *4
		repeat_count: int & >=1 & <=10 | *3
	}
	
	// Reporting requirements
	reporting: {
		formats: [...string] | *["json", "html", "prometheus"]
		
		// Required metrics in reports
		required_metrics: [...string] | *["latency_p50", "latency_p95", "latency_p99", "throughput", "error_rate"]
		
		// Comparison against previous runs
		comparison: {
			enabled: bool | *true
			regression_threshold: number & >=1.05 & <=2.0 | *1.1 // 10% performance regression threshold
		}
	}
}

// Validation: Ensure performance requirements are achievable
#PerformanceSLAs: {
	// Stage latency sum should not exceed pipeline target
	_total_p95: stages.lexical.target_p95 + stages.symbol.target_p95 + stages.semantic.target_p95
	pipeline: target_p95 >= _total_p95
	
	// Throughput and latency must be inversely related and realistic
	if throughput.target_qps > 1000 {
		pipeline.target_p95 <= 20*time.Millisecond
	}
	if throughput.target_qps > 2000 {
		pipeline.target_p95 <= 15*time.Millisecond  
	}
}

// Example performance configuration that meets all constraints
_example_performance: #PerformanceSLAs & {
	stages: {
		lexical: target_p95:  4*time.Millisecond
		symbol: target_p95:   6*time.Millisecond  
		semantic: target_p95: 8*time.Millisecond
	}
	pipeline: target_p95: 18*time.Millisecond
	throughput: target_qps: 1500
}