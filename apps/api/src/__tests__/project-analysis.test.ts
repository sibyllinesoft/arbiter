import { describe, expect, it } from 'bun:test';
import type { ContentFetcher } from '../content-fetcher';
import { analyzeProjectFiles, buildProjectStructure } from '../project-analysis';

const sampleFiles = [
  'Dockerfile',
  'docker-compose.yml',
  'k8s/deployment.yaml',
  'infra/main.tf',
  'apps/api/package.json',
  'apps/api/src/routes/events.ts',
  'apps/api/src/routes/projects.controller.ts',
  'apps/api/src/tests/api.test.ts',
  'db/schema.prisma',
  'configs/service.cue',
];

describe('project-analysis', () => {
  it('builds project structure flags from file list', () => {
    const structure = buildProjectStructure(sampleFiles);

    expect(structure.hasDockerfile).toBe(true);
    expect(structure.hasPackageJson).toBe(true);
    expect(structure.hasYamlFiles).toBe(true);
    expect(structure.hasCueFiles).toBe(true);
    expect(structure.importableFiles.length).toBeGreaterThan(0);
  });

  it('categorizes artifacts based on repository tree', async () => {
    const { artifacts, serviceCount, databaseCount } = await analyzeProjectFiles(
      'project-test',
      'demo-project',
      sampleFiles
    );

    const types = artifacts.map(a => a.type);
    expect(types).toContain('service');
    expect(types).toContain('infrastructure');
    expect(types).toContain('config');
    expect(types).toContain('database');

    expect(serviceCount).toBeGreaterThan(0);
    expect(databaseCount).toBeGreaterThanOrEqual(1);

    const dockerfileArtifact = artifacts.find(a => a.metadata?.dockerfile);
    expect(dockerfileArtifact?.name).toContain('container');
  });

  it('enriches metadata using content fetchers', async () => {
    const fileContents: Record<string, string> = {
      Dockerfile: 'FROM node:18\nEXPOSE 3000',
      'docker-compose.yml':
        'services:\n  api:\n    image: node:18\n    ports:\n      - "3000:3000"',
      'apps/api/package.json': JSON.stringify({
        name: 'api-service',
        scripts: { start: 'node index.js', dev: 'ts-node src/server.ts' },
        dependencies: { hono: '^4.9.8' },
        devDependencies: { typescript: '^5.3.3' },
      }),
    };

    const fetcher: ContentFetcher = {
      async fetchText(filePath: string) {
        return fileContents[filePath] ?? null;
      },
    };

    const { artifacts } = await analyzeProjectFiles('project-test', 'demo-project', sampleFiles, {
      fetcher,
    });

    const dockerfileArtifact = artifacts.find(a => a.metadata?.dockerfile);
    expect(dockerfileArtifact?.metadata).toHaveProperty('baseImage', 'node:18');

    const composeServices = artifacts.filter(a => a.metadata?.composeFile);
    expect(composeServices.length).toBeGreaterThan(0);

    const packageArtifact = artifacts.find(a => a.metadata?.package);
    expect(packageArtifact?.name).toBe('api-service');
    expect(packageArtifact?.metadata).toMatchObject({
      package: {
        scripts: expect.arrayContaining(['start', 'dev']),
      },
    });

    const tsoaAnalysis = packageArtifact?.metadata?.tsoaAnalysis as any;
    expect(tsoaAnalysis).toBeDefined();
    expect(tsoaAnalysis.frameworks).toContain('hono');
    expect(tsoaAnalysis.totalTypeScriptFiles).toBe(3);
    expect(tsoaAnalysis.controllerCandidates).toEqual(
      expect.arrayContaining(['src/routes/events.ts', 'src/routes/projects.controller.ts'])
    );
    expect(tsoaAnalysis.controllerCandidates).not.toEqual(
      expect.arrayContaining(['src/tests/api.test.ts'])
    );
  });
});
