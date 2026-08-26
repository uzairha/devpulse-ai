provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "devpulse-ai"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
