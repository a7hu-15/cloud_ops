import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import NetworkPlanner from './components/NetworkPlanner';
import TerraformRunner from './components/TerraformRunner';
import DiagnosticsHub from './components/DiagnosticsHub';
import ResourceInventory from './components/ResourceInventory';
import FaultInjectionLab from './components/FaultInjectionLab';
import { checkHealth, getLabStatus } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('planner');
  const [systemHealth, setSystemHealth] = useState(null);
  const [activeFaultCount, setActiveFaultCount] = useState(0);
  const [approvedPlan, setApprovedPlan] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Theme Management: Light & Dark
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('cloudops_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cloudops_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    fetchHealthAndStatus();
    const interval = setInterval(fetchHealthAndStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealthAndStatus = async () => {
    setIsRefreshing(true);
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
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealth={systemHealth}
        activeFaultCount={activeFaultCount}
      />

      {/* Main Console Canvas */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* Top Header / Breadcrumbs Bar */}
        <TopNav
          activeTab={activeTab}
          onRefresh={fetchHealthAndStatus}
          isRefreshing={isRefreshing}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Workspace Canvas */}
        <main style={{
          flex: 1,
          padding: '24px 32px 64px',
          maxWidth: 1320,
          width: '100%',
          margin: '0 auto'
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

          {activeTab === 'inventory' && (
            <ResourceInventory />
          )}

          {activeTab === 'faults' && (
            <FaultInjectionLab onFaultsChanged={(count) => setActiveFaultCount(count)} />
          )}
        </main>
      </div>
    </div>
  );
}
