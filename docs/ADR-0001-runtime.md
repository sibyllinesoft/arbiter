# ADR-0001: Bun Runtime Selection

**Status:** Accepted  
**Date:** 2024-08-30  
**Authors:** Development Team  

## Context

We needed to select a runtime environment for the Arbiter CUE editor that would support:
- Real-time collaborative editing with WebSockets
- CUE configuration analysis via subprocess execution
- SQLite persistence for projects and document revisions
- TypeScript development with strict type checking
- Single codebase for both API server and client-side tooling

## Decision

We chose **Bun v1.x** as the primary runtime for the entire application stack.

## Rationale

### Performance Benefits
- **Native TypeScript**: Bun executes TypeScript directly without transpilation overhead
- **Fast startup**: Significantly faster cold starts compared to Node.js + tsc workflows
- **Built-in bundling**: Eliminates need for separate build tools for simple deployments
- **WebSocket performance**: Native WebSocket implementation optimized for high-concurrency connections

### Developer Experience
- **Single runtime**: Use Bun for development, testing, building, and production
- **Unified toolchain**: `bun install`, `bun test`, `bun run` covers all development needs
- **Hot reload**: Built-in `--hot` flag for development server auto-restart
- **Native modules**: Built-in SQLite, WebSocket, and subprocess support

### Architecture Simplification
- **Monorepo support**: Native workspace support for packages/apps structure
- **Database integration**: `bun:sqlite` eliminates external database setup
- **Process spawning**: `Bun.spawn()` provides controlled subprocess execution for CUE CLI
- **Memory efficiency**: Single runtime reduces operational complexity

### Specific Feature Alignment
- **WebSocket + HTTP**: `Bun.serve()` handles both protocols in single server
- **Binary handling**: Excellent support for Y.js binary update relay
- **Stream processing**: Efficient handling of CUE CLI stdout/stderr streams
- **Concurrent execution**: Built-in worker and queue primitives

## Implementation Details

### Server Architecture
```typescript
// Single Bun.serve() call handles both HTTP and WebSocket
Bun.serve({
  port: 3001,
  fetch(req, server) {
    if (server.upgrade(req)) return; // WebSocket upgrade
    return handleHttpRequest(req);   // HTTP API
  },
  websocket: {
    open(ws) { /* collaboration setup */ },
    message(ws, data) { /* real-time updates */ },
    close(ws) { /* cleanup */ }
  }
});
```

### Database Integration
```typescript
import { Database } from 'bun:sqlite';
const db = new Database('./data/arbiter.db', { create: true });
```

### Subprocess Execution
```typescript
import { spawn } from 'bun';
const proc = spawn({
  cmd: ['cue', 'export', 'doc.cue'],
  cwd: tempDir,
  stdout: 'pipe',
  stderr: 'pipe'
});
```

## Alternatives Considered

### Node.js + Express/Fastify
**Pros:**
- Mature ecosystem and tooling
- Well-known deployment patterns
- Extensive library support

**Cons:**
- Requires separate TypeScript compilation step
- Multiple tools needed (ts-node, tsc, build systems)
- Slower development iteration cycle
- Additional complexity for WebSocket + HTTP handling

### Deno
**Pros:**
- Native TypeScript support
- Built-in security model
- Web-standard APIs

**Cons:**
- Less mature ecosystem for real-time applications
- More complex subprocess handling
- Limited SQLite integration options
- Smaller community and tooling ecosystem

### Go + Fiber/Gin
**Pros:**
- Excellent performance characteristics
- Simple deployment model
- Strong concurrency primitives

**Cons:**
- Different language from frontend TypeScript
- Would require separate build processes
- Less suitable for rapid prototyping
- Additional complexity for JSON schema validation

## Known Limitations and Mitigation

### Ecosystem Maturity
**Limitation:** Bun ecosystem is newer than Node.js  
**Mitigation:** 
- Fallback to Node.js for specific tools (e.g., Playwright via `bun x`)
- Extensive testing of critical dependencies
- Docker images available for consistent deployment

### Production Readiness
**Limitation:** Less battle-tested in production environments  
**Mitigation:**
- Comprehensive monitoring and logging
- Gradual rollout strategy
- Fallback deployment option using Node.js runtime

### Debugging Tools
**Limitation:** Fewer debugging tools compared to Node.js  
**Mitigation:**
- Built-in console debugging and logging
- Use of external APM tools for production monitoring
- Comprehensive test coverage to catch issues early

## Consequences

### Positive
- Unified development experience across entire stack
- Faster development iteration cycles
- Simplified deployment and operational model
- Better performance characteristics for real-time features
- Single language/runtime expertise required

### Negative
- Dependency on relatively new runtime
- Potential compatibility issues with some npm packages
- Smaller community for troubleshooting
- May require Node.js fallback for specific tools (e.g., end-to-end testing)

## Future Considerations

### Migration Path
If Bun proves unsuitable for production:
1. API server can be migrated to Node.js with minimal code changes
2. Database schema and WebSocket protocol remain unchanged
3. Frontend build process can use standard Vite + Node.js toolchain

### Scaling Strategy
- Bun's worker support provides horizontal scaling options
- Database can be migrated from SQLite to PostgreSQL without schema changes
- WebSocket clustering can be added using Redis adapter pattern

## References

- [Bun Documentation](https://bun.sh/docs)
- [Bun WebSocket API](https://bun.sh/docs/api/websockets)
- [Bun SQLite Integration](https://bun.sh/docs/api/sqlite)
- [Performance Benchmarks](https://bun.sh/blog/bun-v1.0)

## Review and Updates

This ADR should be reviewed when:
- Bun releases major version updates
- Performance issues arise in production
- Critical ecosystem dependencies become incompatible
- Alternative runtimes demonstrate significant advantages