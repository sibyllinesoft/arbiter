#!/usr/bin/env node

/**
 * Arbiter CLI Wrapper
 * 
 * This is a simple wrapper that delegates to the built CLI in packages/cli/dist/cli.js
 * It ensures the CLI can be run from anywhere while maintaining the modular structure.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the actual CLI implementation
const cliPath = join(__dirname, 'packages', 'cli', 'dist', 'cli.js');

// Forward all arguments to the actual CLI
const args = process.argv.slice(2);

const child = spawn('node', [cliPath, ...args], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start CLI:', err.message);
  process.exit(1);
});