"""
{{project_name}} FastAPI Application
Main application entry point with modern async patterns
"""
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
{{cors_import}}
from contextlib import asynccontextmanager
import logging
import time

from app.core.config import settings
{{database_import}}

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
    logger.info("Starting up {{project_name}}")
    {{database_startup}}
    
    yield
    
    # Shutdown
    logger.info("Shutting down {{project_name}}")


# Create FastAPI instance
app = FastAPI(
    title="{{project_name}}",
    description="{{description}}",
    version="1.0.0",
    lifespan=lifespan,
)

{{cors_setup}}

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
        "service": "{{project_name}}",
        "version": "1.0.0"
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to {{project_name}} API",
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
