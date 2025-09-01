/**
 * Desktop Platform Generator
 * 
 * Generates native desktop UI components, window layouts, and forms
 * that handle desktop-specific interactions using Electron, Tauri, or similar.
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
  DesktopGeneratorConfig,
  TemplateContext,
  GeneratorError,
} from '../types.js';

/**
 * Desktop Platform Generator Implementation
 * 
 * Generates modern desktop applications with:
 * - Electron-based native desktop UI
 * - React components for the frontend
 * - Native menu and window management
 * - IPC (Inter-Process Communication)
 * - Desktop-specific features (file system access, notifications)
 */
export class DesktopGenerator implements UIGenerator {
  readonly platform = 'desktop' as const;
  private config: DesktopGeneratorConfig;

  constructor(config?: Partial<DesktopGeneratorConfig>) {
    this.config = {
      framework: 'electron',
      frontend: 'react',
      typescript: true,
      testing: 'vitest',
      ...config,
    };
  }

  /**
   * Generate all desktop artifacts from Profile.ui
   */
  async generate(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    try {
      // Generate main desktop application files
      const mainProcessArtifacts = await this.generateMainProcess(ui, options);
      artifacts.push(...mainProcessArtifacts);

      // Generate renderer process files
      const rendererArtifacts = await this.generateRendererProcess(ui, options);
      artifacts.push(...rendererArtifacts);

      // Generate window components from routes
      if (ui.routes) {
        for (const [routePath, route] of Object.entries(ui.routes)) {
          const windowArtifact = await this.generateRoute(route, options);
          artifacts.push(windowArtifact);
        }
      }

      // Generate desktop components
      if (ui.components) {
        for (const [componentName, component] of Object.entries(ui.components)) {
          const componentArtifact = await this.generateComponent(component, options);
          artifacts.push(componentArtifact);
        }
      }

      // Generate forms with desktop integration
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
        `Failed to generate desktop artifacts: ${error instanceof Error ? error.message : String(error)}`,
        'desktop',
        'generation'
      );
    }

    return artifacts;
  }

  /**
   * Generate a desktop window from route
   */
  async generateRoute(route: Route, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const windowName = this.getWindowNameFromPath(route.path);
    const filename = `${windowName}Window.tsx`;
    const relativePath = path.join('renderer', 'windows', filename);

    const content = this.generateWindowComponent({
      platform: 'desktop',
      route,
      config: this.config,
      imports: this.getWindowImports(),
      exports: [`${windowName}Window`],
    });

    return {
      type: 'route',
      filename,
      path: relativePath,
      content,
      dependencies: this.getWindowDependencies(),
      platform: 'desktop',
    };
  }

  /**
   * Generate a desktop component
   */
  async generateComponent(component: Component, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const filename = `${component.name}.tsx`;
    const relativePath = path.join('renderer', 'components', filename);

    const content = this.generateDesktopComponent({
      platform: 'desktop',
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
      platform: 'desktop',
    };
  }

  /**
   * Generate a desktop form with native features
   */
  async generateForm(form: Form, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const filename = `${form.name}Form.tsx`;
    const relativePath = path.join('renderer', 'forms', filename);

    const content = this.generateFormComponent({
      platform: 'desktop',
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
      platform: 'desktop',
    };
  }

  /**
   * Generate desktop tests
   */
  async generateTests(tests: TestDefinition, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    for (const scenario of tests.scenarios) {
      const filename = `${scenario.name.replace(/\s+/g, '-').toLowerCase()}.test.tsx`;
      const relativePath = path.join('__tests__', filename);

      const content = this.generateTestFile({
        platform: 'desktop',
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
        platform: 'desktop',
      });
    }

    return artifacts;
  }

  /**
   * Validate generator options
   */
  validateOptions(options: GeneratorOptions): boolean {
    if (options.platform !== 'desktop') {
      return false;
    }

    if (!options.outputDir) {
      return false;
    }

    return true;
  }

  // Private helper methods

  private async generateMainProcess(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    // Generate main process entry point
    artifacts.push({
      type: 'config',
      filename: 'main.ts',
      path: 'main/main.ts',
      content: this.generateMainProcessCode(ui),
      dependencies: this.getMainProcessDependencies(),
      platform: 'desktop',
    });

    // Generate window manager
    artifacts.push({
      type: 'component',
      filename: 'WindowManager.ts',
      path: 'main/WindowManager.ts',
      content: this.generateWindowManager(ui),
      dependencies: this.getMainProcessDependencies(),
      platform: 'desktop',
    });

    // Generate IPC handlers
    artifacts.push({
      type: 'component',
      filename: 'IPCHandlers.ts',
      path: 'main/IPCHandlers.ts',
      content: this.generateIPCHandlers(ui),
      dependencies: this.getMainProcessDependencies(),
      platform: 'desktop',
    });

    return artifacts;
  }

  private async generateRendererProcess(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    // Generate renderer entry point
    artifacts.push({
      type: 'config',
      filename: 'index.tsx',
      path: 'renderer/index.tsx',
      content: this.generateRendererEntry(ui),
      dependencies: this.getRendererDependencies(),
      platform: 'desktop',
    });

    // Generate App component
    artifacts.push({
      type: 'component',
      filename: 'App.tsx',
      path: 'renderer/App.tsx',
      content: this.generateAppComponent(ui),
      dependencies: this.getRendererDependencies(),
      platform: 'desktop',
    });

    // Generate IPC service
    artifacts.push({
      type: 'component',
      filename: 'IPCService.ts',
      path: 'renderer/services/IPCService.ts',
      content: this.generateIPCService(ui),
      dependencies: ['electron'],
      platform: 'desktop',
    });

    return artifacts;
  }

  private generateMainProcessCode(ui: ProfileUI): string {
    return `/**
 * Electron Main Process
 * Auto-generated from Profile.ui specification
 */

import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron';
import * as path from 'path';
import { WindowManager } from './WindowManager.js';
import { setupIPCHandlers } from './IPCHandlers.js';

class DesktopApplication {
  private windowManager: WindowManager;
  private isDev = process.env.NODE_ENV === 'development';

  constructor() {
    this.windowManager = new WindowManager();
    this.setupApp();
    this.setupIPCHandlers();
  }

  private setupApp() {
    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupMenu();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Handle app window close
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle app before quit
    app.on('before-quit', () => {
      this.windowManager.closeAllWindows();
    });

    // Handle web contents created
    app.on('web-contents-created', (_, contents) => {
      // Security: Prevent new window creation
      contents.on('new-window', (event, url) => {
        event.preventDefault();
        shell.openExternal(url);
      });
    });
  }

  private createMainWindow() {
    const mainWindow = this.windowManager.createWindow('main', {
      title: '${this.getAppTitle(ui)}',
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      },
    });

    // Load the renderer
    if (this.isDev) {
      mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    }

    return mainWindow;
  }

  private setupMenu() {
    const template = this.getMenuTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private getMenuTemplate(): Electron.MenuItemConstructorOptions[] {
    return [
      {
        label: 'File',
        submenu: [
${ui.routes ? Object.entries(ui.routes).filter(([_, route]) => route.capabilities?.includes('create')).map(([path, route]) => {
  return `          {
            label: 'New ${route.component || this.getWindowNameFromPath(path)}',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.windowManager.openWindow('${path}');
            }
          },`;
}).join('\n') : ''}
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => {
              this.windowManager.showAboutDialog();
            }
          }
        ]
      }
    ];
  }

  private setupIPCHandlers() {
    setupIPCHandlers();
  }
}

// Create application instance
new DesktopApplication();
`;
  }

  private generateWindowManager(ui: ProfileUI): string {
    return `/**
 * Window Manager
 * Manages desktop application windows
 */

import { BrowserWindow, dialog } from 'electron';
import * as path from 'path';

export interface WindowOptions {
  title?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  maximizable?: boolean;
  minimizable?: boolean;
  webPreferences?: Electron.WebPreferences;
}

export class WindowManager {
  private windows = new Map<string, BrowserWindow>();
  private isDev = process.env.NODE_ENV === 'development';

  createWindow(id: string, options: WindowOptions): BrowserWindow {
    const window = new BrowserWindow({
      show: false,
      ...options,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        ...options.webPreferences,
      },
    });

    // Store window reference
    this.windows.set(id, window);

    // Handle window closed
    window.on('closed', () => {
      this.windows.delete(id);
    });

    // Show window when ready
    window.once('ready-to-show', () => {
      window.show();
    });

    return window;
  }

  openWindow(route: string, options?: Partial<WindowOptions>) {
    const windowId = \`window-\${Date.now()}\`;
    const window = this.createWindow(windowId, {
      title: \`\${route} - ${this.getAppTitle(ui)}\`,
      width: 800,
      height: 600,
      ...options,
    });

    // Load the specific route
    if (this.isDev) {
      window.loadURL(\`http://localhost:3000\${route}\`);
    } else {
      window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
        hash: route,
      });
    }

    return window;
  }

  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  closeWindow(id: string) {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  closeAllWindows() {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.windows.clear();
  }

  showAboutDialog() {
    dialog.showMessageBox({
      type: 'info',
      title: 'About',
      message: '${this.getAppTitle(ui)}',
      detail: 'Auto-generated desktop application from Profile.ui specification.',
      buttons: ['OK'],
    });
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }
}

export default WindowManager;
`;
  }

  private generateIPCHandlers(ui: ProfileUI): string {
    return `/**
 * IPC Handlers
 * Handles Inter-Process Communication between main and renderer processes
 */

import { ipcMain, dialog, shell, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export function setupIPCHandlers() {
  // App information
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getName', () => {
    return app.getName();
  });

  // File system operations
  ipcMain.handle('fs:showOpenDialog', async (event, options) => {
    const result = await dialog.showOpenDialog(options);
    return result;
  });

  ipcMain.handle('fs:showSaveDialog', async (event, options) => {
    const result = await dialog.showSaveDialog(options);
    return result;
  });

  ipcMain.handle('fs:readFile', async (event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:writeFile', async (event, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Shell operations
  ipcMain.handle('shell:openExternal', async (event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:showItemInFolder', async (event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // Window management
  ipcMain.handle('window:close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle('window:minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });

${ui.forms ? Object.entries(ui.forms).map(([formName, form]) => this.generateFormIPCHandlers(formName, form)).join('\n\n') : ''}

${ui.components ? Object.entries(ui.components).map(([componentName, component]) => this.generateComponentIPCHandlers(componentName, component)).join('\n\n') : ''}
}

// Import BrowserWindow for window operations
import { BrowserWindow } from 'electron';
`;
  }

  private generateRendererEntry(ui: ProfileUI): string {
    return `/**
 * Renderer Process Entry Point
 * Auto-generated from Profile.ui specification
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  }

  private generateAppComponent(ui: ProfileUI): string {
    return `/**
 * Desktop App Component
 * Auto-generated from Profile.ui specification
 */

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { IPCProvider } from './contexts/IPCContext';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';

// Import windows
${ui.routes ? Object.entries(ui.routes).map(([path, route]) => {
  const windowName = this.getWindowNameFromPath(path);
  return `import { ${windowName}Window } from './windows/${windowName}Window';`;
}).join('\n') : ''}

function App() {
  return (
    <IPCProvider>
      <div className="app">
        <TitleBar />
        <div className="app-body">
          <Sidebar />
          <main className="app-main">
            <Router>
              <Routes>
${ui.routes ? Object.entries(ui.routes).map(([path, route]) => {
  const windowName = this.getWindowNameFromPath(path);
  return `                <Route path="${path}" element={<${windowName}Window />} />`;
}).join('\n') : ''}
                <Route path="/" element={<HomeWindow />} />
              </Routes>
            </Router>
          </main>
        </div>
      </div>
    </IPCProvider>
  );
}

// Default home window
function HomeWindow() {
  return (
    <div className="home-window">
      <h1>Welcome to ${this.getAppTitle(ui)}</h1>
      <p>Auto-generated desktop application from Profile.ui specification.</p>
      
      <div className="window-grid">
${ui.routes ? Object.entries(ui.routes).map(([path, route]) => {
  const windowName = this.getWindowNameFromPath(path);
  return `        <div className="window-card">
          <h3>${windowName}</h3>
          <p>Navigate to ${path}</p>
          <button onClick={() => window.location.hash = '${path}'}>
            Open ${windowName}
          </button>
        </div>`;
}).join('\n') : ''}
      </div>
    </div>
  );
}

export default App;
`;
  }

  private generateIPCService(ui: ProfileUI): string {
    return `/**
 * IPC Service
 * Service for Inter-Process Communication with main process
 */

export class IPCService {
  // App methods
  static async getAppVersion(): Promise<string> {
    return window.electronAPI.invoke('app:getVersion');
  }

  static async getAppName(): Promise<string> {
    return window.electronAPI.invoke('app:getName');
  }

  // File system methods
  static async showOpenDialog(options: Electron.OpenDialogOptions) {
    return window.electronAPI.invoke('fs:showOpenDialog', options);
  }

  static async showSaveDialog(options: Electron.SaveDialogOptions) {
    return window.electronAPI.invoke('fs:showSaveDialog', options);
  }

  static async readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    return window.electronAPI.invoke('fs:readFile', filePath);
  }

  static async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.invoke('fs:writeFile', filePath, content);
  }

  // Shell methods
  static async openExternal(url: string): Promise<void> {
    return window.electronAPI.invoke('shell:openExternal', url);
  }

  static async showItemInFolder(filePath: string): Promise<void> {
    return window.electronAPI.invoke('shell:showItemInFolder', filePath);
  }

  // Window methods
  static async closeWindow(): Promise<void> {
    return window.electronAPI.invoke('window:close');
  }

  static async minimizeWindow(): Promise<void> {
    return window.electronAPI.invoke('window:minimize');
  }

  static async maximizeWindow(): Promise<void> {
    return window.electronAPI.invoke('window:maximize');
  }

${ui.forms ? Object.entries(ui.forms).map(([formName, form]) => this.generateFormIPCMethods(formName)).join('\n\n') : ''}

${ui.components ? Object.entries(ui.components).map(([componentName, component]) => this.generateComponentIPCMethods(componentName)).join('\n\n') : ''}
}

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}

export default IPCService;
`;
  }

  private generateWindowComponent(context: TemplateContext): string {
    const { route } = context;
    if (!route) throw new GeneratorError('Route context required', 'desktop', 'window');

    const windowName = this.getWindowNameFromPath(route.path);

    return `/**
 * ${windowName} Window
 * Auto-generated desktop window from Profile.ui specification
 */

import React, { useState, useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { WindowHeader } from '../components/WindowHeader';
import { WindowContent } from '../components/WindowContent';
import { WindowFooter } from '../components/WindowFooter';

export function ${windowName}Window() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { invokeIPC } = useIPC();

  useEffect(() => {
    // Window initialization
    handleWindowInit();
  }, []);

  const handleWindowInit = async () => {
    try {
      setIsLoading(true);
      // Initialize window-specific data
      await initializeWindowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeWindowData = async () => {
    // Window-specific initialization logic
${route.capabilities ? route.capabilities.map(cap => `
    // Initialize ${cap} capability
    await initialize${this.capitalize(cap)}();`).join('') : ''}
  };

${route.capabilities ? route.capabilities.map(cap => `
  const initialize${this.capitalize(cap)} = async () => {
    // Implementation for ${cap} capability
    console.log('Initializing ${cap} capability');
  };

  const handle${this.capitalize(cap)} = async () => {
    try {
      setIsLoading(true);
      // Handle ${cap} action
      await invokeIPC('${cap}:execute', {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };`).join('\n\n') : ''}

  if (isLoading) {
    return (
      <div className="window-loading">
        <div className="loading-spinner" />
        <p>Loading ${windowName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="window-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => setError(null)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="desktop-window ${windowName.toLowerCase()}-window">
      <WindowHeader title="${windowName}" />
      
      <WindowContent>
        <div className="window-main-content">
          <h1>${windowName}</h1>
          <p>This window provides the following capabilities:</p>
          
          <div className="capability-buttons">
${route.capabilities ? route.capabilities.map(cap => `
            <button
              className="capability-button ${cap}-button"
              onClick={handle${this.capitalize(cap)}}
              disabled={isLoading}
            >
              ${this.capitalize(cap)}
            </button>`).join('') : '            <p>No specific capabilities defined</p>'}
          </div>
          
          <div className="window-info">
            <p><strong>Route:</strong> {route.path}</p>
            <p><strong>Component:</strong> {route.component || windowName}</p>
          </div>
        </div>
      </WindowContent>
      
      <WindowFooter>
        <span>Ready</span>
      </WindowFooter>
    </div>
  );
}

export default ${windowName}Window;
`;
  }

  private generateDesktopComponent(context: TemplateContext): string {
    const { component } = context;
    if (!component) throw new GeneratorError('Component context required', 'desktop', 'component');

    return `/**
 * ${component.name} Desktop Component
 * Auto-generated from Profile.ui specification
 */

import React from 'react';
import { useIPC } from '../hooks/useIPC';

interface ${component.name}Props {
  className?: string;
${component.props ? Object.entries(component.props).map(([key, value]) => 
  `  ${key}?: ${this.getTypeFromValue(value)};`
).join('\n') : ''}
}

export function ${component.name}({ className, ...props }: ${component.name}Props) {
  const { invokeIPC } = useIPC();

${this.generateComponentHooks(component)}

  return (
    <div className={\`desktop-component \${component.name.toLowerCase()}-component \${className || ''}\`}>
      <div className="component-header">
        <h3>${component.name}</h3>
      </div>
      
      <div className="component-body">
${this.generateComponentContent(component)}
      </div>
      
      <div className="component-footer">
        {/* Component-specific actions */}
${this.generateComponentActions(component)}
      </div>
    </div>
  );
}

export default ${component.name};
`;
  }

  private generateFormComponent(context: TemplateContext): string {
    const { form } = context;
    if (!form) throw new GeneratorError('Form context required', 'desktop', 'form');

    return `/**
 * ${form.name} Desktop Form
 * Auto-generated from Profile.ui specification
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useIPC } from '../hooks/useIPC';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { FileInput } from '../components/ui/FileInput';

// Form validation schema
const ${form.name}Schema = z.object({
${form.fields.map(field => {
  let schema = 'z.string()';
  
  if (field.type === 'email') schema = 'z.string().email()';
  else if (field.type === 'number') schema = 'z.number()';
  else if (!field.required) schema += '.optional()';
  
  return `  ${field.name}: ${schema}${field.required ? '' : '.optional()'},`;
}).join('\n')}
});

type ${form.name}Data = z.infer<typeof ${form.name}Schema>;

interface ${form.name}FormProps {
  className?: string;
  onSubmit?: (data: ${form.name}Data) => void | Promise<void>;
  defaultValues?: Partial<${form.name}Data>;
}

export function ${form.name}Form({ className, onSubmit, defaultValues }: ${form.name}FormProps) {
  const { invokeIPC } = useIPC();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<${form.name}Data>({
    resolver: zodResolver(${form.name}Schema),
    defaultValues,
  });

  const handleFormSubmit = async (data: ${form.name}Data) => {
    try {
      // Call desktop-specific form processing
      await invokeIPC('form:${form.name.toLowerCase()}:submit', data);
      await onSubmit?.(data);
    } catch (error) {
      console.error('Form submission error:', error);
      // Show desktop notification
      await invokeIPC('notification:show', {
        title: 'Form Error',
        body: 'Failed to submit form. Please try again.',
        type: 'error'
      });
    }
  };

${this.generateDesktopFormMethods(form)}

  return (
    <div className={\`desktop-form \${form.name.toLowerCase()}-form \${className || ''}\`}>
      <div className="form-header">
        <h2>${form.name} Form</h2>
      </div>
      
      <form onSubmit={handleSubmit(handleFormSubmit)} className="form-body">
${form.fields.map(field => this.generateDesktopFormField(field)).join('\n\n')}
        
        <div className="form-actions">
          <Button 
            type="submit" 
            disabled={isSubmitting}
            variant="primary"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
          
          <Button 
            type="button" 
            variant="secondary"
            onClick={handleFormReset}
          >
            Reset
          </Button>
          
          <Button 
            type="button" 
            variant="outline"
            onClick={handleSaveAsDraft}
          >
            Save as Draft
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ${form.name}Form;
`;
  }

  private generateTestFile(context: TemplateContext, scenario: any): string {
    const { tests } = context;
    if (!tests) throw new GeneratorError('Test context required', 'desktop', 'test');

    return `/**
 * ${scenario.name} Desktop Test
 * Auto-generated from Profile.ui specification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { IPCProvider } from '../renderer/contexts/IPCContext';

// Mock electron APIs
const mockInvoke = vi.fn();
global.window.electronAPI = {
  invoke: mockInvoke,
};

// Import components to test
${this.getTestComponentImports(scenario)}

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <IPCProvider>
        {component}
      </IPCProvider>
    </BrowserRouter>
  );
};

describe('${scenario.name}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('${scenario.description}', async () => {
    const user = userEvent.setup();
    
    ${this.generateDesktopTestSteps(scenario.steps)}
  });
  
  it('handles IPC communication', async () => {
    renderWithProviders(<TestComponent />);
    
    // Simulate IPC call
    const button = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(button);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-z]+:[a-z]+$/),
        expect.any(Object)
      );
    });
  });
  
  it('handles desktop-specific features', async () => {
    renderWithProviders(<TestComponent />);
    
    // Test file operations
    mockInvoke.mockResolvedValueOnce({
      success: true,
      filePaths: ['/path/to/file.txt']
    });
    
    const fileButton = screen.getByRole('button', { name: /open file/i });
    await userEvent.click(fileButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fs:showOpenDialog', expect.any(Object));
    });
  });

  it('handles error states correctly', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('IPC Error'));
    
    renderWithProviders(<TestComponent />);
    
    const button = screen.getByRole('button');
    await userEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
`;
  }

  private async generateConfigFiles(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    // Generate package.json
    artifacts.push({
      type: 'config',
      filename: 'package.json',
      path: 'package.json',
      content: this.generatePackageJson(ui),
      platform: 'desktop',
    });

    // Generate Electron builder config
    artifacts.push({
      type: 'config',
      filename: 'electron-builder.json',
      path: 'electron-builder.json',
      content: this.generateElectronBuilderConfig(ui),
      platform: 'desktop',
    });

    // Generate preload script
    artifacts.push({
      type: 'config',
      filename: 'preload.ts',
      path: 'preload/preload.ts',
      content: this.generatePreloadScript(),
      platform: 'desktop',
    });

    // Generate TypeScript config
    if (this.config.typescript) {
      artifacts.push({
        type: 'config',
        filename: 'tsconfig.json',
        path: 'tsconfig.json',
        content: this.generateTsConfig(),
        platform: 'desktop',
      });
    }

    return artifacts;
  }

  // Utility methods

  private getWindowNameFromPath(path: string): string {
    return path
      .replace(/^\//, '')
      .replace(/\/:/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .replace(/^./, str => str.toUpperCase()) || 'Unknown';
  }

  private getAppTitle(ui: ProfileUI): string {
    return ui.config?.name || 'Generated Desktop Application';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getTypeFromValue(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'any[]';
    return 'any';
  }

  private generateFormIPCHandlers(formName: string, form: Form): string {
    return `  // ${formName} form handlers
  ipcMain.handle('form:${formName.toLowerCase()}:submit', async (event, data) => {
    try {
      // Process form data
      console.log('Processing ${formName} form:', data);
      
      // You can add form-specific processing here
      // For example: database operations, file operations, etc.
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('form:${formName.toLowerCase()}:validate', async (event, data) => {
    try {
      // Add custom validation logic here
      const errors = [];
      
${form.fields.filter(f => f.required).map(field => `
      if (!data.${field.name}) {
        errors.push('${field.label} is required');
      }`).join('')}
      
      return { success: errors.length === 0, errors };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });`;
  }

  private generateComponentIPCHandlers(componentName: string, component: Component): string {
    return `  // ${componentName} component handlers
  ipcMain.handle('component:${componentName.toLowerCase()}:action', async (event, actionData) => {
    try {
      // Handle component-specific actions
      console.log('${componentName} action:', actionData);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });`;
  }

  private generateFormIPCMethods(formName: string): string {
    return `  // ${formName} form methods
  static async submitForm(data: any): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.invoke('form:${formName.toLowerCase()}:submit', data);
  }

  static async validateForm(data: any): Promise<{ success: boolean; errors?: string[] }> {
    return window.electronAPI.invoke('form:${formName.toLowerCase()}:validate', data);
  }`;
  }

  private generateComponentIPCMethods(componentName: string): string {
    return `  // ${componentName} component methods
  static async performAction(actionData: any): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.invoke('component:${componentName.toLowerCase()}:action', actionData);
  }`;
  }

  private generateComponentHooks(component: Component): string {
    return `  // Component-specific hooks and state
  const [componentState, setComponentState] = React.useState({});
  
  React.useEffect(() => {
    // Component initialization
    initializeComponent();
  }, []);
  
  const initializeComponent = async () => {
    // Initialize ${component.name} component
    try {
      const result = await invokeIPC('component:${component.name.toLowerCase()}:init', {});
      if (result.success) {
        setComponentState(result.data || {});
      }
    } catch (error) {
      console.error('Component initialization error:', error);
    }
  };`;
  }

  private generateComponentContent(component: Component): string {
    switch (component.type) {
      case 'list':
        return `        <div className="component-list">
          {/* List items will be rendered here */}
          <div className="list-controls">
            <button onClick={() => invokeIPC('component:${component.name.toLowerCase()}:refresh', {})}>
              Refresh
            </button>
          </div>
        </div>`;
      case 'form':
        return `        <div className="component-form">
          {/* Form elements will be rendered here */}
          <form>
            <input type="text" placeholder="Component form input" />
          </form>
        </div>`;
      default:
        return `        <div className="component-content">
          <p>This is the ${component.name} desktop component.</p>
          <p>Component type: {component.type}</p>
        </div>`;
    }
  }

  private generateComponentActions(component: Component): string {
    return `        <div className="component-actions">
          <button 
            onClick={() => invokeIPC('component:${component.name.toLowerCase()}:action', { type: 'primary' })}
            className="action-button primary"
          >
            Primary Action
          </button>
        </div>`;
  }

  private generateDesktopFormMethods(form: Form): string {
    return `
  const handleFormReset = () => {
    // Reset form to default values
    Object.keys(defaultValues || {}).forEach(key => {
      setValue(key as keyof ${form.name}Data, defaultValues![key as keyof ${form.name}Data]);
    });
  };

  const handleSaveAsDraft = async () => {
    try {
      const currentData = watch();
      await invokeIPC('form:${form.name.toLowerCase()}:saveDraft', currentData);
      
      // Show success notification
      await invokeIPC('notification:show', {
        title: 'Draft Saved',
        body: 'Form data saved as draft successfully.',
        type: 'success'
      });
    } catch (error) {
      console.error('Save draft error:', error);
    }
  };

  const handleFileSelect = async (fieldName: string) => {
    try {
      const result = await invokeIPC('fs:showOpenDialog', {
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        setValue(fieldName as keyof ${form.name}Data, result.filePaths[0] as any);
      }
    } catch (error) {
      console.error('File select error:', error);
    }
  };`;
  }

  private generateDesktopFormField(field: any): string {
    if (field.type === 'file') {
      return `        <div className="form-field">
          <label className="form-label">${field.label}</label>
          <FileInput
            {...register('${field.name}')}
            onFileSelect={() => handleFileSelect('${field.name}')}
            placeholder="${field.placeholder || 'Select file...'}"
            required={${field.required}}
          />
          {errors.${field.name} && (
            <p className="form-error">{errors.${field.name}?.message}</p>
          )}
        </div>`;
    }

    if (field.type === 'select' && field.options) {
      return `        <div className="form-field">
          <label className="form-label">${field.label}</label>
          <Select
            {...register('${field.name}')}
            placeholder="${field.placeholder || `Select ${field.label.toLowerCase()}`}"
          >
            <option value="">Select an option</option>
${field.options.map((option: any) => 
  `            <option value="${option.value}">${option.label}</option>`
).join('\n')}
          </Select>
          {errors.${field.name} && (
            <p className="form-error">{errors.${field.name}?.message}</p>
          )}
        </div>`;
    }

    if (field.type === 'textarea') {
      return `        <div className="form-field">
          <label className="form-label">${field.label}</label>
          <Textarea
            {...register('${field.name}')}
            placeholder="${field.placeholder || ''}"
            required={${field.required}}
            rows={4}
          />
          {errors.${field.name} && (
            <p className="form-error">{errors.${field.name}?.message}</p>
          )}
        </div>`;
    }

    return `        <div className="form-field">
          <label className="form-label">${field.label}</label>
          <Input
            type="${field.type}"
            {...register('${field.name}')}
            placeholder="${field.placeholder || ''}"
            required={${field.required}}
          />
          {errors.${field.name} && (
            <p className="form-error">{errors.${field.name}?.message}</p>
          )}
        </div>`;
  }

  private generateDesktopTestSteps(steps: any[]): string {
    return steps.map(step => {
      switch (step.action) {
        case 'click':
          return `    const button = screen.getByRole('button', { name: /${step.target}/i });
    await user.click(button);`;
        case 'fill':
          return `    const input = screen.getByLabelText('${step.target}');
    await user.type(input, '${step.value}');`;
        case 'expect':
          return `    expect(screen.getByText('${step.assertion}')).toBeInTheDocument();`;
        case 'navigate':
          return `    // Navigation to ${step.target} would be tested here
    window.location.hash = '${step.target}';`;
        default:
          return `    // ${step.action} step implementation for desktop`;
      }
    }).join('\n    ');
  }

  private getTestComponentImports(scenario: any): string {
    return `// Component imports would be generated based on the test scenario
// For example: import { TestComponent } from '../renderer/components/TestComponent';`;
  }

  // Import and dependency helpers

  private getWindowImports(): string[] {
    return ['react', 'react-router-dom'];
  }

  private getComponentImports(component: Component): string[] {
    return ['react'];
  }

  private getFormImports(): string[] {
    return ['react', 'react-hook-form', '@hookform/resolvers/zod', 'zod'];
  }

  private getTestImports(): string[] {
    return ['vitest', '@testing-library/react', '@testing-library/user-event'];
  }

  private getMainProcessDependencies(): string[] {
    return ['electron'];
  }

  private getRendererDependencies(): string[] {
    return ['react', 'react-dom', 'react-router-dom'];
  }

  private getWindowDependencies(): string[] {
    return ['react', 'react-router-dom'];
  }

  private getComponentDependencies(component: Component): string[] {
    return ['react'];
  }

  private getFormDependencies(): string[] {
    return ['react', 'react-hook-form', '@hookform/resolvers/zod', 'zod'];
  }

  private getTestDependencies(): string[] {
    return ['vitest', '@testing-library/react', '@testing-library/user-event'];
  }

  // Config generators

  private generatePackageJson(ui: ProfileUI): string {
    return `{
  "name": "${ui.config?.name || 'generated-desktop-app'}",
  "version": "1.0.0",
  "description": "Auto-generated desktop application from Profile.ui specification",
  "main": "dist/main/main.js",
  "homepage": "./",
  "scripts": {
    "electron": "electron .",
    "electron-dev": "ELECTRON_IS_DEV=true electron .",
    "build": "npm run build:main && npm run build:renderer",
    "build:main": "tsc -p tsconfig.main.json",
    "build:renderer": "vite build",
    "dev": "concurrently \\"npm run dev:renderer\\" \\"wait-on http://localhost:3000 && npm run electron-dev\\"",
    "dev:renderer": "vite",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "pack": "electron-builder --dir",
    "dist": "npm run build && electron-builder",
    "dist:win": "npm run build && electron-builder --win",
    "dist:mac": "npm run build && electron-builder --mac",
    "dist:linux": "npm run build && electron-builder --linux"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "react-hook-form": "^7.43.0",
    "@hookform/resolvers": "^3.0.0",
    "zod": "^3.20.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@types/node": "^20.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "concurrently": "^7.6.0",
    "wait-on": "^7.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}`;
  }

  private generateElectronBuilderConfig(ui: ProfileUI): string {
    return `{
  "appId": "com.${ui.config?.name?.replace(/[^a-zA-Z0-9]/g, '') || 'generatedapp'}.app",
  "productName": "${ui.config?.name || 'Generated Desktop App'}",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  "mac": {
    "category": "public.app-category.productivity",
    "target": [
      {
        "target": "dmg",
        "arch": ["x64", "arm64"]
      }
    ]
  },
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ]
  },
  "linux": {
    "target": [
      {
        "target": "AppImage",
        "arch": ["x64"]
      }
    ]
  },
  "nsis": {
    "oneClick": false,
    "allowElevation": true,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}`;
  }

  private generatePreloadScript(): string {
    return `/**
 * Preload Script
 * Exposes safe IPC APIs to renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer process
const electronAPI = {
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type definition for the exposed API
export type ElectronAPI = typeof electronAPI;
`;
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
    },
    "jsx": "react-jsx"
  },
  "include": [
    "src/**/*",
    "main/**/*",
    "renderer/**/*",
    "preload/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "release",
    "**/*.test.ts",
    "**/*.test.tsx"
  ]
}`;
  }
}