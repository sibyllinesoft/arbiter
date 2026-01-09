/**
 * Technical Documentation Template
 *
 * Professional template focused on technical details, constraints, and implementation guidance.
 */

import { Templates } from "@/docs/generator/documentation-generator.js";
import { ParsedField, ParsedSchema, ParsedType } from "@/docs/parser/schema-parser.js";

// HTML type rendering helpers

function renderTypeHeader(type: ParsedType, anchor: string): string {
  let content = `<div class="type-card" id="${anchor}">`;
  content += `<div class="type-header">`;
  content += `<h2 class="type-title">${type.name}</h2>`;
  content += `<div class="type-meta">`;
  content += `<span class="type-badge badge-${type.kind}">${type.kind}</span>`;
  content += `</div></div>`;
  if (type.description) {
    content += `<div class="description"><p>${type.description}</p></div>`;
  }
  return content;
}

function renderSpecTable(type: ParsedType): string {
  let content = `<h3>Technical Specification</h3><table class="spec-table">`;
  if (type.baseType) {
    content += `<tr><th>Base Type</th><td><code>${type.baseType}</code></td></tr>`;
  }
  content += `<tr><th>Category</th><td><code>${type.kind}</code></td></tr>`;
  if (type.location) {
    content += `<tr><th>Source</th><td><code>${type.location.file}:${type.location.line}</code></td></tr>`;
  }
  const usageCount = type.usedBy?.length || 0;
  content += `<tr><th>Usage</th><td>${usageCount} reference${usageCount !== 1 ? "s" : ""}</td></tr>`;
  content += `</table>`;
  return content;
}

function renderValidationRules(type: ParsedType): string {
  if (!type.constraints?.length) return "";
  let content = `<h3>Validation Rules</h3>`;
  content += `<table class="spec-table"><thead><tr><th>Rule</th><th>Description</th></tr></thead><tbody>`;
  for (const constraint of type.constraints) {
    const [rule, desc] = constraint.split(":").map((s) => s.trim());
    content += `<tr><td><code>${rule}</code></td><td>${desc || constraint}</td></tr>`;
  }
  content += `</tbody></table>`;
  return content;
}

function renderAllowedValues(type: ParsedType): string {
  if (!type.values?.length) return "";
  let content = `<h3>Allowed Values</h3><div class="example-code">`;
  content += type.values.map((v) => `"${v}"`).join(" | ");
  content += `</div>`;
  return content;
}

function renderExamples(type: ParsedType): string {
  if (!type.examples?.length) return "";
  let content = `<div class="examples"><h4>Usage Examples</h4>`;
  for (const example of type.examples) {
    content += `<div class="example-code">${example}</div>`;
  }
  content += `</div>`;
  return content;
}

function renderImplementationNotes(type: ParsedType): string {
  let content = `<div class="implementation-notes"><h4>Implementation Notes</h4><ul>`;
  content += getImplementationNotesByKind(type);
  content += `</ul></div>`;
  return content;
}

function getImplementationNotesByKind(type: ParsedType): string {
  switch (type.kind) {
    case "constraint":
      return `<li>This type enforces constraints on the base type <code>${type.baseType}</code></li><li>All validation rules must be satisfied for values to be accepted</li>`;
    case "enum":
      return `<li>Only the listed values are acceptable</li><li>String validation is case-sensitive</li>`;
    case "struct":
      return `<li>This is a structured type with defined fields</li><li>All required fields must be provided</li>`;
    case "union":
      return `<li>Values can be any of the specified types</li><li>Type validation occurs at runtime</li>`;
    default:
      return "";
  }
}

function renderRelationships(type: ParsedType): string {
  const hasDeps = type.dependsOn && type.dependsOn.length > 0;
  const hasUsers = type.usedBy && type.usedBy.length > 0;
  if (!hasDeps && !hasUsers) return "";

  let content = `<div class="relationships">`;
  if (hasDeps) {
    content += renderDependencies(type.dependsOn!);
  }
  if (hasUsers) {
    content += renderUsedBy(type.usedBy!);
  }
  content += `</div>`;
  return content;
}

function renderDependencies(deps: string[]): string {
  let content = `<h4>Dependencies</h4><div class="relationship-links">`;
  for (const dep of deps) {
    const anchor = dep.toLowerCase().replace(/[^a-z0-9]/g, "-");
    content += `<a href="#${anchor}">${dep}</a>`;
  }
  content += `</div>`;
  return content;
}

function renderUsedBy(users: string[]): string {
  let content = `<h4>Used By</h4><div class="relationship-links">`;
  for (const user of users) {
    const anchor = user.toLowerCase().replace(/[^a-z0-9]/g, "-");
    content += `<a href="#${anchor}">${user}</a>`;
  }
  content += `</div>`;
  return content;
}

// Markdown type rendering helpers

function renderMarkdownTypeInfo(type: ParsedType): string {
  let content = `<div class="type-info">\n\n`;
  content += `**Category:** \`${type.kind}\` | `;
  if (type.location) {
    content += `**Source:** \`${type.location.file}:${type.location.line}\` | `;
  }
  content += `**Usage:** ${type.usedBy?.length || 0} references\n\n`;
  content += `</div>\n\n`;
  return content;
}

function renderMarkdownDescription(type: ParsedType): string {
  if (!type.description) return "";
  return `### Description\n\n${type.description}\n\n`;
}

function renderMarkdownTechSpec(type: ParsedType): string {
  let content = `### Technical Specification\n\n`;
  if (type.baseType) {
    content += `- **Base Type:** \`${type.baseType}\`\n`;
  }
  if (type.kind !== "primitive") {
    content += `- **Type Kind:** ${type.kind}\n`;
  }
  return content;
}

function renderMarkdownConstraints(type: ParsedType): string {
  if (!type.constraints || type.constraints.length === 0) return "";
  let content = `\n### Validation Rules\n\n`;
  content += `| Rule | Description |\n`;
  content += `|------|-------------|\n`;
  type.constraints.forEach((constraint) => {
    const [rule, desc] = constraint.split(":").map((s) => s.trim());
    content += `| \`${rule}\` | ${desc || constraint} |\n`;
  });
  content += "\n";
  return content;
}

function renderMarkdownAllowedValues(type: ParsedType): string {
  if (!type.values || type.values.length === 0) return "";
  let content = `### Allowed Values\n\n\`\`\`cue\n`;
  content += type.values.map((v) => `"${v}"`).join(" | ");
  content += `\n\`\`\`\n\n`;
  return content;
}

function renderMarkdownDependencies(type: ParsedType): string {
  if (!type.dependsOn || type.dependsOn.length === 0) return "";
  let content = `### Dependencies\n\nThis type depends on the following types:\n\n`;
  type.dependsOn.forEach((dep) => {
    const depAnchor = dep.toLowerCase().replace(/[^a-z0-9]/g, "-");
    content += `- [\`${dep}\`](#${depAnchor})\n`;
  });
  content += "\n";
  return content;
}

function renderMarkdownExamples(type: ParsedType): string {
  if (!type.examples || type.examples.length === 0) return "";
  let content = `### Usage Examples\n\n`;
  type.examples.forEach((example, index) => {
    content += `**Example ${index + 1}:**\n\`\`\`\n${example}\n\`\`\`\n\n`;
  });
  return content;
}

const IMPL_NOTES: Record<string, string[]> = {
  constraint: [
    "This type enforces constraints on the base type",
    "All validation rules must be satisfied for values to be accepted",
  ],
  enum: ["Only the listed values are acceptable", "String validation is case-sensitive"],
  struct: ["This is a structured type with defined fields", "All required fields must be provided"],
  union: ["Values can be any of the specified types", "Type validation occurs at runtime"],
};

function renderMarkdownImplNotes(type: ParsedType): string {
  let content = `### Implementation Notes\n\n`;
  const notes = IMPL_NOTES[type.kind];
  if (notes) {
    notes.forEach((note) => {
      const noteText =
        type.kind === "constraint" && type.baseType
          ? note.replace("base type", `base type \`${type.baseType}\``)
          : note;
      content += `- ${noteText}\n`;
    });
  }
  if (type.usedBy && type.usedBy.length > 0) {
    const users = type.usedBy
      .map((user) => {
        const userAnchor = user.toLowerCase().replace(/[^a-z0-9]/g, "-");
        return `[\`${user}\`](#${userAnchor})`;
      })
      .join(", ");
    content += `- **Used by:** ${users}\n`;
  }
  return content;
}

export const technicalTemplate: Partial<Templates> = {
  markdownHeader: (title: string) => `# ${title}

> **Technical Reference Guide**
> 
> This document provides comprehensive technical documentation for CUE schema definitions,
> including detailed constraint specifications, validation rules, and implementation guidance.

---

## Quick Navigation

- [📦 Package Information](#package-information)
- [🏗️ Type Definitions](#type-definitions)
- [🔗 Type Relationships](#type-relationships)
- [⚡ Implementation Examples](#implementation-examples)

---

`,

  markdownType: (type: ParsedType, schema: ParsedSchema) => {
    const anchor = type.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let content = `## \`${type.name}\` {#${anchor}}\n\n`;

    content += renderMarkdownTypeInfo(type);
    content += renderMarkdownDescription(type);
    content += renderMarkdownTechSpec(type);
    content += renderMarkdownConstraints(type);
    content += renderMarkdownAllowedValues(type);
    content += renderMarkdownDependencies(type);
    content += renderMarkdownExamples(type);
    content += renderMarkdownImplNotes(type);
    content += "\n---\n\n";

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
        :root {
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --secondary: #64748b;
            --success: #059669;
            --warning: #d97706;
            --error: #dc2626;
            --gray-50: #f8fafc;
            --gray-100: #f1f5f9;
            --gray-200: #e2e8f0;
            --gray-900: #0f172a;
        }

        * { box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            line-height: 1.6;
            color: var(--gray-900);
            background: var(--gray-50);
        }

        .container {
            display: flex;
            min-height: 100vh;
        }

        .sidebar {
            width: 320px;
            background: white;
            border-right: 1px solid var(--gray-200);
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .nav-content {
            padding: 1.5rem;
        }

        .nav-title {
            font-weight: 700;
            color: var(--primary);
            margin: 0 0 1rem 0;
            font-size: 1.2rem;
        }

        .nav-section {
            margin-bottom: 1.5rem;
        }

        .nav-section h3 {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--secondary);
            margin: 0 0 0.5rem 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .nav-list {
            list-style: none;
            margin: 0;
            padding: 0;
        }

        .nav-list li {
            margin: 0;
        }

        .nav-list a {
            display: block;
            padding: 0.5rem 0.75rem;
            color: var(--gray-900);
            text-decoration: none;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            transition: all 0.2s ease;
        }

        .nav-list a:hover {
            background: var(--gray-100);
            color: var(--primary);
        }

        .content {
            margin-left: 320px;
            padding: 2rem;
            flex: 1;
            max-width: 1024px;
        }

        .type-card {
            background: white;
            border: 1px solid var(--gray-200);
            border-radius: 0.75rem;
            padding: 2rem;
            margin: 2rem 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .type-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--gray-200);
        }

        .type-title {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--gray-900);
            margin: 0;
            font-family: 'JetBrains Mono', monospace;
        }

        .type-meta {
            display: flex;
            gap: 0.5rem;
        }

        .type-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .badge-struct { background: #dbeafe; color: #1e40af; }
        .badge-enum { background: #dcfce7; color: #166534; }
        .badge-constraint { background: #fef3c7; color: #92400e; }
        .badge-union { background: #ede9fe; color: #6b21a8; }
        .badge-primitive { background: #f3f4f6; color: #374151; }

        .spec-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            background: var(--gray-50);
            border-radius: 0.5rem;
            overflow: hidden;
        }

        .spec-table th,
        .spec-table td {
            padding: 0.75rem 1rem;
            text-align: left;
            border-bottom: 1px solid var(--gray-200);
        }

        .spec-table th {
            background: var(--gray-100);
            font-weight: 600;
            color: var(--gray-900);
            font-size: 0.875rem;
        }

        .spec-table code {
            background: white;
            border: 1px solid var(--gray-200);
            border-radius: 0.25rem;
            padding: 0.125rem 0.375rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
        }

        .examples {
            background: var(--gray-50);
            border: 1px solid var(--gray-200);
            border-radius: 0.5rem;
            padding: 1.5rem;
            margin: 1.5rem 0;
        }

        .examples h4 {
            margin: 0 0 1rem 0;
            color: var(--gray-900);
            font-weight: 600;
        }

        .example-code {
            background: white;
            border: 1px solid var(--gray-200);
            border-radius: 0.375rem;
            padding: 1rem;
            margin: 0.5rem 0;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            overflow-x: auto;
        }

        .relationships {
            margin: 1.5rem 0;
        }

        .relationships h4 {
            margin: 0 0 0.75rem 0;
            color: var(--gray-900);
            font-weight: 600;
            font-size: 1rem;
        }

        .relationship-links {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }

        .relationship-links a {
            display: inline-block;
            padding: 0.375rem 0.75rem;
            background: white;
            border: 1px solid var(--gray-200);
            border-radius: 0.375rem;
            color: var(--primary);
            text-decoration: none;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .relationship-links a:hover {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }

        .implementation-notes {
            background: #fef7ed;
            border: 1px solid #fed7aa;
            border-radius: 0.5rem;
            padding: 1rem;
            margin: 1.5rem 0;
        }

        .implementation-notes h4 {
            margin: 0 0 0.5rem 0;
            color: #c2410c;
            font-size: 0.875rem;
            font-weight: 600;
        }

        .implementation-notes ul {
            margin: 0;
            color: #9a3412;
        }

        .mermaid {
            text-align: center;
            margin: 2rem 0;
            background: white;
            border: 1px solid var(--gray-200);
            border-radius: 0.5rem;
            padding: 1rem;
        }

        @media (max-width: 1024px) {
            .sidebar {
                transform: translateX(-100%);
                transition: transform 0.3s ease;
            }
            .content {
                margin-left: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">`,

  htmlType: (type: ParsedType, schema: ParsedSchema) => {
    const anchor = type.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let content = renderTypeHeader(type, anchor);
    content += renderSpecTable(type);
    content += renderValidationRules(type);
    content += renderAllowedValues(type);
    content += renderExamples(type);
    content += renderImplementationNotes(type);
    content += renderRelationships(type);
    content += `</div>`;
    return content;
  },
};
