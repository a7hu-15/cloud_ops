# CloudOps Lab - Cost Management & Safe Cleanup Guide

## 1. Cost Consciousness Principles (Section 13)
Cloud networking resources in AWS can incur unexpected hourly and data-transfer charges if not monitored carefully. CloudOps Lab is strictly designed to minimize or completely eliminate ongoing costs:

1. **Zero NAT Gateways**:
   - A single AWS NAT Gateway incurs **~$0.045 per hour (~$32.40/month)** plus $0.045 per GB data processing.
   - CloudOps Lab **deliberately avoids NAT Gateways in Version 1**.
2. **Ephemeral / Optional Test Instances**:
   - Compute resources (EC2) are optional. Even when stopped, EBS volumes attached to stopped instances incur storage fees ($0.08 per GB-month for gp3).
   - In the initial lab design, only core network constructs (VPC, Subnets, Route Tables, Internet Gateway, Security Groups) are provisioned. VPCs and route tables themselves incur **$0.00/hour** in AWS!
3. **Public IPv4 Addressing Fee**:
   - Since February 2024, AWS charges **$0.005/hour per in-use public IPv4 address (~$3.60/month)**.
   - Always run the destroy workflow as soon as lab testing concludes.

---

## 2. Safe Destruction Workflow

### Option A: From CloudOps Lab Web UI
1. Navigate to the **Terraform Workflows** tab.
2. Click **Destroy Infrastructure**.
3. A safety confirmation modal will appear. Review the list of managed resources to be deleted.
4. Type the confirmation phrase **`CONFIRM_DESTROY`** into the box.
5. Click **Execute Safe Teardown**.
6. Review the console logs as Terraform tears down all security groups, route associations, route tables, subnets, IGW, and VPC.

### Option B: From Command Line
```bash
cd infrastructure
terraform destroy -auto-approve
```

---

## 3. Post-Cleanup Verification Checklist (AWS Console / CLI)
Run the following verification commands to ensure zero leftover billable resources in your AWS account:

```bash
# 1. Verify no lingering EC2 instances
aws ec2 describe-instances \
  --filters "Name=tag:Project,Values=cloudops-lab" \
  --query "Reservations[*].Instances[*].[InstanceId,State.Name]" --output table

# 2. Verify no unattached Elastic IPs
aws ec2 describe-addresses \
  --filters "Name=tag:Project,Values=cloudops-lab" \
  --query "Addresses[*].[PublicIp,AllocationId]" --output table

# 3. Verify no remaining Security Groups
aws ec2 describe-security-groups \
  --filters "Name=tag:Project,Values=cloudops-lab" \
  --query "SecurityGroups[*].[GroupId,GroupName]" --output table

# 4. Verify no remaining VPCs
aws ec2 describe-vpcs \
  --filters "Name=tag:Project,Values=cloudops-lab" \
  --query "Vpcs[*].[VpcId,CidrBlock]" --output table
```
