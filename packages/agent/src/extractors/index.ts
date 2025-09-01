/**
 * API Surface Extractors for Different Languages
 * 
 * Provides unified interface for extracting API surfaces from different
 * programming languages for semver analysis and breaking change detection.
 */

export { 
  TypeScriptSurfaceExtractor,
  extractTypeScriptApiSurface,
  type TypeScriptApiSurface,
  type FunctionSignature,
  type ClassSignature,
  type InterfaceSignature,
  type TypeAliasSignature,
  type ConstantSignature,
  type EnumSignature,
  type PropertySignature,
  type Parameter,
} from './typescript-surface.js';

export {
  GoSurfaceExtractor,
  extractGoApiSurface,
  type GoApiSurface,
  type GoPackage,
  type GoFunction,
  type GoType,
  type GoConstant,
  type GoVariable,
  type GoParameter,
  type GoReturn,
  type GoField,
} from './go-surface.js';

/**
 * Generic API surface format for cross-language compatibility
 */
export interface GenericApiSurface {
  language: 'typescript' | 'go' | 'rust' | 'python' | string;
  version: string;
  extractedAt: string;
  extractor: string;
  sourceFiles: string[];
  totalExports: number;
  complexityScore: number;
  stability: 'stable' | 'beta' | 'alpha';
  
  // Language-specific surface data
  surface: TypeScriptApiSurface | GoApiSurface | any;
}

/**
 * Factory function to create appropriate extractor based on language
 */
export async function createSurfaceExtractor(
  language: string,
  repoPath: string,
  options: any = {}
): Promise<{
  extract(): Promise<GenericApiSurface>;
}> {
  switch (language) {
    case 'ts':
    case 'typescript':
      const { TypeScriptSurfaceExtractor } = await import('./typescript-surface.js');
      const tsExtractor = new TypeScriptSurfaceExtractor(repoPath, options);
      return {
        async extract(): Promise<GenericApiSurface> {
          const surface = await tsExtractor.extract();
          return {
            language: 'typescript',
            version: surface.version,
            extractedAt: surface.extractedAt,
            extractor: surface.extractor,
            sourceFiles: surface.sourceFiles,
            totalExports: surface.metadata.totalExports,
            complexityScore: surface.metadata.complexityScore,
            stability: surface.metadata.stability,
            surface,
          };
        },
      };

    case 'go':
      const { GoSurfaceExtractor } = await import('./go-surface.js');
      const goExtractor = new GoSurfaceExtractor(repoPath, options);
      return {
        async extract(): Promise<GenericApiSurface> {
          const surface = await goExtractor.extract();
          return {
            language: 'go',
            version: surface.version,
            extractedAt: surface.extractedAt,
            extractor: surface.extractor,
            sourceFiles: surface.sourceFiles,
            totalExports: surface.metadata.totalExports,
            complexityScore: surface.metadata.complexityScore,
            stability: surface.metadata.goVersion.startsWith('1.') ? 'stable' : 'beta',
            surface,
          };
        },
      };

    case 'rust':
      // TODO: Implement Rust surface extractor
      throw new Error('Rust surface extraction not yet implemented');

    case 'python':
      // TODO: Implement Python surface extractor
      throw new Error('Python surface extraction not yet implemented');

    default:
      throw new Error(`Unsupported language for surface extraction: ${language}`);
  }
}

/**
 * Extract API surface using the appropriate extractor for the detected language
 */
export async function extractApiSurface(
  language: string,
  repoPath: string,
  options: any = {}
): Promise<GenericApiSurface> {
  const extractor = await createSurfaceExtractor(language, repoPath, options);
  return extractor.extract();
}