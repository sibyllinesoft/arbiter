# Arbiter File Watcher System

A comprehensive file watching and validation system for CUE files with real-time validation, contract execution, and NDJSON output for agent consumption.

## Overview

The file watcher system provides:

- **Real-time CUE file monitoring** with configurable watch patterns
- **Live validation** with syntax, semantic, contract, schema, and dependency checking
- **NDJSON output stream** for structured agent integration
- **Debounced validation** for optimal performance
- **Cross-file dependency tracking** with incremental validation
- **Comprehensive error reporting** with context and line information
- **Performance metrics** and health monitoring

## Architecture

```
┌─────────────────┐    ┌───────────────────┐    ┌─────────────────┐
│   FileWatcher   │───▶│  ChangeDetector   │───▶│  LiveValidator  │
│   (chokidar)    │    │   (dependency     │    │   (CUE + contracts)
│                 │    │    tracking)      │    │                 │
└─────────────────┘    └───────────────────┘    └─────────────────┘
         │                                                │
         ▼                                                ▼
┌─────────────────┐                              ┌─────────────────┐
│ NDJSONReporter  │◄─────────────────────────────│ ValidationResult│
│  (structured    │                              │   (errors,      │
│   output)       │                              │   warnings)     │
└─────────────────┘                              └─────────────────┘
```

## Components

### FileWatcher (`watcher.ts`)
- Main orchestrator using chokidar for file system monitoring
- Handles debouncing and batch processing
- Manages lifecycle and graceful shutdown
- Emits structured events for agent consumption

### LiveValidator (`validator.ts`)
- Performs CUE syntax and semantic validation
- Executes contracts using the contract engine
- Validates schemas and dependencies
- Supports parallel validation with configurable limits

### ChangeDetector (`change-detector.ts`)
- Tracks file modifications and content hashes
- Builds and maintains dependency graphs
- Determines incremental vs full validation requirements
- Detects circular dependencies

### NDJSONReporter (`ndjson-reporter.ts`)
- Formats all output as NDJSON for agent consumption
- Supports filtering and aggregation
- Provides buffering and streaming capabilities
- Handles structured error reporting

## Usage

### Basic Usage

```typescript
import { createFileWatcher } from './src/watcher';

const watcher = createFileWatcher(['./cue-files'], {
  validation: {
    enableContracts: true,
    enableDependencyCheck: true,
    debounceMs: 300,
  },
  output: {
    format: 'ndjson',
    stream: process.stdout,
  },
});

await watcher.start();
```

### CLI Usage

```bash
# Start watching current directory
bun run watch

# Watch specific directories
bun run src/watcher/cli.ts ./contracts ./schemas

# Development mode with auto-restart
bun run watch:dev
```

### Package.json Scripts

- `bun run watch` - Start file watcher for current directory
- `bun run watch:dev` - Start with auto-restart on code changes

## Configuration

### WatcherConfig

```typescript
interface WatcherConfig {
  watchPaths: string[];                    // Paths to monitor
  watchOptions: {
    ignored?: string[];                    // Patterns to ignore
    ignoreInitial?: boolean;               // Skip initial scan
    followSymlinks?: boolean;              // Follow symbolic links
    depth?: number;                        // Maximum depth to watch
    awaitWriteFinish?: {
      stabilityThreshold?: number;         // Wait for file stability
      pollInterval?: number;               // Check interval
    };
  };
  validation: {
    debounceMs: number;                    // Debounce validation (300ms)
    batchSize: number;                     // Files per batch (10)
    timeout: number;                       // Validation timeout (30s)
    enableContracts: boolean;              // Enable contract validation
    enableDependencyCheck: boolean;        // Enable dependency validation
    parallelValidations: number;           // Concurrent validations (4)
  };
  output: {
    format: 'ndjson' | 'json' | 'text';   // Output format
    stream: NodeJS.WritableStream;         // Output stream
    bufferSize: number;                    // Buffer size (100)
    flushInterval: number;                 // Flush interval (1000ms)
  };
  heartbeat: {
    enabled: boolean;                      // Enable heartbeat
    interval: number;                      // Heartbeat interval (30s)
  };
}
```

## NDJSON Output Format

The watcher outputs structured data in NDJSON format for agent consumption:

### File Events
```json
{
  "type": "file-event",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "type": "change",
    "path": "contracts/user.cue",
    "stats": {
      "size": 1024,
      "mtime": "2024-01-15T10:29:55Z",
      "ctime": "2024-01-15T10:29:55Z"
    }
  }
}
```

### Validation Results
```json
{
  "type": "validation-result",
  "timestamp": "2024-01-15T10:30:01Z",
  "data": {
    "filePath": "contracts/user.cue",
    "status": "error",
    "validationType": "syntax",
    "errors": [{
      "type": "syntax",
      "severity": "error",
      "message": "expected '}', found 'EOF'",
      "line": 15,
      "column": 1
    }],
    "warnings": [],
    "duration": 150,
    "dependencies": ["schemas/base.cue"]
  }
}
```

### Heartbeat
```json
{
  "type": "heartbeat",
  "timestamp": "2024-01-15T10:30:30Z",
  "data": {
    "uptime": 30000,
    "filesWatched": 25,
    "validationsRun": 100,
    "errorsCount": 3
  }
}
```

### Status Updates
```json
{
  "type": "status",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "status": "running",
    "message": "File watcher is running",
    "watchedPaths": ["./contracts", "./schemas"],
    "activeValidations": 2
  }
}
```

## Validation Types

The system supports multiple validation types:

1. **Syntax** - CUE syntax validation using `cue fmt --check`
2. **Semantic** - CUE semantic validation using `cue vet`
3. **Contract** - Contract execution using the arbiter contract engine
4. **Schema** - Schema structure validation
5. **Dependency** - Cross-file dependency validation

## Performance Features

- **Debounced validation** prevents excessive processing during rapid file changes
- **Incremental validation** only revalidates affected files when dependencies haven't changed
- **Parallel validation** with configurable concurrency limits
- **Content hashing** for efficient change detection
- **Dependency graph caching** for fast impact analysis

## Error Handling

The system provides comprehensive error handling:

- **Structured error reporting** with file paths, line numbers, and context
- **Error categorization** by type and severity
- **Graceful degradation** when external tools fail
- **Automatic recovery** from transient failures
- **Timeout protection** for long-running validations

## Integration with Arbiter

The watcher integrates with the existing arbiter ecosystem:

- **Contract Engine** - Uses existing contract execution and validation
- **Shared Types** - Leverages types from `src/contracts/types.ts`
- **Logger** - Uses centralized logging utility
- **Package Structure** - Follows arbiter monorepo conventions

## Agent Consumption

The NDJSON output is designed for agent consumption:

```typescript
// Example agent integration
import { createFileWatcher } from '@arbiter/watcher';

const watcher = createFileWatcher(['./workspace'], {
  output: {
    format: 'ndjson',
    stream: agentInputStream,
  },
});

agentInputStream.on('data', (line) => {
  const event = JSON.parse(line);
  
  switch (event.type) {
    case 'validation-result':
      if (event.data.status === 'error') {
        await handleValidationError(event.data);
      }
      break;
      
    case 'file-event':
      await trackFileChange(event.data);
      break;
  }
});
```

## Development

### Dependencies

- `chokidar` - File system monitoring
- `zod` - Schema validation
- Node.js built-ins - File system, crypto, child_process

### Testing

```bash
# Run validation tests
bun test src/watcher/*.test.ts

# Run with coverage
bun test --coverage src/watcher/
```

### Debugging

Set the `DEBUG` environment variable to enable debug logging:

```bash
DEBUG=1 bun run watch
```

## Security Considerations

- **File path validation** prevents directory traversal
- **Input sanitization** for all external inputs
- **Process timeout** prevents DoS via long-running validations
- **Resource limits** prevent memory exhaustion
- **Safe error handling** prevents information disclosure

## Future Enhancements

- WebSocket output for real-time agent communication
- Plugin system for custom validation types
- Distributed validation across multiple workers
- Machine learning for intelligent validation prioritization
- Integration with IDEs and editors