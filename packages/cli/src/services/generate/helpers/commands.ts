/**
 * @packageDocumentation
 * Language-specific command helpers for code generation.
 *
 * Provides functionality to:
 * - Get prerequisites, install, run, test, build, lint commands
 * - Support multiple package managers (npm, yarn, pnpm, bun)
 * - Handle language-specific variations (TypeScript, Python, Go, Rust)
 */

/** Configuration for language-specific commands */
interface LanguageCommandConfig {
  prerequisites: string;
  prerequisites_bun?: string;
  install: string;
  install_bun?: string;
  run: string;
  run_bun?: string;
  test: string;
  test_bun?: string;
  build: string;
  build_bun?: string;
  lint: string;
  lint_bun?: string;
}

const LANGUAGE_COMMANDS: Record<string, LanguageCommandConfig> = {
  typescript: {
    prerequisites:
      "- [Node.js](https://nodejs.org) v18+\n- [npm](https://npmjs.com) or [yarn](https://yarnpkg.com)",
    prerequisites_bun: "- [Bun](https://bun.sh) v1.0+",
    install: "npm install",
    install_bun: "bun install",
    run: "npm start",
    run_bun: "bun run src/index.ts",
    test: "npm test",
    test_bun: "bun test",
    build: "npm run build",
    build_bun: "bun build",
    lint: "npm run lint",
    lint_bun: "bun run lint",
  },
  python: {
    prerequisites: "- [Python](https://python.org) 3.8+\n- [pip](https://pip.pypa.io)",
    install: "pip install -e .",
    run: "python -m PLACEHOLDER",
    test: "pytest",
    build: "python -m build",
    lint: "ruff check . && mypy .",
  },
  rust: {
    prerequisites: "- [Rust](https://rustup.rs) 1.70+",
    install: "cargo build",
    run: "cargo run",
    test: "cargo test",
    build: "cargo build --release",
    lint: "cargo clippy -- -D warnings",
  },
  go: {
    prerequisites: "- [Go](https://golang.org) 1.21+",
    install: "go mod tidy",
    run: "go run main.go",
    test: "go test ./...",
    build: "go build",
    lint: "golangci-lint run",
  },
  shell: {
    prerequisites: "- [Bash](https://www.gnu.org/software/bash/) 4.0+",
    install: "make install",
    run: "./src/PLACEHOLDER",
    test: "make test",
    build: 'echo "No build step needed"',
    lint: "shellcheck src/*",
  },
};

function getCommand(
  language: string,
  field: keyof LanguageCommandConfig,
  buildTool?: string,
  defaultValue?: string,
): string {
  const config = LANGUAGE_COMMANDS[language];
  if (!config) return defaultValue ?? `echo "${field} command not defined"`;

  const bunField = `${field}_bun` as keyof LanguageCommandConfig;
  if (buildTool === "bun" && config[bunField]) {
    return config[bunField] as string;
  }
  return config[field] as string;
}

export function getPrerequisites(language: string, buildTool?: string): string {
  return getCommand(
    language,
    "prerequisites",
    buildTool,
    `- Development environment for ${language}`,
  );
}

export function getInstallCommand(language: string, buildTool?: string): string {
  return getCommand(language, "install", buildTool);
}

export function getRunCommand(language: string, buildTool?: string): string {
  return getCommand(language, "run", buildTool);
}

export function getTestCommand(language: string, buildTool?: string): string {
  return getCommand(language, "test", buildTool);
}

export function getBuildCommand(language: string, buildTool?: string): string {
  return getCommand(language, "build", buildTool);
}

export function getLintCommand(language: string, buildTool?: string): string {
  return getCommand(language, "lint", buildTool);
}
