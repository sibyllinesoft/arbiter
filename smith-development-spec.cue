// Smith Platform Development Specification
// Formalized from TODO.md requirements - Hardening and Production Readiness

package smith

import "github.com/arbiter-framework/schemas/development"

// Smith Platform Development Specification
SmithDevelopmentSpec: development.#Specification & {
	name: "smith-platform-hardening"
	version: "v2.0.0"
	
	overview: {
		description: "Production hardening for Smith secure AI execution platform"
		goal: "Transform working prototype into production-ready, battle-tested system"
		timeline: "8 phases with measurable acceptance gates"
	}
	
	// Phase 1: Correctness & Safety Proofs
	phase1_correctness: {
		name: "Correctness & Safety Proofs"
		objective: "Prove system fails safely under attack scenarios"
		
		requirements: {
			policy_fuzzing: {
				description: "Property-based testing of policy engine"
				acceptance_criteria: [
					"Zero unexpected admits across fuzz testing",
					"Golden suite unchanged across policy version flips", 
					"95%+ quarantine entries have actionable rule_ref"
				]
				implementation: {
					tool: "Property-based generator over Atom.Use|Macro.Run"
					bounds: "Randomized params within schema + near-miss cases"
					assertions: "Invariants validation (write atoms denied in strict, hosts in allowlist)"
				}
			}
			
			replay_harness: {
				description: "Shadow testing against production traffic"
				acceptance_criteria: [
					"24h of sdlc.raw.* replayed against new policy digest",
					"Admit/deny deltas flagged for review",
					"No golden scenario behavior changes"
				]
				implementation: {
					mechanism: "Re-run production intents in shadow mode"
					validation: "Behavior delta analysis and approval workflow"
				}
			}
			
			adversarial_testing: {
				description: "Canary atoms for attack detection"
				acceptance_criteria: [
					"Malformed path fs.write.v1 correctly denied",
					"HTTP redirect chain attacks blocked",
					"Oversized git.clone.v1 killed within quotas"
				]
				implementation: {
					test_cases: "Malformed paths, redirect chains, resource exhaustion"
					expected_behavior: "Deny or sandbox kill within resource limits"
				}
			}
		}
	}
	
	// Phase 2: Performance & Capacity
	phase2_performance: {
		name: "Performance & Capacity"
		objective: "Prove headroom and graceful degradation under load"
		
		requirements: {
			slo_framework: {
				description: "Per-atom and system-level SLOs"
				acceptance_criteria: [
					"All SLOs green at 5× baseline load",
					"Graceful degradation at 10× (queuing, no drops)",
					"Zero ordering violations within episode"
				]
				targets: {
					fs_read_p95: "≤30ms"
					fs_read_p99: "≤60ms" 
					http_fetch_p95: "≤300ms"
					admission_p99: "≤5ms"
				}
			}
			
			jetstream_optimization: {
				description: "NATS JetStream tuning for scale"
				acceptance_criteria: [
					"Subject-hash sharding by episode for ordering",
					"Consumer lag < threshold triggers backpressure",
					"MaxAckPending tuned to executor concurrency"
				]
				implementation: {
					streams: ["sdlc.raw", "atoms.vetted", "atoms.results", "audit.*"]
					consumers: "Pull-based with limited AckWait"
					sharding: "Subject-hash by episode, partitioned executors"
				}
			}
			
			backpressure_handling: {
				description: "Graceful load shedding under overload"
				acceptance_criteria: [
					"Admission only publishes if atoms.vetted lag < threshold",
					"Overload routed to sdlc.quarantine.backpressure",
					"Retriable reason codes for client retry logic"
				]
			}
		}
	}
	
	// Phase 3: Contract Freezes
	phase3_contracts: {
		name: "Contract Freezes"
		objective: "Stabilize APIs to enable safe iteration"
		
		requirements: {
			policy_abi_v1: {
				description: "Versioned policy bundle schema"
				acceptance_criteria: [
					"Bundle ABI version validation on Admission startup",
					"Startup fails if bundle ABI ≠ supported version",
					"CI fails on ABI/subject/builder changes"
				]
			}
			
			subject_abi: {
				description: "Centralized NATS subject management"
				acceptance_criteria: [
					"smith-bus crate exports ALL subjects",
					"Raw strings forbidden in CI",
					"Subject changes require version bump"
				]
			}
			
			idempotency_keys: {
				description: "Deduplication for reliable execution"
				acceptance_criteria: [
					"idem_key = hash(run_id, episode, step_idx)",
					"Executors upsert results by idem_key",
					"Duplicate sends don't double-execute"
				]
			}
			
			result_schema_v1: {
				description: "Locked result format with extensibility"
				acceptance_criteria: [
					"Required fields: ok, status, latency_ms, bytes, policy_digest, commit, layer, name, mode, exp_id, idem_key",
					"Validator denies unknown fields except x_meta",
					"Schema changes require major version bump"
				]
			}
		}
	}
	
	// Phase 4: Iteration Speed
	phase4_iteration: {
		name: "Iteration Speed"
		objective: "Make behavior changes cheap, visible, reversible"
		
		requirements: {
			behavior_pack_diff: {
				description: "Human-readable change summaries"
				acceptance_criteria: [
					"Pack changes emit enabled/disabled atoms/macros/playbooks",
					"Parameter diffs with risk delta analysis",
					"Silent scope expansion blocked in CI"
				]
			}
			
			auto_regression_gate: {
				description: "Automated quality gates for changes"
				acceptance_criteria: [
					"Pack/digest changes run golden + smoke tests",
					"Merge blocked if ok_rate↓ or p95↑ beyond thresholds",
					"Change-and-bench round-trip ≤ 5 minutes"
				]
			}
			
			layered_ab_testing: {
				description: "Independent A/B at each layer"
				acceptance_criteria: [
					"Switchboard supports playbook|macro|atom splits",
					"Shadow testing at any layer",
					"Gradual rollout with automatic rollback triggers"
				]
			}
		}
	}
	
	// Phase 5: Multi-Tenant & Blast-Radius Control
	phase5_multitenancy: {
		name: "Multi-Tenant & Blast-Radius Control"
		objective: "Safely host many agents/tools"
		
		requirements: {
			nats_isolation: {
				description: "NATS accounts for tenant separation"
				acceptance_criteria: [
					"Per-tenant subjects (acme.*) with shared stream quotas",
					"Tenant A cannot see or starve Tenant B",
					"Budget violations quarantined with clear reasons"
				]
			}
			
			resource_partitions: {
				description: "Isolated executor pools per tenant"
				acceptance_criteria: [
					"Executor pools per tenant",
					"cgroup ceilings in sandbox profiles",
					"Resource exhaustion contained to tenant"
				]
			}
		}
	}
	
	// Phase 6: Supply Chain Attestation
	phase6_attestation: {
		name: "Supply Chain Attestation" 
		objective: "Prove what ran with cryptographic guarantees"
		
		requirements: {
			signing_verification: {
				description: "Cosign bundle and container verification"
				acceptance_criteria: [
					"Policy bundles and container digests signed",
					"Admission/Executor verify signatures on boot",
					"Boot fails if signatures invalid"
				]
			}
			
			provenance_metadata: {
				description: "SLSA-style build attestation"
				acceptance_criteria: [
					"Metadata includes git SHA, build runner, toolchain",
					"Results carry policy_digest, executor_image_digest, bundle_sig_ok",
					"Attestation fields in all benchmark results"
				]
			}
		}
	}
	
	// Phase 7: Operations & UX Polish
	phase7_operations: {
		name: "Operations & UX Polish"
		objective: "Production-ready operations and monitoring"
		
		requirements: {
			observability_dashboard: {
				description: "RED + USE metrics dashboard"
				acceptance_criteria: [
					"Admission latency, admit/deny rates tracking",
					"Vetted lag, executor CPU/RSS monitoring",
					"Top deny reasons analysis and alerting"
				]
			}
			
			operational_runbooks: {
				description: "Incident response procedures"
				acceptance_criteria: [
					"Backpressure handling procedures",
					"Digest flip and hotfix rollback procedures", 
					"Quarantine triage workflows",
					"15-minute incident resolution rehearsals"
				]
			}
			
			chaos_engineering: {
				description: "Failure mode validation"
				acceptance_criteria: [
					"Kill Admission/executor/NATS node scenarios",
					"Self-healing verification",
					"No data loss with JetStream HA"
				]
			}
		}
	}
	
	// Phase 8: Extended Capabilities
	phase8_capabilities: {
		name: "Extended Capabilities"
		objective: "Complete capability triangle with new atoms/macros"
		
		requirements: {
			archive_capabilities: {
				description: "Archive.Read atom with quotas"
				acceptance_criteria: [
					"zip/tar reading with size/entry limits",
					"Workspace.Unpack macro wrapper",
					"Quota enforcement and proper denials in strict mode"
				]
			}
			
			sqlite_capabilities: {
				description: "SQLite.Query read-only atom"
				acceptance_criteria: [
					"Read-only SQLite querying",
					"Report.RunQuery macro wrapper",
					"Query timeout and result size limits"
				]
			}
			
			benchmark_reporting: {
				description: "Bench.Report macro for artifacts"
				acceptance_criteria: [
					"Summary artifact generation for every run",
					"Automated performance regression detection",
					"Historical trend analysis"
				]
			}
		}
	}
	
	// Immediate Next Actions
	immediate_actions: {
		description: "Concrete tasks for this week"
		priorities: [
			"Implement policy fuzzing + replay with CI integration",
			"Add idempotency keys to all execution paths",
			"Stand up SLO dashboard + load test harness", 
			"Add behavior-pack diff linter + auto-regression gate",
			"Ship bundle/image signing with boot-time verification"
		]
	}
	
	// Success Metrics
	success_metrics: {
		correctness: {
			zero_unexpected_admits: "100% compliance across fuzz and replay testing"
			golden_suite_stability: "No behavior changes across policy version transitions"
			quarantine_actionability: "≥95% entries have actionable rule_ref"
		}
		
		performance: {
			slo_compliance: "All SLOs green at 5× baseline, graceful degradation at 10×"
			ordering_guarantee: "Zero violations within episode boundaries"
			response_times: "fs.read p95≤30ms, http.fetch p95≤300ms, admission p99≤5ms"
		}
		
		reliability: {
			contract_stability: "API/ABI changes fail CI deterministically"
			idempotency: "Network retries never cause double-execution"
			deployment_safety: "15-minute incident resolution in rehearsals"
		}
		
		operational_excellence: {
			iteration_speed: "Change-and-bench cycle ≤5 minutes"
			observability: "Complete RED/USE dashboard coverage"
			chaos_resilience: "Self-healing under component failures"
		}
	}
}