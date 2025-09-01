/**
 * UI Scaffolding System - Main Export
 * 
 * This module provides a complete UI scaffolding system that generates
 * platform-specific code from Profile.ui specifications defined in CUE files.
 */

// Core scaffolding engine
export { UIScaffolderEngine, createScaffolder, scaffoldFromCUE, getScaffolderOptions } from './scaffolder.js';

// Platform generators
export { WebGenerator } from './generators/web-generator.js';
export { CLIGenerator } from './generators/cli-generator.js';
export { TUIGenerator } from './generators/tui-generator.js';
export { DesktopGenerator } from './generators/desktop-generator.js';

// Type definitions
export * from './types.js';

// Convenience factory functions
import { UIScaffolderEngine } from './scaffolder.js';
import { WebGenerator } from './generators/web-generator.js';
import { CLIGenerator } from './generators/cli-generator.js';
import { TUIGenerator } from './generators/tui-generator.js';
import { DesktopGenerator } from './generators/desktop-generator.js';
import type { Platform, GeneratorOptions, ProfileUI } from './types.js';

/**
 * Create a fully configured scaffolder with all platform generators
 */
export function createFullScaffolder(options?: { verbose?: boolean }) {
  const scaffolder = new UIScaffolderEngine(
    options?.verbose ? console.log : undefined
  );

  // Register all platform generators
  scaffolder.addGenerator(new WebGenerator());
  scaffolder.addGenerator(new CLIGenerator());
  scaffolder.addGenerator(new TUIGenerator());
  scaffolder.addGenerator(new DesktopGenerator());

  return scaffolder;
}

/**
 * Quick scaffold function - parses CUE and generates for all platforms
 */
export async function quickScaffold(
  cuePath: string,
  outputDir: string,
  options?: {
    platforms?: Platform[];
    overwrite?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
  }
) {
  const scaffolder = createFullScaffolder({ verbose: options?.verbose });
  const ui = await scaffolder.parseCUE(cuePath);

  const platforms = options?.platforms || ['web', 'cli', 'tui', 'desktop'];
  const results = [];

  for (const platform of platforms) {
    const generatorOptions: GeneratorOptions = {
      platform,
      outputDir: `${outputDir}/${platform}`,
      overwrite: options?.overwrite ?? false,
      dryRun: options?.dryRun ?? false,
      verbose: options?.verbose ?? false,
    };

    const result = await scaffolder.scaffold(ui, generatorOptions);
    results.push({ platform, result });
  }

  return results;
}

/**
 * Create platform-specific scaffolder
 */
export function createPlatformScaffolder(platform: Platform, options?: { verbose?: boolean }) {
  const scaffolder = new UIScaffolderEngine(
    options?.verbose ? console.log : undefined
  );

  switch (platform) {
    case 'web':
      scaffolder.addGenerator(new WebGenerator());
      break;
    case 'cli':
      scaffolder.addGenerator(new CLIGenerator());
      break;
    case 'tui':
      scaffolder.addGenerator(new TUIGenerator());
      break;
    case 'desktop':
      scaffolder.addGenerator(new DesktopGenerator());
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  return scaffolder;
}

/**
 * CLI usage example:
 * 
 * ```typescript
 * import { quickScaffold } from './src/ui/index.js';
 * 
 * await quickScaffold(
 *   './arbiter.assembly.cue',
 *   './generated',
 *   { platforms: ['web', 'cli'], verbose: true }
 * );
 * ```
 * 
 * Programmatic usage example:
 * 
 * ```typescript
 * import { createFullScaffolder } from './src/ui/index.js';
 * 
 * const scaffolder = createFullScaffolder({ verbose: true });
 * const ui = await scaffolder.parseCUE('./my-profile.cue');
 * const result = await scaffolder.scaffold(ui, {
 *   platform: 'web',
 *   outputDir: './output',
 *   overwrite: true
 * });
 * ```
 */