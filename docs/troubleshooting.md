# CloudOps Lab - Troubleshooting Guide

This guide outlines common networking faults, diagnosis steps, and remediation workflows for the CloudOps Lab environment.

---

## 1. Scenario: Web Server Inaccessible on Port 443 (HTTPS)
### Symptom
A client sends an HTTPS request to an instance in the public subnet, but the connection times out with `ERR_CONNECTION_TIMED_OUT`.

### Diagnostic Workflow
1. Navigate to the **Diagnostics Hub** and click **Run Diagnostics**.
2. Locate check **`SG-001` (Security Group Inbound Ingress Rules)**.
3. Observe finding status: `FAIL (Severity: HIGH)`.
4. **Evidence Observed**: `Security Group 'cloudops-lab-web-sg' contains rule for TCP port 80, but lacks an inbound rule allowing TCP port 443 (HTTPS).`
5. **Root Cause Analysis**: The Internet Gateway and Route Table are correctly forwarding traffic, but the stateful Security Group drops TCP SYN packets destined for port 443 before they reach the OS stack.

### Remediation
1. In `infrastructure/security.tf`, ensure `enable_https_ingress` is set to `true` (or the dynamic block includes 443).
2. Execute **Terraform Plan** to inspect proposed changes.
3. Execute **Terraform Apply** with confirmation token `CONFIRM_APPLY`.
4. Re-run diagnostics. Verify `SG-001` transitions to `PASS`.

---

## 2. Scenario: Subnet Overlap During Network Expansion
### Symptom
Terraform apply or AWS API returns `InvalidSubnet.Conflict: The CIDR '10.0.1.128/25' conflicts with another existing subnet`.

### Diagnostic Workflow
1. In the **Network Planner**, enter:
   - VPC: `10.0.0.0/16`
   - Subnet A: `10.0.1.0/24`
   - Subnet B: `10.0.1.128/25`
2. Click **Validate Plan**.
3. Observe check **`CIDR-003` (Subnet Non-Overlap Verification)**.
4. **Evidence Observed**: `Subnet overlap detected between 'Subnet A' (10.0.1.0/24) and 'Subnet B' (10.0.1.128/25)`.
5. **Technical Explanation**: `10.0.1.0/24` covers IP addresses `10.0.1.0` through `10.0.1.255`. The range `10.0.1.128/25` (covering `10.0.1.128` to `10.0.1.255`) is a subset of Subnet A. AWS VPC routing tables cannot resolve conflicting subnets within the same VPC.

### Remediation
1. Adjust Subnet B to a distinct range such as `10.0.2.0/24` or `10.0.3.0/24`.
2. Ensure prefix lengths do not intersect.

---

## 3. Scenario: Detached Internet Gateway
### Symptom
Public subnet instances have public IPs assigned and security groups open, but cannot send or receive internet traffic.

### Diagnostic Workflow
1. Check **`IGW-001` (Internet Gateway Attachment)** in the Diagnostics Hub.
2. **Evidence Observed**: `Internet Gateway 'igw-0a1b2c3d4e' state is 'detached' or not associated with VPC`.
3. **Technical Explanation**: An Internet Gateway must be explicitly attached to the target VPC via `aws_internet_gateway` attachment. Without attachment, the gateway cannot translate VPC private IPs to public IPs or route to the AWS edge.

### Remediation
1. In `infrastructure/networking.tf`, verify `aws_internet_gateway.igw` has `vpc_id = aws_vpc.lab_vpc.id`.
2. Apply the configuration.

---

## 4. Scenario: Missing Default Route to Internet Gateway
### Symptom
IGW is attached, but external ping or curl fails immediately with `Network is unreachable`.

### Diagnostic Workflow
1. Run diagnostics and inspect **`RT-001` (Default Route to Internet Gateway)**.
2. **Evidence Observed**: `Route Table 'cloudops-lab-public-rt' has no route matching destination '0.0.0.0/0' targeting 'igw-xxx'`.
3. **Technical Explanation**: Even with an attached IGW, packets do not know how to exit the VPC unless a route entry `0.0.0.0/0 -> igw-xxx` exists in the subnet's associated route table.

### Remediation
1. Add route entry in `infrastructure/networking.tf`:
   ```hcl
   resource "aws_route" "public_internet_access" {
     route_table_id         = aws_route_table.public.id
     destination_cidr_block = "0.0.0.0/0"
     gateway_id             = aws_internet_gateway.igw.id
   }
   ```
2. Run plan and apply.

---

## 5. Scenario: Invalid CIDR Boundary (Host Bits Set)
### Symptom
Subnet creation fails immediately during validation with `CIDR-001: Host bits set in CIDR prefix`.

### Diagnostic Workflow
1. Input a non-boundary CIDR such as `10.0.1.5/24` into the Network Planner or Recovery Engine.
2. Observe finding status: `FAIL (Severity: HIGH)`.
3. **Evidence Observed**: `CIDR '10.0.1.5/24' has host bits set. For prefix /24, host bits must be 0 (e.g., 10.0.1.0/24)`.
4. **Technical Explanation**: In IPv4 CIDR notation, a prefix length of `/24` designates 24 network bits and 8 host bits. Any non-zero bits in the host portion represent an individual IP address, not an allocatable network block.

### Remediation
1. Re-align the base address to the true network boundary `10.0.1.0/24`.

---

## 6. The 7-Step Automated Recovery Workflow

Rather than performing manual investigation across disconnected tools, users can trigger the automated **Recovery Engine**:
1. **Lab Selection**: Load the structured baseline architecture.
2. **Fault Injection**: Introduce any of the 5 reproducible failure scenarios.
3. **Diagnostic Assessment**: Run all 10 checks and collect evidence.
4. **Deterministic RCA**: Generate a root-cause finding with confidence percentage and primary failure layer.
5. **Remediation Review**: Inspect the proposed Terraform HCL diff and security implications.
6. **Recovery Verification**: Apply the fix with confirmation token `CONFIRM_REMEDIATION` and verify that the original finding transitions to `RESOLVED`.
7. **Report Export**: Download the markdown or JSON experiment report.

