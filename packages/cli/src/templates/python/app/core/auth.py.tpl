"""
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
