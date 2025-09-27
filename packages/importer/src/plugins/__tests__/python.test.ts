import { beforeEach, describe, expect, it } from 'bun:test';
import type { Evidence, InferenceContext, ParseContext } from '../../types';
import { PythonPlugin } from '../python';

describe('PythonPlugin', () => {
  let plugin: PythonPlugin;
  let baseParseContext: ParseContext;

  beforeEach(() => {
    plugin = new PythonPlugin();
    baseParseContext = {
      projectRoot: '/project',
      fileIndex: {
        root: '/project',
        files: new Map(),
        directories: new Map(),
        timestamp: Date.now(),
      },
      options: {
        deepAnalysis: false,
        targetLanguages: [],
        maxFileSize: 1024 * 1024,
        includeBinaries: false,
        patterns: { include: ['**/*'], exclude: [] },
      },
      cache: new Map(),
    };
  });

  const buildInferenceContext = (evidence: Evidence[]): InferenceContext => ({
    projectRoot: '/project',
    fileIndex: baseParseContext.fileIndex,
    allEvidence: evidence,
    options: {
      minConfidence: 0.3,
      inferRelationships: true,
      maxDependencyDepth: 5,
      useHeuristics: true,
    },
    cache: new Map(),
    projectMetadata: {
      name: 'project',
      root: '/project',
      languages: [],
      frameworks: [],
      fileCount: 0,
      totalSize: 0,
    },
  });

  it('classifies FastAPI pyproject as service', async () => {
    const pyproject = `
[project]
name = "smith-http"
version = "0.1.0"
description = "HTTP gateway"
dependencies = ["fastapi", "uvicorn"]
`;

    const evidence = await plugin.parse(
      '/project/service/pyproject.toml',
      pyproject,
      baseParseContext
    );

    const artifacts = await plugin.infer(evidence, buildInferenceContext(evidence));

    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0].artifact;
    expect(artifact.type).toBe('service');
    expect(artifact.metadata.framework).toBe('fastapi');
    expect(artifact.metadata.detectedType).toBe('service');
    expect(artifact.description).toBe('HTTP gateway');
  });

  it('classifies setup.py with console scripts as binary tool', async () => {
    const setupPy = `
from setuptools import setup

setup(
    name="smith-cli",
    version="0.2.0",
    description="CLI for smith",
    install_requires=["click"],
    entry_points={
        "console_scripts": {
            "smith": "smith_cli.__main__:main"
        }
    }
)
`;

    const evidence = await plugin.parse('/project/tools/setup.py', setupPy, baseParseContext);
    const artifacts = await plugin.infer(evidence, buildInferenceContext(evidence));

    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0].artifact;
    expect(artifact.type).toBe('binary');
    expect(artifact.metadata.detectedType).toBe('cli');
    expect(artifact.tags).toContain('tool');
  });

  it('defaults to module when no web or cli signals present', async () => {
    const pyproject = `
[project]
name = "smith-library"
version = "0.3.1"
description = "Shared utilities"
dependencies = ["pydantic"]
`;

    const evidence = await plugin.parse(
      '/project/shared/pyproject.toml',
      pyproject,
      baseParseContext
    );

    const artifacts = await plugin.infer(evidence, buildInferenceContext(evidence));

    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0].artifact;
    expect(artifact.type).toBe('module');
    expect(artifact.metadata.detectedType).toBe('module');
    expect(artifact.description).toBe('Shared utilities');
  });
});
