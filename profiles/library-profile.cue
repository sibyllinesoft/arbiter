// Library artifact profile
// Enforces API-surface stability, semver policy, and cross-version build matrix

package profiles

// Library profile definition extending the core profile
LibraryProfile: {
  // Semantic versioning enforcement  
  semver: "strict" | "minor" | "none"
  
  // API surface tracking
  apiSurface: {
    source: "generated" | "declared"
    file?: string
    extractors: {
      typescript: {
        tool: "api-extractor"
        config: "./api-extractor.json"
        output: "./dist/api-surface.json"
      }
      go: {
        tool: "go-api-extractor" 
        pattern: "./..."
        output: "./api-surface.json"
      }
    }
  }
  
  // Breaking change detection and contracts
  contracts: {
    forbidBreaking: bool
    invariants: [...string]
    
    // Version bump requirements
    versionRules: {
      breaking: "major"
      addition: "minor" 
      bugfix: "patch"
    }
    
    // Cross-version compatibility matrix
    compatibilityMatrix: {
      backwards: int // how many major versions back to support
      forwards: bool // forward compatibility required
    }
  }
  
  // Property tests for library invariants
  propertyTests: [...{
    name: string
    description: string
    property: string // CUE expression
    examples: [..._]
  }]
  
  // Build matrix for libraries
  buildMatrix: {
    nodeVersions?: [...string]
    goVersions?: [...string]  
    rustVersions?: [...string]
    pythonVersions?: [...string]
  }
}

// Example library configuration
ExampleLibrary: LibraryProfile & {
  semver: "strict"
  apiSurface: {
    source: "generated"
    file: "./dist/api-surface.json"
  }
  contracts: {
    forbidBreaking: true
    invariants: [
      "apiSurface.exports != null",
      "len(apiSurface.exports) > 0",
      "apiSurface.breaking_changes == null"
    ]
    versionRules: {
      breaking: "major"
      addition: "minor"
      bugfix: "patch" 
    }
    compatibilityMatrix: {
      backwards: 2
      forwards: false
    }
  }
  propertyTests: [
    {
      name: "export_consistency"
      description: "All exports must be consistently typed"
      property: "all_exports_have_types"
      examples: ["function", "class", "interface", "type"]
    }
  ]
  buildMatrix: {
    nodeVersions: ["18", "20", "22"]
  }
}