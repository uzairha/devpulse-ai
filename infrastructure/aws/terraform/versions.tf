terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # No backend block: state defaults to local, which is the right default for
  # a repository nobody has deployed from yet. A team deployment would move
  # this to an S3 bucket + DynamoDB lock table - see the commented example in
  # docs/aws-deployment.md rather than wiring one up here, since an S3 backend
  # itself needs a bucket to already exist, which this milestone deliberately
  # does not create.
}
