package valhalla

import (
	"encoding/json"
)

// OpenAPI specification for Valhalla
openapi: "3.0.0"
info: {
	title: "Valhalla Agent Benchmarking API"
	version: "1.0.0"
	description: "SWE Agent Architecture for reactive DAG execution"
}

components: {
	schemas: {
		Meta: {
			type: "object"
			required: ["version", "timestamp", "cue_version", "arbiter_version", "task_id", "gitlab", "trace_id"]
			properties: {
				version: {
					type: "string"
					pattern: "^v[0-9]+\\.[0-9]+\\.[0-9]+$"
				}
				timestamp: {
					type: "string"
					format: "date-time"
				}
				cue_version: {
					type: "string"
				}
				arbiter_version: {
					type: "string"
				}
				task_id: {
					type: "string"
					pattern: "^[a-zA-Z0-9_-]+$"
				}
				gitlab: {
					"$ref": "#/components/schemas/GitlabContext"
				}
				trace_id: {
					type: "string"
					pattern: "^[a-f0-9-]+$"
				}
				parent_span_id: {
					type: "string"
				}
			}
		}
		
		GitlabContext: {
			type: "object"
			required: ["project_id", "branch"]
			properties: {
				project_id: {
					type: "string"
				}
				merge_request_id: {
					type: "string"
				}
				branch: {
					type: "string"
				}
				commit_sha: {
					type: "string"
				}
			}
		}
		
		Brief: {
			type: "object"
			required: ["dependency_graph", "hotspots", "change_history", "test_coverage", "architectural_constraints"]
			properties: {
				dependency_graph: {
					"$ref": "#/components/schemas/DependencyGraph"
				}
				hotspots: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Hotspot"
					}
				}
				change_history: {
					"$ref": "#/components/schemas/ChangeHistory"
				}
				test_coverage: {
					"$ref": "#/components/schemas/TestCoverage"
				}
				architectural_constraints: {
					"$ref": "#/components/schemas/ArchitecturalConstraints"
				}
			}
		}
		
		DependencyGraph: {
			type: "object"
			required: ["nodes", "edges"]
			properties: {
				nodes: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/DependencyNode"
					}
				}
				edges: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/DependencyEdge"
					}
				}
			}
		}
		
		DependencyNode: {
			type: "object"
			required: ["id", "type", "path", "language"]
			properties: {
				id: {
					type: "string"
				}
				type: {
					type: "string"
					enum: ["module", "class", "function", "file"]
				}
				path: {
					type: "string"
				}
				language: {
					type: "string"
				}
			}
		}
		
		DependencyEdge: {
			type: "object"
			required: ["from", "to", "type", "weight"]
			properties: {
				from: {
					type: "string"
				}
				to: {
					type: "string"
				}
				type: {
					type: "string"
					enum: ["imports", "calls", "inherits", "references"]
				}
				weight: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		Hotspot: {
			type: "object"
			required: ["path", "category", "score", "evidence", "last_modified"]
			properties: {
				path: {
					type: "string"
				}
				category: {
					type: "string"
					enum: ["complexity", "churn", "bugs", "performance"]
				}
				score: {
					type: "number"
					minimum: 0
					maximum: 10
				}
				evidence: {
					type: "array"
					items: {
						type: "string"
					}
				}
				last_modified: {
					type: "string"
					format: "date-time"
				}
			}
		}
		
		ChangeHistory: {
			type: "object"
			required: ["recent_commits", "failure_patterns"]
			properties: {
				recent_commits: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Commit"
					}
				}
				failure_patterns: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/FailurePattern"
					}
				}
			}
		}
		
		Commit: {
			type: "object"
			required: ["sha", "message", "author", "timestamp", "files_changed", "additions", "deletions"]
			properties: {
				sha: {
					type: "string"
				}
				message: {
					type: "string"
				}
				author: {
					type: "string"
				}
				timestamp: {
					type: "string"
					format: "date-time"
				}
				files_changed: {
					type: "array"
					items: {
						type: "string"
					}
				}
				additions: {
					type: "integer"
					minimum: 0
				}
				deletions: {
					type: "integer"
					minimum: 0
				}
			}
		}
		
		FailurePattern: {
			type: "object"
			required: ["pattern_type", "frequency", "affected_files", "symptoms"]
			properties: {
				pattern_type: {
					type: "string"
					enum: ["test_flake", "build_failure", "deployment_issue"]
				}
				frequency: {
					type: "number"
					minimum: 0
				}
				affected_files: {
					type: "array"
					items: {
						type: "string"
					}
				}
				symptoms: {
					type: "array"
					items: {
						type: "string"
					}
				}
			}
		}
		
		TestCoverage: {
			type: "object"
			required: ["overall_percentage", "by_file", "flaky_tests"]
			properties: {
				overall_percentage: {
					type: "number"
					minimum: 0
					maximum: 100
				}
				by_file: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/FileCoverage"
					}
				}
				flaky_tests: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/FlakyTest"
					}
				}
			}
		}
		
		FileCoverage: {
			type: "object"
			required: ["path", "line_coverage", "branch_coverage", "missing_lines"]
			properties: {
				path: {
					type: "string"
				}
				line_coverage: {
					type: "number"
					minimum: 0
					maximum: 100
				}
				branch_coverage: {
					type: "number"
					minimum: 0
					maximum: 100
				}
				missing_lines: {
					type: "array"
					items: {
						type: "integer"
					}
				}
			}
		}
		
		FlakyTest: {
			type: "object"
			required: ["test_name", "flake_rate", "last_failure"]
			properties: {
				test_name: {
					type: "string"
				}
				flake_rate: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				last_failure: {
					type: "string"
					format: "date-time"
				}
			}
		}
		
		ArchitecturalConstraints: {
			type: "object"
			required: ["forbidden_patterns", "required_patterns", "style_guide_violations"]
			properties: {
				forbidden_patterns: {
					type: "array"
					items: {
						type: "string"
					}
				}
				required_patterns: {
					type: "array"
					items: {
						type: "string"
					}
				}
				style_guide_violations: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/StyleViolation"
					}
				}
			}
		}
		
		StyleViolation: {
			type: "object"
			required: ["file", "line", "rule", "severity"]
			properties: {
				file: {
					type: "string"
				}
				line: {
					type: "integer"
				}
				rule: {
					type: "string"
				}
				severity: {
					type: "string"
					enum: ["error", "warning", "info"]
				}
			}
		}
		
		ValhallaPipeline: {
			type: "object"
			required: ["meta", "brief", "spec", "policy", "rubric"]
			properties: {
				meta: {
					"$ref": "#/components/schemas/Meta"
				}
				brief: {
					"$ref": "#/components/schemas/Brief"
				}
				spec: {
					"$ref": "#/components/schemas/Spec"
				}
				policy: {
					"$ref": "#/components/schemas/Policy"
				}
				rubric: {
					"$ref": "#/components/schemas/Rubric"
				}
				plan: {
					"$ref": "#/components/schemas/Plan"
				}
				conclave: {
					"$ref": "#/components/schemas/Conclave"
				}
				implementation: {
					"$ref": "#/components/schemas/Implementation"
				}
				execution_state: {
					"$ref": "#/components/schemas/ExecutionState"
				}
			}
		}
		
		Spec: {
			type: "object"
			required: ["story", "failing_tests", "success_metrics", "constraints"]
			properties: {
				story: {
					"$ref": "#/components/schemas/Story"
				}
				failing_tests: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/FailingTest"
					}
				}
				success_metrics: {
					"$ref": "#/components/schemas/SuccessMetrics"
				}
				constraints: {
					"$ref": "#/components/schemas/Constraints"
				}
			}
		}
		
		Story: {
			type: "object"
			required: ["title", "description", "acceptance_criteria"]
			properties: {
				title: {
					type: "string"
				}
				description: {
					type: "string"
				}
				acceptance_criteria: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/AcceptanceCriterion"
					}
				}
			}
		}
		
		AcceptanceCriterion: {
			type: "object"
			required: ["id", "description", "type", "priority", "testable"]
			properties: {
				id: {
					type: "string"
				}
				description: {
					type: "string"
				}
				type: {
					type: "string"
					enum: ["functional", "non_functional", "quality"]
				}
				priority: {
					type: "string"
					enum: ["must", "should", "could"]
				}
				testable: {
					type: "boolean"
				}
			}
		}
		
		FailingTest: {
			type: "object"
			required: ["name", "path", "framework", "error_message", "reproduction_steps", "expected_behavior", "actual_behavior"]
			properties: {
				name: {
					type: "string"
				}
				path: {
					type: "string"
				}
				framework: {
					type: "string"
				}
				error_message: {
					type: "string"
				}
				stack_trace: {
					type: "string"
				}
				reproduction_steps: {
					type: "array"
					items: {
						type: "string"
					}
				}
				expected_behavior: {
					type: "string"
				}
				actual_behavior: {
					type: "string"
				}
			}
		}
		
		SuccessMetrics: {
			type: "object"
			required: ["pass_rate_threshold", "performance_regression_limit", "test_coverage_minimum", "code_quality_threshold"]
			properties: {
				pass_rate_threshold: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				performance_regression_limit: {
					type: "number"
					minimum: 0
					maximum: 0.1
				}
				test_coverage_minimum: {
					type: "number"
					minimum: 0
					maximum: 100
				}
				code_quality_threshold: {
					type: "number"
					minimum: 0
					maximum: 10
				}
			}
		}
		
		Constraints: {
			type: "object"
			required: ["max_files_changed", "max_lines_changed", "breaking_changes_allowed", "external_dependencies_allowed", "risk_tolerance", "rollback_plan_required"]
			properties: {
				max_files_changed: {
					type: "integer"
					minimum: 1
					maximum: 100
				}
				max_lines_changed: {
					type: "integer"
					minimum: 1
					maximum: 10000
				}
				breaking_changes_allowed: {
					type: "boolean"
				}
				external_dependencies_allowed: {
					type: "boolean"
				}
				risk_tolerance: {
					type: "string"
					enum: ["low", "medium", "high"]
				}
				rollback_plan_required: {
					type: "boolean"
				}
			}
		}
		
		Policy: {
			type: "object"
			required: ["budget", "stopping", "edit_primitives", "risk_limits", "selection_rubric"]
			properties: {
				budget: {
					"$ref": "#/components/schemas/Budget"
				}
				stopping: {
					"$ref": "#/components/schemas/StoppingRules"
				}
				edit_primitives: {
					"$ref": "#/components/schemas/EditPrimitives"
				}
				risk_limits: {
					"$ref": "#/components/schemas/RiskLimits"
				}
				selection_rubric: {
					"$ref": "#/components/schemas/SelectionRubric"
				}
			}
		}
		
		Budget: {
			type: "object"
			required: ["total_usd", "total_minutes", "per_phase"]
			properties: {
				total_usd: {
					type: "number"
					minimum: 0.01
					maximum: 1000
				}
				total_minutes: {
					type: "integer"
					minimum: 1
					maximum: 1440
				}
				per_phase: {
					"$ref": "#/components/schemas/PhaseAllocations"
				}
			}
		}
		
		PhaseAllocations: {
			type: "object"
			required: ["brief", "plan", "implementation", "review", "repair"]
			properties: {
				brief: {
					"$ref": "#/components/schemas/PhaseAllocation"
				}
				plan: {
					"$ref": "#/components/schemas/PhaseAllocation"
				}
				implementation: {
					"$ref": "#/components/schemas/PhaseAllocation"
				}
				review: {
					"$ref": "#/components/schemas/PhaseAllocation"
				}
				repair: {
					"$ref": "#/components/schemas/PhaseAllocation"
				}
			}
		}
		
		PhaseAllocation: {
			type: "object"
			required: ["usd", "minutes"]
			properties: {
				usd: {
					type: "number"
					minimum: 0
				}
				minutes: {
					type: "integer"
					minimum: 0
				}
			}
		}
		
		StoppingRules: {
			type: "object"
			required: ["max_attempts_per_phase", "max_candidate_patches", "consecutive_failures_limit", "flake_rate_threshold", "cost_overrun_threshold", "minimum_test_improvement", "maximum_regression_tolerance"]
			properties: {
				max_attempts_per_phase: {
					type: "integer"
					minimum: 1
					maximum: 10
				}
				max_candidate_patches: {
					type: "integer"
					minimum: 1
					maximum: 20
				}
				consecutive_failures_limit: {
					type: "integer"
					minimum: 1
					maximum: 5
				}
				flake_rate_threshold: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				cost_overrun_threshold: {
					type: "number"
					minimum: 0
					maximum: 2
				}
				minimum_test_improvement: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				maximum_regression_tolerance: {
					type: "number"
					minimum: 0
					maximum: 0.1
				}
			}
		}
		
		EditPrimitives: {
			type: "object"
			required: ["allowed_operations", "max_edit_distance", "preserve_formatting", "respect_syntax", "forbidden_patterns", "required_approvals_for", "checkpoint_frequency", "auto_rollback_triggers"]
			properties: {
				allowed_operations: {
					type: "array"
					items: {
						type: "string"
						enum: ["insert", "delete", "replace", "move"]
					}
				}
				max_edit_distance: {
					type: "integer"
					minimum: 1
					maximum: 1000
				}
				preserve_formatting: {
					type: "boolean"
				}
				respect_syntax: {
					type: "boolean"
				}
				forbidden_patterns: {
					type: "array"
					items: {
						type: "string"
					}
				}
				required_approvals_for: {
					type: "array"
					items: {
						type: "string"
					}
				}
				checkpoint_frequency: {
					type: "integer"
					minimum: 1
					maximum: 10
				}
				auto_rollback_triggers: {
					type: "array"
					items: {
						type: "string"
					}
				}
			}
		}
		
		RiskLimits: {
			type: "object"
			required: ["max_cyclomatic_complexity_increase", "max_coupling_increase", "test_timeout_seconds", "max_flaky_test_reruns", "memory_usage_limit_mb", "execution_time_limit_multiplier", "security_scan_required", "vulnerability_threshold"]
			properties: {
				max_cyclomatic_complexity_increase: {
					type: "integer"
					minimum: 0
					maximum: 10
				}
				max_coupling_increase: {
					type: "number"
					minimum: 0
					maximum: 0.5
				}
				test_timeout_seconds: {
					type: "integer"
					minimum: 1
					maximum: 3600
				}
				max_flaky_test_reruns: {
					type: "integer"
					minimum: 1
					maximum: 10
				}
				memory_usage_limit_mb: {
					type: "integer"
					minimum: 1
					maximum: 8192
				}
				execution_time_limit_multiplier: {
					type: "number"
					minimum: 0.1
					maximum: 10
				}
				security_scan_required: {
					type: "boolean"
				}
				vulnerability_threshold: {
					type: "string"
					enum: ["none", "low", "medium", "high"]
				}
			}
		}
		
		SelectionRubric: {
			type: "object"
			required: ["weights", "criteria"]
			properties: {
				weights: {
					"$ref": "#/components/schemas/SelectionWeights"
				}
				criteria: {
					"$ref": "#/components/schemas/SelectionCriteria"
				}
			}
		}
		
		SelectionWeights: {
			type: "object"
			required: ["test_delta", "locality", "minimal_touch", "code_quality", "performance"]
			properties: {
				test_delta: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				locality: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				minimal_touch: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				code_quality: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				performance: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		SelectionCriteria: {
			type: "object"
			required: ["test_improvement", "code_locality"]
			properties: {
				test_improvement: {
					"$ref": "#/components/schemas/TestImprovementCriteria"
				}
				code_locality: {
					"$ref": "#/components/schemas/CodeLocalityCriteria"
				}
			}
		}
		
		TestImprovementCriteria: {
			type: "object"
			required: ["excellent", "good", "acceptable", "poor"]
			properties: {
				excellent: {
					type: "number"
					minimum: 0.9
					maximum: 1
				}
				good: {
					type: "number"
					minimum: 0.7
					maximum: 1
				}
				acceptable: {
					type: "number"
					minimum: 0.5
					maximum: 1
				}
				poor: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		CodeLocalityCriteria: {
			type: "object"
			required: ["single_file", "single_module", "multiple_modules", "cross_cutting"]
			properties: {
				single_file: {
					type: "number"
				}
				single_module: {
					type: "number"
				}
				multiple_modules: {
					type: "number"
				}
				cross_cutting: {
					type: "number"
				}
			}
		}
		
		Rubric: {
			type: "object"
			required: ["success_metrics", "phase_metrics", "quality_gates", "benchmark"]
			properties: {
				success_metrics: {
					"$ref": "#/components/schemas/RubricSuccessMetrics"
				}
				phase_metrics: {
					"$ref": "#/components/schemas/PhaseMetrics"
				}
				quality_gates: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/QualityGate"
					}
				}
				benchmark: {
					"$ref": "#/components/schemas/Benchmark"
				}
			}
		}
		
		RubricSuccessMetrics: {
			type: "object"
			required: ["pass_at_1", "pass_at_k", "cost_per_success", "latency_seconds", "flake_rate", "revert_rate", "spec_coverage", "diff_minimality_score", "logical_cohesion_score"]
			properties: {
				pass_at_1: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				pass_at_k: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				cost_per_success: {
					type: "number"
					minimum: 0
				}
				latency_seconds: {
					type: "number"
					minimum: 0
				}
				flake_rate: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				revert_rate: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				spec_coverage: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				diff_minimality_score: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				logical_cohesion_score: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		PhaseMetrics: {
			type: "object"
			required: ["brief", "plan", "implementation", "review", "repair"]
			properties: {
				brief: {
					"$ref": "#/components/schemas/BriefMetrics"
				}
				plan: {
					"$ref": "#/components/schemas/PlanMetrics"
				}
				implementation: {
					"$ref": "#/components/schemas/ImplementationMetrics"
				}
				review: {
					"$ref": "#/components/schemas/ReviewMetrics"
				}
				repair: {
					"$ref": "#/components/schemas/RepairMetrics"
				}
			}
		}
		
		BriefMetrics: {
			type: "object"
			required: ["insight_accuracy", "analysis_completeness", "processing_time_seconds"]
			properties: {
				insight_accuracy: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				analysis_completeness: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				processing_time_seconds: {
					type: "number"
					minimum: 0
				}
			}
		}
		
		PlanMetrics: {
			type: "object"
			required: ["strategy_diversity", "feasibility_score", "consensus_strength"]
			properties: {
				strategy_diversity: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				feasibility_score: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				consensus_strength: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		ImplementationMetrics: {
			type: "object"
			required: ["candidate_quality_distribution", "syntax_correctness_rate", "test_passing_rate"]
			properties: {
				candidate_quality_distribution: {
					type: "array"
					items: {
						type: "number"
					}
				}
				syntax_correctness_rate: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				test_passing_rate: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		ReviewMetrics: {
			type: "object"
			required: ["selection_accuracy", "false_positive_rate", "review_consistency"]
			properties: {
				selection_accuracy: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				false_positive_rate: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				review_consistency: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		RepairMetrics: {
			type: "object"
			required: ["convergence_rate", "edit_efficiency", "quality_preservation"]
			properties: {
				convergence_rate: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				edit_efficiency: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				quality_preservation: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		QualityGate: {
			type: "object"
			required: ["name", "threshold", "actual", "passed", "critical"]
			properties: {
				name: {
					type: "string"
				}
				threshold: {
					type: "number"
				}
				actual: {
					type: "number"
				}
				passed: {
					type: "boolean"
				}
				critical: {
					type: "boolean"
				}
			}
		}
		
		Benchmark: {
			type: "object"
			required: ["baseline_metrics", "improvement_delta"]
			properties: {
				baseline_metrics: {
					"$ref": "#/components/schemas/BaselineMetrics"
				}
				improvement_delta: {
					"$ref": "#/components/schemas/ImprovementDelta"
				}
			}
		}
		
		BaselineMetrics: {
			type: "object"
			required: ["swe_bench_score", "code_contests_score", "humaneval_score"]
			properties: {
				swe_bench_score: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				code_contests_score: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				humaneval_score: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		ImprovementDelta: {
			type: "object"
			required: ["accuracy_improvement", "efficiency_improvement", "robustness_improvement"]
			properties: {
				accuracy_improvement: {
					type: "number"
				}
				efficiency_improvement: {
					type: "number"
				}
				robustness_improvement: {
					type: "number"
				}
			}
		}
		
		Plan: {
			type: "object"
			required: ["enabled"]
			properties: {
				enabled: {
					type: "boolean"
				}
				strategy: {
					"$ref": "#/components/schemas/Strategy"
				}
				phases: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Phase"
					}
				}
				target_files: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/TargetFile"
					}
				}
				alternatives: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Alternative"
					}
				}
				plan_success_criteria: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/PlanSuccessCriterion"
					}
				}
			}
		}
		
		Strategy: {
			type: "object"
			required: ["approach", "rationale", "estimated_complexity", "risk_assessment"]
			properties: {
				approach: {
					type: "string"
					enum: ["incremental", "rewrite", "refactor", "patch", "test_driven"]
				}
				rationale: {
					type: "string"
				}
				estimated_complexity: {
					type: "string"
					enum: ["low", "medium", "high"]
				}
				risk_assessment: {
					type: "string"
					enum: ["low", "medium", "high"]
				}
			}
		}
		
		Phase: {
			type: "object"
			required: ["id", "name", "description", "dependencies", "estimated_effort", "deliverables", "risks"]
			properties: {
				id: {
					type: "string"
				}
				name: {
					type: "string"
				}
				description: {
					type: "string"
				}
				dependencies: {
					type: "array"
					items: {
						type: "string"
					}
				}
				estimated_effort: {
					"$ref": "#/components/schemas/EstimatedEffort"
				}
				deliverables: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Deliverable"
					}
				}
				risks: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Risk"
					}
				}
			}
		}
		
		EstimatedEffort: {
			type: "object"
			required: ["hours", "complexity"]
			properties: {
				hours: {
					type: "number"
					minimum: 0
				}
				complexity: {
					type: "number"
					minimum: 1
					maximum: 10
				}
			}
		}
		
		Deliverable: {
			type: "object"
			required: ["type", "files", "description"]
			properties: {
				type: {
					type: "string"
					enum: ["code", "tests", "docs", "config"]
				}
				files: {
					type: "array"
					items: {
						type: "string"
					}
				}
				description: {
					type: "string"
				}
			}
		}
		
		Risk: {
			type: "object"
			required: ["description", "probability", "impact", "mitigation"]
			properties: {
				description: {
					type: "string"
				}
				probability: {
					type: "string"
					enum: ["low", "medium", "high"]
				}
				impact: {
					type: "string"
					enum: ["low", "medium", "high"]
				}
				mitigation: {
					type: "string"
				}
			}
		}
		
		TargetFile: {
			type: "object"
			required: ["path", "modification_type", "estimated_lines_changed", "rationale", "dependencies"]
			properties: {
				path: {
					type: "string"
				}
				modification_type: {
					type: "string"
					enum: ["create", "modify", "delete"]
				}
				estimated_lines_changed: {
					type: "integer"
					minimum: 0
				}
				rationale: {
					type: "string"
				}
				dependencies: {
					type: "array"
					items: {
						type: "string"
					}
				}
			}
		}
		
		Alternative: {
			type: "object"
			required: ["approach", "pros", "cons", "rejected_reason"]
			properties: {
				approach: {
					type: "string"
				}
				pros: {
					type: "array"
					items: {
						type: "string"
					}
				}
				cons: {
					type: "array"
					items: {
						type: "string"
					}
				}
				rejected_reason: {
					type: "string"
				}
			}
		}
		
		PlanSuccessCriterion: {
			type: "object"
			required: ["criterion", "measurement", "threshold"]
			properties: {
				criterion: {
					type: "string"
				}
				measurement: {
					type: "string"
				}
				threshold: {
					oneOf: [
						{type: "number"}
						{type: "string"}
					]
				}
			}
		}
		
		Conclave: {
			type: "object"
			required: ["config", "results"]
			properties: {
				config: {
					"$ref": "#/components/schemas/ConclaveConfig"
				}
				results: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/DebateResult"
					}
				}
			}
		}
		
		ConclaveConfig: {
			type: "object"
			required: ["decision_sites", "debate_parameters", "gating"]
			properties: {
				decision_sites: {
					"$ref": "#/components/schemas/DecisionSites"
				}
				debate_parameters: {
					"$ref": "#/components/schemas/DebateParameters"
				}
				gating: {
					"$ref": "#/components/schemas/Gating"
				}
			}
		}
		
		DecisionSites: {
			type: "object"
			required: ["plan_enabled", "implementation_enabled", "review_enabled", "repair_enabled"]
			properties: {
				plan_enabled: {
					type: "boolean"
				}
				implementation_enabled: {
					type: "boolean"
				}
				review_enabled: {
					type: "boolean"
				}
				repair_enabled: {
					type: "boolean"
				}
			}
		}
		
		DebateParameters: {
			type: "object"
			required: ["width", "depth", "diversity", "adjudicator"]
			properties: {
				width: {
					type: "integer"
					minimum: 1
					maximum: 10
				}
				depth: {
					type: "integer"
					minimum: 1
					maximum: 5
				}
				diversity: {
					"$ref": "#/components/schemas/Diversity"
				}
				adjudicator: {
					"$ref": "#/components/schemas/Adjudicator"
				}
			}
		}
		
		Diversity: {
			type: "object"
			required: ["prompts", "models", "temperatures"]
			properties: {
				prompts: {
					type: "array"
					items: {
						type: "string"
					}
				}
				models: {
					type: "array"
					items: {
						type: "string"
					}
				}
				temperatures: {
					type: "array"
					items: {
						type: "number"
					}
				}
			}
		}
		
		Adjudicator: {
			type: "object"
			required: ["type"]
			properties: {
				type: {
					type: "string"
					enum: ["majority", "weighted", "llm_judge", "human"]
				}
				weights: {
					type: "array"
					items: {
						type: "number"
					}
				}
				judge_model: {
					type: "string"
				}
			}
		}
		
		Gating: {
			type: "object"
			required: ["complexity_threshold", "budget_threshold_usd", "confidence_threshold", "predictors"]
			properties: {
				complexity_threshold: {
					type: "number"
					minimum: 0
					maximum: 10
				}
				budget_threshold_usd: {
					type: "number"
					minimum: 0
				}
				confidence_threshold: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				predictors: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Predictor"
					}
				}
			}
		}
		
		Predictor: {
			type: "object"
			required: ["name", "threshold", "weight"]
			properties: {
				name: {
					type: "string"
				}
				threshold: {
					type: "number"
				}
				weight: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		DebateResult: {
			type: "object"
			required: ["decision_site", "timestamp", "participants", "rounds", "decision", "debate_metrics"]
			properties: {
				decision_site: {
					type: "string"
					enum: ["plan", "implementation", "review", "repair"]
				}
				timestamp: {
					type: "string"
					format: "date-time"
				}
				participants: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Participant"
					}
				}
				rounds: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Round"
					}
				}
				decision: {
					"$ref": "#/components/schemas/Decision"
				}
				debate_metrics: {
					"$ref": "#/components/schemas/DebateMetrics"
				}
			}
		}
		
		Participant: {
			type: "object"
			required: ["agent_id", "model", "prompt_strategy", "position"]
			properties: {
				agent_id: {
					type: "string"
				}
				model: {
					type: "string"
				}
				prompt_strategy: {
					type: "string"
				}
				position: {
					type: "string"
				}
			}
		}
		
		Round: {
			type: "object"
			required: ["round_number", "arguments", "consensus_metrics"]
			properties: {
				round_number: {
					type: "integer"
					minimum: 1
				}
				arguments: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Argument"
					}
				}
				consensus_metrics: {
					"$ref": "#/components/schemas/ConsensusMetrics"
				}
			}
		}
		
		Argument: {
			type: "object"
			required: ["agent_id", "position", "evidence", "confidence"]
			properties: {
				agent_id: {
					type: "string"
				}
				position: {
					type: "string"
				}
				evidence: {
					type: "array"
					items: {
						type: "string"
					}
				}
				confidence: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		ConsensusMetrics: {
			type: "object"
			required: ["agreement_score", "position_distribution", "confidence_variance"]
			properties: {
				agreement_score: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				position_distribution: {
					type: "array"
					items: {
						type: "number"
					}
				}
				confidence_variance: {
					type: "number"
					minimum: 0
				}
			}
		}
		
		Decision: {
			type: "object"
			required: ["chosen_option", "confidence", "rationale", "dissenting_opinions"]
			properties: {
				chosen_option: {
					type: "string"
				}
				confidence: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				rationale: {
					type: "string"
				}
				dissenting_opinions: {
					type: "array"
					items: {
						type: "string"
					}
				}
			}
		}
		
		DebateMetrics: {
			type: "object"
			required: ["total_cost_usd", "total_time_seconds", "convergence_round", "consensus_strength"]
			properties: {
				total_cost_usd: {
					type: "number"
					minimum: 0
				}
				total_time_seconds: {
					type: "number"
					minimum: 0
				}
				convergence_round: {
					type: "integer"
					minimum: 1
				}
				consensus_strength: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		Implementation: {
			type: "object"
			required: ["candidates", "selection", "repair_attempts"]
			properties: {
				candidates: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Candidate"
					}
				}
				selection: {
					"$ref": "#/components/schemas/Selection"
				}
				repair_attempts: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/RepairAttempt"
					}
				}
			}
		}
		
		Candidate: {
			type: "object"
			required: ["id", "timestamp", "patch", "test_results", "quality_scores", "generation_context"]
			properties: {
				id: {
					type: "string"
				}
				timestamp: {
					type: "string"
					format: "date-time"
				}
				patch: {
					"$ref": "#/components/schemas/Patch"
				}
				test_results: {
					"$ref": "#/components/schemas/TestResults"
				}
				quality_scores: {
					"$ref": "#/components/schemas/QualityScores"
				}
				generation_context: {
					"$ref": "#/components/schemas/GenerationContext"
				}
			}
		}
		
		Patch: {
			type: "object"
			required: ["files", "metadata"]
			properties: {
				files: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/PatchFile"
					}
				}
				metadata: {
					"$ref": "#/components/schemas/PatchMetadata"
				}
			}
		}
		
		PatchFile: {
			type: "object"
			required: ["path", "operation"]
			properties: {
				path: {
					type: "string"
				}
				operation: {
					type: "string"
					enum: ["create", "modify", "delete"]
				}
				content: {
					type: "string"
				}
				diff: {
					type: "string"
				}
			}
		}
		
		PatchMetadata: {
			type: "object"
			required: ["lines_added", "lines_deleted", "files_changed", "estimated_complexity", "syntax_valid", "passes_linting", "breaking_changes"]
			properties: {
				lines_added: {
					type: "integer"
					minimum: 0
				}
				lines_deleted: {
					type: "integer"
					minimum: 0
				}
				files_changed: {
					type: "integer"
					minimum: 0
				}
				estimated_complexity: {
					type: "number"
					minimum: 1
					maximum: 10
				}
				syntax_valid: {
					type: "boolean"
				}
				passes_linting: {
					type: "boolean"
				}
				breaking_changes: {
					type: "boolean"
				}
			}
		}
		
		TestResults: {
			type: "object"
			required: ["status", "total_tests", "passed_tests", "failed_tests", "skipped_tests", "flaky_tests", "execution_time_ms", "memory_usage_mb", "coverage_delta", "failures"]
			properties: {
				status: {
					type: "string"
					enum: ["passed", "failed", "timeout", "error"]
				}
				total_tests: {
					type: "integer"
					minimum: 0
				}
				passed_tests: {
					type: "integer"
					minimum: 0
				}
				failed_tests: {
					type: "integer"
					minimum: 0
				}
				skipped_tests: {
					type: "integer"
					minimum: 0
				}
				flaky_tests: {
					type: "integer"
					minimum: 0
				}
				execution_time_ms: {
					type: "integer"
					minimum: 0
				}
				memory_usage_mb: {
					type: "number"
					minimum: 0
				}
				coverage_delta: {
					type: "number"
					minimum: -1
					maximum: 1
				}
				failures: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/TestFailure"
					}
				}
			}
		}
		
		TestFailure: {
			type: "object"
			required: ["test_name", "error_message", "category"]
			properties: {
				test_name: {
					type: "string"
				}
				error_message: {
					type: "string"
				}
				stack_trace: {
					type: "string"
				}
				category: {
					type: "string"
					enum: ["assertion", "timeout", "exception", "flake"]
				}
			}
		}
		
		QualityScores: {
			type: "object"
			required: ["maintainability", "readability", "performance_impact", "security_score"]
			properties: {
				maintainability: {
					type: "number"
					minimum: 0
					maximum: 10
				}
				readability: {
					type: "number"
					minimum: 0
					maximum: 10
				}
				performance_impact: {
					type: "number"
					minimum: -5
					maximum: 5
				}
				security_score: {
					type: "number"
					minimum: 0
					maximum: 10
				}
			}
		}
		
		GenerationContext: {
			type: "object"
			required: ["model", "prompt_strategy", "temperature", "cost_usd", "generation_time_seconds"]
			properties: {
				model: {
					type: "string"
				}
				prompt_strategy: {
					type: "string"
				}
				temperature: {
					type: "number"
					minimum: 0
					maximum: 2
				}
				cost_usd: {
					type: "number"
					minimum: 0
				}
				generation_time_seconds: {
					type: "number"
					minimum: 0
				}
			}
		}
		
		Selection: {
			type: "object"
			required: ["method", "selection_confidence", "selection_rationale", "clusters", "candidate_scores"]
			properties: {
				method: {
					type: "string"
					enum: ["automated", "conclave", "human", "hybrid"]
				}
				selected_candidate_id: {
					type: "string"
				}
				selection_confidence: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				selection_rationale: {
					type: "string"
				}
				clusters: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/Cluster"
					}
				}
				candidate_scores: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/CandidateScore"
					}
				}
			}
		}
		
		Cluster: {
			type: "object"
			required: ["cluster_id", "candidate_ids", "similarity_threshold", "representative_id"]
			properties: {
				cluster_id: {
					type: "string"
				}
				candidate_ids: {
					type: "array"
					items: {
						type: "string"
					}
				}
				similarity_threshold: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				representative_id: {
					type: "string"
				}
			}
		}
		
		CandidateScore: {
			type: "object"
			required: ["candidate_id", "total_score", "component_scores"]
			properties: {
				candidate_id: {
					type: "string"
				}
				total_score: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				component_scores: {
					"$ref": "#/components/schemas/ComponentScores"
				}
			}
		}
		
		ComponentScores: {
			type: "object"
			required: ["test_delta", "locality", "minimal_touch", "code_quality", "performance"]
			properties: {
				test_delta: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				locality: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				minimal_touch: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				code_quality: {
					type: "number"
					minimum: 0
					maximum: 1
				}
				performance: {
					type: "number"
					minimum: 0
					maximum: 1
				}
			}
		}
		
		RepairAttempt: {
			type: "object"
			required: ["attempt_number", "trigger", "search_strategy", "result", "cost_metrics"]
			properties: {
				attempt_number: {
					type: "integer"
					minimum: 1
				}
				trigger: {
					type: "string"
					enum: ["test_failure", "quality_gate", "performance_regression"]
				}
				search_strategy: {
					"$ref": "#/components/schemas/SearchStrategy"
				}
				result: {
					"$ref": "#/components/schemas/RepairResult"
				}
				cost_metrics: {
					"$ref": "#/components/schemas/CostMetrics"
				}
			}
		}
		
		SearchStrategy: {
			type: "object"
			required: ["method", "max_iterations", "edit_constraints"]
			properties: {
				method: {
					type: "string"
					enum: ["beam_search", "genetic", "gradient", "random"]
				}
				beam_width: {
					type: "integer"
					minimum: 1
					maximum: 10
				}
				max_iterations: {
					type: "integer"
					minimum: 1
					maximum: 100
				}
				edit_constraints: {
					"$ref": "#/components/schemas/EditConstraints"
				}
			}
		}
		
		EditConstraints: {
			type: "object"
			required: ["max_edit_distance", "preserve_semantics", "allowed_operations"]
			properties: {
				max_edit_distance: {
					type: "integer"
					minimum: 1
				}
				preserve_semantics: {
					type: "boolean"
				}
				allowed_operations: {
					type: "array"
					items: {
						type: "string"
					}
				}
			}
		}
		
		RepairResult: {
			type: "object"
			required: ["status", "iterations_used", "improvement_achieved"]
			properties: {
				status: {
					type: "string"
					enum: ["success", "partial", "failure"]
				}
				final_candidate_id: {
					type: "string"
				}
				iterations_used: {
					type: "integer"
					minimum: 0
				}
				improvement_achieved: {
					type: "number"
					minimum: -1
					maximum: 1
				}
			}
		}
		
		CostMetrics: {
			type: "object"
			required: ["total_cost_usd", "time_spent_seconds", "api_calls"]
			properties: {
				total_cost_usd: {
					type: "number"
					minimum: 0
				}
				time_spent_seconds: {
					type: "number"
					minimum: 0
				}
				api_calls: {
					type: "integer"
					minimum: 0
				}
			}
		}
		
		ExecutionState: {
			type: "object"
			required: ["current_phase", "phase_history", "budget_usage", "circuit_breakers", "quality_gates"]
			properties: {
				current_phase: {
					type: "string"
					enum: ["spec", "brief", "plan", "tests", "implementation", "review", "repair", "merge", "docs", "complete"]
				}
				phase_history: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/PhaseHistory"
					}
				}
				budget_usage: {
					"$ref": "#/components/schemas/BudgetUsage"
				}
				circuit_breakers: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/CircuitBreaker"
					}
				}
				quality_gates: {
					type: "array"
					items: {
						"$ref": "#/components/schemas/QualityGateStatus"
					}
				}
			}
		}
		
		PhaseHistory: {
			type: "object"
			required: ["phase", "started_at", "status", "cost_usd", "time_seconds", "api_calls"]
			properties: {
				phase: {
					type: "string"
				}
				started_at: {
					type: "string"
					format: "date-time"
				}
				completed_at: {
					type: "string"
					format: "date-time"
				}
				status: {
					type: "string"
					enum: ["running", "completed", "failed", "skipped"]
				}
				cost_usd: {
					type: "number"
					minimum: 0
				}
				time_seconds: {
					type: "number"
					minimum: 0
				}
				api_calls: {
					type: "integer"
					minimum: 0
				}
				outputs: {
					type: "object"
				}
				errors: {
					type: "array"
					items: {
						type: "string"
					}
				}
				warnings: {
					type: "array"
					items: {
						type: "string"
					}
				}
			}
		}
		
		BudgetUsage: {
			type: "object"
			required: ["total_cost_usd", "total_time_seconds", "by_phase"]
			properties: {
				total_cost_usd: {
					type: "number"
					minimum: 0
				}
				total_time_seconds: {
					type: "number"
					minimum: 0
				}
				by_phase: {
					type: "object"
					additionalProperties: {
						"$ref": "#/components/schemas/PhaseBudgetUsage"
					}
				}
			}
		}
		
		PhaseBudgetUsage: {
			type: "object"
			required: ["cost_usd", "time_seconds", "percentage_of_budget"]
			properties: {
				cost_usd: {
					type: "number"
					minimum: 0
				}
				time_seconds: {
					type: "number"
					minimum: 0
				}
				percentage_of_budget: {
					type: "number"
					minimum: 0
					maximum: 2
				}
			}
		}
		
		CircuitBreaker: {
			type: "object"
			required: ["name", "status", "failure_count"]
			properties: {
				name: {
					type: "string"
				}
				status: {
					type: "string"
					enum: ["closed", "open", "half_open"]
				}
				failure_count: {
					type: "integer"
					minimum: 0
				}
				last_failure: {
					type: "string"
					format: "date-time"
				}
				next_attempt: {
					type: "string"
					format: "date-time"
				}
			}
		}
		
		QualityGateStatus: {
			type: "object"
			required: ["gate_name", "status", "threshold"]
			properties: {
				gate_name: {
					type: "string"
				}
				status: {
					type: "string"
					enum: ["pending", "passed", "failed"]
				}
				threshold: {
					type: "number"
				}
				actual: {
					type: "number"
				}
				timestamp: {
					type: "string"
					format: "date-time"
				}
			}
		}
	}
}

paths: {
	"/pipeline": {
		post: {
			summary: "Create a new Valhalla pipeline execution"
			requestBody: {
				required: true
				content: {
					"application/json": {
						schema: {
							"$ref": "#/components/schemas/ValhallaPipeline"
						}
					}
				}
			}
			responses: {
				"201": {
					description: "Pipeline created successfully"
					content: {
						"application/json": {
							schema: {
								"$ref": "#/components/schemas/ValhallaPipeline"
							}
						}
					}
				}
				"400": {
					description: "Invalid pipeline specification"
				}
			}
		}
	}
	
	"/pipeline/{task_id}": {
		get: {
			summary: "Get pipeline execution status"
			parameters: [{
				name: "task_id"
				in: "path"
				required: true
				schema: {
					type: "string"
				}
			}]
			responses: {
				"200": {
					description: "Pipeline status retrieved successfully"
					content: {
						"application/json": {
							schema: {
								"$ref": "#/components/schemas/ValhallaPipeline"
							}
						}
					}
				}
				"404": {
					description: "Pipeline not found"
				}
			}
		}
		
		put: {
			summary: "Update pipeline execution"
			parameters: [{
				name: "task_id"
				in: "path"
				required: true
				schema: {
					type: "string"
				}
			}]
			requestBody: {
				required: true
				content: {
					"application/json": {
						schema: {
							"$ref": "#/components/schemas/ValhallaPipeline"
						}
					}
				}
			}
			responses: {
				"200": {
					description: "Pipeline updated successfully"
					content: {
						"application/json": {
							schema: {
								"$ref": "#/components/schemas/ValhallaPipeline"
							}
						}
					}
				}
				"404": {
					description: "Pipeline not found"
				}
			}
		}
	}
}