import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { safeFileOperation } from "../../constraints/index.js";
import { GoPlugin } from "../go.js";
import {
  type BuildConfig,
  type ComponentConfig,
  type LanguagePlugin,
  LanguageRegistry,
  type ProjectConfig,
  type ServiceConfig,
  generateBuildConfig,
  generateComponent,
  generateService,
  initializeProject,
  registerPlugin,
  registry,
} from "../index.js";
import { PythonPlugin } from "../python.js";
import { RustPlugin } from "../rust.js";
import { TypeScriptPlugin } from "../typescript.js";

describe("Language Plugin System", () => {
  describe("LanguageRegistry", () => {
    it("should create a new registry", () => {
      const reg = new LanguageRegistry();
      expect(reg).toBeDefined();
      expect(reg.list()).toHaveLength(0);
    });

    it("should register and retrieve plugins", () => {
      const reg = new LanguageRegistry();
      const plugin = new TypeScriptPlugin();

      reg.register(plugin);

      expect(reg.get("typescript")).toBe(plugin);
      expect(reg.get("TypeScript")).toBe(plugin); // Case insensitive
      expect(reg.list()).toHaveLength(1);
    });

    it("should list all plugins", () => {
      const reg = new LanguageRegistry();
      const tsPlugin = new TypeScriptPlugin();
      const pyPlugin = new PythonPlugin();

      reg.register(tsPlugin);
      reg.register(pyPlugin);

      const plugins = reg.list();
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(tsPlugin);
      expect(plugins).toContain(pyPlugin);
    });

    it("should get supported languages", () => {
      const reg = new LanguageRegistry();
      const tsPlugin = new TypeScriptPlugin();
      const pyPlugin = new PythonPlugin();

      reg.register(tsPlugin);
      reg.register(pyPlugin);

      const languages = reg.getSupportedLanguages();
      expect(languages).toContain("typescript");
      expect(languages).toContain("python");
    });

    it("should check feature support", () => {
      const reg = new LanguageRegistry();
      const tsPlugin = new TypeScriptPlugin();

      reg.register(tsPlugin);

      expect(reg.hasSupport("typescript", "components")).toBe(true);
      expect(reg.hasSupport("typescript", "unknown-feature")).toBe(false);
      expect(reg.hasSupport("unknown-language", "components")).toBe(false);
    });

    it("should return undefined for unregistered languages", () => {
      const reg = new LanguageRegistry();
      expect(reg.get("unknown")).toBeUndefined();
    });
  });

  describe("Global registry", () => {
    it("should have all plugins auto-registered", () => {
      const languages = registry.getSupportedLanguages();
      expect(languages).toContain("typescript");
      expect(languages).toContain("python");
      expect(languages).toContain("go");
      expect(languages).toContain("rust");
    });

    it("should allow registering new plugins", () => {
      const originalCount = registry.list().length;

      const mockPlugin: LanguagePlugin = {
        name: "Mock Plugin",
        language: "mock",
        version: "1.0.0",
        description: "Test plugin",
        supportedFeatures: ["test"],
        generateService: async () => ({ files: [] }),
        initializeProject: async () => ({ files: [] }),
        generateBuildConfig: async () => ({ files: [] }),
      };

      registerPlugin(mockPlugin);

      expect(registry.list()).toHaveLength(originalCount + 1);
      expect(registry.get("mock")).toBe(mockPlugin);
    });
  });

  describe("TypeScript Plugin", () => {
    const plugin = new TypeScriptPlugin();

    it("should have correct metadata", () => {
      expect(plugin.name).toBe("TypeScript Plugin");
      expect(plugin.language).toBe("typescript");
      expect(plugin.version).toBe("1.1.0");
      expect(plugin.description).toContain("TypeScript");
      expect(plugin.supportedFeatures).toContain("components");
      expect(plugin.supportedFeatures).toContain("testing");
    });

    it("should generate components", async () => {
      const config: ComponentConfig = {
        name: "TestComponent",
        type: "component",
        props: [{ name: "message", type: "string", required: true }],
        styles: true,
        tests: true,
      };

      const result = await plugin.generateComponent!(config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);

      // Should include component file
      const componentFile = result.files.find((f) => f.path.includes("TestComponent.tsx"));
      expect(componentFile).toBeDefined();
      expect(componentFile!.content).toContain("TestComponent");
    });

    it("should generate services", async () => {
      const config: ServiceConfig = {
        name: "UserService",
        type: "api",
        endpoints: ["/users", "/users/:id"],
        auth: true,
        validation: true,
      };

      const result = await plugin.generateService(config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);

      // Should include service file
      const serviceFile = result.files.find((f) => f.path.includes("UserService"));
      expect(serviceFile).toBeDefined();
    });

    it("should initialize projects", async () => {
      const config: ProjectConfig = {
        name: "test-app",
        description: "Test application",
        features: ["react", "typescript", "vite"],
        testing: true,
        docker: false,
      };

      const result = await plugin.initializeProject(config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.dependencies).toBeDefined();
      expect(result.scripts).toBeDefined();

      // Should include package.json
      const packageFile = result.files.find((f) => f.path === "package.json");
      expect(packageFile).toBeDefined();
      expect(packageFile!.content).toContain("test-app");
    });

    it("should generate build config", async () => {
      const config: BuildConfig = {
        target: "production",
        optimization: true,
        bundling: true,
        typeChecking: true,
      };

      const result = await plugin.generateBuildConfig(config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("should honor Next.js framework configuration", async () => {
      const configuredPlugin = new TypeScriptPlugin();
      configuredPlugin.configure({ pluginConfig: { framework: "nextjs" } });

      const result = await configuredPlugin.initializeProject({
        name: "next-app",
        description: "Next.js application",
        features: [],
      });

      const fileNames = result.files.map((file) => file.path);
      expect(fileNames).toContain("next.config.js");
      expect(fileNames).toContain("app/page.tsx");
      expect(fileNames).not.toContain("vite.config.ts");
      expect(result.dependencies).toContain("next");
    });

    it("should scaffold Jest helpers for Next.js projects", async () => {
      const configuredPlugin = new TypeScriptPlugin();
      configuredPlugin.configure({ pluginConfig: { framework: "nextjs", testRunner: "jest" } });

      const result = await configuredPlugin.initializeProject({
        name: "next-jest",
        description: "Next.js with Jest",
        features: [],
      });

      const fileNames = result.files.map((file) => file.path);
      expect(fileNames).toEqual(
        expect.arrayContaining(["babel.config.js", "jest.config.js", "jest.setup.ts"]),
      );

      expect(result.dependencies).toEqual(
        expect.arrayContaining([
          "jest",
          "@types/jest",
          "babel-plugin-dynamic-import-node",
          "jest-next-dynamic",
          "@testing-library/jest-dom",
        ]),
      );
    });

    it("should load component templates from override directory", async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ts-plugin-"));
      const overrideDir = path.join(tmpDir, "typescript");
      await fs.ensureDir(overrideDir);
      const overridePath = path.join(overrideDir, "component.tsx.tpl");
      await safeFileOperation("write", overridePath, async (validatedPath) => {
        await fs.writeFile(
          validatedPath,
          "/* override */\nexport const {{componentName}} = () => null;\n",
        );
      });

      const configuredPlugin = new TypeScriptPlugin();
      configuredPlugin.configure({ templateOverrides: [overrideDir] });

      const result = await configuredPlugin.generateComponent!({
        name: "OverrideComponent",
        type: "component",
      });

      const componentFile = result.files.find((file) =>
        file.path.endsWith("OverrideComponent.tsx"),
      );
      expect(componentFile?.content).toContain("/* override */");

      await fs.remove(tmpDir);
    });
  });

  describe("Python Plugin", () => {
    const plugin = new PythonPlugin();

    it("should have correct metadata", () => {
      expect(plugin.name).toBe("Python Plugin");
      expect(plugin.language).toBe("python");
      expect(plugin.version).toBe("1.0.0");
      expect(plugin.description).toContain("Python");
      expect(plugin.supportedFeatures).toContain("api");
      expect(plugin.supportedFeatures).toContain("async-services");
    });

    it("should generate services", async () => {
      const config: ServiceConfig = {
        name: "UserAPI",
        type: "api",
        endpoints: ["GET /users", "GET /users/{id}"],
        database: true,
        auth: true,
      };

      const result = await plugin.generateService(config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);

      const serviceFile = result.files.find(
        (f) => f.path.includes("UserAPI") || f.path.includes("user") || f.path.includes("main"),
      );
      expect(serviceFile).toBeDefined();
      expect(serviceFile!.content).toContain("FastAPI");
    });

    it("should initialize projects", async () => {
      const config: ProjectConfig = {
        name: "python-api",
        description: "Python API project",
        features: ["fastapi", "async", "database"],
        database: "postgres",
        testing: true,
      };

      const result = await plugin.initializeProject(config);

      expect(result.files).toBeDefined();
      expect(result.dependencies).toBeDefined();

      const reqFile = result.files.find((f) => f.path.includes("requirements"));
      expect(reqFile).toBeDefined();
    });

    it("should generate build config", async () => {
      const config: BuildConfig = {
        target: "production",
        optimization: true,
      };

      const result = await plugin.generateBuildConfig(config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  describe("Go Plugin", () => {
    const plugin = new GoPlugin();

    it("should have correct metadata", () => {
      expect(plugin.name).toBe("Go Plugin");
      expect(plugin.language).toBe("go");
      expect(plugin.version).toBe("1.0.0");
      expect(plugin.description).toContain("Go");
      expect(plugin.supportedFeatures).toContain("api");
      expect(plugin.supportedFeatures).toContain("microservices");
    });

    it("should generate services", async () => {
      const config: ServiceConfig = {
        name: "UserService",
        type: "api",
        endpoints: ["/users", "/users/{id}"],
        database: true,
      };

      const result = await plugin.generateService(config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("should initialize projects", async () => {
      const config: ProjectConfig = {
        name: "go-service",
        description: "Go microservice",
        features: ["gin", "gorm", "testing"],
        database: "postgres",
        testing: true,
      };

      const result = await plugin.initializeProject(config);

      expect(result.files).toBeDefined();
      expect(result.dependencies).toBeDefined();

      const goModFile = result.files.find((f) => f.path === "go.mod");
      expect(goModFile).toBeDefined();
      expect(goModFile!.content).toContain("go-service");
    });
  });

  describe("Rust Plugin", () => {
    const plugin = new RustPlugin();

    it("should have correct metadata", () => {
      expect(plugin.name).toBe("Rust Plugin");
      expect(plugin.language).toBe("rust");
      expect(plugin.version).toBe("1.0.0");
      expect(plugin.description).toContain("Rust");
      expect(plugin.supportedFeatures).toContain("performance");
      expect(plugin.supportedFeatures).toContain("memory-safety");
    });

    it("should generate services", async () => {
      const config: ServiceConfig = {
        name: "UserService",
        type: "api",
        endpoints: ["/users", "/users/{id}"],
        database: true,
      };

      const result = await plugin.generateService(config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("should initialize projects", async () => {
      const config: ProjectConfig = {
        name: "rust-api",
        description: "Rust API service",
        features: ["axum", "sqlx", "tokio"],
        database: "postgres",
        testing: true,
      };

      const result = await plugin.initializeProject(config);

      expect(result.files).toBeDefined();
      expect(result.dependencies).toBeDefined();

      const cargoFile = result.files.find((f) => f.path === "Cargo.toml");
      expect(cargoFile).toBeDefined();
      expect(cargoFile!.content).toContain("rust-api");
    });
  });

  describe("Convenience functions", () => {
    it("should generate components via convenience function", async () => {
      const config: ComponentConfig = {
        name: "TestButton",
        type: "component",
        props: { label: "string", onClick: "function" },
      };

      const result = await generateComponent("typescript", config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("should throw error for unsupported language", async () => {
      const config: ComponentConfig = {
        name: "TestComponent",
        type: "component",
      };

      expect(generateComponent("unknown-language", config)).rejects.toThrow(
        "No plugin found for language: unknown-language",
      );
    });

    it("should throw error for unsupported feature", async () => {
      const config: ComponentConfig = {
        name: "TestComponent",
        type: "component",
      };

      // Python doesn't support component generation
      expect(generateComponent("python", config)).rejects.toThrow(
        "Component generation not supported for language: python",
      );
    });

    it("should generate services via convenience function", async () => {
      const config: ServiceConfig = {
        name: "TestService",
        type: "api",
        endpoints: ["GET /test"],
      };

      const result = await generateService("python", config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("should initialize projects via convenience function", async () => {
      const config: ProjectConfig = {
        name: "test-project",
        features: ["basic"],
      };

      const result = await initializeProject("go", config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("should generate build config via convenience function", async () => {
      const config: BuildConfig = {
        target: "development",
      };

      const result = await generateBuildConfig("typescript", config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });

    it("should throw error for unknown language in service generation", async () => {
      const config: ServiceConfig = {
        name: "TestService",
        type: "api",
      };

      expect(generateService("unknown", config)).rejects.toThrow(
        "No plugin found for language: unknown",
      );
    });

    it("should throw error for unknown language in project initialization", async () => {
      const config: ProjectConfig = {
        name: "test-project",
        features: [],
      };

      expect(initializeProject("unknown", config)).rejects.toThrow(
        "No plugin found for language: unknown",
      );
    });

    it("should throw error for unknown language in build config", async () => {
      const config: BuildConfig = {
        target: "production",
      };

      expect(generateBuildConfig("unknown", config)).rejects.toThrow(
        "No plugin found for language: unknown",
      );
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle empty feature arrays", () => {
      const reg = new LanguageRegistry();
      const mockPlugin: LanguagePlugin = {
        name: "Empty Plugin",
        language: "empty",
        version: "1.0.0",
        description: "Plugin with no features",
        supportedFeatures: [],
        generateService: async () => ({ files: [] }),
        initializeProject: async () => ({ files: [] }),
        generateBuildConfig: async () => ({ files: [] }),
      };

      reg.register(mockPlugin);

      expect(reg.hasSupport("empty", "any-feature")).toBe(false);
    });

    it("should handle plugin registration overwrites", () => {
      const reg = new LanguageRegistry();

      const plugin1: LanguagePlugin = {
        name: "Plugin 1",
        language: "test",
        version: "1.0.0",
        description: "First plugin",
        supportedFeatures: [],
        generateService: async () => ({ files: [] }),
        initializeProject: async () => ({ files: [] }),
        generateBuildConfig: async () => ({ files: [] }),
      };

      const plugin2: LanguagePlugin = {
        name: "Plugin 2",
        language: "test",
        version: "2.0.0",
        description: "Second plugin",
        supportedFeatures: [],
        generateService: async () => ({ files: [] }),
        initializeProject: async () => ({ files: [] }),
        generateBuildConfig: async () => ({ files: [] }),
      };

      reg.register(plugin1);
      reg.register(plugin2);

      expect(reg.list()).toHaveLength(1);
      expect(reg.get("test")).toBe(plugin2);
    });

    it("should handle complex component configurations", async () => {
      const config: ComponentConfig = {
        name: "ComplexComponent",
        type: "component",
        props: {
          title: "string",
          count: "number",
          items: "array",
          onItemClick: "function",
        },
        dependencies: ["react", "lodash"],
        styles: true,
        tests: true,
      };

      const result = await generateComponent("typescript", config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(1); // Should have multiple files for complex component
    });

    it("should handle complex service configurations", async () => {
      const config: ServiceConfig = {
        name: "ComplexAPI",
        type: "api",
        endpoints: ["GET /users", "GET /users/{id}", "GET /users/{id}/posts"],
        database: true,
        auth: true,
        validation: true,
      };

      const result = await generateService("python", config);

      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);
    });
  });
});
