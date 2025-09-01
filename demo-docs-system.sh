#!/bin/bash

# Arbiter Documentation System Demo
# Demonstrates the comprehensive CLI documentation and workflow system

echo "🚀 Arbiter Documentation System Demo"
echo "====================================="
echo ""

# Test workflow documentation generation
echo "📚 1. Generating Golden Path Workflow Documentation"
echo "Command: arbiter docs workflow --out WORKFLOW_DEMO.md --template detailed"
bun src/cli/index.ts docs workflow --out WORKFLOW_DEMO.md --template detailed
echo ""

# Test explain command with enhanced functionality
echo "💬 2. Testing Enhanced Explain Command"
echo "Command: arbiter explain --sections all --detail detailed"
bun src/cli/index.ts explain --sections all --detail detailed
echo ""

# Test API documentation generation (OpenAPI format)
echo "🔌 3. Generating OpenAPI Specification"
echo "Command: arbiter docs api --format openapi --out API_SPEC.yaml"
bun src/cli/index.ts docs api --format openapi --out API_SPEC.yaml
echo ""

# Test architecture documentation
echo "🏗️  4. Generating Architecture Documentation"  
echo "Command: arbiter docs architecture --template c4model --out ARCHITECTURE.md"
bun src/cli/index.ts docs architecture --template c4model --out ARCHITECTURE.md
echo ""

# Test next-step hints with various commands
echo "💡 5. Testing Next-Step Hints System"
echo ""

echo "5a. Testing health command with next-step hint:"
echo "Command: arbiter health"
bun src/cli/index.ts health
echo ""

echo "5b. Testing ticket command with next-step hint:"
echo "Command: arbiter ticket --scope plan-demo123 --expires 1h"
# This will fail because no server is running, but will show the next-step hint
bun src/cli/index.ts ticket --scope plan-demo123 --expires 1h 2>&1 || true
echo ""

# Show generated files
echo "📄 6. Generated Documentation Files"
echo "=================================="
echo ""

if [ -f "WORKFLOW_DEMO.md" ]; then
    echo "✅ Golden Path Workflow Documentation: WORKFLOW_DEMO.md"
    echo "   Size: $(wc -c < WORKFLOW_DEMO.md) bytes, $(wc -l < WORKFLOW_DEMO.md) lines"
    echo "   Preview:"
    head -5 WORKFLOW_DEMO.md
    echo "   ..."
    echo ""
fi

if [ -f "API_SPEC.yaml" ]; then
    echo "✅ OpenAPI Specification: API_SPEC.yaml" 
    echo "   Size: $(wc -c < API_SPEC.yaml) bytes, $(wc -l < API_SPEC.yaml) lines"
    echo "   Preview:"
    head -5 API_SPEC.yaml
    echo "   ..."
    echo ""
fi

if [ -f "ARCHITECTURE.md" ]; then
    echo "✅ Architecture Documentation: ARCHITECTURE.md"
    echo "   Size: $(wc -c < ARCHITECTURE.md) bytes, $(wc -l < ARCHITECTURE.md) lines"
    echo "   Preview:"
    head -5 ARCHITECTURE.md
    echo "   ..."
    echo ""
fi

# Show comprehensive help
echo "❓ 7. Documentation Commands in Help System"
echo "==========================================="
echo "Command: arbiter --help | grep -A5 -B5 DOCUMENTATION"
bun src/cli/index.ts --help | grep -A5 -B5 "DOCUMENTATION"
echo ""

# Show feature summary
echo "✨ 8. Feature Summary"
echo "===================="
echo ""
echo "✅ IMPLEMENTED FEATURES:"
echo "  📚 Golden Path Workflow Documentation"
echo "     - Rule: 'All edits must be ticketed & stamped. Direct CUE edits are rejected.'"
echo "     - Complete development workflow from planning to deployment"
echo "     - Rails & Guarantees architecture patterns"
echo "     - Multiple templates (basic, detailed, enterprise)"
echo ""
echo "  💬 Enhanced Explain System"
echo "     - Plain-English summaries of Assembly, Artifact, contracts, scenarios, UI routes, gates"
echo "     - Contextual explanations based on current project state"
echo "     - Multiple detail levels (basic, detailed, expert)"
echo "     - Multiple output formats (markdown, json, plain)"
echo ""
echo "  💡 Next-Step Guidance System"
echo "     - Every command prints contextual one-line hints"
echo "     - Based on command results and current project state"  
echo "     - Integrated with existing CLI help system"
echo ""
echo "  📖 Documentation Generation"
echo "     - Auto-generate comprehensive docs from CUE schemas"
echo "     - OpenAPI/Swagger specs for APIs"
echo "     - Architecture documentation templates"
echo "     - Multiple output formats (Markdown, HTML, YAML)"
echo ""
echo "  🎯 CLI Integration"
echo "     - Seamless integration with existing arbiter commands"
echo "     - Consistent command patterns and error handling"
echo "     - Agent mode support for programmatic consumption"
echo "     - Help system integration"
echo ""

echo "🎉 Demo Complete!"
echo ""
echo "Next Steps:"
echo "  1. Review generated files: WORKFLOW_DEMO.md, API_SPEC.yaml, ARCHITECTURE.md"
echo "  2. Try: arbiter docs --help"
echo "  3. Try: arbiter explain --sections contracts --out explanations.md" 
echo "  4. Integrate with your development workflow"
echo ""

# Clean up demo files
echo "🧹 Cleanup (removing demo files)..."
rm -f WORKFLOW_DEMO.md API_SPEC.yaml ARCHITECTURE.md
echo "Demo files cleaned up."
echo ""

echo "For more information:"
echo "  • Run: arbiter docs --help"
echo "  • Run: arbiter --help" 
echo "  • Check the generated workflow documentation for full development guide"