import type { APISurface, SurfaceLanguage, SurfaceOptions } from './types.js';

export interface SurfaceExtractor {
  readonly language: SurfaceLanguage;
  extract(options: SurfaceOptions, sourceFiles: string[]): Promise<APISurface | null>;
}
