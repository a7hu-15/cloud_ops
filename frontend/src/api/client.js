// CloudOps Lab API Client

const API_BASE = '';

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function validateNetwork(vpcCidr, subnets) {
  const res = await fetch(`${API_BASE}/api/network/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vpc_cidr: vpcCidr, subnets })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Network validation failed');
  }
  return res.json();
}

export async function runTerraformValidate() {
  const res = await fetch(`${API_BASE}/api/terraform/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
}

export async function runTerraformPlan(variables = null) {
  const res = await fetch(`${API_BASE}/api/terraform/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'plan', variables })
  });
  return res.json();
}

export async function runTerraformApply(confirmationPhrase, variables = null) {
  const res = await fetch(`${API_BASE}/api/terraform/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'apply',
      confirmation_phrase: confirmationPhrase,
      variables
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Apply execution rejected');
  }
  return res.json();
}

export async function runTerraformDestroy(confirmationPhrase) {
  const res = await fetch(`${API_BASE}/api/terraform/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'destroy',
      confirmation_phrase: confirmationPhrase
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Destroy execution rejected');
  }
  return res.json();
}

export async function runDiagnostics({ checks = null, forceSimulated = false, targetHost = null } = {}) {
  const res = await fetch(`${API_BASE}/api/diagnostics/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checks,
      force_simulated_aws: forceSimulated,
      target_host: targetHost
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Diagnostic execution failed');
  }
  return res.json();
}

export async function getDiagnosticsCatalogue() {
  const res = await fetch(`${API_BASE}/api/diagnostics/catalogue`);
  return res.json();
}

export async function toggleSimulatedFault(faultId, enable) {
  const res = await fetch(`${API_BASE}/api/lab/simulate-fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault_id: faultId, enable })
  });
  return res.json();
}

export async function getLabStatus() {
  const res = await fetch(`${API_BASE}/api/lab/status`);
  return res.json();
}

export async function getInfrastructureInventory() {
  const res = await fetch(`${API_BASE}/api/infrastructure/inventory`);
  if (!res.ok) throw new Error('Failed to retrieve infrastructure inventory');
  return res.json();
}

// =============================================================================
// Troubleshooting & Recovery Workflow API
// =============================================================================
export async function getWorkflowSession() {
  const res = await fetch(`${API_BASE}/api/workflow/session`);
  if (!res.ok) throw new Error('Failed to fetch workflow session');
  return res.json();
}

export async function initWorkflowSession(labTemplateId = 'standard_two_tier', mode = 'simulation') {
  const res = await fetch(`${API_BASE}/api/workflow/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lab_template_id: labTemplateId, mode })
  });
  if (!res.ok) throw new Error('Failed to initialize workflow session');
  return res.json();
}

export async function injectWorkflowFault(faultId) {
  const res = await fetch(`${API_BASE}/api/workflow/inject-fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault_id: faultId })
  });
  if (!res.ok) throw new Error(`Failed to inject fault ${faultId}`);
  return res.json();
}

export async function runWorkflowDiagnostics() {
  const res = await fetch(`${API_BASE}/api/workflow/run-diagnostics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Failed to run workflow diagnostics and RCA');
  return res.json();
}

export async function applyWorkflowRemediation(confirmationToken, executeTerraformApply = false) {
  const res = await fetch(`${API_BASE}/api/workflow/apply-remediation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      remediation_id: 'auto',
      confirmation_token: confirmationToken,
      execute_terraform_apply: executeTerraformApply
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Remediation application rejected');
  }
  return res.json();
}

export async function verifyWorkflowRecovery() {
  const res = await fetch(`${API_BASE}/api/workflow/verify-recovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Failed to verify workflow recovery');
  return res.json();
}

export async function getWorkflowReportMarkdown() {
  const res = await fetch(`${API_BASE}/api/workflow/report/markdown`);
  if (!res.ok) throw new Error('Failed to retrieve experiment report');
  return res.json();
}

export async function getPacketTrace(targetPort = 443, originIp = '198.51.100.25', targetProtocol = 'tcp') {
  const res = await fetch(`${API_BASE}/api/network/packet-trace?target_port=${targetPort}&origin_ip=${encodeURIComponent(originIp)}&target_protocol=${encodeURIComponent(targetProtocol)}`);
  if (!res.ok) throw new Error('Failed to evaluate packet trace');
  return res.json();
}



// =============================================================================
// Authentication & User Accounts API (Section 3)
// =============================================================================

export async function registerAccount(fullName, email, password, confirmPassword, termsAccepted) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      full_name: fullName,
      email,
      password,
      confirm_password: confirmPassword,
      terms_accepted: termsAccepted
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Registration failed');
  }
  return data;
}

export async function verifyEmailToken(token) {
  const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Email verification failed');
  }
  return data;
}

export async function loginAccount(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed');
  }
  return data;
}

export async function logoutAccount() {
  const res = await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  });
  return res.json().catch(() => ({}));
}

export async function getCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    credentials: 'include'
  });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export async function requestPasswordReset(email) {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Password reset request failed');
  }
  return data;
}

export async function resetAccountPassword(token, newPassword, confirmPassword) {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      token,
      new_password: newPassword,
      confirm_password: confirmPassword
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Password reset failed');
  }
  return data;
}

// =============================================================================
// Persisted Networks & Topology API (Section 4.2 C, D, 6)
// =============================================================================

export async function saveNetworkConfig(name, region, vpcCidr, subnets) {
  const res = await fetch(`${API_BASE}/api/networks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, region, vpc_cidr: vpcCidr, subnets })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to save network configuration');
  }
  return data;
}

export async function listNetworkConfigs() {
  const res = await fetch(`${API_BASE}/api/networks`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to list network configurations');
  return res.json();
}

export async function getNetworkTopology(configId) {
  const res = await fetch(`${API_BASE}/api/networks/${configId}/topology`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to generate network topology');
  return res.json();
}

export async function generateAdhocTopology(vpcCidr, subnets, region = 'us-east-1') {
  const res = await fetch(`${API_BASE}/api/networks/topology`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ vpc_cidr: vpcCidr, subnets, region })
  });
  if (!res.ok) throw new Error('Failed to generate topology');
  return res.json();
}

// =============================================================================
// Persisted Reports API (Section 4.2 G, 6)
// =============================================================================

export async function listReports() {
  const res = await fetch(`${API_BASE}/api/reports`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to list experiment reports');
  return res.json();
}

export async function getReportDetails(reportId) {
  const res = await fetch(`${API_BASE}/api/reports/${reportId}`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to retrieve experiment report');
  return res.json();
}

export async function saveExperimentReport(data) {
  const res = await fetch(`${API_BASE}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save experiment report');
  }
  return res.json();
}
