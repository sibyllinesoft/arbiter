// Budget Constraint Template
// Implements resource allocation limits based on cost and usage thresholds

package constraints

import "strings"

// BudgetConstraint defines spending and resource usage limits
#BudgetConstraint: {
	// Constraint metadata
	name:        string | *"budget_limit"
	description: string | *"Resource budget constraint with cost and usage limits"
	enabled:     bool | *true
	
	// Budget configuration
	budget: {
		// Maximum allowable spend
		limit: number & >0 | *1000
		
		// Currency or unit type
		currency: string | *"USD"
		
		// Budget period
		period: "hourly" | "daily" | "weekly" | "monthly" | "yearly" | *"monthly"
		
		// Optional: Warning threshold (percentage of limit)
		warning_threshold?: number & >=0 & <=100 | *80
	}
	
	// Resource type being constrained
	resource: {
		type: string | *"compute"
		
		// Optional: Specific resource categories
		categories?: [...string]
		
		// Optional: Resource tags for filtering
		tags?: [string]: string
	}
	
	// Evaluation rules
	rules: {
		// Hard limit enforcement
		enforce_limit: bool | *true
		
		// Action when budget exceeded
		on_exceeded: "block" | "warn" | "log" | *"block"
		
		// Optional: Grace period before enforcement
		grace_period?: string // duration like "1h", "30m"
		
		// Optional: Rollover unused budget
		allow_rollover?: bool | *false
	}
	
	// Cost calculation method
	cost_model: {
		// Pricing model type
		model: "fixed" | "usage_based" | "tiered" | *"usage_based"
		
		// Base rate per unit
		rate: number & >=0 | *1.0
		
		// Optional: Tiered pricing structure
		if model == "tiered" {
			tiers: [...{
				from:  number & >=0
				to:    number & >from | *null
				rate:  number & >=0
			}]
		}
		
		// Optional: Fixed costs (monthly fees, etc.)
		fixed_costs?: [...{
			name:   string
			amount: number & >=0
			period: budget.period
		}]
	}
	
	// Monitoring and alerting
	monitoring: {
		// Check frequency
		check_interval: string | *"1h"
		
		// Alert thresholds
		alerts: [...{
			threshold:  number & >=0 & <=100 // percentage of budget
			recipients: [...string] // email addresses or notification channels
			message?:   string
		}] | *[{
			threshold:  80
			recipients: ["admin@example.com"]
			message:    "Budget at \(threshold)% of limit"
		}]
		
		// Metrics to track
		metrics: [...string] | *["cost", "usage", "remaining_budget"]
	}
	
	// Integration points
	integrations?: {
		// Cost tracking service
		cost_service?: {
			endpoint: string
			auth?: [string]: string
		}
		
		// Notification service
		notifications?: {
			service: "email" | "slack" | "webhook"
			config:  [string]: string
		}
	}
}

// Example budget constraint configurations
examples: {
	// Monthly compute budget with tiered pricing
	monthly_compute: #BudgetConstraint & {
		name:        "monthly_compute_budget"
		description: "Monthly compute resource budget with cost controls"
		
		budget: {
			limit:    5000
			currency: "USD"
			period:   "monthly"
			warning_threshold: 75
		}
		
		resource: {
			type: "compute"
			categories: ["vm", "container", "serverless"]
			tags: environment: "production"
		}
		
		cost_model: {
			model: "tiered"
			rate:  1.0
			tiers: [
				{from: 0, to: 1000, rate: 0.10},
				{from: 1000, to: 5000, rate: 0.08},
				{from: 5000, rate: 0.06}
			]
		}
		
		monitoring: alerts: [
			{threshold: 50, recipients: ["team-lead@example.com"]},
			{threshold: 75, recipients: ["team-lead@example.com", "finance@example.com"]},
			{threshold: 90, recipients: ["team-lead@example.com", "finance@example.com", "cto@example.com"]}
		]
	}
	
	// Daily API usage budget
	daily_api: #BudgetConstraint & {
		name:        "daily_api_budget"
		description: "Daily API call budget with usage-based pricing"
		
		budget: {
			limit:    10000
			currency: "credits"
			period:   "daily"
		}
		
		resource: {
			type: "api_calls"
			categories: ["external_api", "premium_features"]
		}
		
		rules: {
			on_exceeded: "warn"
			allow_rollover: false
		}
		
		cost_model: {
			model: "usage_based"
			rate:  0.01 // per API call
		}
	}
	
	// Project-specific storage budget
	storage_budget: #BudgetConstraint & {
		name:        "project_storage_budget"
		description: "Per-project storage allocation with overage handling"
		
		budget: {
			limit:    100 // GB
			currency: "GB"
			period:   "monthly"
		}
		
		resource: {
			type: "storage"
			tags: project_id: "proj-123"
		}
		
		rules: {
			enforce_limit: false
			on_exceeded:   "log"
			grace_period:  "48h"
		}
		
		cost_model: {
			model: "fixed"
			rate:  0.023 // per GB per month
			fixed_costs: [{
				name:   "storage_management_fee"
				amount: 5.0
				period: "monthly"
			}]
		}
	}
}

// Default budget constraint for quick setup
default_budget: examples.monthly_compute