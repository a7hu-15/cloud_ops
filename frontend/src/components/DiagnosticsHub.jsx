import React, { useState, useEffect } from 'react';
import { runDiagnostics } from '../api/client';

export default function DiagnosticsHub() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [targetHost, setTargetHost] = useState('1.1.1.1');
  const [errorMsg, setErrorMsg] = useState(null);

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

  const filteredFindings = report?.findings.filter((f) => {
    if (filter === 'FAILS') return f.status === 'FAIL' || f.status === 'ERROR';
    if (filter === 'STATIC') return f.source === 'static';
    if (filter === 'AWS') return f.source === 'aws_config';
    if (filter === 'TF') return f.source === 'terraform_cli';
    if (filter === 'LIVE') return f.source === 'live_test';
    return true;
  }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Title & Controls Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Diagnostics Hub & Infrastructure Verification
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 2 }}>
            Run empirical checks across static CIDR rules, local Terraform CLI, AWS configuration, and TCP connectivity.
          </p>
        </div>

        {/* Live probe target and execution button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Probe Target:</span>
            <input
              type="text"
              className="input-control font-mono"
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              style={{ width: 120, height: 32, fontSize: '12px' }}
              placeholder="1.1.1.1"
            />
          </div>

          <button
            onClick={handleRunDiagnostics}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Evaluating Checks...' : 'Run Diagnostics'}
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      {report && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12
        }}>
          <div className="console-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Total Checks
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
              {report.total_checks}
            </div>
          </div>

          <div className="console-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--status-success)', textTransform: 'uppercase' }}>
              Passed
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--status-success)', marginTop: 4 }}>
              {report.passed}
            </div>
          </div>

          <div className="console-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--status-error)', textTransform: 'uppercase' }}>
              Failed / Errors
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--status-error)', marginTop: 4 }}>
              {report.failed}
            </div>
          </div>

          <div className="console-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--status-warning)', textTransform: 'uppercase' }}>
              Warnings
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--status-warning)', marginTop: 4 }}>
              {report.warnings}
            </div>
          </div>

          <div className="console-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Duration
            </div>
            <div className="font-mono" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: 4 }}>
              {report.execution_time_seconds}s
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: 'All Checks' },
          { id: 'FAILS', label: `Failures (${report?.failed || 0})` },
          { id: 'STATIC', label: 'Static CIDR' },
          { id: 'AWS', label: 'AWS Config' },
          { id: 'TF', label: 'Terraform CLI' },
          { id: 'LIVE', label: 'TCP Reachability' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className="btn"
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              backgroundColor: filter === tab.id ? 'var(--accent-primary)' : 'var(--bg-surface)',
              color: filter === tab.id ? '#FFFFFF' : 'var(--text-secondary)',
              borderColor: filter === tab.id ? 'var(--accent-primary)' : 'var(--border-color)',
              borderRadius: 4
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 6,
          backgroundColor: 'var(--status-error-bg)',
          border: '1px solid var(--status-error-border)',
          color: 'var(--status-error)',
          fontSize: '13px'
        }}>
          <strong>Diagnostic Evaluation Error:</strong> {errorMsg}
        </div>
      )}

      {/* Findings List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredFindings.map((finding, idx) => {
          const isPass = finding.status === 'PASS';
          const isFail = finding.status === 'FAIL' || finding.status === 'ERROR';

          return (
            <div
              key={idx}
              className="console-card"
              style={{
                padding: '18px 20px',
                borderLeft: `3.5px solid ${isPass ? 'var(--status-success)' : isFail ? 'var(--status-error)' : 'var(--status-warning)'}`
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="font-mono" style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}>
                    {finding.check_id}
                  </span>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {finding.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="status-pill status-pill-neutral">
                    {finding.source.toUpperCase().replace('_', ' ')}
                  </span>

                  <span className={`status-pill ${
                    finding.severity === 'CRITICAL' || finding.severity === 'HIGH' ? 'status-pill-error' :
                    finding.severity === 'MEDIUM' ? 'status-pill-warning' : 'status-pill-neutral'
                  }`}>
                    {finding.severity}
                  </span>

                  <span className={`status-pill ${
                    isPass ? 'status-pill-success' : isFail ? 'status-pill-error' : 'status-pill-warning'
                  }`}>
                    <span className={`dot ${isPass ? 'dot-success' : isFail ? 'dot-error' : 'dot-warning'}`}></span>
                    {finding.status}
                  </span>
                </div>
              </div>

              {/* Observed Evidence Box */}
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 4,
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-color)',
                fontSize: '12.5px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  OBSERVED EVIDENCE:
                </div>
                <div className="font-mono" style={{ color: isFail ? 'var(--status-error)' : 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {finding.evidence}
                </div>
              </div>

              {/* Actionable Recommendation Box */}
              <div style={{
                marginTop: 8,
                padding: '10px 14px',
                borderRadius: 4,
                backgroundColor: isFail ? 'var(--status-error-bg)' : 'var(--status-success-bg)',
                border: `1px solid ${isFail ? 'var(--status-error-border)' : 'var(--status-success-border)'}`,
                fontSize: '12.5px'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isFail ? 'var(--status-error)' : 'var(--status-success)',
                  marginBottom: 3
                }}>
                  RECOMMENDED REMEDIATION:
                </div>
                <div style={{ color: 'var(--text-primary)' }}>
                  {finding.recommendation}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
