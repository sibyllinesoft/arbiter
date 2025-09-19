# SRF v1.1 - Structured Requirements Format

## Project Metadata

```yaml
srf.metadata:
  version: '1.1'
  project_name: '[PROJECT_NAME]'
  project_id: '[PROJECT_ID]'
  description: '[BRIEF_PROJECT_DESCRIPTION]'
  created_at: '[ISO_DATE]'
  last_modified: '[ISO_DATE]'
  stakeholders:
    product_owner: '[PRODUCT_OWNER]'
    tech_lead: '[TECH_LEAD]'
    team: '[TEAM_NAME]'
  tags: ['[TAG1]', '[TAG2]', '[TAG3]']
  status: 'draft|active|deprecated'
```

## Project Context

### Problem Statement

[Describe the problem this project solves, target users, and business value]

### Success Criteria

[Define measurable outcomes and key results]

### Constraints and Assumptions

[List technical, business, and operational constraints]

## Technical Specifications

```yaml
srf.technical:
  artifact_profile: 'library|cli|service|ui|job'
  language_primary: '[PRIMARY_LANGUAGE]'
  languages_secondary: ['[LANG1]', '[LANG2]']
  frameworks:
    primary: '[PRIMARY_FRAMEWORK]'
    secondary: ['[FRAMEWORK1]', '[FRAMEWORK2]']
  runtime_environment: '[RUNTIME_ENV]'
  deployment_targets: ['[TARGET1]', '[TARGET2]']
  compatibility:
    platforms: ['[PLATFORM1]', '[PLATFORM2]']
    versions: '[VERSION_REQUIREMENTS]'
```

## Requirements Categories

### Functional Requirements

```yaml
srf.requirements.functional:
  - id: 'FR-001'
    title: '[REQUIREMENT_TITLE]'
    description: '[DETAILED_DESCRIPTION]'
    priority: 'critical|high|medium|low'
    category: 'core|feature|integration|ui'
    acceptance_criteria:
      - 'Given [CONDITION], when [ACTION], then [OUTCOME]'
      - 'Given [CONDITION], when [ACTION], then [OUTCOME]'
    dependencies: ['[DEP_ID1]', '[DEP_ID2]']
    effort_estimate: '[STORY_POINTS|HOURS]'
    business_value: '[HIGH|MEDIUM|LOW]'
```

### Non-Functional Requirements

```yaml
srf.requirements.non_functional:
  performance:
    response_time:
      target: '[TARGET_MS]ms'
      max_acceptable: '[MAX_MS]ms'
    throughput:
      target: '[TARGET_RPS] requests/second'
      peak_load: '[PEAK_RPS] requests/second'
    resource_usage:
      memory_limit: '[MEMORY_MB]MB'
      cpu_limit: '[CPU_PERCENT]%'
  scalability:
    concurrent_users: '[MAX_USERS]'
    data_volume: '[MAX_RECORDS]'
    growth_projection: '[GROWTH_RATE]% per [PERIOD]'
  reliability:
    availability_slo: '[UPTIME_PERCENT]%'
    error_budget: '[ERROR_RATE]%'
    mttr_target: '[MINUTES] minutes'
    backup_frequency: '[FREQUENCY]'
  security:
    authentication: 'required|optional|none'
    authorization: 'rbac|acl|none'
    data_encryption: 'at_rest|in_transit|both|none'
    compliance: ['[STANDARD1]', '[STANDARD2]']
    vulnerability_scanning: 'required|optional'
  usability:
    accessibility: 'wcag_2_1_aa|wcag_2_1_a|none'
    browser_support: ['[BROWSER1]', '[BROWSER2]']
    mobile_responsive: 'required|optional|not_applicable'
    i18n_support: 'required|optional|none'
```

## Architecture & Design

```yaml
srf.architecture:
  pattern: 'monolith|microservices|serverless|library|cli'
  components:
    - name: '[COMPONENT_NAME]'
      type: '[COMPONENT_TYPE]'
      responsibility: '[COMPONENT_RESPONSIBILITY]'
      interfaces: ['[INTERFACE1]', '[INTERFACE2]']
  data_storage:
    primary: '[DATABASE_TYPE]'
    secondary: ['[CACHE_TYPE]', '[QUEUE_TYPE]']
    data_retention: '[RETENTION_POLICY]'
  external_dependencies:
    apis:
      - name: '[API_NAME]'
        url: '[API_URL]'
        authentication: '[AUTH_TYPE]'
        rate_limits: '[LIMITS]'
        fallback_strategy: '[FALLBACK]'
    services:
      - name: '[SERVICE_NAME]'
        type: '[SERVICE_TYPE]'
        criticality: 'critical|important|optional'
```

## API Specifications

```yaml
srf.api:
  style: 'rest|graphql|grpc|webhook'
  base_url: '[BASE_URL]'
  version_strategy: 'header|path|query'
  authentication:
    method: 'bearer|api_key|oauth2|none'
    scopes: ['[SCOPE1]', '[SCOPE2]']
  endpoints:
    - path: '[ENDPOINT_PATH]'
      method: '[HTTP_METHOD]'
      description: '[ENDPOINT_DESCRIPTION]'
      request_schema: '[SCHEMA_REF]'
      response_schema: '[SCHEMA_REF]'
      error_codes: ['[CODE1]', '[CODE2]']
      rate_limit: '[REQUESTS_PER_MINUTE]'
  data_schemas:
    - name: '[SCHEMA_NAME]'
      type: 'object|array|primitive'
      properties:
        field1:
          type: '[FIELD_TYPE]'
          required: true|false
          description: '[FIELD_DESCRIPTION]'
```

## Quality Assurance

```yaml
srf.quality:
  testing_strategy:
    unit_tests:
      coverage_target: '[PERCENTAGE]%'
      framework: '[TEST_FRAMEWORK]'
    integration_tests:
      coverage_target: '[PERCENTAGE]%'
      test_data_strategy: '[STRATEGY]'
    end_to_end_tests:
      coverage_target: '[PERCENTAGE]%'
      automation_level: '[PERCENTAGE]%'
    performance_tests:
      load_testing: 'required|optional'
      stress_testing: 'required|optional'
      tools: ['[TOOL1]', '[TOOL2]']
  code_quality:
    linting: 'required|optional'
    static_analysis: 'required|optional'
    complexity_limits:
      cyclomatic: '[MAX_COMPLEXITY]'
      nesting_depth: '[MAX_DEPTH]'
    documentation:
      api_docs: 'required|optional'
      inline_comments: 'required|optional'
      architecture_docs: 'required|optional'
```

## Operations & Deployment

```yaml
srf.operations:
  deployment:
    strategy: 'blue_green|rolling|canary|direct'
    environments: ['development', 'staging', 'production']
    automation_level: '[PERCENTAGE]%'
    rollback_strategy: '[STRATEGY]'
  monitoring:
    metrics:
      - name: '[METRIC_NAME]'
        type: 'counter|gauge|histogram|summary'
        description: '[METRIC_DESCRIPTION]'
        labels: ['[LABEL1]', '[LABEL2]']
    logging:
      level: 'debug|info|warn|error'
      structured: true|false
      retention: '[RETENTION_DAYS] days'
    alerting:
      channels: ['email', 'slack', 'pagerduty']
      escalation_policy: '[POLICY_NAME]'
  maintenance:
    backup_strategy: '[STRATEGY]'
    update_frequency: '[FREQUENCY]'
    maintenance_windows: '[SCHEDULE]'
```

## Project Constraints

```yaml
srf.constraints:
  timeline:
    start_date: '[ISO_DATE]'
    target_date: '[ISO_DATE]'
    hard_deadline: '[ISO_DATE]'
    milestones:
      - name: '[MILESTONE_NAME]'
        date: '[ISO_DATE]'
        deliverables: ['[DELIVERABLE1]', '[DELIVERABLE2]']
  budget:
    development_cost: '[CURRENCY_AMOUNT]'
    operational_cost_monthly: '[CURRENCY_AMOUNT]'
    infrastructure_cost: '[CURRENCY_AMOUNT]'
    third_party_costs: '[CURRENCY_AMOUNT]'
  resources:
    team_size: '[NUMBER] developers'
    skill_requirements: ['[SKILL1]', '[SKILL2]']
    external_dependencies: ['[VENDOR1]', '[VENDOR2]']
  compliance:
    regulations: ['[REGULATION1]', '[REGULATION2]']
    certifications: ['[CERT1]', '[CERT2]']
    audit_requirements: ['[REQ1]', '[REQ2]']
```

## Risk Assessment

```yaml
srf.risks:
  - id: 'RISK-001'
    description: '[RISK_DESCRIPTION]'
    category: 'technical|business|operational|external'
    probability: 'high|medium|low'
    impact: 'high|medium|low'
    risk_score: '[CALCULATED_SCORE]'
    mitigation_strategy: '[STRATEGY]'
    contingency_plan: '[PLAN]'
    owner: '[RESPONSIBLE_PERSON]'
    review_date: '[ISO_DATE]'
```

## Validation Criteria

```yaml
srf.validation:
  acceptance_tests:
    - scenario: '[TEST_SCENARIO]'
      given: '[PRECONDITIONS]'
      when: '[ACTIONS]'
      then: '[EXPECTED_OUTCOMES]'
      verification_method: 'automated|manual|both'
  performance_criteria:
    - metric: '[METRIC_NAME]'
      baseline: '[BASELINE_VALUE]'
      target: '[TARGET_VALUE]'
      measurement_method: '[METHOD]'
  quality_gates:
    - gate: '[GATE_NAME]'
      criteria: '[CRITERIA]'
      measurement: '[MEASUREMENT_METHOD]'
      threshold: '[THRESHOLD_VALUE]'
```

## Appendices

### Glossary

[Define domain-specific terms and acronyms]

### References

[List relevant documentation, standards, and external resources]

### Change Log

```yaml
srf.changelog:
  - version: '1.1.0'
    date: '[ISO_DATE]'
    changes: ['[CHANGE1]', '[CHANGE2]']
    author: '[AUTHOR]'
```
