/**
 * @packageDocumentation
 * Pluggable manifest handler types for sync.
 *
 * Handlers extract 100% reliable metadata from manifest files.
 * Agents fill in the blanks (subtype, detailed config) after initial extraction.
 */

import type { PackageConfig } from "@arbiter/specification";

/**
 * Result of manifest extraction - only fields we're 100% confident about.
 * Agents can enrich this later with subtype detection, framework inference, etc.
 */
export interface ExtractedPackage {
  /** Package name from manifest */
  name: string;
  /** Programming language (detected from manifest type + deps) */
  language: string;
  /** Path to the manifest file relative to project root */
  manifest: string;
  /** Directory containing the manifest */
  directory: string;
  /** Version string if present */
  version?: string;
  /** Direct dependencies (package names only, not versions) */
  dependencies?: string[];
  /** Dev dependencies (package names only) */
  devDependencies?: string[];
  /** Entry points if detectable (main, bin, exports) */
  entryPoints?: Record<string, string>;
  /** Scripts/commands defined in manifest */
  scripts?: Record<string, string>;
  /** Workspaces for monorepo detection */
  workspaces?: string[];
  /** Repository URL if present */
  repository?: string;
  /** License identifier */
  license?: string;
}

/**
 * Handler for extracting package metadata from a specific manifest type.
 */
export interface ManifestHandler {
  /** Unique identifier for this handler */
  id: string;

  /** Human-readable name */
  name: string;

  /** Glob patterns this handler processes */
  patterns: string[];

  /**
   * Extract package metadata from manifest content.
   * Returns null if the file should be skipped (e.g., not a real package).
   *
   * @param filePath - Absolute path to the manifest file
   * @param content - Raw file content
   * @param projectRoot - Project root directory for relative path calculation
   */
  extract(filePath: string, content: string, projectRoot: string): Promise<ExtractedPackage | null>;
}

/**
 * Registry for manifest handlers - supports built-in and custom handlers.
 */
export interface HandlerRegistry {
  /** Register a handler */
  register(handler: ManifestHandler): void;

  /** Get handler for a file path (first matching handler wins) */
  getHandler(filePath: string): ManifestHandler | null;

  /** Get all registered handlers */
  getAll(): ManifestHandler[];
}

/**
 * Sync result for a single manifest.
 */
export interface ManifestSyncResult {
  /** Path to the manifest file */
  manifest: string;
  /** Handler that processed this manifest */
  handlerId: string;
  /** Extracted package data (null if skipped) */
  extracted: ExtractedPackage | null;
  /** Whether extraction succeeded */
  success: boolean;
  /** Error message if extraction failed */
  error?: string;
}

/**
 * Overall sync result.
 */
export interface SyncReport {
  /** Packages successfully extracted */
  packages: ExtractedPackage[];
  /** Manifests that were processed */
  processed: ManifestSyncResult[];
  /** Manifests that had no matching handler */
  unhandled: string[];
  /** Total manifests found */
  totalFound: number;
}
