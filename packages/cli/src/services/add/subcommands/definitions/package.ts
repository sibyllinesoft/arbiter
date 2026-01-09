/**
 * @packageDocumentation
 * Package subcommand module - Handles adding packages to CUE specifications.
 *
 * Supports defining:
 * - Library packages with version info
 * - Export definitions
 * - Language and directory configuration
 */

/** Options for package configuration */
export interface PackageOptions {
  language?: string;
  directory?: string;
  exports?: string;
  version?: string;
  [key: string]: any;
}

export async function addPackage(
  manipulator: any,
  content: string,
  name: string,
  options: PackageOptions,
): Promise<string> {
  const packageName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const packageConfig: Record<string, unknown> = {
    name: packageName,
    type: "package",
    language: options.language || "typescript",
    version: options.version || "0.1.0",
    directory: options.directory || `packages/${packageName}`,
  };

  if (options.exports) {
    packageConfig.exports = options.exports.split(",").map((e) => e.trim());
  }

  return await manipulator.addToSection(content, "components.packages", packageName, packageConfig);
}
