# @arbiter/importer

Codebase analysis and artifact detection for importing existing projects into
the Arbiter platform.

## Overview

This package provides a plugin-based system for analyzing existing codebases and
automatically detecting architectural artifacts such as services, binaries,
libraries, and jobs. It's designed to help with reverse engineering and
understanding of legacy codebases for import into Arbiter specifications.

## Features

- **Plugin-based Architecture**: Extensible system for language-specific
  analysis
- **Comprehensive Detection**: Identifies services, binaries, libraries, jobs,
  schemas, and more
- **Confidence Scoring**: Each detected artifact includes confidence metrics
- **Evidence Collection**: Maintains detailed provenance of how artifacts were
  detected
- **Multi-language Support**: Currently supports Rust, with extensible
  architecture for other languages

## Usage

```typescript
import { ScannerRunner, getAllPlugins } from '@arbiter/importer';

// Create scanner with all available plugins
const scanner = new ScannerRunner({
  projectRoot: '/path/to/project',
  plugins: getAllPlugins(),
  parseOptions: {
    deepAnalysis: true,
    targetLanguages: [], // Auto-detect all languages
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  inferenceOptions: {
    minConfidence: 0.3,
    inferRelationships: true,
  },
});

// Run analysis
const manifest = await scanner.scan();
console.log(`Found ${manifest.artifacts.length} artifacts`);
```

## Plugin Development

To create a new language plugin, implement the `ImporterPlugin` interface:

```typescript
import { ImporterPlugin, Evidence, InferredArtifact } from '@arbiter/importer';

export class MyLanguagePlugin implements ImporterPlugin {
  name(): string {
    return 'my-language';
  }

  supports(filePath: string, fileContent?: string): boolean {
    return filePath.endsWith('.mylang');
  }

  async parse(
    filePath: string,
    fileContent?: string,
    context?: ParseContext
  ): Promise<Evidence[]> {
    // Extract evidence from source files
    return [];
  }

  async infer(
    evidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    // Infer artifacts from collected evidence
    return [];
  }
}
```

## Architecture

The import analysis follows a five-stage pipeline:

1. **Discovery**: File system scanning with ignore patterns
2. **Parse**: Plugin-based evidence collection from source files
3. **Infer**: Artifact inference from collected evidence
4. **Normalize**: De-duplication and confidence merging
5. **Validate**: Sanity checks and consistency validation

## Supported Artifact Types

- **Services**: HTTP APIs, web services, microservices
- **Binaries**: Command-line tools, executables
- **Libraries**: Shared libraries, packages, modules
- **Jobs**: Background jobs, scheduled tasks, workers
- **Schemas**: Database schemas, API schemas
- **Frontends**: Web applications, SPAs
- **Databases**: Database instances, data stores
- **Infrastructure**: Deployment configs, infrastructure as code

## License

MIT
