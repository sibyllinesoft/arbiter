package examples

// Example Profile.ui specification for a dashboard application
// This demonstrates the comprehensive UI scaffolding capabilities
Profile: ui: {
	platform: "web"
	
	// Theme and design tokens
	theme: {
		colors: {
			primary: "#007acc"
			secondary: "#f0f0f0"
			accent: "#ff6b6b"
			background: "#ffffff"
			surface: "#f8f9fa"
			text: {
				primary: "#2d3748"
				secondary: "#718096"
				muted: "#a0aec0"
			}
			border: "#e2e8f0"
			error: "#e53e3e"
			warning: "#ed8936"
			success: "#38a169"
		}
		typography: {
			fontFamily: {
				base: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
				mono: "JetBrains Mono, Consolas, monospace"
			}
			fontSize: {
				xs: "0.75rem"
				sm: "0.875rem"
				base: "1rem"
				lg: "1.125rem"
				xl: "1.25rem"
				"2xl": "1.5rem"
				"3xl": "1.875rem"
			}
			fontWeight: {
				normal: "400"
				medium: "500"
				semibold: "600"
				bold: "700"
			}
		}
		spacing: {
			xs: "0.25rem"
			sm: "0.5rem"
			md: "1rem"
			lg: "1.5rem"
			xl: "2rem"
			"2xl": "3rem"
		}
		borderRadius: {
			sm: "0.25rem"
			md: "0.5rem"
			lg: "0.75rem"
			full: "9999px"
		}
		shadows: {
			sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
			md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
			lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
		}
	}
	
	// Route definitions
	routes: {
		"/": {
			path: "/"
			component: "Dashboard"
			props: {
				title: "Dashboard"
				showWelcome: true
			}
			capabilities: ["view:dashboard", "analytics:read"]
			guards: ["auth", "permissions"]
			layout: "main"
		}
		"/users": {
			path: "/users"
			component: "UserList"
			props: {
				pageSize: 20
				sortBy: "name"
			}
			capabilities: ["users:read"]
			guards: ["auth", "role:admin"]
			layout: "main"
		}
		"/users/:id": {
			path: "/users/:id"
			component: "UserDetail"
			props: {
				showEditButton: true
			}
			capabilities: ["users:read", "users:update"]
			guards: ["auth", "resourceOwner"]
			layout: "main"
		}
		"/settings": {
			path: "/settings"
			component: "Settings"
			props: {
				sections: ["profile", "security", "notifications"]
			}
			capabilities: ["settings:manage"]
			guards: ["auth"]
			layout: "main"
		}
		"/reports": {
			path: "/reports"
			component: "ReportsHub"
			props: {
				defaultView: "summary"
			}
			capabilities: ["reports:read", "analytics:read"]
			guards: ["auth", "role:analyst"]
			layout: "main"
		}
	}
	
	// Component definitions
	components: {
		Dashboard: {
			name: "Dashboard"
			type: "layout"
			props: {
				title: "string"
				showWelcome: "boolean"
			}
			children: ["MetricsGrid", "RecentActivity", "QuickActions"]
			events: {
				onRefresh: "handleDashboardRefresh"
				onExport: "handleExportData"
			}
			styling: {
				layout: "grid"
				gap: "lg"
				padding: "xl"
			}
		}
		
		MetricsGrid: {
			name: "MetricsGrid"
			type: "layout"
			props: {
				columns: "number"
				metrics: "array"
			}
			children: ["MetricCard"]
			styling: {
				display: "grid"
				gridColumns: "repeat(auto-fit, minmax(250px, 1fr))"
				gap: "md"
			}
		}
		
		MetricCard: {
			name: "MetricCard"
			type: "detail"
			props: {
				title: "string"
				value: "string | number"
				change: "number"
				trend: "up | down | flat"
				icon: "string"
			}
			events: {
				onClick: "handleMetricClick"
			}
			styling: {
				background: "surface"
				borderRadius: "lg"
				padding: "lg"
				shadow: "md"
			}
		}
		
		UserList: {
			name: "UserList"
			type: "list"
			props: {
				users: "array"
				pageSize: "number"
				sortBy: "string"
				loading: "boolean"
			}
			children: ["UserListItem", "Pagination", "SearchBar"]
			events: {
				onUserSelect: "handleUserSelection"
				onSort: "handleSortChange"
				onSearch: "handleUserSearch"
			}
		}
		
		UserListItem: {
			name: "UserListItem"
			type: "detail"
			props: {
				user: "object"
				selected: "boolean"
				showActions: "boolean"
			}
			events: {
				onClick: "handleItemClick"
				onEdit: "handleItemEdit"
				onDelete: "handleItemDelete"
			}
		}
		
		UserDetail: {
			name: "UserDetail"
			type: "detail"
			props: {
				user: "object"
				showEditButton: "boolean"
				editable: "boolean"
			}
			children: ["UserProfile", "UserActivity", "UserPermissions"]
			events: {
				onEdit: "handleUserEdit"
				onSave: "handleUserSave"
				onCancel: "handleEditCancel"
			}
		}
		
		SearchBar: {
			name: "SearchBar"
			type: "form"
			props: {
				placeholder: "string"
				value: "string"
				loading: "boolean"
			}
			events: {
				onSearch: "handleSearch"
				onChange: "handleSearchChange"
				onClear: "handleSearchClear"
			}
		}
		
		Pagination: {
			name: "Pagination"
			type: "navigation"
			props: {
				currentPage: "number"
				totalPages: "number"
				pageSize: "number"
				totalItems: "number"
			}
			events: {
				onPageChange: "handlePageChange"
				onPageSizeChange: "handlePageSizeChange"
			}
		}
	}
	
	// Form definitions
	forms: {
		userEditForm: {
			name: "userEditForm"
			fields: [
				{
					name: "firstName"
					type: "text"
					label: "First Name"
					required: true
					placeholder: "Enter first name"
					validation: {
						minLength: 2
						maxLength: 50
						pattern: "^[a-zA-Z\\s]+$"
					}
				},
				{
					name: "lastName"
					type: "text"
					label: "Last Name"
					required: true
					placeholder: "Enter last name"
					validation: {
						minLength: 2
						maxLength: 50
						pattern: "^[a-zA-Z\\s]+$"
					}
				},
				{
					name: "email"
					type: "email"
					label: "Email Address"
					required: true
					placeholder: "user@example.com"
					validation: {
						email: true
					}
				},
				{
					name: "role"
					type: "select"
					label: "User Role"
					required: true
					options: [
						{label: "User", value: "user"},
						{label: "Admin", value: "admin"},
						{label: "Analyst", value: "analyst"},
						{label: "Manager", value: "manager"}
					]
				},
				{
					name: "active"
					type: "checkbox"
					label: "Active Account"
					required: false
				},
				{
					name: "notes"
					type: "textarea"
					label: "Notes"
					required: false
					placeholder: "Additional notes about this user"
					validation: {
						maxLength: 500
					}
				}
			]
			validation: {
				validateOnBlur: true
				validateOnSubmit: true
			}
			onSubmit: "handleUserUpdate"
			layout: "vertical"
		}
		
		settingsForm: {
			name: "settingsForm"
			fields: [
				{
					name: "theme"
					type: "select"
					label: "Theme"
					required: true
					options: [
						{label: "Light", value: "light"},
						{label: "Dark", value: "dark"},
						{label: "System", value: "system"}
					]
				},
				{
					name: "notifications"
					type: "checkbox"
					label: "Enable Notifications"
					required: false
				},
				{
					name: "timezone"
					type: "select"
					label: "Timezone"
					required: true
					options: [
						{label: "UTC", value: "UTC"},
						{label: "US/Eastern", value: "America/New_York"},
						{label: "US/Pacific", value: "America/Los_Angeles"},
						{label: "Europe/London", value: "Europe/London"}
					]
				}
			]
			onSubmit: "handleSettingsUpdate"
			layout: "vertical"
		}
	}
	
	// Test definitions
	tests: {
		scenarios: [
			{
				name: "dashboard_load"
				description: "User can load and view the dashboard"
				steps: [
					{
						action: "navigate"
						target: "/"
						assertion: "page loads successfully"
					},
					{
						action: "expect"
						target: "[data-testid='dashboard']"
						assertion: "dashboard is visible"
					},
					{
						action: "expect"
						target: "[data-testid='metrics-grid']"
						assertion: "metrics grid displays"
					}
				]
				platform: "web"
			},
			{
				name: "user_search"
				description: "User can search for other users"
				steps: [
					{
						action: "navigate"
						target: "/users"
					},
					{
						action: "fill"
						target: "[data-testid='search-input']"
						value: "john"
					},
					{
						action: "expect"
						target: "[data-testid='user-list']"
						assertion: "filtered results display"
					}
				]
				platform: "web"
			},
			{
				name: "user_edit"
				description: "Admin can edit user details"
				steps: [
					{
						action: "navigate"
						target: "/users/123"
					},
					{
						action: "click"
						target: "[data-testid='edit-button']"
					},
					{
						action: "fill"
						target: "[name='firstName']"
						value: "Jane"
					},
					{
						action: "click"
						target: "[data-testid='save-button']"
					},
					{
						action: "expect"
						target: "[data-testid='success-message']"
						assertion: "save success message appears"
					}
				]
				platform: "web"
			}
		]
		coverage: "90%"
		timeout: 30000
		retries: 2
	}
	
	// Configuration
	config: {
		accessibility: {
			wcagLevel: "AA"
			focusManagement: true
			keyboardNavigation: true
			screenReaderSupport: true
		}
		performance: {
			lazyLoading: true
			codesplitting: true
			bundleOptimization: true
			imageOptimization: true
		}
		seo: {
			metaTags: true
			structuredData: true
			openGraph: true
		}
		analytics: {
			tracking: true
			events: ["click", "view", "form_submit"]
			provider: "custom"
		}
		internationalization: {
			enabled: false
			defaultLocale: "en"
			supportedLocales: ["en"]
		}
		errorHandling: {
			errorBoundaries: true
			logging: true
			userFeedback: true
		}
	}
}