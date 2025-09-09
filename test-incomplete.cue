package testproject

{
	product: {
		name: "Test Project"
		// Missing goals - should trigger warning
	}
	metadata: {
		name: "test-project"
		version: "1.0.0"
		// Missing description - should trigger warning
	}
	services: {
		api: {
			serviceType: "bespoke"  // Source service
			language: "typescript"
			type: "deployment"
			ports: [{
				name: "http"
				port: 3000
				targetPort: 3000
			}]
			// Missing health check, resources, env - should trigger warnings
		}
	}
	ui: {
		routes: [{
			id: "dashboard"
			path: "/"
			// Missing capabilities and components - should trigger warnings
		}]
	}
	// Missing tests, epics, security, performance, etc. - should trigger warnings
}