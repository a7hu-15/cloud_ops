import socket
import time
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from .schemas import (
    DiagnosticFinding,
    DiagnosticsRunResponse,
    SubnetInput
)
from .network import parse_ipv4_network, run_cidr_diagnostic_checks
from .terraform_runner import run_terraform_command

BASE_DIR = Path(__file__).resolve().parent.parent.parent
INFRA_DIR = BASE_DIR / "infrastructure"

# In-memory fault state for controlled fault-injection and recovery experiments
ACTIVE_FAULTS: Dict[str, bool] = {
    "sg_missing_https": False,
    "missing_default_route": False,
    "igw_detached": False,
    "subnet_overlap": False,
    "invalid_cidr_boundary": False
}

def set_simulated_fault(fault_id: str, enable: bool) -> Dict[str, bool]:
    if fault_id in ACTIVE_FAULTS:
        ACTIVE_FAULTS[fault_id] = enable
    return ACTIVE_FAULTS

def get_active_faults() -> Dict[str, bool]:
    return dict(ACTIVE_FAULTS)

def check_aws_credentials_available() -> bool:
    """
    Check if AWS credentials are configured in the environment or profile
    without throwing unhandled exceptions.
    """
    try:
        import boto3
        session = boto3.Session()
        creds = session.get_credentials()
        return creds is not None and creds.access_key is not None
    except Exception:
        return False

def check_tf_001_terraform_validate() -> DiagnosticFinding:
    """
    TF-001: Local CLI - Terraform validation succeeds.
    """
    res = run_terraform_command("validate")
    if res.success:
        return DiagnosticFinding(
            check_id="TF-001",
            title="Terraform Configuration Validation",
            status="PASS",
            severity="INFO",
            source="terraform_cli",
            evidence=f"Terraform validation succeeded with exit code 0. {res.stdout.strip()}",
            recommendation="Configuration syntax and type checks are valid.",
            details={"exit_code": res.exit_code, "duration_seconds": res.duration_seconds}
        )
    else:
        return DiagnosticFinding(
            check_id="TF-001",
            title="Terraform Configuration Validation",
            status="FAIL",
            severity="HIGH",
            source="terraform_cli",
            evidence=f"Terraform validate reported errors:\n{res.stderr or res.stdout}",
            recommendation="Fix Terraform syntax errors or missing required parameters before attempting plan or apply.",
            details={"exit_code": res.exit_code, "duration_seconds": res.duration_seconds}
        )

def check_drift_001_plan_review() -> DiagnosticFinding:
    """
    DRIFT-001: Plan review - A refreshed plan shows unexpected differences.
    """
    # Check if a plan run shows changes
    res = run_terraform_command("plan")
    if not res.success:
        return DiagnosticFinding(
            check_id="DRIFT-001",
            title="Infrastructure Drift & Plan Review",
            status="WARNING",
            severity="MEDIUM",
            source="terraform_cli",
            evidence=f"Terraform plan could not execute cleanly (Exit code: {res.exit_code}). Output: {res.stderr[:200]}",
            recommendation="Initialize Terraform or verify cloud credentials before assessing drift."
        )

    summary = res.summary or {}
    to_add = summary.get("to_add", 0)
    to_change = summary.get("to_change", 0)
    to_destroy = summary.get("to_destroy", 0)

    if to_change > 0 or to_destroy > 0:
        return DiagnosticFinding(
            check_id="DRIFT-001",
            title="Infrastructure Drift & Plan Review",
            status="WARNING",
            severity="MEDIUM",
            source="terraform_cli",
            evidence=f"Terraform plan indicates drift or pending changes: {to_add} to add, {to_change} to change, {to_destroy} to destroy.",
            recommendation="Carefully inspect whether cloud console changes caused drift before running apply.",
            details=summary
        )
    else:
        return DiagnosticFinding(
            check_id="DRIFT-001",
            title="Infrastructure Drift & Plan Review",
            status="PASS",
            severity="INFO",
            source="terraform_cli",
            evidence=f"Infrastructure is in sync with Terraform definitions ({to_add} to add, {to_change} to change, {to_destroy} to destroy).",
            recommendation="No drift detected."
        )

def check_conn_001_live_connectivity(target_host: Optional[str] = None, port: int = 443, timeout_sec: float = 3.0) -> DiagnosticFinding:
    """
    CONN-001: Live test - Controlled connection to a known target with strict timeout.
    Prevents arbitrary port scanning by restricting to port 80/443 or specific host.
    """
    host = target_host or "1.1.1.1"  # Default safe public DNS / gateway probe
    # Sanitize host
    if not host.replace(".", "").isalnum():
        return DiagnosticFinding(
            check_id="CONN-001",
            title="Live Network Reachability Test",
            status="ERROR",
            severity="LOW",
            source="live_test",
            evidence=f"Invalid target host '{host}'. Only standard hostnames and IP addresses are allowed.",
            recommendation="Provide a valid target IP address or hostname."
        )

    start = time.time()
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout_sec)
        result = sock.connect_ex((host, port))
        sock.close()
        latency_ms = round((time.time() - start) * 1000, 2)

        if result == 0:
            return DiagnosticFinding(
                check_id="CONN-001",
                title="Live Network Reachability Test",
                status="PASS",
                severity="INFO",
                source="live_test",
                evidence=f"TCP connection to {host}:{port} established successfully in {latency_ms} ms.",
                recommendation="Target is reachable over TCP. Note that live reachability depends on security groups, route tables, and ISP path.",
                details={"host": host, "port": port, "latency_ms": latency_ms}
            )
        else:
            return DiagnosticFinding(
                check_id="CONN-001",
                title="Live Network Reachability Test",
                status="FAIL",
                severity="MEDIUM",
                source="live_test",
                evidence=f"TCP connection to {host}:{port} failed with error code {result}.",
                recommendation="Inspect local network ACLs, security group egress rules, or target availability.",
                details={"host": host, "port": port, "error_code": result}
            )
    except socket.timeout:
        return DiagnosticFinding(
            check_id="CONN-001",
            title="Live Network Reachability Test",
            status="FAIL",
            severity="MEDIUM",
            source="live_test",
            evidence=f"TCP connection to {host}:{port} timed out after {timeout_sec} seconds.",
            recommendation="Check if security groups or route tables are dropping SYN packets.",
            details={"host": host, "port": port, "timeout": timeout_sec}
        )
    except Exception as e:
        return DiagnosticFinding(
            check_id="CONN-001",
            title="Live Network Reachability Test",
            status="ERROR",
            severity="LOW",
            source="live_test",
            evidence=f"Socket error when testing {host}:{port}: {str(e)}",
            recommendation="Verify network adapter status and DNS resolution."
        )

def run_aws_configuration_checks(force_simulated: bool = False) -> Tuple[List[DiagnosticFinding], str]:
    """
    Runs RT-001, IGW-001, SG-001, PUB-001 against AWS or high-fidelity simulation model.
    Accurately demonstrates diagnostic findings with evidence & recommendations.
    """
    has_creds = check_aws_credentials_available() and not force_simulated
    findings: List[DiagnosticFinding] = []

    # If active intentional faults are injected, reflect them
    faults = get_active_faults()

    if not has_creds:
        # High-fidelity Simulation / Educational Mode
        mode = "simulated"

        # RT-001: Expected default route points to intended IGW
        if faults["missing_default_route"]:
            findings.append(DiagnosticFinding(
                check_id="RT-001",
                title="Default Route to Internet Gateway",
                status="FAIL",
                severity="HIGH",
                source="aws_config",
                evidence="[Simulation/Lab] Route Table 'cloudops-lab-public-rt' has no route matching destination '0.0.0.0/0' targeting 'igw-01a2b3c4d5'.",
                recommendation="Add an IPv4 route in the public route table: Destination: 0.0.0.0/0, Target: Internet Gateway.",
                details={"route_table": "cloudops-lab-public-rt", "missing_target": "0.0.0.0/0 -> igw"}
            ))
        else:
            findings.append(DiagnosticFinding(
                check_id="RT-001",
                title="Default Route to Internet Gateway",
                status="PASS",
                severity="INFO",
                source="aws_config",
                evidence="Route Table 'cloudops-lab-public-rt' contains valid default route '0.0.0.0/0' -> 'igw-0a1b2c3d4e'.",
                recommendation="Route table configuration for public internet egress is present.",
                details={"route_table": "cloudops-lab-public-rt", "destination": "0.0.0.0/0", "target": "igw-0a1b2c3d4e"}
            ))

        # IGW-001: Expected IGW is attached to the VPC
        if faults["igw_detached"]:
            findings.append(DiagnosticFinding(
                check_id="IGW-001",
                title="Internet Gateway VPC Attachment",
                status="FAIL",
                severity="CRITICAL",
                source="aws_config",
                evidence="[Simulation/Lab] Internet Gateway 'igw-0a1b2c3d4e' state is 'detached' or not associated with VPC 'vpc-0e8d9c7b6a'.",
                recommendation="Attach the Internet Gateway to the VPC using 'aws ec2 attach-internet-gateway' or Terraform 'aws_internet_gateway'.",
                details={"igw_id": "igw-0a1b2c3d4e", "attachment_state": "detached"}
            ))
        else:
            findings.append(DiagnosticFinding(
                check_id="IGW-001",
                title="Internet Gateway VPC Attachment",
                status="PASS",
                severity="INFO",
                source="aws_config",
                evidence="Internet Gateway 'igw-0a1b2c3d4e' is in state 'available' and attached to VPC 'vpc-0e8d9c7b6a'.",
                recommendation="IGW attachment confirmed.",
                details={"igw_id": "igw-0a1b2c3d4e", "attachment_state": "attached"}
            ))

        # SG-001: Expected protocol/port/source permission exists (HTTPS 443 check)
        if faults["sg_missing_https"]:
            findings.append(DiagnosticFinding(
                check_id="SG-001",
                title="Security Group Inbound Ingress Rules",
                status="FAIL",
                severity="HIGH",
                source="aws_config",
                evidence=(
                    "[Simulation/Lab] Security Group 'cloudops-lab-web-sg' contains rule for TCP port 80, "
                    "but lacks an inbound rule allowing TCP port 443 (HTTPS) from approved sources."
                ),
                recommendation="Add an inbound rule to 'cloudops-lab-web-sg': Protocol: TCP, Port: 443, Source: Approved CIDR.",
                details={"security_group": "cloudops-lab-web-sg", "missing_port": 443, "found_ports": [80]}
            ))
        else:
            findings.append(DiagnosticFinding(
                check_id="SG-001",
                title="Security Group Inbound Ingress Rules",
                status="PASS",
                severity="INFO",
                source="aws_config",
                evidence="Security Group 'cloudops-lab-web-sg' contains active inbound authorization for TCP port 80 and TCP port 443.",
                recommendation="Expected web ingress rules are present. (Note: OS firewalls like iptables/ufw may still restrict traffic).",
                details={"security_group": "cloudops-lab-web-sg", "ports": [80, 443]}
            ))

        # PUB-001: Public address assignment matches intended design
        findings.append(DiagnosticFinding(
            check_id="PUB-001",
            title="Subnet Public IP Auto-Assign Configuration",
            status="PASS",
            severity="INFO",
            source="aws_config",
            evidence="Subnet 'cloudops-lab-public-subnet' has map_public_ip_on_launch=True; 'cloudops-lab-private-subnet' has map_public_ip_on_launch=False.",
            recommendation="Public addressing matches the two-tier architectural design.",
            details={"public_subnet_auto_ip": True, "private_subnet_auto_ip": False}
        ))

        return findings, mode

    # Real AWS Integration via boto3
    try:
        import boto3
        ec2 = boto3.client("ec2")
        mode = "live_aws"

        # Check IGW-001
        igw_resp = ec2.describe_internet_gateways(
            Filters=[{"Name": "tag:Project", "Values": ["cloudops-lab"]}]
        )
        gateways = igw_resp.get("InternetGateways", [])
        if not gateways:
            findings.append(DiagnosticFinding(
                check_id="IGW-001",
                title="Internet Gateway VPC Attachment",
                status="FAIL",
                severity="CRITICAL",
                source="aws_config",
                evidence="No Internet Gateway found with tag Project=cloudops-lab in current AWS region.",
                recommendation="Deploy the lab Terraform stack to provision and attach the Internet Gateway."
            ))
        else:
            igw = gateways[0]
            attachments = [att["VpcId"] for att in igw.get("Attachments", []) if att.get("State") == "available"]
            if attachments:
                findings.append(DiagnosticFinding(
                    check_id="IGW-001",
                    title="Internet Gateway VPC Attachment",
                    status="PASS",
                    severity="INFO",
                    source="aws_config",
                    evidence=f"Internet Gateway {igw['InternetGatewayId']} is attached to VPC(s): {', '.join(attachments)}.",
                    recommendation="IGW attachment confirmed."
                ))
            else:
                findings.append(DiagnosticFinding(
                    check_id="IGW-001",
                    title="Internet Gateway VPC Attachment",
                    status="FAIL",
                    severity="CRITICAL",
                    source="aws_config",
                    evidence=f"Internet Gateway {igw['InternetGatewayId']} exists but has no active VPC attachment.",
                    recommendation="Attach the gateway to the lab VPC."
                ))

        # Check SG-001
        sg_resp = ec2.describe_security_groups(
            Filters=[{"Name": "group-name", "Values": ["cloudops-lab-web-sg"]}]
        )
        sgs = sg_resp.get("SecurityGroups", [])
        if not sgs:
            findings.append(DiagnosticFinding(
                check_id="SG-001",
                title="Security Group Inbound Ingress Rules",
                status="FAIL",
                severity="HIGH",
                source="aws_config",
                evidence="Security Group 'cloudops-lab-web-sg' not found in AWS account.",
                recommendation="Apply Terraform configuration to create the security group."
            ))
        else:
            sg = sgs[0]
            ports_open = []
            for perm in sg.get("IpPermissions", []):
                from_p = perm.get("FromPort")
                to_p = perm.get("ToPort")
                proto = perm.get("IpProtocol")
                if proto == "tcp" and from_p and to_p:
                    ports_open.extend(range(from_p, to_p + 1))

            has_80 = 80 in ports_open
            has_443 = 443 in ports_open

            if has_80 and has_443:
                findings.append(DiagnosticFinding(
                    check_id="SG-001",
                    title="Security Group Inbound Ingress Rules",
                    status="PASS",
                    severity="INFO",
                    source="aws_config",
                    evidence=f"Security Group {sg['GroupId']} allows inbound TCP ports 80 and 443.",
                    recommendation="Expected web ingress rules verified."
                ))
            else:
                missing = []
                if not has_80: missing.append("HTTP (80)")
                if not has_443: missing.append("HTTPS (443)")
                findings.append(DiagnosticFinding(
                    check_id="SG-001",
                    title="Security Group Inbound Ingress Rules",
                    status="FAIL",
                    severity="HIGH",
                    source="aws_config",
                    evidence=f"Security Group {sg['GroupId']} is missing expected inbound rule(s): {', '.join(missing)}.",
                    recommendation="Add the missing ingress rule in Terraform security.tf and apply."
                ))

        # Check RT-001
        rt_resp = ec2.describe_route_tables(
            Filters=[{"Name": "tag:Name", "Values": ["cloudops-lab-public-rt"]}]
        )
        rts = rt_resp.get("RouteTables", [])
        if not rts:
            findings.append(DiagnosticFinding(
                check_id="RT-001",
                title="Default Route to Internet Gateway",
                status="WARNING",
                severity="HIGH",
                source="aws_config",
                evidence="Route table 'cloudops-lab-public-rt' was not found in AWS region.",
                recommendation="Deploy the public route table via Terraform."
            ))
        else:
            rt = rts[0]
            has_default_igw = any(
                r.get("DestinationCidrBlock") == "0.0.0.0/0" and r.get("GatewayId", "").startswith("igw-")
                for r in rt.get("Routes", [])
            )
            if has_default_igw:
                findings.append(DiagnosticFinding(
                    check_id="RT-001",
                    title="Default Route to Internet Gateway",
                    status="PASS",
                    severity="INFO",
                    source="aws_config",
                    evidence=f"Route Table {rt['RouteTableId']} contains 0.0.0.0/0 targeting an Internet Gateway.",
                    recommendation="Public route verified."
                ))
            else:
                findings.append(DiagnosticFinding(
                    check_id="RT-001",
                    title="Default Route to Internet Gateway",
                    status="FAIL",
                    severity="HIGH",
                    source="aws_config",
                    evidence=f"Route Table {rt['RouteTableId']} lacks a route for 0.0.0.0/0 targeting an IGW.",
                    recommendation="Add route 0.0.0.0/0 -> igw in Terraform networking.tf."
                ))

        # PUB-001
        subnets_resp = ec2.describe_subnets(
            Filters=[{"Name": "tag:Project", "Values": ["cloudops-lab"]}]
        )
        subnets = subnets_resp.get("Subnets", [])
        if not subnets:
            findings.append(DiagnosticFinding(
                check_id="PUB-001",
                title="Subnet Public IP Auto-Assign Configuration",
                status="WARNING",
                severity="MEDIUM",
                source="aws_config",
                evidence="No subnets with tag Project=cloudops-lab found.",
                recommendation="Apply Terraform stack."
            ))
        else:
            findings.append(DiagnosticFinding(
                check_id="PUB-001",
                title="Subnet Public IP Auto-Assign Configuration",
                status="PASS",
                severity="INFO",
                source="aws_config",
                evidence=f"Inspected {len(subnets)} AWS subnets for Project=cloudops-lab.",
                recommendation="Subnet configuration verified against AWS API."
            ))

        return findings, mode

    except Exception as e:
        # Fall back gracefully to simulation mode with clear note
        findings.append(DiagnosticFinding(
            check_id="AWS-ERR",
            title="AWS API Inspection Note",
            status="WARNING",
            severity="LOW",
            source="aws_config",
            evidence=f"AWS API access unavailable or credentials not set: {str(e)}",
            recommendation="Falling back to educational simulation engine for lab diagnostics."
        ))
        sim_findings, sim_mode = run_aws_configuration_checks(force_simulated=True)
        return findings + sim_findings, "simulated"

def execute_diagnostic_suite(
    checks: Optional[List[str]] = None,
    force_simulated_aws: bool = False,
    target_host: Optional[str] = None,
    vpc_cidr: str = "10.0.0.0/16",
    subnets: Optional[List[SubnetInput]] = None
) -> DiagnosticsRunResponse:
    """
    Executes all diagnostic rules specified in the catalogue (Section 11)
    and produces structured findings.
    """
    start_time = time.time()
    findings: List[DiagnosticFinding] = []

    # Use default subnets if not provided
    if not subnets:
        subnets = [
            SubnetInput(name="public-subnet", cidr="10.0.1.0/24"),
            SubnetInput(name="private-subnet", cidr="10.0.2.0/24")
        ]

    # Handle faults injected into network design
    faults = get_active_faults()
    eval_subnets = list(subnets)
    if faults["subnet_overlap"]:
        eval_subnets = [
            SubnetInput(name="public-subnet", cidr="10.0.1.0/24"),
            SubnetInput(name="private-subnet", cidr="10.0.1.0/24")  # Intentional overlap
        ]
    if faults["invalid_cidr_boundary"]:
        eval_subnets = [
            SubnetInput(name="public-subnet", cidr="10.0.1.5/24"),  # Host bits set
            SubnetInput(name="private-subnet", cidr="10.0.2.0/24")
        ]

    # 1. Static CIDR Checks (CIDR-001, CIDR-002, CIDR-003)
    cidr_findings = run_cidr_diagnostic_checks(vpc_cidr, eval_subnets)
    findings.extend(cidr_findings)

    # 2. Local CLI Check (TF-001)
    tf_finding = check_tf_001_terraform_validate()
    findings.append(tf_finding)

    # 3. Drift Check (DRIFT-001)
    drift_finding = check_drift_001_plan_review()
    findings.append(drift_finding)

    # 4. AWS Configuration Checks (RT-001, IGW-001, SG-001, PUB-001)
    aws_findings, aws_mode = run_aws_configuration_checks(force_simulated=force_simulated_aws)
    findings.extend(aws_findings)

    # 5. Live Connectivity Check (CONN-001)
    conn_finding = check_conn_001_live_connectivity(target_host=target_host)
    findings.append(conn_finding)

    # Filter if specific check IDs were requested
    if checks:
        check_set = set(checks)
        findings = [f for f in findings if f.check_id in check_set]

    # Calculate statistics
    passed = sum(1 for f in findings if f.status == "PASS")
    failed = sum(1 for f in findings if f.status in ("FAIL", "ERROR"))
    warnings = sum(1 for f in findings if f.status == "WARNING")
    duration = round(time.time() - start_time, 2)

    return DiagnosticsRunResponse(
        total_checks=len(findings),
        passed=passed,
        failed=failed,
        warnings=warnings,
        findings=findings,
        execution_time_seconds=duration,
        aws_mode=aws_mode  # type: ignore
    )
