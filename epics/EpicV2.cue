package epics

// Epic v2 schema for agent-first, deterministic code generation
// This schema transforms epics from labels into executable contracts
// that agents can use for autonomous, deterministic, and idempotent operations.

#Epic: {
	// Core identification and ownership
	id: =~"^EPIC-[A-Z0-9-]+$"
	title: string & !=""
	owners: [...string] & minItems(1)

	// Where code will go - absolute or repo-relative globs
	targets: [...{
		root: string & !=""                    // base directory for this target
		include: [...string] & minItems(1)     // file patterns to include
		exclude: [...string]                   // file patterns to exclude
	}] & minItems(1)

	// What to generate, precisely and deterministically
	generate: [...{
		path: string & !=""                    // file to create or update
		mode: *"create" | "patch"              // patch uses anchors/markers
		template: string & !=""                // inline or reference (e.g., templates/name.cue.t)
		data: _                                // values to hydrate template
		guards: [...string]                    // patterns that must NOT already exist
	}]

	// Compile-time and runtime contracts that must hold
	contracts: {
		types: [...string]                     // CUE expressions that must evaluate
		invariants: [...string]               // human-readable + machine check (CUE bools)
	}

	// Tests the agent can run end-to-end
	tests: {
		// Static analysis - analyze() must be non-bottom
		static: [...{
			selector: string & !=""            // file or pattern to analyze
		}]

		// Property tests - CUE expressions that must evaluate to true
		property: [...{
			name: string & !=""                // descriptive test name
			cue: string & !=""                 // CUE expression that must be true
		}]

		// Golden file tests - compare outputs against expected
		golden: [...{
			input: string & !=""               // input file or pattern
			want: string & !=""                // expected output file
		}]

		// CLI tests - black box command execution
		cli: [...{
			cmd: string & !=""                 // command to execute
			expectExit: *0 | int              // expected exit code (default 0)
			expectRE?: string                 // regex pattern for stdout
		}]
	}

	// Rollout/migration instructions (machine-scorable)
	rollout: {
		steps: [...string]                     // human-readable rollout steps
		gates: [...{                           // automated validation gates
			name: string & !=""                // gate description
			cue: string & !=""                 // CUE expression that must evaluate to true
		}]
	}

	// Hints to help agents decide granularity and approach
	heuristics: {
		preferSmallPRs: *true | false          // break into small changes when possible
		maxFilesPerPR: *10 | int & >0         // maximum files to change per PR
	}

	// Optional metadata for tracking and organization
	metadata?: {
		created?: string                       // ISO datetime
		updated?: string                       // ISO datetime
		version?: string                       // semantic version
		tags?: [...string]                     // classification tags
		priority?: "low" | "medium" | "high" | "critical"
		complexity?: int & >=1 & <=10          // complexity score 1-10
	}
}

// Template data structure for hydrating generators
#TemplateData: {
	// Common template variables
	name?: string          // component/service name
	namespace?: string     // namespace or module
	version?: string       // version identifier
	author?: string        // creator
	timestamp?: string     // generation timestamp

	// Extensible for specific template needs
	...
}

// File operation guards to prevent conflicts
#Guard: {
	pattern: string & !=""     // regex pattern to check against existing content
	message: string & !=""     // error message if guard fails
}

// Test result structure for scoring
#TestResult: {
	name: string
	passed: bool
	duration?: int          // milliseconds
	error?: string         // error message if failed
	details?: _            // additional test-specific data
}

// Epic execution summary
#ExecutionSummary: {
	epicId: string
	timestamp: string
	filesChanged: int
	testsRun: int
	testsPassed: int
	contractsChecked: int
	contractsPassed: int
	rolloutGatesChecked: int
	rolloutGatesPassed: int
	overallSuccess: bool
	duration: int          // total execution time in milliseconds
	results: [...#TestResult]
}

// Validation constraints to ensure epic integrity
#Epic & {
	// Ensure at least one generation target
	generate: minItems(1)

	// If using patch mode, must have guards to prevent conflicts
	if list.Contains([for g in generate {g.mode}], "patch") {
		generate: [for g in generate if g.mode == "patch" {
			guards: minItems(1)
			...
		}]
	}

	// Rollout gates must have corresponding steps
	if rollout.gates != _|_ && len(rollout.gates) > 0 {
		rollout.steps: minItems(1)
	}
}