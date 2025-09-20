/**
 * Brownfield Detection Plugins
 *
 * Central registry for all importer detection plugins.
 * Each plugin implements the ImporterPlugin interface and provides
 * language/framework-specific analysis capabilities.
 */

import { configOnlyPlugin } from './config-only.js';
import { dockerPlugin } from './docker.js';
import { kubernetesPlugin } from './kubernetes.js';
import { nodejsPlugin } from './nodejs.js';
import { rustPlugin } from './rust.js';

export { RustPlugin, rustPlugin } from './rust.js';
export { DockerPlugin, dockerPlugin } from './docker.js';
export { KubernetesPlugin, kubernetesPlugin } from './kubernetes.js';
export { NodeJSPlugin, nodejsPlugin } from './nodejs.js';
export { ConfigOnlyPlugin, configOnlyPlugin } from './config-only.js';

// Re-export types for convenience
export type { ImporterPlugin } from '../types.js';

/**
 * Get all available plugins
 */
export function getAllPlugins() {
  return [
    configOnlyPlugin, // Use simplified plugin first
    rustPlugin,
    dockerPlugin,
    kubernetesPlugin,
    // nodejsPlugin, // Disable complex plugin for now
  ];
}

/**
 * Get plugins by language
 */
export function getPluginsByLanguage(language: string) {
  const plugins = getAllPlugins();

  switch (language.toLowerCase()) {
    case 'rust':
      return [rustPlugin];
    case 'javascript':
    case 'typescript':
    case 'node':
    case 'nodejs':
      return [nodejsPlugin];
    case 'docker':
      return [dockerPlugin];
    case 'kubernetes':
    case 'k8s':
      return [kubernetesPlugin];
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
