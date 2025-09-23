/**
 * Python Plugin for Brownfield Detection
 *
 * Comprehensive plugin for detecting Python artifacts including web services,
 * CLI tools, data processing scripts, and libraries. Analyzes setup.py, pyproject.toml,
 * requirements.txt, and source files to infer application architecture.
 */

import * as path from 'path';
import {
  type DetectionContext,
  type SourceAnalysis,
  detectArtifactType,
} from '../detection/artifact-detector.js';
import {
  BinaryArtifact,
  ConfidenceScore,
  Evidence,
  FrontendArtifact,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ModuleArtifact,
  ParseContext,
  Provenance,
  ServiceArtifact,
} from '../types.js';

// ============================================================================
// Python Configuration Data Types
// ============================================================================

interface PythonPackageData extends Record<string, unknown> {
  configType: string;
  name: string;
  version?: string;
  description?: string;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  entryPoints?: Record<string, string>;
  author?: string;
  license?: string;
  keywords?: string[];
  homepage?: string;
  repository?: string;
}

interface PythonSourceData extends Record<string, unknown> {
  configType: string;
  filePath: string;
  hasImports: boolean;
  hasIfMain: boolean;
  isPackageInit: boolean;
  imports: string[];
  webFrameworks: string[];
  cliPatterns: string[];
  dataProcessingPatterns: string[];
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class PythonPlugin implements ImporterPlugin {
  name(): string {
    return 'python';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath);

    // Support Python configuration files
    if (
      [
        'setup.py',
        'pyproject.toml',
        'requirements.txt',
        'Pipfile',
        'poetry.lock',
        'setup.cfg',
        'environment.yml',
        'conda.yml',
      ].includes(fileName)
    ) {
      return true;
    }

    // Support Python source files
    if (['.py', '.pyx', '.pyi'].includes(extension)) {
      return true;
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const fileName = path.basename(filePath);
    const baseId = path.relative(context?.projectRoot || '', filePath);

    try {
      if (fileName === 'setup.py') {
        evidence.push(...(await this.parseSetupPy(filePath, fileContent, baseId)));
      } else if (fileName === 'pyproject.toml') {
        evidence.push(...(await this.parsePyprojectToml(filePath, fileContent, baseId)));
      } else if (fileName === 'requirements.txt') {
        evidence.push(...(await this.parseRequirementsTxt(filePath, fileContent, baseId)));
      } else if (fileName === 'Pipfile') {
        evidence.push(...(await this.parsePipfile(filePath, fileContent, baseId)));
      } else if (path.extname(filePath) === '.py') {
        evidence.push(...(await this.parsePythonSource(filePath, fileContent, baseId)));
      }
    } catch (error) {
      console.warn(`Python plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const pythonEvidence = evidence.filter(e => e.source === 'python');
    if (pythonEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer from package configuration evidence
      const packageEvidence = pythonEvidence.filter(
        e =>
          e.type === 'config' &&
          typeof e.data.configType === 'string' &&
          e.data.configType.includes('package')
      );

      for (const pkg of packageEvidence) {
        artifacts.push(...(await this.inferFromPackageConfig(pkg, pythonEvidence, context)));
      }

      // If no package config found, try to infer from source files
      if (packageEvidence.length === 0) {
        artifacts.push(...(await this.inferFromSourceOnly(pythonEvidence, context)));
      }
    } catch (error) {
      console.warn('Python plugin inference failed:', error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parseSetupPy(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // Extract setup() call parameters using regex (simplified)
      const setupMatch = content.match(/setup\s*\(\s*([\s\S]*?)\s*\)/);
      if (!setupMatch) return evidence;

      const setupContent = setupMatch[1];

      // Extract basic metadata
      const name =
        this.extractPythonStringField(setupContent, 'name') ||
        path.basename(path.dirname(filePath));
      const version = this.extractPythonStringField(setupContent, 'version');
      const description = this.extractPythonStringField(setupContent, 'description');

      // Extract dependencies
      const installRequires = this.extractPythonListField(setupContent, 'install_requires');
      const extraRequires = this.extractPythonDictField(setupContent, 'extras_require');

      // Extract entry points
      const entryPoints = this.extractPythonDictField(setupContent, 'entry_points');
      const scripts = this.extractPythonListField(setupContent, 'scripts');

      const packageData: PythonPackageData = {
        configType: 'setup-py',
        name,
        version,
        description,
        dependencies: installRequires,
        devDependencies: Object.values(extraRequires).flat(),
        scripts: this.convertToScripts(entryPoints as any, scripts),
        entryPoints: entryPoints as any,
        author: this.extractPythonStringField(setupContent, 'author'),
        license: this.extractPythonStringField(setupContent, 'license'),
        homepage: this.extractPythonStringField(setupContent, 'url'),
      };

      evidence.push({
        id: baseId,
        source: 'python',
        type: 'config',
        filePath,
        data: packageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn('Failed to parse setup.py:', error);
    }

    return evidence;
  }

  private async parsePyprojectToml(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // Simple TOML parsing for common fields
      const projectMatch = content.match(/\[project\]([\s\S]*?)(?=\n\[|\n$)/);
      const poetryMatch = content.match(/\[tool\.poetry\]([\s\S]*?)(?=\n\[|\n$)/);

      let projectSection = projectMatch?.[1] || '';
      let poetrySection = poetryMatch?.[1] || '';

      // Extract from [project] section (PEP 621)
      const name =
        this.extractTomlField(projectSection, 'name') ||
        this.extractTomlField(poetrySection, 'name') ||
        path.basename(path.dirname(filePath));
      const version =
        this.extractTomlField(projectSection, 'version') ||
        this.extractTomlField(poetrySection, 'version');
      const description =
        this.extractTomlField(projectSection, 'description') ||
        this.extractTomlField(poetrySection, 'description');

      // Extract dependencies
      const dependencies =
        this.extractTomlArray(projectSection, 'dependencies') ||
        this.extractTomlDependencies(poetrySection);
      const devDependencies = this.extractTomlDevDependencies(content);

      // Extract scripts
      const scripts =
        this.extractTomlTable(projectSection, 'scripts') ||
        this.extractTomlTable(poetrySection, 'scripts') ||
        {};

      const packageData: PythonPackageData = {
        configType: 'pyproject-toml',
        name,
        version,
        description,
        dependencies,
        devDependencies,
        scripts,
        author:
          this.extractTomlField(projectSection, 'authors') ||
          this.extractTomlField(poetrySection, 'authors'),
        license:
          this.extractTomlField(projectSection, 'license') ||
          this.extractTomlField(poetrySection, 'license'),
        homepage:
          this.extractTomlField(projectSection, 'homepage') ||
          this.extractTomlField(poetrySection, 'homepage'),
      };

      evidence.push({
        id: baseId,
        source: 'python',
        type: 'config',
        filePath,
        data: packageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn('Failed to parse pyproject.toml:', error);
    }

    return evidence;
  }

  private async parseRequirementsTxt(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const dependencies = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('-'))
        .map(line => line.split(/[>=<~!]/)[0].trim());

      evidence.push({
        id: baseId,
        source: 'python',
        type: 'dependency',
        filePath,
        data: {
          configType: 'requirements-txt',
          dependencies,
          devDependencies: [],
        },
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn('Failed to parse requirements.txt:', error);
    }

    return evidence;
  }

  private async parsePipfile(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // Extract dependencies from [packages] and [dev-packages] sections
      const packagesMatch = content.match(/\[packages\]([\s\S]*?)(?=\n\[|\n$)/);
      const devPackagesMatch = content.match(/\[dev-packages\]([\s\S]*?)(?=\n\[|\n$)/);

      const dependencies = this.extractTomlDependencies(packagesMatch?.[1] || '');
      const devDependencies = this.extractTomlDependencies(devPackagesMatch?.[1] || '');

      evidence.push({
        id: baseId,
        source: 'python',
        type: 'dependency',
        filePath,
        data: {
          configType: 'pipfile',
          dependencies,
          devDependencies,
        },
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn('Failed to parse Pipfile:', error);
    }

    return evidence;
  }

  private async parsePythonSource(
    filePath: string,
    content: string,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      // Detect imports
      const imports = this.extractImports(content);
      const hasImports = imports.length > 0;

      // Check for if __name__ == "__main__":
      const hasIfMain = /if\s+__name__\s*==\s*['""]__main__['""]/.test(content);

      // Check if this is a package __init__.py
      const isPackageInit = path.basename(filePath) === '__init__.py';

      // Detect web framework usage
      const webFrameworks = this.detectWebFrameworks(content, imports);

      // Detect CLI patterns
      const cliPatterns = this.detectCliPatterns(content, imports);

      // Detect data processing patterns
      const dataProcessingPatterns = this.detectDataProcessingPatterns(content, imports);

      const sourceData: PythonSourceData = {
        configType: 'source-file',
        filePath,
        hasImports,
        hasIfMain,
        isPackageInit,
        imports,
        webFrameworks,
        cliPatterns,
        dataProcessingPatterns,
      };

      evidence.push({
        id: baseId,
        source: 'python',
        type: hasIfMain ? 'function' : hasImports ? 'import' : 'export',
        filePath,
        data: sourceData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn('Failed to parse Python source:', error);
    }

    return evidence;
  }

  // ============================================================================
  // Private inference methods
  // ============================================================================

  private async inferFromPackageConfig(
    packageEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    const packageData = packageEvidence.data as unknown as PythonPackageData;

    // Create detection context
    const detectionContext: DetectionContext = {
      language: 'python',
      dependencies: [...packageData.dependencies, ...packageData.devDependencies],
      scripts: packageData.scripts,
      filePatterns: this.extractFilePatterns(allEvidence),
      packageConfig: packageData,
      sourceAnalysis: this.createSourceAnalysis(allEvidence),
    };

    // Use the detection engine
    const result = detectArtifactType(detectionContext);

    // Create artifacts based on detected type
    return this.createArtifactFromDetection(result, packageData, allEvidence);
  }

  private async inferFromSourceOnly(
    allEvidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    // When no package config, infer from source files only
    const sourceEvidence = allEvidence.filter(e => e.data?.configType === 'source-file');

    if (sourceEvidence.length === 0) return [];

    // Aggregate all dependencies from source analysis
    const allImports = sourceEvidence.flatMap(
      e => (e.data as unknown as PythonSourceData).imports || []
    );

    const detectionContext: DetectionContext = {
      language: 'python',
      dependencies: allImports,
      scripts: {},
      filePatterns: this.extractFilePatterns(allEvidence),
      packageConfig: {},
      sourceAnalysis: this.createSourceAnalysis(allEvidence),
    };

    const result = detectArtifactType(detectionContext);

    // Create a generic artifact
    const projectName = path.basename(context.projectRoot);
    return this.createArtifactFromDetection(
      result,
      {
        configType: 'inferred',
        name: projectName,
        dependencies: allImports,
        devDependencies: [],
        scripts: {},
      } as PythonPackageData,
      allEvidence
    );
  }

  private createArtifactFromDetection(
    result: any,
    packageData: PythonPackageData,
    allEvidence: Evidence[]
  ): InferredArtifact[] {
    const artifactType = this.mapCategoryToArtifactType(result.primaryType);

    switch (artifactType) {
      case 'binary':
        return this.createBinaryArtifact(packageData, allEvidence);
      case 'service':
        return this.createServiceArtifact(packageData, allEvidence);
      case 'frontend':
        return this.createFrontendArtifact(packageData, allEvidence);
      default:
        return this.createModuleArtifact(packageData, allEvidence);
    }
  }

  private mapCategoryToArtifactType(category: string): string {
    const categoryMap: Record<string, string> = {
      cli: 'binary',
      web_service: 'service',
      frontend: 'module',
      library: 'module',
      desktop_app: 'binary',
      data_processing: 'module',
      testing: 'test',
      build_tool: 'module',
      game: 'module',
      mobile: 'module',
    };

    return categoryMap[category] || 'module';
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // import module
      const importMatch = trimmed.match(
        /^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/
      );
      if (importMatch) {
        imports.push(importMatch[1].split('.')[0]);
        continue;
      }

      // from module import ...
      const fromMatch = trimmed.match(
        /^from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/
      );
      if (fromMatch) {
        imports.push(fromMatch[1].split('.')[0]);
      }
    }

    return [...new Set(imports)];
  }

  private detectWebFrameworks(content: string, imports: string[]): string[] {
    const webFrameworks = [
      'django',
      'flask',
      'fastapi',
      'tornado',
      'sanic',
      'starlette',
      'bottle',
      'falcon',
      'pyramid',
    ];
    return imports.filter(imp => webFrameworks.includes(imp));
  }

  private detectCliPatterns(content: string, imports: string[]): string[] {
    const cliLibraries = ['click', 'argparse', 'typer', 'fire', 'docopt'];
    const patterns: string[] = [];

    // Check for CLI library imports
    patterns.push(...imports.filter(imp => cliLibraries.includes(imp)));

    // Check for CLI patterns in code
    if (/if\s+__name__\s*==\s*['""]__main__['""]/.test(content)) {
      patterns.push('main_guard');
    }

    if (/sys\.argv/.test(content)) {
      patterns.push('argv_usage');
    }

    return patterns;
  }

  private detectDataProcessingPatterns(content: string, imports: string[]): string[] {
    const dataLibraries = [
      'pandas',
      'numpy',
      'scipy',
      'matplotlib',
      'seaborn',
      'plotly',
      'dask',
      'polars',
    ];
    return imports.filter(imp => dataLibraries.includes(imp));
  }

  private createSourceAnalysis(allEvidence: Evidence[]): SourceAnalysis {
    const sourceEvidence = allEvidence.filter(e => e.data?.configType === 'source-file');

    let hasBinaryExecution = false;
    let hasServerPatterns = false;
    let hasFrontendPatterns = false;
    let hasCliPatterns = false;
    let hasDataProcessingPatterns = false;
    let hasTestPatterns = false;
    let hasBuildPatterns = false;
    let hasGamePatterns = false;
    let hasMobilePatterns = false;
    let hasDesktopPatterns = false;

    sourceEvidence.forEach(evidence => {
      const sourceData = evidence.data as unknown as PythonSourceData;

      // Check for CLI patterns
      if (sourceData.hasIfMain || sourceData.cliPatterns?.length > 0) {
        hasCliPatterns = true;
        hasBinaryExecution = true;
      }

      // Check for web frameworks
      if (sourceData.webFrameworks?.length > 0) {
        hasServerPatterns = true;
      }

      // Check for data processing
      if (sourceData.dataProcessingPatterns?.length > 0) {
        hasDataProcessingPatterns = true;
      }

      // Check for test patterns
      if (evidence.filePath?.includes('test') || sourceData.imports?.includes('pytest')) {
        hasTestPatterns = true;
      }

      // Check for frontend patterns (Streamlit, Dash, etc.)
      if (sourceData.imports?.some(imp => ['streamlit', 'dash', 'gradio', 'panel'].includes(imp))) {
        hasFrontendPatterns = true;
      }

      // Check for desktop patterns
      if (
        sourceData.imports?.some(imp => ['tkinter', 'pyqt5', 'pyqt6', 'kivy', 'toga'].includes(imp))
      ) {
        hasDesktopPatterns = true;
      }

      // Check for game patterns
      if (sourceData.imports?.some(imp => ['pygame', 'arcade', 'panda3d'].includes(imp))) {
        hasGamePatterns = true;
      }

      // Check for mobile patterns
      if (sourceData.imports?.some(imp => ['kivy', 'beeware', 'toga'].includes(imp))) {
        hasMobilePatterns = true;
      }
    });

    return {
      hasBinaryExecution,
      hasServerPatterns,
      hasFrontendPatterns,
      hasCliPatterns,
      hasDataProcessingPatterns,
      hasTestPatterns,
      hasBuildPatterns,
      hasGamePatterns,
      hasMobilePatterns,
      hasDesktopPatterns,
    };
  }

  private extractFilePatterns(allEvidence: Evidence[]): string[] {
    const patterns: string[] = [];

    allEvidence.forEach(evidence => {
      if (evidence.filePath) {
        patterns.push(evidence.filePath);
      }
      if (evidence.data?.filePath) {
        patterns.push(evidence.data.filePath as string);
      }
    });

    return patterns;
  }

  // Artifact creation methods (simplified for brevity)
  private createBinaryArtifact(
    packageData: PythonPackageData,
    allEvidence: Evidence[]
  ): InferredArtifact[] {
    const binaryArtifact: BinaryArtifact = {
      id: `python-binary-${packageData.name}`,
      type: 'binary',
      name: packageData.name,
      description: packageData.description || `Python CLI tool: ${packageData.name}`,
      tags: ['python', 'cli', 'binary'],
      metadata: {
        language: 'python',
        buildSystem: 'pip',
        entryPoint: 'main.py',
        arguments: [],
        environmentVariables: [],
        dependencies: packageData.dependencies,
      },
    };

    return [
      {
        artifact: binaryArtifact,
        confidence: this.calculateConfidence(allEvidence, 0.9),
        provenance: this.createProvenance(allEvidence),
        relationships: [],
      },
    ];
  }

  private createServiceArtifact(
    packageData: PythonPackageData,
    allEvidence: Evidence[]
  ): InferredArtifact[] {
    const serviceArtifact: ServiceArtifact = {
      id: `python-service-${packageData.name}`,
      type: 'service',
      name: packageData.name,
      description: packageData.description || `Python web service: ${packageData.name}`,
      tags: ['python', 'service', 'web'],
      metadata: {
        language: 'python',
        framework: this.detectPrimaryWebFramework(allEvidence),
        port: 8000,
        basePath: '/',
        environmentVariables: [],
        dependencies: [],
        endpoints: [],
        healthCheck: {
          path: '/health',
          expectedStatusCode: 200,
          timeoutMs: 5000,
          intervalSeconds: 30,
        },
      },
    };

    return [
      {
        artifact: serviceArtifact,
        confidence: this.calculateConfidence(allEvidence, 0.9),
        provenance: this.createProvenance(allEvidence),
        relationships: [],
      },
    ];
  }

  private createFrontendArtifact(
    packageData: PythonPackageData,
    allEvidence: Evidence[]
  ): InferredArtifact[] {
    const frontendArtifact: FrontendArtifact = {
      id: `python-frontend-${packageData.name}`,
      type: 'frontend',
      name: packageData.name,
      description: packageData.description || `Python frontend app: ${packageData.name}`,
      tags: ['python', 'frontend', 'webapp'],
      metadata: {
        framework: this.detectPrimaryFrontendFramework(allEvidence) || 'unknown',
        buildSystem: 'python',
        routes: [],
        apiDependencies: [],
        environmentVariables: [],
      },
    };

    return [
      {
        artifact: frontendArtifact,
        confidence: this.calculateConfidence(allEvidence, 0.8),
        provenance: this.createProvenance(allEvidence),
        relationships: [],
      },
    ];
  }

  private createModuleArtifact(
    packageData: PythonPackageData,
    allEvidence: Evidence[]
  ): InferredArtifact[] {
    const moduleArtifact: ModuleArtifact = {
      id: `python-module-${packageData.name}`,
      type: 'module',
      name: packageData.name,
      description: packageData.description || `Python module: ${packageData.name}`,
      tags: ['python', 'module'],
      metadata: {
        language: 'python',
        packageManager: 'pip',
        publicApi: [],
        dependencies: packageData.dependencies,
        version: packageData.version,
      },
    };

    return [
      {
        artifact: moduleArtifact,
        confidence: this.calculateConfidence(allEvidence, 0.8),
        provenance: this.createProvenance(allEvidence),
        relationships: [],
      },
    ];
  }

  // Utility methods for parsing Python/TOML content
  private extractPythonStringField(content: string, field: string): string | undefined {
    const regex = new RegExp(`${field}\\s*=\\s*['"](.*?)['"]`);
    const match = content.match(regex);
    return match?.[1];
  }

  private extractPythonListField(content: string, field: string): string[] {
    const regex = new RegExp(`${field}\\s*=\\s*\\[(.*?)\\]`, 's');
    const match = content.match(regex);
    if (!match) return [];

    return match[1]
      .split(',')
      .map(item => item.trim().replace(/['"]/g, ''))
      .filter(item => item.length > 0);
  }

  private extractPythonDictField(content: string, field: string): Record<string, string[]> {
    // Simplified dict parsing - would need more robust implementation
    return {};
  }

  private extractTomlField(content: string, field: string): string | undefined {
    const regex = new RegExp(`${field}\\s*=\\s*['"](.*?)['"]`);
    const match = content.match(regex);
    return match?.[1];
  }

  private extractTomlArray(content: string, field: string): string[] {
    const regex = new RegExp(`${field}\\s*=\\s*\\[(.*?)\\]`, 's');
    const match = content.match(regex);
    if (!match) return [];

    return match[1]
      .split(',')
      .map(item => item.trim().replace(/['"]/g, ''))
      .filter(item => item.length > 0);
  }

  private extractTomlTable(content: string, field: string): Record<string, string> {
    // Simplified table parsing
    return {};
  }

  private extractTomlDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const depName = trimmed.substring(0, eqIndex).trim();
          if (depName && /^[a-zA-Z_-]+$/.test(depName)) {
            dependencies.push(depName);
          }
        }
      }
    }

    return dependencies;
  }

  private extractTomlDevDependencies(content: string): string[] {
    const devMatch = content.match(
      /\[tool\.poetry\.group\.dev\.dependencies\]([\s\S]*?)(?=\n\[|\n$)/
    );
    if (devMatch) {
      return this.extractTomlDependencies(devMatch[1]);
    }
    return [];
  }

  private convertToScripts(
    entryPoints: Record<string, any>,
    scripts: string[]
  ): Record<string, string> {
    const result: Record<string, string> = {};

    // Convert entry points
    if (entryPoints?.console_scripts) {
      Object.entries(entryPoints.console_scripts).forEach(([name, target]) => {
        result[name] = target as string;
      });
    }

    // Convert scripts array
    scripts.forEach(script => {
      const name = path.basename(script, path.extname(script));
      result[name] = script;
    });

    return result;
  }

  private detectPrimaryWebFramework(allEvidence: Evidence[]): string | undefined {
    const sourceEvidence = allEvidence.filter(e => e.data?.configType === 'source-file');

    for (const evidence of sourceEvidence) {
      const sourceData = evidence.data as unknown as PythonSourceData;
      if (sourceData.webFrameworks?.length > 0) {
        return sourceData.webFrameworks[0];
      }
    }

    return undefined;
  }

  private detectPrimaryFrontendFramework(allEvidence: Evidence[]): string | undefined {
    const sourceEvidence = allEvidence.filter(e => e.data?.configType === 'source-file');

    for (const evidence of sourceEvidence) {
      const sourceData = evidence.data as unknown as PythonSourceData;
      const frontendFrameworks = ['streamlit', 'dash', 'gradio', 'panel'];
      const detected = sourceData.imports?.find(imp => frontendFrameworks.includes(imp));
      if (detected) return detected;
    }

    return undefined;
  }

  private calculateConfidence(evidence: Evidence[], baseConfidence: number): ConfidenceScore {
    const avgEvidence = 1.0;
    const overall = Math.min(0.95, baseConfidence * avgEvidence);

    return {
      overall,
      breakdown: {
        evidence: avgEvidence,
        base: baseConfidence,
      },
      factors: evidence.map(e => ({
        description: `Evidence from ${e.type}`,
        weight: 1.0,
        source: e.source,
      })),
    };
  }

  private createProvenance(evidence: Evidence[]): Provenance {
    return {
      evidence: evidence.map(e => e.id),
      plugins: ['python'],
      rules: ['package-config-analysis', 'source-file-analysis'],
      timestamp: Date.now(),
      pipelineVersion: '1.0.0',
    };
  }
}

// Export the plugin instance
export const pythonPlugin = new PythonPlugin();
