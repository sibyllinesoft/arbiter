/**
 * Unit tests for rate limiting functionality
 * Tests token bucket rate limiting implementation
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { checkRateLimit } from './server-isolated';

describe('Rate Limiting', () => {
  let rateLimitMap: Map<string, { tokens: number; lastRefill: number }>;

  beforeEach(() => {
    rateLimitMap = new Map();
  });

  describe('checkRateLimit', () => {
    test('should allow request for new client', () => {
      const allowed = checkRateLimit(rateLimitMap, 'client1', 1);
      
      expect(allowed).toBe(true);
      expect(rateLimitMap.has('client1')).toBe(true);
      
      const bucket = rateLimitMap.get('client1')!;
      expect(bucket.tokens).toBe(0); // 1 token consumed
    });

    test('should track separate buckets for different clients', () => {
      checkRateLimit(rateLimitMap, 'client1', 1);
      checkRateLimit(rateLimitMap, 'client2', 1);
      
      expect(rateLimitMap.size).toBe(2);
      expect(rateLimitMap.has('client1')).toBe(true);
      expect(rateLimitMap.has('client2')).toBe(true);
    });

    test('should deny request when bucket is empty', () => {
      const rateLimit = 1;
      
      // First request should succeed
      const first = checkRateLimit(rateLimitMap, 'client1', rateLimit);
      expect(first).toBe(true);
      
      // Second immediate request should fail (no tokens left)
      const second = checkRateLimit(rateLimitMap, 'client1', rateLimit);
      expect(second).toBe(false);
    });

    test('should allow multiple requests within rate limit', () => {
      const rateLimit = 3;
      
      // Should allow up to rate limit
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
      
      // Should deny additional requests
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(false);
    });

    test('should refill tokens over time', () => {
      const rateLimit = 1;
      
      // Consume initial token
      checkRateLimit(rateLimitMap, 'client1', rateLimit);
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(false);
      
      // Manually advance time by 1 second
      const bucket = rateLimitMap.get('client1')!;
      bucket.lastRefill = Date.now() - 1000;
      
      // Should allow request after refill
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
    });

    test('should refill tokens gradually', () => {
      const rateLimit = 2;
      
      // Consume all tokens
      checkRateLimit(rateLimitMap, 'client1', rateLimit);
      checkRateLimit(rateLimitMap, 'client1', rateLimit);
      
      // Advance time by 2 seconds
      const bucket = rateLimitMap.get('client1')!;
      bucket.lastRefill = Date.now() - 2000;
      
      // Should refill 2 tokens (1 per second)
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(false);
    });

    test('should cap tokens at rate limit', () => {
      const rateLimit = 2;
      
      // Create bucket and advance time far into future
      checkRateLimit(rateLimitMap, 'client1', rateLimit);
      
      const bucket = rateLimitMap.get('client1')!;
      bucket.lastRefill = Date.now() - 10000; // 10 seconds ago
      
      // Should only refill up to rate limit, not 10 tokens
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(false);
    });

    test('should handle partial second refills', () => {
      const rateLimit = 1;
      
      // Consume token
      checkRateLimit(rateLimitMap, 'client1', rateLimit);
      
      // Advance time by 500ms (half second)
      const bucket = rateLimitMap.get('client1')!;
      bucket.lastRefill = Date.now() - 500;
      
      // Should not refill yet (need full second)
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(false);
      
      // Advance to full second
      bucket.lastRefill = Date.now() - 1000;
      
      // Now should refill
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
    });

    test('should handle different rate limits for different scenarios', () => {
      // Test higher rate limit
      const highLimit = 10;
      
      for (let i = 0; i < highLimit; i++) {
        expect(checkRateLimit(rateLimitMap, 'high-rate-client', highLimit)).toBe(true);
      }
      expect(checkRateLimit(rateLimitMap, 'high-rate-client', highLimit)).toBe(false);
      
      // Test lower rate limit
      const lowLimit = 1;
      expect(checkRateLimit(rateLimitMap, 'low-rate-client', lowLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'low-rate-client', lowLimit)).toBe(false);
    });

    test('should update lastRefill timestamp on token refill', () => {
      checkRateLimit(rateLimitMap, 'client1', 1);
      
      const bucket = rateLimitMap.get('client1')!;
      const originalRefill = bucket.lastRefill;
      
      // Advance time significantly
      const pastTime = Date.now() - 2000; // 2 seconds ago
      bucket.lastRefill = pastTime;
      
      // Check rate limit (should trigger refill)
      checkRateLimit(rateLimitMap, 'client1', 1);
      
      // lastRefill should be updated to current time (with some tolerance for timing)
      expect(bucket.lastRefill).toBeGreaterThan(pastTime);
      // Use different time comparison to avoid exact timestamp collision
      expect(bucket.lastRefill).toBeGreaterThanOrEqual(originalRefill);
    });

    test('should handle edge case of zero rate limit', () => {
      // Zero rate limit should always deny
      expect(checkRateLimit(rateLimitMap, 'client1', 0)).toBe(false);
      expect(checkRateLimit(rateLimitMap, 'client1', 0)).toBe(false);
    });

    test('should initialize bucket correctly for first request', () => {
      const rateLimit = 5;
      
      checkRateLimit(rateLimitMap, 'new-client', rateLimit);
      
      const bucket = rateLimitMap.get('new-client')!;
      expect(bucket.tokens).toBe(rateLimit - 1); // One token consumed
      expect(bucket.lastRefill).toBeCloseTo(Date.now(), -1); // Within ~10ms
    });

    test('should handle concurrent access patterns', () => {
      const rateLimit = 3;
      const clientId = 'concurrent-client';
      
      // Simulate rapid concurrent requests
      const results: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(checkRateLimit(rateLimitMap, clientId, rateLimit));
      }
      
      // First 3 should succeed, rest should fail
      expect(results.slice(0, 3)).toEqual([true, true, true]);
      expect(results.slice(3)).toEqual([false, false]);
      
      const bucket = rateLimitMap.get(clientId)!;
      expect(bucket.tokens).toBe(0);
    });

    test('should work with fractional time differences', () => {
      const rateLimit = 1;
      
      checkRateLimit(rateLimitMap, 'client1', rateLimit);
      
      const bucket = rateLimitMap.get('client1')!;
      // Set time to 999ms ago (should not refill)
      bucket.lastRefill = Date.now() - 999;
      
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(false);
      
      // Set time to 1001ms ago (should refill 1 token)
      bucket.lastRefill = Date.now() - 1001;
      
      expect(checkRateLimit(rateLimitMap, 'client1', rateLimit)).toBe(true);
    });
  });

  describe('Rate limit persistence', () => {
    test('should maintain state across multiple checks', () => {
      const rateLimit = 2;
      
      // First session
      expect(checkRateLimit(rateLimitMap, 'persistent-client', rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'persistent-client', rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, 'persistent-client', rateLimit)).toBe(false);
      
      // State should persist
      const bucket = rateLimitMap.get('persistent-client')!;
      expect(bucket.tokens).toBe(0);
      
      // After refill time
      bucket.lastRefill = Date.now() - 2000;
      
      expect(checkRateLimit(rateLimitMap, 'persistent-client', rateLimit)).toBe(true);
    });
  });
});