/**
 * @packageDocumentation
 * Component subcommand module - Handles adding UI components to CUE specifications.
 *
 * Supports component scaffolding with:
 * - Framework selection (React, Vue, etc.)
 * - Props configuration
 * - Storybook integration
 */

/** Options for UI component configuration */
export interface ComponentOptions {
  framework?: string;
  directory?: string;
  props?: string;
  stories?: boolean;
  [key: string]: any;
}

export async function addComponent(
  manipulator: any,
  content: string,
  name: string,
  options: ComponentOptions,
): Promise<string> {
  const componentName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const componentConfig: Record<string, unknown> = {
    name: componentName,
    type: "component",
    framework: options.framework || "react",
    directory: options.directory || `src/components/${componentName}`,
  };

  if (options.props) {
    componentConfig.props = options.props.split(",").map((p) => p.trim());
  }

  if (options.stories) {
    componentConfig.storybook = true;
  }

  return await manipulator.addToSection(content, "components.ui", componentName, componentConfig);
}
