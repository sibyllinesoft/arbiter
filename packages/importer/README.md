# @arbiter/importer

Codebase analysis and artifact detection for importing existing projects into
the Arbiter platform.

## Overview

This package provides a plugin-based system for analyzing existing codebases and
automatically detecting architectural artifacts such as services, binaries,
libraries, and jobs. It's designed to help with reverse engineering and
understanding of legacy codebases for import into Arbiter specifications.

### CLI flags (quick reference)

| Flag | Purpose | Notes |
|------|---------|-------|
| `--github-url <url>` | Analyze a remote repo | Fetches branch metadata; good for public repos |
| `--local-path <path>` | Analyze a local checkout | Skips network; good for private code |
| `--ignore "<glob>"` | Skip expensive/noisy paths | Repeatable; defaults include node_modules/dist |
| `--deep-analysis` | Enable heavier heuristics | Slower, better for infra/tests/schema detection |
| `--target-languages ts,go` | Restrict plugins | Speeds up polyglot monorepos |
| `--min-confidence 0.4` | Filter low-confidence artifacts | Defaults to 0.3 in code |
| `--max-file-size 10485760` | Cap file size (bytes) | Guard against binaries |
| `--max-concurrency 8` | Tune parallelism | Increase on CI, lower on laptops |

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

### Using via the Arbiter CLI

Most users trigger the importer through the CLI instead of programmatic calls:

```bash
# Analyze a GitHub repo (recommended when you need branch metadata)
arbiter init --github-url https://github.com/org/project

# Analyze a local checkout
arbiter init --local-path ../project

# Speed up large repos by ignoring heavy folders
arbiter init --local-path ../project --ignore "**/node_modules/**" --ignore "**/dist/**"

# Enable deeper heuristics for infra/tests/schema detection
arbiter init --local-path ../project --deep-analysis
```

The CLI writes the detected specification into `.arbiter` fragments, which you
can immediately validate (`arbiter check`) or generate (`arbiter generate`).

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

### Example Output (trimmed)

```json
{
  "project": { "path": "/repo", "fileCount": 1423, "totalBytes": 58_230_144 },
  "artifacts": [
    {
      "kind": "service",
      "name": "api",
      "language": "typescript",
      "framework": "express",
      "confidence": 0.82,
      "evidence": ["package.json:scripts[start]", "src/server.ts:Express()"]
    },
    {
      "kind": "binary",
      "name": "migrate",
      "language": "rust",
      "confidence": 0.74,
      "evidence": ["Cargo.toml:bin.migrate", "src/bin/migrate.rs:clap"]
    }
  ],
  "statistics": { "evidenceCount": 512, "pluginsUsed": ["rust"] },
  "configuration": { "deepAnalysis": true, "minConfidence": 0.3 }
}
```

## Supported Artifact Types

- **Services**: HTTP APIs, web services, microservices
- **Binaries**: Command-line tools, executables
- **Libraries**: Shared libraries, packages, modules
- **Jobs**: Background jobs, scheduled tasks, workers
- **Schemas**: Database schemas, API schemas
- **Frontends**: Web applications, SPAs
- **Databases**: Database instances, data stores
- **Infrastructure**: Deployment configs, infrastructure as code

## Configuration

The `ScannerRunner` accepts a rich configuration object that controls parsing
and inference. Important options include:

- `parseOptions.deepAnalysis`: enable more expensive heuristics at the cost of
  runtime
- `parseOptions.targetLanguages`: restricts plugins to a set of languages when
  working in polyglot repositories
- `parseOptions.maxFileSize`: guards against scanning large binaries that slow
  down the pipeline
- `inferenceOptions.minConfidence`: filters out artifacts that do not meet a
  minimum confidence score
- `ignorePatterns`: additional glob patterns merged with the built-in defaults
- `maxConcurrency`: controls the number of files parsed in parallel when the
  importer streams evidence

Covering these knobs in project-specific presets allows large organisations to
standardise how repositories are analysed.

## Evidence and Artifacts

Plugins collect `Evidence` objects during the parse phase; each evidence record
references the file that produced it, the detection heuristic that fired, and a
confidence value. During inference, evidence is aggregated into
`InferredArtifact` records that combine metadata, provenance, and supporting
sources. The resulting `ArtifactManifest` includes:

- `project` metadata such as file counts and aggregate size
- `artifacts` for every detected service, module, job, frontend, infrastructure
  asset, and more
- `provenance` mappings that explain which evidence justifies each artifact
- `statistics` summarising confidence distribution and plugin execution metrics
- `configuration` capturing the options used during the scan

## Extending the Pipeline

Implement the `ImporterPlugin` interface to add support for additional
languages, frameworks, or infrastructure formats. Plugins typically focus on:

1. Quick `supports()` checks to avoid loading unnecessary files
2. Structured parsing with robust error handling in `parse()`
3. Combining cross-file evidence inside `infer()` to produce confident artifacts

The shared `PluginRegistry` and `ScannerRunner` utilities handle concurrency,
error isolation, and manifest assembly so plugins can remain focused on their
specific detection logic.

## Performance and Accuracy Tips

- Ignore noisy or generated paths to cut runtime: `ignorePatterns: ["**/node_modules/**", "**/dist/**"]`.
- For monorepos, set `parseOptions.targetLanguages` to the primary languages to avoid scanning everything.
- Increase `maxConcurrency` on fast disks/CI runners; decrease on laptops to keep fans quiet.
- Raise `inferenceOptions.minConfidence` (e.g., 0.5) when you prefer precision over recall.
- Enable `deepAnalysis` only when you need schema, infra, and test detection; it is slower but more thorough.

## License

MIT
