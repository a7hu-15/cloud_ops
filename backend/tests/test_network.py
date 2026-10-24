import pytest
from backend.app.schemas import SubnetInput
from backend.app.network import (
    parse_ipv4_network,
    validate_network_plan,
    run_cidr_diagnostic_checks
)

def test_parse_valid_cidr():
    net, err = parse_ipv4_network("10.0.0.0/16")
    assert err is None
    assert net is not None
    assert str(net) == "10.0.0.0/16"
    assert net.num_addresses == 65536

def test_parse_malformed_cidr():
    net, err = parse_ipv4_network("not-a-cidr")
    assert net is None
    assert "Malformed IPv4 CIDR" in err or "Invalid" in err

def test_parse_cidr_with_host_bits_set():
    # 10.0.1.5/24 has host bit 5 set
    net, err = parse_ipv4_network("10.0.1.5/24")
    assert net is None
    assert "Host bits were set" in err

def test_validate_valid_network_plan():
    vpc_cidr = "10.0.0.0/16"
    subnets = [
        SubnetInput(name="public-subnet", cidr="10.0.1.0/24"),
        SubnetInput(name="private-subnet", cidr="10.0.2.0/24")
    ]
    result = validate_network_plan(vpc_cidr, subnets)
    assert result.is_valid is True
    assert len(result.errors) == 0
    assert len(result.subnets) == 2

    # Check AWS 5-reserved address model
    pub_sub = next(s for s in result.subnets if s.name == "public-subnet")
    assert pub_sub.total_ips == 256
    assert pub_sub.aws_reserved_ips == 5
    assert pub_sub.usable_ips == 251
    assert pub_sub.first_usable_ip == "10.0.1.4"
    assert pub_sub.last_usable_ip == "10.0.1.254"
    assert pub_sub.is_contained_in_vpc is True

def test_validate_overlapping_subnets():
    vpc_cidr = "10.0.0.0/16"
    subnets = [
        SubnetInput(name="subnet-a", cidr="10.0.1.0/24"),
        SubnetInput(name="subnet-b", cidr="10.0.1.128/25")  # Overlaps with subnet-a
    ]
    result = validate_network_plan(vpc_cidr, subnets)
    assert result.is_valid is False
    assert any("Subnet overlap detected" in err for err in result.errors)

def test_validate_subnet_outside_vpc():
    vpc_cidr = "10.0.0.0/16"
    subnets = [
        SubnetInput(name="public-subnet", cidr="10.0.1.0/24"),
        SubnetInput(name="external-subnet", cidr="192.168.1.0/24")  # Outside VPC
    ]
    result = validate_network_plan(vpc_cidr, subnets)
    assert result.is_valid is False
    assert any("NOT contained inside VPC" in err for err in result.errors)

def test_validate_duplicate_subnet_names():
    vpc_cidr = "10.0.0.0/16"
    subnets = [
        SubnetInput(name="web-tier", cidr="10.0.1.0/24"),
        SubnetInput(name="web-tier", cidr="10.0.2.0/24")
    ]
    result = validate_network_plan(vpc_cidr, subnets)
    assert result.is_valid is False
    assert any("Duplicate subnet name" in err for err in result.errors)

def test_validate_vpc_prefix_bounds():
    # /12 is wider than AWS limit /16
    result = validate_network_plan("10.0.0.0/12", [])
    assert result.is_valid is False
    assert any("outside AWS limits" in err for err in result.errors)

def test_cidr_diagnostic_checks():
    # Pass scenario
    findings = run_cidr_diagnostic_checks(
        "10.0.0.0/16",
        [
            SubnetInput(name="pub", cidr="10.0.1.0/24"),
            SubnetInput(name="priv", cidr="10.0.2.0/24")
        ]
    )
    statuses = {f.check_id: f.status for f in findings}
    assert statuses["CIDR-001"] == "PASS"
    assert statuses["CIDR-002"] == "PASS"
    assert statuses["CIDR-003"] == "PASS"
