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
      action: 'INITIALIZE',
      exit_code: 0,
      timestamp: new Date().toLocaleTimeString(),
      stdout: 'CloudOps Lab Sandboxed Terraform Engine ready.\nTarget Directory: infrastructure/\nSecurity Controls: Process allowlist active (shell=False), Strict input regex, Destructive confirmation tokens enabled.',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Title & Status Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Terraform Infrastructure Pipeline
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 2 }}>
            Manage the AWS networking lifecycle via allowlisted subprocess execution and safety approval checkpoints.
          </p>
        </div>

        {/* Plan summary badge */}
        {lastPlanSummary && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 12px',
            borderRadius: 6,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            fontSize: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Latest Plan Diff:</span>
            <span className="font-mono" style={{ fontWeight: 600, color: 'var(--status-success)' }}>
              +{lastPlanSummary.to_add} to add
            </span>
            <span className="font-mono" style={{ fontWeight: 600, color: 'var(--status-warning)' }}>
              ~{lastPlanSummary.to_change} to change
            </span>
            <span className="font-mono" style={{ fontWeight: 600, color: 'var(--status-error)' }}>
              -{lastPlanSummary.to_destroy} to destroy
            </span>
          </div>
        )}
      </div>

      {/* Action Pipeline Grid */}
      <div className="console-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Infrastructure Actions
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          {/* Validate */}
          <button
            onClick={handleValidate}
            disabled={loadingAction !== null}
            className="btn btn-secondary"
            style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '12px 14px', height: 'auto' }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>1. Validate Config</div>
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>terraform validate</div>
          </button>

          {/* Plan */}
          <button
            onClick={handlePlan}
            disabled={loadingAction !== null}
            className="btn btn-secondary"
            style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '12px 14px', height: 'auto' }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>2. Review Plan Diff</div>
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>terraform plan</div>
          </button>

          {/* Apply with Safety Confirmation */}
          <button
            onClick={() => { setModalMode('apply'); setConfirmationInput(''); }}
            disabled={loadingAction !== null}
            className="btn btn-primary"
            style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '12px 14px', height: 'auto' }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px' }}>3. Apply Infrastructure</div>
            <div style={{ fontSize: '11px', opacity: 0.85, marginTop: 2 }}>Requires typed confirmation</div>
          </button>

          {/* Destroy with Safety Confirmation */}
          <button
            onClick={() => { setModalMode('destroy'); setConfirmationInput(''); }}
            disabled={loadingAction !== null}
            className="btn btn-danger"
            style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '12px 14px', height: 'auto' }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px' }}>4. Destroy Infrastructure</div>
            <div style={{ fontSize: '11px', opacity: 0.85, marginTop: 2 }}>Safe post-lab teardown</div>
          </button>
        </div>
      </div>

      {/* Terminal Console Card */}
      <div className="console-card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Terraform Execution Log
            </span>
            {loadingAction && (
              <span className="status-pill status-pill-accent" style={{ fontSize: '10px' }}>
                Running {loadingAction}...
              </span>
            )}
          </div>

          <button
            onClick={() => setTerminalLogs([])}
            className="btn btn-secondary"
            style={{ fontSize: '11.5px', padding: '3px 8px' }}
          >
            Clear Log
          </button>
        </div>

        {/* Terminal Body */}
        <div className="terminal-window">
          {terminalLogs.map((log, idx) => {
            const isSuccess = log.exit_code === 0;
            return (
              <div key={idx} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94A3B8', fontSize: '11.5px' }}>
                  <span>[{log.timestamp}]</span>
                  <span style={{ color: isSuccess ? '#38BDF8' : '#F87171', fontWeight: 600 }}>
                    $ terraform {log.action}
                  </span>
                  {log.duration_seconds !== undefined && (
                    <span>({log.duration_seconds}s)</span>
                  )}
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: '10px',
                    fontWeight: 600,
                    backgroundColor: isSuccess ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.2)',
                    color: isSuccess ? '#34D399' : '#F87171'
                  }}>
                    Exit {log.exit_code}
                  </span>
                </div>

                {log.stdout && (
                  <pre style={{
                    color: '#E2E8F0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    marginTop: 4,
                    fontSize: '12px'
                  }}>
                    {log.stdout}
                  </pre>
                )}

                {log.stderr && (
                  <pre style={{
                    color: '#FCA5A5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    marginTop: 4,
                    fontSize: '12px'
                  }}>
                    {log.stderr}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Explicit Safety Confirmation Modal */}
      {modalMode && (
        <div className="modal-overlay">
          <div className="console-card" style={{ maxWidth: 480, width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: modalMode === 'apply' ? 'var(--text-primary)' : 'var(--status-error)'
                }}>
                  {modalMode === 'apply' ? 'Confirm Infrastructure Deployment' : 'Confirm Infrastructure Teardown'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Safety Guardrail Requirement (FR-05, FR-09)
                </p>
              </div>

              <span className={`status-pill ${modalMode === 'apply' ? 'status-pill-accent' : 'status-pill-error'}`}>
                {modalMode === 'apply' ? 'Apply Action' : 'Destructive Action'}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              {modalMode === 'apply'
                ? 'Applying configuration provisions AWS VPC resources, route tables, and security groups. Ensure you have reviewed the planned changes.'
                : 'Destroying configuration will remove all managed AWS resources in the lab workspace to prevent ongoing charges.'}
            </p>

            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-color)',
              marginBottom: 16,
              fontSize: '12.5px'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Type </span>
              <strong className="font-mono" style={{ color: modalMode === 'apply' ? 'var(--accent-primary)' : 'var(--status-error)' }}>
                {modalMode === 'apply' ? 'CONFIRM_APPLY' : 'CONFIRM_DESTROY'}
              </strong>
              <span style={{ color: 'var(--text-secondary)' }}> to authorize execution:</span>
            </div>

            <input
              type="text"
              className="input-control font-mono"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={modalMode === 'apply' ? 'CONFIRM_APPLY' : 'CONFIRM_DESTROY'}
              style={{ marginBottom: 18 }}
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
                {modalMode === 'apply' ? 'Authorize & Apply' : 'Authorize & Destroy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
