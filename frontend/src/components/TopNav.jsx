import React from 'react';

export default function TopNav({ activeTab, onRefresh, isRefreshing }) {
  const titles = {
    planner: 'Network Planner & IPv4 Allocation',
    terraform: 'Terraform Infrastructure Pipeline',
    diagnostics: 'Multi-Tier Diagnostics & Verification',
    faults: 'Fault Injection & Recovery Testing',
    viva: 'Engineering Reference & Oral Exam Guide'
  };

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
      zIndex: 40
    }}>
      {/* Breadcrumb path */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px' }}>
        <span style={{ color: 'var(--text-muted)' }}>CloudOps Lab</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {titles[activeTab] || 'Console'}
        </span>
      </div>

      {/* Utilities */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '12px',
          color: 'var(--text-secondary)',
          padding: '4px 10px',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderRadius: 4,
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ color: 'var(--text-muted)' }}>VPC Boundary:</span>
          <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>10.0.0.0/16</span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn btn-secondary"
          style={{ padding: '5px 10px', fontSize: '12px' }}
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
