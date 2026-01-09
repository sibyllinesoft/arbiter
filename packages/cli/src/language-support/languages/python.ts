/**
 * Python Language Plugin - FastAPI + SQLAlchemy 2.0+ + Modern Async Stack
 * Supports: FastAPI 0.100+, SQLAlchemy 2.0+, Pydantic v2, asyncio, pytest
 */

import type {
  BuildConfig,
  GeneratedFile,
  GenerationResult,
  LanguagePlugin,
  ProjectConfig,
  ServiceConfig,
} from "@/language-support/index.js";
import { TemplateResolver } from "@/language-support/template-resolver.js";

function toPascalCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const pythonTemplateResolver = new TemplateResolver({
  language: "python",
  defaultDirectories: [
    new URL("@/language-support/templates/python", import.meta.url).pathname,
    new URL("@/templates/python", import.meta.url).pathname,
  ],
});

export class PythonPlugin implements LanguagePlugin {
  readonly name = "Python Plugin";
  readonly language = "python";
  readonly version = "1.0.0";
  readonly description = "Modern Python with FastAPI, SQLAlchemy 2.0+, and async best practices";
  readonly supportedFeatures = [
    "api",
    "async-services",
    "database-orm",
    "validation",
    "authentication",
    "testing",
    "dependency-injection",
    "background-tasks",
    "websockets",
  ];
  readonly capabilities = {
    components: false,
    services: true,
    api: true,
    testing: true,
  };

  // --- Generation helpers ---
  private async generateAPIRouter(config: ServiceConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("routers/router.py.tpl", { config });
  }

  private async generateBusinessService(config: ServiceConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("services/service.py.tpl", { config });
  }

  private async generateModel(config: ServiceConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("models/model.py.tpl", { config });
  }

  private async generateHandler(config: ServiceConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("handlers/handler.py.tpl", { config });
  }

  private async generatePydanticSchema(config: ServiceConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("schemas/schema.py.tpl", { config });
  }

  private async generateRequirements(config: ProjectConfig, deps: string[]): Promise<string> {
    return deps.join("\n");
  }

  private async generateDevRequirements(_config: ProjectConfig): Promise<string> {
    return ["pytest", "ruff"].join("\n");
  }

  private async generateMainApp(config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("app/main.py.tpl", { config });
  }

  private async generateConfig(config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("app/core/config.py.tpl", { config });
  }

  private async generateDatabase(config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("app/core/database.py.tpl", { config });
  }

  private async generateSecurity(config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("app/core/security.py.tpl", { config });
  }

  private async generateAuth(config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("app/core/auth.py.tpl", { config });
  }

  private async generateTestConfig(config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("tests/conftest.py.tpl", { config });
  }

  private async generateMainTest(config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("tests/test_main.py.tpl", { config });
  }

  private async generatePyprojectToml(config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("pyproject.toml.tpl", { config });
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    const scripts =
      config.target === "production"
        ? { build: "uvicorn app.main:app --host 0.0.0.0 --port 8000" }
        : { dev: "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" };
    return { files: [], scripts };
  }
  async generateService(config: ServiceConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = [];

    switch (config.type) {
      case "api":
        files.push({
          path: `app/routers/${config.name}.py`,
          content: await this.generateAPIRouter(config),
        });
        dependencies.push("fastapi", "uvicorn");
        break;
      case "service":
        files.push({
          path: `app/services/${config.name}_service.py`,
          content: await this.generateBusinessService(config),
        });
        break;
      case "model":
        files.push({
          path: `app/models/${config.name}.py`,
          content: await this.generateModel(config),
        });
        dependencies.push("sqlalchemy");
        break;
      case "handler":
        files.push({
          path: `app/handlers/${config.name}_handler.py`,
          content: await this.generateHandler(config),
        });
        break;
    }

    if (config.validation) {
      dependencies.push("pydantic");
      files.push({
        path: `app/schemas/${config.name}_schema.py`,
        content: await this.generatePydanticSchema(config),
      });
    }

    if (config.database) {
      dependencies.push("sqlalchemy", "asyncpg");
    }

    return { files, dependencies };
  }

  private static readonly BASE_DEPENDENCIES = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.22.0",
    "pydantic>=2.0.0",
    "python-multipart>=0.0.6",
  ];

  private static readonly PROJECT_SCRIPTS = {
    dev: "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
    start: "uvicorn app.main:app --host 0.0.0.0 --port 8000",
    test: "pytest",
    "test:watch": "pytest --watch",
    format: "black . && isort .",
    lint: "flake8 app tests",
    "type-check": "mypy app",
  };

  private async generateCoreFiles(
    config: ProjectConfig,
    dependencies: string[],
  ): Promise<GeneratedFile[]> {
    return [
      { path: "requirements.txt", content: await this.generateRequirements(config, dependencies) },
      { path: "requirements-dev.txt", content: await this.generateDevRequirements(config) },
      { path: "app/main.py", content: await this.generateMainApp(config) },
      { path: "app/core/config.py", content: await this.generateConfig(config) },
      { path: "app/__init__.py", content: "" },
      { path: "app/core/__init__.py", content: "" },
      { path: "pyproject.toml", content: await this.generatePyprojectToml(config) },
    ];
  }

  private async generateDatabaseFiles(
    config: ProjectConfig,
    dependencies: string[],
  ): Promise<GeneratedFile[]> {
    if (!config.database) return [];
    dependencies.push("sqlalchemy>=2.0.0", "asyncpg>=0.28.0");
    return [
      { path: "app/core/database.py", content: await this.generateDatabase(config) },
      { path: "app/models/__init__.py", content: "" },
    ];
  }

  private async generateAuthFiles(
    config: ProjectConfig,
    dependencies: string[],
  ): Promise<GeneratedFile[]> {
    if (!config.auth) return [];
    dependencies.push("python-jose[cryptography]", "passlib[bcrypt]");
    return [
      { path: "app/core/security.py", content: await this.generateSecurity(config) },
      { path: "app/core/auth.py", content: await this.generateAuth(config) },
    ];
  }

  private async generateTestFiles(config: ProjectConfig): Promise<GeneratedFile[]> {
    if (!config.testing) return [];
    return [
      { path: "tests/__init__.py", content: "" },
      { path: "tests/conftest.py", content: await this.generateTestConfig(config) },
      { path: "tests/test_main.py", content: await this.generateMainTest(config) },
    ];
  }

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    const dependencies = [...PythonPlugin.BASE_DEPENDENCIES];

    const coreFiles = await this.generateCoreFiles(config, dependencies);
    const databaseFiles = await this.generateDatabaseFiles(config, dependencies);
    const authFiles = await this.generateAuthFiles(config, dependencies);
    const testFiles = await this.generateTestFiles(config);

    return {
      files: [...coreFiles, ...databaseFiles, ...authFiles, ...testFiles],
      dependencies,
      scripts: PythonPlugin.PROJECT_SCRIPTS,
    };
  }
}
