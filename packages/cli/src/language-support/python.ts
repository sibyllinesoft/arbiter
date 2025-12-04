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

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies = [
      "fastapi>=0.100.0",
      "uvicorn[standard]>=0.22.0",
      "pydantic>=2.0.0",
      "python-multipart>=0.0.6",
    ];

    // Requirements file
    files.push({
      path: "requirements.txt",
      content: await this.generateRequirements(config, dependencies),
    });

    // Development requirements
    files.push({
      path: "requirements-dev.txt",
      content: await this.generateDevRequirements(config),
    });

    // Main application file
    files.push({
      path: "app/main.py",
      content: await this.generateMainApp(config),
    });

    // Application configuration
    files.push({
      path: "app/core/config.py",
      content: await this.generateConfig(config),
    });

    // Core package init
    files.push({
      path: "app/__init__.py",
      content: "",
    });

    files.push({
      path: "app/core/__init__.py",
      content: "",
    });

    // Database setup (if needed)
    if (config.database) {
      files.push({
        path: "app/core/database.py",
        content: await this.generateDatabase(config),
      });
      files.push({
        path: "app/models/__init__.py",
        content: "",
      });
      dependencies.push("sqlalchemy>=2.0.0", "asyncpg>=0.28.0");
    }

    // Authentication setup (if needed)
    if (config.auth) {
      files.push({
        path: "app/core/security.py",
        content: await this.generateSecurity(config),
      });
      files.push({
        path: "app/core/auth.py",
        content: await this.generateAuth(config),
      });
      dependencies.push("python-jose[cryptography]", "passlib[bcrypt]");
    }

    // Testing setup
    if (config.testing) {
      files.push({
        path: "tests/__init__.py",
        content: "",
      });
      files.push({
        path: "tests/conftest.py",
        content: await this.generateTestConfig(config),
      });
      files.push({
        path: "tests/test_main.py",
        content: await this.generateMainTest(config),
      });
    }

    // Docker setup (if requested)
    if (config.docker) {
      files.push({
        path: "Dockerfile",
        content: await this.generateDockerfile(config),
      });
      files.push({
        path: "docker-compose.yml",
        content: await this.generateDockerCompose(config),
      });
    }

    // Project metadata
    files.push({
      path: "pyproject.toml",
      content: await this.generatePyprojectToml(config),
    });

    return {
      files,
      dependencies,
      scripts: {
        dev: "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
        start: "uvicorn app.main:app --host 0.0.0.0 --port 8000",
        test: "pytest",
        "test:watch": "pytest --watch",
        format: "black . && isort .",
        lint: "flake8 app tests",
        "type-check": "mypy app",
      },
    };
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];

    // Production dockerfile
    if (config.target === "production") {
      files.push({
        path: "Dockerfile.prod",
        content: await this.generateProductionDockerfile(config),
      });
    }

    // CI/CD configuration
    files.push({
      path: ".github/workflows/python-app.yml",
      content: await this.generateGitHubActions(config),
    });

    return { files };
  }

  private async generateAPIRouter(config: ServiceConfig): Promise<string> {
    const endpoints = config.endpoints || [
      "GET /",
      "POST /",
      "GET /{id}",
      "PUT /{id}",
      "DELETE /{id}",
    ];
    const routerMethods = endpoints
      .map((endpoint) => {
        const [method, path] = endpoint.split(" ");
        const methodName = method.toLowerCase();
        const safePath = path; // already CUE-safe

        return `@router.${methodName}("${safePath}")
async def ${methodName}_${config.name}(${path.includes("{id}") ? "id: int" : ""}):
    \"\"\"${method} ${path} endpoint for ${config.name}\"\"\"
    # TODO: Implement endpoint logic
    return {"message": "${method} ${config.name} endpoint"${path.includes("{id}") ? ', "id": id' : ""}}`;
      })
      .join("\n");

    return await pythonTemplateResolver.renderTemplate("router.tpl", {
      name: config.name,
      routerMethods,
    });
  }

  private async generateBusinessService(config: ServiceConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("service.tpl", {
      className: toPascalCase(config.name),
      name: config.name,
    });
  }

  private async generateModel(config: ServiceConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("model.tpl", {
      className: toPascalCase(config.name),
      name: config.name,
      tableName: `${config.name.toLowerCase()}s`,
    });
  }

  private async generateHandler(config: ServiceConfig): Promise<string> {
    const dbImport = config.database ? "from app.core.database import get_db_session" : "";
    const schemaImport = config.validation
      ? `from app.schemas.${config.name}_schema import ${config.name}Schema, ${config.name}Create, ${config.name}Update`
      : "";
    const dbDependency = config.database ? ", db: AsyncSession = Depends(get_db_session)" : "";
    const dbArgument = config.database ? "db=db" : "";

    return pythonTemplateResolver.renderTemplate("handler.tpl", {
      resource_name: config.name,
      service_module: config.name,
      service_instance: `${config.name.toLowerCase()}_service`,
      handler_class: `${config.name}Handler`,
      handler_instance: `${config.name.toLowerCase()}_handler`,
      db_import: dbImport,
      schema_import: schemaImport,
      db_dependency: dbDependency,
      db_argument: dbArgument,
    });
  }

  private async generatePydanticSchema(config: ServiceConfig): Promise<string> {
    const className = toPascalCase(config.name);
    return pythonTemplateResolver.renderTemplate("schema.tpl", {
      className,
    });
  }

  private async generateMainApp(config: ProjectConfig): Promise<string> {
    const corsImport = config.features.includes("cors")
      ? "from fastapi.middleware.cors import CORSMiddleware"
      : "";
    const corsSetup = config.features.includes("cors")
      ? `app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)`
      : "";

    const routersImport =
      ((config as any).modules || []).map((m) => `${m.name}`).join(", ") || "router";
    const routerInits = ((config as any).modules || [])
      .map((m) => `app.include_router(${m.name}.router)`)
      .join("\n");

    return pythonTemplateResolver.renderTemplate("main.tpl", {
      projectName: (config as any).projectName || "Generated API",
      routersImport,
      routerInits,
      corsImport,
      corsSetup,
    });
  }

  private async generateConfig(config: ProjectConfig): Promise<string> {
    const databaseSetting = config.database
      ? `    DATABASE_URL: str = \"postgresql+asyncpg://user:password@localhost:5432/${config.name.toLowerCase()}\"\n`
      : "";
    const fallback = `from functools import lru_cache\nfrom pydantic import BaseSettings\n\n\nclass Settings(BaseSettings):\n    PROJECT_NAME: str = \"${config.name}\"\n    VERSION: str = \"0.1.0\"\n    DESCRIPTION: str = \"${config.description || "FastAPI service"}\"\n    ENV: str = \"development\"\n${databaseSetting}    class Config:\n        env_file = \".env\"\n\n\n@lru_cache()\ndef get_settings() -> Settings:\n    return Settings()\n\n\nsettings = get_settings()\n`;

    return pythonTemplateResolver.renderTemplate(
      "app/core/config.py.tpl",
      {
        project_name: config.name,
        description: config.description || "FastAPI service",
        databaseSetting,
      },
      fallback,
    );
  }

  private async generateDatabase(_config: ProjectConfig): Promise<string> {
    const fallback = `from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine\nfrom sqlalchemy.orm import sessionmaker\n\nfrom app.core.config import settings\n\n\nengine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)\nAsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)\n\n\nasync def get_session() -> AsyncSession:\n    async with AsyncSessionLocal() as session:\n        yield session\n`;

    return pythonTemplateResolver.renderTemplate("app/core/database.py.tpl", {}, fallback);
  }

  private async generateSecurity(config: ProjectConfig): Promise<string> {
    if (config.auth !== "jwt") return "";

    const fallback = `"""
Security Utilities
JWT token handling and password hashing
"""
from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
ALGORITHM = "HS256"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def hash_password(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Get password hash"""
    return pwd_context.hash(password)
`;

    return pythonTemplateResolver.renderTemplate("app/core/security.py.tpl", {}, fallback);
  }

  private async generateAuth(config: ProjectConfig): Promise<string> {
    if (config.auth !== "jwt") return "";

    const fallback = `"""
Authentication Dependencies
FastAPI dependencies for authentication
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db_session
from app.core.security import verify_token
# from app.models.user import User  # Uncomment and import your User model
# from app.services.user_service import user_service  # Uncomment and import your user service

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db_session)
) -> dict:  # Replace with your User type
    """Get current authenticated user"""
    token = credentials.credentials
    
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # TODO: Implement user lookup
    # user_id = payload.get("sub")
    # if user_id is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Could not validate credentials",
    #     )
    # 
    # user = await user_service.get_by_id(user_id, db=db)
    # if user is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="User not found",
    #     )
    
    # Return user object or user data
    return {"user_id": payload.get("sub"), "username": payload.get("username")}


async def get_current_active_user(
    current_user: dict = Depends(get_current_user)  # Replace with your User type
) -> dict:  # Replace with your User type
    """Get current active user"""
    # TODO: Implement active user check
    # if not current_user.is_active:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Inactive user"
    #     )
    
    return current_user
`;

    return pythonTemplateResolver.renderTemplate("app/core/auth.py.tpl", {}, fallback);
  }

  private async generateRequirements(config: ProjectConfig, baseDeps: string[]): Promise<string> {
    const deps = [...baseDeps];

    if (config.database) {
      deps.push("sqlalchemy>=2.0.0", "asyncpg>=0.28.0");
    }
    if (config.auth === "jwt") {
      deps.push("python-jose[cryptography]>=3.3.0", "passlib[bcrypt]>=1.7.4");
    }

    const databaseDeps = config.database ? "sqlalchemy>=2.0.0\nasyncpg>=0.28.0\n" : "";
    const fallback = deps.sort().join("\n");
    return pythonTemplateResolver.renderTemplate(
      "requirements.txt.tpl",
      { databaseDeps },
      fallback,
    );
  }

  private async generateDevRequirements(config: ProjectConfig): Promise<string> {
    const testingDeps = config.testing ? "pytest-cov>=4.0.0\nfactory-boy>=3.2.0\n" : "";
    const baseDeps = [
      "pytest>=7.0.0",
      "pytest-asyncio>=0.21.0",
      "httpx>=0.24.0",
      "black>=23.0.0",
      "isort>=5.12.0",
      "flake8>=6.0.0",
      "mypy>=1.0.0",
    ];

    const fallback = [
      ...baseDeps,
      ...(config.testing ? ["pytest-cov>=4.0.0", "factory-boy>=3.2.0"] : []),
    ]
      .sort()
      .join("\n");

    return pythonTemplateResolver.renderTemplate(
      "requirements-dev.txt.tpl",
      { testing_deps: testingDeps },
      fallback,
    );
  }

  private async generateTestConfig(config: ProjectConfig): Promise<string> {
    const databaseImport = config.database
      ? "from app.core.database import get_db_session, Base"
      : "";
    const databaseFixtures = config.database
      ? `@pytest.fixture(scope="session")
async def test_db():
    """Create test database"""
    # Use in-memory SQLite for tests
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=True)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    yield async_session
    
    await engine.dispose()


@pytest.fixture
async def db_session(test_db):
    """Get database session for tests"""
    async with test_db() as session:
        yield session


@pytest.fixture
def override_get_db(db_session):
    """Override database dependency"""
    async def _override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db_session] = _override_get_db
    yield
    app.dependency_overrides.clear()
`
      : "";

    const fallback = `"""
Pytest Configuration
Test fixtures and configuration
"""
import pytest
import asyncio
from typing import Generator, AsyncGenerator
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
${databaseImport}


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


${databaseFixtures}

@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create test client"""
    with TestClient(app) as c:
        yield c


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create async test client"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
`;

    return pythonTemplateResolver.renderTemplate(
      "tests/conftest.py.tpl",
      { database_import: databaseImport, database_fixtures: databaseFixtures },
      fallback,
    );
  }

  private async generateMainTest(_config: ProjectConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("test-main.tpl", {});
  }

  private async generateDockerfile(config: ProjectConfig): Promise<string> {
    const fallback = `# Python ${config.name} Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PYTHONPATH=/app

# Install system dependencies
RUN apt-get update \\
    && apt-get install -y --no-install-recommends \\
        build-essential \\
        libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \\
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' --uid 1000 appuser \\
    && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
`;

    return pythonTemplateResolver.renderTemplate(
      "Dockerfile.tpl",
      { project_name: config.name },
      fallback,
    );
  }

  private async generateDockerCompose(config: ProjectConfig): Promise<string> {
    const dbService =
      config.database === "postgres"
        ? `  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${config.name.toLowerCase()}
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ${config.name.toLowerCase()}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${config.name.toLowerCase()}"]
      interval: 10s
      timeout: 5s
      retries: 5`
        : "";

    const databaseEnv = config.database
      ? `- DATABASE_URL=postgresql+asyncpg://${config.name.toLowerCase()}:password@database:5432/${config.name.toLowerCase()}`
      : "";

    const dependsOnBlock = config.database
      ? `depends_on:
      database:
        condition: service_healthy`
      : "";

    const volumesBlock = config.database === "postgres" ? "volumes:\n  postgres_data:" : "";

    const fallback = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=true
      ${databaseEnv}
    ${dependsOnBlock}
    volumes:
      - .:/app
    restart: unless-stopped
${dbService}

${volumesBlock}
`;

    return pythonTemplateResolver.renderTemplate(
      "docker-compose.yml.tpl",
      {
        database_env: databaseEnv,
        depends_on_block: dependsOnBlock,
        database_block: dbService,
        volumes_block: volumesBlock,
      },
      fallback,
    );
  }

  private async generatePyprojectToml(config: ProjectConfig): Promise<string> {
    const projectSlug = config.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const fallback = `[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "${projectSlug}"
version = "1.0.0"
description = "${config.description || `Modern FastAPI application: ${config.name}`}"
authors = [
    {name = "Your Name", email = "your.email@example.com"}
]
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.22.0",
    "pydantic>=2.0.0",
    "python-multipart>=0.0.6",
]
requires-python = ">=3.11"

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "httpx>=0.24.0",
    "black>=23.0.0",
    "isort>=5.12.0",
    "flake8>=6.0.0",
    "mypy>=1.0.0",
]

[tool.black]
line-length = 100
target-version = ['py311']
include = '\\.pyi?$'

[tool.isort]
profile = "black"
multi_line_output = 3
line_length = 100

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
check_untyped_defs = true

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = "test_*.py"
python_classes = "Test*"
python_functions = "test_*"
addopts = "-v --tb=short"
asyncio_mode = "auto"
`;

    return pythonTemplateResolver.renderTemplate(
      "pyproject.toml.tpl",
      {
        project_slug: projectSlug,
        description: config.description || `Modern FastAPI application: ${config.name}`,
      },
      fallback,
    );
  }
  private async generateProductionDockerfile(_config: BuildConfig): Promise<string> {
    return pythonTemplateResolver.renderTemplate("dockerfile-prod.tpl", {});
  }

  private async generateGitHubActions(config: BuildConfig): Promise<string> {
    if (config.target === "production") {
      return pythonTemplateResolver.renderTemplate("github-actions-prod.tpl", {});
    }
    return pythonTemplateResolver.renderTemplate("github-actions.tpl", {});
  }
}
