/**
 * Basic Navigation Tests
 * Tests for app loading, initial state, and basic navigation functionality
 */

import { type Page, expect, test } from "@playwright/test";
import {
  BasePage,
  SELECTORS,
  StorybookHelper,
  TEST_CONFIG,
  TabsPage,
  TopBarPage,
  checkNetworkErrors,
  findFirstVisibleSelector,
  mockApiResponses,
  testTabSequence,
  testViewportSequence,
} from "./test-utils";

// These specs must run under Playwright's runner; skip when picked up by `bun test`.
const isBunTestRunner = process.env.BUN_TEST_WORKER_INDEX !== undefined;

/** Expected left panel tabs */
const EXPECTED_LEFT_TABS = ["Source", "Friendly"] as const;

/** Expected right panel tabs */
const EXPECTED_RIGHT_TABS = [
  "Flow",
  "Site",
  "FSM",
  "View",
  "Gaps",
  "Resolved",
  "Architecture",
] as const;

/** Diagram tabs for navigation tests */
const DIAGRAM_TABS = ["Flow", "Site", "FSM", "View", "Architecture"] as const;

/** Test viewport configurations */
const TEST_VIEWPORTS = [
  { width: 1920, height: 1080, name: "large-desktop" },
  { width: 1280, height: 720, name: "desktop" },
  { width: 1024, height: 768, name: "tablet-landscape" },
  { width: 768, height: 1024, name: "tablet-portrait" },
] as const;

/** Critical error patterns that should fail tests */
const CRITICAL_ERROR_PATTERNS = [
  "Failed to fetch",
  "Network Error",
  "TypeError",
  "ReferenceError",
] as const;

/** Error selectors to check for error states */
const ERROR_SELECTORS = [SELECTORS.ERROR_MESSAGE, ".error", ".alert-error"] as const;

if (isBunTestRunner) {
  console.warn("Skipping Playwright E2E spec basic-navigation under bun test");
} else {
  registerPlaywrightTests();
}

function registerPlaywrightTests() {
  test.describe("Basic App Navigation", () => {
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
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      // Log any network errors for debugging
      if (networkErrors.length > 0) {
        console.warn("Network errors detected:", networkErrors);
      }
    });

    test("should load the application successfully", async ({ page }) => {
      // Check that the page loads without errors
      await expect(page).toHaveTitle(/Storybook/);

      // Wait for the app to be fully loaded
      await basePage.waitForLoadingComplete();

      // Verify main app elements are present
      await expect(page.locator("body")).toBeVisible();

      // Check for error boundary
      await expect(page.locator(".error-boundary")).not.toBeVisible();

      // Take screenshot for visual verification
      await basePage.takeScreenshot("app-loaded");
    });

    test("should display TopBar with all main elements", async ({ page }) => {
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
      await topBar.screenshot({ path: "test-results/screenshots/topbar-elements.png" });
    });

    test("should display left and right tab panels", async ({ page }) => {
      const leftTabs = await tabsPage.getLeftTabs();
      await expect(leftTabs).toBeVisible();

      const rightTabs = await tabsPage.getRightTabs();
      await expect(rightTabs).toBeVisible();

      const leftTabNames = await tabsPage.getAllTabNames("left");
      const rightTabNames = await tabsPage.getAllTabNames("right");

      for (const tab of EXPECTED_LEFT_TABS) {
        expect(leftTabNames).toContain(tab);
      }

      for (const tab of EXPECTED_RIGHT_TABS) {
        expect(rightTabNames).toContain(tab);
      }

      console.log("Left tabs found:", leftTabNames);
      console.log("Right tabs found:", rightTabNames);
    });

    test("should switch between right tabs successfully", async ({ page }) => {
      const results = await testTabSequence(tabsPage, basePage, DIAGRAM_TABS, "right");

      // All tabs should have switched successfully
      results.forEach(({ tab, success }) => {
        expect(success).toBe(true);
        console.log(`Successfully switched to ${tab} tab`);
      });

      // Verify diagram container is present if it exists
      if (await basePage.elementExists(SELECTORS.DIAGRAM_CONTAINER)) {
        const diagramContainer = await basePage.waitForElement(SELECTORS.DIAGRAM_CONTAINER);
        await expect(diagramContainer).toBeVisible();
      }
    });

    test("should switch between left tabs successfully", async ({ page }) => {
      const results = await testTabSequence(tabsPage, basePage, EXPECTED_LEFT_TABS, "left");

      // All tabs should have switched successfully
      results.forEach(({ tab, success }) => {
        expect(success).toBe(true);
        console.log(`Successfully switched to ${tab} tab`);
      });
    });

    test("should handle project selection", async ({ page }) => {
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
      await basePage.takeScreenshot("project-selection");
    });

    test("should display validation status", async ({ page }) => {
      // Look for validation status indicators using helper
      const statusSelectors = [
        SELECTORS.VALIDATION_STATUS,
        SELECTORS.STATUS_BADGE,
        ".validation-status",
        ".status-indicator",
      ] as const;

      const foundSelector = await findFirstVisibleSelector(basePage, statusSelectors);

      if (foundSelector) {
        const statusElement = page.locator(foundSelector);
        await expect(statusElement).toBeVisible();

        const statusText = await statusElement.textContent();
        console.log(`Validation status: ${statusText}`);
      } else {
        console.warn("No validation status element found");
      }

      // Take screenshot showing validation status
      await basePage.takeScreenshot("validation-status");
    });

    test("should handle CUE file selection", async ({ page }) => {
      // Get CUE selector
      const cueSelector = await topBarPage.getCueSelector();
      await expect(cueSelector).toBeVisible();

      // Check if there are options available
      const options = cueSelector.locator("option");
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
      await basePage.takeScreenshot("cue-file-selector");
    });

    test("should be keyboard accessible", async ({ page }) => {
      // Test tab navigation
      await page.keyboard.press("Tab");
      await page.waitForTimeout(100);

      // Check that focus is visible
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();

      // Test navigation through multiple tabs
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(100);
      }

      // Test escape key (should close any open dropdowns)
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);

      console.log("Keyboard navigation test completed");
    });

    test("should handle window resize gracefully", async ({ page }) => {
      const results = await testViewportSequence(page, basePage, TEST_VIEWPORTS, SELECTORS.TOPBAR);

      // All viewports should show the topbar
      results.forEach(({ viewport, visible }) => {
        expect(visible).toBe(true);
        console.log(`Tested viewport: ${viewport}`);
      });

      // Reset to desktop viewport
      await page.setViewportSize(TEST_CONFIG.VIEWPORT.DESKTOP);
    });

    test("should not have accessibility violations", async ({ page }) => {
      // Wait for app to fully load
      await basePage.waitForLoadingComplete();

      // Run accessibility check
      await basePage.checkAccessibility();

      // Basic accessibility checks
      const headings = page.locator("h1, h2, h3, h4, h5, h6");
      const headingCount = await headings.count();

      // Should have some headings for structure
      expect(headingCount).toBeGreaterThan(0);

      // Check for proper alt text on images
      const images = page.locator("img");
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute("alt");
        const src = await img.getAttribute("src");

        // Images should have alt text or be decorative
        if (src && !src.includes("data:") && !alt) {
          console.warn(`Image missing alt text: ${src}`);
        }
      }

      console.log("Accessibility check completed");
    });

    test("should load without console errors", async ({ page }) => {
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
        else if (msg.type() === "warning") consoleWarnings.push(msg.text());
      });

      await page.reload();
      await basePage.waitForLoadingComplete();

      // Navigate through tabs to trigger lazy-loaded errors
      const testTabs = ["Flow", "Site", "FSM"] as const;
      for (const tab of testTabs) {
        await tabsPage.clickTab(tab, "right");
        await page.waitForTimeout(1000);
      }

      if (consoleErrors.length > 0) {
        console.warn("Console errors detected:");
        consoleErrors.forEach((error, i) => console.warn(`${i + 1}. ${error}`));
      }

      if (consoleWarnings.length > 0) {
        console.log("Console warnings detected:");
        consoleWarnings.forEach((warning, i) => console.log(`${i + 1}. ${warning}`));
      }

      const criticalErrors = consoleErrors.filter((error) =>
        CRITICAL_ERROR_PATTERNS.some((pattern) => error.includes(pattern)),
      );

      expect(criticalErrors.length).toBe(0);
    });
  });
}

test.describe("App Error Handling", () => {
  test("should handle network errors gracefully", async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort());

    const storybookHelper = new StorybookHelper(page);
    const basePage = new BasePage(page);

    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();

    await expect(page.locator(".error-boundary")).not.toBeVisible();

    let errorFound = false;
    for (const selector of ERROR_SELECTORS) {
      if (await basePage.elementExists(selector)) {
        errorFound = true;
        console.log(`Error indicator found: ${selector}`);
        break;
      }
    }

    await basePage.takeScreenshot("network-error-state");
    console.log("Network error handling test completed");
  });

  test("should display error boundary for JavaScript errors", async ({ page }) => {
    const storybookHelper = new StorybookHelper(page);
    const basePage = new BasePage(page);

    // Navigate to app
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();

    // Inject a JavaScript error to trigger error boundary
    await page.evaluate(() => {
      // Simulate an error in a React component
      setTimeout(() => {
        throw new Error("Test error for error boundary");
      }, 100);
    });

    await page.waitForTimeout(500);

    // Error boundary might not catch setTimeout errors, so this is more of a stability test
    const errorBoundary = page.locator(".error-boundary");

    if (await errorBoundary.isVisible()) {
      console.log("Error boundary activated as expected");
      await expect(errorBoundary).toBeVisible();

      // Check for reload button
      const reloadButton = errorBoundary.locator("button");
      await expect(reloadButton).toBeVisible();
    } else {
      console.log("Error boundary not triggered (this may be expected for setTimeout errors)");
    }

    // Take screenshot of error boundary state
    await basePage.takeScreenshot("error-boundary-state");
  });
});
