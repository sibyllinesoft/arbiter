/**
 * Go API Surface Extractor
 * 
 * Extracts public API surface from Go libraries by:
 * 1. Using `go doc -all` to get exported symbols
 * 2. Parsing Go source files for type definitions
 * 3. Converting to standardized surface.json format for semver analysis
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { glob } from 'glob';

export interface GoApiSurface {
  version: string;
  extractedAt: string;
  extractor: 'go-surface';
  modulePath: string;
  sourceFiles: string[];
  packages: GoPackage[];
  dependencies: {
    external: string[];
    internal: string[];
  };
  metadata: {
    totalExports: number;
    complexityScore: number;
    goVersion: string;
  };
}

export interface GoPackage {
  name: string;
  path: string;
  doc: string;
  exports: {
    functions: GoFunction[];
    types: GoType[];
    constants: GoConstant[];
    variables: GoVariable[];
  };
}

export interface GoFunction {
  name: string;
  signature: string;
  doc: string;
  receiver?: string;
  parameters: GoParameter[];
  returns: GoReturn[];
  deprecated?: boolean;
  since?: string;
}

export interface GoType {
  name: string;
  kind: 'struct' | 'interface' | 'alias' | 'chan' | 'map' | 'slice' | 'func';
  doc: string;
  definition: string;
  methods?: GoFunction[];
  fields?: GoField[];
  deprecated?: boolean;
  since?: string;
}

export interface GoConstant {
  name: string;
  type: string;
  value: string;
  doc: string;
  deprecated?: boolean;
  since?: string;
}

export interface GoVariable {
  name: string;
  type: string;
  doc: string;
  deprecated?: boolean;
  since?: string;
}

export interface GoParameter {
  name: string;
  type: string;
  variadic?: boolean;
}

export interface GoReturn {
  name?: string;
  type: string;
}

export interface GoField {
  name: string;
  type: string;
  tag?: string;
  doc: string;
  embedded?: boolean;
}

export class GoSurfaceExtractor {
  constructor(
    private repoPath: string,
    private options: {
      includeInternal?: boolean;
      outputPath?: string;
      module?: string; // Specific module to analyze
    } = {}
  ) {}

  /**
   * Extract API surface from Go project
   */
  async extract(): Promise<GoApiSurface> {
    const startTime = new Date().toISOString();
    
    // Step 1: Find Go module
    const modulePath = await this.findGoModule();
    if (!modulePath) {
      throw new Error('No go.mod found - cannot extract Go API surface');
    }

    // Step 2: Get Go version and validate environment
    const goVersion = await this.getGoVersion();
    
    // Step 3: Discover packages
    const packages = await this.discoverPackages(modulePath);
    if (packages.length === 0) {
      throw new Error('No Go packages found to analyze');
    }

    // Step 4: Extract API surface for each package
    const apiPackages = await Promise.all(
      packages.map(pkg => this.extractPackageApi(pkg))
    );

    // Step 5: Collect dependencies
    const dependencies = await this.extractDependencies();

    // Step 6: Build complete surface
    const surface: GoApiSurface = {
      version: await this.getModuleVersion(),
      extractedAt: startTime,
      extractor: 'go-surface',
      modulePath,
      sourceFiles: await this.getSourceFiles(),
      packages: apiPackages.filter(pkg => pkg !== null) as GoPackage[],
      dependencies,
      metadata: {
        totalExports: this.countTotalExports(apiPackages.filter(pkg => pkg !== null) as GoPackage[]),
        complexityScore: this.calculateComplexityScore(apiPackages.filter(pkg => pkg !== null) as GoPackage[]),
        goVersion,
      },
    };

    // Step 7: Save to file if requested
    if (this.options.outputPath) {
      await fs.writeFile(
        this.options.outputPath,
        JSON.stringify(surface, null, 2)
      );
    }

    return surface;
  }

  private async findGoModule(): Promise<string | null> {
    try {
      const goModPath = path.join(this.repoPath, 'go.mod');
      await fs.access(goModPath);
      
      const content = await fs.readFile(goModPath, 'utf-8');
      const moduleMatch = content.match(/^module\s+(.+)$/m);
      
      return moduleMatch ? moduleMatch[1].trim() : null;
    } catch {
      return null;
    }
  }

  private async getGoVersion(): Promise<string> {
    try {
      const result = await this.runCommand('go', ['version']);
      const match = result.stdout.match(/go version go([\d.]+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async discoverPackages(modulePath: string): Promise<string[]> {
    try {
      // Use go list to find all packages in the module
      const result = await this.runCommand('go', ['list', './...'], { cwd: this.repoPath });
      const packages = result.stdout
        .split('\n')
        .filter(line => line.trim().length > 0)
        .filter(pkg => !pkg.includes('/internal/') || this.options.includeInternal);
      
      return packages;
    } catch (error) {
      console.warn(`Warning: Failed to discover packages: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback: manually discover directories with .go files
      const goFiles = await glob('**/*.go', {
        cwd: this.repoPath,
        ignore: ['**/vendor/**', '**/testdata/**'],
      });

      const packageDirs = new Set<string>();
      for (const goFile of goFiles) {
        const dir = path.dirname(goFile);
        if (dir === '.' || (!dir.includes('internal') || this.options.includeInternal)) {
          packageDirs.add(path.join(modulePath, dir === '.' ? '' : dir));
        }
      }

      return Array.from(packageDirs);
    }
  }

  private async extractPackageApi(packagePath: string): Promise<GoPackage | null> {
    try {
      // Get package documentation
      const docResult = await this.runCommand('go', ['doc', '-all', packagePath], { cwd: this.repoPath });
      const docOutput = docResult.stdout;

      // Parse the package documentation
      const packageName = this.extractPackageName(packagePath);
      const packageDoc = this.extractPackageDoc(docOutput);

      const exports = {
        functions: this.extractFunctions(docOutput),
        types: this.extractTypes(docOutput),
        constants: this.extractConstants(docOutput),
        variables: this.extractVariables(docOutput),
      };

      return {
        name: packageName,
        path: packagePath,
        doc: packageDoc,
        exports,
      };
    } catch (error) {
      console.warn(`Warning: Failed to extract API for package ${packagePath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private extractPackageName(packagePath: string): string {
    const parts = packagePath.split('/');
    return parts[parts.length - 1] || 'main';
  }

  private extractPackageDoc(docOutput: string): string {
    const lines = docOutput.split('\n');
    const packageLineIndex = lines.findIndex(line => line.startsWith('package '));
    
    if (packageLineIndex === -1) return '';
    
    // Extract documentation lines between package declaration and first export
    const docLines: string[] = [];
    for (let i = packageLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' || line.startsWith('    ')) {
        docLines.push(line);
      } else if (line.match(/^(func|type|const|var)\s/)) {
        break;
      } else {
        docLines.push(line);
      }
    }
    
    return docLines.join('\n').trim();
  }

  private extractFunctions(docOutput: string): GoFunction[] {
    const functions: GoFunction[] = [];
    const lines = docOutput.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('func ')) {
        const func = this.parseFunctionSignature(line);
        if (func) {
          // Extract documentation
          func.doc = this.extractDocBefore(lines, i);
          functions.push(func);
        }
      }
    }
    
    return functions;
  }

  private extractTypes(docOutput: string): GoType[] {
    const types: GoType[] = [];
    const lines = docOutput.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('type ')) {
        const type = this.parseTypeDefinition(lines, i);
        if (type.type) {
          types.push(type.type);
          i = type.nextIndex;
        }
      }
    }
    
    return types;
  }

  private extractConstants(docOutput: string): GoConstant[] {
    const constants: GoConstant[] = [];
    const lines = docOutput.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('const ')) {
        const constant = this.parseConstantDeclaration(line);
        if (constant) {
          constant.doc = this.extractDocBefore(lines, i);
          constants.push(constant);
        }
      }
    }
    
    return constants;
  }

  private extractVariables(docOutput: string): GoVariable[] {
    const variables: GoVariable[] = [];
    const lines = docOutput.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('var ')) {
        const variable = this.parseVariableDeclaration(line);
        if (variable) {
          variable.doc = this.extractDocBefore(lines, i);
          variables.push(variable);
        }
      }
    }
    
    return variables;
  }

  private parseFunctionSignature(line: string): GoFunction | null {
    // Parse: func [receiver] FunctionName(params) (returns)
    const funcMatch = line.match(/^func\s*(?:\(([^)]+)\))?\s*(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]+)\)|(\w+[^{]*?))?/);
    if (!funcMatch) return null;

    const [, receiver, name, paramsStr, multiReturns, singleReturn] = funcMatch;

    const parameters = this.parseParameters(paramsStr || '');
    const returns = this.parseReturns(multiReturns || singleReturn || '');

    return {
      name,
      signature: line,
      doc: '',
      receiver: receiver ? receiver.trim() : undefined,
      parameters,
      returns,
    };
  }

  private parseTypeDefinition(lines: string[], startIndex: number): { type: GoType | null; nextIndex: number } {
    const line = lines[startIndex];
    const typeMatch = line.match(/^type\s+(\w+)\s+(struct|interface|chan|map|\w+|\[)/);
    
    if (!typeMatch) return { type: null, nextIndex: startIndex };

    const [, name, kindOrDef] = typeMatch;
    let kind: GoType['kind'] = 'alias';
    
    if (kindOrDef === 'struct') kind = 'struct';
    else if (kindOrDef === 'interface') kind = 'interface';
    else if (kindOrDef === 'chan') kind = 'chan';
    else if (kindOrDef === 'map' || line.includes('map[')) kind = 'map';
    else if (line.includes('[]')) kind = 'slice';
    else if (line.includes('func(')) kind = 'func';

    const type: GoType = {
      name,
      kind,
      doc: this.extractDocBefore(lines, startIndex),
      definition: line,
      methods: [],
      fields: [],
    };

    // For struct and interface types, parse members
    let nextIndex = startIndex + 1;
    if (kind === 'struct' || kind === 'interface') {
      const parseResult = this.parseTypeMembers(lines, startIndex, kind);
      type.fields = parseResult.fields;
      type.methods = parseResult.methods;
      nextIndex = parseResult.nextIndex;
    }

    return { type, nextIndex };
  }

  private parseTypeMembers(lines: string[], startIndex: number, kind: 'struct' | 'interface'): {
    fields: GoField[];
    methods: GoFunction[];
    nextIndex: number;
  } {
    const fields: GoField[] = [];
    const methods: GoFunction[] = [];
    
    let i = startIndex + 1;
    let braceLevel = 0;
    let foundOpenBrace = false;

    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line.includes('{')) {
        braceLevel++;
        foundOpenBrace = true;
      }
      if (line.includes('}')) {
        braceLevel--;
        if (braceLevel === 0 && foundOpenBrace) break;
      }

      if (foundOpenBrace && braceLevel > 0 && line.length > 0 && !line.startsWith('//')) {
        if (kind === 'struct') {
          const field = this.parseStructField(line);
          if (field) fields.push(field);
        } else if (kind === 'interface') {
          const method = this.parseInterfaceMethod(line);
          if (method) methods.push(method);
        }
      }

      i++;
    }

    return { fields, methods, nextIndex: i };
  }

  private parseStructField(line: string): GoField | null {
    // Parse: FieldName Type `tag` or Type (embedded)
    const fieldMatch = line.match(/^\s*(\w+)?\s*([^`\s]+)(?:\s*`([^`]*)`)?/);
    if (!fieldMatch) return null;

    const [, name, type, tag] = fieldMatch;

    return {
      name: name || type, // If no name, it's an embedded field
      type: name ? type : type,
      tag: tag,
      doc: '',
      embedded: !name,
    };
  }

  private parseInterfaceMethod(line: string): GoFunction | null {
    // Parse interface method signature
    const methodMatch = line.match(/^\s*(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]+)\)|(\w+[^{]*?))?/);
    if (!methodMatch) return null;

    const [, name, paramsStr, multiReturns, singleReturn] = methodMatch;

    return {
      name,
      signature: line.trim(),
      doc: '',
      parameters: this.parseParameters(paramsStr || ''),
      returns: this.parseReturns(multiReturns || singleReturn || ''),
    };
  }

  private parseConstantDeclaration(line: string): GoConstant | null {
    const constMatch = line.match(/^const\s+(\w+)(?:\s+([^=\s]+))?\s*=\s*(.+)$/);
    if (!constMatch) return null;

    const [, name, type, value] = constMatch;

    return {
      name,
      type: type || 'untyped',
      value: value.trim(),
      doc: '',
    };
  }

  private parseVariableDeclaration(line: string): GoVariable | null {
    const varMatch = line.match(/^var\s+(\w+)\s+(.+)$/);
    if (!varMatch) return null;

    const [, name, type] = varMatch;

    return {
      name,
      type: type.trim(),
      doc: '',
    };
  }

  private parseParameters(paramsStr: string): GoParameter[] {
    if (!paramsStr.trim()) return [];

    // Split by comma, but be careful of complex types
    const params = this.splitParameters(paramsStr);
    
    return params.map(param => {
      const trimmed = param.trim();
      
      // Handle variadic parameters
      if (trimmed.startsWith('...')) {
        const parts = trimmed.substring(3).split(/\s+/);
        return {
          name: parts.length > 1 ? parts[0] : '',
          type: parts.length > 1 ? parts.slice(1).join(' ') : parts[0],
          variadic: true,
        };
      }

      // Regular parameter: name type
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        return {
          name: parts[0],
          type: parts.slice(1).join(' '),
        };
      }
      
      // Just type, no name
      return {
        name: '',
        type: trimmed,
      };
    });
  }

  private parseReturns(returnsStr: string): GoReturn[] {
    if (!returnsStr.trim()) return [];

    const returns = this.splitParameters(returnsStr);
    
    return returns.map(ret => {
      const trimmed = ret.trim();
      const parts = trimmed.split(/\s+/);
      
      if (parts.length >= 2) {
        return {
          name: parts[0],
          type: parts.slice(1).join(' '),
        };
      }
      
      return {
        type: trimmed,
      };
    });
  }

  private splitParameters(paramStr: string): string[] {
    // Simple parameter splitting - doesn't handle complex nested types perfectly
    const params: string[] = [];
    let current = '';
    let parenLevel = 0;
    let bracketLevel = 0;
    
    for (let i = 0; i < paramStr.length; i++) {
      const char = paramStr[i];
      
      if (char === '(') parenLevel++;
      else if (char === ')') parenLevel--;
      else if (char === '[') bracketLevel++;
      else if (char === ']') bracketLevel--;
      else if (char === ',' && parenLevel === 0 && bracketLevel === 0) {
        params.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      params.push(current.trim());
    }
    
    return params;
  }

  private extractDocBefore(lines: string[], index: number): string {
    const docLines: string[] = [];
    
    // Look backwards for comment lines
    for (let i = index - 1; i >= 0; i--) {
      const line = lines[i];
      
      if (line.trim().startsWith('//')) {
        docLines.unshift(line.trim().substring(2).trim());
      } else if (line.trim() === '') {
        continue;
      } else {
        break;
      }
    }
    
    return docLines.join('\n');
  }

  private async extractDependencies(): Promise<{ external: string[]; internal: string[] }> {
    try {
      // Get module dependencies using go list -m
      const result = await this.runCommand('go', ['list', '-m', 'all'], { cwd: this.repoPath });
      const lines = result.stdout.split('\n');
      
      const external: string[] = [];
      const internal: string[] = [];
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const moduleName = parts[0];
          
          // Skip the main module (first line)
          if (lines.indexOf(line) === 0) continue;
          
          // Classify as external or internal
          if (moduleName.includes('/internal/') || moduleName.startsWith('.')) {
            internal.push(moduleName);
          } else {
            external.push(moduleName);
          }
        }
      }
      
      return {
        external: Array.from(new Set(external)).sort(),
        internal: Array.from(new Set(internal)).sort(),
      };
    } catch {
      return { external: [], internal: [] };
    }
  }

  private async getModuleVersion(): Promise<string> {
    try {
      // Try to get version from git tags
      const result = await this.runCommand('git', ['describe', '--tags', '--abbrev=0'], { cwd: this.repoPath });
      return result.stdout.trim();
    } catch {
      try {
        // Fallback to go.mod version if it's a versioned module
        const goModContent = await fs.readFile(path.join(this.repoPath, 'go.mod'), 'utf-8');
        const versionMatch = goModContent.match(/\/v(\d+)$/m);
        return versionMatch ? `v${versionMatch[1]}.0.0` : 'v0.0.0';
      } catch {
        return 'v0.0.0';
      }
    }
  }

  private async getSourceFiles(): Promise<string[]> {
    try {
      const goFiles = await glob('**/*.go', {
        cwd: this.repoPath,
        ignore: ['**/vendor/**', '**/testdata/**'],
      });
      return goFiles.sort();
    } catch {
      return [];
    }
  }

  private countTotalExports(packages: GoPackage[]): number {
    return packages.reduce((total, pkg) => {
      return total + 
             pkg.exports.functions.length +
             pkg.exports.types.length +
             pkg.exports.constants.length +
             pkg.exports.variables.length;
    }, 0);
  }

  private calculateComplexityScore(packages: GoPackage[]): number {
    let score = 0;
    
    packages.forEach(pkg => {
      // Functions contribute to complexity
      score += pkg.exports.functions.length * 2;
      
      // Types are more complex
      pkg.exports.types.forEach(type => {
        score += 3; // Base type complexity
        score += (type.methods?.length || 0) * 2;
        score += (type.fields?.length || 0);
      });
      
      // Constants and variables
      score += pkg.exports.constants.length;
      score += pkg.exports.variables.length;
    });
    
    return score;
  }

  private async runCommand(
    command: string,
    args: string[],
    options: { cwd?: string } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      const child = spawn(command, args, {
        cwd: options.cwd || this.repoPath,
        stdio: 'pipe',
      });

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        } else {
          reject(new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }
}

/**
 * Convenience function to extract Go API surface
 */
export async function extractGoApiSurface(
  repoPath: string,
  options?: {
    includeInternal?: boolean;
    outputPath?: string;
    module?: string;
  }
): Promise<GoApiSurface> {
  const extractor = new GoSurfaceExtractor(repoPath, options);
  return extractor.extract();
}