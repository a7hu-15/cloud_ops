import React, { useState, useEffect } from 'react';
import {
  getWorkflowSession,
  initWorkflowSession,
  injectWorkflowFault,
  runWorkflowDiagnostics,
  applyWorkflowRemediation,
  verifyWorkflowRecovery,
  getWorkflowReportMarkdown
} from '../api/client';

export default function TroubleshootingWorkflow() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [markdownReport, setMarkdownReport] = useState(null);

  // Safety confirmation modal state for Step 5
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getWorkflowSession();
      setSession(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInitLab = async (mode = 'simulation') => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const data = await initWorkflowSession('standard_two_tier', mode);
      setSession(data);
      setMarkdownReport(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInjectFault = async (faultId) => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const data = await injectWorkflowFault(faultId);
      setSession(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const data = await runWorkflowDiagnostics();
      setSession(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyRemediation = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setShowConfirmModal(false);
    try {
      const data = await applyWorkflowRemediation(confirmInput, false);
      setSession(data);
      setConfirmInput('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyRecovery = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const data = await verifyWorkflowRecovery();
      setSession(data);
      // Automatically load markdown report
      const rep = await getWorkflowReportMarkdown();
      setMarkdownReport(rep.markdown);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const downloadReportFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !session) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading Troubleshooting & Recovery Workflow session...
      </div>
    );
  }

  const stepNumber = session?.current_step || 1;
  const lab = session?.lab;
  const rca = session?.rca_report;
  const rem = session?.applied_remediation || rca?.remediation;
  const rec = session?.recovery_result;

  const faultScenarios = [
    {
      id: 'sg_missing_https',
      title: 'Missing Inbound HTTPS (Port 443)',
      layer: 'Layer 4 / Security Group',
      summary: 'HTTP (80) is authorized, but HTTPS (443) is omitted from web-sg.',
      impact: 'TLS clients experience connection timeouts.'
    },
    {
      id: 'missing_default_route',
      title: 'Missing Public Route to IGW',
      layer: 'Layer 3 / Route Table',
      summary: 'Public route table lacks 0.0.0.0/0 next-hop pointing to IGW.',
      impact: 'Public subnet cannot route egress/ingress packets beyond VPC.'
    },
    {
      id: 'igw_detached',
      title: 'Detached Internet Gateway',
      layer: 'VPC Perimeter Gateway',
      summary: 'Internet Gateway exists in AWS region but is in detached state.',
      impact: 'Public IP translation fails at VPC edge.'
    },
    {
      id: 'subnet_overlap',
      title: 'Subnet CIDR Overlap Collision',
      layer: 'IPv4 Address Planning',
      summary: 'Two subnets are allocated identical or intersecting CIDR blocks (10.0.1.0/24).',
      impact: 'Routing conflict; AWS rejects subnet allocation.'
    },
    {
      id: 'invalid_cidr_boundary',
      title: 'Host Bits Set in Subnet CIDR',
      layer: 'CIDR Mathematics',
      summary: 'Subnet network supplied with non-zero host bits (e.g. 10.0.1.5/24).',
      impact: 'Terraform and Python ipaddress reject malformed network specification.'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="page-eyebrow">Signature Engineering Feature</div>
          <h1 className="page-title">Troubleshooting & recovery engine</h1>
          <p className="page-description">
            End-to-end evidence-based lifecycle: Lab Setup $\rightarrow$ Fault Injection $\rightarrow$ Diagnostics $\rightarrow$ Root-Cause Analysis $\rightarrow$ Remediation $\rightarrow$ Verification.
          </p>
        </div>

        {/* Mode & Reset Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="status-tag status-tag-accent font-mono">
            MODE: {session?.mode?.toUpperCase() || 'SIMULATION'}
          </span>
          <button
            type="button"
            onClick={() => handleInitLab(session?.mode || 'simulation')}
            disabled={actionLoading}
            className="btn btn-secondary"
            style={{ height: 32 }}
          >
            Reset workflow
          </button>
        </div>
      </div>

      {/* 7-Step Progress Stepper Ribbon */}
      <div className="pipeline-stepper" style={{ overflowX: 'auto' }}>
        {[
          { num: 1, title: '1. Lab Model', key: 'lab' },
          { num: 2, title: '2. Inject Fault', key: 'fault' },
          { num: 3, title: '3. Diagnostics', key: 'diag' },
          { num: 4, title: '4. Root-Cause', key: 'rca' },
          { num: 5, title: '5. Remediation', key: 'rem' },
          { num: 6, title: '6. Verification', key: 'rec' },
          { num: 7, title: '7. Audit Report', key: 'report' }
        ].map((s) => {
          const isActive = stepNumber === s.num;
          const isPassed = stepNumber > s.num;
          return (
            <div
              key={s.num}
              className={`pipeline-step-btn ${isActive ? 'active' : ''}`}
              style={{
                cursor: 'default',
                opacity: isPassed || isActive ? 1 : 0.45,
                minWidth: 140
              }}
            >
              <span
                className="step-num"
                style={{
                  backgroundColor: isPassed ? 'var(--status-success)' : isActive ? 'var(--accent)' : 'var(--bg-surface-subtle)',
                  color: isPassed || isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  borderColor: isPassed ? 'var(--status-success)' : isActive ? 'var(--accent)' : 'var(--border-color)'
                }}
              >
                {s.num}
              </span>
              <div className="step-meta">
                <span className="step-title" style={{ fontSize: '11.5px' }}>{s.title}</span>
                <span className="step-cmd" style={{ fontSize: '10px' }}>
                  {isPassed ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Banner if any */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--status-error-bg)',
          border: '1px solid var(--status-error-border)',
          borderRadius: 6,
          color: 'var(--status-error)',
          fontSize: '12.5px'
        }}>
          <strong>Workflow Exception:</strong> {errorMsg}
        </div>
      )}

      {/* =========================================================================
          STEP 1: Lab Architecture Overview
          ========================================================================= */}
      <div className="panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>STEP 1</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Target Network Lab Architecture
            </span>
          </div>
          <span className="status-tag status-tag-neutral font-mono">{lab?.vpc?.vpc_id} (10.0.0.0/16)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 5, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>VPC Boundary</div>
            <div className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
              {lab?.vpc?.cidr_block}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>65,536 Total Addresses</div>
          </div>

          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 5, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Perimeter Gateway</div>
            <div className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
              {lab?.internet_gateway?.igw_id}
            </div>
            <div style={{ fontSize: '11.5px', color: lab?.internet_gateway?.state === 'attached' ? 'var(--status-success)' : 'var(--status-error)' }}>
              Status: {lab?.internet_gateway?.state?.toUpperCase()}
            </div>
          </div>

          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 5, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subnet Tiers (Route-Based)</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
              {lab?.subnets?.length} Subnets Defined
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              {lab?.subnets?.map(s => `${s.name.replace('cloudops-lab-', '')} [${s.calculated_tier}]`).join(', ')}
            </div>
          </div>

          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 5, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Security Policy</div>
            <div className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
              {lab?.security_groups?.[0]?.group_name}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              {lab?.security_groups?.[0]?.ingress_rules?.length} Inbound Authorization Rules
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          STEP 2: Controlled Fault Injection
          ========================================================================= */}
      <div className="panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>STEP 2</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Select Reproducible Fault Scenario
            </span>
          </div>
          {session?.injected_fault_id && (
            <span className="status-tag status-tag-error font-mono">
              ACTIVE FAULT: {session.injected_fault_id}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {faultScenarios.map((sc) => {
            const isSelected = session?.injected_fault_id === sc.id;
            return (
              <div
                key={sc.id}
                style={{
                  padding: '12px 14px',
                  backgroundColor: isSelected ? 'var(--status-error-bg)' : 'var(--bg-surface-subtle)',
                  border: `1px solid ${isSelected ? 'var(--status-error-border)' : 'var(--border-subtle)'}`,
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {sc.layer}
                    </span>
                    {isSelected && (
                      <span className="status-tag status-tag-error" style={{ fontSize: '9.5px' }}>Injected</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    {sc.title}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {sc.summary}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleInjectFault(sc.id)}
                  disabled={actionLoading || isSelected}
                  className={`btn ${isSelected ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ width: '100%', height: 28, fontSize: '11.5px', marginTop: 4 }}
                >
                  {isSelected ? 'Fault Injected' : 'Inject Fault'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          STEP 3 & 4: Diagnostics Execution & Root-Cause Analysis (RCA)
          ========================================================================= */}
      <div className="panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>STEP 3 & 4</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Diagnostic Inspection & Deterministic RCA
            </span>
          </div>

          <button
            type="button"
            onClick={handleRunDiagnostics}
            disabled={actionLoading}
            className="btn btn-primary"
            style={{ height: 30, fontSize: '12px' }}
          >
            {actionLoading && stepNumber === 3 ? 'Analyzing stack...' : 'Run Diagnostics & RCA'}
          </button>
        </div>

        {/* RCA Findings Card if evaluated */}
        {rca ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* RCA Verdict Banner */}
            <div style={{
              padding: '14px 16px',
              backgroundColor: rca.primary_cause_id === 'RCA-HEALTHY' ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
              border: `1px solid ${rca.primary_cause_id === 'RCA-HEALTHY' ? 'var(--status-success-border)' : 'var(--status-error-border)'}`,
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="font-mono" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {rca.primary_cause_id}
                </span>
                <span className={`status-tag ${rca.primary_cause_id === 'RCA-HEALTHY' ? 'status-tag-success' : 'status-tag-error'}`}>
                  Confidence: {Math.round(rca.confidence_score * 100)}% ({rca.certainty_level})
                </span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {rca.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Target: {rca.affected_resource}
              </div>
            </div>

            {/* Evidence Chain */}
            <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '12px 16px', borderRadius: 6 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Multi-Factor Evidence Chain
              </div>
              <ul style={{ paddingLeft: 18, fontSize: '12px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }}>
                {rca.evidence_chain.map((ev, i) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            </div>

            {/* Layer Investigation Status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {rca.investigated_layers.map((layer, idx) => (
                <div key={idx} style={{ padding: '8px 10px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 4, border: '1px solid var(--border-subtle)', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{layer.layer}</span>
                    <span className={`dot-indicator ${layer.status === 'FAULT_DETECTED' ? 'red' : layer.status === 'NORMAL' ? 'green' : 'grey'}`}></span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: '11px' }}>{layer.summary}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
            Click "Run Diagnostics & RCA" to execute automated checks across CIDR, Route Tables, Gateways, and Security Groups.
          </div>
        )}
      </div>

      {/* =========================================================================
          STEP 5: Remediation Synthesis & Review
          ========================================================================= */}
      {rem && (
        <div className="panel" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>STEP 5</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Proposed Terraform Remediation
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={actionLoading || stepNumber > 5}
              className="btn btn-primary"
              style={{ height: 30, fontSize: '12px' }}
            >
              {stepNumber > 5 ? 'Remediation Applied' : 'Review & Apply Remediation'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {rem.title}
              </span>
              <span className="status-tag status-tag-neutral font-mono">{rem.target_file}</span>
            </div>

            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <strong>Rationale:</strong> {rem.rationale}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <strong>Security Implications:</strong> {rem.security_implications}
            </div>

            {/* Diff Preview */}
            <pre style={{
              backgroundColor: 'var(--terminal-bg)',
              color: 'var(--terminal-text)',
              padding: '12px 14px',
              borderRadius: 6,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11.5px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              margin: 0
            }}>
              {rem.diff_preview}
            </pre>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 6: Recovery Verification
          ========================================================================= */}
      {stepNumber >= 5 && (
        <div className="panel" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>STEP 6</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Recovery Verification & Empirical Proof
              </span>
            </div>

            <button
              type="button"
              onClick={handleVerifyRecovery}
              disabled={actionLoading || stepNumber < 6}
              className="btn btn-primary"
              style={{ height: 30, fontSize: '12px' }}
            >
              {actionLoading && stepNumber === 6 ? 'Verifying recovery...' : 'Verify Recovery'}
            </button>
          </div>

          {rec ? (
            <div style={{
              padding: '16px',
              backgroundColor: rec.recovered ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
              border: `1px solid ${rec.recovered ? 'var(--status-success-border)' : 'var(--status-warning-border)'}`,
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`status-tag ${rec.recovered ? 'status-tag-success' : 'status-tag-warning'}`}>
                  {rec.recovered ? 'RECOVERY CERTIFIED (100%)' : 'PARTIAL RECOVERY'}
                </span>
                <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {rec.recovery_mode}
                </span>
              </div>

              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {rec.evidence}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Resolved checks: {rec.resolved_findings.join(', ') || 'None'} | Remaining failures: {rec.remaining_findings.length}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Apply remediation in Step 5, then click "Verify Recovery" to run the diagnostic re-evaluation.
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          STEP 7: Audit Experiment Report Export
          ========================================================================= */}
      {rec && (
        <div className="panel" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>STEP 7</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Certified Experiment Audit Report
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => downloadReportFile(markdownReport || '', `cloudops-lab-report-${session.session_id}.md`, 'text/markdown')}
                className="btn btn-secondary"
                style={{ height: 30, fontSize: '11.5px' }}
              >
                Download Markdown (.md)
              </button>
              <button
                type="button"
                onClick={() => downloadReportFile(JSON.stringify(session, null, 2), `cloudops-lab-session-${session.session_id}.json`, 'application/json')}
                className="btn btn-primary"
                style={{ height: 30, fontSize: '11.5px' }}
              >
                Download JSON (.json)
              </button>
            </div>
          </div>

          {markdownReport && (
            <pre style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-color)',
              padding: '16px',
              borderRadius: 6,
              fontSize: '11.5px',
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: 260,
              overflowY: 'auto',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              {markdownReport}
            </pre>
          )}
        </div>
      )}

      {/* Safety Authorization Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              Safety Confirmation Checkpoint
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
              You are about to apply remediation <strong>{rem?.title}</strong> to resolve the diagnosed failure. Type <strong>CONFIRM_REMEDIATION</strong> to authorize state reconciliation.
            </p>
            <input
              type="text"
              className="input-text font-mono"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="CONFIRM_REMEDIATION"
              autoFocus
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyRemediation}
                disabled={confirmInput !== 'CONFIRM_REMEDIATION'}
                className="btn btn-primary"
              >
                Authorize & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
