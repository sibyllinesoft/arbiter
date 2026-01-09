/**
 * @packageDocumentation
 * Module subcommand module - Handles adding code modules to CUE specifications.
 *
 * Supports defining:
 * - Internal library modules
 * - Language and directory configuration
 * - Function exports and dependencies
 */

/** Options for module configuration */
export interface ModuleOptions {
  language?: string;
  directory?: string;
  deps?: string;
  functions?: string;
  [key: string]: any;
}

export async function addModule(
  manipulator: any,
  content: string,
  name: string,
  options: ModuleOptions,
): Promise<string> {
  const moduleName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const moduleConfig: Record<string, unknown> = {
    name: moduleName,
    type: "package",
    language: options.language || "typescript",
    directory: options.directory || `modules/${moduleName}`,
  };

  if (options.deps) {
    moduleConfig.dependencies = options.deps.split(",").map((dep) => dep.trim());
  }

  if (options.functions) {
    moduleConfig.functions = options.functions.split(",").map((fn) => fn.trim());
  }

  return await manipulator.addToSection(content, "components.modules", moduleName, moduleConfig);
}
