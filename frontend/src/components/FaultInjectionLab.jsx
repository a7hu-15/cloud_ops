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

      // Immediately run the relevant check to show the student the live finding!
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

  const scenarios = [
    {
      id: 'sg_missing_https',
      title: 'Scenario 1: Missing Inbound HTTPS (Port 443) Rule',
      checkId: 'SG-001',
      category: 'Security Group',
      description: 'Simulates an accidental deletion or omission of port 443 inbound authorization in cloudops-lab-web-sg.',
      impact: 'Browsers connecting via HTTPS hang and experience ERR_CONNECTION_TIMED_OUT, while HTTP port 80 still succeeds.',
      remediationHcl: 'resource "aws_security_group" "web_sg" {\n  ingress {\n    from_port = 443\n    to_port   = 443\n    protocol  = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}'
    },
    {
      id: 'missing_default_route',
      title: 'Scenario 2: Missing Default Route to Internet Gateway',
      checkId: 'RT-001',
      category: 'Route Table',
      description: 'The Public Route Table lacks a default route pointing 0.0.0.0/0 to the attached Internet Gateway.',
      impact: 'Instances in the subnet cannot initiate or receive traffic outside the local 10.0.0.0/16 VPC boundary.',
      remediationHcl: 'resource "aws_route" "public_internet_access" {\n  route_table_id         = aws_route_table.public.id\n  destination_cidr_block = "0.0.0.0/0"\n  gateway_id             = aws_internet_gateway.igw.id\n}'
    },
    {
      id: 'igw_detached',
      title: 'Scenario 3: Detached Internet Gateway',
      checkId: 'IGW-001',
      category: 'VPC Gateway',
      description: 'An Internet Gateway exists in the AWS account but is in the detached state and not associated with the VPC.',
      impact: 'All external internet routing fails; AWS edge cannot map public IP addresses to instance private IPs.',
      remediationHcl: 'resource "aws_internet_gateway" "igw" {\n  vpc_id = aws_vpc.lab_vpc.id\n}'
    },
    {
      id: 'subnet_overlap',
      title: 'Scenario 4: Subnet Overlap Collision',
      checkId: 'CIDR-003',
      category: 'VPC Subnetting',
      description: 'Two subnets in the VPC are allocated overlapping IPv4 ranges (e.g. 10.0.1.0/24 and 10.0.1.0/24).',
      impact: 'VPC router routing table cannot resolve duplicate address spaces. Subnet creation fails in AWS.',
      remediationHcl: 'Ensure every subnet has a distinct, mutually disjoint CIDR range (e.g., 10.0.1.0/24 and 10.0.2.0/24).'
    },
    {
      id: 'invalid_cidr_boundary',
      title: 'Scenario 5: Host Bits Set in CIDR String',
      checkId: 'CIDR-001',
      category: 'CIDR Math',
      description: 'User enters a host address instead of a network boundary (e.g. 10.0.1.5/24 instead of 10.0.1.0/24).',
      impact: 'Terraform and Python ipaddress reject the string as malformed strict CIDR notation.',
      remediationHcl: 'Zero out the host bits: 10.0.1.0/24.'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overview Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
          Step 4: Controlled Misconfiguration & Recovery Lab (Section 15)
        </h2>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          Inject common real-world networking misconfigurations into the lab, run diagnostics to capture empirical evidence,
          and verify recovery upon remediation.
        </p>
      </div>

      {/* Scenarios Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {scenarios.map((sc) => {
          const isActive = !!activeFaults[sc.id];
          const isLoading = loadingFaultId === sc.id;
          const findings = scenarioReport[sc.id] || [];
          const targetFinding = findings.find((f) => f.check_id === sc.checkId);

          return (
            <div
              key={sc.id}
              className="glass-panel"
              style={{
                padding: '24px',
                border: isActive ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-card)',
                background: isActive ? 'rgba(30, 18, 25, 0.7)' : 'var(--bg-card)'
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.5rem' }}>{isActive ? '💥' : '🛡️'}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: isActive ? '#fca5a5' : '#fff' }}>
                        {sc.title}
                      </h3>
                      <span className="badge badge-cyan font-mono" style={{ fontSize: '0.7rem' }}>
                        {sc.checkId}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Category: {sc.category}
                    </span>
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  onClick={() => handleToggleFault(sc.id, isActive)}
                  disabled={isLoading}
                  className={`btn ${isActive ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ minWidth: 150 }}
                >
                  {isLoading ? 'Updating...' : isActive ? '✕ Remediate Fault' : '⚡ Inject Fault'}
                </button>
              </div>

              {/* Description & Impact */}
              <div style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
                fontSize: '0.82rem'
              }}>
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Mechanism:</strong>
                  <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>{sc.description}</p>
                </div>

                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                  <strong style={{ color: '#fbbf24' }}>User-Facing Impact:</strong>
                  <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>{sc.impact}</p>
                </div>
              </div>

              {/* Live Finding Callout if evaluated */}
              {targetFinding && (
                <div style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: targetFinding.status === 'FAIL' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  border: `1px solid ${targetFinding.status === 'FAIL' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  fontSize: '0.82rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ color: targetFinding.status === 'FAIL' ? '#f87171' : '#34d399' }}>
                      Diagnostic Result: {targetFinding.status}
                    </strong>
                    <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>{targetFinding.severity}</span>
                  </div>
                  <div className="font-mono" style={{ color: '#e2e8f0', fontSize: '0.78rem' }}>
                    {targetFinding.evidence}
                  </div>
                </div>
              )}

              {/* Remediation Code Snippet */}
              <div style={{ marginTop: 14 }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Terraform Remediation Pattern:
                </span>
                <pre className="font-mono" style={{
                  marginTop: 4,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(5, 8, 15, 0.8)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem',
                  color: '#38bdf8',
                  overflowX: 'auto'
                }}>
                  {sc.remediationHcl}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
