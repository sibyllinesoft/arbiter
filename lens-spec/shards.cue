package lens

import (
	"time"
	"path"
	"crypto/md5"
)

// ShardManager defines the memory-mapped segment architecture
#ShardManager: {
	// Shard distribution and management
	sharding: #ShardingConfig
	
	// Storage layer configuration
	storage: #StorageConfig
	
	// Memory mapping configuration
	memory_mapping: #MemoryMappingConfig
	
	// Compaction and maintenance
	compaction: #CompactionConfig
	
	// Shard lifecycle management
	lifecycle: #ShardLifecycleConfig
}

// ShardingConfig defines how data is distributed across shards
#ShardingConfig: {
	// Shard key strategy - must be deterministic and well-distributed
	key_strategy: "path_hash" | "content_hash" | "hybrid" | *"path_hash"
	
	// Hash function for shard key generation
	hash_function: "md5" | "sha256" | "xxhash" | "murmur3" | *"xxhash"
	
	// Number of shards (must be power of 2 for efficient modulo operations)
	shard_count: int & >0 & (shard_count & (shard_count-1)) == 0 | *256
	
	// Shard size limits to prevent unbounded growth
	shard_limits: {
		// Maximum documents per shard
		max_documents: int & >0 & <=10000000 | *1000000 // 1M documents per shard
		
		// Maximum storage size per shard (bytes)
		max_size: int & >0 & <=10*1024*1024*1024 | *2*1024*1024*1024 // 2GB per shard
		
		// Maximum memory usage per shard
		max_memory: int & >0 & <=2*1024*1024*1024 | *512*1024*1024 // 512MB per shard
	}
	
	// Path-hash specific configuration
	if key_strategy == "path_hash" {
		path_normalization: {
			// Normalize path separators for consistent hashing
			normalize_separators: bool | *true
			
			// Case sensitivity for path hashing
			case_sensitive: bool | *true
			
			// Strip common prefixes to improve distribution
			strip_prefixes: [...string] | *["/", "./", "../"]
			
			// Maximum path depth to consider for hashing
			max_depth: int & >=1 & <=20 | *10
		}
	}
	
	// Rebalancing configuration
	rebalancing: {
		enabled: bool | *true
		
		// Trigger rebalancing when shard size variance exceeds threshold
		size_variance_threshold: number & >=0.1 & <=1.0 | *0.3 // 30% variance
		
		// Minimum time between rebalancing operations
		min_rebalance_interval: time.Duration & >=1*time.Hour & <=24*time.Hour | *6*time.Hour
		
		// Maximum number of shards to rebalance concurrently
		max_concurrent_rebalance: int & >=1 & <=10 | *2
	}
}

// StorageConfig defines the append-only storage layer
#StorageConfig: {
	// Base directory for shard storage
	base_path: string & =~"^/[a-zA-Z0-9/_-]+$" // Must be absolute path
	
	// File naming strategy for shard segments
	naming: {
		// Shard directory naming pattern
		shard_dir_pattern: string | *"shard_{shard_id:04d}"
		
		// Segment file naming pattern  
		segment_file_pattern: string | *"segment_{timestamp}_{sequence:06d}.idx"
		
		// Manifest file for shard metadata
		manifest_file: string | *"manifest.json"
		
		// Lock file for shard exclusive access
		lock_file: string | *"shard.lock"
	}
	
	// Append-only segment configuration
	append_only: {
		// Segment size limits before creating new segment
		max_segment_size: int & >0 & <=1024*1024*1024 | *256*1024*1024 // 256MB
		
		// Number of documents per segment
		max_segment_documents: int & >0 & <=1000000 | *100000 // 100k documents
		
		// Segment format version for backwards compatibility
		format_version: int & >=1 & <=100 | *1
		
		// Checksums for data integrity
		checksums: {
			enabled: bool | *true
			algorithm: "crc32" | "md5" | "sha256" | *"crc32"
			
			// Verify checksums on read operations
			verify_on_read: bool | *true
		}
	}
	
	// Storage efficiency optimizations
	compression: {
		enabled: bool | *true
		algorithm: "lz4" | "zstd" | "snappy" | *"lz4" // Fast compression for hot path
		
		// Compression level (algorithm-specific)
		level: int & >=1 & <=22 | *3
		
		// Minimum data size to trigger compression
		min_size: int & >0 | *4096 // 4KB minimum
	}
	
	// File system optimization
	filesystem: {
		// Use direct I/O to bypass page cache for large files
		use_direct_io: bool | *false // Disable by default due to alignment requirements
		
		// File allocation strategy
		fallocate: {
			enabled: bool | *true
			prealloc_size: int & >0 | *64*1024*1024 // Preallocate 64MB
		}
		
		// Sync strategy for durability
		sync_strategy: "none" | "fsync" | "fdatasync" | *"fdatasync"
		
		// Sync frequency for append operations
		sync_frequency: time.Duration & >=100*time.Millisecond & <=10*time.Second | *1*time.Second
	}
}

// MemoryMappingConfig defines memory-mapped file access
#MemoryMappingConfig: {
	// Memory mapping strategy
	strategy: "full_mmap" | "partial_mmap" | "adaptive" | *"adaptive"
	
	// Memory mapping limits
	limits: {
		// Maximum total memory-mapped size
		max_total_mmap: int & >0 & <=100*1024*1024*1024 | *16*1024*1024*1024 // 16GB
		
		// Maximum memory-mapped size per shard
		max_shard_mmap: int & >0 & <=10*1024*1024*1024 | *1*1024*1024*1024 // 1GB per shard
		
		// Memory mapping page size alignment
		page_size: 4096 | 65536 | *4096 // Standard 4KB pages
	}
	
	// Memory mapping behavior
	behavior: {
		// Advise kernel about access patterns
		madvise: {
			enabled: bool | *true
			
			// Access pattern hints
			pattern: "MADV_RANDOM" | "MADV_SEQUENTIAL" | "MADV_WILLNEED" | *"MADV_RANDOM"
			
			// Population strategy for mapped regions
			populate: bool | *false // Don't populate all pages immediately
		}
		
		// Memory locking for performance-critical sections
		mlock: {
			enabled: bool | *false // Disabled by default to avoid excessive memory usage
			
			// Lock frequently accessed segments
			lock_hot_segments: bool | *true
			
			// Maximum locked memory
			max_locked_memory: int & >0 | *512*1024*1024 // 512MB max locked
		}
		
		// Hugepage support for large mappings
		hugepages: {
			enabled: bool | *false // Requires system configuration
			size: 2*1024*1024 | 1024*1024*1024 | *2*1024*1024 // 2MB hugepages
		}
	}
	
	// Memory mapping cache management
	cache: {
		// LRU cache for memory-mapped segments
		enabled: bool | *true
		
		// Maximum number of cached mappings
		max_cached_mappings: int & >0 & <=1000 | *100
		
		// Cache eviction strategy
		eviction_policy: "lru" | "lfu" | "clock" | *"lru"
		
		// Time-based expiration for unused mappings
		expiration: {
			enabled: bool | *true
			idle_timeout: time.Duration & >=1*time.Minute & <=24*time.Hour | *30*time.Minute
			
			// Background cleanup frequency
			cleanup_interval: time.Duration & >=1*time.Minute & <=1*time.Hour | *5*time.Minute
		}
	}
	
	// Fault handling and error recovery
	fault_handling: {
		// Handle SIGBUS signals from memory mapping errors
		handle_sigbus: bool | *true
		
		// Retry strategy for mapping failures
		retry: {
			enabled: bool | *true
			max_retries: int & >=0 & <=5 | *3
			backoff: time.Duration & >=100*time.Millisecond & <=5*time.Second | *1*time.Second
		}
		
		// Fallback to regular file I/O on mapping failure
		fallback_to_read: bool | *true
	}
}

// CompactionConfig defines segment compaction and cleanup
#CompactionConfig: {
	// Compaction scheduling
	scheduling: {
		enabled: bool | *true
		
		// Trigger compaction based on conditions
		triggers: {
			// Compact when fragmentation exceeds threshold
			fragmentation_threshold: number & >=0.1 & <=0.8 | *0.4 // 40% fragmentation
			
			// Compact when segment count exceeds limit
			max_segments_per_shard: int & >=2 & <=1000 | *50
			
			// Time-based compaction
			max_age: time.Duration & >=1*time.Hour & <=7*24*time.Hour | *24*time.Hour // Daily compaction
			
			// Size-based compaction
			min_size_for_compaction: int & >0 | *100*1024*1024 // 100MB minimum
		}
		
		// Compaction scheduling strategy
		strategy: "background" | "scheduled" | "on_demand" | *"background"
		
		// Time windows for compaction operations
		time_windows: {
			enabled: bool | *true
			
			// Preferred time ranges for compaction (UTC)
			allowed_hours: [...int] | *[2, 3, 4, 5] // 2-6 AM UTC
			
			// Days of week to allow compaction (0=Sunday)
			allowed_days: [...int] | *[0, 1, 2, 3, 4, 5, 6] // All days
		}
	}
	
	// Compaction execution
	execution: {
		// Maximum concurrent compaction operations
		max_concurrent: int & >=1 & <=10 | *2
		
		// I/O rate limiting during compaction
		rate_limiting: {
			enabled: bool | *true
			
			// Maximum I/O bandwidth during compaction (bytes/sec)
			max_io_bandwidth: int & >0 | *100*1024*1024 // 100MB/s
			
			// Maximum IOPS during compaction
			max_iops: int & >0 | *1000
			
			// Throttling based on system load
			adaptive_throttling: {
				enabled: bool | *true
				cpu_threshold: number & >=0.5 & <=0.95 | *0.8 // Slow down if CPU > 80%
				io_wait_threshold: number & >=0.1 & <=0.5 | *0.2 // Slow down if IO wait > 20%
			}
		}
		
		// Memory usage during compaction
		memory_limits: {
			// Maximum memory per compaction operation
			max_memory_per_operation: int & >0 & <=1024*1024*1024 | *256*1024*1024 // 256MB
			
			// Buffer sizes for compaction I/O
			read_buffer_size: int & >0 | *64*1024   // 64KB read buffer
			write_buffer_size: int & >0 | *64*1024  // 64KB write buffer
		}
	}
	
	// Compaction strategy
	strategy: {
		// Compaction algorithm
		algorithm: "size_tiered" | "leveled" | "time_window" | *"size_tiered"
		
		// Merge strategy for overlapping data
		merge_strategy: "last_wins" | "timestamp" | "custom" | *"timestamp"
		
		// Garbage collection of deleted entries
		gc_deleted_entries: bool | *true
		
		// Minimum age before entries can be garbage collected
		gc_min_age: time.Duration & >=1*time.Hour & <=7*24*time.Hour | *24*time.Hour
	}
	
	// Compaction validation and safety
	validation: {
		// Verify compacted segments before replacing originals
		verify_after_compaction: bool | *true
		
		// Checksum validation
		verify_checksums: bool | *true
		
		// Keep backup of original segments during compaction
		backup_originals: bool | *true
		backup_retention: time.Duration & >=1*time.Hour & <=7*24*time.Hour | *48*time.Hour
		
		// Rollback capability
		rollback: {
			enabled: bool | *true
			timeout: time.Duration & >=1*time.Minute & <=1*time.Hour | *10*time.Minute
		}
	}
}

// ShardLifecycleConfig defines shard creation, management, and cleanup
#ShardLifecycleConfig: {
	// Shard creation policies
	creation: {
		// Strategy for creating new shards
		strategy: "eager" | "lazy" | "on_demand" | *"lazy"
		
		// Permissions for shard directories and files
		permissions: {
			directory_mode: int & >=0o700 & <=0o777 | *0o755
			file_mode: int & >=0o600 & <=0o777 | *0o644
		}
		
		// Initial shard configuration
		initial_config: {
			// Pre-allocate space for new shards
			preallocate_space: bool | *true
			preallocation_size: int & >0 | *64*1024*1024 // 64MB
			
			// Create initial index structures
			create_initial_indexes: bool | *true
		}
	}
	
	// Shard monitoring and health checks
	health_monitoring: {
		enabled: bool | *true
		
		// Health check frequency
		check_interval: time.Duration & >=1*time.Minute & <=1*time.Hour | *5*time.Minute
		
		// Health check operations
		checks: {
			// Verify file system accessibility
			filesystem_access: bool | *true
			
			// Check memory mapping status
			memory_mapping_health: bool | *true
			
			// Validate segment integrity
			segment_integrity: bool | *true
			
			// Check for corruption
			corruption_detection: bool | *true
		}
		
		// Actions on health check failures
		failure_handling: {
			// Maximum consecutive failures before marking shard unhealthy
			max_failures: int & >=1 & <=10 | *3
			
			// Automatic recovery attempts
			auto_recovery: {
				enabled: bool | *true
				max_recovery_attempts: int & >=0 & <=5 | *2
				
				// Recovery strategies
				strategies: [...string] | *["remap_memory", "rebuild_indexes", "restore_from_backup"]
			}
			
			// Alerting on persistent failures
			alerting: {
				enabled: bool | *true
				alert_after: time.Duration & >=1*time.Minute & <=1*time.Hour | *15*time.Minute
			}
		}
	}
	
	// Shard cleanup and archival
	cleanup: {
		// Orphaned shard detection and cleanup
		orphan_cleanup: {
			enabled: bool | *true
			
			// Age threshold for considering shards orphaned
			orphan_age_threshold: time.Duration & >=1*time.Hour & <=30*24*time.Hour | *7*24*time.Hour
			
			// Verification before cleanup
			verify_before_cleanup: bool | *true
		}
		
		// Temporary file cleanup
		temp_file_cleanup: {
			enabled: bool | *true
			
			// Age threshold for temporary files
			temp_age_threshold: time.Duration & >=1*time.Hour & <=24*time.Hour | *6*time.Hour
			
			// Cleanup frequency
			cleanup_frequency: time.Duration & >=1*time.Hour & <=24*time.Hour | *4*time.Hour
		}
		
		// Archive old shards
		archival: {
			enabled: bool | *false // Disabled by default
			
			// Archive shards older than threshold
			archive_age_threshold: time.Duration & >=7*24*time.Hour & <=365*24*time.Hour | *90*24*time.Hour
			
			// Archive storage location
			archive_path: string | *""
			
			// Compression for archived shards
			archive_compression: {
				enabled: bool | *true
				algorithm: "gzip" | "xz" | "zstd" | *"zstd"
				level: int & >=1 & <=22 | *6
			}
		}
	}
}

// Shard validation constraints to prevent common issues
#ShardManager: {
	// Ensure shard count is reasonable for the system
	sharding: {
		// Don't create too many small shards
		if sharding.shard_count > 1024 {
			sharding.shard_limits.max_documents >= 100000 // Ensure shards won't be too small
		}
		
		// Don't create too few large shards
		if sharding.shard_count < 16 {
			sharding.shard_limits.max_size <= 5*1024*1024*1024 // Limit shard size to 5GB
		}
	}
	
	// Memory mapping limits must be consistent with shard limits
	memory_mapping: {
		// Per-shard memory mapping should not exceed shard memory limit
		limits: max_shard_mmap <= sharding.shard_limits.max_memory
		
		// Total memory mapping should be reasonable for the number of shards
		limits: max_total_mmap >= (sharding.shard_count * limits.max_shard_mmap / 4) // Allow 25% utilization
	}
	
	// Storage and memory mapping must be compatible
	storage: {
		// Segment size should be reasonable for memory mapping
		append_only: max_segment_size <= memory_mapping.limits.max_shard_mmap / 2
	}
	
	// Compaction configuration must be reasonable
	compaction: {
		// Don't compact too aggressively
		scheduling: triggers: max_segments_per_shard >= 5
		
		// Ensure enough concurrent operations for the number of shards
		execution: max_concurrent >= (sharding.shard_count / 128) // At least 1 per 128 shards
	}
}

// Example shard configuration that meets all constraints
_example_shards: #ShardManager & {
	sharding: {
		key_strategy: "path_hash"
		hash_function: "xxhash"  
		shard_count: 256
		shard_limits: {
			max_documents: 1000000
			max_size: 2*1024*1024*1024      // 2GB
			max_memory: 512*1024*1024        // 512MB
		}
	}
	
	storage: {
		base_path: "/var/lib/lens/shards"
		append_only: {
			max_segment_size: 256*1024*1024  // 256MB
			max_segment_documents: 100000
		}
		compression: {
			enabled: true
			algorithm: "lz4"
		}
	}
	
	memory_mapping: {
		strategy: "adaptive"
		limits: {
			max_total_mmap: 16*1024*1024*1024 // 16GB
			max_shard_mmap: 512*1024*1024      // 512MB per shard
		}
	}
	
	compaction: {
		scheduling: triggers: {
			fragmentation_threshold: 0.4
			max_segments_per_shard: 20
		}
		execution: max_concurrent: 2
	}
}