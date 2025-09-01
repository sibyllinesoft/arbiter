package epics

import "arbiter.com/epics"

// Example: Configuration refactoring with patch mode
ConfigRefactorExample: epics.#Epic & {
	id: "EPIC-CONFIG-REFACTOR-002"
	title: "Migrate configuration from JSON to strongly-typed CUE"
	owners: ["platform-team", "config-owners"]

	targets: [{
		root: "config"
		include: ["**/*.json", "**/*.cue"]
		exclude: ["**/node_modules/**", "**/temp/**"]
	}, {
		root: "src"
		include: ["**/config.ts", "**/types.ts"]
		exclude: ["**/*.test.ts"]
	}]

	generate: [
		{
			path: "config/app.cue"
			mode: "create"
			template: "templates/config/app.cue.t"
			data: {
				appName: "arbiter"
				environments: ["development", "staging", "production"]
				features: ["auth", "analytics", "monitoring"]
			}
			guards: ["app.cue already exists in config/"]
		},
		{
			path: "config/schema.cue"
			mode: "create" 
			template: "templates/config/schema.cue.t"
			data: {
				version: "v2"
				strictValidation: true
			}
		},
		{
			path: "src/types/config.ts"
			mode: "patch"
			template: """
			// ARBITER:BEGIN config-types
			export interface AppConfig {
				database: DatabaseConfig;
				auth: AuthConfig;
				monitoring: MonitoringConfig;
			}
			// ARBITER:END config-types
			"""
			guards: ["ARBITER:BEGIN config-types already exists"]
		},
		{
			path: "src/config.ts"
			mode: "patch"
			template: """
			// ARBITER:BEGIN config-loader
			import { loadCueConfig } from './lib/cue-loader';
			
			export const config = loadCueConfig<AppConfig>('config/app.cue');
			// ARBITER:END config-loader
			"""
			guards: ["ARBITER:BEGIN config-loader already exists"]
		}
	]

	contracts: {
		types: [
			// All config must be valid CUE
			"config.app != _|_",
			"config.schema != _|_",
			// TypeScript types must be compatible
			"src.types.AppConfig.database != _|_"
		]
		invariants: [
			"All configuration must be statically validated",
			"No runtime configuration errors allowed",
			"All environments must use same schema structure"
		]
	}

	tests: {
		static: [
			{ selector: "config/**/*.cue" },
			{ selector: "src/types/config.ts" }
		]

		property: [
			{
				name: "CUE config validates successfully"
				cue: "config.app._validate == true"
			},
			{
				name: "TypeScript types match CUE schema"  
				cue: "config.typescript.compatibility == true"
			}
		]

		golden: [
			{
				input: "config/app.cue"
				want: "testdata/golden/app-config.cue"
			},
			{
				input: "src/types/config.ts"
				want: "testdata/golden/config-types.ts"
			}
		]

		cli: [
			{
				cmd: "cue vet config/"
				expectExit: 0
				expectRE: "validation successful"
			},
			{
				cmd: "npm run config:validate"
				expectExit: 0
			}
		]
	}

	rollout: {
		steps: [
			"Create CUE schema files",
			"Generate TypeScript types from CUE",
			"Patch existing config loader",
			"Validate all environments",
			"Remove legacy JSON configs"
		]
		gates: [
			{
				name: "All CUE files validate"
				cue: "config.validation.allValid == true"
			},
			{
				name: "TypeScript compilation with new types succeeds"
				cue: "src.typescript.compilation.success == true"
			},
			{
				name: "All environment configs load correctly"
				cue: "config.environments.allLoaded == true"
			}
		]
	}

	heuristics: {
		preferSmallPRs: true
		maxFilesPerPR: 5
	}

	metadata: {
		priority: "medium"
		complexity: 5
		tags: ["configuration", "migration", "cue", "typescript", "refactoring"]
	}
}