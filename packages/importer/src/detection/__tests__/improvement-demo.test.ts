/**
 * Demonstration of CLI Detection Improvements
 *
 * This test shows how the new dependency matrix and detection engine
 * can distinguish between different artifact types more accurately
 * than a simple pattern-based approach.
 */

import { type DetectionContext, detectArtifactType } from '../artifact-detector';
import { determineMostLikelyCategory } from '../dependency-matrix';

describe('CLI Detection Improvements Demo', () => {
  describe('Before vs After: CLI with chalk dependency', () => {
    it('should now correctly identify CLI tools with chalk (originally misclassified as library)', () => {
      // This is the scenario mentioned in the original request:
      // A CLI tool using chalk was being identified as a library

      const context: DetectionContext = {
        language: 'javascript',
        dependencies: ['chalk'], // CLI dependency that was causing misclassification
        scripts: {
          start: 'node bin/cli.js',
          help: 'node bin/cli.js --help',
        },
        filePatterns: ['bin/cli.js', 'src/commands/'],
        packageConfig: {
          name: 'my-cli-tool',
          bin: {
            mycli: 'bin/cli.js',
          },
          preferGlobal: true,
        },
        sourceAnalysis: {
          hasBinaryExecution: true,
          hasServerPatterns: false,
          hasFrontendPatterns: false,
          hasCliPatterns: true,
          hasDataProcessingPatterns: false,
          hasTestPatterns: false,
          hasBuildPatterns: false,
          hasGamePatterns: false,
          hasMobilePatterns: false,
          hasDesktopPatterns: false,
        },
      };

      const result = detectArtifactType(context);

      // With the new detection logic, this should be correctly identified as CLI
      expect(result.primaryType).toBe('cli');
      expect(result.confidence).toBeGreaterThan(0.7);

      // Should have multiple factors contributing to CLI detection
      expect(result.factors.dependencyFactors.some(f => f.category === 'cli')).toBe(true);
      expect(result.factors.configFactors.some(f => f.category === 'cli')).toBe(true);
      expect(result.factors.scriptFactors.some(f => f.category === 'cli')).toBe(true);
      expect(result.factors.sourceFactors?.some(f => f.category === 'cli')).toBe(true);
    });
  });

  describe('Multi-language CLI Detection Capabilities', () => {
    it('should detect CLI across different programming languages', () => {
      const languages = [
        { lang: 'javascript', deps: ['commander'] },
        { lang: 'typescript', deps: ['commander'] },
        { lang: 'python', deps: ['click'] },
        { lang: 'rust', deps: ['clap'] },
        { lang: 'go', deps: ['github.com/spf13/cobra'] },
        { lang: 'csharp', deps: ['CommandLineParser'] },
      ];

      languages.forEach(({ lang, deps }) => {
        const result = determineMostLikelyCategory(deps, lang);
        expect(result.category).toBe('cli');
        expect(result.confidence).toBeGreaterThan(0.5);
      });
    });
  });

  describe('Distinction Capabilities', () => {
    it('should distinguish between CLI, web service, and library accurately', () => {
      const testCases = [
        {
          type: 'cli',
          deps: ['commander', 'chalk', 'inquirer'],
          expectedType: 'cli',
        },
        {
          type: 'web service',
          deps: ['express', 'cors', 'helmet'],
          expectedType: 'web_service',
        },
        {
          type: 'frontend',
          deps: ['react', 'react-dom', 'webpack'],
          expectedType: 'frontend',
        },
        {
          type: 'library',
          deps: ['lodash', 'axios', 'uuid'],
          expectedType: 'library',
        },
      ];

      testCases.forEach(({ type, deps, expectedType }) => {
        const result = determineMostLikelyCategory(deps, 'javascript');
        expect(result.category).toBe(expectedType);
      });
    });

    it('should handle ambiguous cases by providing alternatives', () => {
      // A package that could be both CLI and web service
      const ambiguousContext: DetectionContext = {
        language: 'javascript',
        dependencies: ['commander', 'express'], // Both CLI and web
        scripts: {
          start: 'node server.js',
          cli: 'node bin/cli.js',
        },
        filePatterns: ['server.js', 'bin/cli.js'],
        packageConfig: {
          name: 'dual-purpose-tool',
        },
      };

      const result = detectArtifactType(ambiguousContext);

      // Should detect one as primary and list the other as alternative
      expect(['cli', 'web_service']).toContain(result.primaryType);
      expect(result.alternativeTypes.length).toBeGreaterThan(0);

      const allTypes = [result.primaryType, ...result.alternativeTypes.map(alt => alt.type)];
      expect(allTypes).toContain('cli');
      expect(allTypes).toContain('web_service');
    });
  });

  describe('Explanation and Reasoning', () => {
    it('should provide clear explanations for detection decisions', () => {
      const context: DetectionContext = {
        language: 'python',
        dependencies: ['click', 'rich'],
        scripts: {},
        filePatterns: ['cli.py'],
        packageConfig: {
          entry_points: {
            console_scripts: {
              mytool: 'mypackage.cli:main',
            },
          },
        },
      };

      const result = detectArtifactType(context);

      expect(result.primaryType).toBe('cli');
      expect(result.explanation.length).toBeGreaterThan(1);

      // Should mention dependencies in explanation
      const dependencyExplanation = result.explanation.find(
        line => line.includes('Dependencies:') || line.includes('click')
      );
      expect(dependencyExplanation).toBeDefined();
    });
  });

  describe('Comprehensive Factor Analysis', () => {
    it('should analyze all available factors for accurate detection', () => {
      const context: DetectionContext = {
        language: 'rust',
        dependencies: ['clap', 'anyhow'], // CLI dependencies
        scripts: {
          build: 'cargo build',
          run: 'cargo run',
        },
        filePatterns: ['src/main.rs', 'src/cli/'], // CLI file patterns
        packageConfig: {
          name: 'rust-cli-tool',
          bin: [{ name: 'mytool' }], // Binary configuration
        },
        sourceAnalysis: {
          hasBinaryExecution: true, // Source analysis
          hasServerPatterns: false,
          hasFrontendPatterns: false,
          hasCliPatterns: true,
          hasDataProcessingPatterns: false,
          hasTestPatterns: false,
          hasBuildPatterns: false,
          hasGamePatterns: false,
          hasMobilePatterns: false,
          hasDesktopPatterns: false,
        },
      };

      const result = detectArtifactType(context);

      expect(result.primaryType).toBe('cli');

      // Should have evidence from multiple factor types
      expect(result.factors.dependencyFactors.length).toBeGreaterThan(0);
      expect(result.factors.configFactors.length).toBeGreaterThan(0);
      expect(result.factors.scriptFactors.length).toBeGreaterThan(0);
      expect(result.factors.sourceFactors?.length).toBeGreaterThan(0);

      // High confidence due to multiple confirming factors
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });
});
