/**
 * Test utilities and common helpers for Playwright tests
 */

import { type Locator, type Page, expect } from '@playwright/test';

// Base URLs and configuration
export const TEST_CONFIG = {
  STORYBOOK_URL: 'http://localhost:6007',
  TIMEOUT: {
    SHORT: 5000,
    MEDIUM: 10000,
    LONG: 30000,
  },
  VIEWPORT: {
    DESKTOP: { width: 1280, height: 720 },
    TABLET: { width: 768, height: 1024 },
    MOBILE: { width: 375, height: 667 },
  },
} as const;

// Common selectors
export const SELECTORS = {
  // TopBar components
  TOPBAR: '[data-testid="topbar"], .top-bar, header',
  PROJECT_SELECTOR: '[data-testid="project-selector"], .project-selector',
  CUE_SELECTOR: '[data-testid="cue-selector"], select',
  SAVE_BUTTON: '[data-testid="save-button"], button:has-text("Save")',
  VALIDATE_BUTTON: '[data-testid="validate-button"], button:has-text("Validate")',
  FREEZE_BUTTON: '[data-testid="freeze-button"], button:has-text("Freeze")',

  // Navigation and tabs
  LEFT_TABS: '[data-testid="left-tabs"], .left-pane .tabs',
  RIGHT_TABS: '[data-testid="right-tabs"], .right-pane .tabs',
  TAB_BUTTON: '[role="tab"], .tab-button',

  // Editor components
  MONACO_EDITOR: '[data-testid="monaco-editor"], .monaco-editor',
  EDITOR_PANE: '[data-testid="editor-pane"], .editor-pane',
  FILE_TREE: '[data-testid="file-tree"], .file-tree',

  // Diagram components
  DIAGRAM_CONTAINER: '[data-testid="diagram-container"], .diagram-container',
  FLOW_DIAGRAM: '[data-testid="flow-diagram"]',
  SITE_DIAGRAM: '[data-testid="site-diagram"]',
  FSM_DIAGRAM: '[data-testid="fsm-diagram"]',
  VIEW_DIAGRAM: '[data-testid="view-diagram"]',
  ARCHITECTURE_DIAGRAM: '[data-testid="architecture-diagram"]',

  // Common UI elements
  LOADING_SPINNER: '[data-testid="loading"], .spinner, .loading',
  ERROR_MESSAGE: '[data-testid="error"], .error, .alert-error',
  SUCCESS_MESSAGE: '[data-testid="success"], .success, .alert-success',
  TOAST: '.Toastify__toast',

  // Status and validation
  VALIDATION_STATUS: '[data-testid="validation-status"]',
  STATUS_BADGE: '[data-testid="status-badge"], .status-badge',
} as const;

// Story navigation helpers
export class StorybookHelper {
  constructor(private page: Page) {}

  /**
   * Navigate to a specific Storybook story
   */
  async navigateToStory(storyPath: string): Promise<void> {
    const url = `${TEST_CONFIG.STORYBOOK_URL}/iframe.html?args=&id=${storyPath}&viewMode=story`;
    await this.page.goto(url, { waitUntil: 'networkidle' });

    // Wait for story to load
    await this.page.waitForTimeout(1000);
  }

  /**
   * Navigate to the main app in Storybook
   */
  async navigateToApp(): Promise<void> {
    await this.navigateToStory('components-app--default');
  }

  /**
   * Navigate to component documentation
   */
  async navigateToComponentDocs(componentName: string): Promise<void> {
    const docsPath = `components-${componentName.toLowerCase()}--docs`;
    const url = `${TEST_CONFIG.STORYBOOK_URL}/?path=/docs/${docsPath}`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }
}

// Page Object Model base class
export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Wait for element to be visible with timeout
   */
  async waitForElement(selector: string, timeout = TEST_CONFIG.TIMEOUT.MEDIUM): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    return element;
  }

  /**
   * Wait for multiple elements to be visible
   */
  async waitForElements(
    selectors: string[],
    timeout = TEST_CONFIG.TIMEOUT.MEDIUM
  ): Promise<Locator[]> {
    const promises = selectors.map(selector => this.waitForElement(selector, timeout));
    return Promise.all(promises);
  }

  /**
   * Check if element exists without throwing
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    // Wait for any loading spinners to disappear
    const loadingSelectors = [SELECTORS.LOADING_SPINNER];

    for (const selector of loadingSelectors) {
      try {
        await this.page.locator(selector).waitFor({ state: 'hidden', timeout: 5000 });
      } catch {
        // Loading spinner might not exist, continue
      }
    }

    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take screenshot with retry logic
   */
  async takeScreenshot(name: string, fullPage = false): Promise<void> {
    try {
      await this.page.screenshot({
        path: `test-results/screenshots/${name}.png`,
        fullPage,
      });
    } catch (error) {
      console.warn(`Failed to take screenshot ${name}:`, error);
    }
  }

  /**
   * Check accessibility with axe-core
   */
  async checkAccessibility(): Promise<void> {
    try {
      // Inject axe-core if not already present
      await this.page.addScriptTag({
        url: 'https://unpkg.com/axe-core@4.7.0/axe.min.js',
      });

      // Run accessibility check
      const results = await this.page.evaluate(() => {
        return new Promise(resolve => {
          // @ts-ignore - axe is loaded from CDN
          axe.run(document, (err: any, results: any) => {
            if (err) throw err;
            resolve(results);
          });
        });
      });

      // Check for violations
      const violations = (results as any).violations;
      if (violations && violations.length > 0) {
        console.warn('Accessibility violations found:', violations);
        // Log but don't fail the test - can be configured based on severity
      }
    } catch (error) {
      console.warn('Accessibility check failed:', error);
    }
  }
}

// Specific page objects
export class TopBarPage extends BasePage {
  async getProjectSelector(): Promise<Locator> {
    return this.waitForElement(SELECTORS.PROJECT_SELECTOR);
  }

  async getCueSelector(): Promise<Locator> {
    return this.waitForElement(SELECTORS.CUE_SELECTOR);
  }

  async getSaveButton(): Promise<Locator> {
    return this.waitForElement(SELECTORS.SAVE_BUTTON);
  }

  async getValidateButton(): Promise<Locator> {
    return this.waitForElement(SELECTORS.VALIDATE_BUTTON);
  }

  async getFreezeButton(): Promise<Locator> {
    return this.waitForElement(SELECTORS.FREEZE_BUTTON);
  }

  async clickSave(): Promise<void> {
    const saveButton = await this.getSaveButton();
    await saveButton.click();
    await this.waitForLoadingComplete();
  }

  async clickValidate(): Promise<void> {
    const validateButton = await this.getValidateButton();
    await validateButton.click();
    await this.waitForLoadingComplete();
  }

  async selectCueFile(fileName: string): Promise<void> {
    const selector = await this.getCueSelector();
    await selector.selectOption(fileName);
    await this.waitForLoadingComplete();
  }

  async getValidationStatus(): Promise<string> {
    const statusElement = this.page.locator(SELECTORS.VALIDATION_STATUS);
    if (await statusElement.isVisible()) {
      return (await statusElement.textContent()) || '';
    }

    // Fallback to status badge
    const badgeElement = this.page.locator(SELECTORS.STATUS_BADGE);
    return (await badgeElement.textContent()) || '';
  }
}

export class EditorPage extends BasePage {
  async getMonacoEditor(): Promise<Locator> {
    return this.waitForElement(SELECTORS.MONACO_EDITOR);
  }

  async getEditorPane(): Promise<Locator> {
    return this.waitForElement(SELECTORS.EDITOR_PANE);
  }

  async waitForMonacoToLoad(): Promise<void> {
    // Wait for Monaco editor to be fully initialized
    await this.page.waitForFunction(
      () => {
        return window.monaco?.editor;
      },
      { timeout: TEST_CONFIG.TIMEOUT.LONG }
    );

    // Wait for editor content to be visible
    await this.waitForElement(SELECTORS.MONACO_EDITOR);
  }

  async getEditorContent(): Promise<string> {
    await this.waitForMonacoToLoad();

    // Try to get content from Monaco editor instance
    const content = await this.page.evaluate(() => {
      const editorElements = document.querySelectorAll('.monaco-editor');
      if (editorElements.length > 0) {
        // Try to get Monaco editor instance
        const editor = (window as any).monaco?.editor?.getEditors?.()?.[0];
        if (editor) {
          return editor.getValue();
        }
      }
      return '';
    });

    return content;
  }

  async setEditorContent(content: string): Promise<void> {
    await this.waitForMonacoToLoad();

    await this.page.evaluate(text => {
      const editor = (window as any).monaco?.editor?.getEditors?.()?.[0];
      if (editor) {
        editor.setValue(text);
        editor.trigger('test', 'editor.action.formatDocument', {});
      }
    }, content);

    await this.page.waitForTimeout(500); // Allow formatting to complete
  }

  async typeInEditor(text: string): Promise<void> {
    const editor = await this.getMonacoEditor();
    await editor.click();
    await this.page.keyboard.type(text);
  }
}

export class DiagramPage extends BasePage {
  async getDiagramContainer(): Promise<Locator> {
    return this.waitForElement(SELECTORS.DIAGRAM_CONTAINER);
  }

  async waitForDiagramToRender(): Promise<void> {
    await this.waitForElement(SELECTORS.DIAGRAM_CONTAINER);

    // Wait for any SVG, Canvas, or diagram-specific content to load
    const diagramContent = this.page.locator(
      `${SELECTORS.DIAGRAM_CONTAINER} svg, ${SELECTORS.DIAGRAM_CONTAINER} canvas, ${SELECTORS.DIAGRAM_CONTAINER} .diagram-content`
    );

    try {
      await diagramContent
        .first()
        .waitFor({ state: 'visible', timeout: TEST_CONFIG.TIMEOUT.MEDIUM });
    } catch {
      // Diagram might not have visual content yet, just wait for container
    }

    await this.waitForLoadingComplete();
  }

  async getDiagramType(): Promise<string> {
    const container = await this.getDiagramContainer();
    const classes = (await container.getAttribute('class')) || '';

    // Try to determine diagram type from class names or data attributes
    if (classes.includes('flow')) return 'flow';
    if (classes.includes('site')) return 'site';
    if (classes.includes('fsm')) return 'fsm';
    if (classes.includes('view')) return 'view';
    if (classes.includes('architecture')) return 'architecture';

    return 'unknown';
  }

  async checkDiagramInteractivity(): Promise<boolean> {
    const container = await this.getDiagramContainer();

    // Check if diagram has interactive elements
    const interactiveElements = container.locator(
      'button, [role="button"], .clickable, .interactive'
    );
    const count = await interactiveElements.count();

    return count > 0;
  }
}

export class TabsPage extends BasePage {
  async getLeftTabs(): Promise<Locator> {
    return this.waitForElement(SELECTORS.LEFT_TABS);
  }

  async getRightTabs(): Promise<Locator> {
    return this.waitForElement(SELECTORS.RIGHT_TABS);
  }

  async clickTab(tabName: string, side: 'left' | 'right' = 'right'): Promise<void> {
    const tabsContainer = side === 'left' ? await this.getLeftTabs() : await this.getRightTabs();
    const tab = tabsContainer.locator(SELECTORS.TAB_BUTTON).filter({ hasText: tabName });

    await tab.click();
    await this.waitForLoadingComplete();
  }

  async getActiveTab(side: 'left' | 'right' = 'right'): Promise<string> {
    const tabsContainer = side === 'left' ? await this.getLeftTabs() : await this.getRightTabs();
    const activeTab = tabsContainer.locator('.active, [aria-selected="true"]');

    return (await activeTab.textContent()) || '';
  }

  async getAllTabNames(side: 'left' | 'right' = 'right'): Promise<string[]> {
    const tabsContainer = side === 'left' ? await this.getLeftTabs() : await this.getRightTabs();
    const tabs = tabsContainer.locator(SELECTORS.TAB_BUTTON);

    const count = await tabs.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const name = await tabs.nth(i).textContent();
      if (name) names.push(name.trim());
    }

    return names;
  }
}

// Utility functions
export async function waitForToast(
  page: Page,
  type: 'success' | 'error' | 'warning' | 'info' = 'success'
): Promise<void> {
  const toastSelector = `${SELECTORS.TOAST}.Toastify__toast--${type}`;
  try {
    await page.locator(toastSelector).waitFor({ state: 'visible', timeout: 5000 });
    // Wait for toast to appear and then disappear
    await page.locator(toastSelector).waitFor({ state: 'hidden', timeout: 10000 });
  } catch {
    // Toast might not appear or might disappear quickly
  }
}

export async function checkNetworkErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('requestfailed', request => {
    errors.push(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  return errors;
}

export async function mockApiResponses(page: Page): Promise<void> {
  // Mock common API endpoints for testing
  await page.route('**/api/projects', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'test-project-1',
          name: 'Test Project 1',
          description: 'A test project for Playwright',
          created_at: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/projects/*/validate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        errors: [],
        warnings: [],
        spec_hash: 'test-hash-123',
      }),
    });
  });

  await page.route('**/api/projects/*/fragments/**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: '// Test CUE content\npackage test\n\ntest: "value"',
          path: 'test.cue',
        }),
      });
    } else {
      await route.fulfill({ status: 200 });
    }
  });
}

// Test data generators
export const TEST_DATA = {
  CUE_CONTENT: `
package example

// Test application specification
app: {
    name: "test-app"
    version: "1.0.0"
    
    services: {
        api: {
            port: 8080
            routes: ["/health", "/api/v1/*"]
        }
        
        web: {
            port: 3000
            static: true
        }
    }
}
`.trim(),

  INVALID_CUE_CONTENT: `
package invalid

// This will cause validation errors
app: {
    name: 123  // Should be string
    services: "invalid"  // Should be object
}
`.trim(),
} as const;
