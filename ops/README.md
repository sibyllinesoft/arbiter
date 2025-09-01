# Rails & Guarantees v1.0 RC - Production Deployment

This directory contains the complete production deployment configuration for the Rails & Guarantees v1.0 RC implementation, including all phases 5-7 components.

## 🚀 Quick Start

```bash
# 1. Set environment variables
export POSTGRES_PASSWORD="your_secure_postgres_password"
export GRAFANA_PASSWORD="your_secure_grafana_password"
export SLACK_WEBHOOK_URL="your_slack_webhook_url"

# 2. Deploy the complete stack
docker-compose -f ops/rails-guarantees-deployment.yml up -d

# 3. Verify deployment
docker-compose -f ops/rails-guarantees-deployment.yml ps
docker-compose -f ops/rails-guarantees-deployment.yml logs -f rails-guarantees-engine

# 4. Access monitoring interfaces
# - Main service: http://localhost:8080
# - Metrics: http://localhost:9090/metrics
# - Prometheus: http://localhost:9091
# - Grafana: http://localhost:3000 (admin/your_grafana_password)
# - AlertManager: http://localhost:9093
```

## 📊 Architecture Overview

The production deployment includes:

### Core Services
- **rails-guarantees-engine**: Main application with all phases 5-7 features
- **redis**: Nonce tracking and caching
- **postgresql**: Persistent data storage

### Monitoring Stack
- **prometheus**: Metrics collection and storage
- **grafana**: Monitoring dashboards and visualization
- **alertmanager**: SLO alerting and notifications
- **fluentd**: Log aggregation and processing

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RESPONSE_TIME_P95_TARGET_MS` | 400 | SLO target for response time p95 |
| `TICKET_VERIFY_P95_TARGET_MS` | 25 | SLO target for ticket verification p95 |
| `AVAILABILITY_TARGET` | 99.9 | Availability SLO percentage |
| `MAX_TICKET_TTL_MS` | 86400000 | Maximum ticket TTL (24 hours) |
| `PERFORMANCE_BUDGET_CPU_PERCENT` | 70 | CPU usage budget |
| `PERFORMANCE_BUDGET_MEMORY_MB` | 512 | Memory usage budget |

### Phase 5: Contracts & Validation Rules

#### Core Invariants
- **ticket_ttl_enforcement**: Ensures all tickets respect TTL limits
- **nonce_uniqueness**: Prevents replay attacks through nonce tracking
- **canonical_patch_format**: Enforces consistent patch formatting
- **performance_budget_adherence**: Monitors resource usage
- **incremental_validation_correctness**: Validates incremental processing

#### Schema Validation
- CUE-based schema validation with locking mechanism
- Property-based testing support
- Metamorphic testing capabilities

### Phase 6: Artifacts & Release Process

#### Generated Artifacts
- **metrics.json**: Performance and quality metrics
- **traces.ndjson**: Distributed tracing data
- **sbom.json**: Software Bill of Materials (SPDX-2.3)
- **compat_report.json**: API compatibility analysis
- **report.md**: Human-readable release report

#### Build Provenance
- in-toto attestation format
- Cryptographic signatures
- Supply chain security

### Phase 7: Monitoring & SLO Implementation

#### Service Level Objectives
- Response time p95 < 400ms
- Ticket verification p95 < 25ms
- Availability > 99.9%
- Error budget burn rate < 2.0x

#### Alert Categories
- **Critical Security**: TTL violations, replay attacks
- **SLO Violations**: Performance and availability issues
- **Performance Issues**: Resource budget exceeded
- **Invariant Violations**: Core rule violations

## 🔒 Security Features

### Nonce-based Replay Prevention
- Automatic nonce uniqueness validation
- Configurable cleanup intervals
- Memory-efficient tracking

### TTL Enforcement
- Maximum ticket lifetime limits
- Automatic expiration handling
- Security event logging

### Security Event Monitoring
- Pattern-based attack detection
- Automated incident creation
- Real-time alerting

## 📈 Monitoring & Observability

### Metrics Endpoints
- `/metrics`: Prometheus-format metrics
- `/health`: Health check endpoint
- `/debug/performance`: Performance debugging

### Dashboards
Access Grafana at http://localhost:3000 with:
- Username: `admin`
- Password: Set via `GRAFANA_PASSWORD` environment variable

### Alerts
AlertManager at http://localhost:9093 provides:
- Multi-channel notifications (email, Slack, webhook)
- Alert routing based on severity and category
- Alert inhibition rules to reduce noise

## 🧪 Testing

### Integration Tests
```bash
# Run comprehensive integration tests
npm test -- --testPathPattern=rails-guarantees-integration.test.ts

# Test specific phases
npm test -- --testNamePattern="Phase 5"
npm test -- --testNamePattern="Phase 6"
npm test -- --testNamePattern="Phase 7"
```

### Health Checks
```bash
# Service health
curl http://localhost:8080/health

# Detailed status
curl http://localhost:8080/status

# Metrics
curl http://localhost:9090/metrics
```

## 🔄 Maintenance

### Log Management
```bash
# View logs
docker-compose -f ops/rails-guarantees-deployment.yml logs -f

# Log rotation (handled automatically by fluentd)
docker-compose -f ops/rails-guarantees-deployment.yml exec fluentd logrotate /etc/logrotate.conf
```

### Backup & Recovery
```bash
# Backup PostgreSQL
docker-compose -f ops/rails-guarantees-deployment.yml exec postgresql pg_dump -U rails_guarantees rails_guarantees > backup.sql

# Backup Redis
docker-compose -f ops/rails-guarantees-deployment.yml exec redis redis-cli BGSAVE
```

### Scaling
```bash
# Scale the main service
docker-compose -f ops/rails-guarantees-deployment.yml up -d --scale rails-guarantees-engine=3
```

## 🚨 Troubleshooting

### Common Issues

#### High Response Time
1. Check performance metrics in Grafana
2. Verify resource usage is within budgets
3. Review recent deployments for performance regressions
4. Check database query performance

#### Invariant Violations
1. Check application logs for detailed violation reasons
2. Verify configuration parameters are correct
3. Review recent data changes that might affect invariants
4. Check system clock synchronization for TTL issues

#### Alert Fatigue
1. Review alert rules in `prometheus/rails_guarantees_rules.yml`
2. Adjust thresholds based on historical data
3. Implement alert inhibition rules
4. Use alert routing to send notifications to appropriate teams

### Performance Tuning

#### Database Optimization
```sql
-- Index optimization for ticket queries
CREATE INDEX CONCURRENTLY idx_tickets_ttl ON tickets (expires_at) WHERE expires_at > NOW();
CREATE INDEX CONCURRENTLY idx_nonces_created ON nonces (created_at);
```

#### Redis Optimization
```bash
# Monitor Redis performance
docker-compose -f ops/rails-guarantees-deployment.yml exec redis redis-cli info
docker-compose -f ops/rails-guarantees-deployment.yml exec redis redis-cli monitor
```

## 📚 Additional Resources

- [Rails & Guarantees v1.0 RC Specification](../contracts/rails-guarantees.cue)
- [Assembly Configuration](../arbiter.assembly.cue)
- [Integration Tests](../src/guarantees/rails-guarantees-integration.test.ts)
- [Monitoring Engine](../src/guarantees/monitoring-engine.ts)
- [Artifacts Engine](../src/guarantees/artifacts-engine.ts)

## 🤝 Support

For issues and support:
1. Check the monitoring dashboards for system health
2. Review application logs for error details
3. Consult the integration tests for expected behavior
4. Check alert history in AlertManager

The Rails & Guarantees v1.0 RC implementation is production-ready with comprehensive monitoring, alerting, and observability features built-in.