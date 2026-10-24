import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, systemHealth, activeFaultCount }) {
  const navItems = [
    {
      id: 'planner',
      label: 'Network Planner',
      sublabel: 'VPC & Subnet CIDRs',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
          <line x1="6" y1="6" x2="6.01" y2="6"/>
          <line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
      )
    },
    {
      id: 'terraform',
      label: 'Terraform Engine',
      sublabel: 'Plan, Apply & Destroy',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
      )
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics Hub',
      sublabel: '10 Health Checks',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      )
    },
    {
      id: 'inventory',
      label: 'Resource Inventory',
      sublabel: 'Traffic & Route Matrix',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
      )
    },
    {
      id: 'faults',
      label: 'Fault Injection Lab',
      sublabel: 'Controlled Scenarios',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      )
    }
  ];

  const isConnected = systemHealth && systemHealth.status === 'healthy';
  const isAwsLive = systemHealth && systemHealth.aws_credentials_configured;

  return (
    <aside style={{
      width: 250,
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      flexShrink: 0,
      height: '100vh',
      position: 'sticky',
      top: 0
    }}>
      {/* Brand & Target Region */}
      <div>
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            backgroundColor: 'var(--accent-primary)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              CloudOps Lab
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              AWS Infrastructure Console
            </div>
          </div>
        </div>

        {/* Region Target Bar */}
        <div style={{
          padding: '11px 20px',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <span style={{ fontWeight: 500 }}>Target Region:</span>
          <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>us-east-1</span>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid transparent',
                  backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-primary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{
                  color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.id === 'faults' && activeFaultCount > 0 && (
                  <span className="status-pill status-pill-warning" style={{ fontSize: '10px', padding: '1px 5px' }}>
                    {activeFaultCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Telemetry Footer */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface-subtle)'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          System Telemetry
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Backend API</span>
            <span className={`status-pill ${isConnected ? 'status-pill-success' : 'status-pill-error'}`}>
              <span className={`dot ${isConnected ? 'dot-success' : 'dot-error'}`}></span>
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>AWS Engine</span>
            <span className="status-pill status-pill-neutral">
              {isAwsLive ? 'Live Cloud' : 'Simulated'}
            </span>
          </div>

          {activeFaultCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>Active Faults</span>
              <span className="status-pill status-pill-warning">
                {activeFaultCount} Injected
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
