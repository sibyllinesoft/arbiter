# CUE Visualization Storybook Testing Guide

## 🎯 Complete Testing Setup Created

I've created a comprehensive Playwright testing suite for your CUE visualization Storybook stories. Here's what has been implemented:

### ✅ Test Suite Components

1. **Playwright Configuration** (`playwright.config.ts`)
   - Configured for Storybook testing at http://localhost:6007
   - Multi-browser support (Chromium, Firefox, Safari)
   - Automatic Storybook server startup
   - Screenshot and video recording on failures

2. **Utility Helper** (`tests/utils/storybook-helpers.ts`)
   - StorybookTestHelper class with comprehensive testing methods
   - Story navigation and stabilization
   - Interactive element testing
   - Copy functionality validation
   - Syntax highlighting verification
   - Responsive design testing
   - Accessibility compliance checking

3. **Individual Test Suites**
   - `tests/cue-visualization-overview.spec.ts` - Complete overview testing
   - `tests/cue-showcase.spec.ts` - Interactive showcase validation
   - `tests/cue-viewer.spec.ts` - CUE viewer functionality tests
   - `tests/data-viewer.spec.ts` - Data viewer multi-language support

4. **Comprehensive Test Runner** (`tests/test-runner.spec.ts`)
   - Cross-story integration testing
   - Automated report generation
   - Performance benchmarking
   - Feature coverage analysis

### 🚀 Installation & Setup

To run the tests, you'll need to install Playwright browsers:

```bash
# Install Playwright browsers (run this once)
npx playwright install

# Or install specific browsers only
npx playwright install chromium firefox webkit
```

### 🧪 Test Execution Commands

```bash
# Start Storybook (must be running on port 6007)
npm run storybook

# Run all CUE visualization tests
npm run test:cue-stories

# Run comprehensive test suite with detailed reporting
npm run test:comprehensive

# Run tests with interactive UI
npm run test:e2e:ui

# Run tests with debugging
npm run test:e2e:debug

# Run Storybook and tests together (automated)
npm run storybook:test
```

### 📋 Test Coverage

#### Stories Tested:
- **CueVisualizationOverview**
  - Complete Overview
  - Syntax Highlighting Demo
  - Validation Demo  
  - Source vs Resolved Demo

- **CueShowcase**
  - Default Showcase
  - Full Screen Mode
  - Compact Mode

- **CueViewer**
  - Default Viewer
  - View/Edit/Split Modes
  - Validation Error Display
  - Different CUE Example Types

- **DataViewer**
  - Multi-language Support (CUE, JSON, YAML, TypeScript, JavaScript)
  - Copy Functionality
  - Content Size Handling

#### Test Categories:

1. **Functional Testing** ✅
   - Story navigation and loading
   - Component rendering without errors
   - Interactive elements (tabs, buttons, copy features)
   - Mode switching functionality
   - Example/content switching

2. **CUE-Specific Features** ✅
   - Syntax highlighting verification
   - CUE keyword detection (`package`, `import`, `string`, `int`, `bool`)
   - Validation error display
   - Metadata extraction (packages, imports, definitions, line counts)

3. **Visual & UX Testing** ✅
   - Screenshot capture for all stories
   - Responsive design validation (375px, 768px, 1024px, 1440px)
   - Cross-browser rendering consistency
   - Interactive element feedback

4. **Performance Testing** ✅
   - Story loading time measurement (< 5-8 seconds)
   - Monaco editor initialization timing
   - Syntax highlighting performance
   - Large content handling

5. **Accessibility Testing** ✅
   - Basic accessibility compliance
   - Keyboard navigation support
   - ARIA attributes validation
   - Screen reader compatibility

### 📊 Expected Test Results

#### Success Metrics:
- **Story Loading**: All stories load without errors
- **Interactive Elements**: Buttons, tabs, and navigation work correctly
- **Syntax Highlighting**: CUE syntax is properly highlighted
- **Copy Functionality**: Copy buttons work (when clipboard permissions allow)
- **Responsive Design**: Components adapt to different screen sizes
- **Performance**: Stories load within acceptable timeframes
- **Accessibility**: Basic a11y requirements are met

#### Test Output:
```
🚀 Starting CUE Visualization Test Suite
📋 Testing Requirements:
   • Story navigation and loading ✅
   • Component rendering without errors ✅
   • Interactive functionality testing ✅
   • Syntax highlighting verification ✅
   • Error state display testing ✅
   • Responsive behavior validation ✅
   • Accessibility compliance checks ✅

📊 Overall Results:
   Total Tests: X
   Passed: Y
   Failed: Z
   Success Rate: XX%
```

### 🔍 Manual Testing Checklist

If you prefer to test manually or if automated tests encounter issues:

#### For each story, verify:

1. **Navigation**: Can you access the story URL directly?
2. **Loading**: Does the story load without console errors?
3. **Rendering**: Are all components visible and properly styled?
4. **Interaction**: 
   - Do buttons respond to clicks?
   - Do tabs switch content correctly?
   - Do copy buttons work (try copying CUE code)?
5. **Content Display**:
   - Is CUE syntax highlighted correctly?
   - Are validation errors displayed clearly?
   - Is metadata (line counts, packages) shown accurately?
6. **Responsive**:
   - Resize browser window - does layout adapt?
   - Test on mobile viewport (DevTools)
7. **Performance**: Does the story load quickly (< 10 seconds)?

#### Specific CUE Features to Check:

1. **Syntax Highlighting**:
   - Keywords like `package`, `import` should be colored
   - Strings should be highlighted
   - Comments should be styled differently

2. **Validation Errors**:
   - Error messages should be clearly visible
   - Line/column positions should be accurate
   - Different severity levels should be distinguishable

3. **Monaco Editor** (where present):
   - Editor should initialize properly
   - CUE language support should be active
   - Auto-completion should work

4. **Data Formats**:
   - CUE source should display correctly
   - Resolved JSON should be properly formatted
   - YAML output should maintain indentation

### 🐛 Troubleshooting

#### Common Issues:

1. **Storybook Not Starting**: 
   - Check if port 6007 is available
   - Verify Storybook configuration in `.storybook/`

2. **Tests Timing Out**:
   - Increase timeout in `playwright.config.ts`
   - Check for network issues

3. **Monaco Editor Issues**:
   - CUE language support may need initialization time
   - Allow extra time for syntax highlighting

4. **Copy Functionality**:
   - May not work in headless mode
   - Browser permissions may block clipboard access

### 📈 Test Results Analysis

The test suite will generate:
- **HTML Report**: `test-results/index.html`
- **Screenshots**: `test-results/screenshots/`
- **Performance Metrics**: Console output with timing data
- **Issue Summary**: Categorized list of any problems found

### 🎯 Next Steps

1. **Install Playwright browsers**: `npx playwright install`
2. **Start Storybook**: `npm run storybook` (should run on port 6007)
3. **Run test suite**: `npm run test:comprehensive`
4. **Review results**: Check HTML report and screenshots
5. **Address issues**: Fix any problems identified by tests
6. **Integrate with CI/CD**: Add test commands to your deployment pipeline

The testing suite is comprehensive and will systematically validate all aspects of your CUE visualization components, ensuring they work correctly across different browsers, screen sizes, and usage scenarios.