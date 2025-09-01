// CLI artifact profile  
// Enforces typed command tree, argument/flag schema, exit codes, and golden I/O tests

package profiles

// CLI profile definition
CLIProfile: {
  // Command structure specification
  commands: [...{
    name: string
    summary: string
    description?: string
    
    // Positional arguments
    args: [...{
      name: string
      type: "str" | "int" | "file" | "enum" | "bool"
      required: bool
      description?: string
      validation?: string // regex or CUE constraint
    }]
    
    // Named flags/options
    flags: [...{
      name: string
      short?: string // single character alias
      type: "str" | "int" | "bool" | "file" | "enum"
      default?: _
      required?: bool
      repeatable?: bool
      description?: string
      validation?: string
    }]
    
    // Exit codes and meanings
    exits: [...{
      code: int
      meaning: string
      description?: string
    }]
    
    // Input/Output specification
    io: {
      in?: "none" | "stdin" | "file" | "json" | "yaml"
      out?: "stdout" | "file" | "json" | "yaml" | "table" 
      err?: "stderr" | "file"
      schema?: string // path to JSON schema
    }
    
    // Subcommands (for nested CLI structures)
    subcommands?: [...CLICommand]
  }]
  
  // Test specifications
  tests: {
    // Golden file tests (expected output)
    golden: [...{
      name?: string
      cmd: string
      in?: string
      wantOut?: string
      wantRE?: string // regex match
      wantCode?: int
      wantErr?: string
      timeout?: string
    }]
    
    // Property-based tests
    property: [...{
      name: string
      description?: string
      cue: string // CUE property assertion
    }]
    
    // Interactive tests
    interactive?: [...{
      name: string
      script: string // expect script
      timeout?: string
    }]
  }
  
  // CLI metadata
  metadata: {
    version: string
    author?: string
    license?: string
    homepage?: string
    description?: string
  }
  
  // Shell completion support
  completion: {
    bash?: bool
    zsh?: bool
    fish?: bool
    powershell?: bool
  }
  
  // Installation methods
  installation: {
    npm?: bool
    binary?: bool
    homebrew?: bool
    docker?: bool
  }
}

// Example CLI configuration for Arbiter CLI
ArbiterCLI: CLIProfile & {
  commands: [
    {
      name: "import"
      summary: "Import project into Arbiter"
      description: "Scan and analyze a project directory, creating Arbiter configuration"
      
      args: [{
        name: "project-path"
        type: "file"
        required: false
        description: "Path to project directory (default: current directory)"
        validation: "exists && is_directory"
      }]
      
      flags: [
        {
          name: "name"
          short: "n"
          type: "str"
          description: "Override project name"
        },
        {
          name: "template"
          short: "t"
          type: "enum"
          default: "auto"
          description: "Project template type"
          validation: "library|cli|service|job|auto"
        },
        {
          name: "force"
          short: "f"
          type: "bool"
          default: false
          description: "Overwrite existing configuration"
        }
      ]
      
      exits: [
        {code: 0, meaning: "success", description: "Project imported successfully"},
        {code: 1, meaning: "import failed", description: "Failed to import project"},
        {code: 2, meaning: "invalid arguments", description: "Invalid command arguments"}
      ]
      
      io: {
        in: "none"
        out: "stdout"
        schema: "./schemas/import-result.json"
      }
    },
    
    {
      name: "generate"
      summary: "Generate baseline CUE files"
      description: "Create Arbiter configuration files from templates"
      
      flags: [
        {
          name: "template"
          short: "t"
          type: "enum"
          default: "library"
          description: "Artifact template type"
          validation: "library|cli|service|job"
        },
        {
          name: "force"
          short: "f"
          type: "bool"
          default: false
          description: "Overwrite existing files"
        }
      ]
      
      exits: [
        {code: 0, meaning: "success"},
        {code: 1, meaning: "generation failed"}
      ]
      
      io: {
        in: "none"
        out: "stdout"
      }
    },
    
    {
      name: "check"
      summary: "Validate CUE files"
      description: "Validate Arbiter configuration and run profile-specific checks"
      
      flags: [
        {
          name: "verbose"
          short: "v"
          type: "bool"
          default: false
          description: "Verbose output with detailed errors"
        },
        {
          name: "format"
          short: "f"
          type: "enum"
          default: "table"
          description: "Output format"
          validation: "table|json|yaml"
        }
      ]
      
      exits: [
        {code: 0, meaning: "validation passed"},
        {code: 1, meaning: "validation failed"}
      ]
      
      io: {
        in: "file"
        out: "stdout"
        schema: "./schemas/validation-result.json"
      }
    }
  ]
  
  tests: {
    golden: [
      {
        name: "import_help"
        cmd: "arbiter import --help"
        wantOut: "*Import project into Arbiter*"
        wantCode: 0
      },
      {
        name: "generate_library"
        cmd: "arbiter generate --template library"
        wantRE: ".*Created arbiter.assembly.cue.*"
        wantCode: 0
      },
      {
        name: "invalid_template"
        cmd: "arbiter generate --template invalid"
        wantCode: 2
        wantErr: "*invalid template*"
      }
    ]
    
    property: [
      {
        name: "help_commands_exit_zero"
        description: "All --help commands should exit with code 0"
        cue: "all(commands, cmd => cmd.help_exit_code == 0)"
      },
      {
        name: "required_args_validated"
        description: "Required arguments must be validated"
        cue: "all(commands, cmd => all(cmd.args, arg => arg.required => arg.validation != null))"
      }
    ]
  }
  
  metadata: {
    version: "0.1.0"
    author: "Nathan Rice"
    license: "MIT" 
    description: "Arbiter CLI for CUE validation and management"
  }
  
  completion: {
    bash: true
    zsh: true
    fish: false
    powershell: false
  }
  
  installation: {
    npm: true
    binary: true
    homebrew: false
    docker: false
  }
}