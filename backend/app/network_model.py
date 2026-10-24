"""
CloudOps Lab - Network Model & Analysis Engine
Member 1 (Network Intelligence) & Member 3 (Diagnostics & Recovery)

Provides a unified, structured network model representing AWS VPC resources,
true route-based subnet tier classification (not name-based), security group
rule evaluation, and packet path tracing.
"""

from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
import ipaddress


class RouteModel(BaseModel):
    destination: str
    target: str
    status: str = "ACTIVE"  # ACTIVE | BLACKHOLE | FAULT_DROPPED


class RouteTableModel(BaseModel):
    route_table_id: str
    name: str
    vpc_id: str
    associated_subnets: List[str] = Field(default_factory=list)
    routes: List[RouteModel] = Field(default_factory=list)

    def has_default_internet_route(self, igw_id: Optional[str] = None) -> bool:
        """
        Returns True if a 0.0.0.0/0 route exists pointing to an Internet Gateway.
        """
        for r in self.routes:
            if r.destination == "0.0.0.0/0" and r.status == "ACTIVE":
                if igw_id:
                    if r.target == igw_id or r.target.startswith("igw-"):
                        return True
                elif r.target.startswith("igw-"):
                    return True
        return False


class SubnetModel(BaseModel):
    subnet_id: str
    name: str
    cidr_block: str
    availability_zone: str = "us-east-1a"
    map_public_ip_on_launch: bool = False
    route_table_id: Optional[str] = None
    calculated_tier: str = "unknown"  # 'public' | 'private' | 'isolated'
    available_ipv4_count: int = 251


class InternetGatewayModel(BaseModel):
    igw_id: str
    name: str
    state: str = "attached"  # 'attached' | 'detached'
    vpc_attachment: Optional[str] = None


class SecurityGroupRuleModel(BaseModel):
    id: str
    protocol: str  # 'tcp', 'udp', 'icmp', '-1' (all)
    port_range: str  # e.g. '80', '443', '22', '0-65535'
    source: str  # e.g. '0.0.0.0/0' or CIDR
    description: str
    action: str = "ALLOW"


class SecurityGroupModel(BaseModel):
    group_id: str
    group_name: str
    vpc_id: str
    description: str
    ingress_rules: List[SecurityGroupRuleModel] = Field(default_factory=list)
    egress_rules: List[SecurityGroupRuleModel] = Field(default_factory=list)


class VpcModel(BaseModel):
    vpc_id: str
    name: str
    cidr_block: str
    state: str = "available"
    dns_support: bool = True
    dns_hostnames: bool = True
    total_addresses: int = 65536


class PacketHopTrace(BaseModel):
    hop_number: int
    component: str
    identifier: str
    action: str  # 'PASS' | 'DROP' | 'EVALUATED'
    reason: str
    details: Optional[Dict[str, Any]] = None


class PacketPathTrace(BaseModel):
    origin: str
    destination: str
    protocol: str
    port: int
    success: bool
    final_status: str  # 'DELIVERED' | 'DROPPED_AT_IGW' | 'DROPPED_AT_ROUTER' | 'DROPPED_AT_SG'
    hops: List[PacketHopTrace]


class NetworkLabModel(BaseModel):
    lab_id: str
    name: str
    description: str
    mode: str = "simulation"  # 'local' | 'simulation' | 'live_aws'
    vpc: VpcModel
    subnets: List[SubnetModel]
    route_tables: List[RouteTableModel]
    internet_gateway: InternetGatewayModel
    security_groups: List[SecurityGroupModel]
    active_faults: Dict[str, bool] = Field(default_factory=dict)


# ==============================================================================
# Route-Based Subnet Tier Classification (Engineering Standard)
# ==============================================================================
def classify_subnet_tier(
    subnet: SubnetModel,
    route_tables: List[RouteTableModel],
    igw: Optional[InternetGatewayModel]
) -> str:
    """
    AWS Engineering Standard: A subnet is classified as 'public' IF AND ONLY IF:
    1. Its associated route table has a default route (0.0.0.0/0) pointing to an Internet Gateway.
    2. That Internet Gateway is in the 'attached' state to the subnet's VPC.
    
    If the route table lacks 0.0.0.0/0 -> IGW, the subnet is 'private' (or 'isolated').
    We NEVER rely on the subnet name containing the word 'public'!
    """
    if not subnet.route_table_id:
        return "unassociated"

    # Find the associated route table
    matching_rt = next((rt for rt in route_tables if rt.route_table_id == subnet.route_table_id), None)
    if not matching_rt:
        return "unassociated"

    # Check if IGW is attached
    is_igw_attached = igw is not None and igw.state == "attached"

    if matching_rt.has_default_internet_route(igw.igw_id if igw else None) and is_igw_attached:
        return "public"
    else:
        return "private"


# ==============================================================================
# Security Group Ingress Rule Evaluator
# ==============================================================================
def evaluate_sg_ingress(
    security_group: SecurityGroupModel,
    protocol: str,
    port: int,
    source_ip: str
) -> Tuple[bool, Optional[SecurityGroupRuleModel], str]:
    """
    Evaluates whether an inbound packet matching (protocol, port, source_ip)
    is explicitly permitted by any ingress rule in the Security Group.
    """
    clean_proto = protocol.lower().strip()
    src_addr = ipaddress.IPv4Address(source_ip) if source_ip != "0.0.0.0/0" else None

    for rule in security_group.ingress_rules:
        rule_proto = rule.protocol.lower().strip()
        if rule_proto != "-1" and rule_proto != clean_proto:
            continue

        # Check port range
        if "-" in rule.port_range:
            parts = rule.port_range.split("-")
            low, high = int(parts[0]), int(parts[1])
            port_match = low <= port <= high
        else:
            port_match = int(rule.port_range) == port

        if not port_match:
            continue

        # Check CIDR match
        try:
            rule_net = ipaddress.IPv4Network(rule.source.strip())
            if source_ip == "0.0.0.0/0" or (src_addr and src_addr in rule_net):
                return True, rule, f"Permitted by ingress rule '{rule.id}' (Protocol: {rule.protocol}, Port: {rule.port_range}, Source: {rule.source})"
        except Exception:
            if rule.source == "0.0.0.0/0" or rule.source == source_ip:
                return True, rule, f"Permitted by ingress rule '{rule.id}'"

    return False, None, f"Denied: No ingress rule authorizes {protocol.upper()} traffic on port {port} from {source_ip}."


# ==============================================================================
# Deterministic Packet Path Evaluator
# ==============================================================================
def trace_inbound_packet(
    lab: NetworkLabModel,
    origin_ip: str = "198.51.100.25",
    target_port: int = 443,
    target_protocol: str = "tcp",
    target_subnet_id: Optional[str] = None
) -> PacketPathTrace:
    """
    Traces an inbound packet hop-by-hop from the external client to the target host ENI.
    Explains the exact technical reason for acceptance or drop at each layer.
    """
    hops: List[PacketHopTrace] = []

    # Hop 1: External Origin
    hops.append(PacketHopTrace(
        hop_number=1,
        component="Client Edge",
        identifier=origin_ip,
        action="PASS",
        reason=f"Client initiates {target_protocol.upper()} connection to target on port {target_port}."
    ))

    # Hop 2: Internet Gateway
    igw = lab.internet_gateway
    if igw.state != "attached" or not igw.vpc_attachment:
        hops.append(PacketHopTrace(
            hop_number=2,
            component="Internet Gateway",
            identifier=igw.igw_id,
            action="DROP",
            reason=f"Internet Gateway '{igw.igw_id}' is detached from VPC '{lab.vpc.vpc_id}'. External traffic cannot cross edge."
        ))
        return PacketPathTrace(
            origin=origin_ip,
            destination="Host ENI",
            protocol=target_protocol,
            port=target_port,
            success=False,
            final_status="DROPPED_AT_IGW",
            hops=hops
        )

    hops.append(PacketHopTrace(
        hop_number=2,
        component="Internet Gateway",
        identifier=igw.igw_id,
        action="PASS",
        reason=f"Gateway '{igw.igw_id}' attached to VPC '{lab.vpc.vpc_id}'. Edge ingress accepted."
    ))

    # Identify target subnet (default to public tier)
    target_sub = None
    if target_subnet_id:
        target_sub = next((s for s in lab.subnets if s.subnet_id == target_subnet_id), None)
    if not target_sub:
        target_sub = next((s for s in lab.subnets if classify_subnet_tier(s, lab.route_tables, igw) == "public"), None)
    if not target_sub and lab.subnets:
        target_sub = lab.subnets[0]

    # Hop 3: Route Table Association & Propagation
    rt = next((r for r in lab.route_tables if target_sub and r.route_table_id == target_sub.route_table_id), None)
    if not rt:
        hops.append(PacketHopTrace(
            hop_number=3,
            component="VPC Router",
            identifier="no-route-table",
            action="DROP",
            reason=f"Subnet '{target_sub.name if target_sub else 'unknown'}' has no associated route table."
        ))
        return PacketPathTrace(
            origin=origin_ip,
            destination="Host ENI",
            protocol=target_protocol,
            port=target_port,
            success=False,
            final_status="DROPPED_AT_ROUTER",
            hops=hops
        )

    has_default_route = rt.has_default_internet_route(igw.igw_id)
    if not has_default_route:
        hops.append(PacketHopTrace(
            hop_number=3,
            component="Route Table",
            identifier=rt.route_table_id,
            action="DROP",
            reason=f"Route table '{rt.name}' lacks a valid default route '0.0.0.0/0' pointing to attached IGW '{igw.igw_id}'. Egress/ingress route cycle broken."
        ))
        return PacketPathTrace(
            origin=origin_ip,
            destination="Host ENI",
            protocol=target_protocol,
            port=target_port,
            success=False,
            final_status="DROPPED_AT_ROUTER",
            hops=hops
        )

    hops.append(PacketHopTrace(
        hop_number=3,
        component="Route Table",
        identifier=rt.route_table_id,
        action="PASS",
        reason=f"Route table '{rt.name}' contains active route '0.0.0.0/0' -> '{igw.igw_id}'. Traffic routable to subnet '{target_sub.name}'."
    ))

    # Hop 4: Security Group Ingress Evaluation
    sg = lab.security_groups[0] if lab.security_groups else None
    if not sg:
        hops.append(PacketHopTrace(
            hop_number=4,
            component="Security Group",
            identifier="none",
            action="DROP",
            reason="No security group configured to protect target workload."
        ))
        return PacketPathTrace(
            origin=origin_ip,
            destination="Host ENI",
            protocol=target_protocol,
            port=target_port,
            success=False,
            final_status="DROPPED_AT_SG",
            hops=hops
        )

    allowed, matched_rule, reason = evaluate_sg_ingress(sg, target_protocol, target_port, "0.0.0.0/0")
    if not allowed:
        hops.append(PacketHopTrace(
            hop_number=4,
            component="Security Group",
            identifier=sg.group_id,
            action="DROP",
            reason=f"Security Group '{sg.group_name}' dropped packet: No inbound rule allows {target_protocol.upper()} on port {target_port}."
        ))
        return PacketPathTrace(
            origin=origin_ip,
            destination="Host ENI",
            protocol=target_protocol,
            port=target_port,
            success=False,
            final_status="DROPPED_AT_SG",
            hops=hops
        )

    hops.append(PacketHopTrace(
        hop_number=4,
        component="Security Group",
        identifier=sg.group_id,
        action="PASS",
        reason=f"Security Group '{sg.group_name}' accepted packet: {reason}"
    ))

    # Hop 5: Destination Host ENI
    hops.append(PacketHopTrace(
        hop_number=5,
        component="Network Interface (ENI)",
        identifier="eni-01a2b3c4d5e6f7a8b",
        action="PASS",
        reason=f"Packet delivered to host socket in subnet '{target_sub.name}' ({target_sub.cidr_block})."
    ))

    return PacketPathTrace(
        origin=origin_ip,
        destination=f"{target_sub.name} (Port {target_port})",
        protocol=target_protocol,
        port=target_port,
        success=True,
        final_status="DELIVERED",
        hops=hops
    )


# ==============================================================================
# Standard Factory for Predefined Network Lab Environments
# ==============================================================================
def create_standard_two_tier_lab(
    lab_id: str = "lab-two-tier-default",
    mode: str = "simulation",
    active_faults: Optional[Dict[str, bool]] = None
) -> NetworkLabModel:
    """
    Creates the baseline two-tier VPC network lab architecture.
    """
    faults = active_faults or {}

    vpc = VpcModel(
        vpc_id="vpc-0e8d9c7b6a",
        name="cloudops-lab-vpc",
        cidr_block="10.0.0.0/16",
        total_addresses=65536
    )

    igw_detached = faults.get("igw_detached", False)
    igw = InternetGatewayModel(
        igw_id="igw-0a1b2c3d4e",
        name="cloudops-lab-igw",
        state="detached" if igw_detached else "attached",
        vpc_attachment=None if igw_detached else "vpc-0e8d9c7b6a"
    )

    # Routes for public route table
    public_routes = [
        RouteModel(destination="10.0.0.0/16", target="local", status="ACTIVE")
    ]
    missing_route = faults.get("missing_default_route", False)
    if not missing_route and not igw_detached:
        public_routes.append(RouteModel(destination="0.0.0.0/0", target="igw-0a1b2c3d4e", status="ACTIVE"))
    elif missing_route:
        public_routes.append(RouteModel(destination="0.0.0.0/0", target="NONE", status="FAULT_DROPPED"))

    route_tables = [
        RouteTableModel(
            route_table_id="rtb-07f8e9d0a1b2c3d4",
            name="cloudops-lab-public-rt",
            vpc_id="vpc-0e8d9c7b6a",
            associated_subnets=["subnet-01a2b3c4d5e6f701"],
            routes=public_routes
        ),
        RouteTableModel(
            route_table_id="rtb-08a9b0c1d2e3f4a5",
            name="cloudops-lab-private-rt",
            vpc_id="vpc-0e8d9c7b6a",
            associated_subnets=["subnet-02b3c4d5e6f7a802"],
            routes=[
                RouteModel(destination="10.0.0.0/16", target="local", status="ACTIVE")
            ]
        )
    ]

    # Subnets (reflect overlap or invalid boundary faults if active)
    pub_cidr = "10.0.1.0/24"
    priv_cidr = "10.0.2.0/24"
    if faults.get("subnet_overlap", False):
        priv_cidr = "10.0.1.0/24"  # Collision!
    if faults.get("invalid_cidr_boundary", False):
        pub_cidr = "10.0.1.5/24"   # Host bits set!

    subnets = [
        SubnetModel(
            subnet_id="subnet-01a2b3c4d5e6f701",
            name="cloudops-lab-public-subnet",
            cidr_block=pub_cidr,
            map_public_ip_on_launch=True,
            route_table_id="rtb-07f8e9d0a1b2c3d4",
            available_ipv4_count=251
        ),
        SubnetModel(
            subnet_id="subnet-02b3c4d5e6f7a802",
            name="cloudops-lab-private-subnet",
            cidr_block=priv_cidr,
            map_public_ip_on_launch=False,
            route_table_id="rtb-08a9b0c1d2e3f4a5",
            available_ipv4_count=251
        )
    ]

    # Compute actual route-based tier
    for s in subnets:
        s.calculated_tier = classify_subnet_tier(s, route_tables, igw)

    # Ingress rules (reflect missing HTTPS if active)
    ingress_rules = [
        SecurityGroupRuleModel(
            id="rule-http-80",
            protocol="tcp",
            port_range="80",
            source="0.0.0.0/0",
            description="Public HTTP Web Traffic",
            action="ALLOW"
        )
    ]
    if not faults.get("sg_missing_https", False):
        ingress_rules.append(SecurityGroupRuleModel(
            id="rule-https-443",
            protocol="tcp",
            port_range="443",
            source="0.0.0.0/0",
            description="Secure HTTPS Web Ingress",
            action="ALLOW"
        ))

    security_groups = [
        SecurityGroupModel(
            group_id="sg-04f5e6d7c8b9a012",
            group_name="cloudops-lab-web-sg",
            vpc_id="vpc-0e8d9c7b6a",
            description="Security group for web workloads in public subnet",
            ingress_rules=ingress_rules,
            egress_rules=[
                SecurityGroupRuleModel(
                    id="egress-all",
                    protocol="-1",
                    port_range="0-65535",
                    source="0.0.0.0/0",
                    description="Outbound internet traffic",
                    action="ALLOW"
                )
            ]
        )
    ]

    return NetworkLabModel(
        lab_id=lab_id,
        name="Standard Two-Tier AWS VPC",
        description="Public Web Subnet with IGW egress and Private Database Subnet with local routing.",
        mode=mode,
        vpc=vpc,
        subnets=subnets,
        route_tables=route_tables,
        internet_gateway=igw,
        security_groups=security_groups,
        active_faults=faults
    )
