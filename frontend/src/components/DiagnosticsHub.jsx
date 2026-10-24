import React, { useState, useEffect } from 'react';
import { runDiagnostics } from '../api/client';

export default function DiagnosticsHub() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [targetHost, setTargetHost] = useState('1.1.1.1');
  const [errorMsg, setErrorMsg] = useState(null);
  const [expandedCheckId, setExpandedCheckId] = useState(null);

  useEffect(() => {
    handleRunDiagnostics();
  }, []);

  const handleRunDiagnostics = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await runDiagnostics({
        forceSimulated: false,
        targetHost
      });
      setReport(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (checkId) => {
    setExpandedCheckId((prev) => (prev === checkId ? null : checkId));
  };

  const filteredFindings = report?.findings.filter((f) => {
    if (filter === 'FAILS') return f.status === 'FAIL' || f.status === 'ERROR';
    if (filter === 'STATIC') return f.source === 'static';
    if (filter === 'AWS') return f.source === 'aws_config';
    if (filter === 'TF') return f.source === 'terraform_cli';
    if (filter === 'LIVE') return f.source === 'live_test';
    return true;
  }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="page-eyebrow">Verification / Automated Audit</div>
          <h1 className="page-title">Diagnostics & health inspection</h1>
          <p className="page-description">
            Empirical validation across CIDR subnetting, AWS route tables, security groups, and live packet reachability.
          </p>
        </div>

        {/* Live probe target and execution button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Probe:</span>
            <input
              type="text"
              className="input-text font-mono"
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              style={{ width: 110, height: 32, fontSize: '12px' }}
              placeholder="1.1.1.1"
            />
          </div>

          <button
            type="button"
            onClick={handleRunDiagnostics}
            disabled={loading}
            className="btn btn-primary"
            style={{ height: 32 }}
          >
            {loading ? 'Evaluating...' : 'Run diagnostics'}
          </button>
        </div>
      </div>

      {/* Open Metrics Strip (No repeated boxed cards) */}
      {report && (
        <div className="metric-strip">
          <div className="metric-cell">
            <div className="metric-label">Total Checks</div>
            <div className="metric-value font-mono">{report.total_checks}</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label" style={{ color: 'var(--status-success)' }}>Passed</div>
            <div className="metric-value font-mono" style={{ color: 'var(--status-success)' }}>
              {report.passed}
            </div>
          </div>
          <div className="metric-cell">
            <div className="metric-label" style={{ color: 'var(--status-error)' }}>Failures</div>
            <div className="metric-value font-mono" style={{ color: report.failed > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>
              {report.failed}
            </div>
          </div>
          <div className="metric-cell">
            <div className="metric-label" style={{ color: 'var(--status-warning)' }}>Warnings</div>
            <div className="metric-value font-mono" style={{ color: report.warnings > 0 ? 'var(--status-warning)' : 'var(--text-muted)' }}>
              {report.warnings}
            </div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Duration</div>
            <div className="metric-value font-mono" style={{ color: 'var(--accent-text)' }}>
              {report.execution_time_seconds}s
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: 'All Checks', count: report?.total_checks },
          { id: 'FAILS', label: 'Failures', count: report?.failed },
          { id: 'STATIC', label: 'Static CIDR' },
          { id: 'AWS', label: 'AWS Config' },
          { id: 'TF', label: 'Terraform CLI' },
          { id: 'LIVE', label: 'TCP Reachability' }
        ].map((tab) => {
          const isSelected = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className="btn btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                height: 28,
                backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                color: isSelected ? 'var(--accent-text)' : 'var(--text-secondary)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                fontWeight: isSelected ? 600 : 500
              }}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className="font-mono" style={{ fontSize: '11px', opacity: 0.8 }}>({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error Message if any */}
      {errorMsg && (
        <div style={{
          padding: '12px 14px',
          backgroundColor: 'var(--status-error-bg)',
          border: '1px solid var(--status-error-border)',
          borderRadius: 5,
          color: 'var(--status-error)',
          fontSize: '12.5px'
        }}>
          Diagnostic execution error: {errorMsg}
        </div>
      )}

      {/* Technical Inspection Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <table className="data-table-clean">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 100 }}>Check ID</th>
              <th>Check Description</th>
              <th style={{ width: 130 }}>Layer / Source</th>
              <th>Empirical Observation</th>
              <th style={{ width: 90, textAlign: 'right' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredFindings.map((finding) => {
              const isPassed = finding.status === 'PASS';
              const isWarning = finding.status === 'WARN';
              const isFailed = finding.status === 'FAIL' || finding.status === 'ERROR';
              const isExpanded = expandedCheckId === finding.check_id;

              return (
                <React.Fragment key={finding.check_id}>
                  <tr
                    onClick={() => toggleExpand(finding.check_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className={`status-tag ${isPassed ? 'status-tag-success' : isWarning ? 'status-tag-warning' : 'status-tag-error'}`}>
                        <span className={`dot-indicator ${isPassed ? 'green' : isWarning ? 'amber' : 'red'}`}></span>
                        {finding.status}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontWeight: 600, fontSize: '12px' }}>
                      {finding.check_id}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {finding.name}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {finding.source}
                    </td>
                    <td style={{ fontSize: '12.5px', color: isPassed ? 'var(--text-secondary)' : 'var(--status-error)' }}>
                      {finding.message}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--accent)', fontWeight: 500 }}>
                        {isExpanded ? 'Hide' : 'Inspect'}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Remediation Drawer */}
                  {isExpanded && (
                    <tr>
                      <td colSpan="6" style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Root Cause & Empirical Evidence
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: 4 }}>
                              {finding.details || finding.message}
                            </div>
                          </div>

                          {finding.remediation && (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                                Recommended Terraform Remediation
                              </div>
                              <pre style={{
                                backgroundColor: 'var(--terminal-bg)',
                                color: 'var(--terminal-text)',
                                padding: '10px 14px',
                                borderRadius: 5,
                                fontSize: '11.5px',
                                fontFamily: 'JetBrains Mono, monospace',
                                whiteSpace: 'pre-wrap',
                                margin: 0
                              }}>
                                {finding.remediation}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
