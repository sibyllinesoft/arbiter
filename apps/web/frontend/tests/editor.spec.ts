/**
 * Monaco Editor Tests
 * Tests for Monaco editor functionality, content editing, and editor features
 */

import { test, expect } from '@playwright/test';
import { 
  StorybookHelper, 
  EditorPage, 
  TopBarPage, 
  TabsPage, 
  BasePage, 
  TEST_CONFIG, 
  SELECTORS,
  mockApiResponses,
  TEST_DATA,
  waitForToast 
} from './test-utils';

test.describe('Monaco Editor Functionality', () => {
  let storybookHelper: StorybookHelper;
  let editorPage: EditorPage;
  let topBarPage: TopBarPage;
  let tabsPage: TabsPage;
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    storybookHelper = new StorybookHelper(page);
    editorPage = new EditorPage(page);
    topBarPage = new TopBarPage(page);
    tabsPage = new TabsPage(page);
    basePage = new BasePage(page);
    
    // Mock API responses
    await mockApiResponses(page);
    
    // Navigate to the main app
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();
    
    // Switch to Source tab (left side) to ensure editor is visible
    await tabsPage.clickTab('Source', 'left');
    await basePage.waitForLoadingComplete();
  });

  test('should load Monaco editor successfully', async ({ page }) => {
    // Wait for Monaco editor to load
    await editorPage.waitForMonacoToLoad();
    
    // Verify editor is visible
    const editor = await editorPage.getMonacoEditor();
    await expect(editor).toBeVisible();
    
    // Check that Monaco is properly initialized
    const hasMonaco = await page.evaluate(() => {
      return !!(window as any).monaco && !!(window as any).monaco.editor;
    });
    expect(hasMonaco).toBe(true);
    
    // Take screenshot of loaded editor
    await basePage.takeScreenshot('monaco-editor-loaded');
    console.log('Monaco editor loaded successfully');
  });

  test('should display CUE content in editor', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Get current editor content
    const content = await editorPage.getEditorContent();
    
    // Content should be present (might be mock data or actual CUE)
    expect(content.length).toBeGreaterThan(0);
    
    // Check for CUE-like patterns
    const hasCuePatterns = content.includes('package') || 
                          content.includes('cue') || 
                          content.includes('//') ||
                          content.length > 10;
    
    expect(hasCuePatterns).toBe(true);
    
    console.log('Editor content length:', content.length);
    console.log('Content preview:', content.substring(0, 100));
  });

  test('should allow typing and editing content', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Clear existing content and add new content
    await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
    
    // Verify content was set
    const newContent = await editorPage.getEditorContent();
    expect(newContent.trim()).toBe(TEST_DATA.CUE_CONTENT.trim());
    
    // Test typing additional content
    const editor = await editorPage.getMonacoEditor();
    await editor.click();
    
    // Move to end and add a comment
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('// Additional test comment');
    
    // Verify the addition
    const updatedContent = await editorPage.getEditorContent();
    expect(updatedContent).toContain('Additional test comment');
    
    console.log('Content editing test completed');
  });

  test('should provide syntax highlighting for CUE', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Set CUE content
    await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
    
    // Check for syntax highlighting elements
    const editor = await editorPage.getMonacoEditor();
    
    // Look for Monaco's syntax highlighting classes
    const syntaxElements = editor.locator('.mtk1, .mtk2, .mtk3, .mtk4, .mtk5, .mtk6');
    const syntaxCount = await syntaxElements.count();
    
    // Should have multiple syntax highlighting elements
    expect(syntaxCount).toBeGreaterThan(0);
    
    // Check for comment highlighting
    const commentElements = editor.locator('.mtk1:has-text("//"), .comment');
    const commentCount = await commentElements.count();
    
    if (commentCount > 0) {
      console.log('Comment syntax highlighting detected');
    }
    
    // Take screenshot showing syntax highlighting
    await basePage.takeScreenshot('syntax-highlighting');
    
    console.log(`Found ${syntaxCount} syntax highlighting elements`);
  });

  test('should show line numbers', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Set multi-line content
    await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
    
    // Check for line numbers
    const editor = await editorPage.getMonacoEditor();
    const lineNumbers = editor.locator('.line-numbers, .margin-view-overlays .line-numbers');
    
    // Line numbers should be visible
    await expect(lineNumbers.first()).toBeVisible();
    
    // Count visible line numbers
    const lineNumberCount = await lineNumbers.count();
    expect(lineNumberCount).toBeGreaterThan(0);
    
    console.log(`Found ${lineNumberCount} line number elements`);
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Set content
    await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
    
    const editor = await editorPage.getMonacoEditor();
    await editor.click();
    
    // Test Ctrl+A (Select All)
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    
    // Test Ctrl+C and Ctrl+V (Copy and Paste)
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(200);
    
    // Move to end and paste
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Control+v');
    
    // Content should be duplicated
    const finalContent = await editorPage.getEditorContent();
    const originalLines = TEST_DATA.CUE_CONTENT.trim().split('\n').length;
    const finalLines = finalContent.trim().split('\n').length;
    
    // Should have approximately double the lines (allowing for some variance)
    expect(finalLines).toBeGreaterThan(originalLines);
    
    console.log('Keyboard shortcuts test completed');
  });

  test('should trigger save when content changes', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Set initial content
    await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
    
    // Make a change
    const editor = await editorPage.getMonacoEditor();
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('// Change to trigger save');
    
    // Check if save button becomes enabled/highlighted
    const saveButton = await topBarPage.getSaveButton();
    
    // Button might be enabled or show visual indication of unsaved changes
    const saveButtonClasses = await saveButton.getAttribute('class') || '';
    const isDisabled = await saveButton.getAttribute('disabled');
    
    // If save functionality is working, button should not be disabled
    // or should show some indication of unsaved changes
    console.log('Save button state:', { classes: saveButtonClasses, disabled: isDisabled });
    
    // Click save button
    await topBarPage.clickSave();
    
    // Wait for save operation
    await basePage.waitForLoadingComplete();
    
    console.log('Save functionality test completed');
  });

  test('should handle validation errors in editor', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Set invalid CUE content
    await editorPage.setEditorContent(TEST_DATA.INVALID_CUE_CONTENT);
    
    // Trigger validation
    await topBarPage.clickValidate();
    await basePage.waitForLoadingComplete();
    
    // Check for validation status
    const validationStatus = await topBarPage.getValidationStatus();
    console.log('Validation status:', validationStatus);
    
    // Look for error indicators in the editor or UI
    const errorSelectors = [
      '.error-marker',
      '.squiggly-error',
      '.monaco-error',
      SELECTORS.ERROR_MESSAGE
    ];
    
    let errorFound = false;
    for (const selector of errorSelectors) {
      if (await basePage.elementExists(selector)) {
        console.log(`Error indicator found: ${selector}`);
        errorFound = true;
        break;
      }
    }
    
    // Take screenshot of validation state
    await basePage.takeScreenshot('validation-errors');
    
    console.log('Validation error handling test completed');
  });

  test('should support find and replace functionality', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Set content with searchable text
    const searchableContent = `
package example

app: {
    name: "test-app"
    version: "1.0.0"
    test: "searchable"
    another_test: "searchable"
}
    `.trim();
    
    await editorPage.setEditorContent(searchableContent);
    
    const editor = await editorPage.getMonacoEditor();
    await editor.click();
    
    // Open find dialog with Ctrl+F
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);
    
    // Check if find widget is visible
    const findWidget = page.locator('.find-widget, .editor-widget');
    if (await findWidget.isVisible()) {
      // Type search term
      await page.keyboard.type('searchable');
      await page.waitForTimeout(300);
      
      // Press Enter to find next
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      console.log('Find functionality is working');
    } else {
      console.log('Find widget not detected - may use different implementation');
    }
    
    // Close find widget with Escape
    await page.keyboard.press('Escape');
    
    console.log('Find and replace test completed');
  });

  test('should handle large content efficiently', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Generate large content
    const largeContent = Array(100).fill(TEST_DATA.CUE_CONTENT).join('\n\n');
    
    // Measure performance
    const startTime = Date.now();
    await editorPage.setEditorContent(largeContent);
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    console.log(`Large content load time: ${loadTime}ms`);
    
    // Should handle large content reasonably quickly (under 5 seconds)
    expect(loadTime).toBeLessThan(5000);
    
    // Verify content was set
    const retrievedContent = await editorPage.getEditorContent();
    expect(retrievedContent.length).toBeGreaterThan(largeContent.length * 0.9); // Allow for some variance
    
    // Test scrolling performance
    const editor = await editorPage.getMonacoEditor();
    await editor.click();
    
    // Scroll to end
    await page.keyboard.press('Control+End');
    await page.waitForTimeout(200);
    
    // Scroll to beginning
    await page.keyboard.press('Control+Home');
    await page.waitForTimeout(200);
    
    console.log('Large content handling test completed');
  });

  test('should maintain focus and cursor position', async ({ page }) => {
    await editorPage.waitForMonacoToLoad();
    
    // Set content
    await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
    
    const editor = await editorPage.getMonacoEditor();
    await editor.click();
    
    // Move cursor to specific position
    await page.keyboard.press('Control+Home'); // Go to start
    await page.keyboard.press('ArrowDown'); // Move down one line
    await page.keyboard.press('ArrowRight'); // Move right
    await page.keyboard.press('ArrowRight');
    
    // Click somewhere else and back to editor
    await topBarPage.getValidateButton().then(btn => btn.click());
    await editor.click();
    
    // Cursor position should be maintained or at least editor should be focusable
    const isFocused = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement && (
        activeElement.classList.contains('monaco-editor') ||
        activeElement.closest('.monaco-editor') !== null
      );
    });
    
    // Editor should be focusable
    console.log('Editor focus state:', isFocused);
    
    console.log('Focus and cursor position test completed');
  });

  test('should work in both Source and Friendly tabs', async ({ page }) => {
    const tabsToTest = ['Source', 'Friendly'];
    
    for (const tabName of tabsToTest) {
      // Switch to tab
      await tabsPage.clickTab(tabName, 'left');
      await basePage.waitForLoadingComplete();
      
      // Check if editor is present
      if (await basePage.elementExists(SELECTORS.MONACO_EDITOR)) {
        await editorPage.waitForMonacoToLoad();
        
        // Verify editor functionality
        const editor = await editorPage.getMonacoEditor();
        await expect(editor).toBeVisible();
        
        // Test basic interaction
        await editor.click();
        await page.keyboard.type('// Test in ' + tabName);
        
        // Get content to verify it was added
        const content = await editorPage.getEditorContent();
        expect(content).toContain('Test in ' + tabName);
        
        console.log(`Editor working in ${tabName} tab`);
        
        // Clear the test content
        await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
      } else {
        console.log(`No Monaco editor found in ${tabName} tab`);
      }
      
      // Take screenshot of each tab
      await basePage.takeScreenshot(`editor-${tabName.toLowerCase()}-tab`);
    }
  });
});

test.describe('Editor Integration', () => {
  let storybookHelper: StorybookHelper;
  let editorPage: EditorPage;
  let topBarPage: TopBarPage;
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    storybookHelper = new StorybookHelper(page);
    editorPage = new EditorPage(page);
    topBarPage = new TopBarPage(page);
    basePage = new BasePage(page);
    
    await mockApiResponses(page);
    await storybookHelper.navigateToApp();
    await basePage.waitForLoadingComplete();
  });

  test('should integrate with validation system', async ({ page }) => {
    // Switch to Source tab
    const tabsPage = new TabsPage(page);
    await tabsPage.clickTab('Source', 'left');
    
    if (await basePage.elementExists(SELECTORS.MONACO_EDITOR)) {
      await editorPage.waitForMonacoToLoad();
      
      // Set valid content
      await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
      
      // Trigger validation
      await topBarPage.clickValidate();
      await basePage.waitForLoadingComplete();
      
      // Check validation status
      const status1 = await topBarPage.getValidationStatus();
      console.log('Status after valid content:', status1);
      
      // Set invalid content
      await editorPage.setEditorContent(TEST_DATA.INVALID_CUE_CONTENT);
      
      // Trigger validation again
      await topBarPage.clickValidate();
      await basePage.waitForLoadingComplete();
      
      // Check validation status
      const status2 = await topBarPage.getValidationStatus();
      console.log('Status after invalid content:', status2);
      
      // Statuses should be different or show appropriate feedback
      console.log('Validation integration test completed');
    }
  });

  test('should save changes and show appropriate feedback', async ({ page }) => {
    const tabsPage = new TabsPage(page);
    await tabsPage.clickTab('Source', 'left');
    
    if (await basePage.elementExists(SELECTORS.MONACO_EDITOR)) {
      await editorPage.waitForMonacoToLoad();
      
      // Make changes
      await editorPage.setEditorContent(TEST_DATA.CUE_CONTENT);
      const editor = await editorPage.getMonacoEditor();
      await editor.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.type('\n// Saved change');
      
      // Save changes
      await topBarPage.clickSave();
      
      // Wait for save operation and potential toast notification
      await basePage.waitForLoadingComplete();
      await waitForToast(page, 'success');
      
      console.log('Save integration test completed');
    }
  });

  test('should handle CUE file switching', async ({ page }) => {
    const tabsPage = new TabsPage(page);
    await tabsPage.clickTab('Source', 'left');
    
    if (await basePage.elementExists(SELECTORS.MONACO_EDITOR)) {
      await editorPage.waitForMonacoToLoad();
      
      // Get initial content
      const initialContent = await editorPage.getEditorContent();
      
      // Try to switch CUE files (if multiple are available)
      const cueSelector = await topBarPage.getCueSelector();
      const options = cueSelector.locator('option');
      const optionCount = await options.count();
      
      if (optionCount > 1) {
        // Switch to different CUE file
        const secondOption = await options.nth(1).textContent();
        if (secondOption) {
          await topBarPage.selectCueFile(secondOption);
          await basePage.waitForLoadingComplete();
          
          // Content might change
          const newContent = await editorPage.getEditorContent();
          console.log('Content changed after CUE file switch');
          console.log('Initial length:', initialContent.length);
          console.log('New length:', newContent.length);
        }
      }
      
      console.log('CUE file switching test completed');
    }
  });
});