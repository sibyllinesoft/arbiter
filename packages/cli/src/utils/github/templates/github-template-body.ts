/**
 * GitHub template body generation utilities.
 * Extracted from unified-github-template-manager.ts for modularity.
 */

import type { GitHubTemplateSections } from "@/types.js";
import Handlebars from "handlebars";

/**
 * Render string template with data using Handlebars
 */
export function renderString(template: string, data: any): string {
  const compiled = Handlebars.compile(template);
  return compiled(data);
}

/**
 * Process labels with template substitution
 */
export function processLabels(labels: string[], data: any): string[] {
  return labels.map((label) => renderString(label, data)).filter((label) => label.trim() !== "");
}

/**
 * Process assignees with template substitution
 */
export function processAssignees(assignees: string[], data: any): string[] {
  return assignees
    .map((assignee) => renderString(assignee, data))
    .filter((assignee) => assignee.trim() !== "");
}

/**
 * Generate template body from sections configuration
 */
export function generateTemplateBody(
  sections: GitHubTemplateSections | undefined,
  data: any,
): string {
  if (!sections) return "";

  let body = "";

  // Add main description
  if (sections.description) {
    body += renderString(sections.description, data);
  }

  // Add details fields
  if (sections.details) {
    // This would generate form fields for GitHub issue templates
    // For now, we'll just add them as text
    body += "\n## Details\n\n";
    for (const detail of sections.details) {
      const value = data[detail.name] || "";
      body += `**${detail.label}:** ${value}\n`;
    }
    body += "\n";
  }

  // Add acceptance criteria
  if (sections.acceptanceCriteria) {
    body += renderString(sections.acceptanceCriteria, data);
  }

  // Add dependencies
  if (sections.dependencies) {
    body += renderString(sections.dependencies, data);
  }

  // Add additional sections
  if (sections.additional) {
    for (const [_key, content] of Object.entries(sections.additional)) {
      body += renderString(content, data);
    }
  }

  return body.trim();
}

/**
 * Generate template form body for GitHub issue templates (YAML format)
 */
export function generateTemplateFormBody(sections: GitHubTemplateSections, _data: any): string {
  let body = "";

  if (sections.description) {
    body += "  - type: textarea\n";
    body += "    id: description\n";
    body += "    attributes:\n";
    body += "      label: Description\n";
    body += "      placeholder: Describe the issue or request...\n";
    body += "    validations:\n";
    body += "      required: true\n";
  }

  if (sections.details) {
    for (const detail of sections.details) {
      body += `  - type: ${detail.type === "select" ? "dropdown" : "input"}\n`;
      body += `    id: ${detail.name}\n`;
      body += "    attributes:\n";
      body += `      label: ${detail.label}\n`;

      if (detail.type === "select" && detail.enum) {
        body += "      options:\n";
        for (const option of detail.enum) {
          body += `        - ${option}\n`;
        }
      }

      if (detail.required) {
        body += "    validations:\n";
        body += "      required: true\n";
      }
    }
  }

  return body;
}

/**
 * Generate config.yml file content for GitHub issue templates
 */
export function generateConfigFile(): string {
  let content = "# GitHub issue template configuration\n\n";
  content += "blank_issues_enabled: false\n";
  content += "contact_links:\n";
  content += "  - name: 📚 Documentation\n";
  content += "    url: https://github.com/your-org/docs\n";
  content += "    about: Check our documentation for common questions\n";

  return content;
}
