/**
 * Rails & Guarantees v1.0 RC - Phase 5: Contracts & Validation Rules
 * Core Invariant Validation Engine
 */

import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

// Core Types for Invariant Validation
export interface InvariantRule {
  name: string;
  description: string;
  rule: string; // CUE expression or validation logic
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
}

export interface ValidationContext {
  timestamp: number;
  operation: string;
  input: unknown;
  environment: Record<string, unknown>;
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  operationCount?: number;
}

export interface InvariantViolation {
  invariantName: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  context: ValidationContext;
  details: Record<string, unknown>;
  timestamp: number;
}

export interface ValidationResult {
  passed: boolean;
  violations: InvariantViolation[];
  metrics: PerformanceMetrics;
  context: ValidationContext;
}

// Core Invariant Classes
export class TicketTTLInvariant implements InvariantRule {
  name = 'ticket_ttl_enforcement';
  description = 'All tickets must respect TTL and expire appropriately';
  rule = 'ticket.exp > now() && ticket.exp < (now() + max_ttl)';
  severity: 'error' = 'error';
  enabled = true;

  private readonly MAX_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async validate(ticket: any, context: ValidationContext): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];
    const now = Date.now();

    // Check if ticket has required fields
    if (!ticket.exp || !ticket.iat) {
      violations.push({
        invariantName: this.name,
        message: 'Ticket missing required timestamps (exp, iat)',
        severity: 'error',
        context,
        details: { ticket, missingFields: ['exp', 'iat'] },
        timestamp: now
      });
      return violations;
    }

    const expTime = typeof ticket.exp === 'number' ? ticket.exp : new Date(ticket.exp).getTime();
    const iatTime = typeof ticket.iat === 'number' ? ticket.iat : new Date(ticket.iat).getTime();

    // Rule: ticket.exp > now()
    if (expTime <= now) {
      violations.push({
        invariantName: this.name,
        message: 'Ticket has expired',
        severity: 'error',
        context,
        details: { 
          expTime, 
          now, 
          expiredMs: now - expTime 
        },
        timestamp: now
      });
    }

    // Rule: ticket.exp < (now() + max_ttl)
    const maxAllowedExp = now + this.MAX_TTL_MS;
    if (expTime > maxAllowedExp) {
      violations.push({
        invariantName: this.name,
        message: 'Ticket TTL exceeds maximum allowed duration',
        severity: 'error',
        context,
        details: { 
          expTime, 
          maxAllowedExp, 
          excessMs: expTime - maxAllowedExp,
          maxTtlHours: this.MAX_TTL_MS / (60 * 60 * 1000)
        },
        timestamp: now
      });
    }

    // Validate TTL is reasonable (not too short)
    const ttlMs = expTime - iatTime;
    if (ttlMs < 60 * 1000) { // Less than 1 minute
      violations.push({
        invariantName: this.name,
        message: 'Ticket TTL is too short for practical use',
        severity: 'warning',
        context,
        details: { 
          ttlMs, 
          ttlSeconds: ttlMs / 1000 
        },
        timestamp: now
      });
    }

    return violations;
  }
}

export class NonceUniquenessInvariant implements InvariantRule {
  name = 'nonce_uniqueness';
  description = 'Nonces must be unique per repo within TTL window';
  rule = 'unique(repo_id, nonce) within ttl_window';
  severity: 'error' = 'error';
  enabled = true;

  private nonceStore = new Map<string, { nonce: string; expTime: number; repoId: string }[]>();

  async validate(ticket: any, context: ValidationContext): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];
    const now = Date.now();

    if (!ticket.repo_id || !ticket.nonce || !ticket.exp) {
      violations.push({
        invariantName: this.name,
        message: 'Ticket missing required fields for nonce validation (repo_id, nonce, exp)',
        severity: 'error',
        context,
        details: { 
          ticket, 
          missingFields: ['repo_id', 'nonce', 'exp'].filter(f => !ticket[f])
        },
        timestamp: now
      });
      return violations;
    }

    const repoId = ticket.repo_id;
    const nonce = ticket.nonce;
    const expTime = typeof ticket.exp === 'number' ? ticket.exp : new Date(ticket.exp).getTime();

    // Clean up expired nonces first
    this.cleanupExpiredNonces(now);

    // Check if nonce already exists for this repo
    const repoNonces = this.nonceStore.get(repoId) || [];
    const existingNonce = repoNonces.find(entry => entry.nonce === nonce);

    if (existingNonce) {
      violations.push({
        invariantName: this.name,
        message: 'Nonce already used within TTL window for this repository',
        severity: 'error',
        context,
        details: {
          repoId,
          nonce,
          existingExpTime: existingNonce.expTime,
          newExpTime: expTime
        },
        timestamp: now
      });
    } else {
      // Store the nonce
      repoNonces.push({ nonce, expTime, repoId });
      this.nonceStore.set(repoId, repoNonces);
    }

    return violations;
  }

  private cleanupExpiredNonces(now: number): void {
    for (const [repoId, nonces] of this.nonceStore.entries()) {
      const validNonces = nonces.filter(entry => entry.expTime > now);
      if (validNonces.length === 0) {
        this.nonceStore.delete(repoId);
      } else {
        this.nonceStore.set(repoId, validNonces);
      }
    }
  }

  // Get current nonce store stats for monitoring
  getStats(): { totalRepos: number; totalNonces: number; oldestNonce: number | null } {
    const totalRepos = this.nonceStore.size;
    let totalNonces = 0;
    let oldestNonce: number | null = null;

    for (const nonces of this.nonceStore.values()) {
      totalNonces += nonces.length;
      for (const entry of nonces) {
        if (oldestNonce === null || entry.expTime < oldestNonce) {
          oldestNonce = entry.expTime;
        }
      }
    }

    return { totalRepos, totalNonces, oldestNonce };
  }
}

export class CanonicalPatchFormatInvariant implements InvariantRule {
  name = 'canonical_patch_format';
  description = 'All patches must be in canonical format before HMAC';
  rule = 'patch == canonicalize(patch)';
  severity: 'error' = 'error';
  enabled = true;

  async validate(patch: string, context: ValidationContext): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];
    const now = Date.now();

    try {
      const canonicalPatch = this.canonicalize(patch);
      
      if (patch !== canonicalPatch) {
        violations.push({
          invariantName: this.name,
          message: 'Patch is not in canonical format',
          severity: 'error',
          context,
          details: {
            originalHash: createHash('sha256').update(patch).digest('hex'),
            canonicalHash: createHash('sha256').update(canonicalPatch).digest('hex'),
            lengthDiff: patch.length - canonicalPatch.length,
            formatIssues: this.identifyFormatIssues(patch, canonicalPatch)
          },
          timestamp: now
        });
      }
    } catch (error) {
      violations.push({
        invariantName: this.name,
        message: `Failed to canonicalize patch: ${error.message}`,
        severity: 'error',
        context,
        details: { 
          error: error.message,
          patchLength: patch.length,
          patchPreview: patch.substring(0, 200)
        },
        timestamp: now
      });
    }

    return violations;
  }

  canonicalize(patch: string): string {
    // Rails & Guarantees canonical format:
    // 1. sorted_hunks
    // 2. LF_newlines (convert CRLF -> LF)
    // 3. UTF8_encoding (ensure proper encoding)
    // 4. no_BOM (remove byte order mark)

    let canonical = patch;

    // Step 1: Remove BOM if present
    if (canonical.charCodeAt(0) === 0xFEFF) {
      canonical = canonical.slice(1);
    }

    // Step 2: Normalize line endings to LF
    canonical = canonical.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Step 3: Sort hunks (patch sections starting with @@)
    const lines = canonical.split('\n');
    const sortedSections = this.sortPatchHunks(lines);
    canonical = sortedSections.join('\n');

    // Step 4: Ensure UTF-8 encoding (Node.js handles this automatically for strings)
    // Step 5: Remove trailing whitespace but preserve final newline
    canonical = canonical.replace(/[ \t]+$/gm, '');
    if (!canonical.endsWith('\n') && canonical.length > 0) {
      canonical += '\n';
    }

    return canonical;
  }

  private sortPatchHunks(lines: string[]): string[] {
    const hunks: { header: string; lines: string[] }[] = [];
    let currentHunk: { header: string; lines: string[] } | null = null;
    const prefix: string[] = [];
    let inPatchContent = false;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Found hunk header
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = { header: line, lines: [] };
        inPatchContent = true;
      } else if (inPatchContent && currentHunk) {
        currentHunk.lines.push(line);
      } else if (!inPatchContent) {
        prefix.push(line);
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    // Sort hunks by their file and line numbers
    hunks.sort((a, b) => {
      const aMatch = a.header.match(/^@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@/);
      const bMatch = b.header.match(/^@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@/);
      
      if (aMatch && bMatch) {
        const aOldLine = parseInt(aMatch[1], 10);
        const bOldLine = parseInt(bMatch[1], 10);
        return aOldLine - bOldLine;
      }
      
      return a.header.localeCompare(b.header);
    });

    // Reconstruct the patch
    const result = [...prefix];
    for (const hunk of hunks) {
      result.push(hunk.header);
      result.push(...hunk.lines);
    }

    return result;
  }

  private identifyFormatIssues(original: string, canonical: string): string[] {
    const issues: string[] = [];

    if (original.includes('\r')) {
      issues.push('contains_crlf_line_endings');
    }

    if (original.charCodeAt(0) === 0xFEFF) {
      issues.push('contains_bom');
    }

    if (original.match(/[ \t]+$/m)) {
      issues.push('contains_trailing_whitespace');
    }

    if (original !== canonical && issues.length === 0) {
      issues.push('hunk_ordering_incorrect');
    }

    return issues;
  }
}

export class PerformanceBudgetInvariant implements InvariantRule {
  name = 'performance_budget_adherence';
  description = 'All operations must complete within performance budget';
  rule = 'operation_time <= budget_time';
  severity: 'error' = 'error';
  enabled = true;

  private readonly BUDGETS = {
    ticket_verify: 25, // ms
    full_validate: 400, // ms
    stream_start: 100, // ms
    end_to_end: 750 // ms
  };

  async validate(operation: string, metrics: PerformanceMetrics, context: ValidationContext): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];
    const now = Date.now();

    if (!metrics.endTime || !metrics.startTime) {
      violations.push({
        invariantName: this.name,
        message: 'Performance metrics incomplete - missing timing data',
        severity: 'warning',
        context,
        details: { operation, metrics },
        timestamp: now
      });
      return violations;
    }

    const actualTime = metrics.endTime - metrics.startTime;
    const budget = this.getBudgetForOperation(operation);

    if (budget && actualTime > budget) {
      violations.push({
        invariantName: this.name,
        message: `Operation exceeded performance budget`,
        severity: 'error',
        context,
        details: {
          operation,
          actualTimeMs: actualTime,
          budgetMs: budget,
          overageMs: actualTime - budget,
          overagePercent: ((actualTime - budget) / budget * 100).toFixed(1)
        },
        timestamp: now
      });
    }

    // Check for performance degradation patterns
    if (actualTime > budget * 2) {
      violations.push({
        invariantName: this.name,
        message: `Severe performance degradation detected`,
        severity: 'error',
        context,
        details: {
          operation,
          actualTimeMs: actualTime,
          budgetMs: budget,
          degradationMultiple: (actualTime / budget).toFixed(1)
        },
        timestamp: now
      });
    }

    return violations;
  }

  private getBudgetForOperation(operation: string): number | null {
    const normalizedOp = operation.toLowerCase().replace(/[_-]/g, '_');
    return this.BUDGETS[normalizedOp as keyof typeof this.BUDGETS] || null;
  }

  // Get performance statistics
  getPerformanceBudgets(): Record<string, number> {
    return { ...this.BUDGETS };
  }
}

export class IncrementalValidationInvariant implements InvariantRule {
  name = 'incremental_validation_correctness';
  description = 'Incremental validation must produce same results as full validation';
  rule = 'incremental_result == full_validation_result';
  severity: 'error' = 'error';
  enabled = true;

  private validationCache = new Map<string, { result: unknown; timestamp: number; hash: string }>();

  async validate(
    input: unknown, 
    incrementalResult: unknown, 
    fullResult: unknown, 
    context: ValidationContext
  ): Promise<InvariantViolation[]> {
    const violations: InvariantViolation[] = [];
    const now = Date.now();

    // Generate content hash for caching
    const inputHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');

    try {
      // Deep equality check between incremental and full results
      if (!this.deepEqual(incrementalResult, fullResult)) {
        violations.push({
          invariantName: this.name,
          message: 'Incremental validation result differs from full validation',
          severity: 'error',
          context,
          details: {
            inputHash,
            incrementalResult: this.truncateForLog(incrementalResult),
            fullResult: this.truncateForLog(fullResult),
            differences: this.findDifferences(incrementalResult, fullResult)
          },
          timestamp: now
        });
      }

      // Update cache for future validations
      this.validationCache.set(inputHash, {
        result: fullResult,
        timestamp: now,
        hash: inputHash
      });

      // Cleanup old cache entries (older than 1 hour)
      this.cleanupCache(now - 60 * 60 * 1000);

    } catch (error) {
      violations.push({
        invariantName: this.name,
        message: `Failed to validate incremental correctness: ${error.message}`,
        severity: 'error',
        context,
        details: {
          error: error.message,
          inputHash
        },
        timestamp: now
      });
    }

    return violations;
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      const aKeys = Object.keys(a as object);
      const bKeys = Object.keys(b as object);
      
      if (aKeys.length !== bKeys.length) return false;
      
      for (const key of aKeys) {
        if (!bKeys.includes(key)) return false;
        if (!this.deepEqual((a as any)[key], (b as any)[key])) return false;
      }
      
      return true;
    }
    
    return false;
  }

  private findDifferences(a: unknown, b: unknown, path = ''): string[] {
    const differences: string[] = [];
    
    if (a === b) return differences;
    
    if (typeof a !== typeof b) {
      differences.push(`${path}: type mismatch (${typeof a} vs ${typeof b})`);
      return differences;
    }
    
    if (typeof a === 'object' && a != null && b != null) {
      const aKeys = Object.keys(a as object);
      const bKeys = Object.keys(b as object);
      
      const allKeys = new Set([...aKeys, ...bKeys]);
      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        const aVal = (a as any)[key];
        const bVal = (b as any)[key];
        
        if (aKeys.includes(key) && !bKeys.includes(key)) {
          differences.push(`${newPath}: missing in full result`);
        } else if (!aKeys.includes(key) && bKeys.includes(key)) {
          differences.push(`${newPath}: missing in incremental result`);
        } else {
          differences.push(...this.findDifferences(aVal, bVal, newPath));
        }
      }
    } else {
      differences.push(`${path}: value mismatch (${a} vs ${b})`);
    }
    
    return differences;
  }

  private truncateForLog(obj: unknown, maxLength = 500): unknown {
    const str = JSON.stringify(obj);
    if (str.length <= maxLength) return obj;
    
    return {
      truncated: true,
      preview: str.substring(0, maxLength) + '...',
      fullLength: str.length
    };
  }

  private cleanupCache(cutoffTime: number): void {
    for (const [key, entry] of this.validationCache.entries()) {
      if (entry.timestamp < cutoffTime) {
        this.validationCache.delete(key);
      }
    }
  }

  // Get cache statistics
  getCacheStats(): { entries: number; oldestEntry: number | null; hitRate: number } {
    const entries = this.validationCache.size;
    let oldestEntry: number | null = null;
    
    for (const entry of this.validationCache.values()) {
      if (oldestEntry === null || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
    }
    
    return {
      entries,
      oldestEntry,
      hitRate: 0 // TODO: implement hit rate tracking
    };
  }
}

// Main Invariant Engine
export class InvariantEngine {
  private invariants: Map<string, InvariantRule> = new Map();
  private violations: InvariantViolation[] = [];

  constructor() {
    // Register all core invariants
    this.registerInvariant(new TicketTTLInvariant());
    this.registerInvariant(new NonceUniquenessInvariant());
    this.registerInvariant(new CanonicalPatchFormatInvariant());
    this.registerInvariant(new PerformanceBudgetInvariant());
    this.registerInvariant(new IncrementalValidationInvariant());
  }

  registerInvariant(invariant: InvariantRule): void {
    this.invariants.set(invariant.name, invariant);
  }

  async validateAll(data: unknown, context: ValidationContext): Promise<ValidationResult> {
    const startTime = performance.now();
    const allViolations: InvariantViolation[] = [];

    for (const [name, invariant] of this.invariants.entries()) {
      if (!invariant.enabled) continue;

      try {
        const violations = await this.validateInvariant(name, data, context);
        allViolations.push(...violations);
      } catch (error) {
        allViolations.push({
          invariantName: name,
          message: `Invariant validation failed: ${error.message}`,
          severity: 'error',
          context,
          details: { error: error.message },
          timestamp: Date.now()
        });
      }
    }

    const endTime = performance.now();
    const metrics: PerformanceMetrics = {
      startTime,
      endTime,
      cpuUsage: process.cpuUsage().user,
      memoryUsage: process.memoryUsage().heapUsed
    };

    this.violations.push(...allViolations);

    return {
      passed: allViolations.filter(v => v.severity === 'error').length === 0,
      violations: allViolations,
      metrics,
      context
    };
  }

  async validateInvariant(invariantName: string, data: unknown, context: ValidationContext): Promise<InvariantViolation[]> {
    const invariant = this.invariants.get(invariantName);
    if (!invariant) {
      throw new Error(`Unknown invariant: ${invariantName}`);
    }

    // Route to appropriate validation method based on invariant type
    if (invariant instanceof TicketTTLInvariant) {
      return invariant.validate(data, context);
    } else if (invariant instanceof NonceUniquenessInvariant) {
      return invariant.validate(data, context);
    } else if (invariant instanceof CanonicalPatchFormatInvariant) {
      return invariant.validate(data as string, context);
    } else if (invariant instanceof PerformanceBudgetInvariant) {
      const { operation, metrics } = data as { operation: string; metrics: PerformanceMetrics };
      return invariant.validate(operation, metrics, context);
    } else if (invariant instanceof IncrementalValidationInvariant) {
      const { input, incrementalResult, fullResult } = data as { 
        input: unknown; 
        incrementalResult: unknown; 
        fullResult: unknown 
      };
      return invariant.validate(input, incrementalResult, fullResult, context);
    }

    return [];
  }

  // Get all violations recorded so far
  getAllViolations(): InvariantViolation[] {
    return [...this.violations];
  }

  // Get violations by severity
  getViolationsBySeverity(severity: 'error' | 'warning' | 'info'): InvariantViolation[] {
    return this.violations.filter(v => v.severity === severity);
  }

  // Clear all recorded violations
  clearViolations(): void {
    this.violations = [];
  }

  // Generate violation report
  generateReport(): string {
    const errors = this.getViolationsBySeverity('error');
    const warnings = this.getViolationsBySeverity('warning');
    
    const report = [
      '# Rails & Guarantees Invariant Validation Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      `## Summary`,
      `- Total Violations: ${this.violations.length}`,
      `- Errors: ${errors.length}`,
      `- Warnings: ${warnings.length}`,
      '',
    ];

    if (errors.length > 0) {
      report.push('## Errors');
      errors.forEach((violation, index) => {
        report.push(`### ${index + 1}. ${violation.invariantName}`);
        report.push(`**Message**: ${violation.message}`);
        report.push(`**Timestamp**: ${new Date(violation.timestamp).toISOString()}`);
        report.push(`**Details**: \`\`\`json\n${JSON.stringify(violation.details, null, 2)}\n\`\`\``);
        report.push('');
      });
    }

    if (warnings.length > 0) {
      report.push('## Warnings');
      warnings.forEach((violation, index) => {
        report.push(`### ${index + 1}. ${violation.invariantName}`);
        report.push(`**Message**: ${violation.message}`);
        report.push(`**Timestamp**: ${new Date(violation.timestamp).toISOString()}`);
        report.push('');
      });
    }

    return report.join('\n');
  }
}

// Export factory function
export function createInvariantEngine(): InvariantEngine {
  return new InvariantEngine();
}