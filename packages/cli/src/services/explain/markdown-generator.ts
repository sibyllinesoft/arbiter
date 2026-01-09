/**
 * @packageDocumentation
 * Markdown explanation generators for the explain command.
 *
 * Provides functionality to:
 * - Generate human-readable Markdown from assembly explanations
 * - Format build, test, contract, and artifact information
 * - Support hints and recommendations in output
 */

export interface AssemblyExplanation {
  summary: string;
  artifact: {
    type: string;
    language: string;
    description: string;
    metadata: Record<string, any>;
  };
  profile: {
    type: string;
    configuration: Record<string, any>;
    features: string[];
  };
  build: {
    tool: string;
    targets: string[];
    matrix?: Record<string, any>;
  };
  tests: {
    types: string[];
    coverage?: Record<string, any>;
    golden?: any[];
    property?: any[];
  };
  contracts: {
    invariants: string[];
    constraints: string[];
  };
  nextSteps: string[];
  recommendations: string[];
  potentialIssues: string[];
}

/**
 * Generate markdown header section
 */
export function generateMarkdownHeader(): string {
  return `# Project Configuration Explanation\n\n> Generated on ${new Date().toLocaleString()}\n\n`;
}

/**
 * Generate markdown summary section
 */
export function generateMarkdownSummary(summary: string): string {
  return `## Summary\n\n${summary}\n\n`;
}

/**
 * Generate markdown artifact details section
 */
export function generateMarkdownArtifactDetails(artifact: AssemblyExplanation["artifact"]): string {
  const lines = [
    "## Artifact Details\n",
    `- **Type**: ${artifact.type}`,
    `- **Language**: ${artifact.language}`,
  ];

  if (artifact.metadata.name) {
    lines.push(`- **Name**: ${artifact.metadata.name}`);
  }
  if (artifact.metadata.version) {
    lines.push(`- **Version**: ${artifact.metadata.version}`);
  }
  if (artifact.description.trim()) {
    lines.push(`- **Description**: ${artifact.description.trim()}`);
  }

  return `${lines.join("\n")}\n\n`;
}

/**
 * Generate markdown profile configuration section
 */
export function generateMarkdownProfileConfiguration(
  profile: AssemblyExplanation["profile"],
): string {
  const lines = ["## Profile Configuration\n", `- **Profile Type**: ${profile.type}`];

  if (profile.features.length > 0) {
    lines.push(`- **Features**: ${profile.features.join(", ")}`);
  }

  return `${lines.join("\n")}\n\n`;
}

/**
 * Generate markdown build configuration section
 */
export function generateMarkdownBuildConfiguration(build: AssemblyExplanation["build"]): string {
  const lines = ["## Build Configuration\n", `- **Build Tool**: ${build.tool}`];

  if (build.targets.length > 0) {
    lines.push(`- **Targets**: ${build.targets.join(", ")}`);
  }

  return `${lines.join("\n")}\n\n`;
}

/**
 * Generate markdown test configuration section
 */
export function generateMarkdownTestConfiguration(tests: AssemblyExplanation["tests"]): string {
  if (tests.types.length === 0) {
    return "";
  }

  return `## Test Configuration\n\n- **Test Types**: ${tests.types.join(", ")}\n\n`;
}

/**
 * Generate markdown contracts section
 */
export function generateMarkdownContracts(contracts: AssemblyExplanation["contracts"]): string {
  if (contracts.invariants.length === 0) {
    return "";
  }

  const lines = ["## Contracts & Invariants\n"];
  for (const invariant of contracts.invariants) {
    lines.push(`- ${invariant}`);
  }

  return `${lines.join("\n")}\n\n`;
}

/**
 * Generate markdown next steps section
 */
export function generateMarkdownNextSteps(nextSteps: string[]): string {
  if (nextSteps.length === 0) {
    return "";
  }

  const lines = ["## Recommended Next Steps\n"];
  for (let i = 0; i < nextSteps.length; i++) {
    lines.push(`${i + 1}. ${nextSteps[i]}`);
  }

  return `${lines.join("\n")}\n\n`;
}

/**
 * Generate markdown recommendations section
 */
export function generateMarkdownRecommendations(recommendations: string[]): string {
  if (recommendations.length === 0) {
    return "";
  }

  const lines = ["## Recommendations\n"];
  for (const recommendation of recommendations) {
    lines.push(`- ${recommendation}`);
  }

  return `${lines.join("\n")}\n\n`;
}

/**
 * Generate markdown potential issues section
 */
export function generateMarkdownPotentialIssues(potentialIssues: string[]): string {
  if (potentialIssues.length === 0) {
    return "";
  }

  const lines = ["## Potential Issues\n"];
  for (const issue of potentialIssues) {
    lines.push(`- ⚠️ ${issue}`);
  }

  return `${lines.join("\n")}\n\n`;
}

/**
 * Markdown explanation generator using Template Method pattern
 */
class MarkdownExplanationGenerator {
  private explanation: AssemblyExplanation;

  constructor(explanation: AssemblyExplanation) {
    this.explanation = explanation;
  }

  /**
   * Template method - defines the algorithm structure
   */
  generateExplanation(): string {
    const sections = this.collectSections();
    return this.combineSections(sections);
  }

  /**
   * Collect all sections in order
   */
  private collectSections(): string[] {
    return [
      this.generateHeader(),
      this.generateSummarySection(),
      this.generateArtifactSection(),
      this.generateProfileSection(),
      this.generateBuildSection(),
      this.generateTestSection(),
      this.generateContractsSection(),
      this.generateNextStepsSection(),
      this.generateRecommendationsSection(),
      this.generateIssuesSection(),
    ];
  }

  /**
   * Combine sections with filtering
   */
  private combineSections(sections: string[]): string {
    return sections.filter((section) => section.trim()).join("");
  }

  // Section generation methods - each with single responsibility
  private generateHeader(): string {
    return generateMarkdownHeader();
  }

  private generateSummarySection(): string {
    return generateMarkdownSummary(this.explanation.summary);
  }

  private generateArtifactSection(): string {
    return generateMarkdownArtifactDetails(this.explanation.artifact);
  }

  private generateProfileSection(): string {
    return generateMarkdownProfileConfiguration(this.explanation.profile);
  }

  private generateBuildSection(): string {
    return generateMarkdownBuildConfiguration(this.explanation.build);
  }

  private generateTestSection(): string {
    return generateMarkdownTestConfiguration(this.explanation.tests);
  }

  private generateContractsSection(): string {
    return generateMarkdownContracts(this.explanation.contracts);
  }

  private generateNextStepsSection(): string {
    return generateMarkdownNextSteps(this.explanation.nextSteps);
  }

  private generateRecommendationsSection(): string {
    return generateMarkdownRecommendations(this.explanation.recommendations);
  }

  private generateIssuesSection(): string {
    return generateMarkdownPotentialIssues(this.explanation.potentialIssues);
  }
}

/**
 * Generate Markdown explanation for file output
 */
export function generateMarkdownExplanation(explanation: AssemblyExplanation): string {
  const generator = new MarkdownExplanationGenerator(explanation);
  return generator.generateExplanation();
}
