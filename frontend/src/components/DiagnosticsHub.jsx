import React, { useState, useEffect } from 'react';
import { runDiagnostics } from '../api/client';

export default function DiagnosticsHub() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'FAILS' | 'STATIC' | 'AWS' | 'TF' | 'LIVE'
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
        forceSimulated: false, // Auto-detect live AWS credentials, fallback to simulated
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Controls Bar */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              Step 3: Multi-Tier Diagnostic Findings & Troubleshooting Hub
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Inspect live AWS API responses, Terraform configurations, and static CIDR boundaries with structured evidence.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>CONN-001 Target:</span>
              <input
                type="text"
                className="input-field font-mono"
                value={targetHost}
                onChange={(e) => setTargetHost(e.target.value)}
                style={{ width: 130, padding: '6px 10px', fontSize: '0.8rem' }}
                placeholder="1.1.1.1"
              />
            </div>

            <button
              onClick={handleRunDiagnostics}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Evaluating Checks...' : '⚡ Run Diagnostic Suite'}
            </button>
          </div>
        </div>

        {/* Report Metric Cards */}
        {report && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginTop: 20
          }}>
            <div style={{ padding: '14px 18px', background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL CHECKS</div>
              <div className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>
                {report.total_checks}
              </div>
            </div>

            <div style={{ padding: '14px 18px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: '#34d399' }}>PASSED</div>
              <div className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399' }}>
                {report.passed}
              </div>
            </div>

            <div style={{ padding: '14px 18px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: '#f87171' }}>FAILED / ERRORS</div>
              <div className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f87171' }}>
                {report.failed}
              </div>
            </div>

            <div style={{ padding: '14px 18px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: '#fbbf24' }}>WARNINGS</div>
              <div className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24' }}>
                {report.warnings}
              </div>
            </div>

            <div style={{ padding: '14px 18px', background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EXECUTION TIME</div>
              <div className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {report.execution_time_seconds}s
              </div>
            </div>
          </div>
        )}

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Checks' },
            { id: 'FAILS', label: `Failures Only (${report?.failed || 0})` },
            { id: 'STATIC', label: 'Static CIDRs' },
            { id: 'AWS', label: 'AWS Config' },
            { id: 'TF', label: 'Terraform CLI' },
            { id: 'LIVE', label: 'Live Connectivity' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.78rem',
                background: filter === tab.id ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.05)',
                color: filter === tab.id ? '#050a14' : 'var(--text-secondary)',
                fontWeight: filter === tab.id ? 700 : 500,
                borderRadius: 20
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
          <strong>Error executing diagnostics:</strong> {errorMsg}
        </div>
      )}

      {/* Findings Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredFindings.map((finding, idx) => {
          const isPass = finding.status === 'PASS';
          const isFail = finding.status === 'FAIL' || finding.status === 'ERROR';
          const isWarning = finding.status === 'WARNING';

          return (
            <div
              key={idx}
              className="glass-panel"
              style={{
                padding: '20px 24px',
                borderLeft: `4px solid ${isPass ? 'var(--accent-emerald)' : isFail ? 'var(--accent-rose)' : 'var(--accent-amber)'}`
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge badge-cyan font-mono" style={{ fontSize: '0.75rem' }}>
                    {finding.check_id}
                  </span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                    {finding.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.7rem'
                  }}>
                    {finding.source.toUpperCase()}
                  </span>

                  <span className={`badge ${
                    finding.severity === 'CRITICAL' || finding.severity === 'HIGH' ? 'badge-rose' :
                    finding.severity === 'MEDIUM' ? 'badge-amber' : 'badge-cyan'
                  }`} style={{ fontSize: '0.7rem' }}>
                    {finding.severity}
                  </span>

                  <span className={`badge ${isPass ? 'badge-emerald' : isFail ? 'badge-rose' : 'badge-amber'}`}>
                    {finding.status}
                  </span>
                </div>
              </div>

              {/* Observed Evidence */}
              <div style={{
                marginTop: 14,
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.84rem'
              }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  OBSERVED EVIDENCE:
                </div>
                <div className="font-mono" style={{ color: isFail ? '#fca5a5' : '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                  {finding.evidence}
                </div>
              </div>

              {/* Recommendation */}
              <div style={{
                marginTop: 10,
                padding: '12px 16px',
                borderRadius: 8,
                background: isFail ? 'rgba(244, 63, 94, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                border: `1px solid ${isFail ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                fontSize: '0.84rem'
              }}>
                <div style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: isFail ? '#fb7185' : '#34d399',
                  marginBottom: 4
                }}>
                  RECOMMENDED ACTION:
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
