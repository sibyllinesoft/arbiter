/**
 * MkDocs Documentation Module
 *
 * Sets up MkDocs with Material theme for monorepo documentation.
 * Automatically aggregates docs from subprojects into a unified site.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const docsDir = data.docsDir || "docs";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data: {
        ...data,
        docsDir,
        // Collect subprojects for nav aggregation
        subprojects: data.modules || [],
      },
    },
  ];
}

export const description = "MkDocs documentation with Material theme and monorepo aggregation";

export const dependencies = {};

export const devDependencies = {};

export const scripts = {
  "docs:serve": "mkdocs serve",
  "docs:build": "mkdocs build",
  "docs:deploy": "mkdocs gh-deploy",
  "docs:aggregate": "node scripts/aggregate-docs.mjs",
};

export const envVars = {};

// Python requirements for mkdocs
export const pythonRequirements = [
  "mkdocs>=1.5.0",
  "mkdocs-material>=9.5.0",
  "mkdocs-monorepo-plugin>=1.0.0",
  "mkdocs-awesome-pages-plugin>=2.9.0",
  "mkdocs-git-revision-date-localized-plugin>=1.2.0",
  "mkdocs-minify-plugin>=0.7.0",
  "mkdocstrings[python]>=0.24.0",
  "mkdocs-gen-files>=0.5.0",
  "mkdocs-literate-nav>=0.6.0",
  "mkdocs-section-index>=0.3.0",
];
