/**
 * Semver Gate for Breaking Changes Detection
 * 
 * Analyzes API surface differences to determine required version bump
 * and enforces semver policy compliance as specified in library profiles.
 */

import type { TypeScriptApiSurface } from '../extractors/typescript-surface.js';
import type { GoApiSurface } from '../extractors/go-surface.js';

export type ApiSurface = TypeScriptApiSurface | GoApiSurface | any;

export interface BreakingChangeAnalysis {
  required: SemverBump;
  changes: ApiChange[];
  compatible: boolean;
  summary: {
    breaking: number;
    major: number;
    minor: number;
    patch: number;
  };
  verdict: {
    passed: boolean;
    reason?: string;
    recommendation: string;
  };
}

export type SemverBump = 'none' | 'patch' | 'minor' | 'major';
export type SemverPolicy = 'strict' | 'minor' | 'none';

export interface ApiChange {
  type: 'breaking' | 'major' | 'minor' | 'patch';
  category: 'function' | 'class' | 'interface' | 'type' | 'constant' | 'enum' | 'field' | 'parameter';
  operation: 'added' | 'removed' | 'modified';
  path: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  impact: 'high' | 'medium' | 'low';
}

export class SemverGate {
  constructor(
    private policy: SemverPolicy,
    private forbidBreaking: boolean = true
  ) {}

  /**
   * Analyze API changes and determine required version bump
   */
  analyze(
    previousSurface: ApiSurface | null,
    currentSurface: ApiSurface,
    requestedBump?: SemverBump
  ): BreakingChangeAnalysis {
    // If no previous surface, this is the first version
    if (!previousSurface) {
      return this.firstVersionAnalysis(currentSurface, requestedBump);
    }

    // Detect changes between surfaces
    const changes = this.detectChanges(previousSurface, currentSurface);
    
    // Determine required bump based on changes
    const required = this.determineRequiredBump(changes);
    
    // Check policy compliance
    const verdict = this.checkPolicyCompliance(changes, required, requestedBump);
    
    // Build summary
    const summary = {
      breaking: changes.filter(c => c.type === 'breaking').length,
      major: changes.filter(c => c.type === 'major').length,
      minor: changes.filter(c => c.type === 'minor').length,
      patch: changes.filter(c => c.type === 'patch').length,
    };

    return {
      required,
      changes,
      compatible: summary.breaking === 0,
      summary,
      verdict,
    };
  }

  private firstVersionAnalysis(
    currentSurface: ApiSurface,
    requestedBump?: SemverBump
  ): BreakingChangeAnalysis {
    const changes: ApiChange[] = [
      {
        type: 'minor',
        category: 'interface',
        operation: 'added',
        path: 'API',
        description: 'Initial API surface',
        impact: 'low',
      },
    ];

    return {
      required: 'minor',
      changes,
      compatible: true,
      summary: { breaking: 0, major: 0, minor: 1, patch: 0 },
      verdict: {
        passed: true,
        recommendation: 'Initial version - any bump is acceptable',
      },
    };
  }

  private detectChanges(previousSurface: ApiSurface, currentSurface: ApiSurface): ApiChange[] {
    const changes: ApiChange[] = [];

    // Detect changes based on surface type
    if (this.isTypeScriptSurface(previousSurface) && this.isTypeScriptSurface(currentSurface)) {
      changes.push(...this.detectTypeScriptChanges(previousSurface, currentSurface));
    } else if (this.isGoSurface(previousSurface) && this.isGoSurface(currentSurface)) {
      changes.push(...this.detectGoChanges(previousSurface, currentSurface));
    } else {
      // Generic surface comparison
      changes.push(...this.detectGenericChanges(previousSurface, currentSurface));
    }

    return changes;
  }

  private detectTypeScriptChanges(
    previous: TypeScriptApiSurface, 
    current: TypeScriptApiSurface
  ): ApiChange[] {
    const changes: ApiChange[] = [];

    // Function changes
    changes.push(...this.compareFunctions(previous.exports.functions, current.exports.functions));
    
    // Class changes
    changes.push(...this.compareClasses(previous.exports.classes, current.exports.classes));
    
    // Interface changes
    changes.push(...this.compareInterfaces(previous.exports.interfaces, current.exports.interfaces));
    
    // Type alias changes
    changes.push(...this.compareTypes(previous.exports.types, current.exports.types));
    
    // Constant changes
    changes.push(...this.compareConstants(previous.exports.constants, current.exports.constants));
    
    // Enum changes
    changes.push(...this.compareEnums(previous.exports.enums, current.exports.enums));

    return changes;
  }

  private detectGoChanges(previous: GoApiSurface, current: GoApiSurface): ApiChange[] {
    const changes: ApiChange[] = [];

    // Compare packages
    for (const currentPkg of current.packages) {
      const previousPkg = previous.packages.find(p => p.path === currentPkg.path);
      
      if (!previousPkg) {
        changes.push({
          type: 'minor',
          category: 'interface',
          operation: 'added',
          path: currentPkg.path,
          description: `Added new package: ${currentPkg.name}`,
          impact: 'medium',
        });
        continue;
      }

      // Compare package exports
      changes.push(...this.compareGoFunctions(previousPkg.exports.functions, currentPkg.exports.functions, currentPkg.path));
      changes.push(...this.compareGoTypes(previousPkg.exports.types, currentPkg.exports.types, currentPkg.path));
      changes.push(...this.compareGoConstants(previousPkg.exports.constants, currentPkg.exports.constants, currentPkg.path));
      changes.push(...this.compareGoVariables(previousPkg.exports.variables, currentPkg.exports.variables, currentPkg.path));
    }

    // Check for removed packages
    for (const previousPkg of previous.packages) {
      const currentPkg = current.packages.find(p => p.path === previousPkg.path);
      if (!currentPkg) {
        changes.push({
          type: 'breaking',
          category: 'interface',
          operation: 'removed',
          path: previousPkg.path,
          description: `Removed package: ${previousPkg.name}`,
          impact: 'high',
        });
      }
    }

    return changes;
  }

  private detectGenericChanges(previous: any, current: any): ApiChange[] {
    const changes: ApiChange[] = [];
    
    // Generic comparison - just check if major structure changed
    const previousKeys = Object.keys(previous.exports || {});
    const currentKeys = Object.keys(current.exports || {});
    
    const removed = previousKeys.filter(key => !currentKeys.includes(key));
    const added = currentKeys.filter(key => !previousKeys.includes(key));
    
    for (const key of removed) {
      changes.push({
        type: 'breaking',
        category: 'interface',
        operation: 'removed',
        path: key,
        description: `Removed export category: ${key}`,
        impact: 'high',
      });
    }
    
    for (const key of added) {
      changes.push({
        type: 'minor',
        category: 'interface',
        operation: 'added',
        path: key,
        description: `Added export category: ${key}`,
        impact: 'low',
      });
    }

    return changes;
  }

  private compareFunctions(previous: any[], current: any[]): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(f => [f.name, f]));
    const currentMap = new Map(current.map(f => [f.name, f]));

    // Check for removed functions (breaking)
    for (const [name, func] of previousMap) {
      if (!currentMap.has(name)) {
        changes.push({
          type: 'breaking',
          category: 'function',
          operation: 'removed',
          path: name,
          description: `Removed function: ${name}`,
          oldValue: func.signature || func.name,
          impact: 'high',
        });
      }
    }

    // Check for added functions (minor)
    for (const [name, func] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'function',
          operation: 'added',
          path: name,
          description: `Added function: ${name}`,
          newValue: func.signature || func.name,
          impact: 'low',
        });
      }
    }

    // Check for modified functions
    for (const [name, currentFunc] of currentMap) {
      const previousFunc = previousMap.get(name);
      if (previousFunc) {
        const funcChanges = this.compareFunctionSignatures(previousFunc, currentFunc, name);
        changes.push(...funcChanges);
      }
    }

    return changes;
  }

  private compareClasses(previous: any[], current: any[]): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(c => [c.name, c]));
    const currentMap = new Map(current.map(c => [c.name, c]));

    // Check for removed classes (breaking)
    for (const [name, cls] of previousMap) {
      if (!currentMap.has(name)) {
        changes.push({
          type: 'breaking',
          category: 'class',
          operation: 'removed',
          path: name,
          description: `Removed class: ${name}`,
          oldValue: name,
          impact: 'high',
        });
      }
    }

    // Check for added classes (minor)
    for (const [name, cls] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'class',
          operation: 'added',
          path: name,
          description: `Added class: ${name}`,
          newValue: name,
          impact: 'low',
        });
      }
    }

    // Check for modified classes
    for (const [name, currentClass] of currentMap) {
      const previousClass = previousMap.get(name);
      if (previousClass) {
        const classChanges = this.compareClassStructures(previousClass, currentClass, name);
        changes.push(...classChanges);
      }
    }

    return changes;
  }

  private compareInterfaces(previous: any[], current: any[]): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(i => [i.name, i]));
    const currentMap = new Map(current.map(i => [i.name, i]));

    // Check for removed interfaces (breaking)
    for (const [name, iface] of previousMap) {
      if (!currentMap.has(name)) {
        changes.push({
          type: 'breaking',
          category: 'interface',
          operation: 'removed',
          path: name,
          description: `Removed interface: ${name}`,
          oldValue: name,
          impact: 'high',
        });
      }
    }

    // Check for added interfaces (minor)
    for (const [name, iface] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'interface',
          operation: 'added',
          path: name,
          description: `Added interface: ${name}`,
          newValue: name,
          impact: 'low',
        });
      }
    }

    // Check for modified interfaces
    for (const [name, currentInterface] of currentMap) {
      const previousInterface = previousMap.get(name);
      if (previousInterface) {
        const interfaceChanges = this.compareInterfaceStructures(previousInterface, currentInterface, name);
        changes.push(...interfaceChanges);
      }
    }

    return changes;
  }

  private compareTypes(previous: any[], current: any[]): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(t => [t.name, t]));
    const currentMap = new Map(current.map(t => [t.name, t]));

    // Type alias changes follow similar pattern
    for (const [name, type] of previousMap) {
      const currentType = currentMap.get(name);
      if (!currentType) {
        changes.push({
          type: 'breaking',
          category: 'type',
          operation: 'removed',
          path: name,
          description: `Removed type alias: ${name}`,
          oldValue: type.type,
          impact: 'high',
        });
      } else if (type.type !== currentType.type) {
        changes.push({
          type: 'breaking',
          category: 'type',
          operation: 'modified',
          path: name,
          description: `Modified type alias: ${name}`,
          oldValue: type.type,
          newValue: currentType.type,
          impact: 'high',
        });
      }
    }

    for (const [name, type] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'type',
          operation: 'added',
          path: name,
          description: `Added type alias: ${name}`,
          newValue: type.type,
          impact: 'low',
        });
      }
    }

    return changes;
  }

  private compareConstants(previous: any[], current: any[]): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(c => [c.name, c]));
    const currentMap = new Map(current.map(c => [c.name, c]));

    for (const [name, constant] of previousMap) {
      const currentConstant = currentMap.get(name);
      if (!currentConstant) {
        changes.push({
          type: 'breaking',
          category: 'constant',
          operation: 'removed',
          path: name,
          description: `Removed constant: ${name}`,
          oldValue: constant.value,
          impact: 'medium',
        });
      } else if (constant.type !== currentConstant.type) {
        changes.push({
          type: 'breaking',
          category: 'constant',
          operation: 'modified',
          path: name,
          description: `Changed constant type: ${name}`,
          oldValue: constant.type,
          newValue: currentConstant.type,
          impact: 'high',
        });
      } else if (constant.value !== currentConstant.value) {
        changes.push({
          type: 'major',
          category: 'constant',
          operation: 'modified',
          path: name,
          description: `Changed constant value: ${name}`,
          oldValue: constant.value,
          newValue: currentConstant.value,
          impact: 'medium',
        });
      }
    }

    for (const [name, constant] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'constant',
          operation: 'added',
          path: name,
          description: `Added constant: ${name}`,
          newValue: constant.value,
          impact: 'low',
        });
      }
    }

    return changes;
  }

  private compareEnums(previous: any[], current: any[]): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(e => [e.name, e]));
    const currentMap = new Map(current.map(e => [e.name, e]));

    for (const [name, enumDef] of previousMap) {
      const currentEnum = currentMap.get(name);
      if (!currentEnum) {
        changes.push({
          type: 'breaking',
          category: 'enum',
          operation: 'removed',
          path: name,
          description: `Removed enum: ${name}`,
          oldValue: enumDef.members,
          impact: 'high',
        });
      } else {
        // Check enum members
        const memberChanges = this.compareEnumMembers(enumDef.members, currentEnum.members, name);
        changes.push(...memberChanges);
      }
    }

    for (const [name, enumDef] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'enum',
          operation: 'added',
          path: name,
          description: `Added enum: ${name}`,
          newValue: enumDef.members,
          impact: 'low',
        });
      }
    }

    return changes;
  }

  private compareFunctionSignatures(previous: any, current: any, path: string): ApiChange[] {
    const changes: ApiChange[] = [];

    // Check return type changes
    if (previous.returnType !== current.returnType) {
      changes.push({
        type: 'breaking',
        category: 'function',
        operation: 'modified',
        path: `${path}.returnType`,
        description: `Function ${path} return type changed`,
        oldValue: previous.returnType,
        newValue: current.returnType,
        impact: 'high',
      });
    }

    // Check parameter changes
    const paramChanges = this.compareParameters(previous.parameters || [], current.parameters || [], path);
    changes.push(...paramChanges);

    return changes;
  }

  private compareClassStructures(previous: any, current: any, path: string): ApiChange[] {
    const changes: ApiChange[] = [];

    // Check inheritance changes
    if (previous.extends !== current.extends) {
      changes.push({
        type: 'breaking',
        category: 'class',
        operation: 'modified',
        path: `${path}.extends`,
        description: `Class ${path} inheritance changed`,
        oldValue: previous.extends,
        newValue: current.extends,
        impact: 'high',
      });
    }

    // Check method changes
    const methodChanges = this.compareFunctions(previous.methods || [], current.methods || []);
    changes.push(...methodChanges.map(change => ({ 
      ...change, 
      path: `${path}.${change.path}` 
    })));

    return changes;
  }

  private compareInterfaceStructures(previous: any, current: any, path: string): ApiChange[] {
    const changes: ApiChange[] = [];

    // Check property changes
    const propertyChanges = this.compareProperties(previous.properties || [], current.properties || [], path);
    changes.push(...propertyChanges);

    // Check method changes
    const methodChanges = this.compareFunctions(previous.methods || [], current.methods || []);
    changes.push(...methodChanges.map(change => ({ 
      ...change, 
      path: `${path}.${change.path}` 
    })));

    return changes;
  }

  private compareProperties(previous: any[], current: any[], path: string): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(p => [p.name, p]));
    const currentMap = new Map(current.map(p => [p.name, p]));

    for (const [name, prop] of previousMap) {
      const currentProp = currentMap.get(name);
      if (!currentProp) {
        changes.push({
          type: 'breaking',
          category: 'field',
          operation: 'removed',
          path: `${path}.${name}`,
          description: `Removed property: ${name}`,
          oldValue: prop.type,
          impact: 'high',
        });
      } else if (prop.type !== currentProp.type) {
        changes.push({
          type: 'breaking',
          category: 'field',
          operation: 'modified',
          path: `${path}.${name}`,
          description: `Property ${name} type changed`,
          oldValue: prop.type,
          newValue: currentProp.type,
          impact: 'high',
        });
      } else if (!prop.optional && currentProp.optional) {
        changes.push({
          type: 'minor',
          category: 'field',
          operation: 'modified',
          path: `${path}.${name}`,
          description: `Property ${name} became optional`,
          oldValue: 'required',
          newValue: 'optional',
          impact: 'low',
        });
      } else if (prop.optional && !currentProp.optional) {
        changes.push({
          type: 'breaking',
          category: 'field',
          operation: 'modified',
          path: `${path}.${name}`,
          description: `Property ${name} became required`,
          oldValue: 'optional',
          newValue: 'required',
          impact: 'high',
        });
      }
    }

    for (const [name, prop] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: prop.optional ? 'minor' : 'breaking',
          category: 'field',
          operation: 'added',
          path: `${path}.${name}`,
          description: `Added property: ${name}`,
          newValue: prop.type,
          impact: prop.optional ? 'low' : 'high',
        });
      }
    }

    return changes;
  }

  private compareParameters(previous: any[], current: any[], path: string): ApiChange[] {
    const changes: ApiChange[] = [];

    // Parameter changes are generally breaking
    if (previous.length !== current.length) {
      const type = previous.length < current.length ? 'minor' : 'breaking';
      changes.push({
        type,
        category: 'parameter',
        operation: 'modified',
        path: `${path}.parameters`,
        description: `Parameter count changed from ${previous.length} to ${current.length}`,
        oldValue: previous.length,
        newValue: current.length,
        impact: type === 'breaking' ? 'high' : 'low',
      });
    }

    // Check parameter type changes
    for (let i = 0; i < Math.min(previous.length, current.length); i++) {
      const prevParam = previous[i];
      const currParam = current[i];

      if (prevParam.type !== currParam.type) {
        changes.push({
          type: 'breaking',
          category: 'parameter',
          operation: 'modified',
          path: `${path}.parameters[${i}]`,
          description: `Parameter ${i} type changed`,
          oldValue: prevParam.type,
          newValue: currParam.type,
          impact: 'high',
        });
      }
    }

    return changes;
  }

  private compareEnumMembers(previous: any[], current: any[], path: string): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(m => [m.name, m]));
    const currentMap = new Map(current.map(m => [m.name, m]));

    // Removed enum members are breaking
    for (const [name, member] of previousMap) {
      if (!currentMap.has(name)) {
        changes.push({
          type: 'breaking',
          category: 'enum',
          operation: 'removed',
          path: `${path}.${name}`,
          description: `Removed enum member: ${name}`,
          oldValue: member.value,
          impact: 'high',
        });
      }
    }

    // Added enum members are minor changes
    for (const [name, member] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'enum',
          operation: 'added',
          path: `${path}.${name}`,
          description: `Added enum member: ${name}`,
          newValue: member.value,
          impact: 'low',
        });
      }
    }

    return changes;
  }

  // Go-specific comparison methods
  private compareGoFunctions(previous: any[], current: any[], packagePath: string): ApiChange[] {
    // Similar to TypeScript function comparison but adapted for Go
    return this.compareFunctions(previous, current).map(change => ({
      ...change,
      path: `${packagePath}.${change.path}`,
    }));
  }

  private compareGoTypes(previous: any[], current: any[], packagePath: string): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(t => [t.name, t]));
    const currentMap = new Map(current.map(t => [t.name, t]));

    for (const [name, type] of previousMap) {
      const currentType = currentMap.get(name);
      if (!currentType) {
        changes.push({
          type: 'breaking',
          category: 'type',
          operation: 'removed',
          path: `${packagePath}.${name}`,
          description: `Removed Go type: ${name}`,
          oldValue: type.definition,
          impact: 'high',
        });
      } else if (type.definition !== currentType.definition) {
        changes.push({
          type: 'breaking',
          category: 'type',
          operation: 'modified',
          path: `${packagePath}.${name}`,
          description: `Modified Go type: ${name}`,
          oldValue: type.definition,
          newValue: currentType.definition,
          impact: 'high',
        });
      }
    }

    for (const [name, type] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'type',
          operation: 'added',
          path: `${packagePath}.${name}`,
          description: `Added Go type: ${name}`,
          newValue: type.definition,
          impact: 'low',
        });
      }
    }

    return changes;
  }

  private compareGoConstants(previous: any[], current: any[], packagePath: string): ApiChange[] {
    return this.compareConstants(previous, current).map(change => ({
      ...change,
      path: `${packagePath}.${change.path}`,
    }));
  }

  private compareGoVariables(previous: any[], current: any[], packagePath: string): ApiChange[] {
    const changes: ApiChange[] = [];
    const previousMap = new Map(previous.map(v => [v.name, v]));
    const currentMap = new Map(current.map(v => [v.name, v]));

    for (const [name, variable] of previousMap) {
      const currentVar = currentMap.get(name);
      if (!currentVar) {
        changes.push({
          type: 'breaking',
          category: 'constant',
          operation: 'removed',
          path: `${packagePath}.${name}`,
          description: `Removed Go variable: ${name}`,
          oldValue: variable.type,
          impact: 'medium',
        });
      } else if (variable.type !== currentVar.type) {
        changes.push({
          type: 'breaking',
          category: 'constant',
          operation: 'modified',
          path: `${packagePath}.${name}`,
          description: `Changed Go variable type: ${name}`,
          oldValue: variable.type,
          newValue: currentVar.type,
          impact: 'high',
        });
      }
    }

    for (const [name, variable] of currentMap) {
      if (!previousMap.has(name)) {
        changes.push({
          type: 'minor',
          category: 'constant',
          operation: 'added',
          path: `${packagePath}.${name}`,
          description: `Added Go variable: ${name}`,
          newValue: variable.type,
          impact: 'low',
        });
      }
    }

    return changes;
  }

  private determineRequiredBump(changes: ApiChange[]): SemverBump {
    const hasBreaking = changes.some(c => c.type === 'breaking');
    const hasMajor = changes.some(c => c.type === 'major');
    const hasMinor = changes.some(c => c.type === 'minor');
    const hasPatch = changes.some(c => c.type === 'patch');

    if (hasBreaking) return 'major';
    if (hasMajor) return 'major';
    if (hasMinor) return 'minor';
    if (hasPatch) return 'patch';
    
    return 'none';
  }

  private checkPolicyCompliance(
    changes: ApiChange[],
    required: SemverBump,
    requested?: SemverBump
  ): BreakingChangeAnalysis['verdict'] {
    const breakingChanges = changes.filter(c => c.type === 'breaking');

    // Check if breaking changes are forbidden
    if (this.forbidBreaking && breakingChanges.length > 0) {
      return {
        passed: false,
        reason: `Breaking changes are forbidden by policy, but ${breakingChanges.length} breaking changes detected`,
        recommendation: 'Remove breaking changes or update policy configuration',
      };
    }

    // Check semver policy compliance
    if (this.policy === 'strict') {
      if (requested && !this.isBumpSufficient(requested, required)) {
        return {
          passed: false,
          reason: `Requested bump (${requested}) is insufficient for detected changes (requires ${required})`,
          recommendation: `Use version bump: ${required}`,
        };
      }
    } else if (this.policy === 'minor') {
      if (required === 'major' && (!requested || requested !== 'major')) {
        return {
          passed: false,
          reason: 'Major changes detected but policy only allows minor changes',
          recommendation: 'Remove breaking changes or explicitly request major bump',
        };
      }
    }

    return {
      passed: true,
      recommendation: required === 'none' ? 'No version bump required' : `Recommended version bump: ${required}`,
    };
  }

  private isBumpSufficient(requested: SemverBump, required: SemverBump): boolean {
    const order: SemverBump[] = ['none', 'patch', 'minor', 'major'];
    return order.indexOf(requested) >= order.indexOf(required);
  }

  private isTypeScriptSurface(surface: any): surface is TypeScriptApiSurface {
    return surface.extractor === 'typescript-surface';
  }

  private isGoSurface(surface: any): surface is GoApiSurface {
    return surface.extractor === 'go-surface';
  }
}

/**
 * Convenience function for breaking change analysis
 */
export function analyzeSemverCompatibility(
  previousSurface: ApiSurface | null,
  currentSurface: ApiSurface,
  policy: SemverPolicy = 'strict',
  forbidBreaking: boolean = true,
  requestedBump?: SemverBump
): BreakingChangeAnalysis {
  const gate = new SemverGate(policy, forbidBreaking);
  return gate.analyze(previousSurface, currentSurface, requestedBump);
}