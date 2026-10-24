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
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '13px' }}>Querying AWS infrastructure inventory...</div>
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
        borderRadius: 5
      }}>
        Failed to load resource inventory: {error}
      </div>
    );
  }

  const sg = inventory?.security_groups?.[0];
  const hasHttps = sg?.ingress_rules?.some((r) => r.port_range === '443');
  const hasHttp = sg?.ingress_rules?.some((r) => r.port_range === '80');
  const hasSsh = sg?.ingress_rules?.some((r) => r.port_range === '22');
  const hasDb = sg?.ingress_rules?.some((r) => r.port_range === '5432');
  const igwAttached = inventory?.internet_gateway?.state === 'attached';
  const hasDefaultRoute = inventory?.route_tables?.[0]?.routes?.some(
    (r) => r.destination === '0.0.0.0/0' && r.status === 'ACTIVE'
  );

  let isPortAllowed = false;
  if (activeTracePort === 443) isPortAllowed = hasHttps;
  else if (activeTracePort === 80) isPortAllowed = hasHttp;
  else if (activeTracePort === 22) isPortAllowed = hasSsh;
  else if (activeTracePort === 5432) isPortAllowed = hasDb;

  const isTraceSuccess = igwAttached && hasDefaultRoute && isPortAllowed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="page-eyebrow">Infrastructure Asset Registry</div>
          <h1 className="page-title">Resource inventory & traffic matrix</h1>
          <p className="page-description">
            Live AWS VPC components, route table destinations, and ingress packet evaluation.
          </p>
        </div>

        <button
          type="button"
          onClick={loadInventory}
          disabled={loading}
          className="btn btn-secondary"
          style={{ height: 32 }}
        >
          {loading ? 'Refreshing...' : 'Refresh inventory'}
        </button>
      </div>

      {/* Open Metrics Strip (Subtle metadata overview) */}
      <div className="metric-strip">
        <div className="metric-cell">
          <div className="metric-label">VPC ID</div>
          <div className="font-mono" style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
            {inventory?.vpc?.vpc_id}
          </div>
          <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {inventory?.vpc?.cidr_block}
          </div>
        </div>

        <div className="metric-cell">
          <div className="metric-label">Internet Gateway</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className={`dot-indicator ${igwAttached ? 'green' : 'red'}`}></span>
            <span className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {inventory?.internet_gateway?.igw_id}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: igwAttached ? 'var(--status-success)' : 'var(--status-error)' }}>
            {igwAttached ? 'Attached to VPC' : 'Detached'}
          </div>
        </div>

        <div className="metric-cell">
          <div className="metric-label">Subnets</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
            {inventory?.subnets?.length} Subnets
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            1 Public, 1 Private
          </div>
        </div>

        <div className="metric-cell">
          <div className="metric-label">Security Policy</div>
          <div className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
            {sg?.group_id}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {sg?.ingress_rules?.length} Inbound Rules
          </div>
        </div>
      </div>

      {/* Real AWS Data Tables (Prioritizing clean tables as requested) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Table 1: Subnets */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Subnet Allocations & Route Targets
            </span>
            <span className="status-tag status-tag-neutral font-mono">{inventory?.subnets?.length} Subnets</span>
          </div>
          <table className="data-table-clean">
            <thead>
              <tr>
                <th>Subnet Name</th>
                <th>Subnet ID</th>
                <th>CIDR Block</th>
                <th>Availability Zone</th>
                <th>Public IP on Launch</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {inventory?.subnets?.map((sub) => (
                <tr key={sub.subnet_id}>
                  <td style={{ fontWeight: 600 }}>{sub.name}</td>
                  <td className="font-mono" style={{ fontSize: '12px' }}>{sub.subnet_id}</td>
                  <td className="font-mono" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{sub.cidr_block}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{sub.availability_zone}</td>
                  <td>
                    <span className={`status-tag ${sub.map_public_ip ? 'status-tag-accent' : 'status-tag-neutral'}`}>
                      {sub.map_public_ip ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <span className="status-tag status-tag-success">
                      <span className="dot-indicator green"></span>
                      {sub.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table 2: Route Table Destinations & Security Group Ingress Rules Side by Side */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Route Table */}
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Route Table ({inventory?.route_tables?.[0]?.route_table_id})
              </span>
              <span className="status-tag status-tag-neutral">Main RT</span>
            </div>
            <table className="data-table-clean">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Target</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory?.route_tables?.[0]?.routes?.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono" style={{ fontWeight: 600 }}>{r.destination}</td>
                    <td className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.target}</td>
                    <td>
                      <span className="status-tag status-tag-success">
                        <span className="dot-indicator green"></span>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Security Group Ingress */}
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Security Rules ({sg?.group_name})
              </span>
              <span className="status-tag status-tag-neutral">Stateful Ingress</span>
            </div>
            <table className="data-table-clean">
              <thead>
                <tr>
                  <th>Protocol</th>
                  <th>Port</th>
                  <th>Source</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {sg?.ingress_rules?.map((rule, idx) => (
                  <tr key={idx}>
                    <td className="font-mono" style={{ textTransform: 'uppercase', fontSize: '11.5px' }}>{rule.protocol}</td>
                    <td className="font-mono" style={{ fontWeight: 600 }}>{rule.port_range}</td>
                    <td className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{rule.source}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{rule.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Interactive Packet Path Tracer */}
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Packet Path Simulation
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
                Simulate inbound packet reachability from external clients across AWS routing and security boundaries.
              </div>
            </div>

            {/* Port Selectors */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Port:</span>
              {[
                { port: 443, label: 'HTTPS (443)' },
                { port: 80, label: 'HTTP (80)' },
                { port: 22, label: 'SSH (22)' },
                { port: 5432, label: 'Postgres (5432)' }
              ].map((p) => (
                <button
                  key={p.port}
                  type="button"
                  onClick={() => setActiveTracePort(p.port)}
                  className="btn btn-secondary"
                  style={{
                    padding: '3px 9px',
                    fontSize: '11.5px',
                    height: 26,
                    backgroundColor: activeTracePort === p.port ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    color: activeTracePort === p.port ? 'var(--accent-text)' : 'var(--text-secondary)',
                    borderColor: activeTracePort === p.port ? 'var(--accent)' : 'var(--border-color)',
                    fontWeight: activeTracePort === p.port ? 600 : 500
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stepper Flow for Packet Path */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            backgroundColor: 'var(--bg-surface-subtle)',
            padding: '16px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)'
          }}>
            {/* Hop 1: External Client */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>1. Origin</span>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>External Client</div>
              <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>0.0.0.0/0</div>
              <span className="status-tag status-tag-success" style={{ width: 'fit-content', marginTop: 4 }}>
                <span className="dot-indicator green"></span> Transmitted
              </span>
            </div>

            {/* Hop 2: Internet Gateway */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>2. Edge Entry</span>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Internet Gateway</div>
              <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{inventory?.internet_gateway?.igw_id}</div>
              <span className={`status-tag ${igwAttached ? 'status-tag-success' : 'status-tag-error'}`} style={{ width: 'fit-content', marginTop: 4 }}>
                <span className={`dot-indicator ${igwAttached ? 'green' : 'red'}`}></span>
                {igwAttached ? 'Accepted' : 'Detached (Drop)'}
              </span>
            </div>

            {/* Hop 3: Route Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>3. VPC Routing</span>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Public Route Table</div>
              <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>0.0.0.0/0 -&gt; igw</div>
              <span className={`status-tag ${hasDefaultRoute ? 'status-tag-success' : 'status-tag-error'}`} style={{ width: 'fit-content', marginTop: 4 }}>
                <span className={`dot-indicator ${hasDefaultRoute ? 'green' : 'red'}`}></span>
                {hasDefaultRoute ? 'Routable' : 'No Default Route'}
              </span>
            </div>

            {/* Hop 4: Security Group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>4. Security Ingress</span>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{sg?.group_name}</div>
              <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>TCP Port {activeTracePort}</div>
              <span className={`status-tag ${isPortAllowed ? 'status-tag-success' : 'status-tag-error'}`} style={{ width: 'fit-content', marginTop: 4 }}>
                <span className={`dot-indicator ${isPortAllowed ? 'green' : 'red'}`}></span>
                {isPortAllowed ? 'Rule Allowed' : 'Blocked (Drop)'}
              </span>
            </div>

            {/* Hop 5: Destination Host */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>5. Host ENI</span>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Web EC2 Target</div>
              <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>10.0.1.10</div>
              <span className={`status-tag ${isTraceSuccess ? 'status-tag-success' : 'status-tag-error'}`} style={{ width: 'fit-content', marginTop: 4 }}>
                <span className={`dot-indicator ${isTraceSuccess ? 'green' : 'red'}`}></span>
                {isTraceSuccess ? 'Packet Delivered' : 'Connection Timeout'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
