import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import * as YAML from "yaml";
import type { CLIConfig, IntegrateOptions } from "../types.js";
import { ConfigurableTemplateManager } from "../utils/github-template-config.js";

interface BuildMatrix {
  versions: string[];
  os: string[];
  arch: string[];
}

interface ProjectLanguage {
  name: string;
  detected: boolean;
  files: string[];
  framework?: string;
}

/**
 * Read Arbiter assembly file to get build configuration
 */
async function readAssemblyFile(
  projectPath: string,
): Promise<{ buildMatrix?: BuildMatrix; language?: string } | null> {
  const assemblyPath = path.join(projectPath, "arbiter.assembly.cue");

  try {
    await fs.access(assemblyPath);
    const content = await fs.readFile(assemblyPath, "utf-8");

    // Parse the assembly file to extract build matrix configuration
    const config = parseAssemblyConfig(content);
    return config;
  } catch {
    return null;
  }
}

/**
 * Parse assembly file and extract build matrix from Profile configurations
 */
function parseAssemblyConfig(content: string): { buildMatrix?: BuildMatrix; language?: string } {
  // Extract language from assembly
  const languageMatch = content.match(/language:\s*"([^"]+)"/);
  const language = languageMatch?.[1] || "typescript";

  // Extract profile type from assembly
  const profileMatch = content.match(/profile:\s*"([^"]+)"/);
  const profileType = profileMatch?.[1] || "library";

  // Look for inline build matrix configuration first
  const buildMatrix = parseBuildMatrix(content);

  if (buildMatrix) {
    return { buildMatrix, language };
  }

  // If no inline matrix, try to get default matrix based on profile type
  const defaultMatrix = getDefaultBuildMatrixForProfile(profileType, language);

  return {
    buildMatrix: defaultMatrix,
    language,
  };
}

/**
 * Parse build matrix configuration from CUE content
 */
function parseBuildMatrix(content: string): BuildMatrix | undefined {
  const buildMatrixSection = content.match(/buildMatrix:\s*\{([^}]+)\}/);

  if (!buildMatrixSection) {
    return undefined;
  }

  const matrixContent = buildMatrixSection[1];
  const matrix: BuildMatrix = {
    versions: [],
    os: ["ubuntu-latest", "macos-latest", "windows-latest"],
    arch: ["x64"],
  };

  // Extract version arrays for different languages
  const nodeVersions = matrixContent.match(/nodeVersions:\s*\[(.*?)\]/);
  const pythonVersions = matrixContent.match(/pythonVersions:\s*\[(.*?)\]/);
  const rustVersions = matrixContent.match(/rustVersions:\s*\[(.*?)\]/);
  const goVersions = matrixContent.match(/goVersions:\s*\[(.*?)\]/);

  if (nodeVersions) {
    matrix.versions = parseVersionArray(nodeVersions[1]);
  } else if (pythonVersions) {
    matrix.versions = parseVersionArray(pythonVersions[1]);
  } else if (rustVersions) {
    matrix.versions = parseVersionArray(rustVersions[1]);
  } else if (goVersions) {
    matrix.versions = parseVersionArray(goVersions[1]);
  }

  // Extract OS array if specified
  const osMatch = matrixContent.match(/os:\s*\[(.*?)\]/);
  if (osMatch) {
    matrix.os = parseVersionArray(osMatch[1]);
  }

  // Extract architecture array if specified
  const archMatch = matrixContent.match(/arch:\s*\[(.*?)\]/);
  if (archMatch) {
    matrix.arch = parseVersionArray(archMatch[1]);
  }

  return matrix.versions.length > 0 ? matrix : undefined;
}

/**
 * Parse version array from CUE string format
 */
function parseVersionArray(arrayContent: string): string[] {
  return arrayContent
    .split(",")
    .map((v) => v.trim().replace(/["']/g, ""))
    .filter((v) => v.length > 0);
}

/**
 * Get default build matrix based on profile type and language
 */
function getDefaultBuildMatrixForProfile(profileType: string, language: string): BuildMatrix {
  const baseMatrix: BuildMatrix = {
    versions: [],
    os: ["ubuntu-latest", "macos-latest", "windows-latest"],
    arch: ["x64"],
  };

  // Use language-specific defaults that match the profile patterns
  switch (language) {
    case "typescript":
    case "javascript":
      baseMatrix.versions = profileType === "library" ? ["18", "20", "22"] : ["20", "latest"];
      break;
    case "python":
      baseMatrix.versions =
        profileType === "library" ? ["3.9", "3.10", "3.11", "3.12"] : ["3.11", "3.12"];
      break;
    case "rust":
      baseMatrix.versions = profileType === "library" ? ["stable", "beta"] : ["stable"];
      break;
    case "go":
      baseMatrix.versions = profileType === "library" ? ["1.21", "1.22", "1.23"] : ["1.22", "1.23"];
      break;
    default:
      baseMatrix.versions = ["latest"];
  }

  return baseMatrix;
}

/**
 * Detect project languages and frameworks
 */
async function detectProjectInfo(projectPath: string): Promise<ProjectLanguage[]> {
  const languages: ProjectLanguage[] = [];

  // Check for TypeScript/Node.js
  const packageJsonPath = path.join(projectPath, "package.json");
  try {
    const packageContent = await fs.readFile(packageJsonPath, "utf8");
    const pkg = JSON.parse(packageContent);

    languages.push({
      name: "typescript",
      detected: true,
      files: ["package.json"],
      framework: pkg.dependencies?.next
        ? "next"
        : pkg.dependencies?.react
          ? "react"
          : pkg.dependencies?.vue
            ? "vue"
            : "node",
    });
  } catch {
    // No package.json found
  }

  // Check for Python
  const pyprojectPath = path.join(projectPath, "pyproject.toml");
  const requirementsPath = path.join(projectPath, "requirements.txt");
  try {
    await fs.access(pyprojectPath);
    languages.push({
      name: "python",
      detected: true,
      files: ["pyproject.toml"],
      framework: "python",
    });
  } catch {
    try {
      await fs.access(requirementsPath);
      languages.push({
        name: "python",
        detected: true,
        files: ["requirements.txt"],
        framework: "python",
      });
    } catch {
      // No Python files found
    }
  }

  // Check for Rust
  const cargoPath = path.join(projectPath, "Cargo.toml");
  try {
    await fs.access(cargoPath);
    languages.push({
      name: "rust",
      detected: true,
      files: ["Cargo.toml"],
      framework: "rust",
    });
  } catch {
    // No Cargo.toml found
  }

  // Check for Go
  const goModPath = path.join(projectPath, "go.mod");
  try {
    await fs.access(goModPath);
    languages.push({
      name: "go",
      detected: true,
      files: ["go.mod"],
      framework: "go",
    });
  } catch {
    // No go.mod found
  }

  return languages;
}

/**
 * Generate GitHub Actions PR workflow
 */
function generateGitHubPRWorkflow(languages: ProjectLanguage[], matrix?: BuildMatrix) {
  const workflow = {
    name: "PR Validation",
    on: {
      pull_request: {
        branches: ["main", "master"],
      },
    },
    concurrency: {
      group: "${{ github.workflow }}-${{ github.ref }}",
      "cancel-in-progress": true,
    },
    jobs: {
      validation: {
        name: "Validation",
        "runs-on": "ubuntu-latest",
        steps: [
          {
            name: "Checkout code",
            uses: "actions/checkout@v4",
          },
          {
            name: "Setup Arbiter CLI",
            run: "npm install -g @arbiter/cli",
          },
          {
            name: "Validate CUE files",
            run: "arbiter check --format json",
          },
          {
            name: "Generate API surface",
            run: `arbiter surface ${languages[0]?.name || "typescript"} --output surface.json`,
          },
        ],
      },
    },
  };

  // Add language-specific jobs
  for (const lang of languages) {
    switch (lang.name) {
      case "typescript":
        workflow.jobs[`test-${lang.name}`] = {
          name: `Test ${lang.name}`,
          "runs-on": "${{ matrix.os }}",
          strategy: {
            matrix: {
              os: matrix?.os || ["ubuntu-latest", "macos-latest", "windows-latest"],
              "node-version": matrix?.versions || ["18", "20", "latest"],
            },
          },
          steps: [
            {
              name: "Checkout code",
              uses: "actions/checkout@v4",
            },
            {
              name: "Setup Node.js",
              uses: "actions/setup-node@v4",
              with: {
                "node-version": "${{ matrix.node-version }}",
                cache: "npm",
              },
            },
            {
              name: "Install dependencies",
              run: "npm ci",
            },
            {
              name: "Run type checking",
              run: "npm run type-check",
            },
            {
              name: "Run linting",
              run: "npm run lint",
            },
            {
              name: "Run tests",
              run: "npm test",
            },
            {
              name: "Generate test coverage",
              run: "arbiter tests cover --junit coverage.xml",
            },
            {
              name: "Upload coverage reports",
              uses: "codecov/codecov-action@v4",
              with: {
                file: "coverage.xml",
              },
            },
          ],
        };
        break;

      case "python":
        workflow.jobs[`test-${lang.name}`] = {
          name: `Test ${lang.name}`,
          "runs-on": "${{ matrix.os }}",
          strategy: {
            matrix: {
              os: matrix?.os || ["ubuntu-latest", "macos-latest", "windows-latest"],
              "python-version": matrix?.versions || ["3.9", "3.10", "3.11", "3.12"],
            },
          },
          steps: [
            {
              name: "Checkout code",
              uses: "actions/checkout@v4",
            },
            {
              name: "Setup Python",
              uses: "actions/setup-python@v5",
              with: {
                "python-version": "${{ matrix.python-version }}",
              },
            },
            {
              name: "Install dependencies",
              run: "pip install -e .[dev]",
            },
            {
              name: "Run linting",
              run: "ruff check",
            },
            {
              name: "Run type checking",
              run: "mypy .",
            },
            {
              name: "Run tests",
              run: "pytest --cov --cov-report=xml",
            },
            {
              name: "Generate test coverage",
              run: "arbiter tests cover --junit coverage.xml",
            },
          ],
        };
        break;

      case "rust":
        workflow.jobs[`test-${lang.name}`] = {
          name: `Test ${lang.name}`,
          "runs-on": "${{ matrix.os }}",
          strategy: {
            matrix: {
              os: matrix?.os || ["ubuntu-latest", "macos-latest", "windows-latest"],
              "rust-version": matrix?.versions || ["stable", "beta"],
            },
          },
          steps: [
            {
              name: "Checkout code",
              uses: "actions/checkout@v4",
            },
            {
              name: "Setup Rust",
              uses: "dtolnay/rust-toolchain@stable",
              with: {
                toolchain: "${{ matrix.rust-version }}",
              },
            },
            {
              name: "Cache dependencies",
              uses: "actions/cache@v4",
              with: {
                path: "target",
                key: "${{ runner.os }}-cargo-${{ hashFiles('Cargo.lock') }}",
              },
            },
            {
              name: "Run clippy",
              run: "cargo clippy -- -D warnings",
            },
            {
              name: "Run tests",
              run: "cargo test",
            },
            {
              name: "Generate test coverage",
              run: "arbiter tests cover --junit coverage.xml",
            },
          ],
        };
        break;

      case "go":
        workflow.jobs[`test-${lang.name}`] = {
          name: `Test ${lang.name}`,
          "runs-on": "${{ matrix.os }}",
          strategy: {
            matrix: {
              os: matrix?.os || ["ubuntu-latest", "macos-latest", "windows-latest"],
              "go-version": matrix?.versions || ["1.21", "1.22"],
            },
          },
          steps: [
            {
              name: "Checkout code",
              uses: "actions/checkout@v4",
            },
            {
              name: "Setup Go",
              uses: "actions/setup-go@v5",
              with: {
                "go-version": "${{ matrix.go-version }}",
              },
            },
            {
              name: "Run linting",
              uses: "golangci/golangci-lint-action@v4",
            },
            {
              name: "Run tests",
              run: "go test -v -race -coverprofile=coverage.out ./...",
            },
            {
              name: "Generate test coverage",
              run: "arbiter tests cover --junit coverage.xml",
            },
          ],
        };
        break;
    }
  }

  // Add security scanning job
  workflow.jobs.security = {
    name: "Security Scan",
    "runs-on": "ubuntu-latest",
    steps: [
      {
        name: "Checkout code",
        uses: "actions/checkout@v4",
      },
      {
        name: "Run Trivy vulnerability scanner",
        uses: "aquasecurity/trivy-action@master",
        with: {
          "scan-type": "fs",
          "scan-ref": ".",
          format: "sarif",
          output: "trivy-results.sarif",
        },
      },
      {
        name: "Upload Trivy scan results",
        uses: "github/codeql-action/upload-sarif@v3",
        if: "always()",
        with: {
          sarif_file: "trivy-results.sarif",
        },
      },
    ],
  };

  return workflow;
}

/**
 * Generate GitHub Actions main/release workflow
 */
function generateGitHubMainWorkflow(languages: ProjectLanguage[], _matrix?: BuildMatrix) {
  const workflow = {
    name: "Main Branch",
    on: {
      push: {
        branches: ["main", "master"],
      },
      release: {
        types: ["published"],
      },
    },
    jobs: {
      test: {
        name: "Test and Build",
        "runs-on": "ubuntu-latest",
        outputs: {
          version: "${{ steps.version.outputs.version }}",
        },
        steps: [
          {
            name: "Checkout code",
            uses: "actions/checkout@v4",
          },
          {
            name: "Setup Arbiter CLI",
            run: "npm install -g @arbiter/cli",
          },
          {
            name: "Validate CUE files",
            run: "arbiter check",
          },
          {
            name: "Generate version plan",
            run: "arbiter version plan --output version-plan.json",
          },
          {
            name: "Extract version",
            id: "version",
            run: 'echo "version=$(jq -r .recommended_version version-plan.json)" >> $GITHUB_OUTPUT',
          },
        ],
      },
    },
  };

  // Add language-specific build and deploy jobs
  for (const lang of languages) {
    switch (lang.name) {
      case "typescript":
        workflow.jobs.deploy = {
          name: "Deploy",
          needs: "test",
          "runs-on": "ubuntu-latest",
          if: "github.event_name == 'release'",
          steps: [
            {
              name: "Checkout code",
              uses: "actions/checkout@v4",
            },
            {
              name: "Setup Node.js",
              uses: "actions/setup-node@v4",
              with: {
                "node-version": "20",
                "registry-url": "https://registry.npmjs.org",
              },
            },
            {
              name: "Install dependencies",
              run: "npm ci",
            },
            {
              name: "Build package",
              run: "npm run build",
            },
            {
              name: "Update version",
              run: "arbiter version release --apply --version ${{ needs.test.outputs.version }}",
            },
            {
              name: "Publish to npm",
              run: "npm publish",
              env: {
                NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
              },
            },
          ],
        };
        break;

      case "python":
        workflow.jobs.deploy = {
          name: "Deploy",
          needs: "test",
          "runs-on": "ubuntu-latest",
          if: "github.event_name == 'release'",
          steps: [
            {
              name: "Checkout code",
              uses: "actions/checkout@v4",
            },
            {
              name: "Setup Python",
              uses: "actions/setup-python@v5",
              with: {
                "python-version": "3.11",
              },
            },
            {
              name: "Install build tools",
              run: "pip install build twine",
            },
            {
              name: "Update version",
              run: "arbiter version release --apply --version ${{ needs.test.outputs.version }}",
            },
            {
              name: "Build package",
              run: "python -m build",
            },
            {
              name: "Publish to PyPI",
              run: "twine upload dist/*",
              env: {
                TWINE_USERNAME: "__token__",
                TWINE_PASSWORD: "${{ secrets.PYPI_TOKEN }}",
              },
            },
          ],
        };
        break;

      case "rust":
        workflow.jobs.deploy = {
          name: "Deploy",
          needs: "test",
          "runs-on": "ubuntu-latest",
          if: "github.event_name == 'release'",
          steps: [
            {
              name: "Checkout code",
              uses: "actions/checkout@v4",
            },
            {
              name: "Setup Rust",
              uses: "dtolnay/rust-toolchain@stable",
            },
            {
              name: "Update version",
              run: "arbiter version release --apply --version ${{ needs.test.outputs.version }}",
            },
            {
              name: "Publish to crates.io",
              run: "cargo publish",
              env: {
                CARGO_REGISTRY_TOKEN: "${{ secrets.CARGO_TOKEN }}",
              },
            },
          ],
        };
        break;
    }
  }

  return workflow;
}

/**
 * Integrate command implementation
 */
export async function integrateCommand(
  options: IntegrateOptions,
  _config: CLIConfig,
): Promise<number> {
  try {
    const projectPath = process.cwd();
    console.log(chalk.blue("🔗 Arbiter CI/CD integration"));
    console.log(chalk.dim(`Project: ${projectPath}`));

    // Detect project languages and build matrix
    console.log(chalk.blue("🔍 Analyzing project..."));
    const languages = await detectProjectInfo(projectPath);
    const assemblyConfig = await readAssemblyFile(projectPath);

    if (languages.length === 0) {
      console.log(chalk.yellow("⚠️  No supported languages detected"));
      console.log(chalk.dim("Supported: TypeScript, Python, Rust, Go"));
      return 1;
    }

    console.log(chalk.green(`✅ Detected ${languages.length} language(s):`));
    for (const lang of languages) {
      console.log(chalk.dim(`  • ${lang.name} (${lang.framework})`));
    }

    if (assemblyConfig?.buildMatrix) {
      console.log(chalk.green("✅ Found arbiter.assembly.cue with Profile build matrix"));
      console.log(chalk.dim(`  Build matrix: ${assemblyConfig.buildMatrix.versions.join(", ")}`));
      console.log(chalk.dim(`  Platforms: ${assemblyConfig.buildMatrix.os.join(", ")}`));
    } else if (assemblyConfig) {
      console.log(chalk.yellow("⚠️  Found arbiter.assembly.cue but using default build matrix"));
    }

    const provider = options.provider || "github";
    const type = options.type || "all";
    const force = options.force || false;
    const outputDir = options.output || ".github/workflows";

    console.log(chalk.blue(`\n🛠️  Generating ${provider} workflows...`));

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    let generated = 0;

    // Generate PR workflow
    if (type === "pr" || type === "all") {
      const prWorkflow = generateGitHubPRWorkflow(languages, assemblyConfig?.buildMatrix);
      const prPath = path.join(outputDir, "pr.yml");

      if (
        force ||
        !(await fs.access(prPath).then(
          () => true,
          () => false,
        ))
      ) {
        const yamlContent = YAML.stringify(prWorkflow, {
          indent: 2,
          lineWidth: 0,
        });
        await fs.writeFile(prPath, yamlContent);
        console.log(chalk.green(`✅ Generated ${prPath}`));
        generated++;
      } else {
        console.log(chalk.yellow(`⚠️  ${prPath} already exists. Use --force to overwrite.`));
      }
    }

    // Generate main/release workflow
    if (type === "main" || type === "all") {
      const mainWorkflow = generateGitHubMainWorkflow(languages, assemblyConfig?.buildMatrix);
      const mainPath = path.join(outputDir, "main.yml");

      if (
        force ||
        !(await fs.access(mainPath).then(
          () => true,
          () => false,
        ))
      ) {
        const yamlContent = YAML.stringify(mainWorkflow, {
          indent: 2,
          lineWidth: 0,
        });
        await fs.writeFile(mainPath, yamlContent);
        console.log(chalk.green(`✅ Generated ${mainPath}`));
        generated++;
      } else {
        console.log(chalk.yellow(`⚠️  ${mainPath} already exists. Use --force to overwrite.`));
      }
    }

    // Generate GitHub templates if requested
    if (options.templates && provider === "github") {
      console.log(chalk.blue("\n🎯 Generating GitHub issue templates and configuration..."));
      
      // Use configurable template manager with default configuration
      const templateManager = new ConfigurableTemplateManager();
      const allTemplateFiles = templateManager.generateRepositoryTemplates();
      
      for (const [filePath, content] of Object.entries(allTemplateFiles)) {
        const fullPath = path.join(projectPath, filePath);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        
        if (
          force ||
          !(await fs.access(fullPath).then(
            () => true,
            () => false,
          ))
        ) {
          await fs.writeFile(fullPath, content);
          console.log(chalk.green(`✅ Generated ${filePath}`));
          generated++;
        } else {
          console.log(chalk.yellow(`⚠️  ${filePath} already exists. Use --force to overwrite.`));
        }
      }
    }

    console.log(chalk.green(`\n🎉 CI/CD integration complete!`));
    console.log(chalk.cyan(`📊 Generated ${generated} workflow file(s)`));

    if (generated > 0) {
      console.log(chalk.cyan("\nNext steps:"));
      console.log(chalk.dim("  1. Commit and push the workflow files"));
      console.log(chalk.dim("  2. Create repository secrets for deployment tokens:"));

      if (languages.some((l) => l.name === "typescript")) {
        console.log(chalk.dim("     - NPM_TOKEN (for npm publishing)"));
      }
      if (languages.some((l) => l.name === "python")) {
        console.log(chalk.dim("     - PYPI_TOKEN (for PyPI publishing)"));
      }
      if (languages.some((l) => l.name === "rust")) {
        console.log(chalk.dim("     - CARGO_TOKEN (for crates.io publishing)"));
      }

      console.log(chalk.dim("  3. Open a pull request to test the PR validation workflow"));
      console.log(chalk.dim("  4. Create a release to test the deployment workflow"));

      console.log(chalk.cyan("\nFeatures included:"));
      console.log(chalk.dim("  • Multi-platform matrix builds (from Profile configurations)"));
      console.log(chalk.dim("  • Contract coverage gates"));
      console.log(chalk.dim("  • Security scanning with Trivy"));
      console.log(chalk.dim("  • Semver-aware version management"));
      console.log(chalk.dim("  • Automatic deployment on release"));
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Integration failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
