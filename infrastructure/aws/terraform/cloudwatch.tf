# CloudWatch Logs and alarms.
#
# Log groups: one per service, referenced by that service's task definition
# in ecs.tf.
#
# Alarms: created only when var.enable_alarms is true (default false). An
# alarm with nowhere to notify is not "safer to have anyway" - it is a
# per-alarm-month charge with no effect, so it stays off until
# var.alarm_actions actually names somewhere (an SNS topic) to send it. See
# docs/aws-deployment.md for wiring one up.

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}/backend"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-backend-logs"
  }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${local.name_prefix}/frontend"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-frontend-logs"
  }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name_prefix}/worker"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-worker-logs"
  }
}

# --- Alarms ---------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "backend_unhealthy_targets" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-backend-unhealthy-targets"
  alarm_description   = "One or more backend ECS tasks are failing the ALB target group health check."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.backend.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Name = "${local.name_prefix}-backend-unhealthy-targets"
  }
}

resource "aws_cloudwatch_metric_alarm" "frontend_unhealthy_targets" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-frontend-unhealthy-targets"
  alarm_description   = "One or more frontend ECS tasks are failing the ALB target group health check."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.frontend.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Name = "${local.name_prefix}-frontend-unhealthy-targets"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_elevated_5xx" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-alb-elevated-5xx"
  alarm_description   = "The ALB is returning an elevated rate of 5xx responses (from either target or the ALB itself)."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Name = "${local.name_prefix}-alb-elevated-5xx"
  }
}

resource "aws_cloudwatch_metric_alarm" "backend_high_cpu" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-backend-high-cpu"
  alarm_description   = "Backend ECS service CPU utilization is sustained above 80%."
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Name = "${local.name_prefix}-backend-high-cpu"
  }
}

resource "aws_cloudwatch_metric_alarm" "worker_high_cpu" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-worker-high-cpu"
  alarm_description   = "Worker ECS service CPU utilization is sustained above 80% - the BullMQ job queue may be backing up."
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.worker.name
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Name = "${local.name_prefix}-worker-high-cpu"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-high-cpu"
  alarm_description   = "RDS CPU utilization is sustained above 80%."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Name = "${local.name_prefix}-rds-high-cpu"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_high_cpu" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-redis-high-cpu"
  alarm_description   = "ElastiCache CPU utilization is sustained above 80%."
  namespace           = "AWS/ElastiCache"
  metric_name         = "EngineCPUUtilization"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 5
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.main.replication_group_id
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Name = "${local.name_prefix}-redis-high-cpu"
  }
}
