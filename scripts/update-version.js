#!/usr/bin/env node

/**
 * Update version script for Arbiter monorepo
 * Usage: node update-version.js <new-version>
 */

const fs = require('node:fs');
const path = require('node:path');

function updatePackageJson(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Package file not found: ${filePath}`);
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const pkg = JSON.parse(content);
    const oldVersion = pkg.version;

    pkg.version = newVersion;

    fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`✅ Updated ${filePath}: ${oldVersion} → ${newVersion}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  const newVersion = process.argv[2];

  if (!newVersion) {
    console.error('❌ Usage: node update-version.js <new-version>');
    console.error('   Example: node update-version.js 1.2.3');
    process.exit(1);
  }

  // Validate semver format
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?(?:\+([a-zA-Z0-9\-\.]+))?$/;
  if (!semverRegex.test(newVersion)) {
    console.error(`❌ Invalid semver format: ${newVersion}`);
    console.error('   Expected format: MAJOR.MINOR.PATCH[-prerelease][+buildmetadata]');
    process.exit(1);
  }

  console.log(`🔄 Updating all packages to version ${newVersion}...`);

  const packageFiles = [
    './package.json',
    './packages/cli/package.json',
    './packages/shared/package.json',
    './apps/api/package.json',
  ];

  // Check for additional package.json files
  const additionalPackages = [];
  try {
    const { execSync } = require('node:child_process');
    const findOutput = execSync(
      'find apps/ packages/ -name package.json -not -path "*/node_modules/*"',
      { encoding: 'utf8' }
    );
    const foundPackages = findOutput
      .trim()
      .split('\n')
      .filter(p => p && !packageFiles.includes(p));
    additionalPackages.push(...foundPackages);
  } catch (e) {
    console.log('ℹ️  Could not search for additional packages');
  }

  const allPackages = [...packageFiles, ...additionalPackages];
  let successCount = 0;
  let totalCount = 0;

  for (const packageFile of allPackages) {
    totalCount++;
    if (updatePackageJson(packageFile, newVersion)) {
      successCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Updated: ${successCount}/${totalCount} packages`);

  if (successCount === totalCount) {
    console.log('✅ All packages updated successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Some packages failed to update');
    process.exit(1);
  }
}

main();
