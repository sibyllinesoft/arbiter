/**
 * Python Language Plugin - FastAPI + SQLAlchemy 2.0+ + Modern Async Stack
 * Supports: FastAPI 0.100+, SQLAlchemy 2.0+, Pydantic v2, asyncio, pytest
 */

import type {
  BuildConfig,
  ComponentConfig,
  GeneratedFile,
  GenerationResult,
  LanguagePlugin,
  ProjectConfig,
  ServiceConfig,
} from './index.js';

export class PythonPlugin implements LanguagePlugin {
  readonly name = 'Python Plugin';
  readonly language = 'python';
  readonly version = '1.0.0';
  readonly description = 'Modern Python with FastAPI, SQLAlchemy 2.0+, and async best practices';
  readonly supportedFeatures = [
    'api',
    'async-services',
    'database-orm',
    'validation',
    'authentication',
    'testing',
    'dependency-injection',
    'background-tasks',
    'websockets',
  ];
  readonly capabilities = {
    services: true,
    api: true,
    testing: true,
  };

  // Python doesn't have UI components like frontend frameworks
  async generateComponent(config: ComponentConfig): Promise<GenerationResult> {
    throw new Error('Component generation not supported for Python. Use generateService instead.');
  }

  async generateService(config: ServiceConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies: string[] = [];

    switch (config.type) {
      case 'api':
        files.push({
          path: `app/routers/${config.name}.py`,
          content: this.generateAPIRouter(config),
        });
        dependencies.push('fastapi', 'uvicorn');
        break;
      case 'service':
        files.push({
          path: `app/services/${config.name}_service.py`,
          content: this.generateBusinessService(config),
        });
        break;
      case 'model':
        files.push({
          path: `app/models/${config.name}.py`,
          content: this.generateModel(config),
        });
        dependencies.push('sqlalchemy');
        break;
      case 'handler':
        files.push({
          path: `app/handlers/${config.name}_handler.py`,
          content: this.generateHandler(config),
        });
        break;
    }

    if (config.validation) {
      dependencies.push('pydantic');
      files.push({
        path: `app/schemas/${config.name}_schema.py`,
        content: this.generatePydanticSchema(config),
      });
    }

    if (config.database) {
      dependencies.push('sqlalchemy', 'asyncpg');
    }

    return { files, dependencies };
  }

  async initializeProject(config: ProjectConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];
    const dependencies = [
      'fastapi>=0.100.0',
      'uvicorn[standard]>=0.22.0',
      'pydantic>=2.0.0',
      'python-multipart>=0.0.6',
    ];

    // Requirements file
    files.push({
      path: 'requirements.txt',
      content: this.generateRequirements(config, dependencies),
    });

    // Development requirements
    files.push({
      path: 'requirements-dev.txt',
      content: this.generateDevRequirements(config),
    });

    // Main application file
    files.push({
      path: 'app/main.py',
      content: this.generateMainApp(config),
    });

    // Application configuration
    files.push({
      path: 'app/core/config.py',
      content: this.generateConfig(config),
    });

    // Core package init
    files.push({
      path: 'app/__init__.py',
      content: '',
    });

    files.push({
      path: 'app/core/__init__.py',
      content: '',
    });

    // Database setup (if needed)
    if (config.database) {
      files.push({
        path: 'app/core/database.py',
        content: this.generateDatabase(config),
      });
      files.push({
        path: 'app/models/__init__.py',
        content: '',
      });
      dependencies.push('sqlalchemy>=2.0.0', 'asyncpg>=0.28.0');
    }

    // Authentication setup (if needed)
    if (config.auth) {
      files.push({
        path: 'app/core/security.py',
        content: this.generateSecurity(config),
      });
      files.push({
        path: 'app/core/auth.py',
        content: this.generateAuth(config),
      });
      dependencies.push('python-jose[cryptography]', 'passlib[bcrypt]');
    }

    // Testing setup
    if (config.testing) {
      files.push({
        path: 'tests/__init__.py',
        content: '',
      });
      files.push({
        path: 'tests/conftest.py',
        content: this.generateTestConfig(config),
      });
      files.push({
        path: 'tests/test_main.py',
        content: this.generateMainTest(config),
      });
    }

    // Docker setup (if requested)
    if (config.docker) {
      files.push({
        path: 'Dockerfile',
        content: this.generateDockerfile(config),
      });
      files.push({
        path: 'docker-compose.yml',
        content: this.generateDockerCompose(config),
      });
    }

    // Project metadata
    files.push({
      path: 'pyproject.toml',
      content: this.generatePyprojectToml(config),
    });

    return {
      files,
      dependencies,
      scripts: {
        dev: 'uvicorn app.main:app --reload --host 0.0.0.0 --port 8000',
        start: 'uvicorn app.main:app --host 0.0.0.0 --port 8000',
        test: 'pytest',
        'test:watch': 'pytest --watch',
        format: 'black . && isort .',
        lint: 'flake8 app tests',
        'type-check': 'mypy app',
      },
    };
  }

  async generateBuildConfig(config: BuildConfig): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];

    // Production dockerfile
    if (config.target === 'production') {
      files.push({
        path: 'Dockerfile.prod',
        content: this.generateProductionDockerfile(config),
      });
    }

    // CI/CD configuration
    files.push({
      path: '.github/workflows/python-app.yml',
      content: this.generateGitHubActions(config),
    });

    return { files };
  }

  private generateAPIRouter(config: ServiceConfig): string {
    const endpoints = config.endpoints || [
      'GET /',
      'POST /',
      'GET /{id}',
      'PUT /{id}',
      'DELETE /{id}',
    ];
    const routerMethods = endpoints
      .map(endpoint => {
        const [method, path] = endpoint.split(' ');
        const methodName = method.toLowerCase();
        const safePath = path.replace('{', '{').replace('}', '}'); // Ensure proper formatting

        return `
@router.${methodName}("${safePath}")
async def ${methodName}_${config.name}(${path.includes('{id}') ? 'id: int' : ''}):
    """${method} ${path} endpoint for ${config.name}"""
    # TODO: Implement endpoint logic
    return {"message": "${method} ${config.name} endpoint", ${path.includes('{id}') ? '"id": id' : ''}}`;
      })
      .join('\n');

    return `"""
${config.name} Router
FastAPI router for ${config.name} endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
${config.database ? 'from app.core.database import get_db_session' : ''}
${config.validation ? `from app.schemas.${config.name}_schema import ${config.name}Schema, ${config.name}Create, ${config.name}Update` : ''}

router = APIRouter(
    prefix="/${config.name.toLowerCase()}",
    tags=["${config.name}"],
    responses={404: {"description": "Not found"}},
)

${routerMethods}
`;
  }

  private generateBusinessService(config: ServiceConfig): string {
    return `"""
${config.name} Service
Business logic for ${config.name} operations
"""
from typing import List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
${config.database ? 'from app.core.database import get_db_session' : ''}
${config.validation ? `from app.schemas.${config.name}_schema import ${config.name}Schema, ${config.name}Create, ${config.name}Update` : ''}
import logging

logger = logging.getLogger(__name__)


class ${config.name}Service:
    """Service class for ${config.name} business logic"""

    async def get_all(self${config.database ? ', db: AsyncSession' : ''}) -> List[Any]:
        """Get all ${config.name} items"""
        logger.info(f"Fetching all ${config.name} items")
        # TODO: Implement get_all logic
        return []

    async def get_by_id(self, item_id: int${config.database ? ', db: AsyncSession' : ''}) -> Optional[Any]:
        """Get ${config.name} by ID"""
        logger.info(f"Fetching ${config.name} with ID: {item_id}")
        # TODO: Implement get_by_id logic
        return None

    async def create(self, item_data: Any${config.database ? ', db: AsyncSession' : ''}) -> Any:
        """Create new ${config.name}"""
        logger.info(f"Creating new ${config.name}")
        # TODO: Implement create logic
        return item_data

    async def update(self, item_id: int, item_data: Any${config.database ? ', db: AsyncSession' : ''}) -> Optional[Any]:
        """Update ${config.name} by ID"""
        logger.info(f"Updating ${config.name} with ID: {item_id}")
        # TODO: Implement update logic
        return item_data

    async def delete(self, item_id: int${config.database ? ', db: AsyncSession' : ''}) -> bool:
        """Delete ${config.name} by ID"""
        logger.info(f"Deleting ${config.name} with ID: {item_id}")
        # TODO: Implement delete logic
        return True


# Service instance
${config.name.toLowerCase()}_service = ${config.name}Service()
`;
  }

  private generateModel(config: ServiceConfig): string {
    return `"""
${config.name} Model
SQLAlchemy 2.0+ async model definition
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class ${config.name}(Base):
    """${config.name} database model"""
    
    __tablename__ = "${config.name.toLowerCase()}s"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<${config.name}(id={self.id}, name='{self.name}')>"
`;
  }

  private generateHandler(config: ServiceConfig): string {
    return `"""
${config.name} Handler
HTTP request handlers for ${config.name}
"""
from fastapi import HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
${config.database ? 'from app.core.database import get_db_session' : ''}
${config.validation ? `from app.schemas.${config.name}_schema import ${config.name}Schema, ${config.name}Create, ${config.name}Update` : ''}
from app.services.${config.name}_service import ${config.name.toLowerCase()}_service
import logging

logger = logging.getLogger(__name__)


class ${config.name}Handler:
    """Handler class for ${config.name} HTTP operations"""

    async def handle_get_all(self${config.database ? ', db: AsyncSession = Depends(get_db_session)' : ''}) -> List[Any]:
        """Handle GET request for all ${config.name} items"""
        try:
            return await ${config.name.toLowerCase()}_service.get_all(${config.database ? 'db=db' : ''})
        except Exception as e:
            logger.error(f"Error fetching all ${config.name}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def handle_get_by_id(self, item_id: int${config.database ? ', db: AsyncSession = Depends(get_db_session)' : ''}) -> Any:
        """Handle GET request for ${config.name} by ID"""
        try:
            item = await ${config.name.toLowerCase()}_service.get_by_id(item_id${config.database ? ', db=db' : ''})
            if not item:
                raise HTTPException(status_code=404, detail="${config.name} not found")
            return item
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching ${config.name} {item_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def handle_create(self, item_data: Any${config.database ? ', db: AsyncSession = Depends(get_db_session)' : ''}) -> Any:
        """Handle POST request to create ${config.name}"""
        try:
            return await ${config.name.toLowerCase()}_service.create(item_data${config.database ? ', db=db' : ''})
        except Exception as e:
            logger.error(f"Error creating ${config.name}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def handle_update(self, item_id: int, item_data: Any${config.database ? ', db: AsyncSession = Depends(get_db_session)' : ''}) -> Any:
        """Handle PUT request to update ${config.name}"""
        try:
            item = await ${config.name.toLowerCase()}_service.update(item_id, item_data${config.database ? ', db=db' : ''})
            if not item:
                raise HTTPException(status_code=404, detail="${config.name} not found")
            return item
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating ${config.name} {item_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

    async def handle_delete(self, item_id: int${config.database ? ', db: AsyncSession = Depends(get_db_session)' : ''}) -> dict:
        """Handle DELETE request for ${config.name}"""
        try:
            success = await ${config.name.toLowerCase()}_service.delete(item_id${config.database ? ', db=db' : ''})
            if not success:
                raise HTTPException(status_code=404, detail="${config.name} not found")
            return {"message": "${config.name} deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting ${config.name} {item_id}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")


# Handler instance
${config.name.toLowerCase()}_handler = ${config.name}Handler()
`;
  }

  private generatePydanticSchema(config: ServiceConfig): string {
    return `"""
${config.name} Pydantic Schemas
Data validation and serialization schemas using Pydantic v2
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class ${config.name}Base(BaseModel):
    """Base schema for ${config.name}"""
    name: str = Field(..., description="${config.name} name", min_length=1, max_length=100)
    description: Optional[str] = Field(None, description="${config.name} description", max_length=500)
    is_active: bool = Field(True, description="Whether the ${config.name} is active")


class ${config.name}Create(${config.name}Base):
    """Schema for creating ${config.name}"""
    pass


class ${config.name}Update(${config.name}Base):
    """Schema for updating ${config.name}"""
    name: Optional[str] = Field(None, description="${config.name} name", min_length=1, max_length=100)
    is_active: Optional[bool] = Field(None, description="Whether the ${config.name} is active")


class ${config.name}Schema(${config.name}Base):
    """Schema for ${config.name} responses"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="Unique identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class ${config.name}InDB(${config.name}Schema):
    """Schema for ${config.name} as stored in database"""
    pass
`;
  }

  private generateMainApp(config: ProjectConfig): string {
    const corsImport = config.features.includes('cors')
      ? 'from fastapi.middleware.cors import CORSMiddleware'
      : '';
    const corsSetup = config.features.includes('cors')
      ? `
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)`
      : '';

    return `"""
${config.name} FastAPI Application
Main application entry point with modern async patterns
"""
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
${corsImport}
from contextlib import asynccontextmanager
import logging
import time

from app.core.config import settings
${config.database ? 'from app.core.database import init_db' : ''}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting up ${config.name}")
    ${config.database ? 'await init_db()' : ''}
    
    yield
    
    # Shutdown
    logger.info("Shutting down ${config.name}")


# Create FastAPI instance
app = FastAPI(
    title="${config.name}",
    description="${config.description || 'A modern FastAPI application'}",
    version="1.0.0",
    lifespan=lifespan,
)

${corsSetup}

# Middleware for request timing
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Global exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path)
        }
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "${config.name}",
        "version": "1.0.0"
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to ${config.name} API",
        "version": "1.0.0",
        "docs": "/docs"
    }


# Include routers
# TODO: Add your routers here
# app.include_router(your_router, prefix="/api/v1")


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
`;
  }

  private generateConfig(config: ProjectConfig): string {
    return `"""
Application Configuration
Environment-based configuration using Pydantic Settings
"""
from pydantic import Field
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # Basic settings
    APP_NAME: str = Field(default="${config.name}", description="Application name")
    DEBUG: bool = Field(default=True, description="Debug mode")
    HOST: str = Field(default="0.0.0.0", description="Host to bind to")
    PORT: int = Field(default=8000, description="Port to bind to")
    
    # Database settings
    ${
      config.database
        ? `DATABASE_URL: str = Field(
        default="postgresql+asyncpg://user:password@localhost:5432/${config.name.toLowerCase()}",
        description="Database connection URL"
    )`
        : '# DATABASE_URL: str = Field(default="sqlite:///./app.db")'
    }
    
    # Security settings
    ${
      config.auth === 'jwt'
        ? `SECRET_KEY: str = Field(default="your-secret-key-change-in-production", description="JWT secret key")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="Access token expiration time")`
        : '# SECRET_KEY: str = Field(default="your-secret-key")'
    }
    
    # CORS settings
    CORS_ORIGINS: list[str] = Field(default=["http://localhost:3000"], description="CORS allowed origins")
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()
`;
  }

  private generateDatabase(config: ProjectConfig): string {
    const dbType = config.database || 'postgres';

    return `"""
Database Configuration
SQLAlchemy 2.0+ async database setup
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import NullPool
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool if settings.DEBUG else None,
    pool_pre_ping=True,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


async def get_db_session() -> AsyncSession:
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables"""
    try:
        # Import all models here to ensure they are registered
        # from app.models import user, item  # Example imports
        
        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise


async def close_db() -> None:
    """Close database connections"""
    await engine.dispose()
    logger.info("Database connections closed")
`;
  }

  private generateSecurity(config: ProjectConfig): string {
    if (config.auth !== 'jwt') return '';

    return `"""
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
  }

  private generateAuth(config: ProjectConfig): string {
    if (config.auth !== 'jwt') return '';

    return `"""
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
  }

  private generateRequirements(config: ProjectConfig, baseDeps: string[]): string {
    const deps = [...baseDeps];

    if (config.database) {
      deps.push('sqlalchemy>=2.0.0', 'asyncpg>=0.28.0');
    }
    if (config.auth === 'jwt') {
      deps.push('python-jose[cryptography]>=3.3.0', 'passlib[bcrypt]>=1.7.4');
    }
    if (config.features.includes('cors')) {
      // CORS support is built into FastAPI
    }

    return deps.sort().join('\n');
  }

  private generateDevRequirements(config: ProjectConfig): string {
    const devDeps = [
      'pytest>=7.0.0',
      'pytest-asyncio>=0.21.0',
      'httpx>=0.24.0',
      'black>=23.0.0',
      'isort>=5.12.0',
      'flake8>=6.0.0',
      'mypy>=1.0.0',
    ];

    if (config.testing) {
      devDeps.push('pytest-cov>=4.0.0', 'factory-boy>=3.2.0');
    }

    return devDeps.sort().join('\n');
  }

  private generateTestConfig(config: ProjectConfig): string {
    return `"""
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
${config.database ? 'from app.core.database import get_db_session, Base' : ''}


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


${
  config.database
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
    app.dependency_overrides.clear()`
    : ''
}


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
  }

  private generateMainTest(config: ProjectConfig): string {
    return `"""
Main Application Tests
Basic API endpoint tests
"""
import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient


def test_root_endpoint(client: TestClient):
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "${config.name}" in data["message"]


def test_health_check(client: TestClient):
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "${config.name}"


@pytest.mark.asyncio
async def test_root_endpoint_async(async_client: AsyncClient):
    """Test root endpoint with async client"""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data


@pytest.mark.asyncio
async def test_health_check_async(async_client: AsyncClient):
    """Test health check endpoint with async client"""
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
`;
  }

  private generateDockerfile(config: ProjectConfig): string {
    return `# Python ${config.name} Dockerfile
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
  }

  private generateDockerCompose(config: ProjectConfig): string {
    const dbService =
      config.database === 'postgres'
        ? `
  database:
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
        : '';

    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=true
      ${config.database ? `- DATABASE_URL=postgresql+asyncpg://${config.name.toLowerCase()}:password@database:5432/${config.name.toLowerCase()}` : ''}
    ${
      config.database
        ? `depends_on:
      database:
        condition: service_healthy`
        : ''
    }
    volumes:
      - .:/app
    restart: unless-stopped
${dbService}

${
  config.database === 'postgres'
    ? `volumes:
  postgres_data:`
    : ''
}
`;
  }

  private generatePyprojectToml(config: ProjectConfig): string {
    return `[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "${config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}"
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
  }

  private generateProductionDockerfile(config: BuildConfig): string {
    return `# Production Python Dockerfile
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update \\
    && apt-get install -y --no-install-recommends \\
        build-essential \\
        libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --user --no-cache-dir --upgrade pip \\
    && pip install --user --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update \\
    && apt-get install -y --no-install-recommends \\
        libpq5 \\
        curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' --uid 1000 appuser \\
    && chown -R appuser:appuser /app
USER appuser

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
`;
  }

  private generateGitHubActions(config: BuildConfig): string {
    return `name: Python Application CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
        
    - name: Cache pip dependencies
      uses: actions/cache@v3
      with:
        path: ~/.cache/pip
        key: \${{ runner.os }}-pip-\${{ hashFiles('**/requirements*.txt') }}
        restore-keys: |
          \${{ runner.os }}-pip-
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
    
    - name: Lint with flake8
      run: |
        flake8 app tests --count --select=E9,F63,F7,F82 --show-source --statistics
        flake8 app tests --count --exit-zero --max-complexity=10 --max-line-length=100 --statistics
    
    - name: Format check with black
      run: black --check app tests
    
    - name: Import sort check
      run: isort --check-only app tests
    
    - name: Type check with mypy
      run: mypy app
    
    - name: Test with pytest
      env:
        DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/test
      run: |
        pytest --cov=app --cov-report=xml --cov-report=term-missing
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        flags: unittests
        name: codecov-umbrella

  ${
    config.target === 'production'
      ? `deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Build and push Docker image
      env:
        DOCKER_REGISTRY: your-registry.com
      run: |
        docker build -f Dockerfile.prod -t $DOCKER_REGISTRY/your-app:$` +
        '{{ github.sha }}' +
        ` .
        docker push $DOCKER_REGISTRY/your-app:$` +
        '{{ github.sha }}'
      : ''
  }
`;
  }
}
