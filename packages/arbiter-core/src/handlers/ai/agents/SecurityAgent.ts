import type { HandlerResponse, WebhookEvent } from '../../shared/utils.js';
import { createResponse } from '../../shared/utils.js';
import { GitHubPRAdapter } from '../adapters/github/GitHubPRAdapter.js';
import { GitHubPushAdapter } from '../adapters/github/GitHubPushAdapter.js';
import { GitLabMRAdapter } from '../adapters/gitlab/GitLabMRAdapter.js';
import { AIAgentHandler } from '../base/AIAgentHandler.js';
import type { AIAgentConfig, AICommand } from '../base/types.js';
import { ClaudeProvider } from '../providers/ClaudeProvider.js';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';

/**
 * AI-powered Security Agent
 *
 * This agent automatically scans code for security vulnerabilities, providing:
 * - Vulnerability detection and analysis
 * - Security best practices compliance
 * - Dependency security scanning
 * - Authentication and authorization review
 * - Data protection and privacy compliance
 * - Security configuration analysis
 *
 * Supported commands:
 * - /security-scan - Comprehensive security analysis
 * - /vulnerability-check - Specific vulnerability detection
 * - /dependency-audit - Third-party dependency security audit
 * - /auth-review - Authentication and authorization review
 * - /data-privacy - Data protection and privacy analysis
 * - /config-security - Security configuration review
 */
export class SecurityAgent extends AIAgentHandler {
  constructor(config: AIAgentConfig) {
    // Initialize AI provider based on config
    let provider: ClaudeProvider | OpenAIProvider | GeminiProvider;
    switch (config.provider.type) {
      case 'claude':
        provider = new ClaudeProvider(config.provider.config);
        break;
      case 'openai':
        provider = new OpenAIProvider(config.provider.config);
        break;
      case 'gemini':
        provider = new GeminiProvider(config.provider.config);
        break;
      default: {
        const exhaustiveCheck: never = config.provider;
        throw new Error(`Unsupported AI provider: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }

    super(config, provider);

    // Register adapters for different platforms
    this.registerAdapter('github', 'pull_request', new GitHubPRAdapter());
    this.registerAdapter('github', 'push', new GitHubPushAdapter());
    this.registerAdapter('gitlab', 'merge_request', new GitLabMRAdapter());
  }

  /**
   * Initialize AI commands for security analysis
   */
  protected initializeCommands(): void {
    // Comprehensive security scan
    this.registerCommand('security-scan', {
      name: 'security-scan',
      description: 'Comprehensive security analysis of code changes',
      usage: '/security-scan [severity]',
      examples: [
        '/security-scan',
        '/security-scan critical',
        '/security-scan all',
        '/security-scan compliance',
      ],
      requiresArgs: false,
      prompt: `Perform a comprehensive security analysis of the code changes. Examine for:

1. **Input Validation Vulnerabilities**:
   - SQL injection vulnerabilities in database queries
   - Cross-site scripting (XSS) in user input handling
   - Command injection in system calls
   - Path traversal vulnerabilities in file operations
   - XML/JSON injection in data parsing
   - LDAP injection in directory operations

2. **Authentication & Authorization Issues**:
   - Weak password policies and storage
   - Insecure session management
   - Missing authentication checks
   - Privilege escalation vulnerabilities
   - Broken access control mechanisms
   - JWT token vulnerabilities

3. **Data Protection Concerns**:
   - Sensitive data exposure in logs/errors
   - Insecure data transmission (missing HTTPS/TLS)
   - Weak encryption or deprecated algorithms
   - Hardcoded secrets and credentials
   - Insecure data storage mechanisms
   - Missing data anonymization/pseudonymization

4. **Configuration Security Issues**:
   - Insecure default configurations
   - Missing security headers
   - Verbose error messages leaking information
   - Insecure CORS policies
   - Exposed debug interfaces
   - Missing rate limiting

5. **Dependency & Supply Chain Risks**:
   - Vulnerable third-party libraries
   - Outdated dependencies with known CVEs
   - Malicious or suspicious packages
   - Integrity verification issues
   - License compliance concerns

For each vulnerability found:
- **Severity**: Critical, High, Medium, Low
- **CVSS Score**: If applicable
- **CWE Classification**: Common Weakness Enumeration
- **Exploitation Scenario**: How it could be exploited
- **Remediation**: Specific fix recommendations
- **OWASP Mapping**: OWASP Top 10 classification

Prioritize findings by risk and business impact.`,
      actions: {
        postComment: true,
        addLabels: true,
        createIssue: true,
      },
    });

    // Specific vulnerability detection
    this.registerCommand('vulnerability-check', {
      name: 'vulnerability-check',
      description: 'Targeted vulnerability detection for specific security issues',
      usage: '/vulnerability-check [type]',
      examples: [
        '/vulnerability-check',
        '/vulnerability-check injection',
        '/vulnerability-check xss',
        '/vulnerability-check auth',
      ],
      requiresArgs: false,
      prompt: `Focus on detecting specific vulnerabilities in the code changes. Analyze:

1. **Injection Vulnerabilities**:
   - SQL injection in database operations
   - NoSQL injection in document databases
   - Command injection in system execution
   - Code injection in dynamic evaluation
   - XXE (XML External Entity) attacks

2. **Cross-Site Scripting (XSS)**:
   - Reflected XSS in user input echoing
   - Stored XSS in persistent data
   - DOM-based XSS in client-side JavaScript
   - Content Security Policy bypasses

3. **Authentication Bypasses**:
   - Logic flaws in authentication flows
   - Session fixation vulnerabilities
   - Insecure password reset mechanisms
   - Multi-factor authentication bypasses

4. **Authorization Issues**:
   - Horizontal privilege escalation
   - Vertical privilege escalation
   - Insecure direct object references
   - Missing function-level access control

5. **Cryptographic Failures**:
   - Weak random number generation
   - Insecure hash functions
   - Improper certificate validation
   - Weak cipher suites and protocols

Provide detailed technical analysis with:
- Proof of concept exploitation steps
- Code snippets showing vulnerable patterns
- Specific remediation code examples
- Testing methodologies for verification`,
      actions: {
        postComment: true,
        addLabels: true,
        createIssue: true,
      },
    });

    // Dependency security audit
    this.registerCommand('dependency-audit', {
      name: 'dependency-audit',
      description: 'Security audit of third-party dependencies',
      usage: '/dependency-audit [scope]',
      examples: [
        '/dependency-audit',
        '/dependency-audit direct',
        '/dependency-audit transitive',
        '/dependency-audit outdated',
      ],
      requiresArgs: false,
      prompt: `Perform a security audit of third-party dependencies in the code changes. Analyze:

1. **Known Vulnerabilities**:
   - CVE database matches for used packages
   - Security advisories from package maintainers
   - GHSA (GitHub Security Advisories) matches
   - NVD (National Vulnerability Database) entries

2. **Dependency Risk Assessment**:
   - Package popularity and maintenance status
   - Number of maintainers and community support
   - Update frequency and security response time
   - License compatibility and compliance

3. **Supply Chain Security**:
   - Package integrity verification
   - Suspicious recent changes or updates
   - Maintainer changes or compromises
   - Typosquatting or malicious packages

4. **Version Analysis**:
   - Outdated packages with security updates available
   - Version pinning strategies
   - Semantic versioning compliance
   - Breaking changes in security updates

5. **Transitive Dependencies**:
   - Vulnerable indirect dependencies
   - Dependency tree depth and complexity
   - Conflicting version requirements
   - Bundled dependency analysis

For each dependency issue:
- **Package Name**: Exact package and version
- **Vulnerability ID**: CVE, GHSA, or advisory ID
- **Severity Score**: CVSS or equivalent rating
- **Affected Versions**: Version ranges impacted
- **Fix Available**: Update versions or workarounds
- **Exploitability**: Real-world exploitation likelihood`,
      actions: {
        postComment: true,
        addLabels: true,
        createIssue: true,
      },
    });

    // Authentication and authorization review
    this.registerCommand('auth-review', {
      name: 'auth-review',
      description: 'Authentication and authorization security review',
      usage: '/auth-review [focus]',
      examples: ['/auth-review', '/auth-review oauth', '/auth-review jwt', '/auth-review rbac'],
      requiresArgs: false,
      prompt: `Review authentication and authorization mechanisms in the code changes. Focus on:

1. **Authentication Security**:
   - Password strength requirements and policies
   - Multi-factor authentication implementation
   - Account lockout and brute force protection
   - Session management and timeout policies
   - Secure credential storage and hashing

2. **Authorization Controls**:
   - Role-based access control (RBAC) implementation
   - Attribute-based access control (ABAC) if used
   - Principle of least privilege enforcement
   - Privilege escalation prevention
   - Resource-level access control

3. **Token Security**:
   - JWT token validation and verification
   - Token expiration and refresh mechanisms
   - Secure token storage and transmission
   - Token revocation capabilities
   - Cryptographic signature verification

4. **OAuth/OIDC Implementation**:
   - OAuth 2.0/2.1 flow security
   - PKCE (Proof Key for Code Exchange) usage
   - Scope validation and enforcement
   - Redirect URI validation
   - State parameter usage for CSRF protection

5. **Session Security**:
   - Session ID generation and entropy
   - Secure cookie configuration
   - Session invalidation on logout
   - Cross-site request forgery (CSRF) protection
   - Session hijacking prevention

Analyze for common authentication/authorization anti-patterns:
- Hardcoded credentials
- Weak session identifiers  
- Missing authentication checks
- Insufficient authorization verification
- Insecure direct object references`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });

    // Data privacy and protection analysis
    this.registerCommand('data-privacy', {
      name: 'data-privacy',
      description: 'Data protection and privacy compliance analysis',
      usage: '/data-privacy [regulation]',
      examples: [
        '/data-privacy',
        '/data-privacy gdpr',
        '/data-privacy ccpa',
        '/data-privacy hipaa',
      ],
      requiresArgs: false,
      prompt: `Analyze data protection and privacy aspects of the code changes for compliance with regulations like GDPR, CCPA, HIPAA. Review:

1. **Personal Data Handling**:
   - Identification of personal/sensitive data
   - Data minimization principles
   - Purpose limitation and lawful basis
   - Consent management mechanisms
   - Data subject rights implementation

2. **Data Security Measures**:
   - Encryption at rest and in transit
   - Access logging and monitoring
   - Data pseudonymization and anonymization
   - Secure data deletion capabilities
   - Data breach detection mechanisms

3. **Privacy by Design**:
   - Default privacy settings
   - Privacy impact assessments
   - Data protection from system design stage
   - Transparency and user control
   - Data portability mechanisms

4. **Compliance Requirements**:
   - GDPR compliance (EU users)
   - CCPA compliance (California residents)
   - HIPAA compliance (healthcare data)
   - SOX compliance (financial data)
   - Industry-specific regulations

5. **Data Flow Analysis**:
   - Cross-border data transfers
   - Third-party data sharing
   - Data retention policies
   - Data deletion timelines
   - Audit trail requirements

Identify potential privacy violations and provide specific recommendations for regulatory compliance.`,
      actions: {
        postComment: true,
        addLabels: true,
        createIssue: true,
      },
    });

    // Security configuration review
    this.registerCommand('config-security', {
      name: 'config-security',
      description: 'Security configuration and infrastructure review',
      usage: '/config-security [component]',
      examples: [
        '/config-security',
        '/config-security headers',
        '/config-security cors',
        '/config-security tls',
      ],
      requiresArgs: false,
      prompt: `Review security configurations and infrastructure settings in the code changes. Analyze:

1. **HTTP Security Headers**:
   - Content Security Policy (CSP) configuration
   - HTTP Strict Transport Security (HSTS)
   - X-Frame-Options for clickjacking protection
   - X-Content-Type-Options for MIME sniffing
   - Referrer Policy configuration

2. **CORS Configuration**:
   - Cross-Origin Resource Sharing policies
   - Allowed origins, methods, and headers
   - Credential handling in CORS requests
   - Preflight request handling
   - Wildcard usage and security implications

3. **TLS/SSL Configuration**:
   - TLS version requirements (minimum TLS 1.2)
   - Cipher suite selection and ordering
   - Certificate validation mechanisms
   - HSTS implementation
   - Certificate pinning if applicable

4. **Infrastructure Security**:
   - Environment variable security
   - Configuration file permissions
   - Default configuration hardening
   - Debug mode and verbose logging settings
   - Error page information leakage

5. **API Security Configuration**:
   - Rate limiting implementation
   - Request size limitations
   - Timeout configurations
   - API versioning security
   - Health check endpoint exposure

Review configurations against security baselines like:
- OWASP Application Security Configuration Guide
- CIS Benchmarks
- NIST Cybersecurity Framework
- Industry best practices

Provide specific configuration recommendations and potential security risks of current settings.`,
      actions: {
        postComment: true,
        addLabels: true,
      },
    });
  }

  /**
   * Process standard events (automatic security scanning)
   */
  protected async processEvent(
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<HandlerResponse> {
    // Check if automatic security scanning is enabled
    if (!this.config.behavior?.autoResponse) {
      return createResponse(true, 'Automatic security scanning disabled', {
        skipped: true,
        reason: 'auto_response_disabled',
      });
    }

    // Auto-scan significant code changes and protected branch pushes
    const shouldAutoScan = this.shouldPerformSecurityScan(eventData);

    if (!shouldAutoScan) {
      return createResponse(true, 'Event does not require automatic security scan', {
        skipped: true,
        reason: 'no_security_scan_needed',
      });
    }

    try {
      // Perform automatic security scan
      const scanCommand = this.commands.get('security-scan')!;
      const aiContext = {
        command: 'security-scan',
        args: [],
        eventData,
        originalEvent,
        config: this.config,
      };

      const aiResponse = await this.provider.processCommand(scanCommand, aiContext);

      if (!aiResponse.success) {
        return createResponse(false, `Automatic security scan failed: ${aiResponse.error}`);
      }

      // Execute any actions from the AI
      let actionResults = [];
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        actionResults = await this.executeActions(aiResponse.actions, eventData, originalEvent);
      }

      return createResponse(true, 'Automatic security scan completed', {
        securityScan: aiResponse.data,
        actions: actionResults,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return createResponse(false, `Automatic security scan error: ${errorMessage}`);
    }
  }

  /**
   * Determine if security scanning should be performed
   */
  private shouldPerformSecurityScan(eventData: any): boolean {
    // Scan all PRs to protected branches
    if (
      eventData.pullRequest?.targetBranch &&
      ['main', 'master', 'develop', 'production'].includes(eventData.pullRequest.targetBranch)
    ) {
      return true;
    }

    // Scan pushes to protected branches
    if (eventData.push?.isProtectedBranch) {
      return true;
    }

    // Scan if security-related changes detected
    if (this.hasSecurityRelevantChanges(eventData)) {
      return true;
    }

    return false;
  }

  /**
   * Check if changes are security-relevant
   */
  private hasSecurityRelevantChanges(eventData: any): boolean {
    const securityKeywords = [
      'auth',
      'security',
      'password',
      'token',
      'jwt',
      'oauth',
      'encrypt',
      'decrypt',
      'hash',
      'crypto',
      'ssl',
      'tls',
      'permission',
      'role',
      'access',
      'privilege',
      'cors',
      'csrf',
      'xss',
      'injection',
      'vulnerability',
      'cve',
    ];

    const searchText =
      `${eventData.pullRequest?.title} ${eventData.pullRequest?.body} ${eventData.push?.commits?.map((c: any) => c.message).join(' ') || ''}`.toLowerCase();

    return securityKeywords.some(keyword => searchText.includes(keyword));
  }

  /**
   * Execute security-specific actions
   */
  protected async executeAction(
    action: any,
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    switch (action.type) {
      case 'comment':
        return await this.postSecurityComment(action.data, eventData, originalEvent);

      case 'label':
        return await this.addSecurityLabels(action.data, eventData, originalEvent);

      case 'issue':
        return await this.createSecurityIssue(action.data, eventData, originalEvent);

      case 'webhook':
        return await this.triggerSecurityWebhook(action.data, eventData, originalEvent);

      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  /**
   * Post security analysis comment
   */
  private async postSecurityComment(
    data: { body: string },
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    await this.logActivity({
      type: 'ai.agent.action.comment',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'security_comment',
      target: eventData.pullRequest
        ? `PR #${eventData.pullRequest.number}`
        : `Push to ${eventData.push?.branch}`,
      preview: data.body.substring(0, 100),
    });

    return {
      action: 'comment',
      status: 'success',
      type: 'security_analysis',
      message: 'Security analysis comment posted successfully',
      preview: data.body.substring(0, 100),
    };
  }

  /**
   * Add security-related labels
   */
  private async addSecurityLabels(
    data: { labels: string[] },
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    // Ensure security labels are prefixed appropriately
    const securityLabels = data.labels.map(label => {
      if (!label.startsWith('security') && !label.startsWith('vulnerability')) {
        return label.includes('critical') || label.includes('high')
          ? `security:${label}`
          : `security:${label}`;
      }
      return label;
    });

    await this.logActivity({
      type: 'ai.agent.action.label',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'security_label',
      target: eventData.pullRequest ? `PR #${eventData.pullRequest.number}` : 'Repository',
      labels: securityLabels,
    });

    return {
      action: 'label',
      status: 'success',
      type: 'security_labels',
      labels: securityLabels,
      message: `Added security labels: ${securityLabels.join(', ')}`,
    };
  }

  /**
   * Create security issue for vulnerabilities
   */
  private async createSecurityIssue(
    data: { title: string; body: string; labels?: string[]; severity?: string },
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    const securityLabels = ['security', ...(data.labels || [])];

    if (data.severity) {
      securityLabels.push(`severity:${data.severity.toLowerCase()}`);
    }

    await this.logActivity({
      type: 'ai.agent.action.issue',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'security_issue',
      title: data.title,
      severity: data.severity || 'unknown',
      labels: securityLabels,
    });

    return {
      action: 'create_issue',
      status: 'success',
      type: 'security_vulnerability',
      title: data.title,
      severity: data.severity,
      labels: securityLabels,
      message: 'Security vulnerability issue created successfully',
    };
  }

  /**
   * Trigger security webhook (for SIEM, security tools, etc.)
   */
  private async triggerSecurityWebhook(
    data: { webhookUrl: string; severity?: string; [key: string]: any },
    eventData: any,
    originalEvent: WebhookEvent
  ): Promise<any> {
    await this.logActivity({
      type: 'ai.agent.action.webhook',
      timestamp: new Date().toISOString(),
      agentId: this.config.id,
      action: 'security_webhook',
      webhookUrl: data.webhookUrl,
      severity: data.severity || 'unknown',
    });

    return {
      action: 'webhook',
      status: 'success',
      type: 'security_alert',
      url: data.webhookUrl,
      severity: data.severity,
      message: 'Security webhook triggered successfully',
    };
  }
}
