import os
from typing import Dict, Any
from fastapi import APIRouter, Response, Request, Depends, HTTPException, status

from ..schemas import (
    RegisterRequest,
    VerifyEmailRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserProfileResponse
)
from ..auth_service import (
    register_user,
    verify_email_token,
    login_user,
    logout_user,
    request_password_reset,
    reset_password
)
from .dependencies import get_current_user, SESSION_COOKIE_NAME

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

IS_PRODUCTION = os.environ.get("ENV") == "production"

@router.post("/register")
def register_endpoint(req: RegisterRequest) -> Dict[str, Any]:
    """
    Register a new user account with is_verified=false and dispatches a verification email.
    """
    return register_user(
        full_name=req.full_name,
        email=req.email,
        password=req.password,
        confirm_password=req.confirm_password,
        terms_accepted=req.terms_accepted
    )

@router.post("/verify-email")
def verify_email_endpoint(req: VerifyEmailRequest) -> Dict[str, Any]:
    """
    Verifies a user account using the single-use time-limited verification token.
    """
    return verify_email_token(req.token)

@router.post("/login")
def login_endpoint(req: LoginRequest, response: Response) -> Dict[str, Any]:
    """
    Authenticates user, verifies email status, and issues a secure session cookie.
    """
    user, session_token = login_user(email=req.email, password=req.password)

    # Set secure HttpOnly session cookie
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=IS_PRODUCTION,
        max_age=12 * 3600,
        path="/"
    )

    return {
        "success": True,
        "message": "Login successful",
        "user": user,
        "session_token": session_token  # Provided for non-browser / headless clients
    }

@router.post("/logout")
def logout_endpoint(request: Request, response: Response) -> Dict[str, Any]:
    """
    Invalidates the active session on the server and deletes the session cookie.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        auth_hdr = request.headers.get("Authorization")
        if auth_hdr and auth_hdr.startswith("Bearer "):
            token = auth_hdr[7:].strip()

    logout_user(token)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns the authenticated user's profile.
    """
    return user

@router.post("/forgot-password")
def forgot_password_endpoint(req: ForgotPasswordRequest) -> Dict[str, Any]:
    """
    Dispatches a single-use password reset link. Returns neutral response to avoid enumeration.
    """
    return request_password_reset(req.email)

@router.post("/reset-password")
def reset_password_endpoint(req: ResetPasswordRequest) -> Dict[str, Any]:
    """
    Sets a new password using a valid reset token and invalidates all existing sessions.
    """
    return reset_password(
        token_str=req.token,
        new_password=req.new_password,
        confirm_password=req.confirm_password
    )

