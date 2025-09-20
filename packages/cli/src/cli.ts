#!/usr/bin/env node

/**
 * Arbiter CLI - Main entry point
 *
 * This is the main CLI entry point that imports and uses the modular CLI structure.
 */

import program from './cli/index.js';

// Parse command line arguments
program.parse();
