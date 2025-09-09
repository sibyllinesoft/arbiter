package arbiter

// Comprehensive Arbiter Application Specification with Friendly View Tab
// This specification includes a complete "friendly view" UI feature with 
// expandable accordion sections for user-friendly CUE data visualization

{
	// 1. PRODUCT SPECIFICATION
	product: {
		name: "Arbiter - CUE-Based Application Specification & Validation Platform"
		goals: [
			"Provide comprehensive CUE-based application specification and validation",
			"Enable declarative infrastructure and application modeling",
			"Support AI-friendly automation and agent-first workflows",
			"Generate complete application stacks from CUE specifications",
			"Deliver intuitive visual interfaces for complex specification management"
		]
		constraints: [
			"Must maintain backward compatibility with v1 specifications",
			"API response times must be under 500ms for specification validation",
			"Support real-time collaboration on specification editing",
			"Comply with enterprise security standards for sensitive application data"
		]
		roles: [
			"admin",
			"architect", 
			"developer",
			"viewer",
			"guest"
		]
		slos: {
			p95_api_response_ms: 500
			uptime: "99.95%"
			spec_validation_accuracy: "99.9%"
		}
	}

	// 2. DOMAIN VOCABULARY
	domain: {
		enums: {
			spec_status: ["DRAFT", "VALIDATING", "VALID", "INVALID", "ARCHIVED"]
			spec_version: ["v1", "v2"]
			generation_status: ["QUEUED", "GENERATING", "COMPLETE", "FAILED"]
			validation_severity: ["INFO", "WARNING", "ERROR", "CRITICAL"]
			component_type: ["SERVICE", "API", "UI_COMPONENT", "DATABASE", "INFRASTRUCTURE"]
			deployment_target: ["kubernetes", "docker", "serverless", "bare-metal"]
			language: ["typescript", "python", "rust", "go", "javascript"]
		}
		permissions: {
			view_specs: ["admin", "architect", "developer", "viewer", "guest"]
			create_specs: ["admin", "architect", "developer"]
			edit_specs: ["admin", "architect", "developer"]
			validate_specs: ["admin", "architect", "developer", "viewer"]
			generate_code: ["admin", "architect", "developer"]
			deploy_specs: ["admin", "architect"]
			manage_users: ["admin"]
			view_friendly: ["admin", "architect", "developer", "viewer", "guest"]
		}
	}

	// 3. COMPONENT SCHEMAS
	components: {
		schemas: {
			SpecificationDocument: {
				example: {
					id: "spec-uuid-123"
					name: "ecommerce-platform"
					version: "v2"
					status: "VALID"
					created_at: "2024-09-08T12:00:00Z"
					updated_at: "2024-09-08T14:30:00Z"
					author: "architect@company.com"
					content: {
						product: {
							name: "E-commerce Platform"
							goals: ["Enable online sales", "Support inventory management"]
						}
						ui: {
							routes: [
								{
									id: "products:list"
									path: "/products"
									capabilities: ["view_products"]
									components: ["ProductGrid", "SearchFilter"]
								}
							]
						}
					}
				}
				rules: {
					version_immutable: "Once set, version cannot be changed"
					status_transitions: {
						DRAFT: ["VALIDATING", "ARCHIVED"]
						VALIDATING: ["VALID", "INVALID", "DRAFT"]
						VALID: ["DRAFT", "ARCHIVED"]
						INVALID: ["DRAFT", "ARCHIVED"]
						ARCHIVED: ["DRAFT"]
					}
				}
			}

			ValidationResult: {
				example: {
					id: "validation-uuid-456"
					spec_id: "spec-uuid-123"
					status: "VALID"
					errors: []
					warnings: [
						{
							severity: "WARNING"
							message: "Consider adding more specific type constraints"
							line: 42
							column: 15
							path: "ui.routes[0].components"
						}
					]
					validation_time_ms: 150
					validated_at: "2024-09-08T14:30:00Z"
				}
			}

			FriendlyViewSection: {
				example: {
					id: "section-product-info"
					title: "Product Information"
					description: "Application goals, metadata, and business context"
					icon: "info-circle"
					expanded: true
					order: 1
					content_path: "product"
					grid_layout: {
						columns: 2
						gap: "medium"
						responsive: true
					}
					components: [
						{
							type: "info-card"
							title: "Goals & Objectives"
							data_path: "product.goals"
							display_format: "bulleted-list"
						},
						{
							type: "metadata-table"
							title: "Application Metadata"
							data_path: "metadata"
							display_format: "key-value-pairs"
						}
					]
				}
			}

			FriendlyViewConfig: {
				example: {
					id: "friendly-view-config"
					title: "Specification Overview"
					description: "Interactive, user-friendly view of CUE specification data"
					layout: "accordion-grid"
					theme: "modern"
					sections: [
						{
							id: "product-info"
							title: "Product Information"
							description: "Goals, constraints, and business context"
							icon: "building"
							expanded: true
							order: 1
						},
						{
							id: "ui-routes"
							title: "UI Routes & Components"
							description: "User interface structure and navigation"
							icon: "map"
							expanded: false
							order: 2
						},
						{
							id: "services-config"
							title: "Services & Configuration"
							description: "Backend services, APIs, and system configuration"
							icon: "server"
							expanded: false
							order: 3
						},
						{
							id: "flows-states"
							title: "Flows & State Machines"
							description: "User workflows and application state management"
							icon: "workflow"
							expanded: false
							order: 4
						},
						{
							id: "locators-testing"
							title: "Locators & Testing"
							description: "Test selectors, scenarios, and quality gates"
							icon: "test-tube"
							expanded: false
							order: 5
						},
						{
							id: "deployment-ops"
							title: "Deployment & Operations"
							description: "Infrastructure, deployment targets, and operational configuration"
							icon: "cloud"
							expanded: false
							order: 6
						}
					]
				}
			}
		}
	}

	// 4. API PATHS
	paths: {
		"/api/v1/specifications": {
			get: {
				response: {
					example: {
						specifications: [
							{
								id: "spec-uuid-123"
								name: "ecommerce-platform"
								version: "v2"
								status: "VALID"
								created_at: "2024-09-08T12:00:00Z"
								author: "architect@company.com"
							}
						]
						pagination: {
							page: 1
							per_page: 20
							total: 5
							total_pages: 1
						}
					}
				}
			}
			post: {
				request: {
					example: {
						name: "new-application"
						version: "v2"
						content: {
							product: {
								name: "New Application"
								goals: ["Solve business problem"]
							}
						}
					}
				}
				response: {
					$ref: "#/components/schemas/SpecificationDocument"
				}
				status: 201
			}
		}

		"/api/v1/specifications/{id}": {
			get: {
				response: {
					$ref: "#/components/schemas/SpecificationDocument"
				}
			}
			put: {
				request: {
					$ref: "#/components/schemas/SpecificationDocument"
				}
				response: {
					$ref: "#/components/schemas/SpecificationDocument"
				}
			}
			delete: {
				status: 204
			}
		}

		"/api/v1/specifications/{id}/validate": {
			post: {
				response: {
					$ref: "#/components/schemas/ValidationResult"
				}
				status: 200
			}
		}

		"/api/v1/specifications/{id}/friendly-view": {
			get: {
				response: {
					example: {
						spec_id: "spec-uuid-123"
						view_config: {
							$ref: "#/components/schemas/FriendlyViewConfig"
						}
						processed_data: {
							"product-info": {
								goals: ["Enable online sales", "Support inventory management"]
								metadata: {
									name: "ecommerce-platform"
									version: "1.0.0"
								}
							}
							"ui-routes": {
								routes_count: 5
								components_count: 12
								capabilities: ["view_products", "manage_cart"]
							}
							"services-config": {
								services: ["api-service", "payment-service"]
								deployment_target: "kubernetes"
							}
						}
					}
				}
			}
		}

		"/api/v1/friendly-view/config": {
			get: {
				response: {
					$ref: "#/components/schemas/FriendlyViewConfig"
				}
			}
			put: {
				request: {
					$ref: "#/components/schemas/FriendlyViewConfig"
				}
				response: {
					$ref: "#/components/schemas/FriendlyViewConfig"
				}
			}
		}
	}

	// 5. UI ROUTES
	ui: {
		routes: [
			{
				id: "dashboard:main"
				path: "/"
				capabilities: ["view_specs"]
				components: [
					"DashboardHeader",
					"SpecificationGrid",
					"QuickActions",
					"RecentActivity"
				]
			},
			{
				id: "specs:list"
				path: "/specifications"
				capabilities: ["view_specs"]
				components: [
					"SpecificationTable",
					"StatusFilter",
					"SearchBar",
					"CreateSpecButton",
					"BulkActions"
				]
			},
			{
				id: "specs:detail"
				path: "/specifications/{id}"
				capabilities: ["view_specs"]
				components: [
					"SpecHeader",
					"SpecTabs",
					"CueEditor",
					"ValidationPanel",
					"ActionButtons"
				]
			},
			{
				id: "specs:friendly-view"
				path: "/specifications/{id}/friendly"
				capabilities: ["view_friendly"]
				components: [
					"FriendlyViewHeader",
					"AccordionContainer",
					"ProductInfoSection",
					"UIRoutesSection",
					"ServicesSection",
					"FlowsSection",
					"LocatorsSection",
					"DeploymentSection",
					"GridLayoutManager",
					"SectionToggleControls"
				]
			},
			{
				id: "specs:create"
				path: "/specifications/new"
				capabilities: ["create_specs"]
				components: [
					"SpecWizard",
					"VersionSelector",
					"TemplateChooser",
					"CueEditor",
					"PreviewPane"
				]
			},
			{
				id: "specs:edit"
				path: "/specifications/{id}/edit"
				capabilities: ["edit_specs"]
				components: [
					"EditHeader",
					"CueEditor",
					"LiveValidation",
					"SidePanel",
					"SaveActions"
				]
			},
			{
				id: "validation:results"
				path: "/validation/{id}"
				capabilities: ["validate_specs"]
				components: [
					"ValidationSummary",
					"ErrorsList",
					"WarningsList",
					"SuccessIndicators",
					"ValidationMetrics"
				]
			}
		]
	}

	// 6. LOCATORS - Stable CSS selectors for testing
	locators: {
		// Navigation
		"nav:dashboard": "[data-testid='nav-dashboard']"
		"nav:specifications": "[data-testid='nav-specifications']"
		"nav:friendly-view": "[data-testid='nav-friendly-view']"
		
		// Dashboard
		"grid:specifications": "[data-testid='spec-grid']"
		"card:specification": "[data-testid^='spec-card-']"
		"btn:create-spec": "[data-testid='create-spec-btn']"
		"search:global": "[data-testid='global-search']"
		
		// Specification List
		"table:specifications": "[data-testid='specs-table']"
		"row:specification": "[data-testid^='spec-row-']"
		"filter:status": "[data-testid='status-filter']"
		"filter:version": "[data-testid='version-filter']"
		"btn:bulk-actions": "[data-testid='bulk-actions-btn']"
		
		// Specification Detail
		"header:spec": "[data-testid='spec-header']"
		"tabs:spec": "[data-testid='spec-tabs']"
		"tab:code": "[data-testid='code-tab']"
		"tab:friendly": "[data-testid='friendly-tab']"
		"tab:validation": "[data-testid='validation-tab']"
		"editor:cue": "[data-testid='cue-editor']"
		"panel:validation": "[data-testid='validation-panel']"
		"btn:validate": "[data-testid='validate-btn']"
		"btn:generate": "[data-testid='generate-btn']"
		"btn:save": "[data-testid='save-btn']"
		
		// Friendly View Components
		"container:friendly-view": "[data-testid='friendly-view-container']"
		"header:friendly-view": "[data-testid='friendly-view-header']"
		"container:accordion": "[data-testid='accordion-container']"
		"section:accordion": "[data-testid^='accordion-section-']"
		"toggle:section": "[data-testid^='section-toggle-']"
		"grid:section": "[data-testid^='section-grid-']"
		"card:component": "[data-testid^='component-card-']"
		"btn:expand-all": "[data-testid='expand-all-btn']"
		"btn:collapse-all": "[data-testid='collapse-all-btn']"
		"btn:grid-layout": "[data-testid='grid-layout-btn']"
		"btn:list-layout": "[data-testid='list-layout-btn']"
		
		// Product Information Section
		"section:product-info": "[data-testid='product-info-section']"
		"card:goals": "[data-testid='goals-card']"
		"card:constraints": "[data-testid='constraints-card']"
		"card:roles": "[data-testid='roles-card']"
		"card:slos": "[data-testid='slos-card']"
		"list:goals": "[data-testid='goals-list']"
		"list:constraints": "[data-testid='constraints-list']"
		"badge:role": "[data-testid^='role-badge-']"
		"metric:slo": "[data-testid^='slo-metric-']"
		
		// UI Routes Section
		"section:ui-routes": "[data-testid='ui-routes-section']"
		"card:route": "[data-testid^='route-card-']"
		"badge:capability": "[data-testid^='capability-badge-']"
		"list:components": "[data-testid='route-components-list']"
		"summary:routes": "[data-testid='routes-summary']"
		
		// Services Section
		"section:services": "[data-testid='services-section']"
		"card:service": "[data-testid^='service-card-']"
		"badge:service-type": "[data-testid^='service-type-badge-']"
		"config:deployment": "[data-testid='deployment-config']"
		"ports:service": "[data-testid='service-ports']"
		
		// Flows Section
		"section:flows": "[data-testid='flows-section']"
		"card:flow": "[data-testid^='flow-card-']"
		"steps:flow": "[data-testid='flow-steps']"
		"diagram:state-machine": "[data-testid='state-machine-diagram']"
		"state:node": "[data-testid^='state-node-']"
		"transition:edge": "[data-testid^='transition-edge-']"
		
		// Locators Section
		"section:locators": "[data-testid='locators-section']"
		"table:locators": "[data-testid='locators-table']"
		"cell:locator-name": "[data-testid^='locator-name-']"
		"cell:locator-selector": "[data-testid^='locator-selector-']"
		"btn:test-locator": "[data-testid^='test-locator-btn-']"
		
		// Deployment Section
		"section:deployment": "[data-testid='deployment-section']"
		"card:environment": "[data-testid^='env-card-']"
		"config:ops": "[data-testid='ops-config']"
		"flags:feature": "[data-testid='feature-flags']"
		"security:config": "[data-testid='security-config']"
		
		// Common Elements
		"modal:confirm": "[data-testid='confirm-modal']"
		"btn:confirm": "[data-testid='confirm-btn']"
		"btn:cancel": "[data-testid='cancel-btn']"
		"alert:success": "[data-testid='success-alert']"
		"alert:error": "[data-testid='error-alert']"
		"alert:warning": "[data-testid='warning-alert']"
		"spinner:loading": "[data-testid='loading-spinner']"
		"tooltip:help": "[data-testid='help-tooltip']"
	}

	// 7. FLOWS - Complete user workflows
	flows: [
		{
			id: "create-specification-with-friendly-view"
			preconditions: {
				role: "architect"
				seed: []
			}
			steps: [
				{ visit: "dashboard:main" },
				{ expect: { locator: "btn:create-spec", state: "visible" } },
				{ click: "btn:create-spec" },
				{ expect: { locator: "wizard:spec", state: "visible" } },
				{ fill: { locator: "input:spec-name", value: "test-application" } },
				{ click: "select:version" },
				{ fill: { locator: "select:version", value: "v2" } },
				{ click: "btn:continue" },
				{ expect: { locator: "editor:cue", state: "visible" } },
				{ fill: { locator: "editor:cue", value: "product: { name: \"Test App\", goals: [\"Test goal\"] }" } },
				{ click: "btn:save" },
				{ expect_api: {
					method: "POST"
					path: "/api/v1/specifications"
					status: 201
				} },
				{ click: "tab:friendly" },
				{ expect: { locator: "container:friendly-view", state: "visible" } },
				{ expect: { locator: "section:product-info", state: "visible" } },
				{ expect: { locator: "card:goals", text: { contains: "Test goal" } } }
			]
		},
		{
			id: "explore-friendly-view-accordion"
			preconditions: {
				role: "developer"
				seed: [
					{
						factory: "specification"
						as: "sample_spec"
						with: {
							name: "sample-app"
							version: "v2"
							status: "VALID"
						}
					}
				]
			}
			steps: [
				{ visit: "specs:friendly-view" },
				{ expect: { locator: "container:accordion", state: "visible" } },
				{ expect: { locator: "section:product-info", state: "visible" } },
				{ click: "toggle:section[data-section='ui-routes']" },
				{ expect: { locator: "section:ui-routes", state: "visible" } },
				{ expect: { locator: "grid:section[data-section='ui-routes']", state: "visible" } },
				{ click: "toggle:section[data-section='services-config']" },
				{ expect: { locator: "section:services", state: "visible" } },
				{ click: "btn:expand-all" },
				{ expect: { locator: "section:flows", state: "visible" } },
				{ expect: { locator: "section:locators", state: "visible" } },
				{ expect: { locator: "section:deployment", state: "visible" } },
				{ click: "btn:grid-layout" },
				{ expect: { locator: "grid:section", state: "visible" } },
				{ click: "btn:collapse-all" },
				{ expect: { locator: "section:ui-routes", state: "hidden" } }
			]
		},
		{
			id: "validate-specification-from-friendly-view"
			preconditions: {
				role: "architect"
				seed: [
					{
						factory: "specification"
						as: "invalid_spec"
						with: {
							name: "invalid-spec"
							version: "v2"
							status: "DRAFT"
						}
					}
				]
			}
			steps: [
				{ visit: "specs:friendly-view" },
				{ expect: { locator: "header:friendly-view", state: "visible" } },
				{ click: "btn:validate" },
				{ expect_api: {
					method: "POST"
					path: "/api/v1/specifications/{id}/validate"
					status: 200
				} },
				{ expect: { locator: "alert:warning", state: "visible" } },
				{ click: "tab:validation" },
				{ expect: { locator: "panel:validation", state: "visible" } },
				{ expect: { locator: "list:warnings", state: "visible" } }
			]
		}
	]

	// 8. TESTABILITY CONFIGURATION
	testability: {
		network: {
			stub: true
			passthrough: [
				"/api/v1/health",
				"/api/v1/version",
				"/api/v1/specifications/*/friendly-view"
			]
		}
		clock: {
			fixed: "2024-09-08T12:00:00Z"
		}
		seeds: {
			factories: {
				specification: {
					id: "{{faker.uuid}}"
					name: "{{faker.lorem.slug}}"
					version: "v2"
					status: "DRAFT"
					created_at: "{{faker.date.recent}}"
					updated_at: "{{faker.date.recent}}"
					author: "{{faker.internet.email}}"
					content: {
						product: {
							name: "{{faker.commerce.productName}}"
							goals: ["{{faker.company.catchPhrase}}"]
						}
						metadata: {
							name: "{{faker.lorem.slug}}"
							version: "1.0.0"
						}
					}
				}
			}
		}
		quality_gates: {
			a11y: {
				axe_severity_max: "moderate"
				wcag_level: "AA"
			}
			perf: {
				p95_nav_ms_max: 1000
				friendly_view_render_ms_max: 2000
			}
			visual: {
				accordion_animation_smooth: true
				grid_layout_responsive: true
			}
		}
	}

	// 9. OPS CONFIGURATION
	ops: {
		feature_flags: [
			"friendly_view_enabled",
			"accordion_animations",
			"grid_layout_toggle",
			"real_time_validation",
			"collaboration_mode",
			"export_friendly_view",
			"section_customization",
			"advanced_filtering"
		]
		environments: [
			"development",
			"staging",
			"production"
		]
		security: {
			auth: "jwt"
			scopes: [
				"specs:read",
				"specs:write",
				"specs:validate",
				"specs:generate",
				"friendly-view:read",
				"friendly-view:customize"
			]
		}
		monitoring: {
			metrics: [
				"friendly_view_usage",
				"section_expansion_rates",
				"validation_performance",
				"user_engagement_time"
			]
		}
	}

	// 10. STATE MODELS - UI state machines for friendly view
	stateModels: {
		friendly_view_accordion: {
			id: "friendly_view_accordion"
			initial: "loading"
			states: {
				loading: {
					on: {
						DATA_LOADED: "ready"
						ERROR: "error"
					}
				}
				ready: {
					on: {
						EXPAND_SECTION: "expanding"
						COLLAPSE_SECTION: "collapsing" 
						EXPAND_ALL: "expanding_all"
						COLLAPSE_ALL: "collapsing_all"
						TOGGLE_LAYOUT: "changing_layout"
						REFRESH: "loading"
					}
				}
				expanding: {
					on: {
						COMPLETE: "ready"
						ERROR: "ready"
					}
				}
				collapsing: {
					on: {
						COMPLETE: "ready" 
						ERROR: "ready"
					}
				}
				expanding_all: {
					on: {
						COMPLETE: "ready"
						ERROR: "ready"
					}
				}
				collapsing_all: {
					on: {
						COMPLETE: "ready"
						ERROR: "ready"
					}
				}
				changing_layout: {
					on: {
						COMPLETE: "ready"
						ERROR: "ready"
					}
				}
				error: {
					on: {
						RETRY: "loading"
						DISMISS: "ready"
					}
				}
			}
		}
		
		section_interaction: {
			id: "section_interaction"
			initial: "collapsed"
			states: {
				collapsed: {
					on: {
						EXPAND: "expanding"
						HOVER: "hovered"
					}
				}
				expanded: {
					on: {
						COLLAPSE: "collapsing"
						HOVER: "hovered"
						INTERACT: "interacting"
					}
				}
				expanding: {
					on: {
						COMPLETE: "expanded"
						CANCEL: "collapsed"
					}
				}
				collapsing: {
					on: {
						COMPLETE: "collapsed"
						CANCEL: "expanded"
					}
				}
				hovered: {
					on: {
						LEAVE: { target: "collapsed", guard: "isCollapsed" }
						LEAVE: { target: "expanded", guard: "isExpanded" }
						CLICK: "expanding"
					}
				}
				interacting: {
					on: {
						COMPLETE: "expanded"
						CANCEL: "expanded"
					}
				}
			}
		}
	}

	// 11. METADATA & CONFIGURATION
	metadata: {
		name: "arbiter-friendly-view"
		version: "2.0.0"
		description: "Enhanced Arbiter application with comprehensive friendly view capabilities"
		repository: "https://github.com/company/arbiter"
		documentation: "https://docs.arbiter.dev"
		created_at: "2024-09-08T12:00:00Z"
		updated_at: "2024-09-08T15:56:00Z"
		tags: [
			"cue",
			"specification",
			"validation", 
			"ui-friendly",
			"accordion",
			"visualization"
		]
	}

	// 12. DEPLOYMENT CONFIGURATION
	deployment: {
		target: "kubernetes"
		replicas: 3
		resources: {
			requests: {
				cpu: "100m"
				memory: "256Mi"
			}
			limits: {
				cpu: "500m"
				memory: "1Gi"
			}
		}
		health_checks: {
			liveness: "/api/v1/health"
			readiness: "/api/v1/ready"
		}
		autoscaling: {
			enabled: true
			min_replicas: 2
			max_replicas: 10
			target_cpu_utilization: 70
		}
	}

	// 13. SERVICES CONFIGURATION
	services: {
		"arbiter-api": {
			serviceType: "api"
			language: "typescript"
			type: "deployment"
			sourceDirectory: "./apps/api"
			ports: [
				{
					name: "http"
					port: 5050
					targetPort: 5050
					protocol: "TCP"
				}
			]
			environment: {
				NODE_ENV: "production"
				DATABASE_URL: "${DATABASE_URL}"
				JWT_SECRET: "${JWT_SECRET}"
			}
		}
		"arbiter-web": {
			serviceType: "frontend"
			language: "typescript"
			type: "deployment" 
			sourceDirectory: "./apps/web"
			ports: [
				{
					name: "http"
					port: 3000
					targetPort: 3000
					protocol: "TCP"
				}
			]
			environment: {
				REACT_APP_API_URL: "http://arbiter-api:5050"
				REACT_APP_FRIENDLY_VIEW_ENABLED: "true"
			}
		}
	}
}