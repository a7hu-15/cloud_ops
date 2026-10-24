import pytest
from backend.app.schemas import SubnetInput
from backend.app.diagnostics import (
    execute_diagnostic_suite,
    set_simulated_fault,
    get_active_faults,
    check_conn_001_live_connectivity,
    check_tf_001_terraform_validate
)

def setup_function():
    # Reset faults before each test
    for fault in ["sg_missing_https", "missing_default_route", "igw_detached", "subnet_overlap", "invalid_cidr_boundary"]:
        set_simulated_fault(fault, False)

def test_full_diagnostic_suite_healthy():
    resp = execute_diagnostic_suite(force_simulated_aws=True)
    assert resp.total_checks >= 8
    # With healthy defaults, static and simulated AWS checks should pass
    finding_map = {f.check_id: f for f in resp.findings}
    assert "CIDR-001" in finding_map
    assert "CIDR-002" in finding_map
    assert "CIDR-003" in finding_map
    assert "TF-001" in finding_map
    assert "RT-001" in finding_map
    assert "IGW-001" in finding_map
    assert "SG-001" in finding_map
    assert "PUB-001" in finding_map

    assert finding_map["CIDR-001"].status == "PASS"
    assert finding_map["SG-001"].status == "PASS"
    assert finding_map["RT-001"].status == "PASS"
    assert finding_map["IGW-001"].status == "PASS"

def test_fault_injection_sg_missing_https():
    # Inject fault: Remove expected HTTPS rule (Section 15 intentional failure case)
    set_simulated_fault("sg_missing_https", True)
    resp = execute_diagnostic_suite(force_simulated_aws=True)
    finding_map = {f.check_id: f for f in resp.findings}

    sg_finding = finding_map["SG-001"]
    assert sg_finding.status == "FAIL"
    assert sg_finding.severity == "HIGH"
    assert "443" in sg_finding.evidence
    assert "Add an inbound rule" in sg_finding.recommendation

def test_fault_injection_missing_default_route():
    set_simulated_fault("missing_default_route", True)
    resp = execute_diagnostic_suite(force_simulated_aws=True)
    finding_map = {f.check_id: f for f in resp.findings}

    rt_finding = finding_map["RT-001"]
    assert rt_finding.status == "FAIL"
    assert "0.0.0.0/0" in rt_finding.evidence
    assert "public route table" in rt_finding.recommendation

def test_fault_injection_igw_detached():
    set_simulated_fault("igw_detached", True)
    resp = execute_diagnostic_suite(force_simulated_aws=True)
    finding_map = {f.check_id: f for f in resp.findings}

    igw_finding = finding_map["IGW-001"]
    assert igw_finding.status == "FAIL"
    assert "detached" in igw_finding.evidence

def test_conn_001_invalid_host():
    finding = check_conn_001_live_connectivity(target_host="invalid; rm -rf /")
    assert finding.status == "ERROR"
    assert "Invalid target host" in finding.evidence
