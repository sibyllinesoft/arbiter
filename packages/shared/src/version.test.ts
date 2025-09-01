/**
 * @fileoverview Version & Compatibility System Tests v1.0 RC
 * Comprehensive test suite for version management and compatibility validation
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  parseSemanticVersion,
  compareVersions,
  isVersionCompatible,
  checkCompatibility,
  validateVersionSet,
  getRuntimeVersionInfo,
  CURRENT_VERSIONS,
  type VersionSet
} from './version.js';

describe('Version System v1.0 RC', () => {
  
  describe('Semantic Version Parsing', () => {
    test('parses valid semantic versions correctly', () => {
      const cases = [
        {
          input: 'v1.0.0',
          expected: { major: 1, minor: 0, patch: 0, raw: 'v1.0.0' }
        },
        {
          input: '2.1.3',
          expected: { major: 2, minor: 1, patch: 3, raw: '2.1.3' }
        },
        {
          input: 'v1.0.0-rc.1',
          expected: { major: 1, minor: 0, patch: 0, prerelease: 'rc.1', raw: 'v1.0.0-rc.1' }
        },
        {
          input: '1.2.3+build.123',
          expected: { major: 1, minor: 2, patch: 3, build: 'build.123', raw: '1.2.3+build.123' }
        },
        {
          input: 'v2.0.0-alpha.1+build.456',
          expected: { 
            major: 2, minor: 0, patch: 0, 
            prerelease: 'alpha.1', build: 'build.456', 
            raw: 'v2.0.0-alpha.1+build.456' 
          }
        }
      ];

      for (const { input, expected } of cases) {
        const result = parseSemanticVersion(input);
        expect(result).toMatchObject(expected);
      }
    });

    test('throws error for invalid versions', () => {
      const invalidVersions = [
        '',
        'v1',
        '1.0',
        'v1.0.0-',
        'v1.0.0+',
        'not-a-version',
        'v1.0.0-rc.1-invalid',
        '1.0.0.0'
      ];

      for (const version of invalidVersions) {
        expect(() => parseSemanticVersion(version)).toThrow();
      }
    });
  });

  describe('Version Comparison', () => {
    test('compares versions correctly', () => {
      const cases = [
        { a: 'v1.0.0', b: 'v1.0.0', expected: 0 },
        { a: 'v1.0.0', b: 'v1.0.1', expected: -1 },
        { a: 'v1.0.1', b: 'v1.0.0', expected: 1 },
        { a: 'v1.0.0', b: 'v2.0.0', expected: -1 },
        { a: 'v2.0.0', b: 'v1.0.0', expected: 1 },
        { a: 'v1.0.0-rc.1', b: 'v1.0.0', expected: -1 },
        { a: 'v1.0.0', b: 'v1.0.0-rc.1', expected: 1 },
        { a: 'v1.0.0-alpha.1', b: 'v1.0.0-beta.1', expected: -1 }
      ];

      for (const { a, b, expected } of cases) {
        const result = compareVersions(a, b);
        expect(result).toBe(expected);
      }
    });
  });

  describe('Component-Specific Compatibility', () => {
    test('API version compatibility', () => {
      // API: Major must match, minor/patch can be higher
      expect(isVersionCompatible('v1.0.0', 'v1.0.0', 'api_version')).toBe(true);
      expect(isVersionCompatible('v1.1.0', 'v1.0.0', 'api_version')).toBe(true);
      expect(isVersionCompatible('v1.0.1', 'v1.0.0', 'api_version')).toBe(true);
      expect(isVersionCompatible('v2.0.0', 'v1.0.0', 'api_version')).toBe(false);
      expect(isVersionCompatible('v0.9.0', 'v1.0.0', 'api_version')).toBe(false);
    });

    test('Schema version compatibility', () => {
      // Schema: Major must match, minor can be higher
      expect(isVersionCompatible('v2.0.0', 'v2.0.0', 'schema_version')).toBe(true);
      expect(isVersionCompatible('v2.1.0', 'v2.0.0', 'schema_version')).toBe(true);
      expect(isVersionCompatible('v2.0.1', 'v2.0.0', 'schema_version')).toBe(true);
      expect(isVersionCompatible('v3.0.0', 'v2.0.0', 'schema_version')).toBe(false);
      expect(isVersionCompatible('v1.9.0', 'v2.0.0', 'schema_version')).toBe(false);
    });

    test('Contract version compatibility', () => {
      // Contract: Exact match required
      expect(isVersionCompatible('v1.0.0', 'v1.0.0', 'contract_version')).toBe(true);
      expect(isVersionCompatible('v1.0.1', 'v1.0.0', 'contract_version')).toBe(false);
      expect(isVersionCompatible('v1.1.0', 'v1.0.0', 'contract_version')).toBe(false);
    });

    test('Ticket format compatibility', () => {
      // Ticket: Exact match required
      expect(isVersionCompatible('v1.0.0', 'v1.0.0', 'ticket_format')).toBe(true);
      expect(isVersionCompatible('v1.0.1', 'v1.0.0', 'ticket_format')).toBe(false);
      expect(isVersionCompatible('v1.1.0', 'v1.0.0', 'ticket_format')).toBe(false);
    });
  });

  describe('Compatibility Checking', () => {
    test('compatible versions pass validation', async () => {
      const compatibleVersions: VersionSet = {
        api_version: 'v1.0.0-rc.1',
        schema_version: 'v2.0.0',
        contract_version: 'v1.0.0',
        ticket_format: 'v1.0.0'
      };

      const result = await checkCompatibility(compatibleVersions);
      
      expect(result.compatible).toBe(true);
      expect(result.version_mismatches).toHaveLength(0);
      expect(result.migration_required).toBe(false);
    });

    test('incompatible versions fail validation', async () => {
      const incompatibleVersions: VersionSet = {
        api_version: 'v0.9.0', // Wrong major version
        schema_version: 'v1.0.0', // Wrong major version
        contract_version: 'v0.9.0', // Wrong version
        ticket_format: 'v0.9.0' // Wrong version
      };

      const result = await checkCompatibility(incompatibleVersions);
      
      expect(result.compatible).toBe(false);
      expect(result.version_mismatches.length).toBeGreaterThan(0);
    });

    test('missing versions are detected', async () => {
      const partialVersions = {
        api_version: 'v1.0.0-rc.1'
        // Missing other required versions
      };

      const result = await checkCompatibility(partialVersions);
      
      expect(result.compatible).toBe(false);
      expect(result.version_mismatches.some(m => m.actual === 'missing')).toBe(true);
    });

    test('allow-compat flag works correctly', async () => {
      const incompatibleVersions: VersionSet = {
        api_version: 'v0.9.0',
        schema_version: 'v1.0.0', 
        contract_version: 'v0.9.0',
        ticket_format: 'v0.9.0'
      };

      const result = await checkCompatibility(incompatibleVersions, true);
      
      expect(result.compatible).toBe(true);
      expect(result.version_mismatches.every(m => m.severity === 'warning')).toBe(true);
    });
  });

  describe('Version Set Validation', () => {
    test('valid version set passes validation', () => {
      const validVersionSet = {
        api_version: 'v1.0.0',
        schema_version: 'v2.0.0',
        contract_version: 'v1.0.0',
        ticket_format: 'v1.0.0'
      };

      expect(() => validateVersionSet(validVersionSet)).not.toThrow();
    });

    test('invalid version set fails validation', () => {
      const invalidVersionSets = [
        { api_version: 'invalid' }, // Invalid version format
        { api_version: 'v1.0.0' }, // Missing required fields
        { 
          api_version: 'v1.0.0',
          schema_version: 'v2.0.0',
          contract_version: 'v1.0.0',
          ticket_format: 'v1.0.0',
          extra_field: 'not_allowed' // Extra field not allowed
        }
      ];

      for (const invalidVersionSet of invalidVersionSets) {
        expect(() => validateVersionSet(invalidVersionSet)).toThrow();
      }
    });
  });

  describe('Runtime Version Information', () => {
    test('returns complete runtime information', () => {
      const runtimeInfo = getRuntimeVersionInfo();
      
      expect(runtimeInfo.versions).toEqual(CURRENT_VERSIONS);
      expect(runtimeInfo.build_info.timestamp).toBeTruthy();
      expect(runtimeInfo.build_info.deterministic).toBe(true);
      expect(runtimeInfo.build_info.reproducible).toBe(true);
      expect(runtimeInfo.compatibility.migration_support).toBe(true);
    });

    test('respects environment variables', () => {
      // Test production mode
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const runtimeInfo = getRuntimeVersionInfo();
      expect(runtimeInfo.compatibility.strict_mode).toBe(true);
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Current Version Constants', () => {
    test('current versions match specification', () => {
      expect(CURRENT_VERSIONS).toEqual({
        api_version: 'v1.0.0-rc.1',
        schema_version: 'v2.0.0',
        contract_version: 'v1.0.0',
        ticket_format: 'v1.0.0'
      });
    });

    test('current versions are valid semantic versions', () => {
      for (const [component, version] of Object.entries(CURRENT_VERSIONS)) {
        expect(() => parseSemanticVersion(version)).not.toThrow();
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles malformed version objects gracefully', async () => {
      const malformedVersions = [
        null,
        undefined,
        'not an object',
        [],
        { invalid: 'structure' }
      ];

      for (const malformed of malformedVersions) {
        const result = await checkCompatibility(malformed as any);
        expect(result.compatible).toBe(false);
      }
    });

    test('handles empty version strings', () => {
      expect(() => parseSemanticVersion('')).toThrow();
      expect(() => parseSemanticVersion(' ')).toThrow();
    });

    test('compatibility check handles internal errors gracefully', async () => {
      // Mock an internal error scenario
      const weirdVersions = {
        api_version: 'v1.0.0',
        schema_version: 'v2.0.0',
        contract_version: 'v1.0.0',
        ticket_format: 'definitely-not-a-version'
      };

      const result = await checkCompatibility(weirdVersions);
      expect(result.compatible).toBe(false);
      expect(result.version_mismatches.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Requirements', () => {
    test('version parsing performance', () => {
      const startTime = performance.now();
      
      // Parse 1000 versions to test performance
      for (let i = 0; i < 1000; i++) {
        parseSemanticVersion(`v${i % 10}.${i % 10}.${i % 10}`);
      }
      
      const duration = performance.now() - startTime;
      
      // Should complete within reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('compatibility check performance', async () => {
      const startTime = performance.now();
      
      // Run 100 compatibility checks
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(checkCompatibility(CURRENT_VERSIONS));
      }
      
      await Promise.all(promises);
      
      const duration = performance.now() - startTime;
      
      // Should complete within performance budget (< 25ms per operation avg)
      expect(duration / 100).toBeLessThan(25);
    });
  });
});