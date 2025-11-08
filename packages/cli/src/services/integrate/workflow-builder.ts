import type { BuildMatrix, ProjectLanguage } from "./types.js";

export function createGitHubPullRequestWorkflow(
  languages: ProjectLanguage[],
  matrix?: BuildMatrix,
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
          { name: "Setup Arbiter CLI", run: "npm install -g @arbiter/cli" },
          { name: "Validate CUE files", run: "arbiter check --format json" },
          {
            name: "Generate API surface",
            run: `arbiter surface ${languages[0]?.name || "typescript"} --output surface.json`,
          },
        ],
      },
    },
  };

  for (const lang of languages) {
    switch (lang.name) {
      case "typescript":
        workflow.jobs[`test-${lang.name}`] = createNodeJob(matrix);
        break;
      case "python":
        workflow.jobs[`test-${lang.name}`] = createPythonJob(matrix);
        break;
      case "rust":
        workflow.jobs[`test-${lang.name}`] = createRustJob(matrix);
        break;
      case "go":
        workflow.jobs[`test-${lang.name}`] = createGoJob(matrix);
        break;
    }
  }

  workflow.jobs.security = createSecurityJob();
  return workflow;
}

export function createGitHubMainWorkflow(
  languages: ProjectLanguage[],
  _matrix?: BuildMatrix,
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
          { name: "Install deps", run: "npm install" },
          { name: "Test", run: "npm test" },
        ],
      },
      release: {
        name: "Release",
        needs: "test",
        "runs-on": "ubuntu-latest",
        steps: [
          { name: "Checkout", uses: "actions/checkout@v4" },
          { name: "Setup Node.js", uses: "actions/setup-node@v4", with: { "node-version": "20" } },
          { name: "Publish", run: "npm publish" },
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

function createNodeJob(matrix?: BuildMatrix) {
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
        with: { "node-version": "${{ matrix.node-version }}", cache: "npm" },
      },
      { name: "Install dependencies", run: "npm ci" },
      { name: "Run type checking", run: "npm run type-check" },
      { name: "Run linting", run: "npm run lint" },
      { name: "Run tests", run: "npm test" },
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
