/**
 * CUE Error Translator
 * 
 * Converts cryptic CUE errors into AI-friendly explanations with actionable fixes.
 * This module provides a rule-based engine for pattern matching and error translation.
 */

// Core interfaces for structured error handling
export interface CueErrorDetails {
  filename?: string;
  line?: number;
  column?: number;
  path?: string;
  rawMessage: string;
  errorType: CueErrorType;
  context?: string;
}

export interface TranslatedCueError extends CueErrorDetails {
  friendlyMessage: string;
  explanation: string;
  suggestions: string[];
  severity: 'error' | 'warning' | 'info';
  category: CueErrorCategory;
  learnMoreUrl?: string;
}

export enum CueErrorType {
  NON_CONCRETE_VALUE = 'non_concrete_value',
  TYPE_MISMATCH = 'type_mismatch',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  UNDEFINED_FIELD = 'undefined_field',
  CYCLIC_DEPENDENCY = 'cyclic_dependency',
  STRUCTURAL_ERROR = 'structural_error',
  SYNTAX_ERROR = 'syntax_error',
  IMPORT_ERROR = 'import_error',
  DISJUNCTION_ERROR = 'disjunction_error',
  GENERIC_ERROR = 'generic_error'
}

export enum CueErrorCategory {
  VALIDATION = 'validation',
  TYPES = 'types',
  STRUCTURE = 'structure',
  REFERENCES = 'references',
  SYNTAX = 'syntax'
}

// Rule engine interfaces
interface ErrorRule {
  pattern: RegExp;
  errorType: CueErrorType;
  category: CueErrorCategory;
  severity: 'error' | 'warning' | 'info';
  friendlyMessage: (match: RegExpMatchArray, context: CueErrorDetails) => string;
  explanation: (match: RegExpMatchArray, context: CueErrorDetails) => string;
  suggestions: (match: RegExpMatchArray, context: CueErrorDetails) => string[];
  learnMoreUrl?: string;
}

/**
 * Enhanced CUE error parser that extracts more structured information
 */
export function parseEnhancedCueStderr(stderr: string): CueErrorDetails[] {
  const errors: CueErrorDetails[] = [];
  const lines = stderr.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;
    
    // Enhanced pattern matching for different CUE error formats
    const patterns = [
      // Standard format: "filename:line:column: message"
      /^([^:]*):(\d+):(\d+):\s*(.+)$/,
      // Path format: "some.path: message"
      /^([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*):\s*(.+)$/,
      // Simple message format
      /^(.+)$/
    ];
    
    let parsed = false;
    
    // Try standard filename:line:column format first
    const standardPattern = patterns[0];
    if (standardPattern) {
      const standardMatch = line.match(standardPattern);
      if (standardMatch && standardMatch[2] && standardMatch[3] && standardMatch[4]) {
        const context = extractContext(lines, i);
        const errorDetails: CueErrorDetails = {
          rawMessage: standardMatch[4],
          errorType: classifyErrorType(standardMatch[4]),
          context,
          line: parseInt(standardMatch[2]),
          column: parseInt(standardMatch[3])
        };
        if (standardMatch[1]) {
          errorDetails.filename = standardMatch[1];
        }
        errors.push(errorDetails);
        parsed = true;
      }
    }
    
    // Try path format
    if (!parsed) {
      const pathPattern = patterns[1];
      if (pathPattern) {
        const pathMatch = line.match(pathPattern);
        if (pathMatch && pathMatch[1] && pathMatch[2] && !pathMatch[1].includes(' ')) {
          const context = extractContext(lines, i);
          errors.push({
            path: pathMatch[1],
            rawMessage: pathMatch[2],
            errorType: classifyErrorType(pathMatch[2]),
            context
          });
          parsed = true;
        }
      }
    }
    
    // Fallback to generic message
    if (!parsed && line) {
      const context = extractContext(lines, i);
      errors.push({
        rawMessage: line,
        errorType: classifyErrorType(line),
        context
      });
    }
  }
  
  return errors;
}

/**
 * Extract surrounding context from error output
 */
function extractContext(lines: string[], errorIndex: number): string {
  const start = Math.max(0, errorIndex - 1);
  const end = Math.min(lines.length, errorIndex + 3); // Include more context
  return lines.slice(start, end).join('\n');
}

/**
 * Classify error type based on message content
 */
function classifyErrorType(message: string): CueErrorType {
  const lowerMessage = message.toLowerCase();
  
  // Order matters - more specific patterns first
  if (lowerMessage.includes('incomplete') || lowerMessage.includes('non-concrete')) {
    return CueErrorType.NON_CONCRETE_VALUE;
  }
  if (lowerMessage.includes('conflicting values') || lowerMessage.includes('cannot unify')) {
    return CueErrorType.TYPE_MISMATCH;
  }
  if (lowerMessage.includes('field') && lowerMessage.includes('not allowed')) {
    return CueErrorType.UNDEFINED_FIELD;
  }
  if (lowerMessage.includes('undefined field')) {
    return CueErrorType.UNDEFINED_FIELD;
  }
  if (lowerMessage.includes('cycle') || lowerMessage.includes('circular')) {
    return CueErrorType.CYCLIC_DEPENDENCY;
  }
  if (lowerMessage.includes('invalid value') && lowerMessage.includes('out of bound')) {
    return CueErrorType.CONSTRAINT_VIOLATION;
  }
  if (lowerMessage.includes('does not satisfy')) {
    return CueErrorType.CONSTRAINT_VIOLATION;
  }
  if (lowerMessage.includes('cannot find package') || lowerMessage.includes('import')) {
    return CueErrorType.IMPORT_ERROR;
  }
  if (lowerMessage.includes('expected') && (lowerMessage.includes('found') || lowerMessage.includes('got'))) {
    return CueErrorType.SYNTAX_ERROR;
  }
  if (lowerMessage.includes('syntax') || lowerMessage.includes('unexpected')) {
    return CueErrorType.SYNTAX_ERROR;
  }
  if (lowerMessage.includes('disjunction') || lowerMessage.includes('ambiguous')) {
    return CueErrorType.DISJUNCTION_ERROR;
  }
  if (lowerMessage.includes('struct') || lowerMessage.includes('field')) {
    return CueErrorType.STRUCTURAL_ERROR;
  }
  
  return CueErrorType.GENERIC_ERROR;
}

/**
 * Rule-based error translator
 */
export class CueErrorTranslator {
  private rules: ErrorRule[] = [];
  
  constructor() {
    this.initializeRules();
  }
  
  /**
   * Translate a parsed CUE error into a friendly format
   */
  translate(error: CueErrorDetails): TranslatedCueError {
    // Try to match against known rules
    for (const rule of this.rules) {
      const match = error.rawMessage.match(rule.pattern);
      if (match) {
        return {
          ...error,
          friendlyMessage: rule.friendlyMessage(match, error),
          explanation: rule.explanation(match, error),
          suggestions: rule.suggestions(match, error),
          severity: rule.severity,
          category: rule.category,
          ...(rule.learnMoreUrl ? { learnMoreUrl: rule.learnMoreUrl } : {})
        };
      }
    }
    
    // Fallback for unmatched errors
    return this.createFallbackTranslation(error);
  }
  
  /**
   * Translate multiple errors
   */
  translateAll(errors: CueErrorDetails[]): TranslatedCueError[] {
    return errors.map(error => this.translate(error));
  }
  
  /**
   * Initialize the rule engine with common CUE error patterns
   */
  private initializeRules(): void {
    this.rules = [
      // Non-concrete value errors
      {
        pattern: /(.+): incomplete value \((.+)\)/i,
        errorType: CueErrorType.NON_CONCRETE_VALUE,
        category: CueErrorCategory.VALIDATION,
        severity: 'error',
        friendlyMessage: (match) => `Field "${match[1]}" needs a concrete value`,
        explanation: (match) => 
          `CUE found an incomplete value at "${match[1]}". This means the field exists but doesn't have a specific, concrete value assigned to it. CUE requires all values to be fully specified for validation to succeed.`,
        suggestions: (match, context) => [
          `Provide a concrete value for "${match[1]}"`,
          'Check if this field should have a default value defined',
          'Verify that all necessary constraints are specified',
          ...(context.filename ? [`Look at ${context.filename}:${context.line || '?'} for the exact location`] : [])
        ]
      },
      
      // Type mismatch errors
      {
        pattern: /conflicting values (.+) and (.+)/i,
        errorType: CueErrorType.TYPE_MISMATCH,
        category: CueErrorCategory.TYPES,
        severity: 'error',
        friendlyMessage: (match) => `Type conflict: cannot combine ${match[1]} with ${match[2]}`,
        explanation: (match) => 
          `CUE tried to unify two incompatible values: ${match[1]} and ${match[2]}. This typically happens when you assign different types to the same field, or when constraints conflict with assigned values.`,
        suggestions: (match) => [
          `Choose either ${match[1]} or ${match[2]} - they cannot be combined`,
          'Check if you meant to use a disjunction (|) instead of unification',
          'Verify that field types match across all definitions',
          'Consider using conditional logic if both values are needed in different contexts'
        ]
      },
      
      // Undefined field errors
      {
        pattern: /field "(.+)" not allowed/i,
        errorType: CueErrorType.UNDEFINED_FIELD,
        category: CueErrorCategory.STRUCTURE,
        severity: 'error',
        friendlyMessage: (match) => `Field "${match[1]}" is not allowed in this structure`,
        explanation: (match) => 
          `The field "${match[1]}" is not defined in the schema or struct definition. CUE uses closed structs by default, meaning only explicitly defined fields are allowed.`,
        suggestions: (match) => [
          `Add "${match[1]}" to the struct definition`,
          'Check for typos in the field name',
          'Use {...} to make the struct open if additional fields should be allowed',
          'Verify you\'re adding the field to the correct struct'
        ]
      },
      
      // Constraint violation errors
      {
        pattern: /(.+): invalid value (.+) \(out of bound (.+)\)/i,
        errorType: CueErrorType.CONSTRAINT_VIOLATION,
        category: CueErrorCategory.VALIDATION,
        severity: 'error',
        friendlyMessage: (match) => `Value ${match[2]} violates constraint ${match[3]}`,
        explanation: (match) => 
          `The value ${match[2]} doesn't satisfy the constraint ${match[3]}. This means the assigned value falls outside the allowed range or doesn't match the required pattern.`,
        suggestions: (match) => [
          `Use a value that satisfies ${match[3]}`,
          `Check the constraint definition - is ${match[3]} correct?`,
          'Verify the value type matches what the constraint expects',
          'Consider if the constraint is too restrictive for your use case'
        ]
      },
      
      // Syntax errors
      {
        pattern: /expected (.+), found (.+)/i,
        errorType: CueErrorType.SYNTAX_ERROR,
        category: CueErrorCategory.SYNTAX,
        severity: 'error',
        friendlyMessage: (match) => `Syntax error: expected ${match[1]} but found ${match[2]}`,
        explanation: (match) => 
          `CUE's parser expected to find ${match[1]} but encountered ${match[2]} instead. This is typically a syntax or formatting issue.`,
        suggestions: (match) => [
          `Replace ${match[2]} with ${match[1]}`,
          'Check for missing commas, brackets, or quotes',
          'Verify proper indentation and structure',
          'Look for unclosed expressions or mismatched delimiters'
        ]
      },
      
      // Import errors
      {
        pattern: /cannot find package "(.+)"/i,
        errorType: CueErrorType.IMPORT_ERROR,
        category: CueErrorCategory.REFERENCES,
        severity: 'error',
        friendlyMessage: (match) => `Cannot find package "${match[1]}"`,
        explanation: (match) => 
          `CUE cannot locate the package "${match[1]}". This could be because the package doesn't exist, isn't in the module path, or there's a typo in the import statement.`,
        suggestions: (match) => [
          `Check if package "${match[1]}" exists and is accessible`,
          'Verify the import path is correct',
          'Ensure the package is in your CUE module dependencies',
          'Check for typos in the package name'
        ]
      },
      
      // Cyclic dependency errors
      {
        pattern: /cycle/i,
        errorType: CueErrorType.CYCLIC_DEPENDENCY,
        category: CueErrorCategory.REFERENCES,
        severity: 'error',
        friendlyMessage: () => `Circular dependency detected`,
        explanation: () => 
          `CUE detected a circular reference where values depend on each other in a loop. This creates an infinite dependency chain that cannot be resolved.`,
        suggestions: () => [
          'Break the circular dependency by removing one of the references',
          'Use let expressions to define intermediate values',
          'Restructure your schema to avoid circular references',
          'Consider if the circular dependency is actually necessary'
        ]
      }
    ];
  }
  
  /**
   * Create a fallback translation for unmatched errors
   */
  private createFallbackTranslation(error: CueErrorDetails): TranslatedCueError {
    const category = this.getCategoryFromErrorType(error.errorType);
    
    return {
      ...error,
      friendlyMessage: this.generateFallbackMessage(error),
      explanation: this.generateFallbackExplanation(error),
      suggestions: this.generateFallbackSuggestions(error),
      severity: 'error',
      category
    };
  }
  
  private getCategoryFromErrorType(errorType: CueErrorType): CueErrorCategory {
    switch (errorType) {
      case CueErrorType.SYNTAX_ERROR:
        return CueErrorCategory.SYNTAX;
      case CueErrorType.TYPE_MISMATCH:
      case CueErrorType.CONSTRAINT_VIOLATION:
        return CueErrorCategory.TYPES;
      case CueErrorType.UNDEFINED_FIELD:
      case CueErrorType.STRUCTURAL_ERROR:
        return CueErrorCategory.STRUCTURE;
      case CueErrorType.CYCLIC_DEPENDENCY:
      case CueErrorType.IMPORT_ERROR:
        return CueErrorCategory.REFERENCES;
      default:
        return CueErrorCategory.VALIDATION;
    }
  }
  
  private generateFallbackMessage(error: CueErrorDetails): string {
    switch (error.errorType) {
      case CueErrorType.NON_CONCRETE_VALUE:
        return 'A value needs to be more specific';
      case CueErrorType.TYPE_MISMATCH:
        return 'Types do not match';
      case CueErrorType.UNDEFINED_FIELD:
        return 'Field is not defined in the schema';
      case CueErrorType.CONSTRAINT_VIOLATION:
        return 'Value violates a constraint';
      case CueErrorType.SYNTAX_ERROR:
        return 'Syntax error in CUE code';
      case CueErrorType.IMPORT_ERROR:
        return 'Problem with package import';
      case CueErrorType.CYCLIC_DEPENDENCY:
        return 'Circular dependency detected';
      case CueErrorType.STRUCTURAL_ERROR:
        return 'Problem with data structure';
      case CueErrorType.DISJUNCTION_ERROR:
        return 'Ambiguous choice between options';
      default:
        return 'CUE validation error';
    }
  }
  
  private generateFallbackExplanation(error: CueErrorDetails): string {
    const baseExplanation = `CUE encountered an error: "${error.rawMessage}". `;
    
    switch (error.errorType) {
      case CueErrorType.NON_CONCRETE_VALUE:
        return baseExplanation + 'This typically means a field needs a specific value rather than a constraint or incomplete definition.';
      case CueErrorType.TYPE_MISMATCH:
        return baseExplanation + 'This usually happens when trying to combine incompatible types or values.';
      case CueErrorType.UNDEFINED_FIELD:
        return baseExplanation + 'The field being referenced is not defined in the current schema or struct.';
      case CueErrorType.CONSTRAINT_VIOLATION:
        return baseExplanation + 'A value does not meet the defined constraints or validation rules.';
      default:
        return baseExplanation + 'Check the CUE syntax and structure for issues.';
    }
  }
  
  private generateFallbackSuggestions(error: CueErrorDetails): string[] {
    const suggestions = [
      'Review the error message for specific details',
      'Check CUE syntax and formatting',
      'Verify field names and types are correct'
    ];
    
    if (error.filename && error.line) {
      suggestions.unshift(`Check ${error.filename} at line ${error.line}`);
    }
    
    if (error.path) {
      suggestions.unshift(`Review the field path: ${error.path}`);
    }
    
    return suggestions;
  }
}

// Convenience function for direct usage
export function translateCueErrors(stderr: string): TranslatedCueError[] {
  const translator = new CueErrorTranslator();
  const errors = parseEnhancedCueStderr(stderr);
  return translator.translateAll(errors);
}