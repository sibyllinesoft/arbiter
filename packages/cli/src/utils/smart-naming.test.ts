/**
 * Tests for smart naming functionality
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FILE_PATTERNS,
  detectProjectContext,
  generateOutputPath,
  generateSmartFilename,
  resolveSmartNaming,
} from './smart-naming.js';

describe('Smart Naming', () => {
  const testDir = join(process.cwd(), '.test-smart-naming');

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('Project Context Detection', () => {
    it('should detect project name from package.json', async () => {
      const packageJson = {
        name: 'my-test-project',
        version: '1.0.0',
      };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const context = await detectProjectContext(testDir);
      expect(context.name).toBe('my-test-project');
      expect(context.packageJsonPath).toBe(join(testDir, 'package.json'));
    });

    it('should detect project name from assembly file', async () => {
      const assemblyContent = `
apiVersion: "arbiter.dev/v2"
metadata: {
  name: "assembly-project"
  version: "1.0.0"
}
`;
      writeFileSync(join(testDir, 'test.assembly.cue'), assemblyContent);

      const context = await detectProjectContext(testDir);
      expect(context.name).toBe('assembly-project');
      expect(context.assemblyFile).toBe(join(testDir, 'test.assembly.cue'));
    });

    it('should detect project name from Cargo.toml', async () => {
      const cargoContent = `[package]
name = "rust-project"
version = "0.1.0"
`;
      writeFileSync(join(testDir, 'Cargo.toml'), cargoContent);

      const context = await detectProjectContext(testDir);
      expect(context.name).toBe('rust-project');
    });

    it('should fall back to directory name', async () => {
      // Create directory with no config files
      const context = await detectProjectContext(testDir);
      expect(context.name).toBe('.test-smart-naming');
    });
  });

  describe('Smart Filename Generation', () => {
    it('should generate project-specific surface filename', () => {
      const filename = generateSmartFilename('surface', {
        projectName: 'myproject',
        useGenericNames: false,
      });
      expect(filename).toBe('myproject-surface.json');
    });

    it('should generate generic filename when requested', () => {
      const filename = generateSmartFilename('surface', {
        projectName: 'myproject',
        useGenericNames: true,
      });
      expect(filename).toBe('surface.json');
    });

    it('should sanitize project names', () => {
      const filename = generateSmartFilename('assembly', {
        projectName: '@scope/My Project!!',
        useGenericNames: false,
      });
      expect(filename).toBe('scope-my-project.assembly.cue');
    });

    it('should handle all file types', () => {
      const projectName = 'testproject';

      expect(generateSmartFilename('assembly', { projectName, useGenericNames: false })).toBe(
        'testproject.assembly.cue'
      );

      expect(generateSmartFilename('surface', { projectName, useGenericNames: false })).toBe(
        'testproject-surface.json'
      );

      expect(generateSmartFilename('versionPlan', { projectName, useGenericNames: false })).toBe(
        'testproject-version-plan.json'
      );

      expect(generateSmartFilename('apiSurface', { projectName, useGenericNames: false })).toBe(
        'testproject-api-surface.json'
      );
    });

    it('should respect explicit output override', () => {
      const filename = generateSmartFilename('surface', {
        output: 'custom-name.json',
        projectName: 'myproject',
        useGenericNames: false,
      });
      expect(filename).toBe('custom-name.json');
    });
  });

  describe('Output Path Generation', () => {
    it('should generate correct full paths', () => {
      const context = {
        name: 'myproject',
        directory: testDir,
        configFiles: [],
      };

      const path = generateOutputPath(
        'surface',
        {
          useGenericNames: false,
        },
        context
      );

      expect(path).toBe(join(testDir, 'myproject-surface.json'));
    });

    it('should use custom output directory', () => {
      const outputDir = join(testDir, 'output');
      mkdirSync(outputDir);

      const path = generateOutputPath('assembly', {
        outputDir,
        projectName: 'test',
        useGenericNames: false,
      });

      expect(path).toBe(join(outputDir, 'test.assembly.cue'));
    });
  });

  describe('Full Smart Naming Resolution', () => {
    it('should resolve complete naming for a project', async () => {
      const packageJson = {
        name: 'full-test-project',
        version: '1.0.0',
      };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await resolveSmartNaming('surface', {
        outputDir: testDir,
        useGenericNames: false,
      });

      expect(result.filename).toBe('full-test-project-surface.json');
      expect(result.fullPath).toBe(join(testDir, 'full-test-project-surface.json'));
      expect(result.context.name).toBe('full-test-project');
      expect(result.isGeneric).toBe(false);
    });

    it('should detect generic naming preference', async () => {
      // Create existing generic file
      writeFileSync(join(testDir, 'surface.json'), '{}');

      const result = await resolveSmartNaming('surface', {
        outputDir: testDir,
      });

      // Should use generic if existing files are generic
      expect(result.isGeneric).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with explicit generic names', () => {
      Object.entries(FILE_PATTERNS).forEach(([type, pattern]) => {
        const filename = generateSmartFilename(type as any, {
          useGenericNames: true,
        });
        expect(filename).toBe(pattern.default);
      });
    });

    it('should allow explicit output to override everything', () => {
      const filename = generateSmartFilename('surface', {
        output: 'override.json',
        projectName: 'test',
        useGenericNames: false,
      });
      expect(filename).toBe('override.json');
    });
  });
});
