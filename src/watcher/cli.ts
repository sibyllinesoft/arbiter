#!/usr/bin/env bun
/**
 * CLI entry point for the arbiter file watcher
 */

import { startFileWatcherCLI } from './watcher.js';

// If this file is being run directly
if (import.meta.main) {
  startFileWatcherCLI(process.argv.slice(2)).catch((error) => {
    console.error('Failed to start file watcher:', error);
    process.exit(1);
  });
}