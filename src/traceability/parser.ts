/**
 * Artifact Parser
 * 
 * This module provides parsers for extracting traceability artifacts from various
 * file formats including CUE contracts, TypeScript code, Markdown documentation,
 * and test files. It supports the Rails & Guarantees methodology by identifying
 * requirements, scenarios, tests, and code relationships.
 */

import { readFile } from 'fs/promises';
import { extname, basename } from 'path';
import { createHash } from 'crypto';
import type {
  Artifact,
  TraceabilityLink,
  ParseResult,
  ParseIssue,
  ParseMetadata,
  Requirement,
  Scenario,
  Test,
  Code,
  Location,
  ParserConfig,
  ExtractionPattern,
  LinkRule,
  AnnotationPattern
} from './types.js';

/**
 * Base parser interface
 */
interface FileParser {
  /** File extensions this parser handles */
  extensions: string[];
  /** Parse file content */
  parse(filePath: string, content: string, config: ParserConfig): Promise<ParseResult>;
}

/**
 * CUE contract parser for extracting requirements
 */
class CueParser implements FileParser {
  extensions = ['.cue'];

  async parse(filePath: string, content: string, config: ParserConfig): Promise<ParseResult> {
    const startTime = performance.now();
    const artifacts: Artifact[] = [];
    const links: TraceabilityLink[] = [];
    const issues: ParseIssue[] = [];

    try {
      // Parse CUE structure patterns
      await this.parseRequirements(filePath, content, artifacts, issues);
      await this.parseConstraints(filePath, content, artifacts, issues);
      await this.parseDefinitions(filePath, content, artifacts, links, issues);
      
    } catch (error) {
      issues.push({
        severity: 'error',
        message: `Failed to parse CUE file: ${error}`,
        code: 'PARSE_ERROR'
      });
    }

    const duration = performance.now() - startTime;
    const fileSize = Buffer.byteLength(content, 'utf8');

    return {
      filePath,
      artifacts,
      links,
      issues,
      metadata: {
        parser: 'cue',
        duration,
        fileSize,
        fileModified: new Date(),
        parserData: {
          cueVersion: this.detectCueVersion(content),
          packageName: this.extractPackageName(content)
        }
      }
    };
  }

  private async parseRequirements(
    filePath: string,
    content: string,
    artifacts: Artifact[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for CUE field definitions that represent requirements
    const requirementPattern = /^(\w+):\s*({[^}]*priority\s*:\s*"(critical|high|medium|low)"[^}]*}|\s*string\s*@requirement\([^)]*\))/gm;
    
    let match;
    while ((match = requirementPattern.exec(content)) !== null) {
      const [fullMatch, name, definition, priority] = match;
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.getLineNumber(content, match.index + fullMatch.length);

      try {
        const requirement: Requirement = {
          id: this.generateId('req', filePath, name),
          type: 'requirement',
          name: name,
          description: this.extractDescription(definition),
          filePath,
          location: { startLine, endLine },
          contentHash: this.hashContent(fullMatch),
          lastModified: new Date(),
          tags: this.extractTags(definition),
          metadata: {},
          priority: (priority as any) || 'medium',
          category: this.extractCategory(definition) || 'functional',
          source: filePath,
          acceptanceCriteria: this.extractAcceptanceCriteria(definition),
          businessValue: this.extractBusinessValue(definition),
          compliance: this.extractCompliance(definition)
        };

        artifacts.push(requirement);
      } catch (error) {
        issues.push({
          severity: 'warning',
          message: `Failed to parse requirement ${name}: ${error}`,
          location: { startLine, endLine },
          code: 'REQUIREMENT_PARSE_ERROR'
        });
      }
    }
  }

  private async parseConstraints(
    filePath: string,
    content: string,
    artifacts: Artifact[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for CUE constraints that represent validation rules
    const constraintPattern = /^(\w+):\s*({[^}]*constraint[^}]*}|\s*\w+\s*&\s*[^&\n]+)/gm;
    
    let match;
    while ((match = constraintPattern.exec(content)) !== null) {
      const [fullMatch, name, definition] = match;
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.getLineNumber(content, match.index + fullMatch.length);

      try {
        const scenario: Scenario = {
          id: this.generateId('scenario', filePath, name),
          type: 'scenario',
          name: `${name} validation`,
          description: this.extractDescription(definition),
          filePath,
          location: { startLine, endLine },
          contentHash: this.hashContent(fullMatch),
          lastModified: new Date(),
          tags: ['constraint', 'validation', ...this.extractTags(definition)],
          metadata: { constraintType: 'cue' },
          scenarioType: 'validation',
          given: [`Field ${name} exists`],
          when: ['Value is provided'],
          then: [this.extractConstraintRule(definition)],
          expectedOutcomes: ['Constraint validation passes']
        };

        artifacts.push(scenario);
      } catch (error) {
        issues.push({
          severity: 'warning',
          message: `Failed to parse constraint ${name}: ${error}`,
          location: { startLine, endLine },
          code: 'CONSTRAINT_PARSE_ERROR'
        });
      }
    }
  }

  private async parseDefinitions(
    filePath: string,
    content: string,
    artifacts: Artifact[],
    links: TraceabilityLink[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for CUE definitions that can reference other artifacts
    const definitionPattern = /#(\w+):\s*([^#\n]+)/g;
    
    let match;
    while ((match = definitionPattern.exec(content)) !== null) {
      const [fullMatch, name, definition] = match;
      const startLine = this.getLineNumber(content, match.index);
      
      // Check for references to other artifacts
      const references = this.extractReferences(definition);
      for (const ref of references) {
        const link: TraceabilityLink = {
          id: this.generateLinkId(name, ref),
          sourceId: this.generateId('def', filePath, name),
          targetId: ref,
          linkType: 'references',
          strength: 0.7,
          isAutomatic: true,
          createdAt: new Date(),
          context: `Definition reference in ${basename(filePath)}`,
          metadata: { sourceFile: filePath, sourceLine: startLine }
        };
        
        links.push(link);
      }
    }
  }

  // Utility methods
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private generateId(type: string, filePath: string, name: string): string {
    const hash = createHash('md5').update(`${filePath}:${name}`).digest('hex').substring(0, 8);
    return `${type}_${hash}`;
  }

  private generateLinkId(source: string, target: string): string {
    const hash = createHash('md5').update(`${source}->${target}`).digest('hex').substring(0, 8);
    return `link_${hash}`;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private extractDescription(definition: string): string {
    // Extract comments or doc strings
    const commentMatch = definition.match(/\/\/\s*(.+)/);
    return commentMatch ? commentMatch[1].trim() : '';
  }

  private extractTags(definition: string): string[] {
    const tagMatch = definition.match(/@tags\(([^)]+)\)/);
    return tagMatch ? tagMatch[1].split(',').map(t => t.trim()) : [];
  }

  private extractCategory(definition: string): string | undefined {
    const categoryMatch = definition.match(/@category\s*:\s*"([^"]+)"/);
    return categoryMatch ? categoryMatch[1] : undefined;
  }

  private extractAcceptanceCriteria(definition: string): string[] {
    const criteriaMatch = definition.match(/@acceptance\(([^)]+)\)/);
    return criteriaMatch ? criteriaMatch[1].split(',').map(c => c.trim()) : [];
  }

  private extractBusinessValue(definition: string): string | undefined {
    const valueMatch = definition.match(/@value\s*:\s*"([^"]+)"/);
    return valueMatch ? valueMatch[1] : undefined;
  }

  private extractCompliance(definition: string): string[] {
    const complianceMatch = definition.match(/@compliance\(([^)]+)\)/);
    return complianceMatch ? complianceMatch[1].split(',').map(c => c.trim()) : [];
  }

  private extractConstraintRule(definition: string): string {
    // Extract the actual constraint logic
    const ruleMatch = definition.match(/&\s*(.+)/);
    return ruleMatch ? `Value must satisfy: ${ruleMatch[1].trim()}` : 'Value must be valid';
  }

  private extractReferences(definition: string): string[] {
    // Extract references to other artifacts (e.g., #requirement_abc123)
    const refPattern = /#(\w+_\w+)/g;
    const references = [];
    let match;
    
    while ((match = refPattern.exec(definition)) !== null) {
      references.push(match[1]);
    }
    
    return references;
  }

  private detectCueVersion(content: string): string {
    const versionMatch = content.match(/language\.version:\s*"([^"]+)"/);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  private extractPackageName(content: string): string {
    const packageMatch = content.match(/^package\s+(\w+)/m);
    return packageMatch ? packageMatch[1] : 'default';
  }
}

/**
 * TypeScript parser for extracting code artifacts and tests
 */
class TypeScriptParser implements FileParser {
  extensions = ['.ts', '.tsx', '.js', '.jsx'];

  async parse(filePath: string, content: string, config: ParserConfig): Promise<ParseResult> {
    const startTime = performance.now();
    const artifacts: Artifact[] = [];
    const links: TraceabilityLink[] = [];
    const issues: ParseIssue[] = [];

    try {
      if (this.isTestFile(filePath)) {
        await this.parseTests(filePath, content, artifacts, links, issues);
      } else {
        await this.parseCode(filePath, content, artifacts, links, issues);
      }
      
      await this.parseAnnotations(filePath, content, links, issues);
      
    } catch (error) {
      issues.push({
        severity: 'error',
        message: `Failed to parse TypeScript file: ${error}`,
        code: 'PARSE_ERROR'
      });
    }

    const duration = performance.now() - startTime;
    const fileSize = Buffer.byteLength(content, 'utf8');

    return {
      filePath,
      artifacts,
      links,
      issues,
      metadata: {
        parser: 'typescript',
        duration,
        fileSize,
        fileModified: new Date(),
        parserData: {
          isTestFile: this.isTestFile(filePath),
          exports: this.extractExports(content),
          imports: this.extractImports(content)
        }
      }
    };
  }

  private isTestFile(filePath: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath);
  }

  private async parseTests(
    filePath: string,
    content: string,
    artifacts: Artifact[],
    links: TraceabilityLink[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for test suites and cases
    const testPatterns = [
      /describe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\(\s*\)\s*=>\s*{/g,
      /test\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g,
      /it\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g
    ];

    for (const pattern of testPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [fullMatch, testName] = match;
        const startLine = this.getLineNumber(content, match.index);
        const endLine = this.findBlockEnd(content, match.index + fullMatch.length);

        try {
          const test: Test = {
            id: this.generateId('test', filePath, testName),
            type: 'test',
            name: testName,
            description: this.extractTestDescription(content, match.index),
            filePath,
            location: { startLine, endLine },
            contentHash: this.hashContent(fullMatch),
            lastModified: new Date(),
            tags: this.extractTestTags(content, match.index),
            metadata: {},
            framework: this.detectTestFramework(content),
            testType: this.determineTestType(filePath, testName),
            status: 'pending',
            assertions: this.extractAssertions(content, match.index, endLine)
          };

          artifacts.push(test);
          
          // Extract traceability comments
          const traceabilityRefs = this.extractTraceabilityReferences(content, match.index);
          for (const ref of traceabilityRefs) {
            const link: TraceabilityLink = {
              id: this.generateLinkId(test.id, ref.targetId),
              sourceId: test.id,
              targetId: ref.targetId,
              linkType: 'tests',
              strength: ref.strength,
              isAutomatic: false,
              createdAt: new Date(),
              context: ref.context,
              metadata: { sourceFile: filePath, sourceLine: startLine }
            };
            
            links.push(link);
          }
        } catch (error) {
          issues.push({
            severity: 'warning',
            message: `Failed to parse test ${testName}: ${error}`,
            location: { startLine, endLine },
            code: 'TEST_PARSE_ERROR'
          });
        }
      }
    }
  }

  private async parseCode(
    filePath: string,
    content: string,
    artifacts: Artifact[],
    links: TraceabilityLink[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for functions, classes, and interfaces
    const codePatterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g,
      /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*{/g,
      /(?:export\s+)?interface\s+(\w+)\s*{/g,
      /(?:export\s+)?type\s+(\w+)\s*=/g
    ];

    for (const pattern of codePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [fullMatch, name] = match;
        const startLine = this.getLineNumber(content, match.index);
        const endLine = this.findBlockEnd(content, match.index + fullMatch.length);

        try {
          const codeType = this.determineCodeType(fullMatch);
          
          const code: Code = {
            id: this.generateId('code', filePath, name),
            type: 'code',
            name: name,
            description: this.extractJSDocDescription(content, match.index),
            filePath,
            location: { startLine, endLine },
            contentHash: this.hashContent(fullMatch),
            lastModified: new Date(),
            tags: this.extractCodeTags(content, match.index),
            metadata: {},
            language: 'typescript',
            codeType,
            signatures: this.extractSignatures(content, match.index, endLine),
            dependencies: this.extractDependencies(content, match.index, endLine),
            complexity: this.calculateComplexity(content, match.index, endLine)
          };

          artifacts.push(code);
        } catch (error) {
          issues.push({
            severity: 'warning',
            message: `Failed to parse code ${name}: ${error}`,
            location: { startLine, endLine },
            code: 'CODE_PARSE_ERROR'
          });
        }
      }
    }
  }

  private async parseAnnotations(
    filePath: string,
    content: string,
    links: TraceabilityLink[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for traceability annotations in comments
    const annotationPattern = /\/\*\*?\s*@(implements|tests|validates|requires)\s+([^\s*]+)\s*(?:\*\/|\*\s*([^*]*)\*\/)/g;
    
    let match;
    while ((match = annotationPattern.exec(content)) !== null) {
      const [fullMatch, linkType, targetId, context] = match;
      const startLine = this.getLineNumber(content, match.index);

      try {
        const sourceId = this.findNearestArtifact(content, match.index);
        
        if (sourceId) {
          const link: TraceabilityLink = {
            id: this.generateLinkId(sourceId, targetId),
            sourceId,
            targetId,
            linkType: linkType as any,
            strength: 0.9, // High confidence for manual annotations
            isAutomatic: false,
            createdAt: new Date(),
            context: context?.trim() || `Manual annotation in ${basename(filePath)}`,
            metadata: { sourceFile: filePath, sourceLine: startLine, annotationType: 'comment' }
          };
          
          links.push(link);
        }
      } catch (error) {
        issues.push({
          severity: 'warning',
          message: `Failed to parse annotation: ${error}`,
          location: { startLine, endLine: startLine },
          code: 'ANNOTATION_PARSE_ERROR'
        });
      }
    }
  }

  // Utility methods for TypeScript parsing
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private findBlockEnd(content: string, startIndex: number): number {
    let braceCount = 1;
    let index = startIndex;
    
    while (index < content.length && braceCount > 0) {
      if (content[index] === '{') {
        braceCount++;
      } else if (content[index] === '}') {
        braceCount--;
      }
      index++;
    }
    
    return this.getLineNumber(content, index);
  }

  private generateId(type: string, filePath: string, name: string): string {
    const hash = createHash('md5').update(`${filePath}:${name}`).digest('hex').substring(0, 8);
    return `${type}_${hash}`;
  }

  private generateLinkId(source: string, target: string): string {
    const hash = createHash('md5').update(`${source}->${target}`).digest('hex').substring(0, 8);
    return `link_${hash}`;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private extractTestDescription(content: string, testIndex: number): string {
    // Look for JSDoc comment before test
    const beforeTest = content.substring(Math.max(0, testIndex - 500), testIndex);
    const jsdocMatch = beforeTest.match(/\/\*\*\s*([^*]*(?:\*(?!\/)[^*]*)*)\*\//);
    return jsdocMatch ? jsdocMatch[1].replace(/\*/g, '').trim() : '';
  }

  private extractTestTags(content: string, testIndex: number): string[] {
    const tags = [];
    const beforeTest = content.substring(Math.max(0, testIndex - 200), testIndex);
    
    // Look for @tags annotation
    const tagMatch = beforeTest.match(/@tags?\s+([^\n]+)/);
    if (tagMatch) {
      tags.push(...tagMatch[1].split(/[,\s]+/).filter(t => t));
    }
    
    return tags;
  }

  private detectTestFramework(content: string): string {
    if (content.includes('import') && content.includes('vitest')) return 'vitest';
    if (content.includes('import') && content.includes('jest')) return 'jest';
    if (content.includes('describe') || content.includes('it') || content.includes('test')) return 'jest/vitest';
    return 'unknown';
  }

  private determineTestType(filePath: string, testName: string): string {
    if (filePath.includes('e2e') || filePath.includes('integration')) return 'e2e';
    if (filePath.includes('integration')) return 'integration';
    if (testName.toLowerCase().includes('unit')) return 'unit';
    return 'unit';
  }

  private extractAssertions(content: string, startIndex: number, endLine: number): string[] {
    const testBlock = this.extractBlock(content, startIndex, endLine);
    const assertionPattern = /(?:expect|assert)\([^)]+\)\.([^(]+)\(/g;
    const assertions = [];
    
    let match;
    while ((match = assertionPattern.exec(testBlock)) !== null) {
      assertions.push(match[1]);
    }
    
    return assertions;
  }

  private extractTraceabilityReferences(content: string, testIndex: number): Array<{targetId: string, strength: number, context: string}> {
    const refs = [];
    const beforeTest = content.substring(Math.max(0, testIndex - 300), testIndex);
    
    // Look for requirement references
    const reqPattern = /@(?:requirement|req)\s+([^\s]+)(?:\s+(.*))?/g;
    let match;
    
    while ((match = reqPattern.exec(beforeTest)) !== null) {
      refs.push({
        targetId: match[1],
        strength: 0.9,
        context: match[2] || 'Test requirement reference'
      });
    }
    
    return refs;
  }

  private extractJSDocDescription(content: string, codeIndex: number): string {
    const beforeCode = content.substring(Math.max(0, codeIndex - 500), codeIndex);
    const jsdocMatch = beforeCode.match(/\/\*\*\s*([^*]*(?:\*(?!\/)[^*]*)*)\*\//);
    return jsdocMatch ? jsdocMatch[1].replace(/\*/g, '').trim() : '';
  }

  private extractCodeTags(content: string, codeIndex: number): string[] {
    const tags = [];
    const beforeCode = content.substring(Math.max(0, codeIndex - 200), codeIndex);
    
    const tagMatch = beforeCode.match(/@tags?\s+([^\n]+)/);
    if (tagMatch) {
      tags.push(...tagMatch[1].split(/[,\s]+/).filter(t => t));
    }
    
    return tags;
  }

  private determineCodeType(codeMatch: string): string {
    if (codeMatch.includes('function')) return 'function';
    if (codeMatch.includes('class')) return 'class';
    if (codeMatch.includes('interface')) return 'interface';
    if (codeMatch.includes('type')) return 'type';
    return 'unknown';
  }

  private extractSignatures(content: string, startIndex: number, endLine: number): string[] {
    const block = this.extractBlock(content, startIndex, endLine);
    const signatures = [];
    
    // Extract function signatures
    const funcPattern = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?/g;
    let match;
    
    while ((match = funcPattern.exec(block)) !== null) {
      signatures.push(match[0].trim());
    }
    
    return signatures;
  }

  private extractDependencies(content: string, startIndex: number, endLine: number): string[] {
    const block = this.extractBlock(content, startIndex, endLine);
    const dependencies = [];
    
    // Extract import statements and function calls
    const importPattern = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importPattern.exec(block)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }

  private calculateComplexity(content: string, startIndex: number, endLine: number): any {
    const block = this.extractBlock(content, startIndex, endLine);
    
    // Simple cyclomatic complexity calculation
    const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?'];
    let complexity = 1; // Base complexity
    
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = block.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    const linesOfCode = block.split('\n').filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    return {
      cyclomatic: complexity,
      linesOfCode
    };
  }

  private extractBlock(content: string, startIndex: number, endLine: number): string {
    const lines = content.split('\n');
    const startLine = this.getLineNumber(content, startIndex);
    return lines.slice(startLine - 1, endLine).join('\n');
  }

  private findNearestArtifact(content: string, index: number): string | null {
    // Find the nearest function or class definition
    const beforeAnnotation = content.substring(0, index);
    const afterAnnotation = content.substring(index);
    
    // Look for function/class after annotation
    const codeMatch = afterAnnotation.match(/(?:export\s+)?(?:function|class)\s+(\w+)/);
    if (codeMatch) {
      return this.generateId('code', '', codeMatch[1]);
    }
    
    return null;
  }

  private extractExports(content: string): string[] {
    const exports = [];
    const exportPattern = /export\s+(?:default\s+)?(?:function|class|interface|type|const|let|var)\s+(\w+)/g;
    
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    return exports;
  }

  private extractImports(content: string): string[] {
    const imports = [];
    const importPattern = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }
}

/**
 * Markdown parser for extracting scenarios and documentation
 */
class MarkdownParser implements FileParser {
  extensions = ['.md', '.mdx'];

  async parse(filePath: string, content: string, config: ParserConfig): Promise<ParseResult> {
    const startTime = performance.now();
    const artifacts: Artifact[] = [];
    const links: TraceabilityLink[] = [];
    const issues: ParseIssue[] = [];

    try {
      await this.parseScenarios(filePath, content, artifacts, issues);
      await this.parseRequirements(filePath, content, artifacts, issues);
      await this.parseReferences(filePath, content, links, issues);
      
    } catch (error) {
      issues.push({
        severity: 'error',
        message: `Failed to parse Markdown file: ${error}`,
        code: 'PARSE_ERROR'
      });
    }

    const duration = performance.now() - startTime;
    const fileSize = Buffer.byteLength(content, 'utf8');

    return {
      filePath,
      artifacts,
      links,
      issues,
      metadata: {
        parser: 'markdown',
        duration,
        fileSize,
        fileModified: new Date(),
        parserData: {
          headings: this.extractHeadings(content),
          codeBlocks: this.countCodeBlocks(content)
        }
      }
    };
  }

  private async parseScenarios(
    filePath: string,
    content: string,
    artifacts: Artifact[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for Gherkin-style scenarios
    const scenarioPattern = /## Scenario: (.+)\n\n(?:(.+)\n\n)?(?:\*\*Given\*\*:?\s*\n((?:- .+\n)*)\n)?(?:\*\*When\*\*:?\s*\n((?:- .+\n)*)\n)?(?:\*\*Then\*\*:?\s*\n((?:- .+\n)*))/gm;
    
    let match;
    while ((match = scenarioPattern.exec(content)) !== null) {
      const [fullMatch, name, description, givenText, whenText, thenText] = match;
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.getLineNumber(content, match.index + fullMatch.length);

      try {
        const scenario: Scenario = {
          id: this.generateId('scenario', filePath, name),
          type: 'scenario',
          name: name.trim(),
          description: description?.trim() || '',
          filePath,
          location: { startLine, endLine },
          contentHash: this.hashContent(fullMatch),
          lastModified: new Date(),
          tags: this.extractTagsFromText(description || ''),
          metadata: {},
          scenarioType: 'functional',
          given: this.parseListItems(givenText || ''),
          when: this.parseListItems(whenText || ''),
          then: this.parseListItems(thenText || ''),
          expectedOutcomes: this.parseListItems(thenText || '')
        };

        artifacts.push(scenario);
      } catch (error) {
        issues.push({
          severity: 'warning',
          message: `Failed to parse scenario ${name}: ${error}`,
          location: { startLine, endLine },
          code: 'SCENARIO_PARSE_ERROR'
        });
      }
    }
  }

  private async parseRequirements(
    filePath: string,
    content: string,
    artifacts: Artifact[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for requirement sections
    const requirementPattern = /## Requirement: (.+)\n\n(?:(.+)\n\n)?(?:\*\*Priority\*\*:\s*(critical|high|medium|low)\n)?(?:\*\*Category\*\*:\s*(.+)\n)?(?:\*\*Acceptance Criteria\*\*:\s*\n((?:- .+\n)*))?/gm;
    
    let match;
    while ((match = requirementPattern.exec(content)) !== null) {
      const [fullMatch, name, description, priority, category, criteriaText] = match;
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.getLineNumber(content, match.index + fullMatch.length);

      try {
        const requirement: Requirement = {
          id: this.generateId('req', filePath, name),
          type: 'requirement',
          name: name.trim(),
          description: description?.trim() || '',
          filePath,
          location: { startLine, endLine },
          contentHash: this.hashContent(fullMatch),
          lastModified: new Date(),
          tags: this.extractTagsFromText(description || ''),
          metadata: {},
          priority: (priority as any) || 'medium',
          category: category?.trim() || 'functional',
          source: filePath,
          acceptanceCriteria: this.parseListItems(criteriaText || ''),
          businessValue: this.extractBusinessValue(description || ''),
          compliance: this.extractCompliance(description || '')
        };

        artifacts.push(requirement);
      } catch (error) {
        issues.push({
          severity: 'warning',
          message: `Failed to parse requirement ${name}: ${error}`,
          location: { startLine, endLine },
          code: 'REQUIREMENT_PARSE_ERROR'
        });
      }
    }
  }

  private async parseReferences(
    filePath: string,
    content: string,
    links: TraceabilityLink[],
    issues: ParseIssue[]
  ): Promise<void> {
    // Pattern for artifact references in markdown
    const referencePattern = /\[([^\]]+)\]\(#([^)]+)\)/g;
    
    let match;
    while ((match = referencePattern.exec(content)) !== null) {
      const [fullMatch, linkText, targetId] = match;
      const startLine = this.getLineNumber(content, match.index);

      try {
        const sourceId = this.findNearestSection(content, match.index);
        
        if (sourceId) {
          const link: TraceabilityLink = {
            id: this.generateLinkId(sourceId, targetId),
            sourceId,
            targetId,
            linkType: 'references',
            strength: 0.8,
            isAutomatic: true,
            createdAt: new Date(),
            context: `Reference in ${basename(filePath)}: ${linkText}`,
            metadata: { sourceFile: filePath, sourceLine: startLine, linkText }
          };
          
          links.push(link);
        }
      } catch (error) {
        issues.push({
          severity: 'info',
          message: `Could not resolve reference ${targetId}: ${error}`,
          location: { startLine, endLine: startLine },
          code: 'REFERENCE_RESOLUTION_ERROR'
        });
      }
    }
  }

  // Utility methods
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private generateId(type: string, filePath: string, name: string): string {
    const hash = createHash('md5').update(`${filePath}:${name}`).digest('hex').substring(0, 8);
    return `${type}_${hash}`;
  }

  private generateLinkId(source: string, target: string): string {
    const hash = createHash('md5').update(`${source}->${target}`).digest('hex').substring(0, 8);
    return `link_${hash}`;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private parseListItems(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  private extractTagsFromText(text: string): string[] {
    const tagPattern = /#(\w+)/g;
    const tags = [];
    let match;
    
    while ((match = tagPattern.exec(text)) !== null) {
      tags.push(match[1]);
    }
    
    return tags;
  }

  private extractBusinessValue(description: string): string | undefined {
    const valuePattern = /(?:business value|value):\s*([^.\n]+)/i;
    const match = description.match(valuePattern);
    return match ? match[1].trim() : undefined;
  }

  private extractCompliance(description: string): string[] {
    const compliancePattern = /(?:compliance|standards?):\s*([^.\n]+)/i;
    const match = description.match(compliancePattern);
    return match ? match[1].split(',').map(c => c.trim()) : [];
  }

  private findNearestSection(content: string, index: number): string | null {
    const beforeRef = content.substring(0, index);
    const lines = beforeRef.split('\n').reverse();
    
    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.+)/);
      if (headingMatch) {
        return this.generateId('section', '', headingMatch[1]);
      }
    }
    
    return null;
  }

  private extractHeadings(content: string): string[] {
    const headings = [];
    const headingPattern = /^(#{1,6})\s+(.+)$/gm;
    
    let match;
    while ((match = headingPattern.exec(content)) !== null) {
      headings.push(match[2]);
    }
    
    return headings;
  }

  private countCodeBlocks(content: string): number {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const matches = content.match(codeBlockPattern);
    return matches ? matches.length : 0;
  }
}

/**
 * Main artifact parser that coordinates different file type parsers
 */
export class ArtifactParser {
  private parsers: Map<string, FileParser>;
  private config: Record<string, ParserConfig>;

  constructor(config: Record<string, ParserConfig> = {}) {
    this.config = config;
    this.parsers = new Map();
    
    // Register default parsers
    this.registerParser(new CueParser());
    this.registerParser(new TypeScriptParser());
    this.registerParser(new MarkdownParser());
  }

  /**
   * Registers a parser for specific file types
   */
  registerParser(parser: FileParser): void {
    for (const ext of parser.extensions) {
      this.parsers.set(ext, parser);
    }
  }

  /**
   * Parses a file and extracts artifacts and links
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    const extension = extname(filePath).toLowerCase();
    const parser = this.parsers.get(extension);

    if (!parser) {
      return {
        filePath,
        artifacts: [],
        links: [],
        issues: [{
          severity: 'warning',
          message: `No parser available for file type: ${extension}`,
          code: 'NO_PARSER'
        }],
        metadata: {
          parser: 'none',
          duration: 0,
          fileSize: 0,
          fileModified: new Date(),
          parserData: {}
        }
      };
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const parserConfig = this.config[parser.constructor.name] || { enabled: true, options: {} };
      
      return await parser.parse(filePath, content, parserConfig);
    } catch (error) {
      return {
        filePath,
        artifacts: [],
        links: [],
        issues: [{
          severity: 'error',
          message: `Failed to read file: ${error}`,
          code: 'FILE_READ_ERROR'
        }],
        metadata: {
          parser: parser.constructor.name,
          duration: 0,
          fileSize: 0,
          fileModified: new Date(),
          parserData: {}
        }
      };
    }
  }

  /**
   * Parses multiple files in batch
   */
  async parseFiles(filePaths: string[]): Promise<ParseResult[]> {
    const results = await Promise.allSettled(
      filePaths.map(filePath => this.parseFile(filePath))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          filePath: filePaths[index],
          artifacts: [],
          links: [],
          issues: [{
            severity: 'error',
            message: `Parser failed: ${result.reason}`,
            code: 'PARSER_FAILURE'
          }],
          metadata: {
            parser: 'unknown',
            duration: 0,
            fileSize: 0,
            fileModified: new Date(),
            parserData: {}
          }
        };
      }
    });
  }

  /**
   * Gets available parsers and their supported extensions
   */
  getSupportedExtensions(): Record<string, string> {
    const extensions: Record<string, string> = {};
    
    for (const [ext, parser] of this.parsers) {
      extensions[ext] = parser.constructor.name;
    }
    
    return extensions;
  }
}