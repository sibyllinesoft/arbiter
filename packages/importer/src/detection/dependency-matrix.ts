/**
 * Dependency Matrix for Language/Category Detection
 *
 * This module provides comprehensive mapping of dependencies to artifact categories
 * across multiple programming languages. Each category has distinguishing imports
 * that help identify the primary purpose of a codebase.
 */

export interface DependencyPattern {
  /** The dependency/import name or pattern */
  name: string;
  /** Weight of this dependency for category determination (0-1) */
  weight: number;
  /** Additional context or notes about this dependency */
  context?: string;
  /** Alternative names or aliases for this dependency */
  aliases?: string[];
}

export interface CategoryMatrix {
  tool: DependencyPattern[];
  web_service: DependencyPattern[];
  frontend: DependencyPattern[];
  module: DependencyPattern[];
  desktop_app: DependencyPattern[];
  data_processing: DependencyPattern[];
  testing: DependencyPattern[];
  build_tool: DependencyPattern[];
  game: DependencyPattern[];
  mobile: DependencyPattern[];
}

export interface LanguageMatrix {
  [language: string]: CategoryMatrix;
}

/**
 * Comprehensive dependency matrix for multiple languages
 */
export const DEPENDENCY_MATRIX: LanguageMatrix = {
  javascript: {
    tool: [
      { name: "commander", weight: 0.9, context: "Command-line argument parsing" },
      { name: "yargs", weight: 0.9, context: "Command-line argument parsing" },
      { name: "inquirer", weight: 0.8, context: "Interactive CLI prompts" },
      { name: "chalk", weight: 0.7, context: "Terminal text styling" },
      { name: "ora", weight: 0.7, context: "Terminal spinners" },
      { name: "boxen", weight: 0.6, context: "Terminal boxes" },
      { name: "cli-table3", weight: 0.6, context: "Terminal tables" },
      { name: "figlet", weight: 0.6, context: "ASCII art text" },
      { name: "minimist", weight: 0.5, context: "Minimal argument parsing" },
      { name: "cosmiconfig", weight: 0.5, context: "Configuration loading" },
      { name: "meow", weight: 0.8, context: "CLI app helper" },
      { name: "arg", weight: 0.6, context: "Argument parsing" },
      { name: "prompts", weight: 0.7, context: "Terminal prompts" },
      { name: "cli-progress", weight: 0.6, context: "Progress bars" },
      { name: "kleur", weight: 0.6, context: "Terminal colors" },
      { name: "cfonts", weight: 0.5, context: "ASCII fonts" },
      { name: "terminal-kit", weight: 0.6, context: "Terminal UI toolkit" },
      { name: "blessed", weight: 0.7, context: "Terminal UI library" },
      { name: "ink", weight: 0.8, context: "React for CLI apps" },
      { name: "caporal", weight: 0.7, context: "CLI framework" },
    ],
    web_service: [
      { name: "express", weight: 0.9, context: "Web framework" },
      { name: "fastify", weight: 0.9, context: "High-performance web framework" },
      { name: "koa", weight: 0.9, context: "Web framework" },
      { name: "hono", weight: 0.9, context: "Ultrafast web framework" },
      { name: "hapi", weight: 0.8, context: "Web framework" },
      {
        name: "nestjs",
        weight: 0.8,
        context: "Enterprise web framework",
        aliases: ["@nestjs/core"],
      },
      { name: "apollo-server", weight: 0.8, context: "GraphQL server" },
      { name: "socket.io", weight: 0.7, context: "WebSocket server" },
      { name: "cors", weight: 0.6, context: "CORS middleware" },
      { name: "helmet", weight: 0.6, context: "Security middleware" },
      { name: "body-parser", weight: 0.5, context: "Request parsing middleware" },
      { name: "restify", weight: 0.8, context: "REST API framework" },
      { name: "loopback", weight: 0.7, context: "API framework" },
      { name: "sails", weight: 0.7, context: "MVC framework" },
      { name: "feathers", weight: 0.7, context: "Real-time framework" },
      { name: "strapi", weight: 0.8, context: "Headless CMS" },
      { name: "adonis", weight: 0.8, context: "Full-stack framework" },
      { name: "micro", weight: 0.6, context: "Microservice framework" },
      { name: "polka", weight: 0.6, context: "Micro web framework" },
      { name: "graphql", weight: 0.6, context: "GraphQL" },
      { name: "graphql-yoga", weight: 0.7, context: "GraphQL server" },
      { name: "ws", weight: 0.6, context: "WebSocket library" },
      { name: "compression", weight: 0.5, context: "Compression middleware" },
      { name: "morgan", weight: 0.5, context: "HTTP logger" },
      { name: "express-session", weight: 0.5, context: "Session middleware" },
      { name: "passport", weight: 0.6, context: "Authentication middleware" },
      { name: "jsonwebtoken", weight: 0.5, context: "JWT implementation" },
      { name: "bcrypt", weight: 0.5, context: "Password hashing" },
      { name: "bcryptjs", weight: 0.5, context: "Password hashing" },
    ],
    frontend: [
      { name: "react", weight: 0.9, context: "UI library" },
      { name: "vue", weight: 0.9, context: "UI framework" },
      { name: "angular", weight: 0.9, context: "UI framework", aliases: ["@angular/core"] },
      { name: "svelte", weight: 0.9, context: "UI framework" },
      { name: "solid-js", weight: 0.8, context: "UI library" },
      { name: "preact", weight: 0.8, context: "Lightweight React alternative" },
      { name: "lit", weight: 0.7, context: "Web components library" },
      { name: "stimulus", weight: 0.6, context: "Modest JavaScript framework" },
      { name: "alpine.js", weight: 0.6, context: "Lightweight JavaScript framework" },
      { name: "next", weight: 0.8, context: "React framework", aliases: ["next.js"] },
    ],
    module: [
      { name: "lodash", weight: 0.7, context: "Utility library" },
      { name: "axios", weight: 0.6, context: "HTTP client" },
      { name: "moment", weight: 0.6, context: "Date manipulation" },
      { name: "uuid", weight: 0.5, context: "UUID generation" },
      { name: "ramda", weight: 0.6, context: "Functional programming utilities" },
      { name: "date-fns", weight: 0.6, context: "Date utility library" },
      { name: "immutable", weight: 0.6, context: "Immutable data structures" },
      { name: "rxjs", weight: 0.6, context: "Reactive programming" },
      { name: "zod", weight: 0.6, context: "Schema validation" },
      { name: "joi", weight: 0.6, context: "Schema validation" },
      { name: "underscore", weight: 0.6, context: "Utility library" },
      { name: "dayjs", weight: 0.5, context: "Date library" },
      { name: "luxon", weight: 0.5, context: "Date/time library" },
      { name: "validator", weight: 0.6, context: "Validation library" },
      { name: "nanoid", weight: 0.5, context: "ID generation" },
      { name: "shortid", weight: 0.5, context: "Short ID generation" },
      { name: "slugify", weight: 0.5, context: "URL slug generation" },
      { name: "classnames", weight: 0.5, context: "CSS class helper" },
      { name: "clsx", weight: 0.5, context: "CSS class helper" },
      { name: "qs", weight: 0.5, context: "Query string parser" },
      { name: "query-string", weight: 0.5, context: "Query string parser" },
      { name: "path-to-regexp", weight: 0.5, context: "Path matching" },
      { name: "js-cookie", weight: 0.4, context: "Cookie handling" },
      { name: "localforage", weight: 0.4, context: "Storage module" },
      { name: "yup", weight: 0.6, context: "Schema validation" },
    ],
    desktop_app: [
      { name: "electron", weight: 0.9, context: "Desktop app framework" },
      { name: "tauri", weight: 0.9, context: "Desktop app framework" },
      { name: "nw.js", weight: 0.8, context: "Desktop app framework" },
      { name: "node-ffi", weight: 0.6, context: "Native library bindings" },
      { name: "robotjs", weight: 0.6, context: "Desktop automation" },
      { name: "electron-builder", weight: 0.7, context: "Electron packaging" },
      { name: "electron-updater", weight: 0.6, context: "Auto-updater for Electron" },
      { name: "menubar", weight: 0.5, context: "Menu bar applications" },
      { name: "systray", weight: 0.5, context: "System tray applications" },
      { name: "node-notifier", weight: 0.4, context: "Desktop notifications" },
    ],
    data_processing: [
      { name: "cheerio", weight: 0.7, context: "HTML parsing and manipulation" },
      { name: "csv-parser", weight: 0.7, context: "CSV processing" },
      { name: "xml2js", weight: 0.6, context: "XML processing" },
      { name: "sharp", weight: 0.7, context: "Image processing" },
      { name: "jimp", weight: 0.6, context: "Image manipulation" },
      { name: "pdf-parse", weight: 0.6, context: "PDF processing" },
      { name: "stream-transform", weight: 0.6, context: "Stream processing" },
      { name: "papaparse", weight: 0.6, context: "CSV parsing" },
      { name: "fast-csv", weight: 0.6, context: "CSV processing" },
      { name: "mammoth", weight: 0.5, context: "Document processing" },
    ],
    testing: [
      { name: "jest", weight: 0.8, context: "Testing framework" },
      { name: "mocha", weight: 0.8, context: "Testing framework" },
      { name: "vitest", weight: 0.8, context: "Testing framework" },
      { name: "cypress", weight: 0.7, context: "E2E testing" },
      { name: "playwright", weight: 0.7, context: "E2E testing" },
      { name: "puppeteer", weight: 0.7, context: "Browser automation" },
      { name: "chai", weight: 0.6, context: "Assertion library" },
      { name: "sinon", weight: 0.6, context: "Mocking library" },
      { name: "supertest", weight: 0.6, context: "HTTP assertion library" },
      { name: "@testing-library/react", weight: 0.6, context: "React testing utilities" },
    ],
    build_tool: [
      { name: "webpack", weight: 0.8, context: "Module bundler" },
      { name: "vite", weight: 0.8, context: "Build tool" },
      { name: "rollup", weight: 0.8, context: "Module bundler" },
      { name: "parcel", weight: 0.7, context: "Build tool" },
      { name: "esbuild", weight: 0.7, context: "Fast bundler" },
      { name: "babel", weight: 0.6, context: "JavaScript compiler", aliases: ["@babel/core"] },
      { name: "typescript", weight: 0.6, context: "TypeScript compiler" },
      { name: "eslint", weight: 0.5, context: "Code linter" },
      { name: "prettier", weight: 0.4, context: "Code formatter" },
      { name: "gulp", weight: 0.6, context: "Task runner" },
    ],
    game: [
      { name: "phaser", weight: 0.9, context: "Game framework" },
      { name: "three", weight: 0.8, context: "3D graphics library" },
      { name: "babylon.js", weight: 0.8, context: "3D engine" },
      { name: "pixi.js", weight: 0.7, context: "2D graphics library" },
      { name: "matter.js", weight: 0.6, context: "Physics engine" },
      { name: "cannon", weight: 0.6, context: "Physics engine" },
      { name: "howler", weight: 0.5, context: "Audio library" },
      { name: "createjs", weight: 0.5, context: "Interactive content creation" },
      { name: "konva", weight: 0.5, context: "2D canvas library" },
      { name: "aframe", weight: 0.6, context: "VR/AR framework" },
    ],
    mobile: [
      { name: "react-native", weight: 0.9, context: "Mobile app framework" },
      { name: "expo", weight: 0.8, context: "React Native platform" },
      {
        name: "ionic",
        weight: 0.8,
        context: "Hybrid mobile framework",
        aliases: ["@ionic/react", "@ionic/angular"],
      },
      { name: "capacitor", weight: 0.7, context: "Native bridge" },
      { name: "cordova", weight: 0.6, context: "Mobile app platform" },
      { name: "nativescript", weight: 0.7, context: "Mobile framework" },
      { name: "quasar", weight: 0.6, context: "Vue-based mobile framework" },
      { name: "framework7", weight: 0.6, context: "Mobile framework" },
      { name: "onsen", weight: 0.5, context: "Mobile UI framework" },
      { name: "phonegap", weight: 0.4, context: "Mobile app platform (deprecated)" },
    ],
  },

  typescript: {
    tool: [
      { name: "commander", weight: 0.9, context: "Command-line argument parsing" },
      { name: "yargs", weight: 0.9, context: "Command-line argument parsing" },
      { name: "inquirer", weight: 0.8, context: "Interactive CLI prompts" },
      { name: "chalk", weight: 0.7, context: "Terminal text styling" },
      { name: "ora", weight: 0.7, context: "Terminal spinners" },
      { name: "boxen", weight: 0.6, context: "Terminal boxes" },
      { name: "cli-table3", weight: 0.6, context: "Terminal tables" },
      { name: "oclif", weight: 0.8, context: "CLI framework" },
      { name: "clipanion", weight: 0.7, context: "Type-safe CLI framework" },
      { name: "cac", weight: 0.6, context: "Command and Conquer CLI framework" },
    ],
    web_service: [
      { name: "express", weight: 0.9, context: "Web framework" },
      { name: "fastify", weight: 0.9, context: "High-performance web framework" },
      { name: "koa", weight: 0.9, context: "Web framework" },
      { name: "hono", weight: 0.9, context: "Ultrafast web framework" },
      { name: "@nestjs/core", weight: 0.9, context: "Enterprise framework" },
      { name: "hapi", weight: 0.8, context: "Web framework" },
      { name: "apollo-server-express", weight: 0.8, context: "GraphQL server" },
      { name: "type-graphql", weight: 0.7, context: "GraphQL with TypeScript" },
      { name: "typeorm", weight: 0.7, context: "ORM with TypeScript" },
      { name: "prisma", weight: 0.7, context: "Next-generation ORM" },
      { name: "trpc", weight: 0.8, context: "Type-safe API framework" },
    ],
    frontend: [
      { name: "react", weight: 0.9, context: "UI library" },
      { name: "vue", weight: 0.9, context: "UI framework" },
      { name: "@angular/core", weight: 0.9, context: "UI framework" },
      { name: "svelte", weight: 0.9, context: "UI framework" },
      { name: "solid-js", weight: 0.8, context: "UI library" },
      { name: "next", weight: 0.8, context: "React framework" },
      { name: "nuxt", weight: 0.8, context: "Vue framework" },
      { name: "remix", weight: 0.7, context: "Full-stack React framework" },
      { name: "gatsby", weight: 0.7, context: "Static site generator" },
      { name: "lit", weight: 0.7, context: "Web components library" },
    ],
    module: [
      { name: "zod", weight: 0.8, context: "Schema validation" },
      { name: "joi", weight: 0.7, context: "Schema validation" },
      { name: "class-validator", weight: 0.7, context: "Decorator-based validation" },
      { name: "fp-ts", weight: 0.7, context: "Functional programming" },
      { name: "io-ts", weight: 0.6, context: "Runtime type checking" },
      { name: "rxjs", weight: 0.7, context: "Reactive programming" },
      { name: "ramda", weight: 0.6, context: "Functional utilities" },
      { name: "date-fns", weight: 0.6, context: "Date utilities" },
      { name: "class-transformer", weight: 0.6, context: "Object transformation" },
      { name: "reflect-metadata", weight: 0.5, context: "Metadata reflection" },
    ],
    desktop_app: [
      { name: "electron", weight: 0.9, context: "Desktop app framework" },
      { name: "tauri", weight: 0.9, context: "Rust-based desktop framework" },
      { name: "@electron/remote", weight: 0.7, context: "Electron remote module" },
      { name: "electron-builder", weight: 0.7, context: "Electron packaging" },
      { name: "electron-updater", weight: 0.6, context: "Auto-updater" },
      { name: "spectron", weight: 0.5, context: "Electron testing" },
      { name: "nw.js", weight: 0.7, context: "Desktop app framework" },
      { name: "neutralino", weight: 0.6, context: "Lightweight desktop framework" },
      { name: "node-ffi-napi", weight: 0.5, context: "Native bindings" },
      { name: "ref-napi", weight: 0.4, context: "Native type handling" },
    ],
    data_processing: [
      { name: "csv-parse", weight: 0.7, context: "CSV processing with types" },
      { name: "xml2js", weight: 0.6, context: "XML processing" },
      { name: "sharp", weight: 0.7, context: "Image processing" },
      { name: "pdf2pic", weight: 0.6, context: "PDF to image conversion" },
      { name: "xlsx", weight: 0.7, context: "Excel file processing" },
      { name: "cheerio", weight: 0.6, context: "Server-side jQuery" },
      { name: "node-html-parser", weight: 0.6, context: "Fast HTML parser" },
      { name: "fast-xml-parser", weight: 0.6, context: "Fast XML parser" },
      { name: "papaparse", weight: 0.5, context: "CSV parser" },
      { name: "jsdom", weight: 0.5, context: "DOM implementation" },
    ],
    testing: [
      { name: "jest", weight: 0.8, context: "Testing framework" },
      { name: "vitest", weight: 0.8, context: "Vite-native testing" },
      { name: "playwright", weight: 0.7, context: "E2E testing" },
      { name: "@playwright/test", weight: 0.7, context: "Playwright test runner" },
      { name: "cypress", weight: 0.7, context: "E2E testing" },
      { name: "@testing-library/react", weight: 0.6, context: "React testing" },
      { name: "supertest", weight: 0.6, context: "HTTP testing" },
      { name: "ts-jest", weight: 0.6, context: "Jest TypeScript support" },
      { name: "@types/jest", weight: 0.5, context: "Jest type definitions" },
      { name: "ava", weight: 0.6, context: "Test runner" },
    ],
    build_tool: [
      { name: "typescript", weight: 0.9, context: "TypeScript compiler" },
      { name: "vite", weight: 0.8, context: "Build tool" },
      { name: "webpack", weight: 0.7, context: "Module bundler" },
      { name: "rollup", weight: 0.7, context: "Module bundler" },
      { name: "esbuild", weight: 0.7, context: "Fast bundler" },
      { name: "tsup", weight: 0.7, context: "TypeScript bundler" },
      { name: "microbundle", weight: 0.6, context: "Zero-config bundler" },
      { name: "ts-node", weight: 0.6, context: "TypeScript execution" },
      { name: "tsx", weight: 0.6, context: "TypeScript execution" },
      { name: "tsc-watch", weight: 0.5, context: "TypeScript watch mode" },
    ],
    game: [
      { name: "phaser", weight: 0.9, context: "Game framework" },
      { name: "three", weight: 0.8, context: "3D graphics" },
      { name: "@types/three", weight: 0.7, context: "Three.js types" },
      { name: "babylon.js", weight: 0.8, context: "3D engine" },
      { name: "pixi.js", weight: 0.7, context: "2D graphics" },
      { name: "matter.js", weight: 0.6, context: "Physics engine" },
      { name: "@types/matter-js", weight: 0.5, context: "Matter.js types" },
      { name: "cannon-es", weight: 0.6, context: "Physics engine" },
      { name: "howler", weight: 0.5, context: "Audio library" },
      { name: "excalibur", weight: 0.6, context: "TypeScript game engine" },
    ],
    mobile: [
      { name: "react-native", weight: 0.9, context: "Mobile framework" },
      { name: "@react-native/metro-config", weight: 0.7, context: "React Native config" },
      { name: "expo", weight: 0.8, context: "React Native platform" },
      { name: "@ionic/react", weight: 0.8, context: "Ionic React" },
      { name: "@ionic/angular", weight: 0.8, context: "Ionic Angular" },
      { name: "@capacitor/core", weight: 0.7, context: "Capacitor core" },
      { name: "nativescript", weight: 0.7, context: "NativeScript" },
      { name: "@nativescript/core", weight: 0.7, context: "NativeScript core" },
      { name: "quasar", weight: 0.6, context: "Vue mobile framework" },
      { name: "framework7", weight: 0.5, context: "Mobile UI framework" },
    ],
  },

  python: {
    tool: [
      { name: "click", weight: 0.9, context: "Command-line interface creation kit" },
      { name: "argparse", weight: 0.8, context: "Argument parsing (built-in)" },
      { name: "typer", weight: 0.9, context: "Modern CLI framework" },
      { name: "fire", weight: 0.7, context: "Automatic CLI generation" },
      { name: "docopt", weight: 0.6, context: "Command-line interface from docstrings" },
      { name: "rich", weight: 0.7, context: "Rich text and beautiful formatting" },
      { name: "colorama", weight: 0.6, context: "Cross-platform colored terminal text" },
      { name: "tqdm", weight: 0.6, context: "Progress bars" },
      { name: "questionary", weight: 0.6, context: "Interactive command line prompts" },
      { name: "prompt_toolkit", weight: 0.5, context: "Building interactive command lines" },
    ],
    web_service: [
      { name: "fastapi", weight: 0.9, context: "Modern web framework" },
      { name: "django", weight: 0.9, context: "High-level web framework" },
      { name: "flask", weight: 0.9, context: "Micro web framework" },
      { name: "tornado", weight: 0.7, context: "Asynchronous web framework" },
      { name: "sanic", weight: 0.7, context: "Async web framework" },
      { name: "starlette", weight: 0.7, context: "ASGI framework" },
      { name: "aiohttp", weight: 0.7, context: "Async HTTP client/server" },
      { name: "bottle", weight: 0.6, context: "Micro web framework" },
      { name: "falcon", weight: 0.6, context: "Minimalist web framework" },
      { name: "pyramid", weight: 0.6, context: "Web framework" },
    ],
    frontend: [
      { name: "streamlit", weight: 0.9, context: "Data app framework" },
      { name: "dash", weight: 0.8, context: "Web app framework for Python" },
      { name: "gradio", weight: 0.8, context: "ML model interfaces" },
      { name: "panel", weight: 0.7, context: "Data visualization apps" },
      { name: "bokeh", weight: 0.7, context: "Interactive visualization" },
      { name: "plotly", weight: 0.6, context: "Interactive plotting" },
      { name: "voila", weight: 0.6, context: "Jupyter notebook as web app" },
      { name: "anvil", weight: 0.5, context: "Web app framework" },
      { name: "nicegui", weight: 0.6, context: "Modern web UI framework" },
      { name: "reflex", weight: 0.7, context: "Pure Python web framework" },
    ],
    module: [
      { name: "requests", weight: 0.7, context: "HTTP library" },
      { name: "numpy", weight: 0.7, context: "Numerical computing" },
      { name: "pandas", weight: 0.7, context: "Data analysis" },
      { name: "scipy", weight: 0.6, context: "Scientific computing" },
      { name: "matplotlib", weight: 0.6, context: "Plotting library" },
      { name: "pydantic", weight: 0.7, context: "Data validation" },
      { name: "attrs", weight: 0.5, context: "Classes without boilerplate" },
      { name: "httpx", weight: 0.6, context: "HTTP client" },
      { name: "aiofiles", weight: 0.5, context: "Async file operations" },
      { name: "python-dateutil", weight: 0.5, context: "Date utilities" },
    ],
    desktop_app: [
      { name: "tkinter", weight: 0.8, context: "GUI toolkit (built-in)" },
      { name: "pyqt5", weight: 0.8, context: "Qt-based GUI toolkit" },
      { name: "pyqt6", weight: 0.8, context: "Qt6-based GUI toolkit" },
      { name: "pyside2", weight: 0.8, context: "Qt for Python" },
      { name: "pyside6", weight: 0.8, context: "Qt6 for Python" },
      { name: "kivy", weight: 0.7, context: "Multi-platform GUI framework" },
      { name: "wxpython", weight: 0.6, context: "Native GUI toolkit" },
      { name: "toga", weight: 0.6, context: "Native GUI toolkit" },
      { name: "flet", weight: 0.7, context: "Flutter-based GUI" },
      { name: "customtkinter", weight: 0.6, context: "Modern tkinter" },
    ],
    data_processing: [
      { name: "pandas", weight: 0.9, context: "Data manipulation and analysis" },
      { name: "numpy", weight: 0.8, context: "Numerical arrays" },
      { name: "dask", weight: 0.7, context: "Parallel computing" },
      { name: "polars", weight: 0.7, context: "Fast DataFrame library" },
      { name: "openpyxl", weight: 0.6, context: "Excel file processing" },
      { name: "xlsxwriter", weight: 0.5, context: "Excel file creation" },
      { name: "beautifulsoup4", weight: 0.6, context: "HTML/XML parsing" },
      { name: "lxml", weight: 0.6, context: "XML processing" },
      { name: "pyarrow", weight: 0.6, context: "Columnar data processing" },
      { name: "h5py", weight: 0.5, context: "HDF5 file processing" },
    ],
    testing: [
      { name: "pytest", weight: 0.9, context: "Testing framework" },
      { name: "unittest", weight: 0.7, context: "Testing framework (built-in)" },
      { name: "nose2", weight: 0.5, context: "Testing framework" },
      { name: "hypothesis", weight: 0.6, context: "Property-based testing" },
      { name: "mock", weight: 0.5, context: "Mock object library" },
      { name: "responses", weight: 0.5, context: "HTTP mocking" },
      { name: "factory_boy", weight: 0.5, context: "Test data generation" },
      { name: "faker", weight: 0.5, context: "Fake data generation" },
      { name: "selenium", weight: 0.6, context: "Web testing" },
      { name: "playwright", weight: 0.6, context: "Modern web testing" },
    ],
    build_tool: [
      { name: "setuptools", weight: 0.7, context: "Package building" },
      { name: "wheel", weight: 0.6, context: "Built distribution format" },
      { name: "build", weight: 0.6, context: "PEP 517 build frontend" },
      { name: "poetry", weight: 0.8, context: "Dependency management and packaging" },
      { name: "hatch", weight: 0.7, context: "Modern project manager" },
      { name: "flit", weight: 0.6, context: "Simple packaging tool" },
      { name: "pdm", weight: 0.6, context: "Modern dependency manager" },
      { name: "pipenv", weight: 0.5, context: "Package manager" },
      { name: "black", weight: 0.5, context: "Code formatter" },
      { name: "ruff", weight: 0.6, context: "Fast linter" },
    ],
    game: [
      { name: "pygame", weight: 0.9, context: "Game development library" },
      { name: "arcade", weight: 0.8, context: "Modern Python game library" },
      { name: "panda3d", weight: 0.7, context: "3D game engine" },
      { name: "pyglet", weight: 0.6, context: "OpenGL graphics library" },
      { name: "kivy", weight: 0.6, context: "Multi-platform framework" },
      { name: "cocos2d", weight: 0.5, context: "2D game framework" },
      { name: "moderngl", weight: 0.5, context: "Modern OpenGL wrapper" },
      { name: "pymunk", weight: 0.5, context: "Physics engine" },
      { name: "wasabi2d", weight: 0.4, context: "Easy game development" },
      { name: "ren-py", weight: 0.6, context: "Visual novel engine", aliases: ["renpy"] },
    ],
    mobile: [
      { name: "kivy", weight: 0.8, context: "Cross-platform framework" },
      { name: "kivymd", weight: 0.7, context: "Material Design for Kivy" },
      { name: "beeware", weight: 0.7, context: "Native app development" },
      { name: "toga", weight: 0.7, context: "Native GUI toolkit" },
      { name: "briefcase", weight: 0.6, context: "App packaging tool" },
      { name: "python-for-android", weight: 0.6, context: "Android development" },
      { name: "rubicon-java", weight: 0.4, context: "Java bridge for mobile" },
      { name: "chaquopy", weight: 0.5, context: "Python on Android" },
      { name: "pyjnius", weight: 0.4, context: "Python-Java bridge" },
      { name: "plyer", weight: 0.4, context: "Platform-specific features" },
    ],
  },

  rust: {
    tool: [
      { name: "clap", weight: 0.9, context: "Command line argument parser" },
      { name: "structopt", weight: 0.8, context: "Derive-based CLI (deprecated, use clap)" },
      { name: "argh", weight: 0.7, context: "Derive-based CLI" },
      { name: "gumdrop", weight: 0.6, context: "Option parser" },
      { name: "anyhow", weight: 0.7, context: "Error handling" },
      { name: "thiserror", weight: 0.6, context: "Error derive macros" },
      { name: "color-eyre", weight: 0.6, context: "Error reporting" },
      { name: "indicatif", weight: 0.7, context: "Progress bars" },
      { name: "console", weight: 0.6, context: "Terminal utilities" },
      { name: "dialoguer", weight: 0.6, context: "Interactive prompts" },
    ],
    web_service: [
      { name: "axum", weight: 0.9, context: "Modern web framework" },
      { name: "warp", weight: 0.8, context: "Composable web framework" },
      { name: "actix-web", weight: 0.8, context: "Actor-based web framework" },
      { name: "rocket", weight: 0.8, context: "Type-safe web framework" },
      { name: "tide", weight: 0.7, context: "Modular web framework" },
      { name: "hyper", weight: 0.7, context: "HTTP implementation" },
      { name: "tower", weight: 0.6, context: "Service trait and utilities" },
      { name: "tokio", weight: 0.8, context: "Async runtime" },
      { name: "async-std", weight: 0.6, context: "Async standard library" },
      { name: "sqlx", weight: 0.7, context: "SQL database driver" },
    ],
    frontend: [
      { name: "yew", weight: 0.9, context: "React-like framework for WebAssembly" },
      { name: "leptos", weight: 0.8, context: "Full-stack web framework" },
      { name: "dioxus", weight: 0.8, context: "Cross-platform GUI" },
      { name: "sycamore", weight: 0.7, context: "Reactive web framework" },
      { name: "seed", weight: 0.6, context: "Frontend framework" },
      { name: "wasm-bindgen", weight: 0.7, context: "WebAssembly bindings" },
      { name: "js-sys", weight: 0.6, context: "JavaScript API bindings" },
      { name: "web-sys", weight: 0.6, context: "Web API bindings" },
      { name: "stdweb", weight: 0.5, context: "Web platform (deprecated)" },
      { name: "gloo", weight: 0.6, context: "Web development utilities" },
    ],
    module: [
      { name: "serde", weight: 0.8, context: "Serialization framework" },
      { name: "tokio", weight: 0.7, context: "Async runtime" },
      { name: "reqwest", weight: 0.7, context: "HTTP client" },
      { name: "chrono", weight: 0.6, context: "Date and time library" },
      { name: "uuid", weight: 0.5, context: "UUID generation" },
      { name: "regex", weight: 0.6, context: "Regular expressions" },
      { name: "log", weight: 0.6, context: "Logging facade" },
      { name: "env_logger", weight: 0.5, context: "Logger implementation" },
      { name: "rayon", weight: 0.6, context: "Data parallelism" },
      { name: "itertools", weight: 0.5, context: "Iterator utilities" },
    ],
    desktop_app: [
      { name: "tauri", weight: 0.9, context: "Desktop app framework" },
      { name: "egui", weight: 0.8, context: "Immediate mode GUI" },
      { name: "iced", weight: 0.8, context: "Cross-platform GUI" },
      { name: "druid", weight: 0.7, context: "Native GUI toolkit" },
      { name: "gtk4", weight: 0.7, context: "GTK bindings" },
      { name: "fltk", weight: 0.6, context: "FLTK bindings" },
      { name: "slint", weight: 0.7, context: "Native GUI toolkit" },
      { name: "conrod", weight: 0.5, context: "GUI library" },
      { name: "azul", weight: 0.5, context: "Desktop app framework" },
      { name: "relm4", weight: 0.6, context: "GTK4 GUI library" },
    ],
    data_processing: [
      { name: "polars", weight: 0.8, context: "Fast DataFrame library" },
      { name: "csv", weight: 0.7, context: "CSV processing" },
      { name: "serde_json", weight: 0.7, context: "JSON processing" },
      { name: "toml", weight: 0.6, context: "TOML parsing" },
      { name: "yaml-rust", weight: 0.5, context: "YAML processing" },
      { name: "roxmltree", weight: 0.5, context: "XML parsing" },
      { name: "image", weight: 0.6, context: "Image processing" },
      { name: "calamine", weight: 0.5, context: "Excel file reading" },
      { name: "arrow", weight: 0.6, context: "Columnar data processing" },
      { name: "datafusion", weight: 0.6, context: "Query engine" },
    ],
    testing: [
      { name: "criterion", weight: 0.7, context: "Benchmarking library" },
      { name: "proptest", weight: 0.6, context: "Property-based testing" },
      { name: "quickcheck", weight: 0.5, context: "Property-based testing" },
      { name: "mockall", weight: 0.6, context: "Mock generation" },
      { name: "serial_test", weight: 0.5, context: "Serial test execution" },
      { name: "rstest", weight: 0.6, context: "Parameterized testing" },
      { name: "pretty_assertions", weight: 0.4, context: "Better assertion output" },
      { name: "insta", weight: 0.5, context: "Snapshot testing" },
      { name: "wiremock", weight: 0.4, context: "HTTP mocking" },
      { name: "assert_cmd", weight: 0.5, context: "CLI testing" },
    ],
    build_tool: [
      { name: "cargo", weight: 0.9, context: "Package manager and build tool" },
      { name: "cargo-watch", weight: 0.6, context: "File watching" },
      { name: "cargo-make", weight: 0.5, context: "Task runner" },
      { name: "cargo-edit", weight: 0.5, context: "Dependency management" },
      { name: "cargo-outdated", weight: 0.4, context: "Outdated dependencies check" },
      { name: "cargo-audit", weight: 0.4, context: "Security audit" },
      { name: "cargo-deny", weight: 0.4, context: "Cargo plugin for linting" },
      { name: "cargo-clippy", weight: 0.5, context: "Linting tool" },
      { name: "cargo-fmt", weight: 0.4, context: "Code formatting" },
      { name: "cross", weight: 0.5, context: "Cross compilation" },
    ],
    game: [
      { name: "bevy", weight: 0.9, context: "Game engine" },
      { name: "ggez", weight: 0.7, context: "2D game framework" },
      { name: "macroquad", weight: 0.7, context: "Simple game library" },
      { name: "bracket-lib", weight: 0.6, context: "Roguelike toolkit" },
      { name: "piston", weight: 0.6, context: "Game engine" },
      { name: "kiss3d", weight: 0.5, context: "3D graphics engine" },
      { name: "coffee", weight: 0.5, context: "2D game engine" },
      { name: "tetra", weight: 0.5, context: "2D game framework" },
      { name: "good-web-game", weight: 0.4, context: "Web game framework" },
      { name: "amethyst", weight: 0.6, context: "Game engine (archived)" },
    ],
    mobile: [
      { name: "tauri", weight: 0.8, context: "Mobile app framework" },
      { name: "dioxus", weight: 0.7, context: "Cross-platform mobile" },
      { name: "cargo-mobile", weight: 0.6, context: "Mobile development tools" },
      { name: "jni", weight: 0.5, context: "Java Native Interface" },
      { name: "android-ndk", weight: 0.5, context: "Android development" },
      { name: "winit", weight: 0.4, context: "Window creation (mobile support)" },
      { name: "wgpu", weight: 0.4, context: "Graphics API (mobile support)" },
      { name: "glutin", weight: 0.3, context: "OpenGL context (mobile)" },
      { name: "ndk", weight: 0.4, context: "Android NDK bindings" },
      { name: "mobile-entry-point", weight: 0.3, context: "Mobile app entry point" },
    ],
  },

  go: {
    tool: [
      { name: "cobra", weight: 0.9, context: "CLI library", aliases: ["github.com/spf13/cobra"] },
      { name: "cli", weight: 0.8, context: "CLI library", aliases: ["github.com/urfave/cli"] },
      { name: "flag", weight: 0.7, context: "Command-line flag parsing (built-in)" },
      {
        name: "pflag",
        weight: 0.7,
        context: "POSIX/GNU-style flags",
        aliases: ["github.com/spf13/pflag"],
      },
      {
        name: "kingpin",
        weight: 0.6,
        context: "Command line parser",
        aliases: ["github.com/alecthomas/kingpin"],
      },
      {
        name: "viper",
        weight: 0.7,
        context: "Configuration management",
        aliases: ["github.com/spf13/viper"],
      },
      {
        name: "survey",
        weight: 0.6,
        context: "Interactive prompts",
        aliases: ["github.com/AlecAivazis/survey"],
      },
      {
        name: "color",
        weight: 0.5,
        context: "Terminal colors",
        aliases: ["github.com/fatih/color"],
      },
      {
        name: "progressbar",
        weight: 0.5,
        context: "Progress bars",
        aliases: ["github.com/schollz/progressbar"],
      },
      {
        name: "spinner",
        weight: 0.4,
        context: "Terminal spinners",
        aliases: ["github.com/briandowns/spinner"],
      },
    ],
    web_service: [
      { name: "gin", weight: 0.9, context: "Web framework", aliases: ["github.com/gin-gonic/gin"] },
      {
        name: "echo",
        weight: 0.8,
        context: "Web framework",
        aliases: ["github.com/labstack/echo"],
      },
      {
        name: "fiber",
        weight: 0.8,
        context: "Express-inspired web framework",
        aliases: ["github.com/gofiber/fiber"],
      },
      {
        name: "chi",
        weight: 0.7,
        context: "Lightweight router",
        aliases: ["github.com/go-chi/chi"],
      },
      { name: "mux", weight: 0.7, context: "HTTP router", aliases: ["github.com/gorilla/mux"] },
      {
        name: "httprouter",
        weight: 0.6,
        context: "HTTP router",
        aliases: ["github.com/julienschmidt/httprouter"],
      },
      { name: "net/http", weight: 0.8, context: "HTTP server (built-in)" },
      {
        name: "fasthttp",
        weight: 0.6,
        context: "Fast HTTP package",
        aliases: ["github.com/valyala/fasthttp"],
      },
      { name: "iris", weight: 0.6, context: "Web framework", aliases: ["github.com/kataras/iris"] },
      {
        name: "revel",
        weight: 0.5,
        context: "Full-stack framework",
        aliases: ["github.com/revel/revel"],
      },
    ],
    frontend: [
      { name: "templ", weight: 0.8, context: "HTML templating", aliases: ["github.com/a-h/templ"] },
      { name: "html/template", weight: 0.7, context: "HTML templates (built-in)" },
      { name: "text/template", weight: 0.6, context: "Text templates (built-in)" },
      {
        name: "goview",
        weight: 0.6,
        context: "Template engine",
        aliases: ["github.com/foolin/goview"],
      },
      {
        name: "pongo2",
        weight: 0.5,
        context: "Django-like templates",
        aliases: ["github.com/flosch/pongo2"],
      },
      {
        name: "jet",
        weight: 0.5,
        context: "Template engine",
        aliases: ["github.com/CloudyKit/jet"],
      },
      {
        name: "htmx",
        weight: 0.6,
        context: "HTMX integration",
        aliases: ["github.com/bigskysoftware/htmx"],
      },
      {
        name: "vecty",
        weight: 0.5,
        context: "React-like framework",
        aliases: ["github.com/gopherjs/vecty"],
      },
      {
        name: "vugu",
        weight: 0.5,
        context: "Vue.js-inspired framework",
        aliases: ["github.com/vugu/vugu"],
      },
      { name: "tview", weight: 0.4, context: "Terminal UI", aliases: ["github.com/rivo/tview"] },
    ],
    module: [
      {
        name: "logrus",
        weight: 0.7,
        context: "Structured logging",
        aliases: ["github.com/sirupsen/logrus"],
      },
      { name: "zap", weight: 0.7, context: "Fast logging", aliases: ["go.uber.org/zap"] },
      {
        name: "uuid",
        weight: 0.6,
        context: "UUID generation",
        aliases: ["github.com/google/uuid"],
      },
      {
        name: "jwt-go",
        weight: 0.6,
        context: "JWT implementation",
        aliases: ["github.com/golang-jwt/jwt"],
      },
      {
        name: "bcrypt",
        weight: 0.5,
        context: "Password hashing",
        aliases: ["golang.org/x/crypto/bcrypt"],
      },
      {
        name: "validator",
        weight: 0.6,
        context: "Struct validation",
        aliases: ["github.com/go-playground/validator"],
      },
      { name: "cast", weight: 0.5, context: "Type conversion", aliases: ["github.com/spf13/cast"] },
      {
        name: "mapstructure",
        weight: 0.5,
        context: "Struct mapping",
        aliases: ["github.com/mitchellh/mapstructure"],
      },
      {
        name: "copier",
        weight: 0.4,
        context: "Struct copying",
        aliases: ["github.com/jinzhu/copier"],
      },
      {
        name: "decimal",
        weight: 0.5,
        context: "Decimal numbers",
        aliases: ["github.com/shopspring/decimal"],
      },
    ],
    desktop_app: [
      { name: "fyne", weight: 0.9, context: "Cross-platform GUI", aliases: ["fyne.io/fyne/v2"] },
      { name: "walk", weight: 0.7, context: "Windows GUI", aliases: ["github.com/lxn/walk"] },
      { name: "gtk", weight: 0.6, context: "GTK bindings", aliases: ["github.com/gotk3/gotk3"] },
      { name: "ui", weight: 0.6, context: "Native GUI", aliases: ["github.com/andlabs/ui"] },
      { name: "qt", weight: 0.5, context: "Qt bindings", aliases: ["github.com/therecipe/qt"] },
      {
        name: "systray",
        weight: 0.5,
        context: "System tray",
        aliases: ["github.com/getlantern/systray"],
      },
      {
        name: "webview",
        weight: 0.6,
        context: "WebView wrapper",
        aliases: ["github.com/webview/webview"],
      },
      {
        name: "wails",
        weight: 0.7,
        context: "Desktop app framework",
        aliases: ["github.com/wailsapp/wails"],
      },
      { name: "gio", weight: 0.6, context: "Immediate mode GUI", aliases: ["gioui.org"] },
      {
        name: "nucular",
        weight: 0.4,
        context: "Immediate mode GUI",
        aliases: ["github.com/aarzilli/nucular"],
      },
    ],
    data_processing: [
      { name: "csv", weight: 0.7, context: "CSV processing (built-in)", aliases: ["encoding/csv"] },
      {
        name: "json",
        weight: 0.8,
        context: "JSON processing (built-in)",
        aliases: ["encoding/json"],
      },
      { name: "xml", weight: 0.6, context: "XML processing (built-in)", aliases: ["encoding/xml"] },
      { name: "yaml", weight: 0.6, context: "YAML processing", aliases: ["gopkg.in/yaml.v3"] },
      {
        name: "excelize",
        weight: 0.6,
        context: "Excel file processing",
        aliases: ["github.com/xuri/excelize"],
      },
      {
        name: "goquery",
        weight: 0.6,
        context: "jQuery-like HTML parsing",
        aliases: ["github.com/PuerkitoBio/goquery"],
      },
      {
        name: "colly",
        weight: 0.6,
        context: "Web scraping",
        aliases: ["github.com/gocolly/colly"],
      },
      {
        name: "imaging",
        weight: 0.5,
        context: "Image processing",
        aliases: ["github.com/disintegration/imaging"],
      },
      {
        name: "gjson",
        weight: 0.5,
        context: "Fast JSON parsing",
        aliases: ["github.com/tidwall/gjson"],
      },
      {
        name: "arrow",
        weight: 0.5,
        context: "Columnar data",
        aliases: ["github.com/apache/arrow/go"],
      },
    ],
    testing: [
      { name: "testing", weight: 0.9, context: "Testing framework (built-in)" },
      {
        name: "testify",
        weight: 0.8,
        context: "Testing toolkit",
        aliases: ["github.com/stretchr/testify"],
      },
      {
        name: "ginkgo",
        weight: 0.7,
        context: "BDD testing framework",
        aliases: ["github.com/onsi/ginkgo"],
      },
      {
        name: "gomega",
        weight: 0.6,
        context: "Matcher library",
        aliases: ["github.com/onsi/gomega"],
      },
      {
        name: "httptest",
        weight: 0.6,
        context: "HTTP testing (built-in)",
        aliases: ["net/http/httptest"],
      },
      {
        name: "mock",
        weight: 0.6,
        context: "Mock generation",
        aliases: ["github.com/golang/mock"],
      },
      {
        name: "testcontainers",
        weight: 0.5,
        context: "Integration testing",
        aliases: ["github.com/testcontainers/testcontainers-go"],
      },
      {
        name: "dockertest",
        weight: 0.5,
        context: "Docker testing",
        aliases: ["github.com/ory/dockertest"],
      },
      {
        name: "counterfeiter",
        weight: 0.4,
        context: "Fake generation",
        aliases: ["github.com/maxbrunsfeld/counterfeiter"],
      },
      {
        name: "goconvey",
        weight: 0.5,
        context: "BDD testing",
        aliases: ["github.com/smartystreets/goconvey"],
      },
    ],
    build_tool: [
      { name: "go", weight: 0.9, context: "Go toolchain (built-in)" },
      { name: "make", weight: 0.6, context: "Build automation" },
      { name: "task", weight: 0.6, context: "Task runner", aliases: ["github.com/go-task/task"] },
      { name: "mage", weight: 0.5, context: "Build tool", aliases: ["github.com/magefile/mage"] },
      {
        name: "goreleaser",
        weight: 0.6,
        context: "Release automation",
        aliases: ["github.com/goreleaser/goreleaser"],
      },
      { name: "golangci-lint", weight: 0.5, context: "Linter runner" },
      { name: "gofmt", weight: 0.4, context: "Code formatter (built-in)" },
      {
        name: "goimports",
        weight: 0.4,
        context: "Import management",
        aliases: ["golang.org/x/tools/cmd/goimports"],
      },
      {
        name: "wire",
        weight: 0.5,
        context: "Dependency injection",
        aliases: ["github.com/google/wire"],
      },
      { name: "dep", weight: 0.3, context: "Dependency manager (deprecated)" },
    ],
    game: [
      {
        name: "ebiten",
        weight: 0.9,
        context: "2D game library",
        aliases: ["github.com/hajimehoshi/ebiten"],
      },
      {
        name: "pixel",
        weight: 0.7,
        context: "2D game library",
        aliases: ["github.com/faiface/pixel"],
      },
      {
        name: "raylib-go",
        weight: 0.6,
        context: "Raylib bindings",
        aliases: ["github.com/gen2brain/raylib-go"],
      },
      { name: "oak", weight: 0.6, context: "Game engine", aliases: ["github.com/oakmound/oak"] },
      {
        name: "engo",
        weight: 0.5,
        context: "Entity Component System",
        aliases: ["github.com/EngoEngine/engo"],
      },
      { name: "g3n", weight: 0.5, context: "3D game engine", aliases: ["github.com/g3n/engine"] },
      {
        name: "nano",
        weight: 0.4,
        context: "Lightweight game server",
        aliases: ["github.com/lonng/nano"],
      },
      {
        name: "leaf",
        weight: 0.4,
        context: "Game server framework",
        aliases: ["github.com/name5566/leaf"],
      },
      {
        name: "termloop",
        weight: 0.3,
        context: "Terminal-based games",
        aliases: ["github.com/JoelOtter/termloop"],
      },
      {
        name: "goworld",
        weight: 0.4,
        context: "Game server engine",
        aliases: ["github.com/xiaonanln/goworld"],
      },
    ],
    mobile: [
      {
        name: "gomobile",
        weight: 0.8,
        context: "Mobile app development",
        aliases: ["golang.org/x/mobile"],
      },
      { name: "fyne", weight: 0.7, context: "Cross-platform mobile", aliases: ["fyne.io/fyne/v2"] },
      { name: "gio", weight: 0.6, context: "Mobile GUI", aliases: ["gioui.org"] },
      {
        name: "mobile",
        weight: 0.6,
        context: "Mobile package (built-in)",
        aliases: ["golang.org/x/mobile/app"],
      },
      {
        name: "gl",
        weight: 0.4,
        context: "OpenGL ES bindings",
        aliases: ["golang.org/x/mobile/gl"],
      },
      {
        name: "sensor",
        weight: 0.3,
        context: "Mobile sensors",
        aliases: ["golang.org/x/mobile/sensor"],
      },
      {
        name: "bind",
        weight: 0.3,
        context: "Language binding",
        aliases: ["golang.org/x/mobile/bind"],
      },
      { name: "wails", weight: 0.5, context: "Mobile support in desktop framework" },
      { name: "nativescript", weight: 0.3, context: "NativeScript with Go backend" },
      { name: "flutter", weight: 0.3, context: "Flutter with Go backend" },
    ],
  },

  csharp: {
    tool: [
      { name: "CommandLineParser", weight: 0.8, context: "Command line parsing" },
      { name: "System.CommandLine", weight: 0.9, context: "Microsoft's CLI library" },
      { name: "McMaster.Extensions.CommandLineUtils", weight: 0.7, context: "CLI utilities" },
      { name: "Spectre.Console", weight: 0.8, context: "Rich console applications" },
      { name: "ConsoleTables", weight: 0.5, context: "Console table formatting" },
      { name: "Colorful.Console", weight: 0.5, context: "Colored console output" },
      { name: "ShellProgressBar", weight: 0.5, context: "Progress bars" },
      { name: "Inquirer.cs", weight: 0.6, context: "Interactive prompts" },
      { name: "Figgle", weight: 0.4, context: "ASCII art text" },
      { name: "Kurukuru", weight: 0.4, context: "Console spinners" },
    ],
    web_service: [
      { name: "Microsoft.AspNetCore", weight: 0.9, context: "ASP.NET Core web framework" },
      { name: "Carter", weight: 0.7, context: "Minimal web framework" },
      { name: "Nancy", weight: 0.6, context: "Lightweight web framework" },
      { name: "ServiceStack", weight: 0.7, context: "Web services framework" },
      { name: "FastEndpoints", weight: 0.6, context: "Fast web API framework" },
      { name: "Swashbuckle.AspNetCore", weight: 0.6, context: "Swagger/OpenAPI" },
      { name: "MediatR", weight: 0.6, context: "Mediator pattern implementation" },
      { name: "Serilog", weight: 0.5, context: "Structured logging" },
      { name: "FluentValidation", weight: 0.5, context: "Validation library" },
      { name: "AutoMapper", weight: 0.5, context: "Object mapping" },
    ],
    frontend: [
      {
        name: "Blazor",
        weight: 0.9,
        context: "Web UI framework",
        aliases: ["Microsoft.AspNetCore.Blazor"],
      },
      { name: "MudBlazor", weight: 0.7, context: "Blazor component library" },
      { name: "Radzen.Blazor", weight: 0.6, context: "Blazor components" },
      { name: "MatBlazor", weight: 0.5, context: "Material Design for Blazor" },
      { name: "Blazorise", weight: 0.5, context: "Bootstrap Blazor components" },
      { name: "MAUI", weight: 0.8, context: "Multi-platform app UI", aliases: ["Microsoft.Maui"] },
      { name: "Avalonia", weight: 0.8, context: "Cross-platform XAML UI" },
      { name: "Uno Platform", weight: 0.7, context: "Cross-platform UI" },
      { name: "ElectronNET", weight: 0.6, context: "Electron wrapper for .NET" },
      { name: "Photino", weight: 0.5, context: "Lightweight desktop framework" },
    ],
    module: [
      { name: "Newtonsoft.Json", weight: 0.8, context: "JSON serialization" },
      { name: "System.Text.Json", weight: 0.7, context: "JSON serialization (built-in)" },
      { name: "RestSharp", weight: 0.6, context: "REST client library" },
      { name: "HttpClient", weight: 0.7, context: "HTTP client (built-in)" },
      { name: "Dapper", weight: 0.6, context: "Micro ORM" },
      { name: "NodaTime", weight: 0.5, context: "Date and time API" },
      { name: "MoreLINQ", weight: 0.5, context: "LINQ extensions" },
      { name: "Polly", weight: 0.6, context: "Resilience and transient-fault-handling" },
      { name: "CsvHelper", weight: 0.5, context: "CSV processing" },
      { name: "FluentAssertions", weight: 0.5, context: "Fluent assertion framework" },
    ],
    desktop_app: [
      {
        name: "WPF",
        weight: 0.8,
        context: "Windows Presentation Foundation",
        aliases: ["Microsoft.WindowsDesktop.App"],
      },
      {
        name: "WinForms",
        weight: 0.7,
        context: "Windows Forms",
        aliases: ["System.Windows.Forms"],
      },
      { name: "Avalonia", weight: 0.8, context: "Cross-platform XAML UI framework" },
      { name: "MAUI", weight: 0.8, context: "Multi-platform App UI", aliases: ["Microsoft.Maui"] },
      { name: "Uno Platform", weight: 0.7, context: "Cross-platform UI platform" },
      { name: "Eto.Forms", weight: 0.6, context: "Cross-platform GUI framework" },
      { name: "GTK#", weight: 0.5, context: "GTK bindings for .NET" },
      { name: "MonoMac", weight: 0.4, context: "macOS app development" },
      { name: "Xamarin.Mac", weight: 0.5, context: "macOS development" },
      { name: "ElectronNET", weight: 0.6, context: "Electron for .NET" },
    ],
    data_processing: [
      { name: "CsvHelper", weight: 0.7, context: "CSV reading and writing" },
      { name: "ExcelDataReader", weight: 0.6, context: "Excel file reading" },
      { name: "EPPlus", weight: 0.7, context: "Excel file manipulation" },
      { name: "ClosedXML", weight: 0.6, context: "Excel file manipulation" },
      { name: "HtmlAgilityPack", weight: 0.6, context: "HTML parsing" },
      { name: "AngleSharp", weight: 0.5, context: "HTML/CSS/SVG parsing" },
      { name: "YamlDotNet", weight: 0.5, context: "YAML processing" },
      { name: "iTextSharp", weight: 0.5, context: "PDF manipulation" },
      { name: "ImageSharp", weight: 0.6, context: "Image processing" },
      { name: "System.Drawing", weight: 0.5, context: "Image processing (built-in)" },
    ],
    testing: [
      { name: "xUnit", weight: 0.8, context: "Testing framework", aliases: ["xunit"] },
      { name: "NUnit", weight: 0.7, context: "Testing framework" },
      { name: "MSTest", weight: 0.6, context: "Microsoft testing framework" },
      { name: "Moq", weight: 0.7, context: "Mocking framework" },
      { name: "NSubstitute", weight: 0.6, context: "Mocking framework" },
      { name: "AutoFixture", weight: 0.5, context: "Test data generation" },
      { name: "FluentAssertions", weight: 0.6, context: "Assertion library" },
      { name: "Bogus", weight: 0.5, context: "Fake data generation" },
      { name: "Selenium", weight: 0.6, context: "Web testing", aliases: ["Selenium.WebDriver"] },
      { name: "Playwright", weight: 0.6, context: "Modern web testing" },
    ],
    build_tool: [
      { name: "MSBuild", weight: 0.9, context: "Build platform" },
      { name: "dotnet", weight: 0.9, context: ".NET CLI" },
      { name: "NUKE", weight: 0.6, context: "Build automation" },
      { name: "Cake", weight: 0.6, context: "Build automation" },
      { name: "FAKE", weight: 0.5, context: "F# build automation" },
      { name: "psake", weight: 0.4, context: "PowerShell build automation" },
      { name: "Paket", weight: 0.4, context: "Dependency manager" },
      { name: "GitVersion", weight: 0.4, context: "Semantic versioning" },
      { name: "BenchmarkDotNet", weight: 0.5, context: "Benchmarking library" },
      { name: "StyleCop", weight: 0.3, context: "Code analysis" },
    ],
    game: [
      { name: "Unity", weight: 0.9, context: "Game engine" },
      { name: "MonoGame", weight: 0.8, context: "Cross-platform game framework" },
      { name: "Godot", weight: 0.7, context: "Game engine with C# support" },
      { name: "Wave Engine", weight: 0.6, context: "Cross-platform game engine" },
      { name: "FlatRedBall", weight: 0.5, context: "2D game engine" },
      { name: "Stride", weight: 0.6, context: "Open-source C# game engine" },
      { name: "Duality", weight: 0.4, context: "2D game development framework" },
      { name: "Delta Engine", weight: 0.3, context: "Cross-platform game engine" },
      { name: "ANX.Framework", weight: 0.3, context: "XNA-like framework" },
      { name: "RLNET", weight: 0.3, context: "Roguelike development library" },
    ],
    mobile: [
      { name: "Xamarin", weight: 0.8, context: "Cross-platform mobile development" },
      { name: "MAUI", weight: 0.9, context: "Multi-platform App UI", aliases: ["Microsoft.Maui"] },
      { name: "Uno Platform", weight: 0.7, context: "Cross-platform development" },
      { name: "Avalonia", weight: 0.6, context: "Cross-platform UI (mobile support)" },
      { name: "Xamarin.Forms", weight: 0.7, context: "Cross-platform UI toolkit" },
      { name: "Xamarin.iOS", weight: 0.6, context: "iOS development" },
      { name: "Xamarin.Android", weight: 0.6, context: "Android development" },
      { name: "Tizen.NET", weight: 0.4, context: "Tizen platform development" },
      {
        name: "Essentials",
        weight: 0.5,
        context: "Cross-platform APIs",
        aliases: ["Xamarin.Essentials"],
      },
      { name: "ReactiveUI", weight: 0.5, context: "MVVM framework for mobile" },
    ],
  },
};

/**
 * Calculate confidence score for artifact type based on dependencies
 */
export function calculateCategoryConfidence(
  dependencies: string[],
  language: string,
  category: keyof CategoryMatrix,
): number {
  const languageMatrix = DEPENDENCY_MATRIX[language];
  if (!languageMatrix) return 0;

  const categoryPatterns = languageMatrix[category];
  if (!categoryPatterns) return 0;

  let matchedWeight = 0;
  let maxPossibleWeight = 0;

  for (const pattern of categoryPatterns) {
    // Check if dependency matches pattern name or aliases
    const isMatch = dependencies.some((dep) => {
      if (dep === pattern.name) return true;
      if (pattern.aliases?.some((alias) => dep === alias)) return true;
      // Partial matches help with scoped packages like "@nestjs/core"
      if (dep.includes(pattern.name)) return true;
      return false;
    });

    if (isMatch) {
      matchedWeight += pattern.weight;
      maxPossibleWeight += pattern.weight;
    } else {
      // Only count high-weight patterns as "missing" for normalization
      if (pattern.weight >= 0.8) {
        maxPossibleWeight += pattern.weight;
      }
    }
  }

  // If we have matches, normalize by the weight we actually accumulated
  if (matchedWeight > 0) {
    // Cap at 1.0 and ensure we get high confidence for strong matches
    return Math.min(1.0, matchedWeight);
  }

  return 0;
}

/**
 * Determine the most likely artifact type for given dependencies
 */
export function determineMostLikelyCategory(
  dependencies: string[],
  language: string,
): { category: keyof CategoryMatrix; confidence: number } {
  const languageMatrix = DEPENDENCY_MATRIX[language];
  if (!languageMatrix) {
    return { category: "module", confidence: 0 };
  }

  const scores: Array<{ category: keyof CategoryMatrix; confidence: number }> = [];

  for (const category of Object.keys(languageMatrix) as Array<keyof CategoryMatrix>) {
    const confidence = calculateCategoryConfidence(dependencies, language, category);
    scores.push({ category, confidence });
  }

  // Sort by confidence and return the highest
  scores.sort((a, b) => b.confidence - a.confidence);

  const best = scores[0];

  // If no clear winner, default to library with low confidence
  if (best.confidence === 0) {
    return { category: "module", confidence: 0.1 };
  }

  return best;
}

/**
 * Get all categories sorted by confidence for given dependencies
 */
export function getAllCategoriesByConfidence(
  dependencies: string[],
  language: string,
): Array<{ category: keyof CategoryMatrix; confidence: number }> {
  const languageMatrix = DEPENDENCY_MATRIX[language];
  if (!languageMatrix) return [];

  const scores: Array<{ category: keyof CategoryMatrix; confidence: number }> = [];

  for (const category of Object.keys(languageMatrix) as Array<keyof CategoryMatrix>) {
    const confidence = calculateCategoryConfidence(dependencies, language, category);
    if (confidence > 0) {
      scores.push({ category, confidence });
    }
  }

  return scores.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get explanation of why a category was chosen
 */
export function getCategoryExplanation(
  dependencies: string[],
  language: string,
  category: keyof CategoryMatrix,
): string[] {
  const languageMatrix = DEPENDENCY_MATRIX[language];
  if (!languageMatrix) return [];

  const categoryPatterns = languageMatrix[category];
  if (!categoryPatterns) return [];

  const matches: string[] = [];

  for (const pattern of categoryPatterns) {
    const matchingDeps = dependencies.filter((dep) => {
      if (dep === pattern.name) return true;
      if (pattern.aliases?.some((alias) => dep === alias)) return true;
      if (dep.includes(pattern.name)) return true;
      return false;
    });

    if (matchingDeps.length > 0) {
      matches.push(`${matchingDeps.join(", ")} → ${pattern.context} (weight: ${pattern.weight})`);
    }
  }

  return matches;
}
