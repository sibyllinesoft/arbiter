/**
 * @packageDocumentation
 * Analysis generation utilities for explanation output.
 *
 * Provides functionality to:
 * - Generate human-readable summaries
 * - Generate next steps recommendations
 * - Generate improvement recommendations
 * - Identify potential configuration issues
 */

import type { AssemblyExplanation } from "./markdown-generator.js";

/**
 * Enrich explanation with generated analysis.
 */
export function enrichExplanationWithAnalysis(explanation: AssemblyExplanation): void {
  explanation.summary = generateSummary(explanation);
  explanation.nextSteps = generateNextSteps(explanation);
  explanation.recommendations = generateRecommendations(explanation);
  explanation.potentialIssues = generatePotentialIssues(explanation);
}

/**
 * Generate a human-readable summary.
 */
export function generateSummary(explanation: AssemblyExplanation): string {
  const { artifact, profile, build } = explanation;

  let summary = `This project is configured as a ${artifact.type}`;

  if (artifact.language !== "unknown") {
    summary += ` written in ${artifact.language}`;
  }

  if (artifact.metadata.name) {
    summary += ` called "${artifact.metadata.name}"`;
  }

  if (profile.type !== "unknown") {
    summary += `, using the ${profile.type} profile`;
  }

  if (build.tool !== "unknown") {
    summary += `, built with ${build.tool}`;
  }

  if (build.targets.length > 0) {
    summary += `, targeting ${build.targets.join(", ")}`;
  }

  summary += ".";

  return summary;
}

/**
 * Generate next steps based on configuration.
 */
export function generateNextSteps(explanation: AssemblyExplanation): string[] {
  const steps: string[] = [];
  const { artifact, tests } = explanation;

  steps.push('Run "arbiter check" to validate your configuration');

  if (artifact.language !== "unknown") {
    steps.push(`Generate API surface with "arbiter surface ${artifact.language}"`);
  }

  if (tests.types.length === 0) {
    steps.push('Add test configurations to enable "arbiter tests scaffold"');
  } else {
    steps.push('Generate test scaffolding with "arbiter tests scaffold"');
    steps.push('Check test coverage with "arbiter tests cover"');
  }

  if (artifact.type === "library") {
    steps.push('Set up version planning with "arbiter version plan"');
  }

  steps.push('Use "arbiter watch" for continuous validation during development');
  steps.push('Generate IDE configuration with "arbiter ide recommend"');
  steps.push('Set up CI/CD with "arbiter integrate"');

  return steps;
}

/**
 * Add profile mismatch recommendations
 */
function addProfileRecommendations(
  artifact: { type: string },
  profile: { type: string },
  recommendations: string[],
): void {
  if (artifact.type === "library" && profile.type !== "library") {
    recommendations.push("Consider using profiles.#library for library-specific features");
  }
  if (artifact.type === "cli" && profile.type !== "cli") {
    recommendations.push("Consider using profiles.#cli for CLI-specific testing");
  }
}

/**
 * Add test-related recommendations
 */
function addTestRecommendations(tests: { types: string[] }, recommendations: string[]): void {
  if (tests.types.length === 0) {
    recommendations.push("Add test configurations for automated quality gates");
  }
  if (!tests.types.includes("golden")) {
    recommendations.push("Add golden tests for stable output verification");
  }
  if (!tests.types.includes("property")) {
    recommendations.push("Add property tests for comprehensive validation");
  }
}

/**
 * Generate recommendations based on configuration.
 */
export function generateRecommendations(explanation: AssemblyExplanation): string[] {
  const recommendations: string[] = [];
  const { artifact, profile, tests, contracts } = explanation;

  addProfileRecommendations(artifact, profile, recommendations);
  addTestRecommendations(tests, recommendations);

  if (contracts.invariants.length === 0) {
    recommendations.push("Define invariants to enable contract-based testing");
  }

  if (explanation.build.matrix && Object.keys(explanation.build.matrix).length === 0) {
    recommendations.push("Configure build matrix for multi-platform testing");
  }

  addLanguageSpecificRecommendations(artifact.language, recommendations);

  return recommendations;
}

/**
 * Add language-specific recommendations.
 */
function addLanguageSpecificRecommendations(language: string, recommendations: string[]): void {
  if (language === "typescript") {
    recommendations.push("Use strict TypeScript configuration for better type safety");
    recommendations.push("Enable API surface tracking for semver compliance");
  }

  if (language === "python") {
    recommendations.push("Use async patterns for better performance");
    recommendations.push("Add type hints for better tooling support");
  }

  if (language === "rust") {
    recommendations.push("Leverage zero-cost abstractions for performance");
    recommendations.push("Use compile-time checks for safety guarantees");
  }
}

/**
 * Issue check definition
 */
interface IssueCheck {
  condition: (e: AssemblyExplanation) => boolean;
  message: string;
}

/**
 * Basic configuration issue checks
 */
const BASIC_ISSUE_CHECKS: IssueCheck[] = [
  {
    condition: (e) => e.artifact.type === "unknown",
    message: "Artifact kind not clearly specified",
  },
  {
    condition: (e) => e.artifact.language === "unknown",
    message: "Programming language not specified",
  },
  { condition: (e) => e.build.tool === "unknown", message: "Build tool not configured" },
  { condition: (e) => e.build.targets.length === 0, message: "No build targets specified" },
  {
    condition: (e) => e.tests.types.length === 0,
    message: "No test strategy configured - consider adding test specifications",
  },
];

/**
 * Library-specific issue checks
 */
function checkLibraryIssues(explanation: AssemblyExplanation): string[] {
  const { artifact, profile } = explanation;
  const issues: string[] = [];

  if (artifact.type === "library" && !artifact.metadata.version) {
    issues.push("Library version not specified - semver tracking may not work correctly");
  }

  if (artifact.type === "library" && profile.type === "cli") {
    issues.push("Profile mismatch: Library artifact using CLI profile");
  }

  return issues;
}

/**
 * CLI-specific issue checks
 */
function checkCliIssues(explanation: AssemblyExplanation): string[] {
  const { artifact, profile } = explanation;
  const issues: string[] = [];

  if (artifact.type === "cli" && profile.type === "library") {
    issues.push("Profile mismatch: CLI artifact using library profile");
  }

  return issues;
}

/**
 * Generate potential issues based on configuration.
 */
export function generatePotentialIssues(explanation: AssemblyExplanation): string[] {
  const issues: string[] = [];

  // Check basic issues
  for (const check of BASIC_ISSUE_CHECKS) {
    if (check.condition(explanation)) {
      issues.push(check.message);
    }
  }

  // Check type-specific issues
  issues.push(...checkLibraryIssues(explanation));
  issues.push(...checkCliIssues(explanation));

  return issues;
}
