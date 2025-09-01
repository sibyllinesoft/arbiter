/**
 * Spec validation engine with CUE and jq integration
 */
import { join } from "path";
import type { 
  ValidationError, 
  ValidationWarning, 
  GapSet,
  TokenReference,
  CoverageGap,
  Duplicate,
  ServerConfig,
  Fragment 
} from "./types.ts";
import { 
  executeCommand, 
  computeSpecHash, 
  formatCUE, 
  ensureDir, 
  safeJsonParse,
  logger,
  generateId 
} from "./utils.ts";
import { translateCueErrors } from "../../packages/shared/src/cue-error-translator.js";

export class SpecEngine {
  constructor(private config: ServerConfig) {}

  /**
   * Get the project directory path
   */
  private getProjectDir(projectId: string): string {
    return join(this.config.spec_workdir, projectId);
  }

  /**
   * Get the fragments directory path
   */
  private getFragmentsDir(projectId: string): string {
    return join(this.getProjectDir(projectId), "fragments");
  }

  /**
   * Write fragments to filesystem for CUE processing
   */
  private async writeFragmentsToFS(projectId: string, fragments: Fragment[]): Promise<void> {
    const fragmentsDir = this.getFragmentsDir(projectId);
    await ensureDir(fragmentsDir);

    // Write each fragment to its path
    for (const fragment of fragments) {
      const fragmentPath = join(fragmentsDir, fragment.path);
      const fragmentDir = join(fragmentPath, "..");
      
      await ensureDir(fragmentDir);
      await Bun.write(fragmentPath, fragment.content);
    }

    logger.debug("Wrote fragments to filesystem", { 
      projectId, 
      fragmentCount: fragments.length 
    });
  }

  /**
   * Format CUE fragment content
   */
  async formatFragment(content: string): Promise<{ formatted: string; success: boolean; error?: string }> {
    return formatCUE(content, this.config.cue_binary_path);
  }

  /**
   * Run CUE validation (cue vet)
   */
  private async runCueValidation(projectId: string): Promise<ValidationError[]> {
    const fragmentsDir = this.getFragmentsDir(projectId);
    const errors: ValidationError[] = [];

    try {
      const result = await executeCommand(
        this.config.cue_binary_path,
        ["vet", "."],
        {
          cwd: fragmentsDir,
          timeout: this.config.external_tool_timeout_ms
        }
      );

      if (!result.success && result.stderr) {
        // Use the enhanced error translator
        const translatedErrors = translateCueErrors(result.stderr);
        
        for (const translatedError of translatedErrors) {
          // Build location string from available information
          let location: string | undefined;
          if (translatedError.filename && translatedError.line && translatedError.column) {
            location = `${translatedError.filename}:${translatedError.line}:${translatedError.column}`;
          } else if (translatedError.path) {
            location = translatedError.path;
          }
          
          // Create enhanced ValidationError with friendly translation
          errors.push({
            type: 'schema',
            message: translatedError.rawMessage,
            location,
            details: {
              file: translatedError.filename,
              line: translatedError.line,
              column: translatedError.column,
              path: translatedError.path,
              errorType: translatedError.errorType,
              context: translatedError.context
            },
            // Enhanced fields from error translator
            friendlyMessage: translatedError.friendlyMessage,
            explanation: translatedError.explanation,
            suggestions: translatedError.suggestions,
            category: translatedError.category,
            severity: translatedError.severity
          });
        }
      }

      logger.debug("CUE validation completed", { 
        projectId, 
        success: result.success,
        errorCount: errors.length,
        duration: result.duration_ms 
      });

    } catch (error) {
      errors.push({
        type: 'schema',
        message: `CUE validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        friendlyMessage: 'CUE validation process failed',
        explanation: 'The CUE validation process encountered an unexpected error and could not complete.',
        suggestions: [
          'Check that the CUE binary is installed and accessible',
          'Verify that the project files are readable',
          'Review the server logs for more details'
        ],
        category: 'validation',
        severity: 'error'
      });
      
      logger.error("CUE validation error", error instanceof Error ? error : undefined, { projectId });
    }

    return errors;
  }

  /**
   * Export resolved specification (cue export)
   */
  private async exportResolvedSpec(projectId: string): Promise<{ 
    success: boolean; 
    resolved?: Record<string, unknown>; 
    error?: string 
  }> {
    const fragmentsDir = this.getFragmentsDir(projectId);

    try {
      const result = await executeCommand(
        this.config.cue_binary_path,
        ["export", "--out", "json"],
        {
          cwd: fragmentsDir,
          timeout: this.config.external_tool_timeout_ms
        }
      );

      if (result.success && result.stdout) {
        const parseResult = safeJsonParse(result.stdout);
        
        if (parseResult.success) {
          logger.debug("CUE export completed", { 
            projectId, 
            duration: result.duration_ms 
          });
          
          return { success: true, resolved: parseResult.data };
        } else {
          return { 
            success: false, 
            error: `Invalid JSON from CUE export: ${parseResult.error}` 
          };
        }
      } else {
        return { 
          success: false, 
          error: result.stderr || "CUE export failed with no output" 
        };
      }
    } catch (error) {
      logger.error("CUE export error", error instanceof Error ? error : undefined, { projectId });
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  /**
   * Run jq assertions on resolved specification
   */
  private async runJqAssertions(
    resolved: Record<string, unknown>
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const resolvedJson = JSON.stringify(resolved, null, 2);

    // Create temporary file for jq processing
    const tempFile = `/tmp/resolved_${generateId()}.json`;
    
    try {
      await Bun.write(tempFile, resolvedJson);

      // Example assertions - these should be configurable based on spec requirements
      const assertions = [
        // Check for orphaned tokens
        {
          query: '[paths(scalars) as $p | select(getpath($p) | type == "string" and test("[$][{][^}]+[}]")) | $p] | length',
          description: "Check for unresolved template tokens",
          threshold: 0
        },
        // Check coverage completeness
        {
          query: '.capabilities // {} | keys | length',
          description: "Verify capabilities are defined",
          threshold: 1
        }
      ];

      for (const assertion of assertions) {
        try {
          const result = await executeCommand(
            this.config.jq_binary_path,
            [assertion.query, tempFile],
            { timeout: 5000 }
          );

          if (result.success) {
            const value = parseInt(result.stdout.trim()) || 0;
            
            if (assertion.threshold !== undefined && value > assertion.threshold) {
              errors.push({
                type: 'assertion',
                message: `${assertion.description}: expected <= ${assertion.threshold}, got ${value}`,
                details: { 
                  query: assertion.query,
                  value,
                  threshold: assertion.threshold
                }
              });
            }
          } else {
            errors.push({
              type: 'assertion',
              message: `jq assertion failed: ${assertion.description}`,
              details: { 
                query: assertion.query,
                error: result.stderr
              }
            });
          }
        } catch (error) {
          errors.push({
            type: 'assertion',
            message: `jq execution error for ${assertion.description}`,
            details: { 
              query: assertion.query,
              error: error instanceof Error ? error.message : "Unknown error"
            }
          });
        }
      }

    } catch (error) {
      errors.push({
        type: 'assertion',
        message: `Failed to create temporary file for jq processing`,
        details: { error: error instanceof Error ? error.message : "Unknown error" }
      });
    } finally {
      // Clean up temp file
      try {
        const exists = await Bun.file(tempFile).exists();
        if (exists) {
          await Bun.write(tempFile, "");
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    return errors;
  }

  /**
   * Run custom TypeScript validators
   */
  private async runCustomValidators(
    resolved: Record<string, unknown>
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate duplicates
      const duplicateCheck = this.findDuplicates(resolved);
      duplicateCheck.forEach(duplicate => {
        warnings.push({
          type: 'duplicate',
          message: `Duplicate ${duplicate.type}: ${duplicate.name}`,
          location: duplicate.locations.join(', ')
        });
      });

      // Check for undefined capabilities
      if (typeof resolved === 'object' && resolved !== null) {
        const capabilities = (resolved as any).capabilities;
        
        if (!capabilities || Object.keys(capabilities).length === 0) {
          errors.push({
            type: 'custom',
            message: 'No capabilities defined in specification'
          });
        }
      }

      // Add more custom validations as needed

    } catch (error) {
      errors.push({
        type: 'custom',
        message: `Custom validator error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return { errors, warnings };
  }

  /**
   * Find duplicates in the resolved specification
   */
  private findDuplicates(resolved: Record<string, unknown>): Duplicate[] {
    const duplicates: Duplicate[] = [];
    
    try {
      // This is a simplified implementation
      // In a real system, you'd want more sophisticated duplicate detection
      
      if (typeof resolved === 'object' && resolved !== null) {
        const capabilities = (resolved as any).capabilities || {};
        const capabilityNames = Object.keys(capabilities);
        const nameCount: Record<string, string[]> = {};

        // Count occurrences of capability names
        capabilityNames.forEach(name => {
          const parts = name.split('.');
          parts.forEach(part => {
            if (!nameCount[part]) nameCount[part] = [];
            nameCount[part].push(name);
          });
        });

        // Find duplicates
        Object.entries(nameCount).forEach(([name, locations]) => {
          if (locations.length > 1) {
            duplicates.push({
              type: 'capability',
              name,
              locations
            });
          }
        });
      }
    } catch (error) {
      logger.error("Error finding duplicates", error instanceof Error ? error : undefined);
    }

    return duplicates;
  }

  /**
   * Complete validation pipeline
   */
  async validateProject(
    projectId: string, 
    fragments: Fragment[]
  ): Promise<{
    success: boolean;
    specHash: string;
    resolved?: Record<string, unknown>;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const startTime = Date.now();
    
    try {
      // Step 1: Write fragments to filesystem
      await this.writeFragmentsToFS(projectId, fragments);

      // Step 2: Run CUE validation
      const schemaErrors = await this.runCueValidation(projectId);

      // Step 3: Export resolved specification
      const exportResult = await this.exportResolvedSpec(projectId);
      
      if (!exportResult.success || !exportResult.resolved) {
        return {
          success: false,
          specHash: "",
          errors: [
            ...schemaErrors,
            {
              type: 'schema',
              message: exportResult.error || "Failed to export resolved specification"
            }
          ],
          warnings: []
        };
      }

      // Step 4: Compute spec hash
      const specHash = computeSpecHash(JSON.stringify(exportResult.resolved));

      // Step 5: Run jq assertions
      const assertionErrors = await this.runJqAssertions(exportResult.resolved);

      // Step 6: Run custom validators
      const customValidation = await this.runCustomValidators(exportResult.resolved);

      const allErrors = [...schemaErrors, ...assertionErrors, ...customValidation.errors];
      const success = allErrors.length === 0;

      const duration = Date.now() - startTime;
      
      logger.info("Validation completed", {
        projectId,
        success,
        specHash,
        errorCount: allErrors.length,
        warningCount: customValidation.warnings.length,
        duration
      });

      return {
        success,
        specHash,
        resolved: exportResult.resolved,
        errors: allErrors,
        warnings: customValidation.warnings
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error("Validation pipeline error", error instanceof Error ? error : undefined, {
        projectId,
        duration
      });

      return {
        success: false,
        specHash: "",
        errors: [{
          type: 'custom',
          message: `Validation pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        warnings: []
      };
    }
  }

  /**
   * Generate gap analysis
   */
  async generateGapSet(resolved: Record<string, unknown>): Promise<GapSet> {
    try {
      // This is a simplified implementation
      // In practice, you'd want more sophisticated gap analysis
      
      const missing_capabilities: string[] = [];
      const orphaned_tokens: TokenReference[] = [];
      const coverage_gaps: CoverageGap[] = [];
      const duplicates = this.findDuplicates(resolved);

      // Find orphaned tokens by looking for unresolved template expressions
      const jsonStr = JSON.stringify(resolved);
      const tokenMatches = jsonStr.match(/\$\{[^}]+\}/g) || [];
      
      tokenMatches.forEach(token => {
        orphaned_tokens.push({
          token,
          defined_in: [],
          referenced_in: ["resolved.json"]
        });
      });

      // Analyze coverage gaps (simplified)
      if (typeof resolved === 'object' && resolved !== null) {
        const capabilities = (resolved as any).capabilities || {};
        const tests = (resolved as any).tests || {};
        
        Object.keys(capabilities).forEach(capability => {
          const hasTests = Object.keys(tests).some(test => 
            test.includes(capability) || tests[test]?.covers?.includes(capability)
          );
          
          if (!hasTests) {
            coverage_gaps.push({
              capability,
              expected_coverage: 100,
              actual_coverage: 0,
              missing_scenarios: ["basic", "error_handling", "edge_cases"]
            });
          }
        });
      }

      return {
        missing_capabilities,
        orphaned_tokens,
        coverage_gaps,
        duplicates
      };

    } catch (error) {
      logger.error("Gap analysis error", error instanceof Error ? error : undefined);
      
      return {
        missing_capabilities: [],
        orphaned_tokens: [],
        coverage_gaps: [],
        duplicates: []
      };
    }
  }

  /**
   * Clean up project workspace
   */
  async cleanupProject(projectId: string): Promise<void> {
    try {
      const projectDir = this.getProjectDir(projectId);
      await executeCommand("rm", ["-rf", projectDir]);
      
      logger.debug("Cleaned up project workspace", { projectId });
    } catch (error) {
      logger.error("Failed to cleanup project workspace", error instanceof Error ? error : undefined, {
        projectId
      });
    }
  }
}