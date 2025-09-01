# Arbiter Traceability System

A comprehensive traceability system that provides complete REQ→SCENARIO→TEST→CODE linkage following the Rails & Guarantees methodology. This system enables bidirectional traceability tracking, impact analysis, coverage assessment, and comprehensive reporting for software development projects.

## Features

### Core Capabilities
- **Bidirectional Traceability**: Track relationships between requirements, scenarios, tests, and code in both directions
- **Multi-Format Parsing**: Support for CUE contracts, TypeScript/JavaScript code, Markdown documentation, and Python files
- **Impact Analysis**: Analyze the impact of changes across the entire traceability chain
- **Coverage Analysis**: Identify gaps in traceability coverage with detailed recommendations
- **Automatic Link Detection**: Discover relationships through code analysis and naming patterns
- **Manual Annotation Support**: Add and validate traceability annotations in source code
- **Graph-Based Management**: Efficient graph operations with cycle detection and optimization
- **Comprehensive Reporting**: Generate matrices, dashboards, and visual representations

### Rails & Guarantees Methodology
The system follows the Rails & Guarantees methodology where:
- **Requirements** are defined in CUE contracts and specifications
- **Scenarios** describe behavior in structured Gherkin-like format
- **Tests** validate scenarios with property-based testing approaches
- **Code** implements requirements with contract compliance verification

## Architecture

The traceability system consists of several key components:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TraceabilityEngine                           │
│                   (Main Orchestrator)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
     ┌────────────────┼────────────────┐
     │                │                │
┌────▼───┐   ┌────────▼─────┐   ┌─────▼──────┐
│ Parser │   │ GraphManager │   │ Analyzer   │
└────────┘   └──────────────┘   └────────────┘
     │                │                │
┌────▼───┐   ┌────────▼─────┐   ┌─────▼──────┐
│Annotator│  │   Reporter   │   │    Cache   │
└────────┘   └──────────────┘   └────────────┘
```

### Component Details

- **TraceabilityEngine**: Main orchestrator coordinating all operations
- **GraphManager**: Manages the directed graph of artifacts and relationships
- **Parser**: Multi-format parser for CUE, TypeScript, Markdown, and Python files
- **Analyzer**: Impact analysis, coverage analysis, and gap detection
- **Annotator**: Code annotation management and synchronization
- **Reporter**: Report generation in multiple formats (HTML, JSON, CSV)

## Installation

```bash
# Install as part of the arbiter project
npm install arbiter

# Or install dependencies if developing
npm install glob
```

## Quick Start

```typescript
import { createTraceabilityEngine } from './src/traceability';

// Create and initialize the engine
const engine = createTraceabilityEngine({
  includePatterns: ['src/**/*.{ts,cue,md}'],
  excludePatterns: ['node_modules/**', 'dist/**'],
  features: {
    autoLinkDetection: true,
    impactAnalysis: true,
    coverageAnalysis: true
  }
});

await engine.initialize();

// Analyze the entire project
const analysis = await engine.analyzeProject('./src');
console.log('Coverage:', analysis.coverage.overall.coveragePercent);

// Generate a dashboard report
const report = await engine.generateReport('dashboard');
await engine.getReporter().exportReport(report, './traceability-dashboard.html', 'html');

// Analyze impact of changes
const changes = [/* ... artifact changes ... */];
const impact = await engine.analyzeChanges(changes);
console.log('Risk level:', impact.riskAssessment.overallRisk);
```

## Configuration

The traceability system is highly configurable:

```typescript
const config: TraceabilityConfig = {
  includePatterns: [
    '**/*.{ts,tsx,js,jsx}',  // TypeScript/JavaScript
    '**/*.cue',              // CUE contracts
    '**/*.md',               // Markdown docs
    '**/*.py'                // Python files
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**'
  ],
  parsers: {
    TypeScriptParser: {
      enabled: true,
      options: {
        parseTests: true,
        parseJSDoc: true,
        extractImports: true
      }
    },
    CueParser: {
      enabled: true,
      options: {
        parseConstraints: true,
        parseDefinitions: true
      }
    }
  },
  linkRules: [
    {
      id: 'test_to_code',
      name: 'Tests to Code',
      sourceType: 'test',
      targetType: 'code',
      linkType: 'tests',
      confidence: 0.8,
      enabled: true
    }
  ],
  features: {
    autoLinkDetection: true,
    annotationParsing: true,
    transitiveAnalysis: true,
    impactAnalysis: true,
    coverageAnalysis: true,
    graphOptimization: true
  }
};
```

## Usage Examples

### Basic Project Analysis

```typescript
const engine = createTraceabilityEngine();
await engine.initialize();

// Analyze the project
const result = await engine.analyzeProject();

console.log(`Found ${result.parsing.successful} artifacts`);
console.log(`Coverage: ${result.coverage.overall.coveragePercent.toFixed(1)}%`);
console.log(`Gaps: ${result.coverage.gaps.length}`);
```

### Impact Analysis

```typescript
// Define changes to analyze
const changes: ArtifactChange[] = [
  {
    artifact: requirementArtifact,
    changeType: 'modified',
    changeDetails: [
      {
        field: 'acceptanceCriteria',
        oldValue: ['criterion 1'],
        newValue: ['criterion 1', 'criterion 2'],
        impact: 'high'
      }
    ]
  }
];

const impact = await engine.analyzeChanges(changes);

console.log(`Risk: ${impact.riskAssessment.overallRisk}`);
console.log(`Impacted artifacts: ${impact.impactedArtifacts.length}`);
console.log(`Recommendations: ${impact.recommendations.length}`);
```

### Generate Reports

```typescript
// Generate different types of reports
const matrixReport = await engine.generateReport('matrix', {
  artifactTypes: ['requirement', 'test']
});

const coverageReport = await engine.generateReport('coverage');

const dashboardReport = await engine.generateReport('dashboard');

// Export reports
const reporter = engine.getReporter();
await reporter.exportReport(dashboardReport, './dashboard.html', 'html');
await reporter.exportReport(matrixReport, './matrix.csv', 'csv');
```

### Code Annotations

```typescript
// Extract existing annotations
const annotations = await engine.getAnnotator()
  .extractAnnotations('./src/my-file.ts');

// Suggest new annotations
const suggestions = await engine.getAnnotator()
  .suggestAnnotations('./src/my-file.ts', artifact);

// Synchronize annotations with graph
const result = await engine.getAnnotator()
  .synchronizeAnnotations('./src/my-file.ts');

console.log(`Added ${result.added} annotations`);
```

### Graph Operations

```typescript
const graphManager = engine.getGraphManager();

// Find connected artifacts
const connected = graphManager.getLinkedArtifacts(artifactId, {
  direction: 'both',
  maxDepth: 3
});

// Find paths between artifacts
const paths = graphManager.findPaths(sourceId, targetId, 5);

// Detect orphaned artifacts
const orphaned = graphManager.findOrphanedArtifacts();

// Get graph statistics
const stats = graphManager.getStatistics();
```

## Annotation Format

The system supports traceability annotations in source code:

### TypeScript/JavaScript

```typescript
/**
 * User authentication service
 * @implements req_auth_001 User authentication requirement
 */
class AuthService {
  /**
   * @tests test_auth_login Validates login functionality
   */
  async login(credentials: LoginCredentials) {
    // Implementation
  }
}

// Single-line annotations
// @implements req_auth_002 Password validation
function validatePassword(password: string) { }

// @tests scenario_auth_logout User logout scenario
function logout() { }
```

### CUE Files

```cue
// @validates req_user_schema User data validation
#User: {
  id:    string
  email: string & =~"^[^@]+@[^@]+$"
  
  // @requires scenario_email_validation
  verified: bool | *false
}
```

### Markdown Documentation

```markdown
## Scenario: User Registration
<!-- @validates req_user_001 -->

**Given**: A new user wants to register
**When**: They provide valid email and password
**Then**: Account is created and verification email sent

<!-- @implements scenario_user_registration -->
```

## Report Types

### Traceability Matrix
Visual matrix showing relationships between artifact types:

```typescript
const matrixReport = await engine.generateReport('matrix', {
  sourceType: 'requirement',
  targetType: 'test'
});
```

### Coverage Analysis
Detailed analysis of traceability coverage:

```typescript
const coverageReport = await engine.generateReport('coverage');
// Shows overall coverage, gaps, and recommendations
```

### Impact Analysis
Analysis of change impacts across the traceability chain:

```typescript
const impactReport = await engine.generateReport('impact', {
  changes: modifiedArtifacts
});
```

### Dashboard
Comprehensive overview of traceability health:

```typescript
const dashboard = await engine.generateReport('dashboard');
// Includes overview, metrics, trends, and top issues
```

## Integration with Arbiter

The traceability system integrates seamlessly with other arbiter components:

### With Contracts System
```typescript
import { ContractEngine } from '../contracts';

const contractEngine = new ContractEngine();
const traceEngine = createTraceabilityEngine();

// Parse contracts and extract requirements
const contracts = await contractEngine.parseContracts('./contracts');
// Traceability system automatically discovers these requirements
```

### With Version System
```typescript
import { VersionManager } from '../versions';

const versionManager = new VersionManager();
const traceEngine = createTraceabilityEngine();

// Track changes across versions
const changes = await versionManager.detectChanges('1.0.0', '1.1.0');
const impact = await traceEngine.analyzeChanges(changes);
```

## Performance Considerations

- **Incremental Updates**: Use `updateFromChanges()` for efficient incremental updates
- **Caching**: Graph data is automatically cached for faster startup
- **Batch Processing**: Files are processed in batches to avoid memory issues
- **Graph Optimization**: Automatic optimization removes duplicate and weak links

## Troubleshooting

### Common Issues

1. **No artifacts found**: Check include/exclude patterns
2. **Links not detected**: Verify link rules and confidence thresholds
3. **Parse errors**: Check file format and parser configuration
4. **Performance issues**: Adjust batch sizes and enable caching

### Debugging

```typescript
// Enable detailed logging
engine.on('parsing:file', ({ filePath, progress }) => {
  console.log(`Parsing ${filePath} (${progress.toFixed(1)}%)`);
});

engine.on('error', ({ error, context }) => {
  console.error(`Error in ${context}:`, error);
});

// Validate graph integrity
const validation = await engine.validateGraph();
if (!validation.isValid) {
  console.error('Graph validation errors:', validation.errors);
}
```

## API Reference

For detailed API documentation, see the TypeScript interfaces in `types.ts`. Key classes:

- `TraceabilityEngine`: Main engine class
- `TraceabilityGraphManager`: Graph operations
- `ArtifactParser`: File parsing
- `TraceabilityAnalyzer`: Analysis operations  
- `CodeAnnotator`: Annotation management
- `TraceabilityReporter`: Report generation

## Contributing

The traceability system is part of the larger arbiter project. Follow the project's contribution guidelines and ensure all changes include appropriate tests and documentation.

## License

This system is part of the arbiter project and follows the same license terms.