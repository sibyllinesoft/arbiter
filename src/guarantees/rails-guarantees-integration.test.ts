/**
 * Rails & Guarantees v1.0 RC - Comprehensive Integration Tests
 * Tests for Phases 5-7 implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

// Import our engines
import { createInvariantEngine, InvariantEngine } from './invariants-engine';
import { createSchemaValidationEngine, SchemaValidationEngine } from './schema-validation-engine';
import { createArtifactsEngine, ArtifactsEngine } from './artifacts-engine';
import { createMonitoringEngine, MonitoringEngine } from './monitoring-engine';

describe('Rails & Guarantees v1.0 RC Integration Tests', () => {
  let tempDir: string;
  let invariantEngine: InvariantEngine;
  let schemaEngine: SchemaValidationEngine;
  let artifactsEngine: ArtifactsEngine;
  let monitoringEngine: MonitoringEngine;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'rails-guarantees-test-'));
    
    // Initialize engines
    invariantEngine = createInvariantEngine();
    schemaEngine = createSchemaValidationEngine(join(tempDir, 'cue.schema.lock'));
    artifactsEngine = createArtifactsEngine(tempDir);
    monitoringEngine = createMonitoringEngine(join(tempDir, 'logs'));
  });

  afterEach(async () => {
    // Cleanup
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Phase 5: Contracts & Validation Rules', () => {
    describe('Ticket TTL Enforcement', () => {
      it('should validate ticket expiration correctly', async () => {
        const now = Date.now();
        const validTicket = {
          exp: now + 60 * 60 * 1000, // 1 hour from now
          iat: now - 60 * 1000, // 1 minute ago
          repo_id: 'test-repo',
          nonce: 'test-nonce-1'
        };

        const result = await invariantEngine.validateInvariant(
          'ticket_ttl_enforcement',
          validTicket,
          {
            timestamp: now,
            operation: 'ticket_validation',
            input: validTicket,
            environment: { test: true },
            performance: { startTime: now }
          }
        );

        expect(result).toHaveLength(0);
      });

      it('should reject expired tickets', async () => {
        const now = Date.now();
        const expiredTicket = {
          exp: now - 60 * 1000, // 1 minute ago
          iat: now - 120 * 1000, // 2 minutes ago
          repo_id: 'test-repo',
          nonce: 'test-nonce-2'
        };

        const result = await invariantEngine.validateInvariant(
          'ticket_ttl_enforcement',
          expiredTicket,
          {
            timestamp: now,
            operation: 'ticket_validation',
            input: expiredTicket,
            environment: { test: true },
            performance: { startTime: now }
          }
        );

        expect(result).toHaveLength(1);
        expect(result[0].message).toContain('expired');
      });

      it('should reject tickets with excessive TTL', async () => {
        const now = Date.now();
        const longTTLTicket = {
          exp: now + 48 * 60 * 60 * 1000, // 48 hours from now (exceeds 24h max)
          iat: now,
          repo_id: 'test-repo',
          nonce: 'test-nonce-3'
        };

        const result = await invariantEngine.validateInvariant(
          'ticket_ttl_enforcement',
          longTTLTicket,
          {
            timestamp: now,
            operation: 'ticket_validation',
            input: longTTLTicket,
            environment: { test: true },
            performance: { startTime: now }
          }
        );

        expect(result).toHaveLength(1);
        expect(result[0].message).toContain('exceeds maximum');
      });
    });

    describe('Nonce Uniqueness', () => {
      it('should accept first use of nonce', async () => {
        const ticket = {
          repo_id: 'test-repo',
          nonce: 'unique-nonce-1',
          exp: Date.now() + 60 * 60 * 1000
        };

        const result = await invariantEngine.validateInvariant(
          'nonce_uniqueness',
          ticket,
          {
            timestamp: Date.now(),
            operation: 'nonce_validation',
            input: ticket,
            environment: { test: true },
            performance: { startTime: Date.now() }
          }
        );

        expect(result).toHaveLength(0);
      });

      it('should reject duplicate nonce within TTL window', async () => {
        const ticket1 = {
          repo_id: 'test-repo',
          nonce: 'duplicate-nonce',
          exp: Date.now() + 60 * 60 * 1000
        };

        const ticket2 = {
          repo_id: 'test-repo',
          nonce: 'duplicate-nonce', // Same nonce
          exp: Date.now() + 60 * 60 * 1000
        };

        // First use should succeed
        const result1 = await invariantEngine.validateInvariant('nonce_uniqueness', ticket1, {
          timestamp: Date.now(),
          operation: 'nonce_validation',
          input: ticket1,
          environment: { test: true },
          performance: { startTime: Date.now() }
        });
        expect(result1).toHaveLength(0);

        // Second use should fail
        const result2 = await invariantEngine.validateInvariant('nonce_uniqueness', ticket2, {
          timestamp: Date.now(),
          operation: 'nonce_validation',
          input: ticket2,
          environment: { test: true },
          performance: { startTime: Date.now() }
        });
        expect(result2).toHaveLength(1);
        expect(result2[0].message).toContain('already used');
      });

      it('should allow same nonce for different repos', async () => {
        const ticket1 = {
          repo_id: 'test-repo-1',
          nonce: 'shared-nonce',
          exp: Date.now() + 60 * 60 * 1000
        };

        const ticket2 = {
          repo_id: 'test-repo-2',
          nonce: 'shared-nonce', // Same nonce, different repo
          exp: Date.now() + 60 * 60 * 1000
        };

        const result1 = await invariantEngine.validateInvariant('nonce_uniqueness', ticket1, {
          timestamp: Date.now(),
          operation: 'nonce_validation',
          input: ticket1,
          environment: { test: true },
          performance: { startTime: Date.now() }
        });

        const result2 = await invariantEngine.validateInvariant('nonce_uniqueness', ticket2, {
          timestamp: Date.now(),
          operation: 'nonce_validation',
          input: ticket2,
          environment: { test: true },
          performance: { startTime: Date.now() }
        });

        expect(result1).toHaveLength(0);
        expect(result2).toHaveLength(0);
      });
    });

    describe('Canonical Patch Format', () => {
      it('should accept properly formatted patches', async () => {
        const canonicalPatch = `diff --git a/file.txt b/file.txt
index abc123..def456 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 updated
 line 3
`;

        const result = await invariantEngine.validateInvariant(
          'canonical_patch_format',
          canonicalPatch,
          {
            timestamp: Date.now(),
            operation: 'patch_validation',
            input: canonicalPatch,
            environment: { test: true },
            performance: { startTime: Date.now() }
          }
        );

        expect(result).toHaveLength(0);
      });

      it('should reject patches with CRLF line endings', async () => {
        const crlfPatch = `diff --git a/file.txt b/file.txt\r\nindex abc123..def456 100644\r\n--- a/file.txt\r\n+++ b/file.txt\r\n`;

        const result = await invariantEngine.validateInvariant(
          'canonical_patch_format',
          crlfPatch,
          {
            timestamp: Date.now(),
            operation: 'patch_validation',
            input: crlfPatch,
            environment: { test: true },
            performance: { startTime: Date.now() }
          }
        );

        expect(result).toHaveLength(1);
        expect(result[0].message).toContain('not in canonical format');
      });

      it('should reject patches with BOM', async () => {
        const bomPatch = '\uFEFFdiff --git a/file.txt b/file.txt\n';

        const result = await invariantEngine.validateInvariant(
          'canonical_patch_format',
          bomPatch,
          {
            timestamp: Date.now(),
            operation: 'patch_validation',
            input: bomPatch,
            environment: { test: true },
            performance: { startTime: Date.now() }
          }
        );

        expect(result).toHaveLength(1);
        expect(result[0].message).toContain('not in canonical format');
      });
    });

    describe('Performance Budget Adherence', () => {
      it('should pass when within budget', async () => {
        const metrics = {
          startTime: 1000,
          endTime: 1020 // 20ms
        };

        const result = await invariantEngine.validateInvariant(
          'performance_budget_adherence',
          { operation: 'ticket_verify', metrics },
          {
            timestamp: Date.now(),
            operation: 'performance_validation',
            input: { operation: 'ticket_verify', metrics },
            environment: { test: true },
            performance: { startTime: Date.now() }
          }
        );

        expect(result).toHaveLength(0);
      });

      it('should fail when exceeding budget', async () => {
        const metrics = {
          startTime: 1000,
          endTime: 1500 // 500ms (exceeds 400ms budget for full_validate)
        };

        const result = await invariantEngine.validateInvariant(
          'performance_budget_adherence',
          { operation: 'full_validate', metrics },
          {
            timestamp: Date.now(),
            operation: 'performance_validation',
            input: { operation: 'full_validate', metrics },
            environment: { test: true },
            performance: { startTime: Date.now() }
          }
        );

        expect(result).toHaveLength(1);
        expect(result[0].message).toContain('exceeded performance budget');
      });
    });

    describe('Incremental Validation Correctness', () => {
      it('should pass when results match', async () => {
        const input = { test: 'data' };
        const result = { valid: true, errors: [] };

        const validation = await invariantEngine.validateInvariant(
          'incremental_validation_correctness',
          { input, incrementalResult: result, fullResult: result },
          {
            timestamp: Date.now(),
            operation: 'incremental_validation',
            input: { input, incrementalResult: result, fullResult: result },
            environment: { test: true },
            performance: { startTime: Date.now() }
          }
        );

        expect(validation).toHaveLength(0);
      });

      it('should fail when results differ', async () => {
        const input = { test: 'data' };
        const incrementalResult = { valid: true, errors: [] };
        const fullResult = { valid: false, errors: ['validation error'] };

        const validation = await invariantEngine.validateInvariant(
          'incremental_validation_correctness',
          { input, incrementalResult, fullResult },
          {
            timestamp: Date.now(),
            operation: 'incremental_validation',
            input: { input, incrementalResult, fullResult },
            environment: { test: true },
            performance: { startTime: Date.now() }
          }
        );

        expect(validation).toHaveLength(1);
        expect(validation[0].message).toContain('differs from full validation');
      });
    });
  });

  describe('Phase 6: Artifacts & Release Process', () => {
    it('should generate SBOM correctly', async () => {
      const sbom = await artifactsEngine.generateSBOM();
      
      expect(sbom.specVersion).toBe('SPDX-2.3');
      expect(sbom.name).toBe('Arbiter Framework SBOM');
      expect(sbom.packages).toBeDefined();
      expect(sbom.relationships).toBeDefined();
      expect(sbom.creationInfo.created).toBeDefined();
    });

    it('should run quality gates', async () => {
      const gates = await artifactsEngine.runQualityGates();
      
      expect(gates).toBeInstanceOf(Array);
      expect(gates.length).toBeGreaterThan(0);
      
      const gateNames = gates.map(g => g.name);
      expect(gateNames).toContain('security');
      expect(gateNames).toContain('compatibility');
      expect(gateNames).toContain('coverage');
      expect(gateNames).toContain('performance');
    });

    it('should generate required outputs', async () => {
      const outputs = await artifactsEngine.generateRequiredOutputs([]);
      
      expect(outputs.metrics).toBeDefined();
      expect(outputs.traces).toBeDefined();
      expect(outputs.sbom).toBeDefined();
      expect(outputs.compatReport).toBeDefined();
      expect(outputs.report).toBeDefined();
    });
  });

  describe('Phase 7: Monitoring & SLO Implementation', () => {
    it('should track SLO compliance', () => {
      // Record some performance metrics
      monitoringEngine.recordResponseTime('test_operation', 200);
      monitoringEngine.recordTicketVerification(15);
      monitoringEngine.recordAvailability(true);

      const sloStatus = monitoringEngine.getSLOStatus();
      
      expect(sloStatus.response_time_p95).toBeDefined();
      expect(sloStatus.ticket_verify_p95).toBeDefined();
      expect(sloStatus.availability).toBeDefined();
      
      expect(sloStatus.response_time_p95.current).toBe(200);
      expect(sloStatus.ticket_verify_p95.current).toBe(15);
      expect(sloStatus.availability.current).toBe(100);
    });

    it('should detect performance degradation', () => {
      // Record samples that create P99 > 2 * P95 condition
      for (let i = 0; i < 95; i++) {
        monitoringEngine.recordResponseTime('test_op', 100); // P95 will be ~100ms
      }
      for (let i = 0; i < 4; i++) {
        monitoringEngine.recordResponseTime('test_op', 250); // P99 will be ~250ms (2.5x P95)
      }

      const degradation = monitoringEngine.detectPerformanceDegradation();
      
      expect(degradation.degradation).toBe(true);
      expect(degradation.details?.ratio).toBeGreaterThan(2);
    });

    it('should record and analyze security events', () => {
      // Record multiple replay attempts
      for (let i = 0; i < 5; i++) {
        monitoringEngine.recordSecurityEvent({
          type: 'replay_attempt',
          severity: 'medium',
          source: { ip: '192.168.1.100' },
          details: { nonce: `nonce-${i}` },
          blocked: true
        });
      }

      const events = monitoringEngine.getRecentSecurityEvents(1);
      expect(events.length).toBeGreaterThan(5); // Should include pattern detection event
      
      const patternEvent = events.find(e => e.type === 'suspicious_pattern');
      expect(patternEvent).toBeDefined();
      expect(patternEvent?.severity).toBe('high');
    });

    it('should generate alerts for SLO violations', (done) => {
      // Listen for alert
      monitoringEngine.once('alert', (alert) => {
        expect(alert.severity).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.slo).toBeDefined();
        done();
      });

      // Record high response times to trigger alert
      for (let i = 0; i < 10; i++) {
        monitoringEngine.recordResponseTime('test_operation', 600); // Exceeds 400ms target
      }

      // Wait a bit for the periodic check
      setTimeout(() => {
        if (!done) {
          done(new Error('Alert was not triggered'));
        }
      }, 2000);
    });

    it('should provide health status', () => {
      monitoringEngine.recordResponseTime('test_op', 200);
      monitoringEngine.recordAvailability(true);
      
      const health = monitoringEngine.getHealthStatus();
      
      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.slos).toBeDefined();
      expect(health.alerts).toBeGreaterThanOrEqual(0);
      expect(health.incidents).toBeGreaterThanOrEqual(0);
      expect(health.securityEvents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle complete Rails & Guarantees workflow', async () => {
      const now = Date.now();
      
      // 1. Validate a ticket with all invariants
      const ticket = {
        exp: now + 60 * 60 * 1000,
        iat: now,
        repo_id: 'integration-test-repo',
        nonce: `integration-nonce-${now}`,
        patch: 'diff --git a/test.txt b/test.txt\nindex abc123..def456 100644\n--- a/test.txt\n+++ b/test.txt\n@@ -1 +1 @@\n-old line\n+new line\n'
      };

      const context = {
        timestamp: now,
        operation: 'ticket_validation',
        input: ticket,
        environment: { integration_test: true },
        performance: { startTime: now }
      };

      // Test all invariants
      const ttlResult = await invariantEngine.validateInvariant('ticket_ttl_enforcement', ticket, context);
      expect(ttlResult).toHaveLength(0);

      const nonceResult = await invariantEngine.validateInvariant('nonce_uniqueness', ticket, context);
      expect(nonceResult).toHaveLength(0);

      const patchResult = await invariantEngine.validateInvariant('canonical_patch_format', ticket.patch, context);
      expect(patchResult).toHaveLength(0);

      // 2. Record performance metrics
      const startTime = performance.now();
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      const endTime = performance.now();
      
      monitoringEngine.recordTicketVerification(endTime - startTime);
      monitoringEngine.recordResponseTime('ticket_validation', endTime - startTime);

      // 3. Check SLO compliance
      const sloStatus = monitoringEngine.getSLOStatus();
      expect(sloStatus.ticket_verify_p95.status).toBe('ok');
      expect(sloStatus.response_time_p95.status).toBe('ok');

      // 4. Verify health status
      const health = monitoringEngine.getHealthStatus();
      expect(health.status).toBe('healthy');

      console.log('✅ End-to-end Rails & Guarantees workflow completed successfully');
    });

    it('should demonstrate production-ready deployment', async () => {
      // Generate all required artifacts
      const requiredOutputs = await artifactsEngine.generateRequiredOutputs([]);
      
      // Run quality gates
      const qualityGates = await artifactsEngine.runQualityGates();
      const allGatesPassed = qualityGates.every(gate => gate.status === 'passed');
      
      // Check monitoring health
      const health = monitoringEngine.getHealthStatus();
      
      // Validate deployment readiness
      expect(allGatesPassed).toBe(true);
      expect(health.status).toBe('healthy');
      expect(requiredOutputs.metrics).toBeDefined();
      expect(requiredOutputs.traces).toBeDefined();
      expect(requiredOutputs.sbom).toBeDefined();
      expect(requiredOutputs.compatReport).toBeDefined();
      expect(requiredOutputs.report).toBeDefined();

      console.log('🚀 Production deployment validation completed successfully');
    });
  });

  describe('Performance Requirements Validation', () => {
    it('should meet Rails & Guarantees performance requirements', () => {
      // Test response time requirements (p95 < 400ms)
      const responseTime = 350; // Well within budget
      monitoringEngine.recordResponseTime('validation_operation', responseTime);
      
      // Test ticket verification requirements (p95 < 25ms)
      const ticketVerifyTime = 20; // Well within budget
      monitoringEngine.recordTicketVerification(ticketVerifyTime);
      
      // Check SLO status
      const sloStatus = monitoringEngine.getSLOStatus();
      
      expect(sloStatus.response_time_p95.current).toBeLessThanOrEqual(400);
      expect(sloStatus.ticket_verify_p95.current).toBeLessThanOrEqual(25);
      expect(sloStatus.response_time_p95.status).toBe('ok');
      expect(sloStatus.ticket_verify_p95.status).toBe('ok');
    });

    it('should handle performance budget violations gracefully', async () => {
      const slowMetrics = {
        startTime: 1000,
        endTime: 2000 // 1000ms - exceeds all budgets
      };

      const result = await invariantEngine.validateInvariant(
        'performance_budget_adherence',
        { operation: 'full_validate', metrics: slowMetrics },
        {
          timestamp: Date.now(),
          operation: 'performance_validation',
          input: { operation: 'full_validate', metrics: slowMetrics },
          environment: { test: true },
          performance: { startTime: Date.now() }
        }
      );

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('error');
      expect(result[0].details.overagePercent).toBeDefined();
    });
  });

  describe('Security Requirements Validation', () => {
    it('should detect and respond to security threats', () => {
      let alertTriggered = false;
      
      monitoringEngine.once('security_event', (event) => {
        alertTriggered = true;
        expect(event.type).toBeDefined();
        expect(event.severity).toBeDefined();
        expect(event.blocked).toBeDefined();
      });

      // Simulate security incident
      monitoringEngine.recordSecurityEvent({
        type: 'replay_attempt',
        severity: 'high',
        source: { 
          ip: '10.0.0.1', 
          userAgent: 'malicious-bot/1.0',
          repoId: 'target-repo'
        },
        details: { 
          attemptedNonce: 'previously-used-nonce',
          originalTimestamp: Date.now() - 60000
        },
        blocked: true
      });

      expect(alertTriggered).toBe(true);
    });

    it('should maintain security event history', () => {
      // Record various security events
      const eventTypes = ['replay_attempt', 'invalid_signature', 'rate_limit_exceeded'];
      
      eventTypes.forEach((type, index) => {
        monitoringEngine.recordSecurityEvent({
          type: type as any,
          severity: 'medium',
          source: { ip: `192.168.1.${index + 1}` },
          details: { eventIndex: index },
          blocked: true
        });
      });

      const events = monitoringEngine.getRecentSecurityEvents(1);
      expect(events.length).toBeGreaterThanOrEqual(eventTypes.length);
      
      const uniqueTypes = new Set(events.map(e => e.type));
      eventTypes.forEach(type => {
        expect(uniqueTypes).toContain(type);
      });
    });
  });
});