/**
 * @packageDocumentation
 * GitHub workflow builder for the integrate command.
 *
 * Provides functionality to:
 * - Generate pull request validation workflows
 * - Generate main branch CI/CD workflows
 * - Support language-specific build steps
 * - Configure build matrices for multi-version testing
 */

import type { BuildMatrix, ProjectLanguage } from "@/services/integrate/types.js";
import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";

export function createGitHubPullRequestWorkflow(
  languages: ProjectLanguage[],
  matrix: BuildMatrix | undefined,
  pm: PackageManagerCommandSet,
): Record<string, unknown> {
  const workflow: Record<string, any> = {
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
          { name: "Checkout code", uses: "actions/checkout@v4" },
          { name: "Setup Arbiter CLI", run: pm.installGlobal("@arbiter/cli") },
          { name: "Validate CUE files", run: "arbiter status --format json" },
        ],
      },
    },
  };

  const jobCreators: Record<string, () => Record<string, any> | undefined> = {
    typescript: () => createNodeJob(matrix, pm),
    python: () => createPythonJob(matrix),
    rust: () => createRustJob(matrix),
    go: () => createGoJob(matrix),
  };

  for (const lang of languages) {
    const creator = jobCreators[lang.name];
    if (creator) {
      workflow.jobs[`test-${lang.name}`] = creator();
    }
  }

  workflow.jobs.security = createSecurityJob();
  return workflow;
}

export function createGitHubMainWorkflow(
  languages: ProjectLanguage[],
  _matrix: BuildMatrix | undefined,
  pm: PackageManagerCommandSet,
): Record<string, unknown> {
  const workflow: Record<string, any> = {
    name: "Main Branch",
    on: {
      push: { branches: ["main", "master"] },
      release: { types: ["published"] },
    },
    jobs: {
      test: {
        name: "Test and Build",
        "runs-on": "ubuntu-latest",
        outputs: { version: "${{ steps.version.outputs.version }}" },
        steps: [
          { name: "Checkout", uses: "actions/checkout@v4" },
          {
            name: "Determine version",
            id: "version",
            run: 'echo "version=1.0.${GITHUB_RUN_NUMBER}" >> $GITHUB_OUTPUT',
          },
          { name: "Install deps", run: pm.install },
          { name: "Test", run: pm.run("test") },
        ],
      },
      release: {
        name: "Release",
        needs: "test",
        "runs-on": "ubuntu-latest",
        steps: [
          { name: "Checkout", uses: "actions/checkout@v4" },
          { name: "Setup Node.js", uses: "actions/setup-node@v4", with: { "node-version": "20" } },
          { name: "Publish", run: publishCommand(pm) },
        ],
      },
    },
  };

  if (languages.length > 0) {
    workflow.jobs.test.steps.push({
      name: "Generate artifacts",
      run: "arbiter generate --dry-run",
    });
  }

  return workflow;
}

function createNodeJob(matrix: BuildMatrix | undefined, pm: PackageManagerCommandSet) {
  return {
    name: "Test typescript",
    "runs-on": "${{ matrix.os }}",
    strategy: {
      matrix: {
        os: matrix?.os || ["ubuntu-latest", "macos-latest", "windows-latest"],
        "node-version": matrix?.versions || ["18", "20", "latest"],
      },
    },
    steps: [
      { name: "Checkout code", uses: "actions/checkout@v4" },
      {
        name: "Setup Node.js",
        uses: "actions/setup-node@v4",
        with: { "node-version": "${{ matrix.node-version }}", cache: getNodeCacheKey(pm) },
      },
      { name: "Install dependencies", run: installCommand(pm) },
      { name: "Run type checking", run: pm.run("type-check") },
      { name: "Run linting", run: pm.run("lint") },
      { name: "Run tests", run: pm.run("test") },
      { name: "Generate test coverage", run: "arbiter tests cover --junit coverage.xml" },
      {
        name: "Upload coverage reports",
        uses: "codecov/codecov-action@v4",
        with: { file: "coverage.xml" },
      },
    ],
  };
}

function createPythonJob(matrix?: BuildMatrix) {
  return {
    name: "Test python",
    "runs-on": "${{ matrix.os }}",
    strategy: {
      matrix: {
        os: matrix?.os || ["ubuntu-latest", "macos-latest", "windows-latest"],
        "python-version": matrix?.versions || ["3.9", "3.10", "3.11", "3.12"],
      },
    },
    steps: [
      { name: "Checkout code", uses: "actions/checkout@v4" },
      {
        name: "Setup Python",
        uses: "actions/setup-python@v5",
        with: { "python-version": "${{ matrix.python-version }}" },
      },
      { name: "Install dependencies", run: "pip install -e .[dev]" },
      { name: "Run linting", run: "ruff check" },
      { name: "Run type checking", run: "mypy ." },
      { name: "Run tests", run: "pytest --cov --cov-report=xml" },
      { name: "Generate test coverage", run: "arbiter tests cover --junit coverage.xml" },
    ],
  };
}

function createRustJob(matrix?: BuildMatrix) {
  return {
    name: "Test rust",
    "runs-on": "${{ matrix.os }}",
    strategy: {
      matrix: {
        os: matrix?.os || ["ubuntu-latest", "macos-latest", "windows-latest"],
        "rust-version": matrix?.versions || ["stable", "beta"],
      },
    },
    steps: [
      { name: "Checkout code", uses: "actions/checkout@v4" },
      {
        name: "Setup Rust",
        uses: "dtolnay/rust-toolchain@stable",
        with: { toolchain: "${{ matrix.rust-version }}" },
      },
      {
        name: "Cache dependencies",
        uses: "actions/cache@v4",
        with: {
          path: "target",
          key: "${{ runner.os }}-cargo-${{ hashFiles('Cargo.lock') }}",
        },
      },
      { name: "Run clippy", run: "cargo clippy -- -D warnings" },
      { name: "Run tests", run: "cargo test" },
      { name: "Generate test coverage", run: "arbiter tests cover --junit coverage.xml" },
    ],
  };
}

function createGoJob(matrix?: BuildMatrix) {
  return {
    name: "Test go",
    "runs-on": "${{ matrix.os }}",
    strategy: {
      matrix: {
        os: matrix?.os || ["ubuntu-latest", "macos-latest", "windows-latest"],
        "go-version": matrix?.versions || ["1.21", "1.22"],
      },
    },
    steps: [
      { name: "Checkout code", uses: "actions/checkout@v4" },
      {
        name: "Setup Go",
        uses: "actions/setup-go@v5",
        with: { "go-version": "${{ matrix.go-version }}" },
      },
      { name: "Run linting", uses: "golangci/golangci-lint-action@v4" },
      { name: "Run tests", run: "go test -v -race -coverprofile=coverage.out ./..." },
      { name: "Generate test coverage", run: "arbiter tests cover --junit coverage.xml" },
    ],
  };
}

const PM_INSTALL_COMMANDS: Record<string, string> = {
  npm: "npm ci",
  pnpm: "pnpm install --frozen-lockfile",
  yarn: "yarn install --frozen-lockfile",
};

function installCommand(pm: PackageManagerCommandSet): string {
  return PM_INSTALL_COMMANDS[pm.name] ?? pm.install;
}

function publishCommand(pm: PackageManagerCommandSet): string {
  return pm.name === "npm" ? "npm publish" : `${pm.name} publish`;
}

const NODE_CACHE_KEYS: Record<string, "npm" | "pnpm" | "yarn"> = {
  npm: "npm",
  pnpm: "pnpm",
  yarn: "yarn",
};

function getNodeCacheKey(pm: PackageManagerCommandSet): "npm" | "pnpm" | "yarn" | undefined {
  return NODE_CACHE_KEYS[pm.name];
}

function createSecurityJob() {
  return {
    name: "Security Scan",
    "runs-on": "ubuntu-latest",
    steps: [
      { name: "Checkout code", uses: "actions/checkout@v4" },
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
        with: { sarif_file: "trivy-results.sarif" },
      },
    ],
  };
}
