#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check for required dependencies for e2e Docker Compose tests
 */
class DependencyChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Check if a command exists in PATH
   */
  commandExists(command) {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get version of a command
   */
  getVersion(command, versionFlag = '--version') {
    try {
      const output = execSync(`${command} ${versionFlag}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return output.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Check Docker installation
   */
  checkDocker() {
    console.log('🐳 Checking Docker...');

    if (!this.commandExists('docker')) {
      this.errors.push('Docker is not installed or not in PATH');
      return;
    }

    const version = this.getVersion('docker');
    console.log(`  ✅ Docker found: ${version}`);

    // Check if Docker daemon is running
    try {
      execSync('docker info', { stdio: 'ignore' });
      console.log('  ✅ Docker daemon is running');
    } catch (error) {
      this.errors.push('Docker daemon is not running. Please start Docker.');
    }
  }

  /**
   * Check Docker Compose installation
   */
  checkDockerCompose() {
    console.log('🔧 Checking Docker Compose...');

    // Check for docker-compose (standalone)
    if (this.commandExists('docker-compose')) {
      const version = this.getVersion('docker-compose');
      console.log(`  ✅ Docker Compose (standalone) found: ${version}`);
      return;
    }

    // Check for docker compose (plugin)
    try {
      const version = this.getVersion('docker', 'compose version');
      console.log(`  ✅ Docker Compose (plugin) found: ${version}`);
    } catch (error) {
      this.errors.push('Docker Compose is not installed. Please install Docker Compose.');
    }
  }

  /**
   * Check CUE installation
   */
  checkCue() {
    console.log('📝 Checking CUE...');

    if (!this.commandExists('cue')) {
      this.errors.push(
        'CUE is not installed. Please install CUE from https://cuelang.org/docs/install/'
      );
      return;
    }

    const version = this.getVersion('cue');
    console.log(`  ✅ CUE found: ${version}`);
  }

  /**
   * Check Node.js installation
   */
  checkNode() {
    console.log('🟢 Checking Node.js...');

    if (!this.commandExists('node')) {
      this.errors.push('Node.js is not installed');
      return;
    }

    const version = this.getVersion('node');
    console.log(`  ✅ Node.js found: ${version}`);

    // Check for minimum version (18+)
    try {
      const versionNum = execSync('node --version', { encoding: 'utf8' }).trim();
      const majorVersion = parseInt(versionNum.replace('v', '').split('.')[0]);

      if (majorVersion < 18) {
        this.warnings.push(`Node.js version ${versionNum} is older than recommended (18+)`);
      }
    } catch (error) {
      this.warnings.push('Could not determine Node.js version');
    }
  }

  /**
   * Check npm installation
   */
  checkNpm() {
    console.log('📦 Checking npm...');

    if (!this.commandExists('npm')) {
      this.errors.push('npm is not installed');
      return;
    }

    const version = this.getVersion('npm');
    console.log(`  ✅ npm found: ${version}`);
  }

  /**
   * Check available disk space
   */
  checkDiskSpace() {
    console.log('💾 Checking disk space...');

    try {
      const output = execSync('df -h .', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      if (lines.length > 1) {
        const spaceInfo = lines[1].split(/\s+/);
        const available = spaceInfo[3];
        console.log(`  ✅ Available disk space: ${available}`);

        // Parse available space (rough check)
        const availableNum = parseFloat(available);
        const unit = available.slice(-1);

        if (unit === 'M' && availableNum < 500) {
          this.warnings.push('Less than 500MB disk space available');
        } else if (unit === 'G' && availableNum < 1) {
          this.warnings.push('Less than 1GB disk space available');
        }
      }
    } catch (error) {
      this.warnings.push('Could not check disk space');
    }
  }

  /**
   * Check for required test files
   */
  checkTestFiles() {
    console.log('📁 Checking test files...');

    const requiredFiles = [
      'specs/docker-compose.cue',
      'services/node-app/package.json',
      'services/node-app/server.js',
      'services/node-app/Dockerfile',
      'services/nginx/nginx.conf',
    ];

    const basePath = path.join(__dirname, '..');

    for (const file of requiredFiles) {
      const filePath = path.join(basePath, file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`Required test file missing: ${file}`);
      } else {
        console.log(`  ✅ Found: ${file}`);
      }
    }
  }

  /**
   * Check network connectivity
   */
  checkNetworkConnectivity() {
    console.log('🌐 Checking network connectivity...');

    try {
      // Test Docker Hub connectivity
      execSync('docker pull hello-world:latest', { stdio: 'ignore' });
      console.log('  ✅ Docker Hub connectivity working');
    } catch (error) {
      this.warnings.push('Could not connect to Docker Hub. Internet connection may be limited.');
    }
  }

  /**
   * Run all checks
   */
  runAllChecks() {
    console.log('🔍 Running dependency checks for e2e Docker Compose tests...\n');

    this.checkDocker();
    this.checkDockerCompose();
    this.checkCue();
    this.checkNode();
    this.checkNpm();
    this.checkDiskSpace();
    this.checkTestFiles();
    this.checkNetworkConnectivity();

    // Print results
    console.log('\n📊 Dependency Check Results:');

    if (this.errors.length === 0) {
      console.log('✅ All required dependencies are available!');
    } else {
      console.log('❌ Missing required dependencies:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 System is ready for e2e Docker Compose testing!');
      return true;
    }

    return this.errors.length === 0;
  }
}

// Run checks if called directly
if (require.main === module) {
  const checker = new DependencyChecker();
  const success = checker.runAllChecks();
  process.exit(success ? 0 : 1);
}

module.exports = DependencyChecker;
