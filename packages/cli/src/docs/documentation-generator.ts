/**
 * Documentation Generator for CUE Schemas
 *
 * Generates comprehensive documentation from parsed CUE schemas in multiple formats.
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { ParsedField, ParsedSchema, ParsedType } from "./schema-parser.js";

export interface GeneratorOptions {
  outputDir: string;
  formats: ("markdown" | "html" | "json")[];
  title?: string;
  includePrivateTypes?: boolean;
  includeExamples?: boolean;
  includeRelationships?: boolean;
  customTemplates?: Partial<Templates>;
}

export interface Templates {
  markdownHeader: (title: string) => string;
  markdownType: (type: ParsedType, schema: ParsedSchema) => string;
  markdownField: (field: ParsedField) => string;
  htmlHeader: (title: string) => string;
  htmlType: (type: ParsedType, schema: ParsedSchema) => string;
  htmlField: (field: ParsedField) => string;
  htmlFooter: () => string;
}

export class DocumentationGenerator {
  private options: GeneratorOptions;
  private templates: Templates;

  constructor(options: GeneratorOptions) {
    this.options = {
      includePrivateTypes: false,
      includeExamples: true,
      includeRelationships: true,
      ...options,
    };
    this.templates = { ...defaultTemplates, ...options.customTemplates };
  }

  /**
   * Generate documentation for a parsed schema
   */
  async generate(schema: ParsedSchema): Promise<void> {
    // Ensure output directory exists
    mkdirSync(this.options.outputDir, { recursive: true });

    for (const format of this.options.formats) {
      switch (format) {
        case "markdown":
          await this.generateMarkdown(schema);
          break;
        case "html":
          await this.generateHTML(schema);
          break;
        case "json":
          await this.generateJSON(schema);
          break;
      }
    }
  }

  private async generateMarkdown(schema: ParsedSchema): Promise<void> {
    const title = this.options.title || `${schema.package} Schema Documentation`;
    let content = this.templates.markdownHeader(title);

    // Add table of contents
    content += this.generateMarkdownTOC(schema);

    // Add package information
    content += this.generateMarkdownPackageInfo(schema);

    // Add type definitions
    const sortedTypes = this.getSortedTypes(schema);
    for (const type of sortedTypes) {
      if (!this.shouldIncludeType(type)) continue;
      content += this.templates.markdownType(type, schema);
    }

    // Add relationships diagram
    if (this.options.includeRelationships) {
      content += this.generateMarkdownRelationships(schema);
    }

    writeFileSync(path.join(this.options.outputDir, "schema.md"), content);
  }

  private async generateHTML(schema: ParsedSchema): Promise<void> {
    const title = this.options.title || `${schema.package} Schema Documentation`;
    let content = this.templates.htmlHeader(title);

    // Add navigation
    content += this.generateHTMLNavigation(schema);

    // Add main content
    content += '<main class="content">';

    // Package information
    content += this.generateHTMLPackageInfo(schema);

    // Type definitions
    const sortedTypes = this.getSortedTypes(schema);
    for (const type of sortedTypes) {
      if (!this.shouldIncludeType(type)) continue;
      content += this.templates.htmlType(type, schema);
    }

    // Relationships
    if (this.options.includeRelationships) {
      content += this.generateHTMLRelationships(schema);
    }

    content += "</main>";
    content += this.templates.htmlFooter();

    writeFileSync(path.join(this.options.outputDir, "schema.html"), content);
  }

  private async generateJSON(schema: ParsedSchema): Promise<void> {
    const jsonSchema = this.convertToJSONSchema(schema);
    writeFileSync(
      path.join(this.options.outputDir, "schema.json"),
      JSON.stringify(jsonSchema, null, 2),
    );
  }

  private generateMarkdownTOC(schema: ParsedSchema): string {
    const types = this.getSortedTypes(schema).filter((t) => this.shouldIncludeType(t));
    let toc = "\n## Table of Contents\n\n";

    toc += "- [Package Information](#package-information)\n";
    toc += "- [Types](#types)\n";

    for (const type of types) {
      const anchor = type.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      toc += `  - [${type.name}](#${anchor})\n`;
    }

    if (this.options.includeRelationships) {
      toc += "- [Type Relationships](#type-relationships)\n";
    }

    return toc + "\n";
  }

  private generateMarkdownPackageInfo(schema: ParsedSchema): string {
    let content = "## Package Information\n\n";
    content += `**Package:** \`${schema.package}\`\n\n`;

    if (schema.metadata.description) {
      content += `**Description:** ${schema.metadata.description}\n\n`;
    }

    if (schema.imports.length > 0) {
      content += "**Imports:**\n";
      for (const imp of schema.imports) {
        content += `- \`${imp}\`\n`;
      }
      content += "\n";
    }

    return content;
  }

  private generateMarkdownRelationships(schema: ParsedSchema): string {
    let content = "\n## Type Relationships\n\n";
    content += "```mermaid\n";
    content += "graph TD\n";

    const types = Array.from(schema.types.values()).filter((t) => this.shouldIncludeType(t));

    for (const type of types) {
      const typeId = type.name.replace(/[^a-zA-Z0-9]/g, "");
      content += `    ${typeId}[${type.name}]\n`;

      if (type.dependsOn) {
        for (const dep of type.dependsOn) {
          const depId = dep.replace(/[^a-zA-Z0-9]/g, "");
          content += `    ${typeId} --> ${depId}\n`;
        }
      }
    }

    content += "```\n\n";
    return content;
  }

  private generateHTMLNavigation(schema: ParsedSchema): string {
    const types = this.getSortedTypes(schema).filter((t) => this.shouldIncludeType(t));
    let nav = '<nav class="sidebar"><div class="nav-content">';
    nav += "<h2>Navigation</h2>";
    nav += "<ul>";
    nav += '<li><a href="#package-info">Package Information</a></li>';
    nav += '<li><a href="#types">Types</a><ul>';

    for (const type of types) {
      const anchor = type.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      nav += `<li><a href="#${anchor}">${type.name}</a></li>`;
    }

    nav += "</ul></li>";
    if (this.options.includeRelationships) {
      nav += '<li><a href="#relationships">Relationships</a></li>';
    }
    nav += "</ul></div></nav>";

    return nav;
  }

  private generateHTMLPackageInfo(schema: ParsedSchema): string {
    let content = '<section id="package-info">';
    content += "<h2>Package Information</h2>";
    content += `<p><strong>Package:</strong> <code>${schema.package}</code></p>`;

    if (schema.metadata.description) {
      content += `<p><strong>Description:</strong> ${schema.metadata.description}</p>`;
    }

    if (schema.imports.length > 0) {
      content += "<p><strong>Imports:</strong></p><ul>";
      for (const imp of schema.imports) {
        content += `<li><code>${imp}</code></li>`;
      }
      content += "</ul>";
    }

    content += "</section>";
    return content;
  }

  private generateHTMLRelationships(schema: ParsedSchema): string {
    let content = '<section id="relationships">';
    content += "<h2>Type Relationships</h2>";
    content += '<div class="mermaid">';
    content += "graph TD\n";

    const types = Array.from(schema.types.values()).filter((t) => this.shouldIncludeType(t));

    for (const type of types) {
      const typeId = type.name.replace(/[^a-zA-Z0-9]/g, "");
      content += `    ${typeId}[${type.name}]\n`;

      if (type.dependsOn) {
        for (const dep of type.dependsOn) {
          const depId = dep.replace(/[^a-zA-Z0-9]/g, "");
          content += `    ${typeId} --> ${depId}\n`;
        }
      }
    }

    content += "</div>";
    content += "</section>";
    return content;
  }

  private convertToJSONSchema(schema: ParsedSchema): any {
    const jsonSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: this.options.title || `${schema.package} Schema`,
      description: schema.metadata.description || `Schema for ${schema.package}`,
      type: "object",
      definitions: {} as any,
      properties: {} as any,
    };

    // Convert CUE types to JSON Schema definitions
    for (const [name, type] of schema.types) {
      if (!this.shouldIncludeType(type)) continue;
      jsonSchema.definitions[name] = this.convertTypeToJSONSchema(type);
    }

    return jsonSchema;
  }

  private convertTypeToJSONSchema(type: ParsedType): any {
    const jsonType: any = {
      title: type.name,
      description: type.description || `${type.name} type`,
    };

    switch (type.kind) {
      case "struct":
        jsonType.type = "object";
        jsonType.properties = {};
        if (type.fields) {
          for (const field of type.fields) {
            jsonType.properties[field.name] = this.convertFieldToJSONSchema(field);
          }
        }
        break;

      case "enum":
        jsonType.type = "string";
        if (type.values) {
          jsonType.enum = type.values;
        }
        break;

      case "constraint":
        if (type.baseType === "string") {
          jsonType.type = "string";
          // Add pattern if available
          const patternConstraint = type.constraints?.find((c) => c.startsWith("Pattern:"));
          if (patternConstraint) {
            jsonType.pattern = patternConstraint.replace("Pattern: ", "");
          }
        } else if (type.baseType === "number" || type.baseType === "int") {
          jsonType.type = type.baseType === "int" ? "integer" : "number";
          // Add numeric constraints
          type.constraints?.forEach((constraint) => {
            if (constraint.startsWith("Minimum:")) {
              jsonType.minimum = parseFloat(constraint.replace("Minimum: ", ""));
            } else if (constraint.startsWith("Maximum:")) {
              jsonType.maximum = parseFloat(constraint.replace("Maximum: ", ""));
            }
          });
        }
        break;

      case "union":
        if (type.values?.every((v) => typeof v === "string")) {
          jsonType.type = "string";
          jsonType.enum = type.values;
        } else {
          jsonType.oneOf = type.values?.map((v) => ({ const: v }));
        }
        break;

      case "primitive":
        if (type.baseType === "string") jsonType.type = "string";
        else if (type.baseType === "int") jsonType.type = "integer";
        else if (type.baseType === "number") jsonType.type = "number";
        else if (type.baseType === "bool") jsonType.type = "boolean";
        else jsonType.type = "string"; // fallback
        break;
    }

    // Add examples
    if (type.examples && type.examples.length > 0) {
      jsonType.examples = type.examples;
    }

    return jsonType;
  }

  private convertFieldToJSONSchema(field: ParsedField): any {
    const jsonField: any = {
      description: field.description,
    };

    // Determine type
    if (field.type === "string") {
      jsonField.type = "string";
    } else if (field.type === "int") {
      jsonField.type = "integer";
    } else if (field.type === "number") {
      jsonField.type = "number";
    } else if (field.type === "bool") {
      jsonField.type = "boolean";
    } else if (field.type.startsWith("#")) {
      jsonField.$ref = `#/definitions/${field.type.substring(1)}`;
    } else {
      jsonField.type = "string"; // fallback
    }

    // Add constraints
    if (field.constraints) {
      field.constraints.forEach((constraint) => {
        if (constraint.startsWith("Minimum:")) {
          jsonField.minimum = parseFloat(constraint.replace("Minimum: ", ""));
        } else if (constraint.startsWith("Maximum:")) {
          jsonField.maximum = parseFloat(constraint.replace("Maximum: ", ""));
        } else if (constraint === "Non-empty string") {
          jsonField.minLength = 1;
        }
      });
    }

    // Add examples
    if (field.examples && field.examples.length > 0) {
      jsonField.examples = field.examples;
    }

    return jsonField;
  }

  private getSortedTypes(schema: ParsedSchema): ParsedType[] {
    return Array.from(schema.types.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  private shouldIncludeType(type: ParsedType): boolean {
    if (!this.options.includePrivateTypes && type.name.startsWith("_")) {
      return false;
    }
    return true;
  }
}

const defaultTemplates: Templates = {
  markdownHeader: (title: string) => `# ${title}\n\n*Generated from CUE schema files*\n\n`,

  markdownType: (type: ParsedType, schema: ParsedSchema) => {
    const anchor = type.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let content = `## ${type.name} {#${anchor}}\n\n`;

    if (type.description) {
      content += `${type.description}\n\n`;
    }

    content += `**Type:** ${type.kind}\n\n`;

    if (type.baseType) {
      content += `**Base Type:** \`${type.baseType}\`\n\n`;
    }

    if (type.constraints && type.constraints.length > 0) {
      content += "**Constraints:**\n";
      type.constraints.forEach((constraint) => {
        content += `- ${constraint}\n`;
      });
      content += "\n";
    }

    if (type.values && type.values.length > 0) {
      content += "**Allowed Values:**\n";
      type.values.forEach((value) => {
        content += `- \`${value}\`\n`;
      });
      content += "\n";
    }

    if (type.examples && type.examples.length > 0) {
      content += "**Examples:**\n";
      type.examples.forEach((example) => {
        content += `- \`${example}\`\n`;
      });
      content += "\n";
    }

    if (type.dependsOn && type.dependsOn.length > 0) {
      content += "**Depends On:**\n";
      type.dependsOn.forEach((dep) => {
        content += `- [${dep}](#${dep.toLowerCase().replace(/[^a-z0-9]/g, "-")})\n`;
      });
      content += "\n";
    }

    if (type.usedBy && type.usedBy.length > 0) {
      content += "**Used By:**\n";
      type.usedBy.forEach((user) => {
        content += `- [${user}](#${user.toLowerCase().replace(/[^a-z0-9]/g, "-")})\n`;
      });
      content += "\n";
    }

    if (type.location) {
      content += `*Defined in: ${type.location.file}:${type.location.line}*\n\n`;
    }

    content += "---\n\n";
    return content;
  },

  markdownField: (field: ParsedField) => {
    let content = `- **${field.name}**`;
    if (field.optional) content += " *(optional)*";
    content += `: \`${field.type}\``;
    if (field.description) content += ` - ${field.description}`;
    content += "\n";
    return content;
  },

  htmlHeader: (title: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; line-height: 1.6; color: #333; }
        .container { display: flex; min-height: 100vh; }
        .sidebar { width: 280px; background: #f8f9fa; border-right: 1px solid #e9ecef; position: fixed; height: 100vh; overflow-y: auto; }
        .nav-content { padding: 1rem; }
        .content { margin-left: 280px; padding: 2rem; flex: 1; max-width: 800px; }
        .sidebar h2 { margin: 0 0 1rem 0; color: #495057; font-size: 1.1rem; }
        .sidebar ul { list-style: none; margin: 0; padding: 0; }
        .sidebar li { margin: 0; }
        .sidebar a { display: block; padding: 0.25rem 0; color: #666; text-decoration: none; border-radius: 4px; }
        .sidebar a:hover { color: #007bff; background: #e9f4ff; padding-left: 0.5rem; }
        .sidebar ul ul { padding-left: 1rem; }
        .sidebar ul ul a { font-size: 0.9rem; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 0.5rem; }
        h2 { color: #34495e; border-bottom: 1px solid #bdc3c7; padding-bottom: 0.3rem; margin-top: 2rem; }
        h3 { color: #7f8c8d; }
        code { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; }
        pre { background: #f8f9fa; padding: 1rem; border-radius: 6px; overflow-x: auto; border-left: 4px solid #3498db; }
        .type-card { background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .type-header { display: flex; align-items: center; margin-bottom: 1rem; }
        .type-title { font-size: 1.5rem; font-weight: 600; color: #2c3e50; margin: 0; }
        .type-kind { background: #e3f2fd; color: #1976d2; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 1rem; }
        .constraints { margin: 1rem 0; }
        .constraints h4 { margin: 0 0 0.5rem 0; color: #666; font-size: 0.9rem; }
        .constraints ul { margin: 0.5rem 0; padding-left: 1.5rem; }
        .constraints li { color: #666; margin: 0.25rem 0; }
        .examples { background: #f8f9fa; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
        .examples h4 { margin: 0 0 0.5rem 0; color: #666; }
        .relationships { margin: 1rem 0; }
        .relationships h4 { margin: 0 0 0.5rem 0; color: #666; font-size: 0.9rem; }
        .relationships a { color: #007bff; text-decoration: none; margin-right: 0.5rem; }
        .relationships a:hover { text-decoration: underline; }
        .mermaid { text-align: center; margin: 2rem 0; }
        .location { color: #888; font-style: italic; font-size: 0.85rem; margin-top: 1rem; }
        @media (max-width: 768px) {
            .sidebar { display: none; }
            .content { margin-left: 0; }
        }
    </style>
</head>
<body>
    <div class="container">`,

  htmlType: (type: ParsedType, schema: ParsedSchema) => {
    const anchor = type.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let content = `<div class="type-card" id="${anchor}">`;
    content += `<div class="type-header">`;
    content += `<h3 class="type-title">${type.name}</h3>`;
    content += `<span class="type-kind">${type.kind}</span>`;
    content += `</div>`;

    if (type.description) {
      content += `<p>${type.description}</p>`;
    }

    if (type.baseType) {
      content += `<p><strong>Base Type:</strong> <code>${type.baseType}</code></p>`;
    }

    if (type.constraints && type.constraints.length > 0) {
      content += `<div class="constraints">`;
      content += `<h4>Constraints:</h4>`;
      content += `<ul>`;
      type.constraints.forEach((constraint) => {
        content += `<li>${constraint}</li>`;
      });
      content += `</ul></div>`;
    }

    if (type.values && type.values.length > 0) {
      content += `<div class="constraints">`;
      content += `<h4>Allowed Values:</h4>`;
      content += `<ul>`;
      type.values.forEach((value) => {
        content += `<li><code>${value}</code></li>`;
      });
      content += `</ul></div>`;
    }

    if (type.examples && type.examples.length > 0) {
      content += `<div class="examples">`;
      content += `<h4>Examples:</h4>`;
      type.examples.forEach((example) => {
        content += `<code>${example}</code> `;
      });
      content += `</div>`;
    }

    if ((type.dependsOn && type.dependsOn.length > 0) || (type.usedBy && type.usedBy.length > 0)) {
      content += `<div class="relationships">`;

      if (type.dependsOn && type.dependsOn.length > 0) {
        content += `<h4>Depends On:</h4>`;
        type.dependsOn.forEach((dep) => {
          const depAnchor = dep.toLowerCase().replace(/[^a-z0-9]/g, "-");
          content += `<a href="#${depAnchor}">${dep}</a>`;
        });
      }

      if (type.usedBy && type.usedBy.length > 0) {
        content += `<h4>Used By:</h4>`;
        type.usedBy.forEach((user) => {
          const userAnchor = user.toLowerCase().replace(/[^a-z0-9]/g, "-");
          content += `<a href="#${userAnchor}">${user}</a>`;
        });
      }

      content += `</div>`;
    }

    if (type.location) {
      content += `<div class="location">Defined in: ${type.location.file}:${type.location.line}</div>`;
    }

    content += `</div>`;
    return content;
  },

  htmlField: (field: ParsedField) => {
    let content = `<li><strong>${field.name}</strong>`;
    if (field.optional) content += " <em>(optional)</em>";
    content += `: <code>${field.type}</code>`;
    if (field.description) content += ` - ${field.description}`;
    content += "</li>";
    return content;
  },

  htmlFooter: () => `    </div>
    <script>
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
    </script>
</body>
</html>`,
};
