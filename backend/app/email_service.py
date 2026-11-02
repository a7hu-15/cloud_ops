import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger("cloudops.email")

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@cloudops-lab.local")
FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5173")

def is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)

def send_email(to_email: str, subject: str, text_body: str) -> bool:
    """
    Sends email via SMTP if configured; otherwise logs link to local console in development mode.
    """
    if not is_smtp_configured():
        # Development Mode: Log to console clearly
        print("\n" + "=" * 64)
        print(f"[CLOUDOPS EMAIL - DEVELOPMENT MODE]")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print("-" * 64)
        print(text_body.strip())
        print("=" * 64 + "\n")
        logger.info("Simulated email dispatched to %s with subject: %s", to_email, subject)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(text_body, "plain"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SENDER_EMAIL, [to_email], msg.as_string())
        return True
    except Exception as e:
        logger.error("Failed to deliver SMTP email to %s: %s", to_email, e)
        return False

def send_verification_email(to_email: str, full_name: str, token: str) -> bool:
    verify_url = f"{FRONTEND_BASE_URL}/verify?token={token}"
    subject = "CloudOps Lab - Verify Your Account"
    body = f"""Hello {full_name},

Thank you for registering with CloudOps Lab.

To activate your account and start your network engineering labs, please verify your email address by opening the following link:

{verify_url}

This verification link will expire in 30 minutes and can only be used once.

If you did not register for CloudOps Lab, please disregard this email.

--
CloudOps Lab Platform
"""
    return send_email(to_email, subject, body)

def send_password_reset_email(to_email: str, full_name: str, token: str) -> bool:
    reset_url = f"{FRONTEND_BASE_URL}/reset-password?token={token}"
    subject = "CloudOps Lab - Password Reset Request"
    body = f"""Hello {full_name},

A password reset was requested for your CloudOps Lab account.

To choose a new password, click the link below:

{reset_url}

This link is valid for 30 minutes and can only be used once.

If you did not request a password reset, no action is needed; your current password remains secure.

--
CloudOps Lab Platform
"""
    return send_email(to_email, subject, body)

def send_password_changed_notification(to_email: str, full_name: str) -> bool:
    subject = "CloudOps Lab - Security Notice: Password Changed"
    body = f"""Hello {full_name},

This notification confirms that the password for your CloudOps Lab account was successfully updated.

All previous active sessions have been invalidated. If you made this change, you may safely ignore this message.

If you did not make this change, please contact your laboratory administrator immediately.

--
CloudOps Lab Platform
"""
    return send_email(to_email, subject, body)

