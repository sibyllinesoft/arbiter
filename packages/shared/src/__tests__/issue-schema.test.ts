/**
 * Tests for the issue schema specification and validation
 */
import { describe, test, expect } from 'bun:test';
import { 
  IssueSpec, 
  validateIssue, 
  createIssue, 
  createChecklistItem,
  DEFAULT_ISSUE_VALIDATION 
} from '../types.js';

describe('Issue Schema Validation', () => {
  test('validates valid issue with required fields only', () => {
    const issue: IssueSpec = {
      title: 'Test Issue',
      body: 'This is a test issue description'
    };

    const result = validateIssue(issue);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validates issue with all fields', () => {
    const issue: IssueSpec = {
      title: 'Complete Test Issue',
      body: 'This is a comprehensive test issue with all fields',
      labels: ['bug', 'priority:high'],
      acceptance_criteria: ['Should fix the bug', 'Should include tests'],
      checklist: [
        { id: 'item-1', text: 'Fix the code', done: false },
        { id: 'item-2', text: 'Write tests', done: true }
      ],
      links: ['https://github.com/example/repo/issues/123']
    };

    const result = validateIssue(issue);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects issue with missing title', () => {
    const issue = {
      body: 'This has no title'
    } as Partial<IssueSpec>;

    const result = validateIssue(issue);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Field 'title' is required");
  });

  test('rejects issue with missing body', () => {
    const issue = {
      title: 'Title Only'
    } as Partial<IssueSpec>;

    const result = validateIssue(issue);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Field 'body' is required");
  });

  test('rejects issue with empty title', () => {
    const issue = {
      title: '   ',
      body: 'This has empty title'
    } as Partial<IssueSpec>;

    const result = validateIssue(issue);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Field 'title' is required");
  });

  test('rejects title longer than 255 characters', () => {
    const longTitle = 'a'.repeat(256);
    const issue: IssueSpec = {
      title: longTitle,
      body: 'This title is too long'
    };

    const result = validateIssue(issue);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Title exceeds maximum length of 255 characters');
  });

  test('validates checklist items structure', () => {
    const issue: IssueSpec = {
      title: 'Test Checklist',
      body: 'Testing checklist validation',
      checklist: [
        { id: 'valid-item', text: 'Valid item', done: false },
        { id: '', text: 'Invalid item - no id', done: false },
        { id: 'no-text', text: '', done: false }
      ]
    };

    const result = validateIssue(issue);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Checklist item 1 missing required 'id' field");
    expect(result.errors).toContain("Checklist item 2 missing required 'text' field");
  });
});

describe('Issue Creation Helpers', () => {
  test('createIssue creates valid issue with defaults', () => {
    const issue = createIssue({
      title: 'New Issue',
      body: 'New issue description'
    });

    expect(issue.title).toBe('New Issue');
    expect(issue.body).toBe('New issue description');
    expect(issue.labels).toEqual([]);
    expect(issue.acceptance_criteria).toEqual([]);
    expect(issue.checklist).toEqual([]);
    expect(issue.links).toEqual([]);

    const validation = validateIssue(issue);
    expect(validation.valid).toBe(true);
  });

  test('createIssue merges provided optional fields', () => {
    const issue = createIssue({
      title: 'New Issue',
      body: 'New issue description',
      labels: ['feature'],
      acceptance_criteria: ['Must work'],
      links: ['https://example.com']
    });

    expect(issue.labels).toEqual(['feature']);
    expect(issue.acceptance_criteria).toEqual(['Must work']);
    expect(issue.links).toEqual(['https://example.com']);
  });

  test('createChecklistItem generates proper structure', () => {
    const item = createChecklistItem('Test item', true);
    
    expect(item.text).toBe('Test item');
    expect(item.done).toBe(true);
    expect(item.id).toMatch(/^item-\d+-[a-z0-9]+$/);
  });

  test('createChecklistItem defaults done to false', () => {
    const item = createChecklistItem('Test item');
    
    expect(item.done).toBe(false);
  });
});

describe('Issue Validation Configuration', () => {
  test('uses custom validation config', () => {
    const customConfig = {
      maxTitleLength: 50,
      requiredFields: ['title'] as (keyof IssueSpec)[]
    };

    const issue: IssueSpec = {
      title: 'a'.repeat(51), // Exceeds custom limit
      body: 'Body is not required in custom config'
    };

    const result = validateIssue(issue, customConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Title exceeds maximum length of 50 characters');
    // Should not complain about missing body since it's not in requiredFields
    expect(result.errors.some(e => e.includes('body'))).toBe(false);
  });

  test('default configuration values', () => {
    expect(DEFAULT_ISSUE_VALIDATION.maxTitleLength).toBe(255);
    expect(DEFAULT_ISSUE_VALIDATION.requiredFields).toEqual(['title', 'body']);
  });
});