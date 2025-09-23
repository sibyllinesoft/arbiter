import type { Meta, StoryObj } from '@storybook/react';
import { DataViewer } from './DataViewer';
import { MermaidRenderer } from './MermaidRenderer';
import { NetworkDiagram } from './NetworkDiagram';
import { SplitViewShowcase } from './SplitViewShowcase';

const meta = {
  title: 'Diagrams/Flow Diagrams - Split View',
  component: SplitViewShowcase,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SplitViewShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// REALISTIC FLOW DATA EXAMPLES
// ============================================================================

const buildPipelineYaml = `# CI/CD Build Pipeline Specification
name: "E-commerce Platform Build Pipeline"
version: "1.2.0"

stages:
  - name: "preparation"
    displayName: "Environment Setup"
    tasks:
      - checkout_code
      - setup_node
      - install_dependencies
    
  - name: "validation" 
    displayName: "Code Quality Checks"
    dependsOn: ["preparation"]
    tasks:
      - lint_typescript
      - format_check
      - security_scan
      
  - name: "testing"
    displayName: "Test Execution"
    dependsOn: ["validation"]
    parallel: true
    tasks:
      - unit_tests
      - integration_tests
      - e2e_tests
      
  - name: "build"
    displayName: "Application Build"  
    dependsOn: ["testing"]
    tasks:
      - build_frontend
      - build_docker_image
      - push_to_registry
      
  - name: "deployment"
    displayName: "Deploy to Staging"
    dependsOn: ["build"]
    condition: "branch == 'main'"
    tasks:
      - deploy_to_staging
      - smoke_tests
      - notify_team

# Flow Configuration
flow_config:
  retry_policy: "exponential_backoff"
  timeout: "30m"
  notification_channels: ["slack", "email"]
  
# Environment Variables
environments:
  staging:
    api_url: "https://api-staging.company.com"
    database: "staging_db"
  production:
    api_url: "https://api.company.com" 
    database: "prod_db"`;

const buildPipelineMermaid = `graph TD
    A[Checkout Code] --> B[Setup Node.js]
    B --> C[Install Dependencies]
    C --> D{Code Quality}
    
    D -->|TypeScript| E[Lint & Format]
    D -->|Security| F[Security Scan]
    E --> G[Code Quality Gate]
    F --> G
    
    G --> H{Test Suite}
    H -->|Unit| I[Unit Tests]
    H -->|Integration| J[Integration Tests]  
    H -->|E2E| K[End-to-End Tests]
    
    I --> L[Test Results]
    J --> L
    K --> L
    
    L --> M{All Tests Pass?}
    M -->|Yes| N[Build Frontend]
    M -->|No| O[❌ Pipeline Failed]
    
    N --> P[Build Docker Image]
    P --> Q[Push to Registry]
    Q --> R{Branch Check}
    
    R -->|main| S[Deploy to Staging]
    R -->|feature| T[✅ Build Complete]
    
    S --> U[Smoke Tests]
    U --> V{Deploy Success?}
    V -->|Yes| W[✅ Deployment Complete]
    V -->|No| X[Rollback]
    X --> Y[❌ Deploy Failed]
    
    %% Styling
    classDef startEnd fill:#e1f5fe,stroke:#01579b
    classDef process fill:#f3e5f5,stroke:#4a148c
    classDef decision fill:#e8f5e8,stroke:#1b5e20
    classDef success fill:#c8e6c9,stroke:#2e7d32
    classDef error fill:#ffcdd2,stroke:#c62828
    
    class A,T,W startEnd
    class B,C,E,F,I,J,K,N,P,Q,S,U process
    class D,G,H,M,R,V decision
    class W,T success
    class O,X,Y error`;

const userAuthFlowYaml = `# User Authentication Flow Specification
name: "User Authentication & Authorization"
version: "2.1.0"

capabilities:
  - id: "C1"
    name: "User Registration"
    flow:
      start: "registration_request"
      steps:
        - id: "validate_input"
          name: "Input Validation"
          validations: ["email_format", "password_strength"]
          
        - id: "check_existing"
          name: "Duplicate Check"
          query: "SELECT email FROM users WHERE email = ?"
          
        - id: "create_account"
          name: "Account Creation" 
          actions: ["hash_password", "generate_id", "insert_user"]
          
        - id: "send_verification"
          name: "Email Verification"
          service: "email_service"
          template: "welcome_verification"
          
      end: "registration_complete"

  - id: "C2" 
    name: "User Login"
    flow:
      start: "login_request"
      steps:
        - id: "credential_check"
          name: "Validate Credentials"
          methods: ["password_verify", "account_status_check"]
          
        - id: "mfa_required"
          name: "Multi-Factor Auth"
          condition: "user.mfa_enabled"
          methods: ["sms_code", "totp_verify"]
          
        - id: "create_session"
          name: "Session Management"
          actions: ["generate_jwt", "set_cookies", "log_activity"]
          
        - id: "load_profile"
          name: "User Profile"
          includes: ["preferences", "permissions", "recent_activity"]
          
      end: "authenticated_session"

# Error Handling
error_flows:
  invalid_credentials:
    action: "increment_failed_attempts"
    threshold: 5
    consequence: "temporary_lockout"
    
  account_locked:
    action: "redirect_to_unlock"
    notification: "security_email"
    
  verification_expired:
    action: "resend_verification"
    expiry_extension: "24h"`;

const userAuthMermaid = `stateDiagram-v2
    [*] --> Idle
    
    Idle --> ValidatingInput : submit_login
    ValidatingInput --> CheckingCredentials : valid_input
    ValidatingInput --> InputError : invalid_input
    
    CheckingCredentials --> MFACheck : credentials_valid  
    CheckingCredentials --> FailedAttempt : credentials_invalid
    
    MFACheck --> MFAPrompt : mfa_enabled
    MFACheck --> CreatingSession : mfa_disabled
    
    MFAPrompt --> VerifyingMFA : mfa_code_entered
    VerifyingMFA --> CreatingSession : mfa_valid
    VerifyingMFA --> MFAError : mfa_invalid
    
    CreatingSession --> LoadingProfile : session_created
    LoadingProfile --> Authenticated : profile_loaded
    
    FailedAttempt --> CheckAttempts : increment_count
    CheckAttempts --> Idle : attempts_under_limit
    CheckAttempts --> AccountLocked : attempts_exceeded
    
    InputError --> Idle : retry
    MFAError --> MFAPrompt : retry_mfa
    AccountLocked --> [*] : account_locked
    Authenticated --> Idle : logout
    
    %% State styling
    classDef errorState fill:#ffebee,stroke:#d32f2f
    classDef successState fill:#e8f5e8,stroke:#2e7d32
    classDef processState fill:#e3f2fd,stroke:#1976d2
    
    class InputError,MFAError,FailedAttempt,AccountLocked errorState
    class Authenticated successState
    class ValidatingInput,CheckingCredentials,MFACheck,MFAPrompt,VerifyingMFA,CreatingSession,LoadingProfile processState`;

const microserviceArchYaml = `# Microservice Architecture Specification
name: "E-commerce Microservices Platform"
version: "3.0.0"

services:
  - name: "api-gateway"
    type: "gateway"
    port: 8080
    routes:
      - path: "/auth/*"
        service: "auth-service"
        methods: ["GET", "POST", "PUT"]
        
      - path: "/api/users/*"
        service: "user-service" 
        methods: ["GET", "POST", "PUT", "DELETE"]
        auth_required: true
        
      - path: "/api/products/*"
        service: "product-service"
        methods: ["GET", "POST", "PUT", "DELETE"]
        cache_ttl: "5m"
        
      - path: "/api/orders/*"
        service: "order-service"
        methods: ["GET", "POST", "PUT"]
        auth_required: true

  - name: "auth-service"
    type: "service"
    port: 8081
    database: "auth_db"
    dependencies: ["redis", "email-service"]
    endpoints:
      - "/login"
      - "/register" 
      - "/verify"
      - "/refresh-token"
      
  - name: "user-service"
    type: "service"
    port: 8082
    database: "user_db"
    dependencies: ["auth-service"]
    endpoints:
      - "/profile"
      - "/preferences"
      - "/activity"
      
  - name: "product-service" 
    type: "service"
    port: 8083
    database: "product_db"
    dependencies: ["inventory-service", "cache"]
    endpoints:
      - "/catalog"
      - "/search"
      - "/recommendations"
      
  - name: "order-service"
    type: "service"
    port: 8084
    database: "order_db"
    dependencies: ["user-service", "product-service", "payment-service"]
    endpoints:
      - "/create"
      - "/history"
      - "/status"

# Infrastructure
infrastructure:
  databases:
    - name: "auth_db"
      type: "postgresql"
      replicas: 2
      
    - name: "user_db" 
      type: "postgresql"
      replicas: 1
      
    - name: "product_db"
      type: "postgresql" 
      replicas: 3
      
    - name: "order_db"
      type: "postgresql"
      replicas: 2
      
  cache:
    type: "redis"
    cluster: true
    nodes: 3
    
  message_queue:
    type: "rabbitmq"
    exchanges: ["orders", "notifications", "analytics"]`;

// ============================================================================
// STORY DEFINITIONS
// ============================================================================

export const BuildPipelineFlow: Story = {
  args: {
    title: 'CI/CD Build Pipeline Flow',
    description:
      'Interactive visualization of a complete build and deployment pipeline with quality gates and conditional steps.',
    dataPanelTitle: 'Pipeline Configuration (YAML)',
    diagramPanelTitle: 'Pipeline Flow Diagram',
    dataPanel: <DataViewer data={buildPipelineYaml} language="yaml" title="build-pipeline.yml" />,
    diagramPanel: <MermaidRenderer chart={buildPipelineMermaid} title="Automated Build Pipeline" />,
  },
};

export const UserAuthFlow: Story = {
  args: {
    title: 'User Authentication State Machine',
    description:
      'Complete user authentication flow including MFA, error handling, and account lockout mechanisms.',
    dataPanelTitle: 'Authentication Specification (YAML)',
    diagramPanelTitle: 'State Machine Diagram',
    dataPanel: <DataViewer data={userAuthFlowYaml} language="yaml" title="auth-flow.yml" />,
    diagramPanel: <MermaidRenderer chart={userAuthMermaid} title="Authentication State Machine" />,
  },
};

const microserviceNetworkNodes = [
  { id: 'gateway', label: 'API Gateway\n:8080', group: 'gateway', color: '#1e40af', shape: 'box' },
  {
    id: 'auth',
    label: 'Auth Service\n:8081',
    group: 'service',
    color: '#7c3aed',
    shape: 'ellipse',
  },
  {
    id: 'user',
    label: 'User Service\n:8082',
    group: 'service',
    color: '#059669',
    shape: 'ellipse',
  },
  {
    id: 'product',
    label: 'Product Service\n:8083',
    group: 'service',
    color: '#dc2626',
    shape: 'ellipse',
  },
  {
    id: 'order',
    label: 'Order Service\n:8084',
    group: 'service',
    color: '#ea580c',
    shape: 'ellipse',
  },
  {
    id: 'auth_db',
    label: 'Auth DB\n(PostgreSQL)',
    group: 'database',
    color: '#374151',
    shape: 'database',
  },
  {
    id: 'user_db',
    label: 'User DB\n(PostgreSQL)',
    group: 'database',
    color: '#374151',
    shape: 'database',
  },
  {
    id: 'product_db',
    label: 'Product DB\n(PostgreSQL)',
    group: 'database',
    color: '#374151',
    shape: 'database',
  },
  {
    id: 'order_db',
    label: 'Order DB\n(PostgreSQL)',
    group: 'database',
    color: '#374151',
    shape: 'database',
  },
  {
    id: 'redis',
    label: 'Redis Cache\n(Cluster)',
    group: 'cache',
    color: '#dc2626',
    shape: 'diamond',
  },
  {
    id: 'rabbitmq',
    label: 'RabbitMQ\n(Message Queue)',
    group: 'messaging',
    color: '#f59e0b',
    shape: 'triangle',
  },
];

const microserviceNetworkEdges = [
  { from: 'gateway', to: 'auth', label: '/auth/*', color: '#6b7280' },
  { from: 'gateway', to: 'user', label: '/api/users/*', color: '#6b7280' },
  { from: 'gateway', to: 'product', label: '/api/products/*', color: '#6b7280' },
  { from: 'gateway', to: 'order', label: '/api/orders/*', color: '#6b7280' },

  { from: 'auth', to: 'auth_db', label: 'queries', color: '#4b5563', dashes: true },
  { from: 'auth', to: 'redis', label: 'sessions', color: '#dc2626', dashes: true },

  { from: 'user', to: 'user_db', label: 'queries', color: '#4b5563', dashes: true },
  { from: 'user', to: 'auth', label: 'validate', color: '#7c3aed' },

  { from: 'product', to: 'product_db', label: 'queries', color: '#4b5563', dashes: true },
  { from: 'product', to: 'redis', label: 'cache', color: '#dc2626', dashes: true },

  { from: 'order', to: 'order_db', label: 'queries', color: '#4b5563', dashes: true },
  { from: 'order', to: 'user', label: 'user info', color: '#059669' },
  { from: 'order', to: 'product', label: 'inventory', color: '#dc2626' },
  { from: 'order', to: 'rabbitmq', label: 'events', color: '#f59e0b', dashes: true },
];

export const MicroserviceArchitecture: Story = {
  args: {
    title: 'Microservice Architecture Overview',
    description:
      'Interactive network diagram showing service dependencies, databases, and communication patterns.',
    dataPanelTitle: 'Service Configuration (YAML)',
    diagramPanelTitle: 'Architecture Network Diagram',
    dataPanel: <DataViewer data={microserviceArchYaml} language="yaml" title="microservices.yml" />,
    diagramPanel: (
      <NetworkDiagram
        nodes={microserviceNetworkNodes}
        edges={microserviceNetworkEdges}
        title="Service Architecture"
        options={{
          groups: {
            gateway: { color: { background: '#dbeafe', border: '#1e40af' } },
            service: { color: { background: '#f0f9ff', border: '#0284c7' } },
            database: { color: { background: '#f9fafb', border: '#374151' } },
            cache: { color: { background: '#fef2f2', border: '#dc2626' } },
            messaging: { color: { background: '#fffbeb', border: '#f59e0b' } },
          },
          layout: {
            hierarchical: {
              enabled: true,
              levelSeparation: 150,
              nodeSpacing: 120,
              treeSpacing: 150,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true,
              direction: 'UD',
              sortMethod: 'directed',
            },
          },
        }}
      />
    ),
  },
};

const dataProcessingPipeline = `# Real-time Data Processing Pipeline
name: "E-commerce Analytics Pipeline"
version: "1.0.0"

# Data Sources
sources:
  - name: "web_events"
    type: "kafka_topic"
    schema: "user_interaction_v2"
    partition_count: 12
    replication_factor: 3
    
  - name: "mobile_events" 
    type: "kafka_topic"
    schema: "mobile_interaction_v1"
    partition_count: 8
    replication_factor: 3
    
  - name: "api_logs"
    type: "file_stream"
    path: "/var/log/api/*.log"
    format: "json"
    
# Processing Stages
pipeline:
  - stage: "ingestion"
    components:
      - name: "event_collector"
        type: "kafka_consumer"
        parallel: 4
        
      - name: "log_parser"
        type: "file_parser"
        batch_size: 1000
        
  - stage: "processing"
    components:
      - name: "event_enricher"
        type: "stream_processor"
        operations: ["geo_lookup", "user_session", "device_detection"]
        
      - name: "anomaly_detector"
        type: "ml_processor"
        model: "isolation_forest_v2"
        threshold: 0.95
        
      - name: "aggregator"
        type: "window_processor"
        windows: ["1m", "5m", "1h", "24h"]
        
  - stage: "storage"
    components:
      - name: "realtime_store"
        type: "redis"
        ttl: "1h"
        
      - name: "analytics_store"
        type: "clickhouse"
        partitioning: "daily"
        retention: "90d"
        
      - name: "archive_store"
        type: "s3"
        compression: "gzip"
        lifecycle: "glacier_30d"

# Outputs
outputs:
  - name: "dashboard_feed"
    target: "websocket_server"
    format: "json"
    frequency: "realtime"
    
  - name: "alert_system"
    target: "slack_webhook"
    conditions: ["anomaly_detected", "error_rate_high"]
    
  - name: "ml_features"
    target: "feature_store"
    schedule: "hourly"`;

const dataProcessingMermaid = `graph TD
    %% Data Sources
    WE[📱 Web Events<br/>Kafka Topic] --> EC[Event Collector]
    ME[📱 Mobile Events<br/>Kafka Topic] --> EC
    AL[📄 API Logs<br/>File Stream] --> LP[Log Parser]
    
    %% Ingestion Layer
    EC --> EE[Event Enricher]
    LP --> EE
    
    %% Processing Layer  
    EE --> AD[🤖 Anomaly Detector<br/>ML Model]
    EE --> AG[📊 Aggregator<br/>Time Windows]
    
    AD --> AS[🚨 Alert System]
    
    %% Storage Layer
    AG --> RS[⚡ Redis<br/>Real-time Store]
    AG --> CS[📈 ClickHouse<br/>Analytics Store] 
    AG --> S3[💾 S3 Archive<br/>Long-term Storage]
    
    %% Output Layer
    RS --> DF[📺 Dashboard Feed<br/>WebSocket]
    CS --> ML[🧠 ML Features<br/>Feature Store]
    AS --> SL[💬 Slack Alerts]
    
    %% Error Handling
    AD -.-> DLQ[Dead Letter Queue]
    AG -.-> DLQ
    EE -.-> DLQ
    
    %% Styling
    classDef source fill:#e1f5fe,stroke:#01579b
    classDef processing fill:#f3e5f5,stroke:#4a148c
    classDef storage fill:#e8f5e8,stroke:#1b5e20
    classDef output fill:#fff3e0,stroke:#e65100
    classDef error fill:#ffebee,stroke:#d32f2f
    
    class WE,ME,AL source
    class EC,LP,EE,AD,AG processing
    class RS,CS,S3 storage
    class DF,ML,SL output
    class DLQ error`;

export const DataProcessingPipeline: Story = {
  args: {
    title: 'Real-time Data Processing Pipeline',
    description:
      'Complex data pipeline with multiple sources, processing stages, and output destinations for analytics.',
    dataPanelTitle: 'Pipeline Configuration (YAML)',
    diagramPanelTitle: 'Data Flow Architecture',
    dataPanel: (
      <DataViewer data={dataProcessingPipeline} language="yaml" title="data-pipeline.yml" />
    ),
    diagramPanel: (
      <MermaidRenderer chart={dataProcessingMermaid} title="Real-time Data Processing" />
    ),
  },
};

const testingWorkflowYaml = `# Comprehensive Testing Workflow
name: "Quality Assurance Pipeline"
version: "2.0.0"

test_phases:
  - name: "unit_testing"
    parallel: true
    timeout: "10m"
    coverage_threshold: 85
    tests:
      - path: "src/**/*.test.{js,ts}"
        framework: "vitest"
        config: "vitest.config.ts"
        
      - path: "src/**/*.spec.{js,ts}"
        framework: "jest"
        config: "jest.config.js"
        
  - name: "integration_testing"
    depends_on: ["unit_testing"]
    timeout: "20m"
    services:
      - "postgres:13"
      - "redis:7"
      - "rabbitmq:3"
    tests:
      - path: "tests/integration/**"
        framework: "supertest"
        database: "test_db"
        
  - name: "api_testing"
    depends_on: ["integration_testing"]
    timeout: "15m"
    environment: "staging"
    tests:
      - path: "tests/api/**"
        framework: "newman"
        collection: "postman_collection.json"
        
  - name: "e2e_testing"
    depends_on: ["api_testing"]
    parallel: false
    timeout: "30m"
    browsers: ["chromium", "firefox", "webkit"]
    tests:
      - path: "tests/e2e/**"
        framework: "playwright"
        config: "playwright.config.ts"
        
  - name: "performance_testing"
    depends_on: ["e2e_testing"] 
    timeout: "45m"
    load_profiles:
      - name: "baseline"
        users: 10
        duration: "5m"
        
      - name: "peak_load"
        users: 100
        duration: "10m"
        ramp_up: "2m"
        
# Quality Gates
quality_gates:
  - metric: "test_coverage"
    threshold: 85
    blocking: true
    
  - metric: "critical_bugs"
    threshold: 0
    blocking: true
    
  - metric: "response_time_p95"
    threshold: "500ms"
    blocking: false
    
  - metric: "error_rate"
    threshold: "1%"
    blocking: true

# Notification Rules
notifications:
  success:
    channels: ["slack:#qa", "email:team@company.com"]
    
  failure:
    channels: ["slack:#alerts", "pagerduty"]
    escalation: 
      - delay: "5m"
        target: "lead_engineer"
      - delay: "15m"
        target: "engineering_manager"`;

const testingWorkflowMermaid = `graph TD
    START([🚀 Testing Started]) --> UNIT{Unit Tests}
    
    UNIT -->|Jest| U1[Component Tests]
    UNIT -->|Vitest| U2[Logic Tests]
    
    U1 --> COV[📊 Coverage Check]
    U2 --> COV
    COV -->|≥85%| INT{Integration Tests}
    COV -->|<85%| FAIL1[❌ Coverage Gate Failed]
    
    INT --> I1[🗄️ Database Tests]
    INT --> I2[🔌 API Integration]  
    INT --> I3[📬 Message Queue Tests]
    
    I1 --> API{API Tests}
    I2 --> API
    I3 --> API
    
    API --> A1[📋 Postman Collection]
    API --> A2[🌐 Environment Tests]
    A1 --> E2E{E2E Tests}
    A2 --> E2E
    
    E2E -->|Chrome| E1[🖱️ User Journeys]
    E2E -->|Firefox| E2[🧭 Cross-browser]
    E2E -->|Safari| E3[🍎 WebKit Tests]
    
    E1 --> PERF{Performance}
    E2 --> PERF
    E3 --> PERF
    
    PERF --> P1[⚡ Baseline Load]
    PERF --> P2[📈 Peak Load Testing]
    
    P1 --> QG{Quality Gates}
    P2 --> QG
    
    QG -->|All Pass| SUCCESS[✅ All Tests Passed]
    QG -->|Failures| ANALYSIS[🔍 Failure Analysis]
    
    ANALYSIS --> REPORT[📊 Test Report]
    REPORT --> NOTIFY[📢 Team Notification]
    
    SUCCESS --> DEPLOY[🚀 Ready for Deploy]
    FAIL1 --> NOTIFY
    
    %% Error paths
    INT -.->|Failure| FAIL2[❌ Integration Failed]
    API -.->|Failure| FAIL3[❌ API Tests Failed]  
    E2E -.->|Failure| FAIL4[❌ E2E Tests Failed]
    PERF -.->|Failure| FAIL5[❌ Performance Failed]
    
    FAIL2 --> NOTIFY
    FAIL3 --> NOTIFY  
    FAIL4 --> NOTIFY
    FAIL5 --> NOTIFY
    
    %% Styling
    classDef startEnd fill:#e1f5fe,stroke:#01579b
    classDef testPhase fill:#f3e5f5,stroke:#4a148c
    classDef success fill:#c8e6c9,stroke:#2e7d32
    classDef error fill:#ffcdd2,stroke:#c62828
    classDef decision fill:#fff3e0,stroke:#f57c00
    
    class START,DEPLOY startEnd
    class U1,U2,I1,I2,I3,A1,A2,E1,E2,E3,P1,P2 testPhase
    class SUCCESS success
    class FAIL1,FAIL2,FAIL3,FAIL4,FAIL5 error
    class UNIT,INT,API,E2E,PERF,QG,COV decision`;

export const TestingWorkflow: Story = {
  args: {
    title: 'Comprehensive Testing Pipeline',
    description:
      'Multi-phase testing workflow with quality gates, parallel execution, and performance validation.',
    dataPanelTitle: 'Testing Configuration (YAML)',
    diagramPanelTitle: 'Testing Flow Diagram',
    dataPanel: (
      <DataViewer data={testingWorkflowYaml} language="yaml" title="testing-workflow.yml" />
    ),
    diagramPanel: (
      <MermaidRenderer chart={testingWorkflowMermaid} title="Quality Assurance Pipeline" />
    ),
  },
};
