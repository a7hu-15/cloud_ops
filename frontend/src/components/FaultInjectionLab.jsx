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

      // Re-evaluate diagnostics to show the live outcome
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
      title: 'Scenario 1: Missing Inbound HTTPS (Port 443) Security Rule',
      checkId: 'SG-001',
      category: 'Security Group',
      description: 'Simulates omission of port 443 inbound authorization in the web security group.',
      impact: 'Browsers connecting via HTTPS hang and experience connection timeout, while port 80 still succeeds.',
      remediationHcl: 'resource "aws_security_group" "web_sg" {\n  ingress {\n    from_port   = 443\n    to_port     = 443\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}'
    },
    {
      id: 'missing_default_route',
      title: 'Scenario 2: Missing Default Route to Internet Gateway',
      checkId: 'RT-001',
      category: 'Route Table',
      description: 'The Public Route Table lacks a 0.0.0.0/0 route pointing to the attached Internet Gateway.',
      impact: 'Subnet instances cannot route external packets beyond the VPC local boundary (10.0.0.0/16).',
      remediationHcl: 'resource "aws_route" "public_internet_access" {\n  route_table_id         = aws_route_table.public.id\n  destination_cidr_block = "0.0.0.0/0"\n  gateway_id             = aws_internet_gateway.igw.id\n}'
    },
    {
      id: 'igw_detached',
      title: 'Scenario 3: Detached Internet Gateway',
      checkId: 'IGW-001',
      category: 'VPC Gateway',
      description: 'An Internet Gateway exists in the AWS region but is in the detached state and unlinked to the VPC.',
      impact: 'External routing fails; AWS edge cannot translate public IP addresses to internal ENI IPs.',
      remediationHcl: 'resource "aws_internet_gateway" "igw" {\n  vpc_id = aws_vpc.lab_vpc.id\n}'
    },
    {
      id: 'subnet_overlap',
      title: 'Scenario 4: Subnet Overlap Collision',
      checkId: 'CIDR-003',
      category: 'VPC Subnetting',
      description: 'Two subnets in the VPC are allocated overlapping address spaces (e.g. 10.0.1.0/24 and 10.0.1.0/24).',
      impact: 'VPC router cannot resolve conflicting route destinations; creation fails with InvalidSubnet.Conflict.',
      remediationHcl: 'Ensure subnets have mutually disjoint CIDR blocks (e.g., 10.0.1.0/24 and 10.0.2.0/24).'
    },
    {
      id: 'invalid_cidr_boundary',
      title: 'Scenario 5: Host Bits Set in CIDR String',
      checkId: 'CIDR-001',
      category: 'CIDR Math',
      description: 'A host address is supplied instead of a network boundary (e.g. 10.0.1.5/24).',
      impact: 'Terraform and Python ipaddress reject the string as malformed CIDR notation.',
      remediationHcl: 'Zero out the host bits: 10.0.1.0/24.'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Title & Explanation Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Controlled Fault Injection & Recovery Lab
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 2 }}>
          Section 15 Intentional Failure Testing: Simulate common configuration mistakes, inspect diagnostic evidence, and verify recovery.
        </p>
      </div>

      {/* Scenarios List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {scenarios.map((sc) => {
          const isActive = !!activeFaults[sc.id];
          const isLoading = loadingFaultId === sc.id;
          const findings = scenarioReport[sc.id] || [];
          const targetFinding = findings.find((f) => f.check_id === sc.checkId);

          return (
            <div
              key={sc.id}
              className="console-card"
              style={{
                padding: '20px',
                borderLeft: `3.5px solid ${isActive ? 'var(--status-error)' : 'var(--border-color)'}`
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="font-mono" style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}>
                    {sc.checkId}
                  </span>
                  <div>
                    <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sc.title}
                    </h3>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      Category: {sc.category}
                    </div>
                  </div>
                </div>

                {/* State & Action Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`status-pill ${isActive ? 'status-pill-error' : 'status-pill-neutral'}`}>
                    <span className={`dot ${isActive ? 'dot-error' : 'dot-neutral'}`}></span>
                    {isActive ? 'Fault Active' : 'Normal State'}
                  </span>

                  <button
                    onClick={() => handleToggleFault(sc.id, isActive)}
                    disabled={isLoading}
                    className={`btn ${isActive ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ minWidth: 130 }}
                  >
                    {isLoading ? 'Updating...' : isActive ? 'Remediate Fault' : 'Inject Fault'}
                  </button>
                </div>
              </div>

              {/* Technical Description Grid */}
              <div style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
                fontSize: '12.5px'
              }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Failure Mechanism:</span>
                  <p style={{ color: 'var(--text-primary)', marginTop: 2 }}>{sc.description}</p>
                </div>

                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--status-warning)' }}>Expected Workload Impact:</span>
                  <p style={{ color: 'var(--text-primary)', marginTop: 2 }}>{sc.impact}</p>
                </div>
              </div>

              {/* Diagnostic Finding Callout */}
              {targetFinding && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 4,
                  backgroundColor: targetFinding.status === 'FAIL' ? 'var(--status-error-bg)' : 'var(--status-success-bg)',
                  border: `1px solid ${targetFinding.status === 'FAIL' ? 'var(--status-error-border)' : 'var(--status-success-border)'}`,
                  fontSize: '12.5px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: targetFinding.status === 'FAIL' ? 'var(--status-error)' : 'var(--status-success)' }}>
                      Diagnostic Verification: {targetFinding.status}
                    </span>
                    <span className="status-pill status-pill-neutral" style={{ fontSize: '10px' }}>
                      {targetFinding.severity}
                    </span>
                  </div>
                  <div className="font-mono" style={{ color: 'var(--text-primary)', fontSize: '12px' }}>
                    {targetFinding.evidence}
                  </div>
                </div>
              )}

              {/* Remediation Pattern */}
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Terraform Infrastructure Remediation:
                </span>
                <pre className="font-mono" style={{
                  marginTop: 4,
                  padding: '8px 12px',
                  borderRadius: 4,
                  backgroundColor: '#1E2430',
                  color: '#93C5FD',
                  fontSize: '11.5px',
                  overflowX: 'auto',
                  lineHeight: 1.5
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
