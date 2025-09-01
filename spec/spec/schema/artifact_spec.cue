package schema

import "strings"

// Artifact Profile Schema for Arbiter Assembly
// Defines build/test contracts for different artifact types: service | library | cli | job

#ArtifactSpec: {
  // Core artifact definition
  artifact?: #Artifact

  // Profile-specific configurations  
  profiles?: #Profiles
}

#Artifact: {
  kind: "library" | "cli" | "service" | "job"
  language: "go" | "ts" | "rust" | "python" | string
  build: #BuildConfig
  packaging?: #PackagingConfig
}

#BuildConfig: {
  tool: "go" | "bun" | "cargo" | "uv" | string
  targets: [...string] & minItems(1)  // e.g., ./..., packages/*
  matrix?: {
    versions?: [...string]  // e.g., ["18", "20", "22"] for Node.js
    os?: [...string]        // e.g., ["ubuntu", "windows", "macos"]  
    arch?: [...string]      // e.g., ["x64", "arm64"]
  }
}

#PackagingConfig: {
  publish: bool
  registry?: string  // e.g., "npm", "crates.io", "pkg.go.dev"
  artifact?: "tar" | "wheel" | "crate" | "npm" | string
}

#Profiles: {
  library?: #LibraryProfile
  cli?: #CLIProfile
  service?: #ServiceProfile
  job?: #JobProfile
}

// Library Profile: enforce API-surface stability, semver policy, property tests
#LibraryProfile: {
  semver: "strict" | "minor" | "none"
  apiSurface: {
    source: "generated" | "declared"  // generated from code or manually declared
    file?: string  // path to API surface JSON file if declared
  }
  contracts: {
    forbidBreaking: bool  // if true, breaking diff fails unless epic declares MAJOR
    invariants: [...string]  // CUE boolean assertions over surface.json
  }
}

// CLI Profile: enforce typed command tree, argument/flag schema, golden I/O tests
#CLIProfile: {
  commands: [...#CLICommand] & minItems(1)
  tests: #CLITests
}

#CLICommand: {
  name: string & =~"^[a-z][a-z0-9-]*$"  // kebab-case command names
  summary: string & strings.MinRunes(10) // at least 10 chars for help text
  args: [...#CLIArg]
  flags: [...#CLIFlag] 
  exits: [...#ExitCode] & minItems(1)
  io: #IOContract
}

#CLIArg: {
  name: string & =~"^[a-z][a-zA-Z0-9]*$"  // camelCase arg names
  type: "str" | "int" | "file" | "enum" | string
  required: bool
  description?: string
  enum?: [...string]  // valid values if type is "enum"
}

#CLIFlag: {
  name: string & =~"^[a-z][a-zA-Z0-9-]*$"  // kebab-case flag names
  short?: string & =~"^[a-zA-Z]$"  // single char short flag
  type: "str" | "int" | "bool" | "file" | "enum" | string
  default?: _
  repeatable?: bool
  description?: string
  enum?: [...string]  // valid values if type is "enum"
}

#ExitCode: {
  code: int & >=0 & <=255
  meaning: string & strings.MinRunes(5)  // describe what this exit code means
}

#IOContract: {
  in?: "none" | "stdin" | "file" | "json" | string
  out?: "stdout" | "file" | "json" | string
  schema?: string  // JSON schema for structured I/O
}

#CLITests: {
  golden: [...#GoldenTest]
  property: [...#PropertyTest]
}

#GoldenTest: {
  name?: string  // test name for reporting
  cmd: string    // command line to execute
  in?: string    // stdin content or file path
  wantOut?: string  // expected stdout (exact match)
  wantRE?: string   // expected stdout (regex match)  
  wantCode?: int & >=0 & <=255  // expected exit code, defaults to 0
  timeout?: int & >0  // timeout in milliseconds, defaults to 30000
}

#PropertyTest: {
  name: string & =~"^[A-Z][a-zA-Z0-9 ]*$"  // descriptive test name
  cue: string  // CUE expression that must evaluate to true
}

// Service Profile: traditional service deployment (kept for compatibility)
#ServiceProfile: {
  ports?: [...{
    name: string
    port: int & >0 & <=65535
    protocol?: "http" | "grpc" | "tcp" | "udp"
  }]
  healthCheck?: {
    path?: string
    port?: int & >0 & <=65535
    interval?: int & >0  // seconds
  }
}

// Job Profile: enforce deterministic batch runs, resource caps
#JobProfile: {
  resources: #ResourceLimits
  ioContracts: #JobIOContracts
  runtime?: #JobRuntime
}

#ResourceLimits: {
  cpu: string & =~"^[0-9.]+m?$"      // e.g., "100m", "2", "1.5"
  mem: string & =~"^[0-9.]+[KMGT]?i?B?$"  // e.g., "512Mi", "1GB", "2GiB"
  wall: string & =~"^[0-9]+[smh]$"   // e.g., "30s", "5m", "2h"
}

#JobIOContracts: {
  reads: [...string]   // glob patterns for files the job may read
  writes: [...string]  // glob patterns for files the job may write
  net: bool  // whether job needs network access
}

#JobRuntime: {
  idempotent?: bool  // whether re-running produces same result
  deterministic?: bool  // whether same input always produces same output
  batchSize?: int & >0  // for batch processing jobs
}

// Helper constraints
minItems(n: int): { _hiddenMinItems: n }