# CloudOps Lab - Viva & Interview Preparation Guide (Section 18)

This comprehensive guide prepares all 4 team members to excel in academic viva, technical evaluations, and DevOps interviews.

---

### 1. Networking Fundamentals
#### Q: What is IPv4 and what does `/24` mean?
- **IPv4**: A 32-bit binary addressing scheme representing network devices, structured as four 8-bit octets separated by dots (e.g. `192.168.1.1`).
- **CIDR Prefix `/24`**: Represents the **Classless Inter-Domain Routing** prefix length. The number after the slash indicates that the first 24 bits are fixed as the **Network ID**, leaving `32 - 24 = 8` bits for **Host IDs**.
- **Host Count**: $2^8 = 256$ total IPv4 addresses. In standard networking, $256 - 2 = 254$ usable hosts. In an AWS VPC, AWS reserves 5 addresses, leaving $256 - 5 = 251$ usable addresses.

#### Q: Why can CIDRs overlap, and why does AWS forbid it in a VPC?
- CIDRs overlap when one address block contains or intersects the IP range of another (e.g. `10.0.1.0/24` and `10.0.1.128/25`).
- In an AWS VPC, all subnets share the VPC internal router. If two subnets overlapped, the router's routing table would encounter duplicate destination routes for the same IP, causing non-deterministic packet delivery. Therefore, AWS strictly mandates mutually disjoint subnets.

---

### 2. AWS Networking Architecture
#### Q: What is a VPC?
- An **Amazon Virtual Private Cloud (VPC)** is a logically isolated virtual network dedicated to your AWS account. It closely resembles a traditional on-premises data center network with scalable AWS cloud infrastructure.

#### Q: What makes a subnet "public"?
- A subnet is **NOT** public simply because its name says "public". A subnet is technically public if and only if:
  1. It is associated with a route table containing a default route (`0.0.0.0/0`) targeting an attached **Internet Gateway (IGW)**.
  2. Instances launched in the subnet receive a **Public IPv4 address** (either automatically via `map_public_ip_on_launch = true` or via Elastic IP).
  3. Security Groups and NACLs permit inbound/outbound external traffic.

#### Q: What does an Internet Gateway (IGW) do?
- An IGW is a managed, horizontally scalable, redundant software component in AWS that provides two core functions:
  1. Targets in VPC route tables for internet-routable traffic.
  2. Performs **Network Address Translation (1:1 NAT)** between private IPv4 addresses and public IPv4 addresses assigned to instances.

---

### 3. Routing & Packet Decisions
#### Q: What does `0.0.0.0/0` mean?
- `0.0.0.0/0` represents the default route covering all possible IPv4 addresses (CIDR prefix length 0 means zero bits are fixed). It serves as the "route of last resort" when no more specific route matches a packet's destination IP.

#### Q: How does route selection work at a high level?
- AWS VPC route tables use **Longest Prefix Match (Most Specific Match)**.
- If a route table contains `10.0.0.0/16 -> local` and `0.0.0.0/0 -> igw`, traffic destined for `10.0.1.5` matches `/16` (16 fixed bits) vs `/0` (0 fixed bits). The VPC router selects the `/16` route and keeps traffic within the VPC. Any packet destined for a public IP (e.g. `8.8.8.8`) falls through to `/0` and exits through the IGW.

---

### 4. Security Controls
#### Q: How are Security Groups different from Network ACLs (NACLs)?
| Feature | Security Group (SG) | Network ACL (NACL) |
|---|---|---|
| **Level** | Instance / Network Interface (ENI) level | Subnet level boundary |
| **Statefulness** | **Stateful**: Inbound responses automatically allowed out; outbound requests automatically allowed back in | **Stateless**: Inbound and outbound traffic must be explicitly permitted with separate rules |
| **Rule Type** | **Allow only** (no deny rules) | **Allow and Deny** rules supported |
| **Evaluation Order** | All rules evaluated simultaneously before traffic is allowed | Evaluated sequentially in ascending numerical rule order (first match wins) |

#### Q: Why avoid opening SSH (`0.0.0.0/0:22`) to the world?
- Port 22 open to `0.0.0.0/0` exposes the server to continuous automated brute-force password cracking, credential stuffing, and unpatched SSH daemon zero-day exploits. Best practice is to restrict SSH to a specific bastion IP or use **AWS Systems Manager (SSM) Session Manager**, which requires no open inbound ports or public IPs at all!

---

### 5. Terraform Lifecycle & State Management
#### Q: What do `init`, `fmt`, `validate`, `plan`, `apply`, and `destroy` do?
- **`terraform init`**: Downloads required provider plugins (e.g. `hashicorp/aws`) and initializes backend state storage.
- **`terraform fmt`**: Formats configuration files according to canonical HCL conventions.
- **`terraform validate`**: Verifies syntax, attribute names, and variable types without making cloud API calls.
- **`terraform plan`**: Refreshes state against cloud APIs, compares desired state in `.tf` files with actual state, and generates an execution diff.
- **`terraform apply`**: Executes the planned changes to create, update, or delete cloud resources.
- **`terraform destroy`**: Reverses the infrastructure, deleting all resources managed by the state file.

#### Q: Why does Terraform need state? What happens if state is lost?
- Terraform state (`terraform.tfstate`) maps declarative HCL resources to real-world cloud resource IDs (e.g. `aws_vpc.lab_vpc` -> `vpc-0123456789abcdef0`), records metadata, and tracks resource dependencies.
- If state is lost or corrupted, Terraform can no longer track existing resources. Running `apply` will attempt to recreate them, causing name/CIDR conflicts, or orphan real cloud resources that continue generating unexpected cloud charges.

#### Q: What is Drift?
- **Drift** occurs when cloud resources are modified outside Terraform (e.g. an engineer manually deletes a security group rule in the AWS Console). Running `terraform plan` refreshes state against AWS, detects the discrepancy, and plans to restore the desired state declared in the code.

---

### 6. Security Design & Command Injection Prevention
#### Q: How does the CloudOps Lab backend prevent arbitrary command execution?
1. **No `shell=True`**: All executions use `subprocess.run(["terraform", action, ...], shell=False)`. This ensures user input cannot escape into a shell subshell (e.g., `; rm -rf /` or `&& cat /etc/passwd`).
2. **Process Allowlist**: The runner only permits a fixed whitelist of actions: `["fmt_check", "init", "validate", "plan", "apply", "destroy"]`.
3. **Pydantic Validation**: Subnet names and CIDRs are validated against strict regex and `ipaddress.IPv4Network`.
4. **Directory Jailing**: Execution is constrained to `Path(__file__).parent.parent.parent / "infrastructure"`.

---

### 7. Diagnostics & Scientific Method
#### Q: What evidence supports a missing HTTPS rule finding (`SG-001`), and what can it NOT prove?
- **Observed Evidence**: The AWS API response for `DescribeSecurityGroups` shows authorization for port 80, but no matching rule with `FromPort: 443, ToPort: 443, IpProtocol: tcp`.
- **What it CANNOT prove**: It cannot prove that adding the security group rule will guarantee HTTP 200 responses. The web application process (e.g. Nginx) might not be running or listening on 443, an OS firewall (like `iptables` or `ufw`) may be active, the SSL certificate could be expired, or DNS could fail to resolve. Diagnostics report configuration evidence, not absolute root-cause certainty.

---

### 8. Cost Management
#### Q: What can still cost money after an EC2 instance is stopped?
- **EBS Volumes**: Stopped EC2 instances retain their Amazon EBS root and data volumes, which incur monthly storage charges (e.g. $0.08/GB-month for gp3).
- **Public IPv4 Addresses**: Unattached Elastic IPs or reserved public IPv4 addresses incur $0.005/hour.
- **Snapshots**: Any AMI or EBS snapshots created from the instance incur S3 storage fees until deleted.
