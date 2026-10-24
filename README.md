# CloudOps Lab — AWS Infrastructure Engineering & Network Troubleshooting Platform

> An engineering platform providing a unified, evidence-based, reproducible troubleshooting and recovery workflow for AWS networking and Infrastructure-as-Code.

[![CI Checks](https://github.com/ashuchaudhary/cloud-ops/actions/workflows/checks.yml/badge.svg)](https://github.com/ashuchaudhary/cloud-ops/actions/workflows/checks.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Terraform](https://img.shields.io/badge/Terraform-%3E%3D1.5.0-844FBA.svg?logo=terraform)](https://terraform.io)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB.svg?logo=python)](https://python.org)
[![Tests](https://img.shields.io/badge/Tests-43%20Passed-477764.svg)](https://github.com/ashuchaudhary/cloud-ops)

---

## 1. Problem Statement & The Differentiator

AWS Console, Terraform CLI, AWS CLI, VPC Reachability Analyzer, VPC Flow Logs, and Python scripts provide individual cloud networking capabilities in silos. When an infrastructure or network failure occurs:
- The AWS Console requires hopping across 5+ disconnected screens (VPCs, Subnets, Route Tables, Internet Gateways, Security Groups).
- Reachability Analyzer provides path traces but does not synthesize actionable Terraform remediation.
- Terraform executes infrastructure changes but cannot diagnose runtime networking packet drops or explain root causes.

### Our Differentiator
**CloudOps Lab provides a unified, evidence-based, reproducible troubleshooting and recovery workflow that connects network configuration, diagnostics, multi-layer root-cause analysis, Terraform remediation, verification, and learning into an integrated 7-step lifecycle.**

```
+------------------+     +------------------+     +------------------+
| 1. Select / Load | --> | 2. Inject Fault  | --> | 3. Run Checks    |
|    Network Lab   |     |    (5 Scenarios) |     |    (10 Findings) |
+------------------+     +------------------+     +------------------+
                                                           |
                                                           v
+------------------+     +------------------+     +------------------+
| 6. Verify Return | <-- | 5. Review & Apply| <-- | 4. Deterministic |
|    & Diff Proof  |     |    Terraform Fix |     |    RCA Engine    |
+------------------+     +------------------+     +------------------+
         |
         v
+------------------+
| 7. Save & Export |
|    Report (MD)   |
+------------------+
```

---

## 2. The 7-Step Troubleshooting & Recovery Engine

The platform’s signature feature guides engineers through seven connected steps:

1. **Select or Create Network Lab**: Loads a structured AWS networking model (`VpcModel`, `SubnetModel`, `RouteTableModel`, `InternetGatewayModel`, `SecurityGroupModel`). Inspects route-based subnet tiers dynamically rather than relying on subnet naming strings.
2. **Introduce Controlled Fault**: Safe, reproducible fault injection across 5 scenarios:
   - `fault_missing_https_sg`: Missing HTTPS security group ingress rule.
   - `fault_missing_default_route`: Missing `0.0.0.0/0 -> igw` public route.
   - `fault_igw_detached`: Internet Gateway detached from parent VPC.
   - `fault_subnet_overlap`: Overlapping subnet address blocks.
   - `fault_invalid_cidr_boundary`: Host bits set or invalid CIDR boundary.
3. **Run Multi-Tier Diagnostics**: Executes 10 structured checks (`CIDR-001..003`, `RT-001`, `IGW-001`, `SG-001`, `PUB-001`, `TF-001`, `DRIFT-001`, `CONN-001`). Each finding includes unique check ID, severity, affected resource, observed vs expected configuration, empirical evidence, and confidence rating.
4. **Deterministic Root-Cause Analysis (RCA)**: Evaluates multi-layer evidence chains across Layer 2/3 CIDR, Layer 3 Routing, Layer 4 Stateful Firewalls, and Cloud Edge Gateways. Returns a clear root cause code, confidence score (95%-100%), and primary failure layer.
5. **Review & Propose Remediation**: Synthesizes a precise Terraform HCL diff proposal, explaining why the change is required and its security implications. Guarded by mandatory `CONFIRM_REMEDIATION` approval tokens.
6. **Verify Recovery**: Re-executes the diagnostic suite against the remediated state, calculating a before/after diff showing resolved findings, remaining issues, and recovery verification proof.
7. **Export Experiment Report**: Generates audit-grade documentation in both structured JSON and GitHub-flavored Markdown.

---

## 3. Three Explicit Operational Modes

CloudOps Lab explicitly separates its operational modes to guarantee safety and clarity:

| Mode | Target Infrastructure | Safety Guarantee | Purpose |
|---|---|---|---|
| **Local Validation** | Local workstation memory & filesystem | Zero cloud interaction; zero costs | CIDR address math, RFC 1918 validation, Terraform formatting & validation |
| **Simulation** | Synthetic in-memory state models | Synthetic resources explicitly tagged `[SIMULATION]`; zero AWS calls | Safe fault injection, deterministic RCA training, regression testing |
| **Live AWS** | Real AWS VPC / IAM / EC2 resources | Read-only describe calls by default; mutating calls require explicit confirmation tokens | Live inventory inspection, actual AWS VPC Reachability analysis |

---

## 4. Four-Person Engineering Workstream & Contribution Matrix

| Team Member | Engineering Workstream | Source Files & Deliverables | APIs & Test Coverage |
|---|---|---|---|
| **Member 1**<br>Network Intelligence | • Structured network model (`VpcModel`, `SubnetModel`, `RouteTableModel`, `SecurityGroupModel`)<br>• IPv4 CIDR address calculations & RFC 1918 boundary validation<br>• Route-based subnet tier classification (public iff default route to attached IGW)<br>• Hop-by-hop packet path evaluator (Client Edge -> IGW -> Route Table -> SG -> ENI) | `backend/app/network_model.py`<br>`backend/app/network.py`<br>`frontend/src/components/NetworkPlanner.jsx` | `POST /api/network/validate`<br>`POST /api/network/packet-trace`<br>`test_network.py` (8 tests)<br>`test_network_model.py` (6 tests) |
| **Member 2**<br>Infrastructure Automation | • Modular AWS Terraform IaC (`networking.tf`, `security.tf`, `variables.tf`)<br>• Sandboxed Terraform runner with strict process allowlist (no `shell=True`)<br>• Plan interpretation & structured resource change summaries<br>• Destructive operation guardrails (`CONFIRM_APPLY`, `CONFIRM_DESTROY`)<br>• Zero-cost default lab design (no NAT Gateways) | `backend/app/terraform_runner.py`<br>`infrastructure/*.tf`<br>`frontend/src/components/TerraformRunner.jsx` | `POST /api/terraform/validate`<br>`POST /api/terraform/plan`<br>`POST /api/terraform/apply`<br>`POST /api/terraform/destroy`<br>`test_terraform_runner.py` (7 tests) |
| **Member 3**<br>Diagnostics & Recovery | • 10-point diagnostic catalogue runner (`diagnostics.py`)<br>• Multi-layer deterministic Root-Cause Analysis engine (`rca_engine.py`)<br>• Safe fault injection orchestrator (5 reproducible scenarios)<br>• Reviewable Terraform HCL remediation generator<br>• Before/after recovery verification engine | `backend/app/diagnostics.py`<br>`backend/app/rca_engine.py`<br>`backend/app/workflow_engine.py`<br>`frontend/src/components/DiagnosticsHub.jsx`<br>`frontend/src/components/FaultInjectionLab.jsx` | `GET /api/diagnostics/catalogue`<br>`POST /api/diagnostics/run`<br>`POST /api/diagnostics/simulate-fault`<br>`POST /api/workflow/*`<br>`test_diagnostics.py` (5 tests)<br>`test_workflow.py` (6 tests) |
| **Member 4**<br>Platform Engineering & Quality | • Unified 7-step Troubleshooting & Recovery Console UI (`TroubleshootingWorkflow.jsx`)<br>• Live AWS Resource Inventory with packet trace integration<br>• Markdown & JSON audit report generation<br>• GitHub Actions CI pipeline (Pytest, Frontend build, Terraform fmt/validate)<br>• REST API gateway & security middleware | `frontend/src/components/TroubleshootingWorkflow.jsx`<br>`frontend/src/components/ResourceInventory.jsx`<br>`frontend/src/api/client.js`<br>`backend/app/main.py`<br>`.github/workflows/checks.yml`<br>`docs/*.md` | `GET /api/infrastructure/inventory`<br>`GET /api/workflow/report/markdown`<br>`test_api.py` (11 tests)<br>Frontend Vite build checks |

---

## 5. Ten-Step Teacher-Ready Demonstration Script

This deterministic demonstration runs completely offline without requiring paid AWS credentials:

1. **Step 1: Open the Troubleshooting & Recovery Engine**:
   - Navigate to the **Recovery Engine** tab in the sidebar.
   - Click **Initialize Lab Baseline**. Observe the structured lab model loaded with VPC `10.0.0.0/16`, Public Subnet `10.0.1.0/24`, and Private Subnet `10.0.2.0/24`.
2. **Step 2: Inspect Network Baseline**:
   - Note the route-based tier classification: `public-subnet` is classified as **PUBLIC** because its route table associates `0.0.0.0/0 -> igw-lab-01`.
   - Run diagnostics to confirm all 10 checks return `PASS`.
3. **Step 3: Introduce a Controlled Fault**:
   - In Step 2 of the workflow, select **Missing HTTPS Ingress Rule** (`fault_missing_https_sg`).
   - Click **Inject Selected Fault**. Observe the active fault badge displayed in amber.
4. **Step 4: Execute Multi-Tier Diagnostics**:
   - Advance to Step 3 and click **Execute Diagnostics Suite**.
   - Inspect finding `SG-001` (Severity: HIGH).
   - Point out the evidence: `Observed: Inbound rules allow port 80 only; Expected: Port 443 permitted`.
5. **Step 5: Review Deterministic Root-Cause Analysis**:
   - Advance to Step 4. The RCA engine reports:
     - Root Cause Code: `RCA-SG-MISSING-HTTPS`.
     - Confidence: `100%`.
     - Primary Failure Layer: `Security Groups (Stateful L4 Firewall)`.
   - Explain that the engine verified upstream layers (IGW attached, Route Table valid) before isolating the security group.
6. **Step 6: Review Proposed Terraform Remediation**:
   - Advance to Step 5. Inspect the synthesized Terraform HCL diff:
     ```diff
     + ingress {
     +   description = "HTTPS from authorized networks"
     +   from_port   = 443
     +   to_port     = 443
     +   protocol    = "tcp"
     +   cidr_blocks = ["0.0.0.0/0"]
     + }
     ```
   - Highlight the security impact explanation and rollback guidance.
7. **Step 7: Apply Remediation with Guardrails**:
   - Click **Apply Remediation**. Note the safety modal requiring the confirmation token `CONFIRM_REMEDIATION`.
   - Type the token and confirm.
8. **Step 8: Verify Recovery Proof**:
   - Advance to Step 6 and click **Verify Recovery**.
   - Show the before/after comparison table:
     - Pre-Remediation: 1 Failed finding (`SG-001`).
     - Post-Remediation: 0 Failed findings.
     - Resolved: `SG-001`.
     - Verification Proof: `Recovery verified in simulation mode`.
9. **Step 9: Export Audit Report**:
   - Advance to Step 7. Click **Export Markdown Report**.
   - Download the timestamped, audit-ready markdown document detailing the scenario, evidence, diff, and verification proof.
10. **Step 10: Explain Real AWS Parity**:
    - Switch to the **Resource Inventory** tab.
    - Demonstrate how the same network model maps to AWS Describe APIs (`boto3.client('ec2')`) and live packet tracing when credentials are provided.

---

## 6. Architecture & Network Flow

```
                      +------------------------------------------+
                      |         Web Browser (React 19 UI)        |
                      |  - Troubleshooting & Recovery Engine     |
                      |  - CIDR Designer & Route-Based Tiers     |
                      |  - Sandboxed Terraform Terminal          |
                      |  - Diagnostics Hub (10 Structured Checks)|
                      |  - AWS Resource Inventory & Packet Trace |
                      +--------------------+---------------------+
                                           | JSON (HTTP REST)
                                           v
                      +------------------------------------------+
                      |         FastAPI Backend Service          |
                      |  - Structured Network Model              |
                      |  - Multi-Layer Deterministic RCA Engine  |
                      |  - Subprocess Runner (shell=False)       |
                      |  - Recovery Verification & Reporting     |
                      +--------------------+---------------------+
                                           |
                 +-------------------------+-------------------------+
                 |                                                   |
                 v                                                   v
+----------------------------------+               +-----------------------------------+
|     Terraform Engine (Local)     |               |      AWS Cloud (or Simulation)    |
| - `infrastructure/*.tf`          |               | - VPC: 10.0.0.0/16                |
| - Process allowlist (no shell)   |               | - Public Subnet: 10.0.1.0/24      |
| - Variable regex sanitization    |               | - Private Subnet: 10.0.2.0/24     |
| - Auto-approve guardrails        |               | - Internet Gateway (Attached)     |
+----------------------------------+               | - Public Route Table (0.0.0.0/0)  |
                                                   | - Web Security Group (80, 443)    |
                                                   +-----------------------------------+
```

---

## 7. Security & Operational Guardrails

- **Zero Shell Execution**: Subprocesses are invoked via `subprocess.run(list, shell=False)`. User inputs never touch shell interpreters.
- **Destructive Operation Confirmations**: `terraform apply` requires `CONFIRM_APPLY`, `terraform destroy` requires `CONFIRM_DESTROY`, and remediation requires `CONFIRM_REMEDIATION`.
- **Zero Browser Credential Exposure**: AWS keys are never passed to the browser or returned in API responses.
- **Cost-Aware Default Lab**: Default lab relies on free VPC, Subnet, Route Table, and IGW components. **Zero NAT Gateways** are provisioned by default, avoiding recurring AWS charges.

---

## 8. Getting Started Locally

### Prerequisites
- Python 3.9+
- Node.js 18+ and npm
- Terraform CLI (v1.5.0+)
- AWS CLI v2 (optional; full simulation works 100% offline)

### 1. Backend Setup & Test Suite
```bash
# Clone the repository
git clone https://github.com/ashuchaudhary/cloud-ops.git
cd cloud-ops

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run all 43 automated tests
PYTHONPATH=. pytest backend/tests/ -v

# Start FastAPI backend
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive OpenAPI documentation will be available at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Frontend Setup
In a separate terminal:
```bash
cd cloud-ops/frontend

# Install dependencies
npm install

# Run production build validation
npm run build

# Start Vite dev server
npm run dev
```
The engineering console will be accessible at: [http://localhost:5173](http://localhost:5173).

### 3. Terraform Validation
```bash
terraform -chdir=infrastructure fmt -check
terraform -chdir=infrastructure init -backend=false
terraform -chdir=infrastructure validate
```

---

## 9. Automated CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/checks.yml`) validates every pull request and push:
1. **Backend Tests**: Executes `pytest backend/tests/ -v` (43 tests covering CIDR math, network models, diagnostic catalogue, RCA, workflow lifecycle, and guardrails).
2. **Frontend Build**: Executes `npm ci && npm run build` to verify JavaScript/React syntax and bundle packaging.
3. **Terraform Formatting & Validation**: Executes `terraform fmt -check` and `terraform validate`.

---

## 10. Known Limitations & Honest Technical Boundaries

1. **IPv4-Only Scope**: The current network model and CIDR math engine support IPv4. IPv6 dual-stack addressing is outside the current scope.
2. **Single-Region Architecture**: The default lab model assumes a single AWS region (`ap-south-1`). Multi-region transit gateway peering is not simulated.
3. **Stateless NACL Modeling**: Security groups (stateful L4 firewalls) and route tables are fully evaluated. Custom multi-rule stateless Network ACL evaluation is planned for a future release.
4. **Read-Only AWS Mode**: To prevent accidental cloud expenditures or service disruptions, live AWS mode performs read-only `Describe*` calls unless explicit credentials and Terraform apply tokens are supplied.
