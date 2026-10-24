"""
Integration and End-to-End Tests for CloudOps Lab Troubleshooting & Recovery Engine.
Member 3 (Diagnostics & Recovery) & Member 4 (Platform Engineering & Quality)
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.workflow_engine import (
    initialize_workflow_session,
    inject_workflow_fault,
    run_workflow_diagnostics,
    apply_workflow_remediation,
    verify_workflow_recovery,
    generate_workflow_markdown_report
)

client = TestClient(app)


def test_workflow_e2e_https_recovery_lifecycle():
    """
    Validates complete 7-step lifecycle for Scenario 1 (Missing Inbound HTTPS).
    """
    # Step 1: Init Lab
    session = initialize_workflow_session("standard_two_tier", "simulation")
    assert session.current_step == 2
    assert session.lab.vpc.cidr_block == "10.0.0.0/16"

    # Step 2: Inject Fault
    session = inject_workflow_fault("sg_missing_https")
    assert session.current_step == 3
    assert session.injected_fault_id == "sg_missing_https"

    # Step 3 & 4: Run Diagnostics & Root-Cause Analysis
    session = run_workflow_diagnostics()
    assert session.current_step == 5
    assert session.fault_diagnostics is not None
    assert session.rca_report is not None
    assert session.rca_report.primary_cause_id == "RCA-SG-MISSING-HTTPS"
    assert session.rca_report.confidence_score >= 0.90
    assert session.rca_report.remediation is not None
    assert "443" in session.rca_report.remediation.proposed_code

    # Step 5: Safety Guardrail - Rejection with invalid token
    with pytest.raises(ValueError, match="Safety rejection"):
        apply_workflow_remediation("WRONG_TOKEN", False)

    # Step 5: Authorized Remediation
    session = apply_workflow_remediation("CONFIRM_REMEDIATION", False)
    assert session.current_step == 6
    assert session.applied_remediation is not None

    # Step 6: Verify Recovery
    session = verify_workflow_recovery()
    assert session.current_step == 7
    assert session.recovery_result is not None
    assert session.recovery_result.recovered is True
    assert "SG-001" in session.recovery_result.resolved_findings
    assert session.recovery_result.current_failing_count == 0

    # Step 7: Markdown Report Generation
    md = generate_workflow_markdown_report(session)
    assert "# CloudOps Lab — Troubleshooting & Recovery Experiment Report" in md
    assert "SUCCESSFULLY RECOVERED" in md
    assert session.session_id in md


@pytest.mark.parametrize("fault_id,expected_rca", [
    ("missing_default_route", "RCA-RT-MISSING-DEFAULT"),
    ("igw_detached", "RCA-IGW-DETACHED"),
    ("subnet_overlap", "RCA-SUBNET-OVERLAP"),
    ("invalid_cidr_boundary", "RCA-INVALID-CIDR-BOUNDARY")
])
def test_workflow_all_fault_scenarios_rca(fault_id, expected_rca):
    """
    Confirms RCA rules correctly deduce all 5 intentional failure scenarios deterministically.
    """
    initialize_workflow_session()
    inject_workflow_fault(fault_id)
    session = run_workflow_diagnostics()

    assert session.rca_report is not None
    assert session.rca_report.primary_cause_id == expected_rca
    assert session.rca_report.remediation is not None
    assert session.rca_report.confidence_score >= 0.90


def test_workflow_api_endpoints():
    """
    Tests REST API endpoints for workflow orchestration.
    """
    # 1. GET session
    r1 = client.get("/api/workflow/session")
    assert r1.status_code == 200
    data1 = r1.json()
    assert "session_id" in data1

    # 2. POST init
    r2 = client.post("/api/workflow/init", json={"lab_template_id": "standard_two_tier", "mode": "simulation"})
    assert r2.status_code == 200

    # 3. POST inject fault
    r3 = client.post("/api/workflow/inject-fault", json={"fault_id": "missing_default_route"})
    assert r3.status_code == 200
    assert r3.json()["injected_fault_id"] == "missing_default_route"

    # 4. POST run diagnostics & RCA
    r4 = client.post("/api/workflow/run-diagnostics")
    assert r4.status_code == 200
    assert r4.json()["rca_report"]["primary_cause_id"] == "RCA-RT-MISSING-DEFAULT"

    # 5. POST apply remediation without token -> 400
    r5_bad = client.post("/api/workflow/apply-remediation", json={"remediation_id": "auto", "confirmation_token": "INVALID"})
    assert r5_bad.status_code == 400

    # 5b. POST apply with CONFIRM_REMEDIATION
    r5_good = client.post("/api/workflow/apply-remediation", json={"remediation_id": "auto", "confirmation_token": "CONFIRM_REMEDIATION"})
    assert r5_good.status_code == 200

    # 6. POST verify recovery
    r6 = client.post("/api/workflow/verify-recovery")
    assert r6.status_code == 200
    assert r6.json()["recovery_result"]["recovered"] is True

    # 7. GET markdown report
    r7 = client.get("/api/workflow/report/markdown")
    assert r7.status_code == 200
    assert "markdown" in r7.json()
    assert "# CloudOps Lab" in r7.json()["markdown"]
