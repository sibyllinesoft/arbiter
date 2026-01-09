/**
 * TypeScript project configuration generators.
 * Extracted from typescript.ts for modularity.
 */

type FrameworkOption = "vite" | "nextjs";
type StylingOption = "css-modules" | "tailwind" | "styled-components";
type TestRunnerOption = "vitest" | "jest";

export interface TypeScriptRuntimeOptions {
  framework: FrameworkOption;
  styling: StylingOption;
  stateManagement?: string;
  testRunner: TestRunnerOption;
}

/**
 * Remove undefined values from an object
 */
export function pruneUndefined<T extends Record<string, unknown>>(input: T): T {
  for (const key of Object.keys(input)) {
    if (input[key] === undefined) {
      delete input[key];
    }
  }
  return input;
}

/**
 * Create Vite tsconfig.json
 */
export function createViteTsconfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2023", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
    include: ["src"],
    references: [{ path: "./tsconfig.node.json" }],
  };
}

/**
 * Create Vite tsconfig.build.json
 */
export function createViteBuildTsconfig(): Record<string, unknown> {
  return {
    extends: "./tsconfig.json",
    compilerOptions: {
      noEmit: false,
      declaration: true,
      outDir: "./dist",
    },
    exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  };
}

/**
 * Create Vite tsconfig.node.json
 */
export function createViteNodeTsconfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      composite: true,
      module: "ESNext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      types: ["vitest/importMeta"],
    },
    include: ["vite.config.ts"],
  };
}

/**
 * Create Next.js tsconfig.json
 */
export function createNextTsconfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: "ES2022",
      lib: ["DOM", "DOM.Iterable", "ESNext"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      forceConsistentCasingInFileNames: true,
      noEmit: true,
      module: "ESNext",
      moduleResolution: "Bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  };
}

/**
 * Create Vite npm scripts
 */
export function createViteScripts(
  runtime: TypeScriptRuntimeOptions,
): Record<string, string | undefined> {
  return pruneUndefined({
    dev: "vite",
    build: "tsc && vite build",
    preview: "vite preview",
    test: runtime.testRunner === "vitest" ? "vitest run --passWithNoTests" : "jest",
    "test:ui": runtime.testRunner === "vitest" ? "vitest --ui" : undefined,
    lint: "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit",
  });
}

/**
 * Create Next.js npm scripts
 */
export function createNextScripts(
  runtime: TypeScriptRuntimeOptions,
): Record<string, string | undefined> {
  return pruneUndefined({
    dev: "next dev",
    build: "next build",
    start: "next start",
    lint: "next lint",
    test: runtime.testRunner === "jest" ? "jest" : "vitest --run --environment=jsdom --globals",
  });
}

/**
 * Normalize framework option from config
 */
export function normalizeFramework(config: Record<string, unknown>): FrameworkOption {
  const value = typeof config.framework === "string" ? config.framework.toLowerCase() : "";
  if (value === "next" || value === "nextjs") {
    return "nextjs";
  }
  return "vite";
}

/**
 * Normalize styling option from config
 */
export function normalizeStyling(config: Record<string, unknown>): StylingOption {
  const value = typeof config.styling === "string" ? config.styling.toLowerCase() : "";
  if (value === "tailwind") return "tailwind";
  if (value === "styled-components" || value === "styledcomponents") {
    return "styled-components";
  }
  return "css-modules";
}

/**
 * Normalize state management option from config
 */
export function normalizeStateManagement(config: Record<string, unknown>): string | undefined {
  const value = typeof config.stateManagement === "string" ? config.stateManagement.trim() : "";
  return value ? value : undefined;
}

/**
 * Normalize test runner option from config
 */
export function normalizeTestRunner(config: Record<string, unknown>): TestRunnerOption {
  const value = typeof config.testRunner === "string" ? config.testRunner.toLowerCase() : "";
  return value === "jest" ? "jest" : "vitest";
}

/**
 * Collect Vite project dependencies
 */
export function collectViteDependencies(runtime: TypeScriptRuntimeOptions): string[] {
  const deps = new Set<string>([
    "react",
    "react-dom",
    "typescript",
    "@types/react",
    "@types/react-dom",
    "@types/node",
    "@vitejs/plugin-react",
    "vite",
    "eslint",
  ]);

  if (runtime.testRunner === "vitest") {
    deps.add("vitest");
    deps.add("@vitest/ui");
    deps.add("jsdom");
    deps.add("@testing-library/react");
    deps.add("@testing-library/jest-dom");
  } else {
    deps.add("jest");
    deps.add("@types/jest");
    deps.add("jest-environment-jsdom");
    deps.add("@testing-library/react");
    deps.add("@testing-library/jest-dom");
  }

  if (runtime.styling === "styled-components") {
    deps.add("styled-components");
    deps.add("@types/styled-components");
  } else if (runtime.styling === "tailwind") {
    deps.add("tailwindcss");
    deps.add("postcss");
    deps.add("autoprefixer");
  }

  addStateManagementDeps(runtime.stateManagement, (name) => deps.add(name));

  return Array.from(deps);
}

/**
 * Collect Next.js project dependencies
 */
export function collectNextDependencies(runtime: TypeScriptRuntimeOptions): string[] {
  const deps = new Set<string>([
    "next",
    "react",
    "react-dom",
    "typescript",
    "@types/react",
    "@types/node",
    "eslint",
  ]);

  if (runtime.testRunner === "jest") {
    deps.add("jest");
    deps.add("@types/jest");
    deps.add("@testing-library/react");
    deps.add("@testing-library/jest-dom");
    deps.add("babel-plugin-dynamic-import-node");
    deps.add("jest-next-dynamic");
  } else {
    deps.add("vitest");
    deps.add("@testing-library/react");
    deps.add("@testing-library/jest-dom");
  }

  if (runtime.styling === "styled-components") {
    deps.add("styled-components");
    deps.add("@types/styled-components");
  } else if (runtime.styling === "tailwind") {
    deps.add("tailwindcss");
    deps.add("postcss");
    deps.add("autoprefixer");
  }

  addStateManagementDeps(runtime.stateManagement, (name) => deps.add(name));

  return Array.from(deps);
}

/**
 * State management library to dependencies mapping
 */
const STATE_MANAGEMENT_DEPS: Record<string, string[]> = {
  redux: ["@reduxjs/toolkit", "react-redux", "@types/react-redux"],
  "redux-toolkit": ["@reduxjs/toolkit", "react-redux", "@types/react-redux"],
  zustand: ["zustand"],
  jotai: ["jotai"],
  recoil: ["recoil"],
  mobx: ["mobx", "mobx-react-lite"],
};

/**
 * Add state management dependencies
 */
export function addStateManagementDeps(
  stateManagement: string | undefined,
  addDep: (name: string) => void,
): void {
  if (!stateManagement) return;

  const deps = STATE_MANAGEMENT_DEPS[stateManagement.toLowerCase()];
  if (deps) {
    deps.forEach(addDep);
  }
}
