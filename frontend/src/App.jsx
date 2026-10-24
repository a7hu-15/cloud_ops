import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import NetworkPlanner from './components/NetworkPlanner';
import TerraformRunner from './components/TerraformRunner';
import DiagnosticsHub from './components/DiagnosticsHub';
import FaultInjectionLab from './components/FaultInjectionLab';
import VivaStudyGuide from './components/VivaStudyGuide';
import { checkHealth, getLabStatus } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('planner');
  const [systemHealth, setSystemHealth] = useState(null);
  const [activeFaultCount, setActiveFaultCount] = useState(0);
  const [approvedPlan, setApprovedPlan] = useState(null);

  useEffect(() => {
    fetchHealthAndStatus();
    const interval = setInterval(fetchHealthAndStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealthAndStatus = async () => {
    try {
      const health = await checkHealth();
      setSystemHealth(health);
    } catch {
      setSystemHealth({ status: 'unreachable', aws_credentials_configured: false });
    }

    try {
      const status = await getLabStatus();
      const count = Object.values(status.active_faults || {}).filter(Boolean).length;
      setActiveFaultCount(count);
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with live system indicators and tabs */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealth={systemHealth}
        activeFaultCount={activeFaultCount}
      />

      {/* Main Content Area */}
      <main style={{
        maxWidth: 1400,
        width: '100%',
        margin: '0 auto',
        padding: '28px 24px 60px',
        flex: 1
      }}>
        {activeTab === 'planner' && (
          <NetworkPlanner onPlanApproved={(plan) => setApprovedPlan(plan)} />
        )}

        {activeTab === 'terraform' && (
          <TerraformRunner networkPlan={approvedPlan} />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsHub />
        )}

        {activeTab === 'faults' && (
          <FaultInjectionLab onFaultsChanged={(count) => setActiveFaultCount(count)} />
        )}

        {activeTab === 'viva' && (
          <VivaStudyGuide />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(10, 13, 20, 0.95)',
        padding: '20px 24px',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div>
            <strong style={{ color: 'var(--text-secondary)' }}>CloudOps Lab</strong> — AWS Infrastructure & Network Troubleshooting Platform
            <div style={{ fontSize: '0.74rem', marginTop: 2 }}>
              Built for educational & junior-engineer troubleshooting with zero credential exposure and least-cost architecture.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <span>Security: Sandboxed Allowlist</span>
            <span>•</span>
            <span>Cost: $0 Fixed NAT</span>
            <span>•</span>
            <span>CI: GitHub Actions</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
