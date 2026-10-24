import pytest
from backend.app.terraform_runner import (
    run_terraform_command,
    sanitize_variables,
    parse_terraform_plan_summary
)

def test_disallowed_command_blocked():
    # Attempt arbitrary command injection
    res = run_terraform_command("rm -rf /")
    assert res.success is False
    assert "Security violation" in res.stderr
    assert res.exit_code == -1

def test_apply_without_confirmation_rejected():
    res = run_terraform_command("apply")
    assert res.success is False
    assert "CONFIRM_APPLY" in res.stderr
    assert res.exit_code == 400

def test_destroy_without_confirmation_rejected():
    res = run_terraform_command("destroy")
    assert res.success is False
    assert "CONFIRM_DESTROY" in res.stderr
    assert res.exit_code == 400

def test_variable_sanitization():
    raw_vars = {
        "vpc_cidr": "10.0.0.0/16",
        "enable_https_ingress": True,
        "malicious_key": "some_value; drop database",
        "aws_region": "us-east-1"
    }
    cleaned = sanitize_variables(raw_vars)
    assert "malicious_key" not in cleaned
    assert cleaned["vpc_cidr"] == "10.0.0.0/16"
    assert cleaned["enable_https_ingress"] is True
    assert cleaned["aws_region"] == "us-east-1"

def test_variable_sanitization_rejects_special_characters():
    with pytest.raises(ValueError):
        sanitize_variables({"vpc_cidr": "10.0.0.0/16; cat /etc/passwd"})

def test_parse_plan_summary():
    output = "Plan: 5 to add, 1 to change, 0 to destroy."
    summary = parse_terraform_plan_summary(output)
    assert summary == {"to_add": 5, "to_change": 1, "to_destroy": 0}

def test_terraform_validate_succeeds():
    # Test our initialized infrastructure directory
    res = run_terraform_command("validate")
    assert res.success is True
    assert res.exit_code == 0
