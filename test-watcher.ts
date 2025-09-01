#!/usr/bin/env bun
/**
 * Simple test script for the file watcher system
 */

import { createFileWatcher } from './src/watcher/index.js';
import { createWriteStream } from 'fs';

async function testWatcher() {
  console.log('Starting file watcher test...');
  
  // Create a test output stream
  const outputStream = createWriteStream('./watcher-test-output.ndjson');
  
  // Create watcher for test-cue-files directory
  const watcher = createFileWatcher(['./test-cue-files'], {
    validation: {
      debounceMs: 100, // Faster for testing
      batchSize: 5,
      timeout: 10000,
      enableContracts: false, // Disable to avoid contract engine errors
      enableDependencyCheck: true,
      parallelValidations: 2,
    },
    output: {
      format: 'ndjson',
      stream: outputStream,
      bufferSize: 10,
      flushInterval: 500,
    },
    heartbeat: {
      enabled: true,
      interval: 5000, // Every 5 seconds
    },
  });

  // Set up event handlers
  watcher.on('ready', () => {
    console.log('✅ Watcher is ready');
  });

  watcher.on('file-event', (event) => {
    console.log(`📁 File event: ${event.type} - ${event.path}`);
  });

  watcher.on('validation-result', (result) => {
    const status = result.status === 'success' ? '✅' : 
                   result.status === 'error' ? '❌' : 
                   result.status === 'warning' ? '⚠️' : '🔄';
    console.log(`${status} Validation: ${result.filePath} - ${result.status} (${result.duration}ms)`);
    
    if (result.errors.length > 0) {
      result.errors.forEach(err => {
        console.log(`  Error: ${err.message}`);
      });
    }
  });

  watcher.on('error', (error) => {
    console.error('❌ Watcher error:', error.message);
  });

  try {
    // Start the watcher
    await watcher.start();
    
    // Let it run for 30 seconds
    setTimeout(async () => {
      console.log('⏰ Test complete, stopping watcher...');
      await watcher.stop();
      outputStream.end();
      
      console.log('✅ Test completed. Check watcher-test-output.ndjson for structured output.');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test if this script is executed directly
if (import.meta.main) {
  testWatcher().catch(console.error);
}