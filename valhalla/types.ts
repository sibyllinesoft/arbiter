// Generated TypeScript types for Valhalla Agent Benchmarking Framework

export interface Meta {
	version: string;
	timestamp: string;
	cue_version: string;
	arbiter_version: string;
	task_id: string;
	gitlab: GitlabContext;
	trace_id: string;
	parent_span_id?: string;
}

export interface GitlabContext {
	project_id: string;
	merge_request_id?: string;
	branch: string;
	commit_sha?: string;
}

export interface Brief {
	dependency_graph: DependencyGraph;
	hotspots: Hotspot[];
	change_history: ChangeHistory;
	test_coverage: TestCoverage;
	architectural_constraints: ArchitecturalConstraints;
}

export interface DependencyGraph {
	nodes: DependencyNode[];
	edges: DependencyEdge[];
}

export interface DependencyNode {
	id: string;
	type: "module" | "class" | "function" | "file";
	path: string;
	language: string;
}

export interface DependencyEdge {
	from: string;
	to: string;
	type: "imports" | "calls" | "inherits" | "references";
	weight: number;
}

export interface Hotspot {
	path: string;
	category: "complexity" | "churn" | "bugs" | "performance";
	score: number;
	evidence: string[];
	last_modified: string;
}

export interface ChangeHistory {
	recent_commits: Commit[];
	failure_patterns: FailurePattern[];
}

export interface Commit {
	sha: string;
	message: string;
	author: string;
	timestamp: string;
	files_changed: string[];
	additions: number;
	deletions: number;
}

export interface FailurePattern {
	pattern_type: "test_flake" | "build_failure" | "deployment_issue";
	frequency: number;
	affected_files: string[];
	symptoms: string[];
}

export interface TestCoverage {
	overall_percentage: number;
	by_file: FileCoverage[];
	flaky_tests: FlakyTest[];
}

export interface FileCoverage {
	path: string;
	line_coverage: number;
	branch_coverage: number;
	missing_lines: number[];
}

export interface FlakyTest {
	test_name: string;
	flake_rate: number;
	last_failure: string;
}

export interface ArchitecturalConstraints {
	forbidden_patterns: string[];
	required_patterns: string[];
	style_guide_violations: StyleViolation[];
}

export interface StyleViolation {
	file: string;
	line: number;
	rule: string;
	severity: "error" | "warning" | "info";
}

export interface Spec {
	story: Story;
	failing_tests: FailingTest[];
	success_metrics: SuccessMetrics;
	constraints: Constraints;
}

export interface Story {
	title: string;
	description: string;
	acceptance_criteria: AcceptanceCriterion[];
}

export interface AcceptanceCriterion {
	id: string;
	description: string;
	type: "functional" | "non_functional" | "quality";
	priority: "must" | "should" | "could";
	testable: boolean;
}

export interface FailingTest {
	name: string;
	path: string;
	framework: string;
	error_message: string;
	stack_trace?: string;
	reproduction_steps: string[];
	expected_behavior: string;
	actual_behavior: string;
}

export interface SuccessMetrics {
	pass_rate_threshold: number;
	performance_regression_limit: number;
	test_coverage_minimum: number;
	code_quality_threshold: number;
}

export interface Constraints {
	max_files_changed: number;
	max_lines_changed: number;
	breaking_changes_allowed: boolean;
	external_dependencies_allowed: boolean;
	risk_tolerance: "low" | "medium" | "high";
	rollback_plan_required: boolean;
}

export interface Policy {
	budget: Budget;
	stopping: StoppingRules;
	edit_primitives: EditPrimitives;
	risk_limits: RiskLimits;
	selection_rubric: SelectionRubric;
}

export interface Budget {
	total_usd: number;
	total_minutes: number;
	per_phase: PhaseAllocations;
}

export interface PhaseAllocations {
	brief: PhaseAllocation;
	plan: PhaseAllocation;
	implementation: PhaseAllocation;
	review: PhaseAllocation;
	repair: PhaseAllocation;
}

export interface PhaseAllocation {
	usd: number;
	minutes: number;
}

export interface StoppingRules {
	max_attempts_per_phase: number;
	max_candidate_patches: number;
	consecutive_failures_limit: number;
	flake_rate_threshold: number;
	cost_overrun_threshold: number;
	minimum_test_improvement: number;
	maximum_regression_tolerance: number;
}

export interface EditPrimitives {
	allowed_operations: ("insert" | "delete" | "replace" | "move")[];
	max_edit_distance: number;
	preserve_formatting: boolean;
	respect_syntax: boolean;
	forbidden_patterns: string[];
	required_approvals_for: string[];
	checkpoint_frequency: number;
	auto_rollback_triggers: string[];
}

export interface RiskLimits {
	max_cyclomatic_complexity_increase: number;
	max_coupling_increase: number;
	test_timeout_seconds: number;
	max_flaky_test_reruns: number;
	memory_usage_limit_mb: number;
	execution_time_limit_multiplier: number;
	security_scan_required: boolean;
	vulnerability_threshold: "none" | "low" | "medium" | "high";
}

export interface SelectionRubric {
	weights: SelectionWeights;
	criteria: SelectionCriteria;
}

export interface SelectionWeights {
	test_delta: number;
	locality: number;
	minimal_touch: number;
	code_quality: number;
	performance: number;
}

export interface SelectionCriteria {
	test_improvement: TestImprovementCriteria;
	code_locality: CodeLocalityCriteria;
}

export interface TestImprovementCriteria {
	excellent: number;
	good: number;
	acceptable: number;
	poor: number;
}

export interface CodeLocalityCriteria {
	single_file: number;
	single_module: number;
	multiple_modules: number;
	cross_cutting: number;
}

export interface Rubric {
	success_metrics: RubricSuccessMetrics;
	phase_metrics: PhaseMetrics;
	quality_gates: QualityGate[];
	benchmark: Benchmark;
}

export interface RubricSuccessMetrics {
	pass_at_1: number;
	pass_at_k: number;
	cost_per_success: number;
	latency_seconds: number;
	flake_rate: number;
	revert_rate: number;
	spec_coverage: number;
	diff_minimality_score: number;
	logical_cohesion_score: number;
}

export interface PhaseMetrics {
	brief: BriefMetrics;
	plan: PlanMetrics;
	implementation: ImplementationMetrics;
	review: ReviewMetrics;
	repair: RepairMetrics;
}

export interface BriefMetrics {
	insight_accuracy: number;
	analysis_completeness: number;
	processing_time_seconds: number;
}

export interface PlanMetrics {
	strategy_diversity: number;
	feasibility_score: number;
	consensus_strength: number;
}

export interface ImplementationMetrics {
	candidate_quality_distribution: number[];
	syntax_correctness_rate: number;
	test_passing_rate: number;
}

export interface ReviewMetrics {
	selection_accuracy: number;
	false_positive_rate: number;
	review_consistency: number;
}

export interface RepairMetrics {
	convergence_rate: number;
	edit_efficiency: number;
	quality_preservation: number;
}

export interface QualityGate {
	name: string;
	threshold: number;
	actual: number;
	passed: boolean;
	critical: boolean;
}

export interface Benchmark {
	baseline_metrics: BaselineMetrics;
	improvement_delta: ImprovementDelta;
}

export interface BaselineMetrics {
	swe_bench_score: number;
	code_contests_score: number;
	humaneval_score: number;
}

export interface ImprovementDelta {
	accuracy_improvement: number;
	efficiency_improvement: number;
	robustness_improvement: number;
}

export interface Plan {
	enabled: boolean;
	strategy?: Strategy;
	phases?: Phase[];
	target_files?: TargetFile[];
	alternatives?: Alternative[];
	plan_success_criteria?: PlanSuccessCriterion[];
}

export interface Strategy {
	approach: "incremental" | "rewrite" | "refactor" | "patch" | "test_driven";
	rationale: string;
	estimated_complexity: "low" | "medium" | "high";
	risk_assessment: "low" | "medium" | "high";
}

export interface Phase {
	id: string;
	name: string;
	description: string;
	dependencies: string[];
	estimated_effort: EstimatedEffort;
	deliverables: Deliverable[];
	risks: Risk[];
}

export interface EstimatedEffort {
	hours: number;
	complexity: number;
}

export interface Deliverable {
	type: "code" | "tests" | "docs" | "config";
	files: string[];
	description: string;
}

export interface Risk {
	description: string;
	probability: "low" | "medium" | "high";
	impact: "low" | "medium" | "high";
	mitigation: string;
}

export interface TargetFile {
	path: string;
	modification_type: "create" | "modify" | "delete";
	estimated_lines_changed: number;
	rationale: string;
	dependencies: string[];
}

export interface Alternative {
	approach: string;
	pros: string[];
	cons: string[];
	rejected_reason: string;
}

export interface PlanSuccessCriterion {
	criterion: string;
	measurement: string;
	threshold: number | string;
}

export interface Conclave {
	config: ConclaveConfig;
	results: DebateResult[];
}

export interface ConclaveConfig {
	decision_sites: DecisionSites;
	debate_parameters: DebateParameters;
	gating: Gating;
}

export interface DecisionSites {
	plan_enabled: boolean;
	implementation_enabled: boolean;
	review_enabled: boolean;
	repair_enabled: boolean;
}

export interface DebateParameters {
	width: number;
	depth: number;
	diversity: Diversity;
	adjudicator: Adjudicator;
}

export interface Diversity {
	prompts: string[];
	models: string[];
	temperatures: number[];
}

export interface Adjudicator {
	type: "majority" | "weighted" | "llm_judge" | "human";
	weights?: number[];
	judge_model?: string;
}

export interface Gating {
	complexity_threshold: number;
	budget_threshold_usd: number;
	confidence_threshold: number;
	predictors: Predictor[];
}

export interface Predictor {
	name: string;
	threshold: number;
	weight: number;
}

export interface DebateResult {
	decision_site: "plan" | "implementation" | "review" | "repair";
	timestamp: string;
	participants: Participant[];
	rounds: Round[];
	decision: Decision;
	debate_metrics: DebateMetrics;
}

export interface Participant {
	agent_id: string;
	model: string;
	prompt_strategy: string;
	position: string;
}

export interface Round {
	round_number: number;
	arguments: Argument[];
	consensus_metrics: ConsensusMetrics;
}

export interface Argument {
	agent_id: string;
	position: string;
	evidence: string[];
	confidence: number;
}

export interface ConsensusMetrics {
	agreement_score: number;
	position_distribution: number[];
	confidence_variance: number;
}

export interface Decision {
	chosen_option: string;
	confidence: number;
	rationale: string;
	dissenting_opinions: string[];
}

export interface DebateMetrics {
	total_cost_usd: number;
	total_time_seconds: number;
	convergence_round: number;
	consensus_strength: number;
}

export interface Implementation {
	candidates: Candidate[];
	selection: Selection;
	repair_attempts: RepairAttempt[];
}

export interface Candidate {
	id: string;
	timestamp: string;
	patch: Patch;
	test_results: TestResults;
	quality_scores: QualityScores;
	generation_context: GenerationContext;
}

export interface Patch {
	files: PatchFile[];
	metadata: PatchMetadata;
}

export interface PatchFile {
	path: string;
	operation: "create" | "modify" | "delete";
	content?: string;
	diff?: string;
}

export interface PatchMetadata {
	lines_added: number;
	lines_deleted: number;
	files_changed: number;
	estimated_complexity: number;
	syntax_valid: boolean;
	passes_linting: boolean;
	breaking_changes: boolean;
}

export interface TestResults {
	status: "passed" | "failed" | "timeout" | "error";
	total_tests: number;
	passed_tests: number;
	failed_tests: number;
	skipped_tests: number;
	flaky_tests: number;
	execution_time_ms: number;
	memory_usage_mb: number;
	coverage_delta: number;
	failures: TestFailure[];
}

export interface TestFailure {
	test_name: string;
	error_message: string;
	stack_trace?: string;
	category: "assertion" | "timeout" | "exception" | "flake";
}

export interface QualityScores {
	maintainability: number;
	readability: number;
	performance_impact: number;
	security_score: number;
}

export interface GenerationContext {
	model: string;
	prompt_strategy: string;
	temperature: number;
	cost_usd: number;
	generation_time_seconds: number;
}

export interface Selection {
	method: "automated" | "conclave" | "human" | "hybrid";
	selected_candidate_id?: string;
	selection_confidence: number;
	selection_rationale: string;
	clusters: Cluster[];
	candidate_scores: CandidateScore[];
}

export interface Cluster {
	cluster_id: string;
	candidate_ids: string[];
	similarity_threshold: number;
	representative_id: string;
}

export interface CandidateScore {
	candidate_id: string;
	total_score: number;
	component_scores: ComponentScores;
}

export interface ComponentScores {
	test_delta: number;
	locality: number;
	minimal_touch: number;
	code_quality: number;
	performance: number;
}

export interface RepairAttempt {
	attempt_number: number;
	trigger: "test_failure" | "quality_gate" | "performance_regression";
	search_strategy: SearchStrategy;
	result: RepairResult;
	cost_metrics: CostMetrics;
}

export interface SearchStrategy {
	method: "beam_search" | "genetic" | "gradient" | "random";
	beam_width?: number;
	max_iterations: number;
	edit_constraints: EditConstraints;
}

export interface EditConstraints {
	max_edit_distance: number;
	preserve_semantics: boolean;
	allowed_operations: string[];
}

export interface RepairResult {
	status: "success" | "partial" | "failure";
	final_candidate_id?: string;
	iterations_used: number;
	improvement_achieved: number;
}

export interface CostMetrics {
	total_cost_usd: number;
	time_spent_seconds: number;
	api_calls: number;
}

export interface ExecutionState {
	current_phase: "spec" | "brief" | "plan" | "tests" | "implementation" | "review" | "repair" | "merge" | "docs" | "complete";
	phase_history: PhaseHistory[];
	budget_usage: BudgetUsage;
	circuit_breakers: CircuitBreaker[];
	quality_gates: QualityGateStatus[];
}

export interface PhaseHistory {
	phase: string;
	started_at: string;
	completed_at?: string;
	status: "running" | "completed" | "failed" | "skipped";
	cost_usd: number;
	time_seconds: number;
	api_calls: number;
	outputs?: Record<string, any>;
	errors?: string[];
	warnings?: string[];
}

export interface BudgetUsage {
	total_cost_usd: number;
	total_time_seconds: number;
	by_phase: Record<string, PhaseBudgetUsage>;
}

export interface PhaseBudgetUsage {
	cost_usd: number;
	time_seconds: number;
	percentage_of_budget: number;
}

export interface CircuitBreaker {
	name: string;
	status: "closed" | "open" | "half_open";
	failure_count: number;
	last_failure?: string;
	next_attempt?: string;
}

export interface QualityGateStatus {
	gate_name: string;
	status: "pending" | "passed" | "failed";
	threshold: number;
	actual?: number;
	timestamp?: string;
}

export interface ValhallaPipeline {
	meta: Meta;
	brief: Brief;
	spec: Spec;
	policy: Policy;
	rubric: Rubric;
	plan?: Plan;
	conclave?: Conclave;
	implementation?: Implementation;
	execution_state?: ExecutionState;
}

// Utility types for API responses
export interface CreatePipelineRequest {
	pipeline: ValhallaPipeline;
}

export interface CreatePipelineResponse {
	pipeline: ValhallaPipeline;
	task_id: string;
}

export interface GetPipelineStatusResponse {
	pipeline: ValhallaPipeline;
	status: "running" | "completed" | "failed";
}

export interface UpdatePipelineRequest {
	pipeline: Partial<ValhallaPipeline>;
}

export interface UpdatePipelineResponse {
	pipeline: ValhallaPipeline;
}

// Error response types
export interface ErrorResponse {
	error: string;
	message: string;
	details?: Record<string, any>;
}

// Pipeline validation types
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

export interface ValidationError {
	path: string;
	message: string;
	constraint: string;
}

export interface ValidationWarning {
	path: string;
	message: string;
	suggestion: string;
}