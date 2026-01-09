/**
 * @packageDocumentation
 * Assembly file parsing utilities for explanation generation.
 *
 * Provides functionality to:
 * - Parse CUE assembly files into explanation structures
 * - Extract artifact, profile, build, and test information
 * - Track parsing context through nested structures
 */

import type { AssemblyExplanation } from "./markdown-generator.js";

/** Parsing context for state tracking */
export interface ParsingContext {
  currentSection: string;
  braceDepth: number;
}

/**
 * Initialize an empty explanation structure.
 */
export function initializeEmptyExplanation(): AssemblyExplanation {
  return {
    summary: "",
    artifact: {
      type: "unknown",
      language: "unknown",
      description: "",
      metadata: {},
    },
    profile: {
      type: "unknown",
      configuration: {},
      features: [],
    },
    build: {
      tool: "unknown",
      targets: [],
      matrix: {},
    },
    tests: {
      types: [],
      coverage: {},
      golden: [],
      property: [],
    },
    contracts: {
      invariants: [],
      constraints: [],
    },
    nextSteps: [],
    recommendations: [],
    potentialIssues: [],
  };
}

/**
 * Create parsing context for state management.
 */
export function createParsingContext(): ParsingContext {
  return {
    currentSection: "",
    braceDepth: 0,
  };
}

/**
 * Process all content lines with state tracking.
 */
export function processContentLines(
  lines: string[],
  explanation: AssemblyExplanation,
  context: ParsingContext,
): void {
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    processIndividualLine(trimmedLine, line, explanation, context);
  }
}

/**
 * Process a single line with all extraction logic.
 */
function processIndividualLine(
  trimmedLine: string,
  fullLine: string,
  explanation: AssemblyExplanation,
  context: ParsingContext,
): void {
  extractCommentDescription(trimmedLine, explanation);
  updateBraceDepth(fullLine, context);
  updateCurrentSection(trimmedLine, context, explanation);
  extractSectionSpecificFields(trimmedLine, explanation, context);
  extractGlobalBuildInfo(trimmedLine, explanation);
  extractTestInformation(trimmedLine, explanation);
  extractContractInformation(trimmedLine, explanation);
}

/**
 * Extract description from comments.
 */
function extractCommentDescription(trimmedLine: string, explanation: AssemblyExplanation): void {
  if (trimmedLine.startsWith("//") && explanation.artifact.description === "") {
    explanation.artifact.description += `${trimmedLine.replace(/^\/\/\s*/, "")} `;
  }
}

/**
 * Update brace depth tracking.
 */
function updateBraceDepth(line: string, context: ParsingContext): void {
  context.braceDepth += (line.match(/{/g) || []).length;
  context.braceDepth -= (line.match(/}/g) || []).length;
}

/**
 * Update current parsing section.
 */
function updateCurrentSection(
  trimmedLine: string,
  context: ParsingContext,
  explanation: AssemblyExplanation,
): void {
  if (trimmedLine.includes("Artifact:") && trimmedLine.includes("#Artifact")) {
    context.currentSection = "artifact";
  } else if (trimmedLine.includes("Profile:") && trimmedLine.includes("#")) {
    context.currentSection = "profile";
    const profileMatch = trimmedLine.match(/#(\w+)/);
    if (profileMatch) {
      explanation.profile.type = profileMatch[1];
    }
  }
}

/**
 * Extract fields specific to current section.
 */
function extractSectionSpecificFields(
  trimmedLine: string,
  explanation: AssemblyExplanation,
  context: ParsingContext,
): void {
  if (context.currentSection === "artifact") {
    extractArtifactFields(trimmedLine, explanation);
  }
}

/**
 * Extract artifact-specific fields.
 */
function extractArtifactFields(trimmedLine: string, explanation: AssemblyExplanation): void {
  const fieldExtractors = [
    {
      pattern: /kind:\s*"([^"]+)"/,
      target: (match: string) => {
        explanation.artifact.type = match;
      },
    },
    {
      pattern: /language:\s*"([^"]+)"/,
      target: (match: string) => {
        explanation.artifact.language = match;
      },
    },
    {
      pattern: /name:\s*"([^"]+)"/,
      target: (match: string) => {
        explanation.artifact.metadata.name = match;
      },
    },
    {
      pattern: /version:\s*"([^"]+)"/,
      target: (match: string) => {
        explanation.artifact.metadata.version = match;
      },
    },
  ];

  for (const extractor of fieldExtractors) {
    if (trimmedLine.includes(extractor.pattern.source.split("\\s")[0])) {
      const match = trimmedLine.match(extractor.pattern);
      if (match) {
        extractor.target(match[1]);
      }
    }
  }
}

/**
 * Extract global build information.
 */
function extractGlobalBuildInfo(trimmedLine: string, explanation: AssemblyExplanation): void {
  if (trimmedLine.includes("tool:")) {
    const toolMatch = trimmedLine.match(/tool:\s*"([^"]+)"/);
    if (toolMatch) {
      explanation.build.tool = toolMatch[1];
    }
  }

  if (trimmedLine.includes("targets:")) {
    const targetsMatch = trimmedLine.match(/targets:\s*\[([^\]]+)\]/);
    if (targetsMatch) {
      explanation.build.targets = targetsMatch[1].split(",").map((t) => t.trim().replace(/"/g, ""));
    }
  }
}

/**
 * Extract test information.
 */
function extractTestInformation(trimmedLine: string, explanation: AssemblyExplanation): void {
  if (trimmedLine.includes("golden:") || trimmedLine.includes("property:")) {
    if (trimmedLine.includes("golden:")) {
      explanation.tests.types.push("golden");
    }
    if (trimmedLine.includes("property:")) {
      explanation.tests.types.push("property");
    }
  }
}

/**
 * Extract contract and invariant information.
 */
function extractContractInformation(trimmedLine: string, explanation: AssemblyExplanation): void {
  if (trimmedLine.includes("invariants:")) {
    explanation.tests.types.push("contracts");
  }

  if (trimmedLine.includes("name:") && trimmedLine.includes("formula:")) {
    const nameMatch = trimmedLine.match(/name:\s*"([^"]+)"/);
    if (nameMatch) {
      explanation.contracts.invariants.push(nameMatch[1]);
    }
  }
}
