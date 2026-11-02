import sqlite3
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException, status

from .db import get_connection
from .security import (
    normalize_and_validate_email,
    validate_password,
    hash_password,
    verify_password,
    hash_token,
    generate_secure_token,
    generate_session_token
)
from .email_service import (
    send_verification_email,
    send_password_reset_email,
    send_password_changed_notification
)

def register_user(
    full_name: str,
    email: str,
    password: str,
    confirm_password: str,
    terms_accepted: bool
) -> Dict[str, Any]:
    if not terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must agree to the Terms of Use to register"
        )

    clean_name = full_name.strip() if full_name else ""
    if len(clean_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name must be at least 2 characters long"
        )

    is_valid_email, email_or_err, raw_email = normalize_and_validate_email(email)
    if not is_valid_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=email_or_err
        )
    normalized_email = email_or_err

    if password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirm password do not match"
        )

    is_valid_pwd, pwd_err = validate_password(password)
    if not is_valid_pwd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=pwd_err
        )

    conn = get_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, is_verified FROM users WHERE normalized_email = ?",
                (normalized_email,)
            )
            existing = cursor.fetchone()

            if existing:
                if existing["is_verified"]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="An account with this email is already registered"
                    )
                else:
                    # Account exists but unverified: regenerate verification token
                    user_id = existing["id"]
                    cursor.execute(
                        "UPDATE users SET password_hash = ?, full_name = ? WHERE id = ?",
                        (hash_password(password), clean_name, user_id)
                    )
            else:
                cursor.execute(
                    """
                    INSERT INTO users (full_name, email, normalized_email, password_hash, is_verified)
                    VALUES (?, ?, ?, ?, 0)
                    """,
                    (clean_name, raw_email, normalized_email, hash_password(password))
                )
                user_id = cursor.lastrowid

            # Create single-use 30-minute verification token
            raw_token = generate_secure_token()
            token_h = hash_token(raw_token)
            expires_at = datetime.utcnow() + timedelta(minutes=30)

            cursor.execute(
                """
                INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at, is_used)
                VALUES (?, ?, 'verify_email', ?, 0)
                """,
                (user_id, token_h, expires_at.isoformat())
            )

        # Dispatch verification email
        send_verification_email(raw_email, clean_name, raw_token)

        return {
            "success": True,
            "message": "Account created successfully. Please check your email to verify your account.",
            "email": raw_email,
            "user_id": user_id,
            "verification_token_debug": raw_token  # Provided for local testing / dev ease
        }
    finally:
        conn.close()

def verify_email_token(token_str: str) -> Dict[str, Any]:
    if not token_str or not isinstance(token_str, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is required"
        )

    token_h = hash_token(token_str.strip())
    conn = get_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, user_id, expires_at, is_used
                FROM auth_tokens
                WHERE token_hash = ? AND token_type = 'verify_email'
                """,
                (token_h,)
            )
            token_record = cursor.fetchone()

            if not token_record:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid verification token"
                )

            if token_record["is_used"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This verification token has already been used"
                )

            expires_at = datetime.fromisoformat(token_record["expires_at"])
            if datetime.utcnow() > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verification token has expired. Please request a new one."
                )

            # Mark token used
            cursor.execute("UPDATE auth_tokens SET is_used = 1 WHERE id = ?", (token_record["id"],))
            # Set user as verified
            cursor.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (token_record["user_id"],))

        return {
            "success": True,
            "message": "Email address verified successfully. You may now log in."
        }
    finally:
        conn.close()

def login_user(email: str, password: str) -> Tuple[Dict[str, Any], str]:
    is_valid_email, email_or_err, _ = normalize_and_validate_email(email)
    if not is_valid_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    normalized_email = email_or_err

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, full_name, email, normalized_email, password_hash, is_verified, created_at
            FROM users
            WHERE normalized_email = ?
            """,
            (normalized_email,)
        )
        user = cursor.fetchone()

        if not user or not verify_password(user["password_hash"], password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        if not user["is_verified"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is not verified. Please verify your email before logging in."
            )

        # Create session with 30m idle, 12h absolute expiry
        raw_session_token = generate_session_token()
        session_h = hash_token(raw_session_token)
        now = datetime.utcnow()
        abs_expiry = now + timedelta(hours=12)

        with conn:
            cursor.execute(
                """
                INSERT INTO sessions (user_id, session_token_hash, expires_at, last_activity)
                VALUES (?, ?, ?, ?)
                """,
                (user["id"], session_h, abs_expiry.isoformat(), now.isoformat())
            )

        user_dict = {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "is_verified": bool(user["is_verified"]),
            "created_at": user["created_at"]
        }
        return user_dict, raw_session_token
    finally:
        conn.close()

def get_user_from_session(raw_session_token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw_session_token:
        return None

    session_h = hash_token(raw_session_token)
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.id AS session_id, s.user_id, s.expires_at, s.last_activity,
                   u.id, u.full_name, u.email, u.is_verified, u.created_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token_hash = ?
            """,
            (session_h,)
        )
        row = cursor.fetchone()
        if not row:
            return None

        now = datetime.utcnow()
        abs_expiry = datetime.fromisoformat(row["expires_at"])
        last_act = datetime.fromisoformat(row["last_activity"])

        # Check absolute expiry (12h)
        if now > abs_expiry:
            with conn:
                conn.execute("DELETE FROM sessions WHERE id = ?", (row["session_id"],))
            return None

        # Check idle expiry (30m)
        if now - last_act > timedelta(minutes=30):
            with conn:
                conn.execute("DELETE FROM sessions WHERE id = ?", (row["session_id"],))
            return None

        # Update last activity
        with conn:
            conn.execute(
                "UPDATE sessions SET last_activity = ? WHERE id = ?",
                (now.isoformat(), row["session_id"])
            )

        return {
            "id": row["id"],
            "full_name": row["full_name"],
            "email": row["email"],
            "is_verified": bool(row["is_verified"]),
            "created_at": row["created_at"]
        }
    finally:
        conn.close()

def logout_user(raw_session_token: Optional[str]) -> bool:
    if not raw_session_token:
        return True
    session_h = hash_token(raw_session_token)
    conn = get_connection()
    try:
        with conn:
            conn.execute("DELETE FROM sessions WHERE session_token_hash = ?", (session_h,))
        return True
    finally:
        conn.close()

def request_password_reset(email: str) -> Dict[str, Any]:
    neutral_msg = "If an account exists with this email address, a password reset link has been sent."
    is_valid, email_or_err, _ = normalize_and_validate_email(email)
    if not is_valid:
        # Return neutral message to avoid email enumeration
        return {"success": True, "message": neutral_msg}

    normalized = email_or_err
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, full_name, email FROM users WHERE normalized_email = ?", (normalized,))
        user = cursor.fetchone()
        if not user:
            return {"success": True, "message": neutral_msg}

        raw_token = generate_secure_token()
        token_h = hash_token(raw_token)
        expires_at = datetime.utcnow() + timedelta(minutes=30)

        with conn:
            # Invalidate any prior unused reset tokens for this user
            cursor.execute(
                "UPDATE auth_tokens SET is_used = 1 WHERE user_id = ? AND token_type = 'reset_password'",
                (user["id"],)
            )
            cursor.execute(
                """
                INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at, is_used)
                VALUES (?, ?, 'reset_password', ?, 0)
                """,
                (user["id"], token_h, expires_at.isoformat())
            )

        send_password_reset_email(user["email"], user["full_name"], raw_token)
        return {
            "success": True,
            "message": neutral_msg,
            "reset_token_debug": raw_token  # For dev convenience
        }
    finally:
        conn.close()

def reset_password(token_str: str, new_password: str, confirm_password: str) -> Dict[str, Any]:
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token is required"
        )

    if new_password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password and confirm password do not match"
        )

    is_valid, pwd_err = validate_password(new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=pwd_err
        )

    token_h = hash_token(token_str.strip())
    conn = get_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT t.id, t.user_id, t.expires_at, t.is_used, u.email, u.full_name
                FROM auth_tokens t
                JOIN users u ON t.user_id = u.id
                WHERE t.token_hash = ? AND t.token_type = 'reset_password'
                """,
                (token_h,)
            )
            token_record = cursor.fetchone()

            if not token_record:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired password reset token"
                )

            if token_record["is_used"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This password reset token has already been used"
                )

            expires_at = datetime.fromisoformat(token_record["expires_at"])
            if datetime.utcnow() > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password reset token has expired"
                )

            user_id = token_record["user_id"]
            # Update password
            cursor.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (hash_password(new_password), user_id)
            )
            # Invalidate token
            cursor.execute("UPDATE auth_tokens SET is_used = 1 WHERE id = ?", (token_record["id"],))
            # Invalidate all active user sessions per Section 3.6
            cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))

        send_password_changed_notification(token_record["email"], token_record["full_name"])

        return {
            "success": True,
            "message": "Password updated successfully. Please log in with your new password."
        }
    finally:
        conn.close()

