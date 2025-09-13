# Known Issues

**Current limitations and planned improvements for the Arbiter project**

This document tracks known issues, technical debt, and planned improvements for the Arbiter v1.0 release and beyond.

## TypeScript Compilation Issues (CLI Package)

**Status**: Known Issue - Tracked for v1.1  
**Impact**: Low - Current workaround is stable  
**Workaround**: Using working CJS build for CLI distribution

### Description

The CLI package (`packages/cli`) currently has TypeScript compilation errors that prevent a clean ESM/TypeScript build. The main issues include:

- **Missing Type Definitions**: Several API response types are missing required properties (e.g., `exitCode` in `CommandResult`)
- **Import/Export Inconsistencies**: Mixed usage of `.js` extensions in TypeScript imports
- **Type Mismatches**: Various type assertion and conversion issues
- **Commander.js Integration**: Some property access issues with the CLI framework

### Current Workaround

The CLI is distributed using a pre-built CJS version that works correctly. The standalone binary (`arbiter-cli`) is generated using Bun's compile feature and functions properly for all supported operations.

### Resolution Plan

**Target**: v1.1 Release
**Effort**: 1-2 sprint dedicated effort
**Approach**:
1. **Audit Type Definitions**: Review and fix all type interfaces in shared package
2. **Import Standardization**: Standardize import/export patterns across packages  
3. **Commander.js Update**: Update to latest version and fix property access
4. **Project References**: Implement proper TypeScript project references
5. **Build Pipeline**: Establish clean ESM build pipeline

### Impact Assessment

- **User Experience**: No impact - CLI works normally
- **Development**: Slight inconvenience for TypeScript developers
- **Deployment**: No impact - binary distribution unaffected
- **Maintenance**: Manageable with current workaround

---

## Missing Dependencies

### Surface Command Configuration Issues

**Status**: Partially Resolved - Configuration validation needed  
**Impact**: Medium - Surface extraction requires complete configuration  
**Affected Command**: `arbiter surface`

### Description

The `surface` command was previously failing due to a compatibility issue between Progress and SimpleProgress utility classes. This has been fixed. However, the command now requires complete GitHub configuration setup to function properly.

### Current Status

- ✅ **Progress Utility Fix**: Fixed compatibility issue in `packages/cli/src/commands/surface.ts`
- ⏳ **Configuration Schema**: Requires complete `github.templates.base` configuration

### Resolution Options

1. **Complete Configuration**: Add default GitHub templates configuration
2. **Make Configuration Optional**: Allow surface command to work without GitHub integration
3. **Configuration Validation**: Improve error messages for missing configuration

**Recommended**: Option 2 for v1.0 (make GitHub config optional), Option 1 for complete integration

---

## Test Infrastructure

### Flaky Integration Tests

**Status**: Known Issue - Requires Investigation  
**Impact**: Low - Tests are skipped in CI  
**Component**: API integration tests with timing dependencies

### Description

Some API integration tests have timing issues and are currently skipped. These tests verify server connectivity and response handling but occasionally fail due to race conditions.

### Resolution Plan

**Target**: v1.0 (before release)
**Approach**:
1. **Investigate Timing**: Identify specific race conditions
2. **Add Retries**: Implement proper retry logic with backoff
3. **Mock Services**: Consider mocking for more reliable tests
4. **CI Stability**: Ensure stable CI pipeline

---

## Documentation Gaps

### Missing Documentation Files

**Status**: In Progress - Being Addressed  
**Impact**: High for adoption - Critical for v1.0

Currently being addressed as part of v1.0 release preparation:

- ✅ Master README.md - Completed
- ✅ Core Concepts Guide - Completed  
- ✅ CLI Reference - Completed
- ✅ Component README files - Completed
- ⏳ Kubernetes Tutorial - In Progress
- ⏳ API Documentation - Planned
- ⏳ Contributing Guide - Planned

---

## Performance Optimizations

### Bundle Size

**Status**: Future Enhancement  
**Impact**: Low - Acceptable for current use  
**Component**: Frontend application bundle

The frontend bundle size could be optimized further through:
- Advanced code splitting
- Tree shaking improvements  
- Dependency analysis and replacement
- Lazy loading enhancements

**Target**: v1.2+

### CLI Startup Time

**Status**: Future Enhancement  
**Impact**: Low - Current performance acceptable  

The CLI startup time could be improved through:
- Import optimization
- Lazy loading of heavy dependencies
- Command-specific module loading

**Target**: v1.2+

---

## Platform Support

### Windows Support

**Status**: Partial - Core functionality works  
**Impact**: Medium for Windows users  

Known limitations on Windows:
- File watching may have different behavior
- Path handling needs verification
- Some shell integrations may not work

**Resolution**: Dedicated Windows testing and fixes in v1.1

### ARM64 Support

**Status**: Untested  
**Impact**: Low - Not commonly requested  

The CLI binary compilation for ARM64 (Apple Silicon, ARM servers) has not been thoroughly tested.

**Resolution**: Add ARM64 builds to release pipeline when needed

---

## Security Considerations

### Input Validation

**Status**: Good - Comprehensive validation in place  
**Component**: CUE specification processing

Current security measures:
- ✅ CUE schema validation
- ✅ File path sanitization  
- ✅ API input validation
- ✅ Template injection protection

**Ongoing**: Regular security audits planned

### Dependency Vulnerabilities

**Status**: Monitored  
**Process**: Automated vulnerability scanning

Regular dependency audits are performed:
- npm audit for Node.js dependencies
- Automated security updates where possible
- Manual review of security advisories

---

## Migration and Compatibility

### Schema Version Management

**Status**: Implemented - V2 schema active  
**Legacy Support**: V1 schemas supported with warnings

The transition from V1 to V2 schema is complete, with V1 schemas still supported but deprecated.

**Future**: V1 support removal planned for v2.0

### Breaking Changes

**Status**: Minimized for v1.0  
**Policy**: Semantic versioning compliance

All v1.x releases will maintain backward compatibility. Breaking changes will be:
- Clearly documented
- Accompanied by migration guides
- Introduced with deprecation warnings
- Fully implemented only in major version bumps

---

## Reporting Issues

### How to Report

1. **Check Known Issues**: Review this document first
2. **Search Existing Issues**: Check GitHub issues for duplicates  
3. **Provide Details**: Include version, OS, reproduction steps
4. **Use Templates**: Follow issue template guidelines

### Issue Categories

- **Bug Reports**: Functional problems with existing features
- **Feature Requests**: New functionality suggestions  
- **Documentation**: Missing or incorrect documentation
- **Performance**: Performance-related concerns
- **Security**: Security vulnerabilities (use security@arbiter.dev)

---

## Contributing to Fixes

We welcome contributions to address these known issues:

1. **Pick an Issue**: Choose from documented issues above
2. **Discuss Approach**: Comment on the issue with your planned approach
3. **Follow Guidelines**: Adhere to contributing guidelines
4. **Test Thoroughly**: Ensure changes don't introduce regressions
5. **Update Documentation**: Update this file when issues are resolved

---

*This document is updated regularly as issues are identified and resolved. Last updated: 2025-09-13*