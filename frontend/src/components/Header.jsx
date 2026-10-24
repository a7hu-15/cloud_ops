import React from 'react';

export default function Header({ activeTab, setActiveTab, systemHealth, activeFaultCount }) {
  const tabs = [
    { id: 'planner', label: '1. Network Planner', icon: '🗺️' },
    { id: 'terraform', label: '2. Terraform Runner', icon: '⚡' },
    { id: 'diagnostics', label: '3. Diagnostics Hub', icon: '🔍' },
    { id: 'faults', label: '4. Fault Injection Lab', icon: '🧪' },
    { id: 'viva', label: '5. Viva & Study Guide', icon: '🎓' },
  ];

  const isOnline = systemHealth && systemHealth.status === 'healthy';
  const hasAwsCreds = systemHealth && systemHealth.aws_credentials_configured;

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 13, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '16px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(139, 92, 246, 0.2))',
            border: '1px solid var(--border-bright)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: '0 0 20px var(--accent-cyan-glow)'
          }}>
            ☁️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="font-display" style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(to right, #ffffff, #94a3b8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                CLOUDOPS LAB
              </h1>
              <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>AWS & IAC</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              AWS Infrastructure & Network Troubleshooting Platform
            </p>
          </div>
        </div>

        {/* Live System Health Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Backend Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem'
          }}>
            <span className={`pulse-dot ${isOnline ? 'pulse-emerald' : 'pulse-rose'}`}></span>
            <span style={{ color: 'var(--text-muted)' }}>Backend:</span>
            <span style={{ fontWeight: 600, color: isOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
              {isOnline ? 'ONLINE' : 'CONNECTING...'}
            </span>
          </div>

          {/* AWS Mode */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>AWS Mode:</span>
            <span className={`badge ${hasAwsCreds ? 'badge-cyan' : 'badge-violet'}`} style={{ textTransform: 'none' }}>
              {hasAwsCreds ? 'Live AWS Cloud' : 'Simulation Engine'}
            </span>
          </div>

          {/* Active Faults Flag */}
          {activeFaultCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '0.8rem',
              color: '#fca5a5'
            }}>
              <span>⚠️</span>
              <span><strong>{activeFaultCount}</strong> Active Fault(s)</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        gap: 6,
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
