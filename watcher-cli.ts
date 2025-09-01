#!/usr/bin/env bun
/**
 * CLI wrapper for the arbiter file watcher
 */

import { startFileWatcherCLI } from './src/watcher/watcher.js';

if (import.meta.main) {
  const args = process.argv.slice(2);
  
  console.error('🔍 Arbiter File Watcher');
  console.error('Monitoring CUE files for real-time validation...');
  console.error('Output: NDJSON to stdout');
  console.error('Control messages: stderr');
  console.error('Press Ctrl+C to stop\n');
  
  startFileWatcherCLI(args).catch((error) => {
    console.error('❌ Watcher failed:', error);
    process.exit(1);
  });
}