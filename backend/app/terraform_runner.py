import os
import subprocess
import time
import json
import re
from pathlib import Path
from typing import Dict, Any, Optional
from .schemas import TerraformRunResponse

# Absolute path to the managed infrastructure directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
INFRA_DIR = BASE_DIR / "infrastructure"

# Allowed terraform actions with their safe arguments
ALLOWLISTED_ACTIONS = {
    "fmt_check": ["terraform", "fmt", "-check", "-no-color"],
    "init": ["terraform", "init", "-backend=false", "-no-color"],
    "validate": ["terraform", "validate", "-no-color"],
    "plan": ["terraform", "plan", "-no-color", "-input=false"],
    "apply": ["terraform", "apply", "-auto-approve", "-no-color", "-input=false"],
    "destroy": ["terraform", "destroy", "-auto-approve", "-no-color", "-input=false"],
}

# Maximum output capture size in characters (prevents memory buffer overflow)
MAX_OUTPUT_CHARS = 100_000
COMMAND_TIMEOUT_SECONDS = 120

ALLOWED_VARIABLE_KEYS = {
    "vpc_cidr": str,
    "public_subnet_cidr": str,
    "private_subnet_cidr": str,
    "aws_region": str,
    "availability_zone": str,
    "enable_https_ingress": bool,
    "attach_internet_gateway": bool
}

def sanitize_variables(variables: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Strictly validates and sanitizes input variables for Terraform.
    Rejects unknown keys, ensures type safety, and avoids injection risks.
    """
    if not variables:
        return {}

    sanitized: Dict[str, Any] = {}
    for key, value in variables.items():
        if key not in ALLOWED_VARIABLE_KEYS:
            continue

        expected_type = ALLOWED_VARIABLE_KEYS[key]
        if expected_type is bool:
            sanitized[key] = bool(value)
        elif expected_type is str:
            val_str = str(value).strip()
            # Enforce safe alphanumeric, CIDR or region format
            if re.match(r"^[a-zA-Z0-9\.\-\/]+$", val_str):
                sanitized[key] = val_str
            else:
                raise ValueError(f"Variable '{key}' contains invalid characters.")

    return sanitized

def parse_terraform_plan_summary(output: str) -> Optional[Dict[str, int]]:
    """
    Extracts 'Plan: X to add, Y to change, Z to destroy' from terraform output.
    """
    match = re.search(r"Plan:\s+(\d+)\s+to add,\s+(\d+)\s+to change,\s+(\d+)\s+to destroy", output)
    if match:
        return {
            "to_add": int(match.group(1)),
            "to_change": int(match.group(2)),
            "to_destroy": int(match.group(3))
        }
    if "No changes. Your infrastructure matches the configuration." in output:
        return {"to_add": 0, "to_change": 0, "to_destroy": 0}
    return None

def run_terraform_command(
    action: str,
    confirmation_phrase: Optional[str] = None,
    variables: Optional[Dict[str, Any]] = None
) -> TerraformRunResponse:
    """
    Executes a pre-defined Terraform command within the fixed infrastructure directory.
    Enforces security:
    - Never uses shell=True
    - Only executes allowlisted actions
    - Requires explicit confirmation for apply and destroy
    - Sanitizes variables and writes safely to a local tfvars.json
    - Hard timeouts and output size capping
    """
    if action not in ALLOWLISTED_ACTIONS:
        return TerraformRunResponse(
            success=False,
            action=action,
            exit_code=-1,
            stdout="",
            stderr=f"Security violation: Action '{action}' is not in the allowlist of safe commands.",
            duration_seconds=0.0
        )

    # Require explicit confirmation for destructive or provisioning operations
    if action == "apply" and confirmation_phrase != "CONFIRM_APPLY":
        return TerraformRunResponse(
            success=False,
            action=action,
            exit_code=400,
            stdout="",
            stderr="Safety Check: 'apply' requires explicit confirmation phrase 'CONFIRM_APPLY'.",
            duration_seconds=0.0
        )

    if action == "destroy" and confirmation_phrase != "CONFIRM_DESTROY":
        return TerraformRunResponse(
            success=False,
            action=action,
            exit_code=400,
            stdout="",
            stderr="Safety Check: 'destroy' requires explicit confirmation phrase 'CONFIRM_DESTROY'.",
            duration_seconds=0.0
        )

    if not INFRA_DIR.exists():
        return TerraformRunResponse(
            success=False,
            action=action,
            exit_code=-1,
            stdout="",
            stderr=f"Infrastructure directory '{INFRA_DIR}' does not exist.",
            duration_seconds=0.0
        )

    # Write sanitized variables to lab_override.auto.tfvars.json if provided
    var_file_path = INFRA_DIR / "lab_override.auto.tfvars.json"
    try:
        if variables:
            clean_vars = sanitize_variables(variables)
            with open(var_file_path, "w", encoding="utf-8") as f:
                json.dump(clean_vars, f, indent=2)
    except Exception as e:
        return TerraformRunResponse(
            success=False,
            action=action,
            exit_code=-1,
            stdout="",
            stderr=f"Variable sanitation error: {str(e)}",
            duration_seconds=0.0
        )

    cmd = list(ALLOWLISTED_ACTIONS[action])
    start_time = time.time()

    try:
        process = subprocess.run(
            cmd,
            cwd=str(INFRA_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=COMMAND_TIMEOUT_SECONDS,
            shell=False  # CRITICAL: Prevent shell injection attacks
        )
        duration = round(time.time() - start_time, 2)
        stdout = process.stdout[:MAX_OUTPUT_CHARS]
        stderr = process.stderr[:MAX_OUTPUT_CHARS]

        summary = None
        if action == "plan":
            summary = parse_terraform_plan_summary(stdout)

        return TerraformRunResponse(
            success=(process.returncode == 0),
            action=action,
            exit_code=process.returncode,
            stdout=stdout,
            stderr=stderr,
            duration_seconds=duration,
            summary=summary
        )

    except subprocess.TimeoutExpired:
        duration = round(time.time() - start_time, 2)
        return TerraformRunResponse(
            success=False,
            action=action,
            exit_code=-2,
            stdout="",
            stderr=f"Operation timed out after {COMMAND_TIMEOUT_SECONDS} seconds.",
            duration_seconds=duration
        )
    except FileNotFoundError:
        duration = round(time.time() - start_time, 2)
        return TerraformRunResponse(
            success=False,
            action=action,
            exit_code=-3,
            stdout="",
            stderr="Terraform binary not found on the system PATH.",
            duration_seconds=duration
        )
    except Exception as e:
        duration = round(time.time() - start_time, 2)
        return TerraformRunResponse(
            success=False,
            action=action,
            exit_code=-4,
            stdout="",
            stderr=f"Execution error: {str(e)}",
            duration_seconds=duration
        )
