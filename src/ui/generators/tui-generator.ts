/**
 * TUI (Text User Interface) Platform Generator
 * 
 * Generates text-based UI components, navigation, and forms that handle
 * terminal-based interactions using libraries like blessed or ink.
 */

import path from 'path';

import {
  UIGenerator,
  ProfileUI,
  GeneratorOptions,
  GeneratedArtifact,
  Route,
  Component,
  Form,
  TestDefinition,
  TUIGeneratorConfig,
  TemplateContext,
  GeneratorError,
} from '../types.js';

/**
 * TUI Platform Generator Implementation
 * 
 * Generates modern Terminal User Interface applications with:
 * - Blessed.js terminal UI components
 * - Keyboard navigation and shortcuts
 * - Form handling with validation
 * - Screen management and layouts
 * - Terminal-based testing
 */
export class TUIGenerator implements UIGenerator {
  readonly platform = 'tui' as const;
  private config: TUIGeneratorConfig;

  constructor(config?: Partial<TUIGeneratorConfig>) {
    this.config = {
      framework: 'blessed',
      typescript: true,
      testing: 'vitest',
      ...config,
    };
  }

  /**
   * Generate all TUI artifacts from Profile.ui
   */
  async generate(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    try {
      // Generate main TUI application entry point
      const mainAppArtifact = await this.generateMainApp(ui, options);
      artifacts.push(mainAppArtifact);

      // Generate screen components from routes
      if (ui.routes) {
        for (const [routePath, route] of Object.entries(ui.routes)) {
          const screenArtifact = await this.generateRoute(route, options);
          artifacts.push(screenArtifact);
        }

        // Generate navigation manager
        const navArtifact = await this.generateNavigation(ui.routes, options);
        artifacts.push(navArtifact);
      }

      // Generate reusable components
      if (ui.components) {
        for (const [componentName, component] of Object.entries(ui.components)) {
          const componentArtifact = await this.generateComponent(component, options);
          artifacts.push(componentArtifact);
        }
      }

      // Generate interactive forms
      if (ui.forms) {
        for (const [formName, form] of Object.entries(ui.forms)) {
          const formArtifact = await this.generateForm(form, options);
          artifacts.push(formArtifact);
        }
      }

      // Generate tests
      if (ui.tests) {
        const testArtifacts = await this.generateTests(ui.tests, options);
        artifacts.push(...testArtifacts);
      }

      // Generate configuration files
      const configArtifacts = await this.generateConfigFiles(ui, options);
      artifacts.push(...configArtifacts);

    } catch (error) {
      throw new GeneratorError(
        `Failed to generate TUI artifacts: ${error instanceof Error ? error.message : String(error)}`,
        'tui',
        'generation'
      );
    }

    return artifacts;
  }

  /**
   * Generate a TUI screen from route
   */
  async generateRoute(route: Route, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const screenName = this.getScreenNameFromPath(route.path);
    const filename = `${screenName}Screen.ts`;
    const relativePath = path.join('screens', filename);

    const content = this.generateScreenModule({
      platform: 'tui',
      route,
      config: this.config,
      imports: this.getScreenImports(),
      exports: [`${screenName}Screen`],
    });

    return {
      type: 'route',
      filename,
      path: relativePath,
      content,
      dependencies: this.getScreenDependencies(),
      platform: 'tui',
    };
  }

  /**
   * Generate a TUI component
   */
  async generateComponent(component: Component, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const filename = `${component.name}.ts`;
    const relativePath = path.join('components', filename);

    const content = this.generateComponentModule({
      platform: 'tui',
      component,
      config: this.config,
      imports: this.getComponentImports(component),
      exports: [component.name],
    });

    return {
      type: 'component',
      filename,
      path: relativePath,
      content,
      dependencies: this.getComponentDependencies(component),
      platform: 'tui',
    };
  }

  /**
   * Generate a TUI form with terminal input handling
   */
  async generateForm(form: Form, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const filename = `${form.name}Form.ts`;
    const relativePath = path.join('forms', filename);

    const content = this.generateFormModule({
      platform: 'tui',
      form,
      config: this.config,
      imports: this.getFormImports(),
      exports: [`${form.name}Form`],
    });

    return {
      type: 'form',
      filename,
      path: relativePath,
      content,
      dependencies: this.getFormDependencies(),
      platform: 'tui',
    };
  }

  /**
   * Generate TUI tests
   */
  async generateTests(tests: TestDefinition, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    for (const scenario of tests.scenarios) {
      const filename = `${scenario.name.replace(/\s+/g, '-').toLowerCase()}.test.ts`;
      const relativePath = path.join('__tests__', filename);

      const content = this.generateTestFile({
        platform: 'tui',
        tests,
        config: this.config,
        imports: this.getTestImports(),
        exports: [],
      }, scenario);

      artifacts.push({
        type: 'test',
        filename,
        path: relativePath,
        content,
        dependencies: this.getTestDependencies(),
        platform: 'tui',
      });
    }

    return artifacts;
  }

  /**
   * Validate generator options
   */
  validateOptions(options: GeneratorOptions): boolean {
    if (options.platform !== 'tui') {
      return false;
    }

    if (!options.outputDir) {
      return false;
    }

    return true;
  }

  // Private helper methods

  private async generateMainApp(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const content = `/**
 * Main TUI Application
 * Auto-generated from Profile.ui specification
 */

import blessed from 'blessed';
import { NavigationManager } from './navigation/NavigationManager.js';
import { ThemeManager } from './utils/ThemeManager.js';

// Import screens
${ui.routes ? Object.entries(ui.routes).map(([path, route]) => {
  const screenName = this.getScreenNameFromPath(path);
  return `import { ${screenName}Screen } from './screens/${screenName}Screen.js';`;
}).join('\n') : ''}

export class TUIApplication {
  private screen: blessed.Widgets.Screen;
  private navigation: NavigationManager;
  private theme: ThemeManager;

  constructor() {
    // Create the main screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: '${this.getAppTitle(ui)}',
      fullUnicode: true,
      dockBorders: true,
    });

    // Initialize theme
    this.theme = new ThemeManager();
    
    // Initialize navigation
    this.navigation = new NavigationManager(this.screen);
    
    this.setupScreens();
    this.setupKeyBindings();
    this.setupExitHandlers();
  }

  private setupScreens() {
    // Register all screens
${ui.routes ? Object.entries(ui.routes).map(([path, route]) => {
  const screenName = this.getScreenNameFromPath(path);
  return `    this.navigation.registerScreen('${path}', new ${screenName}Screen(this.screen, this.theme));`;
}).join('\n') : ''}
  }

  private setupKeyBindings() {
    // Global key bindings
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.exit();
    });

    // Navigation key bindings
    this.screen.key(['tab'], () => {
      this.screen.focusNext();
    });

    this.screen.key(['S-tab'], () => {
      this.screen.focusPrevious();
    });

    // Help key binding
    this.screen.key(['f1', 'h'], () => {
      this.showHelp();
    });
  }

  private setupExitHandlers() {
    // Handle cleanup on exit
    process.on('SIGTERM', () => this.exit());
    process.on('SIGINT', () => this.exit());
  }

  public async start(initialRoute?: string) {
    try {
      // Show initial screen
      const startRoute = initialRoute || '${this.getDefaultRoute(ui)}';
      await this.navigation.navigateTo(startRoute);
      
      // Render the screen
      this.screen.render();
      
      return new Promise<void>((resolve) => {
        this.screen.on('destroy', () => resolve());
      });
    } catch (error) {
      console.error('TUI Application error:', error);
      this.exit(1);
    }
  }

  private showHelp() {
    const helpBox = blessed.box({
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      content: this.getHelpContent(),
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    helpBox.key(['escape', 'enter'], () => {
      this.screen.remove(helpBox);
      this.screen.render();
    });

    this.screen.append(helpBox);
    helpBox.focus();
    this.screen.render();
  }

  private getHelpContent(): string {
    return \`{center}{bold}Help{/bold}{/center}

{bold}Navigation:{/bold}
  Tab         - Focus next element
  Shift+Tab   - Focus previous element
  Escape/q    - Exit application
  F1/h        - Show this help

{bold}Available Screens:{/bold}
${ui.routes ? Object.entries(ui.routes).map(([path, route]) => 
  `  ${path}       - ${route.component || 'Screen'}`
).join('\n') : '  No routes defined'}

{center}Press Enter or Escape to close{/center}\`;
  }

  public exit(code: number = 0) {
    this.screen.destroy();
    process.exit(code);
  }
}

// Main entry point
export async function main() {
  const app = new TUIApplication();
  await app.start();
}

// Auto-start if this is the main module
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main().catch(console.error);
}

export default TUIApplication;
`;

    return {
      type: 'config',
      filename: 'app.ts',
      path: 'app.ts',
      content,
      dependencies: this.getAppDependencies(),
      platform: 'tui',
    };
  }

  private async generateNavigation(routes: Record<string, Route>, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const content = `/**
 * Navigation Manager
 * Auto-generated TUI navigation system
 */

import blessed from 'blessed';

export interface TUIScreen {
  element: blessed.Widgets.Element;
  onEnter?: () => void | Promise<void>;
  onExit?: () => void | Promise<void>;
  onKeyPress?: (key: string, ch: string) => void | Promise<void>;
}

export class NavigationManager {
  private screen: blessed.Widgets.Screen;
  private screens = new Map<string, TUIScreen>();
  private currentScreen?: string;
  private history: string[] = [];

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
  }

  registerScreen(route: string, tuiScreen: TUIScreen) {
    this.screens.set(route, tuiScreen);
  }

  async navigateTo(route: string, addToHistory: boolean = true) {
    const screen = this.screens.get(route);
    if (!screen) {
      throw new Error(\`Screen not found for route: \${route}\`);
    }

    // Exit current screen
    if (this.currentScreen) {
      const currentScreenObj = this.screens.get(this.currentScreen);
      if (currentScreenObj?.onExit) {
        await currentScreenObj.onExit();
      }
      
      // Hide current screen
      currentScreenObj?.element.hide();
    }

    // Add to history
    if (addToHistory && this.currentScreen && this.currentScreen !== route) {
      this.history.push(this.currentScreen);
    }

    // Enter new screen
    this.currentScreen = route;
    
    if (screen.onEnter) {
      await screen.onEnter();
    }

    // Show new screen
    screen.element.show();
    screen.element.focus();
    
    this.screen.render();
  }

  async goBack() {
    if (this.history.length > 0) {
      const previousRoute = this.history.pop();
      if (previousRoute) {
        await this.navigateTo(previousRoute, false);
      }
    }
  }

  getCurrentRoute(): string | undefined {
    return this.currentScreen;
  }

  getHistory(): string[] {
    return [...this.history];
  }
}

export default NavigationManager;
`;

    return {
      type: 'component',
      filename: 'NavigationManager.ts',
      path: 'navigation/NavigationManager.ts',
      content,
      dependencies: ['blessed'],
      platform: 'tui',
    };
  }

  private generateScreenModule(context: TemplateContext): string {
    const { route } = context;
    if (!route) throw new GeneratorError('Route context required', 'tui', 'screen');

    const screenName = this.getScreenNameFromPath(route.path);

    return `/**
 * ${screenName} Screen
 * Auto-generated from Profile.ui specification
 */

import blessed from 'blessed';
import { TUIScreen } from '../navigation/NavigationManager.js';
import { ThemeManager } from '../utils/ThemeManager.js';

export class ${screenName}Screen implements TUIScreen {
  public element: blessed.Widgets.Box;
  private screen: blessed.Widgets.Screen;
  private theme: ThemeManager;

  constructor(screen: blessed.Widgets.Screen, theme: ThemeManager) {
    this.screen = screen;
    this.theme = theme;
    this.element = this.createLayout();
    this.setupKeyBindings();
    screen.append(this.element);
  }

  private createLayout(): blessed.Widgets.Box {
    const container = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      content: '',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'cyan'
        },
        style: {
          inverse: true
        }
      },
      border: {
        type: 'line'
      },
      style: this.theme.getScreenStyle(),
    });

    // Add title
    const title = blessed.box({
      top: 0,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: \`{center}{bold}${screenName}{/bold}{/center}\`,
      tags: true,
      style: this.theme.getTitleStyle(),
    });

    container.append(title);

    // Add content area
    const content = this.createContent();
    container.append(content);

    // Add status bar
    const statusBar = this.createStatusBar();
    container.append(statusBar);

    return container;
  }

  private createContent(): blessed.Widgets.Box {
    const contentBox = blessed.box({
      top: 2,
      left: 1,
      right: 1,
      bottom: 3,
      content: this.getContentText(),
      tags: true,
      scrollable: true,
      style: this.theme.getContentStyle(),
    });

${this.generateScreenCapabilities(route)}

    return contentBox;
  }

  private createStatusBar(): blessed.Widgets.Box {
    return blessed.box({
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      content: ' ${route.path} | F1: Help | Tab: Navigate | Esc: Exit',
      style: this.theme.getStatusBarStyle(),
    });
  }

  private getContentText(): string {
    return \`Welcome to ${screenName}

This screen provides the following capabilities:
${route.capabilities ? route.capabilities.map(cap => `• ${this.capitalize(cap)}`).join('\n') : '• No specific capabilities defined'}

Use Tab to navigate between elements and Esc to go back.
\`;
  }

  private setupKeyBindings() {
    // Screen-specific key bindings
    this.element.key(['enter'], () => {
      this.handleEnterKey();
    });

    this.element.key(['backspace', 'left'], () => {
      this.handleBackKey();
    });

${route.capabilities ? route.capabilities.map(cap => `
    // ${this.capitalize(cap)} capability binding
    this.element.key(['${cap.charAt(0).toLowerCase()}'], () => {
      this.handle${this.capitalize(cap)}();
    });`).join('') : ''}
  }

  private handleEnterKey() {
    // Handle enter key press
    console.log('Enter key pressed on ${screenName}');
  }

  private handleBackKey() {
    // Handle back navigation
    console.log('Back key pressed on ${screenName}');
  }

${route.capabilities ? route.capabilities.map(cap => `
  private handle${this.capitalize(cap)}() {
    // Handle ${cap} capability
    console.log('${this.capitalize(cap)} action triggered');
  }`).join('') : ''}

  // TUIScreen interface methods
  async onEnter() {
    // Called when entering this screen
    this.element.show();
    this.element.focus();
  }

  async onExit() {
    // Called when exiting this screen
    this.element.hide();
  }

  async onKeyPress(key: string, ch: string) {
    // Handle global key presses while this screen is active
    console.log(\`Key pressed: \${key}, char: \${ch}\`);
  }
}

export default ${screenName}Screen;
`;
  }

  private generateComponentModule(context: TemplateContext): string {
    const { component } = context;
    if (!component) throw new GeneratorError('Component context required', 'tui', 'component');

    return `/**
 * ${component.name} Component
 * Auto-generated TUI component from Profile.ui specification
 */

import blessed from 'blessed';

export interface ${component.name}Options {
${component.props ? Object.entries(component.props).map(([key, value]) => 
  `  ${key}?: ${this.getTypeFromValue(value)};`
).join('\n') : '  // No options defined'}
}

export class ${component.name} {
  private element: blessed.Widgets.Element;

  constructor(options?: ${component.name}Options) {
    this.element = this.createElement(options);
  }

  private createElement(options?: ${component.name}Options): blessed.Widgets.Element {
${this.generateComponentElement(component)}
  }

  public getElement(): blessed.Widgets.Element {
    return this.element;
  }

  public show() {
    this.element.show();
  }

  public hide() {
    this.element.hide();
  }

  public focus() {
    this.element.focus();
  }

${this.generateComponentMethods(component)}
}

export default ${component.name};
`;
  }

  private generateFormModule(context: TemplateContext): string {
    const { form } = context;
    if (!form) throw new GeneratorError('Form context required', 'tui', 'form');

    return `/**
 * ${form.name} Form
 * Auto-generated TUI form from Profile.ui specification
 */

import blessed from 'blessed';

export interface ${form.name}Data {
${form.fields.map(field => 
  `  ${field.name}${field.required ? '' : '?'}: ${this.getFieldType(field.type)};`
).join('\n')}
}

export class ${form.name}Form {
  private container: blessed.Widgets.Form;
  private fields: Map<string, blessed.Widgets.Element> = new Map();
  private onSubmitCallback?: (data: ${form.name}Data) => void | Promise<void>;

  constructor() {
    this.container = this.createForm();
    this.setupValidation();
    this.setupKeyBindings();
  }

  private createForm(): blessed.Widgets.Form {
    const form = blessed.form({
      parent: null, // Will be set by caller
      top: 'center',
      left: 'center',
      width: '80%',
      height: '${Math.min(form.fields.length * 3 + 6, 20)}',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0'
        }
      }
    });

    // Add title
    const title = blessed.box({
      top: 0,
      left: 'center',
      width: 'shrink',
      height: 1,
      content: \`{center}{bold}${form.name}{/bold}{/center}\`,
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue'
      }
    });

    form.append(title);

    // Add form fields
    let yOffset = 2;
    
${form.fields.map((field, index) => this.generateFormField(field, index)).join('\n\n')}

    // Add submit button
    const submitButton = blessed.button({
      parent: form,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 1,
        right: 1
      },
      left: 'center',
      bottom: 2,
      name: 'submit',
      content: 'Submit',
      style: {
        bg: 'green',
        fg: 'white',
        focus: {
          bg: 'red'
        }
      }
    });

    submitButton.on('press', () => {
      this.handleSubmit();
    });

    return form;
  }

  private setupValidation() {
    // Setup field validation
${form.fields.filter(f => f.required || f.validation).map(field => 
  this.generateFieldValidation(field)
).join('\n')}
  }

  private setupKeyBindings() {
    this.container.key(['enter'], () => {
      this.handleSubmit();
    });

    this.container.key(['escape'], () => {
      this.handleCancel();
    });
  }

  private async handleSubmit() {
    try {
      const data = this.collectFormData();
      const isValid = await this.validateForm(data);
      
      if (isValid && this.onSubmitCallback) {
        await this.onSubmitCallback(data);
      }
    } catch (error) {
      this.showError(\`Form submission failed: \${error}\`);
    }
  }

  private handleCancel() {
    this.container.emit('cancel');
  }

  private collectFormData(): ${form.name}Data {
    const data: any = {};
    
${form.fields.map(field => `
    const ${field.name}Element = this.fields.get('${field.name}');
    if (${field.name}Element) {
      data.${field.name} = ${field.name}Element.value || '';
    }`).join('')}

    return data;
  }

  private async validateForm(data: ${form.name}Data): Promise<boolean> {
    const errors: string[] = [];

${form.fields.filter(f => f.required).map(field => `
    if (!data.${field.name}) {
      errors.push('${field.label} is required');
    }`).join('')}

    if (errors.length > 0) {
      this.showError(errors.join('\\n'));
      return false;
    }

    return true;
  }

  private showError(message: string) {
    const errorBox = blessed.message({
      parent: this.container,
      top: 'center',
      left: 'center',
      width: '80%',
      height: 'shrink',
      content: \`{center}{red-fg}Error{/red-fg}{/center}\\n\\n\${message}\`,
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'red',
        bg: 'black',
        border: {
          fg: 'red'
        }
      }
    });

    errorBox.key(['enter', 'escape'], () => {
      errorBox.destroy();
    });
  }

  public onSubmit(callback: (data: ${form.name}Data) => void | Promise<void>) {
    this.onSubmitCallback = callback;
  }

  public getElement(): blessed.Widgets.Form {
    return this.container;
  }

  public show(parent: blessed.Widgets.Node) {
    parent.append(this.container);
    this.container.show();
    this.container.focus();
  }

  public hide() {
    this.container.hide();
  }
}

export default ${form.name}Form;
`;
  }

  private generateTestFile(context: TemplateContext, scenario: any): string {
    const { tests } = context;
    if (!tests) throw new GeneratorError('Test context required', 'tui', 'test');

    return `/**
 * ${scenario.name} TUI Test
 * Auto-generated from Profile.ui specification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import blessed from 'blessed';
import TUIApplication from '../app.js';

// Mock blessed for testing
vi.mock('blessed', () => ({
  default: {
    screen: vi.fn(() => ({
      render: vi.fn(),
      destroy: vi.fn(),
      key: vi.fn(),
      focusNext: vi.fn(),
      focusPrevious: vi.fn(),
      append: vi.fn(),
      remove: vi.fn(),
      on: vi.fn(),
    })),
    box: vi.fn(() => ({
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      append: vi.fn(),
      key: vi.fn(),
      on: vi.fn(),
    })),
  },
}));

describe('${scenario.name}', () => {
  let app: TUIApplication;
  let mockScreen: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScreen = blessed.screen();
    app = new TUIApplication();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('${scenario.description}', async () => {
${this.generateTUITestSteps(scenario.steps)}
  });

  it('handles keyboard navigation', async () => {
    // Test keyboard navigation
    const keyHandler = vi.fn();
    mockScreen.key.mockImplementation((keys: string[], handler: Function) => {
      if (keys.includes('tab')) {
        keyHandler.mockImplementation(handler);
      }
    });

    await app.start();
    
    // Simulate Tab key press
    keyHandler();
    
    expect(mockScreen.focusNext).toHaveBeenCalled();
  });

  it('handles screen lifecycle', async () => {
    // Test screen lifecycle methods
    await app.start();
    
    expect(mockScreen.render).toHaveBeenCalled();
  });

  it('handles exit gracefully', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    expect(() => app.exit(0)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(0);
    
    exitSpy.mockRestore();
  });
});
`;
  }

  private async generateConfigFiles(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    // Generate theme manager
    artifacts.push({
      type: 'config',
      filename: 'ThemeManager.ts',
      path: 'utils/ThemeManager.ts',
      content: this.generateThemeManager(),
      platform: 'tui',
    });

    // Generate package.json
    artifacts.push({
      type: 'config',
      filename: 'package.json',
      path: 'package.json',
      content: this.generatePackageJson(ui),
      platform: 'tui',
    });

    // Generate TypeScript config
    if (this.config.typescript) {
      artifacts.push({
        type: 'config',
        filename: 'tsconfig.json',
        path: 'tsconfig.json',
        content: this.generateTsConfig(),
        platform: 'tui',
      });
    }

    return artifacts;
  }

  // Utility methods

  private getScreenNameFromPath(path: string): string {
    return path
      .replace(/^\//, '')
      .replace(/\/:/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .replace(/^./, str => str.toUpperCase()) || 'Unknown';
  }

  private getAppTitle(ui: ProfileUI): string {
    return ui.config?.name || 'Generated TUI Application';
  }

  private getDefaultRoute(ui: ProfileUI): string {
    if (!ui.routes) return '/';
    const routes = Object.keys(ui.routes);
    return routes[0] || '/';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getFieldType(fieldType: string): string {
    switch (fieldType) {
      case 'number': return 'number';
      case 'checkbox': return 'boolean';
      default: return 'string';
    }
  }

  private getTypeFromValue(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'any[]';
    return 'any';
  }

  private generateScreenCapabilities(route: Route): string {
    if (!route.capabilities) return '';

    return route.capabilities.map(capability => `
    // Add ${capability} functionality
    const ${capability}Button = blessed.button({
      parent: contentBox,
      top: 'center',
      left: 'center',
      width: 20,
      height: 3,
      content: '${this.capitalize(capability)}',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'green',
        focus: {
          bg: 'red'
        }
      }
    });

    ${capability}Button.on('press', () => {
      this.handle${this.capitalize(capability)}();
    });`).join('\n');
  }

  private generateComponentElement(component: Component): string {
    switch (component.type) {
      case 'list':
        return `    return blessed.list({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0'
        },
        selected: {
          bg: 'green'
        }
      },
      keys: true,
      vi: true
    });`;

      case 'form':
        return `    return blessed.form({
      top: 'center',
      left: 'center',
      width: '80%',
      height: '60%',
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0'
        }
      }
    });`;

      default:
        return `    return blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      content: '${component.name} Component',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0'
        }
      }
    });`;
    }
  }

  private generateComponentMethods(component: Component): string {
    switch (component.type) {
      case 'list':
        return `
  public addItem(item: string) {
    (this.element as blessed.Widgets.ListElement).addItem(item);
  }

  public removeItem(item: string) {
    (this.element as blessed.Widgets.ListElement).removeItem(item);
  }

  public getSelected(): string | null {
    const list = this.element as blessed.Widgets.ListElement;
    return list.getItem(list.selected) || null;
  }`;

      case 'form':
        return `
  public submit() {
    (this.element as blessed.Widgets.FormElement).submit();
  }

  public reset() {
    (this.element as blessed.Widgets.FormElement).reset();
  }`;

      default:
        return `
  public setContent(content: string) {
    this.element.setContent(content);
  }

  public getContent(): string {
    return this.element.getContent();
  }`;
    }
  }

  private generateFormField(field: any, index: number): string {
    const yPos = `${2 + index * 3}`;
    
    return `    // ${field.label} field
    const ${field.name}Label = blessed.text({
      parent: form,
      top: ${yPos},
      left: 2,
      width: '30%',
      height: 1,
      content: '${field.label}:',
      style: {
        fg: 'white',
        bg: 'blue'
      }
    });

    const ${field.name}Input = blessed.${this.getBlessedInputType(field.type)}({
      parent: form,
      top: ${yPos},
      left: '32%',
      width: '60%',
      height: 1,
      name: '${field.name}',
      border: {
        type: 'line'
      },
      style: {
        fg: 'black',
        bg: 'white',
        focus: {
          border: {
            fg: 'green'
          }
        }
      }
    });

    this.fields.set('${field.name}', ${field.name}Input);
    yOffset += 3;`;
  }

  private getBlessedInputType(fieldType: string): string {
    switch (fieldType) {
      case 'textarea': return 'textarea';
      case 'checkbox': return 'checkbox';
      case 'password': return 'textbox'; // blessed doesn't have password type, use textbox with hidden option
      default: return 'textbox';
    }
  }

  private generateFieldValidation(field: any): string {
    return `    // Validation for ${field.name}
    const ${field.name}Element = this.fields.get('${field.name}');
    if (${field.name}Element) {
      ${field.name}Element.on('blur', () => {
        // Add validation logic here
      });
    }`;
  }

  private generateTUITestSteps(steps: any[]): string {
    return steps.map(step => {
      switch (step.action) {
        case 'click':
          return `    // Simulate button press
    const button = mockScreen.append.mock.calls.find(call => 
      call[0]?.content?.includes('${step.target}')
    );
    expect(button).toBeDefined();`;
        case 'fill':
          return `    // Simulate form input
    const input = mockScreen.append.mock.calls.find(call => 
      call[0]?.name === '${step.target}'
    );
    if (input) {
      input[0].value = '${step.value}';
    }`;
        case 'expect':
          return `    // Verify screen content
    expect(mockScreen.render).toHaveBeenCalled();`;
        default:
          return `    // ${step.action} step implementation for TUI`;
      }
    }).join('\n    ');
  }

  // Import and dependency helpers

  private getScreenImports(): string[] {
    return ['blessed'];
  }

  private getComponentImports(component: Component): string[] {
    return ['blessed'];
  }

  private getFormImports(): string[] {
    return ['blessed'];
  }

  private getTestImports(): string[] {
    return ['vitest', 'blessed'];
  }

  private getAppDependencies(): string[] {
    return ['blessed'];
  }

  private getScreenDependencies(): string[] {
    return ['blessed'];
  }

  private getComponentDependencies(component: Component): string[] {
    return ['blessed'];
  }

  private getFormDependencies(): string[] {
    return ['blessed'];
  }

  private getTestDependencies(): string[] {
    return ['vitest'];
  }

  // Config generators

  private generateThemeManager(): string {
    return `/**
 * Theme Manager
 * Manages TUI themes and styling
 */

export interface ThemeStyle {
  fg?: string;
  bg?: string;
  border?: {
    fg?: string;
    bg?: string;
  };
  focus?: {
    fg?: string;
    bg?: string;
    border?: {
      fg?: string;
      bg?: string;
    };
  };
  selected?: {
    fg?: string;
    bg?: string;
  };
}

export class ThemeManager {
  private currentTheme: 'default' | 'dark' | 'light' = 'default';

  getScreenStyle(): ThemeStyle {
    return {
      fg: 'white',
      bg: 'black',
      border: {
        fg: '#f0f0f0'
      }
    };
  }

  getTitleStyle(): ThemeStyle {
    return {
      fg: 'white',
      bg: 'blue'
    };
  }

  getContentStyle(): ThemeStyle {
    return {
      fg: 'white',
      bg: 'black'
    };
  }

  getStatusBarStyle(): ThemeStyle {
    return {
      fg: 'black',
      bg: 'white'
    };
  }

  setTheme(theme: 'default' | 'dark' | 'light') {
    this.currentTheme = theme;
  }

  getCurrentTheme(): string {
    return this.currentTheme;
  }
}

export default ThemeManager;`;
  }

  private generatePackageJson(ui: ProfileUI): string {
    return `{
  "name": "${ui.config?.name || 'generated-tui'}",
  "version": "1.0.0",
  "description": "Auto-generated TUI from Profile.ui specification",
  "type": "module",
  "main": "dist/app.js",
  "bin": {
    "${ui.config?.name || 'generated-tui'}": "./dist/app.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/app.ts",
    "start": "node dist/app.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "blessed": "^0.1.81"
  },
  "devDependencies": {
    "@types/blessed": "^0.1.21",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}`;
  }

  private generateTsConfig(): string {
    return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "outDir": "dist",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`;
  }
}