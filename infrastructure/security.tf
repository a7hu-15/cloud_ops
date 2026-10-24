# ==============================================================================
# CloudOps Lab - Security Group Configuration
# Follows AWS security best practices: NO unrestricted SSH (0.0.0.0/0).
# Controlled ingress with optional fault-injection toggle for port 443.
# ==============================================================================

resource "aws_security_group" "web_sg" {
  name        = "cloudops-lab-web-sg"
  description = "Security group for CloudOps Lab test web workloads"
  vpc_id      = aws_vpc.lab_vpc.id

  # Inbound HTTP (port 80)
  ingress {
    description = "Allow inbound HTTP traffic from approved sources"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_ingress_cidrs
  }

  # Inbound HTTPS (port 443) - conditionally toggled for fault-injection testing
  dynamic "ingress" {
    for_each = var.enable_https_ingress ? [443] : []
    content {
      description = "Allow inbound HTTPS traffic from approved sources"
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = var.allowed_ingress_cidrs
    }
  }

  # Outbound traffic (allow outbound HTTP/HTTPS for updates)
  egress {
    description = "Allow outbound HTTPS for secure API/package access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow outbound HTTP for package repositories"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudops-lab-web-sg"
  }
}
