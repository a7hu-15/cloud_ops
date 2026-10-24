import React, { useState, useEffect } from 'react';
import { toggleSimulatedFault, getLabStatus, runDiagnostics } from '../api/client';

export default function FaultInjectionLab({ onFaultsChanged }) {
  const [activeFaults, setActiveFaults] = useState({});
  const [loadingFaultId, setLoadingFaultId] = useState(null);
  const [scenarioReport, setScenarioReport] = useState({});

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await getLabStatus();
      setActiveFaults(res.active_faults || {});
      if (onFaultsChanged) {
        const count = Object.values(res.active_faults || {}).filter(Boolean).length;
        onFaultsChanged(count);
      }
    } catch (err) {
      console.error('Failed to load lab status', err);
    }
  };

  const handleToggleFault = async (faultId, currentVal) => {
    setLoadingFaultId(faultId);
    try {
      const res = await toggleSimulatedFault(faultId, !currentVal);
      setActiveFaults(res.active_faults);
      if (onFaultsChanged) {
        const count = Object.values(res.active_faults).filter(Boolean).length;
        onFaultsChanged(count);
      }

      // Re-evaluate diagnostics to show live test result
      const diagRes = await runDiagnostics({ forceSimulated: true });
      setScenarioReport((prev) => ({
        ...prev,
        [faultId]: diagRes.findings
      }));
    } catch (err) {
      alert(`Error toggling fault: ${err.message}`);
    } finally {
      setLoadingFaultId(null);
    }
  };

  const resetAllFaults = async () => {
    for (const sc of scenarios) {
      if (activeFaults[sc.id]) {
        await toggleSimulatedFault(sc.id, false);
      }
    }
    loadStatus();
  };

  const scenarios = [
    {
      code: 'EXP-01',
      id: 'sg_missing_https',
      title: 'Omit Inbound HTTPS Authorization (Port 443)',
      checkId: 'SG-001',
      layer: 'Layer 4 / Stateful Security Group',
      hypothesis: 'Web clients requesting https:// domain will hang indefinitely until connection timeout, while http:// still succeeds.',
      signature: 'Diagnostics check SG-001 detects missing 443 ingress rule.',
      remediation: 'resource "aws_security_group" "web_sg" {\n  ingress {\n    from_port   = 443\n    to_port     = 443\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}'
    },
    {
      code: 'EXP-02',
      id: 'missing_default_route',
      title: 'Sever Default Route to Internet Gateway',
      checkId: 'RT-001',
      layer: 'Layer 3 / Route Table Propagation',
      hypothesis: 'Subnet instances lose egress path beyond the local VPC (10.0.0.0/16); packets to external IPs are discarded.',
      signature: 'Diagnostics check RT-001 fails with Missing 0.0.0.0/0 route.',
      remediation: 'resource "aws_route" "public_internet_access" {\n  route_table_id         = aws_route_table.public.id\n  destination_cidr_block = "0.0.0.0/0"\n  gateway_id             = aws_internet_gateway.igw.id\n}'
    },
    {
      code: 'EXP-03',
      id: 'igw_detached',
      title: 'Detach Internet Gateway from VPC',
      checkId: 'IGW-001',
      layer: 'VPC Edge Gateway',
      hypothesis: 'Internet Gateway enters detached state; public IPv4 addresses assigned to instances fail to translate at edge.',
      signature: 'Diagnostics check IGW-001 trips with IGW detached state.',
      remediation: 'resource "aws_internet_gateway" "igw" {\n  vpc_id = aws_vpc.lab_vpc.id\n}'
    },
    {
      code: 'EXP-04',
      id: 'subnet_overlap',
      title: 'Subnet CIDR Address Space Collision',
      checkId: 'CIDR-003',
      layer: 'IPv4 Address Planning',
      hypothesis: 'Two subnets configured with overlapping prefixes cause route table lookup conflicts.',
      signature: 'Terraform plan rejects with InvalidSubnet.Conflict.',
      remediation: 'Allocate disjoint CIDR blocks: public 10.0.1.0/24, private 10.0.2.0/24.'
    },
    {
      code: 'EXP-05',
      id: 'invalid_cidr_boundary',
      title: 'Non-Zero Host Bits in Network Specification',
      checkId: 'CIDR-001',
      layer: 'CIDR Mathematics',
      hypothesis: 'Supplying a host address (e.g. 10.0.1.5/24) causes Python ipaddress and Terraform to reject CIDR parsing.',
      signature: 'Diagnostics check CIDR-001 trips with host bits set.',
      remediation: 'Zero out the host bits: 10.0.1.0/24.'
    }
  ];

  const activeCount = Object.values(activeFaults).filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="page-eyebrow">Chaos Engineering / Resiliency Audit</div>
          <h1 className="page-title">Controlled fault injection lab</h1>
          <p className="page-description">
            Simulate realistic AWS networking mistakes, inspect automated detection signatures, and verify remediation.
          </p>
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={resetAllFaults}
            className="btn btn-secondary"
            style={{ height: 32 }}
          >
            Reset all to normal
          </button>
        )}
      </div>

      {/* Metrics Ribbon */}
      <div className="metric-strip">
        <div className="metric-cell">
          <div className="metric-label">Active Experiments</div>
          <div className="metric-value font-mono" style={{ color: activeCount > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
            {activeCount} Active
          </div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Scenario Runbooks</div>
          <div className="metric-value font-mono">
            {scenarios.length} Available
          </div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Automated Detection</div>
          <div className="metric-value font-mono" style={{ color: 'var(--accent-text)' }}>
            Continuous
          </div>
        </div>
      </div>

      {/* Experiment Runbooks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {scenarios.map((sc) => {
          const isActive = !!activeFaults[sc.id];
          const isLoading = loadingFaultId === sc.id;
          const findings = scenarioReport[sc.id] || [];
          const targetFinding = findings.find((f) => f.check_id === sc.checkId);

          return (
            <div
              key={sc.id}
              className="panel"
              style={{
                padding: '18px 20px',
                borderLeft: `3px solid ${isActive ? 'var(--status-error)' : 'var(--border-color)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              {/* Top Row: Experiment Code, Title, Layer, and Toggle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="font-mono" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {sc.code}
                    </span>
                    <span className="status-tag status-tag-neutral font-mono" style={{ fontSize: '10.5px' }}>
                      {sc.checkId}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sc.title}
                    </h3>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                      {sc.layer}
                    </div>
                  </div>
                </div>

                {/* State Tag & Toggle Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`status-tag ${isActive ? 'status-tag-error' : 'status-tag-neutral'}`}>
                    <span className={`dot-indicator ${isActive ? 'red' : 'grey'}`}></span>
                    {isActive ? 'Fault Active' : 'Normal State'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggleFault(sc.id, isActive)}
                    disabled={isLoading}
                    className={`btn ${isActive ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ height: 30, fontSize: '12px', minWidth: 100 }}
                  >
                    {isLoading ? 'Updating...' : isActive ? 'Restore Normal' : 'Inject Fault'}
                  </button>
                </div>
              </div>

              {/* Hypothesis & Detection Signature */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12,
                backgroundColor: 'var(--bg-surface-subtle)',
                padding: '12px 14px',
                borderRadius: 5,
                fontSize: '12px'
              }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.04em' }}>
                    Hypothesis & Expected Impact:
                  </span>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 3 }}>
                    {sc.hypothesis}
                  </div>
                </div>

                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '10.5px', letterSpacing: '0.04em' }}>
                    Detection Signature:
                  </span>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 3 }}>
                    {sc.signature}
                  </div>
                </div>
              </div>

              {/* Live Detection Finding if Fault is Active */}
              {isActive && targetFinding && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--status-error-bg)',
                  border: '1px solid var(--status-error-border)',
                  borderRadius: 5,
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--status-error)', marginBottom: 2 }}>
                    Live Empirical Detection ({targetFinding.check_id})
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>{targetFinding.message}</div>
                </div>
              )}

              {/* Remediation Snippet */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Remediation Specification:
                </span>
                <pre style={{
                  backgroundColor: 'var(--terminal-bg)',
                  color: 'var(--terminal-text)',
                  padding: '10px 14px',
                  borderRadius: 5,
                  fontSize: '11.5px',
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'pre-wrap',
                  margin: '4px 0 0 0'
                }}>
                  {sc.remediation}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
