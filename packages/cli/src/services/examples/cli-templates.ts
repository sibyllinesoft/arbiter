/**
 * @packageDocumentation
 * CLI example templates for the examples command.
 *
 * Provides template content for:
 * - CLI package.json configuration
 * - CLI entry point and command files
 * - CLI test file templates
 */

import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";

export function getCliPackageJson(): string {
  return `{
  "name": "example-cli",
  "version": "0.1.0",
  "description": "Example TypeScript CLI with Arbiter integration",
  "bin": {
    "example-cli": "./bin/cli.js"
  },
  "main": "./dist/cli.js",
  "files": [
    "dist",
    "bin"
  ],
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "dev": "tsx src/cli.ts",
    "arbiter:check": "arbiter check",
    "arbiter:surface": "arbiter surface typescript"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "chalk": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0"
  },
  "keywords": ["cli", "typescript", "arbiter"],
  "license": "MIT"
}`;
}

export function getCliSrc(): string {
  return `#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { helloCommand } from './commands/hello.js';

const program = new Command();

program
  .name('example-cli')
  .description('Example CLI tool with Arbiter integration')
  .version('0.1.0');

// Hello command
program
  .command('hello [name]')
  .description('greet someone')
  .option('-u, --uppercase', 'uppercase the output')
  .option('-c, --count <number>', 'number of greetings', '1')
  .action(async (name: string | undefined, options: { uppercase?: boolean; count?: string }) => {
    try {
      const exitCode = await helloCommand(name, options);
      process.exit(exitCode);
    } catch (error) {
      console.error(chalk.red('Command failed:'), error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  });

// Parse command line arguments
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  program.parse();
}

export default program;`;
}

export function getCliHelloCommand(): string {
  return `import chalk from 'chalk';

export interface HelloOptions {
  uppercase?: boolean;
  count?: string;
}

export async function helloCommand(name: string | undefined, options: HelloOptions): Promise<number> {
  const greeting = \`Hello, \${name || 'World'}!\`;
  const count = parseInt(options.count || '1', 10);

  if (isNaN(count) || count <= 0) {
    console.error(chalk.red('Count must be a positive number'));
    return 1;
  }

  for (let i = 0; i < count; i++) {
    const message = options.uppercase ? greeting.toUpperCase() : greeting;
    console.log(chalk.green(message));
  }

  return 0;
}`;
}

export function getCliBin(): string {
  return `#!/usr/bin/env node

// Simple wrapper to run the compiled CLI
require('../dist/cli.js');`;
}

export function getCliTests(): string {
  return `import { describe, it, expect } from 'bun:test';
import { helloCommand } from '../src/commands/hello.js';

describe('helloCommand', () => {
  it('should return success code', async () => {
    const exitCode = await helloCommand('Test', {});
    expect(exitCode).toBe(0);
  });

  it('should handle invalid count', async () => {
    const exitCode = await helloCommand('Test', { count: 'invalid' });
    expect(exitCode).toBe(1);
  });

  it('should handle zero count', async () => {
    const exitCode = await helloCommand('Test', { count: '0' });
    expect(exitCode).toBe(1);
  });
});`;
}

export function getCliAssemblyCue(): string {
  return `// TypeScript CLI - Arbiter Assembly Configuration
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "cli"
  language: "typescript"
  metadata: {
    name: "example-cli"
    version: "0.1.0"
    description: "Example TypeScript CLI with Arbiter integration"
  }

  build: {
    tool: "bun"
    targets: ["./src/cli.ts"]
  }
}

Profile: profiles.#cli & {
  commands: [
    {
      name: "hello"
      summary: "Greet someone"
      args: [
        {name: "name", type: "string", optional: true, description: "Name to greet"}
      ]
      flags: [
        {name: "uppercase", type: "bool", default: false, description: "Uppercase output"}
        {name: "count", type: "int", default: 1, description: "Number of greetings"}
      ]
      exits: [
        {code: 0, meaning: "success"}
        {code: 1, meaning: "invalid_input"}
        {code: 2, meaning: "command_error"}
      ]
      io: {
        in: "none"
        out: "stdout"
      }
    }
  ]

  tests: {
    golden: [
      {
        name: "help_output"
        command: ["--help"]
        expect_exit: 0
      },
      {
        name: "hello_basic"
        command: ["hello"]
        expect_exit: 0
      },
      {
        name: "hello_with_name"
        command: ["hello", "Alice"]
        expect_exit: 0
      }
    ]

    property: [
      {
        name: "valid_exit_codes"
        description: "Commands should only return documented exit codes"
      }
    ]
  }
}`;
}

export function getCliReadme(pm: PackageManagerCommandSet): string {
  return `# Example CLI

A TypeScript CLI tool example with Arbiter integration, demonstrating command-line interface best practices.

## Installation

\`\`\`bash
${pm.installGlobal("example-cli")}
\`\`\`

## Usage

\`\`\`bash
# Basic greeting
example-cli hello

# Greet someone specific
example-cli hello Alice

# Uppercase output
example-cli hello Bob --uppercase

# Multiple greetings
example-cli hello Charlie --count 3
\`\`\`

## Development

\`\`\`bash
${pm.install}
${pm.run("dev")} hello Alice
\`\`\`

## Arbiter Integration

\`\`\`bash
# Validate CLI contracts
arbiter check

# Generate tests from command specifications
arbiter tests scaffold --language typescript

# Test golden outputs
arbiter tests run --types golden
\`\`\``;
}
