import pytest
import sqlite3
import os
import tempfile
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db import init_db
from backend.app.security import hash_token, hash_password

@pytest.fixture(autouse=True)
def test_db_isolation(monkeypatch):
    """
    Creates a temporary SQLite database for each test to guarantee complete test isolation.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    monkeypatch.setenv("CLOUDOPS_DB_PATH", db_path)
    init_db(db_path)
    yield db_path
    if os.path.exists(db_path):
        os.remove(db_path)

@pytest.fixture
def client():
    return TestClient(app)

# ------------------------------------------------------------------------------
# Authentication Tests (Section 12 Specification)
# ------------------------------------------------------------------------------

def test_valid_registration(client):
    res = client.post("/api/auth/register", json={
        "full_name": "Alice Engineer",
        "email": "alice@cloudops.edu",
        "password": "CorrectPassword123!",
        "confirm_password": "CorrectPassword123!",
        "terms_accepted": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "verification_token_debug" in data

def test_registration_terms_required(client):
    res = client.post("/api/auth/register", json={
        "full_name": "Alice Engineer",
        "email": "alice@cloudops.edu",
        "password": "CorrectPassword123!",
        "confirm_password": "CorrectPassword123!",
        "terms_accepted": False
    })
    assert res.status_code == 400
    assert "Terms of Use" in res.json()["detail"]

def test_invalid_email_rejection(client):
    invalid_emails = [
        "notanemail",
        "user@",
        "@domain.com",
        "user name@domain.com",
        "User <user@domain.com>",
        "user@domain..com",
        "user\n@domain.com"
    ]
    for bad_email in invalid_emails:
        res = client.post("/api/auth/register", json={
            "full_name": "Bob Tester",
            "email": bad_email,
            "password": "ValidPassword123!",
            "confirm_password": "ValidPassword123!",
            "terms_accepted": True
        })
        assert res.status_code == 400

def test_password_policy_enforcement(client):
    # Too short (< 12 chars)
    res = client.post("/api/auth/register", json={
        "full_name": "Short Pwd",
        "email": "short@cloudops.edu",
        "password": "short",
        "confirm_password": "short",
        "terms_accepted": True
    })
    assert res.status_code in (400, 422)

    # Whitespace only
    res = client.post("/api/auth/register", json={
        "full_name": "Blank Pwd",
        "email": "blank@cloudops.edu",
        "password": "            ",
        "confirm_password": "            ",
        "terms_accepted": True
    })
    assert res.status_code in (400, 422)

    # Password mismatch
    res = client.post("/api/auth/register", json={
        "full_name": "Mismatch",
        "email": "mismatch@cloudops.edu",
        "password": "ValidPassword123!",
        "confirm_password": "DifferentPassword123!",
        "terms_accepted": True
    })
    assert res.status_code in (400, 422)

def test_unverified_login_blocked(client):
    # Register
    client.post("/api/auth/register", json={
        "full_name": "Unverified User",
        "email": "unverified@cloudops.edu",
        "password": "ValidPassword123!",
        "confirm_password": "ValidPassword123!",
        "terms_accepted": True
    })

    # Attempt login before email verification
    res = client.post("/api/auth/login", json={
        "email": "unverified@cloudops.edu",
        "password": "ValidPassword123!"
    })
    assert res.status_code == 403
    assert "not verified" in res.json()["detail"].lower()

def test_duplicate_verified_email_rejection(client):
    # Register and verify
    reg = client.post("/api/auth/register", json={
        "full_name": "First User",
        "email": "duplicate@cloudops.edu",
        "password": "ValidPassword123!",
        "confirm_password": "ValidPassword123!",
        "terms_accepted": True
    }).json()

    client.post("/api/auth/verify-email", json={"token": reg["verification_token_debug"]})

    # Attempt to register duplicate
    res = client.post("/api/auth/register", json={
        "full_name": "Duplicate User",
        "email": "duplicate@cloudops.edu",
        "password": "AnotherPassword123!",
        "confirm_password": "AnotherPassword123!",
        "terms_accepted": True
    })
    assert res.status_code == 400
    assert "already registered" in res.json()["detail"].lower()

def test_verification_token_single_use(client):
    reg = client.post("/api/auth/register", json={
        "full_name": "Token Tester",
        "email": "tokentest@cloudops.edu",
        "password": "ValidPassword123!",
        "confirm_password": "ValidPassword123!",
        "terms_accepted": True
    }).json()
    token = reg["verification_token_debug"]

    # First verification succeeds
    res1 = client.post("/api/auth/verify-email", json={"token": token})
    assert res1.status_code == 200

    # Second verification fails
    res2 = client.post("/api/auth/verify-email", json={"token": token})
    assert res2.status_code == 400
    assert "already been used" in res2.json()["detail"].lower()

def test_verification_token_expiration(client, monkeypatch):
    reg = client.post("/api/auth/register", json={
        "full_name": "Expire User",
        "email": "expire@cloudops.edu",
        "password": "ValidPassword123!",
        "confirm_password": "ValidPassword123!",
        "terms_accepted": True
    }).json()
    token = reg["verification_token_debug"]

    # Manually backdate token expiration in DB
    db_path = os.environ["CLOUDOPS_DB_PATH"]
    conn = sqlite3.connect(db_path)
    with conn:
        past_time = (datetime.utcnow() - timedelta(minutes=45)).isoformat()
        conn.execute("UPDATE auth_tokens SET expires_at = ?", (past_time,))
    conn.close()

    res = client.post("/api/auth/verify-email", json={"token": token})
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()

def test_login_and_logout_flow(client):
    # Register & verify
    reg = client.post("/api/auth/register", json={
        "full_name": "Carol Cloud",
        "email": "carol@cloudops.edu",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
        "terms_accepted": True
    }).json()
    client.post("/api/auth/verify-email", json={"token": reg["verification_token_debug"]})

    # Incorrect password
    bad_login = client.post("/api/auth/login", json={
        "email": "carol@cloudops.edu",
        "password": "WrongPassword999!"
    })
    assert bad_login.status_code == 401

    # Correct login
    login_res = client.post("/api/auth/login", json={
        "email": "carol@cloudops.edu",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    session_token = login_res.json()["session_token"]

    # Check /api/auth/me using Bearer header
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {session_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "carol@cloudops.edu"

    # Logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {session_token}"})
    assert logout_res.status_code == 200

    # Ensure session invalidated
    me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {session_token}"})
    assert me_after.status_code == 401

def test_password_reset_flow(client):
    # Register & verify
    reg = client.post("/api/auth/register", json={
        "full_name": "David Reset",
        "email": "david@cloudops.edu",
        "password": "InitialPassword123!",
        "confirm_password": "InitialPassword123!",
        "terms_accepted": True
    }).json()
    client.post("/api/auth/verify-email", json={"token": reg["verification_token_debug"]})

    # Request reset
    forgot_res = client.post("/api/auth/forgot-password", json={"email": "david@cloudops.edu"})
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json()["reset_token_debug"]

    # Reset password
    reset_res = client.post("/api/auth/reset-password", json={
        "token": reset_token,
        "new_password": "UpdatedPassword456!",
        "confirm_password": "UpdatedPassword456!"
    })
    assert reset_res.status_code == 200

    # Old password fails
    old_login = client.post("/api/auth/login", json={
        "email": "david@cloudops.edu",
        "password": "InitialPassword123!"
    })
    assert old_login.status_code == 401

    # New password succeeds
    new_login = client.post("/api/auth/login", json={
        "email": "david@cloudops.edu",
        "password": "UpdatedPassword456!"
    })
    assert new_login.status_code == 200

# ------------------------------------------------------------------------------
# Network Configurations & User Data Isolation Tests (Section 12)
# ------------------------------------------------------------------------------

def test_network_configurations_crud_and_isolation(client):
    # Register User A
    reg_a = client.post("/api/auth/register", json={
        "full_name": "User A",
        "email": "usera@cloudops.edu",
        "password": "PasswordUserA123!",
        "confirm_password": "PasswordUserA123!",
        "terms_accepted": True
    }).json()
    client.post("/api/auth/verify-email", json={"token": reg_a["verification_token_debug"]})
    token_a = client.post("/api/auth/login", json={
        "email": "usera@cloudops.edu",
        "password": "PasswordUserA123!"
    }).json()["session_token"]

    # Register User B
    reg_b = client.post("/api/auth/register", json={
        "full_name": "User B",
        "email": "userb@cloudops.edu",
        "password": "PasswordUserB123!",
        "confirm_password": "PasswordUserB123!",
        "terms_accepted": True
    }).json()
    client.post("/api/auth/verify-email", json={"token": reg_b["verification_token_debug"]})
    token_b = client.post("/api/auth/login", json={
        "email": "userb@cloudops.edu",
        "password": "PasswordUserB123!"
    }).json()["session_token"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a network configuration
    create_res = client.post(
        "/api/networks",
        json={
            "name": "Production VPC Lab",
            "region": "us-east-1",
            "vpc_cidr": "10.0.0.0/16",
            "subnets": [
                {"name": "public-web", "cidr": "10.0.1.0/24", "tier": "public"},
                {"name": "private-db", "cidr": "10.0.2.0/24", "tier": "private"}
            ]
        },
        headers=headers_a
    )
    assert create_res.status_code == 201
    config_id = create_res.json()["id"]

    # User A can list it
    list_a = client.get("/api/networks", headers=headers_a).json()
    assert len(list_a) == 1
    assert list_a[0]["name"] == "Production VPC Lab"

    # User B cannot see User A's config
    list_b = client.get("/api/networks", headers=headers_b).json()
    assert len(list_b) == 0

    # User B cannot retrieve User A's config
    get_b = client.get(f"/api/networks/{config_id}", headers=headers_b)
    assert get_b.status_code == 404

    # Topology generation for saved network
    topo_res = client.post(f"/api/networks/{config_id}/topology", headers=headers_a)
    assert topo_res.status_code == 200
    topo = topo_res.json()
    assert len(topo["nodes"]) >= 5
    assert len(topo["edges"]) >= 4

# ------------------------------------------------------------------------------
# Reports and Experiment Tracking Tests (Section 12)
# ------------------------------------------------------------------------------

def test_reports_creation_and_isolation(client):
    reg = client.post("/api/auth/register", json={
        "full_name": "Report Tester",
        "email": "reports@cloudops.edu",
        "password": "ReportPassword123!",
        "confirm_password": "ReportPassword123!",
        "terms_accepted": True
    }).json()
    client.post("/api/auth/verify-email", json={"token": reg["verification_token_debug"]})
    token = client.post("/api/auth/login", json={
        "email": "reports@cloudops.edu",
        "password": "ReportPassword123!"
    }).json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Save an experiment report
    save_res = client.post(
        "/api/reports",
        json={
            "mode": "simulation",
            "fault_scenario": "fault_missing_https_sg",
            "initial_result": {
                "total_checks": 10,
                "passed": 9,
                "failed": 1,
                "findings": [{"check_id": "SG-001", "severity": "HIGH", "status": "FAIL", "evidence": "Port 443 blocked"}]
            },
            "remediation": {
                "root_cause": "Missing HTTPS SG rule",
                "terraform_diff": "+ ingress { from_port = 443 }"
            },
            "final_result": {
                "total_checks": 10,
                "passed": 10,
                "failed": 0,
                "findings": []
            },
            "recovery_status": "recovered"
        },
        headers=headers
    )
    assert save_res.status_code == 201
    rep_id = save_res.json()["id"]

    # List reports
    reps = client.get("/api/reports", headers=headers).json()
    assert len(reps) == 1
    assert reps[0]["fault_scenario"] == "fault_missing_https_sg"

    # Export markdown
    export_md = client.get(f"/api/reports/{rep_id}/export?format=markdown", headers=headers)
    assert export_md.status_code == 200
    assert "CloudOps Lab — Troubleshooting & Verification Report" in export_md.text
    assert "RECOVERY VERIFIED" in export_md.text

    # Export JSON
    export_json = client.get(f"/api/reports/{rep_id}/export?format=json", headers=headers)
    assert export_json.status_code == 200
    assert export_json.json()["id"] == rep_id
