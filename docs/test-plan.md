# CloudOps Lab - Test Plan & Acceptance Matrix

## 1. Overview
The testing strategy enforces multi-tier quality assurance without requiring live AWS credit consumption for regular automated runs:
1. **Unit Tests (Local)**: CIDR validation, subnet calculations, boundary containment, and overlap detection using Python `ipaddress`.
2. **Security & Guardrail Tests**: Process allowlisting, injection blocking, confirmation token validation, and variable sanitization.
3. **API Integration Tests**: FastAPI endpoints, HTTP request/response validation with Pydantic, and error handling.
4. **Terraform CLI Tests**: Format checks (`fmt -check`), provider initialization (`init -backend=false`), and syntax validation (`validate`).
5. **High-Fidelity Simulated / Live AWS Checks**: Boto3 inspection with simulated fallback for academic demo without credentials.

---

## 2. Test Cases & Acceptance Criteria (Section 14)

| Test Area | Test Case ID | Test Input / Action | Expected Result | Verified By |
|---|---|---|---|---|
| **Unit** | TC-NET-01 | Valid CIDR `10.0.0.0/16` and subnets `10.0.1.0/24`, `10.0.2.0/24` | Accepted; calculates 256 total and 251 usable IPs per subnet (.0-.3, .255 reserved). | `test_network.py::test_validate_valid_network_plan` |
| **Unit** | TC-NET-02 | Malformed CIDR `not-a-cidr` or `10.0.1.5/24` (host bits set) | Rejected with clear diagnostic error explaining host bits or syntax. | `test_network.py::test_parse_cidr_with_host_bits_set` |
| **Unit** | TC-NET-03 | Overlapping subnets `10.0.1.0/24` and `10.0.1.128/25` | Rejected; flags CIDR overlap between the two subnets. | `test_network.py::test_validate_overlapping_subnets` |
| **Unit** | TC-NET-04 | Subnet `192.168.1.0/24` inside VPC `10.0.0.0/16` | Rejected; flags containment violation (outside VPC boundary). | `test_network.py::test_validate_subnet_outside_vpc` |
| **API** | TC-API-01 | Missing required JSON field or invalid schema | Returns HTTP 422/400 with structured error; no crash or stack trace leak. | `test_api.py::test_network_validate_malformed` |
| **Security** | TC-SEC-01 | Shell injection attempt `rm -rf /` or `; cat /etc/passwd` | Rejected immediately with Security Violation; command blocked by allowlist. | `test_terraform_runner.py::test_disallowed_command_blocked` |
| **Security** | TC-SEC-02 | `POST /api/terraform/apply` without confirmation | Rejected with HTTP 400 and message requiring `CONFIRM_APPLY`. | `test_api.py::test_terraform_apply_guardrail` |
| **Security** | TC-SEC-03 | `POST /api/terraform/destroy` without confirmation | Rejected with HTTP 400 and message requiring `CONFIRM_DESTROY`. | `test_api.py::test_terraform_destroy_guardrail` |
| **Terraform** | TC-TF-01 | `terraform validate` on `infrastructure/` | Validates syntax cleanly and exits with status 0. | `test_terraform_runner.py::test_terraform_validate_succeeds` |
| **Fault Recovery** | TC-FLT-01 | Inject missing HTTPS rule (`sg_missing_https=True`) | Check `SG-001` reports FAIL with evidence showing missing port 443. | `test_diagnostics.py::test_fault_injection_sg_missing_https` |
| **Fault Recovery** | TC-FLT-02 | Clear fault (`sg_missing_https=False`) and rerun | Check `SG-001` recovers and reports PASS. | `test_api.py::test_fault_simulation_toggle` |

---

## 3. Running Automated Tests Locally

```bash
# Activate virtual environment
source .venv/bin/activate

# Execute all test suites with verbose output
PYTHONPATH=. pytest backend/tests/ -v
```
