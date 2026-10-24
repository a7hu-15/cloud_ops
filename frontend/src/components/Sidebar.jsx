import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, systemHealth, activeFaultCount }) {
  const navItems = [
    {
      id: 'planner',
      label: 'Network Planner',
      sublabel: 'VPC & CIDR Allocation',
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
    },
    {
      id: 'viva',
      label: 'Study & Viva Guide',
      sublabel: 'Technical Reference',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
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
      {/* Sidebar Header & Brand */}
      <div>
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          {/* Minimalist monochrome SVG cloud logo */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            backgroundColor: '#1E293B',
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
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              CloudOps Lab
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              AWS Networking Console
            </div>
          </div>
        </div>

        {/* Environment context indicator */}
        <div style={{
          padding: '12px 20px',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11.5px',
          color: 'var(--text-secondary)'
        }}>
          <span>Target Region</span>
          <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>us-east-1</span>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
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

      {/* Sidebar Footer / System Status Panel */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface-subtle)'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          System Telemetry
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Backend API</span>
            <span className={`status-pill ${isConnected ? 'status-pill-success' : 'status-pill-error'}`}>
              <span className={`dot ${isConnected ? 'dot-success' : 'dot-error'}`}></span>
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>AWS Mode</span>
            <span className="status-pill status-pill-neutral">
              {isAwsLive ? 'Live Cloud' : 'Simulated'}
            </span>
          </div>

          {activeFaultCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: 'var(--status-warning)', fontWeight: 500 }}>Active Faults</span>
              <span className="status-pill status-pill-warning">
                {activeFaultCount} Fault(s)
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
