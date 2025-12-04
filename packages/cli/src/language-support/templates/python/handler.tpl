from fastapi import Depends, HTTPException
from .{{name}}_service import {{className}}Service

async def get_service() -> {{className}}Service:
    return {{className}}Service()
