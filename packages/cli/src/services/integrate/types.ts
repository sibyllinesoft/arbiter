/**
 * @packageDocumentation
 * Type definitions for the integrate command module.
 *
 * Defines interfaces for:
 * - Build matrix configuration
 * - Project language detection results
 * - Assembly configuration options
 */

/** CI/CD build matrix configuration */
export interface BuildMatrix {
  versions: string[];
  os: string[];
  arch: string[];
}

export interface ProjectLanguage {
  name: string;
  detected: boolean;
  files: string[];
  framework?: string;
}

export interface AssemblyConfig {
  buildMatrix?: BuildMatrix;
  language?: string;
  profile?: string;
}
