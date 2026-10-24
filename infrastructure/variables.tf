variable "aws_region" {
  type        = string
  description = "AWS region for lab deployment"
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type        = string
  description = "IPv4 CIDR block for the lab VPC"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid IPv4 CIDR block (e.g. 10.0.0.0/16)."
  }
}

variable "public_subnet_cidr" {
  type        = string
  description = "IPv4 CIDR block for the public subnet"
  default     = "10.0.1.0/24"

  validation {
    condition     = can(cidrhost(var.public_subnet_cidr, 0))
    error_message = "public_subnet_cidr must be a valid IPv4 CIDR block (e.g. 10.0.1.0/24)."
  }
}

variable "private_subnet_cidr" {
  type        = string
  description = "IPv4 CIDR block for the private subnet"
  default     = "10.0.2.0/24"

  validation {
    condition     = can(cidrhost(var.private_subnet_cidr, 0))
    error_message = "private_subnet_cidr must be a valid IPv4 CIDR block (e.g. 10.0.2.0/24)."
  }
}

variable "availability_zone" {
  type        = string
  description = "Availability zone to place subnets"
  default     = "us-east-1a"
}

variable "allowed_ingress_cidrs" {
  type        = list(string)
  description = "Allowed CIDR blocks for HTTP/HTTPS ingress into the web security group"
  default     = ["0.0.0.0/0"]
}

# Fault injection / controlled test flags (for intentional failure scenarios)
variable "enable_https_ingress" {
  type        = bool
  description = "Toggle HTTPS (port 443) ingress rule for intentional failure testing"
  default     = true
}

variable "attach_internet_gateway" {
  type        = bool
  description = "Toggle Internet Gateway attachment to test route/IGW diagnostics"
  default     = true
}
