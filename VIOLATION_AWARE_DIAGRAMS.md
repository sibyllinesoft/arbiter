# Violation-Aware Diagram System

The Arbiter violation-aware diagram system transforms static CUE structure diagrams into interactive debugging tools that immediately show where violations exist and provide actionable guidance.

## Overview

Instead of just displaying the structure of your CUE configuration, the enhanced system:

1. **Runs both CUE export AND validation** simultaneously
2. **Maps validation errors to specific graph nodes** using intelligent field path detection
3. **Provides visual indicators** with red outlines for errors, amber for warnings
4. **Shows interactive tooltips** with friendly error messages and "jump to line" functionality  
5. **Offers heatmap mode** that aggregates violations by subsystem

## Architecture

### Enhanced Analysis Pipeline

The `analyzeCue` function now:
- Uses the enhanced error translator from `translateCueErrors()`
- Generates unique violation IDs for each error
- Passes errors to `buildGraph()` for violation mapping
- Creates violation-aware graph nodes with severity metadata

### Violation Mapping Logic

The `mapViolationsToNodes()` function connects errors to graph nodes using:
- **Field path analysis**: Extracts field references from error messages
- **Line number mapping**: Associates errors with approximate nodes based on position
- **Severity aggregation**: Determines overall node severity (error > warning > info)
- **Violation counting**: Tracks total issues per node

### Dependency Detection

The `detectDependencies()` function identifies:
- **Field references**: Values starting with `#` or containing `.`
- **Import relationships**: Package dependencies
- **Configuration references**: Cross-references between sections

## Data Structures

### Enhanced GraphNode
```typescript
interface GraphNode {
  id: string;
  label: string;
  type: 'object' | 'array' | 'value';
  children?: string[];
  violations?: {
    severity: 'error' | 'warning' | 'info';
    violationIds: string[];
    count: number;
  };
  edges?: Array<{
    target: string;
    type?: 'reference' | 'import' | 'dependency';
  }>;
}
```

### Enhanced CueError
```typescript
interface CueError {
  message: string;
  line?: number;
  column?: number;
  filename?: string;
  // Enhanced fields
  rawMessage?: string;
  friendlyMessage?: string;
  explanation?: string;
  suggestions?: string[];
  category?: string;
  severity?: 'error' | 'warning' | 'info';
  violationId?: string;
  path?: string;
}
```

## Visual Indicators

### Node Styling
- **Red outline + fill**: Errors (blocking issues)
- **Amber outline + fill**: Warnings (non-blocking but important)
- **Blue outline + fill**: Info (suggestions)
- **Normal styling**: No violations

### Heatmap Mode
- **Critical (Dark Red)**: 5+ errors
- **High (Red)**: 2-4 errors  
- **Medium (Amber)**: 2-4 warnings
- **Low (Yellow)**: 1 warning
- **Info (Blue)**: Info messages only

## Interactive Features

### Tooltips
Click on any violated node to see:
- **Severity level** with appropriate icon
- **Friendly error message** in plain English
- **Suggested fix** with actionable guidance
- **Jump to line** button for quick navigation
- **Close** button to dismiss

### Mode Switching
- **Normal view**: Shows individual node violations
- **Heatmap view**: Aggregates violations by subsystem
- **Toggle between views** for different debugging perspectives

## Usage Examples

### Basic Violation Detection
```cue
// This CUE will show violations in the diagram
config: {
    timeout: 30 & 60  // Conflicting values - RED node
    enabled: bool     // Incomplete value - AMBER node
}
```

### Field Reference Detection
```cue
// The diagram will show dependency edges
database: {
    host: "localhost"
    port: 5432
}

api: {
    db_host: database.host  // Shows edge: api -> database
}
```

### Error Recovery
Even when CUE export fails completely, the system:
1. Attempts `cue eval` to get partial results
2. Falls back to text-based structure analysis
3. Creates meaningful visualization with violation markers

## Integration

### Frontend Components
- **ViolationAwareMermaidRenderer**: Main component with violation styling
- **Interactive tooltips**: Hover/click handlers for violation details
- **Mode switcher**: Toggle between normal and heatmap views

### Backend Processing
- **Enhanced `analyzeCue()`**: Violation-aware analysis pipeline
- **Violation mapping**: Connect errors to graph structure
- **Dependency detection**: Extract relationships from CUE values

### Testing
Comprehensive test suite in `violation-aware-diagrams.test.ts` covering:
- Error parsing with violation IDs
- Field name extraction from various error formats
- Violation mapping to correct graph nodes
- Severity prioritization and aggregation
- Integration with frontend components

## Benefits

1. **Immediate Problem Identification**: Violations are visually obvious
2. **Contextual Debugging**: Errors connected to structure locations
3. **Actionable Guidance**: Friendly messages with suggested fixes
4. **Interactive Navigation**: Click to jump to error locations
5. **Progressive Enhancement**: Works even when CUE parsing fails
6. **Scalable Visualization**: Heatmap mode for complex configurations

## Demo

See `examples/violation-aware-demo.cue` for a CUE file with intentional violations to demonstrate the system capabilities.

## Future Enhancements

- **Source map integration**: More precise line-to-node mapping
- **Bulk fix suggestions**: Apply multiple fixes at once
- **Violation history**: Track changes over time
- **Custom severity rules**: User-configurable error classification
- **Validation profiles**: Different rule sets for different contexts