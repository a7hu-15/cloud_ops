import React, { useState, useEffect } from 'react';
import { validateNetwork } from '../api/client';

export default function NetworkPlanner({ onPlanApproved }) {
  const [vpcCidr, setVpcCidr] = useState('10.0.0.0/16');
  const [subnets, setSubnets] = useState([
    { name: 'public-subnet', cidr: '10.0.1.0/24' },
    { name: 'private-subnet', cidr: '10.0.2.0/24' }
  ]);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showAddressTable, setShowAddressTable] = useState(true);

  useEffect(() => {
    handleValidate();
  }, []);

  const handleSubnetChange = (index, field, value) => {
    const updated = [...subnets];
    updated[index][field] = value;
    setSubnets(updated);
  };

  const addSubnet = () => {
    const nextIdx = subnets.length + 1;
    setSubnets([...subnets, { name: `subnet-${nextIdx}`, cidr: `10.0.${nextIdx}.0/24` }]);
  };

  const removeSubnet = (index) => {
    if (subnets.length <= 1) return;
    setSubnets(subnets.filter((_, i) => i !== index));
  };

  const handleValidate = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await validateNetwork(vpcCidr, subnets);
      setValidationResult(res);
      if (res.is_valid && onPlanApproved) {
        onPlanApproved({ vpcCidr, subnets, result: res });
      }
    } catch (err) {
      setErrorMsg(err.message);
      setValidationResult(null);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetName) => {
    if (presetName === 'standard') {
      setVpcCidr('10.0.0.0/16');
      setSubnets([
        { name: 'public-subnet', cidr: '10.0.1.0/24' },
        { name: 'private-subnet', cidr: '10.0.2.0/24' }
      ]);
    } else if (presetName === 'overlap') {
      setVpcCidr('10.0.0.0/16');
      setSubnets([
        { name: 'web-tier-a', cidr: '10.0.1.0/24' },
        { name: 'web-tier-b', cidr: '10.0.1.128/25' }
      ]);
    } else if (presetName === 'outside') {
      setVpcCidr('10.0.0.0/16');
      setSubnets([
        { name: 'public-subnet', cidr: '10.0.1.0/24' },
        { name: 'external-subnet', cidr: '192.168.10.0/24' }
      ]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Title & Actions Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Network Address Planning & Validation
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 2 }}>
            Define VPC and subnet CIDR blocks, verify boundary containment, and audit AWS 5-reserved address capacity.
          </p>
        </div>

        {/* Presets and validation button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Presets:</span>
          <button
            onClick={() => applyPreset('standard')}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            Standard Two-Tier
          </button>
          <button
            onClick={() => applyPreset('overlap')}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            Subnet Overlap (Fault)
          </button>
          <button
            onClick={() => applyPreset('outside')}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            Subnet Outside VPC (Fault)
          </button>
          <button
            onClick={handleValidate}
            disabled={loading}
            className="btn btn-primary"
            style={{ marginLeft: 6 }}
          >
            {loading ? 'Validating...' : 'Validate Configuration'}
          </button>
        </div>
      </div>

      {/* Main Form & Configuration Card */}
      <div className="console-card" style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* VPC CIDR Input */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              VPC IPv4 CIDR BLOCK
            </label>
            <input
              type="text"
              className="input-control"
              value={vpcCidr}
              onChange={(e) => setVpcCidr(e.target.value)}
              placeholder="10.0.0.0/16"
            />
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 4 }}>
              AWS requires a prefix length between /16 and /28 (RFC 1918 private range recommended).
            </div>
          </div>

          {/* Subnet Inputs */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                SUBNET DEFINITIONS ({subnets.length})
              </label>
              <button
                onClick={addSubnet}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                + Add Subnet
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subnets.map((sub, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-control"
                    style={{ flex: 1 }}
                    value={sub.name}
                    onChange={(e) => handleSubnetChange(idx, 'name', e.target.value)}
                    placeholder="Subnet Identifier"
                  />
                  <input
                    type="text"
                    className="input-control"
                    style={{ flex: 1.2 }}
                    value={sub.cidr}
                    onChange={(e) => handleSubnetChange(idx, 'cidr', e.target.value)}
                    placeholder="e.g. 10.0.1.0/24"
                  />
                  {subnets.length > 1 && (
                    <button
                      onClick={() => removeSubnet(idx)}
                      className="btn btn-secondary"
                      style={{ padding: '0 10px', height: 36, color: 'var(--status-error)' }}
                      title="Remove subnet"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Validation Result Notification */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 6,
          backgroundColor: 'var(--status-error-bg)',
          border: '1px solid var(--status-error-border)',
          color: 'var(--status-error)',
          fontSize: '13px'
        }}>
          <strong>Validation Exception:</strong> {errorMsg}
        </div>
      )}

      {validationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status Bar */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 6,
            backgroundColor: validationResult.is_valid ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
            border: `1px solid ${validationResult.is_valid ? 'var(--status-success-border)' : 'var(--status-error-border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`status-pill ${validationResult.is_valid ? 'status-pill-success' : 'status-pill-error'}`}>
                {validationResult.is_valid ? 'Valid Configuration' : 'Validation Failed'}
              </span>
              <span style={{ fontSize: '13px', color: validationResult.is_valid ? 'var(--status-success)' : 'var(--status-error)', fontWeight: 500 }}>
                {validationResult.is_valid
                  ? `VPC ${validationResult.vpc_cidr} encompasses ${validationResult.vpc_total_ips.toLocaleString()} total IPv4 addresses.`
                  : `${validationResult.errors.length} configuration error(s) must be resolved.`}
              </span>
            </div>

            {validationResult.is_valid && (
              <span className="status-pill status-pill-neutral">
                RFC 1918 Standard
              </span>
            )}
          </div>

          {/* Validation Errors List if any */}
          {validationResult.errors.length > 0 && (
            <div className="console-card" style={{ padding: '14px 18px', borderColor: 'var(--status-error-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-error)', marginBottom: 6 }}>
                DETECTED CONFIGURATION CONFLICTS:
              </div>
              <ul style={{ paddingLeft: 18, color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.6 }}>
                {validationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Network Topology View */}
          <div className="console-card">
            {/* Topology Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  AWS VPC Architectural Layout
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Routing boundaries, subnet allocation, and gateway connectivity.
                </p>
              </div>

              <button
                onClick={() => setShowAddressTable(!showAddressTable)}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 10px' }}
              >
                {showAddressTable ? 'Hide IP Allocation Table' : 'Show IP Allocation Table'}
              </button>
            </div>

            {/* Diagram Canvas */}
            <div style={{ padding: '24px', backgroundColor: 'var(--bg-surface-subtle)' }}>
              {/* Outer VPC Boundary */}
              <div style={{
                border: '1.5px solid var(--border-color)',
                borderRadius: 6,
                padding: '20px',
                backgroundColor: 'var(--bg-surface)',
                position: 'relative'
              }}>
                {/* VPC Header Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 12,
                  marginBottom: 18
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      AWS VPC
                    </span>
                    <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13.5px' }}>
                      {validationResult.vpc_cidr}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      ({validationResult.vpc_total_ips.toLocaleString()} Total Addresses, Netmask: {validationResult.vpc_netmask})
                    </span>
                  </div>

                  <span className="status-pill status-pill-neutral font-mono">TARGET REGION: US-EAST-1</span>
                </div>

                {/* Internet Gateway Node */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  fontSize: '12px',
                  marginBottom: 16
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>igw-cloudops-lab</span>
                  <span className="status-pill status-pill-success" style={{ fontSize: '10px' }}>Attached</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500 }}>Route Target: 0.0.0.0/0</span>
                </div>

                {/* Subnet Nodes Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                  {validationResult.subnets.map((sub, idx) => {
                    const isPublic = sub.name.toLowerCase().includes('public');
                    return (
                      <div
                        key={idx}
                        style={{
                          border: '1.5px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '16px',
                          backgroundColor: 'var(--bg-surface-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                              {sub.name}
                            </div>
                            <div className="font-mono" style={{ fontSize: '12.5px', color: 'var(--accent-text)', fontWeight: 600, marginTop: 2 }}>
                              {sub.cidr}
                            </div>
                          </div>
                          <span className={`status-pill ${isPublic ? 'status-pill-accent' : 'status-pill-neutral'}`}>
                            {isPublic ? 'Public Tier' : 'Private Tier'}
                          </span>
                        </div>

                        {/* Technical Metadata Rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: '12.5px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Available Host Capacity:</span>
                            <span className="font-mono" style={{ fontWeight: 700, color: 'var(--status-success)' }}>
                              {sub.usable_ips} addresses
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>AWS Reserved Addresses:</span>
                            <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              5 (.0-.3, .255)
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Usable Host IP Range:</span>
                            <span className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {sub.first_usable_ip} - {sub.last_usable_ip}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 7, marginTop: 3 }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Default Route Target:</span>
                            <span className="font-mono" style={{ fontSize: '11.5px', fontWeight: 700, color: isPublic ? 'var(--accent-text)' : 'var(--text-primary)' }}>
                              {isPublic ? '0.0.0.0/0 -> igw' : '10.0.0.0/16 Local'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Security Group:</span>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {isPublic ? 'web-sg (TCP 80, 443)' : 'default-internal-sg'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AWS Reserved IP Address Table */}
            {showAddressTable && (
              <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px 20px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                  AWS VPC Subnet Address Allocation Breakdown
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Address Offset</th>
                      <th>Purpose / AWS Assignment</th>
                      <th>Routable</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono">Network + 0 (e.g. .0)</td>
                      <td>Subnet Network Address</td>
                      <td>No</td>
                      <td>Identifies the network block.</td>
                    </tr>
                    <tr>
                      <td className="font-mono">Network + 1 (e.g. .1)</td>
                      <td>AWS VPC Default Router</td>
                      <td>Yes (Internal)</td>
                      <td>Default gateway for traffic exiting the subnet.</td>
                    </tr>
                    <tr>
                      <td className="font-mono">Network + 2 (e.g. .2)</td>
                      <td>AmazonProvidedDNS Resolver</td>
                      <td>Yes (Internal)</td>
                      <td>Internal DNS resolution server (VPC Base + 2).</td>
                    </tr>
                    <tr>
                      <td className="font-mono">Network + 3 (e.g. .3)</td>
                      <td>AWS Future Expansion</td>
                      <td>No</td>
                      <td>Reserved by AWS for internal infrastructure.</td>
                    </tr>
                    <tr>
                      <td className="font-mono">Network + 4 to Last - 1</td>
                      <td>EC2 / ENI Host Workloads</td>
                      <td>Yes</td>
                      <td>251 assignable addresses in a /24 subnet.</td>
                    </tr>
                    <tr>
                      <td className="font-mono">Last IP (e.g. .255)</td>
                      <td>Network Broadcast Address</td>
                      <td>No</td>
                      <td>AWS does not support broadcast, but reserves this address.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
