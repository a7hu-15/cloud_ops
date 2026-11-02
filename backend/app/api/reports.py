from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query, Response, status

from ..schemas import SaveExperimentReportRequest
from ..report_service import (
    save_experiment_report,
    list_user_reports,
    get_experiment_report,
    export_experiment_report_markdown
)
from .dependencies import get_current_user

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.post("", status_code=status.HTTP_201_CREATED)
def create_report(
    req: SaveExperimentReportRequest,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Saves an experiment run report associated with the authenticated user.
    """
    return save_experiment_report(
        user_id=user["id"],
        user_name=user["full_name"],
        network_config_id=req.network_config_id,
        mode=req.mode,
        fault_scenario=req.fault_scenario,
        initial_result=req.initial_result,
        remediation=req.remediation,
        final_result=req.final_result,
        recovery_status=req.recovery_status
    )

@router.get("")
def list_reports(
    user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Lists all experiment reports created by the authenticated user.
    """
    return list_user_reports(user["id"])

@router.get("/{report_id}")
def get_report(
    report_id: int,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves full details for a specific experiment report.
    """
    return get_experiment_report(user["id"], report_id)

@router.get("/{report_id}/export")
def export_report(
    report_id: int,
    format: str = Query(default="markdown", pattern="^(markdown|json)$"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Exports the report in GitHub Flavored Markdown or structured JSON format.
    """
    if format == "markdown":
        md_text = export_experiment_report_markdown(user["id"], report_id)
        return Response(
            content=md_text,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="experiment-report-{report_id}.md"'}
        )

    # JSON export
    rep = get_experiment_report(user["id"], report_id)
    return rep
