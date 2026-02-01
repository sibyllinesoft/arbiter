/**
 * Storybook for React Module
 *
 * Sets up Storybook for React component development and documentation.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const frontendDir = data.frontendDir || "frontend";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${frontendDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Storybook - Component development and documentation for React";

export const dependencies = {};

export const devDependencies = {
  "@storybook/addon-essentials": "^8.4.0",
  "@storybook/addon-interactions": "^8.4.0",
  "@storybook/addon-links": "^8.4.0",
  "@storybook/addon-onboarding": "^8.4.0",
  "@storybook/addon-docs": "^8.4.0",
  "@storybook/addon-a11y": "^8.4.0",
  "@storybook/blocks": "^8.4.0",
  "@storybook/react": "^8.4.0",
  "@storybook/react-vite": "^8.4.0",
  "@storybook/test": "^8.4.0",
  "@storybook/manager-api": "^8.4.0",
  "@storybook/theming": "^8.4.0",
  storybook: "^8.4.0",
};

export const scripts = {
  storybook: "storybook dev -p 6006",
  "build-storybook": "storybook build",
  "test-storybook": "test-storybook",
};

export const envVars = {};
