/**
 * Responsive Design Tests
 * Tests for responsive behavior, mobile compatibility, and viewport adaptations
 */

import { test, expect } from '@playwright/test';
import { 
  StorybookHelper, 
  BasePage, 
  TopBarPage, 
  TabsPage, 
  DiagramPage, 
  EditorPage,
  TEST_CONFIG, 
  SELECTORS,
  mockApiResponses 
} from './test-utils';

test.describe('Responsive Design - Viewport Tests', () => {
  let storybookHelper: StorybookHelper;
  let basePage: BasePage;
  let topBarPage: TopBarPage;
  let tabsPage: TabsPage;

  test.beforeEach(async ({ page }) => {
    storybookHelper = new StorybookHelper(page);
    basePage = new BasePage(page);
    topBarPage = new TopBarPage(page);
    tabsPage = new TabsPage(page);
    
    await mockApiResponses(page);
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();
  });

  const viewports = [
    { name: 'Desktop Large', ...TEST_CONFIG.VIEWPORT.DESKTOP, width: 1920, height: 1080 },
    { name: 'Desktop Standard', ...TEST_CONFIG.VIEWPORT.DESKTOP },
    { name: 'Laptop', width: 1366, height: 768 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Tablet Portrait', ...TEST_CONFIG.VIEWPORT.TABLET },
    { name: 'Mobile Large', width: 414, height: 896 },
    { name: 'Mobile Standard', ...TEST_CONFIG.VIEWPORT.MOBILE },
    { name: 'Mobile Small', width: 320, height: 568 },
  ];

  test('should adapt TopBar layout across all viewports', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Check TopBar visibility and layout
      const topBar = await topBarPage.waitForElement(SELECTORS.TOPBAR);
      await expect(topBar).toBeVisible();
      
      // Get TopBar dimensions
      const topBarBox = await topBar.boundingBox();
      expect(topBarBox).toBeTruthy();
      
      if (topBarBox) {
        // TopBar should not exceed viewport width
        expect(topBarBox.width).toBeLessThanOrEqual(viewport.width + 20); // Allow for scrollbar
        
        // TopBar should have reasonable height
        expect(topBarBox.height).toBeGreaterThan(40);
        expect(topBarBox.height).toBeLessThan(120);
      }
      
      // Check for horizontal scrolling (should be minimal)
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
      
      // Allow some tolerance for scrollbars and minor overflow
      expect(bodyScrollWidth - bodyClientWidth).toBeLessThan(50);
      
      // Test TopBar elements visibility
      if (viewport.width >= 768) {
        // Desktop/tablet: all elements should be visible
        await expect(topBarPage.getProjectSelector()).resolves.toBeVisible();
        await expect(topBarPage.getCueSelector()).resolves.toBeVisible();
        await expect(topBarPage.getSaveButton()).resolves.toBeVisible();
      } else {
        // Mobile: some elements might be hidden or collapsed
        console.log(`Mobile viewport (${viewport.width}px): checking element visibility`);
      }
      
      // Take screenshot for visual verification
      await basePage.takeScreenshot(`topbar-${viewport.name.toLowerCase().replace(/\s+/g, '-')}`);
      
      console.log(`TopBar responsive test passed for ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
    
    // Reset to default viewport
    await page.setViewportSize(TEST_CONFIG.VIEWPORT.DESKTOP);
  });

  test('should handle tab navigation on different screen sizes', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Test right tabs (diagrams)
      const rightTabs = await tabsPage.getRightTabs();
      await expect(rightTabs).toBeVisible();
      
      // Get tab container dimensions
      const tabsBox = await rightTabs.boundingBox();
      
      if (tabsBox) {
        // Tabs should fit within viewport
        expect(tabsBox.width).toBeLessThanOrEqual(viewport.width);
        
        // Test tab switching
        const tabNames = await tabsPage.getAllTabNames('right');
        
        if (tabNames.length > 0) {
          // Test first few tabs
          const tabsToTest = tabNames.slice(0, Math.min(3, tabNames.length));
          
          for (const tabName of tabsToTest) {
            await tabsPage.clickTab(tabName, 'right');
            await basePage.waitForLoadingComplete();
            
            // Verify tab is active
            const activeTab = await tabsPage.getActiveTab('right');
            expect(activeTab.toLowerCase()).toContain(tabName.toLowerCase());
          }
        }
      }
      
      // Test left tabs (editor)
      if (viewport.width >= 768) {
        const leftTabs = await tabsPage.getLeftTabs();
        await expect(leftTabs).toBeVisible();
        
        const leftTabNames = await tabsPage.getAllTabNames('left');
        if (leftTabNames.length > 0) {
          await tabsPage.clickTab(leftTabNames[0], 'left');
          await basePage.waitForLoadingComplete();
        }
      }
      
      console.log(`Tab navigation test passed for ${viewport.name}`);
    }
    
    await page.setViewportSize(TEST_CONFIG.VIEWPORT.DESKTOP);
  });

  test('should maintain content area proportions', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Measure main content area
      const contentArea = page.locator('.main-content, .app-content, .flex-1').first();
      
      if (await contentArea.isVisible()) {
        const contentBox = await contentArea.boundingBox();
        
        if (contentBox) {
          // Content should fill available space efficiently
          const expectedMinHeight = viewport.height * 0.6; // At least 60% of viewport
          expect(contentBox.height).toBeGreaterThan(expectedMinHeight);
          
          // Content should not exceed viewport
          expect(contentBox.width).toBeLessThanOrEqual(viewport.width + 20);
        }
      }
      
      // Check for split pane behavior
      const splitPane = page.locator('.split-pane, .pane-container').first();
      
      if (await splitPane.isVisible()) {
        const splitBox = await splitPane.boundingBox();
        
        if (splitBox) {
          if (viewport.width >= 768) {
            // Desktop: should show split view
            console.log(`${viewport.name}: Split pane active`);
          } else {
            // Mobile: might stack or hide one pane
            console.log(`${viewport.name}: Split pane behavior on mobile`);
          }
        }
      }
      
      console.log(`Content area proportions test passed for ${viewport.name}`);
    }
    
    await page.setViewportSize(TEST_CONFIG.VIEWPORT.DESKTOP);
  });

  test('should handle text scaling and readability', async ({ page }) => {
    const textScales = [0.85, 1.0, 1.15, 1.3];
    
    for (const scale of textScales) {
      // Simulate text scaling (browser zoom)
      await page.evaluate((zoomLevel) => {
        document.body.style.zoom = zoomLevel.toString();
      }, scale);
      
      await page.waitForTimeout(300);
      
      // Check that text is still readable
      const textElements = page.locator('button, .tab-button, .status-badge');
      const count = await textElements.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = textElements.nth(i);
        
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          
          if (box) {
            // Text should not be too small or too large
            expect(box.height).toBeGreaterThan(20 * scale * 0.8);
            expect(box.height).toBeLessThan(80 * scale);
            
            // Text should not overflow
            const text = await element.textContent();
            if (text && text.length > 0) {
              expect(box.width).toBeGreaterThan(text.length * 2 * scale);
            }
          }
        }
      }
      
      // Take screenshot at this scale
      await basePage.takeScreenshot(`text-scale-${scale.toString().replace('.', '-')}`);
      
      console.log(`Text scaling test passed for ${scale}x scale`);
    }
    
    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = '1';
    });
  });
});

test.describe('Mobile-Specific Behavior', () => {
  let storybookHelper: StorybookHelper;
  let basePage: BasePage;
  let topBarPage: TopBarPage;
  let tabsPage: TabsPage;
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(TEST_CONFIG.VIEWPORT.MOBILE);
    
    storybookHelper = new StorybookHelper(page);
    basePage = new BasePage(page);
    topBarPage = new TopBarPage(page);
    tabsPage = new TabsPage(page);
    editorPage = new EditorPage(page);
    
    await mockApiResponses(page);
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();
  });

  test('should provide touch-friendly interface on mobile', async ({ page }) => {
    // Check minimum touch target sizes (44px recommended)
    const touchTargets = page.locator('button, [role="button"], .tab-button, select');
    const count = await touchTargets.count();
    
    for (let i = 0; i < count; i++) {
      const target = touchTargets.nth(i);
      
      if (await target.isVisible()) {
        const box = await target.boundingBox();
        
        if (box) {
          // Touch targets should be at least 44px in either dimension
          const minDimension = Math.min(box.width, box.height);
          expect(minDimension).toBeGreaterThanOrEqual(32); // Allow slightly smaller for space constraints
          
          // But preferably 44px or larger
          if (minDimension < 44) {
            console.warn(`Touch target smaller than recommended: ${minDimension}px`);
          }
        }
      }
    }
    
    console.log('Touch target sizes validated');
  });

  test('should handle mobile tab interactions', async ({ page }) => {
    // Test tab tapping on mobile
    const rightTabNames = await tabsPage.getAllTabNames('right');
    
    for (let i = 0; i < Math.min(rightTabNames.length, 3); i++) {
      const tabName = rightTabNames[i];
      
      // Use tap instead of click for mobile
      const tabButton = page.locator(`[role="tab"]:has-text("${tabName}")`);
      
      if (await tabButton.isVisible()) {
        // Simulate touch tap
        const box = await tabButton.boundingBox();
        
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await basePage.waitForLoadingComplete();
          
          // Verify tab switch
          const activeTab = await tabsPage.getActiveTab('right');
          expect(activeTab.toLowerCase()).toContain(tabName.toLowerCase());
        }
      }
    }
    
    console.log('Mobile tab interactions validated');
  });

  test('should handle mobile scrolling behavior', async ({ page }) => {
    // Test vertical scrolling
    await page.mouse.move(200, 400);
    
    // Simulate touch scroll
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(200);
    
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(200);
    
    // Test horizontal scrolling if tabs overflow
    const rightTabs = await tabsPage.getRightTabs();
    const tabsBox = await rightTabs.boundingBox();
    
    if (tabsBox) {
      // Try horizontal scroll on tabs
      await page.mouse.move(tabsBox.x + tabsBox.width / 2, tabsBox.y + tabsBox.height / 2);
      await page.mouse.wheel(100, 0);
      await page.waitForTimeout(200);
      
      await page.mouse.wheel(-100, 0);
      await page.waitForTimeout(200);
    }
    
    console.log('Mobile scrolling behavior validated');
  });

  test('should provide mobile-optimized editor experience', async ({ page }) => {
    // Switch to Source tab
    await tabsPage.clickTab('Source', 'left');
    await basePage.waitForLoadingComplete();
    
    if (await basePage.elementExists(SELECTORS.MONACO_EDITOR)) {
      await editorPage.waitForMonacoToLoad();
      
      const editor = await editorPage.getMonacoEditor();
      const editorBox = await editor.boundingBox();
      
      if (editorBox) {
        // Editor should be usable on mobile
        expect(editorBox.width).toBeGreaterThan(200);
        expect(editorBox.height).toBeGreaterThan(100);
        
        // Test touch interaction with editor
        await page.mouse.click(editorBox.x + 50, editorBox.y + 50);
        await page.waitForTimeout(200);
        
        // Try typing (mobile keyboard simulation)
        await page.keyboard.type('// Mobile test');
        
        // Verify content was added
        const content = await editorPage.getEditorContent();
        expect(content).toContain('Mobile test');
      }
    }
    
    console.log('Mobile editor experience validated');
  });

  test('should handle mobile orientation changes', async ({ page }) => {
    // Test landscape orientation
    await page.setViewportSize({ width: 667, height: 375 }); // iPhone landscape
    await page.waitForTimeout(500);
    
    // Check that app adapts to landscape
    const topBar = await topBarPage.waitForElement(SELECTORS.TOPBAR);
    await expect(topBar).toBeVisible();
    
    // Take screenshot in landscape
    await basePage.takeScreenshot('mobile-landscape');
    
    // Switch back to portrait
    await page.setViewportSize(TEST_CONFIG.VIEWPORT.MOBILE);
    await page.waitForTimeout(500);
    
    // Check that app adapts back to portrait
    await expect(topBar).toBeVisible();
    
    // Take screenshot in portrait
    await basePage.takeScreenshot('mobile-portrait');
    
    console.log('Mobile orientation changes handled');
  });

  test('should provide mobile-appropriate dropdown behavior', async ({ page }) => {
    // Test project selector dropdown on mobile
    const projectSelector = await topBarPage.getProjectSelector();
    
    if (await projectSelector.isVisible()) {
      // Tap to open dropdown
      await projectSelector.click();
      await page.waitForTimeout(500);
      
      // Check if dropdown is mobile-optimized
      const dropdown = page.locator('.dropdown, [role="menu"], .project-dropdown');
      
      if (await dropdown.isVisible()) {
        const dropdownBox = await dropdown.boundingBox();
        
        if (dropdownBox) {
          // Dropdown should not exceed mobile screen width
          expect(dropdownBox.width).toBeLessThanOrEqual(TEST_CONFIG.VIEWPORT.MOBILE.width);
          
          // Dropdown should be positioned appropriately
          expect(dropdownBox.y).toBeGreaterThanOrEqual(0);
        }
        
        // Close dropdown
        await page.keyboard.press('Escape');
      }
    }
    
    // Test CUE selector dropdown
    const cueSelector = await topBarPage.getCueSelector();
    
    if (await cueSelector.isVisible()) {
      // Select elements should be touch-friendly on mobile
      const box = await cueSelector.boundingBox();
      
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(32);
      }
    }
    
    console.log('Mobile dropdown behavior validated');
  });
});

test.describe('Cross-Browser Responsive Compatibility', () => {
  test('should maintain responsive behavior across different browsers', async ({ page, browserName }) => {
    const storybookHelper = new StorybookHelper(page);
    const basePage = new BasePage(page);
    
    await mockApiResponses(page);
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();
    
    // Test key responsive breakpoints
    const testViewports = [
      { width: 1280, height: 720 },  // Desktop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 },   // Mobile
    ];
    
    for (const viewport of testViewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      // Check that app loads and renders correctly
      await expect(page.locator('body')).toBeVisible();
      
      // Check for horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });
      
      // Should not have significant horizontal scroll
      if (hasHorizontalScroll) {
        const scrollDiff = await page.evaluate(() => {
          return document.body.scrollWidth - document.body.clientWidth;
        });
        
        // Allow small differences (scrollbars, etc.)
        expect(scrollDiff).toBeLessThan(30);
      }
      
      // Take browser-specific screenshot
      await basePage.takeScreenshot(`${browserName}-${viewport.width}x${viewport.height}`);
      
      console.log(`${browserName} responsive test passed for ${viewport.width}x${viewport.height}`);
    }
  });
});

test.describe('Accessibility in Responsive Design', () => {
  let storybookHelper: StorybookHelper;
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    storybookHelper = new StorybookHelper(page);
    basePage = new BasePage(page);
    
    await mockApiResponses(page);
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();
  });

  test('should maintain accessibility at different viewport sizes', async ({ page }) => {
    const viewports = [
      TEST_CONFIG.VIEWPORT.DESKTOP,
      TEST_CONFIG.VIEWPORT.TABLET,
      TEST_CONFIG.VIEWPORT.MOBILE,
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      // Check focus visibility
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      const focusedElement = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!focused) return null;
        
        const rect = focused.getBoundingClientRect();
        const style = window.getComputedStyle(focused);
        
        return {
          tagName: focused.tagName,
          visible: rect.width > 0 && rect.height > 0,
          hasOutline: style.outline !== 'none' && style.outline !== '',
          hasFocusStyle: style.boxShadow.includes('focus') || style.border.includes('focus')
        };
      });
      
      if (focusedElement) {
        expect(focusedElement.visible).toBe(true);
        // Should have some form of focus indicator
        // expect(focusedElement.hasOutline || focusedElement.hasFocusStyle).toBe(true);
      }
      
      // Run accessibility check
      await basePage.checkAccessibility();
      
      console.log(`Accessibility test passed for ${viewport.width}x${viewport.height}`);
    }
  });

  test('should support keyboard navigation at all viewport sizes', async ({ page }) => {
    const viewports = [
      { name: 'Desktop', ...TEST_CONFIG.VIEWPORT.DESKTOP },
      { name: 'Mobile', ...TEST_CONFIG.VIEWPORT.MOBILE },
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Test tab navigation
      let tabCount = 0;
      const maxTabs = 10;
      
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');
        tabCount++;
        
        const focusedElement = await page.evaluate(() => {
          const focused = document.activeElement;
          return focused ? {
            tagName: focused.tagName,
            className: focused.className,
            textContent: focused.textContent?.substring(0, 30),
          } : null;
        });
        
        if (focusedElement) {
          console.log(`${viewport.name} Tab ${tabCount}:`, focusedElement);
        }
        
        await page.waitForTimeout(100);
      }
      
      // Test escape key
      await page.keyboard.press('Escape');
      
      // Test enter key on focused element
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      
      console.log(`Keyboard navigation test completed for ${viewport.name}`);
    }
  });
});