from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
import ipaddress

class SubnetInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=64, description="Human-readable subnet identifier")
    cidr: str = Field(..., description="IPv4 CIDR block string, e.g. 10.0.1.0/24")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        # Sanitize name to avoid weird characters
        clean = v.strip()
        if not all(c.isalnum() or c in ("-", "_") for c in clean):
            raise ValueError("Subnet name may only contain alphanumeric characters, hyphens, and underscores")
        return clean

class NetworkValidationRequest(BaseModel):
    vpc_cidr: str = Field(default="10.0.0.0/16", description="VPC IPv4 CIDR block")
    subnets: List[SubnetInput] = Field(
        default_factory=lambda: [
            SubnetInput(name="public-subnet", cidr="10.0.1.0/24"),
            SubnetInput(name="private-subnet", cidr="10.0.2.0/24")
        ],
        description="List of subnets to validate inside the VPC"
    )

class SubnetCalculation(BaseModel):
    name: str
    cidr: str
    network_address: str
    netmask: str
    broadcast_address: str
    prefix_length: int
    total_ips: int
    aws_reserved_ips: int = 5
    usable_ips: int
    first_usable_ip: Optional[str]
    last_usable_ip: Optional[str]
    is_contained_in_vpc: bool

class NetworkValidationResult(BaseModel):
    is_valid: bool
    vpc_cidr: str
    vpc_total_ips: int
    vpc_netmask: str
    subnets: List[SubnetCalculation]
    errors: List[str]
    warnings: List[str]
    notes: List[str]

class TerraformRunRequest(BaseModel):
    action: Literal["fmt_check", "init", "validate", "plan", "apply", "destroy"]
    confirmation_phrase: Optional[str] = Field(
        default=None,
        description="Required for apply ('CONFIRM_APPLY') and destroy ('CONFIRM_DESTROY') for safety"
    )
    variables: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Terraform variables dictionary. Strict type-checked and sanitized."
    )

class TerraformRunResponse(BaseModel):
    success: bool
    action: str
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float
    summary: Optional[Dict[str, Any]] = None

CheckType = Literal["static", "aws_config", "terraform_cli", "live_test"]
SeverityLevel = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
FindingStatus = Literal["PASS", "FAIL", "WARNING", "SKIPPED", "ERROR"]

class DiagnosticFinding(BaseModel):
    check_id: str
    title: str
    status: FindingStatus
    severity: SeverityLevel
    source: CheckType
    evidence: str
    recommendation: str
    details: Optional[Dict[str, Any]] = None

class DiagnosticsRunRequest(BaseModel):
    checks: Optional[List[str]] = Field(default=None, description="List of check IDs to run. Runs all if omitted.")
    force_simulated_aws: bool = Field(default=False, description="Simulate AWS calls if no live AWS credentials exist")
    target_host: Optional[str] = Field(default=None, description="Optional target for live connection test CONN-001")

class DiagnosticsRunResponse(BaseModel):
    total_checks: int
    passed: int
    failed: int
    warnings: int
    findings: List[DiagnosticFinding]
    execution_time_seconds: float
    aws_mode: Literal["live_aws", "simulated", "offline"]

class FaultSimulationRequest(BaseModel):
    fault_id: Literal[
        "sg_missing_https",
        "subnet_overlap",
        "missing_default_route",
        "igw_detached",
        "invalid_cidr_boundary"
    ]
    enable: bool

class FaultSimulationStatus(BaseModel):
    active_faults: Dict[str, bool]

# ------------------------------------------------------------------------------
# Authentication Schemas (Section 3)
# ------------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=128)
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=12, max_length=128)
    confirm_password: str = Field(..., min_length=12, max_length=128)
    terms_accepted: bool = Field(...)

class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=10)

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(...)

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=12, max_length=128)
    confirm_password: str = Field(..., min_length=12, max_length=128)

class UserProfileResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_verified: bool
    created_at: str

# ------------------------------------------------------------------------------
# Network Configuration & Topology Schemas (Section 4.2 C, D, 5.1, 5.2, 6)
# ------------------------------------------------------------------------------
class SubnetConfigItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    cidr: str = Field(..., description="IPv4 CIDR block")
    tier: Literal["public", "private"] = Field(default="public")

class NetworkConfigCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    region: str = Field(default="us-east-1", max_length=32)
    vpc_cidr: str = Field(default="10.0.0.0/16")
    subnets: List[SubnetConfigItem]

class NetworkConfigUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    region: str = Field(default="us-east-1", max_length=32)
    vpc_cidr: str = Field(default="10.0.0.0/16")
    subnets: List[SubnetConfigItem]

class TopologyGenerateRequest(BaseModel):
    vpc_cidr: str = Field(default="10.0.0.0/16")
    subnets: List[SubnetConfigItem]
    region: str = Field(default="us-east-1")

# ------------------------------------------------------------------------------
# Predefined Fault Scenarios (Section 5.6, 6)
# ------------------------------------------------------------------------------
class ExperimentFaultRequest(BaseModel):
    fault_scenario: Literal[
        "fault_missing_https_sg",
        "fault_missing_default_route",
        "fault_igw_detached",
        "fault_subnet_overlap",
        "fault_invalid_cidr_boundary"
    ]
    enable: bool = True

# ------------------------------------------------------------------------------
# Experiment Report Schemas (Section 4.2 G, 5.10, 6)
# ------------------------------------------------------------------------------
class SaveExperimentReportRequest(BaseModel):
    network_config_id: Optional[int] = None
    mode: str = "simulation"
    fault_scenario: Optional[str] = None
    initial_result: Dict[str, Any]
    remediation: Optional[Dict[str, Any]] = None
    final_result: Optional[Dict[str, Any]] = None
    recovery_status: str = "pending"
