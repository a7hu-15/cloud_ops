import os
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from ..auth_service import get_user_from_session

SESSION_COOKIE_NAME = "cloudops_session"

def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    token = None
    # Prioritize explicit Authorization header over cookie
    auth_hdr = request.headers.get("Authorization")
    if auth_hdr and auth_hdr.startswith("Bearer "):
        token = auth_hdr[7:].strip()

    if not token:
        token = request.cookies.get(SESSION_COOKIE_NAME)

    if not token:
        return None

    return get_user_from_session(token)

def get_current_user(request: Request) -> Dict[str, Any]:
    user = get_current_user_optional(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in."
        )
    return user
