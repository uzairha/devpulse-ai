# RDS PostgreSQL.
#
# Always in the private subnets, regardless of enable_nat_gateway - a
# database never needs a route out to the internet, only reachability from
# the ECS security group within the VPC. Not created by this configuration;
# see the standing no-provisioning policy in the repository root README.

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-db-subnets"
  }
}

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-db"

  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  # Generated in secrets.tf, never typed into a variable or tfvars file -
  # random_password.db_master.result is written directly into both this
  # argument and the database_url secret, so the only place it exists in
  # plaintext is Terraform state (see versions.tf on protecting state).
  password = random_password.db_master.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  # No public subnet placement, no public accessibility - reachable only
  # from inside the VPC, and even then only from the ECS security group.
  publicly_accessible = false

  multi_az                = var.db_multi_az
  backup_retention_period = var.db_backup_retention_days
  # Skipped when backups are already disabled - there would be nothing to
  # apply it to.
  skip_final_snapshot       = var.db_skip_final_snapshot
  final_snapshot_identifier = var.db_skip_final_snapshot ? null : "${local.name_prefix}-db-final-${formatdate("YYYYMMDD-hhmmss", timestamp())}"
  deletion_protection       = var.db_deletion_protection

  auto_minor_version_upgrade = true

  tags = {
    Name = "${local.name_prefix}-db"
  }

  lifecycle {
    ignore_changes = [final_snapshot_identifier]
  }
}
