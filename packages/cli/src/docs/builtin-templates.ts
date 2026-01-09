/**
 * Built-in documentation templates.
 * Extracted from template-implementor.ts for modularity.
 */

/**
 * Advanced markdown template with TOC and better organization
 */
export function getAdvancedMarkdownTemplate(options?: {
  includeToc?: boolean;
  includeExamples?: boolean;
}): string {
  const includeToc = options?.includeToc !== false;
  const includeExamples = options?.includeExamples !== false;

  return `# Arbiter CLI Reference

> **Generated:** {{metadata.generatedAt}}
> **Version:** {{metadata.version}}
> **Commands:** {{metadata.commandCount}}

## Overview

The Arbiter CLI is a CUE-based specification validation and management tool with agent-first automation and comprehensive application modeling capabilities.

### Key Features

- **Agent-First Design**: Non-interactive commands with structured outputs
- **Unified Application Schema**: One app-centric specification powering every workflow
- **Complete Lifecycle**: From specification to production deployment
- **AI-Enhanced**: Built-in AI agents for code review and analysis

${
  includeToc
    ? `
## Table of Contents

{{#each categories}}
- [{{titleCase @key}} Commands](#{{kebabCase @key}}-commands)
  {{#each this}}
  - [\`{{fullName}}\`](#{{kebabCase fullName}})
  {{/each}}
{{/each}}
- [Global Options](#global-options)
- [Exit Codes](#exit-codes)
- [Configuration](#configuration)
`
    : ""
}

{{#each categories}}
## {{titleCase @key}} Commands

{{#each this}}
### \`{{fullName}}\` {#{{kebabCase fullName}}}

{{#if metadata.tags.length}}
{{#each metadata.tags}}
<kbd>{{this}}</kbd>
{{/each}}

{{/if}}
{{description}}

{{#if metadata.stability}}
{{#eq metadata.stability "experimental"}}
> ⚠️ **Experimental**: This command is experimental and may change in future versions.
{{/eq}}
{{#eq metadata.stability "deprecated"}}
> 🚫 **Deprecated**: This command is deprecated{{#if metadata.replacement}} and will be removed. Use \`{{metadata.replacement}}\` instead{{/if}}.
{{/eq}}
{{/if}}

**Usage:**
\`\`\`bash
{{usage}}
\`\`\`

{{#if arguments.length}}
#### Arguments

| Name | Type | Description |
|------|------|-------------|
{{#each arguments}}
| \`{{name}}\` | {{#if required}}**required**{{else}}optional{{/if}}{{#if variadic}}, variadic{{/if}} | {{description}} {{#if choices}}(choices: {{join choices ", "}}){{/if}} |
{{/each}}
{{/if}}

{{#if options.length}}
#### Options

| Flag | Description | Default |
|------|-------------|---------|
{{#each options}}
| \`{{flags}}\` | {{description}} {{#if choices}}<br/>**Choices:** \`{{join choices "\`, \`"}}\`{{/if}} | {{#if defaultValue}}\`{{defaultValue}}\`{{else}}-{{/if}} |
{{/each}}
{{/if}}

${
  includeExamples
    ? `
{{#if examples.length}}
#### Examples

{{#each examples}}
\`\`\`bash
{{this}}
\`\`\`
{{/each}}
{{/if}}
`
    : ""
}

{{#if subcommands.length}}
#### Subcommands

Available subcommands: {{#each subcommands}}\`{{this}}\`{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

---

{{/each}}
{{/each}}

## Global Options

The following options are available for all commands:

| Flag | Description | Default |
|------|-------------|---------|
{{#each globalOptions}}
| \`{{flags}}\` | {{description}} | {{#if defaultValue}}\`{{defaultValue}}\`{{else}}-{{/if}} |
{{/each}}

## Exit Codes

| Code | Meaning |
|------|---------|
| \`0\` | Success |
| \`1\` | Command error (validation failure, file not found, etc.) |
| \`2\` | Configuration error (server unreachable, config invalid) |

## Configuration

The CLI can be configured through:

1. **Command line options**: \`--api-url\`, \`--timeout\`, etc.
2. **Configuration file**: \`.arbiter/config.json\` in project root
3. **Environment variables**: \`ARBITER_API_URL\`, \`ARBITER_TIMEOUT\`, etc.

### Configuration File Format

\`\`\`json
{
  "apiUrl": "http://localhost:5050",
  "timeout": 5000,
  "format": "table",
  "color": true,
  "projectDir": "."
}
\`\`\`

## Agent-Friendly Features

- **Non-interactive**: All commands work without user prompts
- **Structured output**: JSON/YAML formats with \`--format\` option
- **Consistent exit codes**: Reliable automation integration
- **Dry-run support**: Preview changes with \`--dry-run\`

## Getting Help

- Use \`arbiter --help\` for general help
- Use \`arbiter <command> --help\` for command-specific help
- Check the server status with \`arbiter health\`
- View project status with \`arbiter status\`

---

*Documentation generated from CLI source code on {{metadata.generatedAt}}*`;
}

/**
 * Advanced HTML template with search and navigation
 */
export function getAdvancedHTMLTemplate(options?: {
  includeSearch?: boolean;
  customCss?: string;
}): string {
  const includeSearch = options?.includeSearch !== false;
  const customCss = options?.customCss || "";

  const searchStyles = includeSearch
    ? `
        .search-box {
            margin-bottom: 20px;
        }

        .search-box input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--gray-300);
            border-radius: 6px;
            font-size: 14px;
        }

        .search-results {
            display: none;
            background: white;
            border: 1px solid var(--gray-300);
            border-radius: 6px;
            max-height: 300px;
            overflow-y: auto;
        }

        .search-result {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--gray-200);
        }

        .search-result:hover {
            background: var(--gray-100);
        }
        `
    : "";

  const searchBox = includeSearch
    ? `
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search commands...">
                <div class="search-results" id="searchResults"></div>
            </div>
            `
    : "";

  const searchScript = includeSearch
    ? `
    <script>
        // Simple search functionality
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        const commands = [
            {{#each commands}}
            {
                name: '{{fullName}}',
                description: '{{description}}',
                id: '{{kebabCase fullName}}'
            }{{#unless @last}},{{/unless}}
            {{/each}}
        ];

        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            if (query.length < 2) {
                searchResults.style.display = 'none';
                return;
            }

            const matches = commands.filter(cmd =>
                cmd.name.toLowerCase().includes(query) ||
                cmd.description.toLowerCase().includes(query)
            ).slice(0, 10);

            if (matches.length > 0) {
                searchResults.innerHTML = matches.map(match =>
                    \`<div class="search-result" onclick="location.href='#\${match.id}'">
                        <strong>\${match.name}</strong><br>
                        <small>\${match.description}</small>
                    </div>\`
                ).join('');
                searchResults.style.display = 'block';
            } else {
                searchResults.style.display = 'none';
            }
        });

        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    </script>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Arbiter CLI Reference</title>
    <style>
        :root {
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --gray-100: #f3f4f6;
            --gray-200: #e5e7eb;
            --gray-300: #d1d5db;
            --gray-700: #374151;
            --gray-900: #111827;
        }

        * { box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--gray-900);
            margin: 0;
            background: #fff;
        }

        .container {
            display: grid;
            grid-template-columns: 280px 1fr;
            min-height: 100vh;
        }

        .sidebar {
            background: var(--gray-100);
            border-right: 1px solid var(--gray-200);
            padding: 20px;
            overflow-y: auto;
            position: sticky;
            top: 0;
            height: 100vh;
        }

        .content {
            padding: 40px;
            max-width: 900px;
        }

        .header {
            border-bottom: 2px solid var(--gray-200);
            padding-bottom: 20px;
            margin-bottom: 40px;
        }

        .header h1 {
            color: var(--primary);
            margin: 0 0 10px 0;
        }

        .header .meta {
            color: var(--gray-700);
            font-size: 14px;
        }

        ${searchStyles}

        .nav-category {
            margin-bottom: 20px;
        }

        .nav-category h4 {
            margin: 0 0 8px 0;
            color: var(--gray-700);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .nav-links {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .nav-links li {
            margin: 2px 0;
        }

        .nav-links a {
            display: block;
            padding: 4px 8px;
            color: var(--gray-700);
            text-decoration: none;
            font-size: 13px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', monospace;
        }

        .nav-links a:hover {
            background: var(--primary);
            color: white;
        }

        .command {
            margin-bottom: 40px;
            padding: 30px;
            border: 1px solid var(--gray-200);
            border-radius: 8px;
            background: #fafafa;
        }

        .command-header {
            margin-bottom: 20px;
        }

        .command-name {
            font-family: 'Monaco', 'Menlo', monospace;
            background: var(--primary);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
        }

        .command-tags {
            margin: 10px 0;
        }

        .tag {
            display: inline-block;
            background: var(--gray-200);
            color: var(--gray-700);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            margin-right: 6px;
        }

        .usage {
            background: var(--gray-900);
            color: #fff;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            overflow-x: auto;
            margin: 15px 0;
        }

        .section {
            margin: 20px 0;
        }

        .section h4 {
            color: var(--primary);
            margin: 0 0 10px 0;
            font-size: 16px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }

        th, td {
            text-align: left;
            padding: 8px 12px;
            border-bottom: 1px solid var(--gray-200);
        }

        th {
            background: var(--gray-100);
            font-weight: 600;
            color: var(--gray-700);
        }

        .flag {
            font-family: 'Monaco', 'Menlo', monospace;
            background: var(--gray-100);
            padding: 1px 4px;
            border-radius: 3px;
        }

        .warning {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
        }

        .deprecated {
            background: #fecaca;
            border: 1px solid #ef4444;
            color: #991b1b;
        }

        .experimental {
            background: #ddd6fe;
            border: 1px solid #8b5cf6;
            color: #5b21b6;
        }

        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid var(--gray-200);
            color: var(--gray-700);
            font-size: 14px;
        }

        ${customCss}
    </style>
</head>
<body>
    <div class="container">
        <aside class="sidebar">
            <h3>Arbiter CLI</h3>
            ${searchBox}

            {{#each categories}}
            <div class="nav-category">
                <h4>{{titleCase @key}} Commands</h4>
                <ul class="nav-links">
                    {{#each this}}
                    <li><a href="#{{kebabCase fullName}}">{{fullName}}</a></li>
                    {{/each}}
                </ul>
            </div>
            {{/each}}
        </aside>

        <main class="content">
            <div class="header">
                <h1>Arbiter CLI Reference</h1>
                <div class="meta">
                    Generated: {{metadata.generatedAt}} | Version: {{metadata.version}} | Commands: {{metadata.commandCount}}
                </div>
                <p>The Arbiter CLI is a CUE-based specification validation and management tool with agent-first automation capabilities.</p>
            </div>

            {{#each categories}}
            <section id="{{kebabCase @key}}-commands">
                <h2>{{titleCase @key}} Commands</h2>

                {{#each this}}
                <div class="command" id="{{kebabCase fullName}}">
                    <div class="command-header">
                        <h3><span class="command-name">{{fullName}}</span></h3>
                        {{#if metadata.tags.length}}
                        <div class="command-tags">
                            {{#each metadata.tags}}
                            <span class="tag">{{this}}</span>
                            {{/each}}
                        </div>
                        {{/if}}

                        {{#if metadata.stability}}
                        {{#eq metadata.stability "deprecated"}}
                        <div class="warning deprecated">
                            <strong>Deprecated:</strong> This command is deprecated{{#if metadata.replacement}} and will be removed. Use <code>{{metadata.replacement}}</code> instead{{/if}}.
                        </div>
                        {{/eq}}
                        {{#eq metadata.stability "experimental"}}
                        <div class="warning experimental">
                            <strong>Experimental:</strong> This command is experimental and may change in future versions.
                        </div>
                        {{/eq}}
                        {{/if}}
                    </div>

                    <p>{{description}}</p>

                    <div class="usage">{{usage}}</div>

                    {{#if arguments.length}}
                    <div class="section">
                        <h4>Arguments</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {{#each arguments}}
                                <tr>
                                    <td><span class="flag">{{name}}</span></td>
                                    <td>{{#if required}}<strong>required</strong>{{else}}optional{{/if}}{{#if variadic}}, variadic{{/if}}</td>
                                    <td>{{description}}{{#if choices}} <br><strong>Choices:</strong> {{join choices ", "}}{{/if}}</td>
                                </tr>
                                {{/each}}
                            </tbody>
                        </table>
                    </div>
                    {{/if}}

                    {{#if options.length}}
                    <div class="section">
                        <h4>Options</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Flag</th>
                                    <th>Description</th>
                                    <th>Default</th>
                                </tr>
                            </thead>
                            <tbody>
                                {{#each options}}
                                <tr>
                                    <td><span class="flag">{{flags}}</span></td>
                                    <td>{{description}}{{#if choices}}<br><strong>Choices:</strong> <code>{{join choices "</code>, <code>"}}</code>{{/if}}</td>
                                    <td>{{#if defaultValue}}<code>{{defaultValue}}</code>{{else}}-{{/if}}</td>
                                </tr>
                                {{/each}}
                            </tbody>
                        </table>
                    </div>
                    {{/if}}

                    {{#if subcommands.length}}
                    <div class="section">
                        <h4>Subcommands</h4>
                        <p>{{#each subcommands}}<span class="flag">{{this}}</span>{{#unless @last}}, {{/unless}}{{/each}}</p>
                    </div>
                    {{/if}}
                </div>
                {{/each}}
            </section>
            {{/each}}

            <div class="footer">
                <p>Documentation generated from CLI source code on {{metadata.generatedAt}}</p>
            </div>
        </main>
    </div>

    ${searchScript}
</body>
</html>`;
}
