# Arbiter Watch System Documentation

## Overview

The Arbiter Watch System implements a continuous validation loop as specified in TODO.md lines 186-191. It provides real-time monitoring of CUE files, UI profiles, contracts, and source code with intelligent change detection, resource management, and structured NDJSON output.

## Architecture

The watch system consists of four main components:

### 1. File Watcher System (`src/watcher/`)
- **Purpose**: Monitor file system changes with intelligent debouncing
- **Features**:
  - Monitors CUE files, UI profiles, contracts, and source code
  - Intelligent change detection with content-based filtering
  - Configurable file patterns and exclusions
  - Debouncing to prevent excessive validation cycles

### 2. Validation Pipeline (`src/lib/validation-pipeline.ts`)
- **Purpose**: Orchestrate the validation workflow
- **Phases**: validate → surface → UI gates → contracts → budgets
- **Features**:
  - Incremental validation (fast mode) - only validates changed files
  - Parallel execution of independent validations
  - Intelligent dependency tracking
  - Early termination on critical failures

### 3. Resource Manager (`src/lib/resource-manager.ts`)
- **Purpose**: Enforce resource limits and manage system load
- **Limits**:
  - Maximum payload size: ≤ 64 KB per validation
  - Maximum processing time: ≤ 750 ms per phase
  - Maximum rate: ~1 validation per second
- **Features**:
  - Automatic batching of validation requests
  - Exponential backoff on resource pressure
  - Queue management with priority handling
  - Resource usage monitoring and warnings

### 4. Output Streamer (`src/lib/output-streamer.ts`)
- **Purpose**: Structured output in NDJSON format
- **Output Format**: `{ phase, ok, deltas, coverage }`
- **Features**:
  - Buffered output with configurable flush intervals
  - Multiple output formats (NDJSON, JSON, human-readable table)
  - Output validation and size monitoring
  - File or stdout output options

## Command Usage

### Basic Usage

```bash
# Monitor all CUE/JSON/YAML files with NDJSON output
arbiter watch

# Monitor specific file patterns
arbiter watch --patterns="**/*.cue,spec/**/*.yaml"

# Fast mode with selective validation
arbiter watch --fast --selective=validate,ui

# Save output to file
arbiter watch --output=validation.ndjson

# Human-readable table format
arbiter watch --format=table
```

### Advanced Configuration

```bash
# Custom resource limits
arbiter watch --timeout=1000 --max-rate=2 --max-payload=131072

# Performance tuning
arbiter watch --parallel=8 --buffer-size=100 --debounce=500

# Verbose logging for debugging
arbiter watch --verbose --format=table
```

## Output Formats

### NDJSON Format (Default)

Each line is a JSON object representing a validation event:

```json
{"type":"validation-phase","timestamp":"2024-01-01T12:00:00.000Z","phase":"validate","ok":true,"deltas":[{"file":"spec/app.cue","type":"change","timestamp":"2024-01-01T12:00:00.000Z"}],"coverage":{"contracts":0.85,"scenarios":0.72,"ui":0.90,"budgets":0.95},"processingTime":245}

{"type":"validation-phase","timestamp":"2024-01-01T12:00:00.500Z","phase":"surface","ok":true,"deltas":[{"file":"spec/app.cue","type":"change","timestamp":"2024-01-01T12:00:00.000Z"}],"coverage":{"contracts":0.85,"scenarios":0.72,"ui":0.90,"budgets":0.95},"processingTime":123}

{"type":"batch-complete","timestamp":"2024-01-01T12:00:01.000Z","batchId":"batch-1704110400000-abc123","totalPhases":5,"successfulPhases":5,"totalProcessingTime":750,"overallCoverage":{"contracts":0.85,"scenarios":0.72,"ui":0.90,"budgets":0.95}}
```

### Table Format (Human-Readable)

```
12:00:00 ✅ validate    245ms   1Δ C:85% S:72% U:90% B:95%
12:00:00 ✅ surface     123ms   1Δ C:85% S:72% U:90% B:95%
12:00:00 ✅ ui          89ms    1Δ C:85% S:72% U:90% B:95%
12:00:00 ✅ contracts   156ms   1Δ C:85% S:72% U:90% B:95%
12:00:00 ✅ budgets     137ms   1Δ C:85% S:72% U:90% B:95%
12:00:01 📦 BATCH batch-1704110400000-abc123 - 5/5 phases OK (750ms)
```

## Validation Phases

### 1. Validate
- **Purpose**: CUE file syntax and semantic validation
- **Fast Mode**: Only validates changed files
- **Critical**: Failure stops the batch (unless in fast mode)

### 2. Surface
- **Purpose**: API surface analysis and compatibility checking
- **Dependencies**: Requires valid CUE files from validate phase

### 3. UI Gates
- **Purpose**: UI profile validation and accessibility checks
- **Coverage Metrics**: UI compliance percentage
- **Checks**: Routes, accessibility, i18n, performance, design tokens

### 4. Contracts
- **Purpose**: Contract validation and coverage analysis
- **Coverage Metrics**: Contract coverage, scenario coverage
- **Validation**: Property tests, scenario tests, fault tolerance

### 5. Budgets
- **Purpose**: Resource budget compliance checking
- **Coverage Metrics**: Budget compliance percentage
- **Validation**: Memory, CPU, network, storage budgets

## Resource Management

### Automatic Resource Limits

The system automatically enforces the following limits:

- **Payload Size**: 64 KB maximum per validation batch
- **Processing Time**: 750 ms maximum per validation phase
- **Rate Limiting**: ~1 validation per second (configurable)

### Backoff Strategy

When resources are under pressure, the system applies exponential backoff:

1. **Detection**: High processing times, error rates, or resource usage
2. **Backoff**: Exponential delay with jitter (1s base, max 30s)
3. **Recovery**: Automatic retry when conditions improve

### Queue Management

Validation requests are queued with priority handling:

- **Priority Levels**: Critical changes (dependencies) get higher priority
- **Batching**: Multiple file changes are batched together
- **Fairness**: Round-robin processing to prevent starvation

## Integration with External Systems

### NDJSON Consumer Example

```javascript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
  input: createReadStream('validation.ndjson'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  const event = JSON.parse(line);
  
  if (event.type === 'validation-phase' && !event.ok) {
    console.log(`❌ ${event.phase} failed:`, event.errors);
  }
  
  if (event.type === 'batch-complete') {
    const successRate = event.successfulPhases / event.totalPhases;
    console.log(`📊 Batch success rate: ${(successRate * 100).toFixed(1)}%`);
  }
});
```

### CI/CD Integration

```bash
# Run continuous validation for 5 minutes, exit on first failure
timeout 300 arbiter watch --output=ci-validation.ndjson --fast &
WATCH_PID=$!

# Process the output in real-time
tail -f ci-validation.ndjson | while read -r line; do
  if echo "$line" | jq -e '.ok == false' > /dev/null; then
    echo "❌ Validation failed, stopping CI"
    kill $WATCH_PID
    exit 1
  fi
done
```

## Configuration Files

### Watch Configuration

Create `.arbiter/watch.json` to customize watch behavior:

```json
{
  "patterns": [
    "**/*.cue",
    "**/*.json",
    "spec/**/*.yaml"
  ],
  "excluded": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**"
  ],
  "phases": [
    "validate",
    "surface",
    "ui",
    "contracts",
    "budgets"
  ],
  "resourceLimits": {
    "maxPayloadBytes": 65536,
    "maxProcessingTimeMs": 750,
    "maxRatePerSecond": 1.0
  },
  "output": {
    "format": "ndjson",
    "bufferSize": 50,
    "flushInterval": 1000
  }
}
```

## Troubleshooting

### Common Issues

#### High Resource Usage
```bash
# Check resource usage with verbose logging
arbiter watch --verbose --format=table

# Reduce parallel validations
arbiter watch --parallel=2

# Enable fast mode to reduce validation scope
arbiter watch --fast --selective=validate
```

#### Validation Errors
```bash
# Get detailed error information
arbiter watch --verbose --format=table

# Test individual phases
arbiter check  # Manual validation
```

#### Performance Issues
```bash
# Increase debounce time to reduce validation frequency
arbiter watch --debounce=1000

# Reduce output buffer size for more responsive output
arbiter watch --buffer-size=10

# Use selective validation for faster feedback
arbiter watch --selective=validate,ui
```

### Debug Mode

Enable verbose logging and table format for debugging:

```bash
arbiter watch --verbose --format=table --debounce=100
```

This provides:
- Real-time validation status
- Detailed timing information
- Resource usage warnings
- Error details with file locations

## Development

### Adding New Validation Phases

1. **Update ValidationPipeline** (`src/lib/validation-pipeline.ts`):
   ```typescript
   case 'my-new-phase':
     return await this.runMyNewPhaseValidation(filesToValidate);
   ```

2. **Implement Validation Logic**:
   ```typescript
   private async runMyNewPhaseValidation(filesToValidate: Set<string>) {
     // Your validation logic here
     return {
       ok: true,
       coverage: { contracts: 0, scenarios: 0, ui: 0, budgets: 0 },
       errors: []
     };
   }
   ```

3. **Update Phase Configuration**:
   ```bash
   arbiter watch --selective=validate,surface,ui,contracts,budgets,my-new-phase
   ```

### Testing

The watch system includes comprehensive testing:

```bash
# Test basic functionality
bun test src/lib/

# Test file watcher integration
bun test src/watcher/

# Test CLI integration
bun run src/cli/index.ts watch --help
```

## Performance Characteristics

### Typical Performance

- **Startup Time**: < 2 seconds
- **File Change Detection**: < 100ms
- **Validation Latency**: 200-750ms per phase
- **Memory Usage**: < 50MB base, < 100MB under load
- **CPU Usage**: < 10% idle, < 50% during validation

### Scale Limits

- **Files Monitored**: Up to 10,000 files efficiently
- **Validation Rate**: ~1-5 validations/second sustained
- **Output Rate**: Up to 1000 events/second
- **Memory**: Scales with number of files and validation history

## Security Considerations

- **Input Validation**: All file paths and patterns are validated
- **Resource Limits**: Hard limits prevent resource exhaustion
- **Output Sanitization**: All output is sanitized and validated
- **Access Control**: Only monitors files readable by the process
- **No Network Access**: Validation is local-only by default