package examples

// Example: Invoice Management Application - v2 App Specification
// This demonstrates the complete v2 app spec format with all major features

#InvoiceManagementApp: {
	// 1. PRODUCT SPECIFICATION
	product: {
		name: "InvoicePro - Invoice Management System"
		goals: [
			"Enable businesses to create, send, and track invoices efficiently",
			"Provide real-time invoice status tracking and payment notifications",
			"Maintain audit trail for all invoice lifecycle events",
			"Support multiple currencies and tax calculations"
		]
		constraints: [
			"Must comply with SOX financial reporting requirements",
			"Maximum 2 second page load time for invoice list",
			"Support offline invoice creation with sync capability",
			"GDPR compliant data handling for EU customers"
		]
		roles: [
			"admin",
			"manager", 
			"accountant",
			"clerk",
			"viewer"
		]
		slos: {
			p95_page_load_ms: 2000
			uptime: "99.9%"
		}
	}

	// 2. DOMAIN VOCABULARY
	domain: {
		enums: {
			invoice_status: ["DRAFT", "PENDING", "SENT", "VIEWED", "PAID", "OVERDUE", "CANCELLED"]
			payment_method: ["CREDIT_CARD", "BANK_TRANSFER", "CHECK", "CASH", "PAYPAL"]
			currency: ["USD", "EUR", "GBP", "JPY", "CAD"]
			tax_type: ["VAT", "GST", "SALES_TAX", "NO_TAX"]
			priority: ["LOW", "NORMAL", "HIGH", "URGENT"]
		}
		permissions: {
			create_invoice: ["admin", "manager", "accountant", "clerk"]
			approve_invoice: ["admin", "manager"]
			send_invoice: ["admin", "manager", "accountant"]
			view_invoice: ["admin", "manager", "accountant", "clerk", "viewer"]
			delete_invoice: ["admin", "manager"]
			process_payment: ["admin", "manager", "accountant"]
			generate_reports: ["admin", "manager", "accountant"]
			manage_customers: ["admin", "manager", "accountant"]
		}
	}

	// 3. COMPONENT SCHEMAS
	components: {
		schemas: {
			Invoice: {
				example: {
					id: "INV-2024-001"
					number: "2024-001"
					customer_id: "CUST-12345"
					status: "SENT"
					currency: "USD"
					subtotal: 1000.00
					tax_amount: 100.00
					total: 1100.00
					created_at: "2024-01-15T10:30:00Z"
					due_date: "2024-02-15T00:00:00Z"
					sent_at: "2024-01-15T14:30:00Z"
					line_items: [
						{
							description: "Software Development Services"
							quantity: 40
							unit_price: 25.00
							total: 1000.00
						}
					]
					payment_terms: "Net 30"
					notes: "Thank you for your business!"
				}
				rules: {
					total: "subtotal + tax_amount"
					status_transitions: {
						DRAFT: ["PENDING", "CANCELLED"]
						PENDING: ["SENT", "CANCELLED"] 
						SENT: ["VIEWED", "PAID", "OVERDUE", "CANCELLED"]
						VIEWED: ["PAID", "OVERDUE", "CANCELLED"]
						PAID: []
						OVERDUE: ["PAID", "CANCELLED"]
						CANCELLED: []
					}
				}
			}
			
			Customer: {
				example: {
					id: "CUST-12345"
					name: "Acme Corporation"
					email: "billing@acme.com"
					address: {
						line1: "123 Business Ave"
						city: "San Francisco"
						state: "CA"
						postal_code: "94105"
						country: "US"
					}
					payment_terms: "Net 30"
					currency: "USD"
					tax_id: "12-3456789"
				}
			}

			Payment: {
				example: {
					id: "PAY-67890"
					invoice_id: "INV-2024-001"
					amount: 1100.00
					currency: "USD"
					method: "CREDIT_CARD"
					processed_at: "2024-02-10T16:45:00Z"
					reference: "CH_1J2K3L4M5N6O7P8Q"
					status: "COMPLETED"
				}
			}

			InvoiceList: {
				example: {
					invoices: [
						{
							id: "INV-2024-001"
							number: "2024-001"
							customer_name: "Acme Corporation"
							status: "SENT"
							total: 1100.00
							currency: "USD"
							due_date: "2024-02-15T00:00:00Z"
						}
					]
					pagination: {
						page: 1
						per_page: 20
						total: 156
						total_pages: 8
					}
					filters: {
						status: "SENT"
						date_from: "2024-01-01T00:00:00Z"
						date_to: "2024-12-31T23:59:59Z"
					}
				}
			}
		}
	}

	// 4. API PATHS
	paths: {
		"/api/v1/invoices": {
			get: {
				response: {
					$ref: "#/components/schemas/InvoiceList"
					example: {
						invoices: [
							{
								id: "INV-2024-001"
								number: "2024-001"
								customer_name: "Acme Corporation"
								status: "SENT"
								total: 1100.00
								currency: "USD"
								due_date: "2024-02-15T00:00:00Z"
							}
						]
						pagination: {
							page: 1
							per_page: 20
							total: 156
						}
					}
				}
			}
			post: {
				request: {
					$ref: "#/components/schemas/Invoice"
					example: {
						customer_id: "CUST-12345"
						currency: "USD"
						payment_terms: "Net 30"
						line_items: [
							{
								description: "Consulting Services"
								quantity: 10
								unit_price: 150.00
							}
						]
					}
				}
				response: {
					$ref: "#/components/schemas/Invoice"
				}
				status: 201
			}
		}
		
		"/api/v1/invoices/{id}": {
			get: {
				response: {
					$ref: "#/components/schemas/Invoice"
				}
			}
			put: {
				request: {
					$ref: "#/components/schemas/Invoice"
				}
				response: {
					$ref: "#/components/schemas/Invoice"
				}
			}
			delete: {
				status: 204
			}
		}

		"/api/v1/invoices/{id}/send": {
			post: {
				response: {
					example: {
						message: "Invoice sent successfully"
						sent_at: "2024-01-15T14:30:00Z"
						recipient: "billing@acme.com"
					}
				}
			}
		}

		"/api/v1/invoices/{id}/payments": {
			post: {
				request: {
					$ref: "#/components/schemas/Payment"
					example: {
						amount: 1100.00
						method: "CREDIT_CARD"
						reference: "CH_1J2K3L4M5N6O7P8Q"
					}
				}
				response: {
					$ref: "#/components/schemas/Payment"
				}
				status: 201
			}
		}
	}

	// 5. UI ROUTES
	ui: {
		routes: [
			{
				id: "invoices:list"
				path: "/invoices"
				capabilities: ["view_invoice"]
				components: [
					"InvoiceListTable",
					"StatusFilter", 
					"DateRangePicker",
					"ExportButton",
					"CreateInvoiceButton"
				]
			},
			{
				id: "invoices:detail"
				path: "/invoices/{id}"
				capabilities: ["view_invoice"]
				components: [
					"InvoiceHeader",
					"InvoiceLineItems",
					"PaymentHistory",
					"InvoiceActions",
					"ActivityTimeline"
				]
			},
			{
				id: "invoices:create"
				path: "/invoices/new"
				capabilities: ["create_invoice"]
				components: [
					"InvoiceForm",
					"CustomerSelector",
					"LineItemEditor",
					"TaxCalculator",
					"PreviewPane"
				]
			},
			{
				id: "invoices:edit" 
				path: "/invoices/{id}/edit"
				capabilities: ["create_invoice"]
				components: [
					"InvoiceForm",
					"CustomerSelector", 
					"LineItemEditor",
					"TaxCalculator",
					"PreviewPane"
				]
			},
			{
				id: "customers:list"
				path: "/customers"
				capabilities: ["manage_customers", "view_invoice"]
				components: [
					"CustomerTable",
					"SearchBar",
					"CreateCustomerButton"
				]
			},
			{
				id: "reports:dashboard"
				path: "/reports"
				capabilities: ["generate_reports"]
				components: [
					"RevenueChart",
					"OutstandingInvoices",
					"PaymentTrends",
					"TopCustomers"
				]
			}
		]
	}

	// 6. LOCATORS - Stable CSS selectors for testing
	locators: {
		// Navigation
		"nav:invoices": "[data-testid='nav-invoices']"
		"nav:customers": "[data-testid='nav-customers']"
		"nav:reports": "[data-testid='nav-reports']"
		
		// Invoice List
		"btn:create-invoice": "[data-testid='create-invoice-btn']"
		"filter:status": "[data-testid='status-filter']"
		"filter:date-from": "[data-testid='date-from-filter']"
		"filter:date-to": "[data-testid='date-to-filter']"
		"table:invoices": "[data-testid='invoices-table']"
		"row:invoice": "[data-testid^='invoice-row-']"
		"btn:export": "[data-testid='export-btn']"
		
		// Invoice Detail
		"section:header": "[data-testid='invoice-header']"
		"section:line-items": "[data-testid='line-items']"
		"section:payments": "[data-testid='payment-history']"
		"btn:send-invoice": "[data-testid='send-invoice-btn']"
		"btn:mark-paid": "[data-testid='mark-paid-btn']"
		"btn:edit": "[data-testid='edit-invoice-btn']"
		"btn:delete": "[data-testid='delete-invoice-btn']"
		
		// Invoice Form
		"form:invoice": "[data-testid='invoice-form']"
		"input:customer": "[data-testid='customer-select']"
		"input:currency": "[data-testid='currency-select']"
		"input:payment-terms": "[data-testid='payment-terms']"
		"section:line-items": "[data-testid='line-items-editor']"
		"btn:add-line-item": "[data-testid='add-line-item-btn']"
		"input:description": "[data-testid='line-item-description']"
		"input:quantity": "[data-testid='line-item-quantity']"
		"input:unit-price": "[data-testid='line-item-unit-price']"
		"display:subtotal": "[data-testid='subtotal-display']"
		"display:tax": "[data-testid='tax-display']"
		"display:total": "[data-testid='total-display']"
		"btn:save-draft": "[data-testid='save-draft-btn']"
		"btn:save-send": "[data-testid='save-send-btn']"
		
		// Customer Management
		"btn:create-customer": "[data-testid='create-customer-btn']"
		"input:search-customers": "[data-testid='customer-search']"
		"table:customers": "[data-testid='customers-table']"
		
		// Common Elements
		"modal:confirm": "[data-testid='confirm-modal']"
		"btn:confirm": "[data-testid='confirm-btn']"
		"btn:cancel": "[data-testid='cancel-btn']"
		"alert:success": "[data-testid='success-alert']"
		"alert:error": "[data-testid='error-alert']"
		"spinner:loading": "[data-testid='loading-spinner']"
	}

	// 7. FLOWS - Complete user workflows
	flows: [
		{
			id: "create-and-send-invoice"
			preconditions: {
				role: "accountant"
				seed: [
					{
						factory: "customer"
						as: "test_customer"
						with: {
							name: "Test Customer Inc"
							email: "billing@testcustomer.com"
						}
					}
				]
			}
			steps: [
				{ visit: "invoices:list" },
				{ expect: { locator: "table:invoices", state: "visible" } },
				{ click: "btn:create-invoice" },
				{ expect: { locator: "form:invoice", state: "visible" } },
				{ click: "input:customer" },
				{ fill: { locator: "input:customer", value: "Test Customer Inc" } },
				{ click: "input:currency" },
				{ fill: { locator: "input:currency", value: "USD" } },
				{ click: "btn:add-line-item" },
				{ fill: { locator: "input:description", value: "Professional Services" } },
				{ fill: { locator: "input:quantity", value: "10" } },
				{ fill: { locator: "input:unit-price", value: "150.00" } },
				{ expect: { locator: "display:total", text: { eq: "$1,500.00" } } },
				{ click: "btn:save-send" },
				{ expect_api: {
					method: "POST"
					path: "/api/v1/invoices"
					status: 201
				} },
				{ expect_api: {
					method: "POST" 
					path: "/api/v1/invoices/{id}/send"
					status: 200
				} },
				{ expect: { locator: "alert:success", state: "visible" } },
				{ expect: { locator: "alert:success", text: { contains: "Invoice sent successfully" } } }
			]
			variants: [
				{
					name: "save-as-draft"
					override: {
						steps: [
							// ... same steps until save button
							{ click: "btn:save-draft" },
							{ expect_api: {
								method: "POST"
								path: "/api/v1/invoices"
								status: 201
								bodyExample: {
									status: "DRAFT"
								}
							} }
						]
					}
				},
				{
					name: "multi-line-items"
					override: {
						steps: [
							// ... include multiple line items
							{ click: "btn:add-line-item" },
							{ fill: { locator: "input:description", value: "Consulting" } },
							{ fill: { locator: "input:quantity", value: "20" } },
							{ fill: { locator: "input:unit-price", value: "100.00" } },
							{ expect: { locator: "display:total", text: { eq: "$3,500.00" } } }
						]
					}
				}
			]
		},
		{
			id: "process-payment"
			preconditions: {
				role: "accountant"
				seed: [
					{
						factory: "invoice"
						as: "sent_invoice"
						with: {
							status: "SENT"
							total: 1100.00
							currency: "USD"
						}
					}
				]
			}
			steps: [
				{ visit: "invoices:detail" },
				{ expect: { locator: "section:header", state: "visible" } },
				{ expect: { locator: "section:header", text: { contains: "SENT" } } },
				{ click: "btn:mark-paid" },
				{ expect: { locator: "modal:confirm", state: "visible" } },
				{ click: "btn:confirm" },
				{ expect_api: {
					method: "POST"
					path: "/api/v1/invoices/{id}/payments"
					status: 201
					bodyExample: {
						amount: 1100.00
						method: "CREDIT_CARD"
					}
				} },
				{ expect: { locator: "alert:success", state: "visible" } },
				{ expect: { locator: "section:header", text: { contains: "PAID" } } }
			]
		},
		{
			id: "filter-overdue-invoices"
			preconditions: {
				role: "manager"
				seed: [
					{
						factory: "invoice"
						as: "overdue_invoice_1"
						with: {
							status: "OVERDUE"
							due_date: "2024-01-01T00:00:00Z"
						}
					},
					{
						factory: "invoice"  
						as: "paid_invoice"
						with: {
							status: "PAID"
						}
					}
				]
			}
			steps: [
				{ visit: "invoices:list" },
				{ expect: { locator: "table:invoices", state: "visible" } },
				{ click: "filter:status" },
				{ fill: { locator: "filter:status", value: "OVERDUE" } },
				{ expect_api: {
					method: "GET"
					path: "/api/v1/invoices"
					status: 200
				} },
				{ expect: { locator: "table:invoices", state: "visible" } },
				{ expect: { locator: "row:invoice", text: { contains: "OVERDUE" } } }
			]
		}
	]

	// 8. TESTABILITY CONFIGURATION
	testability: {
		network: {
			stub: true
			passthrough: [
				"/api/v1/health",
				"/api/v1/version"
			]
		}
		clock: {
			fixed: "2024-01-15T12:00:00Z"
		}
		seeds: {
			factories: {
				customer: {
					id: "{{faker.uuid}}"
					name: "{{faker.company.name}}"
					email: "{{faker.internet.email}}"
					address: {
						line1: "{{faker.address.streetAddress}}"
						city: "{{faker.address.city}}" 
						state: "{{faker.address.state}}"
						postal_code: "{{faker.address.zipCode}}"
						country: "US"
					}
					payment_terms: "Net 30"
					currency: "USD"
				}
				invoice: {
					id: "{{faker.uuid}}"
					number: "{{faker.finance.account}}"
					customer_id: "{{customer.id}}"
					status: "DRAFT"
					currency: "USD"
					subtotal: "{{faker.finance.amount}}"
					tax_amount: "{{multiply subtotal 0.1}}"
					total: "{{add subtotal tax_amount}}"
					created_at: "{{faker.date.recent}}"
					due_date: "{{faker.date.future}}"
					line_items: [
						{
							description: "{{faker.commerce.productName}}"
							quantity: "{{faker.number.int 1 50}}"
							unit_price: "{{faker.finance.amount}}"
							total: "{{multiply quantity unit_price}}"
						}
					]
					payment_terms: "Net 30"
				}
			}
		}
		quality_gates: {
			a11y: {
				axe_severity_max: "moderate"
			}
			perf: {
				p95_nav_ms_max: 2000
			}
		}
	}

	// 9. OPS CONFIGURATION
	ops: {
		feature_flags: [
			"payment_reminders",
			"bulk_operations", 
			"advanced_reporting",
			"multi_currency_display",
			"pdf_generation",
			"email_notifications"
		]
		environments: [
			"development",
			"staging",
			"production"
		]
		security: {
			auth: "oauth2"
			scopes: [
				"invoices:read",
				"invoices:write",
				"customers:read",
				"customers:write",
				"payments:read",
				"payments:write",
				"reports:read"
			]
		}
	}

	// 10. STATE MODELS - Complex UI flow state machines
	stateModels: {
		invoice_editor: {
			id: "invoice_editor"
			initial: "editing"
			states: {
				editing: {
					on: {
						SAVE_DRAFT: "saving_draft"
						SEND: "sending"
						PREVIEW: "previewing"
						CALCULATE: "calculating"
					}
				}
				saving_draft: {
					on: {
						SUCCESS: "editing"
						ERROR: "editing"
					}
				}
				sending: {
					on: {
						SUCCESS: "sent"
						ERROR: "editing"
					}
				}
				previewing: {
					on: {
						EDIT: "editing"
						SEND: "sending"
					}
				}
				calculating: {
					on: {
						COMPLETE: "editing"
						ERROR: "editing"
					}
				}
				sent: {
					on: {
						EDIT: "editing"
					}
				}
			}
		}
		
		payment_processing: {
			id: "payment_processing"
			initial: "pending"
			states: {
				pending: {
					on: {
						PROCESS: "processing"
						CANCEL: "cancelled"
					}
				}
				processing: {
					on: {
						SUCCESS: "completed"
						FAILURE: "failed"
						PARTIAL: "partial"
					}
				}
				completed: {
					on: {
						REFUND: "refunding"
					}
				}
				failed: {
					on: {
						RETRY: "processing"
						CANCEL: "cancelled"
					}
				}
				partial: {
					on: {
						COMPLETE: "processing"
						CANCEL: "cancelled"
					}
				}
				refunding: {
					on: {
						SUCCESS: "refunded"
						FAILURE: "completed"
					}
				}
				refunded: {}
				cancelled: {}
			}
		}
	}
}