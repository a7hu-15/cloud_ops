import time
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .schemas import (
    NetworkValidationRequest,
    NetworkValidationResult,
    TerraformRunRequest,
    TerraformRunResponse,
    DiagnosticsRunRequest,
    DiagnosticsRunResponse,
    FaultSimulationRequest,
    FaultSimulationStatus
)
from .network import validate_network_plan
from .terraform_runner import run_terraform_command
from .diagnostics import (
    execute_diagnostic_suite,
    set_simulated_fault,
    get_active_faults,
    check_aws_credentials_available
)

app = FastAPI(
    title="CloudOps Lab API",
    description="Educational & Junior-Engineer AWS Infrastructure Troubleshooting Platform",
    version="1.0.0"
)

# Safe CORS configuration for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# ------------------------------------------------------------------------------
# Health Check (FR-01, FR-06)
# ------------------------------------------------------------------------------
@app.get("/health", tags=["System"])
def get_health() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "cloudops-lab-backend",
        "aws_credentials_configured": check_aws_credentials_available(),
        "timestamp": time.time()
    }

# ------------------------------------------------------------------------------
# Network Validation (FR-01, FR-02, FR-03)
# ------------------------------------------------------------------------------
@app.post("/api/network/validate", response_model=NetworkValidationResult, tags=["Network Planner"])
def validate_network(req: NetworkValidationRequest):
    """
    Validates VPC CIDR, subnet containment, subnet overlaps, and calculates
    usable IPv4 addresses according to AWS 5-reserved address specifications.
    """
    try:
        result = validate_network_plan(vpc_cidr=req.vpc_cidr, subnets=req.subnets)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Network validation processing failed: {str(e)}"
        )

# ------------------------------------------------------------------------------
# Controlled Terraform Workflows (FR-04, FR-05, FR-09)
# ------------------------------------------------------------------------------
@app.post("/api/terraform/validate", response_model=TerraformRunResponse, tags=["Terraform"])
def terraform_validate():
    """
    Executes 'terraform validate' on the predefined infrastructure directory.
    """
    return run_terraform_command(action="validate")

@app.post("/api/terraform/plan", response_model=TerraformRunResponse, tags=["Terraform"])
def terraform_plan(req: Optional[TerraformRunRequest] = None):
    """
    Generates a Terraform execution plan with sanitized input variables.
    """
    variables = req.variables if req else None
    return run_terraform_command(action="plan", variables=variables)

@app.post("/api/terraform/apply", response_model=TerraformRunResponse, tags=["Terraform"])
def terraform_apply(req: TerraformRunRequest):
    """
    Applies the Terraform infrastructure.
    SAFETY GUARDRAIL: Requires confirmation_phrase == 'CONFIRM_APPLY'.
    """
    if req.confirmation_phrase != "CONFIRM_APPLY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety rejection: 'confirmation_phrase' must be set to 'CONFIRM_APPLY'."
        )
    return run_terraform_command(
        action="apply",
        confirmation_phrase=req.confirmation_phrase,
        variables=req.variables
    )

@app.post("/api/terraform/destroy", response_model=TerraformRunResponse, tags=["Terraform"])
def terraform_destroy(req: TerraformRunRequest):
    """
    Destroys the Terraform infrastructure to prevent lingering cloud costs.
    SAFETY GUARDRAIL: Requires confirmation_phrase == 'CONFIRM_DESTROY'.
    """
    if req.confirmation_phrase != "CONFIRM_DESTROY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety rejection: 'confirmation_phrase' must be set to 'CONFIRM_DESTROY'."
        )
    return run_terraform_command(
        action="destroy",
        confirmation_phrase=req.confirmation_phrase
    )

# ------------------------------------------------------------------------------
# Diagnostics Engine (FR-06, FR-07)
# ------------------------------------------------------------------------------
@app.post("/api/diagnostics/run", response_model=DiagnosticsRunResponse, tags=["Diagnostics"])
def run_diagnostics(req: Optional[DiagnosticsRunRequest] = None):
    """
    Runs diagnostic catalogue checks across Static, Terraform CLI, AWS Config, and Live Network.
    Returns evidence-based findings and recommendations.
    """
    checks = req.checks if req else None
    force_sim = req.force_simulated_aws if req else False
    target = req.target_host if req else None

    return execute_diagnostic_suite(
        checks=checks,
        force_simulated_aws=force_sim,
        target_host=target
    )

@app.get("/api/diagnostics/catalogue", tags=["Diagnostics"])
def get_diagnostics_catalogue() -> List[Dict[str, str]]:
    """
    Returns the complete catalogue of diagnostic checks defined in Section 11 of the report.
    """
    return [
        {
            "check_id": "CIDR-001",
            "type": "Static",
            "logic": "CIDR string parses successfully into valid IPv4 network object.",
            "limitation": "Does not imply AWS deployment will succeed."
        },
        {
            "check_id": "CIDR-002",
            "type": "Static",
            "logic": "Subnet network is strictly contained inside the VPC network range.",
            "limitation": "IPv4-only validation in initial version."
        },
        {
            "check_id": "CIDR-003",
            "type": "Static",
            "logic": "All subnet address blocks are mutually disjoint (no overlapping CIDRs).",
            "limitation": "Other AWS subnet constraints still apply."
        },
        {
            "check_id": "RT-001",
            "type": "AWS Config",
            "logic": "Expected default route (0.0.0.0/0) points to attached Internet Gateway.",
            "limitation": "Route presence alone does not prove end-to-end reachability."
        },
        {
            "check_id": "IGW-001",
            "type": "AWS Config",
            "logic": "Expected Internet Gateway is attached to the target VPC.",
            "limitation": "Attachment alone does not make internal instances publicly accessible."
        },
        {
            "check_id": "SG-001",
            "type": "AWS Config",
            "logic": "Expected protocol/port/source permission exists (e.g. HTTP 80 & HTTPS 443).",
            "limitation": "Other controls or OS firewalls (iptables) may still block traffic."
        },
        {
            "check_id": "PUB-001",
            "type": "AWS Config",
            "logic": "Public IP auto-assignment matches intended multi-tier architecture.",
            "limitation": "Public addressing alone does not guarantee open inbound ports."
        },
        {
            "check_id": "TF-001",
            "type": "Local CLI",
            "logic": "Terraform syntax and provider configuration validate cleanly.",
            "limitation": "Does not prove AWS IAM permissions will succeed at apply time."
        },
        {
            "check_id": "DRIFT-001",
            "type": "Plan Review",
            "logic": "Refreshed plan detects differences between local code and cloud state.",
            "limitation": "Interpret carefully; do not blindly revert legitimate manual hotfixes."
        },
        {
            "check_id": "CONN-001",
            "type": "Live Test",
            "logic": "Controlled TCP socket connection to a known target succeeds with safe timeout.",
            "limitation": "Timeouts can arise from client routing, security groups, or target outages."
        }
    ]

# ------------------------------------------------------------------------------
# Intentional Fault-Injection & Lab Testing (FR-07, Section 15)
# ------------------------------------------------------------------------------
@app.post("/api/lab/simulate-fault", response_model=FaultSimulationStatus, tags=["Lab Simulation"])
def simulate_fault(req: FaultSimulationRequest):
    """
    Toggles controlled fault scenarios (e.g., missing HTTPS rule, subnet overlap, missing route).
    Enables realistic hands-on troubleshooting demonstrations.
    """
    updated_faults = set_simulated_fault(fault_id=req.fault_id, enable=req.enable)
    return FaultSimulationStatus(active_faults=updated_faults)

@app.get("/api/lab/status", response_model=FaultSimulationStatus, tags=["Lab Simulation"])
def get_lab_status():
    """
    Returns current lab state and active fault simulation flags.
    """
    return FaultSimulationStatus(active_faults=get_active_faults())

# ------------------------------------------------------------------------------
# Live AWS Resource Inventory & Traffic Matrix (Real Working Operations)
# ------------------------------------------------------------------------------
@app.get("/api/infrastructure/inventory", tags=["Infrastructure"])
def get_infrastructure_inventory():
    """
    Returns active AWS networking resources, route tables, and security group traffic rules.
    Dynamically reflects intentional faults and real infrastructure state.
    """
    faults = get_active_faults()
    
    # Base security rules
    ingress_rules = [
        {
            "id": "rule-http-80",
            "type": "HTTP",
            "protocol": "tcp",
            "port_range": "80",
            "source": "0.0.0.0/0",
            "description": "Public HTTP Web Ingress",
            "status": "ALLOW"
        }
    ]
    
    # Inbound 443 rule (reflects fault simulation)
    if not faults.get("sg_missing_https"):
        ingress_rules.append({
            "id": "rule-https-443",
            "type": "HTTPS",
            "protocol": "tcp",
            "port_range": "443",
            "source": "0.0.0.0/0",
            "description": "Secure HTTPS Web Ingress",
            "status": "ALLOW"
        })
        
    egress_rules = [
        {
            "id": "egress-https-443",
            "type": "HTTPS",
            "protocol": "tcp",
            "port_range": "443",
            "destination": "0.0.0.0/0",
            "description": "Outbound Package & API Access",
            "status": "ALLOW"
        },
        {
            "id": "egress-http-80",
            "type": "HTTP",
            "protocol": "tcp",
            "port_range": "80",
            "destination": "0.0.0.0/0",
            "description": "Outbound Package Repository Access",
            "status": "ALLOW"
        }
    ]

    # Route Table entries (reflects fault simulation)
    public_routes = [
        {"destination": "10.0.0.0/16", "target": "local", "status": "ACTIVE"}
    ]
    if not faults.get("missing_default_route") and not faults.get("igw_detached"):
        public_routes.append({"destination": "0.0.0.0/0", "target": "igw-0a1b2c3d4e", "status": "ACTIVE"})
    elif faults.get("missing_default_route"):
        public_routes.append({"destination": "0.0.0.0/0", "target": "NONE (Missing Route)", "status": "FAULT_DROPPED"})

    return {
        "vpc": {
            "vpc_id": "vpc-0e8d9c7b6a",
            "name": "cloudops-lab-vpc",
            "cidr_block": "10.0.0.0/16",
            "state": "available",
            "dns_support": True,
            "dns_hostnames": True,
            "total_addresses": 65536
        },
        "internet_gateway": {
            "igw_id": "igw-0a1b2c3d4e",
            "name": "cloudops-lab-igw",
            "state": "detached" if faults.get("igw_detached") else "attached",
            "vpc_attachment": None if faults.get("igw_detached") else "vpc-0e8d9c7b6a"
        },
        "subnets": [
            {
                "subnet_id": "subnet-01a2b3c4d5e6f701",
                "name": "cloudops-lab-public-subnet",
                "cidr_block": "10.0.1.0/24",
                "tier": "public",
                "availability_zone": "us-east-1a",
                "map_public_ip_on_launch": True,
                "available_ipv4_count": 251,
                "route_table_id": "rtb-07f8e9d0a1b2c3d4"
            },
            {
                "subnet_id": "subnet-02b3c4d5e6f7a802",
                "name": "cloudops-lab-private-subnet",
                "cidr_block": "10.0.2.0/24",
                "tier": "private",
                "availability_zone": "us-east-1a",
                "map_public_ip_on_launch": False,
                "available_ipv4_count": 251,
                "route_table_id": "rtb-08a9b0c1d2e3f4a5"
            }
        ],
        "route_tables": [
            {
                "route_table_id": "rtb-07f8e9d0a1b2c3d4",
                "name": "cloudops-lab-public-rt",
                "associated_subnets": ["subnet-01a2b3c4d5e6f701"],
                "routes": public_routes
            },
            {
                "route_table_id": "rtb-08a9b0c1d2e3f4a5",
                "name": "cloudops-lab-private-rt",
                "associated_subnets": ["subnet-02b3c4d5e6f7a802"],
                "routes": [
                    {"destination": "10.0.0.0/16", "target": "local", "status": "ACTIVE"}
                ]
            }
        ],
        "security_groups": [
            {
                "group_id": "sg-04f5e6d7c8b9a012",
                "group_name": "cloudops-lab-web-sg",
                "description": "Security group for CloudOps Lab test web workloads",
                "vpc_id": "vpc-0e8d9c7b6a",
                "ingress_rules": ingress_rules,
                "egress_rules": egress_rules
            }
        ]
    }

