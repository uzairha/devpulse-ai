# ---------------------------------------------------------------------------
# General
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name. Used in resource names and tags."
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Short project identifier used as a prefix for every resource name."
  type        = string
  default     = "devpulse"
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across. RDS requires at least 2 for its DB subnet group."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2
    error_message = "az_count must be at least 2 - RDS and ElastiCache both require a subnet group spanning 2+ AZs."
  }
}

variable "enable_nat_gateway" {
  description = <<-EOT
    Whether to create a NAT Gateway for private-subnet egress.

    true  - ECS tasks run in private subnets and reach the internet (GitHub API,
            OpenAI API) through a single NAT Gateway. Standard production
            posture, but the NAT Gateway itself costs roughly $32/month plus
            data processing charges even while idle - by far the largest fixed
            cost in this architecture.
    false - ECS tasks run in the public subnets instead, with security groups
            still restricting inbound traffic to the ALB only (a public IP
            address is not the same as an open port). No NAT Gateway is
            created. This is the cheaper option for a short-lived portfolio
            deployment and is the default in terraform.tfvars.example.

    RDS and ElastiCache always stay in the private subnets regardless of this
    setting - they never need a route to the internet, only reachability from
    the application tier within the VPC.
  EOT
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# ECR
# ---------------------------------------------------------------------------

variable "ecr_image_retention_count" {
  description = "Number of most-recent tagged images to retain per ECR repository before older ones are expired."
  type        = number
  default     = 10
}

variable "bootstrap_image_tag" {
  description = <<-EOT
    Tag of the one image pushed by hand before the first `terraform apply`, used
    as each task definition's image when backend_image/frontend_image are not
    set. A task definition must name some image at apply time, and the
    repositories are IMMUTABLE (see ecr.tf), so a moving ":latest" tag is not
    available to fall back on - the deploy workflow could only ever write it
    once. Every subsequent deploy replaces this with an immutable "sha-<commit>"
    tag rendered into the task definition by .github/workflows/deploy-aws.yml,
    so this tag is only ever read on the very first apply. See
    docs/aws-deployment.md for the bootstrap push.
  EOT
  type        = string
  default     = "bootstrap"
}

# ---------------------------------------------------------------------------
# Load balancer / TLS
# ---------------------------------------------------------------------------

variable "certificate_arn" {
  description = <<-EOT
    ACM certificate ARN for the HTTPS listener. Leave empty to deploy with an
    HTTP-only listener - the default, since HTTPS requires a real domain
    pointed at the ALB, which this milestone deliberately does not require.
    See docs/aws-deployment.md for how to add ACM + HTTPS later.
  EOT
  type        = string
  default     = ""
}

variable "app_domain" {
  description = <<-EOT
    Public domain name the application will be served from once DNS is
    pointed at the ALB (e.g. devpulse.example.com). Leave empty to fall back
    to the ALB's own DNS name for CLIENT_URL / GitHub OAuth callback URLs -
    fine for testing, but GitHub OAuth apps need a stable callback URL, so a
    real domain is expected before GitHub login is wired up for real.
  EOT
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# ECS - shared
# ---------------------------------------------------------------------------

variable "log_retention_days" {
  description = "CloudWatch Logs retention period, in days, for each service's log group."
  type        = number
  default     = 14
}

variable "container_insights_enabled" {
  description = "Enable ECS Container Insights on the cluster. Off by default - it bills separately per metric."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# ECS - backend (API) service
# ---------------------------------------------------------------------------

variable "backend_image" {
  description = "Full ECR image URI (repository:tag) for the backend/API container. Placeholder until the first image is built and pushed - see docs/aws-deployment.md."
  type        = string
  default     = ""
}

variable "backend_container_port" {
  description = "Port the backend container listens on."
  type        = number
  default     = 3001
}

variable "backend_cpu" {
  description = "Fargate task-level vCPU units for the backend service (1024 = 1 vCPU)."
  type        = number
  default     = 256
}

variable "backend_memory" {
  description = "Fargate task-level memory, in MiB, for the backend service."
  type        = number
  default     = 512
}

variable "backend_desired_count" {
  description = "Desired number of running backend tasks."
  type        = number
  default     = 1
}

# ---------------------------------------------------------------------------
# ECS - frontend (nginx/SPA) service
# ---------------------------------------------------------------------------

variable "frontend_image" {
  description = "Full ECR image URI (repository:tag) for the frontend container. Placeholder until the first image is built and pushed."
  type        = string
  default     = ""
}

variable "frontend_container_port" {
  description = "Port the frontend container listens on."
  type        = number
  default     = 8080
}

variable "frontend_cpu" {
  description = "Fargate task-level vCPU units for the frontend service."
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Fargate task-level memory, in MiB, for the frontend service."
  type        = number
  default     = 512
}

variable "frontend_desired_count" {
  description = "Desired number of running frontend tasks."
  type        = number
  default     = 1
}

# ---------------------------------------------------------------------------
# ECS - worker (BullMQ background jobs) service
# ---------------------------------------------------------------------------
# No dedicated worker_image variable: the worker runs the backend image with
# its command overridden to `node src/worker.js`. See server/Dockerfile and
# docs/aws-deployment.md for why one image serves both services.

variable "worker_cpu" {
  description = "Fargate task-level vCPU units for the worker service."
  type        = number
  default     = 256
}

variable "worker_memory" {
  description = "Fargate task-level memory, in MiB, for the worker service."
  type        = number
  default     = 512
}

variable "worker_desired_count" {
  description = "Desired number of running worker tasks. BullMQ's repeatable-job registration is idempotent per jobId, so this can safely be more than 1."
  type        = number
  default     = 1
}

# ---------------------------------------------------------------------------
# Application secrets
# ---------------------------------------------------------------------------
# (moved below, near secrets.tf's resources - see the "Secrets Manager"
# section further down this file)

# ---------------------------------------------------------------------------
# RDS (PostgreSQL)
# ---------------------------------------------------------------------------

variable "db_engine_version" {
  description = "PostgreSQL major/minor version. Kept in step with the version docker-compose.yml's `db` service runs locally (postgres:15-alpine), so behavior matches between environments."
  type        = string
  default     = "15.8"
}

variable "db_instance_class" {
  description = "RDS instance class. db.t4g.micro is the smallest Graviton (ARM) burstable class - reasonable for a demo-scale deployment, not for production traffic."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage, in GiB. 20 GiB is the RDS minimum for PostgreSQL."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Initial database name created on the RDS instance."
  type        = string
  default     = "devpulse"
}

variable "db_username" {
  description = "Master username for the RDS instance. The master password is not a variable - it is generated by Terraform and stored directly in Secrets Manager, so it never appears in a .tfvars file or in state as a value you typed. See secrets.tf."
  type        = string
  default     = "devpulse_admin"
}

variable "db_multi_az" {
  description = "Whether to run RDS Multi-AZ (a synchronous standby in a second AZ for automatic failover). Off by default - it roughly doubles the RDS cost for a failure mode a portfolio deployment does not need to survive."
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Automated backup retention period, in days. 0 disables automated backups entirely - the cheapest option for a throwaway demo, since the seed data is trivially reproducible with `npm run seed`."
  type        = number
  default     = 0
}

variable "db_deletion_protection" {
  description = "Whether to enable RDS deletion protection. Off by default so `terraform destroy` (see docs/aws-deployment.md) can tear the instance down without a manual override."
  type        = bool
  default     = false
}

variable "db_skip_final_snapshot" {
  description = "Whether to skip the final snapshot on deletion. true by default to match db_deletion_protection=false - a portfolio deployment's data is not worth paying to retain after `terraform destroy`."
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# ElastiCache (Redis)
# ---------------------------------------------------------------------------

variable "redis_engine_version" {
  description = "Redis engine version. Kept in step with docker-compose.yml's `redis` service (redis:7-alpine)."
  type        = string
  default     = "7.1"
}

variable "redis_node_type" {
  description = "ElastiCache node type. cache.t4g.micro is the smallest Graviton burstable class."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes. 1 = no replication, the cheapest option; BullMQ and the app's cache layer both tolerate a cold cache after a restart."
  type        = number
  default     = 1
}

# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------

variable "s3_force_destroy" {
  description = "Whether `terraform destroy` may delete the S3 bucket even if it still contains objects. true by default for a portfolio deployment where nothing stored is precious; set false once the bucket holds anything worth protecting from an accidental destroy."
  type        = bool
  default     = true
}

variable "s3_lifecycle_expiration_days" {
  description = "Number of days after which objects under the uploads/ prefix are automatically deleted. Keeps demo storage costs from growing unbounded; raise or remove for real production use."
  type        = number
  default     = 90
}

# ---------------------------------------------------------------------------
# Secrets Manager
# ---------------------------------------------------------------------------
# DATABASE_URL, REDIS_URL and JWT_SECRET are generated by Terraform itself
# (see secrets.tf) and need no variable - there is nothing for a human to
# type. The four below are credentials that only exist outside this
# configuration - an OpenAI account, a GitHub OAuth App - so Terraform cannot
# generate them; they must be supplied. All four default to empty and are
# marked sensitive so a `tofu plan`/`apply` never prints their value to the
# console. Real values belong in terraform.tfvars, which is gitignored - see
# terraform.tfvars.example.

variable "openai_api_key" {
  description = "OpenAI API key, from platform.openai.com. Required for the AI-generated insights and weekly report narratives to work; the app boots and serves everything else without it."
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_client_id" {
  description = "GitHub OAuth App client ID, from github.com/settings/developers. Required for GitHub login."
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_client_secret" {
  description = "GitHub OAuth App client secret."
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_webhook_secret" {
  description = "Shared secret configured on the GitHub OAuth App's webhook, used to verify incoming webhook payload signatures."
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_recovery_window_days" {
  description = "Days Secrets Manager retains a deleted secret before permanently removing it (0-30; 0 deletes immediately). 0 by default so a `terraform destroy` (see docs/aws-deployment.md) leaves nothing behind still being billed."
  type        = number
  default     = 0
}

# ---------------------------------------------------------------------------
# CloudWatch alarms
# ---------------------------------------------------------------------------

variable "enable_alarms" {
  description = "Whether to create CloudWatch alarms (unhealthy ALB targets, elevated 5xx rate, high ECS/RDS CPU). Off by default - alarms with no SNS subscriber are silent and still bill per alarm-month; enable once there is somewhere for them to notify. See docs/aws-deployment.md."
  type        = bool
  default     = false
}

variable "alarm_actions" {
  description = "ARNs (typically an SNS topic) to notify when an alarm fires. Ignored entirely when enable_alarms is false."
  type        = list(string)
  default     = []
}
