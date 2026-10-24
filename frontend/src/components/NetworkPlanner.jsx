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
  const [showReservedDetail, setShowReservedDetail] = useState(false);

  // Automatically validate default plan on mount
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
        { name: 'web-tier-b', cidr: '10.0.1.128/25' } // Overlaps!
      ]);
    } else if (presetName === 'outside') {
      setVpcCidr('10.0.0.0/16');
      setSubnets([
        { name: 'public-subnet', cidr: '10.0.1.0/24' },
        { name: 'rogue-subnet', cidr: '192.168.10.0/24' } // Outside VPC!
      ]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Controls / Presets Bar */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              Step 1: IPv4 Network CIDR Designer
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Define VPC CIDR boundaries and validate subnet overlap, containment, and AWS 5-reserved address math.
            </p>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>PRESETS:</span>
            <button
              onClick={() => applyPreset('standard')}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              ✅ Standard Two-Tier
            </button>
            <button
              onClick={() => applyPreset('overlap')}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              ⚠️ Subnet Overlap Fault
            </button>
            <button
              onClick={() => applyPreset('outside')}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', borderColor: 'rgba(245, 158, 11, 0.4)' }}
            >
              ⚠️ Subnet Outside VPC
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 20 }}>
          {/* VPC CIDR */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              VPC IPv4 CIDR BLOCK:
            </label>
            <input
              type="text"
              className="input-field"
              value={vpcCidr}
              onChange={(e) => setVpcCidr(e.target.value)}
              placeholder="e.g. 10.0.0.0/16"
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Allowed: /16 to /28 (RFC 1918 recommended)
            </span>
          </div>

          {/* Subnet configuration */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                SUBNET ALLOCATIONS:
              </label>
              <button
                onClick={addSubnet}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Add Another Subnet
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {subnets.map((sub, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-field"
                    style={{ flex: 1 }}
                    value={sub.name}
                    onChange={(e) => handleSubnetChange(idx, 'name', e.target.value)}
                    placeholder="Subnet Name"
                  />
                  <input
                    type="text"
                    className="input-field"
                    style={{ flex: 1.5 }}
                    value={sub.cidr}
                    onChange={(e) => handleSubnetChange(idx, 'cidr', e.target.value)}
                    placeholder="CIDR, e.g. 10.0.1.0/24"
                  />
                  {subnets.length > 1 && (
                    <button
                      onClick={() => removeSubnet(idx)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        borderRadius: 8,
                        padding: '10px 14px',
                        cursor: 'pointer'
                      }}
                      title="Remove subnet"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Validate Action */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            onClick={handleValidate}
            disabled={loading}
            className="btn btn-primary"
            style={{ minWidth: 160 }}
          >
            {loading ? 'Validating CIDRs...' : '🔍 Validate Network Plan'}
          </button>
        </div>
      </div>

      {/* Validation Result Alert */}
      {errorMsg && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 10,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          fontSize: '0.88rem'
        }}>
          <strong>Validation Error:</strong> {errorMsg}
        </div>
      )}

      {validationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status Banner */}
          <div style={{
            padding: '16px 20px',
            borderRadius: 12,
            background: validationResult.is_valid
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${validationResult.is_valid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.35)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>{validationResult.is_valid ? '✅' : '❌'}</span>
                <div>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: validationResult.is_valid ? '#34d399' : '#f87171'
                  }}>
                    {validationResult.is_valid ? 'Network Configuration Valid' : 'Network Validation Failed'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {validationResult.is_valid
                      ? `VPC ${validationResult.vpc_cidr} encompasses ${validationResult.vpc_total_ips.toLocaleString()} total IP addresses.`
                      : 'Please review and resolve the conflicts below before proceeding with Terraform deployment.'}
                  </p>
                </div>
              </div>

              {/* RFC 1918 Badge */}
              {validationResult.is_valid && (
                <span className="badge badge-emerald">RFC 1918 COMPLIANT</span>
              )}
            </div>

            {/* Error List */}
            {validationResult.errors.length > 0 && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                <strong style={{ fontSize: '0.8rem', color: '#f87171' }}>Issues Detected:</strong>
                <ul style={{ fontSize: '0.82rem', color: '#fca5a5', paddingLeft: 20, marginTop: 4 }}>
                  {validationResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Interactive Visual Network Topology */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h3 className="font-display" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                  Network Architecture & Packet Path Topology
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Visual mapping of VPC boundaries, routing tiers, gateways, and stateful security controls.
                </p>
              </div>

              <button
                onClick={() => setShowReservedDetail(!showReservedDetail)}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                {showReservedDetail ? 'Hide AWS Reserved Math' : '📖 View AWS Reserved IPs (.0 - .3, .255)'}
              </button>
            </div>

            {/* Educational Drawer for AWS 5-reserved IPs */}
            {showReservedDetail && (
              <div style={{
                marginBottom: 20,
                padding: '16px',
                borderRadius: 10,
                background: 'rgba(0, 240, 255, 0.05)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                fontSize: '0.84rem'
              }}>
                <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: 8 }}>
                  AWS 5-Reserved IP Address Model (per Subnet)
                </h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 10 }}>
                  AWS reserves 5 IP addresses in every IPv4 subnet. In a /24 (256 addresses), exactly 251 are available for EC2 or ENIs:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6 }}>
                    <code style={{ color: '#38bdf8' }}>.0</code>: Network Address
                  </div>
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6 }}>
                    <code style={{ color: '#38bdf8' }}>.1</code>: AWS VPC Router
                  </div>
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6 }}>
                    <code style={{ color: '#38bdf8' }}>.2</code>: AmazonProvidedDNS
                  </div>
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6 }}>
                    <code style={{ color: '#38bdf8' }}>.3</code>: Reserved for future AWS use
                  </div>
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6 }}>
                    <code style={{ color: '#38bdf8' }}>.255</code>: Network Broadcast (Reserved)
                  </div>
                </div>
              </div>
            )}

            {/* Visual VPC Container Box */}
            <div style={{
              border: '2px dashed rgba(0, 240, 255, 0.3)',
              borderRadius: 16,
              padding: 24,
              background: 'rgba(10, 15, 30, 0.6)',
              position: 'relative'
            }}>
              {/* VPC Header Badge */}
              <div style={{
                position: 'absolute',
                top: -14,
                left: 20,
                background: '#0d1322',
                padding: '2px 14px',
                borderRadius: 20,
                border: '1px solid var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--accent-cyan)'
              }}>
                <span>AWS VPC:</span>
                <span className="font-mono">{validationResult.vpc_cidr}</span>
                <span style={{ color: 'var(--text-muted)' }}>({validationResult.vpc_total_ips.toLocaleString()} Total IPs)</span>
              </div>

              {/* Internet Gateway Link Component */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                gap: 12
              }}>
                <div style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(0, 240, 255, 0.15))',
                  border: '1px solid var(--border-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}>
                  <span>🌐</span>
                  <span>Internet Gateway (IGW)</span>
                  <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>ATTACHED</span>
                </div>
                <div style={{ height: 2, width: 40, background: 'var(--accent-cyan)' }}></div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0.0.0.0/0 Route</span>
              </div>

              {/* Subnet Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 20
              }}>
                {validationResult.subnets.map((sub, idx) => {
                  const isPublic = sub.name.toLowerCase().includes('public');
                  return (
                    <div
                      key={idx}
                      style={{
                        background: isPublic ? 'rgba(0, 240, 255, 0.04)' : 'rgba(139, 92, 246, 0.04)',
                        border: `1px solid ${isPublic ? 'rgba(0, 240, 255, 0.25)' : 'rgba(139, 92, 246, 0.25)'}`,
                        borderRadius: 12,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}
                    >
                      {/* Subnet Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.1rem' }}>{isPublic ? '🌍' : '🔒'}</span>
                            <strong style={{ fontSize: '0.95rem' }}>{sub.name}</strong>
                          </div>
                          <span className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
                            {sub.cidr}
                          </span>
                        </div>
                        <span className={`badge ${isPublic ? 'badge-cyan' : 'badge-violet'}`}>
                          {isPublic ? 'Public Tier' : 'Private Tier'}
                        </span>
                      </div>

                      {/* IP Allocation Table */}
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: '0.78rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Total IP Addresses:</span>
                          <span className="font-mono">{sub.total_ips}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>AWS Reserved:</span>
                          <span className="font-mono" style={{ color: '#fbbf24' }}>-5 (.0-.3, .255)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Usable Host IPs:</span>
                          <span className="font-mono" style={{ color: '#34d399', fontWeight: 700 }}>{sub.usable_ips}</span>
                        </div>
                        {sub.first_usable_ip && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span>Host Range:</span>
                            <span className="font-mono">{sub.first_usable_ip} → {sub.last_usable_ip}</span>
                          </div>
                        )}
                      </div>

                      {/* Routing & Security Controls Badge */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Route:</span>
                          <code style={{
                            padding: '2px 6px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 4,
                            color: isPublic ? '#38bdf8' : '#a78bfa'
                          }}>
                            {isPublic ? '0.0.0.0/0 → IGW' : '10.0.0.0/16 (Local Only)'}
                          </code>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Security Group:</span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {isPublic ? 'cloudops-lab-web-sg (TCP 80, 443)' : 'Default Internal SG'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
