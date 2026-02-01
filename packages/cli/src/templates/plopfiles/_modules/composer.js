/**
 * Module Composer
 *
 * Dynamically loads and composes template modules based on selections.
 * Used by the full-stack plopfile and can be used programmatically.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathExists } from "fs-extra";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load a template module by category and name
 *
 * @param {string} category - backends, frontends, databases, or infra
 * @param {string} name - module name (e.g., "node-hono", "react-vite")
 * @returns {Promise<import('./types').TemplateModule>}
 */
export async function loadModule(category, name) {
  const modulePath = resolve(__dirname, category, name, "module.js");

  if (!(await pathExists(modulePath))) {
    throw new Error(`Module not found: ${category}/${name} (looked in ${modulePath})`);
  }

  return import(modulePath);
}

/**
 * List available modules in a category
 *
 * @param {string} category
 * @returns {Promise<string[]>}
 */
export async function listModules(category) {
  const { readdir } = await import("fs/promises");
  const categoryPath = resolve(__dirname, category);

  try {
    const entries = await readdir(categoryPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith("_")).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Compose multiple modules into a single manifest
 *
 * @param {object} selections - { backend, frontend, database, desktop, mobile, infra[], cloud[], build[] }
 * @param {import('./types').ModuleContext} context
 * @returns {Promise<{ actions: any[], manifest: import('./types').ComposedManifest }>}
 */
export async function composeModules(selections, context) {
  const actions = [];
  const manifest = {
    name: context.name,
    modules: [],
    dependencies: {},
    devDependencies: {},
    scripts: {},
    envVars: {},
  };

  // Helper to merge module into manifest
  const mergeModule = (mod, name) => {
    manifest.modules.push(name);
    Object.assign(manifest.dependencies, mod.dependencies || {});
    Object.assign(manifest.devDependencies, mod.devDependencies || {});
    Object.assign(manifest.scripts, mod.scripts || {});
    Object.assign(manifest.envVars, mod.envVars || {});
  };

  // Load backend
  if (selections.backend && selections.backend !== "none") {
    const mod = await loadModule("backends", selections.backend);
    actions.push(...mod.default(context));
    mergeModule(mod, `backends/${selections.backend}`);
  }

  // Load frontend
  if (selections.frontend && selections.frontend !== "none") {
    const mod = await loadModule("frontends", selections.frontend);
    actions.push(...mod.default(context));
    mergeModule(mod, `frontends/${selections.frontend}`);
  }

  // Load database
  if (selections.database && selections.database !== "none") {
    const mod = await loadModule("databases", selections.database);
    actions.push(...mod.default(context));
    mergeModule(mod, `databases/${selections.database}`);
  }

  // Load desktop module
  if (selections.desktop && selections.desktop !== "none") {
    const mod = await loadModule("desktop", selections.desktop);
    actions.push(...mod.default(context));
    mergeModule(mod, `desktop/${selections.desktop}`);
  }

  // Load mobile module
  if (selections.mobile && selections.mobile !== "none") {
    const mod = await loadModule("mobile", selections.mobile);
    actions.push(...mod.default(context));
    mergeModule(mod, `mobile/${selections.mobile}`);
  }

  // Load infra modules
  for (const infraName of selections.infra || []) {
    const mod = await loadModule("infra", infraName);
    actions.push(...mod.default(context));
    mergeModule(mod, `infra/${infraName}`);
  }

  // Load cloud modules
  for (const cloudName of selections.cloud || []) {
    const mod = await loadModule("cloud", cloudName);
    actions.push(...mod.default(context));
    mergeModule(mod, `cloud/${cloudName}`);
  }

  // Load build system modules
  for (const buildName of selections.build || []) {
    const mod = await loadModule("build", buildName);
    actions.push(...mod.default(context));
    mergeModule(mod, `build/${buildName}`);
  }

  // Load docs modules
  for (const docsName of selections.docs || []) {
    const mod = await loadModule("docs", docsName);
    actions.push(...mod.default(context));
    mergeModule(mod, `docs/${docsName}`);
  }

  // Load quality/linting modules
  for (const qualityName of selections.quality || []) {
    const mod = await loadModule("quality", qualityName);
    actions.push(...mod.default(context));
    mergeModule(mod, `quality/${qualityName}`);
  }

  // Load storybook modules
  for (const storybookName of selections.storybook || []) {
    const mod = await loadModule("storybook", storybookName);
    actions.push(...mod.default(context));
    mergeModule(mod, `storybook/${storybookName}`);
  }

  return { actions, manifest };
}

/**
 * Get all available module choices for prompts
 */
export async function getModuleChoices() {
  return {
    backends: await listModules("backends"),
    frontends: ["none", ...(await listModules("frontends"))],
    databases: ["none", ...(await listModules("databases"))],
    desktop: ["none", ...(await listModules("desktop"))],
    mobile: ["none", ...(await listModules("mobile"))],
    infra: await listModules("infra"),
    cloud: await listModules("cloud"),
    build: await listModules("build"),
    docs: await listModules("docs"),
    quality: await listModules("quality"),
    storybook: await listModules("storybook"),
  };
}

export default {
  loadModule,
  listModules,
  composeModules,
  getModuleChoices,
};
