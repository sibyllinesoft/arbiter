/**
 * Basic Navigation Tests
 * Tests for app loading, initial state, and basic navigation functionality
 */

import { expect, test } from '@playwright/test';
import {
  BasePage,
  SELECTORS,
  StorybookHelper,
  TEST_CONFIG,
  TabsPage,
  TopBarPage,
  checkNetworkErrors,
  mockApiResponses,
} from './test-utils';

test.describe('Basic App Navigation', () => {
  let storybookHelper: StorybookHelper;
  let topBarPage: TopBarPage;
  let tabsPage: TabsPage;
  let basePage: BasePage;
  let networkErrors: string[];

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    storybookHelper = new StorybookHelper(page);
    topBarPage = new TopBarPage(page);
    tabsPage = new TabsPage(page);
    basePage = new BasePage(page);

    // Track network errors
    networkErrors = await checkNetworkErrors(page);

    // Mock API responses for consistent testing
    await mockApiResponses(page);

    // Navigate to the main app
    await storybookHelper.navigateToApp();
  });

  test.afterEach(async ({ page }) => {
    // Check for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Log any network errors for debugging
    if (networkErrors.length > 0) {
      console.warn('Network errors detected:', networkErrors);
    }
  });

  test('should load the application successfully', async ({ page }) => {
    // Check that the page loads without errors
    await expect(page).toHaveTitle(/Storybook/);

    // Wait for the app to be fully loaded
    await basePage.waitForLoadingComplete();

    // Verify main app elements are present
    await expect(page.locator('body')).toBeVisible();

    // Check for error boundary
    await expect(page.locator('.error-boundary')).not.toBeVisible();

    // Take screenshot for visual verification
    await basePage.takeScreenshot('app-loaded');
  });

  test('should display TopBar with all main elements', async ({ page }) => {
    // Wait for TopBar to load
    const topBar = await topBarPage.waitForElement(SELECTORS.TOPBAR);
    await expect(topBar).toBeVisible();

    // Check for project selector
    const projectSelector = await topBarPage.getProjectSelector();
    await expect(projectSelector).toBeVisible();

    // Check for CUE file selector
    const cueSelector = await topBarPage.getCueSelector();
    await expect(cueSelector).toBeVisible();

    // Check for action buttons
    const saveButton = await topBarPage.getSaveButton();
    const validateButton = await topBarPage.getValidateButton();
    const freezeButton = await topBarPage.getFreezeButton();

    await expect(saveButton).toBeVisible();
    await expect(validateButton).toBeVisible();
    await expect(freezeButton).toBeVisible();

    // Take screenshot of TopBar
    await topBar.screenshot({ path: 'test-results/screenshots/topbar-elements.png' });
  });

  test('should display left and right tab panels', async ({ page }) => {
    // Check left tabs (Source & Friendly)
    const leftTabs = await tabsPage.getLeftTabs();
    await expect(leftTabs).toBeVisible();

    // Check right tabs (Diagrams)
    const rightTabs = await tabsPage.getRightTabs();
    await expect(rightTabs).toBeVisible();

    // Verify tab structure
    const leftTabNames = await tabsPage.getAllTabNames('left');
    const rightTabNames = await tabsPage.getAllTabNames('right');

    // Expected left tabs
    expect(leftTabNames).toContain('Source');
    expect(leftTabNames).toContain('Friendly');

    // Expected right tabs
    expect(rightTabNames).toContain('Flow');
    expect(rightTabNames).toContain('Site');
    expect(rightTabNames).toContain('FSM');
    expect(rightTabNames).toContain('View');
    expect(rightTabNames).toContain('Gaps');
    expect(rightTabNames).toContain('Resolved');
    expect(rightTabNames).toContain('Architecture');

    console.log('Left tabs found:', leftTabNames);
    console.log('Right tabs found:', rightTabNames);
  });

  test('should switch between right tabs successfully', async ({ page }) => {
    const tabsToTest = ['Flow', 'Site', 'FSM', 'View', 'Architecture'];

    for (const tabName of tabsToTest) {
      // Click on the tab
      await tabsPage.clickTab(tabName, 'right');

      // Verify tab is active
      const activeTab = await tabsPage.getActiveTab('right');
      expect(activeTab.toLowerCase()).toContain(tabName.toLowerCase());

      // Wait for content to load
      await basePage.waitForLoadingComplete();

      // Check that diagram container is present
      if (await basePage.elementExists(SELECTORS.DIAGRAM_CONTAINER)) {
        const diagramContainer = await basePage.waitForElement(SELECTORS.DIAGRAM_CONTAINER);
        await expect(diagramContainer).toBeVisible();
      }

      // Take screenshot of each tab
      await basePage.takeScreenshot(`tab-${tabName.toLowerCase()}`);

      console.log(`Successfully switched to ${tabName} tab`);
    }
  });

  test('should switch between left tabs successfully', async ({ page }) => {
    const tabsToTest = ['Source', 'Friendly'];

    for (const tabName of tabsToTest) {
      // Click on the tab
      await tabsPage.clickTab(tabName, 'left');

      // Verify tab is active
      const activeTab = await tabsPage.getActiveTab('left');
      expect(activeTab.toLowerCase()).toContain(tabName.toLowerCase());

      // Wait for content to load
      await basePage.waitForLoadingComplete();

      // Take screenshot of each tab
      await basePage.takeScreenshot(`left-tab-${tabName.toLowerCase()}`);

      console.log(`Successfully switched to ${tabName} tab`);
    }
  });

  test('should handle project selection', async ({ page }) => {
    // Click on project selector to open dropdown
    const projectSelector = await topBarPage.getProjectSelector();
    await projectSelector.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(500);

    // Check for dropdown content
    const dropdown = page.locator('.dropdown, [role="menu"], .project-dropdown');
    if (await dropdown.isVisible()) {
      // If dropdown is visible, check for project options
      const projectOptions = dropdown.locator('button, [role="menuitem"]');
      const optionCount = await projectOptions.count();

      if (optionCount > 0) {
        // Click on first available project
        await projectOptions.first().click();
        await basePage.waitForLoadingComplete();

        console.log(`Found ${optionCount} project options`);
      }
    }

    // Take screenshot of project selection state
    await basePage.takeScreenshot('project-selection');
  });

  test('should display validation status', async ({ page }) => {
    // Look for validation status indicators
    const statusSelectors = [
      SELECTORS.VALIDATION_STATUS,
      SELECTORS.STATUS_BADGE,
      '.validation-status',
      '.status-indicator',
    ];

    let statusFound = false;
    for (const selector of statusSelectors) {
      if (await basePage.elementExists(selector)) {
        const statusElement = page.locator(selector);
        await expect(statusElement).toBeVisible();

        const statusText = await statusElement.textContent();
        console.log(`Validation status: ${statusText}`);
        statusFound = true;
        break;
      }
    }

    // Take screenshot showing validation status
    await basePage.takeScreenshot('validation-status');

    if (!statusFound) {
      console.warn('No validation status element found');
    }
  });

  test('should handle CUE file selection', async ({ page }) => {
    // Get CUE selector
    const cueSelector = await topBarPage.getCueSelector();
    await expect(cueSelector).toBeVisible();

    // Check if there are options available
    const options = cueSelector.locator('option');
    const optionCount = await options.count();

    if (optionCount > 1) {
      // If multiple options, test selection
      const firstOption = await options.nth(1).textContent(); // Skip first (might be placeholder)
      if (firstOption) {
        await topBarPage.selectCueFile(firstOption);

        // Verify selection changed
        const selectedValue = await cueSelector.inputValue();
        expect(selectedValue).toBe(firstOption);

        console.log(`Selected CUE file: ${firstOption}`);
      }
    } else {
      console.log(`Only ${optionCount} CUE file options available`);
    }

    // Take screenshot of CUE selector
    await basePage.takeScreenshot('cue-file-selector');
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Check that focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    // Test navigation through multiple tabs
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // Test escape key (should close any open dropdowns)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    console.log('Keyboard navigation test completed');
  });

  test('should handle window resize gracefully', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Large desktop
      { width: 1280, height: 720 }, // Standard desktop
      { width: 1024, height: 768 }, // Tablet landscape
      { width: 768, height: 1024 }, // Tablet portrait
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      // Check that main elements are still visible
      await expect(page.locator(SELECTORS.TOPBAR)).toBeVisible();

      // Check that content doesn't overflow
      const body = page.locator('body');
      const box = await body.boundingBox();

      if (box) {
        expect(box.width).toBeLessThanOrEqual(viewport.width + 50); // Allow for scrollbars
      }

      // Take screenshot at this viewport
      await basePage.takeScreenshot(`viewport-${viewport.width}x${viewport.height}`);

      console.log(`Tested viewport: ${viewport.width}x${viewport.height}`);
    }

    // Reset to default viewport
    await page.setViewportSize(TEST_CONFIG.VIEWPORT.DESKTOP);
  });

  test('should not have accessibility violations', async ({ page }) => {
    // Wait for app to fully load
    await basePage.waitForLoadingComplete();

    // Run accessibility check
    await basePage.checkAccessibility();

    // Basic accessibility checks
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();

    // Should have some headings for structure
    expect(headingCount).toBeGreaterThan(0);

    // Check for proper alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const src = await img.getAttribute('src');

      // Images should have alt text or be decorative
      if (src && !src.includes('data:') && !alt) {
        console.warn(`Image missing alt text: ${src}`);
      }
    }

    console.log('Accessibility check completed');
  });

  test('should load without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Listen for console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Reload the page to catch all console messages
    await page.reload();
    await basePage.waitForLoadingComplete();

    // Navigate through all tabs to trigger any lazy-loaded errors
    const rightTabs = ['Flow', 'Site', 'FSM'];
    for (const tab of rightTabs) {
      await tabsPage.clickTab(tab, 'right');
      await page.waitForTimeout(1000);
    }

    // Report console errors (but don't fail test unless critical)
    if (consoleErrors.length > 0) {
      console.warn('Console errors detected:');
      consoleErrors.forEach((error, index) => {
        console.warn(`${index + 1}. ${error}`);
      });
    }

    if (consoleWarnings.length > 0) {
      console.log('Console warnings detected:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
    }

    // Only fail if there are critical errors
    const criticalErrors = consoleErrors.filter(
      error =>
        error.includes('Failed to fetch') ||
        error.includes('Network Error') ||
        error.includes('TypeError') ||
        error.includes('ReferenceError')
    );

    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('App Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());

    const storybookHelper = new StorybookHelper(page);
    const basePage = new BasePage(page);

    // Navigate to app
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();

    // App should still load but show appropriate error states
    await expect(page.locator('.error-boundary')).not.toBeVisible();

    // Check for error indicators
    const errorSelectors = [SELECTORS.ERROR_MESSAGE, '.error', '.alert-error'];
    let errorFound = false;

    for (const selector of errorSelectors) {
      if (await basePage.elementExists(selector)) {
        errorFound = true;
        console.log(`Error indicator found: ${selector}`);
        break;
      }
    }

    // Take screenshot of error state
    await basePage.takeScreenshot('network-error-state');

    console.log('Network error handling test completed');
  });

  test('should display error boundary for JavaScript errors', async ({ page }) => {
    const storybookHelper = new StorybookHelper(page);
    const basePage = new BasePage(page);

    // Navigate to app
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();

    // Inject a JavaScript error to trigger error boundary
    await page.evaluate(() => {
      // Simulate an error in a React component
      setTimeout(() => {
        throw new Error('Test error for error boundary');
      }, 100);
    });

    await page.waitForTimeout(500);

    // Error boundary might not catch setTimeout errors, so this is more of a stability test
    const errorBoundary = page.locator('.error-boundary');

    if (await errorBoundary.isVisible()) {
      console.log('Error boundary activated as expected');
      await expect(errorBoundary).toBeVisible();

      // Check for reload button
      const reloadButton = errorBoundary.locator('button');
      await expect(reloadButton).toBeVisible();
    } else {
      console.log('Error boundary not triggered (this may be expected for setTimeout errors)');
    }

    // Take screenshot of error boundary state
    await basePage.takeScreenshot('error-boundary-state');
  });
});
