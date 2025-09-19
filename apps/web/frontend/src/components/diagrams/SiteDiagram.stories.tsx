import type { Meta, StoryObj } from '@storybook/react';
import { SplitViewShowcase } from './SplitViewShowcase';
import { DataViewer } from './DataViewer';
import { MermaidRenderer } from './MermaidRenderer';
import { NetworkDiagram } from './NetworkDiagram';

const meta = {
  title: 'Diagrams/Site Architecture - Split View',
  component: SplitViewShowcase,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SplitViewShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// REALISTIC ARCHITECTURE EXAMPLES
// ============================================================================

const microservicesArchYaml = `# Microservices Architecture
name: "E-commerce Platform Architecture"
version: "2.1.0"
environment: "production"

# Infrastructure Layer
infrastructure:
  load_balancer:
    type: "nginx"
    instances: 2
    config:
      upstream_servers: ["api-gateway-1", "api-gateway-2"]
      health_checks: true
      ssl_termination: true
      
  api_gateway:
    type: "kong"
    instances: 2
    plugins: ["rate-limiting", "cors", "jwt", "prometheus"]
    
  service_mesh:
    type: "istio"
    features: ["traffic_management", "security", "observability"]

# Application Services
services:
  auth-service:
    type: "microservice"
    language: "typescript"
    framework: "fastify"
    port: 3001
    replicas: 3
    resources:
      cpu: "200m"
      memory: "256Mi"
    databases:
      - name: "auth_db"
        type: "postgresql"
        replicas: 2
    dependencies:
      - "redis-sessions"
      - "email-service"
    endpoints:
      - path: "/api/auth/login"
        methods: ["POST"]
        rate_limit: "10/min"
      - path: "/api/auth/register"
        methods: ["POST"] 
        rate_limit: "5/min"
      - path: "/api/auth/verify"
        methods: ["GET", "POST"]
        
  user-service:
    type: "microservice"
    language: "python"
    framework: "fastapi"
    port: 3002
    replicas: 2
    resources:
      cpu: "150m"
      memory: "200Mi"
    databases:
      - name: "user_db"
        type: "postgresql"
        replicas: 1
    dependencies:
      - "auth-service"
      - "file-storage"
    endpoints:
      - path: "/api/users/profile"
        methods: ["GET", "PUT"]
        auth_required: true
      - path: "/api/users/preferences"
        methods: ["GET", "PUT"]
        auth_required: true
        
  product-service:
    type: "microservice"
    language: "golang"
    framework: "gin"
    port: 3003
    replicas: 4
    resources:
      cpu: "300m"
      memory: "400Mi"
    databases:
      - name: "product_db"
        type: "postgresql"
        replicas: 3
      - name: "search_index"
        type: "elasticsearch"
        replicas: 3
    dependencies:
      - "inventory-service"
      - "recommendation-engine"
    endpoints:
      - path: "/api/products"
        methods: ["GET"]
        cache_ttl: "5m"
      - path: "/api/products/search"
        methods: ["GET"]
        cache_ttl: "1m"
        
  order-service:
    type: "microservice"
    language: "java"
    framework: "spring-boot"
    port: 3004
    replicas: 3
    resources:
      cpu: "250m"
      memory: "512Mi"
    databases:
      - name: "order_db"
        type: "postgresql"
        replicas: 2
    dependencies:
      - "user-service"
      - "product-service"
      - "payment-service"
      - "inventory-service"
    endpoints:
      - path: "/api/orders"
        methods: ["GET", "POST"]
        auth_required: true
      - path: "/api/orders/{id}/status"
        methods: ["GET"]
        auth_required: true

# External Services
external_services:
  payment-service:
    provider: "stripe"
    endpoints:
      - "payment_intents"
      - "webhooks"
    sla: "99.9%"
    
  email-service:
    provider: "sendgrid"
    templates: ["welcome", "verification", "password_reset"]
    
  file-storage:
    provider: "aws_s3"
    buckets: ["user-uploads", "product-images", "documents"]

# Data Layer
databases:
  postgresql:
    clusters:
      - name: "auth-cluster"
        primary: 1
        replicas: 2
        backup_schedule: "daily"
        
      - name: "business-cluster" 
        primary: 1
        replicas: 3
        backup_schedule: "hourly"
        
  redis:
    clusters:
      - name: "sessions"
        nodes: 3
        memory: "2GB"
        persistence: true
        
      - name: "cache"
        nodes: 6
        memory: "4GB"
        persistence: false

# Monitoring & Observability
observability:
  metrics:
    prometheus:
      scrape_interval: "15s"
      retention: "30d"
    grafana:
      dashboards: ["infrastructure", "applications", "business"]
      
  logging:
    elasticsearch:
      indices: ["application-logs", "access-logs", "error-logs"]
      retention: "90d"
    kibana:
      dashboards: ["error-analysis", "performance", "security"]
      
  tracing:
    jaeger:
      sampling_rate: "10%"
      retention: "7d"

# Security
security:
  api_authentication:
    type: "jwt"
    expiry: "1h"
    refresh_token: "7d"
    
  service_to_service:
    type: "mutual_tls"
    certificate_rotation: "90d"
    
  secrets_management:
    provider: "vault"
    auto_rotation: true
    
  network_policies:
    ingress_only: ["api-gateway"]
    egress_restricted: ["payment-service", "email-service"]`;

const microservicesMermaid = `graph TB
    subgraph "Client Layer"
        WEB[Web App<br/>React/TypeScript]
        MOB[Mobile App<br/>React Native]
        API_CLIENT[API Clients<br/>External Partners]
    end
    
    subgraph "Edge Layer"
        LB[Load Balancer<br/>nginx]
        CDN[CDN<br/>CloudFlare]
    end
    
    subgraph "API Layer"
        GW[API Gateway<br/>Kong]
        MESH[Service Mesh<br/>Istio]
    end
    
    subgraph "Application Services"
        AUTH[Auth Service<br/>:3001<br/>TypeScript/Fastify]
        USER[User Service<br/>:3002<br/>Python/FastAPI]
        PROD[Product Service<br/>:3003<br/>Go/Gin]
        ORDER[Order Service<br/>:3004<br/>Java/Spring]
    end
    
    subgraph "External Services"
        PAY[Payment Service<br/>Stripe]
        EMAIL[Email Service<br/>SendGrid]
        FILES[File Storage<br/>AWS S3]
    end
    
    subgraph "Data Layer"
        AUTH_DB[(Auth DB<br/>PostgreSQL)]
        USER_DB[(User DB<br/>PostgreSQL)]
        PROD_DB[(Product DB<br/>PostgreSQL)]
        ORDER_DB[(Order DB<br/>PostgreSQL)]
        SEARCH[(Search Index<br/>Elasticsearch)]
        REDIS_SESS[(Redis Sessions)]
        REDIS_CACHE[(Redis Cache)]
    end
    
    subgraph "Monitoring"
        PROM[Prometheus<br/>Metrics]
        GRAF[Grafana<br/>Dashboards]
        ELK[ELK Stack<br/>Logging]
        JAEGER[Jaeger<br/>Tracing]
    end
    
    %% Client connections
    WEB --> LB
    MOB --> LB
    API_CLIENT --> LB
    
    %% Edge to API
    LB --> GW
    CDN --> GW
    GW --> MESH
    
    %% Service connections
    MESH --> AUTH
    MESH --> USER
    MESH --> PROD
    MESH --> ORDER
    
    %% Service dependencies
    USER --> AUTH
    ORDER --> USER
    ORDER --> PROD
    ORDER --> PAY
    AUTH --> EMAIL
    USER --> FILES
    
    %% Database connections
    AUTH --> AUTH_DB
    AUTH --> REDIS_SESS
    USER --> USER_DB
    PROD --> PROD_DB
    PROD --> SEARCH
    PROD --> REDIS_CACHE
    ORDER --> ORDER_DB
    
    %% Monitoring connections
    AUTH -.-> PROM
    USER -.-> PROM
    PROD -.-> PROM
    ORDER -.-> PROM
    PROM --> GRAF
    
    AUTH -.-> ELK
    USER -.-> ELK
    PROD -.-> ELK
    ORDER -.-> ELK
    
    MESH -.-> JAEGER
    
    %% Styling
    classDef client fill:#e1f5fe,stroke:#01579b
    classDef edge fill:#f3e5f5,stroke:#4a148c
    classDef service fill:#e8f5e8,stroke:#1b5e20
    classDef database fill:#fff3e0,stroke:#e65100
    classDef external fill:#fce4ec,stroke:#880e4f
    classDef monitoring fill:#f1f8e9,stroke:#33691e
    
    class WEB,MOB,API_CLIENT client
    class LB,CDN,GW,MESH edge
    class AUTH,USER,PROD,ORDER service
    class AUTH_DB,USER_DB,PROD_DB,ORDER_DB,SEARCH,REDIS_SESS,REDIS_CACHE database
    class PAY,EMAIL,FILES external
    class PROM,GRAF,ELK,JAEGER monitoring`;

const cloudNativeYaml = `# Cloud Native Architecture
name: "Cloud Native E-commerce Platform"
version: "3.0.0"
cloud_provider: "AWS"

# Container Orchestration
kubernetes:
  cluster:
    version: "1.28"
    node_groups:
      - name: "application-nodes"
        instance_type: "t3.large"
        min_size: 3
        max_size: 10
        auto_scaling: true
        
      - name: "database-nodes"
        instance_type: "r5.xlarge"
        min_size: 2
        max_size: 4
        storage_optimized: true

# Application Deployment
applications:
  frontend:
    type: "static_site"
    technology: "React/Vite"
    deployment:
      type: "cdn"
      provider: "CloudFront"
      regions: ["us-east-1", "eu-west-1", "ap-southeast-1"]
      
  backend:
    type: "containerized"
    deployment:
      strategy: "rolling_update"
      replicas: 3
      health_checks:
        liveness: "/health"
        readiness: "/ready"
        startup: "/startup"
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "500m"
          memory: "512Mi"

# Service Mesh
service_mesh:
  provider: "aws_app_mesh"
  features:
    - traffic_routing
    - circuit_breaking
    - retry_policies
    - observability
  configuration:
    retry_attempts: 3
    timeout: "30s"
    circuit_breaker:
      failure_threshold: 50
      reset_timeout: "60s"

# Data Services
managed_databases:
  rds_postgresql:
    instances:
      - name: "primary-db"
        instance_class: "db.r5.xlarge"
        multi_az: true
        backup_retention: 7
        
      - name: "read-replicas"
        count: 2
        instance_class: "db.r5.large"
        
  elasticache:
    clusters:
      - name: "sessions"
        node_type: "cache.r6g.large"
        num_nodes: 3
        
      - name: "application-cache"
        node_type: "cache.r6g.xlarge"
        num_nodes: 6
        
  opensearch:
    cluster:
      instance_type: "t3.medium.search"
      instances: 3
      storage: "100GB"
      indices:
        - "products"
        - "orders"
        - "logs"

# Message Queues & Event Streaming
messaging:
  amazon_mq:
    broker_type: "RabbitMQ"
    deployment: "cluster"
    instances: 2
    
  amazon_sqs:
    queues:
      - name: "order-processing"
        visibility_timeout: "300s"
        message_retention: "14d"
        
      - name: "email-notifications"
        visibility_timeout: "60s"
        dlq_enabled: true
        
  amazon_eventbridge:
    event_buses:
      - "ecommerce-events"
      - "user-events"
      - "order-events"

# Storage Services
storage:
  s3_buckets:
    - name: "user-uploads"
      encryption: "AES256"
      versioning: true
      lifecycle:
        - transition_to_ia: "30d"
        - transition_to_glacier: "90d"
        
    - name: "product-assets"
      encryption: "KMS"
      cdn_enabled: true
      
    - name: "backups"
      storage_class: "GLACIER"
      cross_region_replication: true

# Monitoring & Observability
observability:
  cloudwatch:
    custom_metrics: true
    log_groups:
      - "/aws/eks/application"
      - "/aws/rds/postgresql"
      - "/aws/elasticache"
      
  x_ray:
    tracing_enabled: true
    sampling_rate: 0.1
    
  prometheus_operator:
    namespace: "monitoring"
    grafana_enabled: true
    alertmanager_enabled: true

# Security & Compliance
security:
  iam_roles:
    service_roles:
      - name: "EKSServiceRole"
        policies: ["AmazonEKSServicePolicy"]
      - name: "NodeInstanceRole"
        policies: ["AmazonEKSWorkerNodePolicy", "AmazonEKS_CNI_Policy"]
        
  network_security:
    vpc:
      cidr: "10.0.0.0/16"
      subnets:
        private: ["10.0.1.0/24", "10.0.2.0/24"]
        public: ["10.0.101.0/24", "10.0.102.0/24"]
        database: ["10.0.201.0/24", "10.0.202.0/24"]
      nat_gateway: true
      
    security_groups:
      - name: "application-sg"
        ingress: ["80", "443", "8080"]
      - name: "database-sg"
        ingress: ["5432"]
        source: "application-sg"
        
  secrets_management:
    provider: "aws_secrets_manager"
    auto_rotation: true
    
  compliance:
    standards: ["SOC2", "PCI-DSS"]
    encryption_at_rest: true
    encryption_in_transit: true`;

const cloudNativeNetwork = [
  // Client Layer
  { id: 'web', label: 'Web App\n(React)', group: 'client', color: '#3b82f6' },
  { id: 'mobile', label: 'Mobile App\n(React Native)', group: 'client', color: '#3b82f6' },

  // Edge/CDN Layer
  { id: 'cloudfront', label: 'CloudFront\n(CDN)', group: 'edge', color: '#f59e0b' },
  { id: 'alb', label: 'Application\nLoad Balancer', group: 'edge', color: '#f59e0b' },

  // Container Platform
  { id: 'eks', label: 'EKS Cluster\n(Kubernetes)', group: 'platform', color: '#8b5cf6' },
  { id: 'appmesh', label: 'App Mesh\n(Service Mesh)', group: 'platform', color: '#8b5cf6' },

  // Application Services
  { id: 'auth', label: 'Auth Service\nPods (3x)', group: 'application', color: '#10b981' },
  { id: 'user', label: 'User Service\nPods (2x)', group: 'application', color: '#10b981' },
  { id: 'product', label: 'Product Service\nPods (4x)', group: 'application', color: '#10b981' },
  { id: 'order', label: 'Order Service\nPods (3x)', group: 'application', color: '#10b981' },

  // Managed Databases
  { id: 'rds', label: 'RDS PostgreSQL\n(Multi-AZ)', group: 'database', color: '#374151' },
  { id: 'elasticache', label: 'ElastiCache\n(Redis Cluster)', group: 'database', color: '#dc2626' },
  { id: 'opensearch', label: 'OpenSearch\n(3 nodes)', group: 'database', color: '#374151' },

  // Messaging
  { id: 'amazonmq', label: 'Amazon MQ\n(RabbitMQ)', group: 'messaging', color: '#f59e0b' },
  { id: 'sqs', label: 'SQS Queues\n(Multiple)', group: 'messaging', color: '#f59e0b' },
  { id: 'eventbridge', label: 'EventBridge\n(Event Bus)', group: 'messaging', color: '#f59e0b' },

  // Storage
  { id: 's3', label: 'S3 Buckets\n(Assets & Backups)', group: 'storage', color: '#059669' },

  // Monitoring
  {
    id: 'cloudwatch',
    label: 'CloudWatch\n(Metrics & Logs)',
    group: 'monitoring',
    color: '#7c3aed',
  },
  { id: 'xray', label: 'X-Ray\n(Tracing)', group: 'monitoring', color: '#7c3aed' },
  { id: 'prometheus', label: 'Prometheus\n(Metrics)', group: 'monitoring', color: '#7c3aed' },
];

const cloudNativeNetworkEdges = [
  // Client to Edge
  { from: 'web', to: 'cloudfront', label: 'HTTPS' },
  { from: 'mobile', to: 'alb', label: 'API calls' },
  { from: 'cloudfront', to: 'alb', label: 'origin' },

  // Edge to Platform
  { from: 'alb', to: 'eks', label: 'ingress' },
  { from: 'eks', to: 'appmesh', label: 'mesh' },

  // Platform to Applications
  { from: 'appmesh', to: 'auth', label: 'traffic' },
  { from: 'appmesh', to: 'user', label: 'traffic' },
  { from: 'appmesh', to: 'product', label: 'traffic' },
  { from: 'appmesh', to: 'order', label: 'traffic' },

  // Service Dependencies
  { from: 'user', to: 'auth', label: 'validation', dashes: true },
  { from: 'order', to: 'user', label: 'profile', dashes: true },
  { from: 'order', to: 'product', label: 'inventory', dashes: true },

  // Database Connections
  { from: 'auth', to: 'rds', label: 'auth_db' },
  { from: 'user', to: 'rds', label: 'user_db' },
  { from: 'product', to: 'rds', label: 'product_db' },
  { from: 'order', to: 'rds', label: 'order_db' },

  { from: 'auth', to: 'elasticache', label: 'sessions' },
  { from: 'product', to: 'elasticache', label: 'cache' },
  { from: 'product', to: 'opensearch', label: 'search' },

  // Messaging
  { from: 'order', to: 'amazonmq', label: 'events' },
  { from: 'auth', to: 'sqs', label: 'email queue' },
  { from: 'order', to: 'eventbridge', label: 'order events' },

  // Storage
  { from: 'user', to: 's3', label: 'uploads' },
  { from: 'product', to: 's3', label: 'images' },

  // Monitoring (dotted lines)
  { from: 'auth', to: 'cloudwatch', dashes: true, color: '#9ca3af' },
  { from: 'user', to: 'cloudwatch', dashes: true, color: '#9ca3af' },
  { from: 'product', to: 'cloudwatch', dashes: true, color: '#9ca3af' },
  { from: 'order', to: 'cloudwatch', dashes: true, color: '#9ca3af' },
  { from: 'appmesh', to: 'xray', dashes: true, color: '#9ca3af' },
  { from: 'eks', to: 'prometheus', dashes: true, color: '#9ca3af' },
];

const serverlessArchYaml = `# Serverless Architecture
name: "Serverless E-commerce API"
version: "1.2.0"
cloud_provider: "AWS"

# API Gateway Configuration
api_gateway:
  name: "ecommerce-api"
  version: "v2"
  cors_enabled: true
  throttling:
    burst_limit: 2000
    rate_limit: 1000
  authentication:
    cognito_user_pool: "ecommerce-users"
  
  routes:
    - path: "/auth/{proxy+}"
      method: "ANY"
      lambda: "auth-handler"
      authorizer: "none"
      
    - path: "/users/{proxy+}"
      method: "ANY"
      lambda: "user-handler"
      authorizer: "cognito"
      
    - path: "/products/{proxy+}"
      method: "ANY"
      lambda: "product-handler"
      authorizer: "optional"
      caching:
        ttl: 300
        
    - path: "/orders/{proxy+}"
      method: "ANY"
      lambda: "order-handler"
      authorizer: "cognito"

# Lambda Functions
lambda_functions:
  auth-handler:
    runtime: "nodejs20.x"
    memory: 256
    timeout: 30
    environment:
      USER_POOL_ID: "${cognito_user_pool_id}"
      JWT_SECRET: "${jwt_secret}"
    events:
      - api_gateway: "/auth/{proxy+}"
    layers:
      - "common-utils"
      - "auth-middleware"
      
  user-handler:
    runtime: "python3.11"
    memory: 512
    timeout: 15
    environment:
      DYNAMODB_TABLE: "${user_table}"
      S3_BUCKET: "${user_uploads_bucket}"
    events:
      - api_gateway: "/users/{proxy+}"
    layers:
      - "boto3-layer"
      - "validation-layer"
      
  product-handler:
    runtime: "golang1.x"
    memory: 1024
    timeout: 30
    environment:
      DYNAMODB_TABLE: "${product_table}"
      OPENSEARCH_ENDPOINT: "${search_endpoint}"
      REDIS_ENDPOINT: "${cache_endpoint}"
    events:
      - api_gateway: "/products/{proxy+}"
      - schedule: "rate(1 hour)"  # Cache refresh
    layers:
      - "aws-sdk-go"
      
  order-handler:
    runtime: "java11"
    memory: 512
    timeout: 45
    environment:
      DYNAMODB_TABLE: "${order_table}"
      SQS_QUEUE: "${order_queue}"
      SNS_TOPIC: "${notification_topic}"
    events:
      - api_gateway: "/orders/{proxy+}"
      - sqs: "${order_processing_queue}"
    layers:
      - "aws-sdk-java"
      
# Step Functions
step_functions:
  order-processing-workflow:
    type: "standard"
    timeout: "1h"
    states:
      validate_order:
        type: "task"
        resource: "order-validator-lambda"
        next: "process_payment"
        
      process_payment:
        type: "task"  
        resource: "payment-processor-lambda"
        retry:
          error_equals: ["States.TaskFailed"]
          interval_seconds: 2
          max_attempts: 3
        next: "update_inventory"
        
      update_inventory:
        type: "parallel"
        branches:
          - start_at: "reserve_items"
            states:
              reserve_items:
                type: "task"
                resource: "inventory-manager-lambda"
                end: true
          - start_at: "send_confirmation"
            states:
              send_confirmation:
                type: "task"
                resource: "notification-sender-lambda"
                end: true

# DynamoDB Tables
dynamodb_tables:
  users:
    partition_key: "user_id"
    attributes:
      - name: "email"
        type: "S"
        gsi: true
    billing_mode: "on_demand"
    stream_enabled: true
    
  products:
    partition_key: "product_id"
    sort_key: "category"
    attributes:
      - name: "brand"
        type: "S"
        gsi: true
      - name: "price_range"
        type: "S"
        gsi: true
    billing_mode: "provisioned"
    read_capacity: 100
    write_capacity: 50
    
  orders:
    partition_key: "order_id"
    sort_key: "created_at"
    attributes:
      - name: "user_id"
        type: "S"
        gsi: true
      - name: "status"
        type: "S"
        gsi: true
    billing_mode: "on_demand"
    ttl_attribute: "expires_at"

# Event-Driven Architecture
event_sources:
  dynamodb_streams:
    - table: "users"
      lambda: "user-activity-processor"
      batch_size: 10
      
    - table: "orders"
      lambda: "order-state-tracker"
      batch_size: 5
      
  sqs_queues:
    order-processing:
      visibility_timeout: 300
      message_retention: 1209600  # 14 days
      dlq: "order-processing-dlq"
      
    email-notifications:
      visibility_timeout: 60
      batch_size: 10
      
  sns_topics:
    order-events:
      subscriptions:
        - endpoint: "order-analytics-lambda"
          protocol: "lambda"
        - endpoint: "inventory-webhook"
          protocol: "https"

# Storage & CDN
storage:
  s3_buckets:
    user-uploads:
      cors_enabled: true
      lifecycle_rules:
        - transition_to_ia: 30
        - expiration: 365
        
    product-images:
      cloudfront_distribution: true
      cache_behaviors:
        - path_pattern: "*.jpg"
          ttl: 86400
        - path_pattern: "*.png"
          ttl: 86400
          
# Authentication & Authorization
cognito:
  user_pools:
    ecommerce-users:
      mfa_configuration: "optional"
      password_policy:
        minimum_length: 8
        require_uppercase: true
        require_numbers: true
      schema:
        - name: "email"
          required: true
          mutable: false
        - name: "family_name"
          required: false
          mutable: true

# Monitoring & Alerting
monitoring:
  cloudwatch_alarms:
    - metric: "lambda_errors"
      threshold: 10
      period: 300
      notification: "admin-alerts"
      
    - metric: "api_gateway_4xx"
      threshold: 50
      period: 300
      notification: "dev-alerts"
      
  x_ray:
    tracing_config: "Active"
    sampling_rate: 0.1`;

const serverlessMermaid = `graph TB
    subgraph "Client Applications"
        WEB[Web Application]
        MOB[Mobile App]
        API[3rd Party APIs]
    end
    
    subgraph "Edge & Authentication"
        COGNITO[Cognito<br/>User Pool]
        APIGW[API Gateway<br/>REST API v2]
        CF[CloudFront<br/>CDN]
    end
    
    subgraph "Compute Layer - Lambda Functions"
        AUTH[Auth Handler<br/>Node.js 20x<br/>256MB]
        USER[User Handler<br/>Python 3.11<br/>512MB]  
        PROD[Product Handler<br/>Go 1.x<br/>1024MB]
        ORDER[Order Handler<br/>Java 11<br/>512MB]
    end
    
    subgraph "Orchestration"
        SF[Step Functions<br/>Order Workflow]
        SF_STATES[States:<br/>• Validate Order<br/>• Process Payment<br/>• Update Inventory<br/>• Send Notification]
    end
    
    subgraph "Data Layer"
        DDB_USERS[(DynamoDB<br/>Users Table)]
        DDB_PROD[(DynamoDB<br/>Products Table)]  
        DDB_ORDERS[(DynamoDB<br/>Orders Table)]
        OS[OpenSearch<br/>Product Index]
        REDIS[ElastiCache<br/>Redis Cache]
    end
    
    subgraph "Event & Messaging"
        SQS_ORDER[SQS<br/>Order Queue]
        SQS_EMAIL[SQS<br/>Email Queue]
        SNS[SNS<br/>Order Events]
        DDB_STREAMS[DynamoDB<br/>Streams]
    end
    
    subgraph "Storage & Assets"
        S3_UPLOADS[S3<br/>User Uploads]
        S3_IMAGES[S3<br/>Product Images]
    end
    
    subgraph "Monitoring"
        CW[CloudWatch<br/>Metrics & Logs]
        XRAY[X-Ray<br/>Tracing]
    end
    
    %% Client connections
    WEB --> CF
    WEB --> APIGW
    MOB --> APIGW
    API --> APIGW
    
    %% Authentication flow
    WEB -.-> COGNITO
    MOB -.-> COGNITO
    COGNITO -.-> APIGW
    
    %% API Gateway to Lambda
    APIGW --> AUTH
    APIGW --> USER  
    APIGW --> PROD
    APIGW --> ORDER
    
    %% Lambda to Data
    AUTH --> DDB_USERS
    USER --> DDB_USERS
    USER --> S3_UPLOADS
    
    PROD --> DDB_PROD
    PROD --> OS
    PROD --> REDIS
    
    ORDER --> DDB_ORDERS
    ORDER --> SF
    
    %% Step Functions workflow
    SF --> SF_STATES
    SF_STATES --> SQS_ORDER
    SF_STATES --> SNS
    
    %% Event-driven processing
    DDB_USERS --> DDB_STREAMS
    DDB_ORDERS --> DDB_STREAMS
    DDB_STREAMS -.-> USER
    DDB_STREAMS -.-> ORDER
    
    SQS_ORDER --> ORDER
    SQS_EMAIL -.-> AUTH
    
    %% Storage
    CF --> S3_IMAGES
    
    %% Monitoring
    AUTH -.-> CW
    USER -.-> CW
    PROD -.-> CW
    ORDER -.-> CW
    APIGW -.-> CW
    
    APIGW -.-> XRAY
    AUTH -.-> XRAY
    USER -.-> XRAY
    PROD -.-> XRAY
    ORDER -.-> XRAY
    
    %% Styling
    classDef client fill:#dbeafe,stroke:#1e40af
    classDef edge fill:#fef3c7,stroke:#d97706
    classDef compute fill:#dcfce7,stroke:#16a34a
    classDef data fill:#f1f5f9,stroke:#475569
    classDef event fill:#fdf4ff,stroke:#a21caf
    classDef storage fill:#ecfccb,stroke:#65a30d
    classDef monitor fill:#f0f9ff,stroke:#0284c7
    
    class WEB,MOB,API client
    class COGNITO,APIGW,CF edge
    class AUTH,USER,PROD,ORDER,SF,SF_STATES compute
    class DDB_USERS,DDB_PROD,DDB_ORDERS,OS,REDIS data
    class SQS_ORDER,SQS_EMAIL,SNS,DDB_STREAMS event
    class S3_UPLOADS,S3_IMAGES storage
    class CW,XRAY monitor`;

// ============================================================================
// STORY DEFINITIONS
// ============================================================================

export const MicroservicesArchitecture: Story = {
  args: {
    title: 'Microservices Architecture Overview',
    description:
      'Complete microservices deployment with service mesh, monitoring, and multi-database architecture.',
    dataPanelTitle: 'Architecture Configuration (YAML)',
    diagramPanelTitle: 'Service Architecture Diagram',
    dataPanel: (
      <DataViewer
        data={microservicesArchYaml}
        language="yaml"
        title="microservices-architecture.yml"
      />
    ),
    diagramPanel: <MermaidRenderer chart={microservicesMermaid} title="Microservices Platform" />,
  },
};

export const CloudNativeArchitecture: Story = {
  args: {
    title: 'Cloud Native Platform (AWS)',
    description:
      'Kubernetes-based cloud native architecture with managed services and auto-scaling capabilities.',
    dataPanelTitle: 'Cloud Configuration (YAML)',
    diagramPanelTitle: 'Cloud Architecture Network',
    dataPanel: (
      <DataViewer data={cloudNativeYaml} language="yaml" title="cloud-native-architecture.yml" />
    ),
    diagramPanel: (
      <NetworkDiagram
        nodes={cloudNativeNetwork}
        edges={cloudNativeNetworkEdges}
        title="AWS Cloud Native Architecture"
        options={{
          groups: {
            client: { color: { background: '#dbeafe', border: '#1e40af' } },
            edge: { color: { background: '#fef3c7', border: '#d97706' } },
            platform: { color: { background: '#f3e8ff', border: '#7c3aed' } },
            application: { color: { background: '#dcfce7', border: '#16a34a' } },
            database: { color: { background: '#f1f5f9', border: '#475569' } },
            messaging: { color: { background: '#fef3c7', border: '#d97706' } },
            storage: { color: { background: '#ecfccb', border: '#65a30d' } },
            monitoring: { color: { background: '#f0f9ff', border: '#0284c7' } },
          },
          layout: {
            hierarchical: {
              enabled: true,
              levelSeparation: 120,
              nodeSpacing: 100,
              direction: 'UD',
            },
          },
        }}
      />
    ),
  },
};

export const ServerlessArchitecture: Story = {
  args: {
    title: 'Serverless Architecture (AWS Lambda)',
    description:
      'Event-driven serverless platform with API Gateway, Lambda functions, and managed services.',
    dataPanelTitle: 'Serverless Configuration (YAML)',
    diagramPanelTitle: 'Serverless Architecture Flow',
    dataPanel: (
      <DataViewer data={serverlessArchYaml} language="yaml" title="serverless-architecture.yml" />
    ),
    diagramPanel: (
      <MermaidRenderer chart={serverlessMermaid} title="Serverless Event-Driven Architecture" />
    ),
  },
};
