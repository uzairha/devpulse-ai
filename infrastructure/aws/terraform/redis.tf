# ElastiCache Redis.
#
# Always in the private subnets, same reasoning as rds.tf. Deployed as a
# replication group (rather than a standalone cache cluster) specifically
# because AUTH tokens - required so Redis is not reachable by anything that
# merely lands inside the security group with no further credential - are
# only supported on replication groups, even when running as a single node.

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnets"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-redis-subnets"
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "DevPulse Redis - BullMQ queues, application cache"

  engine         = "redis"
  engine_version = var.redis_engine_version
  node_type      = var.redis_node_type
  port           = 6379

  num_cache_clusters = var.redis_num_cache_nodes
  # Failover requires a replica, i.e. at least 2 nodes - stays false at the
  # single-node default and only makes sense once redis_num_cache_nodes > 1.
  automatic_failover_enabled = var.redis_num_cache_nodes > 1

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  # Generated in secrets.tf. TLS is required by ElastiCache whenever an auth
  # token is set, which is exactly why transit_encryption_enabled is also on.
  auth_token = random_password.redis_auth.result

  auto_minor_version_upgrade = true

  tags = {
    Name = "${local.name_prefix}-redis"
  }
}
