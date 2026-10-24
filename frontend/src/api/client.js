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

