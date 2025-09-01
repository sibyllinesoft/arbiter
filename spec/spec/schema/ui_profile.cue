package schema

import "strings"

// UI Profile Schema for Arbiter Assembly
// Defines UI artifact contracts for different platforms: web | cli | tui | desktop
// Enforces routes, design tokens, accessibility, performance, and testing requirements

#UIProfile: {
	platform: "web" | "cli" | "tui" | "desktop"
	routes: [...#UIRoute] & minItems(1)
	designTokens: #DesignTokens
	cliTree?: [...#CLITreeNode]  // Only for CLI/TUI platforms
}

#UIRoute: {
	path: string & !=""
	component: string & !=""
	data: #RouteDataContract
	guards: [...string]  // CUE boolean expressions (auth, feature flags)
	ux: #UXRequirements
	state: #StateContract
	tests: #RouteTests
}

#RouteDataContract: {
	read: [...#DataSource]
	write: [...#DataAction]
}

#DataSource: {
	source: string & !=""  // data source identifier
	schema: string & !=""  // schema reference or definition
}

#DataAction: {
	action: string & !=""  // action identifier
	schema: string & !=""  // schema reference or definition
}

#UXRequirements: {
	a11y: #AccessibilityReqs
	perf: #PerformanceReqs
	i18n: #InternationalizationReqs
}

#AccessibilityReqs: {
	aria: bool  // ARIA compliance required
	contrast: "AA" | "AAA" | string & =~"^[A-Z]{2,3}$"  // WCAG contrast level
}

#PerformanceReqs: {
	tti_ms: int & >=0  // Time to Interactive in milliseconds
	lcp_ms: int & >=0  // Largest Contentful Paint in milliseconds
}

#InternationalizationReqs: {
	requiredKeys: [...string]  // Required translation keys
}

#StateContract: {
	machine: string & !=""  // SCXML/JSON statechart reference
}

#RouteTests: {
	e2e: [...string] & minItems(1)  // End-to-end test scenarios
	a11y: bool  // Accessibility testing required
	visual: bool  // Visual regression testing required
}

#DesignTokens: {
	color: #ColorTokens
	spacing: #SpacingTokens
	typography: #TypographyTokens
}

#ColorTokens: {
	[string]: string | #ColorPalette
}

#ColorPalette: {
	50?: string   // Lightest shade
	100?: string
	200?: string
	300?: string
	400?: string
	500?: string  // Base color
	600?: string
	700?: string
	800?: string
	900?: string  // Darkest shade
	950?: string  // Extra dark shade
}

#SpacingTokens: {
	[string]: string | number  // e.g., "4px", "0.25rem", 4
}

#TypographyTokens: {
	[string]: #TypographyStyle
}

#TypographyStyle: {
	fontFamily?: string
	fontSize?: string | number
	fontWeight?: string | number
	lineHeight?: string | number
	letterSpacing?: string | number
}

// CLI Tree Definition for CLI/TUI platforms
#CLITreeNode: {
	name: string & =~"^[a-z][a-z0-9-]*$"  // kebab-case command names
	args: [...#CLIArg]
	flags: [...#CLIFlag]
	exits: [...#ExitCode] & minItems(1)
	examples: [...string] & minItems(1)
	subcommands?: [...#CLITreeNode]  // Nested command structure
}

// Reuse existing CLI types from artifact_spec.cue
// #CLIArg, #CLIFlag, and #ExitCode are already defined in artifact_spec.cue

// Platform-specific validation rules
_platformValidation: {
	if platform == "web" {
		// Web-specific validations
		routes: [...{
			path: =~"^/.*$"  // Web paths must start with /
			ux: {
				perf: {
					tti_ms: <=3000  // Web TTI should be under 3 seconds
					lcp_ms: <=2500  // Web LCP should be under 2.5 seconds
				}
			}
		}]
		cliTree: *null | _|_  // CLI tree not applicable for web
	}
	
	if platform == "cli" || platform == "tui" {
		// CLI/TUI-specific validations
		cliTree: minItems(1)  // CLI platforms must have command tree
		routes: [...{
			path: !~"^/.*$"  // CLI routes shouldn't be URL paths
		}]
	}
	
	if platform == "desktop" {
		// Desktop-specific validations
		routes: [...{
			ux: {
				perf: {
					tti_ms: <=1000  // Desktop should be more responsive
				}
			}
		}]
	}
}

// Additional constraints for UI-specific testing
#UITestConstraints: {
	// Visual regression testing is required for web and desktop platforms
	if platform == "web" || platform == "desktop" {
		routes: [...{
			tests: {
				visual: true  // Visual testing mandatory for visual platforms
			}
		}]
	}
	
	// Accessibility testing is required for all platforms except CLI
	if platform != "cli" {
		routes: [...{
			tests: {
				a11y: true  // Accessibility testing mandatory
			}
		}]
	}
}

// Design token validation
_designTokenValidation: {
	// Color tokens should use consistent naming
	designTokens: {
		color: {
			[=~"^(primary|secondary|accent|neutral|semantic).*$"]: _  // Standard color categories
		}
		
		// Spacing should follow consistent scale
		spacing: {
			[=~"^(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl)$"]: _  // T-shirt sizing
		}
		
		// Typography should have consistent hierarchy
		typography: {
			[=~"^(heading|body|caption|overline).*$"]: _  // Semantic typography names
		}
	}
}

// Helper functions
minItems(n: int): { _hiddenMinItems: n }