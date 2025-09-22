#!/usr/bin/env bun
/**
 * Test scanner to verify package type detection
 */

import { getAllPlugins } from './plugins/index.js';
import { ScannerRunner } from './scanner.js';

async function main() {
  const projectPath = process.argv[2] || '/home/nathan/Projects/arbiter';

  console.log(`📦 Scanning project: ${projectPath}\n`);

  try {
    const scanner = new ScannerRunner({
      projectRoot: projectPath,
      debug: false,
      includeEvidence: false,
      plugins: getAllPlugins(),
    });

    const manifest = await scanner.scan();

    console.log('\nDetected Artifacts:');
    console.log('==================');

    // Group artifacts by type
    const byType: Record<string, any[]> = {};

    for (const artifact of manifest.artifacts) {
      const type = artifact.artifact?.type || 'unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(artifact);
    }

    // Display artifacts grouped by type
    for (const [type, artifacts] of Object.entries(byType)) {
      console.log(`\n${type.toUpperCase()}:`);
      for (const artifact of artifacts) {
        const name = artifact.artifact?.name || 'unnamed';
        console.log(`  - ${name}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Total artifacts: ${manifest.artifacts.length}`);

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const [type, artifacts] of Object.entries(byType)) {
      typeCounts[type] = artifacts.length;
    }

    for (const [type, count] of Object.entries(typeCounts)) {
      console.log(`  ${type}: ${count}`);
    }
  } catch (error) {
    console.error('Error scanning project:', error);
    process.exit(1);
  }
}

main();
