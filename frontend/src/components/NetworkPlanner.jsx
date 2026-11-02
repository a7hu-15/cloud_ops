import React, { useState, useEffect } from 'react';
import { validateNetwork, saveNetworkConfig, listNetworkConfigs } from '../api/client';

export default function NetworkPlanner({ onPlanApproved }) {
  const [configName, setConfigName] = useState('Standard Lab Network');
  const [vpcCidr, setVpcCidr] = useState('10.0.0.0/16');
  const [subnets, setSubnets] = useState([
    { name: 'public-subnet', cidr: '10.0.1.0/24', routeTarget: 'igw', tier: 'public' },
    { name: 'private-subnet', cidr: '10.0.2.0/24', routeTarget: 'local', tier: 'private' }
  ]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showAddressTable, setShowAddressTable] = useState(true);

  useEffect(() => {
    handleValidate();
    loadSavedConfigs();
  }, []);

  const loadSavedConfigs = async () => {
    try {
      const data = await listNetworkConfigs();
      setSavedConfigs(data);
    } catch {
      // ignore if unauthenticated
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const payloadSubnets = subnets.map((s) => ({
        name: s.name,
        cidr: s.cidr,
        tier: s.routeTarget === 'igw' ? 'public' : 'private'
      }));
      await saveNetworkConfig(configName, 'us-east-1', vpcCidr, payloadSubnets);
      setSaveStatus('Network configuration saved successfully.');
      loadSavedConfigs();
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`Error saving: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSaved = (configId) => {
    const selected = savedConfigs.find((c) => c.id === Number(configId));
    if (selected) {
      setConfigName(selected.name);
      setVpcCidr(selected.vpc_cidr);
      setSubnets(selected.subnets.map((s) => ({
        name: s.name,
        cidr: s.cidr,
        routeTarget: s.tier === 'public' ? 'igw' : 'local',
        tier: s.tier
      })));
    }
  };

  const handleSubnetChange = (index, field, value) => {
    const updated = [...subnets];
    updated[index][field] = value;
    setSubnets(updated);
  };

  const addSubnet = () => {
    const nextIdx = subnets.length + 1;
    setSubnets([...subnets, { name: `subnet-${nextIdx}`, cidr: `10.0.${nextIdx}.0/24`, routeTarget: 'local' }]);
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
        { name: 'public-subnet', cidr: '10.0.1.0/24', routeTarget: 'igw' },
        { name: 'private-subnet', cidr: '10.0.2.0/24', routeTarget: 'local' }
      ]);
    } else if (presetName === 'overlap') {
      setVpcCidr('10.0.0.0/16');
      setSubnets([
        { name: 'web-tier-a', cidr: '10.0.1.0/24', routeTarget: 'igw' },
        { name: 'web-tier-b', cidr: '10.0.1.128/25', routeTarget: 'local' }
      ]);
    } else if (presetName === 'outside') {
      setVpcCidr('10.0.0.0/16');
      setSubnets([
        { name: 'public-subnet', cidr: '10.0.1.0/24', routeTarget: 'igw' },
        { name: 'external-subnet', cidr: '192.168.10.0/24', routeTarget: 'local' }
      ]);
    }
  };

  const isValid = validationResult?.is_valid;
  const totalIps = validationResult?.vpc_total_ips || 65536;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 360px) 1fr', gap: 32, alignItems: 'start' }}>
      {/* =========================================================================
          LEFT COLUMN: Configuration & Address Planning Form (Minimal, quiet, precise)
          ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header Block */}
        <div>
          <div className="page-eyebrow">Networking / Address Planning</div>
          <h1 className="page-title">Network planner</h1>
          <p className="page-description">Design and validate IPv4 address allocations.</p>
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="status-tag status-tag-neutral font-mono">us-east-1</span>
            <span className="status-tag status-tag-neutral">RFC 1918</span>
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: 'var(--border-subtle)' }} />

        {/* VPC Configuration Section */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            VPC configuration
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              IPv4 CIDR block
            </label>
            <input
              type="text"
              className="input-text font-mono"
              value={vpcCidr}
              onChange={(e) => setVpcCidr(e.target.value)}
              placeholder="10.0.0.0/16"
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <span className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {totalIps.toLocaleString()} total IPv4 addresses
              </span>
              <span className={`status-tag ${isValid ? 'status-tag-success' : 'status-tag-neutral'}`} style={{ fontSize: '10.5px' }}>
                {isValid ? 'Valid CIDR' : 'Unverified'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: 'var(--border-subtle)' }} />

        {/* Subnet Allocation Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Subnet allocation
            </span>
            <button
              type="button"
              onClick={addSubnet}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              + Add subnet
            </button>
          </div>

          {/* Subnet Input Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {subnets.map((sub, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  paddingBottom: 8,
                  borderBottom: idx < subnets.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                }}
              >
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    className="input-text"
                    value={sub.name}
                    onChange={(e) => handleSubnetChange(idx, 'name', e.target.value)}
                    placeholder="subnet-name"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                    CIDR Block
                  </label>
                  <input
                    type="text"
                    className="input-text font-mono"
                    value={sub.cidr}
                    onChange={(e) => handleSubnetChange(idx, 'cidr', e.target.value)}
                    placeholder="10.0.1.0/24"
                  />
                </div>
                <div style={{ flex: 0.9 }}>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                    Route Next-Hop
                  </label>
                  <select
                    className="input-text font-mono"
                    value={sub.routeTarget || 'local'}
                    onChange={(e) => handleSubnetChange(idx, 'routeTarget', e.target.value)}
                    style={{ height: 34, fontSize: '11px', padding: '0 6px' }}
                  >
                    <option value="igw">0.0.0.0/0 (IGW)</option>
                    <option value="local">Local Only</option>
                  </select>
                </div>
                {subnets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSubnet(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '18px 4px 0',
                      fontSize: '13px'
                    }}
                    title="Remove subnet"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Validation Footnote & Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {savedConfigs.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                Load Saved Configuration
              </label>
              <select
                className="input-text"
                onChange={(e) => handleLoadSaved(e.target.value)}
                defaultValue=""
                style={{ height: 32, fontSize: '11.5px' }}
              >
                <option value="" disabled>Select saved network...</option>
                {savedConfigs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.vpc_cidr})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
              Plan Name
            </label>
            <input
              type="text"
              className="input-text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Lab Network Plan"
              style={{ height: 32, fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={handleValidate}
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 1, height: 36 }}
            >
              {loading ? 'Validating...' : 'Validate'}
            </button>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="btn btn-secondary"
              style={{ height: 36, whiteSpace: 'nowrap' }}
            >
              {saving ? 'Saving...' : 'Save Plan'}
            </button>
          </div>

          {saveStatus && (
            <div style={{
              fontSize: '11px',
              padding: '6px 10px',
              borderRadius: 4,
              backgroundColor: saveStatus.startsWith('Error') ? 'rgba(239, 68, 68, 0.08)' : 'rgba(71, 119, 100, 0.08)',
              color: saveStatus.startsWith('Error') ? 'var(--status-danger)' : 'var(--accent)'
            }}>
              {saveStatus}
            </div>
          )}
        </div>

        {/* Presets Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 6 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('standard')}
            className="btn btn-ghost"
            style={{ fontSize: '11.5px', padding: '2px 6px' }}
          >
            Standard
          </button>
          <span style={{ color: 'var(--border-color)' }}>•</span>
          <button
            type="button"
            onClick={() => applyPreset('overlap')}
            className="btn btn-ghost"
            style={{ fontSize: '11.5px', padding: '2px 6px' }}
          >
            Overlap Fault
          </button>
          <span style={{ color: 'var(--border-color)' }}>•</span>
          <button
            type="button"
            onClick={() => applyPreset('outside')}
            className="btn btn-ghost"
            style={{ fontSize: '11.5px', padding: '2px 6px' }}
          >
            Outside VPC
          </button>
        </div>

        {/* Validation Exception Banner if any */}
        {errorMsg && (
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'var(--status-error-bg)',
            border: '1px solid var(--status-error-border)',
            borderRadius: 5,
            color: 'var(--status-error)',
            fontSize: '12.5px'
          }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Validation Error</div>
            {errorMsg}
          </div>
        )}

        {/* Configuration Errors if validation returned errors */}
        {validationResult && validationResult.errors && validationResult.errors.length > 0 && (
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'var(--status-error-bg)',
            border: '1px solid var(--status-error-border)',
            borderRadius: 5,
            fontSize: '12.5px'
          }}>
            <div style={{ fontWeight: 600, color: 'var(--status-error)', marginBottom: 6 }}>
              Detected Configuration Conflicts ({validationResult.errors.length})
            </div>
            <ul style={{ paddingLeft: 16, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
              {validationResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* =========================================================================
          RIGHT COLUMN: HERO Topology Canvas & Subnet IP Allocation Breakdown
          ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Header of the Hero Canvas */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-eyebrow">Topology Canvas</div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              VPC architectural layout
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`status-tag ${isValid ? 'status-tag-success' : 'status-tag-neutral'}`}>
              <span className={`dot-indicator ${isValid ? 'green' : 'grey'}`}></span>
              {isValid ? 'Topology Validated' : 'Awaiting Validation'}
            </span>
            <button
              type="button"
              onClick={() => setShowAddressTable(!showAddressTable)}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11.5px', height: 28 }}
            >
              {showAddressTable ? 'Hide IP Table' : 'Show IP Table'}
            </button>
          </div>
        </div>

        {/* Clean, Spacious Topology Canvas */}
        <div className="topology-canvas" style={{ padding: '28px 24px' }}>
          {/* External Traffic Source & Internet Gateway Layer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
            {/* Internet Node */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 5,
              fontSize: '12px'
            }}>
              <span className="dot-indicator green"></span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Internet Ingress</span>
              <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>0.0.0.0/0</span>
            </div>

            {/* Connecting Line Down */}
            <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)' }} />

            {/* Internet Gateway */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 5,
              fontSize: '12px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>igw-cloudops-lab</span>
              <span className="status-tag status-tag-success" style={{ fontSize: '10px' }}>Attached</span>
            </div>

            {/* Connecting Line into VPC */}
            <div style={{ width: 1, height: 24, backgroundColor: 'var(--border-color)' }} />
          </div>

          {/* VPC Boundary Container */}
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            backgroundColor: 'var(--bg-surface)',
            padding: '20px'
          }}>
            {/* VPC Header Stripe */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: 18
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  AWS VPC
                </span>
                <span className="font-mono" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {vpcCidr}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  ({totalIps.toLocaleString()} IPv4 addresses, /16)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-tag status-tag-neutral font-mono">ID: vpc-cloudops-lab</span>
                <span className="status-tag status-tag-neutral">us-east-1a</span>
              </div>
            </div>

            {/* Subnets Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {subnets.map((sub, idx) => {
                // AWS Engineering Standard: Subnet is public IF AND ONLY IF its route table targets an IGW
                const isPublic = (sub.routeTarget || 'local') === 'igw';
                const nameHasPublic = sub.name.toLowerCase().includes('public');
                const matchingResult = validationResult?.subnets?.find((s) => s.name === sub.name);
                const usableIps = matchingResult?.usable_ips || 251;
                const ipRange = matchingResult ? `${matchingResult.first_usable_ip} - ${matchingResult.last_usable_ip}` : '10.0.X.4 - 10.0.X.254';

                return (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      padding: '16px',
                      backgroundColor: 'var(--bg-surface-subtle)'
                    }}
                  >
                    {/* Subnet Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {sub.name}
                        </div>
                        <div className="font-mono" style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {sub.cidr}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span className={`status-tag ${isPublic ? 'status-tag-accent' : 'status-tag-neutral'}`}>
                          {isPublic ? 'Public Tier' : 'Private Tier'}
                        </span>
                        {!isPublic && nameHasPublic && (
                          <span style={{ fontSize: '9.5px', color: 'var(--status-warning)', fontWeight: 600 }}>
                            Route: Local (No IGW)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Available Host Capacity</span>
                        <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {usableIps} usable addresses
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>AWS Reserved Hosts</span>
                        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                          5 (.0-.3, .255)
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Usable Host Range</span>
                        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {ipRange}
                        </span>
                      </div>

                      <div style={{ height: 1, backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Route Table Target</span>
                        <span className="font-mono" style={{ fontWeight: 600, color: isPublic ? 'var(--accent-text)' : 'var(--text-primary)' }}>
                          {isPublic ? '0.0.0.0/0 -> igw' : '10.0.0.0/16 local'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Security Group</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {isPublic ? 'web-sg (TCP 80, 443)' : 'internal-sg (TCP 5432)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AWS VPC Subnet Address Allocation Breakdown Table */}
        {showAddressTable && (
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  AWS VPC Subnet Address Allocation Breakdown
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Every Amazon VPC subnet reserves 5 IP addresses automatically (RFC 1918 + AWS Network Architecture).
                </div>
              </div>
              <span className="status-tag status-tag-neutral">Standard Specification</span>
            </div>

            <table className="data-table-clean">
              <thead>
                <tr>
                  <th>Address Offset</th>
                  <th>AWS Function / Assignment</th>
                  <th>Routable</th>
                  <th>Technical Role</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono">Network + 0 (.0)</td>
                  <td>Network Address</td>
                  <td>No</td>
                  <td>Identifies the network boundary block.</td>
                </tr>
                <tr>
                  <td className="font-mono">Network + 1 (.1)</td>
                  <td>VPC Default Router</td>
                  <td>Yes (Internal)</td>
                  <td>Internal default gateway for egress packets.</td>
                </tr>
                <tr>
                  <td className="font-mono">Network + 2 (.2)</td>
                  <td>AmazonProvidedDNS Resolver</td>
                  <td>Yes (Internal)</td>
                  <td>DNS resolution server mapped to VPC base + 2.</td>
                </tr>
                <tr>
                  <td className="font-mono">Network + 3 (.3)</td>
                  <td>AWS Future Expansion</td>
                  <td>No</td>
                  <td>Reserved by AWS for internal VPC capabilities.</td>
                </tr>
                <tr>
                  <td className="font-mono">Network + 4 to Last - 1</td>
                  <td>Usable Host Workloads</td>
                  <td>Yes</td>
                  <td>Assignable to EC2, ECS, ENIs, and NAT Gateways.</td>
                </tr>
                <tr>
                  <td className="font-mono">Last IP (.255)</td>
                  <td>Network Broadcast Address</td>
                  <td>No</td>
                  <td>AWS does not support broadcast, but reserves the offset.</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
