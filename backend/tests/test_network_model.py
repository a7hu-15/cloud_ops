"""
Unit tests for CloudOps Lab Network Model, Route-Based Tier Classification,
Security Group Rule Evaluator, and Packet Path Tracing.
Member 1 (Network Intelligence)
"""

import pytest
from backend.app.network_model import (
    SubnetModel,
    RouteTableModel,
    RouteModel,
    InternetGatewayModel,
    SecurityGroupModel,
    SecurityGroupRuleModel,
    classify_subnet_tier,
    evaluate_sg_ingress,
    trace_inbound_packet,
    create_standard_two_tier_lab
)


def test_route_based_subnet_tier_classification():
    """
    Ensures classification relies strictly on route table next-hop to attached IGW,
    NOT on the subnet name string.
    """
    igw_attached = InternetGatewayModel(igw_id="igw-12345", name="igw", state="attached", vpc_attachment="vpc-123")
    igw_detached = InternetGatewayModel(igw_id="igw-12345", name="igw", state="detached", vpc_attachment=None)

    rt_public = RouteTableModel(
        route_table_id="rtb-pub",
        name="public-rt",
        vpc_id="vpc-123",
        routes=[
            RouteModel(destination="10.0.0.0/16", target="local"),
            RouteModel(destination="0.0.0.0/0", target="igw-12345")
        ]
    )

    rt_private = RouteTableModel(
        route_table_id="rtb-priv",
        name="private-rt",
        vpc_id="vpc-123",
        routes=[
            RouteModel(destination="10.0.0.0/16", target="local")
        ]
    )

    # Subnet named 'database-tier' associated with public RT should be classified as 'public'
    sub_a = SubnetModel(subnet_id="sub-1", name="database-tier", cidr_block="10.0.1.0/24", route_table_id="rtb-pub")
    tier_a = classify_subnet_tier(sub_a, [rt_public, rt_private], igw_attached)
    assert tier_a == "public", "Subnet with 0.0.0.0/0 -> attached IGW must be classified as public regardless of name"

    # Subnet named 'public-frontend' associated with private RT must be classified as 'private'
    sub_b = SubnetModel(subnet_id="sub-2", name="public-frontend", cidr_block="10.0.2.0/24", route_table_id="rtb-priv")
    tier_b = classify_subnet_tier(sub_b, [rt_public, rt_private], igw_attached)
    assert tier_b == "private", "Subnet without 0.0.0.0/0 -> IGW must be classified as private despite having 'public' in name"

    # If IGW is detached, even the subnet with public route becomes 'private'
    tier_c = classify_subnet_tier(sub_a, [rt_public, rt_private], igw_detached)
    assert tier_c == "private", "Subnet must not be classified as public if the IGW is in detached state"


def test_security_group_ingress_rule_evaluator():
    """
    Tests exact port matching, range matching, and CIDR checks.
    """
    sg = SecurityGroupModel(
        group_id="sg-123",
        group_name="web-sg",
        vpc_id="vpc-1",
        description="test",
        ingress_rules=[
            SecurityGroupRuleModel(id="r-80", protocol="tcp", port_range="80", source="0.0.0.0/0", description="http"),
            SecurityGroupRuleModel(id="r-ssh", protocol="tcp", port_range="22", source="192.168.1.0/24", description="bastion")
        ]
    )

    # Port 80 from anywhere -> ALLOW
    allowed, rule, reason = evaluate_sg_ingress(sg, "tcp", 80, "203.0.113.5")
    assert allowed is True
    assert rule is not None and rule.id == "r-80"

    # Port 443 -> DENIED (omitted)
    allowed, rule, reason = evaluate_sg_ingress(sg, "tcp", 443, "203.0.113.5")
    assert allowed is False
    assert "Denied" in reason

    # Port 22 from bastion range -> ALLOW
    allowed, rule, _ = evaluate_sg_ingress(sg, "tcp", 22, "192.168.1.50")
    assert allowed is True
    assert rule.id == "r-ssh"

    # Port 22 from random internet IP -> DENIED
    allowed, rule, _ = evaluate_sg_ingress(sg, "tcp", 22, "203.0.113.5")
    assert allowed is False


def test_packet_path_trace_baseline_normal():
    """
    Tests that baseline two-tier lab delivers port 80 and port 443 packets across all 5 hops.
    """
    lab = create_standard_two_tier_lab(active_faults={})

    trace = trace_inbound_packet(lab, origin_ip="198.51.100.10", target_port=443, target_protocol="tcp")
    assert trace.success is True
    assert trace.final_status == "DELIVERED"
    assert len(trace.hops) == 5
    assert all(h.action == "PASS" for h in trace.hops)


def test_packet_path_trace_dropped_at_security_group():
    """
    Tests packet drop when HTTPS fault is active.
    """
    lab = create_standard_two_tier_lab(active_faults={"sg_missing_https": True})

    trace = trace_inbound_packet(lab, target_port=443)
    assert trace.success is False
    assert trace.final_status == "DROPPED_AT_SG"
    assert trace.hops[3].component == "Security Group"
    assert trace.hops[3].action == "DROP"


def test_packet_path_trace_dropped_at_router():
    """
    Tests packet drop when default route is missing.
    """
    lab = create_standard_two_tier_lab(active_faults={"missing_default_route": True})

    trace = trace_inbound_packet(lab, target_port=80)
    assert trace.success is False
    assert trace.final_status == "DROPPED_AT_ROUTER"
    assert trace.hops[2].action == "DROP"


def test_packet_path_trace_dropped_at_igw():
    """
    Tests packet drop when IGW is detached.
    """
    lab = create_standard_two_tier_lab(active_faults={"igw_detached": True})

    trace = trace_inbound_packet(lab, target_port=80)
    assert trace.success is False
    assert trace.final_status == "DROPPED_AT_IGW"
    assert trace.hops[1].action == "DROP"
