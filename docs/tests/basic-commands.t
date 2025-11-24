Basic CLI Commands
==================

Set up arbiter command alias (use absolute path):

  $ ARBITER="node /home/nathan/Projects/arbiter/packages/cli/dist/cli.js"

Test arbiter help output:

  $ $ARBITER --help
  Usage: arbiter [options] [command]
  
  Arbiter CLI for CUE validation and management
  
  Options:
    -V, --version                         output the version number
    -c, --config <path>                   path to configuration file
    --no-color                            disable colored output
    --api-url <url>                       API server URL
    --arbiter-url <url>                   Arbiter server URL (alias for
                                          --api-url)
    --timeout <ms>                        request timeout in milliseconds
    --local                               operate in offline mode using local CUE
                                          files only
    -v, --verbose                         enable verbose logging globally
    -h, --help                            display help for command
  
  Commands:
    init [options] [display-name]         initialize a new CUE project with
                                          templates or presets
    watch [options] [path]                cross-platform file watcher with live
                                          validation and planning
    surface [options] <language>          extract API surface from source code
                                          and generate project-specific surface
                                          file
    spec-import [options] [cue-file]      import a local CUE spec fragment into
                                          the Arbiter service
    check [options] [patterns...]         validate CUE files in the current
                                          directory
    list [options] <type>                 list components of a specific type in
                                          the project
    status [options]                      show project status overview
    diff [options] <old-file> <new-file>  compare two CUE schemas and analyze
                                          changes
    health [options]                      comprehensive Arbiter server health
                                          check
    add                                   incrementally build CUE specifications
                                          with modular generators
    remove                                remove components from the project
                                          specification
    version                               semver-aware version planning and
                                          release management
    generate [options] [spec-name]        generate project files from stored
                                          specifications
    docs                                  generate documentation from CUE schemas
                                          and API surfaces
    examples [options] <type>             generate example projects by profile or
                                          language type
    execute [options] <epic>              execute Arbiter epics for
                                          deterministic, agent-first code
                                          generation
    explain [options]                     generate plain-English summary of
                                          project specifications
    rename [options]                      migrate existing files to
                                          project-specific naming
    sync [options]                        synchronize project manifests
                                          (package.json, pyproject.toml, etc.)
                                          with Arbiter
    integrate [options]                   generate CI/CD workflows with contract
                                          coverage and quality gates
    github-templates [options]            manage GitHub issue templates
                                          configuration
    import                                manage trusted import registry for CUE
                                          files
    tests                                 test management, scaffolding, and
                                          coverage analysis
    auth [options]                        Authenticate the Arbiter CLI using
                                          OAuth
    plan                                  Interactive feature planning assistant
                                          for AI agents
    design                                Interactive technical design assistant
                                          for AI agents
    help [command]                        display help for command
  
  Arbiter CLI - Agent-Friendly Specification Management
  
  Core Workflows:
  
    1. FEATURE PLANNING (AI-Assisted):
      arbiter plan                         # Interactive feature planning prompt
      arbiter design                       # Detailed technical design (after plan)
  
    2. SPEC FRAGMENT MANAGEMENT (Git-Style):
      arbiter init my-app --schema=app     # Initialize with app-centric schema
      arbiter add service billing          # Add service specification
      arbiter add api/order                # Add API endpoint specification
      arbiter add flow checkout            # Add user flow specification
      arbiter generate                     # Generate code from specifications
  
    3. VALIDATION & FEEDBACK:
      arbiter check                        # Validate all specifications
      arbiter watch                        # Watch mode with live validation
  
    4. RELEASE MANAGEMENT:
      arbiter version plan                 # Plan version changes
      arbiter integrate                    # Generate CI/CD workflows
  
  Schema Formats:
    app: Complete application modeling
  
  Agent-Friendly Features:
    \xe2\x80\xa2 Non-interactive commands (no prompts) (esc)
    \xe2\x80\xa2 Structured JSON output (--format=json) (esc)
    \xe2\x80\xa2 Exit codes: 0=success, 1=error, 2=config (esc)
    \xe2\x80\xa2 NDJSON streaming (--ndjson-output) (esc)
  
  Examples:
    arbiter check **/*.cue --format=json  # Validate with JSON output
    arbiter surface app.py --output=cue   # Extract API surface from code
    arbiter health                        # Check server connectivity
  
  For detailed help: arbiter <command> --help
  

Test arbiter version:

  $ $ARBITER --version
  .* (re)

Test arbiter health (may fail if server not running):

  $ $ARBITER health || echo "Server not running (expected in CI)"
  .* (re)
  Server: http://localhost:5050
  Timeout: 10000ms (client caps requests at 10s)
  \xf0\x9f\x8f\xa5 Comprehensive health check... (esc)
  Server: http://localhost:5050
  Timeout: 10000ms (client caps requests at 10s)
  \xe2\x9c\x85 Server is healthy (esc)

Test init help:

  $ $ARBITER init --help
  Usage: arbiter init [options] [display-name]
  
  initialize a new CUE project with templates or presets
  
  Options:
    --schema <type>     schema type to use (app) (default: "app")
    --template <type>   template to use (basic, kubernetes, api)
    --preset <id>       preset to use (web-app, mobile-app, api-service,
                        microservice)
    --directory <path>  target directory to initialize (defaults to current
                        working directory)
    --force             overwrite target directory if it already exists
    --list-templates    list available templates
    --list-presets      list available presets
    -h, --help          display help for command

Test check help:

  $ $ARBITER check --help
  Usage: arbiter check [options] [patterns...]
  
  validate CUE files in the current directory
  
  Options:
    -f, --format <format>  output format (table, json) (default: "table")
    -w, --watch            watch for file changes and re-validate (deprecated:
                           use "arbiter watch")
    -h, --help             display help for command

Test plan command:

  $ $ARBITER plan 2>&1 | head -3
  
  === Feature Planning Assistant Prompt ===
  

Test design command:

  $ $ARBITER design 2>&1 | head -3
  
  === Technical Design Assistant Prompt ===
  

Test add help:

  $ $ARBITER add --help
  .*add.* (re)
  
  incrementally build CUE specifications with modular generators
  
  Options:
    -h, --help                                           display help for command
  
  Commands:
    service [options] <name>                             add a service to the specification
    client [options] <name>                              add a client application to the specification
    contract [options] <name>                            add or update a contract workflow/event definition
    contract-operation [options] <contract> <operation>  add or update an operation on a contract workflow/event
    endpoint [options] <path>                            add an API endpoint to a service
    route [options] <path>                               add a UI route for frontend applications
    flow [options] <id>                                  add a user flow for testing and validation
    load-balancer [options]                              add a load balancer with health check invariants
    database [options] <name>                            add a database with automatic service attachment
    cache [options] <name>                               add a cache service with automatic attachment
    locator [options] <key>                              add a UI locator for testing
    schema [options] <name>                              add a schema for API documentation
    package [options] <name>                             add a reusable package/library (e.g. design systems, shared utilities)
    component [options] <name>                           add a UI component (e.g. buttons, forms, layout components)
    module [options] <name>                              add a standalone module (e.g. utilities, helpers, data models)
    epic                                                 manage epics and their tasks using sharded CUE storage
    task                                                 manage tasks within epics
    help [command]                                       display help for command

Test generate help:

  $ $ARBITER generate --help
  Usage: arbiter generate [options] [spec-name]
  
  generate project files from stored specifications
  
  Options:
    --project-dir <dir>  project directory to sync generated artifacts into
                         (defaults to current working directory or
                         config.projectDir)
    --spec <name>        use a specific stored specification
    --force              overwrite existing files despite validation warnings
    --dry-run            preview what would be generated without creating files
    --sync-github        sync generated epics and tasks to GitHub
    --github-dry-run     preview GitHub sync changes without applying them
    --verbose            enable verbose logging for generation flow
    -h, --help           display help for command

Test sync help:

  $ $ARBITER sync --help
  Usage: arbiter sync [options]
  
  synchronize project manifests (package.json, pyproject.toml, etc.) with Arbiter
  
  Options:
    --dry-run   preview changes without applying them
    --force     overwrite existing manifest entries
    --backup    create backup files before modification
    -h, --help  display help for command

Test integrate help:

  $ $ARBITER integrate --help
  Usage: arbiter integrate [options]
  
  generate CI/CD workflows with contract coverage and quality gates
  
  Options:
    --platform <platform>  CI platform: github, gitlab, azure, all (default:
                           "github")
    --provider <name>      CI provider: github, gitlab, azure, all (default:
                           "github")
    --type <type>          workflow target: pr, main, release, all (default:
                           "all")
    --output <dir>         directory for generated workflows (default:
                           ".github/workflows")
    --force                overwrite existing workflow files
    --dry-run              preview changes without applying them
    --templates            generate GitHub issue templates from configuration
    -h, --help             display help for command
