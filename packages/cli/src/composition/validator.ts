import fs from "fs-extra";
import { spawn } from "node:child_process";
import type { ValidationError, ValidationWarning } from "../types.js";

/**
 * SRF and CUE specification validator
 */
export class SRFValidator {
  /**
   * Validate an SRF file
   */
  async validateSRF(filePath: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      const content = await fs.readFile(filePath, "utf-8");

      // Basic SRF structure validation
      const structureValidation = this.validateSRFStructure(content);
      if (!structureValidation.isValid) {
        result.isValid = false;
        result.errors.push(...structureValidation.errors);
      }
      result.warnings.push(...structureValidation.warnings);

      // YAML/Metadata validation
      const metadataValidation = this.validateMetadata(content);
      if (!metadataValidation.isValid) {
        result.isValid = false;
        result.errors.push(...metadataValidation.errors);
      }
      result.warnings.push(...metadataValidation.warnings);

      // Content validation
      const contentValidation = this.validateSRFContent(content);
      if (!contentValidation.isValid) {
        result.isValid = false;
        result.errors.push(...contentValidation.errors);
      }
      result.warnings.push(...contentValidation.warnings);
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Failed to read SRF file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Validate a composed CUE specification
   */
  async validateComposedSpec(spec: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      // Write spec to temporary file for CUE validation
      const tempFile = `/tmp/arbiter-spec-${Date.now()}.cue`;
      await fs.writeFile(tempFile, spec, "utf-8");

      try {
        // Use CUE CLI to validate the specification
        const cueValidation = await this.runCUEValidation(tempFile);
        if (!cueValidation.success) {
          result.isValid = false;
          result.errors.push(...cueValidation.errors);
        }
        result.warnings.push(...cueValidation.warnings);

        // Syntax validation
        const syntaxValidation = this.validateCUESyntax(spec);
        if (!syntaxValidation.isValid) {
          result.isValid = false;
          result.errors.push(...syntaxValidation.errors);
        }

        // Semantic validation
        const semanticValidation = this.validateSemantics(spec);
        if (!semanticValidation.isValid) {
          result.isValid = false;
          result.errors.push(...semanticValidation.errors);
        }
        result.warnings.push(...semanticValidation.warnings);
      } finally {
        // Clean up temp file
        await fs.remove(tempFile).catch(() => {});
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Spec validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Validate SRF document structure
   */
  private validateSRFStructure(content: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      // Check for required SRF sections
      const requiredSections = [
        "## Project Metadata",
        "## Requirements Analysis",
        "## Technical Specifications",
        "## Quality Attributes",
      ];

      for (const section of requiredSections) {
        if (!content.includes(section)) {
          result.isValid = false;
          result.errors.push(`Missing required SRF section: ${section}`);
        }
      }

      // Check for SRF version declaration
      if (!content.includes("# SRF v1.1") && !content.includes("# SRF v1.0")) {
        result.warnings.push("SRF version not explicitly declared");
      }

      // Check for proper YAML metadata blocks
      const yamlBlocks = content.match(/```yaml[\\s\\S]*?```/g) || [];
      if (yamlBlocks.length === 0) {
        result.isValid = false;
        result.errors.push("No YAML metadata blocks found");
      }

      // Validate YAML syntax in each block
      for (let i = 0; i < yamlBlocks.length; i++) {
        const yamlContent = yamlBlocks[i].replace(/```yaml\\n?|```/g, "");
        try {
          // Basic YAML structure validation
          const lines = yamlContent.split("\\n");
          const indentLevel = 0;

          for (const line of lines) {
            if (line.trim() === "") continue;

            const currentIndent = line.length - line.trimStart().length;
            if (currentIndent % 2 !== 0) {
              result.warnings.push(`Inconsistent YAML indentation in block ${i + 1}`);
            }
          }
        } catch (error) {
          result.errors.push(`Invalid YAML syntax in block ${i + 1}`);
          result.isValid = false;
        }
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Structure validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Validate SRF metadata
   */
  private validateMetadata(content: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      // Extract first YAML block (should be metadata)
      const yamlMatch = content.match(/```yaml([\\s\\S]*?)```/);
      if (!yamlMatch) {
        result.isValid = false;
        result.errors.push("No metadata YAML block found");
        return result;
      }

      const yamlContent = yamlMatch[1];

      // Check for required metadata fields
      const requiredFields = [
        "srf.metadata:",
        "project_name:",
        "description:",
        "created_at:",
        "version:",
      ];

      for (const field of requiredFields) {
        if (!yamlContent.includes(field)) {
          result.isValid = false;
          result.errors.push(`Missing required metadata field: ${field}`);
        }
      }

      // Validate ISO date format for timestamps
      const dateRegex = /\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/;
      const createdAtMatch = yamlContent.match(/created_at:\\s*"([^"]+)"/);
      if (createdAtMatch && !dateRegex.test(createdAtMatch[1])) {
        result.warnings.push("created_at should be in ISO 8601 format");
      }

      // Validate version format
      const versionMatch = yamlContent.match(/version:\\s*"([^"]+)"/);
      if (versionMatch && !/^\\d+\\.\\d+(\\.\\d+)?/.test(versionMatch[1])) {
        result.warnings.push("version should follow semantic versioning format");
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Metadata validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Validate SRF content sections
   */
  private validateSRFContent(content: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      // Check for empty sections
      const sections = [
        "## Requirements Analysis",
        "## Technical Specifications",
        "## Quality Attributes",
        "## Integration Points",
      ];

      for (const section of sections) {
        const sectionRegex = new RegExp(
          `${section.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}([\\s\\S]*?)(?=##|$)`,
        );
        const sectionMatch = content.match(sectionRegex);

        if (sectionMatch) {
          const sectionContent = sectionMatch[1].trim();
          if (sectionContent.length < 50) {
            result.warnings.push(`Section "${section}" appears to be empty or very brief`);
          }
        }
      }

      // Validate priority levels (Must/Should/Could/Won't)
      const requirements = content.match(/^\\s*[-*]\\s+(.+)$/gm) || [];
      const priorityKeywords = ["must", "should", "could", "won't", "will not"];

      for (const req of requirements) {
        const hasKeyword = priorityKeywords.some((keyword) =>
          req.toLowerCase().includes(keyword.toLowerCase()),
        );
        if (!hasKeyword) {
          result.warnings.push(
            `Requirement may be missing priority level: "${req.slice(0, 50)}..."`,
          );
        }
      }

      // Check for technical specification details
      const techSpecSection = content.match(/## Technical Specifications([\\s\\S]*?)(?=##|$)/);
      if (techSpecSection) {
        const techContent = techSpecSection[1];

        // Look for common technical elements
        const techElements = ["API", "database", "architecture", "framework", "library", "service"];
        const foundElements = techElements.filter((element) =>
          techContent.toLowerCase().includes(element),
        );

        if (foundElements.length === 0) {
          result.warnings.push("Technical Specifications section may lack technical details");
        }
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Content validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Run CUE CLI validation on a specification file
   */
  private async runCUEValidation(filePath: string): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return new Promise((resolve) => {
      const result = {
        success: true,
        errors: [] as string[],
        warnings: [] as string[],
      };

      const cueProcess = spawn("cue", ["vet", filePath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      cueProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      cueProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      cueProcess.on("close", (code) => {
        if (code !== 0) {
          result.success = false;
          if (stderr) {
            result.errors.push(stderr.trim());
          }
          if (stdout) {
            result.warnings.push(stdout.trim());
          }
        }

        resolve(result);
      });

      cueProcess.on("error", (error) => {
        result.success = false;
        result.errors.push(`CUE validation failed: ${error.message}`);
        resolve(result);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        cueProcess.kill("SIGTERM");
        result.success = false;
        result.errors.push("CUE validation timed out");
        resolve(result);
      }, 10000);
    });
  }

  /**
   * Validate CUE syntax without external tools
   */
  private validateCUESyntax(spec: string): {
    isValid: boolean;
    errors: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
    };

    try {
      // Basic syntax checks
      const lines = spec.split("\\n");
      let braceCount = 0;
      let bracketCount = 0;
      let parenCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Count brackets, braces, parens
        for (const char of line) {
          switch (char) {
            case "{":
              braceCount++;
              break;
            case "}":
              braceCount--;
              break;
            case "[":
              bracketCount++;
              break;
            case "]":
              bracketCount--;
              break;
            case "(":
              parenCount++;
              break;
            case ")":
              parenCount--;
              break;
          }
        }

        // Check for negative counts (closing without opening)
        if (braceCount < 0) {
          result.isValid = false;
          result.errors.push(`Line ${lineNum}: Unmatched closing brace '}'`);
        }
        if (bracketCount < 0) {
          result.isValid = false;
          result.errors.push(`Line ${lineNum}: Unmatched closing bracket ']'`);
        }
        if (parenCount < 0) {
          result.isValid = false;
          result.errors.push(`Line ${lineNum}: Unmatched closing parenthesis ')'`);
        }
      }

      // Check for unclosed brackets/braces/parens
      if (braceCount > 0) {
        result.isValid = false;
        result.errors.push("Unclosed braces detected");
      }
      if (bracketCount > 0) {
        result.isValid = false;
        result.errors.push("Unclosed brackets detected");
      }
      if (parenCount > 0) {
        result.isValid = false;
        result.errors.push("Unclosed parentheses detected");
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Syntax validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Validate semantic aspects of CUE specification
   */
  private validateSemantics(spec: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      // Check for package declaration
      if (!spec.includes("package ")) {
        result.warnings.push("No package declaration found");
      }

      // Check for duplicate field definitions
      const fieldMatches = spec.match(/^\\s*([a-zA-Z_][a-zA-Z0-9_]*):.*$/gm) || [];
      const fieldNames = fieldMatches.map((match) => match.trim().split(":")[0]);
      const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);

      if (duplicates.length > 0) {
        result.warnings.push(
          `Potential duplicate field definitions: ${[...new Set(duplicates)].join(", ")}`,
        );
      }

      // Check for undefined references (basic check)
      const references = spec.match(/#[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      const definitions = spec.match(/#[a-zA-Z_][a-zA-Z0-9_]*\\s*:/g) || [];

      const definedTypes = new Set(definitions.map((def) => def.replace(/\\s*:.*/, "")));
      const usedTypes = new Set(references);

      for (const usedType of usedTypes) {
        if (!definedTypes.has(usedType)) {
          result.warnings.push(`Potentially undefined type reference: ${usedType}`);
        }
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Semantic validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }
}
