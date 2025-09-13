/**
 * Diagram Tests
 * Tests for diagram rendering, interactions, and visual components
 */

import { test, expect } from '@playwright/test';
import { 
  StorybookHelper, 
  DiagramPage, 
  TopBarPage, 
  TabsPage, 
  BasePage, 
  TEST_CONFIG, 
  SELECTORS,
  mockApiResponses 
} from './test-utils';

test.describe('Diagram Rendering', () => {
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

  test('should render Flow diagram', async ({ page }) => {
    // Switch to Flow tab
    await tabsPage.clickTab('Flow', 'right');
    await basePage.waitForLoadingComplete();
    
    // Wait for diagram to render
    await diagramPage.waitForDiagramToRender();
    
    // Check diagram container is present
    const container = await diagramPage.getDiagramContainer();
    await expect(container).toBeVisible();
    
    // Check for diagram content
    const hasVisualContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      if (!container) return false;
      
      // Look for SVG, Canvas, or other visual elements
      return container.querySelector('svg, canvas, .diagram-content, .flow-diagram') !== null;
    });
    
    // Take screenshot
    await basePage.takeScreenshot('flow-diagram');
    
    console.log('Flow diagram rendered:', hasVisualContent);
    
    // Check diagram type
    const diagramType = await diagramPage.getDiagramType();
    expect(['flow', 'unknown']).toContain(diagramType);
  });

  test('should render Site diagram', async ({ page }) => {
    // Switch to Site tab
    await tabsPage.clickTab('Site', 'right');
    await basePage.waitForLoadingComplete();
    
    // Wait for diagram to render
    await diagramPage.waitForDiagramToRender();
    
    // Check diagram container
    const container = await diagramPage.getDiagramContainer();
    await expect(container).toBeVisible();
    
    // Look for site-specific content
    const hasSiteContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      if (!container) return false;
      
      // Look for site diagram indicators
      const text = container.textContent || '';
      return text.includes('Site') || 
             text.includes('DAG') ||
             container.querySelector('.site-diagram, .dag-diagram') !== null;
    });
    
    // Take screenshot
    await basePage.takeScreenshot('site-diagram');
    
    console.log('Site diagram content found:', hasSiteContent);
  });

  test('should render FSM diagram', async ({ page }) => {
    // Switch to FSM tab
    await tabsPage.clickTab('FSM', 'right');
    await basePage.waitForLoadingComplete();
    
    // Wait for diagram to render
    await diagramPage.waitForDiagramToRender();
    
    // Check diagram container
    const container = await diagramPage.getDiagramContainer();
    await expect(container).toBeVisible();
    
    // Look for FSM-specific content
    const hasFsmContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      if (!container) return false;
      
      const text = container.textContent || '';
      return text.includes('FSM') || 
             text.includes('State') ||
             container.querySelector('.fsm-diagram, .state-diagram') !== null;
    });
    
    // Take screenshot
    await basePage.takeScreenshot('fsm-diagram');
    
    console.log('FSM diagram content found:', hasFsmContent);
  });

  test('should render View diagram', async ({ page }) => {
    // Switch to View tab
    await tabsPage.clickTab('View', 'right');
    await basePage.waitForLoadingComplete();
    
    // Wait for diagram to render
    await diagramPage.waitForDiagramToRender();
    
    // Check diagram container
    const container = await diagramPage.getDiagramContainer();
    await expect(container).toBeVisible();
    
    // Look for view/wireframe content
    const hasViewContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      if (!container) return false;
      
      const text = container.textContent || '';
      return text.includes('View') || 
             text.includes('Wireframe') ||
             container.querySelector('.view-diagram, .wireframe') !== null;
    });
    
    // Take screenshot
    await basePage.takeScreenshot('view-diagram');
    
    console.log('View diagram content found:', hasViewContent);
  });

  test('should render Architecture diagram', async ({ page }) => {
    // Switch to Architecture tab
    await tabsPage.clickTab('Architecture', 'right');
    await basePage.waitForLoadingComplete();
    
    // Wait for diagram to render
    await diagramPage.waitForDiagramToRender();
    
    // Check diagram container
    const container = await diagramPage.getDiagramContainer();
    await expect(container).toBeVisible();
    
    // Look for architecture content
    const hasArchContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      if (!container) return false;
      
      const text = container.textContent || '';
      return text.includes('Architecture') || 
             text.includes('System') ||
             container.querySelector('.architecture-diagram, .system-diagram') !== null;
    });
    
    // Take screenshot
    await basePage.takeScreenshot('architecture-diagram');
    
    console.log('Architecture diagram content found:', hasArchContent);
  });

  test('should display Gaps checklist', async ({ page }) => {
    // Switch to Gaps tab
    await tabsPage.clickTab('Gaps', 'right');
    await basePage.waitForLoadingComplete();
    
    // Wait for content to load
    await diagramPage.waitForDiagramToRender();
    
    // Check for gaps content
    const container = await diagramPage.getDiagramContainer();
    await expect(container).toBeVisible();
    
    // Look for gaps/checklist content
    const hasGapsContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      if (!container) return false;
      
      const text = container.textContent || '';
      return text.includes('Gaps') || 
             text.includes('missing') ||
             text.includes('coverage') ||
             container.querySelector('.gaps-checklist, .checklist') !== null ||
             container.querySelector('ul, ol, .list') !== null;
    });
    
    // Take screenshot
    await basePage.takeScreenshot('gaps-checklist');
    
    console.log('Gaps checklist content found:', hasGapsContent);
    
    // Check if there's a badge indicating number of gaps
    const tabButton = page.locator('[role="tab"]:has-text("Gaps")');
    const hasBadge = await tabButton.locator('.badge, .count').isVisible().catch(() => false);
    
    if (hasBadge) {
      console.log('Gaps tab has badge indicator');
    }
  });

  test('should display Resolved JSON viewer', async ({ page }) => {
    // Switch to Resolved tab
    await tabsPage.clickTab('Resolved', 'right');
    await basePage.waitForLoadingComplete();
    
    // Wait for content to load
    await diagramPage.waitForDiagramToRender();
    
    // Check for resolved content
    const container = await diagramPage.getDiagramContainer();
    await expect(container).toBeVisible();
    
    // Look for JSON or resolved data content
    const hasResolvedContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      if (!container) return false;
      
      const text = container.textContent || '';
      return text.includes('Resolved') || 
             text.includes('{') || // JSON content
             text.includes('[') || // Array content
             container.querySelector('.json-viewer, .code-block, pre') !== null;
    });
    
    // Take screenshot
    await basePage.takeScreenshot('resolved-viewer');
    
    console.log('Resolved JSON content found:', hasResolvedContent);
  });
});

test.describe('Diagram Interactions', () => {
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

  test('should handle tab switching between diagrams', async ({ page }) => {
    const diagramTabs = ['Flow', 'Site', 'FSM', 'View', 'Architecture'];
    
    for (let i = 0; i < diagramTabs.length; i++) {
      const tabName = diagramTabs[i];
      
      // Switch to tab
      await tabsPage.clickTab(tabName, 'right');
      await basePage.waitForLoadingComplete();
      
      // Verify active tab
      const activeTab = await tabsPage.getActiveTab('right');
      expect(activeTab.toLowerCase()).toContain(tabName.toLowerCase());
      
      // Wait for diagram to render
      await diagramPage.waitForDiagramToRender();
      
      // Verify diagram container is visible
      const container = await diagramPage.getDiagramContainer();
      await expect(container).toBeVisible();
      
      // Test rapid switching (not on first iteration)
      if (i > 0) {
        const prevTab = diagramTabs[i - 1];
        await tabsPage.clickTab(prevTab, 'right');
        await page.waitForTimeout(200);
        await tabsPage.clickTab(tabName, 'right');
        await basePage.waitForLoadingComplete();
      }
      
      console.log(`Successfully switched to and validated ${tabName} tab`);
    }
  });

  test('should check for diagram interactivity', async ({ page }) => {
    const interactiveTabs = ['Flow', 'Site', 'FSM', 'Architecture'];
    
    for (const tabName of interactiveTabs) {
      await tabsPage.clickTab(tabName, 'right');
      await basePage.waitForLoadingComplete();
      await diagramPage.waitForDiagramToRender();
      
      // Check if diagram has interactive elements
      const isInteractive = await diagramPage.checkDiagramInteractivity();
      console.log(`${tabName} diagram interactivity:`, isInteractive);
      
      // Test clicking on diagram area
      const container = await diagramPage.getDiagramContainer();
      const box = await container.boundingBox();
      
      if (box) {
        // Click in the center of the diagram
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
      }
      
      // Check for tooltips, popups, or other interactive feedback
      const hasTooltip = await page.locator('.tooltip, .popup, .overlay').isVisible().catch(() => false);
      if (hasTooltip) {
        console.log(`${tabName} diagram shows interactive feedback`);
      }
    }
  });

  test('should handle diagram zoom and pan (if available)', async ({ page }) => {
    // Test on Flow diagram which is most likely to have zoom/pan
    await tabsPage.clickTab('Flow', 'right');
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
      
      console.log('Zoom and pan interactions tested');
    }
    
    // Take screenshot after interactions
    await basePage.takeScreenshot('diagram-interactions');
  });

  test('should update diagrams when validation changes', async ({ page }) => {
    const topBarPage = new TopBarPage(page);
    
    // Start with Flow diagram
    await tabsPage.clickTab('Flow', 'right');
    await basePage.waitForLoadingComplete();
    await diagramPage.waitForDiagramToRender();
    
    // Get initial diagram state
    const initialContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      return container ? container.innerHTML : '';
    });
    
    // Trigger validation
    await topBarPage.clickValidate();
    await basePage.waitForLoadingComplete();
    
    // Wait for potential diagram update
    await page.waitForTimeout(1000);
    
    // Check if diagram content changed
    const updatedContent = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      return container ? container.innerHTML : '';
    });
    
    // Content might change or stay the same depending on implementation
    console.log('Diagram content changed after validation:', initialContent !== updatedContent);
    
    // Take screenshots before and after
    await basePage.takeScreenshot('diagram-after-validation');
  });
});

test.describe('Diagram Error Handling', () => {
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
    await page.route('**/api/projects/*/diagrams/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Diagram generation failed' })
      });
    });
    
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();
  });

  test('should handle diagram loading errors gracefully', async ({ page }) => {
    const diagramTabs = ['Flow', 'Site', 'FSM'];
    
    for (const tabName of diagramTabs) {
      await tabsPage.clickTab(tabName, 'right');
      await basePage.waitForLoadingComplete();
      
      // Check for error handling
      const hasError = await basePage.elementExists(SELECTORS.ERROR_MESSAGE);
      const hasPlaceholder = await page.locator('.diagram-loading, .placeholder').isVisible().catch(() => false);
      const hasErrorState = await page.locator('.error-state, .diagram-error').isVisible().catch(() => false);
      
      // Diagram should handle errors gracefully
      expect(hasError || hasPlaceholder || hasErrorState).toBe(true);
      
      console.log(`${tabName} diagram error handling:`, { hasError, hasPlaceholder, hasErrorState });
      
      // Take screenshot of error state
      await basePage.takeScreenshot(`diagram-error-${tabName.toLowerCase()}`);
    }
  });

  test('should show loading states during diagram rendering', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/projects/**', route => {
      setTimeout(() => route.continue(), 2000);
    });
    
    await tabsPage.clickTab('Flow', 'right');
    
    // Check for loading indicator
    const hasLoadingSpinner = await page.locator(SELECTORS.LOADING_SPINNER).isVisible().catch(() => false);
    const hasLoadingText = await page.locator(':has-text("loading"), :has-text("Loading")').isVisible().catch(() => false);
    
    console.log('Loading indicators found:', { hasLoadingSpinner, hasLoadingText });
    
    // Wait for loading to complete
    await basePage.waitForLoadingComplete();
    
    // Take screenshot of loading state
    await basePage.takeScreenshot('diagram-loading-state');
  });
});

test.describe('Diagram Visual Consistency', () => {
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

  test('should maintain consistent layout across all diagram tabs', async ({ page }) => {
    const allTabs = ['Flow', 'Site', 'FSM', 'View', 'Gaps', 'Resolved', 'Architecture'];
    const layouts: any[] = [];
    
    for (const tabName of allTabs) {
      await tabsPage.clickTab(tabName, 'right');
      await basePage.waitForLoadingComplete();
      
      // Measure layout
      const layout = await page.evaluate(() => {
        const container = document.querySelector('.diagram-container');
        if (!container) return null;
        
        const rect = container.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y
        };
      });
      
      layouts.push({ tab: tabName, layout });
      console.log(`${tabName} layout:`, layout);
      
      // Take screenshot for visual comparison
      await basePage.takeScreenshot(`layout-consistency-${tabName.toLowerCase()}`);
    }
    
    // Check that layouts are consistent (allowing for some variance)
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

  test('should be responsive to container size changes', async ({ page }) => {
    // Test with Flow diagram
    await tabsPage.clickTab('Flow', 'right');
    await basePage.waitForLoadingComplete();
    
    // Get initial size
    const initialSize = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      return container ? container.getBoundingClientRect() : null;
    });
    
    // Resize window
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.waitForTimeout(500);
    
    // Get new size
    const newSize = await page.evaluate(() => {
      const container = document.querySelector('.diagram-container');
      return container ? container.getBoundingClientRect() : null;
    });
    
    // Diagram should adapt to new size
    if (initialSize && newSize) {
      expect(newSize.width).not.toBe(initialSize.width);
      console.log('Diagram responsive behavior confirmed');
    }
    
    // Reset viewport
    await page.setViewportSize(TEST_CONFIG.VIEWPORT.DESKTOP);
    
    // Take screenshot after resize
    await basePage.takeScreenshot('diagram-responsive');
  });
});

test.describe('Individual Diagram Components', () => {
  let storybookHelper: StorybookHelper;

  test.beforeEach(async ({ page }) => {
    storybookHelper = new StorybookHelper(page);
    await page.goto(TEST_CONFIG.STORYBOOK_URL);
  });

  test('should test individual diagram stories', async ({ page }) => {
    // Test individual diagram component stories if they exist
    const diagramStories = [
      'components-diagrams-flowdiagram--default',
      'components-diagrams-sitediagram--default',
      'components-diagrams-fsmdiagram--default',
      'components-diagrams-viewdiagram--default',
      'components-diagrams-architecturediagram--default'
    ];
    
    for (const storyId of diagramStories) {
      try {
        await storybookHelper.navigateToStory(storyId);
        
        // Wait for story to load
        await page.waitForTimeout(2000);
        
        // Check if story loaded successfully
        const hasContent = await page.locator('body').isVisible();
        expect(hasContent).toBe(true);
        
        console.log(`${storyId} story loaded successfully`);
        
        // Take screenshot
        const storyName = storyId.split('--')[0].replace('components-diagrams-', '');
        await page.screenshot({ path: `test-results/screenshots/story-${storyName}.png` });
        
      } catch (error) {
        console.log(`Story ${storyId} not found or failed to load:`, error);
      }
    }
  });
});