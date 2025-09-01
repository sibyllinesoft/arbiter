package epics

import "arbiter.com/epics"

// Example: Creating a new microservice with full scaffolding
NewServiceExample: epics.#Epic & {
	id: "EPIC-NEW-SERVICE-001"
	title: "Create user authentication microservice"
	owners: ["team-auth", "john.doe@company.com"]

	targets: [{
		root: "services/auth"
		include: ["**/*.ts", "**/*.json", "**/*.md"]
		exclude: ["**/node_modules/**", "**/dist/**"]
	}]

	generate: [
		{
			path: "services/auth/package.json"
			mode: "create"
			template: "templates/service/package.json.t"
			data: {
				name: "auth-service"
				version: "1.0.0"
				description: "User authentication microservice"
				author: "Auth Team"
			}
			guards: ["package.json already exists in services/auth"]
		},
		{
			path: "services/auth/src/index.ts"
			mode: "create"
			template: "templates/service/index.ts.t"
			data: {
				serviceName: "AuthService"
				port: 3001
				database: "postgres"
			}
			guards: ["src/index.ts already exists"]
		},
		{
			path: "services/auth/src/routes/auth.ts"
			mode: "create"
			template: "templates/service/routes.ts.t"
			data: {
				routePrefix: "/api/v1/auth"
				methods: ["login", "logout", "refresh", "register"]
			}
		},
		{
			path: "services/auth/Dockerfile"
			mode: "create"
			template: "templates/service/Dockerfile.t"
			data: {
				baseImage: "node:18-alpine"
				workdir: "/app"
				port: 3001
			}
		}
	]

	contracts: {
		types: [
			// Service must export proper TypeScript types
			"services.auth.exports.AuthService != _|_",
			// Must have proper error handling
			"services.auth.errorHandling.middleware != _|_"
		]
		invariants: [
			"All API endpoints must be authenticated",
			"All passwords must be hashed using bcrypt",
			"JWT tokens must expire within 24 hours"
		]
	}

	tests: {
		static: [{
			selector: "services/auth/**/*.ts"
		}]

		property: [
			{
				name: "Service exports main class"
				cue: "services.auth.exports.AuthService != _|_"
			},
			{
				name: "All routes are properly typed"
				cue: "len(services.auth.routes) > 0"
			}
		]

		golden: [{
			input: "services/auth/src/index.ts"
			want: "testdata/golden/auth-service-index.ts"
		}]

		cli: [
			{
				cmd: "npm test"
				expectExit: 0
				expectRE: "All tests passed"
			},
			{
				cmd: "npm run type-check"
				expectExit: 0
			}
		]
	}

	rollout: {
		steps: [
			"Create service directory structure",
			"Generate service scaffolding",
			"Run type checking and tests",
			"Update docker-compose.yml",
			"Add service to API gateway routing"
		]
		gates: [
			{
				name: "TypeScript compilation succeeds"
				cue: "services.auth.compilation.success == true"
			},
			{
				name: "All unit tests pass"
				cue: "services.auth.tests.unitTests.allPassed == true"
			},
			{
				name: "Service starts successfully"
				cue: "services.auth.healthCheck.status == \"healthy\""
			}
		]
	}

	heuristics: {
		preferSmallPRs: true
		maxFilesPerPR: 8
	}

	metadata: {
		priority: "high"
		complexity: 7
		tags: ["microservice", "authentication", "security", "typescript"]
	}
}