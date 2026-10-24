import React, { useState } from 'react';
import {
  runTerraformValidate,
  runTerraformPlan,
  runTerraformApply,
  runTerraformDestroy
} from '../api/client';

export default function TerraformRunner({ networkPlan }) {
  const [loadingAction, setLoadingAction] = useState(null);
  const [terminalLogs, setTerminalLogs] = useState([
    {
      action: 'SYSTEM_READY',
      exit_code: 0,
      timestamp: new Date().toLocaleTimeString(),
      stdout: 'CloudOps Lab Sandboxed Terraform Engine initialized.\nInfrastructure directory: infrastructure/\nSecurity controls: Strict Process Allowlist, No shell=True, Manual Confirmation Guardrails enabled.',
      stderr: ''
    }
  ]);
  const [lastPlanSummary, setLastPlanSummary] = useState(null);

  // Safety Modal state
  const [modalMode, setModalMode] = useState(null); // 'apply' | 'destroy' | null
  const [confirmationInput, setConfirmationInput] = useState('');

  const appendLog = (res) => {
    setTerminalLogs((prev) => [
      ...prev,
      {
        ...res,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const handleValidate = async () => {
    setLoadingAction('validate');
    try {
      const res = await runTerraformValidate();
      appendLog(res);
    } catch (err) {
      appendLog({ action: 'validate', exit_code: -1, stdout: '', stderr: err.message, duration_seconds: 0 });
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePlan = async () => {
    setLoadingAction('plan');
    try {
      const variables = networkPlan ? {
        vpc_cidr: networkPlan.vpcCidr,
        public_subnet_cidr: networkPlan.subnets[0]?.cidr || '10.0.1.0/24',
        private_subnet_cidr: networkPlan.subnets[1]?.cidr || '10.0.2.0/24'
      } : null;

      const res = await runTerraformPlan(variables);
      appendLog(res);
      if (res.summary) {
        setLastPlanSummary(res.summary);
      }
    } catch (err) {
      appendLog({ action: 'plan', exit_code: -1, stdout: '', stderr: err.message, duration_seconds: 0 });
    } finally {
      setLoadingAction(null);
    }
  };

  const executeApply = async () => {
    setLoadingAction('apply');
    setModalMode(null);
    try {
      const variables = networkPlan ? {
        vpc_cidr: networkPlan.vpcCidr,
        public_subnet_cidr: networkPlan.subnets[0]?.cidr || '10.0.1.0/24',
        private_subnet_cidr: networkPlan.subnets[1]?.cidr || '10.0.2.0/24'
      } : null;

      const res = await runTerraformApply(confirmationInput, variables);
      appendLog(res);
    } catch (err) {
      appendLog({ action: 'apply', exit_code: -1, stdout: '', stderr: err.message, duration_seconds: 0 });
    } finally {
      setLoadingAction(null);
      setConfirmationInput('');
    }
  };

  const executeDestroy = async () => {
    setLoadingAction('destroy');
    setModalMode(null);
    try {
      const res = await runTerraformDestroy(confirmationInput);
      appendLog(res);
      setLastPlanSummary(null);
    } catch (err) {
      appendLog({ action: 'destroy', exit_code: -1, stdout: '', stderr: err.message, duration_seconds: 0 });
    } finally {
      setLoadingAction(null);
      setConfirmationInput('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Workflow Navigation & Safety Warnings */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              Step 2: Controlled Terraform Infrastructure Workflows
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Execute declarative infrastructure operations through strict process allowlists and explicit safety approvals.
            </p>
          </div>

          {/* Plan Summary Badge if available */}
          {lastPlanSummary && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 16px',
              borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Latest Plan:</span>
              <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.85rem' }}>+{lastPlanSummary.to_add} to add</span>
              <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem' }}>~{lastPlanSummary.to_change} to change</span>
              <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>-{lastPlanSummary.to_destroy} to destroy</span>
            </div>
          )}
        </div>

        {/* Workflow Action Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginTop: 20
        }}>
          {/* Validate */}
          <button
            onClick={handleValidate}
            disabled={loadingAction !== null}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px 18px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>🧪</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>1. Validate Config</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>terraform validate</div>
            </div>
          </button>

          {/* Plan */}
          <button
            onClick={handlePlan}
            disabled={loadingAction !== null}
            className="btn btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '14px 18px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>📋</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>2. Review Plan</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>terraform plan</div>
            </div>
          </button>

          {/* Apply with Safety Guardrail */}
          <button
            onClick={() => { setModalMode('apply'); setConfirmationInput(''); }}
            disabled={loadingAction !== null}
            className="btn btn-primary"
            style={{ justifyContent: 'flex-start', padding: '14px 18px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>🚀</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>3. Apply Infrastructure</div>
              <div style={{ fontSize: '0.72rem', color: '#0f172a' }}>Requires explicit confirmation</div>
            </div>
          </button>

          {/* Destroy with Safety Guardrail */}
          <button
            onClick={() => { setModalMode('destroy'); setConfirmationInput(''); }}
            disabled={loadingAction !== null}
            className="btn btn-danger"
            style={{ justifyContent: 'flex-start', padding: '14px 18px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>🗑️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>4. Destroy Infrastructure</div>
              <div style={{ fontSize: '0.72rem', color: '#fecaca' }}>Prevents unexpected charges</div>
            </div>
          </button>
        </div>
      </div>

      {/* Terminal / Live Console Log */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {/* Terminal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'rgba(5, 8, 15, 0.95)',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></div>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }}></div>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }}></div>
            </div>
            <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Terraform Safe Execution Console {loadingAction && `[Running ${loadingAction}...]`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setTerminalLogs([])}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Clear Console
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div style={{
          padding: '18px',
          background: '#060911',
          minHeight: 280,
          maxHeight: 450,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          lineHeight: 1.6
        }}>
          {terminalLogs.map((log, idx) => {
            const isSuccess = log.exit_code === 0;
            return (
              <div key={idx} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  <span>[{log.timestamp}]</span>
                  <span style={{
                    color: isSuccess ? 'var(--accent-cyan)' : 'var(--accent-rose)',
                    fontWeight: 700
                  }}>
                    $ terraform {log.action}
                  </span>
                  {log.duration_seconds !== undefined && (
                    <span>({log.duration_seconds}s)</span>
                  )}
                  <span className={`badge ${isSuccess ? 'badge-emerald' : 'badge-rose'}`} style={{ fontSize: '0.62rem' }}>
                    EXIT {log.exit_code}
                  </span>
                </div>

                {log.stdout && (
                  <pre style={{
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    marginTop: 6
                  }}>
                    {log.stdout}
                  </pre>
                )}

                {log.stderr && (
                  <pre style={{
                    color: '#f87171',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    marginTop: 6
                  }}>
                    {log.stderr}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Confirmation Modal (Apply or Destroy) */}
      {modalMode && (
        <div className="modal-overlay">
          <div className="glass-panel" style={{
            maxWidth: 520,
            width: '100%',
            padding: '28px',
            background: '#0c101d',
            border: `1px solid ${modalMode === 'apply' ? 'var(--accent-cyan)' : 'var(--accent-rose)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: '1.8rem' }}>{modalMode === 'apply' ? '🛡️' : '⚠️'}</span>
              <div>
                <h3 className="font-display" style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: modalMode === 'apply' ? '#fff' : '#f87171'
                }}>
                  {modalMode === 'apply' ? 'Explicit Approval Required for Apply' : 'Teardown Confirmation Required'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  CloudOps Lab Operational Safety Guardrail (FR-05, FR-09)
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              {modalMode === 'apply'
                ? 'Applying infrastructure will provision AWS networking resources (VPC, subnets, route tables, and security groups). Please review your plan diff before proceeding.'
                : 'Destroying infrastructure will permanently remove all lab resources to ensure zero lingering costs.'}
            </p>

            <div style={{
              padding: '12px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.4)',
              marginBottom: 16,
              fontSize: '0.82rem'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>To proceed, type the confirmation phrase: </span>
              <strong className="font-mono" style={{ color: modalMode === 'apply' ? 'var(--accent-cyan)' : 'var(--accent-rose)' }}>
                {modalMode === 'apply' ? 'CONFIRM_APPLY' : 'CONFIRM_DESTROY'}
              </strong>
            </div>

            <input
              type="text"
              className="input-field"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={`Type ${modalMode === 'apply' ? 'CONFIRM_APPLY' : 'CONFIRM_DESTROY'}`}
              style={{ marginBottom: 20 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setModalMode(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={modalMode === 'apply' ? executeApply : executeDestroy}
                disabled={confirmationInput !== (modalMode === 'apply' ? 'CONFIRM_APPLY' : 'CONFIRM_DESTROY')}
                className={`btn ${modalMode === 'apply' ? 'btn-primary' : 'btn-danger'}`}
              >
                {modalMode === 'apply' ? 'Approve & Apply' : 'Confirm Teardown'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
