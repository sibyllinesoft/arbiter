# Arbiter Acceptance Suite Documentation

## Overview

The Arbiter Acceptance Suite validates all 7 acceptance criteria from TODO.md Section 12, ensuring the platform is production-ready for specification-driven development.

## Quick Start

```bash
# Run the complete acceptance suite
./run-acceptance-tests.sh

# Or run directly with your preferred runtime
bun run acceptance-suite.ts
# OR
tsx acceptance-suite.ts
# OR  
ts-node acceptance-suite.ts
```

## Acceptance Criteria

### 1. Workflow Demo
**Requirement**: Complete pipeline from `TODO.md → requirements.cue → assembly.cue → SPECIFICATION.md → M1_IMPLEMENTATION.md → tests → green check`

**Test Process**:
- Creates sample TODO.md with structured requirements
- Runs `arbiter requirements analyze` to extract CUE requirements
- Generates assembly spec with `arbiter spec generate`
- Creates documentation with `arbiter docs assembly`
- Generates implementation plan with `arbiter plan milestone`
- Creates test suites with `arbiter tests generate`
- Validates all files are created and tests pass

**Success Criteria**:
- All intermediate files are generated successfully
- Generated tests are runnable and pass
- No command returns errors

### 2. Rust Surface Extraction
**Requirement**: Non-empty extraction; deliberate breaking change flips `required_bump=MAJOR`

**Test Process**:
- Creates Rust library with public API surface
- Extracts initial surface with `arbiter surface --lang rs`
- Modifies code to remove/hide public functions (breaking change)
- Re-extracts surface after changes
- Runs `arbiter version plan` to detect version requirements

**Success Criteria**:
- Initial surface extraction produces non-empty results
- Breaking change detection triggers `required_bump=MAJOR`
- Version planning correctly identifies need for major version bump

### 3. Watch Performance
**Requirement**: Edit file → validate/surface/gates update in ≤3s

**Test Process**:
- Sets up watch-enabled project with assembly spec
- Starts `arbiter watch` in background process
- Modifies source files to trigger watch events
- Measures total time from file change to validation completion
- Verifies watch output contains validation/surface/gates updates

**Success Criteria**:
- Watch detects file changes and processes them
- Total processing time ≤ 3000ms (3 seconds)
- Watch output shows validate/surface/gates operations

### 4. Tests Generation & Coverage
**Requirement**: `tests generate` produces runnable suites; `tests cover` computes Contract Coverage

**Test Process**:
- Creates assembly with testable contract invariants
- Generates test suites with `arbiter tests generate`
- Validates generated tests are syntactically correct and runnable
- Computes contract coverage with `arbiter tests cover`
- Verifies coverage report includes contract-specific metrics

**Success Criteria**:
- Test files are generated in appropriate language format
- Generated tests can be executed without errors
- Coverage command produces Contract Coverage metrics
- Coverage report is structured and contains relevant data

### 5. Traceability
**Requirement**: `TRACE.json` links REQ→SPEC→TEST→CODE with no dangling IDs

**Test Process**:
- Creates structured requirements with stable IDs
- Generates specs and tests with traceability markers
- Creates source code with `ARBITER:BEGIN/END` markers
- Builds traceability graph with `arbiter trace link`
- Validates TRACE.json structure and link integrity

**Success Criteria**:
- TRACE.json contains all required sections (requirements, specifications, tests, code, links)
- All referenced IDs have corresponding definitions
- No dangling references exist in the traceability graph
- Link relationships are bidirectional and consistent

### 6. Deterministic Output
**Requirement**: Identical inputs yield byte-identical outputs across two runs

**Test Process**:
- Creates fixed assembly specification
- Runs generation commands twice with identical inputs:
  - `arbiter docs assembly` (documentation generation)
  - `arbiter plan milestone` (implementation planning)
  - `arbiter preview` (plan preview)
  - `arbiter tests generate` (test generation)
- Compares output files byte-for-byte using SHA-256 hashes

**Success Criteria**:
- All generated files are byte-identical between runs
- No timestamps, random UUIDs, or non-deterministic content
- JSON outputs have consistent key ordering
- File system operations produce identical directory structures

### 7. No "Not Implemented" Errors
**Requirement**: All commands from sections 2–10 work without "not implemented"

**Test Process**:
- Tests all core commands from TODO.md sections 2-10:
  - `validate`, `check`, `docs`, `explain`, `export`
  - `spec create`, `surface`, `version plan`
  - `ide recommend`, `sync`, `integrate`
- Scans command output for "not implemented" messages
- Validates minimum success rate and functionality

**Success Criteria**:
- No commands return "not implemented" errors
- Minimum 80% success rate across all tested commands
- Commands produce expected output formats
- Error messages are helpful and actionable

## File Structure

```
acceptance-suite.ts              # Main test suite implementation
acceptance-test-utils.ts         # Utility classes and helpers
run-acceptance-tests.sh         # Shell script runner
ACCEPTANCE_SUITE_DOCUMENTATION.md # This documentation
```

## Test Infrastructure

### TestFixtureGenerator
Generates realistic project structures for different languages and project types:
- TypeScript libraries with proper package.json and tsconfig.json
- Rust libraries with Cargo.toml and src/lib.rs
- Service projects with API endpoints and assembly specifications

### PerformanceBenchmarker
Measures operation performance against thresholds:
- Tracks individual operation timing
- Generates performance reports
- Validates against specified thresholds (e.g., 3-second watch requirement)

### TestFileUtils
File system utilities for test management:
- Directory creation and cleanup
- File comparison with SHA-256 hashing
- Recursive file searching and pattern matching
- Test fixture creation and teardown

### CommandRunner
Executes CLI commands with detailed logging:
- Timeout handling and error capture
- Verbose output for debugging
- Async/sync execution modes
- Duration measurement for performance testing

### TestValidator
Validates generated files and outputs:
- JSON schema validation
- Traceability graph validation
- Surface extraction validation
- Custom validation rules per file type

## Running Individual Tests

While the full suite is recommended, you can run individual criteria by modifying the `acceptance-suite.ts` file:

```typescript
// Run only specific criteria
const suite = new AcceptanceSuite();
await suite.testWorkflowDemo();        // Criteria 1
await suite.testRustSurfaceExtraction(); // Criteria 2
await suite.testWatchPerformance();     // Criteria 3
// ... etc
```

## Output Format

The acceptance suite provides detailed reporting:

### Console Output
- Real-time progress for each test criterion
- Pass/fail status with timing information
- Detailed error messages and measurements
- Final production readiness assessment

### Success Example
```
🧪 [Criteria 1] Complete workflow from TODO.md to green tests
✅ [Criteria 1] Complete workflow pipeline - PASSED
📊 Measurements: {
  "files_created": ["requirements.cue", "arbiter.assembly.cue", "SPECIFICATION.md", "M1_IMPLEMENTATION.md"],
  "tests_directory_created": true,
  "tests_passing": true,
  "requirements_analyze_success": true,
  "spec_generate_success": true
}
```

### Failure Example
```
❌ [Criteria 2] Rust surface extraction and breaking change detection - FAILED: Breaking change was not detected with MAJOR bump requirement
📝 Details: Version plan did not identify the removed public function as a breaking change
```

### Final Report
```
🏁 ARBITER ACCEPTANCE SUITE - FINAL RESULTS
================================================================================

📊 ACCEPTANCE CRITERIA SUMMARY:
✅ Passed: 7/7 criteria
❌ Failed: 0/7 criteria

🎯 DETAILED RESULTS:
1. ✅ PASS - Workflow Demo: TODO.md → requirements.cue → assembly.cue → SPECIFICATION.md → M1_IMPLEMENTATION.md → tests → green check
2. ✅ PASS - Rust Surface: Non-empty extraction; breaking change flips required_bump=MAJOR
3. ✅ PASS - Watch: Edit file → validate/surface/gates update in ≤3s
4. ✅ PASS - Tests: tests generate produces runnable suites; tests cover computes Contract Coverage
5. ✅ PASS - Traceability: TRACE.json links REQ→SPEC→TEST→CODE with no dangling IDs
6. ✅ PASS - Determinism: Identical inputs yield byte-identical outputs across two runs
7. ✅ PASS - No "not implemented" across commands listed in §§2–10

🎭 PRODUCTION READINESS ASSESSMENT:

🎉 🚀 ARBITER IS PRODUCTION READY! 🚀 🎉

All 7 acceptance criteria from TODO.md Section 12 have been validated successfully.
The specification-driven development platform is ready for deployment.
```

## Environment Requirements

### Required Dependencies
- Node.js 18+ or Bun runtime
- TypeScript compiler or ts-node/tsx for execution
- Git (for repository operations)

### Recommended Setup
- Bun runtime for fastest execution
- VS Code with TypeScript extensions
- Rust toolchain (for Rust surface extraction tests)
- Docker (for isolated testing environments)

### Platform Support
- Linux (primary development platform)
- macOS (supported)  
- Windows (WSL recommended)

## Performance Expectations

### Typical Runtime
- Full suite: 60-180 seconds
- Individual criteria: 5-30 seconds each
- Watch performance test: 10-15 seconds (includes 3s measurement window)

### Resource Usage
- Disk: ~50MB temporary workspace
- Memory: ~100MB peak usage
- CPU: Variable based on compilation steps

## Troubleshooting

### Common Issues

**CLI Not Found**
```bash
❌ CLI not found at ./packages/cli/src/cli.ts
```
Solution: Ensure project is built and CLI path is correct

**Permission Errors**
```bash
❌ Permission denied: ./run-acceptance-tests.sh
```
Solution: Make script executable with `chmod +x run-acceptance-tests.sh`

**Timeout Errors**
```bash
❌ Command timeout after 30000ms
```
Solution: Increase timeout in test configuration or optimize system performance

**Missing Dependencies**
```bash
❌ typescript is required but not installed
```
Solution: Run `npm install` or `bun install` to install dependencies

### Debug Mode

Enable verbose output by modifying the AcceptanceSuite constructor:

```typescript
const commandRunner = new CommandRunner(true); // Enable verbose mode
```

This provides detailed command execution logs for troubleshooting.

## Contributing

When adding new acceptance criteria:

1. Create test method following naming convention: `test{CriteriaName}()`
2. Use provided utilities for consistent file operations and validation
3. Include comprehensive measurements and error reporting
4. Update this documentation with the new criteria details
5. Ensure test cleanup to avoid workspace pollution

## Integration with CI/CD

The acceptance suite returns appropriate exit codes:
- `0`: All criteria passed (production ready)
- `1`: One or more criteria failed (not production ready)

Example GitHub Actions integration:
```yaml
- name: Run Acceptance Suite
  run: ./run-acceptance-tests.sh
  
- name: Check Production Readiness
  if: success()
  run: echo "🚀 Arbiter is production ready!"
```