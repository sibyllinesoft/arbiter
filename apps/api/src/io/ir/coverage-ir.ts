/**
 * Coverage IR generator for test coverage visualization.
 * Transforms capability, test, and requirement specifications into a coverage
 * graph showing testing completeness and traceability.
 */
import { extractAsRecord } from "./helpers";
import type { IREdge, IRNode } from "./types";

/**
 * Generate coverage intermediate representation for test coverage visualization.
 * Creates a graph connecting capabilities, tests, and requirements with coverage metrics.
 * Calculates coverage percentages based on test count and requirement count.
 * @param resolved - The resolved specification containing capability, test, and requirement definitions
 * @returns IR data with nodes, edges, coverage statistics, layout configuration, and metadata
 */
export function generateCoverageIR(resolved: Record<string, unknown>): Record<string, unknown> {
  const capabilities = extractAsRecord(resolved, "capabilities");
  const tests = extractAsRecord(resolved, "tests");
  const requirements = extractAsRecord(resolved, "requirements");

  const nodes: IRNode[] = [];
  const edges: IREdge[] = [];
  const coverage: Record<string, any> = {};
  let fullyTested = 0;
  let partiallyTested = 0;
  let untested = 0;

  Object.entries(capabilities).forEach(([capId, capability]) => {
    const coveringTests = Object.entries(tests).filter(([_, test]) => {
      const covers = test.covers || [];
      return covers.includes(capId);
    });

    const relatedRequirements = Object.entries(requirements).filter(([_, req]) => {
      return req.capability === capId;
    });

    const testCount = coveringTests.length;
    const requirementCount = relatedRequirements.length;

    let coveragePercentage = 0;
    if (testCount >= 8 && requirementCount >= 2) {
      coveragePercentage = 100;
      fullyTested++;
    } else if (testCount >= 1 || requirementCount >= 1) {
      coveragePercentage = Math.min(80, testCount * 10 + requirementCount * 20);
      partiallyTested++;
    } else {
      coveragePercentage = 0;
      untested++;
    }

    nodes.push({
      id: capId,
      label: capability.name || capId,
      type: "capability",
      properties: {
        testCount,
        requirementCount,
        coverage: coveragePercentage,
      },
    });

    coverage[capId] = {
      covered: testCount > 0,
      testCount,
      requirementCount,
      coveragePercentage,
      tests: coveringTests.map(([testId, _]) => testId),
      requirements: relatedRequirements.map(([reqId, _]) => reqId),
    };
  });

  Object.entries(tests).forEach(([testId, test]) => {
    nodes.push({
      id: testId,
      label: test.name || testId,
      type: "test",
      properties: {
        covers: test.covers || [],
      },
    });

    if (test.covers && Array.isArray(test.covers)) {
      test.covers.forEach((capId: string) => {
        edges.push({
          source: testId,
          target: capId,
          type: "covers",
        });
      });
    }
  });

  Object.entries(requirements).forEach(([reqId, req]) => {
    nodes.push({
      id: reqId,
      label: req.name || reqId,
      type: "requirement",
      properties: {
        capability: req.capability,
      },
    });

    if (req.capability) {
      edges.push({
        source: reqId,
        target: req.capability,
        type: "specifies",
      });
    }
  });

  const totalCapabilities = Object.keys(capabilities).length;
  const overallCoverage =
    totalCapabilities > 0
      ? Math.round(((fullyTested + partiallyTested) / totalCapabilities) * 100)
      : 0;

  return {
    type: "coverage_graph",
    nodes,
    edges,
    coverage: {
      overall: overallCoverage,
      fullyTested,
      partiallyTested,
      untested,
      details: coverage,
    },
    layout: {
      algorithm: "force",
    },
    metadata: {
      totalCapabilities,
      totalTests: Object.keys(tests).length,
      totalRequirements: Object.keys(requirements).length,
    },
  };
}
