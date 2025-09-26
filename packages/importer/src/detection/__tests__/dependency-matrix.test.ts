/**
 * Tests for the Dependency Matrix and Enhanced Detection
 */

import {
  DEPENDENCY_MATRIX,
  calculateCategoryConfidence,
  determineMostLikelyCategory,
  getAllCategoriesByConfidence,
  getCategoryExplanation,
} from '../dependency-matrix';

describe('Dependency Matrix', () => {
  describe('JavaScript/TypeScript CLI Detection', () => {
    it('should correctly identify CLI tools based on dependencies', () => {
      const cliDependencies = ['commander', 'chalk', 'ora', 'inquirer'];

      const result = determineMostLikelyCategory(cliDependencies, 'javascript');

      expect(result.category).toBe('tool');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should distinguish CLI from web service with overlapping dependencies', () => {
      const cliDeps = ['commander', 'chalk', 'axios']; // axios could be used by both
      const webDeps = ['express', 'cors', 'axios'];

      const cliResult = determineMostLikelyCategory(cliDeps, 'javascript');
      const webResult = determineMostLikelyCategory(webDeps, 'javascript');

      expect(cliResult.category).toBe('tool');
      expect(webResult.category).toBe('web_service');
    });

    it('should provide explanations for CLI detection', () => {
      const dependencies = ['commander', 'chalk'];

      const explanation = getCategoryExplanation(dependencies, 'javascript', 'tool');

      expect(explanation).toContain('commander → Command-line argument parsing (weight: 0.9)');
      expect(explanation).toContain('chalk → Terminal text styling (weight: 0.7)');
    });

    it('should handle TypeScript CLI dependencies', () => {
      const typescriptCliDeps = ['commander', 'inquirer', '@types/node'];

      const result = determineMostLikelyCategory(typescriptCliDeps, 'typescript');

      expect(result.category).toBe('tool');
      expect(result.confidence).toBeGreaterThan(0.3);
    });
  });

  describe('Python CLI Detection', () => {
    it('should correctly identify Python CLI tools', () => {
      const pythonCliDeps = ['click', 'rich', 'typer'];

      const result = determineMostLikelyCategory(pythonCliDeps, 'python');

      expect(result.category).toBe('tool');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should distinguish Python CLI from web service', () => {
      const pythonCliDeps = ['click', 'colorama'];
      const pythonWebDeps = ['fastapi', 'uvicorn'];

      const cliResult = determineMostLikelyCategory(pythonCliDeps, 'python');
      const webResult = determineMostLikelyCategory(pythonWebDeps, 'python');

      expect(cliResult.category).toBe('tool');
      expect(webResult.category).toBe('web_service');
    });
  });

  describe('Rust CLI Detection', () => {
    it('should correctly identify Rust CLI tools', () => {
      const rustCliDeps = ['clap', 'anyhow', 'indicatif'];

      const result = determineMostLikelyCategory(rustCliDeps, 'rust');

      expect(result.category).toBe('tool');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should distinguish Rust CLI from web service', () => {
      const rustCliDeps = ['clap', 'thiserror'];
      const rustWebDeps = ['axum', 'tokio'];

      const cliResult = determineMostLikelyCategory(rustCliDeps, 'rust');
      const webResult = determineMostLikelyCategory(rustWebDeps, 'rust');

      expect(cliResult.category).toBe('tool');
      expect(webResult.category).toBe('web_service');
    });
  });

  describe('Go CLI Detection', () => {
    it('should correctly identify Go CLI tools', () => {
      const goCliDeps = ['github.com/spf13/cobra', 'github.com/fatih/color'];

      const result = determineMostLikelyCategory(goCliDeps, 'go');

      expect(result.category).toBe('tool');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle Go import aliases', () => {
      const goDepsWithAliases = ['cobra', 'cli']; // aliases for full paths

      const result = determineMostLikelyCategory(goDepsWithAliases, 'go');

      expect(result.category).toBe('tool');
    });
  });

  describe('C# CLI Detection', () => {
    it('should correctly identify C# CLI tools', () => {
      const csharpCliDeps = ['CommandLineParser', 'Spectre.Console'];

      const result = determineMostLikelyCategory(csharpCliDeps, 'csharp');

      expect(result.category).toBe('tool');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should distinguish C# CLI from web service', () => {
      const csharpCliDeps = ['System.CommandLine'];
      const csharpWebDeps = ['Microsoft.AspNetCore'];

      const cliResult = determineMostLikelyCategory(csharpCliDeps, 'csharp');
      const webResult = determineMostLikelyCategory(csharpWebDeps, 'csharp');

      expect(cliResult.category).toBe('tool');
      expect(webResult.category).toBe('web_service');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown languages gracefully', () => {
      const result = determineMostLikelyCategory(['some-dep'], 'unknown-language');

      expect(result.category).toBe('module');
      expect(result.confidence).toBe(0);
    });

    it('should handle empty dependencies', () => {
      const result = determineMostLikelyCategory([], 'javascript');

      expect(result.category).toBe('module');
      expect(result.confidence).toBe(0.1);
    });

    it('should return all categories sorted by confidence', () => {
      const mixedDeps = ['commander', 'express', 'react']; // CLI, web, and frontend

      const categories = getAllCategoriesByConfidence(mixedDeps, 'javascript');

      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0].confidence).toBeGreaterThanOrEqual(categories[1]?.confidence || 0);
    });

    it('should handle partial matches in dependency names', () => {
      const nestjsDeps = ['@nestjs/core', '@nestjs/common'];

      const result = determineMostLikelyCategory(nestjsDeps, 'typescript');

      expect(result.category).toBe('web_service');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Weight System', () => {
    it('should weight higher confidence dependencies more', () => {
      const highWeightCli = ['commander']; // weight 0.9
      const lowWeightCli = ['minimist']; // weight 0.5

      const highResult = calculateCategoryConfidence(highWeightCli, 'javascript', 'tool');
      const lowResult = calculateCategoryConfidence(lowWeightCli, 'javascript', 'tool');

      expect(highResult).toBeGreaterThan(lowResult);
    });

    it('should combine multiple dependencies for higher confidence', () => {
      const singleDep = ['commander'];
      const multipleDeps = ['commander', 'chalk', 'inquirer'];

      const singleResult = calculateCategoryConfidence(singleDep, 'javascript', 'tool');
      const multipleResult = calculateCategoryConfidence(multipleDeps, 'javascript', 'tool');

      expect(multipleResult).toBeGreaterThan(singleResult);
    });
  });

  describe('Framework Coverage', () => {
    it('should have comprehensive CLI coverage for major languages', () => {
      const languages = ['javascript', 'typescript', 'python', 'rust', 'go', 'csharp'];

      languages.forEach(lang => {
        const matrix = DEPENDENCY_MATRIX[lang];
        expect(matrix).toBeDefined();
        expect(matrix.tool).toBeDefined();
        expect(matrix.tool.length).toBeGreaterThanOrEqual(5); // At least 5 CLI indicators
      });
    });

    it('should have web service coverage for major languages', () => {
      const languages = ['javascript', 'typescript', 'python', 'rust', 'go', 'csharp'];

      languages.forEach(lang => {
        const matrix = DEPENDENCY_MATRIX[lang];
        expect(matrix.web_service).toBeDefined();
        expect(matrix.web_service.length).toBeGreaterThanOrEqual(5);
      });
    });
  });
});
