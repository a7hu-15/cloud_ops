import React, { useState } from 'react';
import {
  runTerraformValidate,
  runTerraformPlan,
  runTerraformApply,
  runTerraformDestroy
} from '../api/client';

export default function TerraformRunner({ networkPlan }) {
  const [loadingAction, setLoadingAction] = useState(null);
  const [activeStep, setActiveStep] = useState('plan'); // 'validate' | 'plan' | 'apply' | 'destroy'
  const [terminalLogs, setTerminalLogs] = useState([
    {
      action: 'INITIALIZE',
      exit_code: 0,
      timestamp: new Date().toLocaleTimeString(),
      duration_seconds: 0.1,
      stdout: 'CloudOps Lab Sandboxed Terraform Engine ready.\nTarget Directory: infrastructure/\nSecurity Controls: Process allowlist active (shell=False), Strict input regex, Destructive confirmation tokens enabled.',
      stderr: ''
    }
  ]);
  const [lastPlanSummary, setLastPlanSummary] = useState({ to_add: 5, to_change: 0, to_destroy: 0 });

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
    setActiveStep('validate');
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
    setActiveStep('plan');
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
    setActiveStep('apply');
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
    setActiveStep('destroy');
    setModalMode(null);
    try {
      const res = await runTerraformDestroy(confirmationInput);
      appendLog(res);
      setLastPlanSummary({ to_add: 0, to_change: 0, to_destroy: 0 });
    } catch (err) {
      appendLog({ action: 'destroy', exit_code: -1, stdout: '', stderr: err.message, duration_seconds: 0 });
    } finally {
      setLoadingAction(null);
      setConfirmationInput('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="page-eyebrow">Infrastructure as Code / Orchestration</div>
          <h1 className="page-title">Terraform deployment pipeline</h1>
          <p className="page-description">
            Continuous delivery stages for AWS VPC infrastructure with automated syntax validation and diff analysis.
          </p>
        </div>

        {/* Region & Engine Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="status-tag status-tag-neutral font-mono">CLI: terraform v1.9.0</span>
          <span className="status-tag status-tag-neutral">sandbox: shell=False</span>
        </div>
      </div>

      {/* Pipeline Stepper (True deployment workflow structure) */}
      <div className="pipeline-stepper">
        {/* Step 1: Validate */}
        <button
          type="button"
          onClick={handleValidate}
          disabled={loadingAction !== null}
          className={`pipeline-step-btn ${activeStep === 'validate' ? 'active' : ''}`}
        >
          <span className="step-num">1</span>
          <div className="step-meta">
            <span className="step-title">Validation</span>
            <span className="step-cmd">terraform validate</span>
          </div>
        </button>

        {/* Step 2: Plan */}
        <button
          type="button"
          onClick={handlePlan}
          disabled={loadingAction !== null}
          className={`pipeline-step-btn ${activeStep === 'plan' ? 'active' : ''}`}
        >
          <span className="step-num">2</span>
          <div className="step-meta">
            <span className="step-title">Plan Diff</span>
            <span className="step-cmd">terraform plan</span>
          </div>
        </button>

        {/* Step 3: Apply */}
        <button
          type="button"
          onClick={() => setModalMode('apply')}
          disabled={loadingAction !== null}
          className={`pipeline-step-btn ${activeStep === 'apply' ? 'active' : ''}`}
        >
          <span className="step-num">3</span>
          <div className="step-meta">
            <span className="step-title">Apply State</span>
            <span className="step-cmd">terraform apply</span>
          </div>
        </button>

        {/* Step 4: Destroy */}
        <button
          type="button"
          onClick={() => setModalMode('destroy')}
          disabled={loadingAction !== null}
          className={`pipeline-step-btn ${activeStep === 'destroy' ? 'active' : ''}`}
        >
          <span className="step-num">4</span>
          <div className="step-meta">
            <span className="step-title" style={{ color: 'var(--status-error)' }}>Tear Down</span>
            <span className="step-cmd">terraform destroy</span>
          </div>
        </button>
      </div>

      {/* Stage Details & Variable Bindings Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 20 }}>
        {/* Stage Parameters Panel */}
        <div className="panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Execution Target
            </span>
            <span className="status-tag status-tag-neutral font-mono">us-east-1</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Working Directory</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>infrastructure/</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>VPC CIDR Target</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{networkPlan?.vpcCidr || '10.0.0.0/16'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Public Subnet</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{networkPlan?.subnets?.[0]?.cidr || '10.0.1.0/24'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Private Subnet</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{networkPlan?.subnets?.[1]?.cidr || '10.0.2.0/24'}</span>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: 'var(--border-subtle)' }} />

          {/* Quick Action Button for current step */}
          <div>
            {activeStep === 'validate' && (
              <button
                type="button"
                onClick={handleValidate}
                disabled={loadingAction !== null}
                className="btn btn-secondary"
                style={{ width: '100%', height: 34 }}
              >
                {loadingAction === 'validate' ? 'Executing validate...' : 'Run Validation'}
              </button>
            )}
            {activeStep === 'plan' && (
              <button
                type="button"
                onClick={handlePlan}
                disabled={loadingAction !== null}
                className="btn btn-primary"
                style={{ width: '100%', height: 34 }}
              >
                {loadingAction === 'plan' ? 'Calculating Plan Diff...' : 'Run Speculative Plan'}
              </button>
            )}
            {activeStep === 'apply' && (
              <button
                type="button"
                onClick={() => setModalMode('apply')}
                disabled={loadingAction !== null}
                className="btn btn-primary"
                style={{ width: '100%', height: 34 }}
              >
                Apply Changes to AWS
              </button>
            )}
            {activeStep === 'destroy' && (
              <button
                type="button"
                onClick={() => setModalMode('destroy')}
                disabled={loadingAction !== null}
                className="btn btn-danger"
                style={{ width: '100%', height: 34 }}
              >
                Destroy All Resources
              </button>
            )}
          </div>
        </div>

        {/* Plan Diff & Resource Manifest */}
        <div className="panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Speculative Plan Diff Summary
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-tag status-tag-success font-mono">+{lastPlanSummary.to_add} to add</span>
                <span className="status-tag status-tag-warning font-mono">~{lastPlanSummary.to_change} to change</span>
                <span className="status-tag status-tag-error font-mono">-{lastPlanSummary.to_destroy} to destroy</span>
              </div>
            </div>

            {/* List of affected resources */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 10 }}>
              {[
                { name: 'aws_vpc.lab_vpc', type: 'VPC 10.0.0.0/16', op: '+ create' },
                { name: 'aws_subnet.public', type: 'Public Subnet 10.0.1.0/24', op: '+ create' },
                { name: 'aws_subnet.private', type: 'Private Subnet 10.0.2.0/24', op: '+ create' },
                { name: 'aws_internet_gateway.igw', type: 'Internet Gateway', op: '+ create' },
                { name: 'aws_route_table.public', type: '0.0.0.0/0 via igw', op: '+ create' },
                { name: 'aws_security_group.web_sg', type: 'Ingress 80, 443', op: '+ create' }
              ].map((res, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                    fontSize: '11.5px'
                  }}
                >
                  <div className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{res.name}</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{res.type}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 12 }}>
            Terraform plans are generated without state locks in sandboxed dry-run mode.
          </div>
        </div>
      </div>

      {/* Execution Terminal */}
      <div className="terminal-console">
        <div className="terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot-indicator green"></span>
            <span style={{ fontWeight: 600, color: '#E5EAE7' }}>Execution Console</span>
            <span style={{ color: '#88908B' }}>({terminalLogs.length} events logged)</span>
          </div>
          <button
            type="button"
            onClick={() => setTerminalLogs([])}
            style={{
              background: 'none',
              border: 'none',
              color: '#88908B',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Clear output
          </button>
        </div>

        <div className="terminal-body">
          {terminalLogs.map((log, index) => (
            <div key={index} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#88908B', marginBottom: 4, fontSize: '11px' }}>
                <span style={{ color: '#52B788', fontWeight: 600 }}>[{log.timestamp}]</span>
                <span style={{ color: '#E5EAE7' }}>$ terraform {log.action}</span>
                <span style={{
                  padding: '1px 5px',
                  borderRadius: 3,
                  backgroundColor: log.exit_code === 0 ? 'rgba(82, 183, 136, 0.2)' : 'rgba(229, 106, 99, 0.2)',
                  color: log.exit_code === 0 ? '#52B788' : '#E56A63'
                }}>
                  exit {log.exit_code}
                </span>
                {log.duration_seconds > 0 && (
                  <span>({log.duration_seconds}s)</span>
                )}
              </div>

              {log.stdout && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#E5EAE7' }}>
                  {log.stdout}
                </pre>
              )}

              {log.stderr && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#E56A63' }}>
                  {log.stderr}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      {modalMode && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {modalMode === 'apply' ? 'Confirm Infrastructure Deployment' : 'Confirm Infrastructure Deletion'}
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
              {modalMode === 'apply'
                ? 'Applying configuration will create AWS VPC networking resources in your target account. Type CONFIRM_APPLY to proceed.'
                : 'Destroying resources will delete all VPC subnets, route tables, and gateways. Type CONFIRM_DESTROY to proceed.'}
            </p>

            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                className="input-text font-mono"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={modalMode === 'apply' ? 'CONFIRM_APPLY' : 'CONFIRM_DESTROY'}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setModalMode(null);
                  setConfirmationInput('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={modalMode === 'apply' ? executeApply : executeDestroy}
                disabled={confirmationInput !== (modalMode === 'apply' ? 'CONFIRM_APPLY' : 'CONFIRM_DESTROY')}
                className={`btn ${modalMode === 'apply' ? 'btn-primary' : 'btn-danger'}`}
              >
                {modalMode === 'apply' ? 'Execute Apply' : 'Execute Destroy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
