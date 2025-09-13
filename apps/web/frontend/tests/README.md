# Playwright Test Suite for Arbiter Frontend

This directory contains a comprehensive Playwright test suite for the Arbiter frontend application, designed to test critical user journeys and ensure the application works correctly across different browsers and viewports.

## Test Structure

### Test Files

1. **`basic-navigation.spec.ts`** - Core application functionality
   - App loading and initialization
   - TopBar component interactions
   - Tab navigation (left and right panels)
   - Project and CUE file selection
   - Validation status display
   - Keyboard accessibility
   - Error handling and network failures

2. **`editor.spec.ts`** - Monaco editor functionality
   - Monaco editor loading and initialization
   - Content editing and syntax highlighting
   - Keyboard shortcuts and find/replace
   - Integration with save and validation systems
   - Performance with large content
   - Cross-tab editor behavior

3. **`diagrams.spec.ts`** - Diagram rendering and interactions
   - All diagram types (Flow, Site, FSM, View, Architecture, Gaps, Resolved)
   - Diagram interactivity and user interactions
   - Error handling for diagram loading failures
   - Visual consistency across diagram types
   - Responsive diagram behavior

4. **`responsive.spec.ts`** - Responsive design and mobile compatibility
   - Cross-viewport layout adaptation
   - Mobile-specific touch interactions
   - Text scaling and readability
   - Touch target sizing
   - Orientation change handling
   - Cross-browser responsive compatibility

### Utility Files

- **`test-utils.ts`** - Common utilities and helpers
  - Page Object Model base classes
  - Storybook navigation helpers
  - Common selectors and configuration
  - Accessibility testing utilities
  - Mock API response functions
  - Test data generators

## Configuration

The tests are configured to run against Storybook (port 6007) as defined in `playwright.config.ts`:

```typescript
use: {
  baseURL: "http://localhost:6007",
  // ... other config
}
```

### Browser Support

Tests run on:
- Chromium (Desktop Chrome)
- Firefox (Desktop Firefox)
- WebKit (Desktop Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Viewport Testing

Multiple viewports are tested:
- Desktop Large: 1920x1080
- Desktop Standard: 1280x720
- Laptop: 1366x768
- Tablet Landscape: 1024x768
- Tablet Portrait: 768x1024
- Mobile Large: 414x896
- Mobile Standard: 375x667
- Mobile Small: 320x568

## Running Tests

### Prerequisites

1. Ensure Storybook is running:
   ```bash
   npm run storybook
   ```

2. Install Playwright browsers (if not already done):
   ```bash
   npx playwright install
   ```

### Running All Tests

```bash
# Run all tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug
```

### Running Specific Test Files

```bash
# Run only basic navigation tests
npx playwright test basic-navigation.spec.ts

# Run only editor tests
npx playwright test editor.spec.ts

# Run only diagram tests
npx playwright test diagrams.spec.ts

# Run only responsive tests
npx playwright test responsive.spec.ts
```

### Running Tests for Specific Browsers

```bash
# Run only on Chromium
npx playwright test --project=chromium

# Run only on mobile browsers
npx playwright test --project="Mobile Chrome" --project="Mobile Safari"
```

## Test Features

### Page Object Model

The test suite uses a Page Object Model pattern for better maintainability:

```typescript
// Example usage
const topBarPage = new TopBarPage(page);
const saveButton = await topBarPage.getSaveButton();
await topBarPage.clickSave();
```

### API Mocking

Tests include comprehensive API mocking to ensure consistent test conditions:

```typescript
// Mock API responses
await mockApiResponses(page);

// This mocks:
// - GET /api/projects
// - POST /api/projects/*/validate
// - GET/PUT /api/projects/*/fragments/**
```

### Accessibility Testing

Tests include accessibility checks using axe-core:

```typescript
// Run accessibility check
await basePage.checkAccessibility();
```

### Visual Testing

Screenshots are automatically captured for:
- Different viewport sizes
- Component states
- Error conditions
- Cross-browser comparison

Screenshots are saved to `test-results/screenshots/`

### Network Monitoring

Tests monitor network requests and responses:
- Failed requests are logged
- HTTP errors (4xx, 5xx) are tracked
- Console errors are captured

## Test Data

Test data is defined in `test-utils.ts`:

```typescript
export const TEST_DATA = {
  CUE_CONTENT: `
    package example
    app: {
      name: "test-app"
      version: "1.0.0"
    }
  `,
  INVALID_CUE_CONTENT: `
    package invalid
    app: {
      name: 123  // Should be string
    }
  `
};
```

## Test Patterns

### Error Handling Tests

Tests verify graceful error handling:
- Network failures
- API errors
- JavaScript exceptions
- Validation errors

### Performance Tests

Tests include performance validations:
- Large content handling in Monaco editor
- Diagram rendering performance
- Page load times
- Memory usage monitoring

### Cross-Browser Testing

All tests run across multiple browsers to ensure compatibility:
- Chrome/Chromium
- Firefox
- Safari/WebKit
- Mobile browsers

## Debugging Tests

### Debug Mode

Run tests in debug mode to step through execution:

```bash
npm run test:e2e:debug
```

### UI Mode

Use Playwright's UI mode for interactive test development:

```bash
npm run test:e2e:ui
```

### Screenshot Debugging

All test failures automatically capture:
- Screenshots of the failed state
- Videos of the test execution
- Network logs
- Console output

### Verbose Logging

Enable verbose logging in tests:

```typescript
console.log('Test checkpoint reached');
console.log('Element state:', await element.textContent());
```

## Continuous Integration

Tests are designed to run in CI environments:

- Retry logic for flaky tests
- Proper wait conditions
- Deterministic test data
- Cross-platform compatibility

### CI Configuration

The tests include CI-specific settings:

```typescript
// In playwright.config.ts
retries: process.env.CI ? 2 : 0,
workers: process.env.CI ? 1 : undefined,
```

## Best Practices

### Writing New Tests

1. **Use Page Objects**: Create reusable page objects for complex interactions
2. **Wait for Stability**: Always wait for loading states to complete
3. **Mock External Dependencies**: Use API mocking for consistent tests
4. **Test Multiple Viewports**: Include responsive testing for new features
5. **Include Error Cases**: Test both happy paths and error conditions

### Test Maintenance

1. **Update Selectors**: Keep selectors in `test-utils.ts` centralized
2. **Review Screenshots**: Check visual regression in screenshots
3. **Monitor Flaky Tests**: Address tests that fail intermittently
4. **Update Test Data**: Keep test data relevant to current CUE schemas

### Performance Guidelines

1. **Minimize Wait Times**: Use specific wait conditions over arbitrary timeouts
2. **Reuse Browser Contexts**: Share contexts where possible
3. **Parallel Execution**: Structure tests to run in parallel safely
4. **Resource Cleanup**: Ensure proper cleanup after tests

## Troubleshooting

### Common Issues

1. **Storybook Not Running**: Ensure `npm run storybook` is running on port 6007
2. **Element Not Found**: Check if selectors are up to date
3. **Timeout Errors**: Increase timeout for slow operations
4. **Network Errors**: Verify API mocking is properly configured

### Debugging Tips

1. **Use `page.pause()`**: Pause test execution for manual inspection
2. **Check Console Logs**: Review browser console for JavaScript errors
3. **Verify API Responses**: Check network tab for API call failures
4. **Screenshot Comparison**: Compare current vs expected screenshots

## Contributing

When adding new tests:

1. Follow the existing Page Object Model pattern
2. Add appropriate selectors to `test-utils.ts`
3. Include both positive and negative test cases
4. Test across multiple viewports
5. Update this README if adding new test categories

## Dependencies

- `@playwright/test`: Core testing framework
- `axe-core`: Accessibility testing (loaded via CDN)
- Test utilities defined in `test-utils.ts`

The test suite integrates with the existing Storybook setup and requires no additional dependencies beyond what's already configured in the project.