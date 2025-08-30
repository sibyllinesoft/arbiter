import type { Meta, StoryObj } from '@storybook/react';
import { SplitViewShowcase } from './SplitViewShowcase';
import { DataViewer } from './DataViewer';
import { MermaidRenderer } from './MermaidRenderer';
import React from 'react';

const meta = {
  title: 'Diagrams/Gap Analysis - Split View',
  component: SplitViewShowcase,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SplitViewShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// GAP ANALYSIS VISUALIZATION COMPONENTS
// ============================================================================

interface CoverageData {
  capability: string;
  expected: number;
  actual: number;
  status: 'good' | 'warning' | 'critical';
}

interface GapVisualizationProps {
  data: CoverageData[];
  title?: string;
}

const GapVisualization: React.FC<GapVisualizationProps> = ({ data, title }) => {
  const maxValue = Math.max(...data.map(d => d.expected));
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg">
      {title && (
        <h4 className="text-lg font-semibold mb-4 text-center">{title}</h4>
      )}
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 truncate mr-2">
                {item.capability}
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">
                  {item.actual}% / {item.expected}%
                </span>
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getStatusColor(item.status) }}
                />
              </div>
            </div>
            <div className="relative">
              {/* Background bar (expected) */}
              <div className="w-full h-6 bg-gray-100 rounded-full overflow-hidden">
                {/* Expected coverage (light background) */}
                <div 
                  className="h-full bg-gray-200"
                  style={{ width: `${(item.expected / maxValue) * 100}%` }}
                />
                {/* Actual coverage (colored foreground) */}
                <div 
                  className="absolute top-0 left-0 h-full rounded-full opacity-80"
                  style={{ 
                    width: `${(item.actual / maxValue) * 100}%`,
                    backgroundColor: getStatusColor(item.status)
                  }}
                />
              </div>
              {/* Gap indicator */}
              {item.actual < item.expected && (
                <div 
                  className="absolute top-0 h-full border-r-2 border-red-500"
                  style={{ 
                    left: `${(item.actual / maxValue) * 100}%`,
                    width: `${((item.expected - item.actual) / maxValue) * 100}%`
                  }}
                >
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-200 rounded"></div>
            <span>Expected Coverage</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Good (≥90%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Warning (70-89%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Critical (&lt;70%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// REALISTIC GAP ANALYSIS DATA
// ============================================================================

const testCoverageGapYaml = `# Test Coverage Gap Analysis
name: "E-commerce Platform Test Coverage"
version: "1.0.0"
analysis_date: "2024-01-20"

# Coverage Standards
coverage_standards:
  critical_components: 95
  business_logic: 90
  api_endpoints: 85
  ui_components: 80
  utility_functions: 75

# Coverage Analysis Results
coverage_analysis:
  authentication_module:
    component: "User Authentication"
    expected_coverage: 95
    actual_coverage: 78
    status: "critical"
    gaps:
      - "MFA validation edge cases"
      - "Session timeout scenarios"
      - "Concurrent login handling"
      - "Password reset workflow"
    missing_tests:
      - test: "test_concurrent_login_attempts"
        priority: "high"
        effort: "2d"
      - test: "test_mfa_backup_codes"
        priority: "medium"
        effort: "1d"
      - test: "test_password_reset_expiry"
        priority: "high"
        effort: "1d"
        
  payment_processing:
    component: "Payment Processing"
    expected_coverage: 95
    actual_coverage: 82
    status: "critical"
    gaps:
      - "Payment failure scenarios"
      - "Refund processing edge cases"
      - "Currency conversion handling"
      - "Fraud detection integration"
    missing_tests:
      - test: "test_payment_timeout_handling"
        priority: "high"
        effort: "3d"
      - test: "test_partial_refund_scenarios"
        priority: "medium"
        effort: "2d"
        
  user_management:
    component: "User Management APIs"
    expected_coverage: 85
    actual_coverage: 91
    status: "good"
    gaps:
      - "Bulk user operations"
      - "Role assignment edge cases"
    missing_tests:
      - test: "test_bulk_user_import"
        priority: "low"
        effort: "1d"
        
  product_catalog:
    component: "Product Catalog"
    expected_coverage: 85
    actual_coverage: 74
    status: "warning"
    gaps:
      - "Search functionality edge cases"
      - "Category management"
      - "Inventory sync scenarios"
      - "Product recommendation engine"
    missing_tests:
      - test: "test_search_with_special_characters"
        priority: "high"
        effort: "1d"
      - test: "test_inventory_negative_stock"
        priority: "medium"  
        effort: "2d"
      - test: "test_recommendation_cold_start"
        priority: "low"
        effort: "3d"
        
  order_processing:
    component: "Order Processing"
    expected_coverage: 90
    actual_coverage: 86
    status: "warning"
    gaps:
      - "Order cancellation workflows"
      - "Shipping integration errors"
      - "Tax calculation edge cases"
    missing_tests:
      - test: "test_order_cancellation_after_shipment"
        priority: "high"
        effort: "2d"
      - test: "test_shipping_provider_failures"
        priority: "medium"
        effort: "2d"
        
  notification_system:
    component: "Notification System"
    expected_coverage: 80
    actual_coverage: 92
    status: "good"
    gaps:
      - "Email delivery failure handling"
    missing_tests:
      - test: "test_email_bounce_handling"
        priority: "low"
        effort: "1d"

# Priority Analysis
priority_matrix:
  high_impact_low_coverage:
    - component: "Authentication Module"
      impact: "critical"
      coverage_gap: 17
      business_risk: "security_vulnerability"
      
    - component: "Payment Processing"
      impact: "critical"
      coverage_gap: 13
      business_risk: "financial_loss"
      
  medium_impact_gaps:
    - component: "Product Catalog"
      impact: "high"
      coverage_gap: 11
      business_risk: "user_experience"
      
    - component: "Order Processing"
      impact: "high"
      coverage_gap: 4
      business_risk: "order_fulfillment"

# Recommendations
recommendations:
  immediate_actions:
    - action: "Implement authentication edge case tests"
      deadline: "1 week"
      owner: "security_team"
      
    - action: "Add payment failure scenario coverage"
      deadline: "2 weeks"
      owner: "payments_team"
      
  short_term_goals:
    - goal: "Achieve 85% coverage across all components"
      timeline: "1 month"
      
    - goal: "Implement automated coverage reporting"
      timeline: "2 weeks"
      
  long_term_strategy:
    - strategy: "Implement shift-left testing practices"
      timeline: "3 months"
      
    - strategy: "Establish coverage quality gates in CI/CD"
      timeline: "1 month"`;

const coverageData: CoverageData[] = [
  { capability: 'Authentication Module', expected: 95, actual: 78, status: 'critical' },
  { capability: 'Payment Processing', expected: 95, actual: 82, status: 'critical' },
  { capability: 'User Management APIs', expected: 85, actual: 91, status: 'good' },
  { capability: 'Product Catalog', expected: 85, actual: 74, status: 'warning' },
  { capability: 'Order Processing', expected: 90, actual: 86, status: 'warning' },
  { capability: 'Notification System', expected: 80, actual: 92, status: 'good' },
];

const securityComplianceYaml = `# Security Compliance Gap Analysis
name: "Security Compliance Assessment"
version: "2.0.0"
standards: ["SOC2", "PCI-DSS", "GDPR"]
assessment_date: "2024-01-20"

# Compliance Requirements
compliance_frameworks:
  soc2_type2:
    requirements:
      - control: "CC6.1 - Logical Access Controls"
        expected_score: 100
        actual_score: 85
        status: "non_compliant"
        gaps:
          - "Multi-factor authentication not enforced for all admin accounts"
          - "Password complexity policy insufficient"
          - "Session timeout not configured for admin portal"
        
      - control: "CC6.2 - Logical Access Provisioning"
        expected_score: 100
        actual_score: 92
        status: "minor_gaps"
        gaps:
          - "Access review process not fully automated"
          - "Contractor access provisions unclear"
          
      - control: "CC6.3 - User Access Removal"
        expected_score: 100
        actual_score: 95
        status: "compliant"
        gaps:
          - "API key rotation process could be improved"
          
      - control: "CC7.1 - System Monitoring"
        expected_score: 100
        actual_score: 78
        status: "non_compliant"
        gaps:
          - "Log aggregation incomplete for all services"
          - "Security incident response automation missing"
          - "Threat detection rules need optimization"
          
  pci_dss:
    requirements:
      - control: "Req 3 - Protect Stored Cardholder Data"
        expected_score: 100
        actual_score: 95
        status: "compliant"
        gaps:
          - "Legacy database encryption upgrade pending"
          
      - control: "Req 4 - Encrypt Data in Transit"
        expected_score: 100
        actual_score: 88
        status: "minor_gaps"
        gaps:
          - "Internal service communication not fully encrypted"
          - "Legacy API endpoints using TLS 1.1"
          
      - control: "Req 6 - Secure Development"
        expected_score: 100
        actual_score: 82
        status: "non_compliant"
        gaps:
          - "Code review process not covering all repositories"
          - "Security testing not integrated into CI/CD"
          - "Dependency vulnerability scanning incomplete"
          
      - control: "Req 11 - Regular Security Testing"
        expected_score: 100
        actual_score: 71
        status: "non_compliant"
        gaps:
          - "Penetration testing frequency insufficient"
          - "Vulnerability assessment automation needed"
          - "Security scan coverage incomplete"
          
  gdpr:
    requirements:
      - control: "Data Processing Lawfulness"
        expected_score: 100
        actual_score: 94
        status: "compliant"
        gaps:
          - "Consent management for marketing emails needs update"
          
      - control: "Data Subject Rights"
        expected_score: 100
        actual_score: 87
        status: "minor_gaps"
        gaps:
          - "Data export functionality not covering all data types"
          - "Right to rectification process not fully automated"
          
      - control: "Data Protection Impact Assessment"
        expected_score: 100
        actual_score: 76
        status: "non_compliant"
        gaps:
          - "DPIA not conducted for new AI features"
          - "Privacy impact assessment process incomplete"
          
      - control: "Data Breach Notification"
        expected_score: 100
        actual_score: 89
        status: "minor_gaps"
        gaps:
          - "Breach detection automation needs improvement"
          - "Notification templates require legal review"

# Risk Assessment
risk_matrix:
  critical_risks:
    - finding: "Insufficient logging and monitoring (CC7.1)"
      impact: "high"
      likelihood: "medium"
      business_impact: "Potential security incidents undetected"
      remediation_effort: "high"
      
    - finding: "Incomplete security testing (PCI Req 11)"
      impact: "high"
      likelihood: "high"
      business_impact: "Payment card data compromise risk"
      remediation_effort: "medium"
      
  high_risks:
    - finding: "Insecure development practices (PCI Req 6)"
      impact: "medium"
      likelihood: "medium"
      business_impact: "Code vulnerabilities in production"
      remediation_effort: "medium"
      
    - finding: "Inadequate access controls (CC6.1)"
      impact: "high"
      likelihood: "low"
      business_impact: "Unauthorized system access"
      remediation_effort: "low"

# Remediation Plan
remediation_roadmap:
  immediate_actions:
    - action: "Enable MFA for all administrative accounts"
      priority: "critical"
      effort: "1 week"
      owner: "security_team"
      
    - action: "Upgrade legacy TLS endpoints to 1.3"
      priority: "high"
      effort: "2 weeks"
      owner: "infrastructure_team"
      
  short_term_goals:
    - goal: "Implement comprehensive security monitoring"
      timeline: "1 month"
      components:
        - "SIEM solution deployment"
        - "Security alert automation"
        - "Incident response playbooks"
        
    - goal: "Integrate security testing into CI/CD pipeline"
      timeline: "6 weeks"
      components:
        - "SAST tool integration"
        - "Dependency vulnerability scanning"
        - "Container security scanning"
        
  long_term_objectives:
    - objective: "Achieve full SOC2 Type II compliance"
      timeline: "3 months"
      
    - objective: "Implement zero-trust security architecture"
      timeline: "6 months"`;

const complianceData: CoverageData[] = [
  { capability: 'SOC2 - Access Controls (CC6.1)', expected: 100, actual: 85, status: 'critical' },
  { capability: 'SOC2 - Access Provisioning (CC6.2)', expected: 100, actual: 92, status: 'warning' },
  { capability: 'SOC2 - System Monitoring (CC7.1)', expected: 100, actual: 78, status: 'critical' },
  { capability: 'PCI-DSS - Data Protection (Req 3)', expected: 100, actual: 95, status: 'good' },
  { capability: 'PCI-DSS - Data Transit (Req 4)', expected: 100, actual: 88, status: 'warning' },
  { capability: 'PCI-DSS - Secure Development (Req 6)', expected: 100, actual: 82, status: 'critical' },
  { capability: 'PCI-DSS - Security Testing (Req 11)', expected: 100, actual: 71, status: 'critical' },
  { capability: 'GDPR - Data Processing', expected: 100, actual: 94, status: 'good' },
  { capability: 'GDPR - Subject Rights', expected: 100, actual: 87, status: 'warning' },
  { capability: 'GDPR - Impact Assessment', expected: 100, actual: 76, status: 'critical' },
];

const apiCoverageYaml = `# API Coverage Gap Analysis
name: "API Testing & Documentation Coverage"
version: "1.1.0"
analysis_date: "2024-01-20"

# API Inventory
api_endpoints:
  authentication_service:
    base_url: "/api/v1/auth"
    endpoints:
      - path: "/login"
        method: "POST"
        documentation_coverage: 95
        test_coverage: 78
        performance_tested: false
        security_tested: true
        
      - path: "/register"
        method: "POST"
        documentation_coverage: 90
        test_coverage: 85
        performance_tested: false
        security_tested: true
        
      - path: "/refresh"
        method: "POST"
        documentation_coverage: 88
        test_coverage: 70
        performance_tested: false
        security_tested: false
        
      - path: "/logout"
        method: "POST"
        documentation_coverage: 92
        test_coverage: 95
        performance_tested: true
        security_tested: true
        
  user_service:
    base_url: "/api/v1/users"
    endpoints:
      - path: "/"
        method: "GET"
        documentation_coverage: 85
        test_coverage: 90
        performance_tested: true
        security_tested: true
        
      - path: "/{id}"
        method: "GET"
        documentation_coverage: 92
        test_coverage: 88
        performance_tested: true
        security_tested: true
        
      - path: "/{id}"
        method: "PUT"
        documentation_coverage: 78
        test_coverage: 82
        performance_tested: false
        security_tested: true
        
      - path: "/{id}"
        method: "DELETE"
        documentation_coverage: 95
        test_coverage: 75
        performance_tested: false
        security_tested: false
        
  product_service:
    base_url: "/api/v1/products"
    endpoints:
      - path: "/"
        method: "GET"
        documentation_coverage: 90
        test_coverage: 92
        performance_tested: true
        security_tested: false
        
      - path: "/search"
        method: "GET"
        documentation_coverage: 88
        test_coverage: 85
        performance_tested: true
        security_tested: false
        
      - path: "/{id}"
        method: "GET"
        documentation_coverage: 95
        test_coverage: 90
        performance_tested: true
        security_tested: false
        
      - path: "/"
        method: "POST"
        documentation_coverage: 82
        test_coverage: 78
        performance_tested: false
        security_tested: true

# Coverage Analysis
coverage_summary:
  documentation:
    total_endpoints: 12
    fully_documented: 8  # >= 90%
    partially_documented: 3  # 70-89%
    poorly_documented: 1  # < 70%
    overall_score: 88.5
    
  functional_testing:
    total_endpoints: 12
    well_tested: 7  # >= 85%
    adequately_tested: 3  # 70-84%
    poorly_tested: 2  # < 70%
    overall_score: 83.2
    
  performance_testing:
    total_endpoints: 12
    performance_tested: 5
    not_tested: 7
    coverage_percentage: 41.7
    
  security_testing:
    total_endpoints: 12
    security_tested: 7
    not_tested: 5
    coverage_percentage: 58.3

# Gap Identification
critical_gaps:
  security_testing:
    missing_endpoints:
      - "/api/v1/auth/refresh"
      - "/api/v1/users/{id} DELETE"
      - "/api/v1/products/*"
    impact: "High - Potential security vulnerabilities undetected"
    
  performance_testing:
    missing_endpoints:
      - "/api/v1/auth/login"
      - "/api/v1/auth/register"
      - "/api/v1/auth/refresh"
      - "/api/v1/users/{id} PUT"
      - "/api/v1/users/{id} DELETE"
      - "/api/v1/products/ POST"
    impact: "Medium - Unknown performance characteristics under load"
    
  documentation_quality:
    low_coverage_endpoints:
      - "/api/v1/users/{id} PUT" # 78%
    incomplete_sections:
      - "Error response schemas"
      - "Rate limiting information"
      - "Authentication requirements"

# Improvement Plan
improvement_roadmap:
  week_1:
    - task: "Add security tests for refresh token endpoint"
      owner: "security_team"
      estimated_effort: "2d"
      
    - task: "Implement performance tests for authentication endpoints"
      owner: "qa_team"
      estimated_effort: "3d"
      
  week_2:
    - task: "Complete security testing for product service APIs"
      owner: "security_team"
      estimated_effort: "4d"
      
    - task: "Update documentation for user management endpoints"
      owner: "api_team"
      estimated_effort: "2d"
      
  month_1:
    - milestone: "Achieve 85% coverage across all testing categories"
    - milestone: "Implement automated API testing in CI/CD pipeline"
    
# Quality Gates
quality_standards:
  new_api_requirements:
    documentation_coverage: 95
    functional_test_coverage: 90
    security_testing: "mandatory"
    performance_baseline: "mandatory"
    
  existing_api_improvements:
    documentation_coverage: 85
    functional_test_coverage: 80
    security_testing_priority: "high_risk_endpoints_first"`;

const apiCoverageData: CoverageData[] = [
  { capability: 'Documentation Coverage', expected: 90, actual: 88.5, status: 'warning' },
  { capability: 'Functional Test Coverage', expected: 85, actual: 83.2, status: 'warning' },
  { capability: 'Performance Test Coverage', expected: 80, actual: 41.7, status: 'critical' },
  { capability: 'Security Test Coverage', expected: 75, actual: 58.3, status: 'critical' },
  { capability: 'Auth Service Coverage', expected: 90, actual: 82, status: 'warning' },
  { capability: 'User Service Coverage', expected: 90, actual: 83.8, status: 'warning' },
  { capability: 'Product Service Coverage', expected: 90, actual: 86.3, status: 'warning' },
];

const gapAnalysisMermaid = `graph TD
    subgraph "Coverage Assessment Process"
        START[📊 Gap Analysis<br/>Initiation] --> COLLECT[📋 Data Collection<br/>Current State]
        COLLECT --> BASELINE[📏 Baseline Definition<br/>Expected Standards]
        BASELINE --> ANALYSIS[🔍 Gap Identification<br/>Analysis Engine]
    end
    
    subgraph "Analysis Categories"
        ANALYSIS --> TEST_GAP[🧪 Test Coverage Gaps]
        ANALYSIS --> SEC_GAP[🔒 Security Compliance Gaps]  
        ANALYSIS --> API_GAP[🌐 API Coverage Gaps]
        ANALYSIS --> PERF_GAP[⚡ Performance Gaps]
    end
    
    subgraph "Risk Assessment"
        TEST_GAP --> RISK[⚠️ Risk Matrix<br/>Impact × Probability]
        SEC_GAP --> RISK
        API_GAP --> RISK
        PERF_GAP --> RISK
        
        RISK --> CRITICAL[🚨 Critical Issues<br/>Immediate Action]
        RISK --> HIGH[⚠️ High Priority<br/>Short Term]
        RISK --> MEDIUM[📋 Medium Priority<br/>Planned]
        RISK --> LOW[📝 Low Priority<br/>Backlog]
    end
    
    subgraph "Remediation Planning"
        CRITICAL --> IMMEDIATE[🔥 Immediate Actions<br/>0-1 weeks]
        HIGH --> SHORT_TERM[📅 Short Term Goals<br/>1-4 weeks]
        MEDIUM --> LONG_TERM[🎯 Long Term Strategy<br/>1-3 months]
        
        IMMEDIATE --> EXEC[⚡ Execute Fixes]
        SHORT_TERM --> EXEC
        LONG_TERM --> PLAN[📋 Strategic Planning]
    end
    
    subgraph "Monitoring & Validation"
        EXEC --> VALIDATE[✅ Validation Testing]
        VALIDATE --> MEASURE[📈 Progress Measurement]
        MEASURE --> REPORT[📊 Coverage Reports]
        REPORT --> FEEDBACK[🔄 Continuous Improvement]
        
        FEEDBACK --> COLLECT
    end
    
    %% Styling
    classDef process fill:#e1f5fe,stroke:#01579b
    classDef gap fill:#fff3e0,stroke:#f57c00
    classDef risk fill:#ffebee,stroke:#d32f2f
    classDef action fill:#e8f5e8,stroke:#2e7d32
    classDef monitor fill:#f3e5f5,stroke:#7b1fa2
    
    class START,COLLECT,BASELINE,ANALYSIS process
    class TEST_GAP,SEC_GAP,API_GAP,PERF_GAP gap
    class RISK,CRITICAL,HIGH,MEDIUM,LOW risk
    class IMMEDIATE,SHORT_TERM,LONG_TERM,EXEC,PLAN action
    class VALIDATE,MEASURE,REPORT,FEEDBACK monitor`;

// ============================================================================
// STORY DEFINITIONS
// ============================================================================

export const TestCoverageGapAnalysis: Story = {
  args: {
    title: "Test Coverage Gap Analysis",
    description: "Comprehensive analysis of test coverage gaps across all system components with prioritized remediation plan.",
    dataPanelTitle: "Coverage Analysis Report (YAML)",
    diagramPanelTitle: "Coverage Gap Visualization",
    dataPanel: (
      <DataViewer
        data={testCoverageGapYaml}
        language="yaml"
        title="test-coverage-analysis.yml"
      />
    ),
    diagramPanel: (
      <GapVisualization 
        data={coverageData}
        title="Test Coverage by Component"
      />
    ),
  },
};

export const SecurityComplianceGapAnalysis: Story = {
  args: {
    title: "Security Compliance Gap Analysis",
    description: "Multi-framework security compliance assessment (SOC2, PCI-DSS, GDPR) with risk-based remediation planning.",
    dataPanelTitle: "Compliance Assessment (YAML)",
    diagramPanelTitle: "Compliance Gap Visualization",
    dataPanel: (
      <DataViewer
        data={securityComplianceYaml}
        language="yaml"
        title="security-compliance-analysis.yml"
      />
    ),
    diagramPanel: (
      <GapVisualization 
        data={complianceData}
        title="Security Compliance Status"
      />
    ),
  },
};

export const ApiCoverageGapAnalysis: Story = {
  args: {
    title: "API Coverage Gap Analysis", 
    description: "Comprehensive API testing and documentation coverage analysis with endpoint-level gap identification.",
    dataPanelTitle: "API Analysis Report (YAML)",
    diagramPanelTitle: "API Coverage Visualization",
    dataPanel: (
      <DataViewer
        data={apiCoverageYaml}
        language="yaml"
        title="api-coverage-analysis.yml"
      />
    ),
    diagramPanel: (
      <GapVisualization 
        data={apiCoverageData}
        title="API Testing & Documentation Coverage"
      />
    ),
  },
};

export const GapAnalysisProcess: Story = {
  args: {
    title: "Gap Analysis Methodology",
    description: "Complete gap analysis process flow from data collection through remediation and continuous improvement.",
    dataPanelTitle: "Process Documentation (YAML)",
    diagramPanelTitle: "Gap Analysis Process Flow",
    dataPanel: (
      <DataViewer
        data={`# Gap Analysis Process Methodology
name: "Systematic Gap Analysis Framework"
version: "1.0.0"

# Process Overview
methodology:
  phases:
    - name: "Discovery & Baseline"
      duration: "1-2 weeks"
      activities:
        - "Current state data collection"
        - "Standard/requirement definition"
        - "Tool and metric selection"
        
    - name: "Analysis & Identification" 
      duration: "1 week"
      activities:
        - "Gap identification and quantification"
        - "Root cause analysis"
        - "Impact and risk assessment"
        
    - name: "Planning & Prioritization"
      duration: "1 week"
      activities:
        - "Remediation strategy development"
        - "Resource allocation planning"
        - "Timeline and milestone definition"
        
    - name: "Execution & Monitoring"
      duration: "Ongoing"
      activities:
        - "Remediation implementation"
        - "Progress tracking and measurement"
        - "Continuous improvement feedback"

# Quality Gates
quality_gates:
  discovery_complete:
    criteria: "100% of systems analyzed"
    validation: "Data completeness check"
    
  gaps_identified:
    criteria: "All gaps categorized and prioritized"
    validation: "Stakeholder review and approval"
    
  plan_approved:
    criteria: "Remediation plan approved by leadership"
    validation: "Budget and resource allocation confirmed"

# Success Metrics
success_criteria:
  coverage_improvement: ">20% increase in overall coverage scores"
  risk_reduction: ">50% reduction in critical and high-risk gaps"
  process_efficiency: "<30% time reduction in gap identification cycles"`}
        language="yaml"
        title="gap-analysis-methodology.yml"
      />
    ),
    diagramPanel: (
      <MermaidRenderer 
        chart={gapAnalysisMermaid}
        title="Gap Analysis Process Flow"
      />
    ),
  },
};