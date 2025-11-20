from fastapi import FastAPI

from app.core.config import settings
{{routerImport}}


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=settings.DESCRIPTION,
    )

    {{routerInclude}}

    @app.get("/health")
    async def health():
        return {"status": "ok", "env": settings.ENV, "version": settings.VERSION}

    return app


app = create_application()
