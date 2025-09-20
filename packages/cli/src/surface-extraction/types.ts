export type SurfaceLanguage = 'typescript' | 'python' | 'rust' | 'go' | 'bash';

export interface SurfaceOptions {
  /** Programming language to analyze */
  language: SurfaceLanguage;
  /** Output file path */
  output?: string;
  /** Output directory for generated file */
  outputDir?: string;
  /** Project name for file naming */
  projectName?: string;
  /** Use generic names for backward compatibility */
  genericNames?: boolean;
  /** Compare against existing spec */
  diff?: boolean;
  /** Include private/internal APIs */
  includePrivate?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Agent mode for NDJSON output */
  agentMode?: boolean;
  /** NDJSON output file */
  ndjsonOutput?: string;
}

export interface APISymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant';
  visibility: 'public' | 'private' | 'internal';
  signature?: string;
  documentation?: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  parameters?: Array<{
    name: string;
    type: string;
    optional?: boolean;
    default?: string;
  }>;
  returnType?: string;
  genericParameters?: string[];
}

export interface APISurface {
  language: string;
  version: string;
  timestamp: number;
  symbols: APISymbol[];
  statistics: {
    totalSymbols: number;
    publicSymbols: number;
    privateSymbols: number;
    byType: Record<string, number>;
  };
}
