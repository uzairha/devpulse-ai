# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (ALB, and ECS tasks when enable_nat_gateway=false)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (RDS, ElastiCache always; ECS tasks when enable_nat_gateway=true)."
  value       = aws_subnet.private[*].id
}

output "nat_gateway_enabled" {
  description = "Whether a NAT Gateway was created for this deployment."
  value       = var.enable_nat_gateway
}

# ---------------------------------------------------------------------------
# Load balancer
# ---------------------------------------------------------------------------

output "alb_dns_name" {
  description = "Public DNS name of the ALB. Point a CNAME/ALIAS record here, or use this directly as the application's URL until a custom domain is configured."
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Route 53 hosted zone ID of the ALB - needed for an ALIAS record if the domain is managed in Route 53."
  value       = aws_lb.main.zone_id
}

output "application_url" {
  description = "Base URL the application is expected to be reachable at (var.app_domain if set, otherwise the ALB's own DNS name over HTTP)."
  value       = local.app_base_url
}

# ---------------------------------------------------------------------------
# ECR
# ---------------------------------------------------------------------------

output "ecr_backend_repository_url" {
  description = "Push backend/worker images here (docker push <this>:<tag>)."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "Push frontend images here."
  value       = aws_ecr_repository.frontend.repository_url
}

# ---------------------------------------------------------------------------
# ECS
# ---------------------------------------------------------------------------

output "ecs_cluster_name" {
  description = "Name of the ECS cluster - used by the deploy workflow to target `aws ecs update-service`."
  value       = aws_ecs_cluster.main.name
}

output "ecs_backend_service_name" {
  value = aws_ecs_service.backend.name
}

output "ecs_frontend_service_name" {
  value = aws_ecs_service.frontend.name
}

output "ecs_worker_service_name" {
  value = aws_ecs_service.worker.name
}

# The three below describe where a task runs, and exist because the deploy
# workflow's migration step launches a one-off task with `aws ecs run-task`,
# which - unlike a service - has no stored network configuration to inherit.
# They resolve to whichever placement enable_nat_gateway selected, so the
# migration task always lands in the same subnets as the services it migrates
# for. See docs/aws-deployment.md.

output "ecs_subnet_ids" {
  description = "Subnets ECS tasks run in. Comma-join these into the ECS_SUBNET_IDS repository variable."
  value       = local.ecs_subnet_ids
}

output "ecs_security_group_id" {
  description = "Security group ECS tasks run under. Set as the ECS_SECURITY_GROUP_ID repository variable."
  value       = aws_security_group.ecs_tasks.id
}

output "ecs_assign_public_ip" {
  description = "Whether an ECS task needs a public IP to reach the internet (true when no NAT Gateway exists). Set as the ECS_ASSIGN_PUBLIC_IP repository variable, uppercased: ENABLED or DISABLED."
  value       = local.ecs_assign_public_ip ? "ENABLED" : "DISABLED"
}

# ---------------------------------------------------------------------------
# IAM
# ---------------------------------------------------------------------------

output "ecs_task_execution_role_arn" {
  description = "Execution role assumed by the ECS agent to pull images, write logs and resolve secrets."
  value       = aws_iam_role.ecs_task_execution.arn
}

# ---------------------------------------------------------------------------
# RDS
# ---------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS connection endpoint (host:port). Marked sensitive - it is internal network topology, not itself a credential, but there is no reason to print it to a terminal or CI log either."
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_instance_identifier" {
  value = aws_db_instance.main.identifier
}

# ---------------------------------------------------------------------------
# ElastiCache
# ---------------------------------------------------------------------------

output "redis_primary_endpoint" {
  description = "ElastiCache primary endpoint (hostname only, no port or AUTH token). Marked sensitive for the same reason as rds_endpoint."
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------

output "s3_uploads_bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}

output "s3_uploads_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}
