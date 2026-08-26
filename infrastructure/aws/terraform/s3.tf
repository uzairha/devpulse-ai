# S3 - object storage for future production file and log uploads.
#
# Nothing in the application uploads files today (confirmed against the
# codebase - there is no multer/upload middleware anywhere in server/src).
# This bucket exists so that when that need arises, uploads go to S3 rather
# than the ECS task's own ephemeral, non-persistent filesystem, which is
# wiped on every deploy and every task restart. Not created by this
# configuration - see the standing no-provisioning policy in the repository
# root README.
#
# Expected integration: the backend task role (granted read/write below)
# would use the AWS SDK's S3 client with no explicit credentials - Fargate
# injects them automatically from the task role - to PutObject under the
# uploads/ prefix and either stream the object back through the API or
# return a pre-signed GET URL. No new secret is needed for this: IAM role
# credentials are how the app would authenticate to S3, not an access key.

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "uploads" {
  # S3 bucket names are globally unique across all of AWS, not just this
  # account - the random suffix avoids a name collision with some unrelated
  # AWS customer's already-taken bucket name.
  bucket        = "${local.name_prefix}-uploads-${random_id.bucket_suffix.hex}"
  force_destroy = var.s3_force_destroy

  tags = {
    Name = "${local.name_prefix}-uploads"
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    # bucket_key_enabled is deliberately omitted: it only reduces KMS API
    # call costs and has no effect under SSE-S3 (AES256) - it would be a
    # no-op here, not the "extra hardening" it might look like.
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "expire-uploads"
    status = "Enabled"

    filter {
      prefix = "uploads/"
    }

    expiration {
      days = var.s3_lifecycle_expiration_days
    }

    # Versioning is on, so a deleted object's prior versions would otherwise
    # accumulate (and keep billing) forever without this.
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# --- Task role access ---------------------------------------------------------
# Scoped to this one bucket, and only to the uploads/ prefix within it - not
# s3:* / resource "*". Only the backend and worker task roles get this; the
# frontend has no task role at all (see iam.tf).

data "aws_iam_policy_document" "s3_uploads_access" {
  statement {
    sid = "ReadWriteUploadsPrefix"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.uploads.arn}/uploads/*"]
  }

  statement {
    sid       = "ListBucketUploadsPrefix"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.uploads.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["uploads/*"]
    }
  }
}

resource "aws_iam_role_policy" "backend_s3_access" {
  name   = "${local.name_prefix}-backend-s3-access"
  role   = aws_iam_role.backend_task.id
  policy = data.aws_iam_policy_document.s3_uploads_access.json
}

resource "aws_iam_role_policy" "worker_s3_access" {
  name   = "${local.name_prefix}-worker-s3-access"
  role   = aws_iam_role.worker_task.id
  policy = data.aws_iam_policy_document.s3_uploads_access.json
}
