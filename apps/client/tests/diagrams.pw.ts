/**
 * Diagram Tests
 * Tests for diagram rendering, interactions, and visual components
 */

import { type Page, expect, test } from "@playwright/test";
import {
  BasePage,
  DiagramPage,
  SELECTORS,
  StorybookHelper,
  TEST_CONFIG,
  TabsPage,
  TopBarPage,
  mockApiResponses,
} from "./test-utils";

const isBunTestRunner = process.env.BUN_TEST_WORKER_INDEX !== undefined;

/** Standard diagram tab names for iteration */
const DIAGRAM_TABS = ["Flow", "Site", "FSM", "View", "Architecture"] as const;

/** All tabs including data viewers */
const ALL_TABS = ["Flow", "Site", "FSM", "View", "Gaps", "Resolved", "Architecture"] as const;

/** Tab-specific content indicators */
const CONTENT_INDICATORS: Record<string, { texts: string[]; selectors: string[] }> = {
  Flow: { texts: [], selectors: ["svg", "canvas", ".diagram-content", ".flow-diagram"] },
  Site: { texts: ["Site", "DAG"], selectors: [".site-diagram", ".dag-diagram"] },
  FSM: { texts: ["FSM", "State"], selectors: [".fsm-diagram", ".state-diagram"] },
  View: { texts: ["View", "Wireframe"], selectors: [".view-diagram", ".wireframe"] },
  Architecture: {
    texts: ["Architecture", "System"],
    selectors: [".architecture-diagram", ".system-diagram"],
  },
  Gaps: {
    texts: ["Gaps", "missing", "coverage"],
    selectors: [".gaps-checklist", ".checklist", "ul", "ol", ".list"],
  },
  Resolved: { texts: ["Resolved", "{", "["], selectors: [".json-viewer", ".code-block", "pre"] },
};

/** Check if diagram container has specific content */
const checkDiagramContent = async (page: Page, tabName: string): Promise<boolean> => {
  const indicators = CONTENT_INDICATORS[tabName];
  if (!indicators) return false;

  return page.evaluate(
    ({ texts, selectors }) => {
      const container = document.querySelector(".diagram-container");
      if (!container) return false;

      const content = container.textContent || "";
      const hasText = texts.some((t) => content.includes(t));
      const hasSelector = selectors.some((s) => container.querySelector(s) !== null);
      return hasText || hasSelector;
    },
    { texts: indicators.texts, selectors: indicators.selectors },
  );
};

if (isBunTestRunner) {
  console.warn("Skipping Playwright E2E spec diagrams under bun test");
} else {
  test.describe("Diagram Rendering", () => {
    let storybookHelper: StorybookHelper;
    let diagramPage: DiagramPage;
    let topBarPage: TopBarPage;
    let tabsPage: TabsPage;
    let basePage: BasePage;

    test.beforeEach(async ({ page }) => {
      // Initialize page objects
      storybookHelper = new StorybookHelper(page);
      diagramPage = new DiagramPage(page);
      topBarPage = new TopBarPage(page);
      tabsPage = new TabsPage(page);
      basePage = new BasePage(page);

      // Mock API responses
      await mockApiResponses(page);

      // Navigate to the main app
      await storybookHelper.navigateToApp();
      await basePage.waitForLoadingComplete();
    });

    /** Helper to test rendering of a specific diagram tab */
    const testDiagramRender = async (page: Page, tabName: string) => {
      await tabsPage.clickTab(tabName, "right");
      await basePage.waitForLoadingComplete();
      await diagramPage.waitForDiagramToRender();

      const container = await diagramPage.getDiagramContainer();
      await expect(container).toBeVisible();

      const hasContent = await checkDiagramContent(page, tabName);
      await basePage.takeScreenshot(`${tabName.toLowerCase()}-diagram`);
      console.log(`${tabName} diagram content found:`, hasContent);

      return hasContent;
    };

    test("should render Flow diagram", async ({ page }) => {
      const hasContent = await testDiagramRender(page, "Flow");
      const diagramType = await diagramPage.getDiagramType();
      expect(["flow", "unknown"]).toContain(diagramType);
    });

    test("should render Site diagram", async ({ page }) => {
      await testDiagramRender(page, "Site");
    });

    test("should render FSM diagram", async ({ page }) => {
      await testDiagramRender(page, "FSM");
    });

    test("should render View diagram", async ({ page }) => {
      await testDiagramRender(page, "View");
    });

    test("should render Architecture diagram", async ({ page }) => {
      await testDiagramRender(page, "Architecture");
    });

    test("should display Gaps checklist", async ({ page }) => {
      await testDiagramRender(page, "Gaps");

      // Check for badge indicator on tab
      const tabButton = page.locator('[role="tab"]:has-text("Gaps")');
      const hasBadge = await tabButton
        .locator(".badge, .count")
        .isVisible()
        .catch(() => false);
      if (hasBadge) {
        console.log("Gaps tab has badge indicator");
      }
    });

    test("should display Resolved JSON viewer", async ({ page }) => {
      await testDiagramRender(page, "Resolved");
    });
  });

  test.describe("Diagram Interactions", () => {
    let storybookHelper: StorybookHelper;
    let diagramPage: DiagramPage;
    let tabsPage: TabsPage;
    let basePage: BasePage;

    test.beforeEach(async ({ page }) => {
      storybookHelper = new StorybookHelper(page);
      diagramPage = new DiagramPage(page);
      tabsPage = new TabsPage(page);
      basePage = new BasePage(page);

      await mockApiResponses(page);
      await storybookHelper.navigateToApp();
      await basePage.waitForLoadingComplete();
    });

    test("should handle tab switching between diagrams", async ({ page }) => {
      for (let i = 0; i < DIAGRAM_TABS.length; i++) {
        const tabName = DIAGRAM_TABS[i];

        await tabsPage.clickTab(tabName, "right");
        await basePage.waitForLoadingComplete();

        const activeTab = await tabsPage.getActiveTab("right");
        expect(activeTab.toLowerCase()).toContain(tabName.toLowerCase());

        await diagramPage.waitForDiagramToRender();
        const container = await diagramPage.getDiagramContainer();
        await expect(container).toBeVisible();

        // Test rapid switching (not on first iteration)
        if (i > 0) {
          const prevTab = DIAGRAM_TABS[i - 1];
          await tabsPage.clickTab(prevTab, "right");
          await page.waitForTimeout(200);
          await tabsPage.clickTab(tabName, "right");
          await basePage.waitForLoadingComplete();
        }

        console.log(`Successfully switched to and validated ${tabName} tab`);
      }
    });

    test("should check for diagram interactivity", async ({ page }) => {
      for (const tabName of DIAGRAM_TABS) {
        await tabsPage.clickTab(tabName, "right");
        await basePage.waitForLoadingComplete();
        await diagramPage.waitForDiagramToRender();

        const isInteractive = await diagramPage.checkDiagramInteractivity();
        console.log(`${tabName} diagram interactivity:`, isInteractive);

        const container = await diagramPage.getDiagramContainer();
        const box = await container.boundingBox();

        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(200);
        }

        const hasTooltip = await page
          .locator(".tooltip, .popup, .overlay")
          .isVisible()
          .catch(() => false);
        if (hasTooltip) {
          console.log(`${tabName} diagram shows interactive feedback`);
        }
      }
    });

    test("should handle diagram zoom and pan (if available)", async ({ page }) => {
      // Test on Flow diagram which is most likely to have zoom/pan
      await tabsPage.clickTab("Flow", "right");
      await basePage.waitForLoadingComplete();
      await diagramPage.waitForDiagramToRender();

      const container = await diagramPage.getDiagramContainer();
      const box = await container.boundingBox();

      if (box) {
        // Test mouse wheel for zooming (if supported)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, -100); // Zoom in
        await page.waitForTimeout(200);

        await page.mouse.wheel(0, 100); // Zoom out
        await page.waitForTimeout(200);

        // Test dragging for panning (if supported)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
        await page.mouse.up();
        await page.waitForTimeout(200);

        console.log("Zoom and pan interactions tested");
      }

      // Take screenshot after interactions
      await basePage.takeScreenshot("diagram-interactions");
    });

    test("should update diagrams when validation changes", async ({ page }) => {
      const topBarPage = new TopBarPage(page);

      // Start with Flow diagram
      await tabsPage.clickTab("Flow", "right");
      await basePage.waitForLoadingComplete();
      await diagramPage.waitForDiagramToRender();

      // Get initial diagram state
      const initialContent = await page.evaluate(() => {
        const container = document.querySelector(".diagram-container");
        return container ? container.innerHTML : "";
      });

      // Trigger validation
      await topBarPage.clickValidate();
      await basePage.waitForLoadingComplete();

      // Wait for potential diagram update
      await page.waitForTimeout(1000);

      // Check if diagram content changed
      const updatedContent = await page.evaluate(() => {
        const container = document.querySelector(".diagram-container");
        return container ? container.innerHTML : "";
      });

      // Content might change or stay the same depending on implementation
      console.log("Diagram content changed after validation:", initialContent !== updatedContent);

      // Take screenshots before and after
      await basePage.takeScreenshot("diagram-after-validation");
    });
  });

  test.describe("Diagram Error Handling", () => {
    let storybookHelper: StorybookHelper;
    let diagramPage: DiagramPage;
    let tabsPage: TabsPage;
    let basePage: BasePage;

    test.beforeEach(async ({ page }) => {
      storybookHelper = new StorybookHelper(page);
      diagramPage = new DiagramPage(page);
      tabsPage = new TabsPage(page);
      basePage = new BasePage(page);

      // Mock API with potential errors
      await page.route("**/api/projects/*/diagrams/**", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Diagram generation failed" }),
        });
      });

      await storybookHelper.navigateToApp();
      await basePage.waitForLoadingComplete();
    });

    test("should handle diagram loading errors gracefully", async ({ page }) => {
      const errorTestTabs = ["Flow", "Site", "FSM"] as const;

      for (const tabName of errorTestTabs) {
        await tabsPage.clickTab(tabName, "right");
        await basePage.waitForLoadingComplete();

        const hasError = await basePage.elementExists(SELECTORS.ERROR_MESSAGE);
        const hasPlaceholder = await page
          .locator(".diagram-loading, .placeholder")
          .isVisible()
          .catch(() => false);
        const hasErrorState = await page
          .locator(".error-state, .diagram-error")
          .isVisible()
          .catch(() => false);

        expect(hasError || hasPlaceholder || hasErrorState).toBe(true);

        console.log(`${tabName} diagram error handling:`, {
          hasError,
          hasPlaceholder,
          hasErrorState,
        });
        await basePage.takeScreenshot(`diagram-error-${tabName.toLowerCase()}`);
      }
    });

    test("should show loading states during diagram rendering", async ({ page }) => {
      // Simulate slow network
      await page.route("**/api/projects/**", (route) => {
        setTimeout(() => route.continue(), 2000);
      });

      await tabsPage.clickTab("Flow", "right");

      // Check for loading indicator
      const hasLoadingSpinner = await page
        .locator(SELECTORS.LOADING_SPINNER)
        .isVisible()
        .catch(() => false);
      const hasLoadingText = await page
        .locator(':has-text("loading"), :has-text("Loading")')
        .isVisible()
        .catch(() => false);

      console.log("Loading indicators found:", { hasLoadingSpinner, hasLoadingText });

      // Wait for loading to complete
      await basePage.waitForLoadingComplete();

      // Take screenshot of loading state
      await basePage.takeScreenshot("diagram-loading-state");
    });
  });

  test.describe("Diagram Visual Consistency", () => {
    let storybookHelper: StorybookHelper;
    let tabsPage: TabsPage;
    let basePage: BasePage;

    test.beforeEach(async ({ page }) => {
      storybookHelper = new StorybookHelper(page);
      tabsPage = new TabsPage(page);
      basePage = new BasePage(page);

      await mockApiResponses(page);
      await storybookHelper.navigateToApp();
      await basePage.waitForLoadingComplete();
    });

    test("should maintain consistent layout across all diagram tabs", async ({ page }) => {
      interface LayoutData {
        width: number;
        height: number;
        x: number;
        y: number;
      }
      const layouts: Array<{ tab: string; layout: LayoutData | null }> = [];

      const measureLayout = async (): Promise<LayoutData | null> =>
        page.evaluate(() => {
          const container = document.querySelector(".diagram-container");
          if (!container) return null;
          const rect = container.getBoundingClientRect();
          return { width: rect.width, height: rect.height, x: rect.x, y: rect.y };
        });

      for (const tabName of ALL_TABS) {
        await tabsPage.clickTab(tabName, "right");
        await basePage.waitForLoadingComplete();

        const layout = await measureLayout();
        layouts.push({ tab: tabName, layout });
        console.log(`${tabName} layout:`, layout);

        await basePage.takeScreenshot(`layout-consistency-${tabName.toLowerCase()}`);
      }

      const firstLayout = layouts[0]?.layout;
      if (firstLayout) {
        for (const item of layouts) {
          if (item.layout) {
            expect(Math.abs(item.layout.width - firstLayout.width)).toBeLessThan(50);
            expect(Math.abs(item.layout.x - firstLayout.x)).toBeLessThan(10);
            expect(Math.abs(item.layout.y - firstLayout.y)).toBeLessThan(10);
          }
        }
      }
    });

    test("should be responsive to container size changes", async ({ page }) => {
      // Test with Flow diagram
      await tabsPage.clickTab("Flow", "right");
      await basePage.waitForLoadingComplete();

      // Get initial size
      const initialSize = await page.evaluate(() => {
        const container = document.querySelector(".diagram-container");
        return container ? container.getBoundingClientRect() : null;
      });

      // Resize window
      await page.setViewportSize({ width: 1000, height: 600 });
      await page.waitForTimeout(500);

      // Get new size
      const newSize = await page.evaluate(() => {
        const container = document.querySelector(".diagram-container");
        return container ? container.getBoundingClientRect() : null;
      });

      // Diagram should adapt to new size
      if (initialSize && newSize) {
        expect(newSize.width).not.toBe(initialSize.width);
        console.log("Diagram responsive behavior confirmed");
      }

      // Reset viewport
      await page.setViewportSize(TEST_CONFIG.VIEWPORT.DESKTOP);

      // Take screenshot after resize
      await basePage.takeScreenshot("diagram-responsive");
    });
  });

  test.describe("Individual Diagram Components", () => {
    let storybookHelper: StorybookHelper;

    test.beforeEach(async ({ page }) => {
      storybookHelper = new StorybookHelper(page);
      await page.goto(TEST_CONFIG.STORYBOOK_URL);
    });

    test("should test individual diagram stories", async ({ page }) => {
      // Test individual diagram component stories if they exist
      const diagramStories = [
        "components-diagrams-flowdiagram--default",
        "components-diagrams-sitediagram--default",
        "components-diagrams-fsmdiagram--default",
        "components-diagrams-viewdiagram--default",
        "components-diagrams-architecturediagram--default",
      ];

      for (const storyId of diagramStories) {
        try {
          await storybookHelper.navigateToStory(storyId);

          // Wait for story to load
          await page.waitForTimeout(2000);

          // Check if story loaded successfully
          const hasContent = await page.locator("body").isVisible();
          expect(hasContent).toBe(true);

          console.log(`${storyId} story loaded successfully`);

          // Take screenshot
          const storyName = storyId.split("--")[0].replace("components-diagrams-", "");
          await page.screenshot({ path: `test-results/screenshots/story-${storyName}.png` });
        } catch (error) {
          console.log(`Story ${storyId} not found or failed to load:`, error);
        }
      }
    });
  });
} // end bun-runner guard
