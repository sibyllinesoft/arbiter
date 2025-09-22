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
import { pythonPlugin } from './python.js';
import { rustPlugin } from './rust.js';
import { terraformPlugin } from './terraform.js';

export { RustPlugin, rustPlugin } from './rust.js';
export { DockerPlugin, dockerPlugin } from './docker.js';
export { KubernetesPlugin, kubernetesPlugin } from './kubernetes.js';
export { NodeJSPlugin, nodejsPlugin } from './nodejs.js';
export { PythonPlugin, pythonPlugin } from './python.js';
export { ConfigOnlyPlugin, configOnlyPlugin } from './config-only.js';
export { TerraformPlugin, terraformPlugin } from './terraform.js';

// Re-export types for convenience
export type { ImporterPlugin } from '../types.js';

/**
 * Get all available plugins
 */
export function getAllPlugins() {
  return [
    // configOnlyPlugin disabled to prevent duplicate artifacts
    // It was processing package.json files that are already handled by nodejsPlugin
    rustPlugin,
    dockerPlugin,
    kubernetesPlugin, // Re-enabled
    nodejsPlugin, // Re-enabled with improved detection
    pythonPlugin, // Added Python support
    terraformPlugin, // Terraform support - requires .terraform.lock.hcl
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
    case 'python':
    case 'py':
      return [pythonPlugin];
    case 'docker':
      return [dockerPlugin];
    case 'kubernetes':
    case 'k8s':
      return [kubernetesPlugin];
    case 'terraform':
    case 'tf':
    case 'hcl':
      return [terraformPlugin];
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
