# End-to-End Docker Compose Tests

**Comprehensive integration testing for Arbiter using Docker Compose and real services**

This test suite validates Arbiter's complete workflow from CUE specification to running applications using Docker Compose orchestration. It ensures that generated configurations work correctly in containerized environments.

## What These Tests Cover

- **Specification to Docker Compose**: CUE specs → Docker Compose configurations
- **Service Integration**: Multi-service applications with proper networking
- **Health Checks**: Automated validation of service startup and readiness
- **Real Environment Testing**: Tests run against actual containerized services
- **Dependency Management**: Service startup ordering and dependency validation
- **End-to-End Workflows**: Complete user journeys from spec to running system

## Test Structure

```
e2e-docker-compose/
├── run-e2e-tests.sh           # Main test runner script
├── docker-compose-e2e.test.ts # Bun/TypeScript test suite
├── docker-compose.yml         # Test service definitions
├── arbiter.assembly.cue       # Test specification
├── app/                       # Generated application code
├── services/                  # Service configurations
├── specs/                     # Additional test specifications
└── scripts/                   # Helper scripts and utilities
```

## Running the Tests

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Bun** runtime
- **Arbiter CLI** available in PATH

### Quick Start

```bash
# Run all e2e tests
./run-e2e-tests.sh

# Run specific test suite
bun test docker-compose-e2e.test.ts

# Run with dependency checking
bun test:e2e:deps
```

### Manual Testing

```bash
# Generate Docker Compose from CUE specification
arbiter generate --target docker-compose

# Start the test stack
docker-compose up -d

# Run health checks
./scripts/health-check.sh

# Stop and cleanup
docker-compose down -v
```

## Test Scenarios

### 1. Basic Service Generation
- Generate Docker Compose from CUE specification
- Validate service definitions and networking
- Test container startup and health checks

### 2. Multi-Service Integration
- Complex applications with multiple interconnected services
- Database, API, and frontend service coordination
- Service discovery and communication validation

### 3. Configuration Management
- Environment variable injection
- Secret and configuration file mounting
- Service-specific configuration validation

### 4. Dependency Orchestration
- Service startup ordering (depends_on)
- Health check dependencies
- Graceful shutdown handling

## Test Configuration

The test suite uses the `arbiter.assembly.cue` specification to define:

```cue
product: {
    name: "E2E Test Application"
    goals: ["Validate Docker Compose generation", "Test service integration"]
}

services: {
    api: {
        kind: "backend"
        language: "typescript"
        port: 3000
        dependencies: ["database"]
    }
    
    database: {
        kind: "postgres"
        port: 5432
        environment: "test"
    }
    
    frontend: {
        kind: "web"
        language: "typescript"
        port: 5173
        dependencies: ["api"]
    }
}
```

## Debugging Failed Tests

### Check Service Logs
```bash
# View all service logs
docker-compose logs

# View specific service logs
docker-compose logs api
docker-compose logs database
```

### Health Check Debugging
```bash
# Manual health check
curl http://localhost:3000/health

# Check service status
docker-compose ps

# Inspect service configuration
docker-compose config
```

### Dependency Issues
```bash
# Check dependency validation
node scripts/check-dependencies.cjs

# Validate service ordering
docker-compose up --no-deps service-name
```

## Performance Expectations

- **Startup Time**: Services should be ready within 30 seconds
- **Health Checks**: All health endpoints respond within 5 seconds
- **Service Discovery**: Inter-service communication established within 10 seconds
- **Graceful Shutdown**: Services stop cleanly within 15 seconds

## Test Data and Fixtures

Test data is managed through:
- **fixtures/**: Static test data and configuration files
- **seeds/**: Database initialization scripts
- **mocks/**: Mock service responses for testing

## Continuous Integration

These tests are designed to run in CI environments:

```yaml
# Example GitHub Actions configuration
- name: Run E2E Tests
  run: |
    cd tests/e2e-docker-compose
    ./run-e2e-tests.sh
  env:
    DOCKER_BUILDKIT: 1
    COMPOSE_DOCKER_CLI_BUILD: 1
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure ports 3000, 5173, 5432 are available
2. **Docker Permissions**: Verify Docker daemon is accessible
3. **Resource Limits**: Increase Docker memory/CPU limits if needed
4. **Network Issues**: Check Docker network configuration

### Reset Environment

```bash
# Complete cleanup
docker-compose down -v --remove-orphans
docker system prune -f

# Rebuild from scratch
./run-e2e-tests.sh --clean
```

## Contributing

When adding new e2e tests:

1. **Update the CUE specification** in `arbiter.assembly.cue`
2. **Add test cases** to `docker-compose-e2e.test.ts`
3. **Update service definitions** in `docker-compose.yml` if needed
4. **Run the full test suite** to ensure no regressions
5. **Update this README** with new test scenarios

## Related Documentation

- **[Docker Compose Documentation](https://docs.docker.com/compose/)**
- **[Arbiter CLI Reference](../../docs/cli-reference.md)**
- **[CUE Language Guide](https://cuelang.org/docs/)**
- **[Testing Strategy](../../docs/testing-strategy.md)**

---

*These tests ensure Arbiter generates production-ready Docker Compose configurations that work reliably in real containerized environments.*