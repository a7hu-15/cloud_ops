"""
CloudOps Lab - Integrated Troubleshooting & Recovery Workflow Engine
Member 3 (Diagnostics & Recovery) & Member 4 (Platform Engineering & Quality)

Orchestrates the 7-step signature troubleshooting workflow:
1. Lab Selection
2. Controlled Fault Injection
3. Multi-tier Diagnostics
4. Deterministic Root-Cause Analysis (RCA)
5. Reviewable Remediation Generation
6. Recovery Verification & Before/After Diff
7. Audit Experiment Report Generation (JSON & Markdown)
"""

import time
import json
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

from .schemas import DiagnosticFinding, DiagnosticsRunResponse
from .network_model import (
    NetworkLabModel,
    create_standard_two_tier_lab,
    trace_inbound_packet
)
from .diagnostics import (
    execute_diagnostic_suite,
    set_simulated_fault,
    get_active_faults
)
from .rca_engine import (
    analyze_root_cause,
    RcaAnalysisReport,
    RemediationProposal
)

# In-memory active workflow session store
ACTIVE_WORKFLOW_SESSION: Optional["WorkflowSession"] = None


class WorkflowStepStatus(BaseModel):
    step_number: int
    step_name: str
    status: Literal["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED"]
    summary: str


class WorkflowInitRequest(BaseModel):
    lab_template_id: str = "standard_two_tier"
    mode: Literal["simulation", "live_aws", "local"] = "simulation"


class FaultInjectRequest(BaseModel):
    fault_id: Literal[
        "sg_missing_https",
        "missing_default_route",
        "igw_detached",
        "subnet_overlap",
        "invalid_cidr_boundary"
    ]


class ApplyRemediationRequest(BaseModel):
    remediation_id: str
    confirmation_token: str  # Must be 'CONFIRM_REMEDIATION' for safety
    execute_terraform_apply: bool = False


class RecoveryVerificationResult(BaseModel):
    recovered: bool
    recovery_mode: Literal["SIMULATED_RECOVERY", "LIVE_AWS_VERIFIED_RECOVERY"]
    resolved_findings: List[str]
    remaining_findings: List[str]
    previous_failing_count: int
    current_failing_count: int
    evidence: str
    timestamp: float


class WorkflowSession(BaseModel):
    session_id: str
    created_at: float
    mode: Literal["simulation", "live_aws", "local"]
    current_step: int = 1
    lab: NetworkLabModel
    injected_fault_id: Optional[str] = None
    baseline_diagnostics: Optional[DiagnosticsRunResponse] = None
    fault_diagnostics: Optional[DiagnosticsRunResponse] = None
    rca_report: Optional[RcaAnalysisReport] = None
    applied_remediation: Optional[RemediationProposal] = None
    recovery_result: Optional[RecoveryVerificationResult] = None
    steps: List[WorkflowStepStatus] = Field(default_factory=list)


def initialize_workflow_session(
    lab_template_id: str = "standard_two_tier",
    mode: Literal["simulation", "live_aws", "local"] = "simulation"
) -> WorkflowSession:
    """
    Step 1: Initializes a structured network lab and baseline state.
    """
    global ACTIVE_WORKFLOW_SESSION

    # Reset any active faults
    for f in ["sg_missing_https", "missing_default_route", "igw_detached", "subnet_overlap", "invalid_cidr_boundary"]:
        set_simulated_fault(f, False)

    lab = create_standard_two_tier_lab(
        lab_id=f"lab-{int(time.time())}",
        mode=mode,
        active_faults={}
    )

    steps = [
        WorkflowStepStatus(step_number=1, step_name="Select Network Lab", status="COMPLETED", summary=f"Loaded {lab.name}"),
        WorkflowStepStatus(step_number=2, step_name="Inject Fault", status="NOT_STARTED", summary="Awaiting fault scenario selection"),
        WorkflowStepStatus(step_number=3, step_name="Run Diagnostics", status="NOT_STARTED", summary="Pending diagnostics execution"),
        WorkflowStepStatus(step_number=4, step_name="Root-Cause Analysis", status="NOT_STARTED", summary="Pending RCA rule engine"),
        WorkflowStepStatus(step_number=5, step_name="Generate Remediation", status="NOT_STARTED", summary="Pending remediation synthesis"),
        WorkflowStepStatus(step_number=6, step_name="Verify Recovery", status="NOT_STARTED", summary="Pending re-evaluation"),
        WorkflowStepStatus(step_number=7, step_name="Export Report", status="NOT_STARTED", summary="Pending session report export")
    ]

    session = WorkflowSession(
        session_id=f"wf-session-{int(time.time())}",
        created_at=time.time(),
        mode=mode,
        current_step=2,
        lab=lab,
        steps=steps
    )

    ACTIVE_WORKFLOW_SESSION = session
    return session


def get_current_workflow_session() -> WorkflowSession:
    global ACTIVE_WORKFLOW_SESSION
    if ACTIVE_WORKFLOW_SESSION is None:
        ACTIVE_WORKFLOW_SESSION = initialize_workflow_session()
    return ACTIVE_WORKFLOW_SESSION


def inject_workflow_fault(fault_id: str) -> WorkflowSession:
    """
    Step 2: Introduces a reproducible, controlled fault into the active lab.
    """
    session = get_current_workflow_session()
    session.injected_fault_id = fault_id

    # Update in-memory fault state
    set_simulated_fault(fault_id, True)

    # Re-generate lab model reflecting the injected fault
    session.lab = create_standard_two_tier_lab(
        lab_id=session.lab.lab_id,
        mode=session.mode,
        active_faults=get_active_faults()
    )

    session.current_step = 3
    session.steps[1].status = "COMPLETED"
    session.steps[1].summary = f"Injected fault: {fault_id}"
    session.steps[2].status = "IN_PROGRESS"
    session.steps[2].summary = "Ready to execute diagnostics on faulted lab"

    return session


def run_workflow_diagnostics() -> WorkflowSession:
    """
    Step 3 & 4: Executes multi-tier diagnostics and performs deterministic RCA.
    """
    session = get_current_workflow_session()

    # Run complete diagnostic catalogue
    diag_res = execute_diagnostic_suite(
        force_simulated_aws=(session.mode == "simulation")
    )
    session.fault_diagnostics = diag_res

    # Step 4: Run Root Cause Analysis
    rca = analyze_root_cause(diag_res.findings, session.lab)
    session.rca_report = rca

    session.current_step = 5
    session.steps[2].status = "COMPLETED"
    session.steps[2].summary = f"Executed {diag_res.total_checks} checks ({diag_res.failed} failures, {diag_res.warnings} warnings)"
    session.steps[3].status = "COMPLETED"
    session.steps[3].summary = f"RCA deduced '{rca.title}' ({int(rca.confidence_score * 100)}% confidence)"
    session.steps[4].status = "IN_PROGRESS"
    session.steps[4].summary = f"Remediation proposed: {rca.remediation.title if rca.remediation else 'None'}"

    return session


def apply_workflow_remediation(confirmation_token: str, execute_tf: bool = False) -> WorkflowSession:
    """
    Step 5: Applies the synthesized remediation with explicit safety authorization.
    """
    session = get_current_workflow_session()

    if confirmation_token != "CONFIRM_REMEDIATION":
        raise ValueError("Safety rejection: confirmation_token must equal 'CONFIRM_REMEDIATION'.")

    if not session.rca_report or not session.rca_report.remediation:
        raise ValueError("No pending remediation found to apply in active workflow.")

    rem = session.rca_report.remediation
    session.applied_remediation = rem

    # In simulation mode, turn off the simulated fault
    if rem.simulation_fault_key:
        set_simulated_fault(rem.simulation_fault_key, False)

    # Rebuild lab model
    session.lab = create_standard_two_tier_lab(
        lab_id=session.lab.lab_id,
        mode=session.mode,
        active_faults=get_active_faults()
    )

    session.current_step = 6
    session.steps[4].status = "COMPLETED"
    session.steps[4].summary = f"Applied '{rem.title}' with authorization token."
    session.steps[5].status = "IN_PROGRESS"
    session.steps[5].summary = "Ready to verify recovery"

    return session


def verify_workflow_recovery() -> WorkflowSession:
    """
    Step 6: Re-evaluates diagnostics, computes before/after diff, and proves recovery.
    """
    session = get_current_workflow_session()

    # Re-run diagnostics
    post_diag = execute_diagnostic_suite(
        force_simulated_aws=(session.mode == "simulation")
    )

    prev_failures = set(
        f.check_id for f in (session.fault_diagnostics.findings if session.fault_diagnostics else [])
        if f.status in ("FAIL", "ERROR")
    )
    curr_failures = set(
        f.check_id for f in post_diag.findings
        if f.status in ("FAIL", "ERROR")
    )

    resolved = list(prev_failures - curr_failures)
    remaining = list(curr_failures)
    is_recovered = len(curr_failures) == 0

    mode_label = "SIMULATED_RECOVERY" if session.mode == "simulation" else "LIVE_AWS_VERIFIED_RECOVERY"

    rec_result = RecoveryVerificationResult(
        recovered=is_recovered,
        recovery_mode=mode_label,
        resolved_findings=resolved,
        remaining_findings=remaining,
        previous_failing_count=len(prev_failures),
        current_failing_count=len(curr_failures),
        evidence=(
            f"All prior {len(resolved)} failed checks successfully cleared to PASS. "
            f"Zero configuration conflicts remain in target stack."
            if is_recovered else
            f"Partial recovery: {len(resolved)} resolved, {len(remaining)} checks still failing."
        ),
        timestamp=time.time()
    )

    session.recovery_result = rec_result
    session.current_step = 7
    session.steps[5].status = "COMPLETED"
    session.steps[5].summary = f"Recovery {'VERIFIED' if is_recovered else 'PARTIAL'}: {len(resolved)} checks resolved"
    session.steps[6].status = "COMPLETED"
    session.steps[6].summary = "Experiment report generated and ready for export"

    return session


def generate_workflow_markdown_report(session: WorkflowSession) -> str:
    """
    Step 7: Compiles a clean, academic and engineering grade experiment report.
    """
    lab = session.lab
    rca = session.rca_report
    rem = session.applied_remediation
    rec = session.recovery_result

    report_lines = [
        f"# CloudOps Lab — Troubleshooting & Recovery Experiment Report",
        f"",
        f"**Session ID:** `{session.session_id}`  ",
        f"**Generated:** `{time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}`  ",
        f"**Execution Mode:** `{session.mode.upper()}`  ",
        f"**Lab Architecture:** `{lab.name}` (`{lab.vpc.cidr_block}`)  ",
        f"",
        f"---",
        f"",
        f"## 1. Network Lab Configuration",
        f"- **VPC ID:** `{lab.vpc.vpc_id}` ({lab.vpc.cidr_block})",
        f"- **Internet Gateway:** `{lab.internet_gateway.igw_id}` ({lab.internet_gateway.state})",
        f"- **Subnets:**",
    ]

    for s in lab.subnets:
        report_lines.append(f"  - `{s.name}` ({s.cidr_block}) — Calculated Tier: **{s.calculated_tier.upper()}** (Route Table: `{s.route_table_id}`)")

    report_lines.extend([
        f"",
        f"## 2. Injected Fault Scenario",
        f"- **Fault Identifier:** `{session.injected_fault_id or 'None'}`",
        f"- **Injection Target:** `{rca.affected_resource if rca else 'N/A'}`",
        f"",
        f"## 3. Diagnostic Observations (Pre-Remediation)",
    ])

    if session.fault_diagnostics:
        report_lines.append(f"| Check ID | Title | Status | Severity | Evidence |")
        report_lines.append(f"| :--- | :--- | :--- | :--- | :--- |")
        for f in session.fault_diagnostics.findings:
            report_lines.append(f"| `{f.check_id}` | {f.title} | **{f.status}** | {f.severity} | {f.evidence[:120]}... |")

    report_lines.extend([
        f"",
        f"## 4. Root-Cause Analysis (RCA) Verdict",
        f"- **Primary Root Cause:** `{rca.primary_cause_id if rca else 'N/A'}` — **{rca.title if rca else 'N/A'}**",
        f"- **Confidence Score:** `{int((rca.confidence_score if rca else 0) * 100)}%` ({rca.certainty_level if rca else 'N/A'})",
        f"- **Evidence Chain:**",
    ])

    if rca:
        for ev in rca.evidence_chain:
            report_lines.append(f"  - {ev}")

    report_lines.extend([
        f"",
        f"## 5. Applied Remediation & Terraform Change",
        f"- **Remediation Title:** {rem.title if rem else 'N/A'}",
        f"- **Target File:** `{rem.target_file if rem else 'N/A'}`",
        f"- **Security Implications:** {rem.security_implications if rem else 'N/A'}",
        f"",
        f"```diff",
        f"{rem.diff_preview if rem else 'No diff'}",
        f"```",
        f"",
        f"## 6. Recovery Verification",
        f"- **Recovery Status:** `{'SUCCESSFULLY RECOVERED' if (rec and rec.recovered) else 'UNRESOLVED'}`",
        f"- **Verification Mode:** `{rec.recovery_mode if rec else 'N/A'}`",
        f"- **Resolved Findings:** {', '.join(rec.resolved_findings) if rec and rec.resolved_findings else 'None'}",
        f"- **Remaining Findings:** {', '.join(rec.remaining_findings) if rec and rec.remaining_findings else 'None'}",
        f"- **Conclusion:** {rec.evidence if rec else 'N/A'}",
        f"",
        f"---",
        f"*Report certified by CloudOps Lab Deterministic Verification Engine.*"
    ])

    return "\n".join(report_lines)
