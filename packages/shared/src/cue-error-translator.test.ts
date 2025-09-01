/**
 * Test suite for CUE Error Translator
 * 
 * Tests parsing of various CUE error formats and translation into friendly messages
 */

import { describe, test, expect } from 'bun:test';
import { 
  parseEnhancedCueStderr, 
  CueErrorTranslator, 
  translateCueErrors,
  CueErrorType,
  CueErrorCategory 
} from './cue-error-translator';

describe('CUE Error Translator', () => {
  describe('parseEnhancedCueStderr', () => {
    test('parses standard filename:line:column format', () => {
      const stderr = 'config.cue:5:10: conflicting values "string" and 42';
      const errors = parseEnhancedCueStderr(stderr);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        filename: 'config.cue',
        line: 5,
        column: 10,
        rawMessage: 'conflicting values "string" and 42',
        errorType: CueErrorType.TYPE_MISMATCH
      });
    });

    test('parses path format errors', () => {
      const stderr = 'spec.capabilities.auth: incomplete value (string)';
      const errors = parseEnhancedCueStderr(stderr);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        path: 'spec.capabilities.auth',
        rawMessage: 'incomplete value (string)',
        errorType: CueErrorType.NON_CONCRETE_VALUE
      });
    });

    test('handles multiple errors', () => {
      const stderr = `config.cue:5:10: conflicting values "string" and 42
spec.cue:12:5: field "invalid" not allowed
auth: incomplete value (string)`;
      
      const errors = parseEnhancedCueStderr(stderr);
      
      expect(errors).toHaveLength(3);
      expect(errors[0].errorType).toBe(CueErrorType.TYPE_MISMATCH);
      expect(errors[1].errorType).toBe(CueErrorType.UNDEFINED_FIELD);
      expect(errors[2].errorType).toBe(CueErrorType.NON_CONCRETE_VALUE);
    });

    test('extracts context from surrounding lines', () => {
      const stderr = `context line 1
config.cue:5:10: main error
context line 2
context line 3`;
      
      const errors = parseEnhancedCueStderr(stderr);
      
      expect(errors[0].context).toContain('context line 1');
      expect(errors[0].context).toContain('main error');
      expect(errors[0].context).toContain('context line 2');
    });

    test('classifies error types correctly', () => {
      const testCases = [
        { stderr: 'incomplete value (string)', expected: CueErrorType.NON_CONCRETE_VALUE },
        { stderr: 'conflicting values 1 and 2', expected: CueErrorType.TYPE_MISMATCH },
        { stderr: 'field "x" not allowed', expected: CueErrorType.UNDEFINED_FIELD },
        { stderr: 'cycle detected', expected: CueErrorType.CYCLIC_DEPENDENCY },
        { stderr: 'expected string, found int', expected: CueErrorType.SYNTAX_ERROR },
        { stderr: 'cannot find package "missing"', expected: CueErrorType.IMPORT_ERROR },
        { stderr: 'invalid value 5 (out of bound >10)', expected: CueErrorType.CONSTRAINT_VIOLATION },
        { stderr: 'does not satisfy pattern', expected: CueErrorType.CONSTRAINT_VIOLATION },
        { stderr: 'disjunction ambiguous', expected: CueErrorType.DISJUNCTION_ERROR },
        { stderr: 'some random error', expected: CueErrorType.GENERIC_ERROR }
      ];

      testCases.forEach(({ stderr, expected }) => {
        const errors = parseEnhancedCueStderr(stderr);
        expect(errors[0].errorType).toBe(expected);
      });
    });
  });

  describe('CueErrorTranslator', () => {
    test('translates non-concrete value errors', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'auth: incomplete value (string)',
        errorType: CueErrorType.NON_CONCRETE_VALUE,
        path: 'auth'
      };

      const translated = translator.translate(error);

      expect(translated.friendlyMessage).toBe('Field "auth" needs a concrete value');
      expect(translated.explanation).toContain('incomplete value');
      expect(translated.explanation).toContain('concrete value');
      expect(translated.suggestions).toContain('Provide a concrete value for "auth"');
      expect(translated.category).toBe(CueErrorCategory.VALIDATION);
      expect(translated.severity).toBe('error');
    });

    test('translates type mismatch errors', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'conflicting values "string" and 42',
        errorType: CueErrorType.TYPE_MISMATCH
      };

      const translated = translator.translate(error);

      expect(translated.friendlyMessage).toBe('Type conflict: cannot combine "string" with 42');
      expect(translated.explanation).toContain('incompatible values');
      expect(translated.suggestions).toContain('Choose either "string" or 42 - they cannot be combined');
      expect(translated.category).toBe(CueErrorCategory.TYPES);
    });

    test('translates undefined field errors', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'field "invalid" not allowed',
        errorType: CueErrorType.UNDEFINED_FIELD
      };

      const translated = translator.translate(error);

      expect(translated.friendlyMessage).toBe('Field "invalid" is not allowed in this structure');
      expect(translated.explanation).toContain('not defined in the schema');
      expect(translated.suggestions).toContain('Add "invalid" to the struct definition');
      expect(translated.category).toBe(CueErrorCategory.STRUCTURE);
    });

    test('translates constraint violation errors', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'port: invalid value 99999 (out of bound <=65535)',
        errorType: CueErrorType.CONSTRAINT_VIOLATION
      };

      const translated = translator.translate(error);

      expect(translated.friendlyMessage).toBe('Value 99999 violates constraint <=65535');
      expect(translated.explanation).toContain('doesn\'t satisfy the constraint');
      expect(translated.suggestions).toContain('Use a value that satisfies <=65535');
      expect(translated.category).toBe(CueErrorCategory.VALIDATION);
    });

    test('translates syntax errors', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'expected "}", found "EOF"',
        errorType: CueErrorType.SYNTAX_ERROR
      };

      const translated = translator.translate(error);

      expect(translated.friendlyMessage).toBe('Syntax error: expected "}" but found "EOF"');
      expect(translated.explanation).toContain('parser expected');
      expect(translated.suggestions).toContain('Replace "EOF" with "}"');
      expect(translated.category).toBe(CueErrorCategory.SYNTAX);
    });

    test('translates import errors', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'cannot find package "nonexistent"',
        errorType: CueErrorType.IMPORT_ERROR
      };

      const translated = translator.translate(error);

      expect(translated.friendlyMessage).toBe('Cannot find package "nonexistent"');
      expect(translated.explanation).toContain('cannot locate the package');
      expect(translated.suggestions).toContain('Check if package "nonexistent" exists and is accessible');
      expect(translated.category).toBe(CueErrorCategory.REFERENCES);
    });

    test('translates cyclic dependency errors', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'cycle in references',
        errorType: CueErrorType.CYCLIC_DEPENDENCY
      };

      const translated = translator.translate(error);

      expect(translated.friendlyMessage).toBe('Circular dependency detected');
      expect(translated.explanation).toContain('circular reference');
      expect(translated.suggestions).toContain('Break the circular dependency by removing one of the references');
      expect(translated.category).toBe(CueErrorCategory.REFERENCES);
    });

    test('handles fallback translation for unmatched errors', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'some unknown error format',
        errorType: CueErrorType.GENERIC_ERROR,
        filename: 'test.cue',
        line: 42
      };

      const translated = translator.translate(error);

      expect(translated.friendlyMessage).toBe('CUE validation error');
      expect(translated.explanation).toContain('CUE encountered an error');
      expect(translated.suggestions[0]).toBe('Check test.cue at line 42');
      expect(translated.category).toBe(CueErrorCategory.VALIDATION);
    });

    test('includes location information in suggestions when available', () => {
      const translator = new CueErrorTranslator();
      const error = {
        rawMessage: 'auth: incomplete value (string)',
        errorType: CueErrorType.NON_CONCRETE_VALUE,
        filename: 'config.cue',
        line: 15,
        path: 'auth'
      };

      const translated = translator.translate(error);

      expect(translated.suggestions.some(s => s.includes('config.cue:15'))).toBe(true);
    });

    test('translates multiple errors correctly', () => {
      const translator = new CueErrorTranslator();
      const errors = [
        {
          rawMessage: 'auth: incomplete value (string)',
          errorType: CueErrorType.NON_CONCRETE_VALUE
        },
        {
          rawMessage: 'conflicting values 1 and "one"',
          errorType: CueErrorType.TYPE_MISMATCH
        }
      ];

      const translated = translator.translateAll(errors);

      expect(translated).toHaveLength(2);
      expect(translated[0].category).toBe(CueErrorCategory.VALIDATION);
      expect(translated[1].category).toBe(CueErrorCategory.TYPES);
    });
  });

  describe('translateCueErrors convenience function', () => {
    test('provides end-to-end translation from stderr', () => {
      const stderr = `config.cue:5:10: conflicting values "string" and 42
spec.cue:12:5: field "invalid" not allowed
auth: incomplete value (string)`;

      const translated = translateCueErrors(stderr);

      expect(translated).toHaveLength(3);
      expect(translated[0].friendlyMessage).toContain('Type conflict');
      expect(translated[1].friendlyMessage).toContain('not allowed');
      expect(translated[2].friendlyMessage).toContain('A value needs to be more specific');
    });

    test('handles empty stderr', () => {
      const translated = translateCueErrors('');
      expect(translated).toHaveLength(0);
    });

    test('handles stderr with only whitespace', () => {
      const translated = translateCueErrors('\n  \n\t\n  ');
      expect(translated).toHaveLength(0);
    });
  });

  describe('Real-world CUE error examples', () => {
    test('handles complex CUE validation output', () => {
      const stderr = `spec/app/charter.cue:4:1: field "missingField" not allowed in closed struct
spec/flows.cue:15:20: conflicting values "POST" and "GET" (mismatched types string and string)
components.auth: incomplete value (string)
locators.loginButton: invalid value "#invalid-selector" (does not satisfy pattern)`;

      const translated = translateCueErrors(stderr);

      expect(translated).toHaveLength(4);
      
      // Test first error - structural issue
      expect(translated[0].category).toBe(CueErrorCategory.STRUCTURE);
      expect(translated[0].suggestions).toContain('Add "missingField" to the struct definition');
      
      // Test second error - type conflict
      expect(translated[1].category).toBe(CueErrorCategory.TYPES);
      expect(translated[1].friendlyMessage).toContain('Type conflict');
      
      // Test third error - non-concrete value
      expect(translated[2].category).toBe(CueErrorCategory.VALIDATION);
      expect(translated[2].path).toBe('components.auth');
      
      // Test fourth error - constraint violation  
      expect(translated[3].errorType).toBe(CueErrorType.CONSTRAINT_VIOLATION);
      // Note: This error may use fallback category since it doesn't match our specific patterns
    });

    test('handles CUE import resolution errors', () => {
      const stderr = `cannot find package "k8s.io/api/core/v1"
import "github.com/invalid/package" failed: module not found`;

      const translated = translateCueErrors(stderr);

      expect(translated).toHaveLength(2);
      expect(translated[0].errorType).toBe(CueErrorType.IMPORT_ERROR);
      expect(translated[1].errorType).toBe(CueErrorType.IMPORT_ERROR);
    });
  });
});