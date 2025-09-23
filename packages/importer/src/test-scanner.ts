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
      debug: true,
      plugins: getAllPlugins(),
    });

    const manifest = await scanner.scan();

    console.log('\nDetected Artifacts per Config:');
    console.log('==============================');

    for (const [config, artifacts] of Object.entries(manifest.perConfig)) {
      console.log(`\nConfig: ${config}`);
      console.log('----------------');

      // Group by type for this config
      const byType: Record<string, any[]> = {};
      for (const artifact of artifacts) {
        const type = artifact.artifact?.type || 'unknown';
        if (!byType[type]) byType[type] = [];
        byType[type].push(artifact);
      }

      for (const [type, arts] of Object.entries(byType)) {
        console.log(`  ${type.toUpperCase()}: ${arts.length}`);
        for (const art of arts.slice(0, 3)) {
          // Show first 3
          console.log(`    - ${art.artifact.name}`);
        }
        if (arts.length > 3) console.log(`      ... and ${arts.length - 3} more`);
      }
    }

    const allArtifacts = Object.values(manifest.perConfig).flat();
    console.log(`\n📊 Summary:`);
    console.log(`  Total configs: ${Object.keys(manifest.perConfig).length}`);
    console.log(`  Total artifacts: ${allArtifacts.length}`);

    // Overall type counts
    const typeCounts: Record<string, number> = {};
    for (const artifact of allArtifacts) {
      const type = artifact.artifact?.type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
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
