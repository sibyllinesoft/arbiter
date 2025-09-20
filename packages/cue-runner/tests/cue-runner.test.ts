import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CueRunner, cueFixtures, parseCueToAst } from '../src/index.js';

const tempDirs: string[] = [];

function createWorkspace(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'cue-runner-'));
  tempDirs.push(dir);

  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(dir, relative);
    const folder = path.dirname(absolute);
    Bun.spawnSync(['mkdir', '-p', folder]);
    writeFileSync(absolute, content, 'utf-8');
  }

  return dir;
}

describe('CueRunner', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('vet reports schema conflict diagnostics', async () => {
    const workspace = createWorkspace({
      'bad.cue': `package demo
value: {
    foo: string
    foo: int
}
`,
    });

    const runner = new CueRunner({ cwd: workspace });
    const result = await runner.vet(['./...']);

    expect(result.success).toBeFalse();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].message).toContain('conflicting');
  });

  test('exportJson returns resolved object', async () => {
    const workspace = createWorkspace({
      'app.cue': cueFixtures.validSpec,
    });

    const runner = new CueRunner({ cwd: workspace });
    const result = await runner.exportJson(['./...']);

    expect(result.success).toBeTrue();
    expect(result.value).toBeDefined();
    expect(result.value?.service).toEqual({ name: 'example', replicas: 3, ports: [80, 443] });
  });

  test('parseCueToAst produces tree for valid content', async () => {
    const ast = await parseCueToAst(cueFixtures.validSpec);
    expect(ast.root.children.length).toBeGreaterThan(0);
    const serviceNode = ast.root.children.find(node => node.path.endsWith('.service'));
    expect(serviceNode).toBeDefined();
  });

  test('parseCueToAst surfaces errors for bad content', async () => {
    await expect(parseCueToAst(cueFixtures.conflictingFields)).rejects.toThrow();
  });
});
