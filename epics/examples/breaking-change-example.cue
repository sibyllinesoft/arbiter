package epics

import "arbiter.com/epics"

// Example: Breaking change with migration support
BreakingChangeExample: epics.#Epic & {
	id: "EPIC-BREAKING-CHANGE-003"
	title: "Migrate API from v1 to v2 with backward compatibility"
	owners: ["api-team", "migration-squad"]

	targets: [{
		root: "api"
		include: ["**/*.ts", "**/*.json", "**/openapi.yml"]
		exclude: ["**/node_modules/**", "**/dist/**"]
	}, {
		root: "migrations"
		include: ["**/*.sql", "**/*.ts"]
		exclude: []
	}]

	generate: [
		{
			path: "api/v2/routes/users.ts"
			mode: "create"
			template: "templates/api/v2-route.ts.t"
			data: {
				entityName: "User"
				version: "v2"
				breakingChanges: {
					"userId": "id",
					"userName": "username", 
					"createdAt": "created_at"
				}
			}
			guards: ["v2/routes/users.ts already exists"]
		},
		{
			path: "api/v1/routes/users.ts"
			mode: "patch"
			template: """
			// ARBITER:BEGIN deprecation-warning
			/**
			 * @deprecated This endpoint is deprecated. Use /api/v2/users instead.
			 * Will be removed in version 3.0.0
			 */
			// ARBITER:END deprecation-warning
			"""
			guards: ["ARBITER:BEGIN deprecation-warning already exists"]
		},
		{
			path: "migrations/001-users-v2-schema.sql"
			mode: "create"
			template: "templates/migrations/schema-migration.sql.t"
			data: {
				tableName: "users"
				changes: [
					"RENAME COLUMN userId TO id",
					"RENAME COLUMN userName TO username", 
					"RENAME COLUMN createdAt TO created_at"
				]
			}
		},
		{
			path: "api/middleware/version-compatibility.ts"
			mode: "create"
			template: "templates/api/version-middleware.ts.t"
			data: {
				supportedVersions: ["v1", "v2"]
				defaultVersion: "v2"
				deprecatedVersions: ["v1"]
			}
		}
	]

	contracts: {
		types: [
			// Both API versions must be valid
			"api.v1.routes.users != _|_",
			"api.v2.routes.users != _|_",
			// Migration must be reversible
			"migrations.reversible == true"
		]
		invariants: [
			"v1 API must continue to work during migration period",
			"All v1 responses must include deprecation headers", 
			"v2 API must be fully backward compatible at data level",
			"Migration must be atomic and rollbackable"
		]
	}

	tests: {
		static: [
			{ selector: "api/v1/**/*.ts" },
			{ selector: "api/v2/**/*.ts" },
			{ selector: "migrations/**/*.sql" }
		]

		property: [
			{
				name: "v1 API still functional"
				cue: "api.v1.functional == true"
			},
			{
				name: "v2 API provides same functionality"
				cue: "api.v2.functional == true && api.v2.compatibility.v1 == true"
			},
			{
				name: "Migration is reversible"
				cue: "migrations.reversible == true"
			}
		]

		golden: [
			{
				input: "api/v1/routes/users.ts"
				want: "testdata/golden/users-v1-deprecated.ts"
			},
			{
				input: "api/v2/routes/users.ts" 
				want: "testdata/golden/users-v2-new.ts"
			}
		]

		cli: [
			{
				cmd: "npm run test:api:v1"
				expectExit: 0
				expectRE: "all v1 tests pass"
			},
			{
				cmd: "npm run test:api:v2"
				expectExit: 0
				expectRE: "all v2 tests pass"
			},
			{
				cmd: "npm run migration:test"
				expectExit: 0
				expectRE: "migration successful"
			},
			{
				cmd: "npm run migration:rollback:test"
				expectExit: 0
				expectRE: "rollback successful"
			}
		]
	}

	rollout: {
		steps: [
			"Create v2 API endpoints alongside v1",
			"Add deprecation warnings to v1 endpoints",
			"Create database migration scripts",
			"Add version compatibility middleware",
			"Test both versions in parallel",
			"Run migration in staging",
			"Deploy to production with feature flag",
			"Monitor error rates and performance",
			"Gradually migrate clients to v2",
			"Remove v1 endpoints after migration period"
		]
		gates: [
			{
				name: "Both API versions pass all tests"
				cue: "api.v1.tests.allPassed == true && api.v2.tests.allPassed == true"
			},
			{
				name: "Migration script tested successfully"
				cue: "migrations.tested == true && migrations.rollbackTested == true"
			},
			{
				name: "No increase in error rates"
				cue: "monitoring.errorRate.current <= monitoring.errorRate.baseline"
			},
			{
				name: "Performance within acceptable limits"  
				cue: "monitoring.responseTime.p95 <= monitoring.responseTime.sla"
			},
			{
				name: "At least 90% of clients migrated to v2"
				cue: "api.v2.adoptionRate >= 0.9"
			}
		]
	}

	heuristics: {
		preferSmallPRs: true
		maxFilesPerPR: 6
	}

	metadata: {
		priority: "critical"
		complexity: 9
		tags: ["breaking-change", "migration", "api", "backward-compatibility", "database"]
	}
}