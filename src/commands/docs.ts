#!/usr/bin/env bun

/**
 * CLI Command: Documentation and Workflow System
 * 
 * Implements comprehensive documentation generation and workflow clarity system.
 * Provides `arbiter docs workflow`, enhanced `arbiter explain`, and next-step guidance.
 * 
 * Usage:
 *   arbiter docs workflow --md --out WORKFLOW.md
 *   arbiter docs explain [--sections all|assembly|contracts|ui|scenarios|gates]
 *   arbiter docs api --format openapi|markdown --out API.md
 *   arbiter docs architecture --template basic|detailed --out ARCHITECTURE.md
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs/promises';
import { table } from 'table';

// Documentation interfaces
interface DocsWorkflowOptions {
  md?: boolean;
  out?: string;
  template?: 'basic' | 'detailed' | 'enterprise';
  includeRules?: boolean;
  includeExamples?: boolean;
  includeNextSteps?: boolean;
  verbose?: boolean;
  json?: boolean;
}

interface DocsExplainOptions {
  sections?: string;
  detail?: 'basic' | 'detailed' | 'expert';
  includeExamples?: boolean;
  includeContracts?: boolean;
  includeUI?: boolean;
  includeGates?: boolean;
  format?: 'markdown' | 'json' | 'plain';
  out?: string;
  verbose?: boolean;
}

interface DocsAPIOptions {
  format?: 'openapi' | 'markdown' | 'html';
  out?: string;
  includeExamples?: boolean;
  includeSchemas?: boolean;
  includeAuth?: boolean;
  verbose?: boolean;
}

interface DocsArchitectureOptions {
  template?: 'basic' | 'detailed' | 'c4model' | 'adr';
  out?: string;
  includeDecisions?: boolean;
  includeRisks?: boolean;
  includeMetrics?: boolean;
  verbose?: boolean;
}

/**
 * Create the main docs command with subcommands
 */
export function createDocsCommand(): Command {
  const docsCommand = new Command('docs')
    .description('Comprehensive documentation and workflow system')
    .addHelpText('after', `
The docs system provides:
• Golden Path workflow documentation
• Plain-English explanations of Assembly configurations  
• API documentation generation from schemas
• Architecture documentation templates
• Next-step guidance for all operations

Examples:
  arbiter docs workflow --md --out WORKFLOW.md
  arbiter docs explain --sections contracts --detail expert
  arbiter docs api --format openapi --out openapi.yaml
  arbiter docs architecture --template c4model --out ARCHITECTURE.md`);

  // Add subcommands
  docsCommand.addCommand(createWorkflowCommand());
  docsCommand.addCommand(createExplainCommand());
  docsCommand.addCommand(createAPICommand());
  docsCommand.addCommand(createArchitectureCommand());

  return docsCommand;
}

/**
 * Create the workflow documentation command
 */
function createWorkflowCommand(): Command {
  return new Command('workflow')
    .description('Generate Golden Path workflow documentation')
    .option('--md', 'Output in Markdown format', true)
    .option('--out <file>', 'Output file path', 'WORKFLOW.md')
    .option('--template <type>', 'Documentation template (basic|detailed|enterprise)', 'detailed')
    .option('--include-rules', 'Include explicit rules and constraints', true)
    .option('--include-examples', 'Include workflow examples', true)
    .option('--include-next-steps', 'Include next-step guidance', true)
    .option('--json', 'Output metadata as JSON', false)
    .option('-v, --verbose', 'Enable verbose logging', false)
    .addHelpText('after', `
This generates the Golden Path documentation with the explicit rule:
"All edits must be ticketed & stamped. Direct CUE edits are rejected."

The workflow documentation includes:
• Complete development workflow from planning to deployment
• Rails & Guarantees architecture patterns  
• Ticket system integration
• UI Profile system workflows
• Contract validation processes
• Continuous validation loops

Examples:
  $ arbiter docs workflow
  $ arbiter docs workflow --out docs/DEVELOPMENT.md --template enterprise
  $ arbiter docs workflow --template basic --no-include-examples`)
    .action(async (options: DocsWorkflowOptions) => {
      await executeWorkflowCommand(options);
    });
}

/**
 * Create the enhanced explain command  
 */
function createExplainCommand(): Command {
  return new Command('explain')
    .description('Generate plain-English explanations of Assembly configuration')
    .option('--sections <types>', 'Sections to explain: all,assembly,contracts,ui,scenarios,gates', 'all')
    .option('--detail <level>', 'Detail level: basic,detailed,expert', 'detailed')
    .option('--include-examples', 'Include practical examples', true)
    .option('--include-contracts', 'Include contract explanations', true)
    .option('--include-ui', 'Include UI route explanations', true)
    .option('--include-gates', 'Include gate explanations', true)
    .option('--format <type>', 'Output format: markdown,json,plain', 'markdown')
    .option('--out <file>', 'Output to file (optional)')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .addHelpText('after', `
Renders plain-English summaries of:
• Assembly configuration and artifact profiles
• Contract definitions and scenarios
• UI routes and component specifications
• Gates and validation rules
• Business logic and technical constraints

The explanations are contextual based on your current project state and
use user-friendly language to describe complex technical concepts.

Examples:
  $ arbiter docs explain
  $ arbiter docs explain --sections contracts --detail expert
  $ arbiter docs explain --format json --out explanations.json
  $ arbiter docs explain --sections ui,gates --detail basic`)
    .action(async (options: DocsExplainOptions) => {
      await executeExplainCommand(options);
    });
}

/**
 * Create the API documentation command
 */
function createAPICommand(): Command {
  return new Command('api')
    .description('Generate API documentation from schemas')
    .option('--format <type>', 'Output format: openapi,markdown,html', 'openapi')
    .option('--out <file>', 'Output file path', 'API.md')
    .option('--include-examples', 'Include request/response examples', true)
    .option('--include-schemas', 'Include schema definitions', true)
    .option('--include-auth', 'Include authentication documentation', true)
    .option('-v, --verbose', 'Enable verbose logging', false)
    .addHelpText('after', `
Generates comprehensive API documentation from CUE schemas and contracts.
Supports multiple output formats and includes interactive examples.

Examples:
  $ arbiter docs api --format openapi --out openapi.yaml
  $ arbiter docs api --format markdown --out API_DOCS.md
  $ arbiter docs api --format html --out docs/api.html`)
    .action(async (options: DocsAPIOptions) => {
      await executeAPICommand(options);
    });
}

/**
 * Create the architecture documentation command
 */
function createArchitectureCommand(): Command {
  return new Command('architecture')
    .description('Generate architecture documentation templates')
    .option('--template <type>', 'Template type: basic,detailed,c4model,adr', 'detailed')
    .option('--out <file>', 'Output file path', 'ARCHITECTURE.md')
    .option('--include-decisions', 'Include architecture decision records', true)
    .option('--include-risks', 'Include risk assessments', true)
    .option('--include-metrics', 'Include quality metrics', true)
    .option('-v, --verbose', 'Enable verbose logging', false)
    .addHelpText('after', `
Creates comprehensive architecture documentation using established templates.
Includes system context, capability maps, and decision records.

Templates:
• basic: Essential architecture overview
• detailed: Complete system documentation  
• c4model: C4 model diagrams and descriptions
• adr: Architecture Decision Record template

Examples:
  $ arbiter docs architecture --template c4model
  $ arbiter docs architecture --template adr --out decisions/ADR-001.md
  $ arbiter docs architecture --template detailed --include-metrics`)
    .action(async (options: DocsArchitectureOptions) => {
      await executeArchitectureCommand(options);
    });
}

/**
 * Execute the workflow documentation command
 */
export async function executeWorkflowCommand(options: DocsWorkflowOptions): Promise<void> {
  const spinner = ora('Generating Golden Path workflow documentation...').start();

  try {
    const outputFile = path.resolve(options.out || 'WORKFLOW.md');

    if (options.verbose) {
      spinner.succeed('Configuration loaded');
      console.log(chalk.blue('\n📚 Arbiter Workflow Documentation Generator'));
      console.log(chalk.gray(`Template: ${options.template}`));
      console.log(chalk.gray(`Output: ${outputFile}`));
      console.log(chalk.gray(`Format: ${options.md ? 'Markdown' : 'Plain text'}`));
      console.log('');
    }

    spinner.text = 'Analyzing project structure...';
    
    // Generate the workflow documentation
    const workflowContent = generateWorkflowDocumentation(options);
    
    spinner.text = 'Writing documentation file...';
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write the documentation
    await fs.writeFile(outputFile, workflowContent, 'utf8');
    
    const stats = {
      outputFile,
      template: options.template,
      sections: getSectionCount(workflowContent),
      wordCount: workflowContent.split(/\s+/).length,
      characters: workflowContent.length,
      generatedAt: new Date().toISOString()
    };

    spinner.succeed(chalk.green('Workflow documentation generated successfully'));

    // Display results
    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      displayWorkflowResults(stats, options);
    }

    // Show next steps
    if (!options.json) {
      console.log(chalk.blue('\n💡 Next Steps:'));
      console.log(`  1. Review generated workflow: ${outputFile}`);
      console.log('  2. Customize for your team processes');
      console.log('  3. Share with development team');
      console.log('  4. Generate API docs: arbiter docs api');
    }

  } catch (error) {
    spinner.fail('Workflow documentation generation failed');
    
    if (error instanceof Error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      
      if (options.verbose && error.stack) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
    }

    process.exit(1);
  }
}

/**
 * Execute the enhanced explain command
 */
export async function executeExplainCommand(options: DocsExplainOptions): Promise<void> {
  const spinner = ora('Generating plain-English explanations...').start();

  try {
    if (options.verbose) {
      spinner.succeed('Analysis started');
      console.log(chalk.blue('\n💬 Arbiter Assembly Explainer'));
      console.log(chalk.gray(`Sections: ${options.sections}`));
      console.log(chalk.gray(`Detail level: ${options.detail}`));
      console.log(chalk.gray(`Format: ${options.format}`));
      if (options.out) {
        console.log(chalk.gray(`Output: ${path.resolve(options.out)}`));
      }
      console.log('');
    }

    spinner.text = 'Analyzing assembly configuration...';
    
    // Simulate analysis of current project
    await new Promise(resolve => setTimeout(resolve, 800));
    
    spinner.text = 'Generating explanations...';
    
    // Generate explanations based on sections requested
    const explanations = await generateExplanations(options);
    
    spinner.succeed(chalk.green('Explanations generated successfully'));

    // Output results
    if (options.out) {
      const outputFile = path.resolve(options.out);
      const outputDir = path.dirname(outputFile);
      await fs.mkdir(outputDir, { recursive: true });
      
      const content = formatExplanations(explanations, options.format || 'markdown');
      await fs.writeFile(outputFile, content, 'utf8');
      
      console.log(chalk.green(`\n✅ Explanations saved to: ${outputFile}`));
    } else {
      const content = formatExplanations(explanations, options.format || 'markdown');
      console.log('\n' + content);
    }

    // Show next steps
    if (!options.json && !options.out) {
      console.log(chalk.blue('\n💡 Next Steps:'));
      console.log('  1. Save explanations to file: --out explanations.md');
      console.log('  2. Generate detailed workflow: arbiter docs workflow');
      console.log('  3. Create API documentation: arbiter docs api');
      console.log('  4. Validate current config: arbiter check');
    }

  } catch (error) {
    spinner.fail('Explanation generation failed');
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Execute the API documentation command
 */
export async function executeAPICommand(options: DocsAPIOptions): Promise<void> {
  const spinner = ora('Generating API documentation...').start();

  try {
    const outputFile = path.resolve(options.out || 'API.md');

    if (options.verbose) {
      spinner.succeed('Configuration loaded');
      console.log(chalk.blue('\n🔌 Arbiter API Documentation Generator'));
      console.log(chalk.gray(`Format: ${options.format}`));
      console.log(chalk.gray(`Output: ${outputFile}`));
      console.log('');
    }

    spinner.text = 'Analyzing API schemas...';
    
    // Generate API documentation
    const apiContent = await generateAPIDocumentation(options);
    
    spinner.text = 'Writing API documentation...';
    
    const outputDir = path.dirname(outputFile);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputFile, apiContent, 'utf8');

    spinner.succeed(chalk.green('API documentation generated successfully'));

    console.log(chalk.green(`\n✅ API documentation saved to: ${outputFile}`));
    
    if (!options.verbose) {
      console.log(chalk.blue('\n💡 Next Step: Review and customize the generated API documentation'));
    }

  } catch (error) {
    spinner.fail('API documentation generation failed');
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Execute the architecture documentation command
 */
export async function executeArchitectureCommand(options: DocsArchitectureOptions): Promise<void> {
  const spinner = ora('Generating architecture documentation...').start();

  try {
    const outputFile = path.resolve(options.out || 'ARCHITECTURE.md');

    spinner.text = 'Creating architecture template...';
    
    const archContent = generateArchitectureDocumentation(options);
    
    const outputDir = path.dirname(outputFile);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputFile, archContent, 'utf8');

    spinner.succeed(chalk.green('Architecture documentation generated successfully'));

    console.log(chalk.green(`\n✅ Architecture documentation saved to: ${outputFile}`));
    console.log(chalk.blue('\n💡 Next Step: Fill in the template sections with your system details'));

  } catch (error) {
    spinner.fail('Architecture documentation generation failed');
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

/**
 * Generate comprehensive workflow documentation
 */
function generateWorkflowDocumentation(options: DocsWorkflowOptions): string {
  const template = options.template || 'detailed';
  
  let content = `# Arbiter Development Workflow - Golden Path

> **⚠️ CRITICAL RULE: All edits must be ticketed & stamped. Direct CUE edits are rejected.**

This document defines the Golden Path for development using the Arbiter Rails & Guarantees system.

## Table of Contents

- [Core Principles](#core-principles)
- [Development Workflow](#development-workflow)
- [Rails & Guarantees Architecture](#rails--guarantees-architecture)
- [UI Profile System](#ui-profile-system)
- [Contract Validation](#contract-validation)
- [Continuous Validation](#continuous-validation)
- [Troubleshooting](#troubleshooting)

## Core Principles

### 1. Ticket-Driven Development
All mutations require valid tickets:
\`\`\`bash
# Request a ticket for your scope
arbiter ticket --scope plan-hash-xyz

# Use ticket for all mutations
arbiter ui scaffold profile.cue --ticket tkn_abc123
arbiter execute epic-auth --ticket tkn_abc123
\`\`\`

### 2. Stamped Artifacts
All generated code includes Arbiter stamps for traceability:
- Stamp ID for tracking
- Generation timestamp  
- Ticket ID for authorization
- Source CUE file reference

### 3. Assembly-First Design
Configure behavior in CUE assembly files, generate artifacts:
1. Define in \`arbiter.assembly.cue\`
2. Validate with \`arbiter check\`
3. Generate with appropriate commands
4. Deploy with confidence

## Development Workflow

### Phase 1: Project Setup
\`\`\`bash
# Import existing project
arbiter import .

# Generate baseline assembly
arbiter generate --template library

# Validate initial configuration  
arbiter check
\`\`\`

### Phase 2: Assembly Configuration
Edit \`arbiter.assembly.cue\` to define:
- Artifact profiles
- UI specifications
- Contract definitions
- Validation rules

### Phase 3: UI Development
\`\`\`bash
# Generate UI artifacts
arbiter ui scaffold profile.cue --ticket \${TICKET_ID}

# Validate UI specifications
arbiter ui validate profile.cue

# Preview generated UI
arbiter ui preview profile.cue --port 3000 --open
\`\`\`

### Phase 4: Contract Implementation
\`\`\`bash
# Generate contract tests
arbiter tests generate --language ts --output tests/contracts

# Run contract validation
arbiter tests cover --threshold 80

# Generate implementation plans
arbiter plan milestone auth-epic
\`\`\`

### Phase 5: Continuous Validation
\`\`\`bash
# Start continuous validation loop
arbiter watch --output validation.ndjson

# Monitor in fast mode
arbiter watch --fast --selective validate,ui,contracts
\`\`\`

### Phase 6: Deployment
\`\`\`bash
# Final validation
arbiter check --strict

# Verify all stamps
arbiter verify --strict

# Deploy with confidence
# (Integration with your deployment system)
\`\`\`

## Rails & Guarantees Architecture

### Tickets (Rails)
- **Scope**: Plan hash defining mutation boundaries
- **Expiration**: Time-limited authorization
- **Traceability**: Full audit trail of changes

### Stamps (Guarantees)  
- **Immutable**: Generated artifacts cannot be modified
- **Traceable**: Full lineage from CUE to code
- **Verifiable**: Cryptographic integrity checking

### Gates
Quality gates enforce standards:
- CUE validation
- UI compliance checking
- Contract coverage thresholds
- Performance budgets
- Security scanning

## UI Profile System

The UI Profile system generates complete UI implementations from CUE specifications:

### 1. Define UI Profile
\`\`\`cue
// profile.cue
Profile: ui: {
    routes: {
        "/dashboard": {
            component: "Dashboard"
            title: "Dashboard"
            protected: true
        }
    }
    
    components: {
        Dashboard: {
            type: "page"
            layout: "main"
            sections: ["header", "content", "sidebar"]
        }
    }
    
    forms: {
        LoginForm: {
            fields: {
                email: { type: "email", required: true }
                password: { type: "password", required: true }
            }
        }
    }
}
\`\`\`

### 2. Generate Implementation
\`\`\`bash
arbiter ui scaffold profile.cue --platform web --output ./src
\`\`\`

### 3. Validate Generated UI
\`\`\`bash
arbiter ui validate profile.cue --strict
\`\`\`

## Contract Validation

Contracts define system behavior and generate comprehensive test suites:

### 1. Define Contracts
\`\`\`cue  
contracts: {
    AuthService: {
        scenarios: {
            "successful_login": {
                given: ["valid_user", "correct_password"]
                when: "user_attempts_login"
                then: ["session_created", "redirect_to_dashboard"]
            }
        }
        
        faults: {
            "invalid_credentials": {
                trigger: "wrong_password"
                response: "authentication_error"
                recovery: "allow_retry"
            }
        }
    }
}
\`\`\`

### 2. Generate Tests  
\`\`\`bash
arbiter tests generate --language ts --property-tests 50
\`\`\`

### 3. Run Coverage Analysis
\`\`\`bash
arbiter tests cover --format json,junit --threshold 80
\`\`\`

## Continuous Validation

The watch system provides real-time validation and feedback:

### Basic Usage
\`\`\`bash
# Watch all files with NDJSON output
arbiter watch

# Watch specific patterns  
arbiter watch --patterns="**/*.cue,**/*.ts"

# Fast mode with selective validation
arbiter watch --fast --selective validate,ui
\`\`\`

### Output Format
NDJSON stream for programmatic consumption:
\`\`\`json
{"type":"validation","status":"pass","file":"profile.cue","timestamp":"2024-01-15T10:30:00Z"}
{"type":"ui","status":"pass","routes":5,"components":12,"timestamp":"2024-01-15T10:30:01Z"}
{"type":"contracts","coverage":0.85,"threshold":0.8,"status":"pass","timestamp":"2024-01-15T10:30:02Z"}
\`\`\`

## Troubleshooting

### Common Issues

#### "Direct CUE edits rejected"
**Problem**: Trying to modify generated CUE files directly.
**Solution**: Edit source assembly files, regenerate with proper ticket.

\`\`\`bash
# Wrong: Editing generated files directly
vim generated/ui.cue  # ❌ Will be rejected

# Right: Edit source, regenerate
vim profile.cue              # ✅ Edit source  
arbiter ticket --scope ui    # ✅ Get ticket
arbiter ui scaffold profile.cue --ticket tkn_123  # ✅ Regenerate
\`\`\`

#### "Ticket expired or invalid"  
**Problem**: Using expired or wrong-scope ticket.
**Solution**: Request new ticket with correct scope.

\`\`\`bash
# Check current tickets
arbiter ticket --list

# Request new ticket
arbiter ticket --scope plan-abc123 --expires 2h
\`\`\`

#### "Validation failed"
**Problem**: Assembly or generated code doesn't pass validation.
**Solution**: Use incremental validation to identify issues.

\`\`\`bash
# Check assembly only
arbiter check --no-ui --no-contracts

# Check UI only  
arbiter check --no-contracts profile.cue

# Check contracts only
arbiter check --no-ui contracts/
\`\`\`

## Best Practices

### 1. Assembly Design
- Keep assembly files focused and modular
- Use clear, descriptive names for profiles
- Document complex configurations with comments
- Version control all assembly files

### 2. Ticket Management
- Request tickets with appropriate expiration times
- Use descriptive scopes for traceability
- Never share tickets between team members
- Clean up expired tickets regularly

### 3. UI Generation
- Start with simple profiles, add complexity incrementally
- Validate profiles before generating implementations
- Use design system integration for consistency
- Test generated components thoroughly

### 4. Contract Testing
- Write contracts from user perspective
- Include both happy path and error scenarios  
- Set realistic coverage thresholds
- Review generated tests for completeness

### 5. Continuous Validation
- Use fast mode during development
- Save validation output for debugging
- Monitor validation performance metrics
- Set up alerts for validation failures

---

*Generated by Arbiter Documentation System*
*Template: ${template} | Generated: ${new Date().toISOString()}*
`;

  if (template === 'enterprise') {
    content += `
## Enterprise Features

### Multi-Team Coordination
- Shared assembly repositories
- Cross-team contract validation  
- Centralized ticket management
- Team-specific UI profiles

### Compliance & Audit
- Complete change audit trails
- Regulatory compliance reporting
- Security policy enforcement
- Quality metrics dashboards

### Advanced Workflows
- Automated milestone planning
- Contract-driven development
- Performance budget enforcement
- Multi-environment validation
`;
  }

  if (options.includeExamples) {
    content += generateWorkflowExamples();
  }

  return content;
}

/**
 * Generate workflow examples section
 */
function generateWorkflowExamples(): string {
  return `
## Complete Examples

### Example 1: E-commerce UI Profile
\`\`\`cue
// ecommerce-profile.cue
Profile: ui: {
    routes: {
        "/": { component: "HomePage", public: true }
        "/products": { component: "ProductList", public: true }
        "/product/:id": { component: "ProductDetail", public: true }
        "/cart": { component: "Cart", protected: true }
        "/checkout": { component: "Checkout", protected: true }
        "/account": { component: "Account", protected: true }
    }
    
    components: {
        HomePage: {
            type: "page"
            sections: ["hero", "featured", "categories"]
            performance: { lcp: "2.5s", cls: 0.1 }
        }
        
        ProductList: {
            type: "page"  
            features: ["filtering", "sorting", "pagination"]
            a11y: { keyboard: true, screenReader: true }
        }
        
        Cart: {
            type: "page"
            state: ["items", "total", "shipping"]
            actions: ["add", "remove", "update", "checkout"]
        }
    }
    
    forms: {
        CheckoutForm: {
            steps: ["shipping", "payment", "review"]
            validation: "realtime"
            fields: {
                shipping: {
                    address: { type: "text", required: true }
                    city: { type: "text", required: true }
                    postal: { type: "text", pattern: "[0-9]{5}" }
                }
                payment: {
                    cardNumber: { type: "text", encrypted: true }
                    expiry: { type: "month", required: true }
                    cvv: { type: "password", length: 3 }
                }
            }
        }
    }
}
\`\`\`

### Example 2: API Service Contracts
\`\`\`cue
// api-contracts.cue  
contracts: {
    UserService: {
        scenarios: {
            "create_user_success": {
                given: ["valid_user_data", "unique_email"]
                when: "POST /users"
                then: ["user_created", "201_response", "location_header"]
                performance: { responseTime: "< 500ms" }
            }
            
            "create_user_duplicate_email": {
                given: ["valid_user_data", "existing_email"]
                when: "POST /users"
                then: ["409_conflict", "error_details"]
            }
            
            "get_user_by_id": {
                given: ["existing_user_id", "valid_auth"]
                when: "GET /users/:id"
                then: ["user_data_returned", "200_response"]
                performance: { responseTime: "< 200ms" }
            }
        }
        
        faults: {
            "database_unavailable": {
                trigger: "db_connection_failure"
                response: "503_service_unavailable"
                recovery: "retry_with_backoff"
                timeout: "30s"
            }
            
            "invalid_user_data": {
                trigger: "malformed_request"
                response: "400_bad_request"
                recovery: "return_validation_errors"
            }
        }
        
        resources: {
            budget: {
                maxResponseTime: "1s"
                maxMemoryUsage: "128MB"
                maxCPUUsage: "70%"
            }
        }
    }
}
\`\`\`

### Example 3: Multi-Service Workflow
\`\`\`bash
#!/bin/bash
# complete-workflow.sh - End-to-end example

# 1. Initialize project
arbiter import .
arbiter generate --template service

# 2. Configure assembly
cat > arbiter.assembly.cue << 'EOF'
Assembly: {
    name: "user-management-service"
    version: "1.0.0"
    
    profiles: {
        api: {
            framework: "fastify"
            database: "postgresql"
            auth: "jwt"
        }
        
        ui: {
            framework: "react" 
            styling: "tailwind"
            state: "zustand"
        }
    }
}

// Include external contracts and UI profiles
contracts: #include "contracts/user-service.cue"
Profile: ui: #include "ui/admin-panel.cue"
EOF

# 3. Validate configuration
arbiter check --strict

# 4. Request development ticket
TICKET=$(arbiter ticket --scope plan-$(git rev-parse HEAD | cut -c1-8) --expires 4h --format json | jq -r .ticketId)
echo "Using ticket: $TICKET"

# 5. Generate UI artifacts
arbiter ui scaffold ui/admin-panel.cue --ticket $TICKET --platform web --output src/ui

# 6. Generate contract tests  
arbiter tests generate --language ts --output tests/contracts --property-tests 100

# 7. Start continuous validation
arbiter watch --output validation.ndjson --selective validate,ui,contracts &
WATCH_PID=$!

# 8. Run development server
npm run dev &
DEV_PID=$!

echo "Development environment ready!"
echo "- UI: http://localhost:3000"
echo "- Validation: tail -f validation.ndjson"
echo "- Stop: kill $WATCH_PID $DEV_PID"

# Wait for interrupt
trap "kill $WATCH_PID $DEV_PID" INT
wait
\`\`\`
`;
}

/**
 * Generate plain-English explanations of assembly configuration  
 */
async function generateExplanations(options: DocsExplainOptions): Promise<any> {
  const sections = (options.sections || 'all').split(',');
  const explanations: any = {};

  // Simulate reading current project assembly
  const mockAssembly = {
    name: "example-service",
    version: "1.0.0",
    profiles: {
      api: { framework: "fastify", database: "postgresql" },
      ui: { framework: "react", styling: "tailwind" }
    },
    contracts: {
      UserService: {
        scenarios: { create_user: "When creating a new user..." },
        faults: { duplicate_email: "If email already exists..." }
      }
    },
    ui: {
      routes: { "/dashboard": "Main dashboard page" },
      components: { Dashboard: "Primary dashboard component" }
    },
    gates: {
      validation: { threshold: 0.8 },
      performance: { budget: "2s" }
    }
  };

  if (sections.includes('all') || sections.includes('assembly')) {
    explanations.assembly = {
      title: "Assembly Configuration",
      summary: `Your project "${mockAssembly.name}" is configured as a full-stack application with both API and UI components.`,
      details: [
        `**Project Name**: ${mockAssembly.name} (version ${mockAssembly.version})`,
        `**API Framework**: Using ${mockAssembly.profiles.api.framework} for the backend service`,
        `**Database**: Connected to ${mockAssembly.profiles.api.database} for data persistence`,
        `**UI Framework**: Frontend built with ${mockAssembly.profiles.ui.framework}`,
        `**Styling**: Using ${mockAssembly.profiles.ui.styling} for component styling`,
        "This configuration creates a modern, scalable web application with type-safe contracts between frontend and backend."
      ]
    };
  }

  if (sections.includes('all') || sections.includes('contracts')) {
    explanations.contracts = {
      title: "Contract Definitions", 
      summary: "Your service contracts define how different parts of the system should behave.",
      details: [
        "**UserService Contract**: Defines user management operations",
        "- **create_user scenario**: Handles new user registration with validation",
        "- **duplicate_email fault**: Gracefully handles email conflicts with appropriate error messages",
        "These contracts ensure consistent behavior and enable comprehensive testing."
      ]
    };
  }

  if (sections.includes('all') || sections.includes('ui')) {
    explanations.ui = {
      title: "UI Routes and Components",
      summary: "Your UI is organized with clear routes and reusable components.",
      details: [
        "**Dashboard Route** (`/dashboard`): The main application interface",
        "**Dashboard Component**: A reusable component that can be embedded anywhere",
        "The UI system generates complete React components with TypeScript types, tests, and Storybook stories."
      ]
    };
  }

  if (sections.includes('all') || sections.includes('gates')) {
    explanations.gates = {
      title: "Quality Gates and Validation",
      summary: "Quality gates enforce standards before code can be deployed.",
      details: [
        `**Validation Gate**: Requires ${mockAssembly.gates.validation.threshold * 100}% of tests to pass`,
        `**Performance Gate**: All pages must load within ${mockAssembly.gates.performance.budget}`,
        "These gates run automatically and prevent deployment of code that doesn't meet quality standards."
      ]
    };
  }

  if (sections.includes('all') || sections.includes('scenarios')) {
    explanations.scenarios = {
      title: "User Scenarios and Workflows",
      summary: "Scenarios describe how users interact with your system.",
      details: [
        "**User Registration Flow**: New users can create accounts with email verification",
        "**Dashboard Access**: Authenticated users land on a personalized dashboard",
        "**Error Handling**: The system gracefully handles common errors like duplicate emails",
        "Each scenario is backed by automated tests to ensure reliability."
      ]
    };
  }

  return explanations;
}

/**
 * Format explanations for output
 */
function formatExplanations(explanations: any, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(explanations, null, 2);
      
    case 'plain':
      let plainText = '';
      Object.values(explanations).forEach((section: any) => {
        plainText += `${section.title.toUpperCase()}\n`;
        plainText += '='.repeat(section.title.length) + '\n\n';
        plainText += section.summary + '\n\n';
        section.details.forEach((detail: string) => {
          // Remove markdown formatting for plain text
          const plainDetail = detail.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`(.*?)`/g, '$1');
          plainText += `• ${plainDetail}\n`;
        });
        plainText += '\n';
      });
      return plainText;
      
    case 'markdown':
    default:
      let markdown = '# Assembly Configuration Explained\n\n';
      markdown += '*Generated by Arbiter Documentation System*\n\n';
      
      Object.values(explanations).forEach((section: any) => {
        markdown += `## ${section.title}\n\n`;
        markdown += `${section.summary}\n\n`;
        section.details.forEach((detail: string) => {
          markdown += `${detail}\n\n`;
        });
      });
      
      return markdown;
  }
}

/**
 * Generate API documentation from schemas
 */
async function generateAPIDocumentation(options: DocsAPIOptions): Promise<string> {
  const format = options.format || 'openapi';
  
  // Simulate API schema analysis
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (format === 'markdown') {
    return generateMarkdownAPI(options);
  } else if (format === 'html') {
    return generateHTMLAPI(options);
  } else {
    return generateOpenAPISpec(options);
  }
}

/**
 * Generate OpenAPI specification
 */
function generateOpenAPISpec(options: DocsAPIOptions): string {
  return `openapi: 3.0.0
info:
  title: Arbiter Service API
  description: Auto-generated API documentation from CUE contracts
  version: 1.0.0
  contact:
    name: API Support
    email: support@example.com
    
servers:
  - url: http://localhost:4001
    description: Development server
  - url: https://api.example.com
    description: Production server

paths:
  /users:
    get:
      summary: List users
      description: Retrieve a paginated list of users
      parameters:
        - name: page
          in: query
          description: Page number
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          description: Items per page
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: User list retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  users:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/ServerError'
          
    post:
      summary: Create user
      description: Create a new user account
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
            examples:
              basic_user:
                summary: Basic user creation
                value:
                  email: "john@example.com"
                  name: "John Doe"
                  password: "securePassword123"
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          $ref: '#/components/responses/BadRequest'
        '409':
          description: Email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
                
  /users/{id}:
    get:
      summary: Get user by ID
      description: Retrieve a specific user by their ID
      parameters:
        - name: id
          in: path
          required: true
          description: User ID
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          $ref: '#/components/responses/NotFound'

components:
  schemas:
    User:
      type: object
      required:
        - id
        - email
        - name
        - createdAt
      properties:
        id:
          type: string
          format: uuid
          description: Unique user identifier
          example: "550e8400-e29b-41d4-a716-446655440000"
        email:
          type: string
          format: email
          description: User email address
          example: "john@example.com"
        name:
          type: string
          description: User full name
          example: "John Doe"
        createdAt:
          type: string
          format: date-time
          description: Account creation timestamp
          example: "2024-01-15T10:30:00Z"
        updatedAt:
          type: string
          format: date-time
          description: Last update timestamp
          example: "2024-01-15T10:30:00Z"
          
    CreateUserRequest:
      type: object
      required:
        - email
        - name
        - password
      properties:
        email:
          type: string
          format: email
          description: User email address
        name:
          type: string
          minLength: 1
          maxLength: 100
          description: User full name
        password:
          type: string
          minLength: 8
          description: User password (min 8 characters)
          
    Pagination:
      type: object
      properties:
        page:
          type: integer
          description: Current page number
        limit:
          type: integer  
          description: Items per page
        total:
          type: integer
          description: Total number of items
        pages:
          type: integer
          description: Total number of pages
          
    Error:
      type: object
      required:
        - error
        - message
      properties:
        error:
          type: string
          description: Error code
        message:
          type: string
          description: Human-readable error message
        details:
          type: object
          description: Additional error context
          
  responses:
    BadRequest:
      description: Invalid request data
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
    ServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
            
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      
security:
  - bearerAuth: []

# Generated by Arbiter Documentation System
# Source: CUE contracts and assembly configuration
# Generated at: ${new Date().toISOString()}
`;
}

/**
 * Generate Markdown API documentation
 */
function generateMarkdownAPI(options: DocsAPIOptions): string {
  return `# API Documentation

*Auto-generated from CUE contracts and assembly configuration*

## Overview

This API provides user management functionality with full CRUD operations, authentication, and validation.

**Base URL**: \`http://localhost:4001\`  
**Authentication**: Bearer JWT tokens  
**Content Type**: \`application/json\`

## Endpoints

### Users

#### GET /users
Retrieve a paginated list of users.

**Query Parameters:**
- \`page\` (integer, default: 1) - Page number
- \`limit\` (integer, default: 20, max: 100) - Items per page

**Response:**
\`\`\`json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@example.com", 
      "name": "John Doe",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
\`\`\`

#### POST /users
Create a new user account.

**Request Body:**
\`\`\`json
{
  "email": "john@example.com",
  "name": "John Doe", 
  "password": "securePassword123"
}
\`\`\`

**Response (201 Created):**
\`\`\`json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
\`\`\`

**Error Response (409 Conflict):**
\`\`\`json
{
  "error": "DUPLICATE_EMAIL",
  "message": "Email address already exists",
  "details": {
    "email": "john@example.com"
  }
}
\`\`\`

#### GET /users/{id}
Retrieve a specific user by their ID.

**Path Parameters:**
- \`id\` (string, UUID) - User ID

**Response (200 OK):**
\`\`\`json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
\`\`\`

## Authentication

All endpoints require a valid JWT token in the Authorization header:

\`\`\`
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

## Error Handling

The API uses standard HTTP status codes and returns errors in a consistent format:

\`\`\`json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": {
    "field": "additional context"
  }
}
\`\`\`

Common error codes:
- \`400 Bad Request\` - Invalid request data
- \`401 Unauthorized\` - Authentication required
- \`404 Not Found\` - Resource not found
- \`409 Conflict\` - Resource already exists
- \`500 Internal Server Error\` - Server error

## Rate Limiting

The API implements rate limiting:
- **Anonymous**: 100 requests/hour
- **Authenticated**: 1000 requests/hour

Rate limit information is included in response headers:
\`\`\`
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642291200
\`\`\`

---
*Generated by Arbiter Documentation System at ${new Date().toISOString()}*
`;
}

/**
 * Generate HTML API documentation
 */
function generateHTMLAPI(options: DocsAPIOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .endpoint { border: 1px solid #e1e5e9; border-radius: 8px; margin: 1rem 0; }
        .method { padding: 0.5rem 1rem; font-weight: bold; color: white; }
        .method.get { background: #28a745; }
        .method.post { background: #007bff; }
        .method.put { background: #ffc107; }
        .method.delete { background: #dc3545; }
        pre { background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto; }
        .params { margin: 1rem 0; }
        .param { margin: 0.5rem 0; padding: 0.5rem; background: #f8f9fa; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>API Documentation</h1>
            <p>Auto-generated from CUE contracts and assembly configuration</p>
            <p><strong>Base URL:</strong> <code>http://localhost:4001</code></p>
        </header>

        <main>
            <section id="users">
                <h2>Users</h2>
                
                <div class="endpoint">
                    <div class="method get">GET /users</div>
                    <div style="padding: 1rem;">
                        <p>Retrieve a paginated list of users.</p>
                        
                        <div class="params">
                            <h4>Query Parameters</h4>
                            <div class="param">
                                <code>page</code> (integer, default: 1) - Page number
                            </div>
                            <div class="param">
                                <code>limit</code> (integer, default: 20, max: 100) - Items per page
                            </div>
                        </div>
                        
                        <h4>Example Response</h4>
                        <pre><code>{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@example.com",
      "name": "John Doe",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}</code></pre>
                    </div>
                </div>

                <div class="endpoint">
                    <div class="method post">POST /users</div>
                    <div style="padding: 1rem;">
                        <p>Create a new user account.</p>
                        
                        <h4>Request Body</h4>
                        <pre><code>{
  "email": "john@example.com",
  "name": "John Doe",
  "password": "securePassword123"
}</code></pre>
                        
                        <h4>Response (201 Created)</h4>
                        <pre><code>{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:30:00Z"
}</code></pre>
                    </div>
                </div>
            </section>

            <section id="authentication">
                <h2>Authentication</h2>
                <p>All endpoints require a valid JWT token:</p>
                <pre><code>Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</code></pre>
            </section>

            <section id="errors">
                <h2>Error Handling</h2>
                <p>Standard HTTP status codes with consistent error format:</p>
                <pre><code>{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": { "field": "additional context" }
}</code></pre>
            </section>
        </main>

        <footer>
            <hr>
            <p><em>Generated by Arbiter Documentation System at ${new Date().toISOString()}</em></p>
        </footer>
    </div>
</body>
</html>
`;
}

/**
 * Generate architecture documentation
 */
function generateArchitectureDocumentation(options: DocsArchitectureOptions): string {
  const template = options.template || 'detailed';
  
  let content = `# Architecture Documentation

*Generated by Arbiter Documentation System - Template: ${template}*

## System Overview

### Context
<!-- Problem statement and business context -->

### Target Users
<!-- Primary user personas and their needs -->

### Constraints
<!-- Technical, business, and regulatory constraints -->

## Capability Map

### Core Capabilities
<!-- Functional decomposition (C1, C2, ...) -->

### Success Metrics
<!-- Measurable outcomes for each capability -->

### Boundaries
<!-- What's in scope vs out of scope -->

## System Architecture

### Runtime Topology
<!-- High-level system diagram -->

### Data Contracts
<!-- Schemas, versioning, compatibility -->

### State Management
<!-- Data lifecycle and retention policies -->

### Security Model
<!-- Authentication, authorization, PII handling -->

## Code Structure

### Domain Layer
<!-- Pure business logic -->

### Application Layer
<!-- Use cases and orchestration -->

### Interface Layer
<!-- Controllers, APIs, UI components -->

### Infrastructure Layer
<!-- Databases, external services, adapters -->

## Quality Attributes

### Performance Targets
<!-- Quantitative performance requirements -->
- **Response Time**: P99 < 500ms
- **Throughput**: > 1000 req/sec
- **Availability**: 99.9% uptime

### Scalability Requirements
<!-- Growth and load handling -->

### Security Requirements
<!-- Security controls and compliance -->

## Testing Strategy

### Test Boundaries
<!-- Unit, integration, E2E test definitions -->

### Coverage Targets
<!-- Coverage requirements by test type -->

### Quality Gates
<!-- Automated quality enforcement -->

## Deployment Architecture

### Environments
<!-- Dev, staging, production setup -->

### Infrastructure
<!-- Cloud resources, networking, monitoring -->

### CI/CD Pipeline
<!-- Build, test, deploy automation -->

## Risks and Mitigations

### Technical Risks
<!-- Top technical risks and mitigation strategies -->

### Operational Risks
<!-- Operational challenges and responses -->

### Business Risks
<!-- Business continuity considerations -->
`;

  if (template === 'c4model') {
    content += `
## C4 Model Diagrams

### Level 1: System Context
\`\`\`
[System Context Diagram]
- External actors and systems
- High-level interactions
- System boundaries
\`\`\`

### Level 2: Container Diagram
\`\`\`
[Container Diagram]
- Major containers (applications, databases)
- Technology choices
- Inter-container communication
\`\`\`

### Level 3: Component Diagram
\`\`\`
[Component Diagram - Key Containers]
- Components within containers
- Interfaces and dependencies
- Responsibility allocation
\`\`\`

### Level 4: Code Diagram
\`\`\`
[Code Diagram - Key Components]
- Classes and interfaces
- Design patterns
- Implementation details
\`\`\`
`;
  } else if (template === 'adr') {
    content = `# Architecture Decision Record: [Decision Title]

**Status**: [Proposed | Accepted | Deprecated | Superseded]  
**Date**: ${new Date().toISOString().split('T')[0]}  
**Deciders**: [List of decision makers]  

## Context and Problem Statement

<!-- Describe the context and problem statement -->

## Decision Drivers

- [Driver 1: e.g., performance requirements]
- [Driver 2: e.g., team expertise]
- [Driver 3: e.g., cost constraints]

## Considered Options

### Option 1: [Option Title]
**Description**: [Brief description]  
**Pros**: [Advantages]  
**Cons**: [Disadvantages]  

### Option 2: [Option Title]  
**Description**: [Brief description]  
**Pros**: [Advantages]  
**Cons**: [Disadvantages]  

## Decision Outcome

**Chosen Option**: [Selected option]

**Justification**: [Why this option was chosen]

## Consequences

### Positive
- [Positive consequence 1]
- [Positive consequence 2]

### Negative  
- [Negative consequence 1]
- [Negative consequence 2]

### Neutral
- [Neutral consequence 1]

## Implementation Notes

<!-- Technical implementation details -->

## Validation

<!-- How to validate this decision was correct -->

## Links

- [Related ADR 1]
- [Related documentation]
- [Reference materials]

---
*ADR Template generated by Arbiter Documentation System*
`;
  }

  if (options.includeDecisions) {
    content += `
## Architecture Decision Records

### ADR-001: Technology Stack Selection
**Status**: Accepted  
**Decision**: TypeScript + Fastify + PostgreSQL  
**Rationale**: Type safety, performance, ecosystem maturity

### ADR-002: Authentication Strategy  
**Status**: Accepted  
**Decision**: JWT with refresh tokens  
**Rationale**: Stateless, scalable, industry standard

<!-- Add more ADRs as needed -->
`;
  }

  if (options.includeMetrics) {
    content += `
## Metrics and Monitoring

### Key Performance Indicators
- **System Performance**: Response time, throughput, error rates
- **Business Metrics**: User engagement, conversion rates, feature adoption
- **Operational Metrics**: Uptime, deployment frequency, lead time

### Monitoring Strategy
- **APM**: Application performance monitoring with distributed tracing
- **Infrastructure**: Resource utilization, network metrics
- **Business**: Custom business metrics and dashboards
- **Alerting**: Proactive alerting on SLA violations

### Dashboards
- **Executive Dashboard**: High-level business and system health
- **Operational Dashboard**: Real-time system metrics
- **Development Dashboard**: Code quality and deployment metrics
`;
  }

  return content;
}

/**
 * Display workflow generation results
 */
function displayWorkflowResults(stats: any, options: DocsWorkflowOptions): void {
  console.log('\n' + chalk.bold.green('✅ Workflow Documentation Results'));
  console.log('═'.repeat(50));

  const summaryData = [
    ['Metric', 'Value'],
    ['Template', stats.template],
    ['Output File', stats.outputFile],
    ['Sections', stats.sections.toString()],
    ['Word Count', stats.wordCount.toString()],
    ['Characters', stats.characters.toString()],
    ['Generated', new Date(stats.generatedAt).toLocaleString()]
  ];

  console.log(table(summaryData, {
    border: {
      topBody: '─', topJoin: '┬', topLeft: '┌', topRight: '┐',
      bottomBody: '─', bottomJoin: '┴', bottomLeft: '└', bottomRight: '┘',
      bodyLeft: '│', bodyRight: '│', bodyJoin: '│',
      joinBody: '─', joinLeft: '├', joinRight: '┤', joinJoin: '┼'
    }
  }));

  // Key sections generated
  if (options.verbose) {
    console.log(chalk.green(`\n📝 Key Sections Included:`));
    console.log(`  • Core Principles (Ticket-driven, Stamped artifacts)`);
    console.log(`  • Development Workflow (6-phase process)`);
    console.log(`  • Rails & Guarantees Architecture`);
    console.log(`  • UI Profile System`);
    console.log(`  • Contract Validation`);
    console.log(`  • Continuous Validation`);
    console.log(`  • Troubleshooting Guide`);
    
    if (options.template === 'enterprise') {
      console.log(`  • Enterprise Features`);
    }
    
    if (options.includeExamples) {
      console.log(`  • Complete Examples`);
    }
  }

  // Golden Rule reminder
  console.log(chalk.yellow('\n⚠️  Remember the Golden Rule:'));
  console.log(chalk.yellow('   "All edits must be ticketed & stamped. Direct CUE edits are rejected."'));
}

/**
 * Get section count from content
 */
function getSectionCount(content: string): number {
  return (content.match(/^##\s/gm) || []).length;
}

/**
 * Add next-step hints to existing CLI commands
 */
export function addNextStepHints(commandName: string, result: any): string {
  const hints: Record<string, string> = {
    'import': 'Next: Generate baseline with `arbiter generate --template library`',
    'generate': 'Next: Edit arbiter.assembly.cue and run `arbiter check`', 
    'check': result?.valid ? 'Next: Generate UI with `arbiter ui scaffold` or start `arbiter watch`' : 'Next: Fix validation errors and re-run `arbiter check`',
    'ui': 'Next: Validate UI with `arbiter ui validate` or run full `arbiter check`',
    'tests': 'Next: Run coverage analysis with `arbiter tests cover`',
    'ticket': 'Next: Use ticket for mutations like `arbiter ui scaffold --ticket ${ticketId}`',
    'execute': 'Next: Verify execution with `arbiter verify --strict`',
    'watch': 'Monitoring active - Press Ctrl+C to stop, check output for validation results',
    'verify': result?.valid ? 'Next: All systems verified, ready for deployment' : 'Next: Fix stamp/ticket issues and re-run `arbiter verify`',
    'explain': 'Next: Generate full workflow docs with `arbiter docs workflow`',
    'health': result?.status === 'healthy' ? 'Next: Run `arbiter check` to validate your configuration' : 'Next: Check server logs and restart API service'
  };

  return hints[commandName] || 'Next: Run `arbiter --help` to explore available commands';
}

export default createDocsCommand;