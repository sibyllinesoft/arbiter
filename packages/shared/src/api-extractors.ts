/**
 * API surface extractors for different languages
 * Implements the TODO.md specification for TS and Go extractors
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { join, resolve } from 'path';
import { glob } from 'glob';

export interface APISymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'constant' | 'variable' | 'method' | 'property';
  signature?: string;
  description?: string;
  deprecated?: boolean;
  since?: string;
  visibility: 'public' | 'private' | 'protected';
}

export interface APISurface {
  language: string;
  version: string;
  extractedAt: string;
  exports: APISymbol[];
  dependencies: string[];
  breaking_changes?: Array<{
    type: 'removed' | 'signature_changed' | 'visibility_changed';
    symbol: string;
    details: string;
  }>;
}

export interface APIExtractor {
  language: string;
  extract(projectPath: string): Promise<APISurface>;
  compare(oldSurface: APISurface, newSurface: APISurface): Promise<{
    breaking: boolean;
    changes: APISurface['breaking_changes'];
    addedSymbols: APISymbol[];
    removedSymbols: APISymbol[];
  }>;
}

/**
 * TypeScript API extractor using TypeScript compiler API
 */
export class TypeScriptExtractor implements APIExtractor {
  language = 'typescript';
  
  async extract(projectPath: string): Promise<APISurface> {
    const tsFiles = await glob('**/*.ts', { 
      cwd: projectPath, 
      ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'] 
    });
    
    const exports: APISymbol[] = [];
    const dependencies = await this.extractDependencies(projectPath);
    
    // Simple regex-based extraction (in real implementation, use TypeScript compiler API)
    for (const file of tsFiles) {
      const filePath = join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract exported functions
      const functionMatches = content.matchAll(/export\s+(async\s+)?function\s+(\w+)/g);
      for (const match of functionMatches) {
        exports.push({
          name: match[2],
          kind: 'function',
          signature: this.extractFunctionSignature(content, match[2]),
          visibility: 'public'
        });
      }
      
      // Extract exported classes
      const classMatches = content.matchAll(/export\s+class\s+(\w+)/g);
      for (const match of classMatches) {
        exports.push({
          name: match[1],
          kind: 'class',
          signature: this.extractClassSignature(content, match[1]),
          visibility: 'public'
        });
      }
      
      // Extract exported interfaces
      const interfaceMatches = content.matchAll(/export\s+interface\s+(\w+)/g);
      for (const match of interfaceMatches) {
        exports.push({
          name: match[1],
          kind: 'interface',
          signature: this.extractInterfaceSignature(content, match[1]),
          visibility: 'public'
        });
      }
      
      // Extract exported types
      const typeMatches = content.matchAll(/export\s+type\s+(\w+)/g);
      for (const match of typeMatches) {
        exports.push({
          name: match[1],
          kind: 'type',
          signature: this.extractTypeSignature(content, match[1]),
          visibility: 'public'
        });
      }
      
      // Extract exported enums
      const enumMatches = content.matchAll(/export\s+enum\s+(\w+)/g);
      for (const match of enumMatches) {
        exports.push({
          name: match[1],
          kind: 'enum',
          signature: this.extractEnumSignature(content, match[1]),
          visibility: 'public'
        });
      }
    }
    
    return {
      language: this.language,
      version: await this.getPackageVersion(projectPath),
      extractedAt: new Date().toISOString(),
      exports: exports.sort((a, b) => a.name.localeCompare(b.name)),
      dependencies
    };
  }
  
  async compare(oldSurface: APISurface, newSurface: APISurface): Promise<{
    breaking: boolean;
    changes: APISurface['breaking_changes'];
    addedSymbols: APISymbol[];
    removedSymbols: APISymbol[];
  }> {
    const oldSymbols = new Map(oldSurface.exports.map(s => [s.name, s]));
    const newSymbols = new Map(newSurface.exports.map(s => [s.name, s]));
    
    const changes: APISurface['breaking_changes'] = [];
    const addedSymbols: APISymbol[] = [];
    const removedSymbols: APISymbol[] = [];
    
    // Find removed symbols (breaking)
    for (const [name, symbol] of oldSymbols) {
      if (!newSymbols.has(name)) {
        removedSymbols.push(symbol);
        changes.push({
          type: 'removed',
          symbol: name,
          details: `${symbol.kind} ${name} was removed`
        });
      }
    }
    
    // Find added symbols (non-breaking)
    for (const [name, symbol] of newSymbols) {
      if (!oldSymbols.has(name)) {
        addedSymbols.push(symbol);
      }
    }
    
    // Find signature changes (potentially breaking)
    for (const [name, newSymbol] of newSymbols) {
      const oldSymbol = oldSymbols.get(name);
      if (oldSymbol && oldSymbol.signature !== newSymbol.signature) {
        changes.push({
          type: 'signature_changed',
          symbol: name,
          details: `${newSymbol.kind} ${name} signature changed from "${oldSymbol.signature}" to "${newSymbol.signature}"`
        });
      }
    }
    
    const breaking = changes.some(c => c.type === 'removed' || c.type === 'signature_changed');
    
    return {
      breaking,
      changes,
      addedSymbols,
      removedSymbols
    };
  }
  
  private async extractDependencies(projectPath: string): Promise<string[]> {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return Object.keys(packageJson.dependencies || {});
    } catch {
      return [];
    }
  }
  
  private async getPackageVersion(projectPath: string): Promise<string> {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
  
  private extractFunctionSignature(content: string, functionName: string): string {
    const regex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)(?::\\s*[^{]+)?`, 'g');
    const match = regex.exec(content);
    return match ? match[0].replace(/^export\s+/, '') : `function ${functionName}()`;
  }
  
  private extractClassSignature(content: string, className: string): string {
    const regex = new RegExp(`export\\s+class\\s+${className}(?:\\s+extends\\s+\\w+)?(?:\\s+implements\\s+[^{]+)?`, 'g');
    const match = regex.exec(content);
    return match ? match[0].replace(/^export\s+/, '') : `class ${className}`;
  }
  
  private extractInterfaceSignature(content: string, interfaceName: string): string {
    const regex = new RegExp(`export\\s+interface\\s+${interfaceName}(?:\\s+extends\\s+[^{]+)?`, 'g');
    const match = regex.exec(content);
    return match ? match[0].replace(/^export\s+/, '') : `interface ${interfaceName}`;
  }
  
  private extractTypeSignature(content: string, typeName: string): string {
    const regex = new RegExp(`export\\s+type\\s+${typeName}\\s*=\\s*[^;]+`, 'g');
    const match = regex.exec(content);
    return match ? match[0].replace(/^export\s+/, '') : `type ${typeName}`;
  }
  
  private extractEnumSignature(content: string, enumName: string): string {
    return `enum ${enumName}`;
  }
}

/**
 * Go API extractor using go doc and reflection
 */
export class GoExtractor implements APIExtractor {
  language = 'go';
  
  async extract(projectPath: string): Promise<APISurface> {
    // Check if this is a Go project
    const goModPath = join(projectPath, 'go.mod');
    try {
      await fs.access(goModPath);
    } catch {
      throw new Error('Not a Go project - go.mod not found');
    }
    
    const exports: APISymbol[] = [];
    const dependencies = await this.extractDependencies(projectPath);
    
    try {
      // Use go doc to extract package information
      const docOutput = execSync('go doc -all ./...', { 
        cwd: projectPath, 
        encoding: 'utf-8',
        timeout: 30000
      });
      
      // Parse go doc output (simplified)
      const lines = docOutput.split('\n');
      let currentPackage = '';
      
      for (const line of lines) {
        // Package declaration
        if (line.startsWith('package ')) {
          currentPackage = line.replace('package ', '').trim();
          continue;
        }
        
        // Function declarations
        if (line.startsWith('func ')) {
          const match = line.match(/func\s+(\w+)/);
          if (match) {
            exports.push({
              name: match[1],
              kind: 'function',
              signature: line.trim(),
              visibility: this.isPublic(match[1]) ? 'public' : 'private'
            });
          }
        }
        
        // Type declarations
        if (line.startsWith('type ')) {
          const match = line.match(/type\s+(\w+)/);
          if (match) {
            const kind = line.includes('struct') ? 'class' : 
                        line.includes('interface') ? 'interface' : 'type';
            exports.push({
              name: match[1],
              kind: kind as APISymbol['kind'],
              signature: line.trim(),
              visibility: this.isPublic(match[1]) ? 'public' : 'private'
            });
          }
        }
        
        // Constant declarations
        if (line.startsWith('const ')) {
          const match = line.match(/const\s+(\w+)/);
          if (match) {
            exports.push({
              name: match[1],
              kind: 'constant',
              signature: line.trim(),
              visibility: this.isPublic(match[1]) ? 'public' : 'private'
            });
          }
        }
        
        // Variable declarations
        if (line.startsWith('var ')) {
          const match = line.match(/var\s+(\w+)/);
          if (match) {
            exports.push({
              name: match[1],
              kind: 'variable',
              signature: line.trim(),
              visibility: this.isPublic(match[1]) ? 'public' : 'private'
            });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to extract Go API surface:', error);
      // Fallback to basic file parsing if go doc fails
      await this.fallbackExtraction(projectPath, exports);
    }
    
    return {
      language: this.language,
      version: await this.getModuleVersion(projectPath),
      extractedAt: new Date().toISOString(),
      exports: exports.filter(e => e.visibility === 'public').sort((a, b) => a.name.localeCompare(b.name)),
      dependencies
    };
  }
  
  async compare(oldSurface: APISurface, newSurface: APISurface): Promise<{
    breaking: boolean;
    changes: APISurface['breaking_changes'];
    addedSymbols: APISymbol[];
    removedSymbols: APISymbol[];
  }> {
    // Similar to TypeScript comparison logic
    const oldSymbols = new Map(oldSurface.exports.map(s => [s.name, s]));
    const newSymbols = new Map(newSurface.exports.map(s => [s.name, s]));
    
    const changes: APISurface['breaking_changes'] = [];
    const addedSymbols: APISymbol[] = [];
    const removedSymbols: APISymbol[] = [];
    
    // Find removed symbols
    for (const [name, symbol] of oldSymbols) {
      if (!newSymbols.has(name)) {
        removedSymbols.push(symbol);
        changes.push({
          type: 'removed',
          symbol: name,
          details: `${symbol.kind} ${name} was removed`
        });
      }
    }
    
    // Find added symbols
    for (const [name, symbol] of newSymbols) {
      if (!oldSymbols.has(name)) {
        addedSymbols.push(symbol);
      }
    }
    
    // Find signature changes
    for (const [name, newSymbol] of newSymbols) {
      const oldSymbol = oldSymbols.get(name);
      if (oldSymbol && oldSymbol.signature !== newSymbol.signature) {
        changes.push({
          type: 'signature_changed',
          symbol: name,
          details: `${newSymbol.kind} ${name} signature changed`
        });
      }
    }
    
    const breaking = changes.some(c => c.type === 'removed' || c.type === 'signature_changed');
    
    return {
      breaking,
      changes,
      addedSymbols,
      removedSymbols
    };
  }
  
  private isPublic(identifier: string): boolean {
    // In Go, public identifiers start with uppercase letter
    return identifier.length > 0 && identifier[0] >= 'A' && identifier[0] <= 'Z';
  }
  
  private async extractDependencies(projectPath: string): Promise<string[]> {
    try {
      const goModPath = join(projectPath, 'go.mod');
      const goModContent = await fs.readFile(goModPath, 'utf-8');
      const deps: string[] = [];
      
      const lines = goModContent.split('\n');
      let inRequire = false;
      
      for (const line of lines) {
        if (line.trim().startsWith('require (')) {
          inRequire = true;
          continue;
        }
        if (inRequire && line.trim() === ')') {
          inRequire = false;
          continue;
        }
        if (inRequire || line.trim().startsWith('require ')) {
          const match = line.match(/^\s*([^\s]+)\s+v?[\d.]+/);
          if (match) {
            deps.push(match[1]);
          }
        }
      }
      
      return deps;
    } catch {
      return [];
    }
  }
  
  private async getModuleVersion(projectPath: string): Promise<string> {
    try {
      const goModPath = join(projectPath, 'go.mod');
      const goModContent = await fs.readFile(goModPath, 'utf-8');
      const versionMatch = goModContent.match(/^module\s+([^\s]+)\s*$/m);
      return versionMatch ? versionMatch[1] : '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
  
  private async fallbackExtraction(projectPath: string, exports: APISymbol[]): Promise<void> {
    // Simple regex-based Go extraction as fallback
    const goFiles = await glob('**/*.go', { 
      cwd: projectPath, 
      ignore: ['**/*_test.go', '**/vendor/**'] 
    });
    
    for (const file of goFiles) {
      const filePath = join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract public functions
      const funcMatches = content.matchAll(/^func\s+([A-Z]\w*)/gm);
      for (const match of funcMatches) {
        exports.push({
          name: match[1],
          kind: 'function',
          signature: `func ${match[1]}`,
          visibility: 'public'
        });
      }
      
      // Extract public types
      const typeMatches = content.matchAll(/^type\s+([A-Z]\w*)/gm);
      for (const match of typeMatches) {
        exports.push({
          name: match[1],
          kind: 'type',
          signature: `type ${match[1]}`,
          visibility: 'public'
        });
      }
    }
  }
}

/**
 * API extractor factory
 */
export class APIExtractorFactory {
  private static extractors: Record<string, APIExtractor> = {
    typescript: new TypeScriptExtractor(),
    ts: new TypeScriptExtractor(),
    go: new GoExtractor()
  };
  
  static getExtractor(language: string): APIExtractor {
    const extractor = this.extractors[language];
    if (!extractor) {
      throw new Error(`No API extractor found for language: ${language}`);
    }
    return extractor;
  }
  
  static getSupportedLanguages(): string[] {
    return Object.keys(this.extractors);
  }
}

/**
 * Utility function to save API surface to file
 */
export async function saveAPISurface(surface: APISurface, outputPath: string): Promise<void> {
  await fs.writeFile(outputPath, JSON.stringify(surface, null, 2), 'utf-8');
}

/**
 * Utility function to load API surface from file
 */
export async function loadAPISurface(inputPath: string): Promise<APISurface> {
  const content = await fs.readFile(inputPath, 'utf-8');
  return JSON.parse(content);
}