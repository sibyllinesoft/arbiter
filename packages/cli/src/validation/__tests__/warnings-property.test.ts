/**
 * Property-based tests for validation warnings system
 *
 * Tests system robustness with randomly generated inputs
 * and validates invariants hold across many test cases
 */

import { describe, expect, it } from 'bun:test';
import { formatWarnings, validateSpecification } from '../warnings.js';

describe('Validation Warning System - Property Tests', () => {
  // Property: validation should never throw errors
  describe('Robustness Properties', () => {
    it('should never throw exceptions with any input structure', () => {
      const testCases = generateRandomSpecs(100);

      testCases.forEach((spec, index) => {
        expect(() => {
          const result = validateSpecification(spec);
          expect(result).toBeDefined();
          expect(typeof result.hasWarnings).toBe('boolean');
          expect(typeof result.hasErrors).toBe('boolean');
          expect(Array.isArray(result.warnings)).toBe(true);
          expect(Array.isArray(result.errors)).toBe(true);
        }).not.toThrow(`Test case ${index} should not throw`);
      });
    });

    it('should always return consistent structure', () => {
      const testCases = generateRandomSpecs(50);

      testCases.forEach(spec => {
        const result = validateSpecification(spec);

        // Structure invariants
        expect(result).toHaveProperty('hasWarnings');
        expect(result).toHaveProperty('hasErrors');
        expect(result).toHaveProperty('warnings');
        expect(result).toHaveProperty('errors');

        // Type invariants
        expect(typeof result.hasWarnings).toBe('boolean');
        expect(typeof result.hasErrors).toBe('boolean');
        expect(Array.isArray(result.warnings)).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);

        // Logical invariants
        expect(result.hasWarnings).toBe(result.warnings.length > 0);
        expect(result.hasErrors).toBe(result.errors.length > 0);

        // Warning structure invariants
        result.warnings.forEach(warning => {
          expect(warning).toHaveProperty('category');
          expect(warning).toHaveProperty('severity');
          expect(warning).toHaveProperty('message');
          expect(warning).toHaveProperty('suggestion');
          expect(typeof warning.category).toBe('string');
          expect(['warning', 'error']).toContain(warning.severity);
          expect(typeof warning.message).toBe('string');
          expect(typeof warning.suggestion).toBe('string');
          expect(warning.category.length).toBeGreaterThan(0);
          expect(warning.message.length).toBeGreaterThan(0);
          expect(warning.suggestion.length).toBeGreaterThan(0);
        });
      });
    });

    it('should handle deeply nested null/undefined values', () => {
      const nullSpecs = generateNullSpecs(25);

      nullSpecs.forEach(spec => {
        expect(() => {
          const result = validateSpecification(spec);
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  // Property: more complete specs should have fewer warnings
  describe('Completeness Properties', () => {
    it('should produce fewer warnings as specs become more complete', () => {
      const progressiveSpecs = generateProgressiveSpecs();
      let lastWarningCount = Number.POSITIVE_INFINITY;

      progressiveSpecs.forEach((spec, index) => {
        const result = validateSpecification(spec);

        // Each spec should have same or fewer warnings than the previous
        expect(result.warnings.length).toBeLessThanOrEqual(lastWarningCount);
        lastWarningCount = result.warnings.length;
      });
    });

    it('should validate complete specs without warnings', () => {
      const completeSpecs = generateCompleteSpecs(10);

      completeSpecs.forEach(spec => {
        const result = validateSpecification(spec);
        expect(result.hasWarnings).toBe(false);
        expect(result.hasErrors).toBe(false);
        expect(result.warnings).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  // Property: validation categories should be mutually exclusive
  describe('Category Properties', () => {
    it('should produce distinct warning categories', () => {
      const testSpecs = generateRandomSpecs(20);
      const allCategories = new Set<string>();

      testSpecs.forEach(spec => {
        const result = validateSpecification(spec);
        result.warnings.forEach(warning => {
          allCategories.add(warning.category);
        });
      });

      // Should have multiple distinct categories
      expect(allCategories.size).toBeGreaterThan(5);

      // Categories should be meaningful strings
      allCategories.forEach(category => {
        expect(category.length).toBeGreaterThan(2);
        expect(category).toMatch(/^[A-Za-z\s]+$/);
      });
    });
  });

  // Property: format function should always produce valid output
  describe('Formatting Properties', () => {
    it('should format any validation result without errors', () => {
      const testCases = generateRandomSpecs(30);

      testCases.forEach(spec => {
        const result = validateSpecification(spec);

        expect(() => {
          const formatted = formatWarnings(result);
          expect(typeof formatted).toBe('string');
        }).not.toThrow();
      });
    });

    it('should include required elements when warnings/errors present', () => {
      const incompleteSpecs = generateIncompleteSpecs(15);

      incompleteSpecs.forEach(spec => {
        const result = validateSpecification(spec);

        if (result.hasWarnings || result.hasErrors) {
          const formatted = formatWarnings(result);

          // Should include AI agent prompts
          expect(formatted).toContain('AI AGENTS');
          expect(formatted).toContain('PRODUCT OWNER');

          if (result.hasErrors) {
            expect(formatted).toContain('ERRORS');
          }

          if (result.hasWarnings) {
            expect(formatted).toContain('WARNINGS');
          }
        }
      });
    });
  });

  // Property: performance should be consistent regardless of spec size
  describe('Performance Properties', () => {
    it('should validate large specs in reasonable time', () => {
      const largeSizes = [10, 50, 100, 200];

      largeSizes.forEach(size => {
        const largeSpec = generateLargeSpec(size);

        const startTime = performance.now();
        const result = validateSpecification(largeSpec);
        const endTime = performance.now();

        const duration = endTime - startTime;

        // Should complete within reasonable time (< 50ms for any size)
        const maxAllowedTime = 50;
        expect(duration).toBeLessThan(maxAllowedTime);

        // Should still produce valid results
        expect(result).toBeDefined();
        expect(typeof result.hasWarnings).toBe('boolean');
      });
    });
  });
});

// Helper functions for generating test data

function generateRandomSpecs(count: number): any[] {
  const specs: any[] = [];

  for (let i = 0; i < count; i++) {
    specs.push({
      product:
        Math.random() > 0.5
          ? {
              name: randomString(),
              goals: Math.random() > 0.5 ? [randomString(), randomString()] : [],
            }
          : (undefined as any),

      metadata:
        Math.random() > 0.3
          ? {
              name: randomString(),
              version: randomVersion(),
              description: Math.random() > 0.5 ? randomString() : undefined,
            }
          : (undefined as any),

      services: Math.random() > 0.4 ? generateRandomServices() : {},

      ui:
        Math.random() > 0.4
          ? {
              routes: generateRandomRoutes(),
            }
          : { routes: [] },

      tests: Math.random() > 0.6 ? generateRandomTests() : [],

      epics: Math.random() > 0.7 ? generateRandomEpics() : undefined,

      security:
        Math.random() > 0.8
          ? {
              authentication: { type: 'oauth2' },
            }
          : undefined,

      performance:
        Math.random() > 0.8
          ? {
              sla: { responseTime: '< 200ms' },
            }
          : undefined,

      observability:
        Math.random() > 0.8
          ? {
              logging: { level: 'info' },
              monitoring: { metrics: ['response_time'] },
            }
          : undefined,

      environments:
        Math.random() > 0.8
          ? {
              development: { name: 'dev' },
              production: { name: 'prod' },
            }
          : undefined,
    });
  }

  return specs;
}

function generateNullSpecs(count: number): any[] {
  const specs: any[] = [];

  for (let i = 0; i < count; i++) {
    specs.push({
      product:
        Math.random() > 0.5
          ? null
          : {
              name: Math.random() > 0.5 ? null : randomString(),
              goals: Math.random() > 0.5 ? null : [],
            },
      metadata:
        Math.random() > 0.5
          ? undefined
          : {
              name: Math.random() > 0.5 ? undefined : randomString(),
              version: Math.random() > 0.5 ? null : '1.0.0',
            },
      services:
        Math.random() > 0.5
          ? null
          : {
              test: {
                serviceType: Math.random() > 0.5 ? null : 'bespoke',
                language: Math.random() > 0.5 ? undefined : 'typescript',
                ports: Math.random() > 0.5 ? null : [],
              },
            },
      ui:
        Math.random() > 0.5
          ? null
          : {
              routes: Math.random() > 0.5 ? null : [],
            },
      tests: Math.random() > 0.5 ? null : undefined,
    });
  }

  return specs;
}

function generateProgressiveSpecs(): any[] {
  const baseSpec: any = {
    product: { name: 'Progressive Test' },
    metadata: { name: 'progressive', version: '1.0.0' },
    services: {},
    ui: { routes: [] },
  };

  return [
    // Minimal spec (many warnings)
    { ...baseSpec },

    // Add product goals
    {
      ...baseSpec,
      product: {
        name: 'Progressive Test',
        goals: ['Goal 1', 'Goal 2'],
      },
    },

    // Add description
    {
      ...baseSpec,
      product: {
        name: 'Progressive Test',
        goals: ['Goal 1', 'Goal 2'],
      },
      metadata: {
        name: 'progressive',
        version: '1.0.0',
        description: 'A progressive test project',
      },
    },

    // Add tests
    {
      ...baseSpec,
      product: {
        name: 'Progressive Test',
        goals: ['Goal 1', 'Goal 2'],
      },
      metadata: {
        name: 'progressive',
        version: '1.0.0',
        description: 'A progressive test project',
      },
      tests: [
        { name: 'Unit', type: 'unit', cases: [{ name: 'test', assertion: 'works' }] },
        { name: 'Integration', type: 'integration', cases: [{ name: 'test', assertion: 'works' }] },
        { name: 'E2E', type: 'e2e', cases: [{ name: 'test', assertion: 'works' }] },
      ],
    },

    // Add security
    {
      ...baseSpec,
      product: {
        name: 'Progressive Test',
        goals: ['Goal 1', 'Goal 2'],
      },
      metadata: {
        name: 'progressive',
        version: '1.0.0',
        description: 'A progressive test project',
      },
      tests: [
        { name: 'Unit', type: 'unit', cases: [{ name: 'test', assertion: 'works' }] },
        { name: 'Integration', type: 'integration', cases: [{ name: 'test', assertion: 'works' }] },
        { name: 'E2E', type: 'e2e', cases: [{ name: 'test', assertion: 'works' }] },
      ],
      security: {
        authentication: { type: 'oauth2' },
        authorization: { rbac: true },
      },
    },

    // Complete spec (no warnings)
    {
      ...baseSpec,
      product: {
        name: 'Progressive Test',
        goals: ['Goal 1', 'Goal 2'],
      },
      metadata: {
        name: 'progressive',
        version: '1.0.0',
        description: 'A progressive test project',
      },
      tests: [
        { name: 'Unit', type: 'unit', cases: [{ name: 'test', assertion: 'works' }] },
        { name: 'Integration', type: 'integration', cases: [{ name: 'test', assertion: 'works' }] },
        { name: 'E2E', type: 'e2e', cases: [{ name: 'test', assertion: 'works' }] },
      ],
      security: {
        authentication: { type: 'oauth2' },
        authorization: { rbac: true },
      },
      performance: {
        sla: { responseTime: '< 200ms', availability: '99.9%' },
      },
      observability: {
        logging: { level: 'info', format: 'json' },
        monitoring: { metrics: ['response_time', 'error_rate'] },
      },
      environments: {
        development: { name: 'dev' },
        production: { name: 'prod' },
      },
    },
  ];
}

function generateCompleteSpecs(count: number): any[] {
  const specs: any[] = [];

  for (let i = 0; i < count; i++) {
    specs.push({
      product: {
        name: `Complete Project ${i}`,
        goals: ['Goal A', 'Goal B'],
      },
      metadata: {
        name: `complete-${i}`,
        version: '1.0.0',
        description: `Complete project number ${i}`,
      },
      services: {},
      ui: { routes: [] },
      tests: [
        { name: 'Unit', type: 'unit', cases: [{ name: 'test', assertion: 'works' }] },
        { name: 'Integration', type: 'integration', cases: [{ name: 'test', assertion: 'works' }] },
        { name: 'E2E', type: 'e2e', cases: [{ name: 'test', assertion: 'works' }] },
      ],
      security: {
        authentication: { type: 'oauth2' },
        authorization: { rbac: true },
      },
      performance: {
        sla: { responseTime: '< 200ms', availability: '99.9%' },
      },
      observability: {
        logging: { level: 'info', format: 'json' },
        monitoring: { metrics: ['response_time', 'error_rate'] },
      },
      environments: {
        development: { name: 'dev' },
        production: { name: 'prod' },
      },
    });
  }

  return specs;
}

function generateIncompleteSpecs(count: number): any[] {
  const specs: any[] = [];

  for (let i = 0; i < count; i++) {
    specs.push({
      product: {
        name: `Incomplete ${i}`,
        // Missing goals
      },
      metadata: {
        name: `incomplete-${i}`,
        version: '1.0.0',
        // Missing description
      },
      services: {
        [`service-${i}`]: {
          serviceType: 'bespoke',
          language: 'typescript',
          type: 'deployment',
          // Missing ports, healthCheck, resources, env
        },
      },
      ui: {
        routes: [
          {
            id: `route-${i}`,
            path: `/route-${i}`,
            // Missing capabilities, components
          },
        ],
      },
      // Missing tests, epics, security, performance, observability, environments
    } as any);
  }

  return specs;
}

function generateLargeSpec(serviceCount: number): any {
  const services: Record<string, any> = {};
  const routes: any[] = [];
  const epics: any[] = [];

  // Generate many services
  for (let i = 0; i < serviceCount; i++) {
    services[`service-${i}`] = {
      serviceType: 'bespoke',
      language: 'typescript',
      type: 'deployment',
      ports: [{ name: 'http', port: 3000 + i }],
      healthCheck: { path: '/health', port: 3000 + i },
      resources: {
        limits: { cpu: '1000m', memory: '512Mi' },
        requests: { cpu: '100m', memory: '128Mi' },
      },
      env: { SERVICE_ID: `service-${i}` },
    };

    routes.push({
      id: `route-${i}`,
      path: `/route-${i}`,
      capabilities: ['view'],
      components: [`Component${i}`],
      requiresAuth: i % 2 === 0,
    });

    if (i % 5 === 0) {
      epics.push({
        id: `epic-${i}`,
        name: `Epic ${i}`,
        description: `Description for epic ${i}`,
        tasks: [
          {
            id: `task-${i}-1`,
            name: `Task ${i}-1`,
            type: 'feature',
          },
        ],
      });
    }
  }

  return {
    product: {
      name: 'Large Test Project',
      goals: ['Handle scale', 'Maintain performance'],
    },
    metadata: {
      name: 'large-project',
      version: '1.0.0',
      description: 'A large scale test project',
    },
    services,
    ui: { routes },
    tests: [
      { name: 'Unit', type: 'unit', cases: [{ name: 'test', assertion: 'works' }] },
      { name: 'Integration', type: 'integration', cases: [{ name: 'test', assertion: 'works' }] },
      { name: 'E2E', type: 'e2e', cases: [{ name: 'test', assertion: 'works' }] },
    ],
    epics,
    security: {
      authentication: { type: 'oauth2' },
      authorization: { rbac: true },
    },
    performance: {
      sla: { responseTime: '< 200ms', availability: '99.9%' },
    },
    observability: {
      logging: { level: 'info', format: 'json' },
      monitoring: { metrics: ['response_time', 'error_rate'] },
    },
    environments: {
      development: { name: 'dev' },
      production: { name: 'prod' },
    },
    locators: {
      'main-nav': "[data-testid='main-nav']",
    },
  };
}

function generateRandomServices(): Record<string, any> {
  const serviceCount = Math.floor(Math.random() * 5);
  const services: Record<string, any> = {};

  for (let i = 0; i < serviceCount; i++) {
    const serviceName = `service-${i}`;
    services[serviceName] = {
      serviceType: Math.random() > 0.5 ? 'bespoke' : 'container',
      language: Math.random() > 0.5 ? randomLanguage() : undefined,
      type: 'deployment',
      image: Math.random() > 0.7 ? `${randomString()}:latest` : undefined,
      ports: Math.random() > 0.3 ? [{ name: 'http', port: 3000 + i }] : undefined,
    };
  }

  return services;
}

function generateRandomRoutes(): any[] {
  const routeCount = Math.floor(Math.random() * 3);
  const routes: any[] = [];

  for (let i = 0; i < routeCount; i++) {
    routes.push({
      id: `route-${i}`,
      path: `/route-${i}`,
      capabilities: Math.random() > 0.5 ? ['view'] : undefined,
      components: Math.random() > 0.5 ? [`Component${i}`] : undefined,
      requiresAuth: Math.random() > 0.5,
    });
  }

  return routes;
}

function generateRandomTests(): any[] {
  const tests: any[] = [];
  const testTypes = ['unit', 'integration', 'e2e'];

  testTypes.forEach((type, i) => {
    if (Math.random() > 0.3) {
      tests.push({
        name: `${type} Tests`,
        type,
        cases: Math.random() > 0.5 ? [{ name: `${type} test`, assertion: 'works' }] : [],
      });
    }
  });

  return tests;
}

function generateRandomEpics(): any[] {
  const epicCount = Math.floor(Math.random() * 3);
  const epics: any[] = [];

  for (let i = 0; i < epicCount; i++) {
    epics.push({
      id: `epic-${i}`,
      name: `Epic ${i}`,
      description: Math.random() > 0.5 ? `Description ${i}` : undefined,
      tasks:
        Math.random() > 0.5
          ? [
              {
                id: `task-${i}`,
                name: `Task ${i}`,
                type: 'feature',
              },
            ]
          : [],
    });
  }

  return epics;
}

function randomString(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const length = 5 + Math.floor(Math.random() * 10);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomVersion(): string {
  return `${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;
}

function randomLanguage(): string {
  const languages = ['typescript', 'python', 'rust', 'go', 'java'];
  return languages[Math.floor(Math.random() * languages.length)];
}
