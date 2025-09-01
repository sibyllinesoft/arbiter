// Selection Rubric Template
// Implements multi-criteria decision-making framework with weighted scoring

package selection

import "math"

// SelectionRubric defines a structured decision-making framework
#SelectionRubric: {
	// Rubric metadata
	name:        string | *"selection_rubric"
	description: string | *"Multi-criteria selection and evaluation rubric"
	version:     string | *"1.0.0"
	created_at:  string // ISO 8601 timestamp
	
	// Scoring configuration
	scoring: {
		// Scale definition
		scale: {
			type:    "numeric" | "percentage" | "qualitative" | *"numeric"
			min:     number | *1
			max:     number | *5
			step?:   number | *1
			
			// For qualitative scales
			if type == "qualitative" {
				levels: [...{
					value: string
					score: number
					description?: string
				}]
			}
		}
		
		// Aggregation method
		aggregation: "weighted_sum" | "weighted_average" | "min_threshold" | *"weighted_average"
		
		// Minimum passing score
		threshold: number | *0
		
		// Handle ties
		tie_breaking: "highest_priority" | "manual_review" | "additional_criteria" | *"manual_review"
	}
	
	// Evaluation criteria
	criteria: [...#Criterion] & [_, ...] // At least one criterion required
	
	// Validation rules
	validation: {
		// Ensure weights sum to expected value
		require_normalized_weights: bool | *true
		expected_weight_sum:        number | *100 // or 1.0 for decimal weights
		
		// Minimum criteria requirements
		min_criteria: number & >0 | *1
		max_criteria: number | *20
		
		// Score validation
		allow_partial_scoring: bool | *false
		require_justification: bool | *true
	}
	
	// Decision rules
	decision_rules: {
		// Selection mode
		mode: "single_winner" | "top_n" | "threshold_pass" | *"single_winner"
		
		// For top_n mode
		if mode == "top_n" {
			n: number & >0
		}
		
		// Auto-selection rules
		auto_select: bool | *false
		
		// Review requirements
		require_review: bool | *true
		review_threshold?: number // Score above which review is optional
		
		// Veto conditions
		veto_conditions?: [...{
			criterion: string // Reference to criterion name
			condition: "below_threshold" | "zero_score" | "missing_score"
			threshold?: number
			action: "disqualify" | "require_review" | "flag"
		}]
	}
	
	// Option evaluation structure
	evaluation_template: {
		// Option identification
		option_id:   string
		option_name: string
		description?: string
		
		// Scores for each criterion
		scores: {
			for criterion in criteria {
				(criterion.name): {
					value: number & >=scoring.scale.min & <=scoring.scale.max
					justification?: string
					confidence?: "low" | "medium" | "high" | *"medium"
					evaluator?: string
					date?: string
				}
			}
		}
		
		// Calculated results (auto-populated)
		results?: {
			weighted_score: number
			normalized_score: number
			rank?: number
			recommendation: "select" | "reject" | "review" | "conditional"
			flags?: [...string]
		}
		
		// Additional notes
		notes?: string
		attachments?: [...string]
	}
}

// Criterion definition
#Criterion: {
	name:        string
	description: string
	weight:      number & >0 | *10 // Default weight of 10%
	priority:    "critical" | "high" | "medium" | "low" | *"medium"
	
	// Measurement guidance
	measurement: {
		type: "quantitative" | "qualitative" | "binary" | *"qualitative"
		unit?: string
		
		// Scoring guidance
		scoring_guide?: [...{
			score: number
			description: string
			indicators?: [...string]
		}]
		
		// Data sources
		data_sources?: [...string]
		verification_required?: bool | *false
	}
	
	// Constraints
	constraints?: {
		mandatory?: bool | *false // Must score above minimum
		minimum_score?: number
		disqualifying_score?: number
	}
}

// Example rubric configurations
examples: {
	// Cloud provider selection rubric
	cloud_provider: #SelectionRubric & {
		name:        "cloud_provider_selection"
		description: "Evaluation rubric for selecting cloud infrastructure provider"
		created_at:  "2024-01-01T00:00:00Z"
		
		scoring: {
			scale: {
				type: "numeric"
				min:  1
				max:  10
				step: 1
			}
			aggregation: "weighted_average"
			threshold: 7.0
		}
		
		criteria: [
			{
				name:        "cost_efficiency"
				description: "Overall cost competitiveness and value"
				weight:      25
				priority:    "critical"
				measurement: {
					type: "quantitative"
					unit: "USD/month"
					scoring_guide: [
						{score: 10, description: "Significantly below budget", indicators: ["<80% of budget"]},
						{score: 8, description: "Within budget with savings", indicators: ["80-90% of budget"]},
						{score: 6, description: "At budget", indicators: ["90-100% of budget"]},
						{score: 4, description: "Slightly over budget", indicators: ["100-110% of budget"]},
						{score: 2, description: "Significantly over budget", indicators: [">110% of budget"]}
					]
				}
			},
			{
				name:        "performance"
				description: "Compute performance and network latency"
				weight:      30
				priority:    "critical"
				measurement: {
					type: "quantitative"
					scoring_guide: [
						{score: 10, description: "Exceptional performance", indicators: ["<50ms latency", ">95th percentile compute"]},
						{score: 8, description: "High performance", indicators: ["50-100ms latency", "90-95th percentile compute"]},
						{score: 6, description: "Good performance", indicators: ["100-200ms latency", "80-90th percentile compute"]},
						{score: 4, description: "Adequate performance", indicators: ["200-500ms latency", "70-80th percentile compute"]},
						{score: 2, description: "Poor performance", indicators: [">500ms latency", "<70th percentile compute"]}
					]
				}
			},
			{
				name:        "reliability"
				description: "Service uptime and stability"
				weight:      20
				priority:    "high"
				measurement: {
					type: "quantitative"
					unit: "percentage uptime"
					scoring_guide: [
						{score: 10, description: "Industry leading", indicators: [">99.95% uptime"]},
						{score: 8, description: "Excellent", indicators: ["99.9-99.95% uptime"]},
						{score: 6, description: "Good", indicators: ["99.5-99.9% uptime"]},
						{score: 4, description: "Acceptable", indicators: ["99-99.5% uptime"]},
						{score: 2, description: "Unreliable", indicators: ["<99% uptime"]}
					]
				}
				constraints: {
					mandatory: true
					minimum_score: 6
				}
			},
			{
				name:        "feature_completeness"
				description: "Available services and integrations"
				weight:      15
				priority:    "medium"
				measurement: {
					type: "qualitative"
					scoring_guide: [
						{score: 10, description: "All required + advanced features"},
						{score: 8, description: "All required + some advanced"},
						{score: 6, description: "All required features"},
						{score: 4, description: "Most required features"},
						{score: 2, description: "Missing key features"}
					]
				}
			},
			{
				name:        "support_quality"
				description: "Technical support and documentation"
				weight:      10
				priority:    "medium"
				measurement: {
					type: "qualitative"
					scoring_guide: [
						{score: 10, description: "24/7 premium support + excellent docs"},
						{score: 8, description: "Business hours support + good docs"},
						{score: 6, description: "Standard support + adequate docs"},
						{score: 4, description: "Limited support + basic docs"},
						{score: 2, description: "Poor support + inadequate docs"}
					]
				}
			}
		]
		
		decision_rules: {
			mode: "single_winner"
			auto_select: false
			require_review: true
			veto_conditions: [{
				criterion: "reliability"
				condition: "below_threshold"
				threshold: 6
				action: "disqualify"
			}]
		}
	}
	
	// Feature prioritization matrix
	feature_priority: #SelectionRubric & {
		name:        "feature_prioritization"
		description: "Product feature prioritization framework"
		created_at:  "2024-01-01T00:00:00Z"
		
		scoring: {
			scale: {
				type: "numeric"
				min:  0
				max:  100
				step: 5
			}
			aggregation: "weighted_sum"
			threshold: 200 // Total weighted score
		}
		
		criteria: [
			{
				name:        "user_impact"
				description: "Expected impact on user experience and satisfaction"
				weight:      40
				priority:    "critical"
				measurement: {
					type: "qualitative"
					scoring_guide: [
						{score: 100, description: "Game-changing impact", indicators: ["Addresses top user complaints", "Significantly improves core workflow"]},
						{score: 80, description: "High impact", indicators: ["Addresses common pain points", "Improves key workflows"]},
						{score: 60, description: "Moderate impact", indicators: ["Useful improvement", "Enhances secondary workflows"]},
						{score: 40, description: "Low impact", indicators: ["Nice to have", "Minor workflow improvement"]},
						{score: 20, description: "Minimal impact", indicators: ["Edge case improvement", "Cosmetic changes"]}
					]
				}
			},
			{
				name:        "business_value"
				description: "Revenue impact and strategic alignment"
				weight:      35
				priority:    "critical"
				measurement: {
					type: "quantitative"
					unit: "expected revenue impact"
					scoring_guide: [
						{score: 100, description: "Major revenue driver", indicators: [">$100K annual impact"]},
						{score: 80, description: "Significant value", indicators: ["$50K-$100K annual impact"]},
						{score: 60, description: "Moderate value", indicators: ["$20K-$50K annual impact"]},
						{score: 40, description: "Minor value", indicators: ["$5K-$20K annual impact"]},
						{score: 20, description: "Minimal value", indicators: ["<$5K annual impact"]}
					]
				}
			},
			{
				name:        "implementation_effort"
				description: "Development effort and complexity (inverse scoring)"
				weight:      25
				priority:    "high"
				measurement: {
					type: "quantitative"
					unit: "development days"
					scoring_guide: [
						{score: 100, description: "Very quick win", indicators: ["<1 week", "Minimal complexity"]},
						{score: 80, description: "Quick implementation", indicators: ["1-2 weeks", "Low complexity"]},
						{score: 60, description: "Moderate effort", indicators: ["2-4 weeks", "Medium complexity"]},
						{score: 40, description: "High effort", indicators: ["1-2 months", "High complexity"]},
						{score: 20, description: "Major undertaking", indicators: [">2 months", "Very high complexity"]}
					]
				}
			}
		]
		
		decision_rules: {
			mode: "top_n"
			n: 5 // Select top 5 features for next sprint
			auto_select: true
			require_review: false
			review_threshold: 300
		}
	}
	
	// Simple vendor evaluation
	vendor_evaluation: #SelectionRubric & {
		name:        "vendor_evaluation"
		description: "General vendor assessment rubric"
		created_at:  "2024-01-01T00:00:00Z"
		
		scoring: {
			scale: {
				type: "qualitative"
				levels: [
					{value: "excellent", score: 5, description: "Exceeds expectations"},
					{value: "good", score: 4, description: "Meets expectations well"},
					{value: "satisfactory", score: 3, description: "Meets basic requirements"},
					{value: "poor", score: 2, description: "Below expectations"},
					{value: "unacceptable", score: 1, description: "Does not meet requirements"}
				]
			}
			aggregation: "weighted_average"
			threshold: 3.5
		}
		
		criteria: [
			{name: "pricing", description: "Cost competitiveness", weight: 30, priority: "critical"},
			{name: "quality", description: "Product/service quality", weight: 25, priority: "critical"},
			{name: "reliability", description: "Track record and stability", weight: 20, priority: "high"},
			{name: "support", description: "Customer service quality", weight: 15, priority: "medium"},
			{name: "innovation", description: "Technology leadership", weight: 10, priority: "low"}
		]
		
		decision_rules: {
			mode: "threshold_pass"
			require_review: true
		}
	}
}

// Default rubric for quick setup
default_rubric: examples.vendor_evaluation