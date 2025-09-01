package lens

import (
	"time"
	"strings"
)

// LensService defines the main service architecture
#LensService: {
	// Service metadata and identification
	name:    "lens"
	version: string & =~"^v[0-9]+\\.[0-9]+\\.[0-9]+"
	
	// Process architecture - single daemon with worker pools
	daemon: #DaemonConfig
	
	// NATS/JetStream configuration for inter-component communication
	messaging: #NATSConfig
	
	// Shard management and storage
	shards: #ShardManager
	
	// Three-layer search pipeline
	pipeline: #SearchPipeline
	
	// API server configuration
	api: #APIServer
	
	// Observability configuration
	observability: #ObservabilityConfig
	
	// Resource constraints and limits
	resources: #ResourceLimits
}

// DaemonConfig defines the single process architecture with worker pools
#DaemonConfig: {
	// Process identification
	pid_file: string | *"/var/run/lens/lens.pid"
	
	// Worker pool configurations
	pools: {
		// Ingest/Index pool for document processing
		ingest: #WorkerPool & {
			name: "ingest"
			// Must have sufficient workers for ingestion throughput
			workers: >=2 & <=16
			// Ingest operations are I/O bound
			queue_size: >=100 & <=10000
		}
		
		// Query pool for search operations
		query: #WorkerPool & {
			name: "query"
			// Query pool should be sized for concurrent searches
			workers: >=4 & <=32
			// Query operations should have bounded queue
			queue_size: >=50 & <=1000
		}
		
		// Maintenance pool for compaction and cleanup
		maintenance: #WorkerPool & {
			name: "maintenance"
			// Maintenance can run with fewer workers
			workers: >=1 & <=4
			// Maintenance operations can be queued
			queue_size: >=10 & <=100
		}
	}
	
	// Graceful shutdown configuration
	shutdown: {
		timeout: time.Duration & >=30*time.Second & <=300*time.Second
		signal:  "SIGTERM" | "SIGINT"
	}
}

// WorkerPool defines a pool of workers for specific operations
#WorkerPool: {
	name:       string
	workers:    int & >0
	queue_size: int & >0
	
	// Worker lifecycle management
	lifecycle: {
		startup_timeout:  time.Duration & >=5*time.Second & <=60*time.Second | *30*time.Second
		shutdown_timeout: time.Duration & >=10*time.Second & <=120*time.Second | *60*time.Second
		
		// Health check configuration
		health_check: {
			interval: time.Duration & >=1*time.Second & <=30*time.Second | *10*time.Second
			timeout:  time.Duration & >=1*time.Second & <=10*time.Second | *5*time.Second
		}
	}
	
	// Error handling and recovery
	error_handling: {
		max_retries:      int & >=0 & <=5 | *3
		backoff_strategy: "exponential" | "linear" | "constant" | *"exponential"
		backoff_base:     time.Duration & >=100*time.Millisecond & <=10*time.Second | *1*time.Second
	}
}

// NATSConfig defines NATS/JetStream messaging configuration
#NATSConfig: {
	// NATS server connection
	servers: [...string] & [_, ...] // At least one server required
	
	// Connection configuration
	connection: {
		name:            "lens-service"
		timeout:         time.Duration & >=1*time.Second & <=30*time.Second | *10*time.Second
		reconnect_wait:  time.Duration & >=100*time.Millisecond & <=10*time.Second | *2*time.Second
		max_reconnects:  int & >=-1 | *-1 // -1 for unlimited
		ping_interval:   time.Duration & >=10*time.Second & <=300*time.Second | *120*time.Second
		max_pings:       int & >=1 & <=10 | *2
	}
	
	// JetStream configuration for persistent messaging
	jetstream: {
		enabled: bool | *true
		
		// Stream configurations for different message types
		streams: {
			// Ingest commands and events
			ingest: #JetStreamConfig & {
				name:     "LENS_INGEST"
				subjects: ["lens.ingest.>"]
				retention: "limits" // Delete based on limits
				max_age:   24*time.Hour // Keep messages for 24 hours
			}
			
			// Query requests and responses  
			query: #JetStreamConfig & {
				name:     "LENS_QUERY"
				subjects: ["lens.query.>"]
				retention: "limits"
				max_age:   1*time.Hour // Queries are short-lived
			}
			
			// Maintenance operations
			maintenance: #JetStreamConfig & {
				name:     "LENS_MAINTENANCE"
				subjects: ["lens.maintenance.>"]
				retention: "workqueue" // Delete after acknowledgment
				max_age:   7*24*time.Hour // Keep for a week
			}
		}
	}
}

// JetStreamConfig defines a JetStream stream configuration
#JetStreamConfig: {
	name:     string & =~"^[A-Z_][A-Z0-9_]*$" // Stream names must be uppercase
	subjects: [...string] & [_, ...] // At least one subject
	
	// Retention policy
	retention: "limits" | "interest" | "workqueue"
	
	// Storage configuration
	storage: "file" | "memory" | *"file" // Default to file storage
	
	// Message limits
	max_age:          time.Duration | *24*time.Hour
	max_msgs:         int & >0 | *10000000 // 10M messages
	max_bytes:        int & >0 | *1000000000 // 1GB
	max_msg_size:     int & >0 | *1048576 // 1MB per message
	max_consumers:    int & >0 | *100
	
	// Duplication window
	duplicate_window: time.Duration & >=0*time.Second & <=24*time.Hour | *2*time.Minute
}

// ResourceLimits define system resource constraints
#ResourceLimits: {
	// Memory limits per component
	memory: {
		// Global memory limit for the service
		total: int & >0 & <=(64*1024*1024*1024) // Max 64GB
		
		// Per-shard memory limits
		per_shard: int & >0 & <=(2*1024*1024*1024) // Max 2GB per shard
		
		// Worker pool memory limits
		per_worker: int & >0 & <=(256*1024*1024) // Max 256MB per worker
		
		// Query processing memory limits
		query_buffer: int & >0 & <=(100*1024*1024) // Max 100MB per query
	}
	
	// CPU utilization limits
	cpu: {
		// Maximum CPU utilization percentage
		max_utilization: int & >=10 & <=95 | *85
		
		// CPU affinity and NUMA considerations
		affinity: {
			enabled:    bool | *false
			cpu_set:    [...int] | *[]
			numa_nodes: [...int] | *[]
		}
	}
	
	// Disk I/O limits
	disk: {
		// Maximum IOPS per shard
		max_iops: int & >0 | *10000
		
		// Disk space limits
		max_storage_per_shard: int & >0 | *10*1024*1024*1024 // 10GB per shard
		total_storage_limit:   int & >0 | *1024*1024*1024*1024 // 1TB total
	}
	
	// Network limits
	network: {
		// Maximum concurrent connections
		max_connections: int & >0 & <=10000 | *1000
		
		// Bandwidth limits (bytes per second)
		max_bandwidth: int & >0 | *1000000000 // 1GB/s
		
		// Request rate limiting
		rate_limiting: {
			enabled:         bool | *true
			requests_per_second: int & >0 | *1000
			burst_size:      int & >0 | *100
		}
	}
}

// Validation constraints to prevent common anti-patterns
#LensService: {
	// Ensure worker pools are properly sized relative to each other
	daemon: pools: {
		// Query pool should be larger than ingest pool for read-heavy workloads
		if daemon.pools.query.workers < daemon.pools.ingest.workers {
			daemon.pools.query.workers >= daemon.pools.ingest.workers
		}
		
		// Maintenance pool should be smallest
		daemon.pools.maintenance.workers <= daemon.pools.ingest.workers
		daemon.pools.maintenance.workers <= daemon.pools.query.workers
	}
	
	// Resource constraints must be consistent
	resources: {
		// Per-shard memory must not exceed total memory divided by expected shards
		memory: per_shard <= (memory.total / 10) // Assume at least 10 shards
		
		// Query buffer must be smaller than per-worker memory
		memory: query_buffer <= memory.per_worker
	}
}

// Example configuration that satisfies all constraints
_example: #LensService & {
	name:    "lens-dev"
	version: "v1.0.0"
	
	daemon: {
		pools: {
			ingest: workers:    4
			query: workers:     8
			maintenance: workers: 2
		}
	}
	
	messaging: {
		servers: ["nats://localhost:4222"]
		jetstream: enabled: true
	}
	
	resources: {
		memory: {
			total:        8*1024*1024*1024 // 8GB
			per_shard:    512*1024*1024    // 512MB
			per_worker:   128*1024*1024    // 128MB
			query_buffer: 64*1024*1024     // 64MB
		}
		cpu: max_utilization: 80
	}
}