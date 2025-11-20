"""
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
    assert "{{project_name}}" in data["message"]


def test_health_check(client: TestClient):
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "{{project_name}}"


@pytest.mark.asyncio
async def test_root_endpoint_async(async_client: AsyncClient):
    """Test root endpoint with async client"""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data


@pytest.mark.asyncio
async def test_health_check_async(async_client: AsyncClient):
    """Test health check endpoint"""
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
