import React from 'react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  systemHealth,
  activeFaultCount,
  currentUser,
  onOpenAuth,
  onLogout
}) {
  const navItems = [
    {
      id: 'workflow',
      label: 'Recovery Engine',
      badge: 'Core',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M16 13H8"/>
          <path d="M16 17H8"/>
          <path d="M10 9H8"/>
        </svg>
      )
    },
    {
      id: 'planner',
      label: 'Network Planner',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
          <line x1="6" y1="6" x2="6.01" y2="6"/>
          <line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
      )
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      )
    },
    {
      id: 'terraform',
      label: 'Terraform Review',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
      )
    },
    {
      id: 'reports',
      label: 'Experiment Report',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      )
    },
    {
      id: 'inventory',
      label: 'Resource Inventory',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
      )
    },
    {
      id: 'faults',
      label: 'Fault Injection Lab',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      )
    }
  ];

  const isConnected = Boolean(systemHealth && systemHealth.status === 'healthy');
  const isAwsLive = Boolean(systemHealth && systemHealth.aws_credentials_configured);

  return (
    <aside style={{
      width: 224,
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
      {/* Top Header */}
      <div>
        <div style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          {/* Geometric node icon */}
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            backgroundColor: 'var(--accent)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              CloudOps Lab
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              AWS Network Platform
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 5,
                  border: 'none',
                  backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 450,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background-color 0.1s ease, color 0.1s ease'
                }}
              >
                <span style={{
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.id === 'workflow' && (
                  <span className="status-tag status-tag-neutral" style={{ fontSize: '9px', padding: '1px 4px' }}>
                    7-STEP
                  </span>
                )}
                {item.id === 'faults' && activeFaultCount > 0 && (
                  <span className="status-tag status-tag-warning" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                    {activeFaultCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User & Telemetry Footer */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {/* User Account Tile */}
        {currentUser ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '8px 10px',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 5
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentUser.full_name}
              </span>
              <span className="status-tag status-tag-success" style={{ fontSize: '9px', padding: '1px 4px' }}>
                Verified
              </span>
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.email}
            </div>
            <button
              type="button"
              onClick={onLogout}
              style={{
                marginTop: 4,
                padding: '3px 0',
                background: 'none',
                border: 'none',
                color: 'var(--status-danger)',
                fontSize: '11px',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onOpenAuth('login')}
            style={{ width: '100%', fontSize: '11.5px', height: 32, justifyContent: 'center' }}
          >
            Sign in / Register
          </button>
        )}

        {/* Telemetry info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '10.5px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Backend</span>
            <span style={{ color: isConnected ? 'var(--status-success)' : 'var(--status-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className={`dot-indicator ${isConnected ? 'green' : 'red'}`}></span>
              {isConnected ? 'Operational' : 'Offline'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Mode</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isAwsLive ? 'Live AWS' : 'Simulation'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
