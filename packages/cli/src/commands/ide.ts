import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import type { CLIConfig, IDEOptions } from "../types.js";

interface ProjectLanguage {
  name: string;
  detected: boolean;
  files: string[];
  extensions: string[];
}

/**
 * Detect project languages based on file patterns
 */
async function detectProjectLanguages(projectPath: string): Promise<ProjectLanguage[]> {
  const languages: ProjectLanguage[] = [
    {
      name: "cue",
      detected: false,
      files: [],
      extensions: ["bradleyjkemp.vscode-cue"],
    },
    {
      name: "typescript",
      detected: false,
      files: [],
      extensions: ["ms-vscode.vscode-typescript-next", "bradlc.vscode-tailwindcss"],
    },
    {
      name: "python",
      detected: false,
      files: [],
      extensions: ["ms-python.python", "ms-python.black-formatter"],
    },
    {
      name: "rust",
      detected: false,
      files: [],
      extensions: ["rust-lang.rust-analyzer", "serayuzgur.crates"],
    },
    {
      name: "go",
      detected: false,
      files: [],
      extensions: ["golang.go"],
    },
    {
      name: "bash",
      detected: false,
      files: [],
      extensions: ["timonwong.shellcheck", "foxundermoon.shell-format"],
    },
  ];

  async function scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);

        if (entry.isDirectory()) {
          // Skip common ignore directories
          if (
            ["node_modules", ".git", "dist", "build", "target", ".next", "__pycache__"].includes(
              entry.name,
            )
          ) {
            continue;
          }
          await scanDirectory(fullPath);
        } else {
          // Check file extensions and patterns
          const ext = path.extname(entry.name).toLowerCase();
          const basename = entry.name.toLowerCase();

          // CUE files
          if (ext === ".cue") {
            languages[0].detected = true;
            languages[0].files.push(relativePath);
          }
          // TypeScript/JavaScript
          else if (
            [".ts", ".tsx", ".js", ".jsx"].includes(ext) ||
            ["package.json", "tsconfig.json"].includes(basename)
          ) {
            languages[1].detected = true;
            languages[1].files.push(relativePath);
          }
          // Python
          else if (ext === ".py" || ["pyproject.toml", "requirements.txt"].includes(basename)) {
            languages[2].detected = true;
            languages[2].files.push(relativePath);
          }
          // Rust
          else if (ext === ".rs" || ["cargo.toml", "cargo.lock"].includes(basename)) {
            languages[3].detected = true;
            languages[3].files.push(relativePath);
          }
          // Go
          else if (ext === ".go" || ["go.mod", "go.sum"].includes(basename)) {
            languages[4].detected = true;
            languages[4].files.push(relativePath);
          }
          // Bash
          else if (ext === ".sh" || basename === "makefile") {
            languages[5].detected = true;
            languages[5].files.push(relativePath);
          }
        }
      }
    } catch (_error) {
      // Skip directories we can't read
      return;
    }
  }

  await scanDirectory(projectPath);
  return languages.filter((lang) => lang.detected);
}

/**
 * Generate VS Code configuration
 */
async function generateVSCodeConfig(
  languages: ProjectLanguage[],
  projectPath: string,
  force: boolean,
  outputDir?: string,
): Promise<void> {
  const vscodeDir = path.join(outputDir || projectPath, ".vscode");
  await fs.mkdir(vscodeDir, { recursive: true });

  // Generate all VS Code configuration files
  await generateExtensionsConfig(languages, vscodeDir, force);
  await generateTasksConfig(languages, vscodeDir, force);  
  await generateSettingsConfig(vscodeDir, force);

}

/**
 * Generate extensions.json configuration
 */
async function generateExtensionsConfig(
  languages: ProjectLanguage[],
  vscodeDir: string,
  force: boolean
): Promise<void> {
  const allExtensions = collectRequiredExtensions(languages);
  const extensionsConfig = {
    recommendations: Array.from(allExtensions).sort(),
  };

  const extensionsPath = path.join(vscodeDir, "extensions.json");
  await writeConfigFile(extensionsPath, extensionsConfig, force);
}

/**
 * Collect all required VS Code extensions for detected languages
 */
function collectRequiredExtensions(languages: ProjectLanguage[]): Set<string> {
  const allExtensions = new Set<string>();

  // Add recommended extensions for detected languages
  for (const lang of languages) {
    for (const ext of lang.extensions) {
      allExtensions.add(ext);
    }
  }

  // Add Arbiter-specific extensions
  allExtensions.add("bradleyjkemp.vscode-cue"); // CUE language support
  allExtensions.add("ms-vscode.vscode-json"); // JSON support
  allExtensions.add("redhat.vscode-yaml"); // YAML support

  return allExtensions;
}

/**
 * Write a configuration file, respecting the force flag
 */
async function writeConfigFile(filePath: string, config: any, force: boolean): Promise<void> {
  let shouldWrite = force;

  if (!force) {
    try {
      const existingContent = JSON.parse(await fs.readFile(filePath, "utf8"));
      // Merge with existing config
      Object.assign(existingContent, config);
      await fs.writeFile(filePath, JSON.stringify(existingContent, null, 2));
      console.log(chalk.green(`✅ Merged configuration into ${filePath}`));
      return;
    } catch {
      shouldWrite = true;
    }
  }

  if (shouldWrite) {
    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✅ Generated ${filePath}`));
  }
}

/**
 * Create base Arbiter tasks for VS Code
 */
function createArbiterTasks(): any[] {
  return [
    {
      label: "Arbiter: Check",
      type: "shell",
      command: "arbiter",
      args: ["check", "--format", "json"],
      group: "build",
      presentation: {
        echo: true,
        reveal: "always",
        focus: false,
        panel: "shared",
        clear: true,
      },
      problemMatcher: {
        owner: "arbiter-check",
        fileLocation: ["relative", "${workspaceFolder}"],
        pattern: [
          {
            regexp: "^ERROR\\s+(.*):(\\d+):(\\d+)\\s+(.*)$",
            file: 1,
            line: 2,
            column: 3,
            message: 4,
            severity: "error",
          },
        ],
      },
    },
    {
      label: "Arbiter: Watch",
      type: "shell",
      command: "arbiter",
      args: ["watch"],
      group: "build",
      isBackground: true,
      presentation: {
        echo: true,
        reveal: "always",
        focus: false,
        panel: "shared",
      },
      problemMatcher: {
        owner: "arbiter-watch",
        fileLocation: ["relative", "${workspaceFolder}"],
        background: {
          activeOnStart: true,
          beginsPattern: "^🔍 Watching for changes",
          endsPattern: "^✅ All files validated",
        },
      },
    },
  ];
}

/**
 * Create language-specific tasks
 */
function createLanguageSpecificTasks(languages: ProjectLanguage[]): any[] {
  const tasks = [];
  
  for (const lang of languages) {
    if (lang.name === "typescript") {
      tasks.push({
        label: `${lang.name}: Build`,
        type: "shell",
        command: "npm",
        args: ["run", "build"],
        group: "build",
      });
    } else if (lang.name === "python") {
      tasks.push({
        label: `${lang.name}: Test`,
        type: "shell",
        command: "python",
        args: ["-m", "pytest"],
        group: "test",
      });
    }
    // Add more language-specific tasks as needed
  }
  
  return tasks;
}

/**
 * Generate tasks.json configuration
 */
async function generateTasksConfig(
  languages: ProjectLanguage[],
  vscodeDir: string,
  force: boolean
): Promise<void> {
  const baseTasks = createArbiterTasks();
  const languageTasks = createLanguageSpecificTasks(languages);
  
  const tasksConfig = {
    tasks: [
      {
        label: "Arbiter: Check",
        type: "shell",
        command: "arbiter",
        args: ["check", "--format", "json"],
        group: "build",
        presentation: {
          echo: true,
          reveal: "always",
          focus: false,
          panel: "shared",
          clear: true,
        },
        problemMatcher: {
          owner: "arbiter-check",
          fileLocation: ["relative", "${workspaceFolder}"],
          pattern: [
            {
              regexp: "^ERROR\\s+(.*):(\\d+):(\\d+)\\s+(.*)$",
              file: 1,
              line: 2,
              column: 3,
              message: 4,
              severity: "error",
            },
            {
              regexp: "^WARNING\\s+(.*):(\\d+):(\\d+)\\s+(.*)$",
              file: 1,
              line: 2,
              column: 3,
              message: 4,
              severity: "warning",
            },
            {
              regexp: "^(.*):(\\d+):(\\d+):\\s+(error|warning):\\s+(.*)$",
              file: 1,
              line: 2,
              column: 3,
              severity: 4,
              message: 5,
            },
          ],
        },
      },
      {
        label: "CUE: Format",
        type: "shell",
        command: "cue",
        args: ["fmt", "${file}"],
        group: "build",
        presentation: {
          echo: false,
          reveal: "never",
          focus: false,
          panel: "shared",
        },
        problemMatcher: [],
      },
      {
        label: "CUE: Format All",
        type: "shell",
        command: "cue",
        args: ["fmt", "./..."],
        group: "build",
        presentation: {
          echo: true,
          reveal: "silent",
          focus: false,
          panel: "shared",
        },
        problemMatcher: [],
      },
      {
        label: "Arbiter: Watch",
        type: "shell",
        command: "arbiter",
        args: ["watch", "--agent-mode"],
        group: "build",
        isBackground: true,
        presentation: {
          echo: true,
          reveal: "always",
          focus: false,
          panel: "dedicated",
          clear: true,
        },
        problemMatcher: {
          owner: "arbiter-watch",
          fileLocation: ["relative", "${workspaceFolder}"],
          pattern: [
            {
              regexp:
                '^\\s*"file":\\s*"([^"]+)",\\s*"line":\\s*(\\d+),\\s*"column":\\s*(\\d+),\\s*"severity":\\s*"([^"]+)",\\s*"message":\\s*"([^"]+)"',
              file: 1,
              line: 2,
              column: 3,
              severity: 4,
              message: 5,
            },
          ],
          background: {
            activeOnStart: true,
            beginsPattern: '^.*"event":\\s*"watch_start".*$',
            endsPattern: '^.*"event":\\s*"validation_complete".*$',
          },
        },
      },
      {
        label: "Arbiter: Generate Surface",
        type: "shell",
        command: "arbiter",
        args: ["surface", "typescript", "--output", "surface.json", "--verbose"],
        group: "build",
        presentation: {
          echo: true,
          reveal: "always",
          focus: false,
          panel: "shared",
        },
        problemMatcher: {
          owner: "arbiter-surface",
          fileLocation: ["relative", "${workspaceFolder}"],
          pattern: {
            regexp: "^(.*):(\\d+):(\\d+):\\s+(warning|error):\\s+(.*)$",
            file: 1,
            line: 2,
            column: 3,
            severity: 4,
            message: 5,
          },
        },
      },
      {
        label: "Arbiter: Sync Manifests",
        type: "shell",
        command: "arbiter",
        args: ["sync", "--all"],
        group: "build",
        presentation: {
          echo: true,
          reveal: "always",
          focus: false,
          panel: "shared",
        },
      },
      {
        label: "Arbiter: Generate CI",
        type: "shell",
        command: "arbiter",
        args: ["integrate", "--force"],
        group: "build",
        presentation: {
          echo: true,
          reveal: "always",
          focus: false,
          panel: "shared",
        },
      },
    ],
  };

  // Add language-specific tasks
  if (languages.some((l) => l.name === "typescript")) {
    tasks.tasks.push({
      label: "TypeScript: Build",
      type: "typescript",
      tsconfig: "tsconfig.json",
      group: "build",
      presentation: {
        echo: true,
        reveal: "silent",
        focus: false,
        panel: "shared",
      },
      problemMatcher: "$tsc",
    });
  }

  const tasksPath = path.join(vscodeDir, "tasks.json");
  let shouldWriteTasks = force;

  if (!force) {
    try {
      await fs.access(tasksPath);
      console.log(chalk.yellow(`⚠️  ${tasksPath} already exists. Use --force to overwrite.`));
    } catch {
      shouldWriteTasks = true;
    }
  }

  if (shouldWriteTasks) {
    await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2));
    console.log(chalk.green(`✅ Generated ${tasksPath}`));
  }

  // Generate settings.json with enhanced CUE support and save-time formatting
  const settings = {
    "[cue]": {
      "editor.insertSpaces": true,
      "editor.tabSize": 2,
      "editor.detectIndentation": false,
      "editor.formatOnSave": true,
      "editor.formatOnType": true,
      "editor.formatOnPaste": true,
      "editor.defaultFormatter": "bradleyjkemp.vscode-cue",
    },
    "files.associations": {
      "*.cue": "cue",
      "arbiter.assembly.cue": "cue",
      "*.assembly.cue": "cue",
    },
    "cue.useLanguageServer": true,
    "cue.formatting.enabled": true,
    "editor.rulers": [80, 120],
    "editor.quickSuggestions": {
      other: true,
      comments: false,
      strings: true,
    },
    "editor.suggestSelection": "first",
    "editor.wordBasedSuggestions": false,
    // Save actions for CUE files
    "editor.codeActionsOnSave": {
      "source.organizeImports": true,
      "source.fixAll": true,
    },
    // Arbiter-specific file associations
    "files.exclude": {
      "**/*.log": true,
      "**/node_modules": true,
      "**/dist": true,
      "**/build": true,
      "**/.git": true,
    },
    // Problem matcher integration
    "problemMatcher.pattern": [
      {
        name: "arbiter-cue",
        regexp: "^(.*):(\\d+):(\\d+):\\s+(warning|error):\\s+(.*)$",
        file: 1,
        line: 2,
        column: 3,
        severity: 4,
        message: 5,
      },
    ],
    // Workspace-specific Arbiter settings
    "arbiter.autoFormat": true,
    "arbiter.validateOnSave": true,
    "arbiter.showInlineErrors": true,
  };

  const settingsPath = path.join(vscodeDir, "settings.json");
  let shouldWriteSettings = force;

  if (!force) {
    try {
      const existingSettings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
      // Merge with existing settings
      Object.assign(existingSettings, settings);
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings, null, 2));
      console.log(chalk.green(`✅ Merged settings into ${settingsPath}`));
    } catch {
      shouldWriteSettings = true;
    }
  }

  if (shouldWriteSettings) {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    console.log(chalk.green(`✅ Generated ${settingsPath}`));
  }
}

/**
 * Generate JetBrains IDE configuration (IntelliJ IDEA, etc.)
 */
async function generateIDEAConfig(
  _languages: ProjectLanguage[],
  projectPath: string,
  force: boolean,
  outputDir?: string,
): Promise<void> {
  const ideaDir = path.join(outputDir || projectPath, ".idea");

  try {
    await fs.mkdir(ideaDir, { recursive: true });

    // Generate file watcher for CUE files
    const watchersConfig = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectTasksOptions">
    <TaskOptions isEnabled="true">
      <option name="arguments" value="check" />
      <option name="checkSyntaxErrors" value="true" />
      <option name="description" value="Arbiter CUE validation" />
      <option name="exitCodeBehavior" value="ERROR" />
      <option name="fileExtension" value="cue" />
      <option name="immediateSync" value="false" />
      <option name="name" value="Arbiter Check" />
      <option name="output" value="$FileDir$" />
      <option name="outputFilters">
        <array />
      </option>
      <option name="outputFromStdout" value="false" />
      <option name="program" value="arbiter" />
      <option name="runOnExternalChanges" value="false" />
      <option name="scopeName" value="Project Files" />
      <option name="trackOnlyRoot" value="true" />
      <option name="workingDir" value="$ProjectFileDir$" />
      <envs />
    </TaskOptions>
  </component>
</project>`;

    const watchersPath = path.join(ideaDir, "watchers.xml");
    if (
      force ||
      !(await fs.access(watchersPath).then(
        () => true,
        () => false,
      ))
    ) {
      await fs.writeFile(watchersPath, watchersConfig);
      console.log(chalk.green(`✅ Generated ${watchersPath}`));
    } else {
      console.log(chalk.yellow(`⚠️  ${watchersPath} already exists. Use --force to overwrite.`));
    }
  } catch (_error) {
    console.log(chalk.yellow("⚠️  Could not generate IntelliJ IDEA configuration"));
  }
}

/**
 * Generate Vim configuration
 */
async function generateVimConfig(
  _languages: ProjectLanguage[],
  projectPath: string,
  force: boolean,
  outputDir?: string,
): Promise<void> {
  const vimrcPath = path.join(outputDir || projectPath, ".vimrc.local");

  const vimConfig = `" Arbiter CUE configuration for Vim
" Install cue.vim plugin: https://github.com/jjo/vim-cue

" CUE file settings
autocmd BufNewFile,BufRead *.cue set filetype=cue
autocmd FileType cue setlocal tabstop=2 shiftwidth=2 expandtab

" Arbiter integration
command! ArbiterCheck !arbiter check
command! ArbiterWatch !arbiter watch &

" Key mappings
nnoremap <leader>ac :ArbiterCheck<CR>
nnoremap <leader>aw :ArbiterWatch<CR>
`;

  if (
    force ||
    !(await fs.access(vimrcPath).then(
      () => true,
      () => false,
    ))
  ) {
    await fs.writeFile(vimrcPath, vimConfig);
    console.log(chalk.green(`✅ Generated ${vimrcPath}`));
    console.log(
      chalk.dim('   Add "source .vimrc.local" to your ~/.vimrc to use this configuration'),
    );
  } else {
    console.log(chalk.yellow(`⚠️  ${vimrcPath} already exists. Use --force to overwrite.`));
  }
}

/**
 * IDE recommend command implementation
 */
export async function ideCommand(options: IDEOptions, _config: CLIConfig): Promise<number> {
  try {
    const projectPath = process.cwd();
    console.log(chalk.blue("🔧 Arbiter IDE recommendation system"));
    console.log(chalk.dim(`Project: ${projectPath}`));

    // Detect project languages
    console.log(chalk.blue("🔍 Detecting project languages..."));
    const languages = await detectProjectLanguages(projectPath);

    if (languages.length === 0) {
      console.log(chalk.yellow("⚠️  No supported languages detected in project"));
      console.log(chalk.dim("Supported: CUE, TypeScript, Python, Rust, Go, Bash"));
      return 1;
    }

    console.log(chalk.green(`✅ Detected ${languages.length} language(s):`));
    for (const lang of languages) {
      console.log(chalk.dim(`  • ${lang.name} (${lang.files.length} files)`));
    }

    // If only detecting, return early
    if (options.detect) {
      console.log(chalk.cyan("\n📋 Language Detection Summary:"));
      for (const lang of languages) {
        console.log(
          `${chalk.bold(lang.name)}: ${chalk.green("✓")} (${lang.files.slice(0, 3).join(", ")}${lang.files.length > 3 ? "..." : ""})`,
        );
      }
      return 0;
    }

    // Generate IDE configurations
    const editor = options.editor || "vscode";
    const force = options.force || false;
    const outputDir = options.outputDir || options.output;

    if (outputDir) {
      console.log(chalk.blue(`\n🛠️  Generating ${editor} configuration in ${outputDir}...`));
    } else {
      console.log(chalk.blue(`\n🛠️  Generating ${editor} configuration...`));
    }

    switch (editor) {
      case "vscode":
        await generateVSCodeConfig(languages, projectPath, force, outputDir);
        break;
      case "idea":
        await generateIDEAConfig(languages, projectPath, force, outputDir);
        break;
      case "vim":
        await generateVimConfig(languages, projectPath, force, outputDir);
        break;
      case "all":
        await generateVSCodeConfig(languages, projectPath, force, outputDir);
        await generateIDEAConfig(languages, projectPath, force, outputDir);
        await generateVimConfig(languages, projectPath, force, outputDir);
        break;
      default:
        console.log(chalk.red(`❌ Unknown editor: ${editor}`));
        return 1;
    }

    console.log(chalk.green("\n🎉 IDE configuration generated successfully!"));
    console.log(chalk.cyan("Next steps:"));

    if (editor === "vscode" || editor === "all") {
      console.log(chalk.dim("  1. Restart VS Code to load new configuration"));
      console.log(chalk.dim("  2. Install recommended extensions when prompted"));
      console.log(chalk.dim('  3. Use Ctrl+Shift+P → "Tasks: Run Task" → "Arbiter: Check"'));
    }

    if (editor === "idea" || editor === "all") {
      console.log(chalk.dim("  1. Restart IntelliJ IDEA"));
      console.log(chalk.dim("  2. Enable file watchers in Settings → Tools → File Watchers"));
    }

    if (editor === "vim" || editor === "all") {
      console.log(chalk.dim("  1. Install cue.vim plugin for CUE syntax highlighting"));
      console.log(chalk.dim('  2. Add "source .vimrc.local" to your ~/.vimrc'));
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ IDE configuration failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
