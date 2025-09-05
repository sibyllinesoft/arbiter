/**
 * Generate command - Core code generation based on assembly.cue configuration
 *
 * This is the primary command for generating project files, CI workflows,
 * language-specific configurations, and other artifacts based on the
 * arbiter.assembly.cue specification.
 */

import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import type { Config } from "../config.js";

export interface GenerateOptions {
  output?: string;
  outputDir?: string;
  includeCi?: boolean;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  format?: "auto" | "json" | "yaml" | "typescript" | "python" | "rust" | "go" | "shell";
}

/**
 * Main generate command implementation
 */
export async function generateCommand(options: GenerateOptions, _config: Config): Promise<number> {
  try {
    console.log(chalk.blue("🏗️  Generating project artifacts from assembly.cue..."));

    // Read assembly file
    const assemblyPath = path.resolve("arbiter.assembly.cue");
    if (!fs.existsSync(assemblyPath)) {
      console.error(chalk.red("❌ No arbiter.assembly.cue found in current directory"));
      console.log(chalk.dim("Initialize a project with: arbiter init"));
      return 1;
    }

    const assemblyContent = fs.readFileSync(assemblyPath, "utf-8");
    const assemblyConfig = parseAssemblyFile(assemblyContent);

    if (options.verbose) {
      console.log(chalk.dim("Assembly configuration:"));
      console.log(chalk.dim(JSON.stringify(assemblyConfig, null, 2)));
    }

    // Determine output directory
    const outputDir = options.outputDir || ".";

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = [];

    // Generate language-specific files
    if (assemblyConfig.language) {
      const langResult = await generateLanguageFiles(assemblyConfig, outputDir, options);
      results.push(...langResult);
    }

    // Generate CI workflows if requested
    if (options.includeCi) {
      const ciResult = await generateCIWorkflows(assemblyConfig, outputDir, options);
      results.push(...ciResult);
    }

    // Generate project structure
    const structResult = await generateProjectStructure(assemblyConfig, outputDir, options);
    results.push(...structResult);

    // Generate documentation
    const docsResult = await generateDocumentation(assemblyConfig, outputDir, options);
    results.push(...docsResult);

    // Report results
    if (options.dryRun) {
      console.log(chalk.yellow("🔍 Dry run - files that would be generated:"));
      results.forEach((file) => console.log(chalk.dim(`  ${file}`)));
    } else {
      console.log(chalk.green(`✅ Generated ${results.length} files:`));
      results.forEach((file) => console.log(chalk.dim(`  ✓ ${file}`)));
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Generate failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Parse assembly.cue file and extract configuration
 */
function parseAssemblyFile(content: string): any {
  // Basic CUE parsing - extract key information
  const config: any = {
    kind: "library",
    language: "typescript",
    name: "unknown",
    version: "1.0.0",
  };

  // Extract language
  const langMatch = content.match(/language:\s*"([^"]+)"/);
  if (langMatch) {
    config.language = langMatch[1];
  }

  // Extract kind
  const kindMatch = content.match(/kind:\s*"([^"]+)"/);
  if (kindMatch) {
    config.kind = kindMatch[1];
  }

  // Extract name from metadata
  const nameMatch = content.match(/name:\s*"([^"]+)"/);
  if (nameMatch) {
    config.name = nameMatch[1];
  }

  // Extract version
  const versionMatch = content.match(/version:\s*"([^"]+)"/);
  if (versionMatch) {
    config.version = versionMatch[1];
  }

  // Extract build tool
  const toolMatch = content.match(/tool:\s*"([^"]+)"/);
  if (toolMatch) {
    config.buildTool = toolMatch[1];
  }

  return config;
}

/**
 * Generate language-specific files
 */
async function generateLanguageFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  switch (config.language) {
    case "typescript":
      files.push(...(await generateTypeScriptFiles(config, outputDir, options)));
      break;
    case "python":
      files.push(...(await generatePythonFiles(config, outputDir, options)));
      break;
    case "rust":
      files.push(...(await generateRustFiles(config, outputDir, options)));
      break;
    case "go":
      files.push(...(await generateGoFiles(config, outputDir, options)));
      break;
    case "shell":
    case "bash":
      files.push(...(await generateShellFiles(config, outputDir, options)));
      break;
    default:
      console.log(chalk.yellow(`⚠️  Unknown language: ${config.language}`));
  }

  return files;
}

/**
 * Generate TypeScript project files
 */
async function generateTypeScriptFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  // package.json
  const packageJson = {
    name: config.name,
    version: config.version,
    type: "module",
    scripts: {
      build: config.buildTool === "bun" ? "bun build" : "npm run build",
      test: config.buildTool === "bun" ? "bun test" : "npm test",
      lint: "eslint src/**/*.ts",
      typecheck: "tsc --noEmit",
    },
    devDependencies: {
      "@types/node": "^20.0.0",
      typescript: "^5.0.0",
      eslint: "^8.0.0",
    },
  };

  const packagePath = path.join(outputDir, "package.json");
  if (!options.dryRun) {
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  }
  files.push("package.json");

  // tsconfig.json
  const tsconfigJson = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: "./dist",
      rootDir: "./src",
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist", "tests"],
  };

  const tsconfigPath = path.join(outputDir, "tsconfig.json");
  if (!options.dryRun) {
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigJson, null, 2));
  }
  files.push("tsconfig.json");

  // Create src directory and basic file
  const srcDir = path.join(outputDir, "src");
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const indexContent = `/**
 * ${config.name} - Generated by Arbiter
 * Version: ${config.version}
 */

export function main(): void {
  console.log('Hello from ${config.name}!');
}

// Auto-run if this file is executed directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main();
}
`;

  const indexPath = path.join(srcDir, "index.ts");
  if (!options.dryRun) {
    fs.writeFileSync(indexPath, indexContent);
  }
  files.push("src/index.ts");

  // Create tests directory
  const testsDir = path.join(outputDir, "tests");
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  files.push("tests/");

  return files;
}

/**
 * Generate Python project files
 */
async function generatePythonFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  // pyproject.toml
  const pyprojectToml = `[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "${config.name}"
version = "${config.version}"
description = "Generated by Arbiter"
requires-python = ">=3.8"

[project.scripts]
${config.name} = "${config.name}.main:main"

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
`;

  const pyprojectPath = path.join(outputDir, "pyproject.toml");
  if (!options.dryRun) {
    fs.writeFileSync(pyprojectPath, pyprojectToml);
  }
  files.push("pyproject.toml");

  // requirements.txt
  const requirementsContent = `# Generated by Arbiter
pytest>=7.0.0
`;

  const requirementsPath = path.join(outputDir, "requirements.txt");
  if (!options.dryRun) {
    fs.writeFileSync(requirementsPath, requirementsContent);
  }
  files.push("requirements.txt");

  // Create src directory
  const srcDir = path.join(outputDir, "src", config.name);
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const initContent = `"""
${config.name} - Generated by Arbiter
Version: ${config.version}
"""

__version__ = "${config.version}"
`;

  if (!options.dryRun) {
    fs.writeFileSync(path.join(srcDir, "__init__.py"), initContent);
  }
  files.push(`src/${config.name}/__init__.py`);

  const mainContent = `"""Main entry point for ${config.name}"""

def main():
    """Main function"""
    print(f"Hello from ${config.name}!")

if __name__ == "__main__":
    main()
`;

  if (!options.dryRun) {
    fs.writeFileSync(path.join(srcDir, "main.py"), mainContent);
  }
  files.push(`src/${config.name}/main.py`);

  // Create tests directory
  const testsDir = path.join(outputDir, "tests");
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  files.push("tests/");

  return files;
}

/**
 * Generate Rust project files
 */
async function generateRustFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  // Cargo.toml
  const cargoToml = `[package]
name = "${config.name}"
version = "${config.version}"
edition = "2021"

[dependencies]

[dev-dependencies]
`;

  const cargoPath = path.join(outputDir, "Cargo.toml");
  if (!options.dryRun) {
    fs.writeFileSync(cargoPath, cargoToml);
  }
  files.push("Cargo.toml");

  // Create src directory
  const srcDir = path.join(outputDir, "src");
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const libContent = `//! ${config.name} - Generated by Arbiter
//! Version: ${config.version}

pub fn main() {
    println!("Hello from ${config.name}!");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_main() {
        main(); // Should not panic
    }
}
`;

  if (!options.dryRun) {
    fs.writeFileSync(path.join(srcDir, "lib.rs"), libContent);
  }
  files.push("src/lib.rs");

  // Create tests directory
  const testsDir = path.join(outputDir, "tests");
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  files.push("tests/");

  return files;
}

/**
 * Generate Go project files
 */
async function generateGoFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  // go.mod
  const goMod = `module ${config.name}

go 1.21

require ()
`;

  const goModPath = path.join(outputDir, "go.mod");
  if (!options.dryRun) {
    fs.writeFileSync(goModPath, goMod);
  }
  files.push("go.mod");

  // main.go
  const mainGo = `// ${config.name} - Generated by Arbiter
// Version: ${config.version}
package main

import "fmt"

func main() {
    fmt.Println("Hello from ${config.name}!")
}
`;

  const mainGoPath = path.join(outputDir, "main.go");
  if (!options.dryRun) {
    fs.writeFileSync(mainGoPath, mainGo);
  }
  files.push("main.go");

  // Create test directory
  const testDir = path.join(outputDir, "test");
  if (!fs.existsSync(testDir) && !options.dryRun) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  files.push("test/");

  return files;
}

/**
 * Generate Shell/Bash project files
 */
async function generateShellFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  // Makefile
  const makefile = `# ${config.name} - Generated by Arbiter
# Version: ${config.version}

.PHONY: test install clean

test:
\tbash test/run_tests.sh

install:
\tcp src/${config.name} /usr/local/bin/

clean:
\trm -f *.log *.tmp
`;

  const makefilePath = path.join(outputDir, "Makefile");
  if (!options.dryRun) {
    fs.writeFileSync(makefilePath, makefile);
  }
  files.push("Makefile");

  // Create src directory
  const srcDir = path.join(outputDir, "src");
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const mainScript = `#!/bin/bash
# ${config.name} - Generated by Arbiter  
# Version: ${config.version}

set -euo pipefail

main() {
    echo "Hello from ${config.name}!"
}

# Run main if script is executed directly
if [[ "\${BASH_SOURCE[0]}" == "\${0}" ]]; then
    main "$@"
fi
`;

  const scriptPath = path.join(srcDir, config.name);
  if (!options.dryRun) {
    fs.writeFileSync(scriptPath, mainScript);
    fs.chmodSync(scriptPath, 0o755); // Make executable
  }
  files.push(`src/${config.name}`);

  // Create tests directory
  const testsDir = path.join(outputDir, "tests");
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  files.push("tests/");

  return files;
}

/**
 * Generate CI/CD workflows
 */
async function generateCIWorkflows(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  // GitHub Actions workflow
  const workflowDir = path.join(outputDir, ".github", "workflows");
  if (!fs.existsSync(workflowDir) && !options.dryRun) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }

  const workflow = `# ${config.name} CI/CD - Generated by Arbiter
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup ${config.language}
      uses: ${getSetupAction(config.language)}
      ${getSetupActionConfig(config.language)}
    
    - name: Install dependencies
      run: ${getInstallCommand(config.language, config.buildTool)}
    
    - name: Lint
      run: ${getLintCommand(config.language, config.buildTool)}
    
    - name: Test  
      run: ${getTestCommand(config.language, config.buildTool)}
    
    - name: Build
      run: ${getBuildCommand(config.language, config.buildTool)}
`;

  const workflowPath = path.join(workflowDir, "ci.yml");
  if (!options.dryRun) {
    fs.writeFileSync(workflowPath, workflow);
  }
  files.push(".github/workflows/ci.yml");

  return files;
}

/**
 * Generate project structure (README, etc.)
 */
async function generateProjectStructure(
  config: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  // README.md
  const readme = `# ${config.name}

Generated by Arbiter - Version ${config.version}

## Overview

This is a ${config.language} ${config.kind} generated from an Arbiter assembly specification.

## Getting Started

### Prerequisites

${getPrerequisites(config.language, config.buildTool)}

### Installation

\`\`\`bash
${getInstallCommand(config.language, config.buildTool)}
\`\`\`

### Usage

\`\`\`bash
${getRunCommand(config.language, config.buildTool)}
\`\`\`

### Testing

\`\`\`bash
${getTestCommand(config.language, config.buildTool)}
\`\`\`

## Development

### Building

\`\`\`bash
${getBuildCommand(config.language, config.buildTool)}
\`\`\`

### Linting

\`\`\`bash
${getLintCommand(config.language, config.buildTool)}
\`\`\`

## Generated by Arbiter

This project structure was generated by [Arbiter](https://github.com/arbiter-framework) based on the \`arbiter.assembly.cue\` specification.

To regenerate or modify the structure:

\`\`\`bash
arbiter generate
\`\`\`
`;

  const readmePath = path.join(outputDir, "README.md");
  if (!options.dryRun) {
    fs.writeFileSync(readmePath, readme);
  }
  files.push("README.md");

  return files;
}

/**
 * Generate documentation
 */
async function generateDocumentation(
  _config: any,
  _outputDir: string,
  _options: GenerateOptions,
): Promise<string[]> {
  // Documentation generation will be handled by the docs command
  return [];
}

// Helper functions for CI workflow generation
function getSetupAction(language: string): string {
  switch (language) {
    case "typescript":
      return "actions/setup-node@v4";
    case "python":
      return "actions/setup-python@v4";
    case "rust":
      return "actions-rs/toolchain@v1";
    case "go":
      return "actions/setup-go@v4";
    default:
      return "actions/setup-node@v4";
  }
}

function getSetupActionConfig(language: string): string {
  switch (language) {
    case "typescript":
      return "with:\n        node-version: '20'";
    case "python":
      return "with:\n        python-version: '3.11'";
    case "rust":
      return "with:\n        toolchain: stable";
    case "go":
      return "with:\n        go-version: '1.21'";
    default:
      return "with:\n        node-version: '20'";
  }
}

function getPrerequisites(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun"
        ? "- [Bun](https://bun.sh) v1.0+"
        : "- [Node.js](https://nodejs.org) v18+\n- [npm](https://npmjs.com) or [yarn](https://yarnpkg.com)";
    case "python":
      return "- [Python](https://python.org) 3.8+\n- [pip](https://pip.pypa.io)";
    case "rust":
      return "- [Rust](https://rustup.rs) 1.70+";
    case "go":
      return "- [Go](https://golang.org) 1.21+";
    case "shell":
      return "- [Bash](https://www.gnu.org/software/bash/) 4.0+";
    default:
      return `- Development environment for ${language}`;
  }
}

function getInstallCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun install" : "npm install";
    case "python":
      return "pip install -e .";
    case "rust":
      return "cargo build";
    case "go":
      return "go mod tidy";
    case "shell":
      return "make install";
    default:
      return 'echo "Install command not defined"';
  }
}

function getRunCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun run src/index.ts" : "npm start";
    case "python":
      return "python -m " + "PLACEHOLDER";
    case "rust":
      return "cargo run";
    case "go":
      return "go run main.go";
    case "shell":
      return "./src/PLACEHOLDER";
    default:
      return 'echo "Run command not defined"';
  }
}

function getTestCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun test" : "npm test";
    case "python":
      return "pytest";
    case "rust":
      return "cargo test";
    case "go":
      return "go test ./...";
    case "shell":
      return "make test";
    default:
      return 'echo "Test command not defined"';
  }
}

function getBuildCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun build" : "npm run build";
    case "python":
      return "python -m build";
    case "rust":
      return "cargo build --release";
    case "go":
      return "go build";
    case "shell":
      return 'echo "No build step needed"';
    default:
      return 'echo "Build command not defined"';
  }
}

function getLintCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun run lint" : "npm run lint";
    case "python":
      return "ruff check . && mypy .";
    case "rust":
      return "cargo clippy -- -D warnings";
    case "go":
      return "golangci-lint run";
    case "shell":
      return "shellcheck src/*";
    default:
      return 'echo "Lint command not defined"';
  }
}
