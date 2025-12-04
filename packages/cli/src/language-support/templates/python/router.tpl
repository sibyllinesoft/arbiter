"""
{{name}} Router
FastAPI router for {{name}} endpoints
"""

from fastapi import APIRouter
from typing import Optional

router = APIRouter(prefix="/{{name}}", tags=["{{name}}"])

{{routerMethods}}
