import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data

def test_network_validate_success():
    payload = {
        "vpc_cidr": "10.0.0.0/16",
        "subnets": [
            {"name": "pub-1", "cidr": "10.0.1.0/24"},
            {"name": "priv-1", "cidr": "10.0.2.0/24"}
        ]
    }
    response = client.post("/api/network/validate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is True
    assert len(data["subnets"]) == 2
    assert data["subnets"][0]["usable_ips"] == 251

def test_network_validate_malformed():
    payload = {
        "vpc_cidr": "invalid-cidr",
        "subnets": []
    }
    response = client.post("/api/network/validate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is False
    assert len(data["errors"]) > 0

def test_terraform_validate_api():
    response = client.post("/api/terraform/validate")
    assert response.status_code == 200
    data = response.json()
    assert data["action"] == "validate"
    assert data["success"] is True

def test_terraform_apply_guardrail():
    # Calling apply without confirmation must fail with HTTP 400
    response = client.post("/api/terraform/apply", json={"action": "apply"})
    assert response.status_code == 400
    assert "confirmation_phrase" in response.json()["detail"]

def test_terraform_destroy_guardrail():
    # Calling destroy without confirmation must fail with HTTP 400
    response = client.post("/api/terraform/destroy", json={"action": "destroy"})
    assert response.status_code == 400
    assert "confirmation_phrase" in response.json()["detail"]

def test_diagnostics_catalogue_api():
    response = client.get("/api/diagnostics/catalogue")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 10
    ids = [item["check_id"] for item in items]
    assert "CIDR-001" in ids
    assert "RT-001" in ids
    assert "SG-001" in ids

def test_diagnostics_run_api():
    response = client.post("/api/diagnostics/run", json={"force_simulated_aws": True})
    assert response.status_code == 200
    data = response.json()
    assert data["total_checks"] > 0
    assert "findings" in data

def test_fault_simulation_toggle():
    # Toggle missing HTTPS rule
    resp = client.post("/api/lab/simulate-fault", json={"fault_id": "sg_missing_https", "enable": True})
    assert resp.status_code == 200
    assert resp.json()["active_faults"]["sg_missing_https"] is True

    # Re-run diagnostics to verify detection
    diag_resp = client.post("/api/diagnostics/run", json={"force_simulated_aws": True})
    findings = {f["check_id"]: f for f in diag_resp.json()["findings"]}
    assert findings["SG-001"]["status"] == "FAIL"

    # Reset
    client.post("/api/lab/simulate-fault", json={"fault_id": "sg_missing_https", "enable": False})

def test_infrastructure_inventory_api():
    response = client.get("/api/infrastructure/inventory")
    assert response.status_code == 200
    data = response.json()
    assert "vpc" in data
    assert data["vpc"]["cidr_block"] == "10.0.0.0/16"
    assert "subnets" in data
    assert len(data["subnets"]) == 2
    assert "security_groups" in data
    assert len(data["security_groups"]) > 0

