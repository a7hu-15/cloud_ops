import React, { useState, useEffect } from 'react';
import { listReports, getReportDetails } from '../api/client';

export default function ExperimentReport({ onReturnToWorkflow }) {
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listReports();
      setReports(data);
      if (data.length > 0) {
        setSelectedReportId(data[0].id);
        fetchReport(data[0].id);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load experiment reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async (id) => {
    try {
      const rep = await getReportDetails(id);
      setSelectedReport(rep);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch report details');
    }
  };

  const handleSelectReport = (id) => {
    setSelectedReportId(id);
    fetchReport(id);
  };

  const handleExport = (format) => {
    if (!selectedReportId) return;
    window.open(`/api/reports/${selectedReportId}/export?format=${format}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-eyebrow">Audit & Evidence / Verification</div>
          <h1 className="page-title">Experiment reports</h1>
          <p className="page-description">
            Audit-grade experiment reports detailing fault injection, multi-tier evidence chains, Terraform remediation, and recovery proof.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {selectedReport && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleExport('json')}
                style={{ height: 34, fontSize: '12px' }}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleExport('markdown')}
                style={{ height: 34, fontSize: '12px' }}
              >
                Download Markdown (.md)
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 4,
          fontSize: '12.5px',
          color: 'var(--status-danger)'
        }}>
          {errorMsg}
        </div>
      )}

      {/* Main Grid: Left report selector list, Right report details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: Saved Reports Index */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          padding: 16
        }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Saved Experiments ({reports.length})
          </div>

          {loading && reports.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0' }}>
              Loading reports...
            </div>
          )}

          {!loading && reports.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
              No experiment reports saved yet. Complete a recovery cycle in the Recovery Engine to generate your first audit report.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reports.map((r) => {
              const isSelected = r.id === selectedReportId;
              const isRecovered = r.recovery_status === 'recovered';
              return (
                <div
                  key={r.id}
                  onClick={() => handleSelectReport(r.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'rgba(71, 119, 100, 0.06)' : 'var(--bg-canvas)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.experiment_id}
                    </span>
                    <span className={`status-tag ${isRecovered ? 'status-tag-success' : 'status-tag-neutral'}`} style={{ fontSize: '10px' }}>
                      {r.recovery_status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Scenario: <span className="font-mono">{r.fault_scenario}</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    {r.created_at} UTC
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Report View */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          padding: 24,
          minHeight: 480
        }}>
          {!selectedReport ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Select a report from the list to inspect audit evidence and recovery proof.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Meta Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 16,
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="font-mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedReport.experiment_id}
                    </span>
                    <span className={`status-tag ${selectedReport.recovery_status === 'recovered' ? 'status-tag-success' : 'status-tag-neutral'}`}>
                      {selectedReport.recovery_status.toUpperCase()}
                    </span>
                    <span className="status-tag status-tag-neutral font-mono">
                      {selectedReport.mode.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Engineer: <strong>{selectedReport.user_name}</strong> ({selectedReport.user_email}) | Recorded: {selectedReport.created_at} UTC
                  </div>
                </div>

                {onReturnToWorkflow && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onReturnToWorkflow}
                    style={{ fontSize: '12px' }}
                  >
                    Open in Recovery Engine
                  </button>
                )}
              </div>

              {/* Section 1: Network Topology Summary */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  1. Network Configuration Summary
                </div>
                <div style={{
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Plan Name</span>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
                      {selectedReport.network_config.name}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>VPC CIDR</span>
                    <div className="font-mono" style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
                      {selectedReport.network_config.vpc_cidr}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Injected Fault Scenario</span>
                    <div className="font-mono" style={{ fontSize: '12px', color: 'var(--status-warning)', marginTop: 2 }}>
                      {selectedReport.fault_scenario}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Pre-Remediation Diagnostics */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  2. Pre-Remediation Diagnostic Evidence
                </div>
                <div style={{
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 90px 1fr',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase'
                  }}>
                    <div>Check ID</div>
                    <div>Severity</div>
                    <div>Observed Configuration Evidence</div>
                  </div>

                  {(selectedReport.initial_result?.findings || []).length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      All baseline diagnostic checks passed.
                    </div>
                  ) : (
                    (selectedReport.initial_result?.findings || []).map((f, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '110px 90px 1fr',
                          padding: '10px 12px',
                          borderBottom: i < (selectedReport.initial_result?.findings || []).length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          fontSize: '12px',
                          alignItems: 'center'
                        }}
                      >
                        <span className="font-mono" style={{ fontWeight: 600 }}>{f.check_id}</span>
                        <span className={`status-tag ${f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'status-tag-danger' : 'status-tag-neutral'}`} style={{ fontSize: '10px', width: 'fit-content' }}>
                          {f.severity}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>{f.evidence}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Section 3: Root Cause & Terraform Remediation */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  3. Root Cause Analysis & Proposed Terraform Fix
                </div>
                <div style={{
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  padding: 12
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 10 }}>
                    <strong>Identified Root Cause:</strong> {selectedReport.remediation?.root_cause || 'Deterministic diagnostic evaluation'}
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Synthesized Terraform HCL Diff
                  </div>
                  <pre className="font-mono" style={{
                    margin: 0,
                    padding: 10,
                    backgroundColor: 'var(--bg-terminal)',
                    color: 'var(--text-terminal)',
                    borderRadius: 4,
                    fontSize: '11.5px',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {selectedReport.remediation?.terraform_diff || '# No remediation diff recorded'}
                  </pre>
                </div>
              </div>

              {/* Section 4: Post-Remediation Recovery Proof */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  4. Post-Remediation Verification Proof
                </div>
                <div style={{
                  backgroundColor: selectedReport.recovery_status === 'recovered' ? 'rgba(71, 119, 100, 0.08)' : 'var(--bg-canvas)',
                  border: selectedReport.recovery_status === 'recovered' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedReport.recovery_status === 'recovered'
                        ? 'Recovery Verified: All Diagnostic Findings Resolved'
                        : 'Recovery Incomplete or Unverified'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: 3 }}>
                      Total checks: {selectedReport.final_result?.total_checks || 0} | Passed: {selectedReport.final_result?.passed || 0} | Failing: {selectedReport.final_result?.failed || 0}
                    </div>
                  </div>
                  <span className={`status-tag ${selectedReport.recovery_status === 'recovered' ? 'status-tag-success' : 'status-tag-neutral'}`}>
                    {selectedReport.recovery_status === 'recovered' ? '100% RECOVERED' : 'UNVERIFIED'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

