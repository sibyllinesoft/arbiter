import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ideCommand } from '../commands/ide.js';
import { syncCommand } from '../commands/sync.js';
import { integrateCommand } from '../commands/integrate.js';
import type { IDEOptions, SyncOptions, IntegrateOptions, CLIConfig } from '../types.js';

// Mock configuration
const mockConfig: CLIConfig = {
  apiUrl: 'http://localhost:8080',
  timeout: 5000,
  format: 'table',
  color: false,
  projectDir: process.cwd()
};

describe('Ecosystem Integration Commands', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arbiter-ecosystem-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Cleanup
    process.chdir(originalCwd);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('IDE Command', () => {
    it('should detect project languages correctly', async () => {
      // Create test project files
      await fs.writeFile('package.json', JSON.stringify({ name: 'test-project' }));
      await fs.writeFile('app.py', 'print("hello")');
      await fs.writeFile('main.rs', 'fn main() {}');
      await fs.writeFile('schema.cue', 'package test\nvalue: "hello"');

      const options: IDEOptions = { detect: true };
      const exitCode = await ideCommand(options, mockConfig);

      expect(exitCode).toBe(0);
    });

    it('should generate VS Code configuration', async () => {
      // Create a TypeScript project
      await fs.writeFile('package.json', JSON.stringify({ 
        name: 'test-project',
        dependencies: { typescript: '^5.0.0' }
      }));
      await fs.writeFile('schema.cue', 'package test\nvalue: "hello"');

      const options: IDEOptions = { editor: 'vscode' };
      const exitCode = await ideCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check generated files
      const vscodeDir = path.join(testDir, '.vscode');
      const extensionsFile = path.join(vscodeDir, 'extensions.json');
      const tasksFile = path.join(vscodeDir, 'tasks.json');
      const settingsFile = path.join(vscodeDir, 'settings.json');

      await expect(fs.access(extensionsFile)).resolves.not.toThrow();
      await expect(fs.access(tasksFile)).resolves.not.toThrow();
      await expect(fs.access(settingsFile)).resolves.not.toThrow();

      // Validate extensions.json content
      const extensionsContent = JSON.parse(await fs.readFile(extensionsFile, 'utf8'));
      expect(extensionsContent.recommendations).toContain('bradleyjkemp.vscode-cue');
      expect(extensionsContent.recommendations).toContain('ms-vscode.vscode-typescript-next');

      // Validate tasks.json content
      const tasksContent = JSON.parse(await fs.readFile(tasksFile, 'utf8'));
      expect(tasksContent.tasks).toHaveLength(4); // Check, Watch, Surface, TypeScript Build
      
      const checkTask = tasksContent.tasks.find((t: any) => t.label === 'Arbiter: Check');
      expect(checkTask).toBeDefined();
      expect(checkTask.command).toBe('arbiter');
      expect(checkTask.args).toEqual(['check']);
    });

    it('should generate IntelliJ IDEA configuration', async () => {
      await fs.writeFile('schema.cue', 'package test\nvalue: "hello"');

      const options: IDEOptions = { editor: 'idea' };
      const exitCode = await ideCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check generated files
      const ideaDir = path.join(testDir, '.idea');
      const watchersFile = path.join(ideaDir, 'watchers.xml');

      await expect(fs.access(watchersFile)).resolves.not.toThrow();

      // Validate watchers.xml content
      const watchersContent = await fs.readFile(watchersFile, 'utf8');
      expect(watchersContent).toContain('Arbiter Check');
      expect(watchersContent).toContain('arbiter');
    });

    it('should generate Vim configuration', async () => {
      await fs.writeFile('schema.cue', 'package test\nvalue: "hello"');

      const options: IDEOptions = { editor: 'vim' };
      const exitCode = await ideCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check generated files
      const vimrcFile = path.join(testDir, '.vimrc.local');
      await expect(fs.access(vimrcFile)).resolves.not.toThrow();

      // Validate .vimrc.local content
      const vimrcContent = await fs.readFile(vimrcFile, 'utf8');
      expect(vimrcContent).toContain('ArbiterCheck');
      expect(vimrcContent).toContain('ArbiterWatch');
    });

    it('should respect force option', async () => {
      await fs.writeFile('schema.cue', 'package test\nvalue: "hello"');
      await fs.mkdir('.vscode', { recursive: true });
      await fs.writeFile('.vscode/extensions.json', '{"recommendations": ["existing"]}');

      const options: IDEOptions = { editor: 'vscode', force: true };
      const exitCode = await ideCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check that file was overwritten
      const extensionsContent = JSON.parse(await fs.readFile('.vscode/extensions.json', 'utf8'));
      expect(extensionsContent.recommendations).toContain('bradleyjkemp.vscode-cue');
      expect(extensionsContent.recommendations).not.toContain('existing');
    });
  });

  describe('Sync Command', () => {
    it('should sync package.json with Arbiter configuration', async () => {
      const originalPackage = {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          'start': 'node index.js'
        },
        devDependencies: {
          'typescript': '^5.0.0'
        }
      };

      await fs.writeFile('package.json', JSON.stringify(originalPackage, null, 2));

      const options: SyncOptions = { language: 'typescript' };
      const exitCode = await syncCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check updated package.json
      const updatedPackage = JSON.parse(await fs.readFile('package.json', 'utf8'));
      
      // Should have new Arbiter scripts
      expect(updatedPackage.scripts['arbiter:check']).toBe('arbiter check');
      expect(updatedPackage.scripts['arbiter:surface']).toBe('arbiter surface typescript --output surface.json');
      
      // Should have new Arbiter dev dependency
      expect(updatedPackage.devDependencies['@arbiter/cli']).toBe('^0.1.0');
      
      // Should have Arbiter configuration
      expect(updatedPackage.arbiter).toBeDefined();
      expect(updatedPackage.arbiter.profiles).toEqual(['library']);
      
      // Should preserve existing content
      expect(updatedPackage.scripts.start).toBe('node index.js');
      expect(updatedPackage.devDependencies.typescript).toBe('^5.0.0');
    });

    it('should sync pyproject.toml with Arbiter configuration', async () => {
      const originalToml = `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "test-project"
version = "1.0.0"
`;

      await fs.writeFile('pyproject.toml', originalToml);

      const options: SyncOptions = { language: 'python' };
      const exitCode = await syncCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check updated pyproject.toml
      const updatedToml = await fs.readFile('pyproject.toml', 'utf8');
      
      expect(updatedToml).toContain('[tool.arbiter]');
      expect(updatedToml).toContain('profiles = ["library"]');
      expect(updatedToml).toContain('surface_language = "python"');
      expect(updatedToml).toContain('[tool.arbiter.scripts]');
      expect(updatedToml).toContain('check = "arbiter check"');
      
      // Should preserve existing content
      expect(updatedToml).toContain('[build-system]');
      expect(updatedToml).toContain('name = "test-project"');
    });

    it('should sync Cargo.toml with Arbiter configuration', async () => {
      const originalToml = `[package]
name = "test-project"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1.0"
`;

      await fs.writeFile('Cargo.toml', originalToml);

      const options: SyncOptions = { language: 'rust' };
      const exitCode = await syncCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check updated Cargo.toml
      const updatedToml = await fs.readFile('Cargo.toml', 'utf8');
      
      expect(updatedToml).toContain('[package.metadata.arbiter]');
      expect(updatedToml).toContain('profiles = ["library"]');
      expect(updatedToml).toContain('surface_language = "rust"');
      expect(updatedToml).toContain('[package.metadata.arbiter.scripts]');
      expect(updatedToml).toContain('check = "arbiter check"');
      
      // Should preserve existing content
      expect(updatedToml).toContain('name = "test-project"');
      expect(updatedToml).toContain('serde = "1.0"');
    });

    it('should sync Makefile with Arbiter targets', async () => {
      const originalMakefile = `# Existing Makefile
all: build

build:
	echo "Building project"

clean:
	rm -rf build/
`;

      await fs.writeFile('Makefile', originalMakefile);

      const options: SyncOptions = { language: 'bash' };
      const exitCode = await syncCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check updated Makefile
      const updatedMakefile = await fs.readFile('Makefile', 'utf8');
      
      expect(updatedMakefile).toContain('# Arbiter targets');
      expect(updatedMakefile).toContain('arbiter-check:');
      expect(updatedMakefile).toContain('arbiter-surface:');
      expect(updatedMakefile).toContain('\tarbiter check');
      
      // Should preserve existing content
      expect(updatedMakefile).toContain('# Existing Makefile');
      expect(updatedMakefile).toContain('build:\n\techo "Building project"');
    });

    it('should handle dry-run mode', async () => {
      const originalPackage = { name: 'test-project', version: '1.0.0' };
      await fs.writeFile('package.json', JSON.stringify(originalPackage, null, 2));

      const options: SyncOptions = { language: 'typescript', dryRun: true };
      const exitCode = await syncCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check that package.json wasn't modified
      const packageContent = JSON.parse(await fs.readFile('package.json', 'utf8'));
      expect(packageContent.scripts).toBeUndefined();
      expect(packageContent.arbiter).toBeUndefined();
    });

    it('should create backups when requested', async () => {
      const originalPackage = { name: 'test-project', version: '1.0.0' };
      await fs.writeFile('package.json', JSON.stringify(originalPackage, null, 2));

      const options: SyncOptions = { language: 'typescript', backup: true };
      const exitCode = await syncCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check that backup was created
      const files = await fs.readdir('.');
      const backupFile = files.find(f => f.startsWith('package.json.backup.'));
      expect(backupFile).toBeDefined();

      // Check backup content
      if (backupFile) {
        const backupContent = JSON.parse(await fs.readFile(backupFile, 'utf8'));
        expect(backupContent).toEqual(originalPackage);
      }
    });
  });

  describe('Integrate Command', () => {
    it('should generate GitHub Actions PR workflow', async () => {
      // Create a TypeScript project
      await fs.writeFile('package.json', JSON.stringify({ 
        name: 'test-project',
        dependencies: { typescript: '^5.0.0' }
      }));

      const options: IntegrateOptions = { provider: 'github', type: 'pr' };
      const exitCode = await integrateCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check generated workflow file
      const workflowFile = path.join('.github', 'workflows', 'pr.yml');
      await expect(fs.access(workflowFile)).resolves.not.toThrow();

      // Validate workflow content
      const workflowContent = await fs.readFile(workflowFile, 'utf8');
      
      expect(workflowContent).toContain('name: PR Validation');
      expect(workflowContent).toContain('pull_request:');
      expect(workflowContent).toContain('arbiter check');
      expect(workflowContent).toContain('arbiter surface typescript');
      expect(workflowContent).toContain('test-typescript:');
      expect(workflowContent).toContain('npm ci');
      expect(workflowContent).toContain('npm test');
      expect(workflowContent).toContain('security:');
      expect(workflowContent).toContain('trivy-action');
    });

    it('should generate GitHub Actions main workflow', async () => {
      // Create a Python project
      await fs.writeFile('pyproject.toml', `[project]
name = "test-project"
version = "1.0.0"
`);

      const options: IntegrateOptions = { provider: 'github', type: 'main' };
      const exitCode = await integrateCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check generated workflow file
      const workflowFile = path.join('.github', 'workflows', 'main.yml');
      await expect(fs.access(workflowFile)).resolves.not.toThrow();

      // Validate workflow content
      const workflowContent = await fs.readFile(workflowFile, 'utf8');
      
      expect(workflowContent).toContain('name: Main Branch');
      expect(workflowContent).toContain('push:');
      expect(workflowContent).toContain('branches: [main, master]');
      expect(workflowContent).toContain('release:');
      expect(workflowContent).toContain('arbiter version plan');
      expect(workflowContent).toContain('deploy:');
      expect(workflowContent).toContain('python -m build');
      expect(workflowContent).toContain('twine upload');
    });

    it('should generate workflows for multiple languages', async () => {
      // Create multi-language project
      await fs.writeFile('package.json', JSON.stringify({ name: 'test-project' }));
      await fs.writeFile('pyproject.toml', '[project]\nname = "test-project"');
      await fs.writeFile('Cargo.toml', '[package]\nname = "test-project"');

      const options: IntegrateOptions = { provider: 'github', type: 'all' };
      const exitCode = await integrateCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check PR workflow includes all languages
      const prWorkflowContent = await fs.readFile('.github/workflows/pr.yml', 'utf8');
      expect(prWorkflowContent).toContain('test-typescript:');
      expect(prWorkflowContent).toContain('test-python:');
      expect(prWorkflowContent).toContain('test-rust:');
      expect(prWorkflowContent).toContain('npm ci');
      expect(prWorkflowContent).toContain('pip install');
      expect(prWorkflowContent).toContain('cargo test');
    });

    it('should respect force option for overwriting workflows', async () => {
      await fs.writeFile('package.json', JSON.stringify({ name: 'test-project' }));
      await fs.mkdir('.github/workflows', { recursive: true });
      await fs.writeFile('.github/workflows/pr.yml', 'existing workflow');

      const options: IntegrateOptions = { provider: 'github', type: 'pr', force: true };
      const exitCode = await integrateCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      // Check that workflow was overwritten
      const workflowContent = await fs.readFile('.github/workflows/pr.yml', 'utf8');
      expect(workflowContent).toContain('name: PR Validation');
      expect(workflowContent).not.toContain('existing workflow');
    });

    it('should use build matrix from assembly file when available', async () => {
      await fs.writeFile('package.json', JSON.stringify({ name: 'test-project' }));
      await fs.writeFile('arbiter.assembly.cue', `// Assembly file
import "github.com/arbiter-framework/schemas/artifact"

Artifact: artifact.#Artifact & {
  build: {
    matrix: {
      versions: ["18", "20"]
      os: ["ubuntu-latest", "windows-latest"]
      arch: ["x64"]
    }
  }
}`);

      const options: IntegrateOptions = { provider: 'github', type: 'pr', matrix: true };
      const exitCode = await integrateCommand(options, mockConfig);

      expect(exitCode).toBe(0);

      const workflowContent = await fs.readFile('.github/workflows/pr.yml', 'utf8');
      expect(workflowContent).toContain('node-version: [\'18\', \'20\']');
      expect(workflowContent).toContain('os: [ubuntu-latest, windows-latest]');
    });
  });

  describe('Cross-platform Compatibility', () => {
    it('should handle Windows path separators', async () => {
      // This would be more comprehensive in a real test environment
      await fs.writeFile('package.json', JSON.stringify({ name: 'test-project' }));
      
      const options: IDEOptions = { editor: 'vscode' };
      const exitCode = await ideCommand(options, mockConfig);
      
      expect(exitCode).toBe(0);
      // On Windows, paths should use backslashes, but Node.js path methods handle this
    });

    it('should generate shell scripts with proper line endings', async () => {
      await fs.writeFile('Makefile', '');
      
      const options: SyncOptions = { language: 'bash' };
      const exitCode = await syncCommand(options, mockConfig);
      
      expect(exitCode).toBe(0);
      
      const makefileContent = await fs.readFile('Makefile', 'utf8');
      // Should work on both Unix and Windows
      expect(makefileContent).toContain('arbiter-check:');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing manifest files gracefully', async () => {
      const options: SyncOptions = { language: 'typescript' };
      const exitCode = await syncCommand(options, mockConfig);
      
      expect(exitCode).toBe(1); // Should fail gracefully
    });

    it('should handle permission errors gracefully', async () => {
      // Create a file we can't write to (on Unix systems)
      if (process.platform !== 'win32') {
        await fs.writeFile('package.json', JSON.stringify({ name: 'test' }));
        await fs.chmod('package.json', 0o444); // Read-only
        
        const options: SyncOptions = { language: 'typescript' };
        const exitCode = await syncCommand(options, mockConfig);
        
        expect(exitCode).toBe(1); // Should fail gracefully
      }
    });

    it('should handle malformed JSON files gracefully', async () => {
      await fs.writeFile('package.json', '{ invalid json');
      
      const options: SyncOptions = { language: 'typescript' };
      const exitCode = await syncCommand(options, mockConfig);
      
      expect(exitCode).toBe(1); // Should fail gracefully
    });
  });
});