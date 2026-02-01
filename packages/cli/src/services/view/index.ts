/**
 * @packageDocumentation
 * View command - View Arbiter vault in browser or Obsidian.
 *
 * Provides functionality to:
 * - Serve .arbiter directory with docsify for browser viewing
 * - Open .arbiter directory in Obsidian using URI scheme
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
  /** Open in Obsidian instead of browser */
  obsidian?: boolean;
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
 * Open .arbiter directory in Obsidian.
 *
 * Strategy:
 * 1. If .obsidian folder exists, it's already a vault - open directly
 * 2. Otherwise, just open the folder and let user add it as vault
 */
async function openInObsidian(arbiterPath: string): Promise<number> {
  const absolutePath = path.resolve(arbiterPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(chalk.red("Arbiter directory not found:"), absolutePath);
    console.log(chalk.dim("Initialize with: arbiter init"));
    return 1;
  }

  const obsidianConfigPath = path.join(absolutePath, ".obsidian");
  const isExistingVault = fs.existsSync(obsidianConfigPath);

  console.log(chalk.blue("Opening in Obsidian..."));
  console.log(chalk.dim(`Path: ${absolutePath}`));

  try {
    if (isExistingVault) {
      // It's already a vault - try to open it by path
      // Use the folder path directly - Obsidian will recognize it
      await openUrl(absolutePath);
      console.log(chalk.green("Opened existing vault in Obsidian"));
    } else {
      // Not a vault yet - open folder so user can add it
      // First, create a minimal .obsidian config so Obsidian recognizes it
      fs.mkdirSync(obsidianConfigPath, { recursive: true });

      // Create basic app.json config
      const appConfig = {
        alwaysUpdateLinks: true,
        newFileLocation: "current",
        attachmentFolderPath: "attachments",
        showUnsupportedFiles: true,
      };
      fs.writeFileSync(
        path.join(obsidianConfigPath, "app.json"),
        JSON.stringify(appConfig, null, 2),
      );

      // Create workspace config
      const workspaceConfig = {
        main: {
          id: "main",
          type: "split",
          children: [],
          direction: "vertical",
        },
      };
      fs.writeFileSync(
        path.join(obsidianConfigPath, "workspace.json"),
        JSON.stringify(workspaceConfig, null, 2),
      );

      console.log(chalk.dim("Created Obsidian vault configuration"));

      // Now open the folder - Obsidian should recognize it as a vault
      await openUrl(absolutePath);
      console.log(chalk.green("Initialized and opened as Obsidian vault"));
    }

    console.log(
      chalk.dim(
        "\nTip: If Obsidian doesn't open automatically, drag the folder into Obsidian's vault list.",
      ),
    );
    return 0;
  } catch (error) {
    console.error(
      chalk.red("Failed to open Obsidian:"),
      error instanceof Error ? error.message : String(error),
    );
    console.log(chalk.dim("\nManually open Obsidian and add this vault:"));
    console.log(chalk.cyan(`  ${absolutePath}`));
    return 1;
  }
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
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/docsify@4/lib/themes/vue.css">
  <style>
    :root {
      --theme-color: #5c6bc0;
    }
    .sidebar-nav > ul > li > a {
      font-weight: bold;
    }
    .markdown-section code {
      border-radius: 3px;
    }
    /* Better task list styling */
    .task-list-item {
      list-style-type: none;
    }
    .task-list-item input {
      margin-right: 0.5em;
    }

    /* Frontmatter metadata card styling */
    .arbiter-meta {
      background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%);
      border: 1px solid #e0e0e0;
      border-radius: 8px;
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
      background: var(--theme-color);
      color: white;
      padding: 0.2em 0.6em;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.85em;
      text-transform: uppercase;
    }
    .arbiter-meta-title {
      font-weight: 600;
      font-size: 1.1em;
      color: #333;
    }
    .arbiter-meta-badges {
      display: flex;
      gap: 0.5em;
      flex-wrap: wrap;
      margin-bottom: 0.5em;
    }
    .arbiter-badge {
      padding: 0.2em 0.5em;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: 500;
    }
    /* Status colors */
    .arbiter-status-open { background: #e3f2fd; color: #1565c0; }
    .arbiter-status-in_progress, .arbiter-status-in-progress { background: #fff3e0; color: #ef6c00; }
    .arbiter-status-blocked { background: #ffebee; color: #c62828; }
    .arbiter-status-review { background: #f3e5f5; color: #7b1fa2; }
    .arbiter-status-done, .arbiter-status-closed { background: #e8f5e9; color: #2e7d32; }
    .arbiter-status-wontfix { background: #eceff1; color: #546e7a; }
    /* Priority colors */
    .arbiter-priority-critical { background: #ffcdd2; color: #b71c1c; }
    .arbiter-priority-high { background: #ffe0b2; color: #e65100; }
    .arbiter-priority-medium { background: #fff9c4; color: #f57f17; }
    .arbiter-priority-low { background: #e0e0e0; color: #616161; }
    /* Tags */
    .arbiter-tag {
      background: #e8eaf6;
      color: #3949ab;
      padding: 0.15em 0.4em;
      border-radius: 3px;
      font-size: 0.8em;
    }
    .arbiter-meta-row {
      display: flex;
      gap: 1.5em;
      color: #666;
      font-size: 0.85em;
      flex-wrap: wrap;
    }
    .arbiter-meta-row span {
      display: flex;
      align-items: center;
      gap: 0.3em;
    }
    .arbiter-meta-links {
      margin-top: 0.5em;
      padding-top: 0.5em;
      border-top: 1px solid #e0e0e0;
      font-size: 0.85em;
    }
    .arbiter-meta-links a {
      color: var(--theme-color);
      text-decoration: none;
    }
    .arbiter-meta-links a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js"></script>
  <script>
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
        metaItems.push('<span>👤 ' + escapeHtml(meta.assignee) + '</span>');
      }
      if (meta.created) {
        metaItems.push('<span>📅 ' + escapeHtml(formatDate(meta.created)) + '</span>');
      }
      if (meta.updated) {
        metaItems.push('<span>✏️ ' + escapeHtml(formatDate(meta.updated)) + '</span>');
      }
      if (meta.estimate) {
        metaItems.push('<span>⏱️ ' + escapeHtml(meta.estimate) + '</span>');
      }
      if (metaItems.length > 0) {
        parts.push('<div class="arbiter-meta-row">' + metaItems.join('') + '</div>');
      }

      // External links
      if (meta.external_url || meta.github_url) {
        parts.push('<div class="arbiter-meta-links">');
        if (meta.external_url) {
          parts.push('<a href="' + escapeHtml(meta.external_url) + '" target="_blank">🔗 External Link</a> ');
        }
        if (meta.github_url) {
          parts.push('<a href="' + escapeHtml(meta.github_url) + '" target="_blank">🐙 GitHub</a>');
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
        parts.push('<span class="arbiter-tag">' + escapeHtml(meta.kind) + '</span>');
      }
      if (meta.author) {
        parts.push('<span>👤 ' + escapeHtml(meta.author) + '</span>');
      }
      if (meta.created) {
        parts.push('<span>📅 ' + escapeHtml(formatDate(meta.created)) + '</span>');
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
      search: {
        placeholder: 'Search...',
        noData: 'No results',
        depth: 3,
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

  // Check for standard directories
  const directories = [
    { dir: "notes", title: "Notes" },
    { dir: "tasks", title: "Tasks" },
  ];

  for (const { dir, title } of directories) {
    const dirPath = path.join(arbiterPath, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      lines.push(`* **${title}**`);

      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
      for (const file of files.slice(0, 20)) {
        // Limit to 20 items
        const name = file.replace(".md", "");
        lines.push(`  * [${name}](/${dir}/${file})`);
      }

      if (files.length > 20) {
        lines.push(`  * _...and ${files.length - 20} more_`);
      }

      lines.push("");
    }
  }

  // Add CUE files
  const cueFiles = fs
    .readdirSync(arbiterPath)
    .filter((f) => f.endsWith(".cue") && !f.startsWith("."));

  if (cueFiles.length > 0) {
    lines.push("* **Specifications**");
    for (const file of cueFiles) {
      const name = file.replace(".cue", "");
      lines.push(`  * [${name}](/${file} ":ignore")`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate README.md for the vault root.
 */
function generateReadme(name: string, arbiterPath: string): string {
  const lines: string[] = [
    `# ${name}`,
    "",
    "Welcome to your Arbiter specification vault.",
    "",
    "## Contents",
    "",
  ];

  // List directories
  const entries = fs.readdirSync(arbiterPath, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));
  const files = entries.filter(
    (e) => e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".cue")),
  );

  if (dirs.length > 0) {
    lines.push("### Directories");
    for (const dir of dirs) {
      const count = fs
        .readdirSync(path.join(arbiterPath, dir.name))
        .filter((f) => f.endsWith(".md")).length;
      lines.push(`- **${dir.name}/** - ${count} files`);
    }
    lines.push("");
  }

  if (files.length > 0) {
    lines.push("### Files");
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
  const sidebar = generateSidebar(absolutePath);
  const readme = generateReadme(projectName, absolutePath);

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
      res.end(sidebar);
      return;
    }

    if (urlPath === "/README.md") {
      res.writeHead(200, { "Content-Type": "text/markdown" });
      res.end(readme);
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

  if (options.obsidian) {
    return openInObsidian(arbiterPath);
  }

  const port = options.port ?? 4000;
  const openBrowser = !options.noBrowser;

  return serveWithDocsify(arbiterPath, port, openBrowser);
}
