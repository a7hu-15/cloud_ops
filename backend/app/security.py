import re
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Tuple
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

ph = PasswordHasher()

# Regex for strict standard email validation matching Section 3.3
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)

def normalize_and_validate_email(email: str) -> Tuple[bool, str, str]:
    """
    Validates email according to Section 3.3 rules.
    Returns: (is_valid, normalized_email_or_error_message, raw_trimmed_email)
    """
    if not email or not isinstance(email, str):
        return False, "Email address is required", ""

    trimmed = email.strip()
    if len(trimmed) > 254:
        return False, "Email address exceeds maximum length of 254 characters", ""

    # Reject display names such as User Name <user@example.com>
    if "<" in trimmed or ">" in trimmed or "(" in trimmed or ")" in trimmed:
        return False, "Email address must not include display names or angle brackets", ""

    # Reject whitespace and control characters anywhere in the string
    if any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in trimmed):
        return False, "Email address contains invalid whitespace or control characters", ""

    parts = trimmed.split("@")
    if len(parts) != 2:
        return False, "Email address must contain exactly one '@' separator", ""

    local_part, domain_part = parts[0], parts[1]
    if not local_part or not domain_part:
        return False, "Email local part and domain must not be empty", ""

    if not EMAIL_REGEX.match(trimmed):
        return False, "Malformed email address syntax", ""

    normalized = f"{local_part}@{domain_part.lower()}"
    return True, normalized, trimmed

def validate_password(password: str) -> Tuple[bool, str]:
    """
    Validates password according to Section 3.4 rules.
    - Min 12 characters, max 128 characters
    - Must not be entirely whitespace
    - No silent trimming
    """
    if not password or not isinstance(password, str):
        return False, "Password is required"

    if len(password) < 12:
        return False, "Password must be at least 12 characters long"

    if len(password) > 128:
        return False, "Password must not exceed 128 characters"

    if password.strip() == "":
        return False, "Password cannot be entirely whitespace"

    return True, ""

def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return ph.hash(password)

def verify_password(hashed: str, plain: str) -> bool:
    """Verify password against Argon2id hash."""
    try:
        return ph.verify(hashed, plain)
    except (VerifyMismatchError, InvalidHashError):
        return False

def hash_token(token: str) -> str:
    """Hash a token using SHA-256 for secure DB storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def generate_secure_token() -> str:
    """Generates a cryptographically random, unguessable token."""
    return secrets.token_urlsafe(32)

def generate_session_token() -> str:
    """Generates a secure random session token."""
    return secrets.token_urlsafe(36)

