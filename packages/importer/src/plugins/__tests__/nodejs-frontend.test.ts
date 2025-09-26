import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import type { Evidence, FileIndex, FileInfo, InferenceContext, ParseContext } from '../../types';
import { NodeJSPlugin } from '../nodejs';

async function createTempDir(prefix: string): Promise<string> {
  await fs.ensureDir(tmpdir());
  return fs.mkdtemp(path.join(tmpdir(), prefix));
}

async function writeFile(root: string, relativePath: string, content: string): Promise<void> {
  const fullPath = path.join(root, relativePath);
  await fs.ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, content, 'utf-8');
}

async function createFileInfo(root: string, relativePath: string): Promise<FileInfo> {
  const fullPath = path.join(root, relativePath);
  const stats = await fs.stat(fullPath);
  return {
    path: fullPath,
    relativePath: relativePath.replace(/\\+/g, '/'),
    size: stats.size,
    lastModified: stats.mtimeMs,
    extension: path.extname(fullPath).toLowerCase(),
    isBinary: false,
    metadata: {},
  };
}

function createParseContext(projectRoot: string, fileIndex: FileIndex): ParseContext {
  return {
    projectRoot,
    fileIndex,
    options: {
      deepAnalysis: false,
      targetLanguages: [],
      maxFileSize: 10 * 1024 * 1024,
      includeBinaries: false,
      patterns: {
        include: [],
        exclude: [],
      },
    },
    cache: new Map(),
  };
}

function createInferenceContext(
  projectRoot: string,
  fileIndex: FileIndex,
  evidence: Evidence[],
  projectName: string
): InferenceContext {
  const totalSize = Array.from(fileIndex.files.values()).reduce((sum, file) => sum + file.size, 0);
  return {
    projectRoot,
    fileIndex,
    allEvidence: evidence,
    options: {
      minConfidence: 0.3,
      inferRelationships: false,
      maxDependencyDepth: 3,
      useHeuristics: true,
    },
    cache: new Map(),
    projectMetadata: {
      name: projectName,
      root: projectRoot,
      languages: ['typescript'],
      frameworks: [],
      fileCount: fileIndex.files.size,
      totalSize,
    },
  };
}

describe('NodeJSPlugin frontend analysis', () => {
  it('detects React components and react-router routes', async () => {
    const projectRoot = await createTempDir('nodejs-react-');

    const pkgJson = {
      name: 'react-sample',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        'react-router-dom': '^6.24.0',
      },
    };

    await writeFile(projectRoot, 'package.json', JSON.stringify(pkgJson, null, 2));
    await writeFile(
      projectRoot,
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            jsx: 'react-jsx',
            strict: true,
            esModuleInterop: true,
          },
        },
        null,
        2
      )
    );
    await writeFile(
      projectRoot,
      'src/components/Greeting.tsx',
      `import React from 'react';

export interface GreetingProps {
  name: string;
}

export const Greeting: React.FC<GreetingProps> = ({ name }) => {
  return <div>Hello {name}</div>;
};

export default Greeting;
`
    );
    await writeFile(
      projectRoot,
      'src/App.tsx',
      `import { Routes, Route } from 'react-router-dom';
import Greeting from './components/Greeting';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Greeting name="World" />} />
      <Route path="/dashboard" element={<Greeting name="Dashboard" />} />
    </Routes>
  );
}
`
    );

    const fileInfos = await Promise.all([
      createFileInfo(projectRoot, 'package.json'),
      createFileInfo(projectRoot, 'tsconfig.json'),
      createFileInfo(projectRoot, 'src/components/Greeting.tsx'),
      createFileInfo(projectRoot, 'src/App.tsx'),
    ]);

    const fileIndex: FileIndex = {
      root: projectRoot,
      files: new Map(fileInfos.map(info => [info.path, info])),
      directories: new Map(),
      timestamp: Date.now(),
    };

    const plugin = new NodeJSPlugin();
    const parseContext = createParseContext(projectRoot, fileIndex);
    const pkgContent = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
    const evidence = await plugin.parse(
      path.join(projectRoot, 'package.json'),
      pkgContent,
      parseContext
    );
    const inferenceContext = createInferenceContext(projectRoot, fileIndex, evidence, pkgJson.name);
    const artifacts = await plugin.infer(evidence, inferenceContext);

    expect(artifacts.length).toBeGreaterThan(0);
    const primaryArtifact = artifacts[0].artifact;
    const frontend = (primaryArtifact.metadata as any)?.frontendAnalysis;

    expect(frontend?.frameworks).toContain('react');
    const greetingComponent = frontend?.components?.find(
      (component: any) => component.name === 'Greeting'
    );
    expect(greetingComponent).toBeDefined();
    if (greetingComponent?.props) {
      expect(greetingComponent.props.some((prop: any) => prop.name === 'name')).toBeTrue();
    }

    const router = frontend?.routers?.find((entry: any) => entry.type === 'react-router');
    expect(router).toBeDefined();
    expect(router?.routes?.some((route: any) => route.path === '/dashboard')).toBeTrue();

    await fs.remove(projectRoot);
  });

  it('detects Next.js routes', async () => {
    const projectRoot = await createTempDir('nodejs-next-');

    const pkgJson = {
      name: 'next-sample',
      version: '1.0.0',
      dependencies: {
        next: '14.0.0',
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    };

    await writeFile(projectRoot, 'package.json', JSON.stringify(pkgJson, null, 2));
    await writeFile(
      projectRoot,
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            jsx: 'react-jsx',
            strict: true,
            esModuleInterop: true,
          },
        },
        null,
        2
      )
    );
    await writeFile(
      projectRoot,
      'pages/index.tsx',
      `export default function Home() {
  return <main>Home</main>;
}
`
    );
    await writeFile(
      projectRoot,
      'pages/about.tsx',
      `export default function About() {
  return <main>About</main>;
}
`
    );
    await writeFile(
      projectRoot,
      'pages/blog/[slug].tsx',
      `type Props = { params: { slug: string } };

export default function BlogPost({ params }: Props) {
  return <article>{params.slug}</article>;
}
`
    );

    const fileInfos = await Promise.all([
      createFileInfo(projectRoot, 'package.json'),
      createFileInfo(projectRoot, 'tsconfig.json'),
      createFileInfo(projectRoot, 'pages/index.tsx'),
      createFileInfo(projectRoot, 'pages/about.tsx'),
      createFileInfo(projectRoot, 'pages/blog/[slug].tsx'),
    ]);

    const fileIndex: FileIndex = {
      root: projectRoot,
      files: new Map(fileInfos.map(info => [info.path, info])),
      directories: new Map(),
      timestamp: Date.now(),
    };

    const plugin = new NodeJSPlugin();
    const parseContext = createParseContext(projectRoot, fileIndex);
    const pkgContent = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
    const evidence = await plugin.parse(
      path.join(projectRoot, 'package.json'),
      pkgContent,
      parseContext
    );
    const inferenceContext = createInferenceContext(projectRoot, fileIndex, evidence, pkgJson.name);
    const artifacts = await plugin.infer(evidence, inferenceContext);

    expect(artifacts.length).toBeGreaterThan(0);
    const primaryArtifact = artifacts[0].artifact;
    const frontend = (primaryArtifact.metadata as any)?.frontendAnalysis;

    expect(frontend?.frameworks).toContain('next');
    const router = frontend?.routers?.find((entry: any) => entry.type === 'next');
    expect(router).toBeDefined();
    expect(router?.routes?.some((route: any) => route.path === '/')).toBeTrue();
    expect(router?.routes?.some((route: any) => route.path === '/about')).toBeTrue();
    expect(router?.routes?.some((route: any) => route.path === '/blog/:slug')).toBeTrue();

    await fs.remove(projectRoot);
  });

  it('detects Vue single-file components', async () => {
    const projectRoot = await createTempDir('nodejs-vue-');

    const pkgJson = {
      name: 'vue-sample',
      version: '1.0.0',
      dependencies: {
        vue: '^3.4.0',
      },
    };

    await writeFile(projectRoot, 'package.json', JSON.stringify(pkgJson, null, 2));
    await writeFile(
      projectRoot,
      'src/components/BaseButton.vue',
      `<template>
  <button class="base-button"><slot /></button>
</template>
<script>
export default {
  name: 'BaseButton',
};
</script>
`
    );

    const fileInfos = await Promise.all([
      createFileInfo(projectRoot, 'package.json'),
      createFileInfo(projectRoot, 'src/components/BaseButton.vue'),
    ]);

    const fileIndex: FileIndex = {
      root: projectRoot,
      files: new Map(fileInfos.map(info => [info.path, info])),
      directories: new Map(),
      timestamp: Date.now(),
    };

    const plugin = new NodeJSPlugin();
    const parseContext = createParseContext(projectRoot, fileIndex);
    const pkgContent = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
    const evidence = await plugin.parse(
      path.join(projectRoot, 'package.json'),
      pkgContent,
      parseContext
    );
    const inferenceContext = createInferenceContext(projectRoot, fileIndex, evidence, pkgJson.name);
    const artifacts = await plugin.infer(evidence, inferenceContext);

    const primaryArtifact = artifacts[0].artifact;
    const frontend = (primaryArtifact.metadata as any)?.frontendAnalysis;

    expect(frontend?.frameworks).toContain('vue');
    expect(
      frontend?.components?.some((component: any) => component.name === 'BaseButton')
    ).toBeTrue();

    await fs.remove(projectRoot);
  });
});
