// Arbiter Assembly Specification
// Generated from requirements analysis
// Template: service
// Generated: 2025-09-01T01:29:21.558Z

package assembly

import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

// Metadata
apiVersion: "arbiter.dev/v2"
kind: "Assembly"
metadata: {
    name: "generated-assembly"
    template: "service"
    generated: "2025-09-01T01:29:21.558Z"
    source: "requirements-driven"
}

// Project artifact definition
Artifact: artifact.#Artifact & {
    kind: "service"
    language: "typescript" // TODO: detect from project
    
    build: {
        tool: "bun" // TODO: detect from project
        targets: ["./..."]
        matrix: {
            versions: ["latest"]
            os: ["linux", "darwin"] 
            arch: ["amd64", "arm64"]
        }
    }
    
    packaging: {
        publish: true
        registry: "npm" // TODO: detect from project
        artifact: "npm"
    }
}

// Profile configuration based on template
Profile: profiles.#service & {
    semver: "strict"
    apiSurface: {
        source: "generated"
        file: "./dist/api-surface.json"
    }
    contracts: {
        forbidBreaking: true
        invariants: [
            // TODO: Generate from requirements
            {
                name: "determinism"
                description: "Operations must be deterministic"
                rule: "same inputs produce identical outputs"
            },
            {
                name: "performance"
                description: "Respect performance constraints"
                rule: "response time <= 750ms, payload <= 64KB"
            }
        ]
    }
    gates: {
        quality: {
            testCoverage: 90
            lintPassing: true
            typeCheck: true
        }
        performance: {
            responseTime: "750ms"
            payloadSize: "64KB"
        }
    }
}

// Generated milestones (TODO: extract from requirements)
milestones: {
    M1: {
        title: "Core Foundation"
        description: "Basic functionality and infrastructure"
        deliverables: ["REQ-SERVER-01", "REQ-CLI-01"]
    }
    M2: {
        title: "Requirements Pipeline"
        description: "Requirements analysis and spec generation"
        deliverables: ["REQ-PIPELINE-01"]
        dependencies: ["M1"]
    }
}

// Quality contracts
contracts: {
    invariants: [
        {
            name: "api_stability"
            description: "Public APIs maintain backward compatibility"
            enforcement: "breaking_changes_require_major_version"
        },
        {
            name: "deterministic_outputs"
            description: "Same inputs produce identical outputs"
            enforcement: "validate_with_golden_files"
        }
    ]
}
