import React, { useState } from 'react';

export default function VivaStudyGuide() {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCards, setExpandedCards] = useState({});

  const toggleCard = (id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const cards = [
    {
      id: 'net-1',
      category: 'Networking',
      question: 'What is IPv4, what does /24 mean, and how is usable IP capacity calculated?',
      answer: 'IPv4 is a 32-bit addressing protocol represented as four 8-bit octets. A /24 CIDR prefix indicates the first 24 bits are the network identifier and the remaining 8 bits are host identifiers, yielding 2^8 = 256 total IP addresses. In standard networking, 254 are usable. However, in AWS VPC subnets, AWS reserves 5 IP addresses (.0 network address, .1 VPC router, .2 Amazon DNS, .3 reserved for future AWS expansion, .255 network broadcast), leaving exactly 251 usable host IPs.'
    },
    {
      id: 'net-2',
      category: 'Networking',
      question: 'Why can CIDR ranges overlap, and why does AWS strictly prohibit overlap inside a VPC?',
      answer: 'CIDRs overlap when one subnet range contains or intersects another (e.g. 10.0.1.0/24 and 10.0.1.128/25). In an AWS VPC, all subnets share the VPC virtual router. Conflicting address spaces would cause routing ambiguity (duplicate destination routes in the VPC routing table), making packet delivery non-deterministic. AWS EC2 APIs enforce mutually disjoint subnets at creation time.'
    },
    {
      id: 'aws-1',
      category: 'AWS Architecture',
      question: 'What is a VPC, and what technically makes an AWS subnet "public"?',
      answer: 'A VPC (Virtual Private Cloud) is a logically isolated virtual network in an AWS region. A subnet is not public simply because of its name. A subnet is technically public if: (1) Its associated route table contains a default route (0.0.0.0/0) pointing to an attached Internet Gateway (IGW); (2) Instances launched in it are allocated a public IPv4 address (auto-assign or Elastic IP); and (3) Network ACLs & Security Groups permit external traffic.'
    },
    {
      id: 'aws-2',
      category: 'AWS Architecture',
      question: 'What is the role of an Internet Gateway (IGW) vs a NAT Gateway?',
      answer: 'An Internet Gateway is a horizontally scalable, redundant VPC software component that provides route targets for internet-bound traffic and performs 1:1 Destination/Source NAT for public instances. A NAT Gateway is a managed service placed in a public subnet that allows instances in private subnets to initiate outbound traffic (e.g., software updates) without allowing incoming connections from the Internet. CloudOps Lab deliberately avoids NAT Gateways in v1 to eliminate its ~$32/month fixed hourly charge.'
    },
    {
      id: 'routing-1',
      category: 'Routing',
      question: 'What does 0.0.0.0/0 mean, and how does AWS route table evaluation work?',
      answer: '0.0.0.0/0 denotes the default route covering all IPv4 addresses with 0 fixed prefix bits. AWS route tables use "Longest Prefix Match" (most specific match). When a packet is evaluated, more specific routes like 10.0.0.0/16 take precedence over 0.0.0.0/0. Therefore, local VPC traffic is routed directly within the VPC, while traffic destined for arbitrary public IPs matches 0.0.0.0/0 and exits via the IGW.'
    },
    {
      id: 'sec-1',
      category: 'Security',
      question: 'How do Security Groups differ from Network ACLs (NACLs)?',
      answer: 'Security Groups are stateful firewalls operating at the instance/ENI level that only support ALLOW rules; return traffic is automatically permitted regardless of outbound rules. Network ACLs are stateless firewalls operating at the subnet boundary that evaluate numbered ALLOW and DENY rules in ascending order, requiring explicit inbound and outbound rules for bidirectional communication.'
    },
    {
      id: 'sec-2',
      category: 'Security',
      question: 'Why should you never expose SSH (0.0.0.0/0:22) to the internet?',
      answer: 'Opening port 22 to 0.0.0.0/0 invites continuous automated dictionary attacks, credential stuffing, and zero-day exploit attempts against the SSH daemon. Best practice is to restrict access to a static bastion IP or use AWS Systems Manager (SSM) Session Manager, which establishes encrypted shell sessions via IAM without requiring open inbound ports, public IPs, or SSH keys.'
    },
    {
      id: 'tf-1',
      category: 'Terraform & IaC',
      question: 'What do init, fmt, validate, plan, apply, and destroy do in Terraform?',
      answer: 'init downloads provider binaries and initializes state. fmt formats HCL code according to canonical standards. validate checks configuration syntax and variable types without contacting AWS. plan queries the cloud API to compute the diff between code and actual infrastructure. apply executes the planned changes against AWS. destroy tears down all resources managed by the state file.'
    },
    {
      id: 'tf-2',
      category: 'Terraform & IaC',
      question: 'Why does Terraform need state, and what is Drift?',
      answer: 'Terraform state (terraform.tfstate) maps declared code blocks to real-world cloud resource IDs and tracks dependencies. If state is lost, Terraform loses track of cloud resources, leading to collision errors or orphaned, billable resources. Drift occurs when an engineer modifies resources out-of-band via the AWS Console; running terraform plan refreshes state and detects discrepancies.'
    },
    {
      id: 'backend-1',
      category: 'Security Design',
      question: 'How does CloudOps Lab backend prevent arbitrary command execution (RCE)?',
      answer: 'The backend enforces strict subprocess sandboxing: (1) It never uses shell=True; all commands are executed via explicit argument arrays passed to execve; (2) A strict allowlist limits execution to predefined subcommands (validate, plan, apply, destroy); (3) Variables are sanitized via regex and written to a JSON file; (4) Destructive commands (apply/destroy) mandate explicit confirmation tokens (CONFIRM_APPLY, CONFIRM_DESTROY).'
    },
    {
      id: 'diag-1',
      category: 'Diagnostics',
      question: 'What evidence supports check SG-001 (missing HTTPS rule), and what does it NOT prove?',
      answer: 'The observed evidence is that DescribeSecurityGroups returns authorization for TCP port 80, but lacks an ingress rule for port 443. However, this is not definitive proof that HTTPS will work once added. The web server process (e.g. Nginx) might not be running, an OS firewall (ufw/iptables) may block port 443, DNS may fail, or the SSL certificate could be expired. Diagnostics report configuration evidence, not guaranteed root cause.'
    },
    {
      id: 'cost-1',
      category: 'Cost Control',
      question: 'What AWS resources still incur costs after an EC2 instance is stopped?',
      answer: 'Stopping an EC2 instance halts hourly compute CPU/RAM charges, but attached Amazon EBS volumes continue to accrue monthly storage fees (~$0.08/GB-month for gp3). Additionally, unattached Elastic IPs or in-use public IPv4 addresses incur $0.005/hour, and EBS snapshots incur S3 storage charges until deleted.'
    }
  ];

  const categories = ['ALL', 'Networking', 'AWS Architecture', 'Routing', 'Security', 'Terraform & IaC', 'Security Design', 'Diagnostics', 'Cost Control'];

  const filteredCards = cards.filter((c) => {
    const matchesCat = activeCategory === 'ALL' || c.category === activeCategory;
    const matchesSearch = c.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.answer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Title & Search Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Engineering Viva & Technical Interview Reference
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 2 }}>
          Section 18 Oral Exam Preparation: Architectural principles, AWS routing behavior, IaC lifecycle, and security design.
        </p>
      </div>

      {/* Search and Category Filters */}
      <div className="console-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            className="input-control font-mono"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search questions and concepts..."
            style={{ maxWidth: 320, height: 34, fontSize: '12.5px' }}
          />

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="btn"
                style={{
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  borderRadius: 4,
                  backgroundColor: activeCategory === cat ? 'var(--accent-primary)' : 'var(--bg-surface-subtle)',
                  color: activeCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                  borderColor: activeCategory === cat ? 'var(--accent-primary)' : 'var(--border-color)'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredCards.map((card) => {
          const isExpanded = !!expandedCards[card.id];
          return (
            <div
              key={card.id}
              className="console-card"
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease'
              }}
              onClick={() => toggleCard(card.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="status-pill status-pill-neutral" style={{ fontSize: '10.5px' }}>
                    {card.category}
                  </span>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {card.question}
                  </h3>
                </div>

                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0, marginLeft: 12 }}>
                  {isExpanded ? 'Hide' : 'Details'}
                </span>
              </div>

              {isExpanded && (
                <div style={{
                  marginTop: 12,
                  padding: '12px 16px',
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6
                }}>
                  <strong style={{ color: 'var(--accent-primary)', display: 'block', fontSize: '12px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Key Architectural Points:
                  </strong>
                  {card.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
