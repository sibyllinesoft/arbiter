/**
 * @packageDocumentation
 * Python service example templates for the examples command.
 *
 * Provides template content for:
 * - Python pyproject.toml configuration
 * - FastAPI main entry point and routes
 * - Python test file templates
 */

export function getPythonServicePyproject(): string {
  return `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "example-service"
version = "0.1.0"
description = "Example Python FastAPI service with Arbiter integration"
dependencies = [
    "fastapi>=0.100.0",
    "uvicorn[standard]>=0.23.0",
    "pydantic>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "httpx>=0.24.0",
    "pytest-asyncio>=0.21.0",
]

[tool.arbiter]
profile = "service"
language = "python"`;
}

export function getPythonServiceMain(): string {
  return `#!/usr/bin/env python3

from fastapi import FastAPI
from .api.routes import router

app = FastAPI(
    title="Example Service",
    description="Example Python service with Arbiter integration",
    version="0.1.0"
)

app.include_router(router)

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)`;
}

export function getPythonServiceRoutes(): string {
  return `from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class MessageRequest(BaseModel):
    message: str

class MessageResponse(BaseModel):
    result: str

@router.post("/process", response_model=MessageResponse)
async def process_message(request: MessageRequest) -> MessageResponse:
    return MessageResponse(result=f"Processed: {request.message}")`;
}

export function getPythonServiceTests(): string {
  return `import pytest
from httpx import AsyncClient
from src.main import app

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

@pytest.mark.asyncio
async def test_process_message():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/process", json={"message": "test"})
    assert response.status_code == 200
    assert response.json() == {"result": "Processed: test"}`;
}

export function getServiceAssemblyCue(): string {
  return `// Python Service - Arbiter Assembly Configuration
import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

Artifact: artifact.#Artifact & {
  kind: "service"
  language: "python"
  metadata: {
    name: "example-service"
    version: "0.1.0"
    description: "Example Python FastAPI service"
  }

  build: {
    tool: "uv"
    targets: ["./src"]
  }
}

Profile: profiles.#service & {
  endpoints: [
    {
      path: "/health"
      method: "GET"
      description: "Health check endpoint"
    },
    {
      path: "/process"
      method: "POST"
      description: "Message processing endpoint"
    }
  ]

  healthCheck: "/health"

  tests: {
    integration: [
      {
        name: "health_check"
        request: {method: "GET", path: "/health"}
        expect: {status: 200, body: {"status": "healthy"}}
      }
    ]
  }
}`;
}

export function getPythonServiceReadme(): string {
  return `# Example Python Service

FastAPI service example with Arbiter integration and async patterns.

## Quick Start

\`\`\`bash
# Install dependencies
uv pip install -e .

# Run development server
python src/main.py

# Test the service
curl http://localhost:8000/health
\`\`\`

## Arbiter Integration

\`\`\`bash
arbiter tests scaffold --language python
arbiter status
\`\`\``;
}
