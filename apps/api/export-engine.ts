/**
 * Export Engine - Transforms CUE schemas to various formats
 * Requires explicit tagging to avoid generating nonsense outputs
 */

import { spawn } from 'bun';
import { writeFile, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export interface ExportOptions {
  format: ExportFormat;
  strict?: boolean;
  includeExamples?: boolean;
  outputMode?: 'single' | 'multiple';
}

export type ExportFormat = 'openapi' | 'types' | 'k8s' | 'terraform' | 'json-schema';

export interface ExportResult {
  success: boolean;
  data?: any;
  files?: Array<{ name: string; content: string; format: ExportFormat }>;
  error?: string;
  warnings?: string[];
  metadata?: {
    detectedTags: string[];
    exportedSchemas: string[];
    generatedAt: string;
  };
}

interface SchemaTag {
  format: ExportFormat;
  name: string;
  originalTag?: string;  // Store original tag name from CUE content
  version?: string;
  namespace?: string;
  outputFile?: string;
}

/**
 * Export engine that transforms CUE to various formats with strict tagging requirements
 */
export class ExportEngine {
  /**
   * Export CUE content to specified format with tag validation
   */
  async export(cueContent: string, options: ExportOptions): Promise<ExportResult> {
    try {
      // First, analyze the CUE content for export tags
      const tagAnalysis = await this.analyzeExportTags(cueContent);
      
      if (!tagAnalysis.success) {
        return {
          success: false,
          error: tagAnalysis.error || 'Failed to analyze export tags'
        };
      }

      // Check if content has appropriate tags for the requested format
      const compatibleTags = tagAnalysis.tags.filter(tag => tag.format === options.format);
      
      if (compatibleTags.length === 0) {
        return {
          success: false,
          error: `No #${options.format.toUpperCase()} tags found in schema. Add explicit tags to enable export.`,
          warnings: [`Available tags: ${tagAnalysis.tags.map(t => `#${t.format.toUpperCase()}`).join(', ')}`]
        };
      }

      // Generate exports for each compatible tag
      const exportResults: Array<{ name: string; content: string; format: ExportFormat }> = [];
      const warnings: string[] = [];

      for (const tag of compatibleTags) {
        const result = await this.generateExport(cueContent, tag, options);
        
        if (result.success && result.content) {
          exportResults.push({
            name: tag.outputFile || `${tag.name}.${this.getFileExtension(options.format)}`,
            content: result.content,
            format: options.format
          });
        } else {
          warnings.push(`Failed to export ${tag.name}: ${result.error}`);
        }
      }

      // If no exports succeeded, return as error instead of warnings
      if (exportResults.length === 0 && warnings.length > 0) {
        return {
          success: false,
          error: warnings[0], // Use first warning as main error
          warnings: warnings.length > 1 ? warnings.slice(1) : undefined
        };
      }

      return {
        success: exportResults.length > 0,
        files: exportResults,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          detectedTags: tagAnalysis.tags.map(t => `#${t.originalTag ? t.originalTag.toUpperCase() : t.format.toUpperCase()}`),
          exportedSchemas: exportResults.map(r => r.name),
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  /**
   * Analyze CUE content for export tags and schema structure
   */
  private async analyzeExportTags(cueContent: string): Promise<{
    success: boolean;
    tags: SchemaTag[];
    error?: string;
  }> {
    const tags: SchemaTag[] = [];
    
    // Parse export tags from CUE content
    // Tags should be in format: // #OpenAPI, // #K8s, // #TypeScript
    // Split into lines and process each line that starts with a tag
    const lines = cueContent.split(/\r?\n/);
    
    for (const line of lines) {
      const tagMatch = line.match(/\/\/\s*#(\w+)(?:\s+(\S+))?(?:\s+(.+))?/);
      if (!tagMatch) continue;
      
      const [_, formatStr, nameOrOptions, options] = tagMatch;
      
      // Map tag names to internal format names
      const tagToFormatMap: Record<string, ExportFormat> = {
        'openapi': 'openapi',
        'typescript': 'types',
        'types': 'types',
        'k8s': 'k8s',
        'kubernetes': 'k8s',
        'terraform': 'terraform',
        'tf': 'terraform',
        'jsonschema': 'json-schema',
        'json-schema': 'json-schema'
      };
      
      const normalizedTag = formatStr.toLowerCase();
      const format = tagToFormatMap[normalizedTag];
      
      if (!format) {
        continue; // Skip invalid tags
      }

      // Parse tag options
      let name = nameOrOptions || 'default';
      let version: string | undefined;
      let namespace: string | undefined;
      let outputFile: string | undefined;

      if (options) {
        // Parse options like version=3.1, namespace=production, file=api.yaml
        const optionPairs = options.split(',').map(opt => opt.trim().split('='));
        for (const [key, value] of optionPairs) {
          switch (key) {
            case 'version':
              version = value;
              break;
            case 'namespace':
              namespace = value;
              break;
            case 'file':
              outputFile = value;
              break;
          }
        }
      }

      tags.push({
        format,
        name,
        originalTag: formatStr,  // Store original tag name for metadata
        version,
        namespace,
        outputFile
      });
    }

    return {
      success: true,
      tags
    };
  }

  /**
   * Generate export for a specific tag
   */
  private async generateExport(
    cueContent: string, 
    tag: SchemaTag, 
    options: ExportOptions
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      switch (tag.format) {
        case 'openapi':
          return await this.generateOpenAPI(cueContent, tag, options);
        case 'types':
          return await this.generateTypeScript(cueContent, tag, options);
        case 'k8s':
          return await this.generateKubernetes(cueContent, tag, options);
        case 'terraform':
          return await this.generateTerraform(cueContent, tag, options);
        case 'json-schema':
          return await this.generateJsonSchemaInternal(cueContent);
        default:
          return {
            success: false,
            error: `Unsupported export format: ${tag.format}. Supported formats: openapi, types, k8s, terraform, json-schema`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export generation failed'
      };
    }
  }

  /**
   * Generate OpenAPI 3.1 specification from CUE schema
   */
  private async generateOpenAPI(
    cueContent: string,
    tag: SchemaTag,
    options: ExportOptions
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    const tempDir = await mkdtemp(join(tmpdir(), 'arbiter-openapi-'));
    const cueFile = join(tempDir, 'schema.cue');
    
    // Use the original CUE content directly
    await writeFile(cueFile, cueContent);

    try {
      const proc = spawn({
        cmd: ['cue', 'export', '--out', 'yaml', cueFile],
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(proc.stdout).text();
      const error = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        return {
          success: false,
          error: `CUE export failed: ${error}`
        };
      }

      return {
        success: true,
        content: output
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute CUE export'
      };
    }
  }

  /**
   * Generate TypeScript definitions from CUE schema via JSON Schema
   */
  private async generateTypeScript(
    cueContent: string,
    tag: SchemaTag,
    options: ExportOptions
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      // Parse CUE content directly to generate TypeScript definitions
      const tsTypes = this.cueToTypeScript(cueContent, tag.name);
      
      return {
        success: true,
        content: tsTypes
      };
    } catch (error) {
      return {
        success: false,
        error: `TypeScript generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate Kubernetes YAML from CUE schema
   */
  private async generateKubernetes(
    cueContent: string,
    tag: SchemaTag,
    options: ExportOptions
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    const tempDir = await mkdtemp(join(tmpdir(), 'arbiter-k8s-'));
    const cueFile = join(tempDir, 'k8s.cue');
    
    // Use the original CUE content directly for K8s export
    await writeFile(cueFile, cueContent);

    try {
      const proc = spawn({
        cmd: ['cue', 'export', '--out', 'yaml', cueFile],
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(proc.stdout).text();
      const error = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        return {
          success: false,
          error: `CUE K8s export failed: ${error}`
        };
      }

      return {
        success: true,
        content: output
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute K8s export'
      };
    }
  }

  /**
   * Generate Terraform configuration from CUE schema
   */
  private async generateTerraform(
    cueContent: string,
    tag: SchemaTag,
    options: ExportOptions
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    // Convert CUE to HCL format for Terraform
    const tempDir = await mkdtemp(join(tmpdir(), 'arbiter-tf-'));
    const cueFile = join(tempDir, 'terraform.cue');
    
    // Use the original CUE content directly
    await writeFile(cueFile, cueContent);

    try {
      const proc = spawn({
        cmd: ['cue', 'export', '--out', 'json', cueFile],
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(proc.stdout).text();
      const error = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        return {
          success: false,
          error: `CUE Terraform export failed: ${error}`
        };
      }

      // Convert JSON to HCL format
      const jsonData = JSON.parse(output);
      const hclContent = this.jsonToHCL(jsonData);

      return {
        success: true,
        content: hclContent
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute Terraform export'
      };
    }
  }

  /**
   * Generate JSON Schema from CUE
   */
  private async generateJsonSchemaInternal(
    cueContent: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    const tempDir = await mkdtemp(join(tmpdir(), 'arbiter-jsonschema-'));
    const cueFile = join(tempDir, 'schema.cue');
    
    await writeFile(cueFile, cueContent);

    try {
      const proc = spawn({
        cmd: ['cue', 'export', '--out=jsonschema', cueFile],
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(proc.stdout).text();
      const error = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        return {
          success: false,
          error: `CUE JSON Schema export failed: ${error}`
        };
      }

      return {
        success: true,
        content: output
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute JSON Schema export'
      };
    }
  }

  /**
   * Convert JSON Schema to TypeScript definitions
   */
  /**
   * Convert CUE schema directly to TypeScript definitions
   */
  private cueToTypeScript(cueContent: string, baseName: string): string {
    const lines: string[] = [
      '// Generated TypeScript definitions',
      '// This file was auto-generated - do not edit manually',
      '',
    ];

    // Simple CUE parser - looks for struct definitions like #User: { ... }
    const structRegex = /#(\w+):\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let match;

    while ((match = structRegex.exec(cueContent)) !== null) {
      const [_, structName, structBody] = match;
      
      // Parse fields from struct body
      const props: string[] = [];
      const fieldRegex = /(\w+)(\?)?\s*:\s*(\w+|\{[^}]*\})/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(structBody)) !== null) {
        const [__, fieldName, optional, fieldType] = fieldMatch;
        const optionalMark = optional ? '?' : '';
        const tsType = this.cueTypeToTypeScript(fieldType.trim());
        props.push(`  ${fieldName}${optionalMark}: ${tsType};`);
      }

      lines.push(`export interface ${structName} {`);
      lines.push(...props);
      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert CUE types to TypeScript types
   */
  private cueTypeToTypeScript(cueType: string): string {
    // Handle basic types
    const typeMap: Record<string, string> = {
      'string': 'string',
      'number': 'number',
      'bool': 'boolean',
      'int': 'number',
      'float': 'number',
    };

    // Handle object types
    if (cueType.startsWith('{') && cueType.endsWith('}')) {
      const innerContent = cueType.slice(1, -1).trim();
      if (!innerContent) {
        return 'Record<string, unknown>';
      }
      
      // Parse nested object structure
      const props: string[] = [];
      const fieldRegex = /(\w+)(\?)?\s*:\s*(\w+)/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(innerContent)) !== null) {
        const [_, fieldName, optional, fieldType] = fieldMatch;
        const optionalMark = optional ? '?' : '';
        const tsType = typeMap[fieldType] || 'unknown';
        props.push(`${fieldName}${optionalMark}: ${tsType}`);
      }

      return `{ ${props.join(', ')} }`;
    }

    return typeMap[cueType] || 'unknown';
  }

  private jsonSchemaToTypeScript(schema: any, baseName: string): string {
    const lines: string[] = [
      '// Generated TypeScript definitions',
      '// This file was auto-generated - do not edit manually',
      '',
    ];

    const generateInterface = (name: string, obj: any): string => {
      const props: string[] = [];
      
      if (obj.properties) {
        for (const [propName, propSchema] of Object.entries(obj.properties as Record<string, any>)) {
          const optional = !obj.required?.includes(propName) ? '?' : '';
          const tsType = this.jsonSchemaTypeToTS(propSchema);
          const comment = propSchema.description ? ` // ${propSchema.description}` : '';
          props.push(`  ${propName}${optional}: ${tsType};${comment}`);
        }
      }

      return [
        `export interface ${name} {`,
        ...props,
        '}'
      ].join('\n');
    };

    // Generate main interface
    if (schema.type === 'object') {
      lines.push(generateInterface(baseName, schema));
    }

    // Generate nested interfaces if needed
    if (schema.definitions) {
      for (const [defName, defSchema] of Object.entries(schema.definitions as Record<string, any>)) {
        lines.push('');
        lines.push(generateInterface(defName, defSchema));
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert JSON Schema type to TypeScript type
   */
  private jsonSchemaTypeToTS(schema: any): string {
    if (schema.$ref) {
      // Reference to another definition
      return schema.$ref.split('/').pop();
    }

    switch (schema.type) {
      case 'string':
        if (schema.enum) {
          return schema.enum.map((v: string) => `"${v}"`).join(' | ');
        }
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        const itemType = schema.items ? this.jsonSchemaTypeToTS(schema.items) : 'any';
        return `${itemType}[]`;
      case 'object':
        if (schema.additionalProperties) {
          const valueType = this.jsonSchemaTypeToTS(schema.additionalProperties);
          return `Record<string, ${valueType}>`;
        }
        return 'object';
      default:
        return 'any';
    }
  }

  /**
   * Convert JSON to HCL format for Terraform
   */
  private jsonToHCL(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    const lines: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        lines.push(`${spaces}${key} = "${value}"`);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`${spaces}${key} = ${value}`);
      } else if (Array.isArray(value)) {
        lines.push(`${spaces}${key} = [`);
        value.forEach(item => {
          if (typeof item === 'string') {
            lines.push(`${spaces}  "${item}",`);
          } else {
            lines.push(`${spaces}  ${JSON.stringify(item)},`);
          }
        });
        lines.push(`${spaces}]`);
      } else if (value && typeof value === 'object') {
        lines.push(`${spaces}${key} = {`);
        lines.push(this.jsonToHCL(value, indent + 1));
        lines.push(`${spaces}}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get file extension for export format
   */
  private getFileExtension(format: ExportFormat): string {
    switch (format) {
      case 'openapi':
        return 'openapi.yaml';
      case 'types':
        return 'd.ts';
      case 'k8s':
        return 'k8s.yaml';
      case 'terraform':
        return 'tf';
      case 'json-schema':
        return 'schema.json';
      default:
        return 'txt';
    }
  }
}

/**
 * Validate export format support
 */
export function validateExportFormat(format: string): format is ExportFormat {
  const validFormats: ExportFormat[] = ['openapi', 'types', 'k8s', 'terraform', 'json-schema'];
  return validFormats.includes(format as ExportFormat);
}

/**
 * Get supported export formats with descriptions
 */
export function getSupportedFormats(): Array<{ format: ExportFormat; description: string; example: string }> {
  return [
    {
      format: 'openapi',
      description: 'OpenAPI 3.1 specification',
      example: '// #OpenAPI api-v1 version=3.1.0, file=api.yaml'
    },
    {
      format: 'types',
      description: 'TypeScript type definitions',
      example: '// #TypeScript models file=types.d.ts'
    },
    {
      format: 'k8s',
      description: 'Kubernetes YAML manifests',
      example: '// #K8s deployment namespace=production'
    },
    {
      format: 'terraform',
      description: 'Terraform HCL configuration',
      example: '// #Terraform infrastructure file=main.tf'
    },
    {
      format: 'json-schema',
      description: 'JSON Schema specification',
      example: '// #JsonSchema validation file=schema.json'
    }
  ];
}