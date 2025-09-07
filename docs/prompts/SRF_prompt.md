# SRF v1.1 Creation Instructions

## Overview
You are creating a Structured Requirements Format (SRF) v1.1 document that will be processed by the Arbiter system to generate formal CUE specifications, validation rules, and test cases. Follow these guidelines carefully.

## Key Principles

### 1. Structured Data Blocks
- All `srf.*` blocks MUST be valid YAML or JSON
- Use consistent indentation (2 spaces for YAML)
- Quote string values that might contain special characters
- Use proper list syntax for arrays
- Ensure all required fields are present

### 2. Requirement Completeness
- Every functional requirement needs clear acceptance criteria
- Use the "Given-When-Then" format for behavioral specifications
- Include measurable success metrics
- Specify dependencies between requirements
- Assign realistic priority levels

### 3. Technical Specificity
- Choose appropriate artifact profiles: `library`, `cli`, `service`, `ui`, `job`
- Specify actual technologies, not generic placeholders
- Include version constraints where relevant
- Define concrete API contracts when applicable
- Set realistic performance targets

## Section-by-Section Guidelines

### Project Metadata
- Use kebab-case for `project_id`
- Include ISO 8601 timestamps
- Tag projects meaningfully (`api`, `frontend`, `mobile`, etc.)
- Set status appropriately (`draft`, `active`, `deprecated`)

### Technical Specifications
- **Artifact Profile Selection:**
  - `library`: Reusable code packages, SDKs, utilities
  - `cli`: Command-line tools and utilities
  - `service`: Backend services, APIs, microservices
  - `ui`: Frontend applications, dashboards, websites
  - `job`: Batch processes, workers, scheduled tasks

- **Language and Framework:**
  - Be specific: "TypeScript" not "JavaScript"
  - Include version constraints: "Node.js >=18.0.0"
  - List secondary languages for polyglot projects
  - Specify framework versions: "React 18.x", "FastAPI 0.100+"

### Functional Requirements
- **ID Format:** Use consistent prefixes: `FR-001`, `NFR-001`, `API-001`
- **Acceptance Criteria:** Write testable conditions
  ```yaml
  acceptance_criteria:
    - "Given a valid API key, when making a request, then return 200 status"
    - "Given invalid credentials, when authenticating, then return 401 error"
  ```
- **Dependencies:** Reference other requirement IDs
- **Effort Estimation:** Use story points or hour estimates consistently

### Non-Functional Requirements
- **Performance Targets:** Be realistic and measurable
  - Response time: `< 200ms` for web APIs
  - Throughput: `1000 requests/second` for high-load services
  - Memory: `< 512MB` for containerized services
  
- **Scalability Numbers:** Base on actual usage projections
  - Concurrent users: realistic peaks, not theoretical maximums
  - Data volume: consider growth over 2-3 years
  
- **SLOs and Error Budgets:** Industry-standard targets
  - Availability: `99.9%` for internal tools, `99.99%` for critical services
  - Error rate: `< 0.1%` for production systems

### API Specifications
- **Complete Endpoint Documentation:**
  ```yaml
  endpoints:
    - path: "/api/v1/users"
      method: "GET"
      description: "List users with pagination"
      request_schema: "PaginationRequest"
      response_schema: "UserListResponse"
      error_codes: ["400", "401", "500"]
      rate_limit: "100/minute"
  ```

### Quality Assurance
- **Test Coverage Targets:**
  - Unit tests: 80-90% for business logic
  - Integration tests: 70-80% for API endpoints
  - E2E tests: Cover critical user workflows
- **Code Quality Tools:** Specify actual tools (ESLint, Prettier, SonarQube)

### Operations & Deployment
- **Monitoring Strategy:** Define actual metrics
  ```yaml
  metrics:
    - name: "http_requests_total"
      type: "counter"
      description: "Total HTTP requests by method and status"
      labels: ["method", "status_code", "endpoint"]
  ```

## Data Quality Standards

### Placeholder Management
- Use `"TBD"` for unknown external APIs or third-party dependencies
- Use `"[TO_BE_DETERMINED]"` for values requiring stakeholder input
- Replace `"[PLACEHOLDER]"` with actual values before finalizing

### Realistic Values
- Set conservative but achievable performance targets
- Use industry-standard SLA percentages
- Base resource estimates on similar projects
- Include buffer time in timeline estimates

### Consistency Checks
- Ensure artifact profile matches technical specifications
- Verify dependency relationships are bidirectional
- Check that non-functional requirements align with use cases
- Validate that monitoring covers defined SLOs

## Common Patterns by Artifact Type

### Library/SDK
```yaml
srf.technical:
  artifact_profile: "library"
  language_primary: "TypeScript"
  deployment_targets: ["npm", "cdn"]
```

### CLI Tool
```yaml
srf.technical:
  artifact_profile: "cli"
  language_primary: "Go"
  deployment_targets: ["binary", "homebrew", "apt"]
```

### Web Service
```yaml
srf.technical:
  artifact_profile: "service"
  language_primary: "Python"
  frameworks:
    primary: "FastAPI"
  deployment_targets: ["docker", "kubernetes"]
```

### Frontend Application
```yaml
srf.technical:
  artifact_profile: "ui"
  language_primary: "TypeScript"
  frameworks:
    primary: "React"
  deployment_targets: ["cdn", "nginx"]
```

### Background Job
```yaml
srf.technical:
  artifact_profile: "job"
  language_primary: "Python"
  deployment_targets: ["kubernetes-cronjob", "aws-lambda"]
```

## Final Validation Checklist

Before submitting your SRF document:

- [ ] All YAML blocks are syntactically valid
- [ ] Every functional requirement has acceptance criteria
- [ ] Technical specifications match the artifact profile
- [ ] Performance targets are realistic and measurable
- [ ] API endpoints are completely specified
- [ ] Dependencies are properly referenced
- [ ] Risk assessments include mitigation strategies
- [ ] Timeline includes realistic milestones
- [ ] Monitoring strategy covers defined SLOs
- [ ] No placeholder values remain in critical fields

## Output Format

Generate a complete SRF v1.1 document that:
1. Follows the exact template structure
2. Contains valid YAML/JSON in all `srf.*` blocks
3. Provides specific, actionable requirements
4. Can be immediately processed by: `arbiter srf import your-srf.md`

Begin your response with the complete SRF document. Do not include explanatory text before or after the document itself.