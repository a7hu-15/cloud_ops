import React, { useState, useEffect } from 'react';
import { getInfrastructureInventory } from '../api/client';

export default function ResourceInventory() {
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTracePort, setActiveTracePort] = useState(443);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInfrastructureInventory();
      setInventory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !inventory) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Querying AWS configuration and live inventory...
      </div>
    );
  }

  if (error && !inventory) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: 'var(--status-error-bg)',
        border: '1px solid var(--status-error-border)',
        color: 'var(--status-error)',
        borderRadius: 6
      }}>
        Failed to load resource inventory: {error}
      </div>
    );
  }

  // Evaluate packet trace
  const sg = inventory?.security_groups?.[0];
  const hasHttps = sg?.ingress_rules?.some((r) => r.port_range === '443');
  const hasHttp = sg?.ingress_rules?.some((r) => r.port_range === '80');
  const igwAttached = inventory?.internet_gateway?.state === 'attached';
  const hasDefaultRoute = inventory?.route_tables?.[0]?.routes?.some(
    (r) => r.destination === '0.0.0.0/0' && r.status === 'ACTIVE'
  );

  const isTraceSuccess = activeTracePort === 443
    ? igwAttached && hasDefaultRoute && hasHttps
    : igwAttached && hasDefaultRoute && hasHttp;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Title & Refresh */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Resource Inventory & Traffic Matrix
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 2 }}>
            Real-time inspection of active AWS VPC networking components, route table destinations, and security rules.
          </p>
        </div>

        <button
          onClick={loadInventory}
          disabled={loading}
          className="btn btn-secondary"
          style={{ fontSize: '12px' }}
        >
          {loading ? 'Refreshing...' : 'Refresh Inventory'}
        </button>
      </div>

      {/* Top Resource Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {/* VPC Card */}
        <div className="console-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            VPC Identifier
          </div>
          <div className="font-mono" style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            {inventory?.vpc?.vpc_id}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
            {inventory?.vpc?.cidr_block} ({inventory?.vpc?.total_addresses.toLocaleString()} IPs)
          </div>
        </div>

        {/* IGW Card */}
        <div className="console-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Internet Gateway
          </div>
          <div className="font-mono" style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            {inventory?.internet_gateway?.igw_id}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className={`status-pill ${igwAttached ? 'status-pill-success' : 'status-pill-error'}`} style={{ fontSize: '10px' }}>
              <span className={`dot ${igwAttached ? 'dot-success' : 'dot-error'}`}></span>
              {igwAttached ? 'Attached' : 'Detached'}
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              {igwAttached ? inventory?.internet_gateway?.vpc_attachment : 'No VPC Link'}
            </span>
          </div>
        </div>

        {/* Subnets Card */}
        <div className="console-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Active Subnets
          </div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            {inventory?.subnets?.length} Subnets Defined
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
            1 Public Tier, 1 Private Tier
          </div>
        </div>

        {/* Security Group Card */}
        <div className="console-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Security Group
          </div>
          <div className="font-mono" style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            {sg?.group_id}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
            {sg?.ingress_rules?.length} Ingress Rules Active
          </div>
        </div>
      </div>

      {/* Packet Path Flow Simulator */}
      <div className="console-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Packet Path & Traffic Flow Simulation
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Trace an inbound TCP connection from an external client through IGW, Route Table, and Security Group.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Test Protocol:</span>
            <button
              onClick={() => setActiveTracePort(443)}
              className="btn"
              style={{
                padding: '4px 10px',
                fontSize: '11.5px',
                backgroundColor: activeTracePort === 443 ? 'var(--accent-primary)' : 'var(--bg-surface-subtle)',
                color: activeTracePort === 443 ? '#FFFFFF' : 'var(--text-primary)',
                borderColor: activeTracePort === 443 ? 'var(--accent-primary)' : 'var(--border-color)'
              }}
            >
              HTTPS (TCP 443)
            </button>
            <button
              onClick={() => setActiveTracePort(80)}
              className="btn"
              style={{
                padding: '4px 10px',
                fontSize: '11.5px',
                backgroundColor: activeTracePort === 80 ? 'var(--accent-primary)' : 'var(--bg-surface-subtle)',
                color: activeTracePort === 80 ? '#FFFFFF' : 'var(--text-primary)',
                borderColor: activeTracePort === 80 ? 'var(--accent-primary)' : 'var(--border-color)'
              }}
            >
              HTTP (TCP 80)
            </button>
          </div>
        </div>

        {/* Trace Path Pipeline */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 10,
          backgroundColor: 'var(--bg-surface-subtle)',
          padding: '16px',
          borderRadius: 6,
          border: '1px solid var(--border-color)'
        }}>
          {/* Hop 1: External Client */}
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>STEP 1: CLIENT</div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginTop: 2 }}>Public Internet</div>
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>203.0.113.45</div>
            <span className="status-pill status-pill-success" style={{ marginTop: 6 }}>Source SYN</span>
          </div>

          {/* Hop 2: Internet Gateway */}
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>STEP 2: EDGE GATEWAY</div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginTop: 2 }}>Internet Gateway</div>
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>1:1 Destination NAT</div>
            <span className={`status-pill ${igwAttached ? 'status-pill-success' : 'status-pill-error'}`} style={{ marginTop: 6 }}>
              {igwAttached ? 'Attached (Pass)' : 'Detached (Drop)'}
            </span>
          </div>

          {/* Hop 3: Route Table */}
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>STEP 3: ROUTING</div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginTop: 2 }}>Public Route Table</div>
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>0.0.0.0/0 Target</div>
            <span className={`status-pill ${hasDefaultRoute ? 'status-pill-success' : 'status-pill-error'}`} style={{ marginTop: 6 }}>
              {hasDefaultRoute ? 'Route Active' : 'No Route (Drop)'}
            </span>
          </div>

          {/* Hop 4: Security Group */}
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>STEP 4: STATEFUL FIREWALL</div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginTop: 2 }}>cloudops-lab-web-sg</div>
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 2 }}>Port {activeTracePort} Ingress</div>
            <span className={`status-pill ${(activeTracePort === 443 ? hasHttps : hasHttp) ? 'status-pill-success' : 'status-pill-error'}`} style={{ marginTop: 6 }}>
              {(activeTracePort === 443 ? hasHttps : hasHttp) ? 'Rule Allowed' : 'Missing Rule (Drop)'}
            </span>
          </div>

          {/* Result */}
          <div style={{
            padding: '12px',
            backgroundColor: isTraceSuccess ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
            borderRadius: 4,
            border: `1px solid ${isTraceSuccess ? 'var(--status-success-border)' : 'var(--status-error-border)'}`
          }}>
            <div style={{ fontSize: '10.5px', fontWeight: 600, color: isTraceSuccess ? 'var(--status-success)' : 'var(--status-error)' }}>
              END-TO-END OUTCOME
            </div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: isTraceSuccess ? 'var(--status-success)' : 'var(--status-error)', marginTop: 2 }}>
              {isTraceSuccess ? 'Connection Established' : 'Connection Timed Out'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-primary)', marginTop: 4 }}>
              {isTraceSuccess
                ? 'Traffic reaches EC2 host socket; return path permitted statefully.'
                : 'Packet dropped prior to OS stack. Inspect route or security group.'}
            </div>
          </div>
        </div>
      </div>

      {/* Subnets Details Table */}
      <div className="console-card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            AWS Subnet Inventory
          </h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Subnet Identifier</th>
              <th>Tier</th>
              <th>IPv4 CIDR</th>
              <th>Availability Zone</th>
              <th>Auto-Assign Public IP</th>
              <th>Usable Hosts</th>
              <th>Route Table</th>
            </tr>
          </thead>
          <tbody>
            {inventory?.subnets?.map((sub, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sub.name}</div>
                  <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub.subnet_id}</div>
                </td>
                <td>
                  <span className={`status-pill ${sub.tier === 'public' ? 'status-pill-accent' : 'status-pill-neutral'}`}>
                    {sub.tier}
                  </span>
                </td>
                <td className="font-mono">{sub.cidr_block}</td>
                <td className="font-mono">{sub.availability_zone}</td>
                <td>
                  <span className={`status-pill ${sub.map_public_ip_on_launch ? 'status-pill-success' : 'status-pill-neutral'}`}>
                    {sub.map_public_ip_on_launch ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="font-mono">{sub.available_ipv4_count} IPs</td>
                <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  {sub.route_table_id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security Group Ingress / Egress Rules Table */}
      <div className="console-card">
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Security Group Ingress & Egress Matrix ({sg?.group_name})
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Instance-level stateful traffic authorization rules.
            </p>
          </div>
          <span className="font-mono status-pill status-pill-neutral">{sg?.group_id}</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Rule ID</th>
              <th>Direction</th>
              <th>Protocol</th>
              <th>Port Range</th>
              <th>Source / Destination CIDR</th>
              <th>Action</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {sg?.ingress_rules?.map((rule, i) => (
              <tr key={`in-${i}`}>
                <td className="font-mono" style={{ fontSize: '11.5px' }}>{rule.id}</td>
                <td>
                  <span className="status-pill status-pill-accent">INBOUND</span>
                </td>
                <td className="font-mono" style={{ textTransform: 'uppercase' }}>{rule.protocol}</td>
                <td className="font-mono" style={{ fontWeight: 600 }}>{rule.port_range}</td>
                <td className="font-mono">{rule.source}</td>
                <td>
                  <span className="status-pill status-pill-success">{rule.status}</span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{rule.description}</td>
              </tr>
            ))}
            {sg?.egress_rules?.map((rule, i) => (
              <tr key={`eg-${i}`}>
                <td className="font-mono" style={{ fontSize: '11.5px' }}>{rule.id}</td>
                <td>
                  <span className="status-pill status-pill-neutral">OUTBOUND</span>
                </td>
                <td className="font-mono" style={{ textTransform: 'uppercase' }}>{rule.protocol}</td>
                <td className="font-mono">{rule.port_range}</td>
                <td className="font-mono">{rule.destination}</td>
                <td>
                  <span className="status-pill status-pill-success">{rule.status}</span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{rule.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
