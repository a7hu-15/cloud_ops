from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas import (
    NetworkValidationRequest,
    NetworkValidationResult,
    NetworkConfigCreateRequest,
    NetworkConfigUpdateRequest,
    TopologyGenerateRequest,
    SubnetInput
)
from ..network import validate_network_plan
from ..network_service import (
    save_network_configuration,
    list_network_configurations,
    get_network_configuration,
    update_network_configuration,
    build_topology_from_config
)
from .dependencies import get_current_user

router = APIRouter(prefix="/api/networks", tags=["Networks"])

@router.post("", status_code=status.HTTP_201_CREATED)
def create_network_config(
    req: NetworkConfigCreateRequest,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Saves a user's network configuration to persistent storage.
    """
    subnets_data = [s.model_dump() for s in req.subnets]
    return save_network_configuration(
        user_id=user["id"],
        name=req.name,
        region=req.region,
        vpc_cidr=req.vpc_cidr,
        subnets=subnets_data
    )

@router.get("")
def list_user_networks(
    user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Lists all saved network configurations belonging to the authenticated user.
    """
    return list_network_configurations(user["id"])

@router.get("/{config_id}")
def get_user_network(
    config_id: int,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves a specific network configuration owned by the user.
    """
    return get_network_configuration(user["id"], config_id)

@router.put("/{config_id}")
def update_user_network(
    config_id: int,
    req: NetworkConfigUpdateRequest,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Updates an existing network configuration owned by the user.
    """
    subnets_data = [s.model_dump() for s in req.subnets]
    return update_network_configuration(
        user_id=user["id"],
        config_id=config_id,
        name=req.name,
        region=req.region,
        vpc_cidr=req.vpc_cidr,
        subnets=subnets_data
    )

@router.post("/validate", response_model=NetworkValidationResult)
def validate_networks_endpoint(req: NetworkValidationRequest):
    """
    Validates VPC IPv4 CIDR, subnet containment, and mutual overlap.
    """
    return validate_network_plan(vpc_cidr=req.vpc_cidr, subnets=req.subnets)

@router.post("/{config_id}/topology")
def generate_saved_network_topology(
    config_id: int,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generates a structured network topology model from a saved configuration.
    """
    config = get_network_configuration(user["id"], config_id)
    return build_topology_from_config(
        vpc_cidr=config["vpc_cidr"],
        subnets=config["subnets"],
        region=config["region"]
    )

@router.post("/topology")
def generate_adhoc_topology(req: TopologyGenerateRequest) -> Dict[str, Any]:
    """
    Generates a structured network topology model from ad-hoc configuration.
    """
    subnets_data = [s.model_dump() for s in req.subnets]
    return build_topology_from_config(
        vpc_cidr=req.vpc_cidr,
        subnets=subnets_data,
        region=req.region
    )

