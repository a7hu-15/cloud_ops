import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import NetworkPlanner from './components/NetworkPlanner';
import TerraformRunner from './components/TerraformRunner';
import DiagnosticsHub from './components/DiagnosticsHub';
import ResourceInventory from './components/ResourceInventory';
import FaultInjectionLab from './components/FaultInjectionLab';
import TroubleshootingWorkflow from './components/TroubleshootingWorkflow';
import ExperimentReport from './components/ExperimentReport';
import AuthModal from './components/AuthModal';
import { checkHealth, getLabStatus, getCurrentUser, logoutAccount } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('workflow');
  const [systemHealth, setSystemHealth] = useState(null);
  const [activeFaultCount, setActiveFaultCount] = useState(0);
  const [approvedPlan, setApprovedPlan] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

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
    checkAuthSession();

    // Check for query parameters (?token=... or ?mode=...)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const path = window.location.pathname;

    if (token) {
      if (path.includes('reset') || params.get('mode') === 'reset') {
        setAuthModalMode('reset');
      } else {
        setAuthModalMode('verify');
      }
      setAuthModalOpen(true);
    }

    const interval = setInterval(fetchHealthAndStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkAuthSession = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    } catch {
      // Unauthenticated session
    }
  };

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

  const handleOpenAuth = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logoutAccount();
    } catch {
      // ignore
    } finally {
      setCurrentUser(null);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-canvas)' }}>
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealth={systemHealth}
        activeFaultCount={activeFaultCount}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
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
          currentUser={currentUser}
          onOpenAuth={handleOpenAuth}
          onLogout={handleLogout}
          systemHealth={systemHealth}
        />

        {/* Workspace Canvas */}
        <main style={{
          flex: 1,
          padding: '24px 32px 64px',
          maxWidth: 1320,
          width: '100%',
          margin: '0 auto'
        }}>
          {activeTab === 'workflow' && (
            <TroubleshootingWorkflow />
          )}

          {activeTab === 'planner' && (
            <NetworkPlanner onPlanApproved={(plan) => setApprovedPlan(plan)} />
          )}

          {activeTab === 'terraform' && (
            <TerraformRunner networkPlan={approvedPlan} />
          )}

          {activeTab === 'diagnostics' && (
            <DiagnosticsHub />
          )}

          {activeTab === 'reports' && (
            <ExperimentReport onReturnToWorkflow={() => setActiveTab('workflow')} />
          )}

          {activeTab === 'inventory' && (
            <ResourceInventory />
          )}

          {activeTab === 'faults' && (
            <FaultInjectionLab onFaultsChanged={(count) => setActiveFaultCount(count)} />
          )}
        </main>
      </div>

      {/* Authentication & Account Verification Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
        }}
      />
    </div>
  );
}
