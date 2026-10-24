provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "cloudops-lab"
      Environment = "educational-lab"
      ManagedBy   = "terraform"
    }
  }
}
