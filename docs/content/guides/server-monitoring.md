# Server Monitoring & Error Handling

This document describes the enhanced monitoring and error handling system
implemented for the Arbiter API server.

## Overview

The API server was experiencing frequent crashes/deaths. To address this, we've
implemented comprehensive monitoring, error handling, and diagnostics to help
identify and prevent issues before they cause server crashes.

## Enhanced Error Handling Features

### 1. Process Monitor (`ProcessMonitor` class)

**Location**: `apps/api/src/server.ts`

**Features**:

- **Health Logging**: Logs process health every 30 seconds with:
  - Uptime, PID, Node.js version, platform
  - Memory usage (RSS, heap used/total, external)
  - CPU usage (user/system time)
  - Error count tracking
- **Memory Monitoring**: Checks memory usage every 10 seconds
  - Warns when heap usage exceeds 500MB
  - Triggers garbage collection if available
- **Uncaught Exception Handling**: Catches and logs all uncaught exceptions
  - Tracks error count and initiates shutdown after 5 exceptions
- **Unhandled Rejection Handling**: Catches promise rejections
  - Initiates shutdown after 10 unhandled rejections
- **Process Events**: Monitors warnings, beforeExit, and exit events
- **Graceful Shutdown**: 10-second timeout for clean shutdown

### 2. Enhanced WebSocket Error Handling

**Location**: `apps/api/src/websocket/index.ts`

**Improvements**:

- **Header Validation**: Validates WebSocket upgrade headers
- **Authentication Timeout**: 5-second timeout for auth requests
- **Connection Tracking**: Better connection ID generation and tracking
- **Message Validation**: Size limits (5MB), JSON parsing, structure validation
- **Timeout Handling**: 10-second timeout for message processing
- **Error Responses**: Sends structured error messages to clients
- **Connection Cleanup**: Enhanced disconnection handling with timeouts

### 3. Startup Retry Logic

**Features**:

- **Retry on Failure**: Up to 3 startup attempts with progressive delays
- **Startup Logging**: Clear startup attempt tracking
- **Configuration Validation**: Early configuration error detection

## Monitoring Tools

### 1. Server Monitoring Script

**Location**: `scripts/monitor-server.sh`

**Usage**:

```bash
# Monitor with default 30-second intervals
./scripts/monitor-server.sh

# Monitor with custom interval (e.g., every 5 seconds)
./scripts/monitor-server.sh 5
```

**Features**:

- **Health Checks**: Tests `/health` endpoint
- **WebSocket Monitoring**: Validates WebSocket upgrade capability
- **Process Monitoring**: Tracks server processes, memory, and CPU usage
- **Failure Tracking**: Counts consecutive failures and alerts
- **Logging**: Writes detailed logs to `/tmp/arbiter-monitor.log`
- **Real-time Status**: Visual status indicators for API, WebSocket, and
  processes

### 2. Built-in Process Health Logs

**What it logs**:

```json
{
  "level": "info",
  "message": "📊 Process Health Check",
  "timestamp": "2025-09-20T15:07:51.453Z",
  "uptime": 211,
  "pid": 430772,
  "nodeVersion": "v24.3.0",
  "platform": "linux",
  "errorCount": 0,
  "memory": {
    "rss": "124MB",
    "heapUsed": "20MB",
    "heapTotal": "16MB",
    "external": "5MB"
  },
  "cpu": {
    "user": 888416,
    "system": 432171
  }
}
```

## Error Detection & Alerting

### Automatic Triggers

1. **Memory Warnings**: When heap usage > 500MB
2. **Error Accumulation**: After 5 uncaught exceptions or 10 unhandled
   rejections
3. **Timeout Issues**: Authentication, message handling, or shutdown timeouts
4. **Connection Problems**: WebSocket upgrade failures or connection issues

### Manual Monitoring

1. **External Script**: Use `monitor-server.sh` for continuous monitoring
2. **Log Analysis**: Filter server logs for error patterns:
   ```bash
   # Filter for errors and warnings
   tail -f logs/server.log | grep -E "(❌|⚠️|🚨|ERROR|WARN)"
   ```

## Debugging Server Deaths

### When the server dies, check:

1. **Process Health Logs**: Look for memory warnings or error accumulation

   ```bash
   grep "📊\|❌\|⚠️\|🚨" /path/to/server/logs
   ```

2. **Memory Usage**: Check if memory was growing before crash

   ```bash
   grep "Process Health Check" /path/to/server/logs | tail -10
   ```

3. **Error Patterns**: Look for uncaught exceptions or unhandled rejections

   ```bash
   grep "UNCAUGHT EXCEPTION\|UNHANDLED PROMISE REJECTION" /path/to/server/logs
   ```

4. **External Monitoring**: Check monitoring script logs
   ```bash
   tail -f /tmp/arbiter-monitor.log
   ```

## Prevention Strategies

### Memory Management

- Automatic garbage collection when memory is high
- Memory usage alerts at 500MB threshold
- Process restart after consistent high memory usage

### Error Recovery

- Graceful degradation with structured error responses
- Connection cleanup on WebSocket errors
- Retry logic for startup failures

### Monitoring

- Continuous health checks every 30 seconds
- External monitoring script for independent oversight
- Detailed error logging with context

## Usage Examples

### Start with Enhanced Monitoring

```bash
# Start the server (already includes built-in monitoring)
bun run dev

# Start external monitoring in another terminal
./scripts/monitor-server.sh
```

### Monitor Process Health

```bash
# Watch health check logs in real-time
tail -f logs/server.log | grep "📊 Process Health Check"

# Check memory usage trends
grep "📊 Process Health Check" logs/server.log | jq '.memory.heapUsed'
```

### Debug Issues

```bash
# Look for error patterns
grep -E "(❌|⚠️|🚨)" logs/server.log | tail -20

# Check error count progression
grep "errorCount" logs/server.log | tail -10
```

## Alert Thresholds

- **Memory Warning**: Heap usage > 500MB
- **Error Shutdown**: 5 uncaught exceptions OR 10 unhandled rejections
- **Monitoring Alert**: 5 consecutive health check failures
- **Timeout Limits**: 5s auth, 10s message handling, 10s shutdown

This system should help identify what's causing the server to die and provide
early warnings before crashes occur.
