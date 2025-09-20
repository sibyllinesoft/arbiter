/**
 * Brownfield Detection Plugins
 *
 * Central registry for all importer detection plugins.
 * Each plugin implements the ImporterPlugin interface and provides
 * language-specific analysis capabilities.
 */

import { rustPlugin } from './rust';

export { RustPlugin, rustPlugin } from './rust';

// Re-export types for convenience
export type { ImporterPlugin } from '../types.js';

/**
 * Get all available plugins
 */
export function getAllPlugins() {
  return [rustPlugin];
}

/**
 * Get plugins by language
 */
export function getPluginsByLanguage(language: string) {
  const plugins = getAllPlugins();

  switch (language.toLowerCase()) {
    case 'rust':
      return [rustPlugin];
    default:
      return [];
  }
}

/**
 * Get plugins that support a given file
 */
export function getPluginsForFile(filePath: string, fileContent?: string) {
  return getAllPlugins().filter(plugin => plugin.supports(filePath, fileContent));
}
