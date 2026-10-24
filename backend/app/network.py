import ipaddress
from typing import List, Tuple, Dict, Any, Optional
from .schemas import (
    SubnetInput,
    SubnetCalculation,
    NetworkValidationResult,
    DiagnosticFinding
)

# RFC 1918 Private IP ranges standard for AWS VPCs
RFC_1918_RANGES = [
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16")
]

def parse_ipv4_network(cidr_str: str) -> Tuple[Optional[ipaddress.IPv4Network], Optional[str]]:
    """
    Safely parse an IPv4 CIDR string into an IPv4Network object.
    Rejects malformed strings, host bits set (strict=True), and non-IPv4 addresses.
    """
    clean_cidr = cidr_str.strip()
    if not clean_cidr:
        return None, "CIDR string cannot be empty."

    try:
        # strict=True ensures e.g. 10.0.1.5/24 is flagged because host bits are set
        net = ipaddress.IPv4Network(clean_cidr, strict=True)
        return net, None
    except ipaddress.NetmaskValueError as e:
        return None, f"Invalid netmask or prefix length in '{clean_cidr}': {str(e)}"
    except ValueError as e:
        # Check if user passed host bits
        try:
            suggested = ipaddress.IPv4Network(clean_cidr, strict=False)
            return None, (
                f"Invalid network boundary for '{clean_cidr}'. Host bits were set. "
                f"Did you mean '{suggested.network_address}/{suggested.prefixlen}'?"
            )
        except Exception:
            return None, f"Malformed IPv4 CIDR '{clean_cidr}': {str(e)}"

def calculate_subnet_details(name: str, net: ipaddress.IPv4Network, vpc_net: ipaddress.IPv4Network) -> SubnetCalculation:
    """
    Compute subnet IP allocations including AWS 5-reserved address model.
    """
    total = net.num_addresses
    # AWS reserves 5 addresses per subnet:
    # .0: Network address
    # .1: Reserved by AWS for VPC router
    # .2: Reserved by AWS for DNS
    # .3: Reserved by AWS for future use
    # .255 (last IP): Broadcast address (reserved)
    aws_reserved = 5 if total >= 8 else total
    usable = max(0, total - aws_reserved)

    first_usable = None
    last_usable = None
    if total >= 8:
        # First usable is .4
        first_usable = str(net.network_address + 4)
        # Last usable is broadcast - 1
        last_usable = str(net.broadcast_address - 1)

    is_contained = net.subnet_of(vpc_net)

    return SubnetCalculation(
        name=name,
        cidr=str(net),
        network_address=str(net.network_address),
        netmask=str(net.netmask),
        broadcast_address=str(net.broadcast_address),
        prefix_length=net.prefixlen,
        total_ips=total,
        aws_reserved_ips=aws_reserved,
        usable_ips=usable,
        first_usable_ip=first_usable,
        last_usable_ip=last_usable,
        is_contained_in_vpc=is_contained
    )

def validate_network_plan(vpc_cidr: str, subnets: List[SubnetInput]) -> NetworkValidationResult:
    """
    Validates a VPC and its subnets according to AWS rules:
    - CIDR syntax
    - VPC prefix length (/16 to /28)
    - Subnet containment in VPC
    - Overlap detection between subnets
    - Private RFC 1918 recommendation
    """
    errors: List[str] = []
    warnings: List[str] = []
    notes: List[str] = []
    subnet_calcs: List[SubnetCalculation] = []

    # 1. Parse VPC CIDR
    vpc_net, vpc_err = parse_ipv4_network(vpc_cidr)
    if vpc_err or vpc_net is None:
        return NetworkValidationResult(
            is_valid=False,
            vpc_cidr=vpc_cidr,
            vpc_total_ips=0,
            vpc_netmask="",
            subnets=[],
            errors=[f"VPC CIDR error: {vpc_err}"],
            warnings=[],
            notes=[]
        )

    # AWS VPC prefix length constraints (/16 to /28)
    if vpc_net.prefixlen < 16 or vpc_net.prefixlen > 28:
        errors.append(
            f"VPC prefix length /{vpc_net.prefixlen} is outside AWS limits. AWS requires VPC CIDR blocks to be between /16 and /28."
        )

    # Check RFC 1918 recommendation
    is_rfc1918 = any(vpc_net.subnet_of(rfc) for rfc in RFC_1918_RANGES)
    if not is_rfc1918:
        warnings.append(
            f"VPC CIDR {vpc_cidr} is not in standard RFC 1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). "
            "Using publicly routable IP blocks for a VPC can cause routing conflicts."
        )
    else:
        notes.append(f"VPC CIDR {vpc_cidr} is compliant with RFC 1918 private IP standards.")

    # 2. Parse and validate each subnet
    parsed_subnets: List[Tuple[SubnetInput, ipaddress.IPv4Network]] = []
    subnet_names = set()

    for s_input in subnets:
        if s_input.name in subnet_names:
            errors.append(f"Duplicate subnet name detected: '{s_input.name}'. Each subnet must have a unique identifier.")
        subnet_names.add(s_input.name)

        s_net, s_err = parse_ipv4_network(s_input.cidr)
        if s_err or s_net is None:
            errors.append(f"Subnet '{s_input.name}' error: {s_err}")
            continue

        # Subnet prefix length bounds
        if s_net.prefixlen < 16 or s_net.prefixlen > 28:
            errors.append(
                f"Subnet '{s_input.name}' prefix length /{s_net.prefixlen} is outside AWS limits (/16 to /28)."
            )

        # Containment check (CIDR-002)
        if not s_net.subnet_of(vpc_net):
            errors.append(
                f"Subnet '{s_input.name}' ({s_input.cidr}) is NOT contained inside VPC network ({vpc_cidr})."
            )

        calc = calculate_subnet_details(s_input.name, s_net, vpc_net)
        subnet_calcs.append(calc)
        parsed_subnets.append((s_input, s_net))

    # 3. Subnet overlap check (CIDR-003)
    n = len(parsed_subnets)
    for i in range(n):
        for j in range(i + 1, n):
            name_a, net_a = parsed_subnets[i][0].name, parsed_subnets[i][1]
            name_b, net_b = parsed_subnets[j][0].name, parsed_subnets[j][1]
            if net_a.overlaps(net_b):
                errors.append(
                    f"Subnet overlap detected between '{name_a}' ({net_a}) and '{name_b}' ({net_b}). "
                    "In AWS VPC, subnet CIDR blocks must not overlap."
                )

    is_valid = len(errors) == 0

    if is_valid:
        notes.append("AWS reserves 5 IP addresses per subnet (.0 net, .1 router, .2 DNS, .3 future, .255 broadcast).")

    return NetworkValidationResult(
        is_valid=is_valid,
        vpc_cidr=str(vpc_net),
        vpc_total_ips=vpc_net.num_addresses,
        vpc_netmask=str(vpc_net.netmask),
        subnets=subnet_calcs,
        errors=errors,
        warnings=warnings,
        notes=notes
    )

def run_cidr_diagnostic_checks(vpc_cidr: str, subnets: List[SubnetInput]) -> List[DiagnosticFinding]:
    """
    Generates structured DiagnosticFinding objects for CIDR-001, CIDR-002, CIDR-003.
    """
    findings: List[DiagnosticFinding] = []

    # CIDR-001: VPC & Subnet parse check
    vpc_net, vpc_err = parse_ipv4_network(vpc_cidr)
    if vpc_err or vpc_net is None:
        findings.append(DiagnosticFinding(
            check_id="CIDR-001",
            title="IPv4 CIDR String Parsing",
            status="FAIL",
            severity="CRITICAL",
            source="static",
            evidence=f"VPC CIDR parsing failed: {vpc_err}",
            recommendation="Supply a valid IPv4 CIDR string (e.g. 10.0.0.0/16) where host bits are zeroed."
        ))
        return findings

    subnet_parse_errors = []
    parsed_nets = []
    for s in subnets:
        net, err = parse_ipv4_network(s.cidr)
        if err or net is None:
            subnet_parse_errors.append(f"{s.name}: {err}")
        else:
            parsed_nets.append((s.name, net))

    if subnet_parse_errors:
        findings.append(DiagnosticFinding(
            check_id="CIDR-001",
            title="IPv4 CIDR String Parsing",
            status="FAIL",
            severity="CRITICAL",
            source="static",
            evidence="; ".join(subnet_parse_errors),
            recommendation="Correct invalid subnet CIDR strings and verify host bits are not set."
        ))
    else:
        findings.append(DiagnosticFinding(
            check_id="CIDR-001",
            title="IPv4 CIDR String Parsing",
            status="PASS",
            severity="INFO",
            source="static",
            evidence=f"VPC CIDR {vpc_cidr} and {len(subnets)} subnet CIDRs parsed cleanly.",
            recommendation="No action needed."
        ))

    # CIDR-002: Subnet containment in VPC
    not_contained = []
    for name, s_net in parsed_nets:
        if not s_net.subnet_of(vpc_net):
            not_contained.append(f"{name} ({s_net})")

    if not_contained:
        findings.append(DiagnosticFinding(
            check_id="CIDR-002",
            title="Subnet Containment in VPC",
            status="FAIL",
            severity="CRITICAL",
            source="static",
            evidence=f"Subnet(s) outside VPC {vpc_cidr}: {', '.join(not_contained)}",
            recommendation=f"Adjust subnet CIDR blocks to lie entirely within {vpc_cidr}."
        ))
    else:
        findings.append(DiagnosticFinding(
            check_id="CIDR-002",
            title="Subnet Containment in VPC",
            status="PASS",
            severity="INFO",
            source="static",
            evidence=f"All {len(parsed_nets)} subnets are contained within VPC {vpc_cidr}.",
            recommendation="No action needed."
        ))

    # CIDR-003: Subnet overlap check
    overlaps = []
    n = len(parsed_nets)
    for i in range(n):
        for j in range(i + 1, n):
            name_a, net_a = parsed_nets[i]
            name_b, net_b = parsed_nets[j]
            if net_a.overlaps(net_b):
                overlaps.append(f"{name_a} ({net_a}) overlaps with {name_b} ({net_b})")

    if overlaps:
        findings.append(DiagnosticFinding(
            check_id="CIDR-003",
            title="Subnet Non-Overlap Verification",
            status="FAIL",
            severity="CRITICAL",
            source="static",
            evidence="; ".join(overlaps),
            recommendation="Subnets in an AWS VPC must be mutually disjoint. Choose non-overlapping CIDR ranges."
        ))
    else:
        findings.append(DiagnosticFinding(
            check_id="CIDR-003",
            title="Subnet Non-Overlap Verification",
            status="PASS",
            severity="INFO",
            source="static",
            evidence="No overlapping subnets detected.",
            recommendation="No action needed."
        ))

    return findings
