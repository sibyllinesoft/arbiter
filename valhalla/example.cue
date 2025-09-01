package valhalla

// Import the schema
import "."

// Example concrete instance
example: ValhallaPipeline & {
	meta: {
		version: "v1.0.0"
		timestamp: "2024-01-15T10:30:00Z"
		cue_version: "v0.6.0"
		arbiter_version: "v1.2.0"
		task_id: "valhalla-swe-001"
		gitlab: {
			project_id: "123"
			branch: "feature/valhalla-agent"
		}
		trace_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	}
	
	brief: {
		dependency_graph: {
			nodes: [{
				id: "main.py"
				type: "file"
				path: "/src/main.py"
				language: "python"
			}]
			edges: []
		}
		
		hotspots: [{
			path: "/src/main.py"
			category: "complexity"
			score: 6.5
			evidence: ["High cyclomatic complexity"]
			last_modified: "2024-01-14T15:20:00Z"
		}]
		
		change_history: {
			recent_commits: [{
				sha: "abc123def456"
				message: "Initial implementation"
				author: "dev@example.com"
				timestamp: "2024-01-14T14:00:00Z"
				files_changed: ["/src/main.py"]
				additions: 100
				deletions: 0
			}]
			
			failure_patterns: []
		}
		
		test_coverage: {
			overall_percentage: 85
			by_file: [{
				path: "/src/main.py"
				line_coverage: 80
				branch_coverage: 75
				missing_lines: [45, 67, 89]
			}]
			
			flaky_tests: []
		}
		
		architectural_constraints: {
			forbidden_patterns: ["global variables"]
			required_patterns: ["type hints"]
			style_guide_violations: []
		}
	}
	
	spec: {
		story: {
			title: "Implement user authentication"
			description: "Add secure user authentication to the application"
			acceptance_criteria: [{
				id: "AC001"
				description: "Users can login with email and password"
				type: "functional"
				priority: "must"
				testable: true
			}]
		}
		
		failing_tests: [{
			name: "test_user_login"
			path: "/tests/test_auth.py"
			framework: "pytest"
			error_message: "Authentication failed"
			reproduction_steps: ["Create user", "Attempt login"]
			expected_behavior: "User successfully logged in"
			actual_behavior: "Login rejected"
		}]
		
		success_metrics: {
			pass_rate_threshold: 0.95
			performance_regression_limit: 0.05
			test_coverage_minimum: 90
			code_quality_threshold: 8.0
		}
		
		constraints: {
			max_files_changed: 5
			max_lines_changed: 200
			breaking_changes_allowed: false
			external_dependencies_allowed: true
			risk_tolerance: "medium"
			rollback_plan_required: true
		}
	}
	
	policy: {
		budget: {
			total_usd: 50
			total_minutes: 240
			
			per_phase: {
				brief: {
					usd: 5
					minutes: 24
				}
				plan: {
					usd: 7.5
					minutes: 36
				}
				implementation: {
					usd: 25
					minutes: 120
				}
				review: {
					usd: 7.5
					minutes: 36
				}
				repair: {
					usd: 5
					minutes: 24
				}
			}
		}
		
		stopping: {
			max_attempts_per_phase: 3
			max_candidate_patches: 5
			consecutive_failures_limit: 2
			flake_rate_threshold: 0.1
			cost_overrun_threshold: 1.2
			minimum_test_improvement: 0.1
			maximum_regression_tolerance: 0.05
		}
		
		edit_primitives: {
			allowed_operations: ["insert", "replace"]
			max_edit_distance: 50
			preserve_formatting: true
			respect_syntax: true
			forbidden_patterns: []
			required_approvals_for: []
			checkpoint_frequency: 3
			auto_rollback_triggers: ["test_failure"]
		}
		
		risk_limits: {
			max_cyclomatic_complexity_increase: 2
			max_coupling_increase: 0.1
			test_timeout_seconds: 300
			max_flaky_test_reruns: 3
			memory_usage_limit_mb: 512
			execution_time_limit_multiplier: 1.5
			security_scan_required: true
			vulnerability_threshold: "low"
		}
		
		selection_rubric: {
			weights: {
				test_delta: 0.4
				locality: 0.2
				minimal_touch: 0.2
				code_quality: 0.1
				performance: 0.1
			}
			
			criteria: {
				test_improvement: {
					excellent: 0.95
					good: 0.8
					acceptable: 0.6
					poor: 0.3
				}
				
				code_locality: {
					single_file: 1.0
					single_module: 0.8
					multiple_modules: 0.6
					cross_cutting: 0.4
				}
			}
		}
	}
	
	rubric: {
		success_metrics: {
			pass_at_1: 0.85
			pass_at_k: 0.95
			cost_per_success: 25.50
			latency_seconds: 180
			flake_rate: 0.05
			revert_rate: 0.02
			spec_coverage: 0.90
			diff_minimality_score: 0.80
			logical_cohesion_score: 0.85
		}
		
		phase_metrics: {
			brief: {
				insight_accuracy: 0.90
				analysis_completeness: 0.85
				processing_time_seconds: 30
			}
			
			plan: {
				strategy_diversity: 0.75
				feasibility_score: 0.80
				consensus_strength: 0.70
			}
			
			implementation: {
				candidate_quality_distribution: [0.6, 0.75, 0.85, 0.90, 0.95]
				syntax_correctness_rate: 0.95
				test_passing_rate: 0.80
			}
			
			review: {
				selection_accuracy: 0.85
				false_positive_rate: 0.10
				review_consistency: 0.90
			}
			
			repair: {
				convergence_rate: 0.75
				edit_efficiency: 0.80
				quality_preservation: 0.85
			}
		}
		
		quality_gates: [{
			name: "test_coverage"
			threshold: 0.90
			actual: 0.92
			passed: true
			critical: true
		}]
		
		benchmark: {
			baseline_metrics: {
				swe_bench_score: 0.65
				code_contests_score: 0.70
				humaneval_score: 0.75
			}
			
			improvement_delta: {
				accuracy_improvement: 0.15
				efficiency_improvement: 0.25
				robustness_improvement: 0.20
			}
		}
	}
}