# CloudOps Lab Architecture & Technical Design

## 1. Executive Overview
CloudOps Lab is an educational and junior-engineer troubleshooting platform for AWS networking and Infrastructure-as-Code (Terraform). The system bridges the gap between theoretical cloud networking knowledge and operational diagnostic reality by providing:
1. **Local IPv4 CIDR Planning & Validation** (RFC 1918 compliance, subnet boundary validation, overlap detection, and AWS 5-reserved IP address accounting).
2. **Controlled Terraform Workflows** (sandboxed execution of `fmt`, `init`, `validate`, `plan`, `apply`, and `destroy` with explicit safety approvals).
3. **Structured Diagnostics Engine** (10-point diagnostic catalogue covering static, IaC syntax, drift, AWS configuration, and live reachability).
4. **Controlled Fault-Injection & Recovery Lab** (intentional failure injection for missing security group rules, detached IGWs, missing default routes, and CIDR overlaps).

---

## 2. Component Topology

```
   ┌──────────────────────────────────────────────────────────────┐
   │                   Web Browser (React UI)                     │
   │  • CIDR Designer & Live Visualizer                           │
   │  • Terraform Workflow Terminal & Safety Confirmation Modals  │
   │  • Diagnostics Hub & Structured Evidence Drawer              │
   │  • Controlled Misconfiguration & Recovery Playground         │
   │  • Viva & Technical Knowledge Reference Guide                │
   └──────────────────────────────┬───────────────────────────────┘
                                  │ JSON via HTTP (REST)
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                  FastAPI Backend Service                     │
   │  • Pydantic Schema Validation & Sanitization                 │
   │  • Python `ipaddress` Subnet Mathematics Engine              │
   │  • Security-Hardened Terraform Subprocess Runner             │
   │  • Multi-Tier Diagnostic Suite (Static, CLI, AWS, Live)     │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│     Terraform Engine         │          │   AWS Cloud (or Simulation)  │
│  • infrastructure/*.tf       │          │  • VPC (10.0.0.0/16)         │
│  • Process allowlist         │          │  • Public Subnet (10.0.1.0)  │
│  • Sandboxed .tfvars.json    │          │  • Private Subnet (10.0.2.0) │
│  • Auto-approve guardrails   │          │  • Internet Gateway (IGW)    │
└──────────────────────────────┘          │  • Public Route Table        │
                                          │  • Web Security Group        │
                                          └──────────────────────────────┘
```

---

## 3. Network Architecture & Packet Path

### AWS VPC Layout
- **VPC CIDR**: `10.0.0.0/16` (65,536 total addresses).
- **Public Subnet**: `10.0.1.0/24` (256 addresses; 251 usable after AWS 5-reserved IPs: `.0` network, `.1` VPC router, `.2` DNS, `.3` reserved for future, `.255` broadcast). `map_public_ip_on_launch = true`.
- **Private Subnet**: `10.0.2.0/24` (256 addresses; 251 usable). `map_public_ip_on_launch = false`.
- **Internet Gateway (IGW)**: Horizontally scaled, redundant VPC component that enables communication between VPC instances and the Internet without availability risks or bandwidth constraints.
- **Public Route Table**: Contains local route (`10.0.0.0/16 -> local`) and default route (`0.0.0.0/0 -> igw`).
- **Private Route Table**: Isolated; contains only `10.0.0.0/16 -> local`. No direct internet egress, preventing accidental data exposure.

### Packet Path: Inbound Web Traffic (HTTPS / TCP 443)
1. **Source**: An internet client initiates a TCP SYN packet towards the public IP assigned to the resource in the Public Subnet.
2. **Internet Gateway**: Receives the packet, performs Destination 1:1 NAT (translating the Public IPv4 address to the instance's private IPv4 address `10.0.1.x`), and injects it into the VPC network fabric.
3. **Route Table**: The VPC router checks the destination IP `10.0.1.x`. Since it matches the VPC local route `10.0.0.0/16`, traffic is routed directly to the public subnet.
4. **Network ACL (Subnet Level)**: Stateless firewall evaluates inbound rules. Default AWS NACL allows all inbound and outbound traffic.
5. **Security Group (Instance/Interface Level)**: Stateful firewall evaluates inbound rules. Checks `cloudops-lab-web-sg` for TCP port 443 authorization from the client's CIDR.
   - *If rule is present*: Packet is accepted and delivered to the instance operating system.
   - *If rule is missing (SG-001 fault scenario)*: Packet is dropped silently at the virtual network interface (ENI); client experiences connection timeout.
6. **Return Traffic**: Because Security Groups are **stateful**, return response traffic is automatically allowed regardless of outbound security group rules.

---

## 4. Security & Hardening Architecture

### A. Subprocess Sandboxing & Injection Prevention
- **No `shell=True`**: All subprocess invocations use explicit argument lists passed directly to `execve`.
- **Command Allowlist**: Only predefined commands are recognized:
  `["fmt_check", "init", "validate", "plan", "apply", "destroy"]`.
- **Directory Jailing**: All Terraform actions are locked to the fixed `infrastructure/` directory. Path traversal is rejected.
- **Variable Sanitization**: Terraform variables are strictly checked against regex patterns (`^[a-zA-Z0-9\.\-\/]+$`) and written to a temporary JSON file. No string interpolation into command flags is permitted.
- **Resource Limits**: Fixed timeout (120 seconds) and stdout/stderr capture buffer capping (100 KB) prevent CPU exhaustion and memory leaks.

### B. Destructive Operation Guardrails
- `terraform apply` requires the explicit confirmation token `CONFIRM_APPLY`.
- `terraform destroy` requires the explicit confirmation token `CONFIRM_DESTROY`.
- API endpoints return HTTP 400 with descriptive error details if confirmation is absent.

### C. AWS Credentials Protection
- Zero browser credential exposure: No AWS Access Keys or Secrets are transmitted to or stored in the frontend.
- Backend leverages standard AWS credential chains (environment variables, AWS CLI config profiles, or IAM Instance Profiles).
- Git repository excludes all `.tfstate`, `*.tfvars`, `.env`, `.terraform/`, and key files via comprehensive `.gitignore`.

---

## 5. Diagnostic Catalogue Matrix

| Check ID | Tier | Target | Failure Indicator | Limitation Note |
|---|---|---|---|---|
| **CIDR-001** | Static | IPv4 Syntax | Malformed string or host bits set | Does not imply AWS cloud limits are met. |
| **CIDR-002** | Static | VPC Containment | Subnet outside VPC range | IPv4-only in v1. |
| **CIDR-003** | Static | Subnet Overlap | Overlapping address blocks | AWS subnet constraints still apply. |
| **RT-001** | AWS Config | Public Route Table | Missing `0.0.0.0/0 -> igw` | Route presence alone does not prove reachability. |
| **IGW-001** | AWS Config | Internet Gateway | Detached or non-existent IGW | Attachment alone does not make instances public. |
| **SG-001** | AWS Config | Web Security Group | Missing port 80 or 443 | OS firewall (iptables) may still block traffic. |
| **PUB-001** | AWS Config | Subnet Addressing | Public subnet has auto-IP disabled | Public IP alone does not guarantee open ports. |
| **TF-001** | Local CLI | Terraform Engine | Syntax or provider error | Does not prove cloud IAM permissions. |
| **DRIFT-001** | Plan Review | Cloud State vs IaC | Unplanned changes detected | Manual emergency fixes should not be reverted blindly. |
| **CONN-001** | Live Test | TCP Reachability | Socket timeout or connection refused | Timeouts can result from ISP, local firewalls, or cloud ACLs. |
