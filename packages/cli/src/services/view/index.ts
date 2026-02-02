/**
 * @packageDocumentation
 * View command - View Arbiter vault in browser.
 *
 * Serves the .arbiter directory with docsify for browser viewing.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import type { CLIConfig } from "@/types.js";
import chalk from "chalk";

/**
 * View command options
 */
export interface ViewOptions {
  /** Port for docsify server */
  port?: number;
  /** Don't open browser automatically */
  noBrowser?: boolean;
}

/**
 * Open a URL using the system's default method.
 * Uses platform-specific commands to avoid shell hanging.
 */
async function openUrl(url: string): Promise<void> {
  const platform = process.platform;

  let command: string;
  let args: string[];

  switch (platform) {
    case "darwin":
      command = "open";
      args = [url];
      break;
    case "win32":
      command = "cmd";
      args = ["/c", "start", "", url];
      break;
    default:
      // Linux and others
      command = "xdg-open";
      args = [url];
      break;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    // Don't wait for the process - it's detached
    // Give it a moment to start, then resolve
    setTimeout(resolve, 100);

    child.on("error", (err) => {
      reject(new Error(`Failed to open URL: ${err.message}`));
    });
  });
}

/**
 * Generate docsify index.html content for the vault.
 */
function generateDocsifyHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${name} - Arbiter Vault</title>
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
  <meta name="description" content="Arbiter specification vault">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0">
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Michroma&family=Sunflower:wght@300;500;700&display=swap" rel="stylesheet">
  <!-- Docsify dark theme -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/docsify@4/lib/themes/dark.css">
  <style>
    /* Sibyllinesoft Design System */
    :root {
      /* Graphite palette */
      --color-graphite-900: #0f0f0f;
      --color-graphite-800: #1a1a1a;
      --color-graphite-700: #2a2a2a;
      --color-graphite-600: #404040;
      --color-graphite-500: #525252;
      --color-graphite-400: #737373;
      --color-graphite-300: #a3a3a3;
      --color-graphite-200: #d4d4d4;
      --color-graphite-100: #f5f5f5;
      --color-graphite-50: #fafafa;
      --color-graphite-775: #202020;
      --color-graphite-750: #242424;

      /* Semantic colors */
      --theme-color: #6366f1;
      --color-accent: #6366f1;
      --color-accent-hover: #4f46e5;
      --color-background: var(--color-graphite-800);
      --color-surface: var(--color-graphite-700);
      --color-text: var(--color-graphite-100);
      --color-text-light: var(--color-graphite-300);
      --color-text-muted: var(--color-graphite-500);
      --color-border: var(--color-graphite-750);

      /* Typography */
      --font-family-default: 'Sunflower', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      --font-family-display: 'Michroma', var(--font-family-default);
      --font-family-monospace: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', monospace;

      /* Spacing */
      --space-xs: 0.25rem;
      --space-sm: 0.5rem;
      --space-md: 1rem;
      --space-lg: 1.5rem;

      /* Radius */
      --radius-sm: 0.125rem;
      --radius-md: 0.375rem;
      --radius-lg: 0.5rem;
    }

    /* Override docsify dark theme */
    body {
      font-family: var(--font-family-default) !important;
      background: var(--color-background) !important;
      color: var(--color-text) !important;
      -webkit-font-smoothing: antialiased;
    }

    .sidebar {
      background: var(--color-graphite-900) !important;
      border-right: 1px solid var(--color-border) !important;
    }

    /* Override any bright borders from docsify theme */
    .sidebar-toggle,
    .sidebar-toggle span {
      background: var(--color-graphite-700) !important;
    }

    /* App name in sidebar */
    .app-name-link {
      color: var(--color-text) !important;
    }

    .sidebar-nav {
      font-family: var(--font-family-default) !important;
    }

    .sidebar-nav > ul > li > a {
      font-family: var(--font-family-display) !important;
      font-weight: 600;
      font-size: 0.85em;
      letter-spacing: 0.025em;
      color: var(--color-text) !important;
    }

    .sidebar-nav a {
      color: var(--color-text-light) !important;
      transition: color 0.2s ease;
    }

    .sidebar-nav a:hover {
      color: var(--color-accent) !important;
    }

    .sidebar-nav li.active > a {
      color: var(--color-accent) !important;
      border-right: 2px solid var(--color-accent);
    }

    .markdown-section {
      max-width: 900px;
    }

    .markdown-section h1,
    .markdown-section h2,
    .markdown-section h3 {
      font-family: var(--font-family-display) !important;
      color: var(--color-text) !important;
      letter-spacing: -0.025em;
    }

    .markdown-section h1 { font-size: 2.5rem; }
    .markdown-section h2 { font-size: 1.75rem; margin-top: 2.5rem; }
    .markdown-section h3 { font-size: 1.25rem; }

    .markdown-section p,
    .markdown-section li {
      color: var(--color-text-light) !important;
      line-height: 1.625;
    }

    .markdown-section a {
      color: var(--color-accent) !important;
    }

    .markdown-section a:hover {
      color: var(--color-accent-hover) !important;
    }

    .markdown-section code {
      background: var(--color-graphite-700) !important;
      color: var(--color-graphite-200) !important;
      border-radius: var(--radius-md);
      font-family: var(--font-family-monospace) !important;
    }

    .markdown-section pre {
      background: var(--color-graphite-900) !important;
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
    }

    /* Table styling - dark theme, no zebra striping */
    .markdown-section table,
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.5em 0;
      background: var(--color-graphite-800) !important;
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .markdown-section table th,
    .markdown-section table td,
    table th,
    table td {
      padding: 0.75em 1em;
      text-align: left;
      border: none !important;
      border-bottom: 1px solid var(--color-border) !important;
      background: transparent !important;
    }

    .markdown-section table th,
    table th {
      background: var(--color-graphite-700) !important;
      color: var(--color-text) !important;
      font-weight: 600;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    .markdown-section table td,
    table td {
      color: var(--color-text-light) !important;
      background: var(--color-graphite-800) !important;
    }

    /* Subtle zebra striping - override docsify completely */
    .markdown-section table tbody tr:nth-child(odd),
    .markdown-section table tbody tr:nth-child(odd) td,
    .markdown-section table tr:nth-child(odd),
    .markdown-section table tr:nth-child(odd) td,
    table tbody tr:nth-child(odd),
    table tbody tr:nth-child(odd) td,
    table tr:nth-child(odd),
    table tr:nth-child(odd) td {
      background: var(--color-graphite-800) !important;
      background-color: var(--color-graphite-800) !important;
    }

    .markdown-section table tbody tr:nth-child(even),
    .markdown-section table tbody tr:nth-child(even) td,
    .markdown-section table tr:nth-child(even),
    .markdown-section table tr:nth-child(even) td,
    table tbody tr:nth-child(even),
    table tbody tr:nth-child(even) td,
    table tr:nth-child(even),
    table tr:nth-child(even) td {
      background: #1e1e1e !important;
      background-color: #1e1e1e !important;
    }

    .markdown-section table tr:last-child td,
    table tr:last-child td {
      border-bottom: none !important;
    }

    .markdown-section table tr:hover td,
    table tr:hover td {
      background: var(--color-graphite-750) !important;
    }

    /* HR styling - subtle dark border */
    .markdown-section hr {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 2.5em 0;
    }

    /* Task list styling */
    .task-list-item {
      list-style-type: none;
    }
    .task-list-item input {
      margin-right: 0.5em;
    }

    /* Lucide icon styling */
    .lucide {
      width: 1em;
      height: 1em;
      vertical-align: middle;
      stroke-width: 2;
      color: var(--color-accent);
      filter: drop-shadow(0 0 3px rgba(99, 102, 241, 0.3));
    }

    .lucide-sm { width: 0.875em; height: 0.875em; }
    .lucide-lg { width: 1.25em; height: 1.25em; }

    /* Frontmatter metadata card styling */
    .arbiter-meta {
      background: var(--color-graphite-700);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1em 1.25em;
      margin-bottom: 1.5em;
      font-size: 0.9em;
    }
    .arbiter-meta-header {
      display: flex;
      align-items: center;
      gap: 0.75em;
      margin-bottom: 0.75em;
      flex-wrap: wrap;
    }
    .arbiter-meta-type {
      background: var(--color-accent);
      color: white;
      padding: 0.2em 0.6em;
      border-radius: var(--radius-md);
      font-weight: 600;
      font-size: 0.85em;
      text-transform: uppercase;
      font-family: var(--font-family-display);
    }
    .arbiter-meta-title {
      font-weight: 600;
      font-size: 1.1em;
      color: var(--color-text);
    }
    .arbiter-meta-badges {
      display: flex;
      gap: 0.5em;
      flex-wrap: wrap;
      margin-bottom: 0.5em;
    }
    .arbiter-badge {
      padding: 0.2em 0.5em;
      border-radius: var(--radius-md);
      font-size: 0.8em;
      font-weight: 500;
    }
    /* Status colors - dark theme adjusted */
    .arbiter-status-open { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
    .arbiter-status-in_progress, .arbiter-status-in-progress { background: rgba(251, 146, 60, 0.2); color: #fb923c; }
    .arbiter-status-blocked { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .arbiter-status-review { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
    .arbiter-status-done, .arbiter-status-closed { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
    .arbiter-status-wontfix { background: rgba(115, 115, 115, 0.2); color: #a3a3a3; }
    /* Priority colors - dark theme adjusted */
    .arbiter-priority-critical { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .arbiter-priority-high { background: rgba(249, 115, 22, 0.2); color: #fb923c; }
    .arbiter-priority-medium { background: rgba(234, 179, 8, 0.2); color: #fbbf24; }
    .arbiter-priority-low { background: rgba(115, 115, 115, 0.2); color: #a3a3a3; }
    /* Tags */
    .arbiter-tag {
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      padding: 0.15em 0.4em;
      border-radius: var(--radius-sm);
      font-size: 0.8em;
    }
    .arbiter-meta-row {
      display: flex;
      gap: 1.5em;
      color: var(--color-text-muted);
      font-size: 0.85em;
      flex-wrap: wrap;
    }
    .arbiter-meta-row span {
      display: flex;
      align-items: center;
      gap: 0.4em;
    }
    .arbiter-meta-row .lucide {
      color: var(--color-text-muted);
      filter: none;
    }
    .arbiter-meta-links {
      margin-top: 0.5em;
      padding-top: 0.5em;
      border-top: 1px solid var(--color-border);
      font-size: 0.85em;
      display: flex;
      gap: 1em;
    }
    .arbiter-meta-links a {
      color: var(--color-accent) !important;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.3em;
    }
    .arbiter-meta-links a:hover {
      color: var(--color-accent-hover) !important;
    }

    /* Search box styling */
    .search input {
      background: var(--color-graphite-700) !important;
      border: 1px solid var(--color-border) !important;
      color: var(--color-text) !important;
      border-radius: var(--radius-md) !important;
    }

    .search .matching-post {
      background: var(--color-graphite-700) !important;
      border-bottom: 1px solid var(--color-border) !important;
    }

    /* Global border overrides - prevent any bright white borders */
    * {
      border-color: var(--color-border) !important;
    }

    /* Ensure HRs use subtle dark color */
    hr {
      border: none !important;
      border-top: 1px solid var(--color-border) !important;
      background: transparent !important;
    }

    /* Docsify specific overrides */
    .content,
    .markdown-section,
    article {
      border-color: var(--color-border) !important;
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>
    // Lucide icon helper - creates inline SVG
    function lucideIcon(name, className) {
      const icons = {
        user: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
        pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
        clock: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        link: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
        github: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>',
        tag: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>'
      };
      const cls = className ? ' class="lucide ' + className + '"' : ' class="lucide"';
      return (icons[name] || '').replace('<svg', '<svg' + cls);
    }

    // Frontmatter renderers by type
    const frontmatterRenderers = {
      // Task/Issue types - show full metadata card
      task: renderTaskMeta,
      issue: renderTaskMeta,
      bug: renderTaskMeta,
      feature: renderTaskMeta,
      epic: renderTaskMeta,
      milestone: renderTaskMeta,
      story: renderTaskMeta,
      spike: renderTaskMeta,

      // Comments - show condensed info
      comment: renderCommentMeta,
      note: renderCommentMeta,

      // Default - hide frontmatter
      _default: function() { return ''; }
    };

    function renderTaskMeta(meta) {
      const parts = [];

      // Header with type badge and title
      parts.push('<div class="arbiter-meta">');
      parts.push('<div class="arbiter-meta-header">');
      if (meta.type) {
        parts.push('<span class="arbiter-meta-type">' + escapeHtml(meta.type) + '</span>');
      }
      if (meta.title) {
        parts.push('<span class="arbiter-meta-title">' + escapeHtml(meta.title) + '</span>');
      }
      parts.push('</div>');

      // Status and priority badges
      parts.push('<div class="arbiter-meta-badges">');
      if (meta.status) {
        const statusClass = 'arbiter-status-' + meta.status.replace('_', '-');
        parts.push('<span class="arbiter-badge ' + statusClass + '">' + escapeHtml(meta.status) + '</span>');
      }
      if (meta.priority) {
        const priorityClass = 'arbiter-priority-' + meta.priority;
        parts.push('<span class="arbiter-badge ' + priorityClass + '">' + escapeHtml(meta.priority) + '</span>');
      }
      // Tags
      if (meta.tags && Array.isArray(meta.tags)) {
        meta.tags.forEach(function(tag) {
          parts.push('<span class="arbiter-tag">' + escapeHtml(tag) + '</span>');
        });
      }
      parts.push('</div>');

      // Metadata row
      const metaItems = [];
      if (meta.assignee) {
        metaItems.push('<span>' + lucideIcon('user', 'lucide-sm') + ' ' + escapeHtml(meta.assignee) + '</span>');
      }
      if (meta.created) {
        metaItems.push('<span>' + lucideIcon('calendar', 'lucide-sm') + ' ' + escapeHtml(formatDate(meta.created)) + '</span>');
      }
      if (meta.updated) {
        metaItems.push('<span>' + lucideIcon('pencil', 'lucide-sm') + ' ' + escapeHtml(formatDate(meta.updated)) + '</span>');
      }
      if (meta.estimate) {
        metaItems.push('<span>' + lucideIcon('clock', 'lucide-sm') + ' ' + escapeHtml(meta.estimate) + '</span>');
      }
      if (metaItems.length > 0) {
        parts.push('<div class="arbiter-meta-row">' + metaItems.join('') + '</div>');
      }

      // External links
      if (meta.external_url || meta.github_url) {
        parts.push('<div class="arbiter-meta-links">');
        if (meta.external_url) {
          parts.push('<a href="' + escapeHtml(meta.external_url) + '" target="_blank">' + lucideIcon('link', 'lucide-sm') + ' External Link</a>');
        }
        if (meta.github_url) {
          parts.push('<a href="' + escapeHtml(meta.github_url) + '" target="_blank">' + lucideIcon('github', 'lucide-sm') + ' GitHub</a>');
        }
        parts.push('</div>');
      }

      parts.push('</div>');
      return parts.join('');
    }

    function renderCommentMeta(meta) {
      const parts = ['<div class="arbiter-meta" style="padding: 0.5em 1em;">'];
      parts.push('<div class="arbiter-meta-row">');
      if (meta.kind) {
        parts.push('<span class="arbiter-tag">' + lucideIcon('tag', 'lucide-sm') + ' ' + escapeHtml(meta.kind) + '</span>');
      }
      if (meta.author) {
        parts.push('<span>' + lucideIcon('user', 'lucide-sm') + ' ' + escapeHtml(meta.author) + '</span>');
      }
      if (meta.created) {
        parts.push('<span>' + lucideIcon('calendar', 'lucide-sm') + ' ' + escapeHtml(formatDate(meta.created)) + '</span>');
      }
      parts.push('</div></div>');
      return parts.join('');
    }

    function escapeHtml(str) {
      if (typeof str !== 'string') return String(str);
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatDate(dateStr) {
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString();
      } catch {
        return dateStr;
      }
    }

    function parseFrontmatter(content) {
      const regex = /^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n?/;
      const match = content.match(regex);
      if (!match) return { meta: null, body: content };

      try {
        const meta = jsyaml.load(match[1]);
        const body = content.slice(match[0].length);
        return { meta, body };
      } catch (e) {
        console.warn('Failed to parse frontmatter:', e);
        return { meta: null, body: content };
      }
    }

    window.$docsify = {
      name: '${name}',
      repo: '',
      loadSidebar: true,
      subMaxLevel: 3,
      auto2top: true,
      alias: {
        '/.*/_sidebar.md': '/_sidebar.md',
      },
      search: {
        placeholder: 'Search...',
        noData: 'No results',
        depth: 3,
        pathNamespaces: ['/'],
        namespace: 'arbiter',
        hideOtherSidebarContent: true,
        // Only index markdown files
        paths: 'auto',
      },
      copyCode: {
        buttonText: 'Copy',
        successText: 'Copied',
      },
      pagination: {
        previousText: 'Previous',
        nextText: 'Next',
        crossChapter: true,
      },
      tabs: {
        persist: true,
        sync: true,
      },
      plugins: [
        function(hook, vm) {
          hook.beforeEach(function(content) {
            const { meta, body } = parseFrontmatter(content);

            if (!meta) return content;

            // Get renderer based on type, fall back to default
            const type = meta.type || meta.kind || '_default';
            const renderer = frontmatterRenderers[type] || frontmatterRenderers._default;

            return renderer(meta) + body;
          });
        }
      ]
    }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/docsify@4"></script>
  <script src="https://cdn.jsdelivr.net/npm/docsify@4/lib/plugins/search.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/docsify-copy-code@2"></script>
  <script src="https://cdn.jsdelivr.net/npm/docsify-pagination@2/dist/docsify-pagination.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/docsify-tabs@1"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-yaml.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-typescript.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-python.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-rust.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-go.min.js"></script>
</body>
</html>`;
}

/**
 * Generate sidebar content from directory structure.
 */
function generateSidebar(arbiterPath: string): string {
  const lines: string[] = ["* [Home](/)", ""];

  // Known directory types with their display titles
  const knownDirectories: Record<string, string> = {
    notes: "Notes",
    tasks: "Tasks",
    groups: "Groups",
    schemas: "Schemas",
  };

  // Discover all directories
  const entries = fs.readdirSync(arbiterPath, { withFileTypes: true });
  const allDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "cache")
    .map((e) => e.name);

  // Separate into services (dirs with README.md) and other directories
  const serviceDirs: string[] = [];
  const otherDirs: string[] = [];

  for (const dir of allDirs) {
    const dirPath = path.join(arbiterPath, dir);
    const hasReadme = fs.existsSync(path.join(dirPath, "README.md"));

    if (hasReadme && !knownDirectories[dir]) {
      // Directory with README.md is likely a service entity
      serviceDirs.push(dir);
    } else if (knownDirectories[dir]) {
      otherDirs.push(dir);
    }
  }

  // Add packages/services section if there are any
  if (serviceDirs.length > 0) {
    lines.push("* **Packages**");
    for (const dir of serviceDirs.sort()) {
      // Try to read the package name from README frontmatter
      const readmePath = path.join(arbiterPath, dir, "README.md");
      let displayName = dir;
      try {
        const content = fs.readFileSync(readmePath, "utf-8");
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          displayName = titleMatch[1];
        }
      } catch {
        // Use directory name as fallback
      }
      lines.push(`  * [${displayName}](/${dir}/README.md)`);

      // List child endpoints/files
      const dirPath = path.join(arbiterPath, dir);
      const childFiles = fs
        .readdirSync(dirPath)
        .filter((f) => f.endsWith(".md") && f !== "README.md");
      for (const file of childFiles.slice(0, 10)) {
        const name = file.replace(".md", "");
        lines.push(`    * [${name}](/${dir}/${file})`);
      }
      if (childFiles.length > 10) {
        lines.push(`    * _...and ${childFiles.length - 10} more_`);
      }
    }
    lines.push("");
  }

  // Add known directories (notes, tasks, etc.)
  for (const dir of otherDirs) {
    const title = knownDirectories[dir];
    const dirPath = path.join(arbiterPath, dir);

    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
      if (files.length === 0) continue; // Skip empty directories

      lines.push(`* **${title}**`);

      for (const file of files.slice(0, 20)) {
        const name = file.replace(".md", "");
        lines.push(`  * [${name}](/${dir}/${file})`);
      }

      if (files.length > 20) {
        lines.push(`  * _...and ${files.length - 20} more_`);
      }

      lines.push("");
    }
  }

  // Note: CUE files are not shown in sidebar as docsify can't render them
  // and search tries to index them causing issues

  return lines.join("\n");
}

/**
 * Generate README.md for the vault root.
 */
function generateReadme(name: string, arbiterPath: string): string {
  const lines: string[] = [`# ${name}`, "", "Welcome to your Arbiter specification vault.", ""];

  // List directories
  const entries = fs.readdirSync(arbiterPath, { withFileTypes: true });
  const dirs = entries.filter(
    (e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "cache",
  );
  const files = entries.filter(
    (e) =>
      e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".cue")) && e.name !== "README.md",
  );

  // Categorize directories
  const serviceDirs: Array<{ name: string; title: string; type?: string }> = [];
  const otherDirs: Array<{ name: string; fileCount: number }> = [];

  for (const dir of dirs) {
    const dirPath = path.join(arbiterPath, dir.name);
    const readmePath = path.join(dirPath, "README.md");

    if (fs.existsSync(readmePath)) {
      // Read service info from README
      try {
        const content = fs.readFileSync(readmePath, "utf-8");
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const typeMatch = content.match(/^type:\s*["']?(\w+)["']?/m);
        serviceDirs.push({
          name: dir.name,
          title: titleMatch?.[1] || dir.name,
          type: typeMatch?.[1],
        });
      } catch {
        serviceDirs.push({ name: dir.name, title: dir.name });
      }
    } else {
      const fileCount = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md")).length;
      otherDirs.push({ name: dir.name, fileCount });
    }
  }

  // Show packages
  if (serviceDirs.length > 0) {
    lines.push("## Packages");
    lines.push("");
    lines.push("| Package | Type |");
    lines.push("|---------|------|");
    for (const pkg of serviceDirs.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`| [${pkg.title}](${pkg.name}/README.md) | ${pkg.type || "package"} |`);
    }
    lines.push("");
  }

  // Show other directories
  if (otherDirs.length > 0) {
    const nonEmptyDirs = otherDirs.filter((d) => d.fileCount > 0);
    if (nonEmptyDirs.length > 0) {
      lines.push("## Other");
      lines.push("");
      for (const dir of nonEmptyDirs) {
        lines.push(`- **${dir.name}/** - ${dir.fileCount} file(s)`);
      }
      lines.push("");
    }
  }

  // Show root files
  if (files.length > 0) {
    lines.push("## Files");
    lines.push("");
    for (const file of files) {
      lines.push(`- [${file.name}](${file.name})`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Served with [Docsify](https://docsify.js.org/)*");

  return lines.join("\n");
}

/**
 * Serve .arbiter directory with docsify.
 */
async function serveWithDocsify(
  arbiterPath: string,
  port: number,
  openBrowser: boolean,
): Promise<number> {
  const absolutePath = path.resolve(arbiterPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(chalk.red("Arbiter directory not found:"), absolutePath);
    console.log(chalk.dim("Initialize with: arbiter init"));
    return 1;
  }

  // Get project name from assembly.cue or directory
  let projectName = path.basename(path.dirname(absolutePath));
  const assemblyPath = path.join(absolutePath, "assembly.cue");
  if (fs.existsSync(assemblyPath)) {
    const content = fs.readFileSync(assemblyPath, "utf-8");
    const nameMatch = content.match(/name:\s*["']?([^"'\n]+)["']?/);
    if (nameMatch) {
      projectName = nameMatch[1];
    }
  }

  // Generate required files
  const indexHtml = generateDocsifyHtml(projectName);
  // Note: sidebar and readme are generated dynamically on each request
  // to pick up new files without requiring a server restart

  // MIME types
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".md": "text/markdown",
    ".cue": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };

  const server = http.createServer((req, res) => {
    let urlPath = req.url || "/";

    // Remove query string
    urlPath = urlPath.split("?")[0];

    // Handle special generated files
    if (urlPath === "/" || urlPath === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(indexHtml);
      return;
    }

    if (urlPath === "/_sidebar.md") {
      res.writeHead(200, { "Content-Type": "text/markdown" });
      res.end(generateSidebar(absolutePath));
      return;
    }

    if (urlPath === "/README.md") {
      res.writeHead(200, { "Content-Type": "text/markdown" });
      res.end(generateReadme(projectName, absolutePath));
      return;
    }

    // Serve files from .arbiter directory
    const filePath = path.join(absolutePath, urlPath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(absolutePath)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // For SPA routing, return index.html for non-existent paths
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(indexHtml);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, async () => {
      const url = `http://localhost:${port}`;

      console.log(chalk.blue("Arbiter Vault Server"));
      console.log(chalk.dim(`Serving: ${absolutePath}`));
      console.log();
      console.log(chalk.green("Server running at:"), chalk.cyan(url));
      console.log();
      console.log(chalk.dim("Press Ctrl+C to stop"));

      if (openBrowser) {
        try {
          await openUrl(url);
        } catch {
          // Ignore browser open errors
        }
      }
    });

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log(chalk.dim("\nShutting down..."));
      server.close(() => {
        resolve(0);
      });
    });

    process.on("SIGTERM", () => {
      server.close(() => {
        resolve(0);
      });
    });
  });
}

/**
 * View command entry point.
 */
export async function viewCommand(options: ViewOptions, config: CLIConfig): Promise<number> {
  const arbiterPath = path.join(config.projectDir ?? process.cwd(), ".arbiter");
  const port = options.port ?? 4000;
  const openBrowser = !options.noBrowser;

  return serveWithDocsify(arbiterPath, port, openBrowser);
}
