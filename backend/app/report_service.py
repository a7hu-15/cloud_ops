import json
import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status
from .db import get_connection

def save_experiment_report(
    user_id: int,
    user_name: str,
    network_config_id: Optional[int],
    mode: str,
    fault_scenario: Optional[str],
    initial_result: Dict[str, Any],
    remediation: Optional[Dict[str, Any]],
    final_result: Optional[Dict[str, Any]],
    recovery_status: str
) -> Dict[str, Any]:
    conn = get_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO experiments (
                    user_id, network_config_id, mode, fault_scenario,
                    initial_result_json, remediation_json, final_result_json, recovery_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    network_config_id,
                    mode,
                    fault_scenario or "baseline_healthy",
                    json.dumps(initial_result),
                    json.dumps(remediation or {}),
                    json.dumps(final_result or {}),
                    recovery_status
                )
            )
            experiment_id = cursor.lastrowid

        return get_experiment_report(user_id, experiment_id)
    finally:
        conn.close()

def list_user_reports(user_id: int) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT e.id, e.user_id, e.network_config_id, e.mode, e.fault_scenario,
                   e.recovery_status, e.created_at, u.full_name,
                   nc.name AS network_name, nc.vpc_cidr
            FROM experiments e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN network_configurations nc ON e.network_config_id = nc.id
            WHERE e.user_id = ?
            ORDER BY e.created_at DESC
            """,
            (user_id,)
        )
        rows = cursor.fetchall()
        reports = []
        for r in rows:
            reports.append({
                "id": r["id"],
                "experiment_id": f"EXP-{r['id']:04d}",
                "user_name": r["full_name"],
                "mode": r["mode"],
                "fault_scenario": r["fault_scenario"],
                "network_name": r["network_name"] or "Default Standard Lab",
                "vpc_cidr": r["vpc_cidr"] or "10.0.0.0/16",
                "recovery_status": r["recovery_status"],
                "created_at": r["created_at"]
            })
        return reports
    finally:
        conn.close()

def get_experiment_report(user_id: int, experiment_id: int) -> Dict[str, Any]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT e.*, u.full_name, u.email,
                   nc.name AS network_name, nc.vpc_cidr, nc.subnets_json
            FROM experiments e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN network_configurations nc ON e.network_config_id = nc.id
            WHERE e.id = ? AND e.user_id = ?
            """,
            (experiment_id, user_id)
        )
        r = cursor.fetchone()
        if not r:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Experiment report not found or you do not have permission to view it"
            )

        initial = json.loads(r["initial_result_json"]) if r["initial_result_json"] else {}
        remediation = json.loads(r["remediation_json"]) if r["remediation_json"] else {}
        final = json.loads(r["final_result_json"]) if r["final_result_json"] else {}
        subnets = json.loads(r["subnets_json"]) if r["subnets_json"] else []

        return {
            "id": r["id"],
            "experiment_id": f"EXP-{r['id']:04d}",
            "user_id": r["user_id"],
            "user_name": r["full_name"],
            "user_email": r["email"],
            "mode": r["mode"],
            "created_at": r["created_at"],
            "network_config": {
                "id": r["network_config_id"],
                "name": r["network_name"] or "Default Standard Lab",
                "vpc_cidr": r["vpc_cidr"] or "10.0.0.0/16",
                "subnets": subnets
            },
            "fault_scenario": r["fault_scenario"],
            "initial_result": initial,
            "remediation": remediation,
            "final_result": final,
            "recovery_status": r["recovery_status"]
        }
    finally:
        conn.close()

def export_experiment_report_markdown(user_id: int, experiment_id: int) -> str:
    rep = get_experiment_report(user_id, experiment_id)

    init_res = rep.get("initial_result", {})
    init_failed = [f for f in init_res.get("findings", []) if f.get("status") in ("FAIL", "WARNING")]
    final_res = rep.get("final_result", {})
    final_failed = [f for f in final_res.get("findings", []) if f.get("status") in ("FAIL", "WARNING")]

    hcl = rep.get("remediation", {}).get("terraform_diff", "# No remediation diff recorded")
    rca = rep.get("remediation", {}).get("root_cause", "Deterministic diagnostic evaluation")

    md = f"""# CloudOps Lab — Troubleshooting & Verification Report
**Experiment ID:** {rep['experiment_id']}  
**Engineer:** {rep['user_name']} ({rep['user_email']})  
**Generated At:** {rep['created_at']} UTC  
**Operational Mode:** {rep['mode'].upper()}  
**Recovery Status:** {rep['recovery_status'].upper()}  

---

## 1. Network Topology Summary
* **VPC CIDR:** `{rep['network_config']['vpc_cidr']}`
* **Network Plan Name:** {rep['network_config']['name']}
* **Active Fault Scenario:** `{rep['fault_scenario']}`

---

## 2. Pre-Remediation Diagnostic Findings
* **Total Checks Run:** {init_res.get('total_checks', 0)}
* **Passed:** {init_res.get('passed', 0)}
* **Failed / Warnings:** {len(init_failed)}

| Check ID | Severity | Status | Evidence |
|---|---|---|---|
"""
    for f in init_failed:
        md += f"| `{f.get('check_id')}` | {f.get('severity')} | {f.get('status')} | {f.get('evidence')} |\n"

    if not init_failed:
        md += "| None | INFO | PASS | All diagnostic checks passed baseline. |\n"

    md += f"""
---

## 3. Root Cause Analysis & Proposed Terraform Fix
* **Identified Root Cause:** {rca}
* **Proposed Terraform HCL Diff:**

```diff
{hcl}
```

---

## 4. Post-Remediation Verification Proof
* **Post-Fix Total Checks:** {final_res.get('total_checks', 0)}
* **Post-Fix Passed:** {final_res.get('passed', 0)}
* **Post-Fix Failed:** {len(final_failed)}
* **Verification Proof:** {'RECOVERY VERIFIED: 0 failing checks remaining' if len(final_failed) == 0 else 'RECOVERY INCOMPLETE: Remaining issues detected'}

---
*Report generated automatically by CloudOps Lab Platform.*
"""
    return md

