# CloudOps Lab: AWS Infrastructure & Network Troubleshooting Platform

> A practical, security-hardened educational platform for junior cloud engineers and students to design, validate, provision, troubleshoot, and safely clean up AWS networking infrastructure using Terraform, FastAPI, and React.

[![CI Checks](https://github.com/ashuchaudhary/cloud-ops/actions/workflows/checks.yml/badge.svg)](https://github.com/ashuchaudhary/cloud-ops/actions/workflows/checks.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![Terraform](https://img.shields.io/badge/Terraform-%3E%3D1.5.0-844FBA.svg?logo=terraform)](https://terraform.io)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB.svg?logo=python)](https://python.org)

---

## 1. Problem Statement & Target Users

Cloud networking behavior relies on a web of interlocked configurations: IPv4 address bounds, CIDR subnetting, route table entries, internet gateways, security group permissions, stateless network ACLs, and operating-system firewalls. Junior engineers and cloud learners frequently struggle to determine which exact layer failed when a connection times out. 

**CloudOps Lab** provides a structured, repeatable, and safe environment to:
- Learn IPv4 CIDR subnetting and AWS's mandatory 5-reserved IP address allocation model.
- Execute declarative Terraform infrastructure changes through controlled, sandboxed workflows without arbitrary shell execution vulnerabilities.
- Run multi-tier diagnostics (Static CIDR checks, Terraform CLI checks, live/simulated AWS configuration inspections, and live TCP socket probes).
- Intentionally inject common cloud misconfigurations (e.g. missing HTTPS security group rule, missing default route, detached IGW) and verify empirical evidence and recovery.

---

## 2. Key Features & Boundaries

### In Scope
- **IPv4 CIDR Calculator & Validator**: Checks RFC 1918 compliance, subnet boundary alignment, containment within VPC, subnet overlap detection, and calculates the 5 AWS reserved IP addresses per subnet (`.0` net, `.1` router, `.2` DNS, `.3` future, `.255` broadcast).
- **Controlled Terraform Runner**: Strictly sandboxed execution of `fmt -check`, `init`, `validate`, `plan`, `apply`, and `destroy` with explicit safety confirmation tokens (`CONFIRM_APPLY` and `CONFIRM_DESTROY`).
- **Structured Diagnostic Catalogue (10 Checks)**:
  - `CIDR-001`, `CIDR-002`, `CIDR-003`: Static CIDR syntax, containment, and non-overlap.
  - `RT-001`: Route table default route `0.0.0.0/0 -> igw` presence.
  - `IGW-001`: Internet Gateway VPC attachment state.
  - `SG-001`: Inbound TCP port 80 & 443 authorization in security groups.
  - `PUB-001`: Public IP auto-assignment on public tier subnets.
  - `TF-001`: Local Terraform CLI syntax and validation.
  - `DRIFT-001`: Refreshed Terraform plan review to detect manual out-of-band changes.
  - `CONN-001`: Controlled TCP socket reachability test with strict timeout.
- **Intentional Fault-Injection & Recovery Lab**: Toggle controlled misconfigurations and observe real diagnostic evidence.
- **Viva & Technical Interview Guide**: Interactive study deck answering 11 essential networking and cloud questions.

### Out of Scope (Version 1)
- Multi-tenant cloud hosting, Kubernetes clusters, enterprise observability stacks (Datadog/NewRelic), automated remediation, and arbitrary command execution.

---

## 3. Architecture & Network Flow

```
                      +------------------------------------------+
                      |         Web Browser (React UI)           |
                      |  - CIDR Designer & Visual Topology       |
                      |  - Terraform Workflows Terminal          |
                      |  - Diagnostics Hub (10 Checks)           |
                      |  - Fault Injection Playground            |
                      |  - Viva Guide Flashcards                 |
                      +--------------------+---------------------+
                                           | JSON (HTTP REST)
                                           v
                      +------------------------------------------+
                      |         FastAPI Backend API              |
                      |  - Python `ipaddress` Engine             |
                      |  - Security Sandboxed Subprocess Runner  |
                      |  - Multi-Tier Diagnostic Engine          |
                      +--------------------+---------------------+
                                           |
                 +-------------------------+-------------------------+
                 |                                                   |
                 v                                                   v
+----------------------------------+               +-----------------------------------+
|     Terraform Engine (Local)     |               |      AWS Cloud (or Simulation)    |
| - `infrastructure/*.tf`          |               | - VPC: 10.0.0.0/16                |
| - Process allowlist (no shell)   |               | - Public Subnet: 10.0.1.0/24      |
| - Variable sanitization          |               | - Private Subnet: 10.0.2.0/24     |
| - Auto-approve guardrails        |               | - Internet Gateway (Attached)     |
+----------------------------------+               | - Public Route Table (0.0.0.0/0)  |
                                                   | - Web Security Group (80, 443)    |
                                                   +-----------------------------------+
```

### Packet Flow for Inbound HTTPS (TCP 443)
1. **Client** initiates TCP SYN to public IPv4.
2. **Internet Gateway (IGW)** performs Destination 1:1 NAT, translating public IP to instance private IP `10.0.1.x`.
3. **Route Table** matches VPC local route `10.0.0.0/16` and forwards packet to public subnet.
4. **Network ACL** permits inbound traffic.
5. **Security Group** evaluates inbound rules. If rule for 443 is present, connection is established. If missing (`SG-001`), packet is dropped at the ENI.
6. **Return Traffic**: Because Security Groups are **stateful**, outbound return response packets are automatically permitted.

---

## 4. Repository Structure

```
cloudops-lab/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application & security middleware
│   │   ├── schemas.py           # Pydantic models with strict validation
│   │   ├── network.py           # Python ipaddress CIDR math & static checks
│   │   ├── diagnostics.py       # Diagnostic catalogue runner (Live & Simulation)
│   │   └── terraform_runner.py  # Sandboxed subprocess runner (no shell=True)
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_network.py      # Unit tests for CIDR, boundaries, AWS 5 IPs
│   │   ├── test_diagnostics.py  # Diagnostic check tests & fault simulation
│   │   ├── test_api.py          # FastAPI endpoint integration tests
│   │   └── test_terraform_runner.py # Allowlist & guardrail tests
│   └── requirements.txt
├── infrastructure/
│   ├── versions.tf              # Pinned AWS provider & Terraform version
│   ├── provider.tf              # AWS provider with default project tags
│   ├── variables.tf             # Validated CIDRs & fault toggle variables
│   ├── networking.tf            # VPC, Subnets, IGW, Route Tables
│   ├── security.tf              # Web Security Group with least-privilege rules
│   ├── outputs.tf               # Resource IDs and configuration outputs
│   └── terraform.tfvars.example # Safe example variables file
├── frontend/
│   ├── src/
│   │   ├── api/client.js        # REST API client
│   │   ├── components/
│   │   │   ├── Header.jsx       # Real-time health & status pills
│   │   │   ├── NetworkPlanner.jsx # Interactive CIDR form & visual topology
│   │   │   ├── TerraformRunner.jsx# Safe workflow buttons & terminal
│   │   │   ├── DiagnosticsHub.jsx # 10 diagnostic checks & evidence
│   │   │   ├── FaultInjectionLab.jsx # 5 intentional failure scenarios
│   │   │   └── VivaStudyGuide.jsx # Section 18 study flashcards
│   │   ├── App.jsx
│   │   └── index.css            # Dark glassmorphic design system
│   ├── package.json
│   └── vite.config.js           # Dev server with proxy to backend
├── docs/
│   ├── architecture.md          # Architectural deep-dive & packet analysis
│   ├── troubleshooting.md      # Scenario diagnosis and resolution steps
│   ├── test-plan.md             # Multi-tier testing matrix
│   ├── cost-and-cleanup.md      # AWS pricing breakdown & verification checklist
│   └── viva-guide.md            # Viva questions & model answers
├── .github/workflows/
│   └── checks.yml               # Automated CI for pytest & terraform validate
├── .gitignore                   # Strict security ignore rules
└── README.md
```

---

## 5. Security & Operational Safety Guardrails

- **Zero Arbitrary Command Execution**: Subprocess runner invokes allowlisted commands with `shell=False`. It never passes shell command strings from user inputs.
- **Destructive Operation Confirmations**: `apply` and `destroy` strictly mandate confirmation phrases (`CONFIRM_APPLY` and `CONFIRM_DESTROY`).
- **No Browser Credentials**: AWS Access Keys or Secrets are never transmitted to the browser or stored in state.
- **No Unrestricted SSH**: Security groups do **NOT** expose port 22 to `0.0.0.0/0`.
- **Zero Ongoing Costs in Default Lab**: Avoids NAT Gateways (~$32.40/month savings).

---

## 6. Getting Started Locally

### Prerequisites
- Python 3.9+
- Node.js 18+ and npm
- Terraform CLI (v1.5.0+)
- AWS CLI (v2) (optional; high-fidelity simulation engine enables full lab testing offline without AWS credentials)

### 1. Set Up Python Virtual Environment & Backend
```bash
# Clone the repository
git clone https://github.com/ashuchaudhary/cloud-ops.git
cd cloud-ops

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Run backend automated tests (30/30 tests pass)
PYTHONPATH=. pytest backend/tests/ -v

# Start the FastAPI server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Set Up and Start React Frontend
In a separate terminal window:
```bash
cd cloud-ops/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
The CloudOps Lab Web Dashboard will be accessible at: [http://localhost:5173](http://localhost:5173).

---

## 7. Automated CI/CD
GitHub Actions workflow `.github/workflows/checks.yml` automatically validates every commit and pull request:
1. Runs Python test suite (`pytest backend/tests/ -v`).
2. Checks Terraform formatting (`terraform fmt -check infrastructure/`).
3. Runs Terraform validation without requiring cloud credentials (`terraform init -backend=false && terraform validate`).

---

## 8. Safe Cleanup & Teardown
To ensure zero residual cloud costs:
1. From the Web Dashboard, go to **Terraform Runner** -> click **Destroy Infrastructure** -> type `CONFIRM_DESTROY`.
2. Or via CLI:
   ```bash
   cd infrastructure
   terraform destroy -auto-approve
   ```
3. Consult [`docs/cost-and-cleanup.md`](docs/cost-and-cleanup.md) for post-cleanup verification commands.

---

## 9. Team Work Allocation (Section 7)

| Team Member | Primary Ownership | Deliverables |
|---|---|---|
| **Member 1** — Cloud & Terraform | Network Design & IaC | `versions.tf`, `provider.tf`, `variables.tf`, `networking.tf`, `security.tf`, `outputs.tf` |
| **Member 2** — Backend API | Python / FastAPI | `main.py`, `schemas.py`, `network.py`, `diagnostics.py`, `terraform_runner.py` |
| **Member 3** — Frontend UI | React + Vite UI | Dashboard, Network Planner, Visual Topology, Terminal Console, Fault Lab |
| **Member 4** — Security, Testing & Docs | QA, CI & Documentation | `pytest` test suite, `.github/workflows/checks.yml`, Architecture docs, Viva Guide |
