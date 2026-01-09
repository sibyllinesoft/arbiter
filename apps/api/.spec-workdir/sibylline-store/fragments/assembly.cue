package sibyllinestore

{
	product: {
		name: "Sibylline-store"
		goals: [
			"Allow customers to browse and purchase SaaS plans in under two minutes.",
			"Streamline operator workflows by centralizing billing and catalog updates.",
			"Capture actionable metrics that inform pricing and growth experiments.",
		]
	}
	ui: {
		routes: [
			{
				id:   "storefront:main"
				path: "/"
				capabilities: [
					"view",
				]
				components: [
					"StorefrontPage",
				]
			},
		]
	}
	locators: {
		"page:storefront": "[data-testid=\"storefront-page\"]"
	}
	capabilities: {
		"public.storefront": {
			owner:       "frontend@sibylline.dev"
			description: "Allow customers to explore plans, configure subscriptions, and begin checkout."
			kind:        "ui"
		}
		"catalog.products": {
			owner:       "backend@sibylline.dev"
			description: "Serve product catalogs, plan metadata, and pricing for the storefront experience."
			kind:        "service"
		}
		"billing.webhooks": {
			owner:       "platform@sibylline.dev"
			description: "Process Stripe webhooks, reconcile usage with Lago, and raise workflow events."
			kind:        "integration"
		}
	}
	flows: [
		{
			id: "storefront:checkout"
			steps: [
				{
					visit: "/"
				},
				{
					expect: {
						locator: "page:storefront"
						state:   "visible"
					}
				},
				{
					click: "[data-testid=\"plan-pro\"]"
				},
				{
					expect_api: {
						method: "POST"
						path:   "/catalog/checkout"
						status: 200
					}
				},
			]
		},
	]
	tests: [
		{
			name:      "storefront-unit"
			type:      "unit"
			framework: "vitest"
			targets: [
				"storefront",
			]
			cases: [
				{
					name: "renders catalog grid"
					assertions: [
						"component renders featured products",
						"plan CTA buttons are enabled",
					]
				},
			]
		},
		{
			name:      "catalog-integration"
			type:      "integration"
			framework: "jest"
			targets: [
				"catalog-api",
				"lago-api",
			]
			cases: [
				{
					name: "creates Lago customer"
					assertions: [
						"POST /catalog/customers returns 201",
						"Lago API receives mirror request",
					]
				},
			]
		},
		{
			name:      "checkout-e2e"
			type:      "e2e"
			framework: "playwright"
			targets: [
				"storefront",
				"catalog-api",
				"stripe-webhooks",
			]
			cases: [
				{
					name: "customer purchases pro plan"
					assertions: [
						"Pro plan appears in confirmation view",
						"Lago subscription created for customer",
					]
				},
			]
		},
	]
	groups: [
		{
			id:          "EP-001"
			name:        "Catalog service foundation"
			status:      "in_progress"
			description: "Deliver the catalog-api service with Lago integration and product data."
			owners: [
				"backend@sibylline.dev",
			]
			tasks: [
				{
					id:          "EP-001-T1"
					name:        "Design product data schema"
					description: "Model products, plans, and billing periods in Postgres."
					deliverables: [
						"catalog-db schema CUE",
						"initial migration scripts",
					]
					dependencies: []
				},
				{
					id:          "EP-001-T2"
					name:        "Implement catalog API endpoints"
					description: "Expose REST endpoints for listing products and fetching details."
					deliverables: [
						"/catalog/products endpoint",
						"/catalog/products/{productId} endpoint",
					]
					dependencies: [
						"EP-001-T1",
					]
				},
			]
		},
		{
			id:          "EP-002"
			name:        "Storefront experience"
			status:      "planning"
			description: "Build the customer storefront UI backed by the catalog API."
			owners: [
				"frontend@sibylline.dev",
			]
			tasks: [
				{
					id:          "EP-002-T1"
					name:        "Implement plan marketplace view"
					description: "Render plan cards, pricing, and plan detail modals."
					deliverables: [
						"StorefrontPage component",
						"storybook coverage",
					]
					dependencies: [
						"EP-001-T2",
					]
				},
				{
					id:          "EP-002-T2"
					name:        "Integrate checkout instrumentation"
					description: "Capture analytics and send events to Lago for subscription creation."
					deliverables: [
						"checkout analytics instrumentation",
						"Playwright coverage",
					]
					dependencies: [
						"EP-002-T1",
					]
				},
			]
		},
		{
			id:          "EP-003"
			name:        "Stripe-webhooks event processing"
			status:      "planning"
			description: "Handle Stripe events and reconcile with Lago usage records."
			owners: [
				"platform@sibylline.dev",
			]
			tasks: [
				{
					id:          "EP-003-T1"
					name:        "Define webhook payload contracts"
					description: "Document payload handling and failure scenarios."
					deliverables: [
						"billing.webhooks@v1 contract",
						"alerting plan",
					]
					dependencies: []
				},
				{
					id:          "EP-003-T2"
					name:        "Implement idempotent event processing"
					description: "Persist checkpoints, retry failures, and fan out to Lago."
					deliverables: [
						"Stripe event consumer",
						"Replay CLI utility",
					]
					dependencies: [
						"EP-003-T1",
					]
				},
			]
		},
	]
	config: {
		language: "typescript"
		kind:     "service"
	}
	metadata: {
		name:        "sibylline-store"
		version:     "1.0.0"
		description: "Multitenant storefront that packages Lago billing with a TypeScript UI."
	}
	docs: {
		api: {
			format:      "openapi"
			version:     "1.0.0"
			source:      "./docs/openapi.yaml"
			description: "Describes storefront HTTP endpoints and Stripe webhook contracts."
			owners: [
				"api@sibylline.dev",
			]
			environments: [
				"development",
				"staging",
				"production",
			]
		}
		runbooks: [
			{
				name: "On-call playbook"
				path: "./docs/runbooks/on-call.md"
			},
		]
	}
	deployment: {
		target: "kubernetes"
	}
	execution: {
		environments: {
			development: {
				platform:  "kubernetes"
				namespace: "sibylline-store-dev"
				replicas: {
					storefront:        1
					"catalog-api":     1
					"lago-api":        1
					"lago-worker":     1
					"stripe-webhooks": 1
				}
				resources: {
					storefront: {
						cpu:    "250m"
						memory: "256Mi"
					}
					"catalog-api": {
						cpu:    "250m"
						memory: "256Mi"
					}
					"lago-api": {
						cpu:    "500m"
						memory: "512Mi"
					}
					"lago-worker": {
						cpu:    "500m"
						memory: "512Mi"
					}
					"stripe-webhooks": {
						cpu:    "200m"
						memory: "256Mi"
					}
				}
			}
			staging: {
				platform:  "kubernetes"
				namespace: "sibylline-store-staging"
				replicas: {
					storefront:        2
					"catalog-api":     2
					"lago-api":        2
					"lago-worker":     2
					"stripe-webhooks": 1
				}
			}
			production: {
				platform:  "kubernetes"
				namespace: "sibylline-store-prod"
				replicas: {
					storefront:        3
					"catalog-api":     3
					"lago-api":        3
					"lago-worker":     3
					"stripe-webhooks": 2
				}
				autoscaling: {
					"lago-api": {
						enabled:              true
						minReplicas:          3
						maxReplicas:          8
						targetCPUUtilization: 70
					}
					"lago-worker": {
						enabled:     true
						minReplicas: 3
						maxReplicas: 10
					}
				}
			}
		}
	}
	data: {
		schemas: {
			catalog: {
				engine:  "postgres"
				version: "1.0.0"
				tables: [
					"products",
					"plans",
					"price_tiers",
				]
				owner: "catalog-api"
			}
			billing: {
				engine:  "postgres"
				version: "1.0.0"
				tables: [
					"subscriptions",
					"invoices",
					"usage_records",
				]
				owner: "lago-api"
			}
		}
		migrations: {
			tool:      "drizzle"
			strategy:  "versioned"
			schedule:  "continuous"
			artifacts: "./migrations"
			backup: {
				enabled:   true
				retention: "7d"
				tool:      "wal-g"
			}
		}
	}
	security: {
		authentication: {
			default: {
				method:   "oauth2"
				provider: "auth0"
				required: true
				audience: [
					"catalog-api",
					"storefront",
				]
			}
			adminPortal: {
				method: "oidc"
				requiredRoles: [
					"operator",
				]
				sessionDuration: "8h"
			}
		}
		authorization: {
			model: "role-based"
			roles: {
				customer: {
					capabilities: [
						"browse_catalog",
						"manage_subscription",
					]
				}
				operator: {
					capabilities: [
						"manage_catalog",
						"view_billing",
						"trigger_refunds",
					]
				}
			}
		}
		policies: {
			dataRetention: "30d"
			encryption: {
				inTransit: true
				atRest:    true
			}
			secrets: {
				store: "vault"
				rotation: {
					frequency: "90d"
				}
			}
		}
	}
	performance: {
		sla: {
			uptime:        "99.5%"
			p95ResponseMs: 400
			p99ResponseMs: 900
		}
		loadProfile: {
			expectedRps: 300
			peakUsers:   5000
			regions: [
				"us-east-1",
				"eu-west-1",
			]
		}
		alertThresholds: {
			errorRate: "2%"
			cpu:       "80%"
			memory:    "85%"
		}
	}
	observability: {
		logging: {
			level:  "info"
			format: "json"
			sinks: [
				"stdout",
				"datadog",
			]
			retentionDays: 30
		}
		monitoring: {
			metricsProvider: "prometheus"
			dashboards: [
				"catalog-latency",
				"checkout-conversion",
			]
			alerts: [
				{
					name:      "high-error-rate"
					condition: "error_rate > 2%"
					targets: [
						"oncall@sibylline.dev",
					]
				},
				{
					name:      "webhook-failures"
					condition: "stripe_webhook_failures > 5"
					targets: [
						"platform@sibylline.dev",
					]
				},
			]
		}
		tracing: {
			provider: "opentelemetry"
			sampler:  "parentbased_always_on"
			exporter: "otlp"
		}
	}
	environments: {
		development: {
			domain: "http://localhost:3000"
			observability: {
				logLevel: "debug"
			}
			secrets: [
				"STRIPE_TEST_KEY",
				"LAGO_API_KEY",
			]
		}
		staging: {
			domain: "https://staging.sibylline.store"
			observability: {
				logLevel: "info"
			}
			releaseGate: "qa-signoff"
		}
		production: {
			domain: "https://sibylline.store"
			observability: {
				logLevel: "warn"
			}
			changeManagement: "prod-approval"
		}
	}
	services: {
		storefront: {
			serviceType:     "bespoke"
			language:        "typescript"
			type:            "deployment"
			sourceDirectory: "./src/storefront"
			ports: [
				{
					name:       "http"
					port:       3000
					targetPort: 3000
				},
			]
			capabilities: [
				{
					kind:        "httpServer"
					contractRef: "public.storefront@v1"
				},
			]
			healthCheck: {
				path:     "/healthz"
				port:     3000
				interval: "30s"
				timeout:  "5s"
			}
			env: {
				NODE_ENV:           "production"
				API_BASE_URL:       "http://catalog-api:4000"
				NEXT_PUBLIC_STRIPE: "pk_test_replace"
			}
			config: {
				environment: {
					PORT:                     "3000"
					NEXT_PUBLIC_API_BASE_URL: "http://catalog-api:4000"
				}
			}
			resources: {
				requests: {
					cpu:    "250m"
					memory: "256Mi"
				}
				limits: {
					cpu:    "500m"
					memory: "512Mi"
				}
			}
			dependencies: [
				"catalog-api",
			]
		}
		"catalog-api": {
			serviceType:     "bespoke"
			language:        "typescript"
			type:            "deployment"
			sourceDirectory: "./src/catalog-api"
			ports: [
				{
					name:       "http"
					port:       4000
					targetPort: 4000
				},
			]
			capabilities: [
				{
					kind:        "httpServer"
					contractRef: "catalog@v1"
				},
			]
			healthCheck: {
				path:     "/health"
				port:     4000
				interval: "30s"
				timeout:  "5s"
			}
			env: {
				NODE_ENV:     "production"
				PORT:         "4000"
				DATABASE_URL: "postgresql://user:password@catalog-db:5432/catalog-db"
				LAGO_API_URL: "http://lago-api:3001"
			}
			config: {
				environment: {
					PORT:         "4000"
					DATABASE_URL: "postgresql://user:password@catalog-db:5432/catalog-db"
					LAGO_API_URL: "http://lago-api:3001"
				}
			}
			resources: {
				requests: {
					cpu:    "250m"
					memory: "256Mi"
				}
				limits: {
					cpu:    "500m"
					memory: "512Mi"
				}
			}
			dependencies: [
				"catalog-db",
				"lago-api",
			]
		}
		"lago-api": {
			serviceType: "prebuilt"
			language:    "container"
			type:        "deployment"
			image:       "getlago/lago:0.59.0"
			ports: [
				{
					name:       "http"
					port:       3001
					targetPort: 3001
				},
			]
			healthCheck: {
				path:     "/health"
				port:     3001
				interval: "60s"
				timeout:  "5s"
			}
			config: {
				environment: {
					PORT:         "3001"
					DATABASE_URL: "postgresql://user:password@lago-db:5432/lago-db"
					REDIS_URL:    "redis://lago-redis:6379/0"
					STRIPE_API_KEY: {
						value:    "replace-in-secrets"
						required: true
					}
					LAGO_API_KEY: {
						value:    "replace-in-secrets"
						required: true
					}
				}
			}
			resources: {
				requests: {
					cpu:    "400m"
					memory: "512Mi"
				}
				limits: {
					cpu:    "800m"
					memory: "1Gi"
				}
			}
			dependencies: [
				"lago-db",
				"lago-redis",
			]
		}
		"lago-worker": {
			serviceType: "prebuilt"
			language:    "container"
			type:        "deployment"
			image:       "getlago/lago:0.59.0"
			ports: [
				{
					name:       "http"
					port:       3002
					targetPort: 3002
				},
			]
			config: {
				environment: {
					DATABASE_URL: "postgresql://user:password@lago-db:5432/lago-db"
					REDIS_URL:    "redis://lago-redis:6379/0"
				}
			}
			resources: {
				requests: {
					cpu:    "400m"
					memory: "512Mi"
				}
				limits: {
					cpu:    "800m"
					memory: "1Gi"
				}
			}
			dependencies: [
				"lago-db",
				"lago-redis",
			]
		}
		"stripe-webhooks": {
			serviceType:     "bespoke"
			language:        "typescript"
			type:            "deployment"
			sourceDirectory: "./src/stripe-webhooks"
			ports: [
				{
					name:       "http"
					port:       4010
					targetPort: 4010
				},
			]
			capabilities: [
				{
					kind:        "httpServer"
					contractRef: "billing.webhooks@v1"
				},
			]
			healthCheck: {
				path:     "/healthz"
				port:     4010
				interval: "30s"
				timeout:  "5s"
			}
			env: {
				NODE_ENV:          "production"
				PORT:              "4010"
				STRIPE_ENDPOINT:   "/stripe/webhook"
				EVENT_RETENTION_H: "24"
			}
			config: {
				environment: {
					PORT:                "4010"
					STRIPE_WEBHOOK_PATH: "/stripe/webhook"
					TARGET_ENV:          "development"
				}
			}
			resources: {
				requests: {
					cpu:    "150m"
					memory: "256Mi"
				}
				limits: {
					cpu:    "300m"
					memory: "512Mi"
				}
			}
			dependencies: [
				"lago-api",
				"catalog-api",
			]
		}
		"lago-db": {
			serviceType: "prebuilt"
			language:    "container"
			type:        "statefulset"
			image:       "postgres:15"
			ports: [
				{
					name:       "db"
					port:       5432
					targetPort: 5432
				},
			]
			volumes: [
				{
					name: "data"
					path: "/var/lib/postgresql/data"
					size: "50Gi"
					type: "persistentVolumeClaim"
				},
			]
			env: {
				POSTGRES_DB:       "lago-db"
				POSTGRES_USER:     "user"
				POSTGRES_PASSWORD: "password"
			}
			resources: {
				requests: {
					cpu:    "500m"
					memory: "1Gi"
				}
				limits: {
					cpu:    "1"
					memory: "2Gi"
				}
			}
		}
		"catalog-db": {
			serviceType: "prebuilt"
			language:    "container"
			type:        "statefulset"
			image:       "postgres:15"
			ports: [
				{
					name:       "db"
					port:       5432
					targetPort: 5432
				},
			]
			volumes: [
				{
					name: "data"
					path: "/var/lib/postgresql/data"
					size: "50Gi"
					type: "persistentVolumeClaim"
				},
			]
			env: {
				POSTGRES_DB:       "catalog-db"
				POSTGRES_USER:     "user"
				POSTGRES_PASSWORD: "password"
			}
			resources: {
				requests: {
					cpu:    "500m"
					memory: "1Gi"
				}
				limits: {
					cpu:    "1"
					memory: "2Gi"
				}
			}
		}
		"lago-redis": {
			serviceType: "prebuilt"
			language:    "container"
			type:        "deployment"
			image:       "redis:7-alpine"
			ports: [
				{
					name:       "cache"
					port:       6379
					targetPort: 6379
				},
			]
			config: {
				environment: {
					REDIS_APPENDONLY: "yes"
				}
			}
			volumes: [
				{
					name: "data"
					path: "/data"
					size: "10Gi"
				},
			]
			resources: {
				requests: {
					cpu:    "200m"
					memory: "256Mi"
				}
				limits: {
					cpu:    "400m"
					memory: "512Mi"
				}
			}
		}
	}
	paths: {
		"/stripe/webhook": {
			post: {
				summary:     "Ingest Stripe events"
				description: "Receives Stripe webhook events and forwards them to Lago and catalog workflows."
			}
		}
		"/catalog/products": {
			get: {
				summary:     "List products"
				description: "Returns the available SaaS products and plans."
			}
		}
		"/catalog/products/{productId}": {
			get: {
				summary:     "Fetch product detail"
				description: "Returns catalog metadata for a single product."
			}
		}
	}
}
