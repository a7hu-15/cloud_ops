from typing import Dict, Any, List, Optional
import json
import sqlite3
from fastapi import HTTPException, status
from .db import get_connection
from .network import validate_network_plan
from .schemas import SubnetInput

def build_topology_from_config(
    vpc_cidr: str,
    subnets: List[Dict[str, Any]],
    region: str = "us-east-1"
) -> Dict[str, Any]:
    """
    Builds a structured topology graph model with nodes, edges, tier classifications,
    route targets, and security associations according to Section 5.2.
    """
    subnet_models = [
        SubnetInput(name=s.get("name", f"subnet-{i}"), cidr=s.get("cidr", ""))
        for i, s in enumerate(subnets)
    ]
    validation = validate_network_plan(vpc_cidr, subnet_models)

    nodes = []
    edges = []

    # VPC Node
    vpc_id = "vpc-lab-01"
    nodes.append({
        "id": vpc_id,
        "type": "vpc",
        "label": f"VPC ({vpc_cidr})",
        "cidr": vpc_cidr,
        "region": region,
        "status": "valid" if validation.is_valid else "invalid"
    })

    # Internet Gateway Node
    igw_id = "igw-lab-01"
    nodes.append({
        "id": igw_id,
        "type": "internet_gateway",
        "label": "Internet Gateway",
        "status": "attached",
        "attached_to": vpc_id
    })
    edges.append({
        "from": igw_id,
        "to": vpc_id,
        "type": "attaches_to",
        "label": "Attached"
    })

    # Route tables
    rt_public_id = "rt-public-01"
    nodes.append({
        "id": rt_public_id,
        "type": "route_table",
        "label": "Public Route Table",
        "tier": "public",
        "routes": [
            {"destination": vpc_cidr, "target": "local"},
            {"destination": "0.0.0.0/0", "target": igw_id}
        ]
    })
    edges.append({
        "from": rt_public_id,
        "to": igw_id,
        "type": "routes_to",
        "label": "0.0.0.0/0 -> IGW"
    })

    rt_private_id = "rt-private-01"
    nodes.append({
        "id": rt_private_id,
        "type": "route_table",
        "label": "Private Route Table",
        "tier": "private",
        "routes": [
            {"destination": vpc_cidr, "target": "local"}
        ]
    })

    # Security Group Node
    sg_id = "sg-web-01"
    nodes.append({
        "id": sg_id,
        "type": "security_group",
        "label": "Web Security Group",
        "inbound_rules": [
            {"protocol": "tcp", "port": 80, "source": "0.0.0.0/0", "description": "HTTP"},
            {"protocol": "tcp", "port": 443, "source": "0.0.0.0/0", "description": "HTTPS"}
        ]
    })

    # Subnets
    for i, s in enumerate(subnets):
        s_name = s.get("name", f"subnet-{i}")
        s_cidr = s.get("cidr", "")
        configured_tier = s.get("tier", "public" if "public" in s_name.lower() else "private")

        sub_id = f"subnet-{i+1}"
        calc = next((c for c in validation.subnets if c.name == s_name), None)

        nodes.append({
            "id": sub_id,
            "type": "subnet",
            "name": s_name,
            "label": f"{s_name} ({s_cidr})",
            "cidr": s_cidr,
            "tier": configured_tier,
            "total_ips": calc.total_ips if calc else 0,
            "usable_ips": calc.usable_ips if calc else 0,
            "contained": calc.is_contained_in_vpc if calc else False
        })

        # Connect VPC to subnet
        edges.append({
            "from": vpc_id,
            "to": sub_id,
            "type": "contains",
            "label": "Contains"
        })

        # Connect subnet to route table
        target_rt = rt_public_id if configured_tier == "public" else rt_private_id
        edges.append({
            "from": sub_id,
            "to": target_rt,
            "type": "associated_with",
            "label": "Route Table"
        })

        # Connect Security Group to public workloads
        if configured_tier == "public":
            edges.append({
                "from": sg_id,
                "to": sub_id,
                "type": "secures",
                "label": "Applies SG"
            })

    return {
        "vpc_cidr": vpc_cidr,
        "region": region,
        "is_valid": validation.is_valid,
        "errors": validation.errors,
        "warnings": validation.warnings,
        "nodes": nodes,
        "edges": edges
    }

def save_network_configuration(
    user_id: int,
    name: str,
    region: str,
    vpc_cidr: str,
    subnets: List[Dict[str, Any]]
) -> Dict[str, Any]:
    if not name or not name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Network configuration name is required"
        )

    # Validate configuration syntax
    subnet_models = [
        SubnetInput(name=s.get("name", f"subnet-{i}"), cidr=s.get("cidr", ""))
        for i, s in enumerate(subnets)
    ]
    val = validate_network_plan(vpc_cidr, subnet_models)

    subnets_json = json.dumps(subnets)
    conn = get_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO network_configurations (user_id, name, region, vpc_cidr, subnets_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, name.strip(), region.strip() or "us-east-1", vpc_cidr.strip(), subnets_json)
            )
            config_id = cursor.lastrowid

        return {
            "id": config_id,
            "name": name.strip(),
            "region": region,
            "vpc_cidr": vpc_cidr,
            "subnets": subnets,
            "validation": val.model_dump()
        }
    finally:
        conn.close()

def list_network_configurations(user_id: int) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, user_id, name, region, vpc_cidr, subnets_json, created_at, updated_at
            FROM network_configurations
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,)
        )
        rows = cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r["id"],
                "name": r["name"],
                "region": r["region"],
                "vpc_cidr": r["vpc_cidr"],
                "subnets": json.loads(r["subnets_json"]),
                "created_at": r["created_at"],
                "updated_at": r["updated_at"]
            })
        return result
    finally:
        conn.close()

def get_network_configuration(user_id: int, config_id: int) -> Dict[str, Any]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, user_id, name, region, vpc_cidr, subnets_json, created_at, updated_at
            FROM network_configurations
            WHERE id = ? AND user_id = ?
            """,
            (config_id, user_id)
        )
        r = cursor.fetchone()
        if not r:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Network configuration not found"
            )
        subnets = json.loads(r["subnets_json"])
        subnet_models = [
            SubnetInput(name=s.get("name", f"subnet-{i}"), cidr=s.get("cidr", ""))
            for i, s in enumerate(subnets)
        ]
        val = validate_network_plan(r["vpc_cidr"], subnet_models)

        return {
            "id": r["id"],
            "name": r["name"],
            "region": r["region"],
            "vpc_cidr": r["vpc_cidr"],
            "subnets": subnets,
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "validation": val.model_dump()
        }
    finally:
        conn.close()

def update_network_configuration(
    user_id: int,
    config_id: int,
    name: str,
    region: str,
    vpc_cidr: str,
    subnets: List[Dict[str, Any]]
) -> Dict[str, Any]:
    # Ensure config belongs to user
    get_network_configuration(user_id, config_id)

    subnet_models = [
        SubnetInput(name=s.get("name", f"subnet-{i}"), cidr=s.get("cidr", ""))
        for i, s in enumerate(subnets)
    ]
    val = validate_network_plan(vpc_cidr, subnet_models)
    subnets_json = json.dumps(subnets)

    conn = get_connection()
    try:
        with conn:
            conn.execute(
                """
                UPDATE network_configurations
                SET name = ?, region = ?, vpc_cidr = ?, subnets_json = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                (name.strip(), region.strip(), vpc_cidr.strip(), subnets_json, config_id, user_id)
            )

        return {
            "id": config_id,
            "name": name.strip(),
            "region": region,
            "vpc_cidr": vpc_cidr,
            "subnets": subnets,
            "validation": val.model_dump()
        }
    finally:
        conn.close()

