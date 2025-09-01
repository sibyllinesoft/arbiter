/**
 * Semantic Versioning Validation Gate
 * Implements the TODO.md specification for API surface diff and version bump validation
 * Gate logic: (requested_version_bump >= required_bump(Δ))
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { APISurface } from './api-extractors.js';
import type { Epic } from './profile-adapters.js';

export type VersionBump = 'major' | 'minor' | 'patch';
export type SemverPolicy = 'strict' | 'minor' | 'none';

export interface ChangeClassification {
  breaking: Array<{
    type: 'removed_symbol' | 'signature_changed' | 'visibility_changed' | 'behavior_changed';
    symbol: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  additive: Array<{
    type: 'added_symbol' | 'added_optional_parameter' | 'extended_interface';
    symbol: string;
    description: string;
  }>;
  internal: Array<{
    type: 'implementation_detail' | 'private_change' | 'refactor';
    description: string;
  }>;
}

export interface VersionRequirement {
  minimum: VersionBump;
  reason: string;
  changes: ChangeClassification;
}

export interface SemverValidationResult {
  valid: boolean;
  requestedBump: VersionBump;
  requiredBump: VersionBump;
  message: string;
  changes: ChangeClassification;
  recommendation?: string;
}

/**
 * Semantic Version Validator implementing the TODO.md gate logic
 */
export class SemverValidator {
  private policy: SemverPolicy;
  
  constructor(policy: SemverPolicy = 'strict') {
    this.policy = policy;
  }
  
  /**
   * Validate version bump against API surface changes
   * Core gate logic: (requested_version_bump >= required_bump(Δ))
   */
  async validateVersionBump(
    oldSurface: APISurface,
    newSurface: APISurface,
    requestedBump: VersionBump,
    epic?: Epic
  ): Promise<SemverValidationResult> {
    // Classify changes
    const changes = this.classifyChanges(oldSurface, newSurface);
    
    // Determine required version bump
    const requirement = this.determineRequiredBump(changes);
    
    // Check if requested bump is sufficient
    const valid = this.compareBumps(requestedBump, requirement.minimum) >= 0;
    
    // Apply policy-specific rules
    const policyCheck = this.applyPolicy(changes, requestedBump);
    
    return {
      valid: valid && policyCheck.valid,
      requestedBump,
      requiredBump: requirement.minimum,
      message: valid && policyCheck.valid 
        ? `Version bump ${requestedBump} is sufficient for the changes made`
        : policyCheck.message || `Version bump ${requestedBump} insufficient for changes requiring ${requirement.minimum}: ${requirement.reason}`,
      changes,
      recommendation: this.generateRecommendation(changes, requestedBump, requirement.minimum)
    };
  }
  
  /**
   * Classify API changes into breaking, additive, and internal categories
   */
  private classifyChanges(oldSurface: APISurface, newSurface: APISurface): ChangeClassification {
    const oldSymbols = new Map(oldSurface.exports.map(s => [s.name, s]));
    const newSymbols = new Map(newSurface.exports.map(s => [s.name, s]));
    
    const changes: ChangeClassification = {
      breaking: [],
      additive: [],
      internal: []
    };
    
    // Find removed symbols (always breaking)
    for (const [name, oldSymbol] of oldSymbols) {
      if (!newSymbols.has(name)) {
        changes.breaking.push({
          type: 'removed_symbol',
          symbol: name,
          description: `${oldSymbol.kind} ${name} was removed from the public API`,
          impact: this.assessRemovalImpact(oldSymbol)
        });
      }
    }
    
    // Find added symbols (additive)
    for (const [name, newSymbol] of newSymbols) {
      if (!oldSymbols.has(name)) {
        changes.additive.push({
          type: 'added_symbol',
          symbol: name,
          description: `${newSymbol.kind} ${name} was added to the public API`
        });
      }
    }
    
    // Find signature changes (potentially breaking)
    for (const [name, newSymbol] of newSymbols) {
      const oldSymbol = oldSymbols.get(name);
      if (oldSymbol && oldSymbol.signature !== newSymbol.signature) {
        const isBreaking = this.isSignatureChangeBreaking(oldSymbol, newSymbol);
        
        if (isBreaking) {
          changes.breaking.push({
            type: 'signature_changed',
            symbol: name,
            description: `${newSymbol.kind} ${name} signature changed: ${oldSymbol.signature} → ${newSymbol.signature}`,
            impact: 'high'
          });
        } else {
          changes.additive.push({
            type: 'extended_interface',
            symbol: name,
            description: `${newSymbol.kind} ${name} was extended with backward compatibility`
          });
        }
      }
    }
    
    // Find visibility changes (breaking)
    for (const [name, newSymbol] of newSymbols) {
      const oldSymbol = oldSymbols.get(name);
      if (oldSymbol && oldSymbol.visibility !== newSymbol.visibility) {
        if (oldSymbol.visibility === 'public' && newSymbol.visibility !== 'public') {
          changes.breaking.push({
            type: 'visibility_changed',
            symbol: name,
            description: `${newSymbol.kind} ${name} visibility changed from ${oldSymbol.visibility} to ${newSymbol.visibility}`,
            impact: 'high'
          });
        }
      }
    }
    
    return changes;
  }
  
  /**
   * Determine required version bump based on classified changes
   */
  private determineRequiredBump(changes: ChangeClassification): VersionRequirement {
    // Breaking changes require major bump
    if (changes.breaking.length > 0) {
      const highImpactChanges = changes.breaking.filter(c => c.impact === 'high');
      return {
        minimum: 'major',
        reason: `Breaking changes detected: ${changes.breaking.length} total, ${highImpactChanges.length} high impact`,
        changes
      };
    }
    
    // Additive changes require minor bump
    if (changes.additive.length > 0) {
      return {
        minimum: 'minor',
        reason: `Additive changes detected: ${changes.additive.length} new public API elements`,
        changes
      };
    }
    
    // Internal changes require patch bump
    if (changes.internal.length > 0) {
      return {
        minimum: 'patch',
        reason: `Internal changes detected: ${changes.internal.length} implementation updates`,
        changes
      };
    }
    
    // No changes detected
    return {
      minimum: 'patch',
      reason: 'No API changes detected - patch bump for maintenance',
      changes
    };
  }
  
  /**
   * Apply semver policy-specific validation rules
   */
  private applyPolicy(
    changes: ChangeClassification,
    requestedBump: VersionBump
  ): { valid: boolean; message?: string } {
    switch (this.policy) {
      case 'strict':
        // Strict policy: no breaking changes allowed unless major bump
        if (changes.breaking.length > 0 && requestedBump !== 'major') {
          return {
            valid: false,
            message: `Strict semver policy violation: Breaking changes require major version bump, but ${requestedBump} was requested`
          };
        }
        break;
        
      case 'minor':
        // Minor policy: only additive changes allowed
        if (changes.breaking.length > 0) {
          return {
            valid: false,
            message: `Minor-only semver policy violation: Breaking changes are not permitted`
          };
        }
        break;
        
      case 'none':
        // No policy enforcement
        break;
    }
    
    return { valid: true };
  }
  
  /**
   * Compare version bumps (returns -1, 0, or 1)
   */
  private compareBumps(bump1: VersionBump, bump2: VersionBump): number {
    const order: Record<VersionBump, number> = {
      'patch': 1,
      'minor': 2,
      'major': 3
    };
    
    return order[bump1] - order[bump2];
  }
  
  /**
   * Assess the impact of removing a symbol
   */
  private assessRemovalImpact(symbol: { kind: string; name: string }): 'high' | 'medium' | 'low' {
    // Heuristics for assessing removal impact
    if (symbol.kind === 'class' || symbol.kind === 'interface') {
      return 'high'; // Removing types is highly disruptive
    }
    
    if (symbol.kind === 'function' && symbol.name.includes('create') || symbol.name.includes('init')) {
      return 'high'; // Constructor-like functions are critical
    }
    
    if (symbol.name.startsWith('_') || symbol.name.includes('internal')) {
      return 'low'; // Likely internal despite being public
    }
    
    return 'medium'; // Default impact
  }
  
  /**
   * Determine if a signature change is breaking
   */
  private isSignatureChangeBreaking(
    oldSymbol: { signature?: string; kind: string },
    newSymbol: { signature?: string; kind: string }
  ): boolean {
    if (!oldSymbol.signature || !newSymbol.signature) {
      return false; // Can't determine without signatures
    }
    
    // Simple heuristics (in real implementation, use proper AST parsing)
    const oldSig = oldSymbol.signature;
    const newSig = newSymbol.signature;
    
    // Parameter removal is breaking
    if (oldSig.includes('(') && newSig.includes('(')) {
      const oldParams = this.extractParameters(oldSig);
      const newParams = this.extractParameters(newSig);
      
      // If new signature has fewer required parameters, it might be breaking
      if (newParams.length < oldParams.length) {
        // Check if removed parameters had default values
        return true; // Simplified: assume breaking
      }
    }
    
    // Return type changes might be breaking
    if (oldSig.includes('->') || oldSig.includes(':')) {
      // Simplified return type comparison
      return oldSig !== newSig;
    }
    
    return false;
  }
  
  /**
   * Extract parameters from function signature (simplified)
   */
  private extractParameters(signature: string): string[] {
    const match = signature.match(/\(([^)]*)\)/);
    if (!match) return [];
    
    return match[1]
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
  
  /**
   * Generate recommendation for version bump
   */
  private generateRecommendation(
    changes: ChangeClassification,
    requested: VersionBump,
    required: VersionBump
  ): string {
    if (this.compareBumps(requested, required) >= 0) {
      return `Version bump ${requested} is appropriate for the changes made`;
    }
    
    const suggestions = [];
    
    if (changes.breaking.length > 0) {
      suggestions.push(`Consider using major version bump (${changes.breaking.length} breaking changes)`);
      
      // Suggest alternatives
      if (changes.breaking.every(c => c.impact === 'low')) {
        suggestions.push('Alternative: Mark removed symbols as deprecated in a minor release first');
      }
    }
    
    if (changes.additive.length > 0) {
      suggestions.push(`Minor version bump recommended for ${changes.additive.length} new API additions`);
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Patch version bump is sufficient for internal changes only');
    }
    
    return suggestions.join('. ');
  }
}

/**
 * Semver validation gate implementation
 */
export class SemverGate {
  private validator: SemverValidator;
  
  constructor(policy: SemverPolicy = 'strict') {
    this.validator = new SemverValidator(policy);
  }
  
  /**
   * Execute the semver validation gate
   */
  async execute(
    projectPath: string,
    epic: Epic,
    previousSurfacePath?: string
  ): Promise<{
    pass: boolean;
    result: SemverValidationResult;
    surfacePath: string;
  }> {
    const surfacePath = join(projectPath, 'dist', 'api-surface.json');
    
    try {
      // Load current API surface
      const currentSurface = JSON.parse(await fs.readFile(surfacePath, 'utf-8'));
      
      // Load previous surface if available
      let previousSurface;
      if (previousSurfacePath) {
        try {
          previousSurface = JSON.parse(await fs.readFile(previousSurfacePath, 'utf-8'));
        } catch {
          // No previous surface - treat as initial version
          previousSurface = {
            language: currentSurface.language,
            version: '0.0.0',
            extractedAt: new Date(0).toISOString(),
            exports: [],
            dependencies: []
          };
        }
      } else {
        // Create empty baseline
        previousSurface = {
          language: currentSurface.language,
          version: '0.0.0',
          extractedAt: new Date(0).toISOString(),
          exports: [],
          dependencies: []
        };
      }
      
      // Validate version bump
      const requestedBump = epic.versionBump || 'patch';
      const result = await this.validator.validateVersionBump(
        previousSurface,
        currentSurface,
        requestedBump,
        epic
      );
      
      return {
        pass: result.valid,
        result,
        surfacePath
      };
      
    } catch (error) {
      throw new Error(`Semver gate execution failed: ${error}`);
    }
  }
  
  /**
   * Generate semver gate report
   */
  generateReport(result: SemverValidationResult): string {
    const lines = [
      '# Semantic Versioning Validation Report',
      '',
      `**Status**: ${result.valid ? '✅ PASS' : '❌ FAIL'}`,
      `**Requested Bump**: ${result.requestedBump}`,
      `**Required Bump**: ${result.requiredBump}`,
      `**Message**: ${result.message}`,
      ''
    ];
    
    if (result.changes.breaking.length > 0) {
      lines.push('## Breaking Changes');
      lines.push('');
      for (const change of result.changes.breaking) {
        lines.push(`- **${change.symbol}** (${change.impact} impact): ${change.description}`);
      }
      lines.push('');
    }
    
    if (result.changes.additive.length > 0) {
      lines.push('## Additive Changes');
      lines.push('');
      for (const change of result.changes.additive) {
        lines.push(`- **${change.symbol}**: ${change.description}`);
      }
      lines.push('');
    }
    
    if (result.recommendation) {
      lines.push('## Recommendation');
      lines.push('');
      lines.push(result.recommendation);
    }
    
    return lines.join('\n');
  }
}

/**
 * Utility functions for version management
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

export function bumpVersion(currentVersion: string, bump: VersionBump): string {
  const { major, minor, patch } = parseVersion(currentVersion);
  
  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown version bump type: ${bump}`);
  }
}