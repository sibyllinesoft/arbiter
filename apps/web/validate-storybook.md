# Storybook Validation Guide

This document provides instructions for validating the updated Storybook stories for the Arbiter system.

## Stories Created/Updated

### 1. CUE Analysis Visualization Stories
**File:** `src/components/diagrams/CueAnalysisShowcase.stories.tsx`

**Stories:**
- `CueSpecAnalysis` - Shows how CUE code is parsed and analyzed
- `CapabilityDiagram` - Interactive capability dependency visualization  
- `OrderStateMachine` - State machine derived from CUE business logic
- `SystemArchitecture` - Network diagram of system architecture
- `InteractiveDemo` - Editable CUE specification demo
- `RealWorldBankingPlatform` - Complex real-world example

**Features Demonstrated:**
- Real CUE code parsing and analysis
- Live diagram generation from CUE specifications
- Multiple diagram types (flow, state machine, network)
- Interactive examples with realistic business scenarios
- Integration with Arbiter's core CUE → visualization pipeline

### 2. Enhanced Diagram Showcase
**File:** `src/components/diagrams/DiagramShowcase.stories.tsx`

**Added Stories:**
- `ArbiterSystemOverview` - Complete system architecture
- `DevelopmentWorkflow` - Live development experience

**Features:**
- Comprehensive system architecture visualization
- Real-time development workflow demonstration
- Integration with existing flow diagram examples

### 3. Complete Design System Showcase  
**File:** `src/design-system/components/DesignSystemShowcase.stories.tsx`

**Stories:**
- `CompleteProjectDashboard` - Full project management interface
- `SpecificationEditorForm` - Complex form with validation and preview
- `ComponentCombinationMatrix` - All components working together

**Features:**
- Complete application interfaces using the design system
- Real-world component combinations and usage patterns
- Complex forms, navigation, data tables, and modals
- Responsive layouts and interactive features

## Validation Steps

### Prerequisites
1. Fix npm cache permissions (if needed):
   ```bash
   sudo chown -R $(id -u):$(id -g) "/media/nathan/Seagate Hub/dev-caches/npm"
   ```

2. Install dependencies:
   ```bash
   cd apps/web
   npm install
   # or
   bun install
   ```

### Running Storybook
```bash
cd apps/web
npm run storybook
# or
bun run storybook
```

### Expected Results

#### 1. Navigation Structure
The Storybook should show this hierarchical organization:

```
📁 Arbiter
  └── 📖 CUE Analysis Visualization
      ├── CUE Spec Analysis
      ├── Capability Diagram  
      ├── Order State Machine
      ├── System Architecture
      ├── Interactive Demo
      └── Real World Banking Platform

📁 Design System
  ├── 📖 Complete Showcase
  │   ├── Complete Project Dashboard
  │   ├── Specification Editor Form
  │   └── Component Combination Matrix
  └── 📖 Overview
      ├── Application Showcase
      ├── Color Palette
      ├── Typography
      └── Component Showcase

📁 Diagrams
  ├── 📖 Complete Diagram Showcase
  │   ├── Diagram Showcase Overview
  │   ├── Technical Architecture Overview
  │   ├── Arbiter System Overview
  │   └── Development Workflow
  └── 📖 Flow Diagrams - Split View
      ├── Build Pipeline Flow
      ├── User Auth Flow
      ├── Microservice Architecture
      ├── Data Processing Pipeline
      └── Testing Workflow
```

#### 2. Key Features to Validate

**CUE Analysis Stories:**
- [ ] CUE code syntax highlighting in code panels
- [ ] Generated analysis JSON in diagram panels
- [ ] Mermaid diagrams render correctly
- [ ] Network diagrams show interactive nodes and edges
- [ ] All stories have comprehensive documentation

**Design System Stories:**
- [ ] Complete project dashboard renders with all components
- [ ] Form components work interactively (inputs, selects, checkboxes)
- [ ] Modals and dialogs can be opened/closed
- [ ] Status badges show different states correctly
- [ ] Responsive layouts work at different screen sizes

**Diagram Stories:**
- [ ] All Mermaid diagrams render without errors
- [ ] Complex system architecture diagram displays
- [ ] Split-view layouts work properly
- [ ] Code and diagram panels scroll independently

#### 3. Component Integration Tests

**Design System Integration:**
- [ ] Buttons work in different contexts (cards, forms, toolbars)
- [ ] Status badges integrate with data tables and cards
- [ ] Input fields work with icons and validation states
- [ ] Navigation components (tabs, breadcrumbs) function correctly
- [ ] Cards display content with proper spacing and borders

**Visualization Integration:**
- [ ] DataViewer components display CUE and YAML code correctly
- [ ] MermaidRenderer handles complex diagrams without errors
- [ ] NetworkDiagram shows interactive nodes and relationships
- [ ] SplitViewShowcase creates proper two-panel layouts

## Troubleshooting

### Common Issues

1. **Permission Errors:**
   - Fix npm cache ownership as shown in prerequisites
   - Use `sudo` with chown command if needed

2. **Missing Dependencies:**
   - Run `npm install` or `bun install` in the web app directory
   - Ensure all design system components are properly exported

3. **Story Rendering Errors:**
   - Check browser console for JavaScript errors
   - Verify all imported components exist and are exported correctly
   - Check that story data is properly formatted

4. **Diagram Rendering Issues:**
   - Mermaid diagrams may take a moment to render
   - Check network connectivity for any external resources
   - Verify Mermaid syntax is valid in the story data

### Success Criteria

✅ **Storybook loads without errors**
✅ **All stories render correctly**  
✅ **Interactive elements respond to user input**
✅ **Documentation tabs show comprehensive information**
✅ **Diagrams display properly and are interactive**
✅ **Design system components work in combination**
✅ **CUE analysis examples demonstrate the core system capabilities**

## Story Documentation Quality

Each story includes:
- Comprehensive descriptions explaining the functionality
- Real-world examples relevant to the Arbiter system
- Interactive controls where appropriate
- Code examples showing CUE specifications and analysis results
- Documentation explaining how the components work together

## Integration with Arbiter System

The stories demonstrate:
- **Core workflow:** CUE specification → analysis → visualization
- **Real-time features:** Live editing and diagram updates
- **System architecture:** Complete technical overview
- **Developer experience:** Tools and workflows for specification management
- **Design consistency:** Professional interface patterns for developer tools

This validation ensures that Storybook effectively showcases both the Arbiter system's capabilities and the design system's comprehensive component library.