package valhalla

import (
	"time"
)

// Meta: System versioning and configuration
#Meta: {
	version:    string & =~"^v[0-9]+\\.[0-9]+\\.[0-9]+$"
	timestamp:  string & time.Format(time.RFC3339)
	cue_version: string
	arbiter_version: string
	task_id:    string & =~"^[a-zA-Z0-9_-]+$"
	
	// Execution context
	gitlab: {
		project_id: string
		merge_request_id?: string
		branch: string
		commit_sha?: string
	}
	
	// Trace correlation
	trace_id: string & =~"^[a-f0-9-]+$"
	parent_span_id?: string
}

// Brief: Codebase insight from Mimir (read-only analysis)
#Brief: {
	// Dependency analysis
	dependency_graph: {
		nodes: [...{
			id: string
			type: "module" | "class" | "function" | "file"
			path: string
			language: string
		}]
		edges: [...{
			from: string
			to: string
			type: "imports" | "calls" | "inherits" | "references"
			weight: number & >=0 & <=1.0
		}]
	}
	
	// Hotspots and risk areas
	hotspots: [...{
		path: string
		category: "complexity" | "churn" | "bugs" | "performance"
		score: number & >=0 & <=10.0
		evidence: [...string]
		last_modified: string & time.Format(time.RFC3339)
	}]
	
	// Prior changes analysis
	change_history: {
		recent_commits: [...{
			sha: string
			message: string
			author: string
			timestamp: string & time.Format(time.RFC3339)
			files_changed: [...string]
			additions: int & >=0
			deletions: int & >=0
		}]
		
		failure_patterns: [...{
			pattern_type: "test_flake" | "build_failure" | "deployment_issue"
			frequency: number & >=0
			affected_files: [...string]
			symptoms: [...string]
		}]
	}
	
	// Test coverage insights
	test_coverage: {
		overall_percentage: number & >=0 & <=100
		by_file: [...{
			path: string
			line_coverage: number & >=0 & <=100
			branch_coverage: number & >=0 & <=100
			missing_lines: [...int]
		}]
		
		flaky_tests: [...{
			test_name: string
			flake_rate: number & >=0 & <=1.0
			last_failure: string & time.Format(time.RFC3339)
		}]
	}
	
	// Architectural constraints
	architectural_constraints: {
		forbidden_patterns: [...string]
		required_patterns: [...string]
		style_guide_violations: [...{
			file: string
			line: int
			rule: string
			severity: "error" | "warning" | "info"
		}]
	}
}

// Spec: Acceptance criteria and requirements
#Spec: {
	// User story and requirements
	story: {
		title: string
		description: string
		acceptance_criteria: [...{
			id: string
			description: string
			type: "functional" | "non_functional" | "quality"
			priority: "must" | "should" | "could"
			testable: bool
		}]
	}
	
	// Failing tests (oracle)
	failing_tests: [...{
		name: string
		path: string
		framework: string
		error_message: string
		stack_trace?: string
		reproduction_steps: [...string]
		expected_behavior: string
		actual_behavior: string
	}]
	
	// Success criteria
	success_metrics: {
		pass_rate_threshold: number & >=0 & <=1.0
		performance_regression_limit: number & >=0 & <=0.1
		test_coverage_minimum: number & >=0 & <=100
		code_quality_threshold: number & >=0 & <=10
	}
	
	// Constraints and boundaries
	constraints: {
		max_files_changed: int & >0 & <=100
		max_lines_changed: int & >0 & <=10000
		breaking_changes_allowed: bool
		external_dependencies_allowed: bool
		
		// Risk limits
		risk_tolerance: "low" | "medium" | "high"
		rollback_plan_required: bool
	}
}

// Policy: Governance, budgets, and operational rules
#Policy: {
	// Budget allocation across stages
	budget: {
		total_usd: number & >0 & <=1000
		total_minutes: int & >0 & <=1440
		
		per_phase: {
			brief: {
				usd: number & >=0 & <=100
				minutes: int & >=0 & <=144
			}
			plan: {
				usd: number & >=0 & <=150
				minutes: int & >=0 & <=216
			}
			implementation: {
				usd: number & >=0 & <=500
				minutes: int & >=0 & <=720
			}
			review: {
				usd: number & >=0 & <=150
				minutes: int & >=0 & <=216
			}
			repair: {
				usd: number & >=0 & <=100
				minutes: int & >=0 & <=144
			}
		}
	}
	
	// Stopping rules and limits
	stopping: {
		max_attempts_per_phase: int & >0 & <=10
		max_candidate_patches: int & >0 & <=20
		
		// Circuit breakers
		consecutive_failures_limit: int & >0 & <=5
		flake_rate_threshold: number & >=0 & <=1.0
		cost_overrun_threshold: number & >=0 & <=2.0
		
		// Quality gates
		minimum_test_improvement: number & >=0 & <=1.0
		maximum_regression_tolerance: number & >=0 & <=0.1
	}
	
	// Edit primitives and constraints
	edit_primitives: {
		allowed_operations: [...("insert" | "delete" | "replace" | "move")]
		
		// Atomic edit constraints
		max_edit_distance: int & >0 & <=1000
		preserve_formatting: bool
		respect_syntax: bool
		
		// Safety constraints
		forbidden_patterns: [...string]
		required_approvals_for: [...string]
		
		// Rollback strategy
		checkpoint_frequency: int & >0 & <=10
		auto_rollback_triggers: [...string]
	}
	
	// Risk limits and safety
	risk_limits: {
		// Code changes
		max_cyclomatic_complexity_increase: int & >=0 & <=10
		max_coupling_increase: number & >=0 & <=0.5
		
		// Testing
		test_timeout_seconds: int & >0 & <=3600
		max_flaky_test_reruns: int & >0 & <=10
		
		// Performance
		memory_usage_limit_mb: int & >0 & <=8192
		execution_time_limit_multiplier: number & >0 & <=10.0
		
		// Security
		security_scan_required: bool
		vulnerability_threshold: "none" | "low" | "medium" | "high"
	}
	
	// Selection rubric for patch evaluation
	selection_rubric: {
		weights: {
			test_delta: number & >=0 & <=1.0
			locality: number & >=0 & <=1.0
			minimal_touch: number & >=0 & <=1.0
			code_quality: number & >=0 & <=1.0
			performance: number & >=0 & <=1.0
		}
		
		// Weights must sum to 1.0
		_weight_sum: weights.test_delta + weights.locality + 
			weights.minimal_touch + weights.code_quality + 
			weights.performance
		_weight_sum: 1.0
		
		// Scoring criteria
		criteria: {
			test_improvement: {
				excellent: number & >=0.9 & <=1.0
				good: number & >=0.7 & <0.9
				acceptable: number & >=0.5 & <0.7
				poor: number & >=0 & <0.5
			}
			
			code_locality: {
				single_file: number
				single_module: number
				multiple_modules: number
				cross_cutting: number
			}
		}
	}
}

// Rubric: Evaluation and quality metrics
#Rubric: {
	// Success metrics
	success_metrics: {
		// Primary metrics
		pass_at_1: number & >=0 & <=1.0
		pass_at_k: number & >=0 & <=1.0
		
		// Cost efficiency
		cost_per_success: number & >=0
		latency_seconds: number & >=0
		
		// Quality metrics
		flake_rate: number & >=0 & <=1.0
		revert_rate: number & >=0 & <=1.0
		spec_coverage: number & >=0 & <=1.0
		
		// Diff quality
		diff_minimality_score: number & >=0 & <=1.0
		logical_cohesion_score: number & >=0 & <=1.0
	}
	
	// Phase-specific metrics
	phase_metrics: {
		brief: {
			insight_accuracy: number & >=0 & <=1.0
			analysis_completeness: number & >=0 & <=1.0
			processing_time_seconds: number & >=0
		}
		
		plan: {
			strategy_diversity: number & >=0 & <=1.0
			feasibility_score: number & >=0 & <=1.0
			consensus_strength: number & >=0 & <=1.0
		}
		
		implementation: {
			candidate_quality_distribution: [...number]
			syntax_correctness_rate: number & >=0 & <=1.0
			test_passing_rate: number & >=0 & <=1.0
		}
		
		review: {
			selection_accuracy: number & >=0 & <=1.0
			false_positive_rate: number & >=0 & <=1.0
			review_consistency: number & >=0 & <=1.0
		}
		
		repair: {
			convergence_rate: number & >=0 & <=1.0
			edit_efficiency: number & >=0 & <=1.0
			quality_preservation: number & >=0 & <=1.0
		}
	}
	
	// Quality gates
	quality_gates: [...{
		name: string
		threshold: number
		actual: number
		passed: bool
		critical: bool
	}]
	
	// Benchmark comparison
	benchmark: {
		baseline_metrics: {
			swe_bench_score: number & >=0 & <=1.0
			code_contests_score: number & >=0 & <=1.0
			humaneval_score: number & >=0 & <=1.0
		}
		
		improvement_delta: {
			accuracy_improvement: number
			efficiency_improvement: number
			robustness_improvement: number
		}
	}
}

// Plan: Strategic approach and implementation planning (optional Conclave output)
#Plan: {
	enabled: bool
	
	if enabled {
		// High-level strategy
		strategy: {
			approach: "incremental" | "rewrite" | "refactor" | "patch" | "test_driven"
			rationale: string
			estimated_complexity: "low" | "medium" | "high"
			risk_assessment: "low" | "medium" | "high"
		}
		
		// Implementation phases
		phases: [...{
			id: string
			name: string
			description: string
			dependencies: [...string]
			estimated_effort: {
				hours: number & >=0
				complexity: number & >=1 & <=10
			}
			
			deliverables: [...{
				type: "code" | "tests" | "docs" | "config"
				files: [...string]
				description: string
			}]
			
			risks: [...{
				description: string
				probability: "low" | "medium" | "high"
				impact: "low" | "medium" | "high"
				mitigation: string
			}]
		}]
		
		// Target files and modifications
		target_files: [...{
			path: string
			modification_type: "create" | "modify" | "delete"
			estimated_lines_changed: int & >=0
			rationale: string
			dependencies: [...string]
		}]
		
		// Alternative strategies considered
		alternatives: [...{
			approach: string
			pros: [...string]
			cons: [...string]
			rejected_reason: string
		}]
		
		// Success criteria specific to this plan
		plan_success_criteria: [...{
			criterion: string
			measurement: string
			threshold: number | string
		}]
	}
}

// Conclave: Debate engine configuration and results
#Conclave: {
	// Configuration for debate sites
	config: {
		// Decision sites where Conclave can be invoked
		decision_sites: {
			plan_enabled: bool
			implementation_enabled: bool
			review_enabled: bool
			repair_enabled: bool
		}
		
		// Debate parameters
		debate_parameters: {
			width: int & >0 & <=10  // parallel agents
			depth: int & >0 & <=5   // debate rounds
			diversity: {
				prompts: [...string]  // different prompt strategies
				models: [...string]  // different model types
				temperatures: [...number]  // sampling diversity
			}
			
			// Adjudicator configuration
			adjudicator: {
				type: "majority" | "weighted" | "llm_judge" | "human"
				weights?: [...number]  // if weighted
				judge_model?: string   // if llm_judge
			}
		}
		
		// Gating logic - when to enable Conclave
		gating: {
			complexity_threshold: number & >=0 & <=10
			budget_threshold_usd: number & >=0
			confidence_threshold: number & >=0 & <=1.0
			
			// Predictors for enabling
			predictors: [...{
				name: string
				threshold: number
				weight: number & >=0 & <=1.0
			}]
		}
	}
	
	// Results from debate sessions
	results: [...{
		decision_site: "plan" | "implementation" | "review" | "repair"
		timestamp: string & time.Format(time.RFC3339)
		
		// Debate participants
		participants: [...{
			agent_id: string
			model: string
			prompt_strategy: string
			position: string
		}]
		
		// Debate rounds
		rounds: [...{
			round_number: int & >=1
			arguments: [...{
				agent_id: string
				position: string
				evidence: [...string]
				confidence: number & >=0 & <=1.0
			}]
			
			consensus_metrics: {
				agreement_score: number & >=0 & <=1.0
				position_distribution: [...number]
				confidence_variance: number & >=0
			}
		}]
		
		// Final decision
		decision: {
			chosen_option: string
			confidence: number & >=0 & <=1.0
			rationale: string
			dissenting_opinions: [...string]
		}
		
		// Metrics
		debate_metrics: {
			total_cost_usd: number & >=0
			total_time_seconds: number & >=0
			convergence_round: int & >=1
			consensus_strength: number & >=0 & <=1.0
		}
	}]
}

// Implementation: Code generation and patch management
#Implementation: {
	// Generated candidates
	candidates: [...{
		id: string
		timestamp: string & time.Format(time.RFC3339)
		
		// Code changes
		patch: {
			files: [...{
				path: string
				operation: "create" | "modify" | "delete"
				content?: string  // for create/modify
				diff?: string     // unified diff format
			}]
			
			// Patch metadata
			metadata: {
				lines_added: int & >=0
				lines_deleted: int & >=0
				files_changed: int & >=0
				estimated_complexity: number & >=1 & <=10
				
				// Safety checks
				syntax_valid: bool
				passes_linting: bool
				breaking_changes: bool
			}
		}
		
		// Test results
		test_results: {
			status: "passed" | "failed" | "timeout" | "error"
			
			// Detailed results
			total_tests: int & >=0
			passed_tests: int & >=0
			failed_tests: int & >=0
			skipped_tests: int & >=0
			flaky_tests: int & >=0
			
			// Performance impact
			execution_time_ms: int & >=0
			memory_usage_mb: number & >=0
			
			// Coverage changes
			coverage_delta: number & >=-1.0 & <=1.0
			
			// Failure details
			failures: [...{
				test_name: string
				error_message: string
				stack_trace?: string
				category: "assertion" | "timeout" | "exception" | "flake"
			}]
		}
		
		// Quality metrics
		quality_scores: {
			maintainability: number & >=0 & <=10
			readability: number & >=0 & <=10
			performance_impact: number & >=-5.0 & <=5.0
			security_score: number & >=0 & <=10
		}
		
		// Generation context
		generation_context: {
			model: string
			prompt_strategy: string
			temperature: number & >=0 & <=2.0
			cost_usd: number & >=0
			generation_time_seconds: number & >=0
		}
	}]
	
	// Selection and review
	selection: {
		method: "automated" | "conclave" | "human" | "hybrid"
		
		// Selected candidate
		selected_candidate_id?: string
		selection_confidence: number & >=0 & <=1.0
		selection_rationale: string
		
		// Clustering results (for duplicate detection)
		clusters: [...{
			cluster_id: string
			candidate_ids: [...string]
			similarity_threshold: number & >=0 & <=1.0
			representative_id: string
		}]
		
		// Review scores
		candidate_scores: [...{
			candidate_id: string
			total_score: number & >=0 & <=1.0
			
			component_scores: {
				test_delta: number & >=0 & <=1.0
				locality: number & >=0 & <=1.0
				minimal_touch: number & >=0 & <=1.0
				code_quality: number & >=0 & <=1.0
				performance: number & >=0 & <=1.0
			}
		}]
	}
	
	// Repair attempts (if needed)
	repair_attempts: [...{
		attempt_number: int & >=1
		trigger: "test_failure" | "quality_gate" | "performance_regression"
		
		// Edit search strategy
		search_strategy: {
			method: "beam_search" | "genetic" | "gradient" | "random"
			beam_width?: int & >=1 & <=10  // for beam_search
			max_iterations: int & >=1 & <=100
			
			// Edit constraints from policy
			edit_constraints: {
				max_edit_distance: int & >=1
				preserve_semantics: bool
				allowed_operations: [...string]
			}
		}
		
		// Results
		result: {
			status: "success" | "partial" | "failure"
			final_candidate_id?: string
			iterations_used: int & >=0
			improvement_achieved: number & >=-1.0 & <=1.0
		}
		
		// Cost tracking
		cost_metrics: {
			total_cost_usd: number & >=0
			time_spent_seconds: number & >=0
			api_calls: int & >=0
		}
	}]
}

// Execution state and telemetry
#ExecutionState: {
	// Current phase
	current_phase: "spec" | "brief" | "plan" | "tests" | "implementation" | "review" | "repair" | "merge" | "docs" | "complete"
	
	// Phase history
	phase_history: [...{
		phase: string
		started_at: string & time.Format(time.RFC3339)
		completed_at?: string & time.Format(time.RFC3339)
		status: "running" | "completed" | "failed" | "skipped"
		
		// Resource usage
		cost_usd: number & >=0
		time_seconds: number & >=0
		api_calls: int & >=0
		
		// Outcomes
		outputs?: {[string]: _}  // phase-specific outputs
		errors?: [...string]
		warnings?: [...string]
	}]
	
	// Budget tracking
	budget_usage: {
		total_cost_usd: number & >=0
		total_time_seconds: number & >=0
		
		by_phase: {[string]: {
			cost_usd: number & >=0
			time_seconds: number & >=0
			percentage_of_budget: number & >=0 & <=2.0
		}}
	}
	
	// Circuit breaker status
	circuit_breakers: [...{
		name: string
		status: "closed" | "open" | "half_open"
		failure_count: int & >=0
		last_failure?: string & time.Format(time.RFC3339)
		next_attempt?: string & time.Format(time.RFC3339)
	}]
	
	// Quality gates status
	quality_gates: [...{
		gate_name: string
		status: "pending" | "passed" | "failed"
		threshold: number
		actual?: number
		timestamp?: string & time.Format(time.RFC3339)
	}]
}

// Main specification structure
#ValhallaPipeline: {
	// Required sections
	meta: #Meta
	brief: #Brief
	spec: #Spec
	policy: #Policy
	rubric: #Rubric
	
	// Optional sections
	plan?: #Plan
	conclave?: #Conclave
	implementation?: #Implementation
	execution_state?: #ExecutionState
}

// Export the main schema
ValhallaPipeline: #ValhallaPipeline