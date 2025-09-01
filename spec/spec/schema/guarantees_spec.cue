package schema

import "strings"

// Guarantees/Contracts Specification for Arbiter Assembly
// Defines contract-driven development with pre/post conditions, meta-properties,
// metamorphic laws, resource budgets, fault injection, and test scenarios

#GuaranteesSpec: {
  // Contract definitions that force correctness
  contracts?: #ContractSet
  
  // Test scenarios derived from contracts
  scenarios?: [...#TestScenario]
  
  // Coverage requirements
  coverage?: #CoverageRequirements
}

// ---------- Contract System ----------

#ContractSet: {
  // Preconditions: what must be true before execution
  pre: [...#Condition] 
  
  // Postconditions: what must be true after execution  
  post: [...#Condition]
  
  // Meta-properties: system-wide behavioral guarantees
  meta: [...#MetaProperty]
  
  // Metamorphic laws: relations between different executions
  laws: [...#MetamorphicLaw]
  
  // Resource budgets: quantified performance constraints
  resources: #ResourceBudgets
  
  // Fault injection: failure modes and expected behaviors
  faults: [...#FaultInjection]
}

#Condition: {
  name: string & strings.MinRunes(3) & strings.MaxRunes(100)
  cue: string & strings.MinRunes(1)  // CUE expression that must evaluate to true
  description?: string
  category?: "input" | "output" | "state" | "config" | "env"
  critical?: bool  // whether violation should fail immediately vs warn
}

#MetaProperty: {
  name: string & strings.MinRunes(3) & strings.MaxRunes(100)
  cue: string & strings.MinRunes(1)   // CUE expression for the property
  type: "idempotent" | "deterministic" | "monotonic" | "commutative" | "associative" | "functional" | "pure" | string
  description?: string
  examples?: [...string]  // example scenarios demonstrating the property
}

#MetamorphicLaw: {
  name: string & strings.MinRunes(3) & strings.MaxRunes(100)
  relation: string & strings.MinRunes(1)  // relationship expression between executions
  type: "equivalence" | "ordering" | "transformation" | "invariant" | string
  description?: string
  // Examples: "f(x) + f(y) = f(x+y)", "sort(sort(x)) = sort(x)"
  examples?: [...string]
}

#ResourceBudgets: {
  // CPU time budget in milliseconds
  cpu_ms: int & >=0 & <=3600000  // max 1 hour
  
  // Memory budget in megabytes  
  mem_mb: int & >=0 & <=32768    // max 32GB
  
  // Wall clock time budget in milliseconds
  wall_ms: int & >=0 & <=3600000 // max 1 hour
  
  // Optional additional resource constraints
  disk_mb?: int & >=0
  network_kb?: int & >=0
  file_handles?: int & >=0 & <=65536
}

#FaultInjection: {
  name: string & strings.MinRunes(3) & strings.MaxRunes(100)
  inject: string & strings.MinRunes(1)   // what fault to inject (CUE or command)
  expect: string & strings.MinRunes(1)   // expected system response (CUE expression)
  type: "network" | "disk" | "memory" | "cpu" | "timeout" | "corruption" | "unavailable" | string
  severity: "critical" | "major" | "minor" | "info"
  description?: string
  recovery?: string  // expected recovery behavior
}

// ---------- Test Scenarios ----------

#TestScenario: {
  id: string & =~"^[a-z0-9][a-z0-9-]*[a-z0-9]$"  // kebab-case identifier
  title: string & strings.MinRunes(10) & strings.MaxRunes(200)
  
  // Three-phase test structure
  arrange: string & strings.MinRunes(1)     // setup (CUE expression or command)
  act: string & strings.MinRunes(1)         // action (CUE expression or command)  
  assert: [...string] & minItems(1)         // assertions (CUE expressions)
  
  // Test classification
  priority: "p0" | "p1" | "p2"  // p0=critical, p1=important, p2=nice-to-have
  type?: "unit" | "integration" | "e2e" | "property" | "scenario" | "fault"
  
  // Test execution context
  timeout?: int & >0 & <=3600000  // timeout in milliseconds
  retries?: int & >=0 & <=10
  parallel?: bool                 // can run in parallel with other tests
  
  // Dependencies and requirements
  requires?: [...string]          // prerequisite scenario IDs
  tags?: [...string]             // arbitrary tags for filtering
  
  // Documentation
  description?: string
  rationale?: string             // why this test is necessary
  references?: [...string]       // links to specs, issues, etc.
}

// ---------- Coverage Requirements ----------

#CoverageRequirements: {
  // Contract coverage thresholds
  contract: #CoverageThresholds
  
  // Scenario coverage thresholds  
  scenario: #CoverageThresholds
  
  // Code coverage requirements (if applicable)
  code?: #CodeCoverageThresholds
  
  // Fault coverage requirements
  fault?: #FaultCoverageThresholds
}

#CoverageThresholds: {
  minimum: #Percent01    // minimum required coverage to pass
  target: #Percent01     // target coverage for quality gates
  critical: #Percent01   // coverage required for critical paths
}

#CodeCoverageThresholds: {
  line: #CoverageThresholds
  branch: #CoverageThresholds  
  function: #CoverageThresholds
  statement: #CoverageThresholds
}

#FaultCoverageThresholds: {
  injection: #CoverageThresholds   // how many fault scenarios were tested
  recovery: #CoverageThresholds    // how many recovery paths were verified
  resilience: #CoverageThresholds  // how many resilience patterns were confirmed
}

// ---------- Contract Derivations ----------

// Property tests can be derived from contracts
#PropertyTestDerivation: {
  from: "pre" | "post" | "meta" | "laws"
  method: "quickcheck" | "hypothesis" | "proptest" | "jsverify" | string
  generators?: #DataGenerators
  iterations?: int & >0 & <=10000
  shrinking?: bool
}

#DataGenerators: {
  [name=string]: {
    type: "int" | "string" | "bool" | "array" | "object" | "enum" | string
    constraints?: _   // type-specific constraints
    examples?: [..._] // seed examples
  }
}

// Scenario tests can be black-box tests
#ScenarioTestDerivation: {
  framework: "playwright" | "pytest" | "vitest" | "jest" | "go-test" | string
  environment?: "local" | "docker" | "k8s" | "cloud" | string
  fixtures?: [...string]  // test fixtures or data files needed
}

// Fault injection tests derived from fault specifications  
#FaultTestDerivation: {
  tool: "chaos-monkey" | "pumba" | "toxiproxy" | "litmus" | string
  scope: "process" | "container" | "network" | "disk" | "system" | string
  duration?: string & =~"^[0-9]+[smh]$"  // fault duration
}

// Budget checks as CI gates
#BudgetCheckDerivation: {
  tool: "time" | "perf" | "valgrind" | "hyperfine" | "criterion" | string
  baseline?: #ResourceBudgets  // baseline measurements for comparison
  tolerance?: #Percent01       // acceptable variance from budget
}

// ---------- Integration with Artifact Profiles ----------

// Extend existing profiles with guarantees
#LibraryProfileWithGuarantees: #LibraryProfile & {
  guarantees?: #GuaranteesSpec
}

#CLIProfileWithGuarantees: #CLIProfile & {  
  guarantees?: #GuaranteesSpec
}

#ServiceProfileWithGuarantees: #ServiceProfile & {
  guarantees?: #GuaranteesSpec
}

#JobProfileWithGuarantees: #JobProfile & {
  guarantees?: #GuaranteesSpec
}

// ---------- Validation Rules ----------

// Ensure contract consistency
#ContractValidation: {
  // All referenced CUE expressions must be valid
  cue_syntax_valid: true
  
  // Preconditions should not contradict postconditions  
  pre_post_consistent: true
  
  // Resource budgets should be realistic
  budgets_realistic: true
  
  // Fault injection should have recovery expectations
  faults_have_recovery: true
  
  // Scenarios should cover all critical contracts
  scenarios_cover_contracts: true
}

// Quality gates for contract-driven development
#QualityGates: {
  all_contracts_true: bool       // all contract conditions pass
  budgets_respected: bool        // resource usage within budgets  
  coverage_above_threshold: bool // coverage meets minimum requirements
  fault_tolerance_verified: bool // fault injection tests pass
  scenarios_pass: bool          // all scenario tests pass
}

// Helper constraints (reused from artifact_spec.cue pattern)
minItems(n: int): { _hiddenMinItems: n }