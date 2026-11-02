import React from 'react';

export default function TopNav({
  activeTab,
  onRefresh,
  isRefreshing,
  theme,
  onToggleTheme,
  currentUser,
  onOpenAuth,
  onLogout,
  systemHealth
}) {
  const titles = {
    workflow: 'Recovery Engine (7-Step Workflow)',
    planner: 'Network Planner & Topology',
    terraform: 'Terraform Review & Pipeline',
    diagnostics: 'Diagnostics Hub',
    reports: 'Experiment Reports & Audit',
    inventory: 'Resource Inventory & Traffic Matrix',
    faults: 'Fault Injection Lab'
  };

  const isAwsLive = Boolean(systemHealth && systemHealth.aws_credentials_configured);

  return (
    <header style={{
      height: 52,
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      transition: 'background-color 0.2s ease, border-color 0.2s ease'
    }}>
      {/* Breadcrumb path */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px' }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>CloudOps Lab</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {titles[activeTab] || 'Console'}
        </span>
      </div>

      {/* Utilities: Region, Mode, Theme, User Menu, Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Region Chip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '11.5px',
          color: 'var(--text-secondary)',
          padding: '3px 8px',
          backgroundColor: 'var(--bg-canvas)',
          borderRadius: 4,
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Region:</span>
          <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>us-east-1</span>
        </div>

        {/* Operational Mode Pill (Simulation or Live AWS) */}
        <span className={`status-tag ${isAwsLive ? 'status-tag-success' : 'status-tag-neutral'}`} style={{ fontSize: '11px', padding: '3px 8px' }}>
          {isAwsLive ? 'Live AWS' : 'Simulation'}
        </span>

        {/* User Account / Profile Menu */}
        {currentUser ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 10px',
            backgroundColor: 'var(--bg-canvas)',
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            fontSize: '12px'
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {currentUser.full_name}
            </span>
            <button
              type="button"
              onClick={onLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--status-danger)',
                cursor: 'pointer',
                fontSize: '11.5px',
                padding: '0 0 0 4px',
                borderLeft: '1px solid var(--border-subtle)',
                marginLeft: 4
              }}
              title="Sign out of workspace"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '12px', height: 32 }}
          >
            Sign in
          </button>
        )}

        {/* Dark / Light Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="btn btn-secondary"
          style={{ padding: '5px 10px', fontSize: '12px', height: 32 }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Refresh Action */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn btn-secondary"
          style={{ padding: '5px 10px', fontSize: '12px', height: 32 }}
          title="Refresh backend status and diagnostics"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/>
          </svg>
          <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>
    </header>
  );
}
