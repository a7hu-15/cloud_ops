# ==============================================================================
# CloudOps Lab - Networking Infrastructure
# Safe, minimal, cost-conscious VPC layout for educational troubleshooting.
# ==============================================================================

resource "aws_vpc" "lab_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "cloudops-lab-vpc"
  }
}

# Public Subnet (Intended for public-facing resources)
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.lab_vpc.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = var.availability_zone
  map_public_ip_on_launch = true

  tags = {
    Name = "cloudops-lab-public-subnet"
    Tier = "public"
  }
}

# Private Subnet (Intended for internal-only resources)
resource "aws_subnet" "private" {
  vpc_id                  = aws_vpc.lab_vpc.id
  cidr_block              = var.private_subnet_cidr
  availability_zone       = var.availability_zone
  map_public_ip_on_launch = false

  tags = {
    Name = "cloudops-lab-private-subnet"
    Tier = "private"
  }
}

# Internet Gateway (Conditionally created for fault-injection testing)
resource "aws_internet_gateway" "igw" {
  count  = var.attach_internet_gateway ? 1 : 0
  vpc_id = aws_vpc.lab_vpc.id

  tags = {
    Name = "cloudops-lab-igw"
  }
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.lab_vpc.id

  tags = {
    Name = "cloudops-lab-public-rt"
  }
}

# Default Route to Internet Gateway
resource "aws_route" "public_internet_access" {
  count                  = var.attach_internet_gateway ? 1 : 0
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw[0].id
}

# Public Route Table Association
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Private Route Table (Isolated; no default internet route)
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.lab_vpc.id

  tags = {
    Name = "cloudops-lab-private-rt"
  }
}

# Private Route Table Association
resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private.id
}
